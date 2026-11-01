import { expect, test } from '@playwright/test'
import { oidcTestCookies } from './oidc-test-session'

test('admin publishes SDK-registered plugin metadata without a compiled Observatory workspace', async ({ page }) => {
  await page.context().clearCookies()
  await page.context().addCookies(oidcTestCookies(['observatory_admin']))
  const plugin = {
    name: 'route-optimizer',
    version: '1.0.0',
    enabled: true,
    description: 'Delivery routing',
    capabilities: ['routes.optimize'],
    capability_versions: {},
    ui: { label: 'Route Optimizer', category: 'Operations' },
    published: null as boolean | null,
    published_version: null as string | null,
    slug: null as string | null,
    capability_id: null as string | null,
    revision: 0,
  }
  await page.route('**/api/observatory/admin/plugins', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ plugins: [plugin] }) })
  })
  let saved: Record<string, unknown> | null = null
  await page.route('**/api/observatory/admin/plugins/route-optimizer', async (route) => {
    saved = route.request().postDataJSON() as Record<string, unknown>
    plugin.published = true
    plugin.published_version = '1.0.0'
    plugin.revision = 1
    plugin.slug = 'delivery-routes'
    plugin.capability_id = 'routes.optimize'
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  })
  await page.goto('http://observatory.localhost:3000/uk/admin/plugins')
  const card = page.locator('article').filter({ hasText: 'Route Optimizer' })
  await card.getByRole('button', { name: 'Редагувати' }).click()
  await expect(card.getByRole('heading', { name: /Редагування плагіна/ })).toBeVisible()
  await card.getByLabel('Назва').fill('Оптимізатор маршрутів')
  await card.getByRole('textbox', { name: 'Коротка адреса (URL)' }).fill('delivery-routes')
  await card.getByLabel('Опис').fill('Розрахунок маршрутів доставки')
  await card.getByLabel('Категорія').selectOption('Optimization')
  await card.getByRole('button', { name: 'Зберегти й опублікувати' }).click()
  await expect.poll(() => saved).not.toBeNull()
  expect(saved).toMatchObject({
    published: true,
    expected_revision: 0,
    capability_id: 'routes.optimize',
    display_name: 'Оптимізатор маршрутів',
    description: 'Розрахунок маршрутів доставки',
    category: 'Optimization',
    slug: 'delivery-routes',
  })
  await expect(card.getByRole('heading', { name: /Редагування плагіна/ })).toHaveCount(0)
  await expect(card.getByText('Опубліковано', { exact: true })).toBeVisible()
  await expect(card.getByRole('link', { name: /Переглянути сторінку/ })).toHaveAttribute(
    'href',
    '/uk/plugins/delivery-routes'
  )
  await expect(card.getByText('Версія: 1.0.0')).toBeVisible()
})

test('375px admin editor has no horizontal overflow and hides the singleton SDK capability selector', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.context().clearCookies()
  await page.context().addCookies(oidcTestCookies(['observatory_admin']))
  await page.route('**/api/observatory/admin/plugins', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        plugins: [
          {
            name: 'mobile-secretary',
            plugin_id: 'secretary',
            source: 'remote',
            version: '0.1.0',
            description: 'A planning plugin for a personal assistant',
            enabled: true,
            capabilities: ['secretary.plan'],
            published: false,
            published_version: null,
            capability_id: 'secretary.plan',
            slug: 'secretary',
            revision: 0,
            ui: { label: 'Yara — Decision Assistant', category: 'Productivity' },
          },
        ],
      }),
    })
  })

  await page.goto('http://observatory.localhost:3000/uk/admin/plugins')
  const card = page.locator('article').filter({ hasText: 'Yara — Decision Assistant' })
  await card.getByRole('button', { name: 'Редагувати' }).click()
  await expect(card.getByRole('combobox', { name: 'Можливість SDK' })).toHaveCount(0)

  for (const control of [
    card.getByRole('textbox', { name: 'Назва' }),
    card.getByRole('textbox', { name: 'Коротка адреса (URL)' }),
    card.getByRole('textbox', { name: 'Опис' }),
    card.getByRole('combobox', { name: 'Категорія' }),
    card.getByRole('button', { name: 'Зберегти й опублікувати' }),
  ]) {
    await expect(control).toBeVisible()
    const rect = await control.boundingBox()
    expect(rect).not.toBeNull()
    expect(rect!.x).toBeGreaterThanOrEqual(0)
    expect(rect!.x + rect!.width).toBeLessThanOrEqual(375)
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

for (const [viewport, width, height] of [
  ['desktop', 1440, 900],
  ['mobile-portrait', 390, 844],
  ['mobile-landscape', 844, 390],
] as const) {
  test(`Yara admin catalog name and responsive layout — ${viewport}`, async ({ page }, testInfo) => {
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
              name: 'remote-04e7c87d7b72111c-secretary',
              plugin_id: 'secretary',
              source: 'remote',
              version: '0.1.0',
              enabled: true,
              description: 'Decision-aware planning of commitments',
              capabilities: ['secretary.plan'],
              published: true,
              published_version: '0.1.0',
              capability_id: 'secretary.plan',
              slug: 'secretary',
              revision: 3,
              ui: { label: 'VHV — Decision Assistant', category: 'Productivity' },
            },
          ],
        }),
      })
    })
    await page.goto('http://observatory.localhost:3000/uk/admin/plugins')
    const card = page.locator('article').filter({ hasText: 'Yara — планування справ і часу' })
    await expect(card.getByRole('heading', { name: 'Yara — планування справ і часу' })).toBeVisible()
    await expect(page.getByText('VHV — Decision Assistant')).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    if (viewport === 'mobile-portrait') {
      const version = await card.getByText('Версія: 0.1.0').boundingBox()
      const publication = await card.getByText('Опубліковано', { exact: true }).boundingBox()
      expect(version).not.toBeNull()
      expect(publication).not.toBeNull()
      expect(publication!.y - version!.y).toBeLessThan(120)
    }
    await page.screenshot({
      path: testInfo.outputPath(`yara-${viewport}.png`),
      fullPage: true,
    })
  })
}

