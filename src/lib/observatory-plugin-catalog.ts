import 'server-only'

import { parsePluginCatalog, QdipClient, type PluginCatalogEntry } from '@qdip/client'

import { normalizeDipBaseUrl } from '@/lib/dip-url'
import { DIP_USE_CASES } from '@/use-cases/registry'

export type CorePluginPublication = PluginCatalogEntry

// These specific demos were already publicly listed before the admin controls.
// New application routes are PRIVATE until explicitly published.
const LEGACY_PUBLIC = new Set([
  'resource-allocation',
  'supply-network-optimization',
  'contractor-allocation',
  'gtm-lab',
])

export function corePluginConnection(): { base: string; key: string } {
  const base = normalizeDipBaseUrl(process.env.DIP_API_BASE_URL ?? process.env.DIP_URL)
  // The Core publication endpoint currently accepts the platform API key only.
  // Reuse the existing server-only key for P0; a scoped catalog key requires
  // a Core authorization contract, not an arbitrary additional environment key.
  const key = process.env.DIP_ADMIN_API_KEY?.trim() || process.env.DIP_API_KEY?.trim() || ''
  if (!base || !key) throw new Error('QDIP Core admin connection is not configured')
  const url = new URL(base)
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))
    throw new Error('QDIP Core requires HTTPS')
  return { base, key }
}

/** The Observatory backend is an SDK consumer, never a second registry client. */
export function coreCatalogClient(): QdipClient {
  const { base, key } = corePluginConnection()
  return new QdipClient({
    baseUrl: base,
    adminApiKey: key,
    allowInsecureLoopback: process.env.NODE_ENV === 'test',
  })
}

export async function readCorePublications(): Promise<CorePluginPublication[]> {
  return coreCatalogClient().catalog.list()
}

export type AdminPluginSecurity = { state: string; reason: string | null; criticalBlock: boolean }

/** Admin-only projection: the SDK catalog parser intentionally omits security review metadata. */
export async function readAdminCorePublications(): Promise<
  (CorePluginPublication & { security?: AdminPluginSecurity })[]
> {
  const { base, key } = corePluginConnection()
  const response = await fetch(`${base}/api/v1/plugin-publications`, {
    headers: { 'x-api-key': key, accept: 'application/json' },
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(12_000),
  })
  if (!response.ok) throw new Error('Core publication registry unavailable')
  const raw: unknown = await response.json()
  const entries = parsePluginCatalog(raw)
  if (!Array.isArray(raw)) throw new Error('Invalid Core catalog')
  return entries.map((entry, index) => {
    const security: unknown = raw[index]?.security
    if (entry.source !== 'remote') return entry
    if (!security || typeof security !== 'object' || !('state' in security) || typeof security.state !== 'string') {
      return { ...entry, security: { state: 'unknown', reason: null, criticalBlock: false } }
    }
    const reason = 'reason' in security && typeof security.reason === 'string' ? security.reason : null
    const criticalBlock = 'critical_block' in security && security.critical_block === true
    return { ...entry, security: { state: security.state, reason, criticalBlock } }
  })
}

export function visibleUseCases(records: readonly CorePluginPublication[]): string[] {
  const byName = new Map(records.map((item) => [item.name, item]))
  return DIP_USE_CASES.filter((item) => {
    const record = byName.get(item.plugin.id)
    if (!record) return LEGACY_PUBLIC.has(item.id)
    if (!record.enabled || !record.capabilities.includes(item.plugin.capability)) return false
    if (record.published === null) return LEGACY_PUBLIC.has(item.id)
    return (
      record.published === true &&
      record.published_version === record.version &&
      record.capability_id === item.plugin.capability
    )
  }).map((item) => item.id)
}

export async function visiblePluginUseCaseIds(): Promise<string[]> {
  try {
    return visibleUseCases(await readCorePublications())
  } catch {
    // Only the existing Playwright harness may display legacy mock cards.
    return process.env.QDIP_PLAYWRIGHT_LEGACY_CATALOG === '1' ? visibleUseCases([]) : []
  }
}

/** Public-facing catalog entries are server-derived and expose no infrastructure keys. */
export function publishedPluginEntries(records: readonly CorePluginPublication[]): CorePluginPublication[] {
  return records.filter(
    (plugin) =>
      /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(plugin.name) &&
      // Publication and current runtime availability are independent states.
      // Preserve published details only for disconnected remote SDK workers.
      // Locally disabled embedded plugins must still disappear from public listings.
      (plugin.enabled || plugin.source === 'remote') &&
      plugin.published === true &&
      plugin.published_version === plugin.version &&
      typeof plugin.capability_id === 'string' &&
      plugin.capabilities.includes(plugin.capability_id)
  )
}

export async function publishedPlugins(): Promise<CorePluginPublication[]> {
  try {
    return publishedPluginEntries(await readCorePublications())
  } catch {
    // No public fallbacks: unavailable Core or admin credential must fail closed.
    return []
  }
}
