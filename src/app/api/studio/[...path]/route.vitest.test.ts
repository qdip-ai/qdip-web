import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('server-only', () => ({}))
const auth = vi.hoisted(() => ({ roles: ['studio'], subject: 'same-user' as string | null }))
vi.mock('@/lib/qdip-oidc', () => ({
  sessionFromRequest: () =>
    auth.subject ? { sub: auth.subject, issuer: 'https://identity.example.test', roles: auth.roles } : null,
  canAccessStudio: (session: { roles: string[] }) => session.roles.includes('studio'),
}))

import { GET, POST, PATCH, PUT } from './route'
import { toOwnedProfileId } from '@/lib/studio-user-scope'

const context = { params: Promise.resolve({ path: ['decision-profiles'] }) }

function request(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH',
  host: string,
  extras: Record<string, string> = {},
  body?: string
): NextRequest {
  return new NextRequest('http://127.0.0.1:3000/api/studio/decision-profiles', {
    method,
    headers: { host, ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...extras },
    ...(body === undefined ? {} : { body }),
  })
}

beforeEach(() => {
  auth.roles = ['studio']
  auth.subject = 'same-user'
  vi.stubEnv('DIP_API_BASE_URL', 'http://127.0.0.1:8000')
  vi.stubEnv('DIP_API_KEY', 'test-org-scoped-api-key')
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === 'POST'
        ? Response.json({ id: toOwnedProfileId({ issuer: 'https://identity.example.test', sub: 'same-user' }, 'demo') })
        : Response.json([])
    )
  )
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('Studio BFF reverse proxy trust boundary', () => {
  it('allows non-Studio sessions to use personal Studio models without Studio role', async () => {
    auth.roles = ['observatory_admin']
    const response = await GET(request('GET', 'studio.localhost:3000'), context)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual([])
    expect(fetch).toHaveBeenCalledOnce()
  })

  it('routes a valid externally hosted Studio request via the authenticated backend key', async () => {
    const response = await GET(request('GET', 'studio.localhost:3000'), context)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual([])
    const upstream = vi.mocked(fetch)
    expect(upstream).toHaveBeenCalledOnce()
    expect(upstream.mock.calls[0]?.[1]?.headers).toMatchObject({ 'x-api-key': 'test-org-scoped-api-key' })
  })

  it('rejects forwarded-host spoofing, malformed/multiple Host headers and non-Studio hosts', async () => {
    for (const host of ['evil.localhost:3000', 'studio.localhost:3000,evil.localhost', 'studio.localhost@evil.test']) {
      const response = await GET(request('GET', host, { 'x-forwarded-host': 'studio.localhost:3000' }), context)
      expect(response.status, host).toBe(403)
    }
    expect((await GET(request('GET', 'observatory.localhost:3000'), context)).status).toBe(404)
    expect((await GET(request('GET', 'qdip.localhost:3000'), context)).status).toBe(404)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('ignores a forged forwarded host when the actual Host is valid', async () => {
    const response = await GET(request('GET', 'studio.localhost:3000', { 'x-forwarded-host': 'evil.example' }), context)
    expect(response.status).toBe(200)
  })

  it('enforces external browser Origin for mutations behind internal Next.js listener', async () => {
    const body = JSON.stringify({ name: 'demo' })
    const valid = await POST(
      request('POST', 'studio.localhost:3000', { origin: 'http://studio.localhost:3000' }, body),
      context
    )
    expect(valid.status).toBe(200)
    expect(JSON.parse((vi.mocked(fetch).mock.calls[0]?.[1]?.body as Buffer).toString())).toMatchObject({ name: 'demo' })
    for (const origin of ['http://127.0.0.1:3000', 'https://evil.example', 'http://observatory.localhost:3000']) {
      const denied = await POST(request('POST', 'studio.localhost:3000', { origin }, body), context)
      expect(denied.status, origin).toBe(403)
    }
    expect(fetch).toHaveBeenCalledOnce()
  })

  it('rejects plain HTTP on production host and only accepts matching HTTPS Origin', async () => {
    expect((await GET(request('GET', 'studio.qdip.ai'), context)).status).toBe(403)
    expect(
      (
        await POST(
          request(
            'POST',
            'studio.qdip.ai',
            {
              'x-forwarded-proto': 'https',
              origin: 'http://studio.qdip.ai',
            },
            '{}'
          ),
          context
        )
      ).status
    ).toBe(403)
    const response = await POST(
      request(
        'POST',
        'studio.qdip.ai',
        {
          'x-forwarded-proto': 'https',
          origin: 'https://studio.qdip.ai',
        },
        '{}'
      ),
      context
    )
    expect(response.status).toBe(200)
    expect(fetch).toHaveBeenCalledOnce()
  })

  it('bounds request bytes even without a content-length header and rejects non-JSON writes', async () => {
    const oversized = await POST(
      request(
        'POST',
        'studio.localhost:3000',
        {
          origin: 'http://studio.localhost:3000',
        },
        'x'.repeat(2_150_001)
      ),
      context
    )
    expect(oversized.status).toBe(413)
    const nonJson = await POST(
      request(
        'POST',
        'studio.localhost:3000',
        {
          origin: 'http://studio.localhost:3000',
          'content-type': 'text/plain',
        },
        '{}'
      ),
      context
    )
    expect(nonJson.status).toBe(415)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('rejects oversized upstream response and non-TLS remote backend', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('x'.repeat(4_194_305)))
    )
    expect((await GET(request('GET', 'studio.localhost:3000'), context)).status).toBe(502)
    vi.stubEnv('DIP_API_BASE_URL', 'http://remote.internal:8000')
    expect((await GET(request('GET', 'studio.localhost:3000'), context)).status).toBe(503)
  })
})

describe('Personal Studio isolation for role-free users', () => {
  const principal = (sub: string) => ({ issuer: 'https://identity.example.test', sub })
  const route = (...path: string[]) => ({ params: Promise.resolve({ path }) })

  it('separates list results for two signed-in users without special roles', async () => {
    auth.roles = []
    const a = toOwnedProfileId(principal('user-a'), 'plan')
    const b = toOwnedProfileId(principal('user-b'), 'plan')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json([
          { id: a, name: 'Private A' },
          { id: b, name: 'Private B' },
        ])
      )
    )
    auth.subject = 'user-a'
    const resultA = await GET(request('GET', 'studio.localhost:3000'), route('decision-profiles'))
    expect(await resultA.json()).toEqual([{ id: 'plan', name: 'Private A' }])
    auth.subject = 'user-b'
    const resultB = await GET(request('GET', 'studio.localhost:3000'), route('decision-profiles'))
    expect(await resultB.json()).toEqual([{ id: 'plan', name: 'Private B' }])
  })

  it('blocks anonymous Core access and modifications to global plugin bindings', async () => {
    auth.subject = null
    expect((await GET(request('GET', 'studio.localhost:3000'), route('decision-profiles'))).status).toBe(401)
    auth.subject = 'user-a'
    auth.roles = []
    const denied = await PUT(
      request('PUT', 'studio.localhost:3000', { origin: 'http://studio.localhost:3000' }, '[]'),
      route('plugins', 'manual', 'dimension-bindings')
    )
    expect(denied.status).toBe(403)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('creates owner-scoped profiles and prevents changing ownership through the body', async () => {
    auth.subject = 'user-a'
    auth.roles = []
    const ownedId = toOwnedProfileId(principal('user-a'), 'plan')
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body ?? '{}'))
        return Response.json({ id: body.id ?? ownedId, name: 'My plan' })
      })
    )
    const response = await POST(
      request(
        'POST',
        'studio.localhost:3000',
        { origin: 'http://studio.localhost:3000' },
        JSON.stringify({ id: 'plan', name: 'My plan' })
      ),
      route('decision-profiles')
    )
    expect(response.status).toBe(200)
    expect((await response.json()).id).toBe('plan')
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls.at(-1)?.[1]?.body)).id).toBe(ownedId)
    const denied = await PATCH(
      request(
        'PATCH',
        'studio.localhost:3000',
        { origin: 'http://studio.localhost:3000' },
        JSON.stringify({ id: 'another-id', version: '2.0' })
      ),
      route('decision-profiles', 'plan')
    )
    expect(denied.status).toBe(403)
    expect(fetch).toHaveBeenCalledOnce()
  })

  it('hides another user audit and blocks replay before side effects', async () => {
    auth.subject = 'user-b'
    auth.roles = []
    const foreign = { decision_id: 'audit-a', profile: { id: toOwnedProfileId(principal('user-a'), 'plan') } }
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json(foreign))
    )
    const snapshot = await GET(request('GET', 'observatory.localhost:3000'), route('dimension-decisions', 'audit-a'))
    expect(snapshot.status).toBe(404)
    const replay = await POST(
      request('POST', 'observatory.localhost:3000', { origin: 'http://observatory.localhost:3000' }, '{}'),
      route('dimension-decisions', 'audit-a', 'replay')
    )
    expect(replay.status).toBe(404)
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(vi.mocked(fetch).mock.calls.every(([url]) => !String(url).endsWith('/replay'))).toBe(true)
  })

  it('filters the audit listing by verified principal', async () => {
    auth.subject = 'user-a'
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json([
          { decision_id: 'a', profile: { id: toOwnedProfileId(principal('user-a'), 'plan') } },
          { decision_id: 'b', profile: { id: toOwnedProfileId(principal('user-b'), 'plan') } },
        ])
      )
    )
    const response = await GET(request('GET', 'observatory.localhost:3000'), route('dimension-decisions'))
    expect(await response.json()).toEqual([{ decision_id: 'a', profile: { id: 'plan' } }])
  })
})
