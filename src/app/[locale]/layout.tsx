import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { notFound } from 'next/navigation'

import { I18nProvider } from '@/i18n/provider'
import { getLocaleMetadata, isSupportedLocale, SUPPORTED_LOCALES } from '@/lib/observatory-i18n'

type LayoutProps = {
  children: ReactNode
  params: Promise<{ locale: string }>
}

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }))
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const resolvedLocale = isSupportedLocale(locale) ? locale : 'en'

  return getLocaleMetadata(resolvedLocale)
}

export default async function LocaleLayout({ children, params }: LayoutProps) {
  const { locale } = await params

  if (!isSupportedLocale(locale)) {
    notFound()
  }

  return <I18nProvider locale={locale}>{children}</I18nProvider>
}
