import { QdipError } from './errors';
import type { ApproximationContract, CapabilitiesResponse, ExecutionResult, InvokeResponse, SemanticReplayContract, PluginCatalogEntry } from './types';

const fail = (): never => { throw new QdipError('INVALID_RESPONSE'); };
const obj = (v: unknown): Record<string, unknown> => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return fail();
  return v as Record<string, unknown>;
};
const str = (v: unknown): string => typeof v === 'string' && v.length > 0 && v.length <= 256 ? v : fail();
const hash = (v: unknown): string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v) ? v : fail();
const version = (v: unknown, expected: string): void => {
  if (v !== expected) throw new QdipError('INCOMPATIBLE_VERSION');
};
const decimal = (v: unknown): string =>
  typeof v === 'string' && /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(v) ? v : fail();
const optionalDecimal = (v: unknown): string | null => v === null ? null : decimal(v);
const dictionary = (v: unknown): Record<string, unknown> => obj(v);
const nullableDictionary = (v: unknown): Record<string, unknown> | null => v === null ? null : dictionary(v);

export function parseCapabilitiesResponse(value: unknown): CapabilitiesResponse {
  const response = obj(value);
  if (!Array.isArray(response.items) || response.items.length > 4096) return fail();
  const items = response.items.map((entry: unknown) => {
    const v = obj(entry);
    return { plugin_id: str(v.plugin_id), capability_id: str(v.capability_id), capability_version: str(v.capability_version) };
  });
  return { items };
}

function parseApproximation(value: unknown): ApproximationContract | null {
  if (value === null) return null;
  const a = obj(value);
  const type = a.type as ApproximationContract['type'];
  if (type !== 'OptimalityGapApproximation' && type !== 'StatisticalToleranceApproximation' && type !== 'PolicyEvaluationApproximation') return fail();
  if (typeof a.verified !== 'boolean' || !Array.isArray(a.verification_evidence) || a.verification_evidence.length === 0) return fail();
  const verification_evidence = a.verification_evidence.map(str);
  const measured_metrics = obj(a.measured_metrics);
  const common = { type, verified: a.verified, verification_method: str(a.verification_method), verification_evidence };
  if (type === 'OptimalityGapApproximation') {
    const declared_max_gap = decimal(a.declared_max_gap);
    const gap = decimal(measured_metrics.gap);
    if (Number(declared_max_gap) < 0 || Number(gap) < 0) return fail();
    return { ...common, declared_max_gap, measured_metrics: { gap } };
  }
  const declared_tolerance = decimal(a.declared_tolerance);
  const error = decimal(measured_metrics.error);
  if (Number(declared_tolerance) < 0 || Number(error) < 0) return fail();
  return { ...common, declared_tolerance, measured_metrics: { error } };
}

function parseExecutionResult(value: unknown): ExecutionResult {
  const v = obj(value);
  version(v.semantic_version, '1.0.0');
  const manifest = obj(v.manifest);
  version(manifest.semantic_version, '1.0.0');
  version(manifest.compiler_version, 'qdip-runtime-compiler.v1');
  version(manifest.runtime_version, 'qdip-runtime-kernel.v1');
  const checkedManifest: ExecutionResult['manifest'] = {
    semantic_version: '1.0.0', execution_id: str(manifest.execution_id),
    decision_id: str(manifest.decision_id), decision_spec_hash: hash(manifest.decision_spec_hash),
    ir_hash: hash(manifest.ir_hash), compiler_version: 'qdip-runtime-compiler.v1',
    runtime_version: 'qdip-runtime-kernel.v1', backend_id: str(manifest.backend_id),
    backend_version: str(manifest.backend_version)
  };
  const semantic_status = v.semantic_status;
  if (semantic_status !== 'EXACT' && semantic_status !== 'APPROXIMATE' && semantic_status !== 'UNSUPPORTED') return fail();
  let solution: Record<string, string> | null = null;
  if (v.solution !== null) {
    const values = obj(v.solution);
    solution = {};
    for (const [key, val] of Object.entries(values)) {
      if (!key || key.length > 128 || key === '__proto__' || key === 'constructor' || key === 'prototype') return fail();
      solution[key] = decimal(val);
    }
  }
  const approximation_contract = parseApproximation(v.approximation_contract);
  const policy = nullableDictionary(v.policy);
  const diagnostics = dictionary(v.diagnostics);
  const result: ExecutionResult = {
    semantic_version: '1.0.0', execution_id: str(v.execution_id), decision_id: str(v.decision_id),
    ir_hash: hash(v.ir_hash), semantic_status, backend_status: str(v.backend_status),
    solution, policy, objective_value: optionalDecimal(v.objective_value),
    approximation_contract, diagnostics, manifest: checkedManifest
  };
  if (result.execution_id !== checkedManifest.execution_id ||
      result.decision_id !== checkedManifest.decision_id || result.ir_hash !== checkedManifest.ir_hash) return fail();
  if (semantic_status === 'EXACT' && approximation_contract !== null) return fail();
  if (semantic_status === 'APPROXIMATE' && approximation_contract === null) return fail();
  if (semantic_status === 'UNSUPPORTED' && (approximation_contract !== null || solution !== null || policy !== null)) return fail();
  if (result.backend_status === 'OPTIMAL' && semantic_status === 'EXACT' && solution === null) return fail();
  return result;
}

