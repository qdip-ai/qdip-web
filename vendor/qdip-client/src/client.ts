import { QdipError, type QdipErrorCode } from './errors';
import { parseCapabilitiesResponse, parseInvokeResponse, parsePluginCatalog, parsePluginCatalogEntry, parsePluginSecurityResult } from './validation';
import type { CapabilitiesResponse, InvokeOptions, InvokeResponse, QdipClientOptions, PluginCatalogEntry, PluginCatalogUpdate, PluginSecurityResult, PluginSourceScanInput, PluginQuarantineInput, PluginApprovalInput } from './types';

const DEFAULT_INVOKE_DEADLINE_MS = 45_000;
const DISCOVERY_DEADLINE_MS = 15_000;

/** Maximum decompressed JSON payload accepted from the gateway (1 MiB). */
const MAX_RESPONSE_BODY_BYTES = 1_048_576;

async function readJsonBounded(response: Response): Promise<unknown> {
  const length = response.headers.get('content-length');
  if (length && /^\d+$/.test(length) && Number(length) > MAX_RESPONSE_BODY_BYTES) {
    await response.body?.cancel().catch(() => undefined);
    throw new QdipError('INVALID_RESPONSE');
  }
  if (!response.body) throw new QdipError('INVALID_RESPONSE');
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let bytes = 0;
  let json = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      // Bound decoded bytes, including chunked responses and decompressed bodies.
      if (bytes > MAX_RESPONSE_BODY_BYTES) throw new QdipError('INVALID_RESPONSE');
      json += decoder.decode(value, { stream: true });
    }
    json += decoder.decode();
    try { return JSON.parse(json) as unknown; }
    catch { throw new QdipError('INVALID_RESPONSE'); }
  } catch (error) {
    if (error instanceof TypeError) throw new QdipError('INVALID_RESPONSE');
    throw error;
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
const safeHeader = (value: string | null): string | undefined => value && value.length <= 128 ? value : undefined;
const hasKey = (key: string | undefined): key is string => typeof key === 'string' && key.trim().length > 0;
const isDuration = (v: number): boolean => Number.isFinite(v) && v > 0 && v <= 120_000;
const isLoopback = (host: string): boolean => host === 'localhost' || host === '127.0.0.1' || host === '[::1]';

function validateOrigin(baseUrl: string, allowInsecureLoopback: boolean): string {
  let u: URL;
  try { u = new URL(baseUrl); } catch { throw new QdipError('CONFIGURATION_ERROR'); }
  if (u.username || u.password || u.search || u.hash || u.pathname !== '/' ||
      (u.protocol !== 'https:' && !(u.protocol === 'http:' && allowInsecureLoopback && isLoopback(u.hostname)))) {
    throw new QdipError('CONFIGURATION_ERROR');
  }
  return u.origin;
}

function httpError(response: Response): QdipError {
  const mapping: Record<number, QdipErrorCode> = {
    401: 'UNAUTHORIZED', 403: 'FORBIDDEN', 400: 'INVALID_REQUEST',
    404: 'INVALID_REQUEST', 409: 'INVALID_REQUEST', 422: 'INVALID_REQUEST',
    429: 'RATE_LIMITED', 503: 'WORKER_UNAVAILABLE', 504: 'GATEWAY_TIMEOUT'
  };
  const code = mapping[response.status] ?? (response.status >= 400 && response.status < 500 ? 'INVALID_REQUEST' : 'HTTP_ERROR');
  return new QdipError(code, {
    httpStatus: response.status,
    retryAfter: safeHeader(response.headers.get('retry-after')),
    diagnosticId: safeHeader(response.headers.get('x-request-id') ?? response.headers.get('x-correlation-id'))
  });
}

function serializeInput(input: Record<string, unknown>): string {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) throw new QdipError('CONFIGURATION_ERROR');
  let body: string | undefined;
  try {
    body = JSON.stringify(input, (_key, value: unknown) => {
      if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('nonfinite');
      return value;
    });
  } catch { throw new QdipError('CONFIGURATION_ERROR'); }
  if (!body || body === '{}' && Object.keys(input).length > 0) throw new QdipError('CONFIGURATION_ERROR');
  return body;
}

export class QdipClient {
  readonly capabilities: { list: (options?: { signal?: AbortSignal; deadlineMs?: number }) => Promise<CapabilitiesResponse> };
  readonly plugins: { invoke: (options: InvokeOptions) => Promise<InvokeResponse> };
  readonly catalog: {
    list: (options?: { signal?: AbortSignal; deadlineMs?: number }) => Promise<PluginCatalogEntry[]>;
    publish: (name: string, change: PluginCatalogUpdate) => Promise<PluginCatalogEntry>;
    scan: (name: string, input: PluginSourceScanInput) => Promise<PluginSecurityResult>;
    quarantine: (name: string, input: PluginQuarantineInput) => Promise<PluginSecurityResult>;
    approve: (name: string, input: PluginApprovalInput) => Promise<PluginSecurityResult>;
  };
  private readonly origin: string;
  private readonly readApiKey: string | undefined;
  private readonly executeApiKey: string | undefined;
  private readonly adminApiKey: string | undefined;
  private readonly defaultDeadlineMs: number;

