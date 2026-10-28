import { expect, test } from '@playwright/test'

const heroCta = {
  en: 'See QDIP in action',
  uk: 'Подивитися QDIP у дії',
  pl: 'Zobacz QDIP w działaniu',
} as const

const demoNames = {
  en: ['Resource Allocation', 'Supply Network Optimization', 'GTM Lab'],
  uk: ['Розподіл ресурсів', 'Оптимізація мережі постачання', 'Лабораторія виходу на ринок'],
  pl: ['Alokacja zasobów', 'Optymalizacja sieci dostaw', 'Laboratorium wejścia na rynek'],
} as const

const proofArtifacts = {
  en: ['Audit trace', 'Baseline comparison', 'Deterministic replay'],
  uk: ['Аудит рішення', 'Порівняння з базовим сценарієм', 'Детерміноване відтворення'],
  pl: ['Ślad audytowy decyzji', 'Porównanie ze scenariuszem bazowym', 'Deterministyczne odtworzenie'],
} as const

const applicationNames = {
  en: { challenge: 'Decision Challenge', intake: 'Decision Intake' },
  uk: { challenge: 'Виклик рішень', intake: 'Підготовка рішення' },
  pl: { challenge: 'Wyzwanie decyzyjne', intake: 'Przygotowanie decyzji' },
} as const

const legacyAllocationPreview = {
  en: 'Recommended allocation plan',
  uk: 'Рекомендований план розподілу',
  pl: 'Rekomendowany plan alokacji',
} as const

const studioUi = {
  en: { heading: 'Decision Workspace', decisions: 'Decisions' },
  uk: { heading: 'Робочий простір рішень', decisions: 'Рішення' },
  pl: { heading: 'Przestrzeń decyzji', decisions: 'Decyzje' },
} as const

const footerDisclaimer = {
  en: 'Your team makes the final decision.',
  uk: 'Остаточне рішення приймає ваша команда.',
  pl: 'Ostateczną decyzję podejmuje Twój zespół.',
} as const

const locales = ['en', 'uk', 'pl'] as const

test.describe('P1 marketing conversion gate', () => {
  for (const locale of locales) {
    test(`${locale} hero CTA opens localized Observatory directly`, async ({ page }) => {
      const response = await page.goto(`http://qdip.localhost:3000/${locale}`)
      expect(response?.status()).toBeLessThan(400)

      await expect(page.getByRole('link', { name: heroCta[locale] })).toHaveAttribute(
        'href',
        `https://observatory.qdip.ai/${locale}`
      )

      const proof = page.locator('#why')
      await expect(proof.locator('article')).toHaveCount(3)
      for (const artifact of proofArtifacts[locale]) {
        await expect(proof.getByText(artifact, { exact: true })).toBeVisible()
      }
    })
  }
})

test.describe('P1 Observatory consistency gate', () => {
  for (const locale of locales) {
    test(`${locale} exposes canonical applications without a domain-specific homepage preview`, async ({ page }) => {
      const response = await page.goto(`http://observatory.localhost:3000/${locale}`)
      expect(response?.status()).toBeLessThan(400)

      for (const name of demoNames[locale]) {
        await expect(page.getByRole('heading', { level: 3, name })).toBeVisible()
      }

      await expect(page.getByRole('heading', { level: 3, name: applicationNames[locale].challenge })).toBeVisible()
      await expect(page.getByRole('heading', { level: 3, name: applicationNames[locale].intake })).toHaveCount(0)
      await expect(page.locator('[data-use-case="resource-allocation"]')).toBeVisible()
      await expect(page.getByText(legacyAllocationPreview[locale], { exact: true })).toHaveCount(0)

      const footer = page.getByTestId('observatory-footer')
      await expect(footer).toBeVisible()
      await expect(footer.getByRole('navigation')).toHaveCount(0)
      await expect(footer.getByText(footerDisclaimer[locale], { exact: true })).toBeVisible()
      await expect(footer.getByText(/© \d{4} QDIP/)).toBeVisible()
    })
  }
})

test('P1 Observatory mobile navigation aligns with the content grid', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const response = await page.goto('http://observatory.localhost:3000/en/gtm-lab')
  expect(response?.status()).toBeLessThan(400)

  const menuSummary = page.locator('.ds-product-mobile-navigation summary')
  const mobileLocale = page.getByRole('group', { name: 'Language' })
  const breadcrumbHome = page.locator('[aria-label="Breadcrumb"]').getByRole('link', { name: 'QDIP home' })

  await expect(menuSummary).toBeVisible()
  await expect(mobileLocale).toBeVisible()
  const localeBox = await mobileLocale.boundingBox()
  expect(localeBox).not.toBeNull()
  expect(localeBox?.height).toBeGreaterThanOrEqual(44)
  await expect(breadcrumbHome).toBeVisible()

  const menuBox = await menuSummary.boundingBox()
  const homeBox = await breadcrumbHome.boundingBox()
  expect(menuBox).not.toBeNull()
  expect(homeBox).not.toBeNull()
  expect(Math.abs((menuBox?.x ?? 0) - (homeBox?.x ?? 0))).toBeLessThanOrEqual(1)
})

test.describe('P1 Studio localization gate', () => {
  for (const locale of locales) {
    test(`${locale} footer uses the active Studio locale`, async ({ page }) => {
      const response = await page.goto(`http://studio.localhost:3000/${locale}`)
      expect(response?.status()).toBeLessThan(400)
      await expect(page).toHaveURL(new RegExp(`/${locale}/profiles$`))

      await expect(page.getByRole('heading', { level: 1, name: studioUi[locale].heading })).toBeVisible()
      await expect(page.getByRole('link', { name: studioUi[locale].decisions }).first()).toBeVisible()

      const footer = page.getByTestId('studio-footer')
      await expect(footer).toBeVisible()
      await expect(footer.getByRole('navigation')).toHaveCount(0)
      await expect(footer.getByText(footerDisclaimer[locale], { exact: true })).toBeVisible()
      await expect(footer.getByText(/© \d{4} QDIP/)).toBeVisible()
    })
  }
})
