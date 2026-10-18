import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
import { publishedPluginEntries, visibleUseCases, type CorePluginPublication } from './observatory-plugin-catalog'

const meta: CorePluginPublication = {
  name: 'readiness-recovery',
  version: '1.0',
  description: '',
  enabled: true,
  capabilities: ['operations.readiness-recovery.plan'],
  capability_versions: {},
  ui: {},
  published: null,
  revision: 0,
  capability_id: null,
  published_version: null,
}

describe('public Observatory plugin projection', () => {
  it('retains existing explicit public demo allowlist before admin override', () => {
    expect(visibleUseCases([meta])).toContain('readiness-recovery')
  })
  it('unpublish hides an existing application card', () => {
    expect(visibleUseCases([{ ...meta, published: false }])).not.toContain('readiness-recovery')
  })
  it('refuses published metadata with a stale version or wrong capability', () => {
    const published = { ...meta, published: true, published_version: '1.0', capability_id: meta.capabilities[0] }
    expect(visibleUseCases([published])).toContain('readiness-recovery')
    expect(visibleUseCases([{ ...published, published_version: '2.0' }])).not.toContain('readiness-recovery')
    expect(visibleUseCases([{ ...published, capability_id: 'unknown' }])).not.toContain('readiness-recovery')
    expect(visibleUseCases([{ ...published, enabled: false }])).not.toContain('readiness-recovery')
  })
  it('does not add arbitrary plugin IDs to the compiled Observatory route registry', () => {
    expect(visibleUseCases([{ ...meta, name: 'untrusted', published: true }])).not.toContain('untrusted')
  })
})

describe('published plugin directory', () => {
  const approved: CorePluginPublication = {
    ...meta,
    name: 'route-optimizer',
    source: 'remote',
    security: { state: 'approved', approval_source: 'trusted_first_party_manual' },
    version: '2.0',
    description: 'Delivery route optimization',
    ui: { label: 'Route Optimizer', category: 'Operations' },
    capabilities: ['routing.optimize'],
    published: true,
    capability_id: 'routing.optimize',
    published_version: '2.0',
  }
  it('includes approved installed plugins without a compiled use-case route', () => {
    expect(publishedPluginEntries([approved])).toEqual([approved])
    expect(visibleUseCases([approved])).not.toContain('route-optimizer')
  })
  it('preserves published catalog pages when a remote worker goes offline', () => {
    expect(publishedPluginEntries([{ ...approved, enabled: false }])).toEqual([{ ...approved, enabled: false }])
  })
  it('hides explicitly disabled embedded plugins from the public directory', () => {
    expect(publishedPluginEntries([{ ...approved, source: 'embedded', enabled: false }])).toEqual([])
  })
  it('excludes unapproved and permanently revoked remote plugins', () => {
    expect(publishedPluginEntries([{ ...approved, security: { state: 'pending_review' } }])).toEqual([])
    expect(publishedPluginEntries([{ ...approved, security: { state: 'quarantined' } }])).toEqual([])
    expect(publishedPluginEntries([{ ...approved, security: { state: 'revoked' } }])).toEqual([])
  })
  it('excludes unpublished and stale catalog entries', () => {
    expect(publishedPluginEntries([{ ...approved, published: false }])).toEqual([])
    expect(publishedPluginEntries([{ ...approved, published_version: '1.0' }])).toEqual([])
    expect(publishedPluginEntries([{ ...approved, capability_id: 'unknown' }])).toEqual([])
    expect(publishedPluginEntries([{ ...approved, name: '../escape' }])).toEqual([])
  })
})