for (const [viewport, width, height] of [
  ['desktop', 1440, 900],
  ['mobile-portrait', 390, 844],
  ['mobile-landscape', 844, 390],
] as const) {
  test(`Yara explicit Worker approval contract and responsive admin — ${viewport}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height })
    await page.context().clearCookies()
    await page.context().addCookies(oidcTestCookies(['observatory_admin']))
    const worker = {
      name: 'remote-3b25f5ae494aa7bf-secretary',
      plugin_id: 'secretary',
      source: 'remote',
      version: '0.1.0',
      description: 'Decision-aware planning of commitments',
      enabled: true,
      capabilities: ['secretary.plan'],
      published: false,
      published_version: null,
      capability_id: 'secretary.plan',
      slug: 'yara',
      revision: 1,
      ui: { label: 'VHV — Decision Assistant', category: 'Productivity' },
    }
    await page.route('**/api/observatory/admin/plugins', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ plugins: [worker] }) })
    })
    let reviewed: Record<string, unknown> | null = null
    await page.route(
      '**/api/observatory/admin/plugins/remote-3b25f5ae494aa7bf-secretary/security/approve',
      async (route) => {
        reviewed = route.request().postDataJSON() as Record<string, unknown>
        worker.revision = 2
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            name: worker.name,
            revision: 2,
            security: { state: 'approved' },
            published: false,
          }),
        })
      }
    )
    await page.goto('http://observatory.localhost:3000/uk/admin/plugins')
    const card = page.locator('article').filter({ hasText: 'Yara — планування справ і часу' })
    await card.getByRole('button', { name: 'Редагувати' }).click()
    await expect(card.getByRole('textbox', { name: 'Назва' })).toHaveValue('Yara — Decision Assistant')
    await expect(card.getByRole('textbox', { name: 'Коротка адреса (URL)' })).toHaveValue('yara')
    const approve = card.getByRole('button', { name: 'Схвалити Worker' })
    await expect(approve).toBeDisabled()
    await card.getByLabel('Посилання на перевірку (review reference)').fill('QDIP-YARA-REVIEW-20261101')
    await card
      .getByLabel('Причина схвалення та результат перевірки')
      .fill('Verified the exact first-party Worker manifest and accepted the reviewed admission risk.')
    await expect(approve).toBeDisabled()
    const riskCheckbox = card.getByRole('checkbox', { name: /усвідомлено приймаю ризик допуску/ })
    const riskText = riskCheckbox.locator('xpath=following-sibling::span')
    const checkboxBox = await riskCheckbox.boundingBox()
    const textBox = await riskText.boundingBox()
    expect(checkboxBox).not.toBeNull()
    expect(textBox).not.toBeNull()
    expect(checkboxBox!.height).toBeLessThanOrEqual(24)
    expect(textBox!.x).toBeGreaterThanOrEqual(checkboxBox!.x + checkboxBox!.width + 8)
    expect(Math.abs(textBox!.y - checkboxBox!.y)).toBeLessThanOrEqual(10)
    await riskCheckbox.check()
    await expect(approve).toBeEnabled()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    const rect = await approve.boundingBox()
    expect(rect).not.toBeNull()
    expect(rect!.x).toBeGreaterThanOrEqual(0)
    expect(rect!.x + rect!.width).toBeLessThanOrEqual(width)
    await page.screenshot({ path: testInfo.outputPath(`yara-approval-${viewport}.png`), fullPage: true })
    await approve.click()
    await expect.poll(() => reviewed).not.toBeNull()
    expect(reviewed).toMatchObject({
      expected_revision: 1,
      plugin_version: '0.1.0',
      review_reference: 'QDIP-YARA-REVIEW-20261101',
      risk_acknowledged: true,
    })
    await expect(card.getByText(/Security approval підтверджено Core/)).toBeVisible()
    await expect(card.getByText('Не опубліковано', { exact: true })).toBeVisible()
  })
}
