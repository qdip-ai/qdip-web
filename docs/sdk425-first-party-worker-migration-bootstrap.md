# #425 — first-party SDK-02 Worker bootstrap (feature flag OFF)

Context: Zitadel organization `368555767923594379` is already linked
to Core UUID `ff638747-1962-4a44-95ee-3902c28d949f` in production.
The existing VHV `secretary` and RO `route-optimizer-sdk02` Worker
registrations remain bound to legacy Core UUID organizations.

## Bootstrap dependency

The Observatory key-manager refused a legacy SDK plugin ID while that
plugin remained registered in an old tenant. But re-registering its Worker
in the correct Core tenant REQUIRES a new tenant-bound `plugins:register`
key first. This was a bootstrap deadlock.

This draft adds a **temporary, disabled-by-default**, narrowly scoped
server-side migration exception. It is not a new organization creation API
or general third-party credential impersonation.

Only when `QDIP_SDK425_MIGRATION_BOOTSTRAP=enabled` is set explicitly
in the **Observatory server** does a signed-in, live-verified
`ORG_OWNER` receive the option to request a new **Worker** key via the
existing explicit manual-bootstrap flow, for _exactly_:

| SDK plugin ID           | Registered legacy tenant               | Allowed capability                 |
| ----------------------- | -------------------------------------- | ---------------------------------- |
| `secretary`             | `1aeac26a-7dcd-467d-b6f3-2cfd842ea2ab` | `secretary.plan`                   |
| `route-optimizer-sdk02` | `cbe626fc-e287-4e23-8c1b-001858521c44` | `route-optimizer.select-routes.v1` |

Both must target canonical Core UUID
`ff638747-1962-4a44-95ee-3902c28d949f`, under the exact
`https://mentality-rmwj0i.eu1.zitadel.cloud` issuer/organization.
The existing server verifies `ORG_OWNER` per request. The code checks
the _source catalog fingerprint_ resolves to the explicit legacy tenant
and source name; the legacy Worker must still be live (`enabled=true`) and
its legacy Core organization active at issuance time. It does not accept arbitrary plugin/capability names,
a forged tenant, an unrelated organization's registration, or
an `execute` (caller) key via this temporary exception.

On the target tenant, only an exact `plugins:register` key is issued
with a single capability and a 30-day expiry via the current Core
server-key path. The existing create/read-back policy attestation remains
mandatory. The source tenant and source keys are never changed by this
bootstrap operation.

Once a real target Worker has registered, use its **new opaque Core catalog
ID** in the normal UI to create a separately scoped `execute` caller
credential. Do **not** choose the legacy catalog card or assume that
matching capability implies matching organization. When both old and new
registrations coexist, a generic SDK `plugin_id` is deliberately rejected as
ambiguous, but the **exact target catalog ID** is accepted and must match the
verified canonical Core tenant. This does not grant access to the old tenant.
The source legacy organization must also remain active during the narrowly
permitted temporary Worker bootstrap; stale/inactive legacy source identities
are refused.

A disconnected Worker already registered under the exact verified canonical
tenant can receive a replacement registration key **only** in the explicit
#425 migration window: flag `enabled`, `manual=true`, Worker role, exact
first-party `secretary` or `route-optimizer-sdk02` target registration,
exact capability, and `published=false`. There is **no general recovery
exception** for an offline Worker; once published, an unavailable Worker is
not implicitly authorized to re-register. A new independent recovery/
security-admission process would need a separate review.

## Release and security constraints

1. **Default remains OFF**; merging code or deploying this PR does not
   enable the exception. Do not set the flag until an independently reviewed
   migration window, policy #400 first-party admission, session and
   tenant proof, target Worker and caller consumer snapshot, and recoverable
   Railway variable delivery process are ready.
2. The feature flag and existing one-time key display are NOT a secret
   manager. No raw keys or Railway tokens should be sent to GitHub.
3. On/off is deployment-time configuration; enable only during the
   controlled migration. Restore OFF immediately after **both** Workers
   register in the target. It is not a permanent onboarding workflow.
4. No old key revocation, automatic Worker redeployment, public slug
   transfer, or migration success state is triggered by issuing a key.
5. Core Draft #440 remains separate. Publication and alias transfer is a
   later independently verified transaction, never implied by key issuance.

## Verification

New Vitest cases cover default DENY, explicit allowlist, exact
capability/scope/target selection, wrong legacy origin, non-worker denial,
exact-target caller selection alongside legacy registration, and narrowly
gated prepublication first-party Worker recovery. Published-but-disconnected
and untrusted Worker recovery cases are explicitly denied. Tests are source-authored; exact
repository test execution must be performed separately before merge.

The flag is **not set** in production and this branch is Draft.
