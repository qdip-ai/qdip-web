import { createHash } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/observatory-plugin-catalog', () => ({
  corePluginConnection: () => ({
    base: 'https://core.qdip.test',
    key: 'PRIVATE-PLATFORM-ADMIN',
  }),
}))
import { issuePluginCredential, listPluginCredentials, revokePluginCredential } from './observatory-developer-keys'

const ORG = '12345678-1234-4234-8234-123456789abc'
const ZITADEL_ID = '11111111111111111111'
const OWNER = { id: ZITADEL_ID, issuer: 'https://zitadel.example.test' }
const WRONG_OWNER = { id: '22222222222222222222', issuer: OWNER.issuer }
const KEY_ID = '12345678-1234-4234-8234-123456789abd'
const SECRET = 'dip-' + 'a'.repeat(32)
const CAPS = ['sample.plan', 'sample.validate']
const remoteId = (tenant: string, pluginId: string) => {
  const fingerprint = createHash('sha256')
    .update(tenant + '\0' + pluginId)
    .digest('hex')
    .slice(0, 16)
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
const org = {
  id: ORG,
  name: 'QDIP',
  status: 'active',
  identity_provider: 'zitadel',
  zitadel_organization_id: ZITADEL_ID,
  zitadel_issuer: OWNER.issuer,
}

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
  it('issues scoped Worker credentials into the linked Core UUID, not a new pseudo-organization', async () => {
    const capability = 'new-plugin.run'
    let createdName = ''
    let keySaved = false
    const calls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, options: RequestInit) => {
        const path = new URL(input).pathname
        const method = options.method ?? 'GET'
        calls.push(method + ' ' + path)
        if (path.endsWith('/plugin-publications')) return Response.json([])
        if (method === 'GET' && path.endsWith('/organizations')) return Response.json([org])
        if (method === 'GET' && path.endsWith('/keys')) {
          return Response.json(
            keySaved
              ? [
                  {
                    ...key(),
                    name: createdName,
                    scopes: ['plugins:register'],
                    allowed_capabilities: [capability],
                    key: undefined,
                  },
                ]
              : []
          )
        }
        if (method === 'POST' && path.endsWith('/keys')) {
          const policy = JSON.parse(String(options.body))
          expect(policy.scopes).toEqual(['plugins:register'])
          expect(policy.allowed_capabilities).toEqual([capability])
          createdName = policy.name
          keySaved = true
          return Response.json(
            {
              ...key(),
              name: createdName,
              scopes: ['plugins:register'],
              allowed_capabilities: [capability],
            },
            { status: 201 }
          )
        }
        throw Error('Unexpected Core request: ' + path)
      })
    )
    const issued = await issuePluginCredential('new-plugin', [capability], 'worker', OWNER, true)
    expect(issued.role).toBe('worker')
    expect(issued.key).toBe(SECRET)
    expect(calls.some((call) => call === 'POST /api/v1/organizations')).toBe(false)
    expect(calls.some((call) => call === 'POST /api/v1/organizations/' + ORG + '/keys')).toBe(true)
  })

  it('never reads or revokes another linked Zitadel organization key', async () => {
    const foreign = '12345678-1234-4234-8234-123456789ade'
    const calls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string) => {
        const path = new URL(input).pathname
        calls.push(path)
        if (path.endsWith('/plugin-publications')) return Response.json([])
        if (path.endsWith('/organizations'))
          return Response.json([org, { ...org, id: foreign, zitadel_organization_id: WRONG_OWNER.id }])
        if (path.endsWith('/keys')) return Response.json([])
        throw Error('Unexpected Core request: ' + path)
      })
    )
    expect(await listPluginCredentials(OWNER)).toEqual({ available: [], connected: [] })
    expect(calls).not.toContain('/api/v1/organizations/' + foreign + '/keys')
    await expect(revokePluginCredential(foreign, KEY_ID, OWNER)).rejects.toMatchObject({ status: 403 })
    expect(calls).not.toContain('/api/v1/organizations/' + foreign + '/keys/' + KEY_ID + '/revoke')
  })

  it('lists installed plugins dynamically and moves already keyed VHV out of available', async () => {
    const vhv = {
      name: remoteId(ORG, 'secretary'),
      plugin_id: 'secretary',
      source: 'remote',
      enabled: true,
      capabilities: ['secretary.plan'],
      ui: { label: 'VHV' },
    }
    const vhvOrg = { ...org }
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
    const inventory = await listPluginCredentials(OWNER)
    expect(inventory.connected.map((p) => p.label)).toEqual(['VHV'])
    expect(inventory.available.map((p) => p.label)).toEqual(['Sample Planner'])
    expect(inventory.connected[0].keys).toHaveLength(1)
    expect(JSON.stringify(inventory)).not.toContain(SECRET)
  })

  it('blocks issuance for embedded plugin until a verified Zitadel organization is selected', async () => {
    const calls: Array<{ method: string; path: string }> = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, options: RequestInit) => {
        const path = new URL(input).pathname
        const method = options.method || 'GET'
        calls.push({ method, path })
        if (path.endsWith('/plugin-publications')) return Response.json([plugin])
        if (path.endsWith('/organizations')) return Response.json([org])
        if (path.endsWith('/keys')) return Response.json([key()])
        throw Error('Unexpected Core request')
      })
    )
    await expect(issuePluginCredential('sample', CAPS, 'execute', WRONG_OWNER)).rejects.toMatchObject({ status: 409 })
    await expect(issuePluginCredential('sample', CAPS, 'worker', WRONG_OWNER)).rejects.toMatchObject({ status: 409 })
    expect(calls.every((call) => call.method === 'GET')).toBe(true)
  })

  it('rejects arbitrary unregistered plugins even with manual bootstrap, without creating an organization', async () => {
    const calls: Array<{ method: string; path: string }> = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, options: RequestInit) => {
        const path = new URL(input).pathname
        const method = options.method || 'GET'
        calls.push({ method, path })
        if (path.endsWith('/plugin-publications')) return Response.json([])
        if (path.endsWith('/organizations')) return Response.json([])
        throw Error('Unexpected Core request')
      })
    )
    await expect(issuePluginCredential('new-plugin', ['new-plugin.run'], 'worker', OWNER, false)).rejects.toMatchObject(
      {
        status: 422,
      }
    )
    await expect(issuePluginCredential('new-plugin', ['new-plugin.run'], 'worker', OWNER, true)).rejects.toMatchObject({
      status: 409,
    })
    expect(calls.every((call) => call.method === 'GET')).toBe(true)
  })

  it('rejects invalid capabilities without network calls', async () => {
    const fetchStub = vi.fn()
    vi.stubGlobal('fetch', fetchStub)
    await expect(issuePluginCredential('../invalid', ['sample.plan'], 'execute', OWNER)).rejects.toMatchObject({
      status: 422,
    })
    await expect(issuePluginCredential('GTM Lab', ['gtm-lab.demo'], 'execute', OWNER)).rejects.toMatchObject({
      status: 422,
    })
    await expect(issuePluginCredential('sample', ['*'], 'execute', OWNER)).rejects.toMatchObject({ status: 422 })
    await expect(
      issuePluginCredential('sample', ['sample.plan', 'sample.plan'], 'execute', OWNER)
    ).rejects.toMatchObject({ status: 422 })
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
    await revokePluginCredential(ORG, KEY_ID, OWNER)
    expect(count).toBe(1)
  })
  it('binds a registered remote plugin to its verified SDK tenant, not its catalog row or another matching capability', async () => {
    const cap = 'route-optimizer.select-routes.v1'
    const workerOrg = { ...org }
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
      ...key(),
      id: '12345678-1234-4234-8234-123456789af1',
      scopes: ['plugins:register'],
      allowed_capabilities: [cap],
      name: 'access/route-optimizer-sdk02/worker',
    }
    const wrongExecute = {
      ...key(),
      id: '12345678-1234-4234-8234-123456789af2',
      org_id: incorrectOrg.id,
      allowed_capabilities: [cap],
      name: 'access/' + remote.name + '/wrong-execute',
    }
    const issued = {
      ...key(),
      id: '12345678-1234-4234-8234-123456789af3',
      allowed_capabilities: [cap],
      name: 'access/route-optimizer-sdk02/new-execute',
    }
    let createdIn = ''
    const calls: Array<Record<string, unknown>> = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, options: RequestInit) => {
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
      })
    )

    const inventory = await listPluginCredentials(OWNER)
    const matching = inventory.available.find((item) => item.id === remote.name)
    expect(matching?.keys).toHaveLength(1)
    expect(matching?.keys[0].orgId).toBe(ORG)
    const created = await issuePluginCredential(remote.name, [cap], 'execute', OWNER)
    expect(created.role).toBe('execute')
    expect(created.pluginId).toBe(remote.name)
    expect(createdIn).toContain('/organizations/' + ORG + '/keys')
    expect(calls[0].scopes).toEqual(['plugins:read', 'plugins:execute'])
    expect(calls[0].allowed_capabilities).toEqual([cap])
    expect(String(calls[0].name)).toMatch(/^access\/route-optimizer-sdk02\//)
  })

  it('rejects a forged remote catalog identity without a matching managed registration tenant', async () => {
    const cap = 'route-optimizer.select-routes.v1'
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string) => {
        const path = new URL(input).pathname
        if (path.endsWith('/plugin-publications'))
          return Response.json([
            {
              name: 'remote-fake-route-optimizer-sdk02',
              plugin_id: 'route-optimizer-sdk02',
              source: 'remote',
              enabled: true,
              capabilities: [cap],
            },
          ])
        if (path.endsWith('/organizations')) return Response.json([org])
        if (path.endsWith('/keys')) return Response.json([])
        throw Error('Unexpected request')
      })
    )
    await expect(
      issuePluginCredential('remote-fake-route-optimizer-sdk02', [cap], 'execute', OWNER)
    ).rejects.toMatchObject({
      status: 409,
    })
  })
})


