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
  ui: { label: 'Yara — Decision Assistant' },
  published: true,
  revision: 3,
  capability_id: 'secretary.plan',
  published_version: '0.1.0',
}

describe('trusted external application launch links', () => {
  it('launches the authentic, published Yara application from its canonical short-URL catalog entry', () => {
    expect(launchLinkForPlugin(vhv)).toEqual({ href: 'https://yara.qdip.ai', application: 'Yara' })
  })

  it('supports the published Yara even if the Worker is temporarily offline or the slug changes', () => {
    expect(launchLinkForPlugin({ ...vhv, enabled: false, slug: 'secretary' })).toEqual({
      href: 'https://yara.qdip.ai',
      application: 'Yara',
    })
  })

  it('recognizes the canonical-tenant Yara catalog identity without trusting a lookalike plugin', () => {
    const canonical = { ...vhv, name: 'remote-3b25f5ae494aa7bf-secretary', slug: 'yara' }
    expect(launchLinkForPlugin(canonical)).toEqual({
      href: 'https://yara.qdip.ai',
      application: 'Yara',
    })
    expect(launchLinkForPlugin({ ...canonical, name: 'remote-attacker-secretary' })).toBeNull()
    expect(launchLinkForPlugin({ ...canonical, plugin_id: 'different-plugin' })).toBeNull()
    expect(launchLinkForPlugin({ ...canonical, published: false })).toBeNull()
  })

  it('never offers a public launch link for unpublished or stale capability versions', () => {
    expect(launchLinkForPlugin({ ...vhv, published: false })).toBeNull()
    expect(launchLinkForPlugin({ ...vhv, published_version: '0.0.9' })).toBeNull()
    expect(launchLinkForPlugin({ ...vhv, capability_id: 'other.capability' })).toBeNull()
    expect(launchLinkForPlugin({ ...vhv, capabilities: [] })).toBeNull()
  })

  it('does not give a fake Yara plugin the application URL', () => {
    expect(launchLinkForPlugin({ ...vhv, name: 'remote-attacker-secretary' })).toBeNull()
    expect(launchLinkForPlugin({ ...vhv, plugin_id: 'other-plugin' })).toBeNull()
    expect(launchLinkForPlugin({ ...vhv, source: 'embedded' })).toBeNull()
    expect(
      launchLinkForPlugin({
        ...vhv,
        name: 'remote-attacker-secretary',
        slug: 'vhv',
        ui: { label: 'Yara — Decision Assistant' },
      })
    ).toBeNull()
  })

  it('launches an independently hosted SDK plugin only with the audited HTTPS destination', () => {
    const thirdParty: PluginCatalogEntry = {
      ...vhv,
      name: 'remote-different-tenant-routing',
      plugin_id: 'routing',
      slug: 'routes',
      capabilities: ['routes.optimize'],
      capability_id: 'routes.optimize',
      ui: { label: 'Route Optimizer' },
      application_launch_url: 'https://routing.partner-example.org/app',
      launch_url_verified: true,
    }
    expect(launchLinkForPlugin(thirdParty)).toEqual({
      href: 'https://routing.partner-example.org/app',
      application: 'Route Optimizer',
    })
    expect(launchLinkForPlugin({ ...thirdParty, launch_url_verified: false })).toBeNull()
    expect(launchLinkForPlugin({ ...thirdParty, application_launch_url: 'http://127.0.0.1/admin' })).toBeNull()
    expect(launchLinkForPlugin({ ...thirdParty, application_launch_url: 'https://private.internal/' })).toBeNull()
    expect(launchLinkForPlugin({ ...thirdParty, published: false })).toBeNull()
    expect(launchLinkForPlugin({ ...thirdParty, published_version: '0.2.0' })).toBeNull()
    expect(launchLinkForPlugin({ ...thirdParty, capabilities: [] })).toBeNull()
  })
})
