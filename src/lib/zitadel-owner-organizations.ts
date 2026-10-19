import 'server-only'

/**
 * Owner candidates come from ZITADEL, never from QDIP Core pseudo-orgs.
 * This adapter is read-only and deliberately fails closed if ZITADEL has
 * not granted the QDIP server org.read + org.member.read.
 *
 * The existing PROJECT_OWNER_VIEWER credential must not be promoted: use
 * a distinct ZITADEL_ORG_READ_TOKEN with narrowly audited permissions.
 */
const ID = /^[0-9]{1,32}$/
const MAX_ORGS = 100
const MAX_ADMINS = 100
const MAX_BODY = 131_072

export type ZitadelOwnerOrganization = {
  id: string
  name: string
  state: 'active'
}

export class OwnerOrganizationError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message)
  }
}

type Identity = { issuer: string; sub: string }
type Organization = { id?: unknown; name?: unknown; state?: unknown }
type Administrator = {
  user?: { id?: unknown }
  roles?: unknown
  organization?: unknown
  organizationId?: unknown
  instance?: unknown
}

function config(identity: Identity): { issuer: string; token: string } {
  const issuer = process.env.ZITADEL_ISSUER?.replace(/\/+$/, '')
  const token = process.env.ZITADEL_ORG_READ_TOKEN
  if (!issuer || !token || token.length < 32 || identity.issuer !== issuer || !ID.test(identity.sub)) {
    throw new OwnerOrganizationError(503, 'Zitadel organization verification unavailable')
  }
  try {
    const url = new URL(issuer)
    if (url.protocol !== 'https:' || url.pathname !== '/' || url.search || url.hash || url.username || url.password) {
      throw new Error('invalid issuer')
    }
  } catch {
    throw new OwnerOrganizationError(503, 'Zitadel organization verification unavailable')
  }
  return { issuer, token }
}

async function query(
  settings: { issuer: string; token: string },
  path: string,
  payload: Record<string, unknown>,
  connect = false
): Promise<Record<string, unknown>> {
  let response: Response
  try {
    response = await fetch(settings.issuer + path, {
      method: 'POST',
      headers: {
        authorization: 'Bearer ' + settings.token,
        accept: 'application/json',
        'content-type': 'application/json',
        ...(connect ? { 'connect-protocol-version': '1' } : {}),
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(8000),
    })
  } catch {
    throw new OwnerOrganizationError(503, 'Zitadel verification unreachable')
  }
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined)
    // Never disclose the upstream response body or service-account token.
    throw new OwnerOrganizationError(503, 'Zitadel organization permissions unavailable')
  }
  const declared = response.headers.get('content-length')
  if (declared && Number(declared) > MAX_BODY) {
    throw new OwnerOrganizationError(503, 'Zitadel organization listing incomplete')
  }
  let raw: string
  try {
    raw = await response.text()
  } catch {
    throw new OwnerOrganizationError(503, 'Zitadel verification failed')
  }
  if (raw.length > MAX_BODY) throw new OwnerOrganizationError(503, 'Zitadel organization listing incomplete')
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error('invalid')
    return parsed as Record<string, unknown>
  } catch {
    throw new OwnerOrganizationError(503, 'Invalid Zitadel verification response')
  }
}

function exactCount(body: Record<string, unknown>, actual: number, max: number): void {
  const pagination = body.pagination ?? body.details
  if (!pagination || typeof pagination !== 'object' || Array.isArray(pagination)) {
    throw new OwnerOrganizationError(503, 'Zitadel pagination evidence missing')
  }
  const count = (pagination as Record<string, unknown>).totalResult
  if (!Number.isSafeInteger(Number(count)) || count === null || count === undefined) {
    throw new OwnerOrganizationError(503, 'Zitadel pagination evidence invalid')
  }
  if (Number(count) !== actual || actual > max) {
    throw new OwnerOrganizationError(503, 'Zitadel organization listing incomplete')
  }
}

function belongsToOrg(admin: Administrator, id: string): boolean {
  if (admin.instance === true) return false
  const object = admin.organization
  const explicit = admin.organizationId === id
  const nested =
    object !== null &&
    typeof object === 'object' &&
    !Array.isArray(object) &&
    ((object as Record<string, unknown>).organizationId === id || (object as Record<string, unknown>).id === id)
  return explicit || nested || object === id
}

