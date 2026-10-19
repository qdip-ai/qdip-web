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
  // Only return organizations for which the exact authenticated Zitadel
  // subject holds a current ORG_OWNER grant on that specific organization.
  for (const row of records as Organization[]) {
    if (!ID.test(String(row?.id ?? '')) || typeof row.name !== 'string' || !row.name.trim() || seen.has(String(row.id))) {
      throw new OwnerOrganizationError(503, 'Invalid Zitadel organization identity')
    }
    const id = row.id as string
    seen.add(id)
    if (row.state !== 'ORGANIZATION_STATE_ACTIVE') continue

    const admins = await query(
      settings,
      '/zitadel.internal_permission.v2.InternalPermissionService/ListAdministrators',
      {
        pagination: { offset: 0, limit: MAX_ADMINS },
        filters: [{ resource: { organizationId: id } }],
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
        belongsToOrg(admin, id) &&
        Array.isArray(admin.roles) &&
        admin.roles.includes('ORG_OWNER')
    )
    if (hasOwner) verified.push({ id, name: row.name.trim(), state: 'active' })
  }
  return verified.sort((a, b) => a.name.localeCompare(b.name))
}
