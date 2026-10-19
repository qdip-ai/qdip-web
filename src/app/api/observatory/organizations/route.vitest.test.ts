import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { ISSUER, ORG, CORE } = vi.hoisted(() => ({
  ISSUER: 'https://zitadel.example.test',
  ORG: '11111111111111111111',
  CORE: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
}))

vi.mock('@/routing-config', () => ({ isSurfaceHost: () => true }))
vi.mock('@/lib/qdip-oidc', () => ({
  sessionFromRequest: vi.fn(() => ({ issuer: ISSUER, sub: '99999999999999999999', roles: [] })),
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
    listOwnedZitadelOrganizations: vi.fn(async () => [{ id: ORG, name: 'QDIP', state: 'active' }]),
    verifyOwnedZitadelOrganization: vi.fn(async (_principal: unknown, organizationId: string) => {
      if (organizationId !== ORG) throw new OwnerOrganizationError(403, 'Organization owner required')
      return { id: ORG, name: 'QDIP', state: 'active' }
    }),
  }
})
vi.mock('@/lib/observatory-plugin-catalog', () => ({
  corePluginConnection: () => ({ base: 'https://core.qdip.test', key: 'PRIVATE-SERVICE-KEY' }),
}))
vi.mock('@/lib/zitadel-org-link-assertion', () => ({
  signZitadelOwnerLink: () => ({ issued_at: 1792400000, nonce: 'a'.repeat(32), assertion: 'b'.repeat(64) }),
}))

import { GET, POST } from './route'
import { sessionFromRequest } from '@/lib/qdip-oidc'
import { verifyOwnedZitadelOrganization } from '@/lib/zitadel-owner-organizations'

function request(method: 'GET' | 'POST', body?: object, origin = 'https://observatory.qdip.ai') {
  return new NextRequest('https://observatory.qdip.ai/api/observatory/organizations', {
    method,
    headers: {
      host: 'observatory.qdip.ai',
      origin,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {})...[truncated]