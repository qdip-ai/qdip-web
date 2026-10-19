import { NextRequest, NextResponse } from 'next/server'
import { sessionFromRequest } from '@/lib/qdip-oidc'
import { isSurfaceHost } from '@/routing-config'
import { listOwnedZitadelOrganizations, ZitadelOwnerLookupError } from '@/lib/zitadel-owned-organizations'

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
  if (!secure && !host.split(':')[0].endsWith('.localhost'))
    return respond({ error: 'HTTPS required' }, 403)
  const session = sessionFromRequest(request)
  if (!session) return respond({ error: 'Sign in required' }, 401)
  try {
    const organizations = await listOwnedZitadelOrganizations({
      issuer: session.issuer,
      sub: session.sub,
    })
    return respond({ organizations }, 200)
  } catch (error) {
    if (error instanceof ZitadelOwnerLookupError)
      return respond({ error: error.message }, error.status)
    return respond({ error: 'Zitadel ownership unavailable' }, 503)
  }
}
