import { NextRequest, NextResponse } from 'next/server'
import { oidcConfigured, sessionFromRequest, canAccessStudio, canAdministerObservatory } from '@/lib/qdip-oidc'
import { isSurfaceHost } from '@/routing-config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function GET(request: NextRequest) {
  // Next.js may expose its internal 127.0.0.1 listener through nextUrl.host
  // behind a reverse proxy. Validate the actual Host against our exact
  // surface allowlist, never trust x-forwarded-host.
  const host = request.headers.get('host') ?? request.nextUrl.host
  if (
    /[,\s@/?#]/.test(host) ||
    !(['site', 'studio', 'observatory'] as const).some((surface) => isSurfaceHost(surface, host))
  )
    return NextResponse.json({ error: 'Invalid host' }, { status: 403 })
  const session = sessionFromRequest(request)
  return NextResponse.json(
    {
      configured: oidcConfigured(),
      authenticated: Boolean(session),
      ...(session
        ? {
            user: {
              id: session.sub,
              displayName: session.displayName ?? null,
              email: session.email ?? null,
              picture: session.picture ?? null,
            },
          }
        : {}),
      studio: Boolean(session && canAccessStudio(session)),
      observatoryAdmin: Boolean(session && canAdministerObservatory(session)),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
