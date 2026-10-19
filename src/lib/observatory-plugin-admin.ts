import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { canAdministerObservatory, sessionFromRequest } from '@/lib/qdip-oidc'
import { isSurfaceHost } from '@/routing-config'

export function adminRequest(request: NextRequest, mutate = false) {
  const host = request.headers.get('host')
  if (!host || /[,\s@/?#]/.test(host) || !isSurfaceHost('observatory', host))
    return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }), session: null }
  const secure = request.nextUrl.protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https'
  const localhost = host.split(':')[0].endsWith('.localhost')
  if (!secure && !localhost)
    return { error: NextResponse.json({ error: 'HTTPS required' }, { status: 403 }), session: null }
  const session = sessionFromRequest(request)
  if (!session) return { error: NextResponse.json({ error: 'Sign in required' }, { status: 401 }), session: null }
  if (!canAdministerObservatory(session))
    return { error: NextResponse.json({ error: 'Admin role required' }, { status: 403 }), session: null }
  if (mutate && request.headers.get('origin') !== `${secure ? 'https' : 'http'}://${host.toLowerCase()}`)
    return { error: NextResponse.json({ error: 'Same-origin request required' }, { status: 403 }), session: null }
  return { error: null, session }
}

/** Developer self-service: OIDC identity + per-operation live Zitadel owner check.
 * A platform-wide Observatory admin grant is NOT needed or sufficient.
 */
export function developerRequest(request: NextRequest, mutate = false) {
  const host = request.headers.get('host')
  if (!host || /[,\\s@/?#]/.test(host) || !isSurfaceHost('observatory', host))
    return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }), session: null }
  const secure = request.nextUrl.protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https'
  if (!secure && !host.split(':')[0].endsWith('.localhost'))
    return { error: NextResponse.json({ error: 'HTTPS required' }, { status: 403 }), session: null }
  const session = sessionFromRequest(request)
  if (!session) return { error: NextResponse.json({ error: 'Sign in required' }, { status: 401 }), session: null }
  if (mutate && request.headers.get('origin') !== `${secure ? 'https' : 'http'}://${host.toLowerCase()}`)
    return { error: NextResponse.json({ error: 'Same-origin request required' }, { status: 403 }), session: null }
  return { error: null, session }
}
