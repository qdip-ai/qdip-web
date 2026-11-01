import { expect, test } from '@playwright/test'
import { oidcTestCookies } from './oidc-test-session'

const adminPage = 'http://observatory.localhost:3000/uk/admin/plugins'
const adminApi = 'http://observatory.localhost:3000/api/observatory/admin/plugins'

test.describe('Observatory admin route must never hide permission errors as 404', () => {
  test('signed Observatory admin can open the real nested page', async ({ page }) => {
    await page.context().clearCookies()
    await page.context().addCookies(oidcTestCookies(['observatory_admin']))
    const response = await page.goto(adminPage)
    expect(response?.status()).toBe(200)
    await expect(page.getByRole('heading', { name: 'Керування плагінами' })).toBeVisible()
    await expect(page.getByTestId('qdip-access-gate')).toHaveCount(0)
    const session = await page.request.get('http://observatory.localhost:3000/api/auth/session')
    expect(session.status()).toBe(200)
    expect((await session.json()).observatoryAdmin).toBe(true)
  })

  test('signed non-admin receives an actionable access gate, not 404', async ({ page }) => {
    await page.context().clearCookies()
    await page.context().addCookies(oidcTestCookies(['studio']))
    const response = await page.goto(adminPage)
    expect(response?.status()).toBe(200)
    await expect(page.getByTestId('qdip-access-gate')).toBeVisible()
    await expect(page.getByText('Поточна сесія не містить цієї ролі.', { exact: false })).toBeVisible()
    const api = await page.request.get(adminApi)
    expect(api.status()).toBe(403)
  })

  test('anonymous user is redirected to login and admin API rejects access', async ({ page }) => {
    await page.context().clearCookies()
    const pageResponse = await page.request.get(adminPage, { maxRedirects: 0 })
    expect([302, 303, 307, 308]).toContain(pageResponse.status())
    expect(pageResponse.headers().location).toContain('/api/auth/login')
    const apiResponse = await page.request.get(adminApi)
    expect(apiResponse.status()).toBe(401)
  })

  test('admin cards stay compact on mobile and fit all viewport orientations', async ({ page }, testInfo) => {
    await page.context().clearCookies()
    await page.context().addCookies(oidcTestCookies(['observatory_admin']))
    await page.route('**/api/observatory/admin/plugins', async (route) => {
      if (route.request().method() !== 'GET') return route.continue()
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          plugins: [
            {
              name: 'mobile-layout-fixture',
              plugin_id: 'mobile-layout-fixture',
              source: 'remote',
              description: 'A short plugin description for responsive layout regression.',
              version: '0.1.0',
              enabled: true,
              capabilities: [],
              published: false,
              published_version: null,
              capability_id: null,
              revision: 1,
              ui: { label: 'Responsive layout fixture', category: 'Other' },
            },
          ],
        }),
      })
    })

    for (const viewport of [
      { name: 'desktop', width: 1280, height: 800 },
      { name: 'mobile-portrait', width: 390, height: 844 },
      { name: 'mobile-landscape', width: 844, height: 390 },
    ]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await page.goto(adminPage)
      const card = page
        .locator('article')
        .filter({ has: page.getByRole('heading', { name: 'Responsive layout fixture' }) })
      await expect(card).toBeVisible()
      const version = card.getByText('Версія: 0.1.0')
      const status = card.getByText('Не опубліковано')
      await expect(version).toBeVisible()
      await expect(status).toBeVisible()
      const cardBox = await card.boundingBox()
      expect(cardBox).not.toBeNull()
      expect(cardBox!.x + cardBox!.width).toBeLessThanOrEqual(viewport.width + 1)

      if (viewport.width <= 740) {
        const versionBox = await version.boundingBox()
        const statusBox = await status.boundingBox()
        expect(versionBox).not.toBeNull()
        expect(statusBox).not.toBeNull()
        expect(statusBox!.y - (versionBox!.y + versionBox!.height)).toBeLessThan(64)
      }

      await testInfo.attach(`observatory-admin-${viewport.name}`, {
        body: await page.screenshot(),
        contentType: 'image/png',
      })
    }
  })
})
