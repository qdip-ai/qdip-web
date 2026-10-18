'use client'

import { useEffect, useRef, useState } from 'react'
import type { Locale } from '@/lib/observatory-i18n'
import { rrOperatorCopy } from './operator-copy'
import { RREconomicPreflightPanel } from './economic-preflight-panel'
import { OperatorEvidence, isKernelRRPresentation, type KernelRRPresentation } from './operator-evidence'
import { canCompareRRExecutions, RRExecutionComparison } from './operator-comparison'
import {
  OperatorRequestError,
  OperatorRequestGuard,
  classifyOperatorHttpStatus,
  parsedExecutionIds,
  recoverableRRSubmission,
  type OperatorErrorKind,
} from './operator-guards'
import {
  METRIC_KEYS,
  defaultKernelView,
  moveKernelPanel,
  readKernelView,
  saveKernelView,
  templateKernelView,
  toggleKernelMetric,
  type KernelPanel,
  type KernelView,
} from './operator-presentation'

type Session = { configured: boolean; authenticated: boolean; mode: string }
type KernelPreflight = {
  schema_version: 'readiness-recovery.presentation.v1'
  validation_scope: 'SCHEMA_AND_ADMISSION_ONLY'
  accepted_for_kernel_submission: true
  execution_id: string
  decision_id: string
  source_system: string
  source_snapshot_id: string
  source_version: string
  payload_digest: string
  job_count: number
  technician_count: number
  inventory_item_types: number
  donor_count: number
  horizon_slots: number
  workshop_capacity: number
  warning: 'NOT_EXECUTION_OR_FEASIBILITY_PROOF'
}
function isKernelPreflight(value: unknown): value is KernelPreflight {
  if (!value || typeof value !== 'object') return false
  const v = value as Partial<KernelPreflight>
  return (
    v.schema_version === 'readiness-recovery.presentation.v1' &&
    v.validation_scope === 'SCHEMA_AND_ADMISSION_ONLY' &&
    v.accepted_for_kernel_submission === true &&
    typeof v.execution_id === 'string' &&
    /^[A-Za-z0-9_.-]{1,128}$/.test(v.execution_id) &&
    typeof v.decision_id === 'string' &&
    /^[A-Za-z0-9_.-]{1,128}$/.test(v.decision_id) &&
    typeof v.source_system === 'string' &&
    v.source_system.trim().length > 0 &&
    typeof v.source_snapshot_id === 'string' &&
    v.source_snapshot_id.trim().length > 0 &&
    typeof v.source_version === 'string' &&
    v.source_version.trim().length > 0 &&
    typeof v.payload_digest === 'string' &&
    /^[0-9a-f]{64}$/.test(v.payload_digest) &&
    v.warning === 'NOT_EXECUTION_OR_FEASIBILITY_PROOF' &&
    typeof v.job_count === 'number' &&
    Number.isSafeInteger(v.job_count) &&
    v.job_count > 0 &&
    typeof v.technician_count === 'number' &&
    Number.isSafeInteger(v.technician_count) &&
    v.technician_count > 0 &&
    Number.isSafeInteger(v.inventory_item_types) &&
    (v.inventory_item_types ?? -1) >= 0 &&
    Number.isSafeInteger(v.donor_count) &&
    (v.donor_count ?? -1) >= 0 &&
    Number.isSafeInteger(v.horizon_slots) &&
    (v.horizon_slots ?? 0) > 0 &&
    Number.isSafeInteger(v.workshop_capacity) &&
    (v.workshop_capacity ?? 0) > 0
  )
}
/** Transport classification only; the backend validates every field/digest. */
function hasVersion(raw: string, version: string): boolean {
  try {
    const doc: unknown = JSON.parse(raw)
    return (
      !!doc &&
      typeof doc === 'object' &&
      !Array.isArray(doc) &&
      'format_version' in doc &&
      doc.format_version === version
    )
  } catch {
    return false
  }
}
const isNormalizedImport = (raw: string) => hasVersion(raw, 'readiness-recovery.normalized-import.v1')
const isNormalizedReplan = (raw: string) => hasVersion(raw, 'readiness-recovery.normalized-replan.v1')

const initialRequest = `{
  "execution_id": "rr-reference-001",
  "source": {},
  "ingested_at": "",
  "payload": {}
}`

async function checkedJson(response: Response): Promise<unknown> {
  const data: unknown = await response.json()
  if (!response.ok) {
    const message =
      data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
        ? data.error
        : data && typeof data === 'object' && 'detail' in data
          ? JSON.stringify(data.detail)
          : `RR request failed (${response.status})`
    throw new OperatorRequestError(classifyOperatorHttpStatus(response.status), message)
  }
  return data
}

/**
 * Independent reference-operator workflow. Never maps stochastic demo results
 * onto the exact Kernel job/technician/slot domain or persists credentials.
 */
