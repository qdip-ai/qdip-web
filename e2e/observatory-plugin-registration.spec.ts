import { expect, test } from '@playwright/test'
import { oidcTestCookies } from './oidc-test-session'

test('admin edits SDK-registered plugin directly inside its card and closes the form after publishing', async ({ page }) => {
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
    capability_id: null as string | null,
    revision: 0,
  }
  await page.route('**/api/observatory/admin/plugins', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ plugins: [plugin] }) })
  })
  let saved: Record<string, unknown> | null = null
  await page.route('**/api/observatory/admin/plugins/route-optimizer', async (route) => {
    saved = route.request().postDataJSON() as Record<string, unknown>
    plugin.ui.label = String(saved.display_name)
    plugin.description = String(saved.description)
    plugin.ui.category = String(saved.category)
    plugin.capability_id = String(saved.capability_id)
    plugin.published = true
    plugin.published_version = plugin.version
    plugin.revision += 1
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  })
  await page.goto('http://observatory.localhost:3000/uk/admin/plugins')
  const card = page.locator('article').first()
  await expect(card).toBeVisible()
  await expect(page.getByLabel('Назва')).toHaveCount(0)

  const editButton = card.getByRole('button', { name: 'Редагувати' })
  await editButton.click()
  const editor = card.getByRole('region', { name: /Редагування плагіна/ })
  await expect(editor).toBeVisible()
  await expect(editor.getByLabel('Назва')).toBeFocused()
  const buttonBox = await card.getByRole('button', { name: 'Згорнути' }).boundingBox()
  const formBox = await editor.boundingBox()
  expect(buttonBox).not.toBeNull()
  expect(formBox).not.toBeNull()
  expect(formBox!.y).toBeGreaterThan(buttonBox!.y)

  await editor.getByLabel('Назва').fill('Оптимізатор маршрутів')
  await editor.getByLabel('Опис').fill('Розрахунок маршрутів доставки')
  await editor.getByLabel('Категорія').selectOption('Optimization')
  await editor.getByRole('button', { name: 'Зберегти й опублікувати' }).click()
  await expect.poll(() => saved).not.toBeNull()
  expect(saved).toMatchObject({
    published: true,
    expected_revision: 0,
    capability_id: 'routes.optimize',
    display_name: 'Оптимізатор маршрутів',
    description: 'Розрахунок маршрутів доставки',
    category: 'Optimization',
  })
  await expect(card.locator('form')).toHaveCount(0)
  await expect(card.getByRole('status')).toContainText('Зміни збережено')
  await expect(card.getByText('Опубліковано', { exact: true })).toBeVisible()
  await expect(card.getByText('Стандартна сторінка каталогу')).toBeVisible()
})

test('editor switches between cards and preserves edits if publication fails', async ({ page }) => {
  await page.context().clearCookies()
  await page.context().addCookies(oidcTestCookies(['observatory_admin']))
  const base = {
    version: '1.0.0',
    enabled: true,
    description: '',
    capabilities: ['routes.optimize'],
    ui: { category: 'Operations' },
    published: null,
    published_version: null,
    capability_id: null,
    revision: 0,
  }
  await page.route('**/api/observatory/admin/plugins', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        plugins: [
          { ...base, name: 'alpha-plugin', ui: { ...base.ui, label: 'Alpha' } },
          { ...base, name: 'beta-plugin', ui: { ...base.ui, label: 'Beta' } },
        ],
      }),
    })
  })
  await page.route('**/api/observatory/admin/plugins/beta-plugin', async (route) => {
    await route.fulfill({ status: 500, contentType: 'application/json', body: '{}' })
  })
  await page.goto('http://observatory.localhost:3000/uk/admin/plugins')
  const alpha = page.locator('article').filter({ has: page.getByRole('heading', { name: 'Alpha' }) })
  const beta = page.locator('article').filter({ has: page.getByRole('heading', { name: 'Beta' }) })
  await alpha.getByRole('button', { name: 'Редагувати' }).click()
  await expect(alpha.getByLabel('Назва')).toBeVisible()
  await beta.getByRole('button', { name: 'Редагувати' }).click()
  await expect(alpha.locator('form')).toHaveCount(0)
  await expect(beta.getByLabel('Назва')).toHaveValue('Beta')
  await beta.getByLabel('Назва').fill('Beta Updated')
  await beta.getByRole('button', { name: 'Зберегти й опублікувати' }).click()
  await expect(beta.getByRole('alert')).toContainText('Не вдалося зберегти')
  await expect(beta.getByLabel('Назва')).toHaveValue('Beta Updated')
  await beta.getByRole('button', { name: 'Скасувати' }).click()
  await expect(beta.locator('form')).toHaveCount(0)
})
