import { expect, test } from '@playwright/test'

const applications = [
  '/uk/resource-allocation',
  '/uk/supply-network-optimization',
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

  for (const path of ['/uk/supply-network-optimization'] as const) {
    test(`${path} exposes smart and exact analyst data modes`, async ({ page }) => {
      const response = await page.goto(`http://observatory.localhost:3000${path}`, { waitUntil: 'domcontentloaded' })
      expect(response?.status()).toBeLessThan(400)
      const workspace = page.getByTestId('analyst-data-workspace').first()
      await expect(workspace).toBeVisible()
      await expect(workspace.locator('input[type="file"]')).toHaveCount(2)
    })
  }

  test('readiness-recovery exposes the Kernel-only operator, never a second optimizer', async ({ page }) => {
    const response = await page.goto('http://observatory.localhost:3000/uk/readiness-recovery', {
      waitUntil: 'domcontentloaded',
    })
    expect(response?.status()).toBeLessThan(400)
    await expect(page.getByTestId('rr-kernel-only-workspace')).toBeVisible()
    await expect(page.getByTestId('rr-kernel-unavailable')).toBeVisible()
    await expect(page.getByTestId('analyst-data-workspace')).toHaveCount(0)
    const oldSolver = await page.request.post('http://observatory.localhost:3000/readiness/scenarios', {
      data: { input: {} },
    })
    expect(oldSolver.status()).toBe(410)
  })

})
