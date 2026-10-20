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

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

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


describe('P0 #425: first-party legacy Worker recovery and bootstrap', () => {
  const tenant = 'ff638747-1962-4a44-95ee-3902c28d949f'
  const owner = {
    id: '368555767923594379',
    issuer: 'https://mentality-rmwj0i.eu1.zitadel.cloud',
  }
  const vhvOld = {
    id: '1aeac26a-7dcd-467d-b6f3-2cfd842ea2ab',
    name: 'qdip-sdk-app:vhv',
    status: 'active',
  }
  const linked = {
    id: tenant,
    name: 'QDIP',
    status: 'active',
    identity_provider: 'zitadel',
    zitadel_organization_id: owner.id,
    zitadel_issuer: owner.issuer,
  }
  const vhv = {
    name: remoteId(vhvOld.id, 'secretary'),
    plugin_id: 'secretary',
    source: 'remote',
    enabled: false,
    capabilities: ['secretary.plan'],
    ui: { label: 'VHV' },
  }

  function givenLegacyPlugin(options: {
    source?: typeof vhvOld
    target?: typeof linked
    published?: typeof vhv
  } = {}) {
    const calls: string[] = []
    let createdName = ''
    let created = false
    vi.stubGlobal('fetch', vi.fn(async (input: string, init: RequestInit = {}) => {
      const path = new URL(input).pathname
      const method = init.method ?? 'GET'
      calls.push(method + ' ' + path)
      if (path.endsWith('/plugin-publications'))
        return Response.json([options.published ?? vhv])
      if (method === 'GET' && path.endsWith('/organizations'))
        return Response.json([options.target ?? linked, options.source ?? vhvOld])
      if (method === 'GET' && path.endsWith('/keys')) {
        if (!created) return Response.json([])
        const response = {
          ...key(), org_id: tenant, name: createdName,
          scopes: ['plugins:register'], allowed_capabilities: ['secretary.plan'],
        }
        delete (response as { key?: string }).key
        return Response.json([response])
      }
      if (method === 'POST' && path.endsWith('/keys')) {
        const body = JSON.parse(String(init.body)) as { name: string; scopes: string[]; allowed_capabilities: string[] }
        expect(body.scopes).toEqual(['plugins:register'])
        expect(body.allowed_capabilities).toEqual(['secretary.plan'])
        createdName = body.name
        created = true
        return Response.json({
          ...key(), org_id: tenant, name: createdName,
          scopes: ['plugins:register'], allowed_capabilities: ['secretary.plan'],
        }, { status: 201 })
      }
      throw new Error('Unexpected Core request')
    }))
    return calls
  }

  it('defaults to DENY for old-tenant plugins without an explicit operator migration flag', async () => {
    const calls = givenLegacyPlugin()
    await expect(
      issuePluginCredential('secretary', ['secretary.plan'], 'worker', owner, true)
    ).rejects.toMatchObject({ status: 409 })
    expect(calls.every((call) => call.startsWith('GET '))).toBe(true)
  })

  it('permits only a 30-day capability-scoped Worker key in the known owner tenant when explicitly enabled', async () => {
    vi.stubEnv('QDIP_SDK425_MIGRATION_BOOTSTRAP', 'enabled')
    const calls = givenLegacyPlugin()
    const issued = await issuePluginCredential('secretary', ['secretary.plan'], 'worker', owner, true)
    expect(issued.pluginId).toBe('secretary')
    expect(issued.capabilities).toEqual(['secretary.plan'])
    expect(calls).toContain('POST /api/v1/organizations/' + tenant + '/keys')
    expect(calls).not.toContain('POST /api/v1/organizations')
    expect(calls.some((call) => call.includes(vhvOld.id + '/keys'))).toBe(false)
  })

  it('never permits execute/cross-tenant/forged legacy bootstrap even with the flag enabled', async () => {
    vi.stubEnv('QDIP_SDK425_MIGRATION_BOOTSTRAP', 'enabled')
    let calls = givenLegacyPlugin()
    await expect(issuePluginCredential('secretary', ['secretary.plan'], 'execute', owner, true))
      .rejects.toMatchObject({ status: 409 })
    await expect(issuePluginCredential('secretary', ['secretary.plan'], 'worker', owner, false))
      .rejects.toMatchObject({ status: 409 })
    expect(calls.every((call) => call.startsWith('GET '))).toBe(true)

    calls = givenLegacyPlugin({ source: { ...vhvOld, name: 'qdip-sdk-plugin:unrelated' } })
    await expect(issuePluginCredential('secretary', ['secretary.plan'], 'worker', owner, true))
      .rejects.toMatchObject({ status: 409 })
    expect(calls.every((call) => call.startsWith('GET '))).toBe(true)

    calls = givenLegacyPlugin({ source: { ...vhvOld, status: 'inactive' } })
    await expect(issuePluginCredential('secretary', ['secretary.plan'], 'worker', owner, true))
      .rejects.toMatchObject({ status: 409 })
    expect(calls.every((call) => call.startsWith('GET '))).toBe(true)

    calls = givenLegacyPlugin({ target: { ...linked, id: '12345678-1234-4234-8234-123456789abf' } })
    await expect(issuePluginCredential('secretary', ['secretary.plan'], 'worker', owner, true))
      .rejects.toMatchObject({ status: 409 })
    expect(calls.every((call) => call.startsWith('GET '))).toBe(true)
  })

  it('allows same-tenant registration-key recovery for a disconnected verified remote Worker', async () => {
    const targetRemote = {
      ...vhv,
      name: remoteId(tenant, 'secretary'),
      enabled: false,
    }
    const calls = givenLegacyPlugin({ published: targetRemote })
    const issued = await issuePluginCredential(targetRemote.name, ['secretary.plan'], 'worker', owner)
    expect(issued.role).toBe('worker')
    expect(calls).toContain('POST /api/v1/organizations/' + tenant + '/keys')
    expect(calls).not.toContain('POST /api/v1/organizations')
  })
})