export function RRProductionOperatorPanel({ locale = 'en' }: { locale?: Locale }) {
  const t = rrOperatorCopy[locale]
  const requestGuard = useRef(new OperatorRequestGuard())
  const activeController = useRef<AbortController | null>(null)
  const fileRevision = useRef(0)
  const inputRevision = useRef(0)
  const [view, setView] = useState<KernelView>(() => defaultKernelView())
  const [viewReady, setViewReady] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [requestBody, setRequestBody] = useState(initialRequest)
  const [replanBody, setReplanBody] = useState('')
  const [decisionId, setDecisionId] = useState('')
  const [executionId, setExecutionId] = useState('')
  const [lastResult, setLastResult] = useState<unknown>(null)
  const [presentation, setPresentation] = useState<KernelRRPresentation | null>(null)
  const [comparisonPredecessor, setComparisonPredecessor] = useState<KernelRRPresentation | null>(null)
  const [scheduleSearch, setScheduleSearch] = useState('')
  const [preflight, setPreflight] = useState<KernelPreflight | null>(null)
  const [validatedBody, setValidatedBody] = useState<string | null>(null)
  const [preflightStatus, setPreflightStatus] = useState('')
  const [operation, setOperation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [errorKind, setErrorKind] = useState<OperatorErrorKind | null>(null)
  const [busy, setBusy] = useState(false)
  // Hold the exact uncertain payload; a second click must not repeat a possibly committed write.
  const [uncertainWrite, setUncertainWrite] = useState<{ kind: 'create' | 'replan'; body: string } | null>(null)

  useEffect(() => {
    let active = true
    void Promise.resolve().then(() => {
      if (!active) return
      try {
        setView(readKernelView(window.localStorage))
      } catch {
        setView(defaultKernelView())
      }
      setViewReady(true)
    })
    return () => {
      active = false
    }
  }, [])
  useEffect(() => {
    if (!viewReady) return
    try {
      saveKernelView(window.localStorage, view)
    } catch {
      /* private browsing */
    }
  }, [view, viewReady])
  useEffect(() => {
    if (!viewReady || !session?.authenticated || view.startPanel === 'EXECUTE') return
    // Only the selected local presentation anchor may change scroll position.
    // Never affects Kernel requests, decision policy or authorization.
    document.getElementById('rr-panel-' + view.startPanel.toLowerCase())?.scrollIntoView({ block: 'start' })
  }, [viewReady, session?.authenticated, view.startPanel])

  useEffect(
    () => () => {
      requestGuard.current.invalidate()
      activeController.current?.abort()
      fileRevision.current += 1
    },
    []
  )

  function invalidateOutcome() {
    requestGuard.current.invalidate()
    activeController.current?.abort()
    setBusy(false)
    setLastResult(null)
    setPresentation(null)
    setComparisonPredecessor(null)
    setScheduleSearch('')
    setPreflight(null)
    setValidatedBody(null)
    setPreflightStatus('Input changed; waiting for Kernel validation')
    setOperation('')
    setErrorKind(null)
  }
  function startOperation() {
    activeController.current?.abort()
    const controller = new AbortController()
    activeController.current = controller
    return { epoch: requestGuard.current.begin(), signal: controller.signal }
  }
  function operationFailed(reason: unknown, epoch: number) {
    if (!requestGuard.current.current(epoch)) return
    setErrorKind(reason instanceof OperatorRequestError ? reason.kind : 'TRANSPORT_ERROR')
    if (reason instanceof OperatorRequestError && reason.kind === 'AUTH_REQUIRED') {
      setSession({ configured: true, authenticated: false, mode: 'zitadel-oidc' })
      setLastResult(null)
      setPresentation(null)
      setComparisonPredecessor(null)
      setDecisionId('')
      setExecutionId('')
      setError(t.sessionLost)
    } else if (!(reason instanceof DOMException && reason.name === 'AbortError')) {
      setLastResult(null)
      if (reason instanceof OperatorRequestError && reason.kind === 'ACCESS_DENIED') {
        // A role/tenant denial invalidates previously displayed private read models.
        setPresentation(null)
        setComparisonPredecessor(null)
        setPreflight(null)
        setValidatedBody(null)
      }
      setError(reason instanceof Error ? reason.message : 'RR operation failed')
    }
  }

  useEffect(() => {
    if (!session?.authenticated) return
    const controller = new AbortController()
    const currentBody = requestBody
    const currentRevision = inputRevision.current
    const timeout = setTimeout(() => {
      if (currentRevision !== inputRevision.current) return
      setPreflight(null)
      setValidatedBody(null)
      setPreflightStatus('Checking Kernel contract…')
      void fetch(
        isNormalizedImport(currentBody)
          ? '/api/rr-operator/kernel/source-import/preflight'
          : '/api/rr-operator/kernel/preflight',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: currentBody,
          cache: 'no-store',
          signal: controller.signal,
        }
      )
        .then(checkedJson)
        .then((value) => {
          if (controller.signal.aborted || currentRevision !== inputRevision.current) return
          if (!isKernelPreflight(value)) throw new Error('Unsupported Kernel preflight response')
          setPreflight(value)
          setValidatedBody(currentBody)
          setPreflightStatus('')
        })
        .catch((reason: unknown) => {
          if (controller.signal.aborted || currentRevision !== inputRevision.current) return
          setPreflight(null)
          setValidatedBody(null)
          setPreflightStatus(reason instanceof Error ? reason.message : 'Preflight rejected')
        })
    }, 250)
    return () => {
      clearTimeout(timeout)
      controller.abort()
    }
  }, [requestBody, session?.authenticated])

  useEffect(() => {
    let active = true
    fetch('/api/rr-operator/session', { cache: 'no-store' })
      .then((response) => checkedJson(response))
      .then((data) => {
        if (active) setSession(data as Session)
      })
      .catch(() => {
        if (active) setSession({ configured: false, authenticated: false, mode: 'unavailable' })
      })
    return () => {
      active = false
    }
  }, [])

  async function findDirectPredecessor(projection: KernelRRPresentation, epoch: number, signal: AbortSignal) {
    setComparisonPredecessor(null)
    if (!projection.predecessor_execution_id) return
    try {
      const result: unknown = await checkedJson(
        await fetch(
          `/api/rr-operator/kernel/executions/${encodeURIComponent(projection.predecessor_execution_id)}/presentation`,
          { cache: 'no-store', signal }
        )
      )
      if (requestGuard.current.current(epoch) && canCompareRRExecutions(result, projection)) {
        setComparisonPredecessor(result)
      }
    } catch {
      // Optional descriptive comparison must not invalidate the authoritative current execution.
    }
  }

  async function loadExistingPresentation() {
    if (!/^[A-Za-z0-9_.-]{1,128}$/.test(executionId)) return
    const { epoch, signal } = startOperation()
    setBusy(true)
    setError(null)
    setLastResult(null)
    setPresentation(null)
    setComparisonPredecessor(null)
    try {
      const result: unknown = await checkedJson(
        await fetch(`/api/rr-operator/kernel/executions/${encodeURIComponent(executionId)}/presentation`, {
          cache: 'no-store',
          signal,
        })
      )
      if (!requestGuard.current.current(epoch)) return
      if (!isKernelRRPresentation(result) || result.execution_id !== executionId) {
        throw new Error('Kernel returned an incompatible presentation schema')
      }
      setPresentation(result)
      setDecisionId(result.decision_id)
      setOperation('Inspect stored execution')
      await findDirectPredecessor(result, epoch, signal)
    } catch (reason) {
      operationFailed(reason, epoch)
    } finally {
      if (requestGuard.current.current(epoch)) setBusy(false)
    }
  }

  async function execute(label: string, url: string, method = 'GET', body?: string) {
    const { epoch, signal } = startOperation()
    setBusy(true)
    setError(null)
    setErrorKind(null)
    setLastResult(null)
    if (method !== 'GET') {
      setPresentation(null)
      setComparisonPredecessor(null)
    }
    try {
      const response = await fetch(url, {
        method,
        headers: method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
        body,
        cache: 'no-store',
        signal,
      })
      const data = await checkedJson(response)
      if (!requestGuard.current.current(epoch)) return
      if (method === 'POST' && label === 'Create execution') {
        const ids = parsedExecutionIds(data)
        const workflow =
          data &&
          typeof data === 'object' &&
          'result' in data &&
          data.result &&
          typeof data.result === 'object' &&
          'workflow' in data.result
            ? data.result.workflow
            : null
        const ingestion =
          workflow && typeof workflow === 'object' && 'ingestion' in workflow ? workflow.ingestion : null
        const digest =
          ingestion && typeof ingestion === 'object' && 'payload_digest' in ingestion ? ingestion.payload_digest : null
        if (
          !ids.executionId ||
          !ids.decisionId ||
          preflight?.execution_id !== ids.executionId ||
          preflight?.decision_id !== ids.decisionId ||
          digest !== preflight?.payload_digest
        )
          throw new Error(t.requestMismatch)
        setExecutionId(ids.executionId)
        setDecisionId(ids.decisionId)
      }
      if (method === 'POST' && label === 'Replan execution') {
        const ids = parsedExecutionIds(data)
        const successor: unknown = body ? (JSON.parse(body) as unknown) : null
        const target = isNormalizedReplan(body ?? '')
          ? successor &&
            typeof successor === 'object' &&
            'import_document' in successor &&
            successor.import_document &&
            typeof successor.import_document === 'object' &&
            'execution_id' in successor.import_document
            ? successor.import_document.execution_id
            : null
          : successor && typeof successor === 'object' && 'execution_id' in successor
            ? successor.execution_id
            : null
        if (!ids.executionId || !ids.decisionId || target !== ids.executionId) throw new Error(t.requestMismatch)
        setExecutionId(ids.executionId)
        setDecisionId(ids.decisionId)
      }
      if (method === 'POST') setUncertainWrite(null)
      setLastResult(data)
      setOperation(label)
      if (method === 'POST' && (label === 'Create execution' || label === 'Replan execution')) {
        const { executionId: id } = parsedExecutionIds(data)
        if (id) {
          try {
            const projection: unknown = await checkedJson(
              await fetch(`${prefix}/executions/${encodeURIComponent(id)}/presentation`, { cache: 'no-store', signal })
            )
            if (!requestGuard.current.current(epoch)) return
            if (
              !isKernelRRPresentation(projection) ||
              projection.execution_id !== id ||
              projection.decision_id !== parsedExecutionIds(data).decisionId ||
              (label === 'Create execution' &&
                (projection.payload_digest !== preflight?.payload_digest ||
                  projection.source_snapshot_id !== preflight?.source_snapshot_id))
            )
              throw new Error('Kernel returned an incompatible presentation schema')
            setPresentation(projection)
            await findDirectPredecessor(projection, epoch, signal)
          } catch (projectionError) {
            if (
              requestGuard.current.current(epoch) &&
              !(projectionError instanceof DOMException && projectionError.name === 'AbortError')
            ) {
              // A successful execution is NOT rolled back or retried because an optional read model is unavailable.
              setError('Execution created. Plugin evidence is unavailable; do not resubmit the same request.')
            }
          }
        }
      }
    } catch (reason) {
      // Lost acknowledgement is not an execution failure. Never retry the POST.
      const ambiguous =
        reason instanceof TypeError ||
        reason instanceof SyntaxError ||
        (reason instanceof OperatorRequestError && reason.kind === 'UNAVAILABLE')
      const attempted =
        ambiguous && method === 'POST'
          ? recoverableRRSubmission(label === 'Create execution' ? 'create' : 'replan', body, {
              preflight,
              predecessorExecutionId: executionId,
              decisionId,
            })
          : null
      if (
        attempted &&
        (label === 'Create execution' || label === 'Replan execution') &&
        requestGuard.current.current(epoch)
      ) {
        try {
          const recovered: unknown = await checkedJson(
            await fetch(`${prefix}/executions/${encodeURIComponent(attempted.executionId)}/presentation`, {
              cache: 'no-store',
              signal,
            })
          )
          if (!requestGuard.current.current(epoch)) return
          if (
            !isKernelRRPresentation(recovered) ||
            recovered.execution_id !== attempted.executionId ||
            (attempted.decisionId !== null && recovered.decision_id !== attempted.decisionId) ||
            recovered.predecessor_execution_id !== attempted.predecessorExecutionId ||
            (attempted.payloadDigest !== null && recovered.payload_digest !== attempted.payloadDigest) ||
            (attempted.sourceSnapshotId !== null && recovered.source_snapshot_id !== attempted.sourceSnapshotId)
          ) {
            throw new Error('Core evidence does not match the attempted execution')
          }
          setExecutionId(recovered.execution_id)
          setDecisionId(recovered.decision_id)
          setPresentation(recovered)
          setError(null)
          setErrorKind(null)
          setOperation(t.submissionRecovered)
          setUncertainWrite(null)
          await findDirectPredecessor(recovered, epoch, signal)
          return
        } catch (readError) {
          if (!requestGuard.current.current(epoch)) return
          if (
            readError instanceof OperatorRequestError &&
            (readError.kind === 'AUTH_REQUIRED' || readError.kind === 'ACCESS_DENIED')
          ) {
            operationFailed(readError, epoch)
            return
          }
          // Missing, transient, or mismatched evidence proves neither outcome.
        }
        setExecutionId(attempted.executionId)
        if (attempted.decisionId) setDecisionId(attempted.decisionId)
        setErrorKind('TRANSPORT_ERROR')
        setError(t.submissionUncertain)
        setUncertainWrite({ kind: label === 'Create execution' ? 'create' : 'replan', body: body ?? '' })
        setOperation('')
      } else {
        operationFailed(reason, epoch)
      }
    } finally {
      if (requestGuard.current.current(epoch)) setBusy(false)
    }
  }

  async function exportComplete() {
    const { epoch, signal } = startOperation()
    const id = decisionId
    setBusy(true)
    setError(null)
    setLastResult(null)
    try {
      const records: unknown[] = []
      let cursor: string | null = null
      let expectedHead: string | null = null
      let manifest: string | null = null
      let complete = false
      // Pagination here is purely transport assembly. Every page receives
      // a fresh full-chain attestation and is bounded by qdip-core.
      for (let index = 0; index < 1000; index++) {
        const params = new URLSearchParams()
        if (cursor) params.set('cursor', cursor)
        if (expectedHead) params.set('expected_head', expectedHead)
        const data: unknown = await checkedJson(
          await fetch(
            `${prefix}/decisions/${encodeURIComponent(id)}/history/verified-export-page?${params.toString()}`,
            { cache: 'no-store', signal }
          )
        )
        if (!requestGuard.current.current(epoch)) return
        if (
          !data ||
          typeof data !== 'object' ||
          !('schema_version' in data) ||
          data.schema_version !== 'readiness-recovery.presentation.v1' ||
          !('history_verified' in data) ||
          data.history_verified !== true ||
          !('decision_id' in data) ||
          data.decision_id !== id ||
          !('head_execution_id' in data) ||
          typeof data.head_execution_id !== 'string' ||
          !('history_manifest_digest' in data) ||
          typeof data.history_manifest_digest !== 'string' ||
          !/^[a-f0-9]{64}$/.test(data.history_manifest_digest) ||
          !('executions' in data) ||
          !Array.isArray(data.executions) ||
          !('export_complete' in data) ||
          typeof data.export_complete !== 'boolean' ||
          !('next_cursor' in data) ||
          !(typeof data.next_cursor === 'string' || data.next_cursor === null)
        ) {
          throw new Error('Kernel did not attest the complete RR export page')
        }
        if (expectedHead !== null && data.head_execution_id !== expectedHead)
          throw new Error('Kernel decision head changed during export')
        if (manifest !== null && data.history_manifest_digest !== manifest)
          throw new Error('Kernel history manifest changed during export')
        expectedHead = data.head_execution_id
        manifest = data.history_manifest_digest
        if (!data.executions.length) throw new Error('Kernel returned an empty verified export page')
        records.push(...data.executions)
        if (data.export_complete) {
          if (data.next_cursor !== null) throw new Error('Final RR export has a continuation cursor')
          complete = true
          break
        }
        if (!data.next_cursor || data.next_cursor === cursor) throw new Error('Kernel export cursor did not advance')
        cursor = data.next_cursor
      }
      if (!complete || !manifest || !expectedHead) throw new Error('RR export has not been completely verified')
      if (!requestGuard.current.current(epoch)) return
      const exportedDocument = {
        schema_version: 'readiness-recovery.presentation.v1',
        decision_id: id,
        head_execution_id: expectedHead,
        history_manifest_digest: manifest,
        executions: records,
        export_complete: true,
        history_verified: true,
      }
      const blob = new Blob([JSON.stringify(exportedDocument)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      try {
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = `rr-history-${id}.json`
        anchor.click()
      } finally {
        URL.revokeObjectURL(url)
      }
      setOperation('Complete history export')
      // Keep only the attestation manifest in the visible panel, not
      // potentially many megabytes of historical payloads.
      setLastResult({
        decision_id: id,
        head_execution_id: expectedHead,
        history_manifest_digest: manifest,
        export_complete: true,
        history_verified: true,
      })
    } catch (reason) {
      operationFailed(reason, epoch)
    } finally {
      if (requestGuard.current.current(epoch)) setBusy(false)
    }
  }

  function login() {
    const root = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://qdip.ai'
    const url = new URL('/api/auth/login', root)
    url.searchParams.set('return_to', window.location.href)
    window.location.assign(url.toString())
  }

  async function logout() {
    const { epoch, signal } = startOperation()
    fileRevision.current += 1
    setBusy(true)
    setLastResult(null)
    setError(null)
    try {
      await checkedJson(await fetch('/api/auth/logout', { method: 'POST', signal }))
      if (!requestGuard.current.current(epoch)) return
      setSession({ configured: true, authenticated: false, mode: 'zitadel-oidc' })
      setLastResult(null)
      setPresentation(null)
      setComparisonPredecessor(null)
      setScheduleSearch('')
      setExecutionId('')
      setDecisionId('')
      setRequestBody(initialRequest)
      setReplanBody('')
      setUncertainWrite(null)
    } catch (reason) {
      operationFailed(reason, epoch)
    } finally {
      if (requestGuard.current.current(epoch)) setBusy(false)
    }
  }

  if (!session)
    return (
      <p className="mx-auto max-w-5xl px-5 py-12 text-slate-400" role="status">
        {t.checking}
      </p>
    )
  if (!session.configured)
    return (
      <section
        data-testid="rr-kernel-unavailable"
        className="mx-auto max-w-5xl border border-white/15 bg-slate-900/50 p-6"
        role="status"
      >
        <h2 className="text-lg font-semibold">{t.unavailable}</h2>
        <p className="mt-3 text-sm text-slate-300">{t.unavailableHelp}</p>
      </section>
    )

  const validId = (id: string) => /^[A-Za-z0-9_.-]{1,128}$/.test(id)
  const prefix = '/api/rr-operator/kernel'

  return (
    <section
      className={`mt-8 border border-sky-400/30 bg-slate-900/70 ${view.density === 'COMPACT' ? 'p-3 md:p-4 text-sm' : 'p-5 md:p-6'}`}
      data-testid="rr-production-operator"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-sky-200">{t.title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{t.description}</p>
        </div>
        {session.authenticated && (
          <button type="button" onClick={() => void logout()} className="border border-slate-400 px-4 py-2 text-sm">
            {t.signout}
          </button>
        )}
      </div>

      {session.authenticated && presentation ? (
        <section aria-label={t.outcome} data-testid="rr-decision-first" className="mt-6">
          <h3 className="text-lg font-semibold text-white">{t.outcome}</h3>
          <div data-testid="rr-decision-review" className="mt-3 border-l-2 border-sky-400/60 pl-3">
            <h4 className="font-semibold">{t.reviewHeader}</h4>
            <p className="mt-1 text-sm text-slate-300">{t.reviewBody}</p>
            <p className="mt-2 text-xs text-amber-200">{t.evidenceGaps}</p>
          </div>
          <label className="mt-4 block text-sm" htmlFor="rr-schedule-filter">
            {t.scheduleFilter}
          </label>
          <input
            id="rr-schedule-filter"
            type="search"
            value={scheduleSearch}
            onChange={(event) => setScheduleSearch(event.target.value)}
            className="mt-2 w-full max-w-md border border-white/20 bg-slate-950 p-2 text-sm"
            autoComplete="off"
          />
          <OperatorEvidence
            locale={locale}
            record={presentation}
            visibleMetrics={view.metrics}
            scheduleSearch={scheduleSearch}
            detailed={view.details === 'DETAILED'}
          />
          <RRExecutionComparison locale={locale} previous={comparisonPredecessor} current={presentation} />
        </section>
      ) : null}
      {session.authenticated && (
        <p data-testid="rr-workflow-steps" className="mt-4 text-sm text-slate-300">
          {t.viewSteps}
        </p>
      )}
      {session.authenticated && (
        <div className="mt-5 border border-white/15 p-3" data-testid="rr-operator-preferences">
          <h3 className="font-semibold">{t.display}</h3>
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={t.templates}>
            <button
              type="button"
              onClick={() => setView(templateKernelView('BUSINESS'))}
              className="border border-white/20 px-3 py-2 text-sm text-slate-200"
            >
              {t.business}
            </button>
            <button
              type="button"
              onClick={() => setView(templateKernelView('OPERATIONS'))}
              className="border border-white/20 px-3 py-2 text-sm text-slate-200"
            >
              {t.operations}
            </button>
            <button
              type="button"
              onClick={() => setView(templateKernelView('ANALYST'))}
              className="border border-white/20 px-3 py-2 text-sm text-slate-200"
            >
              {t.analyst}
            </button>
          </div>
          <label className="mt-2 block text-sm">
            {t.density}
            <select
              aria-label={t.density}
              className="ml-3 border border-white/20 bg-slate-950 p-2"
              value={view.density}
              onChange={(event) => setView({ ...view, density: event.target.value as KernelView['density'] })}
            >
              <option value="COMFORTABLE">{t.comfortable}</option>
              <option value="COMPACT">{t.compact}</option>
            </select>
          </label>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-sm" htmlFor="rr-start-panel">
              {t.startView}
              <select
                id="rr-start-panel"
                className="mt-1 block w-full border border-white/20 bg-slate-950 p-2"
                value={view.startPanel}
                onChange={(event) => setView({ ...view, startPanel: event.target.value as KernelPanel })}
              >
                <option value="EXECUTE">{t.firstPanel}</option>
                <option value="REPLAN">{t.replanPanel}</option>
                <option value="EVIDENCE">{t.evidencePanel}</option>
              </select>
            </label>
            <label className="block text-sm" htmlFor="rr-evidence-detail">
              {t.detailLevel}
              <select
                id="rr-evidence-detail"
                className="mt-1 block w-full border border-white/20 bg-slate-950 p-2"
                value={view.details}
                onChange={(event) => setView({ ...view, details: event.target.value as KernelView['details'] })}
              >
                <option value="SUMMARY">{t.summaryView}</option>
                <option value="DETAILED">{t.detailedView}</option>
              </select>
            </label>
          </div>
          <fieldset className="mt-3 border border-white/15 p-3">
            <legend className="px-2 text-sm">{t.visibleMetrics}</legend>
            <div className="flex flex-wrap gap-4">
              {METRIC_KEYS.map((key) => (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={view.metrics.includes(key)}
                    disabled={view.metrics.length === 1 && view.metrics.includes(key)}
                    onChange={() => setView(toggleKernelMetric(view, key))}
                  />
                  {key === 'INPUT_JOBS'
                    ? t.inputJobs
                    : key === 'SCHEDULED_JOBS'
                      ? t.scheduledJobs
                      : key === 'TECHNICIANS'
                        ? t.technicians
                        : t.selectedDonors}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="mt-3 flex flex-wrap gap-3">
            {view.panels.map((key: KernelPanel) => (
              <div key={key} className="flex items-center gap-2 border border-white/15 px-2 py-1 text-sm">
                <span>{key === 'EXECUTE' ? t.create : key === 'REPLAN' ? t.replan : t.evidence}</span>
                <button
                  type="button"
                  aria-label={`${t.up}: ${key}`}
                  disabled={view.panels.indexOf(key) === 0}
                  onClick={() => setView(moveKernelPanel(view, key, -1))}
                  className="disabled:opacity-30"
                >
                  {t.up}
                </button>
                <button
                  type="button"
                  aria-label={`${t.down}: ${key}`}
                  disabled={view.panels.indexOf(key) === view.panels.length - 1}
                  onClick={() => setView(moveKernelPanel(view, key, 1))}
                  className="disabled:opacity-30"
                >
                  {t.down}
                </button>
              </div>
            ))}
            <button
              type="button"
              className="border border-white/15 px-3 py-1"
              onClick={() => setView(defaultKernelView())}
            >
              {t.reset}
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-400">{t.preferences}</p>
        </div>
      )}
      {!session.authenticated ? (
        <div className="mt-5 flex max-w-lg flex-col gap-3">
          <p className="text-sm text-slate-300">
            {locale === 'uk'
              ? 'Увійдіть через ваш обліковий запис Zitadel.'
              : locale === 'pl'
                ? 'Zaloguj się przez swoje konto Zitadel.'
                : 'Sign in with your authorized Zitadel account.'}
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => login()}
            className="bg-sky-400 px-4 py-2 font-semibold text-slate-950 disabled:opacity-50"
          >
            {locale === 'uk'
              ? 'Увійти через Zitadel'
              : locale === 'pl'
                ? 'Zaloguj przez Zitadel'
                : 'Sign in with Zitadel'}
          </button>
        </div>
      ) : (
        <div className={`mt-6 grid xl:grid-cols-2 ${view.density === 'COMPACT' ? 'gap-2' : 'gap-5'}`}>
          <div
            id="rr-panel-execute"
            className="min-w-0 space-y-3 scroll-mt-6"
            style={{ order: view.panels.indexOf('EXECUTE') }}
          >
            <h3 className="font-semibold">1. {t.create}</h3>
            <p className="text-xs text-slate-400">{t.createHelp}</p>
            <label className="block text-sm" htmlFor="rr-kernel-request-file">
              {t.import}
            </label>
            <input
              id="rr-kernel-request-file"
              type="file"
              accept=".json,application/json"
              className="block w-full text-xs"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (!file) return
                const revision = ++fileRevision.current
                invalidateOutcome()
                if (file.size > 2_150_000) {
                  setError('RR request exceeds the accepted size limit.')
                  return
                }
                void file
                  .text()
                  .then((value) => {
                    if (fileRevision.current !== revision) return
                    try {
                      // Preserve the original bytes so Core rejects duplicate
                      // properties; browser reserialization must not erase them.
                      JSON.parse(value)
                      inputRevision.current += 1
                      setRequestBody(value)
                      setError(null)
                    } catch (reason) {
                      setError(reason instanceof Error ? reason.message : 'Invalid RR JSON')
                    }
                  })
                  .catch(() => {
                    if (fileRevision.current === revision) setError('Could not read the RR request file')
                  })
              }}
            />
            <textarea
              aria-label="Kernel execution JSON"
              value={requestBody}
              onChange={(event) => {
                fileRevision.current += 1
                inputRevision.current += 1
                invalidateOutcome()
                setRequestBody(event.target.value)
              }}
              spellCheck={false}
              rows={10}
              className="w-full border border-white/20 bg-slate-950 p-3 font-mono text-xs"
            />
            <p
              role="status"
              className={`text-xs ${preflight ? 'text-sky-200' : 'text-amber-200'}`}
              data-testid="rr-kernel-preflight"
            >
              {preflight
                ? `Kernel preflight · execution: ${preflight.execution_id} · decision: ${preflight.decision_id} · snapshot: ${preflight.source_snapshot_id} · jobs: ${preflight.job_count} · technicians: ${preflight.technician_count}`
                : `Server preflight: ${preflightStatus || 'Not validated by qdip-core'}`}
              {preflight ? ' · No execution or feasibility proof.' : ''}
            </p>
            <button
              type="button"
              disabled={
                busy ||
                !preflight ||
                validatedBody !== requestBody ||
                (uncertainWrite?.kind === 'create' && uncertainWrite.body === requestBody)
              }
              onClick={() =>
                void execute(
                  'Create execution',
                  isNormalizedImport(requestBody) ? `${prefix}/source-import/executions` : `${prefix}/executions`,
                  'POST',
                  requestBody
                )
              }
              className="bg-sky-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
            >
              {t.createButton}
            </button>
          </div>

          <div
            id="rr-panel-replan"
            className="min-w-0 space-y-3 scroll-mt-6"
            style={{ order: view.panels.indexOf('REPLAN') }}
          >
            <h3 className="font-semibold">2. {t.replan}</h3>
            <p className="text-xs text-slate-400">{t.replanHelp}</p>
            <label className="block text-sm" htmlFor="rr-execution-id">
              {t.executionId}
            </label>
            <input
              id="rr-execution-id"
              value={executionId}
              onChange={(event) => {
                invalidateOutcome()
                setExecutionId(event.target.value)
              }}
              className="w-full border border-white/20 bg-slate-950 p-2 text-sm"
            />
            <textarea
              aria-label="Kernel replan JSON"
              value={replanBody}
              onChange={(event) => {
                invalidateOutcome()
                setReplanBody(event.target.value)
              }}
              spellCheck={false}
              placeholder="Paste ReadinessRecoveryReplanRequest or normalized-replan.v1 JSON"
              rows={7}
              className="w-full border border-white/20 bg-slate-950 p-3 font-mono text-xs"
            />
            <button
              type="button"
              disabled={
                busy ||
                !validId(executionId) ||
                !replanBody.trim() ||
                (uncertainWrite?.kind === 'replan' && uncertainWrite.body === replanBody)
              }
              onClick={() =>
                void execute(
                  'Replan execution',
                  isNormalizedReplan(replanBody)
                    ? `${prefix}/source-import/executions/${encodeURIComponent(executionId)}/replan`
                    : `${prefix}/executions/${encodeURIComponent(executionId)}/replan`,
                  'POST',
                  replanBody
                )
              }
              className="bg-white px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
            >
              {t.replanButton}
            </button>
          </div>

          <div
            id="rr-panel-evidence"
            className="min-w-0 space-y-3 scroll-mt-6 xl:col-span-2"
            style={{ order: view.panels.indexOf('EVIDENCE') }}
          >
            <h3 className="font-semibold">3. {t.evidence}</h3>
            <label className="block text-sm" htmlFor="rr-decision-id">
              {t.decisionId}
            </label>
            <input
              id="rr-decision-id"
              value={decisionId}
              onChange={(event) => {
                invalidateOutcome()
                setDecisionId(event.target.value)
              }}
              className="w-full border border-white/20 bg-slate-950 p-2 text-sm"
            />
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={busy || !validId(executionId)}
                onClick={() => void loadExistingPresentation()}
                className="border border-white/25 px-4 py-2 text-sm disabled:opacity-50"
              >
                {t.inspectExecution}
              </button>
              <button
                type="button"
                disabled={busy || !validId(decisionId)}
                onClick={() =>
                  void execute('Decision history', `${prefix}/decisions/${encodeURIComponent(decisionId)}/history`)
                }
                className="border border-white/25 px-4 py-2 text-sm disabled:opacity-50"
              >
                {t.history}
              </button>
              <button
                type="button"
                disabled={busy || !validId(decisionId)}
                onClick={() =>
                  void execute(
                    'History integrity',
                    `${prefix}/decisions/${encodeURIComponent(decisionId)}/history-integrity`
                  )
                }
                className="border border-white/25 px-4 py-2 text-sm disabled:opacity-50"
              >
                {t.integrity}
              </button>
              <button
                type="button"
                disabled={busy || !validId(decisionId)}
                onClick={() => void exportComplete()}
                className="border border-white/25 px-4 py-2 text-sm disabled:opacity-50"
              >
                {t.export}
              </button>
              <button
                type="button"
                disabled={busy || !validId(executionId)}
                onClick={() =>
                  void execute(
                    'Semantic replay',
                    `${prefix}/executions/${encodeURIComponent(executionId)}/replay-verification`
                  )
                }
                className="border border-white/25 px-4 py-2 text-sm disabled:opacity-50"
              >
                {t.replay}
              </button>
            </div>
          </div>
          {lastResult !== null && (
            <div className="xl:col-span-2" style={{ order: 3 }} aria-live="polite">
              <h3 className="font-semibold">{operation}</h3>
              <details
                key={view.details}
                open={view.details === 'DETAILED'}
                className="mt-3 border border-white/15 p-3"
                data-testid="rr-technical-response"
              >
                <summary className="cursor-pointer text-sm font-semibold text-slate-200">{t.technicalPayload}</summary>
                <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-all bg-slate-950 p-4 font-mono text-xs">
                  {JSON.stringify(lastResult, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </div>
      )}
      {session.authenticated && <RREconomicPreflightPanel locale={locale} />}
      {error && (
        <p role="alert" data-error-kind={errorKind ?? 'INVALID_INPUT'} className="mt-4 text-sm text-rose-300">
          {error}
        </p>
      )}
      <p className="mt-5 text-xs text-slate-400">{t.restricted}</p>
    </section>
  )
}
