import { describe, expect, it } from 'vitest'
import type { PluginCatalogEntry } from '@qdip/client'
import { launchLinkForPlugin } from './observatory-plugin-launch'

const vhv: PluginCatalogEntry = {
  name: 'remote-04e7c87d7b72111c-secretary',
  plugin_id: 'secretary',
  source: 'remote',
  slug: 'vhv',
  version: '0.1.0',
  description: 'Decision-aware planning',
  enabled: true,
  capabilities: ['secretary.plan'],
  capability_versions: { 'secretary.plan': '1' },
  ui: { label: 'VHV — Decision Assistant' },
  published: true,
  revision: 3,
  capability_id: 'secretary.plan',
  published_version: '0.1.0',
}

describe('trusted external application launch links', () => {
  it('launches the authentic, published VHV application from its canonical short-URL catalog entry', () => {
    expect(launchLinkForPlugin(vhv)).toEqual({ href: 'https://vhv.qdip.ai', application: 'VHV' })
  })

  it('supports the published VHV even if the Worker is temporarily offline or the slug changes', () => {
    expect(launchLinkForPlugin({ ...vhv, enabled: false, slug: 'secretary' })).toEqual({
      href: 'https://vhv.qdip.ai',
      application: 'VHV',
    })
  })

  it('never offers a public launch link for unpublished or stale capability versions', () => {
    expect(launchLinkForPlugin({ ...vhv, published: false })).toBeNull()
    expect(launchLinkForPlugin({ ...vhv, published_version: '0.0.9' })).toBeNull()
    expect(launchLinkForPlugin({ ...vhv, capability_id: 'other.capability' })).toBeNull()
    expect(launchLinkForPlugin({ ...vhv, capabilities: [] })).toBeNull()
  })

  it('does not give a fake VHV plugin the application URL', () => {
    expect(launchLinkForPlugin({ ...vhv, name: 'remote-attacker-secretary' })).toBeNull()
    expect(launchLinkForPlugin({ ...vhv, plugin_id: 'other-plugin' })).toBeNull()
    expect(launchLinkForPlugin({ ...vhv, source: 'embedded' })).toBeNull()
    expect(
      launchLinkForPlugin({
        ...vhv,
        name: 'remote-attacker-secretary',
        slug: 'vhv',
        ui: { label: 'VHV — Decision Assistant' },
      })
    ).toBeNull()
  })
})
