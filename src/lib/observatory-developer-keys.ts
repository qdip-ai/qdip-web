import 'server-only'

import { createHash, randomUUID } from 'node:crypto'
import { corePluginConnection } from '@/lib/observatory-plugin-catalog'

/** One generic, admin-only key manager. Plugin identity is data from Core. */
const PLUGIN_ID = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/
const CAPABILITY = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/
const UUID = /^[a-f0-9-]{36}$/i
const RAW_KEY = /^dip-[a-f0-9]{32}$/
const LIMIT = 131_072
const PREFIXES = ['qdip-sdk-app:', 'qdip-sdk-plugin:'] as const
const ROLE_SCOPES = {
  execute: ['plugins:read', 'plugins:execute'],
  worker: ['plugins:register'],
} as const

type Role = keyof typeof ROLE_SCOPES
type CoreOrg = {
  id: string
  name: string
  status?: string
  identity_provider?: string | null
  zitadel_organization_id?: string | null
  zitadel_issuer?: string | null
}
export type VerifiedOrganization = { id: string; issuer: string }
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
type CatalogPlugin = {
  name: string
  plugin_id?: string
  source?: 'embedded' | 'remote'
  enabled: boolean
  capabilities: string[]
  ui?: { label?: string }
  published?: boolean | null
}
export type ConnectedKey = {
  id: string
  orgId: string
  role: Role
  expiresAt: string
  capabilities: string[]
}
export type PluginKeyEntry = {
  id: string
  label: string
  capabilities: string[]
  registered: boolean
  enabled: boolean
  keys: ConnectedKey[]
}
export type PluginKeyInventory = {
  available: PluginKeyEntry[]
  connected: PluginKeyEntry[]
}
export type IssuedPluginKey = {
  pluginId: string
  key: string
  keyId: string
  expiresAt: string
  capabilities: string[]
  role: Role
}

export class DeveloperKeyError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message)
  }
}

const exact = (actual: unknown, expected: readonly string[]): boolean =>
  Array.isArray(actual) && actual.length === expected.length && actual.every((item, i) => item === expected[i])

function coreOrigin(): { origin: string; key: string } {
  let base: string
  let key: string
  try {
    const connection = corePluginConnection()
    base = connection.base
    key = connection.key
  } catch {
    console.error('observatory_plugin_keys: core connection not configured')
    throw new DeveloperKeyError(503, 'QDIP Core connection is not configured')
  }
  const url = new URL(base)
  if (
    (url.protocol !== 'https:' &&
      !(
        process.env.NODE_ENV === 'test' &&
        url.protocol === 'http:' &&
        ['localhost', '127.0.0.1'].includes(url.hostname)
      )) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !['/', '/api/v1', '/api/v1/'].includes(url.pathname)
  )
    throw new DeveloperKeyError(503, 'QDIP Core origin misconfigured')
  return { origin: url.origin, key }
}

async function core<T>(method: 'GET' | 'POST', path: string, payload?: Record<string, unknown>): Promise<T> {
  const { origin, key } = coreOrigin()
  const stage =
    path === 'plugin-publications'
      ? 'catalog'
      : path === 'organizations'
        ? 'organizations'
        : path.endsWith('/keys')
          ? 'credentials'
          : 'key-management'
  let response: Response
  try {
    response = await fetch(origin + '/api/v1/' + path, {
      method,
      headers: {
        'x-api-key': key,
        accept: 'application/json',
        ...(payload ? { 'content-type': 'application/json' } : {}),
      },
      body: payload ? JSON.stringify(payload) : undefined,
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
    })
  } catch {
    console.error('observatory_plugin_keys: Core request failed', stage, 'network')
    throw new DeveloperKeyError(503, `QDIP Core ${stage}: network error`)
  }
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined)
    console.error('observatory_plugin_keys: Core request failed', stage, response.status)
    throw new DeveloperKeyError(
      response.status === 401 || response.status === 403 ? 502 : 503,
      `QDIP Core ${stage}: HTTP ${response.status}`
    )
  }
  const length = response.headers.get('content-length')
  if (length && Number(length) > LIMIT) throw new DeveloperKeyError(502, 'Core response too large')
  let raw: string
  try {
    raw = await response.text()
  } catch {
    throw new DeveloperKeyError(502, 'Invalid QDIP response')
  }
  if (raw.length > LIMIT) throw new DeveloperKeyError(502, 'Core response too large')
  try {
    return JSON.parse(raw) as T
  } catch {
    throw new DeveloperKeyError(502, 'Invalid QDIP response')
  }
}

