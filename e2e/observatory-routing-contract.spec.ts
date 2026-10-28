import { expect, test, type Page } from '@playwright/test'

const locales = ['en', 'uk', 'pl'] as const
const routes = [
  {
    id: 'resource-allocation',
    path: '/resource-allocation',
    title: { en: 'Resource Allocation', uk: 'Розподіл ресурсів', pl: 'Alokacja zasobów' },
  },
  {
    id: 'supply-network-optimization',
    path: '/supply-network-optimization',
    title: {
      en: 'Supply Network Optimization',
      uk: 'Оптимізація мережі постачання',
      pl: 'Optymalizacja sieci dostaw',
    },
  },
  {
    id: 'readiness-recovery',
    path: '/readiness-recovery',
    title: {
      en: 'Readiness Recovery Planner',
      uk: 'Планувальник відновлення готовності',
      pl: 'Planer odtwarzania gotowości',
    },
  },
  {
    id: 'gtm-lab',
    path: '/gtm-lab',
    title: {
      en: 'GTM Lab',
      uk: 'Лабораторія виходу на ринок',
      pl: 'Laboratorium wejścia na rynek',
    },
  },
] as const

function capturePageErrors(page: Page) {
  const errors: Error[] = []
  page.on('pageerror', (error) => errors.push(error))
  return errors
}

test.describe('Observatory production routing contract', () => {
  for (const locale of locales) {
    for (const route of routes) {
      test(`${locale}${route.path} renders without client runtime errors`, async ({ page }) => {
        const errors = capturePageErrors(page)
        const response = await page.goto(`http://observatory.localhost:3000/${locale}${route.path}`, {
          waitUntil: 'domcontentloaded',
        })

        expect(response?.status()).toBeLessThan(400)
        await expect(page.locator('#main-content')).toBeVisible()
        await expect(page.getByRole('link', { name: route.title[locale], exact: true }).first()).toHaveAttribute(
          'aria-current',
          'page'
        )
        await expect.poll(() => errors.map((error) => error.message), { timeout: 1_500 }).toEqual([])
      })
    }
  }

  for (const locale of locales) {
    test(`${locale} application navigation can visit every registered use case without page errors`, async ({
      page,
    }) => {
      const errors = capturePageErrors(page)
      const response = await page.goto(`http://observatory.localhost:3000/${locale}${routes[0].path}`, {
        waitUntil: 'domcontentloaded',
      })
      expect(response?.status()).toBeLessThan(400)

      for (const route of routes.slice(1)) {
        await page.getByRole('link', { name: route.title[locale], exact: true }).first().click()
        await expect(page).toHaveURL(new RegExp(`observatory\\.localhost:3000/${locale}${route.path}$`))
        await expect(page.locator('#main-content')).toBeVisible()
      }

      await expect.poll(() => errors.map((error) => error.message), { timeout: 1_500 }).toEqual([])
    })
  }

  for (const route of routes) {
    test(`${route.id} desktop locale navigation preserves route and runtime`, async ({ page }) => {
      const errors = capturePageErrors(page)
      const response = await page.goto(`http://observatory.localhost:3000/en${route.path}`, {
        waitUntil: 'domcontentloaded',
      })
      expect(response?.status()).toBeLessThan(400)

      for (const locale of ['uk', 'pl', 'en'] as const) {
        await page.locator(`a[data-locale="${locale}"]`).click()
        await expect(page).toHaveURL(new RegExp(`observatory\\.localhost:3000/${locale}${route.path}$`))
        await expect(page.locator('#main-content')).toBeVisible()
        await expect(page.locator(`a[data-locale="${locale}"]`)).toHaveAttribute('aria-current', 'page')
      }

      await expect.poll(() => errors.map((error) => error.message), { timeout: 1_500 }).toEqual([])
    })

    test(`${route.id} mobile locale navigation preserves route and runtime`, async ({ page }) => {
      const errors = capturePageErrors(page)
      await page.setViewportSize({ width: 390, height: 844 })
      const response = await page.goto(`http://observatory.localhost:3000/en${route.path}`, {
        waitUntil: 'domcontentloaded',
      })
      expect(response?.status()).toBeLessThan(400)

      const languages = page.getByRole('group', { name: 'Language' })
      await expect(languages).toBeVisible()
      await expect(languages.locator('a[aria-current="page"]')).toHaveText('EN')
      await languages.locator('a[data-mobile-locale="uk"]').click()
      await expect(page).toHaveURL(new RegExp(`observatory\\.localhost:3000/uk${route.path}$`))
      await expect(page.locator('#main-content')).toBeVisible()

      await expect.poll(() => errors.map((error) => error.message), { timeout: 1_500 }).toEqual([])
    })
  }

  test('unknown use case remains a hard 404 instead of falling through to a broken renderer', async ({ page }) => {
    const errors = capturePageErrors(page)
    const response = await page.goto('http://observatory.localhost:3000/en/not-a-real-use-case')
    expect(response?.status()).toBe(404)
    expect(errors.map((error) => error.message)).toEqual([])
  })
})

