import 'server-only'

import type { PortfolioProject } from '@/components/observatory/portfolio-roadmap-data'
import { corePluginConnection } from '@/lib/observatory-plugin-catalog'

export type PortfolioFeed = {
  projects: PortfolioProject[]
  fetchedAt: string
  source: 'github-issues'
}

function validatePortfolio(input: unknown): PortfolioFeed {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('CORE_PORTFOLIO_INVALID')
  const data = input as Record<string, unknown>
  if (
    data.source !== 'github-issues' ||
    typeof data.fetchedAt !== 'string' ||
    !Array.isArray(data.projects) ||
    data.projects.length === 0 ||
    data.projects.length > 100
  ) {
    throw new Error('CORE_PORTFOLIO_INVALID')
  }
  const allowed = new Set(['active', 'gated', 'blocked', 'research', 'paused', 'closed'])
  const projects: PortfolioProject[] = []
  for (const item of data.projects) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('CORE_PORTFOLIO_INVALID')
    const p = item as Record<string, unknown>
    if (
      typeof p.id !== 'string' ||
      !/^[a-z0-9][a-z0-9-]{0,69}$/.test(p.id) ||
      typeof p.title !== 'string' ||
      typeof p.group !== 'string' ||
      typeof p.status !== 'string' ||
      !allowed.has(p.status) ||
      typeof p.stage !== 'string' ||
      typeof p.next !== 'string' ||
      typeof p.source !== 'string' ||
      !/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/issues\/[1-9]\d*$/.test(p.source) ||
      typeof p.updatedAt !== 'string' ||
      !Array.isArray(p.dependencies) ||
      !p.dependencies.every((v) => typeof v === 'string') ||
      !Array.isArray(p.missingDependencies) ||
      !p.missingDependencies.every((v) => typeof v === 'string') ||
      !Array.isArray(p.steps) ||
      !p.steps.every((v) => typeof v === 'string')
    )
      throw new Error('CORE_PORTFOLIO_INVALID')
    projects.push(p as PortfolioProject)
  }
  return { source: 'github-issues', fetchedAt: data.fetchedAt, projects }
}

/** Observatory only communicates with the existing Core backend; no GitHub credentials at Vercel. */
export async function loadGithubPortfolio(): Promise<PortfolioFeed> {
  const { base, key } = corePluginConnection()
  const origin = new URL(base)
  // Only use the existing, trusted Core origin from the SDK connection.
  const response = await fetch(origin.origin + '/api/v1/portfolio/roadmap', {
    headers: { 'x-api-key': key, Accept: 'application/json' },
    next: { revalidate: 60 },
    redirect: 'error',
    signal: AbortSignal.timeout(12_000),
  })
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined)
    throw new Error('CORE_PORTFOLIO_UNAVAILABLE')
  }
  const raw = await response.text()
  if (raw.length > 250_000) throw new Error('CORE_PORTFOLIO_INVALID')
  try {
    return validatePortfolio(JSON.parse(raw) as unknown)
  } catch {
    throw new Error('CORE_PORTFOLIO_INVALID')
  }
}

export function portfolioErrorLabel(error: unknown) {
  const code = error instanceof Error ? error.message : ''
  if (code === 'CORE_PORTFOLIO_UNAVAILABLE')
    return 'QDIP Core не зміг прочитати актуальні GitHub Issues. Перевірте backend GitHub read-доступ.'
  if (code === 'CORE_PORTFOLIO_INVALID')
    return 'QDIP Core повернув некоректну карту. Не показуємо непідтверджені статуси.'
  return 'З’єднання з QDIP Core недоступне або ще не розгорнуто backend-інтеграцію roadmap.'
}
