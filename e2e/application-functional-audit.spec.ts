import { expect, test } from '@playwright/test'

const applications = [
  '/uk/resource-allocation',
  '/uk/supply-network-optimization',
  '/uk/contractor-allocation',
  '/uk/gtm-lab',
] as const

test.describe('application-wide analyst context contract', () => {
  for (const path of applications) {
    test(`${path} explains the decision scenario before analysis`, async ({ page }) => {
      const response = await page.goto(`http://observatory.localhost:3000${path}`, { waitUntil: 'domcontentloaded' })
      expect(response?.status()).toBeLessThan(400)
      await expect(page.getByTestId('scenario-context').first()).toBeVisible()
    })
  }

  for (const path of ['/uk/contractor-allocation', '/uk/supply-network-optimization'] as const) {
    test(`${path} exposes smart and exact analyst data modes`, async ({ page }) => {
      const response = await page.goto(`http://observatory.localhost:3000${path}`, { waitUntil: 'domcontentloaded' })
      expect(response?.status()).toBeLessThan(400)
      const workspace = page.getByTestId('analyst-data-workspace').first()
      await expect(workspace).toBeVisible()
      await expect(workspace.locator('input[type="file"]')).toHaveCount(2)
    })
  }

  test('contractor capacity-loss mode does not expose company-specific naming', async ({ page }) => {
    await page.goto('http://observatory.localhost:3000/uk/contractor-allocation', { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'Кейс 2022: втрата потужності підрядника' }).click()
    await expect(page.getByText(/Eversource/i)).toHaveCount(0)
    await expect(page.getByText(/266 миль повернуто на торги/i)).toBeVisible()
  })
})