async function metadata(selected: VerifiedOrganization): Promise<{
  catalog: CatalogPlugin[]
  orgs: CoreOrg[]
  stored: Array<{ org: CoreOrg; keys: CoreKey[] }>
}> {
  const [catalog, orgs] = await Promise.all([
    core<CatalogPlugin[]>('GET', 'plugin-publications'),
    core<CoreOrg[]>('GET', 'organizations'),
  ])
  if (
    !Array.isArray(catalog) ||
    !Array.isArray(orgs) ||
    catalog.length > 1000 ||
    orgs.length > 500 ||
    orgs.some((o) => !o || typeof o.id !== 'string' || typeof o.name !== 'string')
  )
    throw new DeveloperKeyError(502, 'Invalid Core plugin or organization catalog')
  const validCatalog = catalog.filter(
    (p) =>
      p &&
      typeof p.name === 'string' &&
      PLUGIN_ID.test(p.name) &&
      Array.isArray(p.capabilities) &&
      p.capabilities.every((c) => typeof c === 'string' && CAPABILITY.test(c))
  )
  if (validCatalog.length < catalog.length)
    console.warn('observatory_plugin_keys: incompatible Core plugin identifiers', catalog.length - validCatalog.length)
  // Older independent SDK qualification organizations can use non-UUID IDs.
  // We never read their keys. Only plugin-managed organizations need the
  // strict UUID identity required by the key-management API.
  // The platform service credential is broad; never enumerate keys of
  // any tenant other than the actor's live-verified selected Zitadel org.
  const managed = orgs.filter(
    (o) =>
      o.identity_provider === 'zitadel' &&
      o.zitadel_organization_id === selected.id &&
      o.zitadel_issuer === selected.issuer &&
      o.status === 'active'
  )
  if (managed.some((org) => !UUID.test(org.id)))
    throw new DeveloperKeyError(502, 'Invalid managed plugin organization ID')
  // No key values are ever fetched from this read-only Core endpoint.
  const stored: Array<{ org: CoreOrg; keys: CoreKey[] }> = []
  for (let offset = 0; offset < managed.length; offset += 8) {
    const group = await Promise.all(
      managed.slice(offset, offset + 8).map(async (org) => {
        const keys = await core<CoreKey[]>('GET', 'organizations/' + org.id + '/keys')
        if (!Array.isArray(keys) || keys.length > 500) {
          throw new DeveloperKeyError(502, 'QDIP Core credentials: invalid key list')
        }
        return { org, keys }
      })
    )
    stored.push(...group)
  }
  return { catalog: validCatalog, orgs, stored }
}

/**
 * The public remote catalog name is derived by Core from the actual
 * organization id and the developer's plugin id. Never infer tenancy from
 * matching capability names, a display name, or an opaque catalog id.
 * Match the Core-generated fingerprint against ONLY existing managed orgs.
 */
function registeredRemoteOrg(
  plugin: CatalogPlugin,
  data: Pick<Awaited<ReturnType<typeof metadata>>, 'orgs'>
): CoreOrg | null {
  if (plugin.source !== 'remote') return null
  if (!plugin.plugin_id || !PLUGIN_ID.test(plugin.plugin_id)) return null
  const slug = [...plugin.plugin_id]
    .map((char) => (/^[A-Za-z0-9_.-]$/.test(char) ? char : '-'))
    .join('')
    .slice(0, 98)
  const matches = data.orgs.filter((org) => {
    if (
      !(PREFIXES.some((prefix) => org.name.startsWith(prefix)) || org.identity_provider === 'zitadel') ||
      !UUID.test(org.id)
    )
      return false
    const fingerprint = createHash('sha256')
      .update(org.id + '\0' + plugin.plugin_id)
      .digest('hex')
      .slice(0, 16)
    return plugin.name === 'remote-' + fingerprint + '-' + slug
  })
  if (matches.length > 1) throw new DeveloperKeyError(409, 'Ambiguous remote plugin tenant')
  return matches[0] ?? null
}

