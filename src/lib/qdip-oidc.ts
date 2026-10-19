import 'server-only'

import { rrCoreApiKey } from '@/lib/rr-core-credential'

import { createHash, createHmac, createPublicKey, randomBytes, timingSafeEqual, verify } from 'node:crypto'
import type { JsonWebKey as NodeJsonWebKey } from 'node:crypto'
import type { NextRequest, NextResponse } from 'next/server'
import { PLATFORM_ORIGINS } from '@/routing-config'

type Role = 'studio' | 'rr_operator' | 'observatory_admin'
type Session = {
  sub: string
  issuer: string
  clientId: string
  projectId: string
  organizationId: string
  expiresAt: number
  roles: Role[]
  displayName?: string
  email?: string
}
type Pending = { state: string; nonce: string; verifier: string; returnTo: string; issuedAt: number }
type OidcDiscovery = {
  issuer: string
  authorization_endpoint: string
  token_endpoint: string
  jwks_uri: string
  userinfo_endpoint?: string
}

const FLOW_COOKIE = 'qdip_oidc_flow'
const SESSION_COOKIE = 'qdip_oidc_session'
const SESSION_SECONDS = 60 * 60
const FLOW_SECONDS = 10 * 60
const AUTH_CALLBACK_PATH = '/api/auth/callback/zitadel'

function sharedSecret() {
  const value = process.env.QDIP_AUTH_COOKIE_SECRET ?? ''
  return value.length >= 32 ? value : null
}

function configuredIssuer() {
  const raw = process.env.ZITADEL_ISSUER?.replace(/\/+$/, '')
  if (!raw) return null
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/')
      return null
    return url.origin
  } catch {
    return null
  }
}

type QdipRoleConfig = {
  projectId: string
  organizationId: string
  studioKey: string
  rrKey: string
  adminKey: string
}

function roleConfig(): QdipRoleConfig | null {
  const projectId = (process.env.ZITADEL_QDIP_PROJECT_ID ?? '').trim()
  const organizationId = (process.env.ZITADEL_QDIP_ORGANIZATION_ID ?? '').trim()
  const studioKey = (process.env.QDIP_STUDIO_ZITADEL_ROLE_KEY ?? 'studio').trim()
  const rrKey = (process.env.QDIP_RR_ZITADEL_ROLE_KEY ?? 'rr_operator').trim()
  const adminKey = (process.env.QDIP_OBSERVATORY_ADMIN_ZITADEL_ROLE_KEY ?? 'observatory_admin').trim()
  // Zitadel role keys may contain spaces; reject empty/control-character keys only.
  const validKey = (key: string) => key.length > 0 && key.length <= 128 && !/[\x00-\x1f\x7f]/.test(key)
  if (
    !/^\d+$/.test(projectId) ||
    !/^\d+$/.test(organizationId) ||
    !validKey(studioKey) ||
    !validKey(rrKey) ||
    !validKey(adminKey)
  )
    return null
  if (new Set([studioKey, rrKey, adminKey]).size !== 3) return null
  return { projectId, organizationId, studioKey, rrKey, adminKey }
}

function validRoles(value: unknown): value is Role[] {
  return (
    Array.isArray(value) &&
    value.length <= 3 &&
    value.every((role) => role === 'studio' || role === 'rr_operator' || role === 'observatory_admin') &&
    new Set(value).size === value.length
  )
}

export function oidcConfigured() {
  return Boolean(configuredIssuer() && (process.env.ZITADEL_CLIENT_ID ?? '').trim() && sharedSecret() && roleConfig())
}

export function operatorConfigured() {
  return Boolean(
    oidcConfigured() &&
    (process.env.DIP_API_BASE_URL ?? process.env.DIP_URL) &&
    rrCoreApiKey() &&
    (process.env.RR_ACTOR_ASSERTION_SECRET ?? '').length >= 32
  )
}

