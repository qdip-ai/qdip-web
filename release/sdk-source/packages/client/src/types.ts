/** Frozen QDIP Kernel v1 wire contract. Numeric solver values remain decimal strings. */
export type SemanticStatus = 'EXACT' | 'APPROXIMATE' | 'UNSUPPORTED';

export interface Capability {
  plugin_id: string;
  capability_id: string;
  capability_version: string;
}
export interface CanonicalApplicationBinding {
  organization_id: string; plugin_id: string; issuer: string; zitadel_organization_id: string;
  application_id: string; project_id: string; owner_subject: string; oidc_client_id: string;
}
export interface CapabilitiesResponse { items: Capability[]; principal_binding?: CanonicalApplicationBinding }
export interface CapabilityDescription extends Capability {
  input_schema: Record<string, unknown>; required_scopes: string[];
  execution_mode: 'managed_kernel'; principal_binding: CanonicalApplicationBinding;
}
export interface DescribeCapabilityOptions {
  capabilityId: string; capabilityVersion: string; signal?: AbortSignal; deadlineMs?: number;
}

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
  /** Opt-in #652 live canonical/published contract checks, preserved through result release. */
  requireCanonicalApplication?: boolean;
  capabilityId: string;
  input: Record<string, unknown>;
  capabilityVersion?: string;
  timeoutSeconds?: number;
  signal?: AbortSignal;
  /** HTTP caller deadline; distinct from server worker timeout. */
  deadlineMs?: number;
}

/** Server-side application identity. QDIP Gateway enforces scopes and allowed capabilities. */
export interface QdipClientOptions {
  /** Gateway origin, e.g. https://api.example.com; never include a path/query/credentials. */
  baseUrl: string;
  /** Preferred: one restricted application key with plugins:read and plugins:execute permissions. */
  apiKey?: string;
  /** Legacy multi-key mode only; mutually exclusive with apiKey. */
  readApiKey?: string;
  /** Legacy multi-key mode only; mutually exclusive with apiKey. */
  executeApiKey?: string;
  /** Platform admin-scoped server credential for catalog methods only. */
  adminApiKey?: string;
  /** Local loopback fixture only. Never enable for public hosts. */
  allowInsecureLoopback?: boolean;
  /** Defaults to 45s for invoke and 15s for discovery. */
  defaultDeadlineMs?: number;
  /** Explicit private-only Route Worker origin; MUST NOT be the public Gateway. */
  privateRouteBaseUrl?: string;
  /** Org-scoped route-specific server credential; never a platform key or browser secret. */
  routeApiKey?: string;
}



/** Private, server-only Route Optimizer; never sent to PluginRuntime/Mongo audit. */
export type RouteCity = 'kyiv' | 'warsaw' | 'berlin';
export interface RoutePoint { latitude: number; longitude: number }
export interface RouteCoordinateStop extends RoutePoint { id: string }
export interface RouteAddressStop { id: string; address: string }
export interface RouteConstraints {
  city: RouteCity;
  driver_count: number;
  max_stops_per_driver?: number;
  max_shift_minutes?: number;
  time_limit_seconds?: number;
  include_geometry?: boolean;
}
export interface RouteCoordinatesInput extends RouteConstraints {
  depot: RoutePoint;
  deliveries: RouteCoordinateStop[];
}
export interface RouteAddressesInput extends RouteConstraints {
  depot_address: string;
  deliveries: RouteAddressStop[];
}
export interface RouteSolveOptions {
  /** Caller cancelation/deadline; server will continue its bounded job if disconnected. */
  signal?: AbortSignal;
  deadlineMs?: number;
}
export interface RouteDriverResult {
  driver_id: string;
  stops: Array<RouteCoordinateStop & { arrival_minute: number }>;
  stop_count: number;
  approx_distance_km: number;
  shift_duration_minutes: number;
  geometry?: unknown;
}
export interface RouteSolveResult {
  status: 'FEASIBLE' | 'PARTIAL' | 'NO_SOLUTION';
  city: RouteCity;
  graph_id: string;
  distance_basis: 'OSRM_DRIVING_STREET_NETWORK';
  solution_quality: 'HEURISTIC_NOT_PROVEN_OPTIMAL';
  deliveries_requested: number;
  deliveries_assigned: number;
  routes: RouteDriverResult[];
  unassigned_stop_ids: string[];
  /** This payload must never be submitted through normal plugin invoke/audit. */
  not_safe_for_default_plugin_runtime_audit: true;
  geocoding_basis?: 'PRIVATE_UNAMBIGUOUS_ADDRESS_POINT';
  total_approx_distance_km?: number;
  [key: string]: unknown;
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


/** FE-01 annual World Bank economic series. Diagnostic backtests use today's revised vintage. */
export interface EconomicForecastInput {
  executionId: string;
  country: string;
  indicator?: 'NY.GDP.MKTP.CD' | 'NV.IND.TOTL.KD';
  horizonYears?: 1 | 2 | 3;
}
/** FE v1 domain-neutral state, returned only for the authenticated organization. */
export interface FEForecastExecutionState {
  domain_id: string;
  /** Caller-provided public execution ID, never the internal tenant hash. */
  execution_id: string;
  status: 'REQUESTED' | 'MATERIALIZED' | 'SEALED' | 'FAILED';
  state_version: number;
  artifact_ready: boolean;
  artifact_hash: string | null;
  /** Safe machine-readable failure code; detailed errors remain server-side. */
  failure_code: string | null;
  /** Publication must have a validated journal, not only a registry entry. */
  journal_record_present: true;
}

/** FE v1 sealed immutable forecast envelope, with domain-owned payload. */
export interface FESealedForecastArtifact {
  version: 'future-engine.forecast-artifact.v1';
  domain_id: string;
  /** Internally scoped execution identity in the verified artifact. */
  execution_id: string;
  artifact_hash: string;
  context_hash: string;
  payload_hash: string;
  adapter_id: string;
  adapter_version: string;
  request_schema_id: string;
  request_schema_version: string;
  payload_schema_id: string;
  payload_schema_version: string;
  request_payload: Record<string, unknown>;
  payload: Record<string, unknown>;
}

/** Require replay of the exact sealed generation referenced by a consumer. */
export interface FEArtifactReadOptions {
  signal?: AbortSignal;
  deadlineMs?: number;
  expectedArtifactHash?: string;
}

export interface EconomicForecastOptions {
  signal?: AbortSignal;
  deadlineMs?: number;
}
export interface EconomicForecastArtifact {
  version: 'future-engine.forecast-artifact.v1';
  execution_id: string;
  domain_id: 'worldbank.economic-indicator';
  artifact_hash: string;
  request_payload: {
    country: string;
    indicator: string;
    horizon_years: number;
  };
  payload: {
    target: { country: string; indicator: string; frequency: 'annual' };
    source: { provider: string; retrieved_at: string; raw_sha256: string; observations_sha256: string; historical_vintage_available: false };
    observations: Array<{ year: number; value: number }>;
    forecast: Array<{ year: number; value: number; baseline_value: number }>;
    evaluation: { method: string; observations: number; model_mae: number; baseline_mae: number; beats_naive: boolean; point_in_time_verified: false };
    intervals_available: false;
  };
}
