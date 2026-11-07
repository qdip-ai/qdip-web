import { NextRequest, NextResponse } from 'next/server'
import { sessionFromRequest } from '@/lib/qdip-oidc'
import { corePluginConnection } from '@/lib/observatory-plugin-catalog'
import { signZitadelOwnerLink, signZitadelOwnerList } from '@/lib/zitadel-org-link-assertion'
import { isSurfaceHost } from '@/routing-config'
import {
  listOwnedZitadelOrganizations,
  verifyOwnedZitadelOrganization,
  OwnerOrganizationError,
} from '@/lib/zitadel-owner-organizations'

const RR_QA_PROJECT = '4665798b-2012-466e-be91-2555d76f36c2'
const QDIP_ZITADEL_ORG = '368555767923594379'

/** Explicit RR QA-only backend; production never routes an owner action to staging. */
function rrStagingOwnerBridge(): string | null {
  if (process.env.RAILWAY_PROJECT_ID !== RR_QA_PROJECT || process.env.RAILWAY_ENVIRONMENT_NAME !== 'qa') return null
  const configured = process.env.RR_STAGING_OWNER_LINK_URL?.trim()
  if (!configured) return null
  const url = new URL(configured)
  if (
    url.protocol !== 'https:' ||
    !url.hostname.endsWith('.up.railway.app') ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/qa/rr/owner-link'
  )
    throw new OwnerOrganizationError(503, 'Invalid RR staging owner bridge')
  return url.href
}

async function rrStagingOwnerRequest(
  bridge: string,
  action: 'list' | 'link',
  session: { issuer: string; sub: string },
  organizationId?: string
): Promise<unknown> {
  const proof =
    action === 'list'
      ? signZitadelOwnerList(session)
      : signZitadelOwnerLink({ ...session, organizationId: organizationId ?? '' })
  let result: Response
  try {
    result = await fetch(bridge, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        action,
        issuer: session.issuer,
        authenticated_subject: session.sub,
        ...(action === 'link' ? { organization_id: organizationId } : {}),
        ...proof,
      }),
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(12_000),
    })
  } catch {
    throw new OwnerOrganizationError(503, 'RR staging owner bridge unavailable')
  }
  if (!result.ok) {
    await result.body?.cancel().catch(() => undefined)
    throw new OwnerOrganizationError(result.status === 403 ? 403 : 503, 'RR staging owner verification failed')
  }
  const raw = await result.text()
  if (raw.length > 16_384) throw new OwnerOrganizationError(503, 'RR staging owner response too large')
  try {
    return JSON.parse(raw) as unknown
  } catch {
    throw new OwnerOrganizationError(503, 'Invalid RR staging owner response')
  }
}

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
    const bridge = rrStagingOwnerBridge()
    if (bridge) {
      const result = await rrStagingOwnerRequest(bridge, 'list', { issuer: session.issuer, sub: session.sub })
      if (
        !result ||
        typeof result !== 'object' ||
        !('organizations' in result) ||
        !Array.isArray(result.organizations) ||
        !result.organizations.every(
          (org: unknown) =>
            org &&
            typeof org === 'object' &&
            'id' in org &&
            org.id === QDIP_ZITADEL_ORG &&
            'state' in org &&
            org.state === 'active'
        )
      )
        return response({ error: 'Invalid staging owner verification' }, 503)
      return response({ organizations: result.organizations }, 200)
    }
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
    const bridge = rrStagingOwnerBridge()
    if (bridge) {
      if (id !== QDIP_ZITADEL_ORG) return response({ error: 'Only the canonical QDIP QA organization is allowed' }, 403)
      const result = await rrStagingOwnerRequest(bridge, 'link', { issuer: session.issuer, sub: session.sub }, id)
      if (
        !result ||
        typeof result !== 'object' ||
        !('linked' in result) ||
        result.linked !== true ||
        !('coreTenantId' in result) ||
        typeof result.coreTenantId !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(result.coreTenantId) ||
        !('organization' in result) ||
        !result.organization ||
        typeof result.organization !== 'object' ||
        !('id' in result.organization) ||
        result.organization.id !== id
      )
        return response({ error: 'RR staging tenant identity mismatch' }, 503)
      return response(result as Record<string, unknown>, 200)
    }
    const selection = await verifyOwnedZitadelOrganization({ issuer: session.issuer, sub: session.sub }, id)

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
        ...signZitadelOwnerLink({
          issuer: session.issuer,
          sub: session.sub,
          organizationId: selection.id,
        }),
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
      typeof bound.id !== 'string' ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(bound.id) ||
      !('identity_provider' in bound) ||
      bound.identity_provider !== 'zitadel' ||
      !('zitadel_organization_id' in bound) ||
      bound.zitadel_organization_id !== selection.id ||
      !('zitadel_issuer' in bound) ||
      bound.zitadel_issuer !== session.issuer
    ) {
      return response({ error: 'Core organization identity mismatch' }, 503)
    }
    return response(
      { organization: selection, coreTenantId: bound.id, linked: true, pluginMigrationComplete: false },
      200
    )
  } catch (error) {
    if (error instanceof OwnerOrganizationError) {
      return response({ error: error.message }, error.status)
    }
    return response({ error: 'Zitadel organization linkage unavailable' }, 503)
  }
}
