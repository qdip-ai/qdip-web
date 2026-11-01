import { NextRequest, NextResponse } from 'next/server'
import { adminRequest } from '@/lib/observatory-plugin-admin'
import { corePluginConnection, readCorePublications } from '@/lib/observatory-plugin-catalog'
import { OwnerOrganizationError, verifyOwnedZitadelOrganization } from '@/lib/zitadel-owner-organizations'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// This review endpoint is intentionally limited to the verified first-party Yara identity.
const YARA_CATALOG_ID = 'remote-3b25f5ae494aa7bf-secretary'

const noStore = (status: number, body: Record<string, unknown>) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })

/** An explicit first-party risk review, never an automatic admission or publication. */
export async function POST(request: NextRequest, context: { params: Promise<{ name: string }> }) {
  const { error, session } = adminRequest(request, true)
  if (error) return error
  if (!session || !/^[A-Za-z0-9@._:-]{1,256}$/.test(session.sub))
    return noStore(403, { error: 'Verified administrator required' })

  const { name } = await context.params
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(name)) return noStore(400, { error: 'Invalid plugin identity' })
  if (name !== YARA_CATALOG_ID) return noStore(403, { error: 'Not the reviewed first-party Worker' })
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json')
    return noStore(415, { error: 'JSON required' })

  let data: Record<string, unknown>
  try {
    const raw = await request.text()
    if (raw.length > 4096) return noStore(413, { error: 'Request too large' })
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      return noStore(422, { error: 'Invalid review request' })
    data = parsed as Record<string, unknown>
  } catch {
    return noStore(400, { error: 'Invalid JSON' })
  }

  const revision = data.expected_revision
  const version = data.plugin_version
  const reason = data.reason
  const reference = data.review_reference
  if (
    Object.keys(data).some(
      (key) => !['expected_revision', 'plugin_version', 'reason', 'review_reference', 'risk_acknowledged'].includes(key)
    ) ||
    !Number.isSafeInteger(revision) ||
    (revision as number) < 0 ||
    typeof version !== 'string' ||
    version.length < 1 ||
    version.length > 64 ||
    typeof reason !== 'string' ||
    reason.trim().length < 20 ||
    reason.length > 1000 ||
    typeof reference !== 'string' ||
    reference.trim().length < 8 ||
    reference.length > 256 ||
    data.risk_acknowledged !== true
  )
    return noStore(422, { error: 'Explicit, referenced security risk acceptance required' })

  try {
    const record = (await readCorePublications()).find((item) => item.name === name)
    if (!record || record.source !== 'remote') return noStore(404, { error: 'Remote Worker not registered' })
    if (record.version !== version || record.revision !== revision)
      return noStore(409, { error: 'Registration changed; reload before review' })

    const organizationId = process.env.ZITADEL_QDIP_ORGANIZATION_ID
    if (!organizationId || !/^[0-9]{1,32}$/.test(organizationId))
      return noStore(503, { error: 'Yara organization ownership verification is not configured' })
    try {
      await verifyOwnedZitadelOrganization({ issuer: session.issuer, sub: session.sub }, organizationId)
    } catch (cause) {
      if (cause instanceof OwnerOrganizationError && cause.status === 403)
        return noStore(403, { error: 'Yara organization ownership required' })
      return noStore(503, { error: 'Yara organization ownership could not be verified' })
    }

    const { base, key } = corePluginConnection()
    const upstream = await fetch(`${base}/api/v1/plugin-publications/${encodeURIComponent(name)}/security/approve`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        'x-api-key': key,
        'x-qdip-actor': session.sub,
      },
      body: JSON.stringify({
        expected_revision: revision,
        plugin_version: version,
        reason: reason.trim(),
        review_reference: reference.trim(),
        risk_acknowledged: true,
      }),
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    })

    if (upstream.status === 409) return noStore(409, { error: 'Security state changed; reload before review' })
    if (upstream.status === 403)
      return noStore(403, { error: 'Worker is not admitted by the trusted Core manifest allowlist' })
    if (upstream.status === 401) return noStore(502, { error: 'Core administrator credential rejected' })
    if (upstream.status === 400 || upstream.status === 422)
      return noStore(422, { error: 'Core rejected the review contract' })
    if (!upstream.ok) return noStore(503, { error: 'Core security admission unavailable' })

    const result: unknown = await upstream.json()
    if (
      !result ||
      typeof result !== 'object' ||
      (result as { name?: unknown }).name !== name ||
      (result as { revision?: unknown }).revision !== (revision as number) + 1 ||
      (result as { security?: { state?: unknown } }).security?.state !== 'approved'
    )
      return noStore(502, { error: 'Core response could not be verified; reload before retrying' })

    return noStore(200, {
      name,
      revision: (result as { revision: number }).revision,
      security: { state: 'approved' },
      published: (result as { published?: unknown }).published === true,
    })
  } catch {
    return noStore(503, { error: 'Core security admission unavailable; check state before retrying' })
  }
}
