import { notFound } from 'next/navigation'
import { visiblePluginUseCaseIds } from '@/lib/observatory-plugin-catalog'

import { ObservatoryHome, PrototypeShell } from '@/features/observatory'
import { buildLocalePath, isSupportedLocale, type Locale } from '@/lib/observatory-i18n'

export const dynamic = 'force-dynamic'

export default async function LocalizedHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isSupportedLocale(locale)) notFound()
  const visibleIds = await visiblePluginUseCaseIds()
  // Public CTA only navigates to the existing authenticated Zitadel owner-link route.
  const rrQaOwnerLinkAvailable =
    process.env.RAILWAY_PROJECT_ID === '4665798b-2012-466e-be91-2555d76f36c2' &&
    process.env.RAILWAY_ENVIRONMENT_NAME === 'qa' &&
    Boolean(process.env.RR_STAGING_OWNER_LINK_URL)
  const ownerAction = {
    uk: {
      title: 'Прив’язка RR QA',
      description: 'Підтвердіть організацію через Zitadel. Це не видає API-ключі й не змінює production.',
      button: 'Підтвердити організацію RR QA',
    },
    en: {
      title: 'RR QA organization link',
      description: 'Verify your organization through Zitadel. This does not issue API keys or change production.',
      button: 'Verify RR QA organization',
    },
    pl: {
      title: 'Powiązanie organizacji RR QA',
      description: 'Potwierdź organizację w Zitadel. Nie wydaje to kluczy API ani nie zmienia produkcji.',
      button: 'Potwierdź organizację RR QA',
    },
  }[locale as Locale]
  return (
    <PrototypeShell locale={locale as Locale} activeRoute="/">
      {rrQaOwnerLinkAvailable && (
        <section
          aria-label={ownerAction.title}
          className="mx-auto mb-6 max-w-5xl rounded-xl border border-white/20 bg-slate-900 px-5 py-5 text-slate-100"
        >
          <h2 className="text-lg font-semibold">{ownerAction.title}</h2>
          <p className="mt-2 text-sm text-slate-300">{ownerAction.description}</p>
          <a
            href={buildLocalePath('/admin/apps', locale as Locale)}
            className="mt-4 inline-flex min-h-11 items-center justify-center rounded-lg border border-white/30 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
          >
            {ownerAction.button}
          </a>
        </section>
      )}
      <ObservatoryHome locale={locale as Locale} visibleIds={visibleIds} />
    </PrototypeShell>
  )
}
