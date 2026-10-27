import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'

import { PortfolioRoadmap } from '@/components/observatory/portfolio-roadmap'
import { pageAccess } from '@/lib/qdip-page-access'
import { loadGithubPortfolio, portfolioErrorLabel } from '@/lib/portfolio-github'
import { loginUrl } from '@/lib/qdip-oidc'
import { isSupportedLocale } from '@/lib/observatory-i18n'
import { observatoryHref } from '@/lib/platform-urls'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Portfolio Roadmap — QDIP',
  description: 'Authenticated QDIP project stages, dependencies and next steps.',
  robots: { index: false, follow: false },
}

export default async function PortfolioPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isSupportedLocale(locale)) notFound()

  const access = await pageAccess('observatory_admin')
  if (!access.authenticated) {
    redirect(loginUrl(observatoryHref('/portfolio', locale)))
  }
  if (!access.allowed) notFound()

  let projects: Awaited<ReturnType<typeof loadGithubPortfolio>>['projects'] = []
  let fetchedAt: string | null = null
  let errorMessage: string | undefined
  try {
    const portfolio = await loadGithubPortfolio()
    projects = portfolio.projects
    fetchedAt = portfolio.fetchedAt
  } catch (error) {
    errorMessage = portfolioErrorLabel(error)
  }
  return <PortfolioRoadmap projects={projects} fetchedAt={fetchedAt} error={errorMessage} />
}
