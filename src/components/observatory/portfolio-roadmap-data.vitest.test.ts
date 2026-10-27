import { describe, expect, it } from 'vitest'

import { assemblePortfolio, dependentsOf, parsePortfolioIssue, type PortfolioRecord } from './portfolio-roadmap-data'

function issue(meta: object, number: number, state = 'open') {
  return {
    html_url: 'https://github.com/qdip-ai/qdip-core/issues/' + number,
    body: 'Existing roadmap issue body\n\n## QDIP Portfolio · dynamic project metadata\n\n' +
      '<!-- qdip-portfolio:v1 -->\n' + '```json\n' + JSON.stringify(meta, null, 2) + '\n```\n',
    state,
    updated_at: '2026-10-27T17:00:00Z',
  }
}
function metadata(id: string, dependsOn: string[] = []) {
  return {
    id, title: 'Project ' + id, group: 'Платформа', status: 'active',
    stage: 'Open acceptance', next: 'Run current acceptance tests and save independent evidence.',
    dependsOn, steps: ['Previous', 'Current', 'Future'],
  }
}

describe('dynamic GitHub Issue roadmap', () => {
  it('reads a changed current stage from canonical issue instead of a compiled project constant', () => {
    const first = parsePortfolioIssue(issue(metadata('sdk'), 555))
    const changed = parsePortfolioIssue(issue({ ...metadata('sdk'), stage: 'Independent E2E completed', next: 'Freeze stage' }, 555))
    expect(first?.stage).toBe('Open acceptance')
    expect(changed?.stage).toBe('Independent E2E completed')
    expect(changed?.next).toBe('Freeze stage')
  })

  it('rejects non-GitHub dependencies, unexpected statuses, malformed JSON and PRs', () => {
    expect(parsePortfolioIssue(issue({ ...metadata('sdk'), dependsOn: ['https://example.com/exfil'] }, 555))).toBeNull()
    expect(parsePortfolioIssue(issue({ ...metadata('sdk'), status: 'production_verified' }, 555))).toBeNull()
    expect(parsePortfolioIssue({ ...issue(metadata('sdk'), 555), pull_request: {} })).toBeNull()
    expect(parsePortfolioIssue({ ...issue(metadata('sdk'), 555), body: 'not a project' })).toBeNull()
  })

  it('closed issues never incorrectly remain marked active', () => {
    expect(parsePortfolioIssue(issue(metadata('sdk'), 555, 'closed'))?.status).toBe('closed')
  })

  it('computes actual cross-repo blockers from issue URLs rather than hardcoded ids', () => {
    const app = parsePortfolioIssue(issue(metadata('sdk'), 555))
    const integration = parsePortfolioIssue(issue(metadata('bridge', [
      'https://github.com/qdip-ai/qdip-core/issues/555',
      'https://github.com/mentality-prj/mentality-web/issues/577',
    ]), 99))
    expect(app).not.toBeNull()
    expect(integration).not.toBeNull()
    const rows = assemblePortfolio([app, integration] as PortfolioRecord[])
    const bridge = rows.find((x) => x.id === 'bridge')
    expect(bridge?.dependencies).toEqual(['sdk'])
    expect(bridge?.missingDependencies).toEqual(['https://github.com/mentality-prj/mentality-web/issues/577'])
    expect(dependentsOf('sdk', rows).map((x) => x.id)).toEqual(['bridge'])
  })

  it('rejects duplicate project identities rather than picking an arbitrary source', () => {
    const row = parsePortfolioIssue(issue(metadata('sdk'), 555))
    expect(() => assemblePortfolio([row, row] as PortfolioRecord[])).toThrow(/Duplicate portfolio/)
  })
})
