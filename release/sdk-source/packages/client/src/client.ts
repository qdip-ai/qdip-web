import { QdipError, type QdipErrorCode } from './errors.js';
import { validForecastDomainId, parseFEExecutionState, parseFESealedArtifact } from './fe-read.js';
import { privateRouteOrigin, parsePrivateRouteResult, serializePrivateRouteInput } from './route-optimizer.js';
import { parseCapabilitiesResponse, parseAuthorizedCapabilitiesResponse, parseCapabilityDescription, parseInvokeResponse, parsePluginCatalog, parsePluginCatalogEntry, safePluginLaunchUrl } from './validation.js';
import type { CapabilitiesResponse, CapabilityDescription, DescribeCapabilityOptions, InvokeOptions, InvokeResponse, QdipClientOptions, PluginCatalogEntry, PluginCatalogUpdate, RouteCoordinatesInput, RouteAddressesInput, RouteSolveOptions, RouteSolveResult, EconomicForecastInput, EconomicForecastOptions, EconomicForecastArtifact, FEForecastExecutionState, FESealedForecastArtifact, FEArtifactReadOptions } from './types.js';

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


function parseEconomicForecastArtifact(value: unknown): EconomicForecastArtifact {
  const isRecord = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
  if (!isRecord(value) || value.version !== 'future-engine.forecast-artifact.v1' ||
      value.domain_id !== 'worldbank.economic-indicator' || typeof value.execution_id !== 'string' ||
      typeof value.artifact_hash !== 'string' || !/^[0-9a-f]{64}$/.test(value.artifact_hash) ||
      !isRecord(value.payload) || !isRecord(value.request_payload)) throw new QdipError('INVALID_RESPONSE');
  const p = value.payload;
  if (!Array.isArray(p.forecast) || p.forecast.length < 1 || p.forecast.length > 3 ||
      !p.forecast.every((item: unknown) => isRecord(item) && Number.isSafeInteger(item.year) &&
        typeof item.value === 'number' && Number.isFinite(item.value) &&
        typeof item.baseline_value === 'number' && Number.isFinite(item.baseline_value)) ||
      !Array.isArray(p.observations) || p.observations.length < 8 ||
      !isRecord(p.source) || !isRecord(p.evaluation) ||
      typeof p.evaluation.model_mae !== 'number' || !Number.isFinite(p.evaluation.model_mae) ||
      typeof p.evaluation.baseline_mae !== 'number' || !Number.isFinite(p.evaluation.baseline_mae) ||
      typeof p.evaluation.beats_naive !== 'boolean' || p.evaluation.point_in_time_verified !== false ||
      p.intervals_available !== false) throw new QdipError('INVALID_RESPONSE');
  return value as unknown as EconomicForecastArtifact;
}
const validEconomicExecutionId = (id: string): boolean =>
  typeof id === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,95}$/.test(id);

export class QdipClient {
  readonly capabilities: {
    list: (options?: { authorized?: boolean; signal?: AbortSignal; deadlineMs?: number }) => Promise<CapabilitiesResponse>;
    describe: (options: DescribeCapabilityOptions) => Promise<CapabilityDescription>;
  };
  readonly plugins: {
    invoke: (options: InvokeOptions) => Promise<InvokeResponse>;
  };
  /** Private only. This API bypasses ordinary PluginRuntime audit intentionally. */
  readonly routes: {
    solveCoordinates: (input: RouteCoordinatesInput, options?: RouteSolveOptions) => Promise<RouteSolveResult>;
    solveAddresses: (input: RouteAddressesInput, options?: RouteSolveOptions) => Promise<RouteSolveResult>;
  };
  readonly forecasts: {
    getExecutionState: (domainId: string, executionId: string, options?: EconomicForecastOptions) => Promise<FEForecastExecutionState>;
    getSealedArtifact: (domainId: string, executionId: string, options?: FEArtifactReadOptions) => Promise<FESealedForecastArtifact>;
    runEconomic: (input: EconomicForecastInput, options?: EconomicForecastOptions) => Promise<EconomicForecastArtifact>;
    getEconomic: (executionId: string, options?: EconomicForecastOptions) => Promise<EconomicForecastArtifact>;
  };
  readonly catalog: {
    list: (options?: { signal?: AbortSignal; deadlineMs?: number }) => Promise<PluginCatalogEntry[]>;
    publish: (name: string, change: PluginCatalogUpdate) => Promise<PluginCatalogEntry>;
  };
  private readonly origin: string;
  private readonly routeOrigin: string | undefined;
  private readonly routeApiKey: string | undefined;
  private readonly readApiKey: string | undefined;
  private readonly executeApiKey: string | undefined;
  private readonly adminApiKey: string | undefined;
  private readonly defaultDeadlineMs: number;

