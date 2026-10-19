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
      method: 'POST...[truncated]