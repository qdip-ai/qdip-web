import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
import type { CoreApplicationPublication } from './observatory-application-catalog'
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

const publishedRR: CoreApplicationPublication = {
  application_id: 'readiness-recovery',
  version: '1',
  launch_route: '/readiness-recovery',
  required_capabilities: [
    {
      plugin_id: 'readiness-recovery-scheduler-sdk02',
      capability_id: 'readiness-recovery.scheduling.plan.v1',
      plugin_version: '0.1.0',
      capability_version: '1',
    },
  ],
  runtime_binding: { kind: 'rr-core-sdk02', organization_id: 'tenant' },
  status: 'published',
  revision: 1,
  published_at: '2026-11-12T12:00:00Z',
  published_by: 'admin',
  admission: { ready: true, reasons: [] },
  visible: true,
}

describe('independent Observatory application projection', () => {
  it('does not expose RR through legacy SDK plugin publication', () => {
    const sdkPublished = {
      ...meta,
      published: true,
      published_version: meta.version,
      capability_id: meta.capabilities[0],
    }
    expect(visibleUseCases([sdkPublished])).not.toContain('readiness-recovery')
    expect(visibleUseCases([{ ...sdkPublished, capabilities: ['readiness-recovery.evaluate'] }])).not.toContain(
      'readiness-recovery'
    )
  })
  it('publishes RR independently of plugin state', () => {
    expect(visibleUseCases([{ ...meta, enabled: false, published: false }], [publishedRR])).toContain(
      'readiness-recovery'
    )
    expect(visibleUseCases([], [publishedRR])).toContain('readiness-recovery')
  })
  it('hides RR on unpublish, runtime disconnection, or stale visible projection', () => {
    expect(visibleUseCases([], [{ ...publishedRR, status: 'unpublished', visible: false }])).not.toContain(
      'readiness-recovery'
    )
    expect(
      visibleUseCases([], [{ ...publishedRR, admission: { ready: false, reasons: ['offline'] }, visible: false }])
    ).not.toContain('readiness-recovery')
    expect(visibleUseCases([], [{ ...publishedRR, visible: false }])).not.toContain('readiness-recovery')
  })
  it('preserves existing plugin-only application visibility outside RR', () => {
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
