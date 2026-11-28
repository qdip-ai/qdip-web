import { NextRequest, NextResponse } from 'next/server'
import { adminRequest } from '@/lib/observatory-plugin-admin'
import { readAdminCorePublications } from '@/lib/observatory-plugin-catalog'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { error } = adminRequest(request)
  if (error) return error
  try {
    return NextResponse.json(
      { plugins: await readAdminCorePublications() },
      {
        headers: { 'Cache-Control': 'no-store' },
      }
    )
  } catch {
    return NextResponse.json({ error: 'QDIP Core publication registry unavailable' }, { status: 503 })
  }
}