describe('P0 #425: RO SDK-02 never reuses a stray legacy caller tenant', () => {
  it('allows only an explicit owner-scoped first-party RO Worker bootstrap', async () => {
    vi.stubEnv('QDIP_SDK425_MIGRATION_BOOTSTRAP', 'enabled')
    const owner = {
      id: '368555767923594379',
      issuer: 'https://mentality-rmwj0i.eu1.zitadel.cloud',
    }
    const target = {
      id: 'ff638747-1962-4a44-95ee-3902c28d949f', name: 'QDIP',
      status: 'active', identity_provider: 'zitadel',
      zitadel_organization_id: owner.id, zitadel_issuer: owner.issuer,
    }
    const ro = {
      id: 'cbe626fc-e287-4e23-8c1b-001858521c44',
      name: 'qdip-sdk-plugin:route-optimizer-sdk02', status: 'active',
    }
    const strayCaller = {
      id: '23fade79-c21a-405e-bcb6-2603a7e5ea8b',
      name: 'qdip-sdk-app:unmatched-ro-caller', status: 'active',
    }
    const cap = 'route-optimizer.select-routes.v1'
    const remote = {
      name: remoteId(ro.id, 'route-optimizer-sdk02'),
      plugin_id: 'route-optimizer-sdk02', source: 'remote', enabled: true,
      capabilities: [cap],
    }
    let generated = false
    let issueName = ''
    const requests: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (input: string, init: RequestInit = {}) => {
      const path = new URL(input).pathname
      const method = init.method ?? 'GET'
      requests.push(method + ' ' + path)
      if (path.endsWith('/plugin-publications')) return Response.json([remote])
      if (method === 'GET' && path.endsWith('/organizations'))
        return Response.json([target, ro, strayCaller])
      if (method === 'GET' && path.endsWith('/keys')) {
        if (!generated) return Response.json([])
        const record = {
          ...key(), name: issueName, org_id: target.id,
          scopes: ['plugins:register'], allowed_capabilities: [cap],
        }
        delete (record as { key?: string }).key
        return Response.json([record])
      }
      if (method === 'POST' && path.endsWith('/keys')) {
        const policy = JSON.parse(String(init.body)) as { name: string; scopes: string[]; allowed_capabilities: string[] }
        expect(policy.scopes).toEqual(['plugins:register'])
        expect(policy.allowed_capabilities).toEqual([cap])
        issueName = policy.name
        generated = true
        return Response.json({
          ...key(), name: issueName, org_id: target.id,
          scopes: ['plugins:register'], allowed_capabilities: [cap],
        }, { status: 201 })
      }
      throw new Error('Unexpected Core request')
    }))
    await expect(
      issuePluginCredential('route-optimizer-sdk02', [cap], 'execute', owner, true)
    ).rejects.toMatchObject({ status: 409 })
    const result = await issuePluginCredential('route-optimizer-sdk02', [cap], 'worker', owner, true)
    expect(result.role).toBe('worker')
    expect(requests).toContain('POST /api/v1/organizations/' + target.id + '/keys')
    expect(requests.some((item) => item.includes(strayCaller.id))).toBe(false)
    expect(requests.some((item) => item.includes(ro.id + '/keys'))).toBe(false)
    expect(requests).not.toContain('POST /api/v1/organizations')
  })
})


