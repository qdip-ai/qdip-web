import 'server-only'
import { safePluginLaunchUrl } from '@qdip/client'
import { corePluginConnection } from '@/lib/observatory-plugin-catalog'

/** Core APP-PUBLISH-01 (#705) record: an application bound to a declared SDK runtime. */
export type CoreApplicationPublication = {
  application_id: string
  version: string
  launch_url: string
  required_capabilities: {
    plugin_id: string
    capability_id: string
    plugin_version: string
    capability_version: string
  }[]
  runtime_binding: { kind: string; organization_id: string; plugin_id: string; plugin_version: string }
  status: 'draft' | 'published' | 'unpublished'
  revision: number
  published_at: string | null
  published_by: string | null
  admission: { ready: boolean; reasons: string[] }
  visible: boolean
}

const APPLICATION_ID = /^[a-z0-9](?:[a-z0-9.-]{0,126}[a-z0-9])?$/

export async function readCoreApplications(connection: {
  base: string
  key: string
}): Promise<CoreApplicationPublication[]> {
  const { base, key } = connection
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
      !item ||
      typeof item !== 'object' ||
      !('application_id' in item) ||
      typeof item.application_id !== 'string' ||
      !APPLICATION_ID.test(item.application_id) ||
      !('launch_url' in item) ||
      typeof item.launch_url !== 'string' ||
      !('status' in item) ||
      !['draft', 'published', 'unpublished'].includes(item.status as string) ||
      !('visible' in item) ||
      typeof item.visible !== 'boolean' ||
      !('revision' in item) ||
      !Number.isSafeInteger(item.revision) ||
      !('admission' in item) ||
      !item.admission ||
      typeof item.admission !== 'object' ||
      !('ready' in item.admission) ||
      typeof item.admission.ready !== 'boolean' ||
      !('reasons' in item.admission) ||
      !Array.isArray(item.admission.reasons) ||
      !item.admission.reasons.every((reason: unknown) => typeof reason === 'string')
    )
      throw new Error('Invalid application publication record')
    return item as CoreApplicationPublication
  })
}

/**
 * Public catalog: only applications Core reports as visible (published,
 * runtime admitted, contract current) with a safe external HTTPS launch URL.
 * Any Core failure shows no application (fail closed).
 */
export async function visibleApplications(): Promise<CoreApplicationPublication[]> {
  try {
    const items = await readCoreApplications(corePluginConnection())
    return items.filter((item) => item.visible && item.status === 'published' && safePluginLaunchUrl(item.launch_url))
  } catch {
    return []
  }
}
