import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

vi.mock('server-only', () => ({}))

import { operatorAuthorized, operatorConfigured, safeTransport, sameOrigin } from './rr-operator-auth'
import { attachSession, canOperateRr, getQdipSession, safeReturnTo } from './qdip-oidc'
import { NextResponse } from 'next/server'

beforeEach(() => {
  vi.stubEnv('ZITADEL_ISSUER', 'https://identity.example.test')
  vi.stubEnv('ZITADEL_CLIENT_ID', '394566248211424533')
  vi.stubEnv('QDIP_AUTH_COOKIE_SECRET', 'a-strong-and-independent-oidc-cookie-signing-secret')
  vi.stubEnv('ZITADEL_QDIP_PROJECT_ID', '123456789')
  vi.stubEnv('ZITADEL_QDIP_ORGANIZATION_ID', '987654321')
  vi.stubEnv('DIP_API_BASE_URL', 'http://127.0.0.1:8000')
  vi.stubEnv('DIP_API_KEY', 'test-org-scoped-key')
  vi.stubEnv('RR_ORG_API_KEY', '')
  vi.stubEnv('RR_ACTOR_ASSERTION_SECRET', 'this-is-an-independent-core-rr-actor-signing-secret')
})

afterEach(() => vi.unstubAllEnvs())

describe('Zitadel-backed RR session boundary', () => {
  it('fails closed without valid OIDC project scope or operator backend credentials', () => {
    vi.stubEnv('ZITADEL_QDIP_PROJECT_ID', '')
    expect(operatorConfigured()).toBe(false)
    vi.stubEnv('ZITADEL_QDIP_PROJECT_ID', '123456789')
    vi.stubEnv('ZITADEL_ISSUER', '')
    expect(operatorConfigured()).toBe(false)
  })

  it('accepts dedicated RR credential without requiring the platform Core key', () => {
    vi.stubEnv('DIP_API_KEY', '')
    vi.stubEnv('RR_ORG_API_KEY', 'dedicated-single-org-rr-key')
    expect(operatorConfigured()).toBe(true)
    vi.stubEnv('RR_ORG_API_KEY', '')
    expect(operatorConfigured()).toBe(false)
  })

  it('derives operator permission from signed roles, not a matching subject ID', () => {
    expect(operatorConfigured()).toBe(true)
    const req = { nextUrl: new URL('https://observatory.qdip.ai/en/readiness-recovery') } as NextRequest
    const response = NextResponse.json({})
    attachSession(response, req, {
      sub: 'user-1',
      roles: ['rr_operator'],
      projectId: '123456789',
      organizationId: '987654321',
      issuer: 'https://identity.example.test',
      clientId: '394566248211424533',
      expiresAt: Math.floor(Date.now() / 1000) + 300,
    })
    const cookie = response.cookies.get('qdip_oidc_session')?.value
    expect(getQdipSession(cookie)?.sub).toBe('user-1')
    const request = { cookies: { get: () => ({ value: cookie }) } } as unknown as NextRequest
    expect(operatorAuthorized(request)).toBe(true)
    expect(canOperateRr(getQdipSession(cookie)!)).toBe(true)
    const studioResponse = NextResponse.json({})
    attachSession(studioResponse, req, {
      sub: 'user-1',
      roles: ['studio'],
      projectId: '123456789',
      organizationId: '987654321',
      issuer: 'https://identity.example.test',
      clientId: '394566248211424533',
      expiresAt: Math.floor(Date.now() / 1000) + 300,
    })
    const studioCookie = studioResponse.cookies.get('qdip_oidc_session')?.value
    const studioRequest = { cookies: { get: () => ({ value: studioCookie }) } } as unknown as NextRequest
    expect(operatorAuthorized(studioRequest)).toBe(false)
    expect(getQdipSession(cookie + 'tampered')).toBeNull()
    vi.stubEnv('ZITADEL_QDIP_ORGANIZATION_ID', '111111111')
    expect(getQdipSession(cookie)).toBeNull()
  })

  it('rejects open redirects and cross-origin mutation', () => {
    expect(safeReturnTo('https://evil.example/path')).toBe('https://qdip.ai/en')
    expect(safeReturnTo('https://observatory.qdip.ai/en')).toBe('https://observatory.qdip.ai/en')
    const make = (url: string, origin?: string) =>
      ({ nextUrl: new URL(url), headers: new Headers(origin ? { origin } : {}) }) as unknown as NextRequest
    expect(sameOrigin(make('https://observatory.qdip.ai/api/rr-operator/session', 'https://evil.example'))).toBe(false)
    expect(sameOrigin(make('https://observatory.qdip.ai/api/rr-operator/session', 'https://observatory.qdip.ai'))).toBe(
      true
    )
    expect(safeTransport(make('https://observatory.qdip.ai/api/rr-operator/session'))).toBe(true)
    expect(safeTransport(make('http://observatory.qdip.ai/api/rr-operator/session'))).toBe(false)
    expect(safeTransport(make('https://qdip.ai/api/rr-operator/session'))).toBe(false)
    // Next's request URL can be the internal listener; the original Host is authoritative.
    const behindLocalProxy = {
      nextUrl: new URL('http://127.0.0.1:3000/api/rr-operator/kernel/preflight'),
      headers: new Headers({
        host: 'observatory.localhost:3000',
        origin: 'http://observatory.localhost:3000',
      }),
    } as unknown as NextRequest
    expect(safeTransport(behindLocalProxy)).toBe(true)
    expect(sameOrigin(behindLocalProxy)).toBe(true)

    const wrongHost = {
      nextUrl: new URL('http://127.0.0.1:3000/api/rr-operator/kernel/preflight'),
      headers: new Headers({
        host: 'attacker.localhost:3000',
        origin: 'http://attacker.localhost:3000',
      }),
    } as unknown as NextRequest
    expect(safeTransport(wrongHost)).toBe(false)
    expect(sameOrigin(wrongHost)).toBe(false)

    const originSpoofed = {
      nextUrl: behindLocalProxy.nextUrl,
      headers: new Headers({
        host: 'observatory.localhost:3000',
        origin: 'http://attacker.localhost:3000',
      }),
    } as unknown as NextRequest
    expect(safeTransport(originSpoofed)).toBe(true)
    expect(sameOrigin(originSpoofed)).toBe(false)

    const behindTlsProxy = {
      nextUrl: new URL('http://127.0.0.1:3000/api/rr-operator/session'),
      headers: new Headers({
        host: 'observatory.qdip.ai',
        origin: 'https://observatory.qdip.ai',
        'x-forwarded-proto': 'https',
      }),
    } as unknown as NextRequest
    expect(safeTransport(behindTlsProxy)).toBe(true)
    expect(sameOrigin(behindTlsProxy)).toBe(true)

    const insecureProduction = {
      nextUrl: new URL('http://127.0.0.1:3000/api/rr-operator/session'),
      headers: new Headers({ host: 'observatory.qdip.ai', origin: 'http://observatory.qdip.ai' }),
    } as unknown as NextRequest
    expect(safeTransport(insecureProduction)).toBe(false)
    expect(sameOrigin(insecureProduction)).toBe(false)
  })
})
