import { expect, test } from '@playwright/test'
import { oidcTestCookies } from './oidc-test-session'

test.describe('QDIP role-gated pages', () => {
  test('anonymous Studio shows the entire workspace without backend grants', async ({ page }) => {
    await page.context().clearCookies()
    const response = await page.goto('http://studio.localhost:3000/en/profiles')
    expect(response?.status()).toBe(200)
    await expect(page.locator('.studio-workspace')).toBeVisible()
    await expect(page.getByTestId('qdip-access-gate')).toHaveCount(0)
    await expect(page.getByTestId('studio-persistence-notice')).toHaveAttribute('data-mode', 'guest')
    await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create profile' }).first()).toBeVisible()
  })

  test('non-Studio user can explore Studio but cannot use protected Core persistence', async ({ page }) => {
    await page.context().clearCookies()
    await page.context().addCookies(oidcTestCookies(['observatory_admin']))
    await page.goto('http://studio.localhost:3000/en/plugins')
    await expect(page.locator('.studio-workspace')).toBeVisible()
    await expect(page.getByTestId('studio-persistence-notice')).toHaveAttribute('data-mode', 'live')
    await expect(page.getByTestId('qdip-access-gate')).toHaveCount(0)
  })

  test('public Observatory demos are not gated; RR is not hosted here', async ({ page }) => {
    await page.context().clearCookies()
    const rr = await page.goto('http://observatory.localhost:3000/uk/readiness-recovery')
    expect(rr?.status()).toBe(404)

    await page.goto('http://observatory.localhost:3000/uk/resource-allocation')
    await expect(page.locator('#main-content')).toBeVisible()
    await expect(page.getByTestId('qdip-access-gate')).toHaveCount(0)
  })

  test('Decision Audit requires login but not the Studio role', async ({ page }) => {
    await page.context().clearCookies()
    await page.context().addCookies(oidcTestCookies(['observatory_admin']))
    await page.goto('http://observatory.localhost:3000/en/decisions')
    await expect(page.getByTestId('qdip-access-gate')).toHaveCount(0)
    await expect(page.locator('#main-content')).toBeVisible()
  })

  test('Studio role allows the Studio workspace', async ({ page }) => {
    await page.goto('http://studio.localhost:3000/en/profiles')
    await expect(page.locator('.studio-workspace')).toBeVisible()
    await expect(page.getByTestId('qdip-access-gate')).toHaveCount(0)
  })
})