describe('P0 #425: parallel legacy and canonical SDK registration', () => {
  it('requires the target opaque catalog ID and issues only a target-tenant caller key', async () => {
    const owner = {
      id: '368555767923594379',
      issuer: 'https://mentality-rmwj0i.eu1.zitadel.cloud',
    }
    const targetId = 'ff638747-1962-4a44-95ee-3902c28d949f'
    const legacyId = '1aeac26a-7dcd-467d-b6f3-2cfd842ea2ab'
    const sourcePluginId = remoteId(legacyId, 'secretary')
    const targetPluginId = remoteId(targetId, 'secretary')
    const organizations = [
      { id: targetId, name: 'QDIP', status: 'active', identity_provider: 'zitadel',
        zitadel_organization_id: owner.id, zitadel_issuer: owner.issuer },
      { id: legacyId, name: 'qdip-sdk-app:vhv', status: 'active' },
    ]
    const catalog = [
      { name: sourcePluginId, source: 'remote', plugin_id: 'secretary',
        enabled: true, capabilities: ['secretary.plan'] },
      { name: targetPluginId, source: 'remote', plugin_id: 'secretary',
        enabled: true, capabilities: ['secretary.plan'] },
    ]
    const requests: string[] = []
    let createdName = ''
    let issued = false
    vi.stubGlobal('fetch', vi.fn(async (input: string, init: RequestInit = {}) => {
      const path = new URL(input).pathname
      const method = init.method ?? 'GET'
      requests.push(method + ' ' + path)
      if (path.endsWith('/plugin-publications')) return Response.json(catalog)
      if (method === 'GET' && path.endsWith('/organizations')) return Response.json(organizations)
      if (method === 'GET' && path.endsWith('/keys')) {
        if (!issued) return Response.json([])
        const row = { ...key(), org_id: targetId, name: createdName,
          scopes: ['plugins:read', 'plugins:execute'], allowed_capabilities: ['secretary.plan'] }
        delete (row as { key?: string }).key
        return Response.json([row])
      }
      if (method === 'POST' && path.endsWith('/keys')) {
        const policy = JSON.parse(String(init.body)) as { name: string; scopes: string[]; allowed_capabilities: string[] }
        expect(policy.scopes).toEqual(['plugins:read', 'plugins:execute'])
        expect(policy.allowed_capabilities).toEqual(['secretary.plan'])
        createdName = policy.name
        issued = true
        return Response.json({ ...key(), org_id: targetId, name: createdName,
          scopes: policy.scopes, allowed_capabilities: policy.allowed_capabilities }, { status: 201 })
      }
      throw new Error('Unexpected Core request: ' + method + ' ' + path)
    }))

    // Shared SDK plugin_id has two registrations. Silent selection is unsafe.
    await expect(issuePluginCredential('secretary', ['secretary.plan'], 'execute', owner, true))
      .rejects.toMatchObject({ status: 409 })
    await expect(issuePluginCredential(sourcePluginId, ['secretary.plan'], 'execute', owner))
      .rejects.toMatchObject({ status: 409 })
    expect(requests.every((call) => call.startsWith('GET '))).toBe(true)

    // Selecting the immutable *target* catalog ID resolves tenant unambiguously.
    const result = await issuePluginCredential(targetPluginId, ['secretary.plan'], 'execute', owner)
    expect(result.role).toBe('execute')
    expect(result.pluginId).toBe(targetPluginId)
    expect(requests).toContain('POST /api/v1/organizations/' + targetId + '/keys')
    expect(requests.some((call) => call.includes(legacyId + '/keys'))).toBe(false)
    expect(requests.some((call) => call.includes(legacyId + '/keys/'))).toBe(false)
  })

  it('refuses a duplicate opaque catalog identity even if the manifests have the same capability', async () => {
    const owner = { id: ZITADEL_ID, issuer: OWNER.issuer }
    const entry = { name: remoteId(ORG, 'secretary'), plugin_id: 'secretary',
      source: 'remote', enabled: true, capabilities: ['secretary.plan'] }
    const requests: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (input: string, init: RequestInit = {}) => {
      const path = new URL(input).pathname
      requests.push((init.method ?? 'GET') + ' ' + path)
      if (path.endsWith('/plugin-publications')) return Response.json([entry, entry])
      if (path.endsWith('/organizations')) return Response.json([org])
      if (path.endsWith('/keys')) return Response.json([])
      throw new Error('Unexpected Core request')
    }))
    await expect(issuePluginCredential(entry.name, ['secretary.plan'], 'worker', owner))
      .rejects.toMatchObject({ status: 409 })
    expect(requests.every((call) => call.startsWith('GET '))).toBe(true)
  })
})
