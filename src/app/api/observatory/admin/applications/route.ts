import { NextRequest, NextResponse } from 'next/server'
import { adminRequest } from '@/lib/observatory-plugin-admin'
import {
  DeveloperKeyError,
  issuePluginCredential,
  listPluginCredentials,
  revokePluginCredential,
} from '@/lib/observatory-developer-keys'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function noStore(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'private, no-store, max-age=0',
      Pragma: 'no-cache',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

function handle(error: unknown) {
  return error instanceof DeveloperKeyError
    ? noStore({ error: error.message }, error.status)
    : noStore({ error: 'Plugin key management unavailable' }, 503)
}

async function payload(request: NextRequest): Promise<Record<string, unknown>> {
  if (request.headers.get('content-type')?.split(';')[0]?.trim() !== 'application/json')
    throw new DeveloperKeyError(415, 'JSON required')
  let source: string
  try {
    source = await request.text()
  } catch {
    throw new DeveloperKeyError(400, 'Invalid request')
  }
  if (source.length > 4096) throw new DeveloperKeyError(413, 'Request too large')
  let value: unknown
  try {
    value = JSON.parse(source)
  } catch {
    throw new DeveloperKeyError(400, 'Invalid JSON')
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new DeveloperKeyError(422, 'Invalid request')
  return value as Record<string, unknown>
}

export async function GET(request: NextRequest) {
  const { error } = adminRequest(request)
  if (error) return error
  try {
    const inventory = await listPluginCredentials()
    return noStore(inventory, 200)
  } catch (cause) {
    return handle(cause)
  }
}

export async function POST(request: NextRequest) {
  const { error } = adminRequest(request, true)
  if (error) return error
  try {
    const data = await payload(request)
    if (
      Object.keys(data).some((k) => !['pluginId', 'capabilities', 'role', 'manual'].includes(k)) ||
      typeof data.pluginId !== 'string' ||
      !Array.isArray(data.capabilities) ||
      !data.capabilities.every((c) => typeof c === 'string') ||
      (data.role !== 'execute' && data.role !== 'worker') ||
      typeof data.manual !== 'boolean'
    )
      throw new DeveloperKeyError(422, 'Invalid plugin key request')
    const created = await issuePluginCredential(data.pluginId, data.capabilities, data.role, data.manual)
    return noStore(created, 201)
  } catch (cause) {
    return handle(cause)
  }
}

export async function DELETE(request: NextRequest) {
  const { error } = adminRequest(request, true)
  if (error) return error
  try {
    const data = await payload(request)
    if (
      Object.keys(data).some((k) => !['orgId', 'keyId'].includes(k)) ||
      typeof data.orgId !== 'string' ||
      typeof data.keyId !== 'string'
    )
      throw new DeveloperKeyError(422, 'Invalid key identity')
    await revokePluginCredential(data.orgId, data.keyId)
    return noStore({ revoked: true }, 200)
  } catch (cause) {
    return handle(cause)
  }
}
