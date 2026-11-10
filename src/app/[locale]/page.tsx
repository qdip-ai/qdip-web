import { notFound } from 'next/navigation'
import { visiblePluginUseCaseIds } from '@/lib/observatory-plugin-catalog'

import { ObservatoryHome, PrototypeShell } from '@/features/observatory'
import { isSupportedLocale, type Locale } from '@/lib/observatory-i18n'

export const dynamic = 'force-dynamic'

export default async function LocalizedHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isSupportedLocale(locale)) notFound()
  const visibleIds = await visiblePluginUseCaseIds()
  return (
    <PrototypeShell locale={locale as Locale} activeRoute="/">
      <ObservatoryHome locale={locale as Locale} visibleIds={visibleIds} />
    </PrototypeShell>
  )
}
