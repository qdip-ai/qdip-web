import { expect, test, type Page } from '@playwright/test'

function capturePageErrors(page: Page) {
  const errors: Error[] = []
  page.on('pageerror', (error) => errors.push(error))
  return errors
}

async function expectNoPageErrors(errors: Error[]) {
  await expect.poll(() => errors.map((error) => error.message), { timeout: 1_500 }).toEqual([])
}

test.describe('platform surface routing contract', () => {
  test('all three product surfaces return enforceable CSP response headers', async ({ request }) => {
    const routes = [
      ['qdip.localhost:3000', '/en'],
      ['studio.localhost:3000', '/en/profiles'],
      ['observatory.localhost:3000', '/en'],
    ] as const

    for (const [host, path] of routes) {
      const response = await request.get(`http://127.0.0.1:3000${path}`, { headers: { host } })
      expect(response.status(), host).toBe(200)

      const headers = response.headers()
      const policy = headers['content-security-policy'] ?? ''
      expect(policy, host).toContain("script-src 'self' 'unsafe-inline'")
      expect(policy, host).toContain("object-src 'none'")
      expect(policy, host).toContain("frame-ancestors 'none'")
      expect(policy, host).toContain('https://tile.openstreetmap.org')
      expect(headers['x-content-type-options'], host).toBe('nosniff')
      expect(headers['x-frame-options'], host).toBe('DENY')
      expect(headers['x-powered-by'], host).toBeUndefined()
    }
  })

  test('Observatory survives the original mixed locale and application navigation sequence', async ({ page }) => {
    const errors = capturePageErrors(page)

    const response = await page.goto('http://observatory.localhost:3000/uk', { waitUntil: 'domcontentloaded' })
    expect(response?.status()).toBeLessThan(400)

    await page.locator('a[href="/uk/supply-network-optimization"]').first().click()
    await expect(page).toHaveURL(/observatory\.localhost:3000\/uk\/supply-network-optimization$/)
    await page.locator('a.ds-product-lockup-product').first().click()
    await expect(page).toHaveURL(/observatory\.localhost:3000\/uk\/?$/)

    await page.locator('a[data-locale="pl"]').click()
    await expect(page).toHaveURL(/observatory\.localhost:3000\/pl\/?$/)
    await page.locator('a[href="/pl/resource-allocation"]').first().click()
    await expect(page).toHaveURL(/observatory\.localhost:3000\/pl\/resource-allocation$/)
    await page.locator('a.ds-product-lockup-product').first().click()
    await expect(page).toHaveURL(/observatory\.localhost:3000\/pl\/?$/)

    await page.locator('a[data-locale="en"]').click()
    await expect(page).toHaveURL(/observatory\.localhost:3000\/en\/?$/)
    await page.locator('a[href="/en/gtm-lab"]').first().click()
    await expect(page).toHaveURL(/observatory\.localhost:3000\/en\/gtm-lab$/)
    await page.locator('a.ds-product-lockup-product').first().click()
    await expect(page).toHaveURL(/observatory\.localhost:3000\/en\/?$/)

    await expect(page.locator('#main-content')).toBeVisible()
    await expectNoPageErrors(errors)
  })

  test('Studio preserves public route and locale through repeated native navigation', async ({ page }) => {
    const errors = capturePageErrors(page)

    const response = await page.goto('http://studio.localhost:3000/en/profiles', { waitUntil: 'domcontentloaded' })
    expect(response?.status()).toBeLessThan(400)
    await expect(page.locator('#main-content')).toBeVisible()

    await page.locator('a[href="/en/plugins"]:visible').first().click()
    await expect(page).toHaveURL(/studio\.localhost:3000\/en\/plugins$/)

    await page.locator('a[href="/uk/plugins"]:visible').first().click()
    await expect(page).toHaveURL(/studio\.localhost:3000\/uk\/plugins$/)

    await page.locator('a[href="/uk/bindings"]:visible').first().click()
    await expect(page).toHaveURL(/studio\.localhost:3000\/uk\/bindings$/)

    await page.locator('a[href="/pl/bindings"]:visible').first().click()
    await expect(page).toHaveURL(/studio\.localhost:3000\/pl\/bindings$/)

    await page.locator('a[href="/pl/dimensions"]:visible').first().click()
    await expect(page).toHaveURL(/studio\.localhost:3000\/pl\/dimensions$/)

    await expect(page.locator('#main-content')).toBeVisible()
    await expectNoPageErrors(errors)
  })

  test('cross-surface links always target canonical product hosts', async ({ page }) => {
    await page.goto('http://observatory.localhost:3000/en', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('a.ds-product-lockup-brand').first()).toHaveAttribute('href', 'https://qdip.ai/en')
    await expect(page.locator('a.ds-product-switch-link').first()).toHaveAttribute('href', 'https://studio.qdip.ai/en')

    await page.goto('http://studio.localhost:3000/en/profiles', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('a.ds-product-lockup-brand').first()).toHaveAttribute('href', 'https://qdip.ai/en')
    await expect(page.locator('a[href="https://observatory.qdip.ai/en"]:visible').first()).toBeVisible()

    await page.goto('http://qdip.localhost:3000/en', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('a[href="https://observatory.qdip.ai/en"]').first()).toBeVisible()
    await expect(page.locator('a[href="https://studio.qdip.ai/en"]').first()).toBeVisible()
  })

  test('Studio pages are public while client headers cannot bypass Core API authorization', async ({ request }) => {
    const response = await request.get('http://127.0.0.1:3000/uk/plugins', {
      headers: {
        host: 'studio.localhost:3000',
        'x-qdip-internal-rewrite': '1',
      },
    })

    expect(response.status()).toBeLessThan(400)
    const html = await response.text()
    expect(html).toContain('studio-shell')
    expect(html).toContain('studio-workspace')
  })

  test('foreign internal namespaces redirect to their owning surface', async ({ request }) => {
    const studioLeak = await request.get('http://127.0.0.1:3000/studio/plugins?source=leak', {
      headers: { host: 'qdip.localhost:3000' },
      maxRedirects: 0,
    })
    expect(studioLeak.status()).toBe(308)
    expect(studioLeak.headers().location).toBe('https://studio.qdip.ai/en/plugins?source=leak')

    const siteLeak = await request.get('http://127.0.0.1:3000/platform/uk/use-cases?source=leak', {
      headers: { host: 'observatory.localhost:3000' },
      maxRedirects: 0,
    })
    expect(siteLeak.status()).toBe(308)
    expect(siteLeak.headers().location).toBe('https://qdip.ai/uk/use-cases?source=leak')

    const observatoryLeak = await request.get('http://127.0.0.1:3000/observatory/decisions?decision=abc', {
      headers: { host: 'studio.localhost:3000' },
      maxRedirects: 0,
    })
    expect(observatoryLeak.status()).toBe(308)
    expect(observatoryLeak.headers().location).toBe('https://observatory.qdip.ai/en/decisions?decision=abc')
  })

  test('Studio API is not exposed on non-Studio surfaces', async ({ request }) => {
    for (const host of ['qdip.localhost:3000', 'observatory.localhost:3000']) {
      const response = await request.get('http://127.0.0.1:3000/api/studio/dimensions', {
        headers: { host },
      })

      expect(response.status(), host).toBe(404)
    }
  })

  test('dotted application routes still pass through product routing', async ({ page }) => {
    const response = await page.goto('http://studio.localhost:3000/uk/profiles/demo.v1', {
      waitUntil: 'domcontentloaded',
    })

    expect(response?.status()).toBeLessThan(400)
    await expect(page).toHaveURL(/studio\.localhost:3000\/uk\/profiles\/demo\.v1$/)
    await expect(page.locator('#main-content')).toBeVisible()
  })

  test('canonical product roots never expose internal rewrite paths', async ({ page }) => {
    const observatory = await page.goto('http://observatory.localhost:3000/', { waitUntil: 'domcontentloaded' })
    expect(observatory?.status()).toBeLessThan(400)
    await expect(page).toHaveURL(/observatory\.localhost:3000\/en$/)

    const studio = await page.goto('http://studio.localhost:3000/', { waitUntil: 'domcontentloaded' })
    expect(studio?.status()).toBeLessThan(400)
    await expect(page).toHaveURL(/studio\.localhost:3000\/en\/profiles$/)

    const marketing = await page.goto('http://qdip.localhost:3000/', { waitUntil: 'domcontentloaded' })
    expect(marketing?.status()).toBeLessThan(400)
    await expect(page).toHaveURL(/qdip\.localhost:3000\/$/)
  })

  test('localized Decision Audit is routable and legacy URL canonicalizes', async ({ page }) => {
    const errors = capturePageErrors(page)

    const legacy = await page.goto('http://observatory.localhost:3000/decisions?decision=test-id', {
      waitUntil: 'domcontentloaded',
    })
    expect(legacy?.status()).toBeLessThan(400)
    await expect(page).toHaveURL(/observatory\.localhost:3000\/en\/decisions\?decision=test-id$/)
    await expect(page.locator('#main-content')).toBeVisible()

    const localized = await page.goto('http://observatory.localhost:3000/uk/decisions?decision=test-id', {
      waitUntil: 'domcontentloaded',
    })
    expect(localized?.status()).toBeLessThan(400)
    await expect(page).toHaveURL(/observatory\.localhost:3000\/uk\/decisions\?decision=test-id$/)
    await expect(page.locator('#main-content')).toBeVisible()

    await expectNoPageErrors(errors)
  })

  test('Vercel preview localized routes render marketing instead of Observatory', async ({ request }) => {
    for (const pathname of ['/uk', '/pl/core/architecture']) {
      const response = await request.get(`http://127.0.0.1:3000${pathname}`, {
        headers: { host: 'dip-observatory-git-routing-preview.vercel.app' },
      })

      expect(response.status()).toBeLessThan(400)
      const html = await response.text()
      expect(html).toMatch(/<main[^>]*id="main-content"[^>]*lang="(?:uk|pl)"/)
    }
  })

  test('marketing localized routes remain on the marketing surface', async ({ page }) => {
    const errors = capturePageErrors(page)

    const response = await page.goto('http://qdip.localhost:3000/en', { waitUntil: 'domcontentloaded' })
    expect(response?.status()).toBeLessThan(400)

    const pl = page.locator('a[href="/pl"]').first()
    await expect(pl).toBeVisible()
    await pl.click()
    await expect(page).toHaveURL(/qdip\.localhost:3000\/pl$/)

    const nested = await page.goto('http://qdip.localhost:3000/uk/core/architecture', {
      waitUntil: 'domcontentloaded',
    })
    expect(nested?.status()).toBeLessThan(400)
    await expect(page).toHaveURL(/qdip\.localhost:3000\/uk\/core\/architecture$/)

    await expectNoPageErrors(errors)
  })
})
