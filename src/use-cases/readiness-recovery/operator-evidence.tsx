import type { Locale } from '@/lib/observatory-i18n'
import { METRIC_KEYS, type KernelMetric } from './operator-presentation'

/**
 * This is a typed VIEW CONTRACT owned by qdip-core's RR plugin.
 * No Monte Carlo, Pareto, optimization, capability scores or outcome
 * classification is performed in qdip-web.
 */
export type KernelRRPresentation = {
  schema_version: 'readiness-recovery.presentation.v1'
  computation_authority: 'QDIP_KERNEL_RR_V1'
  execution_id: string
  decision_id: string
  source_system: string
  source_snapshot_id: string
  source_version: string
  payload_digest: string
  change_kind: string
  predecessor_execution_id: string | null
  outcome_kind: string
  backend_status: string
  authoritative: boolean
  actionable: boolean
  summary: string
  scheduled_jobs: { job_id: string; technician_id: string; start_slot: number; finish_slot: number }[]
  selected_donor_ids: string[]
  scheduled_job_count: number
  job_count: number
  technician_count: number
  probability_demand_satisfied: null
  probability_confidence_interval: null
  field_verified: false
}

/**
 * Exactly the Core runtime outcome/normalized-status relationship.
 * Presentation validation checks consistency; it never derives feasibility.
 */
const expectedOutcomes = {
  OPTIMAL_DECISION: ['OPTIMAL', true, true],
  INFEASIBLE: ['INFEASIBLE', true, false],
  UNBOUNDED: ['UNBOUNDED', true, false],
  PARTIAL_UNCERTIFIED: ['FEASIBLE', false, false],
  TIME_LIMIT: ['TIME_LIMIT', false, false],
  CANCELLED: ['CANCELLED', false, false],
  UNSUPPORTED: ['UNSUPPORTED', false, false],
  ERROR: ['ERROR', false, false],
} as const