/** Only an already linked Zitadel organization is a valid issuance tenant. */
function verifiedCoreTenant(
  data: Pick<Awaited<ReturnType<typeof metadata>>, 'orgs'>,
  selected: VerifiedOrganization
): CoreOrg {
  if (!/^[0-9]{1,32}$/.test(selected.id) || !selected.issuer.startsWith('https://'))
    throw new DeveloperKeyError(403, 'Verified Zitadel organization required')
  const matches = data.orgs.filter(
    (org) =>
      org.identity_provider === 'zitadel' &&
      org.zitadel_organization_id === selected.id &&
      org.zitadel_issuer === selected.issuer &&
      org.status === 'active' &&
      UUID.test(org.id)
  )
  if (matches.length !== 1) throw new DeveloperKeyError(409, 'Zitadel organization must be linked in Core')
  return matches[0]
}

function isActive(key: CoreKey): boolean {
  return (
    key.environment === 'production' &&
    key.revoked_at === null &&
    typeof key.expires_at === 'string' &&
    Date.parse(key.expires_at) > Date.now() &&
    Array.isArray(key.allowed_capabilities) &&
    key.allowed_capabilities.length > 0
  )
}

function keyView(org: CoreOrg, key: CoreKey): ConnectedKey | null {
  if (!isActive(key) || !UUID.test(key.id)) return null
  const role: Role | null = exact(key.scopes, ROLE_SCOPES.worker)
    ? 'worker'
    : exact(key.scopes, ROLE_SCOPES.execute)
      ? 'execute'
      : null
  if (
    !role ||
    key.org_id !== org.id ||
    !key.allowed_capabilities ||
    key.allowed_capabilities.some((c) => typeof c !== 'string' || !CAPABILITY.test(c))
  )
    return null
  return {
    id: key.id,
    orgId: org.id,
    role,
    expiresAt: key.expires_at!,
    capabilities: [...key.allowed_capabilities],
  }
}

