import { notFound, redirect } from 'next/navigation'
import { PrototypeShell } from '@/features/observatory'
import { isSupportedLocale, type Locale } from '@/lib/observatory-i18n'
import { cookies } from 'next/headers'
import { getQdipSession, QDIP_SESSION_COOKIE } from '@/lib/qdip-oidc'
import { loginUrl } from '@/lib/qdip-oidc'
import { observatoryHref } from '@/lib/platform-urls'
import { ObservatoryDeveloperKeys } from '@/components/observatory/observatory-developer-keys'

export const dynamic = 'force-dynamic'

export default async function DeveloperApplicationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isSupportedLocale(locale)) notFound()
  const cookieStore = await cookies()
  const session = getQdipSession(cookieStore.get(QDIP_SESSION_COOKIE)?.value)
  if (!session) redirect(loginUrl(observatoryHref('/admin/apps', locale)))
  return (
    <PrototypeShell locale={locale as Locale} activeRoute="/admin/apps">
      <ObservatoryDeveloperKeys locale={locale as Locale} />
    </PrototypeShell>
  )
}
