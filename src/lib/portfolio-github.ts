import 'server-only'

import { assemblePortfolio, parsePortfolioIssue, type PortfolioProject } from '@/components/observatory/portfolio-roadmap-data'

type SearchResponse = {
  total_count?: number
  incomplete_results?: boolean
  items?: unknown[]
}

const SEARCH_ORGS = ['qdip-ai', 'mentality-prj'] as const
const MAX_PAGES = 5

export type PortfolioFeed = {
  projects: PortfolioProject[]
  fetchedAt: string
  source: 'github-issues'
}

function readToken() {
  // This is a server-only, scoped credential: never pass it into client props.
  const token = process.env.QDIP_PORTFOLIO_GITHUB_READ_TOKEN?.trim()
  if (!token) throw new Error('GITHUB_READ_NOT_CONFIGURED')
  return token
}

async function githubJson(url: string, token: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: 'Bearer ' + token,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'qdip-observatory-portfolio',
    },
    next: { revalidate: 60 },
  })
  if (!response.ok) {
    // No raw GitHub error bodies or secrets in logs.
    throw new Error('GITHUB_READ_FAILED_' + response.status)
  }
  return response.json()
}

async function searchOrg(org: string, token: string) {
  const found: unknown[] = []
  for (let page = 1; page <= MAX_PAGES; page++) {
    const q = encodeURIComponent('org:' + org + ' is:issue in:body "QDIP Portfolio"')
    const data = await githubJson('https://api.github.com/search/issues?q=' + q + '&per_page=100&page=' + page, token) as SearchResponse
    if (!Array.isArray(data.items) || typeof data.total_count !== 'number' || data.incomplete_results === true) {
      throw new Error('GITHUB_SEARCH_INCOMPLETE')
    }
    if (data.total_count > 100 * MAX_PAGES) throw new Error('GITHUB_SEARCH_TRUNCATED')
    found.push(...data.items)
    if (found.length >= data.total_count) break
    if (data.items.length !== 100) throw new Error('GITHUB_SEARCH_INCOMPLETE')
  }
  return found
}

/** Only run after the Observatory server-side admin check. Never render a stale snapshot on an API error. */
export async function loadGithubPortfolio(): Promise<PortfolioFeed> {
  const token = readToken()
  // Deny a partial portfolio when the deployment's token cannot read core private issues.
  const probe = await githubJson('https://api.github.com/repos/qdip-ai/qdip-core', token)
  if (!probe || typeof probe !== 'object' || (probe as { private?: unknown }).private !== true) {
    throw new Error('GITHUB_PRIVATE_REPO_ACCESS_NOT_VERIFIED')
  }
  const groups = await Promise.all(SEARCH_ORGS.map((org) => searchOrg(org, token)))
  const records = groups.flat().flatMap((item) => {
    const parsed = parsePortfolioIssue(item)
    return parsed ? [parsed] : []
  })
  if (records.length === 0) throw new Error('GITHUB_PORTFOLIO_METADATA_EMPTY')
  return { projects: assemblePortfolio(records), fetchedAt: new Date().toISOString(), source: 'github-issues' }
}

export function portfolioErrorLabel(error: unknown) {
  const code = error instanceof Error ? error.message : ''
  if (code === 'GITHUB_READ_NOT_CONFIGURED')
    return 'GitHub доступ не налаштовано: необхідний серверний read-only credential до приватних репозиторіїв.'
  if (code.includes('403') || code.includes('401') || code.includes('404') ||
      code === 'GITHUB_PRIVATE_REPO_ACCESS_NOT_VERIFIED')
    return 'GitHub відхилив доступ до одного з приватних репозиторіїв. Перевірте read-only дозволи сервісу.'
  if (code === 'GITHUB_SEARCH_INCOMPLETE' || code === 'GITHUB_SEARCH_TRUNCATED')
    return 'GitHub повернув неповну вибірку Issues. Часткову карту приховано.'
  return 'Не вдалося отримати підтверджені дані GitHub Issues. Повторіть спробу пізніше.'
}
