import type { PluginCatalogEntry } from '@qdip/client'

export type PluginLaunchLink = Readonly<{ href: string; host: string }>

/**
 * A catalog link is navigation only; it is not a QDIP capability invocation.
 * Core accepts this field only through audited platform-admin publication.
 * Reject unsafe/invalid URLs again at the public rendering boundary.
 */
/** A browser must not follow a private, credential-bearing or non-HTTPS destination. */
export function validPublicApplicationUrl(value: string): boolean {
  if (!value || value.length > 512 || value !== value.trim() || value.includes(String.fromCharCode(92)) || /[\x00-\x1f\x7f]/.test(value)) return false
  try {
    const url = new URL(value)
    const labels = url.hostname.toLowerCase().split('.')
    return url.protocol === 'https:' && !url.username && !url.password &&
      !url.search && !url.hash && !url.port && !url.hostname.endsWith('.') &&
      labels.length >= 2 &&
      !['localhost', 'local', 'internal', 'lan', 'test', 'invalid', 'example'].includes(labels[labels.length - 1] ?? '') &&
      labels.every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) &&
      /^[a-z]{2,63}$/.test(labels[labels.length - 1] ?? '')
  } catch {
    return false
  }
}

export function launchLinkForPlugin(plugin: PluginCatalogEntry): PluginLaunchLink | null {
  if (
    plugin.published !== true ||
    plugin.published_version !== plugin.version ||
    typeof plugin.capability_id !== 'string' ||
    !plugin.capabilities.includes(plugin.capability_id) ||
    (plugin.application_url !== null && plugin.application_url !== undefined && typeof plugin.application_url !== 'string')
  ) return null
  // Transition only: retain the existing VHV link until an administrator
  // saves application_url through the generic catalog field. Do not infer
  // URLs from a user-controlled slug, name or worker-provided description.
  const legacyVhv = plugin.application_url === undefined || plugin.application_url === null
    ? plugin.name === 'remote-04e7c87d7b72111c-secretary' &&
      plugin.plugin_id === 'secretary' && plugin.source === 'remote' &&
      plugin.capability_id === 'secretary.plan'
    : false
  const value = plugin.application_url || (legacyVhv ? 'https://vhv.qdip.ai' : '')
  if (!validPublicApplicationUrl(value)) return null
  return { href: value, host: new URL(value).hostname }
}