const copy = {
  en: {
    metric: 'Kernel metric provenance',
    metricDetails: 'Inspect this metric',
    definition: 'Definition',
    coreField: 'Core projection field',
    measurement: 'Method',
    reported: 'Reported by Core',
    counted: 'Count of distinct IDs reported by Core',
    inputJobsMeaning: 'Jobs in the admitted input, not completed work',
    scheduledMeaning: 'Jobs returned in the Kernel schedule, not field completion',
    techniciansMeaning: 'Technicians in the input; actual shift availability is not asserted',
    donorsMeaning: 'Selected donor identifiers; not all available donors',
    missingStat: 'Algorithm, sample count, seed, timestamps, source revision and uncertainty methodology',

    total: 'Input jobs',
    scheduled: 'Scheduled jobs',
    technicians: 'Input technicians',
    selectedDonorCount: 'Selected donor IDs',
    src: 'Metric origin',
    unit: 'Units',
    model: 'Model-verified projection; not field-verified',
    uncertaintyNote: 'Probability and confidence intervals: not computed',
    edge: 'Economic benefit or optimizer superiority: not established',
    jobunits: 'Job counts; slot values are discrete model slots',
    title: 'Kernel evidence',
    status: 'Kernel status',
    execution: 'Execution',
    decision: 'Decision',
    source: 'Source snapshot',
    digest: 'Input digest',
    revision: 'Predecessor',
    authority: 'Kernel evidence',
    allowed: 'Kernel reports actionable',
    denied: 'Non-actionable',
    jobs: 'Scheduled jobs',
    donors: 'Donors',
    technician: 'Technician',
    slotRange: 'Scheduled slots',
    details: 'Show technical provenance',
    empty: 'No jobs scheduled',
    filterEmpty: 'No scheduled jobs match this display filter',
    statusGuidance: {
      OPTIMAL_DECISION: 'Kernel reports model optimality; real-world completion is not verified.',
      INFEASIBLE: 'No feasible schedule exists under the supplied model constraints.',
      UNBOUNDED: 'Unbounded model result; review constraints.',
      PARTIAL_UNCERTIFIED: 'Partial solution: no exact certificate. Do not treat it as approved.',
      TIME_LIMIT: 'Execution timed out. Infeasibility was not established.',
      CANCELLED: 'Execution was cancelled without an authoritative decision.',
      UNSUPPORTED: 'The backend does not support this exact model.',
      ERROR: 'Execution failed. No authoritative decision is available.',
    },
    unknown: 'Unknown / not recorded',
    warning: 'This view does not issue real-world work orders. Backend authority is not field acceptance.',
  },
  uk: {
    metric: 'Походження метрик Kernel',
    metricDetails: 'Перевірити метрику',
    definition: 'Визначення',
    coreField: 'Поле відповіді Core',
    measurement: 'Спосіб отримання',
    reported: 'Надано Core',
    counted: 'Кількість унікальних ідентифікаторів із Core',
    inputJobsMeaning: 'Роботи у вхідних даних, не факт виконання',
    scheduledMeaning: 'Роботи у плані Kernel, не факт виконання',
    techniciansMeaning: 'Спеціалісти у вхідних даних; доступність у зміні не підтверджена',
    donorsMeaning: 'Ідентифікатори вибраних донорів, не всіх доступних',
    missingStat: 'Алгоритм, вибірка, seed, часові мітки, ревізія джерела та метод невизначеності',

    total: 'Роботи у вхідних даних',
    scheduled: 'Заплановані роботи',
    technicians: 'Спеціалісти у вхідних даних',
    selectedDonorCount: 'Вибрані донори',
    src: 'Джерело метрик',
    unit: 'Одиниці',
    model: 'Перевірено в межах моделі, не в реальних умовах',
    uncertaintyNote: 'Ймовірність та довірчі інтервали: не обчислювалися',
    edge: 'Економічна вигода та перевага оптимізатора: не доведені',
    jobunits: 'Кількість робіт; час вимірюється дискретними слотами моделі',
    title: 'Докази Kernel',
    status: 'Статус Kernel',
    execution: 'Виконання',
    decision: 'Рішення',
    source: 'Snapshot джерела',
    digest: 'Хеш вхідних даних',
    revision: 'Попереднє виконання',
    authority: 'Докази Kernel',
    allowed: 'Kernel визначив рішення придатним до виконання',
    denied: 'Не дозволено до виконання',
    jobs: 'Заплановані роботи',
    donors: 'Донори',
    technician: 'Спеціаліст',
    slotRange: 'Часові слоти',
    details: 'Показати технічне походження даних',
    empty: 'Запланованих робіт немає',
    filterEmpty: 'У розкладі немає робіт за цим фільтром',
    statusGuidance: {
      OPTIMAL_DECISION: 'Kernel підтверджує оптимальність у моделі, не фактичне виконання робіт.',
      INFEASIBLE: 'У заданих обмеженнях моделі допустимого розкладу немає.',
      UNBOUNDED: 'Необмежена модель; перевірте обмеження.',
      PARTIAL_UNCERTIFIED: 'Частковий результат без точного сертифіката, не погоджений план.',
      TIME_LIMIT: 'Час виконання вичерпано. Недопустимість не доведена.',
      CANCELLED: 'Виконання скасовано без авторитетного рішення.',
      UNSUPPORTED: 'Backend не підтримує цей контракт моделі.',
      ERROR: 'Помилка виконання. Авторитетне рішення відсутнє.',
    },
    unknown: 'Невідомо / не записано',
    warning: 'Інтерфейс не видає реальних ремонтних наказів. Авторитет Kernel не означає польового приймання.',
  },
  pl: {
    metric: 'Pochodzenie metryk Kernel',
    metricDetails: 'Sprawdź metrykę',
    definition: 'Definicja',
    coreField: 'Pole projekcji Core',
    measurement: 'Metoda',
    reported: 'Zwrócone przez Core',
    counted: 'Liczba unikalnych identyfikatorów zwróconych przez Core',
    inputJobsMeaning: 'Zadania na wejściu, nie ukończone prace',
    scheduledMeaning: 'Zadania w harmonogramie Kernel, nie realizacja w terenie',
    techniciansMeaning: 'Technicy na wejściu; dostępność na zmianie niepotwierdzona',
    donorsMeaning: 'Wybrane identyfikatory dawców, nie wszyscy dostępni',
    missingStat: 'Algorytm, próby, seed, znaczniki czasu, rewizja źródła i metoda niepewności',

    total: 'Zadania wejściowe',
    scheduled: 'Zaplanowane zadania',
    technicians: 'Technicy w danych wejściowych',
    selectedDonorCount: 'Wybrani dawcy',
    src: 'Źródło metryk',
    unit: 'Jednostki',
    model: 'Wynik zweryfikowany w modelu, nie w terenie',
    uncertaintyNote: 'Prawdopodobieństwo i przedziały ufności: nie obliczono',
    edge: 'Korzyść ekonomiczna i przewaga optymalizatora: niepotwierdzone',
    jobunits: 'Liczba zadań; czas jest wyrażony w dyskretnych slotach modelu',
    title: 'Dowody Kernel',
    status: 'Status Kernel',
    execution: 'Wykonanie',
    decision: 'Decyzja',
    source: 'Migawka źródła',
    digest: 'Skrót danych wejściowych',
    revision: 'Poprzednik',
    authority: 'Dowody Kernel',
    allowed: 'Kernel zgłasza wykonalność',
    denied: 'Brak zgody na wykonanie',
    jobs: 'Zaplanowane zadania',
    donors: 'Dawcy',
    technician: 'Technik',
    slotRange: 'Sloty harmonogramu',
    details: 'Pokaż pochodzenie techniczne',
    empty: 'Brak zaplanowanych zadań',
    filterEmpty: 'Żadne zaplanowane zadania nie pasują do filtra',
    statusGuidance: {
      OPTIMAL_DECISION: 'Kernel potwierdza optymalność modelu, nie wykonanie prac w terenie.',
      INFEASIBLE: 'Brak dopuszczalnego harmonogramu przy zadanych ograniczeniach modelu.',
      UNBOUNDED: 'Wynik nieograniczony; sprawdź ograniczenia.',
      PARTIAL_UNCERTIFIED: 'Wynik częściowy bez dokładnego certyfikatu; nie jest zatwierdzonym planem.',
      TIME_LIMIT: 'Przekroczono czas. Niewykonalność nie została udowodniona.',
      CANCELLED: 'Wykonanie anulowano bez autorytatywnej decyzji.',
      UNSUPPORTED: 'Backend nie obsługuje tego kontraktu modelu.',
      ERROR: 'Błąd wykonania. Brak autorytatywnej decyzji.',
    },
    unknown: 'Brak danych',
    warning: 'Interfejs nie wydaje zleceń napraw. Wynik Kernel nie jest akceptacją terenową.',
  },
} as const

