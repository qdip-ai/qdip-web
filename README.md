# QDIP Platform

One Next.js application serving the QDIP product family:

| Host                  | Surface                          | Internal route                         |
| --------------------- | -------------------------------- | -------------------------------------- |
| `qdip.ai`             | Product and platform site        | `/`                                    |
| `studio.qdip.ai`      | Decision configuration           | `/studio`                              |
| `observatory.qdip.ai` | Demonstrators and decision audit | `/en`, `/pl`, `/observatory/decisions` |

Host ownership lives in `src/routing-config.ts`. `next.config.ts` uses Next.js built-in host-conditioned `rewrites()` and `redirects()`; there is no application Proxy/middleware router.
Canonical public paths use the same `/[locale]/...` shape on every product surface. Local development mirrors production hosts through `qdip.localhost`, `studio.localhost`, and `observatory.localhost`.
Generated `*.vercel.app` preview hosts are matched only by the marketing rewrite.

## Local development

```bash
cp .env.example .env
pnpm install --frozen-lockfile
pnpm dev
```

Use the product-local hosts so local routing exercises the same host contracts as production:

- marketing: `http://qdip.localhost:3000/en`
- Studio: `http://studio.localhost:3000/en`
- Observatory: `http://observatory.localhost:3000/en`

The internal `/studio` and `/platform` paths are rewrite destinations only. Direct requests are permanently redirected to canonical public URLs by Next.js `redirects()`.

## Environment

Platform URLs have production-safe defaults and can be overridden:

- `NEXT_PUBLIC_SITE_URL` — defaults to `https://qdip.ai`
- `NEXT_PUBLIC_STUDIO_URL` — defaults to `https://studio.qdip.ai`
- `NEXT_PUBLIC_OBSERVATORY_URL` — defaults to `https://observatory.qdip.ai`

The hostname of each configured origin is automatically registered as the owner of that surface. Staging/custom domains therefore do not require a second routing configuration. A host cannot belong to more than one surface; startup fails fast if the configured origins collide.

Backend integration uses:

- `DIP_API_BASE_URL` — DIP backend base URL
- `DIP_API_KEY` — legacy/shared API key for server-side QDIP requests (Studio/Observatory). Do not rotate it to an RR-only key.
- `RR_ORG_API_KEY` — separate **server-only** organization-scoped Core key for the single-organization RR BFF. It must belong to the pre-existing Core organization corresponding to the authorized Zitadel organization, with minimum `decisions:read`, `audit:read`, `decisions:execute` scopes. Provision via a reviewed platform-admin organization-key path; the plugin key UI issues `plugins:*` scopes and is not a substitute. The legacy `DIP_API_KEY` RR fallback is for migration/isolated E2E only; a successful production RR acceptance requires `RR_ORG_API_KEY`.

### Decision inquiry email delivery

The public Describe your decision form is delivered server-side through authenticated Zoho Mail SMTP. Configure these server-only variables in local `.env` and in the production secret store:

- `ZOHO_SMTP_USER` — Zoho mailbox used as both sender and recipient, e.g. `hello@qdip.ai`
- `ZOHO_SMTP_PASSWORD` — Zoho app password for that mailbox
- `ZOHO_SMTP_HOST` — optional; defaults to `smtp.zoho.com`. Override it if the Zoho Admin Console assigns a data-center-specific SMTP hostname.
- `ZOHO_SMTP_PORT` — optional; defaults to `465` using implicit TLS/SSL.

The SMTP connection is created only from the Node.js server route. Credentials are never exposed through `NEXT_PUBLIC_*` variables or sent to the browser. The visitor email is used only as the validated `Reply-To`; the authenticated Zoho mailbox remains both the `From` and delivery address.

Zoho supports authenticated SMTP over SSL on port 465. If the account uses a data-center-specific SMTP hostname, use the exact value shown in the Zoho Mail account/Admin Console rather than changing application code.

## Zitadel OIDC access control

QDIP reuses the existing Zitadel instance with a separate Web Application. Use
**Authorization Code + PKCE**, client authentication `none`, issuer `ZITADEL_ISSUER`,
and client ID `ZITADEL_CLIENT_ID`. There is no client secret.

