import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { SERVICEOPS_URLS, serviceOpsCopy } from './serviceops-content'

const file = (path: string) => readFileSync(path, 'utf8')

describe('ServiceOps public application case and funnel', () => {
  it('uses the deployed ServiceOps route contract', () => {
    expect(SERVICEOPS_URLS).toEqual({
      app: 'https://ops.qdip.ai/app',
      ownerDemo: 'https://ops.qdip.ai/demo/owner',
      workerDemo: 'https://ops.qdip.ai/demo/worker',
      customerDemo: 'https://ops.qdip.ai/demo/customer',
    })
  })

  it('contains full localized user guidance and twelve service templates', () => {
    for (const locale of ['en', 'uk', 'pl'] as const) {
      const copy = serviceOpsCopy[locale]
      expect(copy.presets).toHaveLength(12)
      expect(copy.guideSections).toHaveLength(8)
      expect(copy.guideSections.every((section) => section.steps.length >= 4)).toBe(true)
      expect(copy.features).toHaveLength(3)
      expect(Object.keys(copy.roles).sort()).toEqual(['customer', 'owner', 'worker'])
      expect(copy.faq).toHaveLength(3)
      expect(copy.boundary).toContain('Kernel')
      expect(copy.seoDescription.length).toBeGreaterThan(40)
    }
  })

  it('publishes canonical marketing routes and localized sitemap', () => {
    const route = file('src/app/platform/[locale]/[...slug]/page.tsx')
    const sitemap = file('src/app/sitemap.ts')
    expect(route).toContain("if (key === 'serviceops')")
    expect(route).toContain("if (key === 'serviceops/guide')")
    expect(sitemap).toContain("'serviceops/guide'")
    expect(sitemap).toContain("'serviceops'")
  })

  it('reuses current inquiry backend and preserves real-vs-demo distinction', () => {
    const form = file('src/components/marketing/decision-inquiry-form.tsx')
    const page = file('src/components/marketing/serviceops/serviceops-page.tsx')
    expect(form).toContain("variant = 'decision'")
    expect(form).toContain('ServiceOps pilot inquiry')
    expect(form).toContain('w.dataLayer?.push({ event, locale, placement })')
    expect(form).toContain("fetch('/api/decision-inquiry'")
    expect(page).toContain('variant="serviceops"')
    expect(page).toContain('SERVICEOPS_URLS.ownerDemo')
    expect(page).not.toContain('guaranteed')
  })

  it('links home and use-cases without changing canonical DI demo names', () => {
    expect(file('src/components/marketing/qdip-site.tsx')).toContain('serviceops_home_case')
    expect(file('src/components/marketing/public-page.tsx')).toContain('serviceops_usecases_case')
    const policy = file('src/product/public-product-policy.ts')
    for (const key of ['resourceAllocation', 'supplyNetworkOptimization', 'gtmLab']) expect(policy).toContain(key)
    expect(file('src/components/marketing/marketing-analytics.tsx')).toContain(
      'dataLayer.push({ event, locale, placement })'
    )
  })
})