  constructor(options: QdipClientOptions) {
    if (!options || typeof options.baseUrl !== 'string') throw new QdipError('CONFIGURATION_ERROR');
    this.origin = validateOrigin(options.baseUrl, options.allowInsecureLoopback ?? false);
    // Never fall back to Gateway, a public hostname, or execute/admin API keys.
    if ((options.privateRouteBaseUrl === undefined) !== (options.routeApiKey === undefined)) throw new QdipError('CONFIGURATION_ERROR');
    this.routeOrigin = options.privateRouteBaseUrl === undefined ? undefined :
      privateRouteOrigin(options.privateRouteBaseUrl, options.allowInsecureLoopback ?? false);
    if (this.routeOrigin && this.routeOrigin === this.origin) throw new QdipError('CONFIGURATION_ERROR');
    if (options.routeApiKey !== undefined && (!hasKey(options.routeApiKey) || options.routeApiKey.length > 512)) throw new QdipError('CONFIGURATION_ERROR');
    this.routeApiKey = options.routeApiKey;
    if (options.defaultDeadlineMs !== undefined && !isDuration(options.defaultDeadlineMs)) throw new QdipError('CONFIGURATION_ERROR');
    this.defaultDeadlineMs = options.defaultDeadlineMs ?? DEFAULT_INVOKE_DEADLINE_MS;
    // Google Maps-style consumer contract: one app key for discover + invoke.
    // Explicit legacy credentials remain supported, but never mix the modes.
    if (options.apiKey !== undefined && (options.readApiKey !== undefined || options.executeApiKey !== undefined))
      throw new QdipError('CONFIGURATION_ERROR');
    if (options.apiKey !== undefined && !hasKey(options.apiKey))
      throw new QdipError('CONFIGURATION_ERROR');
    this.readApiKey = options.apiKey ?? options.readApiKey;
    this.executeApiKey = options.apiKey ?? options.executeApiKey;
    this.adminApiKey = options.adminApiKey;
    this.capabilities = { list: (params = {}) => this.listCapabilities(params), describe: params => this.describeCapability(params) };
    this.plugins = {
      invoke: params => this.invoke(params),
    };
    this.routes = {
      solveCoordinates: (input, params = {}) => this.solveRoute('coordinates', input, params),
      solveAddresses: (input, params = {}) => this.solveRoute('addresses', input, params),
    };
    this.forecasts = {
      getExecutionState: (domainId, executionId, options = {}) => this.getFEExecutionState(domainId, executionId, options),
      getSealedArtifact: (domainId, executionId, options = {}) => this.getFESealedArtifact(domainId, executionId, options),
      runEconomic: (input, options = {}) => this.runEconomicForecast(input, options),
      getEconomic: (executionId, options = {}) => this.getEconomicForecast(executionId, options),
    };
    this.catalog = {
      list: (params = {}) => this.listCatalog(params),
      publish: (name, change) => this.publishCatalog(name, change),
    };
  }

