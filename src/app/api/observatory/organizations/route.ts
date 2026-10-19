import { NextRequest, NextResponse } from 'next/server'
import { sessionFromRequest } from '@/lib/qdip-oidc'
import { isSurfaceHost } from '@/routing-config'
import {
  listOwnedZitadelOrganizations,
  verifyZitadelOrganizationOwner,
  ZitadelOwnerLookupError,
} from '@/lib/zitadel-owned-organizations'
import { corePluginConnection } from '@/lib/observatory-plugin-catalog'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function respond(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'private, no-store, max-age=0',
      Pragma: 'no-cache',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

/** Only the identity and current Zitadel owner roles control visibility.
 * The broad Observatory admin role does not grant organization ownership.
 */
export async function GET(request: NextRequest) {
  const host = request.headers.get('host')
  if (!host || /[,\s@/?#]/.test(host) || !isSurfaceHost('observatory', host))
    return respond({ error: 'Not found' }, 404)
  const secure = request.nextUrl.protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https'
  if (!secure && !host.split(':')[0].endsWith('.localhost')) return respond({ error: 'HTTPS required' }, 403)
  const session = sessionFromRequest(request)
  if (!session) return respond({ error: 'Sign in required' }, 401)
  try {
    const organizations = await listOwnedZitadelOrganizations({
      issuer: session.issuer,
      sub: session.sub,
    })
    return respond({ organizations }, 200)
  } catch (error) {
    if (error instanceof ZitadelOwnerLookupError) return respond({ error: error.message }, error.status)
    return respond({ error: 'Zitadel ownership unavailable' }, 503)
  }
}

// Only a real ZITADEL ORG_OWNER may explicitly link a selected existing
// organization to a Core projection. A QA user cannot supply the founder's
// organization ID and bypass this check. The Core UUID is internal, never a
// newly created Zitadel organization or a plugin-owned pseudo-tenant.
export async function POST(request: NextRequest) {
  const host = request.headers.get('host')
  if (!host || /[,\s@/?#]/.test(host) || !isSurfaceHost('observatory', host))
    return respond({ error: 'Not found' }, 404)
  const secure = request.nextUrl.protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https'
  if (!secure && !host.split(':')[0].endsWith('.localhost')) return respond({ error: 'HTTPS required' }, 403)
  if (request.headers.get('origin') !== `${secure ? 'https' : 'http'}://${host.toLowerCase()}`)
    return respond({ error: 'Same-origin request required' }, 403)
  const session = sessionFromRequest(request)
  if (!session) return respond({ error: 'Sign in required' }, 401)
  if (request.headers.get('content-type')?.split(';')[0]?.trim() !== 'application/json')
    return respond({ error: 'JSON required' }, 415)
  let payload: unknown
  try {
    const raw = await request.text()
    if (raw.length > 2048) return respond({ error: 'Request too large' }, 413)
    payload = JSON.parse(raw)
  } catch {
    return respond({ error: 'Invalid JSON request' }, 400)
  }
  if (
    !payload ||
    typeof payload !== 'object' ||
    Array.isArray(payload) ||
    Object.keys(payload).length !== 1 ||
    !Object.hasOwn(payload, 'organizationId') ||
    typeof (payload as { organizationId: unknown }).organizationId !== 'string'
  )
    return respond({ error: 'Invalid organization selection' }, 422)

  try {
    const selected = await verifyZitadelOrganizationOwner(
      { issuer: session.issuer, sub: session.sub },
      (payload as { organizationId: string }).organizationId
    )
    const { base, key } = corePluginConnection()
    const endpoint = new URL('/api/v1/organizations/zitadel-projections', base)
    if (endpoint.protocol !== 'https:' && !(process.env.NODE_ENV === 'test' && endpoint.hostname === 'localhost'))
      return respond({ error: 'Core connection unavailable' }, 503)
    const coreResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        issuer: session.issuer,
        organization_id: selected.id,
        name: selected.name,
      }),
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(12_000),
    })
    if (!coreResponse.ok) {
      await coreResponse.body?.cancel().catch(() => undefined)
      return respond({ error: 'QDIP tenant projection failed' }, 503)
    }
    const raw = await coreResponse.text()
    if (raw.length > 4096) return respond({ error: 'Invalid QDIP tenant response' }, 502)
    let linked: unknown
    try {
      linked = JSON.parse(raw)
    } catch {
      return respond({ error: 'Invalid QDIP tenant response' }, 502)
    }
    if (
      !linked ||
      typeof linked !== 'object' ||
      typeof (linked as { id?: unknown }).id !== 'string' ||
      !/^[a-f0-9-]{36}$/i.test((linked as { id: string }).id) ||
      (linked as { zitadel_issuer?: unknown }).zitadel_issuer !== session.issuer ||
      (linked as { zitadel_organization_id?: unknown }).zitadel_organization_id !== selected.id ||
      (linked as { status?: unknown }).status !== 'active'
    )
      return respond({ error: 'QDIP tenant identity mismatch' }, 502)
    return respond(
      {
        organization: {
          id: selected.id,
          name: selected.name,
          coreTenantId: (linked as { id: string }).id,
        },
      },
      200
    )
  } catch (error) {
    if (error instanceof ZitadelOwnerLookupError) return respond({ error: error.message }, error.status)
    return respond({ error: 'Organization linkage unavailable' }, 503)
  }
}
