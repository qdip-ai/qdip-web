import { NextRequest, NextResponse } from 'next/server'
import { QdipError } from '@qdip/client'
import { adminRequest } from '@/lib/observatory-plugin-admin'
import { coreCatalogClient, readCorePublications } from '@/lib/observatory-plugin-catalog'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, context: { params: Promise<{ name: string }> }) {
  const { error, session } = adminRequest(request, true)
  if (error) return error
  if (!session) return NextResponse.json({ error: 'Sign in required' }, { status: 401 })
  const { name } = await context.params
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(name))
    return NextResponse.json({ error: 'Invalid plugin name' }, { status: 400 })
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json')
    return NextResponse.json({ error: 'JSON required' }, { status: 415 })

  let payload: Record<string, unknown>
  try {
    const raw = await request.text()
    if (new TextEncoder().encode(raw).length > 40_000)
      return NextResponse.json({ error: 'Request too large' }, { status: 413 })
    const data: unknown = JSON.parse(raw)
    if (!data || typeof data !== 'object' || Array.isArray(data))
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    payload = data as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (!Number.isSafeInteger(payload.expected_revision) || (payload.expected_revision as number) < 0)
    return NextResponse.json({ error: 'Invalid revision' }, { status: 422 })
  try {
    const installed = (await readCorePublications()).find((row) => row.name === name)
    if (!installed || installed.source !== 'remote')
      return NextResponse.json({ error: 'SDK-registered remote plugin required' }, { status: 404 })
    if (installed.revision !== payload.expected_revision)
      return NextResponse.json({ error: 'Plugin changed, refresh and retry' }, { status: 409 })

    const client = coreCatalogClient()
    const input = {
      expectedRevision: installed.revision,
      pluginVersion: installed.version,
      actor: session.sub,
    }
    let outcome
    if (payload.action === 'scan') {
      if (
        typeof payload.source_code !== 'string' ||
        !['python', 'javascript', 'typescript', 'shell'].includes(String(payload.language)) ||
        new TextEncoder().encode(payload.source_code).length > 32768
      )
        return NextResponse.json({ error: 'Invalid source snapshot' }, { status: 422 })
      outcome = await client.catalog.scan(name, {
        ...input,
        language: payload.language as 'python' | 'javascript' | 'typescript' | 'shell',
        sourceCode: payload.source_code,
      })
    } else if (payload.action === 'quarantine') {
      if (typeof payload.quarantined !== 'boolean' || typeof payload.reason !== 'string')
        return NextResponse.json({ error: 'Invalid quarantine request' }, { status: 422 })
      outcome = await client.catalog.quarantine(name, {
        ...input,
        quarantined: payload.quarantined,
        reason: payload.reason,
      })
    } else if (payload.action === 'approve') {
      if (
        typeof payload.reason !== 'string' ||
        typeof payload.review_reference !== 'string' ||
        payload.risk_acknowledged !== true
      )
        return NextResponse.json({ error: 'Explicit risk acceptance required' }, { status: 422 })
      outcome = await client.catalog.approve(name, {
        ...input,
        reason: payload.reason,
        reviewReference: payload.review_reference,
        riskAcknowledged: true,
      })
    } else {
      return NextResponse.json({ error: 'Unknown security action' }, { status: 422 })
    }
    return NextResponse.json(outcome, { headers: { 'Cache-Control': 'no-store' } })
  } catch (cause) {
    if (cause instanceof QdipError) {
      if (cause.httpStatus === 409) return NextResponse.json({ error: 'State changed; reload' }, { status: 409 })
      if (cause.httpStatus === 400 || cause.httpStatus === 422)
        return NextResponse.json({ error: 'Invalid security review request' }, { status: 422 })
      if (cause.httpStatus === 403)
        return NextResponse.json({ error: 'Worker is not allowlisted for first-party manual approval' }, { status: 403 })
      if (cause.httpStatus === 401)
        return NextResponse.json({ error: 'Core admin access rejected' }, { status: 502 })
    }
    return NextResponse.json({ error: 'Core security service unavailable' }, { status: 503 })
  }
}