describe('Direct first-party Worker re-registration in linked QDIP', () => {
  const target = 'ff638747-1962-4a44-95ee-3902c28d949f'
  const owner = {
    id: '368555767923594379',
    issuer: 'https://mentality-rmwj0i.eu1.zitadel.cloud',
  }
  const canonical = {
    id: target,
    name: 'QDIP',
    status: 'active',
    identity_provider: 'zitadel',
    zitadel_organization_id: owner.id,
    zitadel_issuer: owner.issuer,
  }
  const cases = [
    {
      id: 'secretary',
      cap: 'secretary.plan',
      old: '1aeac26a-7dcd-467d-b6f3-2cfd842ea2ab',
      name: 'qdip-sdk-app:vhv',
    },
    {
      id: 'route-optimizer-sdk02',
      cap: 'route-optimizer.select-routes.v1',
      old: 'cbe626fc-e287-4e23-8c1b-001858521c44',
      name: 'qdip-sdk-plugin:route-optimizer-sdk02',
    },
  ] as const

  function mockCase(c: (typeof cases)[number], overrides: {
    source?: Record<string, unknown>
    remote?: Record<string, unknown>
    addTarget?: boolean
  } = {}) {
    const source = { id: c.old, name: c.name, status: 'active', ...overrides.source }
    const legacy = {
      name: remoteId(c.old, c.id),
      plugin_id: c.id,
      source: 'remote',
      enabled: true,
      capabilities: [c.cap],
      ...overrides.remote,
    }
    const newlyRegistered = {
      ...legacy,
      name: remoteId(target, c.id),
      source: 'remote',
      enabled: true,
    }
    const requests: string[] = []
    let createdName = ''
    let posted: { scopes: string[]; allowed_capabilities: string[] } | undefined
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init: RequestInit = {}) => {
        const path = new URL(input).pathname
        const method = init.method ?? 'GET'
        requests.push(method + ' ' + path)
        if (path.endsWith('/plugin-publications'))
          return Response.json(overrides.addTarget ? [legacy, newlyRegistered] : [legacy])
        if (path.endsWith('/organizations'))
          return Response.json([canonical, source])
        if (method === 'GET' && path.endsWith('/keys')) {
          if (!posted) return Response.json([])
          return Response.json([{
            ...key(), org_id: target, name: createdName, scopes: posted.scopes,
            allowed_capabilities: posted.allowed_capabilities, key: undefined,
          }])
        }
        if (method === 'POST' && path.endsWith('/keys')) {
          const policy = JSON.parse(String(init.body)) as {
            name: string
            scopes: string[]
            allowed_capabilities: string[]
          }
          posted = policy
          createdName = policy.name
          return Response.json({
            ...key(), org_id: target, name: createdName, scopes: policy.scopes,
            allowed_capabilities: policy.allowed_capabilities,
          }, { status: 201 })
        }
        throw Error('Unexpected path ' + method + ' ' + path)
      })
    )
    return { requests, get posted() { return posted } }
  }

  for (const c of cases) {
    it('issues only ' + c.id + ' registration key to existing QDIP without removing old catalog row', async () => {
      const mock = mockCase(c)
      const issued = await issuePluginCredential(c.id, [c.cap], 'worker', owner, true)
      expect(issued.role).toBe('worker')
      expect(mock.posted?.scopes).toEqual(['plugins:register'])
      expect(mock.posted?.allowed_capabilities).toEqual([c.cap])
      expect(mock.requests).toContain('POST /api/v1/organizations/' + target + '/keys')
      expect(mock.requests.some((s) => s.includes(c.old + '/keys'))).toBe(false)
    })

    it('denies cross-tenant invoke and wrong capability for ' + c.id, async () => {
      const mock = mockCase(c)
      await expect(issuePluginCredential(c.id, [c.cap], 'execute', owner, true))
        .rejects.toMatchObject({ status: 409 })
      await expect(issuePluginCredential(c.id, ['wrong.capability'], 'worker', owner, true))
        .rejects.toMatchObject({ status: 422 })
      expect(mock.requests.every((p) => p.startsWith('GET '))).toBe(true)
    })
  }

  it('denies tampered source organizations and unauthenticated selected org', async () => {
    const c = cases[0]
    let mock = mockCase(c, { source: { name: 'unrelated-tenant' } })
    await expect(issuePluginCredential(c.id, [c.cap], 'worker', owner, true))
      .rejects.toMatchObject({ status: 409 })
    expect(mock.requests.every((s) => s.startsWith('GET '))).toBe(true)

    mock = mockCase(c)
    await expect(issuePluginCredential(c.id, [c.cap], 'worker', { ...owner, id: '999999' }, true))
      .rejects.toMatchObject({ status: 409 })
    expect(mock.requests.every((s) => s.startsWith('GET '))).toBe(true)
  })

  it('rejects generic SDK ID after both target and legacy registrations coexist', async () => {
    const c = cases[0]
    const mock = mockCase(c, { addTarget: true })
    await expect(issuePluginCredential(c.id, [c.cap], 'worker', owner, true))
      .rejects.toMatchObject({ status: 409 })
    expect(mock.requests.every((s) => s.startsWith('GET '))).toBe(true)
  })

  it('never issues an invoke credential for an unregistered manual plugin', async () => {
    const calls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (input: string, init: RequestInit = {}) => {
      const path = new URL(input).pathname
      calls.push((init.method || 'GET') + ' ' + path)
      if (path.endsWith('/plugin-publications')) return Response.json([])
      if (path.endsWith('/organizations')) return Response.json([canonical])
      if (path.endsWith('/keys')) return Response.json([])
      throw Error('Unexpected route')
    }))
    await expect(issuePluginCredential('unregistered', ['unregistered.run'], 'execute', owner, true))
      .rejects.toMatchObject({ status: 422 })
    expect(calls.every((c) => c.startsWith('GET '))).toBe(true)
  })
})