function rows(data: Awaited<ReturnType<typeof metadata>>, tenantId: string): PluginKeyEntry[] {
  const active: Array<ConnectedKey & { name: string }> = data.stored
    .filter(({ org }) => org.id === tenantId)
    .flatMap(({ org, keys }) =>
      keys.flatMap((key) => {
        const row = keyView(org, key)
        return row ? [{ ...row, name: key.name }] : []
      })
    )
  const items = new Map<string, PluginKeyEntry>()
  for (const plugin of data.catalog) {
    const caps = plugin.capabilities.filter((c): c is string => typeof c === 'string' && CAPABILITY.test(c))
    const pluginId = plugin.name
    const remoteOrg = plugin.source === 'remote' ? registeredRemoteOrg(plugin, data) : null
    // Do not advertise a remote plugin in the key-issuance form when its
    // authenticated registration tenant cannot be verified.
    if (plugin.source === 'remote' && remoteOrg?.id !== tenantId) continue
    const keys = active
      .filter((k) => (!remoteOrg || k.orgId === remoteOrg.id) && k.capabilities.some((c) => caps.includes(c)))
      .map(({ id, orgId, role, expiresAt, capabilities }) => ({ id, orgId, role, expiresAt, capabilities }))
    if (!caps.length || (!plugin.enabled && !keys.length)) continue
    items.set(pluginId, {
      id: pluginId,
      label: plugin.ui?.label || plugin.plugin_id || pluginId,
      capabilities: [...new Set(caps)].slice(0, 16),
      registered: true,
      enabled: true,
      keys,
    })
  }
  for (const record of active) {
    // Existing catalog items already own this credential. Do not create a
    // duplicate legacy-organization card such as "vhv" next to "VHV".
    const alreadyShown = [...items.values()].some((p) =>
      p.keys.some((k) => k.id === record.id && k.orgId === record.orgId)
    )
    if (alreadyShown) continue
    const match = /^access\/([A-Za-z0-9_.-]{1,128})\//.exec(record.name)
    // Backward compatibility for VHV and earlier app keys, without hardcoded names.
    const legacy = data.stored.find(({ org }) => org.id === record.orgId)?.org.name
    const id = match?.[1] || (legacy?.startsWith('qdip-sdk-app:') ? legacy.slice('qdip-sdk-app:'.length) : '')
    if (!id) continue
    if (items.has(id)) {
      // An old key issued against an opaque catalog ID belongs to another
      // tenant. Keep it visible for an administrator to revoke, but never
      // treat it as authorization for the registered Worker.
      const unmatchedId = 'unmatched-' + record.id
      items.set(unmatchedId, {
        id: unmatchedId,
        label: 'Unmatched credential: ' + id,
        capabilities: [...record.capabilities],
        registered: false,
        enabled: false,
        keys: [
          {
            id: record.id,
            orgId: record.orgId,
            role: record.role,
            expiresAt: record.expiresAt,
            capabilities: record.capabilities,
          },
        ],
      })
      continue
    }
    const keys = active
      .filter((x) => (match ? x.name.startsWith('access/' + id + '/') : x.orgId === record.orgId))
      .map(({ id: keyId, orgId, role, expiresAt, capabilities }) => ({
        id: keyId,
        orgId,
        role,
        expiresAt,
        capabilities,
      }))
    items.set(id, {
      id,
      label: id,
      capabilities: [...new Set(keys.flatMap((k) => k.capabilities))],
      registered: false,
      enabled: false,
      keys,
    })
  }
  return [...items.values()].sort((a, b) => a.label.localeCompare(b.label))
}

export async function listPluginCredentials(selected: VerifiedOrganization): Promise<PluginKeyInventory> {
  const data = await metadata(selected)
  const tenant = verifiedCoreTenant(data, selected)
  const entries = rows(data, tenant.id)
  return {
    available: entries.filter((p) => p.enabled && !p.keys.some((k) => k.role === 'execute')),
    connected: entries.filter((p) => p.keys.length > 0),
  }
}

async function revoke(orgId: string, keyId: string): Promise<void> {
  await core('POST', 'organizations/' + orgId + '/keys/' + keyId + '/revoke', {})
}

export async function revokePluginCredential(
  orgId: string,
  keyId: string,
  selected: VerifiedOrganization
): Promise<void> {
  if (!UUID.test(orgId) || !UUID.test(keyId)) throw new DeveloperKeyError(422, 'Invalid key identity')
  const data = await metadata(selected)
  const tenant = verifiedCoreTenant(data, selected)
  if (orgId !== tenant.id) throw new DeveloperKeyError(403, 'Cross-organization key revoke denied')
  const found = data.stored.find(({ org }) => org.id === orgId)
  if (!found || !found.keys.some((k) => k.id === keyId && keyView(found.org, k)))
    throw new DeveloperKeyError(404, 'Active managed key not found')
  await revoke(orgId, keyId)
}