export async function listOwnedZitadelOrganizations(identity: Identity): Promise<ZitadelOwnerOrganization[]> {
  const settings = config(identity)
  const orgs = await query(settings, '/v2/organizations/_search', {
    query: { offset: 0, limit: MAX_ORGS, asc: true },
  })
  const records = orgs.result
  if (!Array.isArray(records)) throw new OwnerOrganizationError(503, 'Invalid Zitadel organization list')
  exactCount(orgs, records.length, MAX_ORGS)

  const verified: ZitadelOwnerOrganization[] = []
  const seen = new Set<string>()
  // Batch bounded org-member checks; no partial listing is returned if any
  // required organization query fails, even if earlier checks succeeded.
  const rows = records as Organization[]
  for (let offset = 0; offset < rows.length; offset += 6) {
    const batch = rows.slice(offset, offset + 6)
    const granted = await Promise.all(
      batch.map(async (row): Promise<ZitadelOwnerOrganization | null> => {
        if (!ID.test(String(row?.id ?? '')) || typeof row.name !== 'string' || !row.name.trim()) {
          throw new OwnerOrganizationError(503, 'Invalid Zitadel organization identity')
        }
        const id = row.id as string
        if (seen.has(id)) throw new OwnerOrganizationError(503, 'Duplicate Zitadel organization')
        seen.add(id)
        if (row.state !== 'ORGANIZATION_STATE_ACTIVE') return null

        const admins = await query(
          settings,
          '/zitadel.internal_permission.v2.InternalPermissionService/ListAdministrators',
          {
            pagination: { offset: 0, limit: MAX_ADMINS },
            filters: [
              { resource: { organizationId: id } },
              { inUserIdsFilter: { ids: [identity.sub] } },
              { role: { roleKey: 'ORG_OWNER' } },
            ],
          },
          true
        )
        if (!Array.isArray(admins.administrators)) {
          throw new OwnerOrganizationError(503, 'Invalid Zitadel administrator listing')
        }
        exactCount(admins, admins.administrators.length, MAX_ADMINS)
        const hasOwner = (admins.administrators as Administrator[]).some(
          (admin) =>
            admin &&
            admin.user?.id === identity.sub &&
            admin.instance !== true &&
            ((admin.organization === undefined && admin.organizationId === undefined) || belongsToOrg(admin, id)) &&
            Array.isArray(admin.roles) &&
            admin.roles.includes('ORG_OWNER')
        )
        return hasOwner ? { id, name: row.name.trim(), state: 'active' } : null
      })
    )
    for (const org of granted) if (org) verified.push(org)
  }
  return verified.sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Authorize one selected tenant in O(1) Zitadel requests rather than enumerate
 * every organization for each key operation. The server's exact resource,
 * principal and role filters are mandatory; never trust home-org claims.
 */
export async function verifyOwnedZitadelOrganization(
  identity: Identity,
  organizationId: string
): Promise<ZitadelOwnerOrganization> {
  if (!ID.test(organizationId)) throw new OwnerOrganizationError(422, 'Invalid Zitadel organization')
  const settings = config(identity)
  const result = await query(settings, '/v2/organizations/_search', {
    query: { offset: 0, limit: 2, asc: true },
    queries: [{ idQuery: { id: organizationId } }],
  })
  if (!Array.isArray(result.result)) throw new OwnerOrganizationError(503, 'Invalid Zitadel organization lookup')
  exactCount(result, result.result.length, 2)
  const matches = (result.result as Organization[]).filter(
    (row) => row?.id === organizationId && row.state === 'ORGANIZATION_STATE_ACTIVE'
  )
  if (
    result.result.length !== 1 ||
    matches.length !== 1 ||
    typeof matches[0].name !== 'string' ||
    !matches[0].name.trim()
  )
    throw new OwnerOrganizationError(403, 'Zitadel organization inactive or not found')

  const owners = await query(
    settings,
    '/zitadel.internal_permission.v2.InternalPermissionService/ListAdministrators',
    {
      pagination: { offset: 0, limit: MAX_ADMINS, asc: true },
      filters: [
        { resource: { organizationId } },
        { inUserIdsFilter: { ids: [identity.sub] } },
        { role: { roleKey: 'ORG_OWNER' } },
      ],
    },
    true
  )
  if (!Array.isArray(owners.administrators)) throw new OwnerOrganizationError(503, 'Zitadel owner verification invalid')
  exactCount(owners, owners.administrators.length, MAX_ADMINS)
  const granted = (owners.administrators as Administrator[]).some(
    (admin) =>
      admin &&
      admin.instance !== true &&
      admin.user?.id === identity.sub &&
      Array.isArray(admin.roles) &&
      admin.roles.includes('ORG_OWNER') &&
      // Zitadel can omit the resource in a reply to a resource-filtered query.
      // Explicit mismatches must always fail closed.
      ((admin.organization === undefined && admin.organizationId === undefined) || belongsToOrg(admin, organizationId))
  )
  if (!granted) throw new OwnerOrganizationError(403, 'Current Zitadel ORG_OWNER role required')
  return { id: organizationId, name: matches[0].name.trim(), state: 'active' }
}
