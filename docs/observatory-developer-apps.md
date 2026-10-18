# QDIP Observatory — universal plugin key management

Open `https://observatory.qdip.ai/uk/admin/apps` with a real Zitadel
`observatory_admin` session. The interface has two sections:

- **Available to connect:** enabled plugins with registered capabilities
  in the authoritative QDIP Core SDK catalog and no active execution key.
- **Credentials issued:** plugins with active organization-scoped keys;
  this is **not** a claim that the Worker is online or that a real E2E has
  completed. Existing VHV keys are read from Core and thus disappear from
  the available list automatically. After revoking a key the item may
  appear again under Available.

There are **no plugin-name hardcodes** in the key issuance, frontend selection,
or access inventory. New Doctor, RR and third-party SDK-registered plugins
appear via the Core catalog with no edits to Observatory.

## Creating a key

Choose the registered plugin, select the permitted capabilities and purpose:

- **Invoke plugin:** `plugins:read` and `plugins:execute`, with an explicit
  maximum 16 capability-ID allowlist; this key goes to the server-side caller
  using the existing `@qdip/client`.
- **Register Worker:** `plugins:register` for an outgoing SDK-02 Worker.
  A registration key is not a caller key. A plugin with only a registration
  key remains available to receive a caller key.

For a new unregistered plugin there is an explicit **manual bootstrap**
option: enter its immutable plugin ID and capability IDs (as declared in its
own SDK manifest). Only administrators can do this; issuance does **not**
register a plugin or publish its metadata. Once its SDK Worker registers,
the catalog becomes the source of truth and mismatched requested
capabilities are refused.

The server checks the Core create response AND persisted key readback:
organization, scope array, exact allowed capabilities, name, environment,
expiry and revocation. Unverified new keys are not revealed and the server
attempts to revoke them. If issuance outcome/revocation is uncertain it
fails closed and tells the operator to reconcile keys before retrying.

Keys are displayed only once in a `Cache-Control: private, no-store`
response, never in inventory, source files, logs, public browser assets
or Observatory localStorage. The admin can revoke a key from the
Credentials issued section; revocation immediately blocks future
requests, but does not stop already accepted work.

The implementation reads Core `plugin-publications`,
`organizations`, and `organizations/{orgId}/keys`. Org-scoped keys
are stored in `qdip-sdk-plugin:<pluginId>` (older app organizations
`qdip-sdk-app:<app>` are recognized for backward compatibility, including
VHV). Key scope and capability restrictions remain enforced by **Core**.

## Important separation

An API key authorizes _access_; it does not install or register a plugin,
start a Worker, publish an Observatory catalog entry or prove the
Kernel produced a result. Registered plugins appear automatically through
their SDK manifests; private Route Optimizer uses its existing private
`@qdip/client.routes` adapter so delivery addresses must not be routed
through ordinary `PluginRuntime` raw Mongo audit. It needs its own
private Worker deployment, org-scoped key and feature flags.
