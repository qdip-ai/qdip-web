import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
import { publishedPluginEntries, visibleUseCases, type CorePluginPublication } from './observatory-plugin-catalog'

const meta: CorePluginPublication = {
  name: 'resource-allocation',
  version: '1.0',
  description: '',
  enabled: true,
  capabilities: ['humanitarian.resource-allocation.optimize'],
  capability_versions: {},
  ui: {},
  published: null,
  revision: 0,
  capability_id: null,
  published_version: null,
}

describe('Observatory use-case projection', () => {
  it('never lists Readiness Recovery: it is an independent plugin service', () => {
    const rr = {
      ...meta,
      name: 'qdip-rr',
      capabilities: ['readiness-recovery.scheduling.plan.v1'],
      capability_id: 'readiness-recovery.scheduling.plan.v1',
      published: true,
      published_version: meta.version,
    }
    expect(visibleUseCases([rr])).not.toContain('readiness-recovery')
    expect(visibleUseCases([])).not.toContain('readiness-recovery')
  })
  it('keeps plugin-only application visibility', () => {
    const resource = {
      ...meta,
      name: 'resource-allocation',
      capabilities: ['humanitarian.resource-allocation.optimize'],
      capability_id: 'humanitarian.resource-allocation.optimize',
      published: true,
      published_version: meta.version,
    }
    expect(visibleUseCases([resource])).toContain('resource-allocation')
    expect(visibleUseCases([{ ...resource, published: false }])).not.toContain('resource-allocation')
  })
})

describe('published plugin directory', () => {
  const approved: CorePluginPublication = {
    ...meta,
    name: 'route-optimizer',
    source: 'remote',
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
  it('excludes unpublished and stale catalog entries', () => {
    expect(publishedPluginEntries([{ ...approved, published: false }])).toEqual([])
    expect(publishedPluginEntries([{ ...approved, published_version: '1.0' }])).toEqual([])
    expect(publishedPluginEntries([{ ...approved, capability_id: 'unknown' }])).toEqual([])
    expect(publishedPluginEntries([{ ...approved, name: '../escape' }])).toEqual([])
  })
})