test('retired Supply Network Resilience route is not publicly routable', async ({ page }) => {
  for (const locale of locales) {
    const response = await page.goto(`http://observatory.localhost:3000/${locale}/supply-network-resilience`)
    expect(response?.status()).toBe(404)
  }
})

test.describe('Observatory product-home routing regression', () => {
  for (const locale of locales) {
    test(`${locale} product lockup returns to Observatory home without client runtime errors`, async ({ page }) => {
      const errors = capturePageErrors(page)
      const response = await page.goto(`http://observatory.localhost:3000/${locale}/supply-network-optimization`, {
        waitUntil: 'domcontentloaded',
      })
      expect(response?.status()).toBeLessThan(400)

      await page.locator('a.ds-product-lockup-product').first().click()
      await expect(page).toHaveURL(new RegExp(`observatory\\.localhost:3000/${locale}/?$`))
      await expect(page.locator('#main-content')).toBeVisible()
      await expect.poll(() => errors.map((error) => error.message), { timeout: 1_500 }).toEqual([])
    })
  }
})

test.describe('Observatory repeated navigation regression', () => {
  for (const locale of locales) {
    test(`${locale} repeatedly navigates home and applications without runtime errors`, async ({ page }) => {
      const errors = capturePageErrors(page)
      const response = await page.goto(`http://observatory.localhost:3000/${locale}`, {
        waitUntil: 'domcontentloaded',
      })
      expect(response?.status()).toBeLessThan(400)

      for (const route of routes) {
        await page.getByRole('link', { name: route.title[locale], exact: true }).first().click()
        await expect(page).toHaveURL(new RegExp(`observatory\\.localhost:3000/${locale}${route.path}$`))
        await expect(page.locator('#main-content')).toBeVisible()

        await page.locator('a.ds-product-lockup-product').first().click()
        await expect(page).toHaveURL(new RegExp(`observatory\\.localhost:3000/${locale}/?$`))
        await expect(page.locator('#main-content')).toBeVisible()
      }

      await expect.poll(() => errors.map((error) => error.message), { timeout: 1_500 }).toEqual([])
    })
  }
})

test.describe('retired Contractor Allocation routes', () => {
  for (const locale of locales) {
    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 390, height: 844 },
      { width: 844, height: 390 },
    ] as const) {
      test(`${locale} route absent at ${viewport.width}x${viewport.height}`, async ({ page }) => {
        await page.setViewportSize(viewport)
        const retired = await page.goto(`http://observatory.localhost:3000/${locale}/contractor-allocation`)
        expect(retired?.status()).toBe(404)
        const home = await page.goto(`http://observatory.localhost:3000/${locale}`)
        expect(home?.status()).toBeLessThan(400)
        await expect(page.getByRole('link', { name: /Contractor Allocation|Розподіл робіт між підрядниками|Przydział prac wykonawcom/i })).toHaveCount(0)
      })
    }
  }
})
