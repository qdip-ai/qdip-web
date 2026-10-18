/** Frozen QDIP Kernel v1 wire contract. Numeric solver values remain decimal strings. */
export type SemanticStatus = 'EXACT' | 'APPROXIMATE' | 'UNSUPPORTED';

export interface Capability {
  plugin_id: string;
  capability_id: string;
  capability_version: string;
}
export interface CapabilitiesResponse { items: Capability[] }

export interface ExecutionManifest {
  semantic_version: '1.0.0';
  execution_id: string;
  decision_id: string;
  decision_spec_hash: string;
  ir_hash: string;
  compiler_version: 'qdip-runtime-compiler.v1';
  runtime_version: 'qdip-runtime-kernel.v1';
  backend_id: string;
  backend_version: string;
}

export interface ApproximationContract {
  type: 'OptimalityGapApproximation' | 'StatisticalToleranceApproximation' | 'PolicyEvaluationApproximation';
  verification_method: string;
  verification_evidence: string[];
  verified: boolean;
  declared_max_gap?: string;
  declared_tolerance?: string;
  measured_metrics: { gap?: string; error?: string };
}

export interface ExecutionResult {
  semantic_version: '1.0.0';
  execution_id: string;
  decision_id: string;
  ir_hash: string;
  semantic_status: SemanticStatus;
  backend_status: string;
  solution: Record<string, string> | null;
  policy: Record<string, unknown> | null;
  objective_value: string | null;
  approximation_contract: ApproximationContract | null;
  diagnostics: Record<string, unknown>;
  manifest: ExecutionManifest;
}

export interface SemanticReplayContract {
  semantic_version: '1.0.0';
  decision_id: string;
  decision_spec_hash: string;
  ir_hash: string;
  compiler_version: 'qdip-runtime-compiler.v1';
}

export interface InvokeResponse {
  execution_result: ExecutionResult;
  replay_contract: SemanticReplayContract;
  /** True only for valid EXACT + OPTIMAL responses containing a solver solution. */
  actionable: boolean;
}

export interface InvokeOptions {
  capabilityId: string;
  input: Record<string, unknown>;
  capabilityVersion?: string;
  timeoutSeconds?: number;
  signal?: AbortSignal;
  /** HTTP caller deadline; distinct from server worker timeout. */
  deadlineMs?: number;
}

/** Credentials must be organization-scoped, server-side keys, with separate read/execute privileges. */
export interface QdipClientOptions {
  /** Gateway origin, e.g. https://api.example.com; never include a path/query/credentials. */
  baseUrl: string;
  readApiKey?: string;
  executeApiKey?: string;
  /** Platform admin-scoped server credential for catalog methods only. */
  adminApiKey?: string;
  /** Local loopback fixture only. Never enable for public hosts. */
  allowInsecureLoopback?: boolean;
  /** Defaults to 45s for invoke and 15s for discovery. */
  defaultDeadlineMs?: number;
}

/** One registry projection for embedded and remotely registered SDK plugins. */
export interface PluginCatalogEntry {
  name: string;
  plugin_id?: string;
  source?: 'embedded' | 'remote';
  version: string;
  description: string;
  enabled: boolean;
  capabilities: string[];
  capability_versions: Record<string, string>;
  ui: { label?: string; category?: string };
  published: boolean | null;
  revision: number;
  capability_id: string | null;
  published_version: string | null;
  /** Canonical public URL slug, not a Gateway plugin identity. */
  slug?: string | null;
  /** Historical URL slugs kept for backward-compatible redirects. */
  slug_aliases?: string[];
  /** Present only after an explicit platform-admin destination review. */
  application_launch_url?: string | null;
  launch_url_verified?: boolean;
}

export interface PluginCatalogUpdate {
  published: boolean;
  expectedRevision: number;
  capabilityId: string;
  pluginVersion: string;
  displayName?: string;
  description?: string;
  category?: string;
  /** Human-friendly public route. Never changes the immutable SDK plugin ID. */
  slug?: string;
  /** Empty string clears an existing verified destination. */
  applicationLaunchUrl?: string;
  /** Must be true when setting an external URL, false when clearing it. */
  launchUrlVerified?: boolean;
  /** Verified user subject for server-side publication audit, not an API key. */
  actor: string;
  deadlineMs?: number;
  signal?: AbortSignal;
}