  private async request<T>(path: string, apiKey: string | undefined, method: 'GET' | 'POST' | 'PUT',
    deadlineMs: number, signal: AbortSignal | undefined, body: string | undefined,
    parser: (value: unknown) => T, actor?: string, origin?: string): Promise<T> {
    if (!hasKey(apiKey) || !isDuration(deadlineMs)) throw new QdipError('CONFIGURATION_ERROR');
    if (signal?.aborted) throw new QdipError('ABORTED');
    const ctrl = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; ctrl.abort(); }, deadlineMs);
    const externalAbort = (): void => ctrl.abort();
    signal?.addEventListener('abort', externalAbort, { once: true });
    try {
      const response = await fetch((origin ?? this.origin) + '/api/v1/' + path, {
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


  private runEconomicForecast(input: EconomicForecastInput, options: EconomicForecastOptions): Promise<EconomicForecastArtifact> {
    if (!input || !validEconomicExecutionId(input.executionId) || !/^[A-Z]{3}$/.test(input.country) ||
        (input.indicator !== undefined && !['NY.GDP.MKTP.CD', 'NV.IND.TOTL.KD'].includes(input.indicator)) ||
        (input.horizonYears !== undefined && ![1, 2, 3].includes(input.horizonYears)))
      throw new QdipError('CONFIGURATION_ERROR');
    const body = serializeInput({
      execution_id: input.executionId,
      country: input.country,
      indicator: input.indicator ?? 'NY.GDP.MKTP.CD',
      horizon_years: input.horizonYears ?? 1,
    });
    return this.request('future-engine/forecasts/economic', this.executeApiKey, 'POST',
      options.deadlineMs ?? this.defaultDeadlineMs, options.signal, body, parseEconomicForecastArtifact);
  }

  private getFEExecutionState(domainId: string, executionId: string, options: EconomicForecastOptions): Promise<FEForecastExecutionState> {
    if (!validForecastDomainId(domainId) || !validEconomicExecutionId(executionId))
      throw new QdipError('CONFIGURATION_ERROR');
    return this.request(
      'future-engine/forecasts/executions/' + encodeURIComponent(domainId) + '/' + encodeURIComponent(executionId),
      this.readApiKey, 'GET', options.deadlineMs ?? DISCOVERY_DEADLINE_MS,
      options.signal, undefined, value => parseFEExecutionState(value, domainId, executionId),
    );
  }

  private getFESealedArtifact(domainId: string, executionId: string, options: FEArtifactReadOptions): Promise<FESealedForecastArtifact> {
    if (!validForecastDomainId(domainId) || !validEconomicExecutionId(executionId))
      throw new QdipError('CONFIGURATION_ERROR');
    const expected = options.expectedArtifactHash;
    if (expected !== undefined && !/^[0-9a-f]{64}$/.test(expected))
      throw new QdipError('CONFIGURATION_ERROR');
    const path = 'future-engine/forecasts/artifacts/' +
      encodeURIComponent(domainId) + '/' + encodeURIComponent(executionId) +
      (expected === undefined ? '' : '?expected_artifact_hash=' + expected);
    return this.request(
      path, this.readApiKey, 'GET', options.deadlineMs ?? DISCOVERY_DEADLINE_MS,
      options.signal, undefined, value => {
        const artifact = parseFESealedArtifact(value, domainId, executionId);
        // Defend against intermediaries and misrouted registry responses.
        if (expected !== undefined && artifact.artifact_hash !== expected)
          throw new QdipError('INVALID_RESPONSE');
        return artifact;
      },
    );
  }

  private getEconomicForecast(executionId: string, options: EconomicForecastOptions): Promise<EconomicForecastArtifact> {
    if (!validEconomicExecutionId(executionId)) throw new QdipError('CONFIGURATION_ERROR');
    return this.request('future-engine/forecasts/economic/' + encodeURIComponent(executionId),
      this.readApiKey, 'GET', options.deadlineMs ?? DISCOVERY_DEADLINE_MS,
      options.signal, undefined, parseEconomicForecastArtifact);
  }

  private async solveRoute(
    mode: 'coordinates' | 'addresses', input: RouteCoordinatesInput | RouteAddressesInput,
    options: RouteSolveOptions,
  ): Promise<RouteSolveResult> {
    if (!this.routeOrigin || !hasKey(this.routeApiKey)) throw new QdipError('CONFIGURATION_ERROR');
    const body = serializePrivateRouteInput(mode, input);
    const deadlineMs = options?.deadlineMs ?? 120_000;
    if (!isDuration(deadlineMs)) throw new QdipError('CONFIGURATION_ERROR');
    return this.request(
      mode === 'addresses' ? 'customer-routes/solve-addresses' : 'customer-routes/solve',
      this.routeApiKey, 'POST', deadlineMs, options?.signal, body,
      parsePrivateRouteResult, undefined, this.routeOrigin,
    );
  }

  private listCapabilities(options: { authorized?: boolean; signal?: AbortSignal; deadlineMs?: number }): Promise<CapabilitiesResponse> {
    return this.request('remote-plugins/capabilities' + (options.authorized === true ? '?authorized=true' : ''), this.readApiKey, 'GET', options.deadlineMs ?? DISCOVERY_DEADLINE_MS,
      options.signal, undefined, options.authorized === true ? parseAuthorizedCapabilitiesResponse : parseCapabilitiesResponse);
  }

  private async describeCapability(options: DescribeCapabilityOptions): Promise<CapabilityDescription> {
    if (!options || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(options.capabilityId) ||
        typeof options.capabilityVersion !== 'string' || options.capabilityVersion.length < 1 ||
        options.capabilityVersion.length > 32) throw new QdipError('CONFIGURATION_ERROR');
    const result = await this.request('remote-plugins/capabilities/' + encodeURIComponent(options.capabilityId) +
      '?capability_version=' + encodeURIComponent(options.capabilityVersion), this.readApiKey, 'GET',
      options.deadlineMs ?? DISCOVERY_DEADLINE_MS, options.signal, undefined, parseCapabilityDescription);
    if (result.capability_id !== options.capabilityId || result.capability_version !== options.capabilityVersion)
      throw new QdipError('INVALID_RESPONSE');
    return result;
  }

  private invoke(options: InvokeOptions): Promise<InvokeResponse> {
    if (!options || typeof options.capabilityId !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/.test(options.capabilityId)) throw new QdipError('CONFIGURATION_ERROR');
    const timeoutSeconds = options.timeoutSeconds ?? 10;
    const capabilityVersion = options.capabilityVersion ?? '1';
    if (!Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0 || timeoutSeconds > 30 ||
        typeof capabilityVersion !== 'string' || capabilityVersion.length < 1 || capabilityVersion.length > 32) throw new QdipError('CONFIGURATION_ERROR');
    const input = JSON.parse(serializeInput(options.input)) as Record<string, unknown>;
    const payload = JSON.stringify({ input, timeout_seconds: timeoutSeconds, capability_version: capabilityVersion,
      ...(options.requireCanonicalApplication === true ? {canonical_application_required: true} : {}) });
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
        update.slug.includes('--') || ['admin', 'api', 'new', 'edit', 'plugins', 'settings'].includes(update.slug))) ||
        (update.applicationLaunchUrl !== undefined && update.applicationLaunchUrl !== '' &&
          (!safePluginLaunchUrl(update.applicationLaunchUrl) || update.launchUrlVerified !== true)) ||
        (update.applicationLaunchUrl === '' && update.launchUrlVerified === true) ||
        (update.applicationLaunchUrl === undefined && update.launchUrlVerified !== undefined)) {
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
      ...(update.applicationLaunchUrl !== undefined ? { application_launch_url: update.applicationLaunchUrl } : {}),
      ...(update.launchUrlVerified !== undefined ? { launch_url_verified: update.launchUrlVerified } : {}),
    });
    return this.request('plugin-publications/' + encodeURIComponent(name), this.adminApiKey,
      'PUT', update.deadlineMs ?? DISCOVERY_DEADLINE_MS, update.signal, payload,
      parsePluginCatalogEntry, update.actor);
  }

}

