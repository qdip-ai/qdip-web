'use client'

import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react'
import { type Locale } from './config'
import { createTranslator, type Translator } from './runtime'

const LocaleContext = createContext<Locale | null>(null)

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
}

export function useLocale(): Locale {
  const locale = useContext(LocaleContext)
  if (!locale) throw new Error('I18nProvider is missing for this route')
  return locale
}

export function useTranslations(namespace = ''): Translator {
  const locale = useLocale()
  return useMemo(() => createTranslator(locale, namespace), [locale, namespace])
}
