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
    published: null,
    published_version: null,
    capability_id: null,
    revision: 0,
  }
  await page.route('**/api/observatory/admin/plugins', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ plugins: [plugin] }) })
  })
  let saved: Record<string, unknown> | null = null
  await page.route('**/api/observatory/admin/plugins/route-optimizer', async (route) => {
    saved = route.request().postDataJSON() as Record<string, unknown>
    plugin.published = true as never
    plugin.published_version = '1.0.0' as never
    plugin.revision = 1
    ;(plugin as typeof plugin & { slug?: string }).slug = 'delivery-routes'
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
  await expect(card.getByText('Опубліковано')).toBeVisible()
  await expect(card.getByRole('link', { name: /Переглянути сторінку/ }))
    .toHaveAttribute('href', '/uk/plugins/delivery-routes')
  await expect(page.getByText('Стандартна сторінка каталогу')).toBeVisible()
})
