import { NextRequest, NextResponse } from 'next/server'
import { sessionFromRequest } from '@/lib/qdip-oidc'
import { corePluginConnection } from '@/lib/observatory-plugin-catalog'
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

/**
 * Explicit owner-approved linking. The authenticated principal comes only
 * from the signed Zitadel cookie, not the request payload.
 *
 * The Core platform API key is server-only. Core independently verifies
 * this live ORG_OWNER membership before persisting the Zitadel org ID.
 * This route neither migrates existing Workers nor mints plugin credentials.
 */
export async function POST(request: NextRequest) {
  const host = request.headers.get('host')
  if (!host || /[,\s@/?#]/.test(host) || !isSurfaceHost('observatory', host)) {
    return response({ error: 'Not found' }, 404)
  }
  const secure = request.nextUrl.protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https'
  if (!secure && !host.split(':')[0].endsWith('.localhost')) {
    return response({ error: 'HTTPS required' }, 403)
  }
  if (request.headers.get('origin') !== `${secure ? 'https' : 'http'}://${host.toLowerCase()}`) {
    return response({ error: 'Same-origin request required' }, 403)
  }
  const session = sessionFromRequest(request)
  if (!session) return response({ error: 'Sign in required' }, 401)
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') {
    return response({ error: 'JSON required' }, 415)
  }

  let id: string
  try {
    const raw = await request.text()
    if (raw.length > 1024) return response({ error: 'Request too large' }, 413)
    const parsed: unknown = JSON.parse(raw)
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      Array.isArray(parsed) ||
      Object.keys(parsed).length !== 1 ||
      !('organizationId' in parsed) ||
      typeof parsed.organizationId !== 'string' ||
      !/^[0-9]{1,32}$/.test(parsed.organizationId)
    ) {
      return response({ error: 'Invalid organization selection' }, 422)
    }
    id = parsed.organizationId
  } catch {
    return response({ error: 'Invalid JSON' }, 400)
  }

  try {
    const accessible = await listOwnedZitadelOrganizations({ issuer: session.issuer, sub: session.sub })
    const selection = accessible.find((org) => org.id === id)
    if (!selection) return response({ error: 'Zitadel organization ownership required' }, 403)

    const { base, key } = corePluginConnection()
    const origin = new URL(base)
    if (
      origin.protocol !== 'https:' ||
      origin.username ||
      origin.password ||
      origin.search ||
      origin.hash ||
      !['/', '/api/v1', '/api/v1/'].includes(origin.pathname)
    ) {
      return response({ error: 'Core origin unavailable' }, 503)
    }
    const upstream = await fetch(origin.origin + '/api/v1/organizations/zitadel-link', {
      method: 'POST',
      headers: { 'x-api-key': key, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        organization_id: selection.id,
        issuer: session.issuer,
        authenticated_subject: session.sub,
      }),
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
    })
    if (!upstream.ok) {
      await upstream.body?.cancel().catch(() => undefined)
      return response({ error: 'Core/Zitadel organization binding refused' }, upstream.status === 403 ? 403 : 503)
    }
    const rawResult = await upstream.text()
    if (rawResult.length > 16_384) return response({ error: 'Core organization identity invalid' }, 503)
    const bound: unknown = JSON.parse(rawResult)
    if (
      !bound ||
      typeof bound !== 'object' ||
      Array.isArray(bound) ||
      !('id' in bound) ||
      bound.id !== selection.id ||
      !('identity_provider' in bound) ||
      bound.identity_provider !== 'zitadel' ||
      !('zitadel_organization_id' in bound) ||
      bound.zitadel_organization_id !== selection.id ||
      !('zitadel_issuer' in bound) ||
      bound.zitadel_issuer !== session.issuer
    ) {
      return response({ error: 'Core organization identity mismatch' }, 503)
    }
    return response({ organization: selection, linked: true, pluginMigrationComplete: false }, 200)
  } catch {
    return response({ error: 'Zitadel organization linkage unavailable' }, 503)
  }
}
