export const PUBLIC_DEMO_NAMES = {
  resourceAllocation: 'Resource Allocation',
  supplyNetworkOptimization: 'Supply Network Optimization',
  readinessRecovery: 'Readiness Recovery Planner',
  gtmLab: 'GTM Lab',
} as const

export const PUBLIC_PRODUCT_NAMES = [
  'QDIP',
  'Studio',
  'Observatory',
  'Core',
  PUBLIC_DEMO_NAMES.resourceAllocation,
  PUBLIC_DEMO_NAMES.supplyNetworkOptimization,
  PUBLIC_DEMO_NAMES.readinessRecovery,
  PUBLIC_DEMO_NAMES.gtmLab,
] as const

export const LOCALIZATION_ALLOWED_TECHNICAL_TOKENS = ['JSON', 'GDPR'] as const
