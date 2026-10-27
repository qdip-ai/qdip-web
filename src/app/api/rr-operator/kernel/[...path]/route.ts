import { NextRequest, NextResponse } from 'next/server'
import { normalizeDipBaseUrl } from '@/lib/dip-url'
import { allowedKernelPath } from '@/lib/rr-kernel-route-allowlist'
import { signedRrActorFromRequest } from '@/lib/rr-actor-assertion'
import { rrCoreApiKey } from '@/lib/rr-core-credential'
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

  const base = normalizeDipBaseUrl(process.env.DIP_API_BASE_URL ?? process.env.DIP_URL)
  const key = rrCoreApiKey()
  if (!base || !key) return json('DIP connection is not configured', 503)
  const upstreamBase = new URL(base)
  if (
    upstreamBase.protocol !== 'https:' &&
    !(upstreamBase.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(upstreamBase.hostname))
  )
    return json('DIP backend requires TLS', 503)

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
            : path[0] === 'economic-v2' && ['snapshots', 'advice'].includes(path[1])
              ? 'execute'
              : null
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'x-api-key': key }
    if (actorOperation) headers['x-qdip-actor-assertion'] = signedRrActorFromRequest(request, actorOperation)
    const upstream = await fetch(`${base}/api/v1/readiness-recovery/${path.join('/')}${request.nextUrl.search}`, {
      method: request.method,
      headers,
      body,
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(45_000),
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
    const payload = Buffer.concat(chunks).toString('utf8')
    return new NextResponse(payload, {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
    })
  } catch {
    return json('RR backend unavailable', 502)
  }
}

export { handle as GET, handle as POST }
