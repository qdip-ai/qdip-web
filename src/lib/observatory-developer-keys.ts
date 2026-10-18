import 'server-only'

import { randomUUID } from 'node:crypto'
import { corePluginConnection } from '@/lib/observatory-plugin-catalog'

/**
 * Trusted Observatory backend only. All application tenants are internal QDIP
 * isolation records; the VHV application neither creates nor stores orgs.
 */
const APP_NAME = /^[A-Za-z][A-Za-z0-9-]{1,31}$/
const CAPABILITY = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/
const UUID = /^[a-f0-9-]{36}$/i
const RAW_KEY = /^dip-[a-f0-9]{32}$/
const APP_SCOPES = ['plugins:read', 'plugins:execute']
const WORKER_SCOPES = ['plugins:register']
const RO_SCOPES = ['plugins:execute']
export const RO_CAPABILITIES = [
  'route-optimizer.customer-coordinate-vrp.v1',
  'route-optimizer.customer-address-vrp.v1',
] as const
const LIMIT = 131_072

export type DeveloperKeyPair = {
  application: string
  capability: string
  environment: 'production'
  app: { key: string; expiresAt: string }
  worker: { key: string; expiresAt: string }
}

export type RouteDeveloperKey = {
  application: 'RO'
  capabilities: readonly string[]
  environment: 'production'
  app: { key: string; expiresAt: string }
  worker: null
}

type CoreOrg = { id: string; name: string }
type CoreKey = {
  id: string
  key?: string
  org_id: string
  name: string
  environment: string
  scopes: string[]
  allowed_capabilities: string[] | null
  expires_at: string | null
  revoked_at: string | null
}

export class DeveloperKeyError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message)
  }
}

function exactArray(actual: unknown, expected: string[]) {
  return (
    Array.isArray(actual) &&
    actual.length === expected.length &&
    actual.every((item, index) => item === expected[index])
  )
}

function safeCore() {
  const { base, key } = corePluginConnection()
  const origin = new URL(base)
  if (
    origin.protocol !== 'https:' &&
    !(
      process.env.NODE_ENV === 'test' &&
      origin.protocol === 'http:' &&
      ['localhost', '127.0.0.1'].includes(origin.hostname)
    )
  )
    throw new DeveloperKeyError(503, 'QDIP Core HTTPS origin required')
  if (origin.username || origin.password || origin.search || origin.hash || origin.pathname !== '/')
    throw new DeveloperKeyError(503, 'QDIP Core origin misconfigured')
  return { origin: origin.origin, key }
}

async function coreRequest<T>(method: 'GET' | 'POST', path: string, body?: Record<string, unknown>): Promise<T> {
  const { origin, key } = safeCore()
  let response: Response
  try {
    response = await fetch(origin + '/api/v1/' + path, {
      method,
      headers: {
        'x-api-key': key,
        accept: 'application/json',
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(8_000),
    })
  } catch {
    throw new DeveloperKeyError(503, 'QDIP Core unavailable')
  }
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined)
    if ([401, 403].includes(response.status))
      throw new DeveloperKeyError(502, 'QDIP administrative credential rejected')
    throw new DeveloperKeyError(503, 'QDIP Core operation failed')
  }
  const length = response.headers.get('content-length')
  if (length && Number(length) > LIMIT) throw new DeveloperKeyError(502, 'QDIP Core response too large')
  let data: string
  try {
    data = await response.text()
  } catch {
    throw new DeveloperKeyError(502, 'Invalid QDIP Core response')
  }
  if (data.length > LIMIT) throw new DeveloperKeyError(502, 'QDIP Core response too large')
  try {
    return JSON.parse(data) as T
  } catch {
    throw new DeveloperKeyError(502, 'Invalid QDIP Core response')
  }
}

function validPolicy(
  key: CoreKey, orgId: string, name: string, scopes: string[], capabilities: readonly string[]
) {
  const remaining = Date.parse(key.expires_at ?? '') - Date.now()
  return (
    key.org_id === orgId &&
    key.name === name &&
    key.environment === 'production' &&
    exactArray(key.scopes, scopes) &&
    exactArray(key.allowed_capabilities, [...capabilities]) &&
    key.revoked_at === null &&
    Number.isFinite(remaining) &&
    remaining > 29 * 86_400_000 &&
    remaining <= 31 * 86_400_000
  )
}

async function revoke(orgId: string, keyId: string) {
  try {
    await coreRequest('POST', 'organizations/' + orgId + '/keys/' + keyId + '/revoke', {})
    return true
  } catch {
    return false
  }
}

