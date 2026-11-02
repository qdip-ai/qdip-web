import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { QdipError } from '@qdip/client'

vi.mock('server-only', () => ({}))
const auth = vi.hoisted(() => ({ sub: 'verified-admin', authenticated: true, admin: true }))
const source = vi.hoisted(() => ({
  read: vi.fn(),
  publish: vi.fn(),
}))
vi.mock('@/lib/qdip-oidc', () => ({
  sessionFromRequest: () => (auth.authenticated ? { sub: auth.sub } : null),
  canAdministerObservatory: () => auth.admin,
}))
vi.mock('@/lib/observatory-plugin-catalog', () => ({
  readCorePublications: source.read,
  coreCatalogClient: () => ({ catalog: { publish: source.publish } }),
}))

import { PUT } from './route'

const plugin = {
  name: 'remote-third-party-route',
  version: '1.0.0',
  enabled: true,
  capabilities: ['routes.optimize'],
  capability_id: 'routes.optimize',
}
const update = {
  published: true,
  expected_revision: 3,
  capability_id: 'routes.optimize',
  application_launch_url: 'https://routing.partner-example.org/app',
  launch_url_verified: true,
}
const context = { params: Promise.resolve({ name: plugin.name }) }
const request = (data: object, origin = 'https://observatory.qdip.ai') =>
  new NextRequest('https://observatory.qdip.ai/api/observatory/admin/plugins/' + plugin.name, {
    method: 'PUT',
    headers: { host: 'observatory.qdip.ai', origin, 'content-type': 'application/json' },
    body: JSON.stringify(data),
  })

beforeEach(() => {
  vi.clearAllMocks()
  auth.authenticated = true
  auth.admin = true
  source.read.mockResolvedValue([plugin])
  source.publish.mockResolvedValue({ ...plugin, published: true })
})

describe('verified plugin launch URL admin API security', () => {
  it('forwards reviewed external link and authenticated actor through the existing SDK', async () => {
    const response = await PUT(request(update), context)
    expect(response.status).toBe(200)
    expect(source.publish).toHaveBeenCalledWith(
      plugin.name,
      expect.objectContaining({
        applicationLaunchUrl: update.application_launch_url,
        launchUrlVerified: true,
        actor: 'verified-admin',
        expectedRevision: 3,
        capabilityId: 'routes.optimize',
      })
    )
  })

  it.each([
    'http://example.org',
    'https://127.0.0.1',
    'https://internal.local',
    'https://admin@example.org',
    'https://example.org:8080',
    'https://example.org/?next=https://evil.org',
    'https://xn--exmple-cua.org',
  ])('rejects unsafe external URL %s before invoking Core', async (url) => {
    const response = await PUT(request({ ...update, application_launch_url: url }), context)
    expect(response.status).toBe(422)
    expect(source.publish).not.toHaveBeenCalled()
  })

  it('rejects a safe URL without explicit administrator verification', async () => {
    expect((await PUT(request({ ...update, launch_url_verified: false }), context)).status).toBe(422)
    expect((await PUT(request({ ...update, launch_url_verified: undefined }), context)).status).toBe(422)
    expect(source.publish).not.toHaveBeenCalled()
  })

  it('allows an explicit link revocation without unregistering the plugin', async () => {
    const result = await PUT(request({ ...update, application_launch_url: '', launch_url_verified: false }), context)
    expect(result.status).toBe(200)
    expect(source.publish).toHaveBeenCalledWith(
      plugin.name,
      expect.objectContaining({
        published: true,
        applicationLaunchUrl: '',
        launchUrlVerified: false,
      })
    )
  })

  it('denies anonymous, insufficient-role and cross-origin requests before reading catalog', async () => {
    auth.authenticated = false
    expect((await PUT(request(update), context)).status).toBe(401)
    auth.authenticated = true
    auth.admin = false
    expect((await PUT(request(update), context)).status).toBe(403)
    auth.admin = true
    expect((await PUT(request(update, 'https://evil.example.org'), context)).status).toBe(403)
    expect(source.read).not.toHaveBeenCalled()
  })

  it('reports security review required for unapproved remote Worker', async () => {
    source.read.mockResolvedValueOnce([{ ...plugin, source: 'remote', security: { state: 'pending_review' } }])
    const response = await PUT(request(update), context)
    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({
      error: 'Remote Worker requires security approval before publication',
    })
    expect(source.publish).not.toHaveBeenCalled()
  })

  it('retains Core security 403 separately from credential 401', async () => {
    source.publish.mockRejectedValueOnce(new QdipError('INVALID_REQUEST', { httpStatus: 403 }))
    const policy = await PUT(request(update), context)
    expect(policy.status).toBe(403)
    expect((await policy.json()).error).toContain('security policy')
    source.publish.mockRejectedValueOnce(new QdipError('INVALID_REQUEST', { httpStatus: 401 }))
    const auth = await PUT(request(update), context)
    expect(auth.status).toBe(502)
    expect((await auth.json()).error).toContain('credential rejected')
  })

  it('allows reviewed remote Worker to reach Core', async () => {
    source.read.mockResolvedValueOnce([{ ...plugin, source: 'remote', security: { state: 'approved' } }])
    expect((await PUT(request(update), context)).status).toBe(200)
    expect(source.publish).toHaveBeenCalledOnce()
  })

  it('rejects stale CAS revision and forged capability without executing a plugin', async () => {
    expect((await PUT(request({ ...update, capability_id: 'other.execute' }), context)).status).toBe(409)
    expect(source.publish).not.toHaveBeenCalled()
    source.publish.mockRejectedValueOnce(new QdipError('INVALID_REQUEST', { httpStatus: 409 }))
    expect((await PUT(request(update), context)).status).toBe(409)
  })
})
