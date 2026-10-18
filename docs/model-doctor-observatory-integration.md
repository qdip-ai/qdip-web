# Model Doctor in QDIP Observatory

## Implemented boundary: standalone application discovery

- Observatory registers Model Doctor in its shared application registry, navigation and product-home cards, with EN/UK/PL copy.
- The locale-aware `/[locale]/model-doctor` landing page launches the canonical `https://doctor.qdip.ai/{locale}` native application in a separate tab. Doctor owns its existing Zitadel `doctor_user` OAuth sign-in, session, upload flow, and isolated CP-SAT worker.
- The Observatory site does **not** send its QDIP browser session, tokens, model contents or Core platform API keys to Doctor. No cross-origin iframe or cookie forwarding. The link is a genuine product hand-off, not an executable Observatory API adapter.
- The doctor browser application accepts native versioned `CpModelProto` diagnostics, **not** Kernel v1 `DecisionSpec`. No new SDK-02 capability is registered, and no Kernel executions/replays are claimed.
- This integration must not be registered as a runtime plugin in the Core publication API. Catalog publication is for SDK/Core-registered capabilities only.

## Qualification

1. `pnpm lint && pnpm prettier && pnpm typecheck && pnpm test && pnpm build` on the exact PR SHA.
2. `pnpm exec playwright test e2e/model-doctor-observatory.spec.ts` on all locales and mobile widths.
3. Live authenticated Doctor QA: launch from Observatory, use existing `doctor_user` identity in Zitadel, upload a synthetic `.cpmodel`, validate/solve/diagnose; assert anonymous Doctor API is 401 and logout revokes execution. Run separately and record the deployed SHA.
4. Confirm the Observatory entry is visible without a Core plugin publication and that no Doctor invocation is mislabeled as a Kernel Replay.

## Not implemented (separate security-gated work)

An in-Observatory upload/execution UI needs a **new explicitly authenticated Doctor BFF contract** with verified delegated Zitadel audience/role, exact origin and CSRF checks, bounded upload/timeouts, rate limiting and negative auth E2E. Observatory session cookies are not Doctor access tokens; do not proxy them or introduce a shared root/service key to bypass Doctor authorization. Track this in [Model Doctor #8](https://github.com/qdip-ai/qdip-model-doctor/issues/8).

The separate external ChatGPT OAuth to Doctor MCP must pass its own E2E under [Model Doctor #6](https://github.com/qdip-ai/qdip-model-doctor/issues/6). Kernel v1 stays frozen.
