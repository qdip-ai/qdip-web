import { expect, test } from '@playwright/test'

const locales = ['en', 'uk', 'pl'] as const
const demos = [
  ['Resource Allocation', '/resource-allocation'],
  ['Supply Network Optimization', '/supply-network-optimization'],
  ['GTM Lab', '/gtm-lab'],
] as const

const openLabels = {
  en: 'Open',
  uk: 'Відкрити',
  pl: 'Otwórz',
} as const

const useCaseLocalization = {
  en: {
    heading: 'One Decision Engine. Reusable decision patterns.',
    body: 'Resource Allocation, Supply Network Optimization and GTM Lab are working applications.',
  },
  uk: {
    heading: 'Один рушій рішень. Багаторазові патерни рішень.',
    body: 'Resource Allocation, Supply Network Optimization і GTM Lab — робочі застосунки.',
  },
  pl: {
    heading: 'Jeden silnik decyzyjny. Wielokrotnego użytku wzorce decyzji.',
    body: 'Resource Allocation, Supply Network Optimization i GTM Lab to działające aplikacje.',
  },
} as const

const heroHeadlines = {
  en: 'Turn uncertainty into decisions',
  uk: 'Перетворюйте невизначеність на рішення',
  pl: 'Przekształcaj niepewność w decyzje',
} as const

const whyLabels = {
  en: 'Why QDIP',
  uk: 'Чому QDIP',
  pl: 'Dlaczego QDIP',
} as const

