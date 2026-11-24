import { notFound, redirect } from 'next/navigation'
import { PrototypeShell } from '@/features/observatory'
import { QdipAccessGate } from '@/components/auth/qdip-access-gate'
import { isSupportedLocale, type Locale } from '@/lib/observatory-i18n'
import { pageAccess } from '@/lib/qdip-page-access'
import { loginUrl } from '@/lib/qdip-oidc'
import { observatoryHref } from '@/lib/platform-urls'
import { corePluginConnection, readCorePublications } from '@/lib/observatory-plugin-catalog'
import { readCoreApplications } from '@/lib/observatory-application-catalog'
import { ApplicationPublicationControls } from '@/components/observatory/application-publication-controls'
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

  const [publications, applications] = await Promise.all([
    readCorePublications().catch(() => null),
    Promise.resolve()
      .then(() => readCoreApplications(corePluginConnection()))
      .catch(() => null),
  ])
  const byName = new Map(publications?.map((record) => [record.name, record]) ?? [])
  const labels = {
    uk: {
      title: 'Керування застосунками',
      description: 'Публікація застосунків незалежна від публікації SDK-плагінів.',
      unavailable: 'Стан Core недоступний',
      missing: 'Плагін не зареєстровано',
      disabled: 'Плагін вимкнений',
      unpublished: 'Плагін не опубліковано',
      mismatch: 'Capability не збігається з Core',
      version: 'Версія плагіна не збігається',
      available: 'Доступний у каталозі',
      pending: 'Публікація цього застосунку ще керується через плагін',
      independent: 'Незалежні застосунки (SDK runtime)',
      none: 'Core не оголошує незалежних застосунків',
      ready: 'Runtime готовий',
      blocked: 'Публікацію заблоковано',
    },
    en: {
      title: 'Manage applications',
      description: 'Application publication is independent of SDK plugin publication.',
      unavailable: 'Core status unavailable',
      missing: 'Plugin not registered',
      disabled: 'Plugin disabled',
      unpublished: 'Plugin not published',
      mismatch: 'Plugin capability mismatch',
      version: 'Plugin version mismatch',
      available: 'Visible in catalog',
      pending: 'This application still uses legacy plugin visibility',
      independent: 'Independent applications (SDK runtime)',
      none: 'Core declares no independent applications',
      ready: 'Runtime admitted',
      blocked: 'Publication blocked',
    },
    pl: {
      title: 'Zarządzaj aplikacjami',
      description: 'Publikacja aplikacji jest niezależna od publikacji wtyczek SDK.',
      unavailable: 'Stan Core niedostępny',
      missing: 'Wtyczka niezarejestrowana',
      disabled: 'Wtyczka wyłączona',
      unpublished: 'Wtyczka nieopublikowana',
      mismatch: 'Niezgodne capability',
      version: 'Niezgodna wersja wtyczki',
      available: 'Widoczna w katalogu',
      pending: 'Ta aplikacja korzysta nadal z publikacji wtyczek',
      independent: 'Niezależne aplikacje (runtime SDK)',
      none: 'Core nie deklaruje niezależnych aplikacji',
      ready: 'Środowisko gotowe',
      blocked: 'Publikacja zablokowana',
    },
  }[locale]

  return (
    <PrototypeShell locale={locale as Locale} activeRoute="/admin/applications">
      <section style={{ padding: '1.5rem', maxWidth: 960 }}>
        <h1>{labels.title}</h1>
        <p>{labels.description}</p>
        <ul>
          {DIP_USE_CASES.map((app) => {
            const plugin = byName.get(app.plugin.id)
            let status = labels.available
            if (!publications) status = labels.unavailable
            else if (!plugin) status = labels.missing
            else if (!plugin.enabled) status = labels.disabled
            else if (
              !plugin.capabilities.includes(app.plugin.capability) ||
              plugin.capability_id !== app.plugin.capability
            )
              status = labels.mismatch
            else if (plugin.published !== true) status = labels.unpublished
            else if (plugin.published_version !== plugin.version) status = labels.version
            return (
              <li key={app.id}>
                <strong>{app.id}</strong> — {status} ({labels.pending})
              </li>
            )
          })}
        </ul>
        <h2>{labels.independent}</h2>
        {!applications ? (
          <p>{labels.unavailable}</p>
        ) : applications.length === 0 ? (
          <p>{labels.none}</p>
        ) : (
          <ul data-testid="independent-applications">
            {applications.map((application) => (
              <li key={application.application_id}>
                <strong>{application.application_id}</strong> — {application.status}
                {' · '}
                {application.visible ? labels.available : application.admission.ready ? labels.ready : labels.blocked}
                {' · '}
                <code>{application.launch_url}</code>
                <div>
                  {application.admission.reasons.length > 0 && (
                    <span role="status">{application.admission.reasons.join(', ')}</span>
                  )}
                </div>
                <ApplicationPublicationControls application={application} locale={locale as Locale} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </PrototypeShell>
  )
}