export async function issuePluginCredential(
  pluginId: string,
  capabilities: string[],
  role: Role,
  selected: VerifiedOrganization,
  manual = false
): Promise<IssuedPluginKey> {
  if (
    !PLUGIN_ID.test(pluginId) ||
    !Array.isArray(capabilities) ||
    capabilities.length < 1 ||
    capabilities.length > 16 ||
    capabilities.some((x) => typeof x !== 'string' || !CAPABILITY.test(x)) ||
    new Set(capabilities).size !== capabilities.length ||
    !Object.hasOwn(ROLE_SCOPES, role) ||
    typeof manual !== 'boolean'
  )
    throw new DeveloperKeyError(422, 'Invalid plugin key policy')

  const data = await metadata(selected)
  const direct = data.catalog.find((p) => p.name === pluginId)
  // Manual bootstrap of a plugin already registered under an opaque catalog
  // name must reuse that registration, not create a new tenant.
  const remoteMatches = data.catalog.filter((p) => p.source === 'remote' && p.plugin_id === pluginId)
  if (remoteMatches.length > 1) throw new DeveloperKeyError(409, 'Ambiguous registered plugin ID')
  const registered = direct ?? remoteMatches[0]
  if (registered) {
    if (!registered.enabled || capabilities.some((c) => !registered.capabilities.includes(c)))
      throw new DeveloperKeyError(422, 'Capabilities not registered or plugin disabled')
  } else if (!manual) {
    throw new DeveloperKeyError(422, 'Plugin is not registered; use explicit manual bootstrap')
  }
  const tenant = verifiedCoreTenant(data, selected)
  const scopes = [...ROLE_SCOPES[role]]
  const org: CoreOrg = tenant
  let credentialPluginId = pluginId
  if (registered?.source === 'remote') {
    const registrationOrg = registeredRemoteOrg(registered, data)
    if (!registrationOrg) throw new DeveloperKeyError(409, 'Remote plugin tenant cannot be verified')
    // Old SDK per-plugin UUID orgs must be migrated before issuing new keys.
    if (registrationOrg.id !== tenant.id)
      throw new DeveloperKeyError(409, 'Remote plugin belongs to a legacy or different tenant; migration required')
    credentialPluginId = registered.plugin_id!
  }
  // The same capability can be present in multiple tenant organizations:
  // duplicate detection must be scoped to the resolved registration owner.
  const exactMatch = data.stored.some(
    ({ org: storedOrg, keys }) =>
      storedOrg.id === org.id &&
      keys.some((key) => {
        const row = keyView(storedOrg, key)
        return row && row.role === role && exact(row.capabilities, capabilities)
      })
  )
  if (exactMatch) throw new DeveloperKeyError(409, 'A matching active key already exists')

  const expiresAt = new Date(Date.now() + 30 * 86_400_000).toISOString()
  let created: CoreKey | null = null
  try {
    created = await core<CoreKey>('POST', 'organizations/' + org.id + '/keys', {
      name: 'access/' + credentialPluginId + '/' + randomUUID(),
      environment: 'production',
      scopes,
      allowed_capabilities: capabilities,
      expires_at: expiresAt,
    })
    if (!created || !UUID.test(created.id)) throw new DeveloperKeyError(503, 'Key issuance outcome unverified')
    const stored = await core<CoreKey[]>('GET', 'organizations/' + org.id + '/keys')
    const matches = Array.isArray(stored) ? stored.filter((k) => k.id === created!.id) : []
    const valid = (key: CoreKey) =>
      key.org_id === org.id &&
      key.name === created!.name &&
      key.environment === 'production' &&
      exact(key.scopes, scopes) &&
      exact(key.allowed_capabilities, capabilities) &&
      key.revoked_at === null &&
      Date.parse(key.expires_at ?? '') - Date.now() > 29 * 86_400_000 &&
      Date.parse(key.expires_at ?? '') - Date.now() <= 31 * 86_400_000
    if (!RAW_KEY.test(created.key ?? '') || !valid(created) || matches.length !== 1 || !valid(matches[0]))
      throw new DeveloperKeyError(502, 'Core failed scoped key attestation')
    return {
      pluginId,
      key: created.key!,
      keyId: created.id,
      expiresAt: created.expires_at!,
      capabilities,
      role,
    }
  } catch {
    if (!created?.id) {
      throw new DeveloperKeyError(503, 'Key issuance outcome unverified; reconcile keys before retry')
    }
    try {
      await revoke(org.id, created.id)
    } catch {
      throw new DeveloperKeyError(503, 'Key issuance failed; revocation unverified')
    }
    throw new DeveloperKeyError(503, 'Key issuance failed; new key revoked')
  }
}
