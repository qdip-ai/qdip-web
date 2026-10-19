import { createHash } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/observatory-plugin-catalog', () => ({
  corePluginConnection: () => ({
    base: 'https://core.qdip.test',
    key: 'PRIVATE-PLATFORM-ADMIN',
  }),
}))
import {
  DeveloperKeyError,
  issuePluginCredential,
  listPluginCredentials,
  revokePluginCredential,
} from './observatory-developer-keys'

const ORG = '12345678-1234-4234-8234-123456789abc'
const KEY_ID = '12345678-1234-4234-8234-123456789abd'
const SECRET = 'dip-' + 'a'.repeat(32)
const CAPS = ['sample.plan', 'sample.validate']
const remoteId = (tenant: string, pluginId: string) => {
  const fingerprint = createHash('sha256').update(tenant + '\0' + pluginId).digest('hex').slice(0, 16)
  return 'remote-' + fingerprint + '-' + pluginId
}
const expires = () => new Date(Date.now() + 30 * 86_400_000).toISOString()
const plugin = {
  name: 'sample',
  plugin_id: 'sample',
  enabled: true,
  capabilities: CAPS,
  ui: { label: 'Sample Planner' },
}
const org = { id: ORG, name: 'qdip-sdk-plugin:sample' }

const key = () => ({
  id: KEY_ID,
  key: SECRET,
  org_id: ORG,
  name: 'access/sample/' + KEY_ID,
  environment: 'production',
  scopes: ['plugins:read', 'plugins:execute'],
  allowed_capabilities: CAPS,
  expires_at: expires(),
  revoked_at: null,
})

afterEach(() => vi.unstubAllGlobals())

