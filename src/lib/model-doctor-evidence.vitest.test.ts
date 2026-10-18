import { describe, expect, it } from 'vitest'
import { parseDoctorEvidence } from './model-doctor-evidence'

const HASH = 'a'.repeat(64)
const NEXT = 'b'.repeat(64)

function base(operation: 'validate' | 'solve' | 'diagnose' | 'propose_repair' = 'propose_repair') {
  return {
    contract_version: 'doctor.native-cpsat.v0.1',
    operation,
    model_wire_sha256: HASH,
    execution_status: 'COMPLETED',
    solver_status: 'INFEASIBLE',
    error_code: null,
    validation_error: null,
    solution: null,
    objective_value: null,
    diagnosis: {
      kind: 'VERIFIED_SUFFICIENT_ASSUMPTION_CORE',
      verification_status: 'INFEASIBLE',
      minimal: false,
      assumption_core: [
        { literal: 1, variable_index: 1, variable_name: 'A', negated: false },
        { literal: 2, variable_index: 2, variable_name: 'B', negated: false },
      ],
    },
    repair: { kind: 'NOT_APPLICABLE', proposals: [] as Array<Record<string, unknown>> },
  }
}

function proposal(literal: number, hash: string) {
  return {
    operation: 'REMOVE_ASSUMPTION',
    assumption: {
      literal,
      variable_index: literal,
      variable_name: literal === 1 ? 'A' : 'B',
      negated: false,
    },
    candidate_wire_sha256: hash,
    candidate_solver_status: 'FEASIBLE',
    verified_by: 'INDEPENDENT_CP_SAT_SOLVE',
    requires_user_approval: true,
    automatically_applied: false,
  }
}

describe('Doctor native evidence anti-forgery presentation gate', () => {
  it('requires exact contract, operation and locally calculated SHA-256', () => {
    const good = base()
    expect(parseDoctorEvidence(good, 'propose_repair', HASH)?.solverStatus).toBe('INFEASIBLE')
    expect(parseDoctorEvidence(good, 'propose_repair', NEXT)).toBeNull()
    expect(parseDoctorEvidence({ ...good, operation: 'solve' }, 'propose_repair', HASH)).toBeNull()
    expect(parseDoctorEvidence({ ...good, contract_version: 'unknown' }, 'propose_repair', HASH)).toBeNull()
    expect(parseDoctorEvidence({ ...good, solver_status: 'VERIFIED' }, 'propose_repair', HASH)).toBeNull()
  })

  it('reports a sufficient but not minimal core and two independently proven choices', () => {
    const data = base()
    data.repair.kind = 'VERIFIED_ASSUMPTION_RELAXATION_ALTERNATIVES'
    data.repair.proposals = [proposal(1, NEXT), proposal(2, 'c'.repeat(64))]
    const proof = parseDoctorEvidence(data, 'propose_repair', HASH)
    expect(proof?.assumptions).toHaveLength(2)
    expect(proof?.repairs).toMatchObject([{ literal: 1 }, { literal: 2 }])
    expect(proof?.invalidProof).toBe(false)
    expect(proof?.solution).toEqual([])
  })

  it.each([
    ['forged verified_by', { verified_by: 'AI_GUESS' }],
    ['no approval', { requires_user_approval: false }],
    ['silently applied', { automatically_applied: true }],
    ['wrong operation', { operation: 'CHANGE_CONSTRAINT' }],
    ['bad solver', { candidate_solver_status: 'UNKNOWN' }],
    ['duplicate hash', { candidate_wire_sha256: NEXT }],
  ])('hides the entire set of proposals for %s', (_reason, change) => {
    const data = base()
    data.repair.kind = 'VERIFIED_ASSUMPTION_RELAXATION_ALTERNATIVES'
    data.repair.proposals = [proposal(1, NEXT), { ...proposal(2, 'c'.repeat(64)), ...change }]
    const proof = parseDoctorEvidence(data, 'propose_repair', HASH)
    expect(proof?.invalidProof).toBe(true)
    expect(proof?.repairs).toEqual([])
    expect(proof?.assumptions).toEqual([])
  })

  it('rejects unproven or contradictory cores, cannot call them verified', () => {
    const data = base()
    data.diagnosis.minimal = true
    const result = parseDoctorEvidence(data, 'propose_repair', HASH)
    expect(result?.invalidProof).toBe(true)
    expect(result?.assumptions).toEqual([])
    const other = base()
    other.diagnosis.assumption_core[1].literal = 1
    expect(parseDoctorEvidence(other, 'propose_repair', HASH)?.invalidProof).toBe(true)
  })

  it('shows a rejected malformed binary only as an error, without a fabricated digest or proof', () => {
    const result = {
      ...base(),
      execution_status: 'INPUT_REJECTED',
      solver_status: null,
      model_wire_sha256: null,
      error_code: 'INVALID_PROTOBUF',
      diagnosis: { kind: 'NOT_APPLICABLE', assumption_core: [] },
    }
    const evidence = parseDoctorEvidence(result, 'propose_repair', HASH)
    expect(evidence?.errorCode).toBe('INVALID_PROTOBUF')
    expect(evidence?.repairs).toEqual([])
    expect(parseDoctorEvidence({ ...result, model_wire_sha256: NEXT }, 'propose_repair', HASH)).toBeNull()
  })

  it('keeps solver output limited and never labels failures as proof', () => {
    const data = base('solve')
    data.solver_status = 'OPTIMAL'
    data.diagnosis.kind = 'NOT_APPLICABLE'
    data.diagnosis.assumption_core = []
    const solved = { ...data, solution: Array.from({ length: 80 }, (_, i) => i) }
    expect(parseDoctorEvidence(solved, 'solve', HASH)?.solution).toHaveLength(40)
    const forged = { ...data, error_code: 'unexpected', solution: [1] }
    expect(parseDoctorEvidence(forged, 'solve', HASH)).toBeNull()
  })
})
