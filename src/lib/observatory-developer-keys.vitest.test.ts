import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/observatory-plugin-catalog', () => ({
  corePluginConnection: () => ({
    base: 'https://core.qdip.test',
    key: 'PRIVATE-PLATFORM-ADMIN',
  }),
}))
import { createDeveloperCredentials, DeveloperKeyError } from './observatory-developer-keys'

const ORG = '12345678-1234-4234-8234-123456789abc'
const APP = '12345678-1234-4234-8234-123456789abd'
const WORKER = '12345678-1234-4234-8234-123456789abe'
const appRaw = 'dip-' + 'a'.repeat(32)
const workerRaw = 'dip-' + 'b'.repeat(32)
const expires = () => new Date(Date.now() + 30 * 86_400_000).toISOString()

function key(id: string, role: 'app' | 'worker', allowlist: string[] | null = ['secretary.plan']) {
  return {
    id,
    key: role === 'app' ? appRaw : workerRaw,
    org_id: ORG,
    name: '',
    environment: 'production',
    scopes: role === 'app' ? ['plugins:read', 'plugins:execute'] : ['plugins:register'],
    allowed_capabilities: allowlist,
    expires_at: expires(),
    revoked_at: null,
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Observatory developer keys: audited app+Worker bootstrap', () => {
  it('issues separate app/Worker keys and verifies exact persisted policy before display', async () => {
    const calls: Array<{
      method: string
      path: string
      scopes?: string[]
      allowlist?: string[]
    }> = []
    const issued = [] as ReturnType<typeof key>[]
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, options: RequestInit) => {
        const path = new URL(input).pathname
        const method = options.method || 'GET'
        const body = options.body ? JSON.parse(String(options.body)) : null
        calls.push({
          method,
          path,
          scopes: body?.scopes,
          allowlist: body?.allowed_capabilities,
        })
        expect(options.redirect).toBe('error')
        expect((options.headers as Record<string, string>)['x-api-key']).toBe('PRIVATE-PLATFORM-ADMIN')
        if (method === 'GET' && path.endsWith('/organizations')) return Response.json([])
        if (method === 'POST' && path.endsWith('/organizations'))
          return Response.json({ id: ORG, name: body.name }, { status: 201 })
        if (method === 'POST' && path.endsWith('/keys')) {
          const issuedKey = key(issued.length === 0 ? APP : WORKER, issued.length === 0 ? 'app' : 'worker')
          issuedKey.name = body.name
          issued.push(issuedKey)
          return Response.json(issuedKey, { status: 201 })
        }
        if (method === 'GET' && path.endsWith('/keys'))
          return Response.json(
            issued.map((row) => Object.fromEntries(Object.entries(row).filter(([field]) => field !== 'key')))
          )
        throw Error('Unexpected QDIP call')
      })
    )
    const response = await createDeveloperCredentials('VHV', 'secretary.plan')
    expect(response.app.key).toBe(appRaw)
    expect(response.worker.key).toBe(workerRaw)
    expect(response).not.toHaveProperty('organizationId')
    expect(calls.filter((c) => c.method === 'POST' && c.path.endsWith('/keys')).map((c) => c.scopes)).toEqual([
      ['plugins:read', 'plugins:execute'],
      ['plugins:register'],
    ])
    expect(calls.filter((c) => c.method === 'POST' && c.path.endsWith('/keys')).map((c) => c.allowlist)).toEqual([
      ['secretary.plan'],
      ['secretary.plan'],
    ])
  })

  it('refuses missing capability allowlist and revokes every newly issued key', async () => {
    const issued = [] as ReturnType<typeof key>[]
    let revokeCount = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, options: RequestInit) => {
        const path = new URL(input).pathname,
          method = options.method || 'GET'
        if (method === 'GET' && path.endsWith('/organizations'))
          return Response.json([{ id: ORG, name: 'qdip-sdk-app:vhv' }])
        if (method === 'POST' && path.endsWith('/keys')) {
          const body = JSON.parse(String(options.body))
          const record = key(issued.length === 0 ? APP : WORKER, issued.length === 0 ? 'app' : 'worker', null)
          record.name = body.name
          issued.push(record)
          return Response.json(record, { status: 201 })
        }
        if (method === 'GET' && path.endsWith('/keys'))
          return Response.json(
            issued.map((row) => Object.fromEntries(Object.entries(row).filter(([field]) => field !== 'key')))
          )
        if (method === 'POST' && path.endsWith('/revoke')) {
          revokeCount++
          return Response.json({})
        }
        throw Error('Unexpected request')
      })
    )
    await expect(createDeveloperCredentials('VHV', 'secretary.plan')).rejects.toMatchObject({ status: 503 })
    expect(revokeCount).toBe(2)
  })

  it('revokes both known credentials when the Worker raw key is malformed', async () => {
    const issued = [] as ReturnType<typeof key>[]
    const revoked: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, options: RequestInit) => {
        const path = new URL(input).pathname,
          method = options.method || 'GET'
        if (method === 'GET' && path.endsWith('/organizations'))
          return Response.json([{ id: ORG, name: 'qdip-sdk-app:vhv' }])
        if (method === 'POST' && path.endsWith('/keys')) {
          const body = JSON.parse(String(options.body))
          const record = key(issued.length === 0 ? APP : WORKER, issued.length === 0 ? 'app' : 'worker')
          record.name = body.name
          if (issued.length === 1) record.key = 'invalid-raw-key'
          issued.push(record)
          return Response.json(record, { status: 201 })
        }
        if (method === 'POST' && path.endsWith('/revoke')) {
          revoked.push(path)
          return Response.json({})
        }
        throw Error('Unexpected request')
      })
    )
    await expect(createDeveloperCredentials('VHV', 'secretary.plan')).rejects.toMatchObject({ status: 503 })
    expect(revoked).toHaveLength(2)
  })

  it('rejects invalid application input without contacting QDIP', async () => {
    const fetchStub = vi.fn()
    vi.stubGlobal('fetch', fetchStub)
    await expect(createDeveloperCredentials('VHV/../../root', 'secretary.plan')).rejects.toBeInstanceOf(
      DeveloperKeyError
    )
    await expect(createDeveloperCredentials('VHV', '*')).rejects.toBeInstanceOf(DeveloperKeyError)
    expect(fetchStub).not.toHaveBeenCalled()
  })
})


