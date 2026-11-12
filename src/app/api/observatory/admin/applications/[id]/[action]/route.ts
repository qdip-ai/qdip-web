import { NextRequest, NextResponse } from 'next/server'
import { adminRequest } from '@/lib/observatory-plugin-admin'
import { corePluginConnection } from '@/lib/observatory-plugin-catalog'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Context = { params: Promise<{ id: string; action: string }> }
const reply = (data: Record<string, unknown>, status: number) =>
  NextResponse.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } })

export async function POST(request: NextRequest, context: Context) {
  const { error, session } = adminRequest(request, true)
  if (error) return error
  if (!session || !/^[A-Za-z0-9@._:-]{1,256}$/.test(session.sub))
    return reply({ error: 'Verified administrator required' }, 403)
  const { id, action } = await context.params
  if (id !== 'readiness-recovery' || !['publish', 'unpublish'].includes(action))
    return reply({ error: 'Unknown application operation' }, 404)
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json')
    return reply({ error: 'JSON required' }, 415)
  let revision: number
  try {
    const raw = await request.text()
    if (raw.length > 256) return reply({ error: 'Request too large' }, 413)
    const body: unknown = JSON.parse(raw)
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
        Object.keys(body).length !== 1 || !('expected_revision' in body) ||
        !Number.isSafeInteger(body.expected_revision) || (body.expected_revision as number) < 0)
      return reply({ error: 'Invalid revision' }, 422)
    revision = body.expected_revision as number
  } catch {
    return reply({ error: 'Invalid JSON' }, 400)
  }
  try {
    const { base, key } = corePluginConnection()
    const upstream = await fetch(
      `${base}/api/v1/applications/${encodeURIComponent(id)}/${action}`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
          'x-api-key': key,
          'x-qdip-actor': session.sub,
        },
        body: JSON.stringify({ expected_revision: revision }),
        redirect: 'error',
        cache: 'no-store',
        signal: AbortSignal.timeout(15_000),
      }
    )
    if (upstream.status === 409) {
      const reason: unknown = await upstream.json().catch(() => null)
      const detail = reason && typeof reason === 'object' && 'detail' in reason ? reason.detail : null
      const reasons = detail && typeof detail === 'object' && 'reasons' in detail &&
        Array.isArray(detail.reasons) ? detail.reasons.filter((r: unknown) => typeof r === 'string').slice(0, 8) : []
      return reply({ error: 'Publication conflict or runtime not admitted', reasons }, 409)
    }
    if (upstream.status === 401 || upstream.status === 403)
      return reply({ error: 'Core rejected administrator permission' }, 403)
    if (!upstream.ok) return reply({ error: 'Core application publication unavailable' }, 503)
    const result: unknown = await upstream.json()
    const target = action === 'publish' ? 'published' : 'unpublished'
    if (
      !result || typeof result !== 'object' ||
      !('application_id' in result) || result.application_id !== id ||
      !('status' in result) || result.status !== target ||
      !('revision' in result) || !Number.isSafeInteger(result.revision) ||
      ![revision, revision + 1].includes(result.revision as number)
    )
      return reply({ error: 'Core publication response not verified; reload before retrying' }, 502)
    return reply(result as Record<string, unknown>, 200)
  } catch {
    return reply({ error: 'Core unavailable; reload before retrying' }, 503)
  }
}
