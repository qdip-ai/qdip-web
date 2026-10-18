/** Client-side race isolation; server-side authority is always the Kernel. */
export class OperatorRequestGuard {
  private revision = 0
  begin() {
    this.revision += 1
    return this.revision
  }
  invalidate() {
    this.revision += 1
  }
  current(revision: number) {
    return this.revision === revision
  }
}

export type OperatorErrorKind =
  'AUTH_REQUIRED' | 'ACCESS_DENIED' | 'CONFLICT' | 'INVALID_INPUT' | 'UNSUPPORTED' | 'UNAVAILABLE' | 'TRANSPORT_ERROR'

export function classifyOperatorHttpStatus(status: number): OperatorErrorKind {
  if (status === 401) return 'AUTH_REQUIRED'
  if (status === 403) return 'ACCESS_DENIED'
  if (status === 409 || status === 412) return 'CONFLICT'
  if (status === 400 || status === 413 || status === 415 || status === 422) return 'INVALID_INPUT'
  if (status === 404 || status === 410) return 'UNSUPPORTED'
  return 'UNAVAILABLE'
}

export class OperatorRequestError extends Error {
  constructor(
    readonly kind: OperatorErrorKind,
    message: string
  ) {
    super(message)
    this.name = 'OperatorRequestError'
  }
}

export function parsedExecutionIds(value: unknown): { executionId: string; decisionId: string } {
  if (!value || typeof value !== 'object') return { executionId: '', decisionId: '' }
  const result = 'result' in value ? value.result : undefined
  if (!result || typeof result !== 'object') return { executionId: '', decisionId: '' }
  const workflow = 'workflow' in result ? result.workflow : undefined
  if (!workflow || typeof workflow !== 'object') return { executionId: '', decisionId: '' }
  const executionId = 'execution_id' in workflow ? workflow.execution_id : null
  const ingestion = 'ingestion' in workflow ? workflow.ingestion : null
  const payload = ingestion && typeof ingestion === 'object' && 'payload' in ingestion ? ingestion.payload : null
  const decisionId = payload && typeof payload === 'object' && 'decision_id' in payload ? payload.decision_id : null
  const safe = (id: unknown) => (typeof id === 'string' && /^[a-zA-Z0-9][\w.-]{0,127}$/.test(id) ? id : '')
  return { executionId: safe(executionId), decisionId: safe(decisionId) }
}

/** Resolve an ambiguous write by identity, never by retrying its POST. */
export function recoverableRRSubmission(
  kind: 'create' | 'replan',
  rawBody: string | undefined,
  options: {
    preflight?: {
      execution_id: string
      decision_id: string
      payload_digest: string
      source_snapshot_id: string
    } | null
    predecessorExecutionId?: string
    decisionId?: string
  }
): {
  executionId: string
  decisionId: string | null
  predecessorExecutionId: string | null
  payloadDigest: string | null
  sourceSnapshotId: string | null
} | null {
  if (!rawBody) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(rawBody)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  const doc = parsed as Record<string, unknown>
  const validId = (id: unknown): id is string =>
    typeof id === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(id)

  if (kind === 'create') {
    const preflight = options.preflight
    if (
      !preflight ||
      !validId(doc.execution_id) ||
      doc.execution_id !== preflight.execution_id ||
      !validId(preflight.decision_id) ||
      !/^[0-9a-f]{64}$/.test(preflight.payload_digest) ||
      !preflight.source_snapshot_id.trim()
    ) return null
    return {
      executionId: doc.execution_id,
      decisionId: preflight.decision_id,
      predecessorExecutionId: null,
      payloadDigest: preflight.payload_digest,
      sourceSnapshotId: preflight.source_snapshot_id,
    }
  }

  const successor = doc.format_version === 'readiness-recovery.normalized-replan.v1'
    ? doc.import_document
    : doc
  if (!successor || typeof successor !== 'object' || Array.isArray(successor)) return null
  const nextId = (successor as Record<string, unknown>).execution_id
  if (
    !validId(nextId) ||
    !validId(options.predecessorExecutionId) ||
    nextId === options.predecessorExecutionId
  ) return null
  return {
    executionId: nextId,
    decisionId: validId(options.decisionId) ? options.decisionId : null,
    predecessorExecutionId: options.predecessorExecutionId,
    payloadDigest: null,
    sourceSnapshotId: null,
  }
}
