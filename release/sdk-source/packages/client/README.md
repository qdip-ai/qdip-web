# @qdip/client — SDK-03 (Node.js / TypeScript)

**Languages:** [English](README.md) · [Українська](README.uk.md) · [Polski](README.pl.md)

Server-side TypeScript client for QDIP Remote Plugin HTTP API. SDK-03 is a **caller client**, distinct from Python SDK-02 **Worker**. **Not published to npm**: install a verified @qdip/client tarball built from this source. No qdip-core runtime dependency, no new Kernel. Requires Node.js >=20 and scoped credentials issued by a QDIP administrator.

## Install locally from a pinned source revision

```bash
cd packages/client
npm ci
npm run build
npm pack --pack-destination /tmp
sha256sum /tmp/qdip-client-0.2.0.tgz
# From a separate Node project (after verifying the checksum):
npm install /tmp/qdip-client-0.2.0.tgz
```

Registry publication and reproducible provenance require a separate release gate. A tarball checksum alone does not prove source authenticity. Do not commit credentials to source or browser bundles.

## Minimal server-only example

```ts
import { QdipClient, isActionable, QdipError } from '@qdip/client';

const client = new QdipClient({
  baseUrl: process.env.QDIP_GATEWAY_URL!,
  apiKey: process.env.QDIP_API_KEY! // server only: plugins:read + plugins:execute
});
const { items } = await client.capabilities.list(); // plugins:read
try {
  const response = await client.plugins.invoke({
    capabilityId: 'repairs.plan',
    input: { capacity_hours: 4, jobs: [{ id: 'a', hours: 3, priority: 9 }] },
    capabilityVersion: '1', timeoutSeconds: 10, deadlineMs: 45_000
  }); // plugins:execute
  if (isActionable(response)) {
    // Domain authorization, validation and user approval remain app-owned.
    console.log(response.execution_result.execution_id);
  }
} catch (error) {
  if (error instanceof QdipError) {
    console.error(error.code, error.httpStatus, error.retryAfter, error.diagnosticId);
  } else { throw error; }
}
```

## Compatibility and invariants

- Managed API uses /api/v1/remote-plugins/capabilities and /{capability_id}/invoke; opt-in external reports use the separate /{capability_id}/evaluate route. HTTP 200 does not establish actionability.
- SDK 0.2.0 is pre-1.0. Kernel semantic_version=1.0.0, runtime=qdip-runtime-kernel.v1, compiler=qdip-runtime-compiler.v1. Unknown versions trigger INCOMPATIBLE_VERSION; incomplete/inconsistent envelopes trigger INVALID_RESPONSE.
- Capability version is explicit (default 1). Decimal solver results remain strings; do not coerce to imprecise JS doubles.
- Actionability requires verified envelope cross-links, EXACT, OPTIMAL and non-null solution. All unsupported, approximate, infeasible and unknown results remain non-actionable. isActionable revalidates before decisions.
- Invoke automatic retry is disabled. Caller abort/deadline does not imply server work never started; no exactly-once guarantee.
- Keys are server-only and org-scoped with separate plugins:read and plugins:execute scopes. HTTP is permitted only for explicit loopback fixtures.
- Replay contract binds semantic identity and hashes. It does not execute an historical solver run or cryptographically authenticate the response; trusted TLS endpoint is required.

## Gate

`npm test` runs Node mock-gateway contract tests. Independent acceptance requires installing the tarball in a clean Node project, invoking the pinned QDIP gateway with a registered Python SDK-02 Worker, recording source SHAs and positive/negative runs. Contract tests are not a substitute for production E2E.


**Current source artifact:** `@qdip/client` `0.2.0` is operator-distributed, not publicly published on npm. The [hosted Gateway quickstart](../../docs/sdk-hosted-gateway-quickstart.md) documents separately scoped Worker and caller credentials; local contract mocks do not establish external E2E.
