import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/observatory-plugin-admin', () => ({
  developerRequest: vi.fn(() => ({
    error: null,
    session: { issuer: 'https://zitadel.example.test', sub: '1234567890123' },
  })),
}))
vi.mock('@/lib/zitadel-owner-organizations', () => {
  class OwnerOrganizationError extends Error {
    constructor(
      public readonly status: number,
      message: string
    ) {
      super(message)
    }
  }
  return {
    OwnerOrganizationError,
    verifyOwnedZitadelOrganization: vi.fn(async (_identity: unknown, organizationId: string) => {
      if (organizationId !== '1111111111111') throw new OwnerOrganizationError(403, 'Not organization owner')
      return { id: organizationId, name: 'Own organization', state: 'active' }
    }),
  }
})
vi.mock('@/lib/observatory-developer-keys', () => ({
  DeveloperKeyError: class DeveloperKeyError extends Error {
    constructor(
      public readonly status: number,
      message: string
    ) {
      super(message)
    }
  },
  listPluginCredentials: vi.fn(async () => ({ available: [], connected: [] })),
  issuePluginCredential: vi.fn(async () => ({
    pluginId: 'sample',
    key: 'dip-' + 'a'.repeat(32),
    keyId: 'key',
  })),
  revokePluginCredential: vi.fn(async () => {}),
}))

import { GET, POST, DELETE } from './route'
import { listPluginCredentials, issuePluginCredential, revokePluginCredential } from '@/lib/observatory-developer-keys'

function request(method: 'GET' | 'POST' | 'DELETE', organizationId: string, body?: object) {
  const url =
    'https://observatory.qdip.ai/api/observatory/admin/applications' +
    (method === 'GET' ? '?organizationId=' + organizationId : '')
  return new NextRequest(url, {
    method,
    headers: {
      host: 'observatory.qdip.ai',
      origin: 'https://observatory.qdip.ai',
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    ...(body ? { body:...[truncated]