test.describe('current marketing routing', () => {
  test('marketing header uses an accessible custom icon without visible Sign in text', async ({ page }) => {
    await page.route('**/api/auth/session', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ configured: true, authenticated: false, studio: false, operator: false }),
      })
    )
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('http://qdip.localhost:3000/en')
    const signIn = page.locator('header a[data-qdip-auth="signed-out"]')
    await expect(signIn).toBeVisible()
    await expect(signIn).toHaveAttribute('aria-label', 'Sign in')
    await expect(signIn).toHaveText('')
    await expect(signIn).toHaveAttribute('class', /iconOnly/)
    await expect(signIn).toHaveCSS('min-width', '44px')
    await page.goto('http://qdip.localhost:3000/uk')
    await expect(page.locator('header a[data-qdip-auth="signed-out"]')).toHaveAttribute('aria-label', 'Увійти')
  })

  test('mobile header orders language, sign-in, then menu with no horizontal overflow', async ({ page }) => {
    await page.route('**/api/auth/session', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ configured: true, authenticated: false, studio: false, operator: false }),
      })
    )

    for (const locale of locales) {
      for (const width of [375, 390]) {
        await page.setViewportSize({ width, height: 844 })
        await page.goto(`http://qdip.localhost:3000/${locale}`)

        const language = page.locator('header summary[aria-label]')
        const signIn = page.locator('header [data-qdip-auth="signed-out"]')
        const menu = page.locator('header button[aria-controls="mobile-navigation"]')

        await expect(language).toBeVisible()
        await expect(signIn).toBeVisible()
        await expect(menu).toBeVisible()

        const languageBox = await language.boundingBox()
        const signInBox = await signIn.boundingBox()
        const menuBox = await menu.boundingBox()
        expect(languageBox).not.toBeNull()
        expect(signInBox).not.toBeNull()
        expect(menuBox).not.toBeNull()
        expect(languageBox!.x + languageBox!.width).toBeLessThanOrEqual(signInBox!.x)
        expect(signInBox!.x + signInBox!.width).toBeLessThanOrEqual(menuBox!.x)

        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
        expect(overflow).toBeLessThanOrEqual(1)
      }
    }
  })

  test('all 13 icons stay within a safe optical grid at 76px and 24px', async ({ page, request }) => {
    const response = await request.get('http://qdip.localhost:3000/marketing-icon-gallery.svg')
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('image/svg+xml')

    await page.goto('http://qdip.localhost:3000/marketing-icon-gallery.svg')
    const symbols = page.locator('svg > g[data-icon]')
    await expect(symbols).toHaveCount(13)

    for (const symbol of await symbols.all()) {
      await expect(symbol.locator('clipPath, mask')).toHaveCount(0)
      for (const scale of ['1.1875', '0.375']) {
        const glyph = symbol.locator(`g[transform*="scale(${scale})"]`)
        await expect(glyph).toHaveCount(1)
        const bounds = await glyph.evaluate((node) => {
          const rect = (node as SVGGraphicsElement).getBBox()
          return { left: rect.x, top: rect.y, right: rect.x + rect.width, bottom: rect.y + rect.height }
        })
        // Leave at least 3 units for round caps and anti-aliasing on all sides.
        expect(bounds.left).toBeGreaterThanOrEqual(3)
        expect(bounds.top).toBeGreaterThanOrEqual(3)
        expect(bounds.right).toBeLessThanOrEqual(61)
        expect(bounds.bottom).toBeLessThanOrEqual(61)
      }
    }
  })

  test('marketing network texture stays above the opaque surface on desktop and mobile', async ({ page, request }) => {
    const asset = await request.get('http://qdip.localhost:3000/qdip-network.svg')
    expect(asset.status()).toBe(200)
    expect(asset.headers()['content-type']).toContain('image/svg+xml')

    for (const viewport of [
      { width: 1440, height: 900, locale: 'en' },
      { width: 390, height: 844, locale: 'uk' },
    ]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      const response = await page.goto(`http://qdip.localhost:3000/${viewport.locale}`)
      expect(response?.status()).toBeLessThan(400)

      const layers = await page.locator('#main-content').evaluate((main) => {
        const shell = main.parentElement
        if (!shell) throw new Error('Marketing shell not found')
        const texture = getComputedStyle(shell, '::before')
        return {
          image: texture.backgroundImage,
          position: texture.position,
          opacity: Number(texture.opacity),
          zIndex: Number(texture.zIndex),
          mainZIndex: Number(getComputedStyle(main).zIndex),
          shellIsolation: getComputedStyle(shell).isolation,
        }
      })

      expect(layers.image).toContain('qdip-network.svg')
      expect(layers.position).toBe('fixed')
      expect(layers.opacity).toBeGreaterThan(0)
      expect(layers.shellIsolation).toBe('isolate')
      expect(layers.mainZIndex).toBeGreaterThan(layers.zIndex)
    }
  })

  test('original network artwork replaces hero grid and is visible behind product sections', async ({
    page,
    request,
  }) => {
    const svg = await (await request.get('http://qdip.localhost:3000/qdip-network.svg')).text()
    expect(svg).toContain('<g opacity="0.5">')
    for (const width of [375, 768, 1366]) {
      await page.setViewportSize({ width, height: 850 })
      await page.goto('http://qdip.localhost:3000/en')
      const hero = page.locator('section[class*="engineeredHero"]')
      const pattern = page.locator('section[class*="patternSection"]')
      const heroBackdrop = await hero.evaluate((node) => getComputedStyle(node, '::before').backgroundImage)
      const patternBackdrop = await pattern.evaluate((node) => getComputedStyle(node).backgroundImage)
      expect(heroBackdrop).toContain('qdip-network.svg')
      expect(heroBackdrop).not.toContain('linear-gradient')
      expect(patternBackdrop).toContain('qdip-network.svg')
      await expect(page.getByTestId('marketing-network-motion')).toHaveCount(0)
    }
  })

  test('A4 proportions, concentric replay and integrated verification badges are geometrically consistent', async ({
    page,
  }) => {
    await page.goto('http://qdip.localhost:3000/marketing-icon-gallery.svg')

    for (const key of ['audit', 'human-approval']) {
      const glyph = page.locator(`[data-icon="${key}"] g[transform*="scale(1.1875)"]`)
      await expect(glyph.locator('rect[x="9"][y="7"][width="32"][height="46"]')).toHaveCount(1)
      await expect(glyph.locator('circle[cx="39"][cy="43"]')).toHaveCount(1)
    }
    const evidence = page.locator('[data-icon="evidence"] g[transform*="scale(1.1875)"]')
    await expect(evidence.locator('circle[cx="40"][cy="44"][r="10"]')).toHaveCount(1)

    const replay = page.locator('[data-icon="replay"] g[transform*="scale(1.1875)"]')
    await expect(replay.locator('circle[cx="32"][cy="32"][r="13"]')).toHaveCount(1)
    await expect(replay.locator('path[d*="A24 24"]')).toHaveCount(1)

    const simulation = page.locator('[data-icon="simulation"] g[transform*="scale(1.1875)"]')
    await expect(simulation.locator('circle[cx="26"][cy="32"][r="3"]')).toHaveCount(1)
    await expect(simulation.locator('path[d*="M26 32C35 32 35 18 45 18"]')).toHaveCount(1)

    const constraints = page.locator('[data-icon="constraints"] g[transform*="scale(1.1875)"]')
    await expect(constraints.locator('circle[r="3.5"]')).toHaveCount(3)
    const workflow = page.locator('[data-icon="workflow"] g[transform*="scale(1.1875)"]')
    await expect(workflow.locator('circle[r="3"]')).toHaveCount(3)
  })

  test('allocation displays an actual detailed source feeding three destinations', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('http://qdip.localhost:3000/en')
    const allocation = page.locator('svg[class*="patternIcon"]').first()
    await expect(allocation).toHaveCSS('width', '76px')
    await expect(allocation).toHaveCSS('border-top-width', '0px')
    await expect(allocation.locator('rect')).toHaveCount(3)
    await expect(allocation.locator('ellipse')).toHaveCount(1)
    await expect(allocation.locator('circle')).toHaveCount(1)
    expect(await allocation.locator('path').count()).toBeGreaterThanOrEqual(3)
  })

  test('light-theme decision playground has readable workflow stages and budget labels', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('http://qdip.localhost:3000/en')
    await page.locator('button[class*="menuButton"]').click()
    await page.locator('[data-testid="marketing-theme-toggle"]:visible').click()
    const playground = page.locator('section[aria-labelledby="decision-playground-title"]')
    const stage = playground.locator('[data-expanded]').first()
    await expect(stage).toHaveCSS('background-color', 'rgb(255, 255, 255)')
    await expect(playground.locator('.ds-workflow-step strong').first()).toHaveCSS('color', 'rgb(27, 32, 41)')
    const budget = playground.locator('button[aria-pressed]').first()
    await expect(budget).toHaveCSS('color', 'rgb(27, 32, 41)')
    await budget.click()
    await expect(budget).toHaveAttribute('aria-pressed', 'true')
  })

  test('mobile appearance switch closes navigation and keeps the workbench readable', async ({ page }) => {
    await page.route('**/api/auth/session', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ configured: true, authenticated: false, studio: false, operator: false }),
      })
    )
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('http://qdip.localhost:3000/en')

    const menu = page.locator('header button[aria-controls="mobile-navigation"]')
    const workbench = page.getByTestId('decision-workbench')
    await menu.click()
    await expect(menu).toHaveAttribute('aria-expanded', 'true')
    await page.locator('[data-testid="marketing-theme-toggle"]:visible').click()
    await expect(menu).toHaveAttribute('aria-expanded', 'false')
    await expect(page.locator('#mobile-navigation')).toHaveCount(0)

    await expect(workbench).toHaveCSS('background-color', 'rgb(255, 255, 255)')
    await expect(workbench).toHaveCSS('color', 'rgb(27, 32, 41)')
    await expect(workbench.locator('[class*="pathbar"] li').first()).toHaveCSS('color', 'rgb(61, 72, 88)')
    await expect(workbench.locator('[class*="codeBlock"]').first()).toHaveCSS('background-color', 'rgb(241, 243, 246)')
    await expect(page.locator('header [data-qdip-auth="signed-out"] img')).toHaveCSS('filter', 'brightness(0)')
    const secondaryCta = page.locator('a[class*="secondaryButton"]').first()
    await secondaryCta.hover()
    await expect(secondaryCta).toHaveCSS('color', 'rgb(27, 32, 41)')
    const selectedBudget = workbench.getByRole('button', { name: '€40k' })
    await expect(selectedBudget).toHaveCSS('color', 'rgb(255, 255, 255)')
    await expect(selectedBudget).toHaveCSS('background-color', 'rgb(122, 24, 56)')

    // Repeated switching must not leave either appearance or the menu stale.
    await menu.click()
    await page.locator('[data-testid="marketing-theme-toggle"]:visible').click()
    await expect(menu).toHaveAttribute('aria-expanded', 'false')
    await expect(page.locator('#mobile-navigation')).toHaveCount(0)
    await expect(workbench).toHaveCSS('background-color', 'rgb(32, 35, 42)')
    await expect(workbench).toHaveCSS('color', 'rgb(240, 242, 245)')
  })

  test('homepage uses a readable technical workbench at desktop and mobile widths', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 768, height: 1024 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport)
      await page.goto('http://qdip.localhost:3000/en')
      const hero = page.locator('#main-content > section').first()
      const heading = hero.getByRole('heading', { level: 1 })
      const console = page.getByTestId('decision-workbench')
      await expect(heading).toBeVisible()
      await expect(console).toBeVisible()
      await expect(page.getByTestId('marketing-network-motion')).toHaveCount(0)
      const consoleBox = await console.boundingBox()
      const headingBox = await heading.boundingBox()
      expect(consoleBox).not.toBeNull()
      expect(headingBox).not.toBeNull()
      expect(consoleBox?.y ?? 0).toBeGreaterThan((headingBox?.y ?? 0) + (headingBox?.height ?? 0))
      const consoleWidth = consoleBox?.width ?? 0
      expect(consoleWidth).toBeGreaterThan(Math.min(300, viewport.width * 0.7))
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
      expect(overflow).toBeLessThanOrEqual(1)
    }
  })

  test('neutral burgundy marketing is responsive in EN/UK/PL at 375/768/1366', async ({ page }) => {
    for (const locale of locales) {
      for (const width of [375, 768, 1366]) {
        await page.setViewportSize({ width, height: 900 })
        await page.goto(`http://qdip.localhost:3000/${locale}`)
        const marketing = page.locator('[data-ds-theme="burgundy"][data-ds-mode="dark"]').first()
        await expect(marketing).toHaveCSS('background-color', 'rgb(21, 23, 28)')
        const workbench = page.getByTestId('decision-workbench')
        await expect(workbench).toHaveCSS('background-color', 'rgb(32, 35, 42)')
        const evidenceIcons = page.locator('#why svg[viewBox="0 0 64 64"]')
        await expect(evidenceIcons).toHaveCount(3)
        await expect(evidenceIcons.first()).toHaveCSS('width', '64px')
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
        expect(overflow).toBeLessThanOrEqual(1)
      }
    }
    await page.goto('http://qdip.localhost:3000/en/core')
    // Count the six semantic Core feature icons, not unrelated header/footer SVGs.
    const coreFeatureIcons = page.locator(
      '#main-content section[class*="section"] article svg[class*="techFeatureIcon"]'
    )
    await expect(coreFeatureIcons).toHaveCount(6)
    for (const icon of await coreFeatureIcons.all()) {
      await expect(icon).toHaveAttribute('viewBox', '0 0 64 64')
      await expect(icon).toHaveAttribute('aria-hidden', 'true')
    }
  })

  test('light theme preserves the restrained burgundy CTA and theme choice on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('http://qdip.localhost:3000/en')
    await page.locator('button[class*="menuButton"]').click()
    const toggle = page.locator('[data-testid="marketing-theme-toggle"]:visible')
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')
    await toggle.click()
    await expect(page.locator('header button[aria-controls="mobile-navigation"]')).toHaveAttribute(
      'aria-expanded',
      'false'
    )
    await expect(page.locator('#mobile-navigation')).toHaveCount(0)
    await expect(page.locator('[data-marketing-appearance="light"]')).toHaveCSS(
      'background-color',
      'rgb(245, 246, 248)'
    )
    const evidence = page.locator('#why article').first()
    await expect(evidence).toHaveCSS('background-color', 'rgb(255, 255, 255)')
    const primary = page.locator('a[class*="primaryButtonLarge"]').first()
    // Theme changes can leave the pointer over the CTA after mobile layout shifts.
    // Assert its resting burgundy color, not its intentional hover shade.
    await page.mouse.move(0, 0)
    await expect(primary).toHaveCSS('background-color', 'rgb(122, 24, 56)')
    // Regressions from the light-theme screenshot: no white heading on pale CTA.
    const cta = page.locator('section[class*="finalCta"]')
    await expect(cta).toHaveCSS('background-color', 'rgb(245, 246, 248)')
    await expect(cta.getByRole('heading', { level: 2 })).toHaveCSS('color', 'rgb(27, 32, 41)')
    // The marketing footer follows the chosen appearance, including its logo and links.
    const footer = page.locator('footer[data-variant="marketing"]')
    await expect(footer).toHaveCSS('background-color', 'rgb(245, 246, 248)')
    await expect(footer).toHaveCSS('color', 'rgb(27, 32, 41)')
    await expect(footer.locator('img').first()).toHaveCSS('filter', 'none')
    await expect(footer.locator('nav a').first()).toHaveCSS('color', 'rgb(82, 92, 106)')
    await page.reload()
    await expect(page.locator('[data-marketing-appearance="light"]')).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
    expect(overflow).toBeLessThanOrEqual(1)
  })

  test('light-theme footer follows appearance on public pages', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('http://qdip.localhost:3000/en')
    await page.locator('button[class*="menuButton"]').click()
    await page.locator('[data-testid="marketing-theme-toggle"]:visible').click()
    await page.goto('http://qdip.localhost:3000/en/decision')
    const footer = page.locator('footer[class*="footer"]').last()
    await expect(footer).toHaveCSS('background-color', 'rgb(245, 246, 248)')
    await expect(footer).toHaveCSS('color', 'rgb(27, 32, 41)')
    await expect(footer.locator('nav a').first()).toHaveCSS('color', 'rgb(82, 92, 106)')
  })

  test('workbench budget changes recommendation and respects reduced motion', async ({ page }) => {
    await page.goto('http://qdip.localhost:3000/en')
    const console = page.getByTestId('decision-workbench')
    const low = console.getByRole('button', { name: '€40k' })
    const high = console.getByRole('button', { name: '€70k' })
    await expect(low).toHaveAttribute('aria-pressed', 'true')
    await expect(console.getByText('Fund 5 highest-priority requests')).toBeVisible()
    await high.click()
    await expect(high).toHaveAttribute('aria-pressed', 'true')
    await expect(low).toHaveAttribute('aria-pressed', 'false')
    await expect(console.getByText('Fund 8 highest-priority requests')).toBeVisible()
    const outcome = console.locator('strong[class*="outcome"]')
    await expect(outcome).toHaveCSS('animation-name', /qdip-console-result/)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await expect(outcome).toHaveCSS('animation-name', 'none')
    await expect(console.getByText('Example data, not a live QDIP execution')).toBeVisible()
  })

  test('marketing CTA remains below hero copy and reduced motion is respected', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('http://qdip.localhost:3000/en')
    const hero = page.locator('#main-content > section').first()
    const heading = hero.getByRole('heading', { level: 1 })
    const primary = hero.locator('a[class*="primaryButtonLarge"]').first()
    await expect(heading).toBeVisible()
    await expect(primary).toBeVisible()
    await expect(primary).toHaveCSS('animation-name', /qdip-cta-arrive/)
    const headingRect = await heading.boundingBox()
    const primaryRect = await primary.boundingBox()
    const headingBottom = (headingRect?.y ?? 0) + (headingRect?.height ?? 0)
    expect(primaryRect?.y ?? 0).toBeGreaterThan(headingBottom)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await expect(primary).toHaveCSS('animation-name', 'none')
  })

  for (const locale of locales) {
    test(`${locale} homepage keeps buyer navigation and headline semantics intact`, async ({ page }) => {
      const response = await page.goto(`http://qdip.localhost:3000/${locale}`)
      expect(response?.status()).toBeLessThan(400)

      await expect(page.getByRole('heading', { level: 1, name: heroHeadlines[locale] })).toBeVisible()
      const why = page.getByRole('link', { name: whyLabels[locale] }).first()
      await expect(why).toHaveAttribute('href', /#why$/)
      await expect(page.locator('#why')).toHaveCount(1)
    })

    test(`${locale} use-case demos route to Observatory`, async ({ page }) => {
      const response = await page.goto(`http://qdip.localhost:3000/${locale}/use-cases#demos`)
      expect(response?.status()).toBeLessThan(400)

      for (const [title, path] of demos) {
        await expect(page.getByRole('link', { name: `${openLabels[locale]} ${title}` })).toHaveAttribute(
          'href',
          `https://observatory.qdip.ai/${locale}${path}`
        )
      }

      await expect(page.getByRole('heading', { level: 1, name: useCaseLocalization[locale].heading })).toBeVisible()
      await expect(page.getByText(useCaseLocalization[locale].body, { exact: false })).toBeVisible()
    })
  }
})
