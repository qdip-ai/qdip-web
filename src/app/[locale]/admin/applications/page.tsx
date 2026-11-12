import { notFound, redirect } from 'next/navigation'
import { PrototypeShell } from '@/features/observatory'
import { QdipAccessGate } from '@/components/auth/qdip-access-gate'
import { isSupportedLocale, type Locale } from '@/lib/observatory-i18n'
import { pageAccess } from '@/lib/qdip-page-access'
import { loginUrl } from '@/lib/qdip-oidc'
import { observatoryHref } from '@/lib/platform-urls'
import { readCorePublications } from '@/lib/observatory-plugin-catalog'
import { DIP_USE_CASES } from '@/use-cases/registry'

export const dynamic = 'force-dynamic'

export default async function ManageApplicationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isSupportedLocale(locale)) notFound()
  const access = await pageAccess('observatory_admin')
  if (!access.authenticated) redirect(loginUrl(observatoryHref('/admin/applications', locale)))
  if (!access.allowed)
    return (
      <QdipAccessGate
        locale={locale as Locale}
        role="observatory_admin"
        returnTo={observatoryHref('/admin/applications', locale as Locale)}
        authenticated={true}
      />
    )

  let records: Awaited<ReturnType<typeof readCorePublications>> | null = null
  try {
    records = await readCorePublications()
  } catch {
    // Never report a publication as absent when Core could not be queried.
  }
  const byName = new Map(records?.map((record) => [record.name, record]) ?? [])
  const labels = {
    uk: {
      title: 'Керування застосунками',
      description: 'Стан доступності застосунків. Публікація SDK-плагіна не публікує застосунок автоматично.',
      unavailable: 'Стан Core недоступний',
      missing: 'Плагін не зареєстровано',
      disabled: 'Плагін вимкнений',
      unpublished: 'Плагін не опубліковано',
      mismatch: 'Capability застосунку не збігається з Core',
      version: 'Версія публікації не збігається',
      available: 'Доступний у каталозі',
      pending: 'Окреме керування публікацією застосунків ще не реалізовано',
    },
    en: {
      title: 'Manage applications',
      description:
        'Application availability diagnostics. Publishing an SDK plugin does not automatically publish an application.',
      unavailable: 'Core status unavailable',
      missing: 'Plugin not registered',
      disabled: 'Plugin disabled',
      unpublished: 'Plugin not published',
      mismatch: 'Application capability differs from Core',
      version: 'Published version differs',
      available: 'Visible in catalog',
      pending: 'Independent application publishing controls are not implemented yet',
    },
    pl: {
      title: 'Zarządzaj aplikacjami',
      description: 'Diagnostyka dostępności aplikacji. Publikacja wtyczki SDK nie publikuje automatycznie aplikacji.',
      unavailable: 'Status Core niedostępny',
      missing: 'Wtyczka niezarejestrowana',
      disabled: 'Wtyczka wyłączona',
      unpublished: 'Wtyczka nieopublikowana',
      mismatch: 'Niezgodna funkcja aplikacji i Core',
      version: 'Niezgodna wersja publikacji',
      available: 'Widoczna w katalogu',
      pending: 'Niezależne sterowanie publikacją aplikacji nie jest jeszcze dostępne',
    },
  }[locale]

  return (
    <PrototypeShell locale={locale as Locale} activeRoute="/admin/applications">
      <section style={{ padding: '1.5rem', maxWidth: 960 }}>
        <h1>{labels.title}</h1>
        <p>{labels.description}</p>
        <p>{labels.pending}</p>
        <ul>
          {DIP_USE_CASES.map((app) => {
            const plugin = byName.get(app.plugin.id)
            let status = labels.available
            if (!records) {
              status = labels.unavailable
            } else if (!plugin) {
              status = labels.missing
            } else if (!plugin.enabled) {
              status = labels.disabled
            } else if (!plugin.capabilities.includes(app.plugin.capability)) {
              status = labels.mismatch
            } else if (plugin.capability_id !== app.plugin.capability) {
              status = labels.mismatch
            } else if (plugin.published !== true) {
              status = labels.unpublished
            } else if (plugin.published_version !== plugin.version) {
              status = labels.version
            }
            return (
              <li key={app.id}>
                <strong>{app.id}</strong> — {status}
              </li>
            )
          })}
        </ul>
      </section>
    </PrototypeShell>
  )
}
