import { observableUseCases, type UseCaseTheme } from '@/use-cases/registry'

export type ObservatoryApplicationKind = 'challenge' | 'intake' | 'tool' | 'use-case'
export type ObservatoryApplicationIcon = 'scale' | 'upload' | 'stethoscope' | 'heart' | 'network' | 'sparkles'
export type ObservatoryApplication = {
  id: string
  route: string
  kind: ObservatoryApplicationKind
  order: number
  theme: UseCaseTheme
  icon: ObservatoryApplicationIcon
  useCaseId?: string
}

const SYSTEM_APPLICATIONS: readonly ObservatoryApplication[] = [
  { id: 'decision-challenge', route: '/challenges', kind: 'challenge', order: 10, theme: 'cyan', icon: 'scale' },
  { id: 'decision-intake', route: '/decision-intake', kind: 'intake', order: 20, theme: 'violet', icon: 'upload' },
  { id: 'model-doctor', route: '/model-doctor', kind: 'tool', order: 25, theme: 'violet', icon: 'stethoscope' },
]

const USE_CASE_ICONS: Record<string, ObservatoryApplicationIcon> = {
  'resource-allocation': 'heart',
  'supply-network-optimization': 'network',
  'contractor-allocation': 'network',
  'readiness-recovery': 'network',
  'gtm-lab': 'sparkles',
}

export const observableApplications = (visibleUseCaseIds?: readonly string[]): ObservatoryApplication[] =>
  [
    ...SYSTEM_APPLICATIONS,
    ...observableUseCases()
      .filter((item) => visibleUseCaseIds === undefined || visibleUseCaseIds.includes(item.id))
      .map((item) => ({
        id: item.id,
        route: item.route,
        kind: 'use-case' as const,
        order: item.navigation.order + 20,
        theme: item.presentation.theme,
        icon: USE_CASE_ICONS[item.id] ?? 'sparkles',
        useCaseId: item.id,
      })),
  ].sort((a, b) => a.order - b.order)

export const findObservatoryApplicationByRoute = (route: string) =>
  observableApplications().find((item) => route === item.route || route.startsWith(`${item.route}/`))
