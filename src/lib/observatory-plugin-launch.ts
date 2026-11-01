import { safePluginLaunchUrl, type PluginCatalogEntry } from '@qdip/client'

export type PluginLaunchLink = Readonly<{ href: string; application: string }>

/**
 * Trusted application destinations are controlled by Observatory code.
 * SDK-registered plugins cannot inject arbitrary outbound URLs or impersonate
 * another application's call-to-action through a display name or public slug.
 */
export function launchLinkForPlugin(plugin: PluginCatalogEntry): PluginLaunchLink | null {
  if (
    (plugin.name === 'remote-04e7c87d7b72111c-secretary' || plugin.name === 'remote-3b25f5ae494aa7bf-secretary') &&
    plugin.plugin_id === 'secretary' &&
    plugin.source === 'remote' &&
    plugin.capability_id === 'secretary.plan' &&
    plugin.capabilities.includes('secretary.plan') &&
    plugin.published === true &&
    plugin.published_version === plugin.version
  ) {
    return { href: 'https://yara.qdip.ai', application: 'Yara' }
  }
  // Only admin-reviewed, typed Core catalog metadata may supply a URL.
  // The SDK Worker manifest never determines an outbound browser destination.
  if (
    plugin.published === true &&
    plugin.published_version === plugin.version &&
    !!plugin.capability_id &&
    plugin.capabilities.includes(plugin.capability_id) &&
    plugin.launch_url_verified === true &&
    safePluginLaunchUrl(plugin.application_launch_url)
  ) {
    return {
      href: plugin.application_launch_url,
      application: plugin.ui?.label || plugin.plugin_id || plugin.name,
    }
  }
  return null
}
