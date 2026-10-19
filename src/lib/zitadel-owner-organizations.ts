import 'server-only'

import { corePluginConnection } from '@/lib/observatory-plugin-catalog'
import { signZitadelOwnerLink, signZitadelOwnerList } from '@/lib/zitadel-org-link-assertion'

/** Zitadel credential stays only in private Core. This BFF never sees it. */
const ID = /^[0-9]{1,32}$/
const MAX_ORGS = 100
const MAX_BODY = 131_072
type Identity = { issuer: string; sub: string }
export type ZitadelOwnerOrganization = { id: string; name: string; state: 'active' }

export class OwnerOrganizationError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message)
  }
}

function trust(identity: Identity): void {
  const issuer = process.env.ZITADEL_ISSUER?.replace(/\/+$/, '') ?? ''
  if (!issuer || identity.issuer !== issuer || !ID.test(identity.sub)) {
    throw new OwnerOrganizationError(503, 'Zitadel organization verification unavailable')
  }
  try {
    const url = new URL(issuer)
    if (url.protocol !== 'https:' || url.pathname !== '/' || url.search || url.hash || url.username || url.password)
      throw new Error('Invalid issuer')
  } catch {
    throw new OwnerOrganizationError(503, 'Zitadel organization verification unavailable')
  }
}

function core(): { origin: string; key: string } {
  let base: string
  let key: string
  try {
    const connection = corePluginConnection()
    base = connection.base
    key = connection.key
  } catch {
    throw new OwnerOrganizationError(503, 'QDIP Core organization verification unavailable')
  }
  try {
    const url = new URL(base)
    if (
      url.protocol !== 'https:' ||
      url.username || url.password || url.search || url.hash ||
      !['/', '/api/v1', '/api/v1/'].includes(url.pathname) ||
      !key
    )
      throw new Error('Invalid Core connection')
    return { origin: url.origin, key }
  } catch {
    throw new OwnerOrganizationError(503, 'QDIP Core organization verification unavailable')
  }
}

async function ownerRequest(route: 'zitadel-owned' | 'zitadel-owner-proof', body: object): Promise<unknown> {
  const { origin, key } = core()
  let response: Response
  try {
    response = await fetch(origin + '/api/v1/organizations/' + route, {
      method: 'POST',
      headers: { 'x-api-key': key, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(body),
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
    })
  } catch {
    throw new OwnerOrganizationError(503, 'Zitadel organization verification unavailable')
  }
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined)
    throw new OwnerOrganizationError(
      response.status === 403 ? 403 : 503,
      response.status === 403 ? 'Zitadel organization owner required' : 'Zitadel organization verification unavailable'
    )
  }
  const size = response.headers.get('content-length')
  if (size && Number(size) > MAX_BODY) throw new OwnerOrganizationError(503, 'Invalid QDIP organization response')
  try {
    const raw = await response.text()
    if (raw.length > MAX_BODY) throw new Error('Response too large')
    return JSON.parse(raw) as unknown
  } catch {
    throw new OwnerOrganizationError(503, 'Invalid QDIP organization response')
  }
}

function isOrganization(value: unknown): value is ZitadelOwnerOrganization {
  return Boolean(
    value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      'id' in value &&
      typeof value.id === 'string' &&
      ID.test(value.id) &&
      'name' in value &&
      typeof value.name === 'string' &&
      value.name.trim() &&
      value.name.length <= 120 &&
      'state' in value &&
      value.state === 'active'
  )
}

/** One signed Core request; only live-verified owner organizations are returned. */
export async function listOwnedZitadelOrganizations(identity: Identity): Promise<ZitadelOwnerOrganization[]> {
  trust(identity)
  const raw = await ownerRequest('zitadel-owned', {
    issuer: identity.issuer,
    authenticated_subject: identity.sub,
    ...signZitadelOwnerList(identity),
  })
  if (!raw || typeof raw !== 'object' || !('organizations' in raw) || !Array.isArray(raw.organizations)) {
    throw new OwnerOrganizationError(503, 'Invalid QDIP organization response')
  }
  const organizations: unknown[] = raw.organizations
  if (organizations.length > MAX_ORGS || !organizations.every(isOrganization)) {
    throw new OwnerOrganizationError(503, 'Invalid QDIP organization response')
  }
  const ids = organizations.map((org) => (org as ZitadelOwnerOrganization).id)
  if (new Set(ids).size !== ids.length) throw new OwnerOrganizationError(503, 'Duplicate QDIP organization')
  return organizations as ZitadelOwnerOrganization[]
}

/** Called again on EACH key read, issue and revoke: a previous link is not authorization. */
export async function verifyOwnedZitadelOrganization(
  identity: Identity,
  organizationId: string
): Promise<ZitadelOwnerOrganization> {
  if (!ID.test(organizationId)) throw new OwnerOrganizationError(422, 'Invalid Zitadel organization')
  trust(identity)
  const raw = await ownerRequest('zitadel-owner-proof', {
    issuer: identity.issuer,
    organization_id: organizationId,
    authenticated_subject: identity.sub,
    ...signZitadelOwnerLink({ ...identity, organizationId }),
  })
  if (!isOrganization(raw) || raw.id !== organizationId) {
    throw new OwnerOrganizationError(503, 'QDIP organization identity mismatch')
  }
  return raw
}
