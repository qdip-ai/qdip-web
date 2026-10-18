import { describe, expect, it } from 'vitest'
import type { PluginCatalogEntry } from '@qdip/client'
import { launchLinkForPlugin, validPublicApplicationUrl } from './observatory-plugin-launch'

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
  application_url: 'https://vhv.qdip.ai',
}

describe('public plugin application links', () => {
  it('uses the catalog-approved application destination, not hardcoded VHV identity', () => {
    expect(launchLinkForPlugin(vhv)).toEqual({ href: 'https://vhv.qdip.ai', host: 'vhv.qdip.ai' })
    expect(launchLinkForPlugin({
      ...vhv,
      name: 'remote-other-provider',
      plugin_id: 'optimizer',
      slug: 'optimizer',
      application_url: 'https://other-example.dev/start',
    })).toEqual({ href: 'https://other-example.dev/start', host: 'other-example.dev' })
  })

  it('still provides a published external app when a remote Worker is offline', () => {
    expect(launchLinkForPlugin({ ...vhv, enabled: false })).toEqual({
      href: 'https://vhv.qdip.ai', host: 'vhv.qdip.ai',
    })
  })

  it('never exposes a button for unpublished or stale catalog records', () => {
    expect(launchLinkForPlugin({ ...vhv, published: false })).toBeNull()
    expect(launchLinkForPlugin({ ...vhv, published_version: '0.0.9' })).toBeNull()
    expect(launchLinkForPlugin({ ...vhv, capability_id: 'other.capability' })).toBeNull()
    expect(launchLinkForPlugin({ ...vhv, capabilities: [] })).toBeNull()
    // Transitional VHV link remains available until its admin record is migrated.
    expect(launchLinkForPlugin({ ...vhv, application_url: null })).toEqual({
      href: 'https://vhv.qdip.ai', host: 'vhv.qdip.ai',
    })
    expect(launchLinkForPlugin({
      ...vhv, name: 'remote-third-party', application_url: null,
    })).toBeNull()
  })

  it.each([
    'http://example.com', 'javascript:alert(1)', '//example.com',
    'https://user:secret@example.com', 'https://example.com?token=secret',
    'https://example.com/#fragment', 'https://example.com:8443',
    'https://127.0.0.1', 'https://localhost', 'https://example.local',
    'https://example.com\\@evil.test', 'https://example.com/' + 'x'.repeat(520),
  ])('rejects unsafe application link %s', (url) => {
    expect(validPublicApplicationUrl(url)).toBe(false)
    expect(launchLinkForPlugin({ ...vhv, application_url: url })).toBeNull()
  })

  it('only accepts public HTTPS destinations and supports paths', () => {
    expect(validPublicApplicationUrl('https://vhv.qdip.ai')).toBe(true)
    expect(validPublicApplicationUrl('https://console.example.org/app')).toBe(true)
  })
})
