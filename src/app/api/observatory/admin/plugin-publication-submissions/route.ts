import { NextRequest, NextResponse } from 'next/server'
import { adminRequest } from '@/lib/observatory-plugin-admin'
import { corePluginConnection } from '@/lib/observatory-plugin-catalog'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { error } = adminRequest(request)
  if (error) return error
  try {
    const { base, key } = corePluginConnection()
    const upstream = await fetch(`${base}/api/v1/admin/plugin-publication-submissions`, {
      headers: { 'x-api-key': key, accept: 'application/json' },
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(12_000),
    })
    if (!upstream.ok)
      return NextResponse.json({ error: 'Core review queue unavailable' }, { status: 503 })
    const payload: unknown = await upstream.json()
    if (!payload || typeof payload !== 'object' || !Array.isArray((payload as { items?: unknown }).items))
      return NextResponse.json({ error: 'Invalid review queue' }, { status: 502 })
    return NextResponse.json(payload, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch {
    return NextResponse.json({ error: 'Core review queue unavailable' }, { status: 503 })
  }
}
