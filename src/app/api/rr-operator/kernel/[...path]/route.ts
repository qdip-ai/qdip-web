import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { normalizeDipBaseUrl } from '@/lib/dip-url'
import { allowedKernelPath } from '@/lib/rr-kernel-route-allowlist'
import { signedRrActorFromRequest } from '@/lib/rr-actor-assertion'
import { rrOrgApiKey } from '@/lib/rr-org-credential'
import { operatorAuthorized, operatorConfigured, safeTransport, sameOrigin } from '@/lib/rr-operator-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Context = { params: Promise<{ path: string[] }> }
const MAX_BODY_BYTES = 2_150_000

function json(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } })
}

async function handle(request: NextRequest, context: Context) {
  if (!safeTransport(request)) return json('TLS required', 403)
  if (!operatorConfigured()) return json('RR operator mode is not configured', 503)
  if (!operatorAuthorized(request)) return json('RR operator login required', 401)
  if (request.method === 'POST' && !sameOrigin(request)) return json('Forbidden origin', 403)
  const { path } = await context.params
  if (!allowedKernelPath(path, request.method)) return json('Unsupported RR operation', 404)

  // Standalone qdip-rr API only. Core no longer serves any RR route: no fallback.
  const base = normalizeDipBaseUrl(process.env.RR_STANDALONE_API_BASE_URL)
  const key = rrOrgApiKey()
  if (!base || !key) return json('RR connection is not configured', 503)
  const upstreamBase = new URL(base)
  if (
    upstreamBase.protocol !== 'https:' &&
    !(
      upstreamBase.protocol === 'http:' &&
      (['localhost', '127.0.0.1'].includes(upstreamBase.hostname) ||
        upstreamBase.hostname.endsWith('.railway.internal'))
    )
  )
    return json('RR backend requires TLS', 503)

  let body: string | undefined
  if (request.method === 'POST') {
    if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) return json('Request too large', 413)
    if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json')
      return json('JSON required', 415)
    body = await request.text()
    if (Buffer.byteLength(body, 'utf8') > MAX_BODY_BYTES) return json('Request too large', 413)
  }
  try {
    const actorOperation =
      request.method !== 'POST'
        ? null
        : path[0] === 'executions'
          ? path.length === 1
            ? 'execute'
            : 'replan'
          : path[0] === 'source-import' && path[1] === 'executions'
            ? path.length === 2
              ? 'execute'
              : 'replan'
            : path[0] === 'economic-v2' && ['snapshots', 'advice', 'scenario-advice'].includes(path[1])
              ? 'execute'
              : path[0] === 'forecasts'
                ? 'execute'
                : null
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'x-api-key': key }
    if (actorOperation) {
      // Stable across network retries; scoped by backend tenant and unique route+body.
      headers['idempotency-key'] = createHash('sha256')
        .update(path.join('/'))
        .update('\\0')
        .update(body ?? '')
        .digest('hex')
    }
    if (actorOperation) {
      const organizationId = process.env.RR_ORGANIZATION_ID?.trim() ?? ''
      if (!/^[A-Za-z0-9_.-]{1,128}$/.test(organizationId))
        return json('RR organization binding is not configured', 503)
      headers['x-qdip-actor-assertion'] = signedRrActorFromRequest(request, actorOperation, {
        organizationId,
        method: request.method,
        path: `/api/v1/readiness-recovery/${path.join('/')}${request.nextUrl.search}`,
        body: body ?? '',
        idempotencyKey: headers['idempotency-key'],
      })
    }
    const upstream = await fetch(`${base}/api/v1/readiness-recovery/${path.join('/')}${request.nextUrl.search}`, {
      method: request.method,
      headers,
      body,
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(path[0] === 'economic-v2' && path[1] === 'scenario-advice' ? 160_000 : 45_000),
    })
    const maxResponse = 4_194_304
    if (Number(upstream.headers.get('content-length') ?? 0) > maxResponse)
      return json('RR response exceeds size limit', 502)
    const reader = upstream.body?.getReader()
    const chunks: Uint8Array[] = []
    let bytes = 0
    if (reader) {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        bytes += value.byteLength
        if (bytes > maxResponse) {
          await reader.cancel()
          return json('RR response exceeds size limit', 502)
        }
        chunks.push(value)
      }
    }
    const payload = Buffer.concat(chunks)
    const csv = path[0] === 'forecasts' && path[path.length - 1] === 'export.csv' && upstream.ok
    const responseHeaders: Record<string, string> = {
      'Content-Type': csv ? 'text/csv; charset=utf-8' : 'application/json',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    }
    const disposition = upstream.headers.get('content-disposition')
    if (csv && disposition && /^attachment; filename="rr-po-[A-Za-z0-9_.:-]{1,96}\.csv"$/.test(disposition))
      responseHeaders['Content-Disposition'] = disposition
    const gatewayExecution = upstream.headers.get('x-qdip-gateway-execution-id')
    if (gatewayExecution && /^[A-Za-z0-9_.-]{1,128}$/.test(gatewayExecution))
      responseHeaders['X-QDIP-Gateway-Execution-Id'] = gatewayExecution
    return new NextResponse(csv ? payload : payload.toString('utf8'), {
      status: upstream.status,
      headers: responseHeaders,
    })
  } catch {
    return json('RR backend unavailable', 502)
  }
}

export { handle as GET, handle as POST }