/** A defensive shape gate for a *server projection*, not RR decision logic. */
export function isKernelRRPresentation(value: unknown): value is KernelRRPresentation {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const v = value as Partial<KernelRRPresentation>
  const validId = (id: unknown) => typeof id === 'string' && /^[A-Za-z0-9_.-]{1,128}$/.test(id)
  const status = expectedOutcomes[v.outcome_kind as keyof typeof expectedOutcomes]
  return (
    Boolean(status) &&
    v.backend_status === status?.[0] &&
    v.authoritative === status?.[1] &&
    v.actionable === status?.[2] &&
    v.schema_version === 'readiness-recovery.presentation.v1' &&
    v.computation_authority === 'QDIP_KERNEL_RR_V1' &&
    validId(v.execution_id) &&
    validId(v.decision_id) &&
    typeof v.source_system === 'string' &&
    v.source_system.trim().length > 0 &&
    typeof v.source_snapshot_id === 'string' &&
    v.source_snapshot_id.trim().length > 0 &&
    typeof v.source_version === 'string' &&
    v.source_version.trim().length > 0 &&
    typeof v.payload_digest === 'string' &&
    /^[a-f0-9]{64}$/.test(v.payload_digest) &&
    typeof v.change_kind === 'string' &&
    typeof v.outcome_kind === 'string' &&
    typeof v.backend_status === 'string' &&
    typeof v.summary === 'string' &&
    (v.predecessor_execution_id === null || validId(v.predecessor_execution_id)) &&
    typeof v.authoritative === 'boolean' &&
    typeof v.actionable === 'boolean' &&
    (!v.actionable || v.authoritative) &&
    v.field_verified === false &&
    v.probability_demand_satisfied === null &&
    v.probability_confidence_interval === null &&
    typeof v.scheduled_job_count === 'number' &&
    Number.isSafeInteger(v.scheduled_job_count) &&
    v.scheduled_job_count >= 0 &&
    typeof v.job_count === 'number' &&
    Number.isSafeInteger(v.job_count) &&
    v.job_count > 0 &&
    v.scheduled_job_count <= v.job_count &&
    typeof v.technician_count === 'number' &&
    Number.isSafeInteger(v.technician_count) &&
    v.technician_count > 0 &&
    Array.isArray(v.selected_donor_ids) &&
    v.selected_donor_ids.every(validId) &&
    new Set(v.selected_donor_ids).size === v.selected_donor_ids.length &&
    Array.isArray(v.scheduled_jobs) &&
    v.scheduled_jobs.length === v.scheduled_job_count &&
    v.scheduled_jobs.every(
      (item) =>
        Boolean(item) &&
        typeof item === 'object' &&
        validId(item.job_id) &&
        validId(item.technician_id) &&
        Number.isSafeInteger(item.start_slot) &&
        Number.isSafeInteger(item.finish_slot) &&
        item.start_slot >= 0 &&
        item.finish_slot > item.start_slot
    ) &&
    new Set(v.scheduled_jobs.map((job) => job.job_id)).size === v.scheduled_jobs.length
  )
}

