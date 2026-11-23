import { NextRequest, NextResponse } from 'next/server'
import { clearSession, oidcEndSessionUrl } from '@/lib/qdip-oidc'
import { isSurfaceHost } from '@/routing-config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * The Next.js internal listener can appear in nextUrl behind a reverse proxy;
 * validate the externally routed Host + exact browser Origin instead.
 * Never trust x-forwarded-host, and require TLS outside local *.localhost.
 */
export function POST(request: NextRequest) {
  const host = request.headers.get('host') ?? request.nextUrl.host
  if (
    !host ||
    /[,\s@/?#]/.test(host) ||
    !(['site', 'studio', 'observatory'] as const).some((surface) => isSurfaceHost(surface, host))
  )
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const forwardedProto = request.headers.get('x-forwarded-proto')
  if (forwardedProto && !['http', 'https'].includes(forwardedProto))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const localHost = new URL(`http://${host}`).hostname.endsWith('.localhost')
  const secure = request.nextUrl.protocol === 'https:' || forwardedProto === 'https'
  const scheme = secure ? 'https:' : request.nextUrl.protocol === 'http:' && localHost ? 'http:' : null
  if (!scheme || request.headers.get('origin') !== `${scheme}//${host.toLowerCase()}`)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const returnSurface =
    scheme !== 'https:'
      ? undefined
      : host.toLowerCase() === 'qdip.ai'
        ? 'site'
        : host.toLowerCase() === 'studio.qdip.ai'
          ? 'studio'
          : host.toLowerCase() === 'observatory.qdip.ai'
            ? 'observatory'
            : undefined
  const response = NextResponse.json(
    {
      authenticated: false,
      logoutUrl: oidcEndSessionUrl(returnSurface),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
  clearSession(response, request)
  return response
}
