# QDIP Developer Applications — VHV connection

## Admin workflow

Visit `https://observatory.qdip.ai/uk/admin/apps` after the Observatory
release. Sign in with the existing Zitadel `observatory_admin` role.

Select **Create VHV keys**. This is a privileged QDIP bootstrap, not a
public unauthenticated API. The server uses the existing server-only Core
administrator connection, never exposes that platform credential, and
creates/reuses a QDIP-internal application isolation record. VHV does not
have its own organizations.

The one-time response contains **two** identities with an explicit
`allowed_capabilities: ["secretary.plan"]` policy, verified by Core
create-response and persisted readback:

| Role              | Scopes                            | Railway target                   | Variable              |
| ----------------- | --------------------------------- | -------------------------------- | --------------------- |
| VHV application   | `plugins:read`, `plugins:execute` | `@secretary/api`                 | `QDIP_API_KEY`        |
| Python SDK Worker | `plugins:register`                | `vhv-qdip-secretary-plan-worker` | `QDIP_REMOTE_API_KEY` |

The existing `QDIP_API_URL` and `QDIP_REMOTE_URL` remain as the HTTPS and
WSS endpoints respectively. The application credential is only consumed by
the **server-side** `@qdip/client@0.1.2` within NestJS; the Worker uses the
independent Python SDK-02. No `QDIP_READ_API_KEY`, root admin key, new
Gateway, or frontend key is needed.

The admin must save both secret values when displayed. This flow intentionally
does not pass browser-held secrets to an untrusted Railway URL, store them in
Web cookies, localStorage, server logs, GitHub, or source control. Never use
the QDIP platform root key in VHV.

## Register and publish

1. Deploy Core #384 capability-scoped authentication **before** creating
   credentials. On an older Core, this UI refuses to release unrestricted
   credentials and attempts to revoke them.
2. Save the two generated values into the specified Railway services.
   Apply the prepared exact-SHA VHV Nest + Worker build once, with the Worker
   using a real `wss://.../api/v1/remote-plugins/connect` endpoint.
3. Verify the Python SDK Worker registered `secretary.plan` in the same
   internal tenant as the VHV application credential.
4. Open `/uk/admin/plugins`. Choose the automatically SDK-registered
   `secretary` entry. Fill title, description, category and publish. The
   Observatory admin screen **does not create fake registry entries** and
   never registers a plugin without its SDK Worker.
5. Confirm the public `/uk/plugins/secretary` catalog page is accessible.
   Publication is separate from runtime execution authorization.
6. Complete the authenticated Zitadel → NestJS → QDIP SDK → Gateway → Python
   Worker → Kernel → PostgreSQL proposal + approval scenario. Verify
   tenant denial and absence of Google Calendar side effects before
   merging the remaining VHV release PR.

## Failure and recovery

- Missing Core admin credential: Core errors return generic 502/503.
- Missing policy support: credentials fail strict readback and are not
  displayed; new IDs are revoked when possible.
- Partial issuance: attempt revocation of every newly issued key. If
  revocation cannot be confirmed, return a blocking error and reconcile
  active key IDs before retrying.
- A second issuance creates new keys but does not revoke existing deployed
  credentials automatically. Rotate old credentials only after verified E2E.
- No production status should be claimed based only on a green unit test,
  successful creation response, or a published metadata record.

The admin page is currently an internal bootstrap interface; broader
developer self-service registration and app ownership remain future work.

## Route Optimizer (RO): той самий екран створення ключів

На `https://observatory.qdip.ai/uk/admin/apps` виберіть у списку застосунків
**Route Optimizer (RO)**, а потім натисніть **Створити ключ для RO**.

На відміну від VHV, для RO створюється **лише один ключ виклику**
з внутрішньою організацією `qdip-sdk-app:ro`:

- `environment: production` (поточна політика адміністративного інтерфейсу)
- `scopes: ["plugins:execute"]`
- `allowed_capabilities: ["route-optimizer.customer-coordinate-vrp.v1", "route-optimizer.customer-address-vrp.v1"]`
- строк дії 30 днів; перевіряється відповідь Core **та** збережена політика
- немає `plugins:register` та другого ключа SDK-02: приватний Route Worker не реєструється через SDK-02

Ключ показується лише один раз адміністратору. Збережіть його в
серверній змінній `QDIP_ROUTE_ORG_API_KEY` того backend-застосунку, яке
викликає `@qdip/client` через `routes.solveAddresses()` або
`routes.solveCoordinates()`. Не вставляйте цей ключ у браузер,
публічний SDK, GitHub чи код клієнтського інтерфейсу.

Тут **не відбувається автоматична передача секрету до Railway**:
інтерфейс не знає, в якому саме застосунку буде використовуватися RO.
Інтерфейс не активує приватний Worker, не створює публічний Gateway і не
публікує плагін в Observatory. Ключ має силу лише в межах зазначених
двох capabilities; якщо Core поверне ширші права, інтерфейс не
покаже секрет і намагатиметься відкликати щойно створений ключ.

Створення вимагає реальної сесії адміністратора Observatory з Zitadel.
Без цієї сесії API повертає 401/403; обхід через технічний ключ
платформи або вставлення ключа в чат не допускається.
