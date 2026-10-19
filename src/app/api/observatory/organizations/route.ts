import { NextRequest, NextResponse } from 'next/server'
import { sessionFromRequest } from '@/lib/qdip-oidc'
import { isSurfaceHost } from '@/routing-config'
import { listOwnedZitadelOrganizations, OwnerOrganizationError } from '@/lib/zitadel-owner-organizations'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function response(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'private, no-store, max-age=0', Pragma: 'no-cache' },
  })
}

/** Read-only. This never creates a QDIP Core or ZITADEL organization. */
export async function GET(request: NextRequest) {
  const host = request.headers.get('host')
  if (!host || /[,\s@/?#]/.test(host) || !isSurfaceHost('observatory', host)) {
    return response({ error: 'Not found' }, 404)
  }
  const secure = request.nextUrl.protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https'
  if (!secure && !host.split(':')[0].endsWith('.localhost')) {
    return response({ error: 'HTTPS required' }, 403)
  }
  const session = sessionFromRequest(request)
  if (!session) return response({ error: 'Sign in required' }, 401)
  try {
    const organizations = await listOwnedZitadelOrganizations({ issuer: session.issuer, sub: session.sub })
    return response({ organizations }, 200)
  } catch (error) {
    if (error instanceof OwnerOrganizationError) {
      return response({ error: error.message }, error.status)
    }
    return response({ error: 'Organization verification unavailable' }, 503)
  }
}