function parseReplay(value: unknown): SemanticReplayContract {
  const v = obj(value);
  version(v.semantic_version, '1.0.0');
  version(v.compiler_version, 'qdip-runtime-compiler.v1');
  return { semantic_version: '1.0.0', decision_id: str(v.decision_id),
    decision_spec_hash: hash(v.decision_spec_hash), ir_hash: hash(v.ir_hash),
    compiler_version: 'qdip-runtime-compiler.v1' };
}

/** Always revalidate at decision-to-act boundary if result could have been modified. */
export function isActionable(value: unknown): boolean {
  try { return parseInvokeResponse(value).actionable; } catch { return false; }
}

/** Validates both envelopes and cross-links before actionability can be evaluated. */
export function parseInvokeResponse(value: unknown): InvokeResponse {
  const v = obj(value);
  const result = parseExecutionResult(v.execution_result);
  const replay = parseReplay(v.replay_contract);
  const m = result.manifest;
  if (replay.decision_id !== result.decision_id || replay.ir_hash !== result.ir_hash ||
      replay.decision_spec_hash !== m.decision_spec_hash || replay.compiler_version !== m.compiler_version) return fail();
  return { execution_result: result, replay_contract: replay,
    actionable: result.semantic_status === 'EXACT' && result.backend_status === 'OPTIMAL' && result.solution !== null };
}

/** Never trust an administrative HTTP envelope merely because it came from Core. */
export function parsePluginCatalogEntry(input: unknown): PluginCatalogEntry {
  const v = obj(input);
  const ui = obj(v.ui);
  if (typeof v.enabled !== 'boolean' ||
      (v.published !== null && typeof v.published !== 'boolean') ||
      !Number.isSafeInteger(v.revision) || (v.revision as number) < 0 ||
      (v.capability_id !== null && typeof v.capability_id !== 'string') ||
      (v.published_version !== null && typeof v.published_version !== 'string') ||
      !Array.isArray(v.capabilities) || v.capabilities.length > 256 ||
      typeof v.description !== 'string' || v.description.length > 2000) return fail();
  if (v.plugin_id !== undefined && typeof v.plugin_id !== 'string') return fail();
  if (v.source !== undefined && v.source !== 'embedded' && v.source !== 'remote') return fail();
  if (v.slug !== undefined && v.slug !== null && (typeof v.slug !== 'string' ||
      !/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(v.slug))) return fail();
  if (v.slug_aliases !== undefined && (!Array.isArray(v.slug_aliases) ||
      v.slug_aliases.length > 256 || v.slug_aliases.some((slug: unknown) => typeof slug !== 'string' ||
        !/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(slug)))) return fail();
  const versions = obj(v.capability_versions);
  if (ui.label != null && typeof ui.label !== 'string') return fail();
  if (ui.category != null && typeof ui.category !== 'string') return fail();
  const capabilities = v.capabilities.map(str);
  const capability_versions: Record<string,string> = {};
  for (const [key, val] of Object.entries(versions)) {
    if (!capabilities.includes(key)) return fail();
    capability_versions[key] = str(val);
  }
  return {
    name: str(v.name), version: str(v.version), description: v.description,
    ...(v.plugin_id !== undefined ? { plugin_id: str(v.plugin_id) } : {}),
    ...(v.source !== undefined ? { source: v.source as 'embedded' | 'remote' } : {}),
    enabled: v.enabled, capabilities, capability_versions,
    ui: { ...(typeof ui.label === 'string' ? { label: ui.label } : {}),
      ...(typeof ui.category === 'string' ? { category: ui.category } : {}) },
    published: v.published, revision: v.revision as number,
    capability_id: v.capability_id, published_version: v.published_version,
    ...(v.slug !== undefined ? { slug: v.slug as string | null } : {}),
    ...(v.slug_aliases !== undefined ? { slug_aliases: v.slug_aliases as string[] } : {}),
    ...(v.security !== undefined ? { security: parsePluginSecurityState(v.security) } : {})
  };
}

