import 'server-only'

import { QdipClient, type PluginCatalogEntry } from '@qdip/client'

import { normalizeDipBaseUrl } from '@/lib/dip-url'
import { DIP_USE_CASES } from '@/use-cases/registry'

export type CorePluginPublication = PluginCatalogEntry

// These specific demos were already publicly listed before the admin controls.
// New application routes are PRIVATE until explicitly published.
const LEGACY_PUBLIC = new Set(['resource-allocation', 'supply-network-optimization', 'readiness-recovery', 'gtm-lab'])

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
    // Existing browser fixtures intentionally run without Core; this explicit
    // Playwright-only override is set by playwright.config.ts, never by Web.
    // Production fails closed if Core cannot verify publication status.
    if (process.env.QDIP_PLAYWRIGHT_LEGACY_CATALOG === '1') {
      return visibleUseCases([])
    }
    return []
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
