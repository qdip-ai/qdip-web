# Readiness Recovery — Kernel-only frontend

**Current architecture:** The `qdip-web` application does not run any RR solver, stochastic simulation, Pareto search, benchmark, score calculation or Test A ledger mutation.

- Canonical RR workspace: `src/use-cases/readiness-recovery/kernel-workspace.tsx`.
- Authenticated UI and display-only state: `production-operator-panel.tsx`. Zitadel OIDC (Authorization Code + PKCE) replaces the shared-password operator login; subject allowlists are enforced server-side.
- Strict server proxy: `/api/rr-operator/kernel/[...path]` with an allowlisted, org-scoped `qdip-core` API key. Its response stream is size-gated while reading, not after buffering.
- Authoritative source of scheduling/optimization: `qdip-core/app/plugins/readiness_recovery`.
- Plugin computes preflight domain counts and payload digest, domain schema/admission, execution results, provenance/evidence presentation, semantic replay, and complete-history verification.
- The obsolete `readiness-recovery.v1` asset/capability TypeScript solver is **retired**, not silently treated as equivalent to `readiness-recovery-runtime.v1`. Every `/readiness/scenarios` endpoint returns HTTP 410.
- Deprecated TS Monte Carlo/Pareto/heuristic research source is retained in Git history of PRs prior to this migration, not as deployable web code. A separate unexposed Python research-math module in the RR plugin carries bounded distribution/Monte Carlo/Pareto primitives. This research module is **not** a production scheduler or parity-certified port of the historical planner.

## RR-ECON-v2 Web ↔ Core integration (compiler-only)

The authenticated **existing** RR operator also contains an economic v2
preflight panel, without introducing a second scheduler or a replacement UI.
The precise server contract is
`qdip-core/app/api/v1/readiness_recovery.py:RREconomicPreflightResponse`.

- The Web BFF permits only
  `POST /api/rr-operator/kernel/economic-v2/preflight`, forwarding JSON to
  `POST /api/v1/readiness-recovery/economic-v2/preflight` in Core.
  Existing Zitadel RR role, same-origin, HTTPS/localhost and server-only
  org-scoped `RR_ORG_API_KEY` guard (legacy `DIP_API_KEY` fixture fallback) is reused. Arbitrary economic-v2
  execution, ordering or commit paths stay outside the proxy allowlist.
- The browser sends user-supplied versioned `RREconomicInput` unmodified.
  Only Core validates the complete model and returns
  `readiness-recovery.economic-preflight.v2`, a semantic hash and input
  counts. Web defensively checks schema/decision identity and that
  `state=COMPILED_PREVIEW_ONLY`, `actionable=false`,
  `supply_source_verified=false` and `atomic_plan_committed=false`.
  It does **not** compute revenue, a feasible schedule or optimality.
- In-flight requests are aborted on edited input or panel unmount, and
  stale responses cannot update the display. Raw economic input is not
  stored in localStorage or included in URLs.
- **Do not submit a v2 preflight response to the v1 execution endpoint.**
  There is no authenticated economic v2 solve/commit API or trusted
  live stock/quote repository yet. No physical ordering, asset reservation,
  customer ROI or stochastic optimization is implied.

Web-local Vitest contract checks only:
`src/use-cases/readiness-recovery/economic-preflight-contract.vitest.test.ts`,
`src/lib/rr-economic-proxy.vitest.test.ts`, and
`src/lib/rr-kernel-route-allowlist.vitest.test.ts`.
These cover pure transport/schema/permission boundaries and do NOT qualify
real service integration. Project build/lint/typechecks remain regular Web
CI checks; a developer is not required to run Playwright locally.

All real Core+Web+native Mongo+Chromium RR E2E belongs in the independent
public `qdip-ai/qdip-e2e` GitHub Actions repository, pinned to exact
Core/Web SHAs. Add a genuine end-to-end RR-ECON-v2 preflight scenario there
that submits valid source-independent synthetic economic JSON to Core,
checks the Web proxy via authenticated browser, checks wrong-tenant/guest
denial and that no solver execution or persistent plan was created. The
current `rr-oidc-session-v1` E2E tests use synthetic signed browser sessions,
not a real external Zitadel login; live OIDC needs a separate qualification
gate. The runner's `QDIP_READ_TOKEN` must be configured via its GitHub
Actions secret, not sourced from a developer machine or chat.

Core #328 merged into `dev`; no Kernel v1 change or Vercel configuration
change is part of this Web integration.

## Operational request sequence

1. User supplies the unchanged normalized Kernel RR JSON request.
2. UI passes JSON to `POST /api/rr-operator/kernel/preflight`; **only the plugin** validates the RR domain and computes counts. If this server endpoint is absent or rejects the request, submission is disabled.
3. UI submits the unchanged JSON to `POST /api/rr-operator/kernel/executions` (or replan). Frozen RR Kernel computes the decision; web does not calculate risk, readiness, optimization objective or estimated utility.
4. After execution, UI requests `GET /api/rr-operator/kernel/executions/:id/presentation`. The typed server projection determines outcome kind, authority, provenance and scheduled jobs; browser renders only that projection.
5. Full history export requests `GET /api/rr-operator/kernel/decisions/:id/history/verified-export-page` and follows its server-issued cursor. Every page is independently chain-verified, head-bound and bound to a digest of **every serialized execution record**, with an upstream size limit below the proxy's 4 MiB ceiling. The browser only assembles and downloads transport pages; it never certifies the chain itself. Oversized snapshots (24 MB admission ceiling) fail closed with HTTP 413. Failures are not converted to successful exports.

Deployment sequence: **core plugin routes must be deployed before enabling the web UI changes**. Until then, preflight fails closed; there is no browser-calculation fallback. To attribute operator writes to the personally authenticated Zitadel subject, configure an independent `RR_ACTOR_ASSERTION_SECRET` (at least 32 random characters, identical in both Web and Core). The Web BFF sends a short-lived HMAC-signed, operation-bound actor assertion on create/replan; the Core org API key and RBAC remain mandatory. Core stores the verified pseudonymous subject in the execution and audit. Absent the shared actor secret, the OIDC RR operator fails closed. OIDC identity, API-key organization membership, live callbacks, and access policies still require deployment validation.

See `docs/architecture/rr-reverse-audit-remediation.md` for reverse audit and qualifications.