Configure the application's **exact** login redirect URI:
`https://qdip.ai/api/auth/callback/zitadel`. A single callback on the main
domain is sufficient: login sets a secure, HttpOnly session cookie scoped to
`qdip.ai` and available to `studio.qdip.ai` and `observatory.qdip.ai`.
Identity is verified from Zitadel's signed ID token (JWKS, issuer, audience,
expiry and nonce); PKCE and signed state bind the login exchange.
No Zitadel token or QDIP API key is sent to the browser.

Set `QDIP_AUTH_COOKIE_SECRET` (random 32+ chars) **only on qdip-web**.
It signs the short-lived browser session and OIDC login-state cookie; qdip-core
never reads or validates these cookies. Store the value in web hosting secrets.

QDIP uses **Zitadel project roles**, not user ID allowlists. Set the static
`ZITADEL_QDIP_PROJECT_ID` and `ZITADEL_QDIP_ORGANIZATION_ID` (numeric IDs from
the Zitadel Console) once in the qdip-web deployment. They are not secrets.
The project ID must be the project that defines the QDIP roles; the org ID
must be the organization whose grants should authorize the single-org Core
API key.

Role keys are configured once (and are independent):

- `QDIP_STUDIO_ZITADEL_ROLE_KEY` — defaults to `studio`.
- `QDIP_RR_ZITADEL_ROLE_KEY` — defaults to `rr_operator`.

Create these application roles (or set their exact existing role keys) in
Zitadel **Project → Roles**, and assign them through **Role Assignments**.
Set **Project → Assert Roles on Authentication** and enable **User Roles Inside
ID Token** for the QDIP Web application. The OIDC login requests the
project audience and project role claims explicitly. Server-side authorization
accepts only `urn:zitadel:iam:org:project:<projectId>:roles` in the
_cryptographically validated_ ID token and only grants belonging to the
configured organization ID. It fails closed if there is no valid role claim.
A Studio grant does not imply an RR grant, or vice versa.

The callback creates a signed HttpOnly session containing only the validated
subject and normalized role flags — never Zitadel tokens. Studio and RR
privileged BFF API boundaries independently check this session. Changes
made to role assignments in Zitadel require **no Vercel secret edits or
redeployment**; they take effect at the user's **next login**, or no later
than session expiry (maximum 60 minutes). For immediate removal, the user
must log out, and administrators should separately revoke active access
using the appropriate session strategy if a stricter revocation SLA is needed.
An account with neither role is denied at login; pre-migration sessions
are denied rather than silently retaining previous permissions.

Studio pages remain publicly browsable; only privileged Studio BFF calls
require Studio roles. Public marketing, inquiry and demonstrator routes
remain public. The existing server-only organization-scoped API key continues
to authorize Core operations; Zitadel roles alone do not create a Core tenant.
Legacy RR password login stays retired (HTTP 410).

Separately, `RR_ACTOR_ASSERTION_SECRET` **must** be identical on qdip-web
and qdip-core. It authenticates the short-lived, pseudonymous RR actor assertion
that qdip-web sends to Core on execute/replan for audit attribution. It is not
the browser-session secret, and neither secret replaces the Core API key.

**Security boundary:** This is a single-organization hosted BFF integration, not
yet production multi-tenant OIDC-to-Core authorization, comprehensive per-user
authorization (beyond the signed RR actor audit attribution),
a replacement for Core API keys or real-time role revocation.
Only deploy with trusted `*.qdip.ai` subdomains and strict TLS. A shared domain
cookie is intentionally visible (as an HttpOnly cookie) to the QDIP subdomains.
Development on unrelated `*.localhost` hosts does not have cross-host SSO;
use a same-origin local callback for a single surface or test on a TLS staging
domain under `qdip.ai` after updating allowed Redirect URIs.

## Deployment

Assign `qdip.ai`, `studio.qdip.ai`, and `observatory.qdip.ai` to the same deployment. Next.js selects the surface declaratively in `next.config.ts` using host conditions; no runtime middleware/proxy or separate build is required. Configure the three DNS records according to the hosting provider and set the backend and Zoho SMTP environment variables above.

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

New work must use a feature branch; see `CONTRIBUTING.md`.
