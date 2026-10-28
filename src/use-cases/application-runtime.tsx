'use client'

import type { ComponentType } from 'react'
import { ObservatoryDecisionNarrative } from '@/components/observatory/decision-narrative'
import { ScenarioContextPanel } from '@/components/observatory/scenario-context-panel'
import { GtmLabWorkspace } from '@/features/gtm-lab/components/gtm-lab-workspace'
import { ResourceAllocationWorkspace } from '@/features/resource-allocation/components/resource-allocation-workspace'
import { SupplyNetworkAnalystDataWorkspace } from '@/features/supply-network-optimization/analyst-data-workspace'
import { SupplyNetworkOptimizationWorkspace } from '@/features/supply-network-optimization/workspace'
import type { Locale } from '@/lib/observatory-i18n'
import { applicationScenarioContext } from '@/use-cases/application-context'
import { ReadinessRecoveryKernelWorkspace } from '@/use-cases/readiness-recovery/kernel-workspace'
import { findUseCaseById, type UseCaseId } from '@/use-cases/registry'

export type ApplicationFrontendProps = { locale: Locale }

const frontends = {
  'resource-allocation': ResourceAllocationWorkspace,
  'supply-network-optimization': SupplyNetworkOptimizationWorkspace,
  'readiness-recovery': ReadinessRecoveryKernelWorkspace,
  'gtm-lab': GtmLabWorkspace,
} satisfies Record<UseCaseId, ComponentType<ApplicationFrontendProps>>

export function ApplicationFrontend({ id, locale }: { id: UseCaseId; locale: Locale }) {
  const Frontend = frontends[id]
  const useCase = findUseCaseById(id)
  const context = applicationScenarioContext(id, locale)

  return (
    <>
      {useCase && id !== 'readiness-recovery' ? (
        <ObservatoryDecisionNarrative locale={locale} useCase={useCase} />
      ) : null}
      {context && id !== 'readiness-recovery' ? (
        <div className="mx-auto w-full max-w-[1540px] px-4 sm:px-5 md:px-8 lg:px-10">
          <ScenarioContextPanel locale={locale} context={context} />
        </div>
      ) : null}
      {id === 'supply-network-optimization' ? <SupplyNetworkAnalystDataWorkspace locale={locale} /> : null}
      <Frontend locale={locale} />
    </>
  )
}

export function hasApplicationFrontend(id: string): id is UseCaseId {
  return id in frontends
}
