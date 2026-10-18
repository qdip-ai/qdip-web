import { describe, it, expect } from 'vitest'
import {
  OperatorRequestGuard,
  classifyOperatorHttpStatus,
  parsedExecutionIds,
  recoverableRRSubmission,
} from './operator-guards'

describe('Kernel operator authority and race controls', () => {
  it('invalidates old result completion after another request or logout', () => {
    const guard = new OperatorRequestGuard()
    const first = guard.begin()
    const second = guard.begin()
    expect(guard.current(first)).toBe(false)
    expect(guard.current(second)).toBe(true)
    guard.invalidate()
    expect(guard.current(second)).toBe(false)
  })
  it('classifies negative authoritative HTTP outcomes without manufacturing infeasibility', () => {
    expect(classifyOperatorHttpStatus(401)).toBe('AUTH_REQUIRED')
    expect(classifyOperatorHttpStatus(403)).toBe('ACCESS_DENIED')
    expect(classifyOperatorHttpStatus(409)).toBe('CONFLICT')
    expect(classifyOperatorHttpStatus(422)).toBe('INVALID_INPUT')
    expect(classifyOperatorHttpStatus(404)).toBe('UNSUPPORTED')
    expect(classifyOperatorHttpStatus(503)).toBe('UNAVAILABLE')
  })
  it('ignores malformed execution ids returned in arbitrary result fields', () => {
    expect(
      parsedExecutionIds({
        result: { workflow: { execution_id: 'safe-1', ingestion: { payload: { decision_id: 'safe.2' } } } },
      })
    ).toEqual({ executionId: 'safe-1', decisionId: 'safe.2' })
    expect(
      parsedExecutionIds({
        result: { workflow: { execution_id: '../../bad', ingestion: { payload: { decision_id: 42 } } } },
      })
    ).toEqual({ executionId: '', decisionId: '' })
  })
})

describe('lost RR acknowledgement identity', () => {
  const preflight = {
    execution_id: 'run-10',
    decision_id: 'workshop',
    payload_digest: 'a'.repeat(64),
    source_snapshot_id: 'snapshot-10',
  }

  it('requires the exact server preflight-bound create ID', () => {
    expect(recoverableRRSubmission('create', '{"execution_id":"run-10"}', { preflight })).toMatchObject({
      executionId: 'run-10',
      decisionId: 'workshop',
      payloadDigest: 'a'.repeat(64),
    })
    expect(recoverableRRSubmission('create', '{"execution_id":"other"}', { preflight })).toBeNull()
    expect(recoverableRRSubmission('create', '{"execution_id":"../bad"}', { preflight })).toBeNull()
    expect(recoverableRRSubmission('create', '{"execution_id":"run-10"}', {})).toBeNull()
  })

  it('supports both replan formats and refuses ambiguous or unsafe IDs', () => {
    const opts = { predecessorExecutionId: 'run-10', decisionId: 'workshop' }
    expect(recoverableRRSubmission('replan', '{"execution_id":"run-11"}', opts)).toMatchObject({
      executionId: 'run-11',
      predecessorExecutionId: 'run-10',
    })
    const normalized = JSON.stringify({
      format_version: 'readiness-recovery.normalized-replan.v1',
      import_document: { execution_id: 'run-12' },
    })
    expect(recoverableRRSubmission('replan', normalized, opts)?.executionId).toBe('run-12')
    expect(recoverableRRSubmission('replan', '{"execution_id":"run-10"}', opts)).toBeNull()
    expect(recoverableRRSubmission('replan', '{"execution_id":"run-11"}', {})).toBeNull()
    expect(recoverableRRSubmission('replan', '{', opts)).toBeNull()
  })
})
