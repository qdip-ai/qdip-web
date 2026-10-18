# Model Doctor — native execution inside Observatory

Dependency: [Doctor native session adapter](https://github.com/qdip-ai/qdip-model-doctor/pulls)
must be merged and deployed **before** this UI is released.

The `/[locale]/model-doctor` page uses a client-only form to upload a native
OR-Tools `CpModelProto` binary (max 256 KiB), execute one of four native
operations with a 2/5-second solver limit, and display solver evidence with
verified repair approval guards. No form data, model bytes, cookies or tokens
are stored on Observatory servers, in Next.js API routes or browser storage.
The Core catalog and Kernel v1 are not involved.

A signed-in Observatory user is **not automatically** a Doctor user.
`credentials: include` sends Doctor's existing host-only `__Host-`
HttpOnly cookie to Doctor; the Doctor server verifies session and
`doctor_user` acquired through its own Zitadel login. The UI has an explicit
independent sign-in link and a refresh control after login. Browser JavaScript
never reads the cookie. The Doctor origin is hardcoded, not a dynamic proxy
target. All origin, CSRF, rate limit and worker safeguards remain Doctor-owned.

Tests: `pnpm lint && pnpm prettier && pnpm typecheck && pnpm test && pnpm build`
then `pnpm exec playwright test e2e/model-doctor-native-adapter.spec.ts`.
Playwright mocks verify UI behavior only. After Doctor deployment, independently
qualify real browser: Observatory → Doctor sign-in/Zitadel doctor_user → return
and refresh → upload known model → solve and repair → logout on Doctor → 401 on
Observatory execution, plus negative roleless/wrong Origin and mobile viewport.

Do not merge Web prior to the verified Doctor adapter release. No SDK plugin
or Kernel certified DecisionSpec/replay semantics are asserted.
