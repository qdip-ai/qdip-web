import 'server-only'

import { corePluginConnection } from '@/lib/observatory-plugin-catalog'

export type CoreApplicationPublication = {
  application_id: string
  version: string
  launch_route: string
  required_capabilities: {
    plugin_id: string
    capability_id: string
    plugin_version: string
    capability_version: string
  }[]
  runtime_binding: { kind: string; organization_id: string } | Record<string, never>
  status: 'draft' | 'published' | 'unpublished'
  revision: number
  published_at: string | null
  published_by: string | null
  admission: { ready: boolean; reasons: string[] }
  visible: boolean
}

export async function readCoreApplications(): Promise<CoreApplicationPublication[]> {
  const { base, key } = corePluginConnection()
  const response = await fetch(`${base}/api/v1/applications`, {
    headers: { 'x-api-key': key, accept: 'application/json' },
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(12_000),
  })
  if (!response.ok) throw new Error('Core application catalog unavailable')
  const result: unknown = await response.json()
  if (!result || typeof result !== 'object' || !('items' in result) || !Array.isArray(result.items))
    throw new Error('Invalid application catalog response')
  return result.items.map((item: unknown) => {
    if (
      !item || typeof item !== 'object' ||
      !('application_id' in item) || typeof item.application_id !== 'string' ||
      !('status' in item) || !['draft', 'published', 'unpublished'].includes(item.status as string) ||
      !('visible' in item) || typeof item.visible !== 'boolean' ||
      !('revision' in item) || !Number.isSafeInteger(item.revision) ||
      !('admission' in item) || !item.admission || typeof item.admission !== 'object' ||
      !('ready' in item.admission) || typeof item.admission.ready !== 'boolean' ||
      !('reasons' in item.admission) || !Array.isArray(item.admission.reasons) ||
      !item.admission.reasons.every((reason: unknown) => typeof reason === 'string')
    ) throw new Error('Invalid application publication record')
    return item as CoreApplicationPublication
  })
}
