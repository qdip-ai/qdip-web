import type { UseCaseId } from '@/use-cases/registry'

export type AnalystDataCapability = {
  applicationId: UseCaseId
  scenarioContext: boolean
  synthetic: boolean
  smartImport: boolean
  exactImport: boolean
  exactExport: boolean
  dataDictionary: boolean
  schemaVersion: string
}

export const ANALYST_DATA_CAPABILITIES: Record<UseCaseId, AnalystDataCapability> = {
  'resource-allocation': {
    applicationId: 'resource-allocation',
    scenarioContext: true,
    synthetic: true,
    smartImport: true,
    exactImport: true,
    exactExport: true,
    dataDictionary: true,
    schemaVersion: 'resource-allocation.v1',
  },
  'supply-network-optimization': {
    applicationId: 'supply-network-optimization',
    scenarioContext: true,
    synthetic: true,
    smartImport: true,
    exactImport: true,
    exactExport: true,
    dataDictionary: true,
    schemaVersion: 'supply-network.v1',
  },
  'contractor-allocation': {
    applicationId: 'contractor-allocation',
    scenarioContext: true,
    synthetic: true,
    smartImport: true,
    exactImport: true,
    exactExport: true,
    dataDictionary: true,
    schemaVersion: 'contractor-allocation.v1',
  },
  'gtm-lab': {
    applicationId: 'gtm-lab',
    scenarioContext: true,
    synthetic: true,
    smartImport: true,
    exactImport: true,
    exactExport: true,
    dataDictionary: true,
    schemaVersion: 'gtm-lab.v1',
  },
}