export function parsePluginCatalog(value: unknown): PluginCatalogEntry[] {
  if (!Array.isArray(value) || value.length > 1000) return fail();
  return value.map(parsePluginCatalogEntry);
}

/** Strict parsing of administrative security evidence: never display opaque HTML. */
export function parsePluginSecurityState(input: unknown): import('./types.js').PluginSecurityState {
  const v = obj(input);
  if (!['pending_review', 'approved', 'quarantined', 'revoked'].includes(String(v.state))) return fail();
  if (v.reason != null && (typeof v.reason !== 'string' || v.reason.length > 1000)) return fail();
  if (v.review_reference != null && (typeof v.review_reference !== 'string' || v.review_reference.length > 256)) return fail();
  if (v.approval_source != null && (typeof v.approval_source !== 'string' || v.approval_source.length > 128)) return fail();
  let lastScan: import('./types.js').PluginSecurityState['last_scan'] = null;
  if (v.last_scan != null) {
    const scan = obj(v.last_scan);
    if (typeof scan.source_sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(scan.source_sha256) ||
        scan.source_kind !== 'reviewer_supplied_unverified' ||
        !['python','javascript','typescript','shell'].includes(String(scan.language)) ||
        !['critical','review','no_signatures'].includes(String(scan.result)) ||
        typeof scan.coverage !== 'string' || scan.coverage.length > 128 ||
        !Array.isArray(scan.findings) || scan.findings.length > 12) return fail();
    const findings = scan.findings.map((entry: unknown) => {
      const f = obj(entry);
      if (typeof f.id !== 'string' || f.id.length > 64 ||
          (f.severity !== 'critical' && f.severity !== 'review') ||
          !Number.isSafeInteger(f.line) || (f.line as number) < 1) return fail();
      return { id: f.id as string, severity: f.severity as 'critical' | 'review', line: f.line as number };
    });
    lastScan = {
      source_sha256: scan.source_sha256,
      source_kind: 'reviewer_supplied_unverified',
      language: scan.language as 'python' | 'javascript' | 'typescript' | 'shell',
      findings, result: scan.result as 'critical' | 'review' | 'no_signatures', coverage: scan.coverage
    };
  }
  if (v.critical_block !== undefined && typeof v.critical_block !== 'boolean') return fail();
  return {
    state: v.state as import('./types.js').PluginSecurityState['state'],
    ...(v.reason !== undefined ? { reason: v.reason as string | null } : {}),
    ...(v.review_reference !== undefined ? { review_reference: v.review_reference as string | null } : {}),
    ...(v.approval_source !== undefined ? { approval_source: v.approval_source as string | null } : {}),
    ...(v.critical_block !== undefined ? { critical_block: v.critical_block as boolean } : {}),
    ...(v.last_scan !== undefined ? { last_scan: lastScan } : {}),
  };
}

export function parsePluginSecurityResult(value: unknown): import('./types.js').PluginSecurityResult {
  const v = obj(value);
  if (!Number.isSafeInteger(v.revision) || (v.revision as number) < 0 || typeof v.published !== 'boolean')
    return fail();
  return {
    name: str(v.name), revision: v.revision as number,
    published: v.published, security: parsePluginSecurityState(v.security)
  };
}
