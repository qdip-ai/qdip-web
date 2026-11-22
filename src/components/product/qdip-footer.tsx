import Link from 'next/link'
import type { ReactNode } from 'react'

import { QdipLogo } from '@/components/marketing/qdip-logo'
import { createTranslator } from '@/i18n/runtime'
import type { Locale } from '@/lib/observatory-i18n'
import { marketingHref } from '@/lib/platform-urls'
import styles from './qdip-footer.module.css'

export type QdipFooterVariant = 'marketing' | 'observatory' | 'studio' | 'product'

const path = (locale: Locale, slug: string) => `${marketingHref(locale)}/${slug}`

function FooterLink({
  href,
  children,
  className,
  ariaLabel,
  native,
  dataFooterBrand = false,
}: {
  href: string
  children: ReactNode
  className?: string
  ariaLabel?: string
  native: boolean
  dataFooterBrand?: boolean
}) {
  const brandAttribute = dataFooterBrand ? '' : undefined
  return native ? (
    <a className={className} href={href} aria-label={ariaLabel} data-footer-brand={brandAttribute}>
      {children}
    </a>
  ) : (
    <Link className={className} href={href} aria-label={ariaLabel} data-footer-brand={brandAttribute}>
      {children}
    </Link>
  )
}

export function QdipFooter({
  locale,
  variant = 'marketing',
  showNavigation = true,
  testId,
  className,
}: {
  locale: Locale
  variant?: QdipFooterVariant
  showNavigation?: boolean
  testId?: string
  className?: string
}) {
  const copy = createTranslator(locale, 'footer')
  const shared = createTranslator(locale, 'shared')
  const native = variant === 'observatory' || variant === 'studio'
  const inverseLogo = variant !== 'product' && variant !== 'studio'

  return (
    <footer
      className={`${styles.footer}${className ? ` ${className}` : ''}`}
      data-variant={variant}
      data-testid={testId}
    >
      <div className={styles.inner}>
        <FooterLink
          className={styles.brand}
          href={marketingHref(locale)}
          ariaLabel={shared('home')}
          native={native}
          dataFooterBrand
        >
          <QdipLogo inverse={inverseLogo} />
        </FooterLink>

        {showNavigation ? (
          <nav className={styles.navigation} aria-label={shared('footerNavigation')}>
            <FooterLink href={path(locale, 'how-it-works')} native={native}>
              {copy('how')}
            </FooterLink>
            <FooterLink href={path(locale, 'use-cases')} native={native}>
              {copy('useCases')}
            </FooterLink>
            <FooterLink href={path(locale, 'core')} native={native}>
              {copy('core')}
            </FooterLink>
            <FooterLink href={path(locale, 'core/research')} native={native}>
              {copy('research')}
            </FooterLink>
            <FooterLink href={path(locale, 'sdk')} native={native}>
              SDK
            </FooterLink>
          </nav>
        ) : null}

        <div className={styles.meta}>
          <span className={styles.disclaimer} data-footer-disclaimer>
            {copy('disclaimer')}
          </span>
          <span className={styles.copyright} data-footer-copyright>
            © {new Date().getFullYear()} QDIP
          </span>
        </div>
      </div>
    </footer>
  )
}
