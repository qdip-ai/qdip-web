import { describe, expect, it } from 'vitest'

import { createTranslator } from '@/i18n/runtime'
import { DIP_USE_CASES, findUseCaseById, findUseCaseByRoute } from './registry'

const routingContract = [
  {
    id: 'resource-allocation',
    route: '/resource-allocation',
    load: () =>
      import('../features/resource-allocation/components/resource-allocation-workspace').then(
        (module) => module.ResourceAllocationWorkspace
      ),
  },
  {
    id: 'supply-network-optimization',
    route: '/supply-network-optimization',
    load: () =>
      import('../features/supply-network-optimization/workspace').then(
        (module) => module.SupplyNetworkOptimizationWorkspace
      ),
  },
  {
    id: 'contractor-allocation',
    route: '/contractor-allocation',
    load: () => import('./contractor-allocation/workspace').then((module) => module.ContractorAllocationWorkspace),
  },
  {
    id: 'gtm-lab',
    route: '/gtm-lab',
    load: () => import('../features/gtm-lab/components/gtm-lab-workspace').then((module) => module.GtmLabWorkspace),
  },
] as const

describe('Observatory routing contract', () => {
  it('requires an explicit renderer contract for every registered use case', () => {
    expect(DIP_USE_CASES.map(({ id, route }) => ({ id, route }))).toEqual(
      routingContract.map(({ id, route }) => ({ id, route }))
    )
  })

  it('keeps ids and routes unique and canonical', () => {
    const ids = DIP_USE_CASES.map((item) => item.id)
    const routes = DIP_USE_CASES.map((item) => item.route)

    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(routes).size).toBe(routes.length)

    for (const item of DIP_USE_CASES) {
      expect(item.route).toMatch(/^\/[a-z0-9]+(?:-[a-z0-9]+)*$/)
      expect(findUseCaseById(item.id)).toBe(item)
      expect(findUseCaseByRoute(item.route)).toBe(item)
    }
  })

  it('loads every registered client workspace as a callable React component', async () => {
    for (const route of routingContract) {
      const component = await route.load()
      expect(component, `${route.id} workspace export must be a function`).toBeTypeOf('function')
    }
  })

  it('has complete localized navigation metadata for every route', () => {
    for (const item of DIP_USE_CASES) {
      for (const locale of ['en', 'uk', 'pl'] as const) {
        const messages = createTranslator(locale, `useCases.${item.id}`)
        expect(messages('title').trim()).not.toBe('')
        expect(messages('description').trim()).not.toBe('')
        expect(messages('tag').trim()).not.toBe('')
      }
    }
  })
})
