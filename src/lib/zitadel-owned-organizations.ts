import 'server-only'

/**
 * Account-owned plugin organizations (#425).
 *
 * ZITADEL is the authority: no QDIP organization is created or inferred from
 * plugin IDs. This service only exposes existing ZITADEL organizations for
 * which the authenticated (issuer, subject) has a current ORG_OWNER role.
 *
 * Requires a separate read-only service principal with org.read and
 * org.member.read permissions. Never reuse the ZITADEL login-client token.
 */
const ORG_ID = /^\d{1,64}$/
const USER_ID = /^\d{1,64}$/
const MAX_ORGANIZATIONS = 100
const MAX_ADMINS_PER_ORG = 100
const LIMIT_BYTES = 128_000

export type ZitadelOwnerPrincipal = { issuer: string; sub: string }
export type OwnedZitadelOrganization = { id: string; name: string }

export class ZitadelOwnerLookupError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message)
  }
}

function serviceConnection(principal: ZitadelOwnerPrincipal): { base: string; token: string } {
  const issuer = process.env.ZITADEL_ISSUER?.replace(/\/+$/, '') ?? ''
  const token = process.env.ZITADEL_ORG_READER_TOKEN ?? ''
  let url: URL
  try {
    url = new URL(issuer)
  } catch {
    throw new ZitadelOwnerLookupError(503, 'Zitadel organization lookup unavailable')
  }
  if (
    url.protocol !== 'https:' ||
    url.pathname !== '/' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    principal.issuer !== url.origin ||
    !USER_ID.test(principal.sub) ||
    token.length < 16 ||
    token.length > 8192 ||
    /[\x00-\x20\x7f]/.test(token)
  ) {
    throw new ZitadelOwnerLookupError(503, 'Zitadel organization lookup unavailable')
  }
  return { base: url.origin, token }
}

async function readZitadel<T>(
  connection: { base: string; token: string },
  path: string,
  body: Record<string, unknown>,
  connect = false
): Promise<T> {
  let response: Response
  try {
    response = await fetch(connection.base + path, {
      method: 'POST',
      headers: {
        authorization: 'Bearer ' + connection.token,
        'content-type': 'application/json',
        accept: 'application/json',
        ...(connect ? { 'connect-protocol-version': '1' } : {}),
      },
      body: JSON.stringify(body),
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    })
  } catch {
    throw new ZitadelOwnerLookupError(503, 'Zitadel organization lookup unavailable')
  }
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined)
    throw new ZitadelOwnerLookupError(503, 'Zitadel organization permission verification failed')
  }
  const length = response.headers.get('content-length')
  if (length && Number(length) > LIMIT_BYTES)
    throw new ZitadelOwnerLookupError(502, 'Zitadel organization response too large')
  let raw: string
  try {
    raw = await response.text()
  } catch {
    throw new ZitadelOwnerLookupError(503, 'Zitadel organization lookup unavailable')
  }
  if (raw.length > LIMIT_BYTES)
    throw new ZitadelOwnerLookupError(502, 'Zitadel organization response too large')
  try {
    return JSON.parse(raw) as T
  } catch {
    throw new ZitadelOwnerLookupError(502, 'Invalid Zitadel organization response')
  }
}

type OrgRecord = { id?: unknown; name?: unknown; state?: unknown }
type AdminRecord = { user?: { id?: unknown }; roles?: unknown; organizationId?: unknown }

export async function listOwnedZitadelOrganizations(
  principal: ZitadelOwnerPrincipal
): Promise<OwnedZitadelOrganization[]> {
  const connection = serviceConnection(principal)
  const catalog = await readZitadel<{
    result?: unknown
    details?: { totalResult?: unknown }
  }>(connection, '/v2/organizations/_search', { query: { offset: 0, limit: MAX_ORGANIZATIONS } })
  if (!Array.isArray(catalog.result) ||
    catalog.result.length > MAX_ORGANIZATIONS ||
    (typeof catalog.details?.totalResult === 'number' && catalog.details.totalResult > MAX_ORGANIZATIONS)
  ) throw new ZitadelOwnerLookupError(503, 'Zitadel organization list requires pagination')

  const organizations: OwnedZitadelOrganization[] = []
  const seen = new Set<string>()
  for (const candidate of catalog.result as OrgRecord[]) {
    if (!candidate || typeof candidate.id !== 'string' ||
      !ORG_ID.test(candidate.id) || typeof candidate.name !== 'string' ||
      candidate.name.length < 1 || candidate.name.length > 120 ||
      seen.has(candidate.id)) throw new ZitadelOwnerLookupError(502, 'Invalid Zitadel organization identity')
    seen.add(candidate.id)
    if (candidate.state !== 'ORGANIZATION_STATE_ACTIVE') continue
    // Filter by the organization resource on the trusted Zitadel side. Do
    // not treat a user's home organization or project role as ownership.
    const membership = await readZitadel<{
      administrators?: unknown
      pagination?: { totalResult?: unknown }
    }>(connection, '/zitadel.internal_permission.v2.InternalPermissionService/ListAdministrators', {
      pagination: { offset: 0, limit: MAX_ADMINS_PER_ORG, asc: true },
      filters: [{ resource: { organizationId: candidate.id } }],
    }, true)
    if (!Array.isArray(membership.administrators) ||
      membership.administrators.length > MAX_ADMINS_PER_ORG ||
      (typeof membership.pagination?.totalResult === 'number' &&
        membership.pagination.totalResult > MAX_ADMINS_PER_ORG)
    ) throw new ZitadelOwnerLookupError(503, 'Zitadel administrator list requires pagination')

    const isOwner = (membership.administrators as AdminRecord[]).some(
      (entry) => entry?.user?.id === principal.sub &&
        Array.isArray(entry.roles) && entry.roles.includes('ORG_OWNER') &&
        // Some Zitadel revisions omit resource from returned rows once the
        // server-side resource filter is applied. If present it must match.
        (entry.organizationId === undefined || entry.organizationId === candidate.id)
    )
    if (isOwner) organizations.push({ id: candidate.id, name: candidate.name })
  }
  return organizations
}

export async function verifyZitadelOrganizationOwner(
  principal: ZitadelOwnerPrincipal,
  organizationId: string
): Promise<OwnedZitadelOrganization> {
  if (!ORG_ID.test(organizationId))
    throw new ZitadelOwnerLookupError(422, 'Invalid Zitadel organization ID')
  const organizations = await listOwnedZitadelOrganizations(principal)
  const owned = organizations.find((org) => org.id === organizationId)
  if (!owned) throw new ZitadelOwnerLookupError(403, 'Zitadel organization owner permission required')
  return owned
}
