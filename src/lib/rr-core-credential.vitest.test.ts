import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { rrCoreApiKey } from './rr-core-credential'

afterEach(() => vi.unstubAllEnvs())

describe('RR Core credential separation', () => {
  it('prefers the dedicated RR organization credential', () => {
    vi.stubEnv('RR_ORG_API_KEY', ' rr-org-key ')
    vi.stubEnv('DIP_API_KEY', 'shared-platform-key')
    expect(rrCoreApiKey()).toBe('rr-org-key')
  })

  it('preserves the legacy integration fixture while migration is incomplete', () => {
    vi.stubEnv('RR_ORG_API_KEY', '')
    vi.stubEnv('DIP_API_KEY', ' test-org-scoped-legacy-key ')
    expect(rrCoreApiKey()).toBe('test-org-scoped-legacy-key')
  })

  it('fails closed when neither RR nor the legacy credential is configured', () => {
    vi.stubEnv('RR_ORG_API_KEY', '')
    vi.stubEnv('DIP_API_KEY', '')
    expect(rrCoreApiKey()).toBe('')
  })
})
