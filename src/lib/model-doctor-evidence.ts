/**
 * Browser-side fail-closed presentation gate for Doctor native CP-SAT evidence.
 * This is not a replacement for Doctor's server-side worker verification:
 * show "verified" details only when the entire proof is internally consistent.
 */
export type DoctorOperation = 'validate' | 'solve' | 'diagnose' | 'propose_repair'

type JsonObject = Record<string, unknown>
export type VerifiedAssumption = { literal: number; variableIndex: number; name: string; negated: boolean }
export type VerifiedRepair = {
  label: string
  literal: number
  solverStatus: 'OPTIMAL' | 'FEASIBLE'
  candidateHash: string
}
export type VerifiedHardConstraint = { index: number; name: string }
export type DoctorEvidence = {
  raw: JsonObject
  operation: DoctorOperation
  executionStatus: string
  solverStatus: string | null
  errorCode: string | null
  validationError: string | null
  objective: number | null
  solution: Array<{ index: number; value: number }>
  modelHash: string
  diagnosisKind: string
  assumptions: VerifiedAssumption[]
  hardConstraints: VerifiedHardConstraint[]
  repairs: VerifiedRepair[]
  invalidProof: boolean
}

const VALID_STATUS = new Set(['VALID', 'MODEL_INVALID', 'OPTIMAL', 'FEASIBLE', 'INFEASIBLE', 'UNKNOWN'])
const HEX = /^[0-9a-f]{64}$/
const FAILURES = new Set(['INPUT_REJECTED', 'WORKER_FAILED', 'WORKER_BUSY', 'WORKER_TIMEOUT'])
const REPAIR_SINGLE = 'VERIFIED_SINGLE_ASSUMPTION_RELAXATION'
const REPAIR_MULTIPLE = 'VERIFIED_ASSUMPTION_RELAXATION_ALTERNATIVES'
const CORE_KIND = 'VERIFIED_SUFFICIENT_ASSUMPTION_CORE'
const HARD_KIND = 'VERIFIED_SUFFICIENT_HARD_CONSTRAINT_CORE'
const LABEL_LIMIT = 80

export function asObject(value: unknown): JsonObject | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : null
}
function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value)
}
function safeString(value: unknown, limit = LABEL_LIMIT): string {
  return typeof value === 'string' ? value.slice(0, limit) : ''
}
function validHash(value: unknown): value is string {
  return typeof value === 'string' && HEX.test(value)
}

function validatedCore(diagnosis: JsonObject, status: string | null, operation: DoctorOperation): VerifiedAssumption[] {
  if (
    !['diagnose', 'propose_repair'].includes(operation) ||
    status !== 'INFEASIBLE' || diagnosis.kind !== CORE_KIND ||
    diagnosis.minimal !== false || diagnosis.verification_status !== 'INFEASIBLE' ||
    !Array.isArray(diagnosis.assumption_core) || diagnosis.assumption_core.length === 0 ||
    diagnosis.assumption_core.length > 2000
  ) return []
  const core: VerifiedAssumption[] = []
  const seen = new Set<number>()
  for (const item of diagnosis.assumption_core) {
    const a = asObject(item)
    if (
      !a || !isInteger(a.literal) || !isInteger(a.variable_index) || a.variable_index < 0 ||
      typeof a.variable_name !== 'string' || typeof a.negated !== 'boolean' ||
      seen.has(a.literal)
    ) return []
    seen.add(a.literal)
    core.push({
      literal: a.literal, variableIndex: a.variable_index,
      name: safeString(a.variable_name), negated: a.negated,
    })
  }
  return core
}

function validatedHard(diagnosis: JsonObject, inspection: unknown, status: string | null,
  operation: DoctorOperation): VerifiedHardConstraint[] {
  const model = asObject(inspection)
  const count = model?.constraints_total
  if (
    !['diagnose', 'propose_repair'].includes(operation) || status !== 'INFEASIBLE' ||
    diagnosis.kind !== HARD_KIND || diagnosis.minimal !== false ||
    diagnosis.verification_status !== 'INFEASIBLE' ||
    diagnosis.instrumentation !== 'GUARDED_LINEAR_CONSTRAINTS_V1' ||
    diagnosis.original_model_mutated !== false ||
    !isInteger(count) || count < 1 || count > 24 ||
    !Array.isArray(diagnosis.hard_constraints) ||
    diagnosis.hard_constraints.length < 1 || diagnosis.hard_constraints.length > 24
  ) return []
  const hard: VerifiedHardConstraint[] = []
  const seen = new Set<number>()
  for (const item of diagnosis.hard_constraints) {
    const c = asObject(item)
    if (
      !c || !isInteger(c.index) || c.index < 0 || c.index >= count ||
      seen.has(c.index) || c.type !== 'linear' ||
      typeof c.name !== 'string' || c.name.length > LABEL_LIMIT
    ) return []
    seen.add(c.index)
    hard.push({ index: c.index, name: c.name })
  }
  return hard
}

