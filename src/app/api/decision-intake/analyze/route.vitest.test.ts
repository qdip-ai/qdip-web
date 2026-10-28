// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
import { POST } from './route'

const URL_ = 'https://observatory.example/api/decision-intake/analyze'

function upload(headers: Record<string, string>) {
  const form = new FormData()
  form.set('file', new File(['a,b\n1,2\n'], 'data.csv', { type: 'text/csv' }))
  return new Request(URL_, { method: 'POST', body: form, headers })
}

describe('Decision Intake analyze route access', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('rejects cross-origin uploads before forwarding to QDIP Core', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    const response = await POST(upload({ origin: 'https://attacker.example', 'sec-fetch-site': 'cross-site' }))

    expect(response.status).toBe(403)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('forwards same-origin uploads to QDIP Core with the server-side key', async () => {
    vi.stubEnv('DIP_API_BASE_URL', 'https://core.example')
    vi.stubEnv('DIP_API_KEY', 'test-key')
    const fetchSpy = vi.fn().mockResolvedValue(new Response('{}', { status: 502 }))
    vi.stubGlobal('fetch', fetchSpy)

    await POST(upload({ origin: 'https://observatory.example', 'sec-fetch-site': 'same-origin' }))

    expect(fetchSpy).toHaveBeenCalled()
    expect(String(fetchSpy.mock.calls[0][0])).toBe('https://core.example/api/v1/intake/v2/analyze')
  })
})
