import { expect, test } from '@playwright/test'
import { oidcTestCookies } from './oidc-test-session'

// APP-PUBLISH-01 (#705): an application published in Core is listed with its
// external launch URL; one that Core does not admit is never listed. RR is not
// hosted by QDIP Web any more.
test.describe('independent application publication', () => {
  test('public catalog lists only the admitted application with an external launch', async ({ page }) => {
    await page.goto('http://observatory.localhost:3000/uk/plugins')
    const section = page.getByTestId('published-applications')
    await expect(section).toBeVisible()
    const launch = section.getByRole('link', { name: 'Відкрити Readiness Recovery' })
    await expect(launch).toHaveAttribute('href', 'https://rr.qdip.ai')
    await expect(launch).toHaveAttribute('target', '_blank')
    await expect(launch).toHaveAttribute('rel', 'noopener noreferrer')
    await expect(section.getByText('blocked-app')).toHaveCount(0)
    await launch.scrollIntoViewIfNeeded()
    const box = await launch.boundingBox()
    const viewport = page.viewportSize()
    expect(box && viewport && box.x >= 0 && box.x + box.width <= viewport.width).toBe(true)
  })

  test('admin sees status, admission reasons and lifecycle controls', async ({ page }) => {
    await page.context().clearCookies()
    await page.context().addCookies(oidcTestCookies(['observatory_admin']))
    await page.goto('http://observatory.localhost:3000/en/admin/applications')
    const list = page.getByTestId('independent-applications')
    await expect(list).toBeVisible()
    const rr = list.locator('li', { hasText: 'readiness-recovery' })
    await expect(rr.getByText('Visible in catalog')).toBeVisible()
    await expect(rr.getByRole('button', { name: 'Publish', exact: true })).toBeDisabled()
    await expect(rr.getByRole('button', { name: 'Unpublish', exact: true })).toBeEnabled()
    const blocked = list.locator('li', { hasText: 'blocked-app' })
    await expect(blocked.getByText('Publication blocked')).toBeVisible()
    await expect(blocked.getByRole('status')).toHaveText('RUNTIME_UNAVAILABLE')
    await expect(blocked.getByRole('button', { name: 'Publish', exact: true })).toBeDisabled()
  })

  test('RR is no longer an Observatory route', async ({ page }) => {
    const response = await page.goto('http://observatory.localhost:3000/uk/readiness-recovery')
    expect(response?.status()).toBe(404)
  })
})
