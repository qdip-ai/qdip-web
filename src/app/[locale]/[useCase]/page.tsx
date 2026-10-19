import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { PrototypeShell } from '@/components/observatory/prototype-shell'
import { QdipAccessGate } from '@/components/auth/qdip-access-gate'
import { createTranslator } from '@/i18n/runtime'
import { isSupportedLocale, SUPPORTED_LOCALES } from '@/lib/observatory-i18n'
import { pageAccess } from '@/lib/qdip-page-access'
import { visiblePluginUseCaseIds } from '@/lib/observatory-plugin-catalog'
import { observatoryHref } from '@/lib/platform-urls'
import { ApplicationFrontend } from '@/use-cases/application-runtime'
import { DIP_USE_CASES, findUseCaseByRoute, type UseCaseId } from '@/use-cases/registry'

export const dynamic = 'force-dynamic'

type UseCasePageParams = {
  locale: string
  useCase: string
}

function resolveUseCase(routeSegment: string) {
  return findUseCaseByRoute(`/${routeSegment}`)
}

export function generateStaticParams() {
  return SUPPORTED_LOCALES.flatMap((locale) =>
    DIP_USE_CASES.map((application) => ({
      locale,
      useCase: application.route.replace(/^\//, ''),
    }))
  )
}

export async function generateMetadata({ params }: { params: Promise<UseCasePageParams> }): Promise<Metadata> {
  const { locale, useCase: routeSegment } = await params
  if (!isSupportedLocale(locale)) return {}

  const application = resolveUseCase(routeSegment)
  if (!application) return {}
  if (application.id !== 'readiness-recovery' && !(await visiblePluginUseCaseIds()).includes(application.id)) {
    return { robots: { index: false, follow: false } }
  }

  const messages = createTranslator(locale, `useCases.${application.id}`)
  const title = `${messages('title')} — QDIP Observatory`
  const description = messages('description')
  const route = application.route
  const canonical = `https://observatory.qdip.ai/${locale}${route}`

  return {
    title: { absolute: title },
    description,
    alternates: {
      canonical,
      languages: Object.fromEntries(
        SUPPORTED_LOCALES.map((supportedLocale) => [
          supportedLocale,
          `https://observatory.qdip.ai/${supportedLocale}${route}`,
        ])
      ),
    },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: 'QDIP Observatory',
      type: 'website',
    },
  }
}

export default async function UseCasePage({ params }: { params: Promise<UseCasePageParams> }) {
  const { locale, useCase: routeSegment } = await params
  if (!isSupportedLocale(locale)) notFound()
  const application = resolveUseCase(routeSegment)
  if (!application) notFound()
  if (application.id !== 'readiness-recovery' && !(await visiblePluginUseCaseIds()).includes(application.id)) {
    notFound()
  }

  if (application.id === 'readiness-recovery') {
    const access = await pageAccess('rr_operator')
    if (!access.allowed)
      return (
        <QdipAccessGate
          locale={locale}
          role="rr_operator"
          returnTo={observatoryHref(application.route, locale)}
          authenticated={access.authenticated}
        />
      )
  }

  return (
    <PrototypeShell locale={locale} activeRoute={application.route} theme={application.presentation.theme}>
      <ApplicationFrontend id={application.id as UseCaseId} locale={locale} />
    </PrototypeShell>
  )
}
