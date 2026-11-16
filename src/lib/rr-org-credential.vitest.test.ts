import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { rrOrgApiKey } from './rr-org-credential'

afterEach(() => vi.unstubAllEnvs())

describe('standalone RR organization credential', () => {
  it('uses only the dedicated RR organization key', () => {
    vi.stubEnv('RR_ORG_API_KEY', ' rr-org-key ')
    vi.stubEnv('DIP_API_KEY', 'shared-platform-key')
    expect(rrOrgApiKey()).toBe('rr-org-key')
  })

  it('never falls back to the shared platform key in any environment', () => {
    vi.stubEnv('RR_ORG_API_KEY', '')
    vi.stubEnv('DIP_API_KEY', 'shared-platform-key')
    for (const env of ['production', 'preview', 'development', '']) {
      vi.stubEnv('VERCEL_ENV', env)
      expect(rrOrgApiKey()).toBe('')
    }
  })
})
