import 'server-only'

import { createHash, createHmac } from 'node:crypto'
import type { NextRequest } from 'next/server'
import { canOperateRr, sessionFromRequest } from '@/lib/qdip-oidc'
import { rrCoreApiKey } from '@/lib/rr-core-credential'

export type RrActorOperation = 'execute' | 'replan'

/**
 * The BFF has already verified Zitadel's signed ID token and the operator
 * project-role permissions. Core still authenticates its own org-scoped API key.
 * This separately authenticated hint is *audit attribution*, never RBAC.
 */
export function signRrActor(
  issuer: string,
  subject: string,
  operation: RrActorOperation,
  sharedSecret: string,
  apiKey: string,
  now = Date.now()
): string {
  if (!issuer.startsWith('https://') || !subject || subject.length > 1024 || sharedSecret.length < 32 || !apiKey.trim())
    throw new Error('RR operator identity assertion is not configured')
  const actorHash = createHash('sha256').update(issuer).update('\0').update(subject).digest('hex')
  const expires = Math.floor(now / 1000) + 30
  const payload = `v2.${expires}.zitadel:${actorHash}.${operation}`
  const signature = createHmac('sha256', sharedSecret).update(payload).update('\0').update(apiKey).digest('hex')
  return payload + '.' + signature
}

export function signedRrActorFromRequest(request: NextRequest, operation: RrActorOperation): string {
  const session = sessionFromRequest(request)
  if (!session || !canOperateRr(session)) throw new Error('RR operator permission denied')
  return signRrActor(
    session.issuer,
    session.sub,
    operation,
    process.env.RR_ACTOR_ASSERTION_SECRET ?? '',
    rrCoreApiKey()
  )
}
