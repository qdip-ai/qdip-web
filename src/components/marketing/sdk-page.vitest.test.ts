import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync('src/components/marketing/sdk-page.tsx', 'utf8')
const routes = readFileSync('src/app/platform/[locale]/[...slug]/page.tsx', 'utf8')
const header = readFileSync('src/components/marketing/marketing-header.tsx', 'utf8')
const footer = readFileSync('src/components/product/qdip-footer.tsx', 'utf8')
const sitemap = readFileSync('src/app/sitemap.ts', 'utf8')
const nextConfig = readFileSync('next.config.ts', 'utf8')

describe('public SDK marketing surface', () => {
  it('registers SDK as a canonical localized marketing page', () => {
    expect(routes).toContain("'sdk',")
    expect(routes).toContain("if (key === 'sdk') return <SdkPage locale={locale} />")
    expect(nextConfig).toContain("source: '/sdk'")
    expect(nextConfig).toContain("destination: PLATFORM_ORIGINS.site + '/en/sdk'")
    expect(sitemap).toContain("'sdk',")
  })

  it('makes SDK discoverable in desktop and mobile navigation and footer', () => {
    expect(header).toContain("marketingPath(locale, 'sdk')")
    expect(footer).toContain("path(locale, 'sdk')")
  })

  it('provides all supported locales and correct independent SDK versions', () => {
    for (const locale of ['en', 'uk', 'pl']) {
      expect(source).toContain('  ' + locale + ': {')
      expect(routes).toContain('  ' + locale + ': {')
    }
    expect(source).toContain('qdip-remote-sdk==0.1.3')
    expect(source).toContain('qdip-client-0.1.2.tgz')
    expect(source).toContain('role="status"')
  })

  it('does not expose non-existent release links, tokens, or fixture credentials', () => {
    expect(source).not.toMatch(/href=["']\/sdk\/releases\//)
    expect(source).not.toMatch(/local-only-sdk02-|dip-[a-f0-9]{32}/)
    expect(source).toContain('Public downloads not yet available')
    expect(source).toContain('scoped Worker key')
  })
})
