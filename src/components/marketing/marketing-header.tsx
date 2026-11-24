import Link from 'next/link'
import { QdipAuthControl } from '@/components/auth/qdip-auth-control'
import { SlidersHorizontal, Telescope } from 'lucide-react'
import { marketingLocaleHref, observatoryHref, studioHref, PLATFORM_URLS } from '@/lib/platform-urls'
import { sharedI18n } from '@/lib/product-i18n'
import { LanguageSwitcher } from './language-switcher'
import { MobileMenu } from './mobile-menu'
import { MarketingThemeToggle } from './marketing-theme-toggle'
import { marketingCopy, type MarketingLocale } from './qdip-copy'
import { QdipLogo } from './qdip-logo'
import styles from './qdip-site.module.css'
import shellStyles from './marketing-shell.module.css'

function marketingPath(locale: MarketingLocale, slug: string) {
  return `${marketingLocaleHref(locale)}/${slug}`
}

export function MarketingHeader({ locale, currentPath }: { locale: MarketingLocale; currentPath?: string }) {
  const c = marketingCopy[locale]
  const a11y = sharedI18n[locale]
  const items = [
    { href: marketingPath(locale, 'how-it-works'), label: c.nav[0] },
    { href: marketingPath(locale, 'use-cases'), label: c.nav[1] },
    { href: `${marketingLocaleHref(locale)}#why`, label: c.nav[2] },
    { href: marketingPath(locale, 'core'), label: c.nav[3] },
    { href: marketingPath(locale, 'sdk'), label: 'SDK' },
    { href: `${marketingPath(locale, 'use-cases')}#demos`, label: c.nav[4] },
  ]
  const mobileItems = [
    ...items,
    { href: observatoryHref('', locale), label: 'Observatory', icon: <Telescope size={15} /> },
    { href: studioHref('', locale), label: 'Studio', icon: <SlidersHorizontal size={15} /> },
  ]
  const returnTo = new URL(
    currentPath ? marketingPath(locale, currentPath) : marketingLocaleHref(locale),
    PLATFORM_URLS.site
  ).toString()
  const hrefForLocale = (target: MarketingLocale) =>
    currentPath ? marketingPath(target, currentPath) : marketingLocaleHref(target)

  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <Link
          className={`${styles.brand} ${shellStyles.headerBrand}`}
          href={marketingLocaleHref(locale)}
          aria-label={a11y.home}
        >
          <QdipLogo />
        </Link>
        <nav aria-label={a11y.primaryNavigation} className={styles.nav}>
          {items.map((item) => (
            <Link href={item.href} key={`${item.href}-${item.label}`}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className={styles.headerTools}>
          <div className={styles.productLinks} aria-label={a11y.products}>
            <Link href={observatoryHref('', locale)}>
              <Telescope size={15} aria-hidden />
              Observatory
            </Link>
            <Link href={studioHref('', locale)}>
              <SlidersHorizontal size={15} aria-hidden />
              Studio
            </Link>
          </div>
          <LanguageSwitcher locale={locale} hrefForLocale={hrefForLocale} />
          <QdipAuthControl locale={locale} returnTo={returnTo} iconOnly />
          <div className={styles.desktopThemeSwitch}>
            <MarketingThemeToggle locale={locale} />
          </div>
          <MobileMenu items={mobileItems} locale={locale} />
        </div>
      </div>
    </header>
  )
}