export function OperatorEvidence({
  locale,
  record,
  visibleMetrics = METRIC_KEYS,
  scheduleSearch = '',
  detailed = false,
}: {
  locale: Locale
  record: KernelRRPresentation | null
  visibleMetrics?: readonly KernelMetric[]
  scheduleSearch?: string
  detailed?: boolean
}) {
  const t = copy[locale]
  if (!record)
    return (
      <p role="status" className="mt-3 text-sm text-amber-200">
        {t.unknown}
      </p>
    )
  const normalizedFilter = scheduleSearch.trim().toLocaleLowerCase()
  const visibleJobs = record.scheduled_jobs.filter(
    (job) =>
      job.job_id.toLocaleLowerCase().includes(normalizedFilter) ||
      job.technician_id.toLocaleLowerCase().includes(normalizedFilter)
  )
  const metricCards: readonly [KernelMetric, string, number, string, string, string][] = [
    ['INPUT_JOBS', t.total, record.job_count, 'job_count', t.inputJobsMeaning, t.reported],
    ['SCHEDULED_JOBS', t.scheduled, record.scheduled_job_count, 'scheduled_job_count', t.scheduledMeaning, t.reported],
    ['TECHNICIANS', t.technicians, record.technician_count, 'technician_count', t.techniciansMeaning, t.reported],
    [
      'DONORS',
      t.selectedDonorCount,
      record.selected_donor_ids.length,
      'selected_donor_ids',
      t.donorsMeaning,
      t.counted,
    ],
  ]
  const cells = [
    [t.execution, record.execution_id],
    [t.decision, record.decision_id],
    [t.status, record.outcome_kind],
    [t.source, record.source_snapshot_id],
    [t.digest, record.payload_digest],
    [t.revision, record.predecessor_execution_id],
    [t.authority, record.authoritative ? record.backend_status : t.denied],
    [t.jobs, record.scheduled_job_count],
    [t.donors, record.selected_donor_ids.join(', ')],
  ]
  return (
    <section
      data-testid="rr-kernel-evidence"
      data-kernel-authoritative={String(record.authoritative)}
      data-actionable={String(record.actionable)}
      className="mt-3 border border-white/20 p-4"
    >
      <h4 className="font-semibold">{t.title}</h4>
      <p className="mt-2 text-sm">
        {record.actionable ? t.allowed : t.denied} · {record.summary}
      </p>
      <p role="status" data-testid="rr-outcome-guidance" className="mt-2 text-sm text-amber-200">
        {t.statusGuidance[record.outcome_kind as keyof typeof t.statusGuidance] ?? t.unknown}
      </p>
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span>
          {t.status}: <strong>{record.outcome_kind}</strong>
        </span>
        <span>
          {t.jobs}: <strong>{record.scheduled_job_count}</strong>
        </span>
      </div>
      <section className="mt-4 border border-sky-400/20 p-3" data-testid="rr-metric-provenance">
        <h5 className="font-semibold text-sky-200">{t.metric}</h5>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {metricCards
            .filter(([key]) => visibleMetrics.includes(key))
            .map(([key, label, value, field, definition, method]) => (
              <div key={key} className="min-w-0 border-l border-white/20 pl-3" data-testid={`rr-metric-${key}`}>
                <dl>
                  <dt className="text-xs text-slate-400">{label}</dt>
                  <dd className="mt-1 font-semibold tabular-nums">{value}</dd>
                </dl>
                <p className="mt-1 text-xs text-slate-400">
                  {t.definition}: {definition}
                </p>
                <details open={detailed} className="mt-2 text-xs text-slate-300">
                  <summary className="cursor-pointer text-sky-200">{t.metricDetails}</summary>
                  <dl className="mt-2 space-y-2">
                    <div>
                      <dt className="text-slate-400">{t.coreField}</dt>
                      <dd className="break-all font-mono">{field}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">{t.measurement}</dt>
                      <dd>{method}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">
                        {t.src} / {t.source}
                      </dt>
                      <dd className="break-all">
                        {record.source_system} / {record.source_version} / {record.source_snapshot_id}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">{t.digest}</dt>
                      <dd className="break-all font-mono">{record.payload_digest}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">{t.authority}</dt>
                      <dd>{record.computation_authority}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">{t.missingStat}</dt>
                      <dd>{t.unknown}</dd>
                    </div>
                  </dl>
                </details>
              </div>
            ))}
        </div>
        <dl className="mt-3 text-xs text-slate-300">
          <div>
            <dt className="inline font-semibold">{t.src}: </dt>
            <dd className="inline">
              {record.source_system} / {record.source_version} · {record.computation_authority}
            </dd>
          </div>
          <div>
            <dt className="inline font-semibold">{t.unit}: </dt>
            <dd className="inline">{t.jobunits}</dd>
          </div>
        </dl>
        <p className="mt-2 text-xs text-amber-200">{t.model}</p>
        <p className="mt-1 text-xs text-slate-300">{t.uncertaintyNote}</p>
        <p className="mt-1 text-xs text-slate-300">{t.edge}</p>
      </section>
      {record.scheduled_jobs.length ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm" data-testid="rr-kernel-schedule">
            <thead>
              <tr className="border-b border-white/20 text-slate-400">
                <th scope="col" className="py-2 pr-3">
                  {t.jobs}
                </th>
                <th scope="col" className="py-2 pr-3">
                  {t.technician}
                </th>
                <th scope="col" className="py-2">
                  {t.slotRange}
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleJobs.map((job) => (
                <tr key={job.job_id} className="border-b border-white/10">
                  <td className="py-2 pr-3 font-mono text-xs">{job.job_id}</td>
                  <td className="py-2 pr-3">{job.technician_id}</td>
                  <td className="py-2">
                    {job.start_slot}–{job.finish_slot}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {visibleJobs.length === 0 && (
            <p role="status" className="mt-2 text-xs text-amber-200">
              {t.filterEmpty}
            </p>
          )}
        </div>
      ) : (
        <p className="mt-4 text-sm text-amber-200">{t.empty}</p>
      )}
      <details open={detailed} className="mt-4 border-t border-white/15 pt-3">
        <summary className="cursor-pointer text-sm text-slate-300">{t.details}</summary>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {cells.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-slate-400">{label}</dt>
              <dd className="mt-1 break-all text-slate-100">{value ?? t.unknown}</dd>
            </div>
          ))}
        </dl>
      </details>
      <p className="mt-4 text-xs text-amber-200">{t.warning}</p>
    </section>
  )
}
