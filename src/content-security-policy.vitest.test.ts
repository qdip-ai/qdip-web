import { describe, expect, it } from 'vitest'
import nextConfig, { buildContentSecurityPolicy } from '../next.config'

function directive(policy: string, name: string) {
  return policy.split('; ').find((part) => part.startsWith(name + ' ')) ?? ''
}

describe('browser security policy', () => {
  it('restricts production script origins to self and blocks high-risk embeds', () => {
    const policy = buildContentSecurityPolicy(false)
    const scripts = directive(policy, 'script-src')

    expect(scripts).toBe("script-src 'self' 'unsafe-inline'")
    expect(scripts).not.toContain('unsafe-eval')
    expect(scripts).not.toContain('https:')
    expect(policy).toContain("object-src 'none'")
    expect(policy).toContain("frame-src 'none'")
    expect(policy).toContain("frame-ancestors 'none'")
    expect(policy).toContain("base-uri 'self'")
    expect(policy).toContain("form-action 'self'")
    expect(policy).toContain('upgrade-insecure-requests')
  })

  it('allows only the required external application and map resources', () => {
    const policy = buildContentSecurityPolicy(false)
    const connect = directive(policy, 'connect-src')
    const images = directive(policy, 'img-src')

    expect(connect).toContain('https://doctor.qdip.ai')
    expect(connect).toContain('https://tile.openstreetmap.org')
    expect(connect.split(' ')).not.toContain('https:')
    expect(connect).not.toContain('*')
    expect(images).toContain('https://tile.openstreetmap.org')
    expect(images).toContain('data:')
    expect(directive(policy, 'worker-src')).toContain('blob:')
  })

  it('limits development exceptions to local tooling', () => {
    const development = buildContentSecurityPolicy(true)
    const production = buildContentSecurityPolicy(false)

    expect(directive(development, 'script-src')).toContain("'unsafe-eval'")
    expect(directive(production, 'script-src')).not.toContain("'unsafe-eval'")
    expect(directive(development, 'connect-src')).toContain('ws:')
    expect(directive(production, 'connect-src')).not.toContain('ws:')
    expect(development).not.toContain('upgrade-insecure-requests')
  })

  it('applies CSP to documents without replacing route-specific API CSP', async () => {
    expect(nextConfig.headers).toBeTypeOf('function')
    const rules = await nextConfig.headers!()
    const documentRule = rules.find((rule) => rule.source === '/((?!api/).*)')
    const globalRule = rules.find((rule) => rule.source === '/:path*')

    expect(documentRule?.headers.find((header) => header.key === 'Content-Security-Policy')?.value).toBe(
      buildContentSecurityPolicy(process.env.NODE_ENV === 'development')
    )
    expect(globalRule?.headers).toEqual(
      expect.arrayContaining([
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
      ])
    )
    expect(nextConfig.poweredByHeader).toBe(false)
  })
})
