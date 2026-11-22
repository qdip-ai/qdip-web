import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync('src/components/marketing/sdk-page.tsx', 'utf8')
const routes = readFileSync('src/app/platform/[locale]/[...slug]/page.tsx', 'utf8')
const header = readFileSync('src/components/marketing/marketing-header.tsx', 'utf8')
const footer = readFileSync('src/components/product/qdip-footer.tsx', 'utf8')
const sitemap = readFileSync('src/app/sitemap.ts', 'utf8')
const nextConfig = readFileSync('next.config.ts', 'utf8')
const manifest = JSON.parse(readFileSync('public/sdk/manifest.json', 'utf8')) as {
  schema_version: number
  source_commit: string
  artifacts: Record<string, { version: string; filename: string; size_bytes: number; sha256: string; url: string; platform?: string }>
}

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

  it('provides all supported locales, correct versions and real release links', () => {
    for (const locale of ['en', 'uk', 'pl']) {
      expect(source).toContain('  ' + locale + ': {')
      expect(routes).toContain('  ' + locale + ': {')
    }
    expect(source).toContain('qdip-remote-sdk==0.1.3')
    expect(source).toContain('qdip-client-0.2.0.tgz')
    expect(source).not.toContain('qdip-client-0.1.2.tgz')
    expect(source).toContain('sdkRelease.artifacts.sdk02.filename')
    expect(source).toContain('sdkRelease.artifacts.sdk03.filename')
    expect(source).toContain('href="/sdk/manifest.json"')
    expect(source).not.toMatch(/local-only-sdk02-|dip-[a-f0-9]{32}/)
    expect(source).toContain('scoped Worker key')
  })

  it('only publishes present archives matching the immutable SHA-256 manifest', () => {
    expect(manifest.schema_version).toBe(1)
    expect(manifest.source_commit).toMatch(/^[a-f0-9]{40}$/)
    expect(Object.keys(manifest.artifacts).sort()).toEqual(['sdk02', 'sdk03'])
    for (const [key, item] of Object.entries(manifest.artifacts)) {
      expect(item.filename).toMatch(/^qdip-[a-z0-9.-]+\.(?:zip|tgz)$/)
      expect(item.url).toBe('https://qdip.ai/sdk/releases/' + item.filename)
      expect(item.filename).not.toContain('..')
      expect(item.sha256).toMatch(/^[a-f0-9]{64}$/)
      const data = readFileSync('public/sdk/releases/' + item.filename)
      expect(data.length).toBe(item.size_bytes)
      expect(createHash('sha256').update(data).digest('hex')).toBe(item.sha256)
      expect(key === 'sdk02' ? data.subarray(0, 2).toString() : data[0]).toBe(key === 'sdk02' ? 'PK' : 31)
    }
    expect(manifest.artifacts.sdk02.version).toBe('0.1.3')
    expect(manifest.artifacts.sdk02.platform).toBe('CPython 3.11 / Linux x86_64')
    expect(manifest.artifacts.sdk03.version).toBe('0.2.0')
  })
})