describe('Generic developer plugin keys', () => {
  it('lists installed plugins dynamically and moves already keyed VHV out of available', async () => {
    const vhv = {
      name: remoteId(ORG, 'secretary'),
      plugin_id: 'secretary',
      source: 'remote',
      enabled: true,
      capabilities: ['secretary.plan'],
      ui: { label: 'VHV' },
    }
    const vhvOrg = { id: ORG, name: 'qdip-sdk-app:vhv' }
    const legacyPlugin = { ...plugin, name: 'GTM Lab' }
    const unrelatedOrg = { id: 'sdk-gate-test-tenant', name: 'SDK qualification tenant' }
    const record = {
      ...key(),
      name: 'app/VHV/previous-operation',
      allowed_capabilities: ['secretary.plan'],
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string) => {
        const path = new URL(input).pathname
        if (path.endsWith('/plugin-publications')) return Response.json([vhv, legacyPlugin, plugin])
        if (path.endsWith('/organizations')) return Response.json([vhvOrg, unrelatedOrg])
        if (path.endsWith('/keys')) return Response.json([record])
        throw Error('Unexpected Core path: ' + path)
      })
    )
    const inventory = await listPluginCredentials()
    expect(inventory.connected.map((p) => p.label)).toEqual(['VHV'])
    expect(inventory.available.map((p) => p.label)).toEqual(['Sample Planner'])
    expect(inventory.connected[0].keys).toHaveLength(1)
    expect(JSON.stringify(inventory)).not.toContain(SECRET)
  })

  it('issues one key for arbitrary registered plugin with only selected capabilities', async () => {
    const calls: Array<Record<string, unknown>> = []
    const created = { ...key(), allowed_capabilities: ['sample.plan'] }
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, options: RequestInit) => {
        const url = new URL(input).pathname
        const method = options.method || 'GET'
        expect(options.redirect).toBe('error')
        expect((options.headers as Record<string, string>)['x-api-key']).toBe('PRIVATE-PLATFORM-ADMIN')
        if (url.endsWith('/plugin-publications')) return Response.json([plugin])
        if (method === 'GET' && url.endsWith('/organizations')) return Response.json([org])
        if (method === 'GET' && url.endsWith('/keys')) {
          const rest = { ...created }
          delete (rest as { key?: string }).key
          return Response.json(calls.length ? [rest] : [])
        }
        if (method === 'POST' && url.endsWith('/keys')) {
          const body = JSON.parse(String(options.body))
          calls.push(body)
          created.name = body.name
          return Response.json(created, { status: 201 })
        }
        throw Error('Unexpected Core path: ' + url)
      })
    )
    const response = await issuePluginCredential('sample', ['sample.plan'])
    expect(response.key).toBe(SECRET)
    expect(response.capabilities).toEqual(['sample.plan'])
    expect(calls).toHaveLength(1)
    expect(calls[0].scopes).toEqual(['plugins:read', 'plugins:execute'])
    expect(calls[0].allowed_capabilities).toEqual(['sample.plan'])
  })

  it('refuses unknown capability and forbids duplicate active keys', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string) => {
        const url = new URL(input).pathname
        if (url.endsWith('/plugin-publications')) return Response.json([plugin])
        if (url.endsWith('/organizations')) return Response.json([org])
        if (url.endsWith('/keys')) return Response.json([key()])
        throw Error('Unexpected Core path: ' + url)
      })
    )
    await expect(issuePluginCredential('sample', ['other.execute'])).rejects.toMatchObject({ status: 422 })
    await expect(issuePluginCredential('sample', CAPS)).rejects.toMatchObject({ status: 409 })
  })

  it('supports pre-registration bootstrap for arbitrary new SDK plugin', async () => {
    const issued = { ...key(), name: '', allowed_capabilities: ['new-plugin.run'] }
    const newOrg = { ...org, name: 'qdip-sdk-plugin:new-plugin' }
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, options: RequestInit) => {
        const url = new URL(input).pathname
        const method = options.method || 'GET'
        if (url.endsWith('/plugin-publications')) return Response.json([plugin])
        if (method === 'GET' && url.endsWith('/organizations')) return Response.json([])
        if (method === 'POST' && url.endsWith('/organizations')) return Response.json(newOrg)
        if (method === 'POST' && url.endsWith('/keys')) {
          issued.name = JSON.parse(String(options.body)).name
          issued.scopes = ['plugins:register']
          return Response.json(issued, { status: 201 })
        }
        if (method === 'GET' && url.endsWith('/keys')) return Response.json([issued])
        throw Error('Unexpected Core path: ' + url)
      })
    )
    await expect(issuePluginCredential('new-plugin', ['new-plugin.run'], 'worker', false)).rejects.toBeInstanceOf(
      DeveloperKeyError
    )
    const result = await issuePluginCredential('new-plugin', ['new-plugin.run'], 'worker', true)
    expect(result.role).toBe('worker')
    expect(result.capabilities).toEqual(['new-plugin.run'])
  })

  it('rejects invalid capabilities without network calls', async () => {
    const fetchStub = vi.fn()
    vi.stubGlobal('fetch', fetchStub)
    await expect(issuePluginCredential('../invalid', ['sample.plan'])).rejects.toMatchObject({ status: 422 })
    await expect(issuePluginCredential('GTM Lab', ['gtm-lab.demo'])).rejects.toMatchObject({ status: 422 })
    await expect(issuePluginCredential('sample', ['*'])).rejects.toMatchObject({ status: 422 })
    await expect(issuePluginCredential('sample', ['sample.plan', 'sample.plan'])).rejects.toMatchObject({ status: 422 })
    expect(fetchStub).not.toHaveBeenCalled()
  })

  it('revokes only keys in managed plugin organizations', async () => {
    let count = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, options: RequestInit) => {
        const path = new URL(input).pathname
        if (path.endsWith('/plugin-publications')) return Response.json([plugin])
        if (path.endsWith('/organizations')) return Response.json([org])
        if (path.endsWith('/keys')) return Response.json([key()])
        if (path.endsWith('/revoke') && options.method === 'POST') {
          count++
          return Response.json({ ...key(), revoked_at: new Date().toISOString() })
        }
        throw Error('Unexpected Core path: ' + path)
      })
    )
    await revokePluginCredential(ORG, KEY_ID)
    expect(count).toBe(1)
  })
  it('binds a registered remote plugin to its verified SDK tenant, not its catalog row or another matching capability', async () => {
    const cap = 'route-optimizer.select-routes.v1'
    const workerOrg = { id: ORG, name: 'qdip-sdk-plugin:route-optimizer-sdk02' }
    const incorrectOrg = { id: '12345678-1234-4234-8234-123456789aee', name: 'qdip-sdk-plugin:remote-wrong' }
    const remote = {
      name: remoteId(ORG, 'route-optimizer-sdk02'),
      plugin_id: 'route-optimizer-sdk02',
      source: 'remote',
      enabled: true,
      capabilities: [cap],
      ui: { label: 'Route Optimizer' },
    }
    const workerKey = {
      ...key(), id: '12345678-1234-4234-8234-123456789af1',
      scopes: ['plugins:register'], allowed_capabilities: [cap],
      name: 'access/route-optimizer-sdk02/worker',
    }
    const wrongExecute = {
      ...key(), id: '12345678-1234-4234-8234-123456789af2',
      org_id: incorrectOrg.id, allowed_capabilities: [cap],
      name: 'access/' + remote.name + '/wrong-execute',
    }
    const issued = {
      ...key(), id: '12345678-1234-4234-8234-123456789af3',
      allowed_capabilities: [cap], name: 'access/route-optimizer-sdk02/new-execute',
    }
    let createdIn = ''
    const calls: Array<Record<string, unknown>> = []
    vi.stubGlobal('fetch', vi.fn(async (input: string, options: RequestInit) => {
      const path = new URL(input).pathname
      const method = options.method ?? 'GET'
      if (path.endsWith('/plugin-publications')) return Response.json([remote])
      if (method === 'GET' && path.endsWith('/organizations')) return Response.json([workerOrg, incorrectOrg])
      if (method === 'GET' && path.includes('/keys')) {
        if (path.includes(workerOrg.id)) {
          const publicIssued = { ...issued }
          delete (publicIssued as { key?: string }).key
          return Response.json(calls.length ? [workerKey, publicIssued] : [workerKey])
        }
        return Response.json([wrongExecute])
      }
      if (method === 'POST' && path.endsWith('/keys')) {
        createdIn = path
        const body = JSON.parse(String(options.body))
        calls.push(body)
        issued.name = body.name
        return Response.json(issued, { status: 201 })
      }
      throw Error('Unexpected Core request')
    }))

    const inventory = await listPluginCredentials()
    const matching = inventory.available.find(item => item.id === remote.name)
    expect(matching?.keys).toHaveLength(1)
    expect(matching?.keys[0].orgId).toBe(ORG)
    const created = await issuePluginCredential(remote.name, [cap], 'execute')
    expect(created.role).toBe('execute')
    expect(created.pluginId).toBe(remote.name)
    expect(createdIn).toContain('/organizations/' + ORG + '/keys')
    expect(calls[0].scopes).toEqual(['plugins:read', 'plugins:execute'])
    expect(calls[0].allowed_capabilities).toEqual([cap])
    expect(String(calls[0].name)).toMatch(/^access\/route-optimizer-sdk02\//)
  })

  it('rejects a forged remote catalog identity without a matching managed registration tenant', async () => {
    const cap = 'route-optimizer.select-routes.v1'
    vi.stubGlobal('fetch', vi.fn(async (input: string) => {
      const path = new URL(input).pathname
      if (path.endsWith('/plugin-publications')) return Response.json([
        { name: 'remote-fake-route-optimizer-sdk02', plugin_id: 'route-optimizer-sdk02',
          source: 'remote', enabled: true, capabilities: [cap] },
      ])
      if (path.endsWith('/organizations')) return Response.json([org])
      if (path.endsWith('/keys')) return Response.json([])
      throw Error('Unexpected request')
    }))
    await expect(
      issuePluginCredential('remote-fake-route-optimizer-sdk02', [cap], 'execute')
    ).rejects.toMatchObject({ status: 409 })
  })

})
