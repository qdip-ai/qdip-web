import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { marketingCopy, marketingLocales } from './qdip-copy'

const homepage = readFileSync('src/components/marketing/qdip-site.tsx', 'utf8')
const marketingStyles = readFileSync('src/components/marketing/qdip-site.module.css', 'utf8')

describe('QDIP ecosystem showcase', () => {
  it.each(marketingLocales)('%s has a distinct, accurate Dzvin product description', (locale) => {
    const copy = marketingCopy[locale].ecosystem
    expect(copy.heading.length).toBeGreaterThan(0)
    expect(copy.category.length).toBeGreaterThan(0)
    expect(copy.description).toContain('Dzvin.co')
    expect(copy.cta).toContain('Dzvin.co')
    expect(copy.cta.length).toBeGreaterThan(0)
    expect(JSON.stringify(copy)).not.toMatch(/Powered by QDIP/i)
  })

  it('shows exactly one Dzvin product card between demos and the existing final CTA', () => {
    const demo = homepage.indexOf('<DecisionPatterns locale={locale} cases={c.cases} />')
    const card = homepage.indexOf('<article className={styles.ecosystemCard}>')
    const cta = homepage.indexOf('<section className={styles.finalCta}>')
    expect(demo).toBeGreaterThan(-1)
    expect(card).toBeGreaterThan(demo)
    expect(card).toBeLessThan(cta)
    expect(homepage.match(/<article className={styles.ecosystemCard}>/g)).toHaveLength(1)
    expect(homepage).toContain('href="https://dzvin.co"')
    expect(homepage).toContain('{c.ecosystem.heading}')
    expect(homepage).toContain('{c.ecosystem.description}')
    expect(homepage).toContain('{c.ecosystem.cta}')
    expect(homepage).toContain('src="/brands/dzvin-wordmark.png"')
    expect(homepage).toContain('alt="Dzvin.co"')
  })

  it('ships the branded wordmark as an actual local PNG asset', () => {
    const file = readFileSync('public/brands/dzvin-wordmark.png')
    expect(Array.from(file.subarray(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
    expect(file.byteLength).toBeGreaterThan(1000)
    // Cropped to painted pixels; the original PNG had transparent margins.
    expect(file.readUInt32BE(16)).toBe(287)
    expect(file.readUInt32BE(20)).toBe(68)
  })

  it('keeps the wordmark above its category without a white label panel', () => {
    const brandRule = marketingStyles.match(/\.ecosystemBrand\s*\{([^}]*)\}/)?.[1]
    expect(brandRule).toContain('display: block')
    expect(brandRule).not.toMatch(/display:\s*inline-flex|background:|border-radius:|overflow:/)
    expect(homepage).toContain('<h3 className={styles.ecosystemBrand}>')
    expect(homepage).toContain('<span className={styles.ecosystemCategory}>')
    expect(homepage).toContain('width={144} height={34}')
    expect(marketingStyles).toMatch(
      /\.ecosystemBrand img\s*\{[^}]*content:\s*url\('\/brands\/dzvin-wordmark-dark\.png'\)/
    )
    expect(marketingStyles).toMatch(/data-marketing-appearance='light'[^}]*content:\s*normal/)
  })
})