// The server trusts only permissions derived from verified project- and org-bound
// Zitadel ID-token claims and stored in the signed, short-lived session cookie.
// The subject alone NEVER grants access.
export function canAccessStudio(session: Session) {
  return validRoles(session.roles) && session.roles.includes('studio')
}

export function canAdministerObservatory(session: Session) {
  return validRoles(session.roles) && session.roles.includes('observatory_admin')
}

export function canOperateRr(session: Session) {
  return validRoles(session.roles) && session.roles.includes('rr_operator')
}

export function isAllowedSession(session: Session) {
  return validRoles(session.roles)
}

function rolesFromClaims(claims: Record<string, unknown>): Role[] {
  const config = roleConfig()
  if (!config) throw new Error('QDIP Zitadel role configuration is missing')
  const grant = claims[`urn:zitadel:iam:org:project:${config.projectId}:roles`]
  if (grant === undefined) return []
  if (!grant || typeof grant !== 'object' || Array.isArray(grant))
    throw new Error('Invalid Zitadel project roles claim')
  const assignedToOrganization = (key: string) => {
    const roleGrants = (grant as Record<string, unknown>)[key]
    return Boolean(
      roleGrants &&
      typeof roleGrants === 'object' &&
      !Array.isArray(roleGrants) &&
      Object.prototype.hasOwnProperty.call(roleGrants, config.organizationId) &&
      typeof (roleGrants as Record<string, unknown>)[config.organizationId] === 'string' &&
      (roleGrants as Record<string, string>)[config.organizationId].length > 0
    )
  }
  const roles: Role[] = []
  if (assignedToOrganization(config.studioKey)) roles.push('studio')
  if (assignedToOrganization(config.rrKey)) roles.push('rr_operator')
  if (assignedToOrganization(config.adminKey)) roles.push('observatory_admin')
  return roles
}

function mac(purpose: string, payload: string, secret: string) {
  return createHmac('sha256', secret)
    .update(purpose + ':' + payload)
    .digest('base64url')
}

function seal(value: Session | Pending, purpose: string) {
  const secret = sharedSecret()
  if (!secret) throw new Error('OIDC session signing key is missing')
  const payload = Buffer.from(JSON.stringify(value)).toString('base64url')
  return payload + '.' + mac(purpose, payload, secret)
}

function unseal<T>(signed: string | undefined, purpose: string): T | null {
  const secret = sharedSecret()
  if (!secret || !signed || signed.length > 6000) return null
  const fields = signed.split('.')
  if (fields.length !== 2) return null
  const [payload, signature] = fields
  const expected = Buffer.from(mac(purpose, payload, secret))
  const actual = Buffer.from(signature)
  if (actual.length !== expected.length || !timingSafeEqual(expected, actual)) return null
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as T
  } catch {
    return null
  }
}

export function safeReturnTo(value: string | null | undefined) {
  if (!value || value.length > 2048) return PLATFORM_ORIGINS.site + '/en'
  try {
    const url = new URL(value)
    if (url.username || url.password) return PLATFORM_ORIGINS.site + '/en'
    if (!Object.values(PLATFORM_ORIGINS).some((origin) => new URL(origin).origin === url.origin))
      return PLATFORM_ORIGINS.site + '/en'
    return url.href
  } catch {
    return PLATFORM_ORIGINS.site + '/en'
  }
}

export function loginUrl(returnTo: string) {
  const url = new URL('/api/auth/login', PLATFORM_ORIGINS.site)
  url.searchParams.set('return_to', safeReturnTo(returnTo))
  return url.toString()
}

