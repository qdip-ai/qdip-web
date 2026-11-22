import { describe, expect, it } from 'vitest'
import nextConfig from '../next.config'
import { isSurfaceHost, PLATFORM_HOST_PATTERNS, PLATFORM_HOSTS, PLATFORM_ORIGINS } from './routing-config'

describe('declarative platform routing', () => {
  it('assigns canonical and local hosts to exactly one surface', () => {
    const seen = new Map<string, string>()

    for (const [surface, hosts] of Object.entries(PLATFORM_HOSTS)) {
      for (const host of hosts) {
        expect(seen.has(host), host).toBe(false)
        seen.set(host, surface)
        expect(isSurfaceHost(surface as 'site' | 'studio' | 'observatory', host)).toBe(true)
        expect(isSurfaceHost(surface as 'site' | 'studio' | 'observatory', `${host}:3000`)).toBe(true)
      }
    }

    expect(isSurfaceHost('studio', 'studio.example.com')).toBe(false)
    expect(isSurfaceHost('observatory', 'foo.qdip.ai')).toBe(false)
  })

  it('reserves Vercel preview hosts for the marketing rewrite only', () => {
    expect(new RegExp(PLATFORM_HOST_PATTERNS.site).test('dip-observatory-git-feature.vercel.app')).toBe(true)
    expect(new RegExp(PLATFORM_HOST_PATTERNS.studio).test('dip-observatory-git-feature.vercel.app')).toBe(false)
    expect(new RegExp(PLATFORM_HOST_PATTERNS.observatory).test('dip-observatory-git-feature.vercel.app')).toBe(false)
  })

  it('declares host-conditioned rewrites in Next config', async () => {
    expect(nextConfig.rewrites).toBeTypeOf('function')
    const rewrites = await nextConfig.rewrites!()
    expect(Array.isArray(rewrites)).toBe(false)

    const beforeFiles = 'beforeFiles' in rewrites ? rewrites.beforeFiles : []
    expect(beforeFiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: '/:locale(en|uk|pl)',
          destination: '/platform/:locale',
          has: [{ type: 'host', value: PLATFORM_HOST_PATTERNS.site }],
        }),
        expect.objectContaining({
          source: '/:locale(en|uk|pl)/:path*',
          destination: '/studio/:path*?lang=:locale&route=:path*',
          has: [{ type: 'host', value: PLATFORM_HOST_PATTERNS.studio }],
        }),
      ])
    )
  })

  it('canonicalizes implementation namespaces with built-in redirects', async () => {
    expect(nextConfig.redirects).toBeTypeOf('function')
    const redirects = await nextConfig.redirects!()

    expect(redirects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: '/platform/:locale(en|uk|pl)/:path*',
          destination: `${PLATFORM_ORIGINS.site}/:locale/:path*`,
          permanent: true,
        }),
        expect.objectContaining({
          source: '/studio/:path*',
          destination: `${PLATFORM_ORIGINS.studio}/en/:path*`,
          permanent: true,
        }),
        expect.objectContaining({
          source: '/observatory/:path*',
          destination: `${PLATFORM_ORIGINS.observatory}/en/:path*`,
          permanent: true,
        }),
      ])
    )
  })

  it('redirects unknown wildcard hosts, not registered platform surfaces or unrelated domains', async () => {
    const redirects = await nextConfig.redirects!()
    const fallback = redirects.find((rule) => rule.source === '/:path*' && rule.destination === 'https://qdip.ai')

    expect(fallback?.permanent).toBe(true) // Next.js serves permanent redirects as HTTP 308.
    const matches = (host: string) =>
      (fallback?.has ?? []).every(
        ({ type, value }) => type === 'host' && new RegExp(value ?? 'a^').test(host)
      ) &&
      (fallback?.missing ?? []).every(
        ({ type, value }) => type !== 'host' || !new RegExp(value ?? 'a^').test(host)
      )

    for (const host of ['ghhjuhv.qdip.ai', 'unknown.qdip.ai', 'deep.unknown.qdip.ai']) {
      expect(matches(host), host).toBe(true)
    }

    for (const host of [
      'qdip.ai',
      'www.qdip.ai',
      'studio.qdip.ai',
      'observatory.qdip.ai',
      'qdip.localhost:3000',
      'studio.localhost:3000',
      'observatory.localhost:3000',
      'preview.vercel.app',
      'qdip.ai.attacker.example',
      'notqdip.ai',
    ]) {
      expect(matches(host), host).toBe(false)
    }
  })

})