  constructor(options: QdipClientOptions) {
    if (!options || typeof options.baseUrl !== 'string') throw new QdipError('CONFIGURATION_ERROR');
    this.origin = validateOrigin(options.baseUrl, options.allowInsecureLoopback ?? false);
    if (options.defaultDeadlineMs !== undefined && !isDuration(options.defaultDeadlineMs)) throw new QdipError('CONFIGURATION_ERROR');
    this.defaultDeadlineMs = options.defaultDeadlineMs ?? DEFAULT_INVOKE_DEADLINE_MS;
    this.readApiKey = options.readApiKey;
    this.executeApiKey = options.executeApiKey;
    this.adminApiKey = options.adminApiKey;
    this.capabilities = { list: (params = {}) => this.listCapabilities(params) };
    this.plugins = { invoke: params => this.invoke(params) };
    this.catalog = {
      list: (params = {}) => this.listCatalog(params),
      publish: (name, change) => this.publishCatalog(name, change),
      scan: (name, input) => this.scanPlugin(name, input),
      quarantine: (name, input) => this.quarantinePlugin(name, input),
      approve: (name, input) => this.approvePlugin(name, input),
    };
  }

  private async request<T>(path: string, apiKey: string | undefined, method: 'GET' | 'POST' | 'PUT',
    deadlineMs: number, signal: AbortSignal | undefined, body: string | undefined,
    parser: (value: unknown) => T, actor?: string): Promise<T> {
    if (!hasKey(apiKey) || !isDuration(deadlineMs)) throw new QdipError('CONFIGURATION_ERROR');
    if (signal?.aborted) throw new QdipError('ABORTED');
    const ctrl = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; ctrl.abort(); }, deadlineMs);
    const externalAbort = (): void => ctrl.abort();
    signal?.addEventListener('abort', externalAbort, { once: true });
    try {
      const response = await fetch(this.origin + '/api/v1/' + path, {
        method, headers: { 'x-api-key': apiKey, 'accept': 'application/json', ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...(actor ? { 'X-QDIP-Actor': actor } : {}) }, 
        body, signal: ctrl.signal, redirect: 'error', cache: 'no-store'
      });
      if (!response.ok) {
        const mapped = httpError(response);
        await response.body?.cancel().catch(() => undefined);
        throw mapped;
      }
      let data: unknown;
      try { data = await readJsonBounded(response); }
      catch { if (timedOut) throw new QdipError('DEADLINE_EXCEEDED'); if (signal?.aborted) throw new QdipError('ABORTED'); throw new QdipError('INVALID_RESPONSE'); }
      if (timedOut) throw new QdipError('DEADLINE_EXCEEDED');
      if (signal?.aborted) throw new QdipError('ABORTED');
      return parser(data);
    } catch (error) {
      if (timedOut) throw new QdipError('DEADLINE_EXCEEDED');
      if (signal?.aborted) throw new QdipError('ABORTED');
      if (error instanceof QdipError) throw error;
      throw new QdipError('TRANSPORT_ERROR');
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', externalAbort); }
  }

  private listCapabilities(options: { signal?: AbortSignal; deadlineMs?: number }): Promise<CapabilitiesResponse> {
    return this.request('remote-plugins/capabilities', this.readApiKey, 'GET', options.deadlineMs ?? DISCOVERY_DEADLINE_MS,
      options.signal, undefined, parseCapabilitiesResponse);
  }

  private invoke(options: InvokeOptions): Promise<InvokeResponse> {
    if (!options || typeof options.capabilityId !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/.test(options.capabilityId)) throw new QdipError('CONFIGURATION_ERROR');
    const timeoutSeconds = options.timeoutSeconds ?? 10;
    const capabilityVersion = options.capabilityVersion ?? '1';
    if (!Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0 || timeoutSeconds > 30 ||
        typeof capabilityVersion !== 'string' || capabilityVersion.length < 1 || capabilityVersion.length > 32) throw new QdipError('CONFIGURATION_ERROR');
    const input = JSON.parse(serializeInput(options.input)) as Record<string, unknown>;
    const payload = JSON.stringify({ input, timeout_seconds: timeoutSeconds, capability_version: capabilityVersion });
    return this.request('remote-plugins/' + encodeURIComponent(options.capabilityId) + '/invoke', this.executeApiKey, 'POST',
      options.deadlineMs ?? this.defaultDeadlineMs, options.signal, payload, parseInvokeResponse);
  }
  private listCatalog(options: { signal?: AbortSignal; deadlineMs?: number }): Promise<PluginCatalogEntry[]> {
    return this.request('plugin-publications', this.adminApiKey, 'GET',
      options.deadlineMs ?? DISCOVERY_DEADLINE_MS, options.signal, undefined, parsePluginCatalog);
  }

  private publishCatalog(name: string, update: PluginCatalogUpdate): Promise<PluginCatalogEntry> {
    if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(name) ||
        !update || !Number.isSafeInteger(update.expectedRevision) || update.expectedRevision < 0 ||
        typeof update.published !== 'boolean' ||
        !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(update.capabilityId) ||
        !update.pluginVersion || update.pluginVersion.length > 64 ||
        !/^[A-Za-z0-9@._:-]{1,256}$/.test(update.actor) ||
        (update.displayName !== undefined && (update.displayName.trim().length < 2 || update.displayName.length > 120)) ||
        (update.description !== undefined && update.description.length > 2000) ||
        (update.category !== undefined && !/^[A-Za-z0-9 _.-]{1,64}$/.test(update.category)) ||
        (update.slug !== undefined && (!/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(update.slug) ||
        update.slug.includes('--') || ['admin', 'api', 'new', 'edit', 'plugins', 'settings'].includes(update.slug)))) {
      throw new QdipError('CONFIGURATION_ERROR');
    }
    const payload = serializeInput({
      published: update.published,
      expected_revision: update.expectedRevision,
      capability_id: update.capabilityId,
      plugin_version: update.pluginVersion,
      ...(update.displayName !== undefined ? { display_name: update.displayName } : {}),
      ...(update.description !== undefined ? { description: update.description } : {}),
      ...(update.category !== undefined ? { category: update.category } : {}),
      ...(update.slug !== undefined ? { slug: update.slug } : {}),
    });
    return this.request('plugin-publications/' + encodeURIComponent(name), this.adminApiKey,
      'PUT', update.deadlineMs ?? DISCOVERY_DEADLINE_MS, update.signal, payload,
      parsePluginCatalogEntry, update.actor);
  }

  private validateSecurityRequest(name: string, revision: number, version: string, actor: string): void {
    if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(name) ||
        !Number.isSafeInteger(revision) || revision < 0 ||
        typeof version !== 'string' || version.length < 1 || version.length > 64 ||
        typeof actor !== 'string' || !/^[A-Za-z0-9@._:-]{1,256}$/.test(actor))
      throw new QdipError('CONFIGURATION_ERROR');
  }

  private scanPlugin(name: string, input: PluginSourceScanInput): Promise<PluginSecurityResult> {
    if (!input) throw new QdipError('CONFIGURATION_ERROR');
    this.validateSecurityRequest(name, input.expectedRevision, input.pluginVersion, input.actor);
    if (!['python', 'javascript', 'typescript', 'shell'].includes(input.language) ||
        typeof input.sourceCode !== 'string' ||
        new TextEncoder().encode(input.sourceCode).length < 1 ||
        new TextEncoder().encode(input.sourceCode).length > 32768)
      throw new QdipError('CONFIGURATION_ERROR');
    return this.request('plugin-publications/' + encodeURIComponent(name) + '/security/scan',
      this.adminApiKey, 'POST', input.deadlineMs ?? DISCOVERY_DEADLINE_MS, input.signal,
      serializeInput({
        expected_revision: input.expectedRevision, plugin_version: input.pluginVersion,
        language: input.language, source_code: input.sourceCode,
      }), parsePluginSecurityResult, input.actor);
  }

  private quarantinePlugin(name: string, input: PluginQuarantineInput): Promise<PluginSecurityResult> {
    if (!input) throw new QdipError('CONFIGURATION_ERROR');
    this.validateSecurityRequest(name, input.expectedRevision, input.pluginVersion, input.actor);
    if (typeof input.quarantined !== 'boolean' || typeof input.reason !== 'string' ||
        input.reason.trim().length < 12 || input.reason.length > 1000)
      throw new QdipError('CONFIGURATION_ERROR');
    return this.request('plugin-publications/' + encodeURIComponent(name) + '/security/quarantine',
      this.adminApiKey, 'POST', input.deadlineMs ?? DISCOVERY_DEADLINE_MS, input.signal,
      serializeInput({
        expected_revision: input.expectedRevision, plugin_version: input.pluginVersion,
        quarantined: input.quarantined, reason: input.reason.trim(),
      }), parsePluginSecurityResult, input.actor);
  }

  private approvePlugin(name: string, input: PluginApprovalInput): Promise<PluginSecurityResult> {
    if (!input) throw new QdipError('CONFIGURATION_ERROR');
    this.validateSecurityRequest(name, input.expectedRevision, input.pluginVersion, input.actor);
    if (input.riskAcknowledged !== true ||
        typeof input.reason !== 'string' || input.reason.trim().length < 20 || input.reason.length > 1000 ||
        typeof input.reviewReference !== 'string' || input.reviewReference.trim().length < 8 ||
        input.reviewReference.length > 256)
      throw new QdipError('CONFIGURATION_ERROR');
    return this.request('plugin-publications/' + encodeURIComponent(name) + '/security/approve',
      this.adminApiKey, 'POST', input.deadlineMs ?? DISCOVERY_DEADLINE_MS, input.signal,
      serializeInput({
        expected_revision: input.expectedRevision, plugin_version: input.pluginVersion,
        reason: input.reason.trim(), review_reference: input.reviewReference.trim(),
        risk_acknowledged: true,
      }), parsePluginSecurityResult, input.actor);
  }

}
