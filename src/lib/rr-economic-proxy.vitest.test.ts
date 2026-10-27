import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/rr-operator-auth', () => ({
  operatorAuthorized: vi.fn(() => true),
  operatorConfigured: vi.fn(() => true),
  safeTransport: vi.fn(() => true),
  sameOrigin: vi.fn(() => true),
}))
vi.mock('@/lib/rr-actor-assertion', () => ({
  signedRrActorFromRequest: vi.fn(() => 'signed-actor'),
}))

import { POST } from '@/app/api/rr-operator/kernel/[...path]/route'
import { signedRrActorFromRequest } from '@/lib/rr-actor-assertion'
import { operatorAuthorized, sameOrigin } from '@/lib/rr-operator-auth'

const params = (path: string[]) => ({ params: Promise.resolve({ path }) })
const input = JSON.stringify({ operational: { decision_id: 'rr-economic-fixture' } })

function fakeRequest(): NextRequest {
  return {
    method: 'POST',
    headers: new Headers({
      'Content-Type': 'application/json',
      'Content-Length': String(Buffer.byteLength(input)),
    }),
    text: async () => input,
    nextUrl: new URL('https://observatory.qdip.ai/api/rr-operator/kernel/economic-v2/preflight'),
  } as unknown as NextRequest
}

beforeEach(() => {
  vi.stubEnv('DIP_API_BASE_URL', 'https://core.example.test')
  vi.stubEnv('DIP_API_KEY', 'test-organization-scoped-key')
  vi.stubEnv('RR_ORG_API_KEY', '')
  vi.mocked(operatorAuthorized).mockReturnValue(true)
  vi.mocked(sameOrigin).mockReturnValue(true)
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('RR-ECON-v2 Web-to-Core proxy integration boundary', () => {
  it('forwards exactly the compiler-only path with server API key and no actor execution', async () => {
    const calls: { url: string; init: RequestInit }[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url, init })
        return new Response(
          JSON.stringify({
            schema_version: 'readiness-recovery.economic-preflight.v2',
            state: 'COMPILED_PREVIEW_ONLY',
            actionable: false,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      })
    )
    const response = await POST(fakeRequest(), params(['economic-v2', 'preflight']))
    expect(response.status).toBe(200)
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('https://core.example.test/api/v1/readiness-recovery/economic-v2/preflight')
    expect(calls[0].init.method).toBe('POST')
    expect(calls[0].init.body).toBe(input)
    const headers = calls[0].init.headers as Record<string, string>
    expect(headers['x-api-key']).toBe('test-organization-scoped-key')
    expect(headers['x-qdip-actor-assertion']).toBeUndefined()
    expect(signedRrActorFromRequest).not.toHaveBeenCalled()
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it('uses RR_ORG_API_KEY instead of the shared platform key for Core requests', async () => {
    vi.stubEnv('RR_ORG_API_KEY', 'dedicated-rr-organization-key')
    vi.stubEnv('DIP_API_KEY', 'platform-admin-key-must-not-be-used-for-rr')
    const fetcher = vi.fn(async (url: string, init: RequestInit) => {
      expect(url).toContain('/economic-v2/preflight')
      expect(init.method).toBe('POST')
      return new Response(JSON.stringify({ state: 'COMPILED_PREVIEW_ONLY' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    })
    vi.stubGlobal('fetch', fetcher)
    const response = await POST(fakeRequest(), params(['economic-v2', 'preflight']))
    expect(response.status).toBe(200)
    expect(fetcher).toHaveBeenCalledOnce()
    const headers = fetcher.mock.calls[0][1].headers as Record<string, string>
    expect(headers['x-api-key']).toBe('dedicated-rr-organization-key')
    expect(headers['x-api-key']).not.toBe('platform-admin-key-must-not-be-used-for-rr')
  })

  it('rejects unauthenticated and wrong-origin requests before touching Core', async () => {
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)
    vi.mocked(operatorAuthorized).mockReturnValue(false)
    const noSession = await POST(fakeRequest(), params(['economic-v2', 'preflight']))
    expect(noSession.status).toBe(401)
    vi.mocked(operatorAuthorized).mockReturnValue(true)
    vi.mocked(sameOrigin).mockReturnValue(false)
    const csrf = await POST(fakeRequest(), params(['economic-v2', 'preflight']))
    expect(csrf.status).toBe(403)
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('blocks economic solve/commit/order routes even with a valid session', async () => {
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)
    for (const forbidden of [
      ['economic-v2', 'execute'],
      ['economic-v2', 'orders'],
      ['economic-v2', 'preflight', 'apply'],
    ]) {
      const response = await POST(fakeRequest(), params(forbidden))
      expect(response.status).toBe(404)
    }
    expect(fetcher).not.toHaveBeenCalled()
  })
})
