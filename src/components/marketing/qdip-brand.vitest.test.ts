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

  it('shows ServiceOps and exactly one Dzvin card between demos and the final CTA', () => {
    const demo = homepage.indexOf('<DecisionPatterns locale={locale} cases={c.cases} />')
    const serviceCard = homepage.indexOf('<h3>ServiceOps</h3>')
    const dzvinCard = homepage.indexOf('<h3 className={styles.ecosystemBrand}>')
    const cta = homepage.indexOf('<section className={styles.finalCta}>')
    expect(demo).toBeGreaterThan(-1)
    expect(serviceCard).toBeGreaterThan(demo)
    expect(dzvinCard).toBeGreaterThan(serviceCard)
    expect(dzvinCard).toBeLessThan(cta)
    expect(homepage.match(/<article className={styles.ecosystemCard}>/g)).toHaveLength(2)
    expect(homepage.match(/<h3 className={styles.ecosystemBrand}>/g)).toHaveLength(1)
    expect(homepage).toContain('href="https://dzvin.co"')
    expect(homepage).toContain('{c.ecosystem.heading}')
    expect(homepage).toContain('{c.ecosystem.description}')
    expect(homepage).toContain('{c.ecosystem.cta}')
    expect(homepage).toContain('src="/brands/dzvin-wordmark.svg"')
    expect(homepage).toContain('alt="Dzvin.co"')
  })

  it('ships self-contained vector wordmarks with matching glyph outlines', () => {
    const light = readFileSync('public/brands/dzvin-wordmark.svg', 'utf8')
    const dark = readFileSync('public/brands/dzvin-wordmark-dark.svg', 'utf8')
    const lightPaths = [...light.matchAll(/<path[^>]* d="([^"]+)"/g)].map((match) => match[1])
    const darkPaths = [...dark.matchAll(/<path[^>]* d="([^"]+)"/g)].map((match) => match[1])

    expect(light).toContain('<svg xmlns="http://www.w3.org/2000/svg"')
    expect(dark).toContain('<svg xmlns="http://www.w3.org/2000/svg"')
    expect(lightPaths).toHaveLength(2) // peach brand shadow + purple wordmark
    expect(darkPaths).toHaveLength(1)
    expect(lightPaths[0]).toBe(lightPaths[1])
    expect(lightPaths[1]).toBe(darkPaths[0])
    expect(darkPaths[0]).toMatch(/^M[0-9]/)
    expect(darkPaths[0].length).toBeGreaterThan(4000)
    for (const svg of [light, dark]) {
      expect(svg).not.toMatch(/<image\b|data:image\/|<text\b|@font-face/i)
    }
  })

  it('keeps the wordmark above its category without a white label panel', () => {
    const brandRule = marketingStyles.match(/\.ecosystemBrand\s*\{([^}]*)\}/)?.[1]
    expect(brandRule).toContain('display: block')
    expect(brandRule).not.toMatch(/display:\s*inline-flex|background:|border-radius:|overflow:/)
    expect(homepage).toContain('<h3 className={styles.ecosystemBrand}>')
    expect(homepage).toContain('<span className={styles.ecosystemCategory}>')
    expect(homepage).toContain('width={144} height={34}')
    expect(marketingStyles).toMatch(
      /\.ecosystemBrand img\s*\{[^}]*content:\s*url\('\/brands\/dzvin-wordmark-dark\.svg'\)/
    )
    expect(marketingStyles).toMatch(/data-marketing-appearance='light'[^}]*content:\s*normal/)
  })
})
