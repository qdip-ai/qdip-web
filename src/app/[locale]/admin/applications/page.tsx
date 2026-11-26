import { notFound, redirect } from 'next/navigation'
import { PrototypeShell } from '@/features/observatory'
import { QdipAccessGate } from '@/components/auth/qdip-access-gate'
import { isSupportedLocale, type Locale } from '@/lib/observatory-i18n'
import { pageAccess } from '@/lib/qdip-page-access'
import { loginUrl } from '@/lib/qdip-oidc'
import { observatoryHref } from '@/lib/platform-urls'
import { corePluginConnection } from '@/lib/observatory-plugin-catalog'
import { readCoreApplications } from '@/lib/observatory-application-catalog'
import { ApplicationPublicationControls } from '@/components/observatory/application-publication-controls'

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

  const applications = await Promise.resolve()
    .then(() => readCoreApplications(corePluginConnection()))
    .catch(() => null)
  const labels = {
    uk: {
      title: 'Керування застосунками',
      description: 'Публікація застосунків незалежна від публікації SDK-плагінів.',
      unavailable: 'Стан Core недоступний',
      available: 'Доступний у каталозі',
      independent: 'Незалежні застосунки (SDK runtime)',
      none: 'Core не оголошує незалежних застосунків',
      ready: 'Runtime готовий',
      blocked: 'Публікацію заблоковано',
    },
    en: {
      title: 'Manage applications',
      description: 'Application publication is independent of SDK plugin publication.',
      unavailable: 'Core status unavailable',
      available: 'Visible in catalog',
      independent: 'Independent applications (SDK runtime)',
      none: 'Core declares no independent applications',
      ready: 'Runtime admitted',
      blocked: 'Publication blocked',
    },
    pl: {
      title: 'Zarządzaj aplikacjami',
      description: 'Publikacja aplikacji jest niezależna od publikacji wtyczek SDK.',
      unavailable: 'Stan Core niedostępny',
      available: 'Widoczna w katalogu',
      independent: 'Niezależne aplikacje (runtime SDK)',
      none: 'Core nie deklaruje niezależnych aplikacji',
      ready: 'Środowisko gotowe',
      blocked: 'Publikacja zablokowana',
    },
  }[locale]

  return (
    <PrototypeShell locale={locale as Locale} activeRoute="/admin/applications">
      <section className="w-full min-w-0 max-w-[960px] p-6">
        <h1>{labels.title}</h1>
        <p>{labels.description}</p>
        <h2>{labels.independent}</h2>
        {!applications ? (
          <p>{labels.unavailable}</p>
        ) : applications.length === 0 ? (
          <p>{labels.none}</p>
        ) : (
          <ul className="grid gap-4" data-testid="independent-applications">
            {applications.map((application) => (
              <li key={application.application_id} className="min-w-0 break-words rounded-lg border border-current/20 p-4">
                <strong>{application.application_id}</strong> — {application.status}
                {' · '}
                {application.visible ? labels.available : application.admission.ready ? labels.ready : labels.blocked}
                {' · '}
                <code className="break-all">{application.launch_url}</code>
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
