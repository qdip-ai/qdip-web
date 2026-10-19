import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/observatory-plugin-admin', () => ({
  adminRequest: vi.fn(() => ({
    error: null,
    session: { issuer: 'https://zitadel.example.test', sub: '1234567890123' },
  })),
}))
vi.mock('@/lib/zitadel-owner-organizations', () => {
  class OwnerOrganizationError extends Error {
    constructor(public readonly status: number, message: string) { super(message) }
  }
  return {
    OwnerOrganizationError,
    verifyOwnedZitadelOrganization: vi.fn(async (_identity: unknown, organizationId: string) => {
      if (organizationId !== '1111111111111')
        throw new OwnerOrganizationError(403, 'Not organization owner')
      return { id: organizationId, name: 'Own organization', state: 'active' }
    }),
  }
})
vi.mock('@/lib/observatory-developer-keys', () => ({
  DeveloperKeyError: class DeveloperKeyError extends Error {
    constructor(public readonly status: number, message: string) { super(message) }
  },
  listPluginCredentials: vi.fn(async () => ({ available: [], connected: [] })),
  issuePluginCredential: vi.fn(async () => ({
    pluginId: 'sample', key: 'dip-' + 'a'.repeat(32), keyId: 'key',
  })),
  revokePluginCredential: vi.fn(async () => {}),
}))

import { GET, POST, DELETE } from './route'
import {
  listPluginCredentials, issuePluginCredential, revokePluginCredential,
} from '@/lib/observatory-developer-keys'

function request(method: 'GET' | 'POST' | 'DELETE', organizationId: string, body?: object) {
  const url = 'https://observatory.qdip.ai/api/observatory/admin/applications' +
    (method === 'GET' ? '?organizationId=' + organizationId : '')
  return new NextRequest(url, {
    method,
    headers: {
      host: 'observatory.qdip.ai',
      origin: 'https://observatory.qdip.ai',
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify({ ...body, organizationId }) } : {}),
  })
}

beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.unstubAllGlobals())

describe('owner-bound plugin key operations', () => {
  it('lists only keys under a live verified organization', async () => {
    expect((await GET(request('GET', '1111111111111'))).status).toBe(200)
    expect(vi.mocked(listPluginCredentials)).toHaveBeenCalledWith({
      id: '1111111111111', issuer: 'https://zitadel.example.test',
    })
  })

  it('denies an outsider-selected organization before accessing Core', async () => {
    expect((await GET(request('GET', '2222222222222'))).status).toBe(403)
    expect(vi.mocked(listPluginCredentials)).not.toHaveBeenCalled()
  })

  it('denies unverified organization key issuance and revocation', async () => {
    const issue = {
      pluginId: 'sample', capabilities: ['sample.plan'],
      role: 'execute', manual: false,
    }
    expect((await POST(request('POST', '2222222222222', issue))).status).toBe(403)
    expect(vi.mocked(issuePluginCredential)).not.toHaveBeenCalled()
    expect((await DELETE(request('DELETE', '2222222222222', {
      orgId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      keyId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    }))).status).toBe(403)
    expect(vi.mocked(revokePluginCredential)).not.toHaveBeenCalled()
  })

  it('passes the verified organization to every mutation', async () => {
    const data = {
      pluginId: 'sample', capabilities: ['sample.plan'], role: 'execute', manual: false,
    }
    expect((await POST(request('POST', '1111111111111', data))).status).toBe(201)
    expect(vi.mocked(issuePluginCredential)).toHaveBeenCalledWith(
      'sample', ['sample.plan'], 'execute',
      { id: '1111111111111', issuer: 'https://zitadel.example.test' }, false,
    )
    expect((await DELETE(request('DELETE', '1111111111111', {
      orgId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      keyId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    }))).status).toBe(200)
    expect(vi.mocked(revokePluginCredential)).toHaveBeenCalledWith(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      { id: '1111111111111', issuer: 'https://zitadel.example.test' },
    )
  })
})
