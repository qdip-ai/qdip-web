import { expect, test } from '@playwright/test'
import { oidcTestCookies } from './oidc-test-session'

for (const [viewport, width, height] of [
  ['desktop', 1440, 900],
  ['mobile-portrait', 390, 844],
  ['mobile-landscape', 844, 390],
] as const) {
  test(`verified Yara is not rendered as legacy VHV — ${viewport}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height })
    await page.context().clearCookies()
    await page.context().addCookies(oidcTestCookies(['observatory_admin']))

    await page.route('**/api/observatory/admin/plugins', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          plugins: [
            {
              name: 'remote-3b25f5ae494aa7bf-secretary',
              plugin_id: 'secretary',
              source: 'remote',
              version: '0.1.0',
              enabled: true,
              published: false,
              published_version: null,
              revision: 1,
              capabilities: ['secretary.plan'],
              capability_id: 'secretary.plan',
              description: 'Decision-aware planning of commitments, tasks and calendar slots using QDIP.',
              ui: { label: 'VHV — Decision Assistant', category: 'Productivity' },
            },
          ],
        }),
      })
    })

    await page.goto('http://observatory.localhost:3000/uk/admin/plugins')
    await expect(page.getByRole('heading', { name: 'Yara — планування справ і часу' })).toBeVisible()
    await expect(
      page.getByText(
        'Допомагає складати плани справ і зобов’язань з урахуванням часу. Виконання дій та оновлення календаря потребують окремого підтвердження в Yara.'
      )
    ).toBeVisible()
    await expect(page.getByText(/VHV/)).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`yara-rename-${viewport}.png`), fullPage: true })
  })
}

test('verified Yara is renamed in English and Polish; unrelated publisher remains untouched', async ({ page }) => {
  await page.context().clearCookies()
  await page.context().addCookies(oidcTestCookies(['observatory_admin']))
  await page.route('**/api/observatory/admin/plugins', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        plugins: [
          {
            name: 'remote-04e7c87d7b72111c-secretary',
            plugin_id: 'secretary',
            source: 'remote',
            version: '0.1.0',
            enabled: true,
            published: false,
            revision: 5,
            capabilities: ['secretary.plan'],
            capability_id: 'secretary.plan',
            description: 'Decision-aware planning of commitments, tasks and calendar slots using QDIP.',
            ui: { label: 'VHV — Decision Assistant', category: 'Productivity' },
          },
          {
            name: 'remote-other-secretary',
            plugin_id: 'secretary',
            source: 'remote',
            version: '0.1.0',
            enabled: true,
            published: false,
            revision: 1,
            capabilities: ['secretary.plan'],
            capability_id: 'secretary.plan',
            description: 'Independent developer assistant.',
            ui: { label: 'VHV — External Publisher', category: 'Productivity' },
          },
        ],
      }),
    })
  })
  await page.goto('http://observatory.localhost:3000/en/admin/plugins')
  await expect(page.getByRole('heading', { name: 'Yara — Decision Assistant' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'VHV — External Publisher' })).toBeVisible()
  await page.goto('http://observatory.localhost:3000/pl/admin/plugins')
  await expect(page.getByRole('heading', { name: 'Yara — planowanie zadań i czasu' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'VHV — External Publisher' })).toBeVisible()
})
