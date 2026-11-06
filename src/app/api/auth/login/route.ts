import { NextRequest, NextResponse } from 'next/server'
import {
  authOrigin,
  authorizationUrl,
  discoverOidc,
  oidcConfigured,
  onSiteOrigin,
  safeReturnTo,
  startFlow,
} from '@/lib/qdip-oidc'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const returnTo = safeReturnTo(request.nextUrl.searchParams.get('return_to'))
  if (!onSiteOrigin(request)) {
    const redirect = new URL('/api/auth/login', authOrigin())
    redirect.searchParams.set('return_to', returnTo)
    return NextResponse.redirect(redirect, 307)
  }
  if (!oidcConfigured()) return NextResponse.json({ error: 'QDIP OIDC is not configured' }, { status: 503 })
  try {
    const discovery = await discoverOidc()
    const result = NextResponse.redirect(authOrigin(), 302)
    const flow = startFlow(result, request, returnTo)
    result.headers.set('Location', authorizationUrl(discovery, flow).toString())
    result.headers.set('Cache-Control', 'no-store')
    return result
  } catch {
    return NextResponse.json({ error: 'Identity provider unavailable' }, { status: 502 })
  }
}