async function issue(
  orgId: string, name: string, scopes: string[], capabilities: readonly string[]
) {
  const expiresAt = new Date(Date.now() + 30 * 86_400_000).toISOString()
  const key = await coreRequest<CoreKey>('POST', 'organizations/' + orgId + '/keys', {
    name,
    environment: 'production',
    scopes,
    allowed_capabilities: [...capabilities],
    expires_at: expiresAt,
  })
  // Return the key ID to the caller before validating the one-time raw
  // material. A malformed raw response must still be revoked if possible.
  if (!UUID.test(key?.id ?? '')) throw new DeveloperKeyError(502, 'QDIP Core returned an invalid credential ID')
  return key
}

/**
 * The same admin-only credential issuer supports VHV and Route Optimizer.
 * VHV requires two identities (app + SDK-02 Worker); RO's existing private
 * route Worker does not REGISTER remotely, so RO needs just one caller key.
 * Core must independently attest exact scopes and capability allowlists.
 */
export function createDeveloperCredentials(
  application: 'VHV', capability: 'secretary.plan'
): Promise<DeveloperKeyPair>
export function createDeveloperCredentials(
  application: 'RO', capability: 'route-optimizer.customer-address-vrp.v1'
): Promise<RouteDeveloperKey>
export function createDeveloperCredentials(
  application: string, capability: string
): Promise<DeveloperKeyPair | RouteDeveloperKey>
export async function createDeveloperCredentials(
  application: string, capability: string
): Promise<DeveloperKeyPair | RouteDeveloperKey> {
  const vhv = application === 'VHV' && capability === 'secretary.plan'
  const route = application === 'RO' && capability === RO_CAPABILITIES[1]
  if (!APP_NAME.test(application) || !CAPABILITY.test(capability) || (!vhv && !route))
    throw new DeveloperKeyError(422, 'Unsupported application or capability')

  const name = 'qdip-sdk-app:' + application.toLowerCase()
  const orgs = await coreRequest<CoreOrg[]>('GET', 'organizations')
  if (!Array.isArray(orgs)) throw new DeveloperKeyError(502, 'Invalid QDIP organization response')
  const existing = orgs.filter((org) => org && org.name === name && UUID.test(org.id))
  if (existing.length > 1) throw new DeveloperKeyError(409, 'Ambiguous QDIP application identity')
  const org = existing[0] ?? (await coreRequest<CoreOrg>('POST', 'organizations', { name }))
  if (!org || !UUID.test(org.id) || org.name !== name)
    throw new DeveloperKeyError(502, 'QDIP application isolation was not created')

  const operation = randomUUID()
  const keyIds: string[] = []
  const capabilities: string[] = route ? [...RO_CAPABILITIES] : ['secretary.plan']
  const appScopes = route ? RO_SCOPES : APP_SCOPES
  try {
    const app = await issue(org.id, 'app/' + application + '/' + operation, appScopes, capabilities)
    keyIds.push(app.id)
    if (!RAW_KEY.test(app.key ?? '')) throw new DeveloperKeyError(502, 'Invalid application credential')
    let worker: CoreKey | null = null
    if (vhv) {
      worker = await issue(
        org.id, 'worker/' + application + '/' + operation, WORKER_SCOPES, capabilities
      )
      keyIds.push(worker.id)
      if (!RAW_KEY.test(worker.key ?? ''))
        throw new DeveloperKeyError(502, 'Invalid Worker credential')
    }

    const stored = await coreRequest<CoreKey[]>('GET', 'organizations/' + org.id + '/keys')
    if (!Array.isArray(stored)) throw new DeveloperKeyError(502, 'QDIP key policy readback failed')
    const issued = worker ? [[app, appScopes], [worker, WORKER_SCOPES]] as const :
      [[app, appScopes]] as const
    for (const [credential, scopes] of issued) {
      const matches = stored.filter((row) => row.id === credential.id)
      if (
        !validPolicy(credential, org.id, credential.name, scopes, capabilities) ||
        matches.length !== 1 ||
        !validPolicy(matches[0], org.id, credential.name, scopes, capabilities)
      ) {
        throw new DeveloperKeyError(502, 'QDIP key restrictions not verified; keys not released')
      }
    }
    if (route) {
      return {
        application: 'RO', capabilities, environment: 'production',
        app: { key: app.key!, expiresAt: app.expires_at! },
        worker: null,
      }
    }
    return {
      application: 'VHV', capability: 'secretary.plan', environment: 'production',
      app: { key: app.key!, expiresAt: app.expires_at! },
      worker: { key: worker!.key!, expiresAt: worker!.expires_at! },
    }
  } catch {
    const outcomes = await Promise.all(keyIds.map((id) => revoke(org.id, id)))
    if (outcomes.some((result) => !result))
      throw new DeveloperKeyError(
        503, 'Key creation failed; revocation unverified. Contact administrator before retry'
      )
    throw new DeveloperKeyError(503, 'Unable to issue verified scoped credentials')
  }
}