describe('Route Optimizer keys through the existing Observatory interface', () => {
  it('issues just one org-scoped execute key for both RO capabilities and verifies persisted policy', async () => {
    const captured: Array<{ name: string; scopes: string[]; allowed_capabilities: string[] }> = []
    const record = {
      id: APP, key: appRaw, org_id: ORG, name: '', environment: 'production',
      scopes: ['plugins:execute'],
      allowed_capabilities: [
        'route-optimizer.customer-coordinate-vrp.v1',
        'route-optimizer.customer-address-vrp.v1',
      ],
      expires_at: expires(), revoked_at: null,
    }
    vi.stubGlobal('fetch', vi.fn(async (input: string, options: RequestInit) => {
      const path = new URL(input).pathname
      const method = options.method ?? 'GET'
      if (method === 'GET' && path.endsWith('/organizations'))
        return Response.json([{ id: ORG, name: 'qdip-sdk-app:ro' }])
      if (method === 'POST' && path.endsWith('/keys')) {
        const body = JSON.parse(String(options.body))
        captured.push(body)
        record.name = body.name
        return Response.json(record, { status: 201 })
      }
      if (method === 'GET' && path.endsWith('/keys')) {
        const { key: _secret, ...stored } = record
        return Response.json([stored])
      }
      throw Error('Unexpected request')
    }))
    const result = await createDeveloperCredentials('RO', 'route-optimizer.customer-address-vrp.v1')
    expect(result.application).toBe('RO')
    expect(result.worker).toBeNull()
    expect(result.app.key).toBe(appRaw)
    expect(result.capabilities).toEqual([
      'route-optimizer.customer-coordinate-vrp.v1',
      'route-optimizer.customer-address-vrp.v1',
    ])
    expect(captured).toHaveLength(1)
    expect(captured[0].scopes).toEqual(['plugins:execute'])
    expect(captured[0].allowed_capabilities).toEqual(result.capabilities)
    expect(captured[0].name.startsWith('app/RO/')).toBe(true)
  })

  it('refuses and revokes a RO key if Core drops either capability', async () => {
    const issued = {
      id: APP, key: appRaw, org_id: ORG, name: '', environment: 'production',
      scopes: ['plugins:execute'], allowed_capabilities: ['route-optimizer.customer-coordinate-vrp.v1'],
      expires_at: expires(), revoked_at: null,
    }
    let revoked = 0
    vi.stubGlobal('fetch', vi.fn(async (input: string, options: RequestInit) => {
      const path = new URL(input).pathname
      const method = options.method ?? 'GET'
      if (method === 'GET' && path.endsWith('/organizations'))
        return Response.json([{ id: ORG, name: 'qdip-sdk-app:ro' }])
      if (method === 'POST' && path.endsWith('/keys')) {
        issued.name = JSON.parse(String(options.body)).name
        return Response.json(issued, { status: 201 })
      }
      if (method === 'GET' && path.endsWith('/keys')) return Response.json([issued])
      if (method === 'POST' && path.endsWith('/revoke')) {
        revoked++
        return Response.json({})
      }
      throw Error('Unexpected request')
    }))
    await expect(
      createDeveloperCredentials('RO', 'route-optimizer.customer-address-vrp.v1')
    ).rejects.toMatchObject({ status: 503 })
    expect(revoked).toBe(1)
  })

  it('blocks arbitrary application/capability combinations before Core is contacted', async () => {
    const fetchStub = vi.fn()
    vi.stubGlobal('fetch', fetchStub)
    await expect(createDeveloperCredentials('RO', 'secretary.plan')).rejects.toMatchObject({ status: 422 })
    await expect(createDeveloperCredentials('VHV', 'route-optimizer.customer-address-vrp.v1'))
      .rejects.toMatchObject({ status: 422 })
    await expect(createDeveloperCredentials('SomeOtherApp', 'secretary.plan'))
      .rejects.toMatchObject({ status: 422 })
    expect(fetchStub).not.toHaveBeenCalled()
  })
})
