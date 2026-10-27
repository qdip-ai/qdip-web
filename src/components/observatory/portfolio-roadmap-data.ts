export type PortfolioStatus = 'active' | 'gated' | 'blocked' | 'research' | 'paused' | 'closed'

export type PortfolioProject = {
  id: string
  title: string
  group: string
  status: PortfolioStatus
  stage: string
  next: string
  source: string
  updatedAt: string
  dependencies: string[]
  missingDependencies: string[]
  steps: string[]
}

export const statusLabels: Record<PortfolioStatus, string> = {
  active: 'В розробці',
  gated: 'Очікує приймання',
  blocked: 'Заблоковано',
  research: 'Дослідження',
  paused: 'На паузі',
  closed: 'Завершено / KILL',
}

type GitHubIssue = {
  html_url?: unknown
  title?: unknown
  body?: unknown
  state?: unknown
  updated_at?: unknown
  pull_request?: unknown
}

export type PortfolioRecord = {
  id: string
  title: string
  group: string
  status: PortfolioStatus
  stage: string
  next: string
  dependsOn: string[]
  steps: string[]
  source: string
  updatedAt: string
}

const STATUS_VALUES = new Set<PortfolioStatus>(['active', 'gated', 'blocked', 'research', 'paused', 'closed'])
const PORTFOLIO_MARKER = new RegExp(String.raw`<!-- qdip-portfolio:v1 -->\s*` + '```' + String.raw`json\s*(\{[\s\S]*?\})\s*` + '```')

function validIssueUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try {
    const u = new URL(value)
    return u.protocol === 'https:' && u.hostname === 'github.com' &&
      /^\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+\/issues\/[1-9]\d*$/.test(u.pathname) &&
      !u.search && !u.hash && !u.username && !u.password
  } catch {
    return false
  }
}

function short(value: unknown, max = 320): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max
}

/** Explicit issue metadata is authoritative. Never guess "PASS" from a merged PR or deployment. */
export function parsePortfolioIssue(issue: GitHubIssue): PortfolioRecord | null {
  if (issue.pull_request !== undefined || !validIssueUrl(issue.html_url) ||
      typeof issue.body !== 'string') return null
  const match = PORTFOLIO_MARKER.exec(issue.body)
  if (!match) return null
  try {
    const input: unknown = JSON.parse(match[1])
    if (!input || typeof input !== 'object' || Array.isArray(input)) return null
    const data = input as Record<string, unknown>
    if (!short(data.id, 70) || !/^[a-z0-9][a-z0-9-]*$/.test(data.id) ||
        !short(data.title, 130) || !short(data.group, 120) || !short(data.stage) ||
        !short(data.next, 1200) || !STATUS_VALUES.has(data.status as PortfolioStatus) ||
        !Array.isArray(data.dependsOn) || data.dependsOn.length > 20 ||
        !data.dependsOn.every(validIssueUrl) ||
        !Array.isArray(data.steps) || data.steps.length < 1 || data.steps.length > 12 ||
        !data.steps.every((v) => short(v, 320))) return null
    return {
      id: data.id, title: data.title, group: data.group,
      // Closing an issue must never leave a misleading "in development" status.
      status: issue.state === 'closed' ? 'closed' : data.status as PortfolioStatus,
      stage: data.stage, next: data.next,
      dependsOn: data.dependsOn, steps: data.steps,
      source: issue.html_url,
      updatedAt: typeof issue.updated_at === 'string' ? issue.updated_at : '',
    }
  } catch {
    return null
  }
}

export function assemblePortfolio(records: PortfolioRecord[]): PortfolioProject[] {
  const bySource = new Map<string, PortfolioRecord>()
  const byId = new Map<string, PortfolioRecord>()
  for (const item of records) {
    if (byId.has(item.id) || bySource.has(item.source)) {
      throw new Error('Duplicate portfolio identity — refusing an ambiguous roadmap')
    }
    byId.set(item.id, item)
    bySource.set(item.source, item)
  }
  return records.map((item) => ({
    ...item,
    dependencies: item.dependsOn.flatMap((ref) => {
      const target = bySource.get(ref)
      return target && target.id !== item.id ? [target.id] : []
    }),
    missingDependencies: item.dependsOn.filter((ref) => !bySource.has(ref)),
  })).sort((a, b) => a.group.localeCompare(b.group, 'uk') || a.title.localeCompare(b.title, 'uk'))
}

export function dependentsOf(projectId: string, projects: PortfolioProject[]) {
  return projects.filter((project) => project.dependencies.includes(projectId))
}
