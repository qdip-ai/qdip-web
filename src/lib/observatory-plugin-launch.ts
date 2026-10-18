import type { PluginCatalogEntry } from '@qdip/client'

type LaunchCandidate = Pick<
  PluginCatalogEntry,
  'name' | 'plugin_id' | 'source' | 'published' | 'version' | 'published_version' | 'capability_id' | 'capabilities'
>

export type PluginLaunchLink = Readonly<{ href: string; application: string }>

/**
 * Trusted application destinations are controlled by Observatory code.
 * SDK-registered plugins cannot inject arbitrary outbound URLs or impersonate
 * another application's call-to-action through a display name or public slug.
 */
export function launchLinkForPlugin(plugin: LaunchCandidate): PluginLaunchLink | null {
  if (
    plugin.name === 'remote-04e7c87d7b72111c-secretary' &&
    plugin.plugin_id === 'secretary' &&
    plugin.source === 'remote' &&
    plugin.capability_id === 'secretary.plan' &&
    plugin.capabilities.includes('secretary.plan') &&
    plugin.published === true &&
    plugin.published_version === plugin.version
  ) {
    return { href: 'https://vhv.qdip.ai', application: 'VHV' }
  }
  return null
}
