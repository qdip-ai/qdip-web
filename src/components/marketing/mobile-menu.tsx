'use client'

import Link from 'next/link'
import { Menu, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { sharedI18n } from '@/lib/product-i18n'
import type { MarketingLocale } from './qdip-copy'
import { MarketingThemeToggle } from './marketing-theme-toggle'
import styles from './qdip-site.module.css'

type Item = { href: string; label: string; icon?: ReactNode }

export function MobileMenu({ items, locale }: { items: readonly Item[]; locale: MarketingLocale }) {
  const [open, setOpen] = useState(false)
  const a11y = sharedI18n[locale]
  return (
    <div className={styles.mobileMenu}>
      <button
        aria-controls="mobile-navigation"
        aria-expanded={open}
        aria-label={open ? a11y.closeNavigation : a11y.openNavigation}
        className={styles.menuButton}
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        {open ? <X aria-hidden="true" size={22} /> : <Menu aria-hidden="true" size={22} />}
      </button>
      {open && (
        <nav aria-label={a11y.mobileNavigation} className={styles.mobileNav} id="mobile-navigation">
          {items.map((item) => (
            <Link
              href={item.href}
              key={`${item.href}-${item.label}`}
              onClick={() => setOpen(false)}
              style={item.icon ? { alignItems: 'center', display: 'flex', gap: '10px' } : undefined}
            >
              {item.icon ? (
                <span aria-hidden="true" style={{ display: 'inline-flex', flex: '0 0 18px', justifyContent: 'center' }}>
                  {item.icon}
                </span>
              ) : null}
              <span>{item.label}</span>
            </Link>
          ))}
          <div className={styles.mobileThemeRow}>
            <MarketingThemeToggle locale={locale} onChange={() => setOpen(false)} />
          </div>
        </nav>
      )}
    </div>
  )
}
