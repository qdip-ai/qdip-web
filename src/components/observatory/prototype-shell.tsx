'use client'

import { useEffect, useRef, useState } from 'react'
import {
  ChevronRight,
  FileUp,
  FlaskConical,
  Home,
  Menu,
  ShieldCheck,
  KeyRound,
  Network,
  Blocks,
  Scale,
  Stethoscope,
  SlidersHorizontal,
  UsersRound,
} from 'lucide-react'
import { QdipAuthControl } from '@/components/auth/qdip-auth-control'
import { ProductShell, type DesignTheme } from '@/design-system'
import { useTranslations } from '@/i18n/provider'
import { buildLocalePath, SUPPORTED_LOCALES, type Locale } from '@/lib/observatory-i18n'
import { marketingHref, observatoryHref, studioHref } from '@/lib/platform-urls'
import { systemApplicationCopy } from '@/observatory/application-copy'
import { findObservatoryApplicationByRoute, observableApplications } from '@/observatory/applications'
import { type UseCaseRoute, type UseCaseTheme } from '@/use-cases/registry'
import { ObservatoryFooter } from './observatory-footer'
import styles from './prototype-shell.module.css'

export type PrototypeTheme = UseCaseTheme | 'burgundy'
export type ObservatoryRoute =
  | '/'
  | '/challenges'
  | '/decision-intake'
  | '/model-doctor'
  | '/decisions'
  | '/plugins'
  | '/admin/plugins'
  | '/admin/apps'
  | UseCaseRoute

type PrototypeShellProps = {
  locale: Locale
  children: React.ReactNode
  activeRoute: ObservatoryRoute
  theme?: PrototypeTheme
}

const NAV_ICONS = {
  scale: Scale,
  upload: FileUp,
  stethoscope: Stethoscope,
  heart: UsersRound,
  network: Network,
  sparkles: FlaskConical,
} as const

