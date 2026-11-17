import { expect, test, type Page } from '@playwright/test'

async function downloadAndReimportExact(page: Page) {
  const workspace = page.getByTestId('analyst-data-workspace').first()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    workspace.getByRole('button', { name: 'Завантажити точний шаблон' }).click(),
  ])
  const path = await download.path()
  expect(path).toBeTruthy()
  await workspace.locator('input[type="file"]').nth(1).setInputFiles(path!)
  await expect(workspace.locator('[role="alert"]')).toHaveCount(0)
}

test('contractor exact template can be re-imported and executed', async ({ page }) => {
  await page.goto('http://observatory.localhost:3000/uk/contractor-allocation', { waitUntil: 'domcontentloaded' })
  await downloadAndReimportExact(page)
  await expect(page.getByText('EXACT INPUT', { exact: true })).toBeVisible()
  await page.locator('main button.bg-sky-400').first().click()
  await expect(page.getByText(/Статус моделі|QDIP/i).first()).toBeVisible()
})

test('supply exact template can be re-imported and run without falling back to demo data', async ({ page }) => {
  let optimizedExactNetwork = false
  await page.route('**/api/supply-network/run', async (route) => {
    const request = route.request()
    const body = request.postDataJSON() as { action?: string; network?: { warehouses?: unknown[] } }
    expect(body.action).toBe('optimize')
    expect(body.network?.warehouses?.length).toBeGreaterThan(0)
    optimizedExactNetwork = true
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        result: {
          kpis: {
            service_level: 0.987,
            unserved_demand_units: 12,
            objective_value: 1234,
            business_loss: 56,
          },
          solver_status: 'OPTIMAL',
        },
      }),
    })
  })

  await page.goto('http://observatory.localhost:3000/uk/supply-network-optimization', {
    waitUntil: 'domcontentloaded',
  })
  await downloadAndReimportExact(page)
  await page.getByRole('button', { name: 'Запустити точну мережу' }).click()
  await expect(page.getByTestId('supply-exact-result')).toBeVisible({ timeout: 20_000 })
  expect(optimizedExactNetwork).toBe(true)
})