function validatedRepairs(repair: JsonObject, core: VerifiedAssumption[],
  status: string | null, operation: DoctorOperation): VerifiedRepair[] {
  const proposals = repair.proposals
  if (
    operation !== 'propose_repair' || status !== 'INFEASIBLE' ||
    core.length === 0 || !Array.isArray(proposals) ||
    proposals.length < 1 || proposals.length > 3 ||
    repair.kind !== (proposals.length === 1 ? REPAIR_SINGLE : REPAIR_MULTIPLE)
  ) return []
  const result: VerifiedRepair[] = []
  const seenLiterals = new Set<number>()
  const seenHashes = new Set<string>()
  for (const item of proposals) {
    const proposal = asObject(item)
    const assumption = asObject(proposal?.assumption)
    const hash = proposal?.candidate_wire_sha256
    if (
      !proposal || !assumption || !isInteger(assumption.literal) ||
      !isInteger(assumption.variable_index) ||
      typeof assumption.variable_name !== 'string' ||
      typeof assumption.negated !== 'boolean' ||
      !validHash(hash) ||
      proposal.operation !== 'REMOVE_ASSUMPTION' ||
      proposal.verified_by !== 'INDEPENDENT_CP_SAT_SOLVE' ||
      !['OPTIMAL', 'FEASIBLE'].includes(String(proposal.candidate_solver_status)) ||
      proposal.requires_user_approval !== true ||
      proposal.automatically_applied !== false ||
      seenLiterals.has(assumption.literal) || seenHashes.has(hash)
    ) return []
    const member = core.find((c) =>
      c.literal === assumption.literal &&
      c.variableIndex === assumption.variable_index &&
      c.name === safeString(assumption.variable_name) &&
      c.negated === assumption.negated
    )
    if (!member) return []
    seenLiterals.add(member.literal)
    seenHashes.add(hash)
    result.push({
      label: member.name || `#${member.variableIndex}`,
      literal: member.literal,
      solverStatus: proposal.candidate_solver_status as 'OPTIMAL' | 'FEASIBLE',
      candidateHash: hash,
    })
  }
  return result
}

/** A model hash is checked against the bytes selected by this browser, not just any server string. */
export function parseDoctorEvidence(
  value: unknown, operation: DoctorOperation, expectedHash: string
): DoctorEvidence | null {
  const raw = asObject(value)
  if (!raw || raw.contract_version !== 'doctor.native-cpsat.v0.1' ||
      raw.operation !== operation || !validHash(expectedHash) ||
      raw.model_wire_sha256 !== expectedHash) return null

  const execution = raw.execution_status
  const solver = raw.solver_status
  if (typeof execution !== 'string') return null
  const completed = execution === 'COMPLETED' && typeof solver === 'string' && VALID_STATUS.has(solver)
  if (!completed && !FAILURES.has(execution)) return null
  if (completed && ((operation === 'validate') !== ['VALID', 'MODEL_INVALID'].includes(solver))) return null
  if (completed && raw.error_code !== null) return null
  if (completed && solver === 'MODEL_INVALID' && (
    typeof raw.validation_error !== 'string' || !raw.validation_error
  )) return null
  if (completed && solver !== 'MODEL_INVALID' && raw.validation_error != null) return null
  if (!completed && solver !== null) return null

  let solution: DoctorEvidence['solution'] = []
  if (completed && (solver === 'OPTIMAL' || solver === 'FEASIBLE')) {
    if (!Array.isArray(raw.solution) || raw.solution.length > 100000 ||
        !raw.solution.every(isInteger)) return null
    solution = raw.solution.slice(0, 40).map((n: number, index: number) => ({ index, value: n }))
  } else if (raw.solution != null) return null
  const objective = completed && (solver === 'OPTIMAL' || solver === 'FEASIBLE') &&
    typeof raw.objective_value === 'number' && Number.isFinite(raw.objective_value)
    ? raw.objective_value : null
  if (!(solver === 'OPTIMAL' || solver === 'FEASIBLE') && raw.objective_value != null) return null

  const diagnosis = asObject(raw.diagnosis) ?? {}
  const repair = asObject(raw.repair) ?? {}
  const assumptions = completed ? validatedCore(diagnosis, solver, operation) : []
  const hardConstraints = completed ? validatedHard(diagnosis, raw.model_inspection, solver, operation) : []
  const repairs = completed ? validatedRepairs(repair, assumptions, solver, operation) : []
  const requiresProof = diagnosis.kind === CORE_KIND || diagnosis.kind === HARD_KIND ||
    repair.kind === REPAIR_SINGLE || repair.kind === REPAIR_MULTIPLE
  const invalidProof = requiresProof && (
    (diagnosis.kind === CORE_KIND && assumptions.length === 0) ||
    (diagnosis.kind === HARD_KIND && hardConstraints.length === 0) ||
    ([REPAIR_SINGLE, REPAIR_MULTIPLE].includes(String(repair.kind)) && repairs.length === 0)
  )
  // A malformed purported proof may still be inspected as raw diagnostic data,
  // but must never be displayed with a verified label or action.
  return {
    raw, operation, executionStatus: execution,
    solverStatus: completed ? solver : null,
    errorCode: safeString(raw.error_code, 160) || null,
    validationError: safeString(raw.validation_error, 500) || null,
    objective, solution, modelHash: expectedHash,
    diagnosisKind: safeString(diagnosis.kind, 100),
    assumptions: invalidProof ? [] : assumptions,
    hardConstraints: invalidProof ? [] : hardConstraints,
    repairs: invalidProof ? [] : repairs,
    invalidProof,
  }
}
