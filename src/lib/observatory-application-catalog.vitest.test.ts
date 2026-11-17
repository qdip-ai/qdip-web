import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/observatory-plugin-catalog', () => ({
  corePluginConnection: () => ({ base: 'https://core.qdip.test', key: 'k' }),
}))

import { readCoreApplications, visibleApplications } from './observatory-application-catalog'

const record = (over: Record<string, unknown> = {}) => ({
  application_id: 'readiness-recovery',
  version: '1',
  launch_url: 'https://rr.qdip.ai',
  required_capabilities: [],
  runtime_binding: { kind: 'sdk-plugin', organization_id: 'o', plugin_id: 'qdip-rr', plugin_version: '1.0.0' },
  status: 'published',
  revision: 1,
  published_at: null,
  published_by: null,
  admission: { ready: true, reasons: [] },
  visible: true,
  ...over,
})

const respond = (items: unknown[], ok = true) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ items }), { status: ok ? 200 : 503 }))
  )

afterEach(() => vi.unstubAllGlobals())

describe('independent application catalog (APP-PUBLISH-01)', () => {
  it('lists only visible, published applications with a safe external launch URL', async () => {
    respond([
      record(),
      record({ application_id: 'hidden', visible: false }),
      record({ application_id: 'draft', status: 'draft' }),
      record({ application_id: 'plain-http', launch_url: 'http://rr.qdip.ai' }),
    ])
    expect((await visibleApplications()).map((item) => item.application_id)).toEqual(['readiness-recovery'])
  })

  it('fails closed on Core outage or malformed records', async () => {
    respond([], false)
    expect(await visibleApplications()).toEqual([])
    respond([record({ application_id: '../x' })])
    expect(await visibleApplications()).toEqual([])
    await expect(readCoreApplications({ base: 'https://core.qdip.test', key: 'k' })).rejects.toThrow()
  })
})
