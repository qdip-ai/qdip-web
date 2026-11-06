import 'server-only'

import { createHash, createHmac, randomBytes } from 'node:crypto'
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

export type RrActorRequestContext = {
  organizationId: string
  method: string
  path: string
  body: string
  idempotencyKey: string
}

/** Request-bound standalone attribution; no change to the Gateway/SDK protocol. */
export function signRrRequestActor(
  issuer: string,
  subject: string,
  operation: RrActorOperation,
  sharedSecret: string,
  apiKey: string,
  context: RrActorRequestContext,
  now = Date.now(),
  assertionId = randomBytes(16).toString('hex')
): string {
  if (
    !issuer.startsWith('https://') ||
    !subject ||
    subject.length > 1024 ||
    sharedSecret.length < 32 ||
    !apiKey.trim() ||
    !/^[A-Za-z0-9_.-]{1,128}$/.test(context.organizationId) ||
    context.method !== 'POST' ||
    !context.path.startsWith('/api/v1/readiness-recovery/') ||
    context.path.includes('#') ||
    context.path.length > 512 ||
    !/^[A-Za-z0-9_.-]{1,128}$/.test(context.idempotencyKey) ||
    !/^[0-9a-f]{32}$/.test(assertionId)
  )
    throw new Error('RR request identity assertion is not configured')
  const claims = {
    actor_id: 'zitadel:' + createHash('sha256').update(issuer).update('\0').update(subject).digest('hex'),
    assertion_id: assertionId,
    expires_at: Math.floor(now / 1000) + 30,
    organization_id: context.organizationId,
    operation,
    method: context.method,
    path: context.path,
    body_sha256: createHash('sha256').update(context.body, 'utf8').digest('hex'),
    idempotency_key: context.idempotencyKey,
  }
  const payload = 'v3.' + Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url')
  const signature = createHmac('sha256', sharedSecret).update(payload).update('\0').update(apiKey).digest('hex')
  return payload + '.' + signature
}

export function signedRrActorFromRequest(
  request: NextRequest,
  operation: RrActorOperation,
  context?: RrActorRequestContext
): string {
  const session = sessionFromRequest(request)
  if (!session || !canOperateRr(session)) throw new Error('RR operator permission denied')
  if (context)
    return signRrRequestActor(
      session.issuer,
      session.sub,
      operation,
      process.env.RR_ACTOR_ASSERTION_SECRET ?? '',
      rrCoreApiKey(),
      context
    )
  return signRrActor(
    session.issuer,
    session.sub,
    operation,
    process.env.RR_ACTOR_ASSERTION_SECRET ?? '',
    rrCoreApiKey()
  )
}
