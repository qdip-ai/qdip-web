import { createHash, createHmac } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
import { signRrActor, signRrRequestActor } from './rr-actor-assertion'

const issuer = 'https://identity.example.test'
const subject = 'oidc-sub-123'
const secret = 'unique-shared-rr-audit-assertion-secret-minimum-32'
const apiKey = 'org-alpha-integration-api-key'

describe('authenticated RR operator audit assertion', () => {
  it('binds immutable Zitadel subject and operation to a short-lived MAC', () => {
    const fixedNow = 1791676800000
    const assertion = signRrActor(issuer, subject, 'execute', secret, apiKey, fixedNow)
    const pieces = assertion.split('.')
    expect(pieces).toHaveLength(5)
    expect(pieces[0]).toBe('v2')
    expect(Number(pieces[1])).toBe(Math.floor(fixedNow / 1000) + 30)
    const hash = createHash('sha256').update(issuer).update('\0').update(subject).digest('hex')
    expect(pieces[2]).toBe('zitadel:' + hash)
    expect(pieces[3]).toBe('execute')
    const payload = pieces.slice(0, 4).join('.')
    expect(pieces[4]).toBe(createHmac('sha256', secret).update(payload).update('\0').update(apiKey).digest('hex'))
    expect(signRrActor(issuer, subject, 'replan', secret, apiKey, fixedNow)).not.toBe(assertion)
    expect(signRrActor(issuer, 'someone-else', 'execute', secret, apiKey, fixedNow)).not.toBe(assertion)
    expect(signRrActor(issuer, subject, 'execute', secret, 'org-beta-key', fixedNow)).not.toBe(assertion)
  })

  it('refuses invalid issuer, missing subject and an absent signing secret', () => {
    expect(() => signRrActor('http://invalid.local', subject, 'execute', secret, apiKey)).toThrow()
    expect(() => signRrActor(issuer, '', 'execute', secret, apiKey)).toThrow()
    expect(() => signRrActor(issuer, subject, 'execute', 'short', apiKey)).toThrow()
    expect(() => signRrActor(issuer, subject, 'execute', secret, '')).toThrow()
  })
})

describe('request-bound standalone RR assertion', () => {
  const context = {
    organizationId: 'core-rr-organization',
    method: 'POST',
    path: '/api/v1/readiness-recovery/executions',
    body: '{"execution_id":"rr-fixture"}',
    idempotencyKey: 'idempotent-rr-fixture',
  }

  it('binds the exact UTF-8 body, route, method, organization and idempotency identity', () => {
    const assertion = signRrRequestActor(
      issuer,
      subject,
      'execute',
      secret,
      apiKey,
      context,
      1791676800000,
      'a'.repeat(32)
    )
    const [version, payload, mac] = assertion.split('.')
    expect(version).toBe('v3')
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    expect(claims).toEqual({
      actor_id: 'zitadel:' + createHash('sha256').update(issuer).update('\0').update(subject).digest('hex'),
      assertion_id: 'a'.repeat(32),
      expires_at: 1791676830,
      organization_id: context.organizationId,
      operation: 'execute',
      method: 'POST',
      path: context.path,
      body_sha256: createHash('sha256').update(context.body, 'utf8').digest('hex'),
      idempotency_key: context.idempotencyKey,
    })
    expect(mac).toBe(
      createHmac('sha256', secret)
        .update('v3.' + payload)
        .update('\0')
        .update(apiKey)
        .digest('hex')
    )
  })

  it('issues a fresh assertion identity while keeping the legitimate retry context unchanged', () => {
    const first = signRrRequestActor(issuer, subject, 'execute', secret, apiKey, context)
    const second = signRrRequestActor(issuer, subject, 'execute', secret, apiKey, context)
    const claims = (token: string) => JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'))
    expect(claims(first).assertion_id).not.toBe(claims(second).assertion_id)
    expect(claims(first).idempotency_key).toBe(claims(second).idempotency_key)
    expect(claims(first).body_sha256).toBe(claims(second).body_sha256)
  })

  it('rejects missing organization/idempotency bindings and noncanonical operations', () => {
    for (const invalid of [{ organizationId: '' }, { idempotencyKey: '' }, { method: 'GET' }, { path: '/unrelated' }])
      expect(() => signRrRequestActor(issuer, subject, 'execute', secret, apiKey, { ...context, ...invalid })).toThrow()
  })
})
