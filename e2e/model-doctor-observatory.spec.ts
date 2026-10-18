import { expect, test } from '@playwright/test'

const translations = {
  en: { launch: 'Open Doctor', access: 'Separate protected sign-in' },
  uk: { launch: 'Відкрити Doctor', access: 'Окремий захищений вхід' },
  pl: { launch: 'Otwórz Doctor', access: 'Osobne zabezpieczone logowanie' },
} as const

for (const locale of ['en', 'uk', 'pl'] as const) {
  test(`Doctor is discoverable and opens the correct isolated app for ${locale}`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    const response = await page.goto(`http://observatory.localhost:3000/${locale}/model-doctor`)
    expect(response?.status()).toBe(200)
    await expect(page.getByRole('heading', { name: 'Model Doctor', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: translations[locale].access })).toBeVisible()

    const launch = page.getByRole('link', { name: translations[locale].launch })
    await expect(launch).toHaveAttribute('href', `https://doctor.qdip.ai/${locale}`)
    await expect(launch).toHaveAttribute('target', '_blank')
    await expect(launch).toHaveAttribute('rel', /noopener.*noreferrer/)
    await expect(page.getByRole('link', { name: 'Model Doctor', exact: true }).first()).toHaveAttribute(
      'aria-current',
      'page'
    )
    expect(errors).toEqual([])

    await page.goto(`http://observatory.localhost:3000/${locale}`)
    const card = page.locator('[data-use-case="model-doctor"]')
    await expect(card).toBeVisible()
    await expect(card).toHaveAttribute('href', `/${locale}/model-doctor`)
  })
}

test('Doctor locale switch keeps the Observatory landing route', async ({ page }) => {
  await page.goto('http://observatory.localhost:3000/en/model-doctor')
  await page.locator('a[data-locale="uk"]').click()
  await expect(page).toHaveURL(/\/uk\/model-doctor$/)
  await expect(page.getByRole('link', { name: 'Відкрити Doctor' })).toHaveAttribute(
    'href',
    'https://doctor.qdip.ai/uk'
  )
})
