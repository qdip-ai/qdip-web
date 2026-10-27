import 'server-only'

import { createSign } from 'node:crypto'

import {
  assemblePortfolio,
  parsePortfolioIssue,
  type PortfolioProject,
} from '@/components/observatory/portfolio-roadmap-data'

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

function jwtForGithubApp(): string {
  const appId = process.env.QDIP_PORTFOLIO_GITHUB_APP_ID?.trim()
  const privateKey = process.env.QDIP_PORTFOLIO_GITHUB_APP_PRIVATE_KEY?.replace(/\\n/g, '\n')
  if (!appId || !privateKey || !/^\d+$/.test(appId)) throw new Error('GITHUB_APP_NOT_CONFIGURED')

  const now = Math.floor(Date.now() / 1000)
  const encode = (v: object) => Buffer.from(JSON.stringify(v)).toString('base64url')
  const message = encode({ alg: 'RS256', typ: 'JWT' }) + '.' + encode({ iat: now - 60, exp: now + 540, iss: appId })
  const signer = createSign('RSA-SHA256')
  signer.update(message)
  signer.end()
  return message + '.' + signer.sign(privateKey).toString('base64url')
}

async function installToken(org: string): Promise<string> {
  const appJwt = jwtForGithubApp()
  const appHeaders = {
    Accept: 'application/vnd.github+json',
    Authorization: 'Bearer ' + appJwt,
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'qdip-observatory-portfolio',
  }
  const installationResponse = await fetch('https://api.github.com/orgs/' + org + '/installation', {
    headers: appHeaders,
    cache: 'no-store',
  })
  if (!installationResponse.ok) throw new Error('GITHUB_APP_INSTALLATION_' + installationResponse.status)
  const installation: unknown = await installationResponse.json()
  if (!installation || typeof installation !== 'object' || typeof (installation as { id?: unknown }).id !== 'number') {
    throw new Error('GITHUB_APP_INSTALLATION_INVALID')
  }
  const id = (installation as { id: number }).id
  const tokenResponse = await fetch('https://api.github.com/app/installations/' + id + '/access_tokens', {
    method: 'POST',
    headers: { ...appHeaders, 'Content-Type': 'application/json' },
    cache: 'no-store',
    // The generated token cannot write to issues or repository contents.
    body: JSON.stringify({ permissions: { issues: 'read', metadata: 'read' } }),
  })
  if (!tokenResponse.ok) throw new Error('GITHUB_APP_TOKEN_' + tokenResponse.status)
  const data: unknown = await tokenResponse.json()
  if (!data || typeof data !== 'object' || typeof (data as { token?: unknown }).token !== 'string') {
    throw new Error('GITHUB_APP_TOKEN_INVALID')
  }
  return (data as { token: string }).token
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
    // Never log upstream response bodies, auth tokens or private issue payload.
    throw new Error('GITHUB_READ_FAILED_' + response.status)
  }
  return response.json()
}

async function searchOrg(org: string, token: string) {
  const found: unknown[] = []
  for (let page = 1; page <= MAX_PAGES; page++) {
    const q = encodeURIComponent('org:' + org + ' is:issue in:body "QDIP Portfolio"')
    const data = (await githubJson(
      'https://api.github.com/search/issues?q=' + q + '&per_page=100&page=' + page,
      token
    )) as SearchResponse
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

/** Run only after the existing Observatory Zitadel admin check. Never fall back to a stale static snapshot. */
export async function loadGithubPortfolio(): Promise<PortfolioFeed> {
  // One App, separate short-lived installation tokens per organization. No developer-issued per-plugin keys.
  const credentials = await Promise.all(SEARCH_ORGS.map((org) => installToken(org)))
  const [qdipToken, mentalityToken] = credentials
  // Do not silently omit private repositories if one installation has insufficient access.
  const probes = await Promise.all([
    githubJson('https://api.github.com/repos/qdip-ai/qdip-core', qdipToken),
    githubJson('https://api.github.com/repos/mentality-prj/mentality-translator', mentalityToken),
  ])
  for (const probe of probes) {
    if (!probe || typeof probe !== 'object' || (probe as { private?: unknown }).private !== true) {
      throw new Error('GITHUB_PRIVATE_REPO_ACCESS_NOT_VERIFIED')
    }
  }
  const groups = await Promise.all(SEARCH_ORGS.map((org, index) => searchOrg(org, credentials[index])))
  const records = groups.flat().flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return []
    const parsed = parsePortfolioIssue(item as Record<string, unknown>)
    return parsed ? [parsed] : []
  })
  if (records.length === 0) throw new Error('GITHUB_PORTFOLIO_METADATA_EMPTY')
  return { projects: assemblePortfolio(records), fetchedAt: new Date().toISOString(), source: 'github-issues' }
}

export function portfolioErrorLabel(error: unknown) {
  const code = error instanceof Error ? error.message : ''
  if (code === 'GITHUB_APP_NOT_CONFIGURED')
    return 'GitHub App для читання приватних roadmap Issues не налаштовано в серверному середовищі.'
  if (
    code.startsWith('GITHUB_APP_') ||
    code.includes('403') ||
    code.includes('401') ||
    code.includes('404') ||
    code === 'GITHUB_PRIVATE_REPO_ACCESS_NOT_VERIFIED'
  )
    return 'GitHub App не може прочитати всі приватні Issues. Перевірте дві інсталяції та read-only дозволи.'
  if (code === 'GITHUB_SEARCH_INCOMPLETE' || code === 'GITHUB_SEARCH_TRUNCATED')
    return 'GitHub повернув неповну вибірку Issues. Часткову карту приховано.'
  return 'Не вдалося отримати підтверджені дані GitHub Issues. Повторіть спробу пізніше.'
}
