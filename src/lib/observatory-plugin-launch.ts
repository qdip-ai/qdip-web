import type { PluginCatalogEntry } from '@qdip/client'

export type PluginLaunchLink = Readonly<{ href: string; host: string }>

/**
 * A catalog link is navigation only; it is not a QDIP capability invocation.
 * Core accepts this field only through audited platform-admin publication.
 * Reject unsafe/invalid URLs again at the public rendering boundary.
 */
export function launchLinkForPlugin(plugin: PluginCatalogEntry): PluginLaunchLink | null {
  if (
    plugin.published !== true ||
    plugin.published_version !== plugin.version ||
    typeof plugin.capability_id !== 'string' ||
    !plugin.capabilities.includes(plugin.capability_id) ||
    typeof plugin.application_url !== 'string'
  ) return null
  const value = plugin.application_url
  if (!value || value.length > 512 || value !== value.trim() || /[\\\\\x00-\x1f\x7f]/.test(value)) return null
  try {
    const url = new URL(value)
    const labels = url.hostname.toLowerCase().split('.')
    if (
      url.protocol !== 'https:' || url.username || url.password ||
      url.search || url.hash || url.port || url.hostname.endsWith('.') ||
      labels.length < 2 ||
      !labels.every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) ||
      !/^[a-z]{2,63}$/.test(labels[labels.length - 1] ?? '')
    ) return null
    return { href: value, host: url.hostname }
  } catch {
    return null
  }
}