export function onSiteOrigin(request: NextRequest) {
  // Next.js can expose its internal listener (127.0.0.1) through nextUrl,
  // even when a trusted proxy routes the external canonical site host.
  // Use the actual Host header, never spoofable x-forwarded-host.
  const canonical = new URL(PLATFORM_ORIGINS.site)
  const host = request.headers.get('host') ?? request.nextUrl.host
  if (!host || /[,\s@/?#]/.test(host)) return false
  let observed: URL
  try {
    observed = new URL(canonical.protocol + '//' + host)
  } catch {
    return false
  }
  if (observed.host.toLowerCase() !== canonical.host.toLowerCase()) return false

  // A proxy may terminate TLS, but cannot silently downgrade an HTTPS
  // public login to HTTP. For local tests only, allow the exact .localhost
  // canonical origin over HTTP without adding other allowed hosts.
  const forwardedProto = request.headers.get('x-forwarded-proto')
  const secureRequest = request.nextUrl.protocol === 'https:' || forwardedProto === 'https'
  if (canonical.protocol === 'https:') return forwardedProto !== 'http' && secureRequest
  // Only local HTTP testing is allowed; Next may annotate its internal
  // listener protocol differently from the external browser connection.
  return canonical.hostname.endsWith('.localhost')
}

function cookieOptions(request: NextRequest, maxAge: number, shared: boolean) {
  // The authenticated cookie is intentionally shared by qdip.ai and its two product subdomains.
  // PKCE flow cookie is host-only, preventing subdomains from reading or overwriting it.
  const root = new URL(PLATFORM_ORIGINS.site)
  return {
    httpOnly: true,
    secure: root.protocol === 'https:',
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
    ...(shared && root.hostname === 'qdip.ai' ? { domain: 'qdip.ai' } : {}),
  }
}

export function clearFlow(response: NextResponse, request: NextRequest) {
  response.cookies.set(FLOW_COOKIE, '', cookieOptions(request, 0, false))
}

export function clearSession(response: NextResponse, request: NextRequest) {
  response.cookies.set(SESSION_COOKIE, '', cookieOptions(request, 0, true))
}

export function startFlow(response: NextResponse, request: NextRequest, returnTo: string) {
  const flow: Pending = {
    state: randomBytes(32).toString('base64url'),
    nonce: randomBytes(32).toString('base64url'),
    verifier: randomBytes(32).toString('base64url'),
    returnTo: safeReturnTo(returnTo),
    issuedAt: Date.now(),
  }
  response.cookies.set(FLOW_COOKIE, seal(flow, 'flow-v1'), cookieOptions(request, FLOW_SECONDS, false))
  return flow
}

export function readFlow(request: NextRequest, state: string | null) {
  const flow = unseal<Pending>(request.cookies.get(FLOW_COOKIE)?.value, 'flow-v1')
  if (!flow || typeof state !== 'string' || !/^[\w-]{20,100}$/.test(state)) return null
  if (
    !Number.isFinite(flow.issuedAt) ||
    Date.now() - flow.issuedAt > FLOW_SECONDS * 1000 ||
    flow.issuedAt > Date.now() + 30_000
  )
    return null
  if (typeof flow.state !== 'string' || typeof flow.nonce !== 'string' || typeof flow.verifier !== 'string') return null
  const expected = Buffer.from(flow.state)
  const actual = Buffer.from(state)
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null
  return flow
}

function assertIssuerUrl(value: string, issuer: string) {
  const url = new URL(value)
  if (url.protocol !== 'https:' || url.origin !== issuer || url.username || url.password || url.hash)
    throw new Error('Untrusted OIDC endpoint')
  return url.toString()
}

async function readJson(url: string, init?: RequestInit) {
  const res = await fetch(url, { ...init, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw new Error('OIDC endpoint unavailable')
  const text = await res.text()
  if (text.length > 200_000) throw new Error('OIDC response exceeds limit')
  return JSON.parse(text) as Record<string, unknown>
}

export async function discoverOidc(): Promise<OidcDiscovery> {
  const issuer = configuredIssuer()
  if (!issuer) throw new Error('OIDC issuer missing or invalid')
  const doc = await readJson(issuer + '/.well-known/openid-configuration')
  if (doc.issuer !== issuer) throw new Error('OIDC issuer mismatch')
  if (
    typeof doc.authorization_endpoint !== 'string' ||
    typeof doc.token_endpoint !== 'string' ||
    typeof doc.jwks_uri !== 'string'
  )
    throw new Error('Invalid OIDC discovery document')
  return {
    issuer,
    authorization_endpoint: assertIssuerUrl(doc.authorization_endpoint, issuer),
    token_endpoint: assertIssuerUrl(doc.token_endpoint, issuer),
    jwks_uri: assertIssuerUrl(doc.jwks_uri, issuer),
    ...(typeof doc.userinfo_endpoint === 'string'
      ? { userinfo_endpoint: assertIssuerUrl(doc.userinfo_endpoint, issuer) }
      : {}),
  }
}

export function authorizationUrl(config: OidcDiscovery, flow: Pending) {
  const clientId = process.env.ZITADEL_CLIENT_ID?.trim()
  if (!clientId) throw new Error('OIDC client ID missing')
  const url = new URL(config.authorization_endpoint)
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('response_type', 'code')
  const roleSettings = roleConfig()
  if (!roleSettings) throw new Error('QDIP Zitadel role configuration is missing')
  url.searchParams.set(
    'scope',
    // Do not scope roles to a guessed organization: Zitadel silently drops grants for other organizations.
    // The verified project/org membership is enforced by rolesFromClaims after token issuance.
    `openid profile email urn:zitadel:iam:org:project:id:${roleSettings.projectId}:aud urn:iam:org:project:roles urn:zitadel:iam:org:projects:roles`
  )
  url.searchParams.set('redirect_uri', new URL(AUTH_CALLBACK_PATH, PLATFORM_ORIGINS.site).toString())
  url.searchParams.set('state', flow.state)
  url.searchParams.set('nonce', flow.nonce)
  url.searchParams.set('code_challenge', createHash('sha256').update(flow.verifier).digest('base64url'))
  url.searchParams.set('code_challenge_method', 'S256')
  return url
}

type JwtClaims = Record<string, unknown>

function safeIdentityLabel(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim()
  if (!normalized || normalized.length > maxLength || /[\x00-\x1f\x7f]/.test(normalized)) return undefined
  return normalized
}

function identityFromClaims(claims: Record<string, unknown>) {
  const displayName = safeIdentityLabel(claims.name, 160) ?? safeIdentityLabel(claims.preferred_username, 160)
  const email = safeIdentityLabel(claims.email, 254)
  return {
    ...(displayName ? { displayName } : {}),
    ...(email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? { email } : {}),
  }
}

export async function verifyIdToken(token: string, flow: Pending, config: OidcDiscovery): Promise<Session> {
  if (token.length > 15_000) throw new Error('Invalid ID token')
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('Invalid ID token')
  let header: Record<string, unknown>, claims: JwtClaims
  try {
    header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'))
    claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
  } catch {
    throw new Error('Invalid ID token')
  }
  if (header.alg !== 'RS256' || typeof header.kid !== 'string' || header.kid.length > 256)
    throw new Error('Unsupported ID token signing key')
  const jwks = await readJson(config.jwks_uri)
  const keys = jwks.keys
  if (!Array.isArray(keys)) throw new Error('Invalid JWKS')
  const jwk = keys.find(
    (key) =>
      key &&
      typeof key === 'object' &&
      key.kid === header.kid &&
      key.kty === 'RSA' &&
      (key.use === undefined || key.use === 'sig') &&
      (key.alg === undefined || key.alg === 'RS256')
  )
  if (!jwk) throw new Error('Untrusted ID token signing key')
  const publicKey = createPublicKey({ key: jwk as NodeJsonWebKey, format: 'jwk' })
  if (!verify('RSA-SHA256', Buffer.from(parts[0] + '.' + parts[1]), publicKey, Buffer.from(parts[2], 'base64url')))
    throw new Error('Invalid ID token signature')
  const clientId = process.env.ZITADEL_CLIENT_ID?.trim()
  const aud = claims.aud
  const audiences = typeof aud === 'string' ? [aud] : Array.isArray(aud) ? aud : []
  const now = Math.floor(Date.now() / 1000)
  if (
    !clientId ||
    !audiences.includes(clientId) ||
    (audiences.length > 1 && claims.azp !== clientId) ||
    claims.iss !== config.issuer ||
    claims.nonce !== flow.nonce ||
    typeof claims.sub !== 'string' ||
    !claims.sub ||
    typeof claims.exp !== 'number' ||
    claims.exp <= now ||
    typeof claims.iat !== 'number' ||
    claims.iat > now + 60
  )
    throw new Error('Invalid ID token claims')
  const roleSettings = roleConfig()
  if (!roleSettings) throw new Error('QDIP Zitadel role configuration is missing')
  return {
    sub: claims.sub,
    issuer: config.issuer,
    clientId,
    projectId: roleSettings.projectId,
    organizationId: roleSettings.organizationId,
    expiresAt: Math.min(claims.exp, now + SESSION_SECONDS),
    roles: rolesFromClaims(claims),
    ...identityFromClaims(claims),
  }
}

export async function exchangeCode(code: string, flow: Pending, config: OidcDiscovery) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: process.env.ZITADEL_CLIENT_ID?.trim() ?? '',
    redirect_uri: new URL(AUTH_CALLBACK_PATH, PLATFORM_ORIGINS.site).toString(),
    code_verifier: flow.verifier,
  })
  const payload = await readJson(config.token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (typeof payload.id_token !== 'string') throw new Error('OIDC ID token missing')
  const session = await verifyIdToken(payload.id_token, flow, config)
  if (!config.userinfo_endpoint || (session.email && session.displayName)) return session

  // Zitadel may assert roles in Userinfo even when they are absent from the ID token.
  // Read only from the discovered, issuer-pinned endpoint using this code exchange's access token.
  // A Userinfo response never overrides a role-bearing ID token.
  const accessToken = payload.access_token
  if (typeof accessToken !== 'string' || accessToken.length < 10 || accessToken.length > 15_000) return session
  let userinfo: Record<string, unknown>
  try {
    userinfo = await readJson(config.userinfo_endpoint, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
  } catch {
    return session
  }
  if (userinfo.sub !== session.sub) throw new Error('OIDC Userinfo subject mismatch')
  const identity = identityFromClaims(userinfo)
  return {
    ...session,
    displayName: session.displayName ?? identity.displayName,
    email: session.email ?? identity.email,
    roles: session.roles.length > 0 ? session.roles : rolesFromClaims(userinfo),
  }
}

export function attachSession(response: NextResponse, request: NextRequest, session: Session) {
  response.cookies.set(
    SESSION_COOKIE,
    seal(session, 'session-v1'),
    cookieOptions(request, Math.max(0, session.expiresAt - Math.floor(Date.now() / 1000)), true)
  )
}

export function getQdipSession(value: string | undefined): Session | null {
  if (!oidcConfigured()) return null
  const roleSettings = roleConfig()
  if (!roleSettings) return null
  const session = unseal<Session>(value, 'session-v1')
  if (
    !session ||
    typeof session.sub !== 'string' ||
    (session.displayName !== undefined && safeIdentityLabel(session.displayName, 160) !== session.displayName) ||
    (session.email !== undefined && safeIdentityLabel(session.email, 254) !== session.email) ||
    !validRoles(session.roles) ||
    session.sub.length === 0 ||
    session.issuer !== configuredIssuer() ||
    session.clientId !== process.env.ZITADEL_CLIENT_ID ||
    session.projectId !== roleSettings.projectId ||
    session.organizationId !== roleSettings.organizationId ||
    typeof session.expiresAt !== 'number' ||
    session.expiresAt <= Math.floor(Date.now() / 1000) ||
    session.expiresAt > Math.floor(Date.now() / 1000) + SESSION_SECONDS
  )
    return null
  return session
}

export function sessionFromRequest(request: NextRequest) {
  return getQdipSession(request.cookies.get(SESSION_COOKIE)?.value)
}

export const QDIP_SESSION_COOKIE = SESSION_COOKIE
