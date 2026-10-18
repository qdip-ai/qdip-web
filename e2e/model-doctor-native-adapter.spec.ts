import { expect, test } from '@playwright/test'

const origin = 'http://observatory.localhost:3000'
const cors = {
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Methods': 'GET, POST',
  'Access-Control-Allow-Headers': 'content-type',
  'Cache-Control': 'no-store',
}

async function mockDoctor(page: import('@playwright/test').Page, authenticated: boolean) {
  await page.route('https://doctor.qdip.ai/api/observatory/**', async (route) => {
    const request = route.request()
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: cors, body: '' })
      return
    }
    if (request.url().endsWith('/session')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: cors,
        body: JSON.stringify({ authenticated, web_auth_configured: true }),
      })
      return
    }
    if (!authenticated) {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        headers: cors,
        body: JSON.stringify({ error: 'authentication_required' }),
      })
      return
    }
    const payload = request.postDataJSON()
    expect(payload.operation).toBe('diagnose')
    expect(payload.model_base64).toBe('AQID')
    expect(payload.time_limit_seconds).toBe(2)
    expect(request.headers()['cookie']).toBeUndefined()
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: cors,
      body: JSON.stringify({
        contract_version: 'doctor.native-cpsat.v0.1',
        operation: 'diagnose',
        execution_status: 'COMPLETED',
        solver_status: 'INFEASIBLE',
        model_wire_sha256: 'a'.repeat(64),
        diagnosis: { kind: 'VERIFIED_SUFFICIENT_ASSUMPTION_CORE', assumption_core: [{ literal: 1 }, { literal: 2 }] },
        repair: { kind: 'NOT_APPLICABLE', proposals: [] },
        solution: null,
      }),
    })
  })
}

test('Model Doctor adapter stays unauthorized until Doctor session is verified', async ({ page }) => {
  await mockDoctor(page, false)
  await page.goto(origin + '/uk/model-doctor')
  await expect(page.getByText('Увійдіть у Doctor через Zitadel')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Увійти в Doctor' })).toHaveAttribute(
    'href',
    'https://doctor.qdip.ai/auth/login?lang=uk'
  )
  await page.locator('[data-testid="doctor-file"]').setInputFiles({
    name: 'native.cpmodel',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from([1, 2, 3]),
  })
  await expect(page.getByRole('button', { name: 'Виконати в Doctor' })).toBeDisabled()
})

test('Doctor works inside Observatory using a pre-existing Doctor session', async ({ page }) => {
  await mockDoctor(page, true)
  await page.goto(origin + '/uk/model-doctor')
  await expect(page.getByText('Сесія Doctor активна')).toBeVisible()
  await page.locator('[data-testid="doctor-file"]').setInputFiles({
    name: 'native.cpmodel',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from([1, 2, 3]),
  })
  await page.getByRole('button', { name: 'Виконати в Doctor' }).click()
  const output = page.locator('[data-testid="doctor-result"]')
  await expect(output.getByText('INFEASIBLE')).toBeVisible()
  await expect(output.getByText('VERIFIED_SUFFICIENT_ASSUMPTION_CORE')).toBeVisible()
  await expect(output.getByText('a'.repeat(64))).toBeVisible()
})

test('Doctor adapter rejects oversized files before upload', async ({ page }) => {
  await mockDoctor(page, true)
  await page.goto(origin + '/en/model-doctor')
  await expect(page.getByText('Doctor session is active')).toBeVisible()
  await page.locator('[data-testid="doctor-file"]').setInputFiles({
    name: 'huge.cpmodel',
    mimeType: 'application/octet-stream',
    buffer: Buffer.alloc(262145, 1),
  })
  await expect(page.getByRole('alert')).toContainText('256 KB')
  await expect(page.getByRole('button', { name: 'Run in Doctor' })).toBeDisabled()
})
