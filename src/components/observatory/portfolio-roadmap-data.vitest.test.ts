import { describe, expect, it } from 'vitest'

import { dependentsOf, portfolioProjects, PORTFOLIO_VERIFIED_AT } from './portfolio-roadmap-data'

describe('interactive portfolio dependency graph', () => {
  it('has uniquely identified projects and no broken dependency edges', () => {
    const ids = portfolioProjects.map((project) => project.id)
    const idSet = new Set(ids)
    expect(ids.length).toBeGreaterThanOrEqual(15)
    expect(idSet.size).toBe(ids.length)
    for (const project of portfolioProjects) {
      expect(project.dependencies).not.toContain(project.id)
      expect(project.steps).toHaveLength(3)
      expect(project.source.startsWith('https://github.com/')).toBe(true)
      expect(project.next.length).toBeGreaterThan(15)
      for (const dependsOn of project.dependencies) {
        expect(idSet.has(dependsOn)).toBe(true)
        expect(dependentsOf(dependsOn).map((item) => item.id)).toContain(project.id)
      }
    }
  })

  it('blocks bidirectional personal-data exchange on security and both owner products', () => {
    const project = portfolioProjects.find((item) => item.id === 'bridge')
    expect(project?.status).toBe('blocked')
    expect(project?.dependencies).toEqual(expect.arrayContaining(['sdk', 'worker', 'yara', 'dzvin']))
    expect(project?.next).toContain('calendar')
  })

  it('keeps the dated snapshot explicit instead of pretending to be live', () => {
    expect(PORTFOLIO_VERIFIED_AT).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    const autodev = portfolioProjects.find((item) => item.id === 'autodev')
    const fe = portfolioProjects.find((item) => item.id === 'fe')
    expect(autodev?.status).toBe('blocked')
    expect(fe?.status).toBe('gated')
  })
})
