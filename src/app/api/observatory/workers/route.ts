import { NextRequest, NextResponse } from 'next/server'
import { isSurfaceHost } from '@/routing-config'
import { observatoryCapabilityGrants } from '@/lib/observatory-access'
import { normalizeDipBaseUrl } from '@/lib/dip-url'

export async function GET(request: NextRequest) {
  const host = request.headers.get('host')
  if (!host || /[,\\s@/?#]/.test(host) || !isSurfaceHost('observatory', host))
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const grants = observatoryCapabilityGrants(request)
  if (!grants)
    return NextResponse.json({ error: 'Zitadel login required' }, { status: 401 })
  const base = normalizeDipBaseUrl(process.env.DIP_API_BASE_URL ?? process.env.DIP_URL)
  // Dedicated read-only Gateway service key: never fall back to admin/execute credentials.
  const key = process.env.QDIP_OBSERVATORY_READ_API_KEY?.trim()
  if (!base || !key) return NextResponse.json({ error: 'Catalog not configured' }, { status: 503 })
  const target = new URL(base)
  if (target.protocol !== 'https:' && !(target.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(target.hostname)))
    return NextResponse.json({ error: 'TLS required' }, { status: 503 })
  try {
    const upstream = await fetch(base + '/api/v1/observatory/workers', {
      headers: { 'x-api-key': key },
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
    })
    if (!upstream.ok) return NextResponse.json({ error: 'Catalog unavailable' }, { status: upstream.status === 401 || upstream.status === 403 ? 403 : 502 })
    if (Number(upstream.headers.get('content-length') ?? 0) > 262144)
      return NextResponse.json({ error: 'Catalog too large' }, { status: 502 })
    const body: unknown = await upstream.json()
    if (!body || typeof body !== 'object' || !('items' in body) || !Array.isArray(body.items) || body.items.length > 1000)
      return NextResponse.json({ error: 'Invalid catalog' }, { status: 502 })
    const items = body.items.filter((item: unknown) => item && typeof item === 'object' &&
      'capability_id' in item && typeof item.capability_id === 'string' && grants.has(item.capability_id))
    return NextResponse.json({ items, count: items.length }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'Catalog unavailable' }, { status: 502 })
  }
}
