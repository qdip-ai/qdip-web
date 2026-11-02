import { NextRequest, NextResponse } from 'next/server'
import { adminRequest } from '@/lib/observatory-plugin-admin'
import { corePluginConnection } from '@/lib/observatory-plugin-catalog'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const reply = (data: Record<string, unknown>, status = 200) =>
  NextResponse.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } })

export async function POST(request: NextRequest, context: { params: Promise<{ name: string }> }) {
  const { error, session } = adminRequest(request, true)
  if (error) return error
  if (!session || !/^[A-Za-z0-9@._:-]{1,256}$/.test(session.sub))
    return reply({ error: 'Verified reviewer required' }, 403)
  const { name } = await context.params
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(name)) return reply({ error: 'Invalid plugin identity' }, 422)
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json')
    return reply({ error: 'JSON required' }, 415)
  let payload: Record<string, unknown>
  try {
    const raw = await request.text()
    if (raw.length > 2048) return reply({ error: 'Request too large' }, 413)
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object' || Array.isArray(value))
      return reply({ error: 'Invalid review request' }, 422)
    payload = value as Record<string, unknown>
  } catch {
    return reply({ error: 'Invalid JSON' }, 400)
  }
  if (
    Object.keys(payload).some((k) => !['expected_revision', 'action', 'reason'].includes(k)) ||
    !Number.isSafeInteger(payload.expected_revision) ||
    (payload.expected_revision as number) < 1 ||
    !['reject', 'suspend'].includes(payload.action as string) ||
    typeof payload.reason !== 'string' ||
    payload.reason.trim().length < 8 ||
    payload.reason.length > 500
  )
    return reply({ error: 'Invalid moderation details' }, 422)
  try {
    const { base, key } = corePluginConnection()
    const response = await fetch(
      `${base}/api/v1/admin/plugin-publication-submissions/${encodeURIComponent(name)}/moderate`,
      {
        method: 'POST',
        headers: {
          'x-api-key': key,
          'x-qdip-actor': session.sub,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({
          expected_revision: payload.expected_revision,
          action: payload.action,
          reason: (payload.reason as string).trim(),
        }),
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.timeout(12_000),
      }
    )
    if (response.status === 409) return reply({ error: 'Review changed; refresh' }, 409)
    if (!response.ok) return reply({ error: 'Core moderation rejected' }, 503)
    const result: unknown = await response.json()
    if (
      !result ||
      typeof result !== 'object' ||
      (result as { plugin_name?: unknown }).plugin_name !== name ||
      (result as { expected_revision?: unknown }).expected_revision !== (payload.expected_revision as number) + 1 ||
      !['REJECTED', 'SUSPENDED'].includes((result as { status?: string }).status ?? '')
    )
      return reply({ error: 'Unverified moderation response' }, 502)
    return reply(result as Record<string, unknown>)
  } catch {
    return reply({ error: 'Core moderation unavailable' }, 503)
  }
}
