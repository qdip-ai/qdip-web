import type { DecisionPatternId } from '@/product/experience'

export type UseCaseIcon = 'heart' | 'sparkles' | 'network'
export type UseCaseTheme = 'cyan' | 'violet' | 'amber' | 'emerald' | 'rose'
export type DipUseCase = {
  id: string
  route: string
  navigation: { visible: boolean; order: number }
  decisionPattern: DecisionPatternId
  presentation: { icon: UseCaseIcon; theme: UseCaseTheme }
  plugin: { id: string; capability: string }
}

const visible = (order: number) => ({ visible: true, order }) as const

const useCases = [
  {
    id: 'resource-allocation',
    route: '/resource-allocation',
    navigation: visible(10),
    decisionPattern: 'allocate',
    presentation: { icon: 'heart', theme: 'rose' },
    plugin: { id: 'resource-allocation', capability: 'humanitarian.resource-allocation.optimize' },
  },
  {
    id: 'supply-network-optimization',
    route: '/supply-network-optimization',
    navigation: visible(20),
    decisionPattern: 'allocate',
    presentation: { icon: 'network', theme: 'amber' },
    plugin: { id: 'supply-network', capability: 'supply.network.optimize' },
  },
  {
    id: 'contractor-allocation',
    route: '/contractor-allocation',
    navigation: visible(25),
    decisionPattern: 'allocate',
    presentation: { icon: 'network', theme: 'cyan' },
    plugin: { id: 'contractor-allocation', capability: 'operations.contractor-allocation.optimize' },
  },
  {
    id: 'gtm-lab',
    route: '/gtm-lab',
    navigation: visible(30),
    decisionPattern: 'prioritize',
    presentation: { icon: 'sparkles', theme: 'emerald' },
    plugin: { id: 'gtm-lab', capability: 'gtm.demo.run' },
  },
] as const satisfies readonly DipUseCase[]

export type RegisteredUseCase = (typeof useCases)[number]
export type UseCaseId = RegisteredUseCase['id']
export type UseCaseRoute = RegisteredUseCase['route']
export const DIP_USE_CASES: readonly RegisteredUseCase[] = useCases
export const observableUseCases = () =>
  [...DIP_USE_CASES].filter((item) => item.navigation.visible).sort((a, b) => a.navigation.order - b.navigation.order)
export const findUseCaseById = (id: string) => DIP_USE_CASES.find((item) => item.id === id)
export const findUseCaseByRoute = (route: string) => DIP_USE_CASES.find((item) => item.route === route)
export function findUseCaseByPlugin(pluginId: string, capabilityId?: string): DipUseCase | undefined {
  return DIP_USE_CASES.find(
    (item) => item.plugin.id === pluginId && (!capabilityId || item.plugin.capability === capabilityId)
  )
}