export function PrototypeShell({ locale, children, activeRoute, theme = 'cyan' }: PrototypeShellProps) {
  const activeNavRef = useRef<HTMLAnchorElement>(null)
  const [visibleIds, setVisibleIds] = useState<string[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const navItems = observableApplications(visibleIds)
  useEffect(() => {
    const controller = new AbortController()
    void fetch('/api/observatory/catalog', {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => (response.ok ? response.json() : { visibleIds: [] }))
      .then((data: { visibleIds?: string[] }) => {
        if (!controller.signal.aborted && Array.isArray(data.visibleIds)) setVisibleIds(data.visibleIds)
      })
      .catch(() => {})
    void fetch('/api/auth/session', {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => (response.ok ? response.json() : {}))
      .then((data: { observatoryAdmin?: boolean }) => {
        if (!controller.signal.aborted) setIsAdmin(data.observatoryAdmin === true)
      })
      .catch(() => {})
    return () => controller.abort()
  }, [])
  const shared = useTranslations('shared')
  const observatory = useTranslations('observatory')
  const caseT = useTranslations('useCases')
  const activeItem = findObservatoryApplicationByRoute(activeRoute)

  useEffect(() => {
    activeNavRef.current?.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
    })
  }, [activeRoute])

  const localeHref = (next: Locale) => buildLocalePath(activeRoute, next)
  const labelFor = (item: (typeof navItems)[number]) =>
    item.kind === 'use-case'
      ? caseT(`${item.useCaseId}.title`)
      : systemApplicationCopy(locale, item.id as 'decision-challenge' | 'decision-intake' | 'model-doctor').title
  const activeLabel =
    activeRoute === '/admin/apps'
      ? (
          {
            en: 'Developer applications',
            uk: 'Застосунки та ключі',
            pl: 'Aplikacje i klucze',
          } as const
        )[locale]
      : activeRoute === '/admin/plugins'
        ? (
            {
              en: 'Plugin administration',
              uk: 'Керування плагінами',
              pl: 'Administracja wtyczkami',
            } as const
          )[locale]
        : activeRoute === '/plugins'
          ? (
              {
                en: 'Plugin catalog',
                uk: 'Каталог плагінів',
                pl: 'Katalog wtyczek',
              } as const
            )[locale]
          : activeItem
            ? labelFor(activeItem)
            : 'Observatory'

  const nav = (
    <nav className={styles.navigation} aria-label={observatory('applications')}>
      {navItems.map((item) => {
        const active = activeItem?.id === item.id
        const Icon = NAV_ICONS[item.icon]
        return (
          <a
            ref={active ? activeNavRef : undefined}
            key={item.id}
            href={buildLocalePath(item.route, locale)}
            aria-current={active ? 'page' : undefined}
            className={styles.navLink}
          >
            <Icon className={styles.navIcon} aria-hidden />
            <span>{labelFor(item)}</span>
          </a>
        )
      })}
      <a
        className={styles.navLink}
        href={buildLocalePath('/plugins', locale)}
        aria-current={activeRoute === '/plugins' ? 'page' : undefined}
      >
        <Blocks className={styles.navIcon} aria-hidden />
        <span>{({ en: 'Plugins', uk: 'Плагіни', pl: 'Wtyczki' } as const)[locale]}</span>
      </a>
      {isAdmin && (
        <a
          className={styles.navLink}
          href={buildLocalePath('/admin/apps', locale)}
          aria-current={activeRoute === '/admin/apps' ? 'page' : undefined}
        >
          <KeyRound className={styles.navIcon} aria-hidden />
          <span>
            {
              (
                {
                  en: 'Applications & keys',
                  uk: 'Застосунки та ключі',
                  pl: 'Aplikacje i klucze',
                } as const
              )[locale]
            }
          </span>
        </a>
      )}
      {isAdmin && (
        <a
          className={styles.navLink}
          href={buildLocalePath('/admin/plugins', locale)}
          aria-current={activeRoute === '/admin/plugins' ? 'page' : undefined}
        >
          <ShieldCheck className={styles.navIcon} aria-hidden />
          <span>
            {
              (
                {
                  en: 'Manage plugins',
                  uk: 'Керування плагінами',
                  pl: 'Zarządzaj wtyczkami',
                } as const
              )[locale]
            }
          </span>
        </a>
      )}
    </nav>
  )

  const utilities = (
    <div className={styles.localeControls}>
      <div className={styles.locale} aria-label={shared('language')}>
        {SUPPORTED_LOCALES.map((option) => (
          <a
            key={option}
            href={localeHref(option)}
            aria-current={option === locale ? 'page' : undefined}
            data-locale={option}
          >
            {shared(`localeLabels.${option}`)}
          </a>
        ))}
      </div>
      <div className={styles.mobileLocale} role="group" aria-label={shared('language')}>
        {SUPPORTED_LOCALES.map((option) => (
          <a
            key={option}
            href={localeHref(option)}
            data-mobile-locale={option}
            lang={option}
            aria-label={shared(`localeLabels.${option}`)}
            aria-current={option === locale ? 'page' : undefined}
          >
            {option.toUpperCase()}
          </a>
        ))}
      </div>
    </div>
  )

  return (
    <ProductShell
      theme={theme as DesignTheme}
      className={styles.shell}
      href={buildLocalePath('/', locale)}
      brandHref={marketingHref(locale)}
      product="Observatory"
      nativeNavigation
      navigation={<div className={styles.desktopNavigation}>{nav}</div>}
      mobileNavigation={
        <details className={styles.mobileMenu}>
          <summary>
            <Menu aria-hidden /> <span>{observatory('mobileApplications')}</span>
          </summary>
          <div className={styles.mobileNavigation}>
            {nav}
            <a className={styles.mobileProductLink} href={studioHref('', locale)}>
              <SlidersHorizontal size={15} aria-hidden />
              {observatory('openStudio')}
            </a>
          </div>
        </details>
      }
      productSwitch={{
        href: studioHref('', locale),
        label: observatory('openStudio'),
        icon: <SlidersHorizontal size={15} />,
      }}
      utilities={
        <>
          <QdipAuthControl locale={locale} returnTo={observatoryHref(activeRoute, locale)} showProfile />
          {utilities}
        </>
      }
    >
      <div className={styles.stage}>
        <div className={styles.breadcrumb} aria-label={shared('breadcrumb')}>
          <a className={styles.breadcrumbHome} href={marketingHref(locale)} aria-label={shared('home')}>
            <Home />
          </a>
          <ChevronRight />
          <span>{activeLabel}</span>
        </div>
        <div className={styles.content} id="main-content" tabIndex={-1}>
          {children}
        </div>
      </div>
      <ObservatoryFooter locale={locale} />
    </ProductShell>
  )
}
