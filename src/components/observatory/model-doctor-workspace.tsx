'use client'

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { ArrowUpRight, FileUp, RefreshCcw, ShieldCheck } from 'lucide-react'

import type { Locale } from '@/lib/observatory-i18n'
import { MODEL_DOCTOR_BRIDGE, modelDoctorSignInHref } from '@/lib/model-doctor-url'

type Operation = 'validate' | 'solve' | 'diagnose' | 'propose_repair'
type SessionState = 'checking' | 'authenticated' | 'signed-out' | 'unavailable'
type Evidence = {
  contract_version?: string
  operation?: string
  execution_status?: string
  solver_status?: string | null
  model_wire_sha256?: string | null
  error_code?: string | null
  validation_error?: string | null
  objective_value?: number | null
  solution?: unknown
  diagnosis?: unknown
  repair?: unknown
}

const MAX_MODEL_BYTES = 256 * 1024
const MAX_REPLY_CHARS = 1024 * 1024
const OPERATIONS: Operation[] = ['validate', 'solve', 'diagnose', 'propose_repair']

const copy = {
  uk: {
    title: 'Аналіз моделі в Observatory',
    description: 'Файл передається безпосередньо захищеному Doctor Worker. Observatory не зберігає модель і не отримує токени Doctor.',
    checking: 'Перевірка сесії Doctor…',
    connected: 'Сесія Doctor активна',
    disconnected: 'Увійдіть у Doctor через Zitadel, потім перевірте сесію.',
    unavailable: 'З’єднання з Doctor недоступне або адаптер ще не розгорнуто.',
    login: 'Увійти в Doctor', refresh: 'Перевірити сесію',
    choose: 'Оберіть бінарний файл .cpmodel (до 256 КБ)',
    operation: 'Операція', limit: 'Ліміт розрахунку',
    submit: 'Виконати в Doctor', running: 'Виконується…',
    large: 'Файл має бути непорожнім і не перевищувати 256 КБ.',
    failed: 'Doctor відхилив запит або обчислення недоступне.',
    network: 'Не вдалося з’єднатися з Doctor. Перевірте сесію та доступність сервісу.',
    badReply: 'Неочікувана відповідь Doctor — результат не можна вважати перевіреним.',
    chooseFirst: 'Спочатку завантажте файл моделі.',
    result: 'Результат', execution: 'Виконання', solver: 'Статус CP-SAT',
    diagnosis: 'Діагностика', repair: 'Пропозиції виправлення', solution: 'Значення змінних',
    objective: 'Цільова функція', hash: 'SHA-256 оригінальної моделі',
    approval: 'Жодне виправлення не застосовується автоматично. Економічний ефект не визначений.',
    evidence: 'Технічна відповідь Doctor', noData: 'Немає додаткового висновку',
    operations: ['Перевірити', 'Розв’язати', 'Діагностувати', 'Запропонувати виправлення'],
  },
  en: {
    title: 'Inspect a model in Observatory',
    description: 'The file goes directly to the isolated Doctor Worker. Observatory does not store the model or receive Doctor tokens.',
    checking: 'Checking Doctor session…',
    connected: 'Doctor session is active',
    disconnected: 'Sign in to Doctor with Zitadel, then refresh the session.',
    unavailable: 'Doctor is unreachable or its adapter is not yet deployed.',
    login: 'Sign in to Doctor', refresh: 'Refresh session',
    choose: 'Choose a binary .cpmodel file (up to 256 KB)',
    operation: 'Operation', limit: 'Compute limit',
    submit: 'Run in Doctor', running: 'Running…',
    large: 'Model must be nonempty and no larger than 256 KB.',
    failed: 'Doctor rejected the request or execution is unavailable.',
    network: 'Doctor connection failed. Check the session and service availability.',
    badReply: 'Unexpected Doctor response; do not treat this as verified evidence.',
    chooseFirst: 'Select a model file first.',
    result: 'Result', execution: 'Execution', solver: 'CP-SAT status',
    diagnosis: 'Diagnosis', repair: 'Repair proposals', solution: 'Variable values',
    objective: 'Objective', hash: 'Original model SHA-256',
    approval: 'No repair is applied automatically. Business impact is unknown.',
    evidence: 'Doctor technical response', noData: 'No further evidence available',
    operations: ['Validate', 'Solve', 'Diagnose', 'Propose repair'],
  },
  pl: {
    title: 'Analiza modelu w Observatory',
    description: 'Plik trafia bezpośrednio do odizolowanego Doctor Worker. Observatory nie zapisuje modelu ani tokenów Doctor.',
    checking: 'Sprawdzanie sesji Doctor…',
    connected: 'Sesja Doctor jest aktywna',
    disconnected: 'Zaloguj się do Doctor przez Zitadel, a następnie odśwież sesję.',
    unavailable: 'Doctor jest niedostępny lub adapter nie został jeszcze wdrożony.',
    login: 'Zaloguj do Doctor', refresh: 'Sprawdź sesję',
    choose: 'Wybierz plik binarny .cpmodel (do 256 KB)',
    operation: 'Operacja', limit: 'Limit obliczeń',
    submit: 'Uruchom w Doctor', running: 'Trwa obliczanie…',
    large: 'Plik musi być niepusty i nie większy niż 256 KB.',
    failed: 'Doctor odrzucił żądanie lub obliczenia są niedostępne.',
    network: 'Nie można połączyć się z Doctor. Sprawdź sesję i dostępność usługi.',
    badReply: 'Nieoczekiwana odpowiedź Doctor — nie traktuj jej jako zweryfikowanego wyniku.',
    chooseFirst: 'Najpierw wybierz plik modelu.',
    result: 'Wynik', execution: 'Wykonanie', solver: 'Status CP-SAT',
    diagnosis: 'Diagnoza', repair: 'Propozycje zmian', solution: 'Wartości zmiennych',
    objective: 'Cel', hash: 'SHA-256 modelu źródłowego',
    approval: 'Żadna zmiana nie jest stosowana automatycznie. Wpływ biznesowy jest nieznany.',
    evidence: 'Techniczna odpowiedź Doctor', noData: 'Brak dodatkowych informacji',
    operations: ['Waliduj', 'Rozwiąż', 'Diagnozuj', 'Zaproponuj poprawkę'],
  },
} as const

function objectOf(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function safeLabel(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  return '—'
}

function base64(bytes: Uint8Array): string {
  let binary = ''
  for (let index = 0; index < bytes.length; index += 8192) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 8192))
  }
  return btoa(binary)
}

export function ModelDoctorWorkspace({ locale }: { locale: Locale }) {
  const t = copy[locale]
  const [session, setSession] = useState<SessionState>('checking')
  const [operation, setOperation] = useState<Operation>('diagnose')
  const [seconds, setSeconds] = useState<2 | 5>(2)
  const [model, setModel] = useState('')
  const [fileLabel, setFileLabel] = useState('')
  const [error, setError] = useState('')
  const [running, setRunning] = useState(false)
  const [report, setReport] = useState<Evidence | null>(null)
  const sessionRequest = useRef<AbortController | null>(null)
  const executionRequest = useRef<AbortController | null>(null)
  const revision = useRef(0)

  const refresh = useCallback(async () => {
    sessionRequest.current?.abort()
    const controller = new AbortController()
    sessionRequest.current = controller
    setSession('checking')
    try {
      const response = await fetch(MODEL_DOCTOR_BRIDGE.session, {
        method: 'GET', mode: 'cors', credentials: 'include', cache: 'no-store',
        redirect: 'error', signal: controller.signal,
      })
      if (!response.ok) throw new Error('session_unavailable')
      const info: unknown = await response.json()
      if (controller.signal.aborted) return
      const payload = objectOf(info)
      setSession(payload?.authenticated === true ? 'authenticated' : 'signed-out')
    } catch {
      if (!controller.signal.aborted) setSession('unavailable')
    }
  }, [])

  useEffect(() => {
    let mounted = true
    queueMicrotask(() => {
      if (mounted) void refresh()
    })
    return () => {
      mounted = false
      sessionRequest.current?.abort()
      executionRequest.current?.abort()
    }
  }, [refresh])

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    revision.current += 1
    const snapshot = revision.current
    executionRequest.current?.abort()
    setRunning(false)
    setError('')
    setReport(null)
    setModel('')
    setFileLabel('')
    const file = event.currentTarget.files?.[0]
    if (!file) return
    if (!file.size || file.size > MAX_MODEL_BYTES) {
      setError(t.large)
      event.currentTarget.value = ''
      return
    }
    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      if (snapshot !== revision.current) return
      setModel(base64(bytes))
      setFileLabel(file.name)
    } catch {
      if (snapshot === revision.current) setError(t.failed)
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (running || session !== 'authenticated') return
    if (!model) { setError(t.chooseFirst); return }
    executionRequest.current?.abort()
    const controller = new AbortController()
    executionRequest.current = controller
    const snapshot = revision.current
    setError('')
    setReport(null)
    setRunning(true)
    try {
      const response = await fetch(MODEL_DOCTOR_BRIDGE.execute, {
        method: 'POST', mode: 'cors', credentials: 'include', cache: 'no-store',
        redirect: 'error', signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model_base64: model, operation, time_limit_seconds: seconds }),
      })
      if (controller.signal.aborted || snapshot !== revision.current) return
      if (response.status === 401) {
        setSession('signed-out')
        setError(t.disconnected)
        return
      }
      if (!response.ok) {
        setError(`${t.failed} (HTTP ${response.status})`)
        return
      }
      const length = Number(response.headers.get('content-length'))
      if (length > MAX_REPLY_CHARS) throw new Error('response_too_large')
      const raw = await response.text()
      if (raw.length > MAX_REPLY_CHARS) throw new Error('response_too_large')
      const data: unknown = JSON.parse(raw)
      const valid = objectOf(data)
      if (controller.signal.aborted || snapshot !== revision.current) return
      if (
        !valid || valid.contract_version !== 'doctor.native-cpsat.v0.1' ||
        valid.operation !== operation || typeof valid.execution_status !== 'string'
      ) {
        setError(t.badReply)
        return
      }
      setReport(valid as Evidence)
    } catch {
      if (!controller.signal.aborted && snapshot === revision.current) setError(t.network)
    } finally {
      if (!controller.signal.aborted && snapshot === revision.current) setRunning(false)
    }
  }

  const diagnosis = objectOf(report?.diagnosis)
  const repair = objectOf(report?.repair)
  const proposals = Array.isArray(repair?.proposals) ? repair.proposals.slice(0, 3) : []
  const solution = Array.isArray(report?.solution) ? report.solution.slice(0, 24) : []
  const assumptionCore = Array.isArray(diagnosis?.assumption_core) ? diagnosis.assumption_core.slice(0, 24) : []

  return (
    <section className="mt-12" aria-labelledby="doctor-workspace-title">
      <h2 className="text-2xl font-medium" id="doctor-workspace-title">{t.title}</h2>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">{t.description}</p>
      <div className="mt-5 flex flex-wrap items-center gap-3" data-testid="doctor-session">
        <span className="rounded-lg border border-white/15 px-3 py-2 text-sm" role="status">
          {session === 'checking' ? t.checking : session === 'authenticated' ? t.connected :
            session === 'signed-out' ? t.disconnected : t.unavailable}
        </span>
        {session !== 'authenticated' && (
          <a
            href={modelDoctorSignInHref(locale)} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-cyan-300/40 px-4 py-2 text-sm text-cyan-200"
          >
            {t.login} <ArrowUpRight size={16} aria-hidden />
          </a>
        )}
        <button type="button" onClick={() => void refresh()}
          className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-4 py-2 text-sm"
        >
          <RefreshCcw size={16} aria-hidden /> {t.refresh}
        </button>
      </div>
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <form onSubmit={(event) => void submit(event)}
          className="rounded-xl border border-white/15 bg-white/5 p-5 md:p-7">
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-white/25 p-5 text-sm">
            <FileUp size={24} aria-hidden />
            <span className="min-w-0 break-words">{fileLabel || t.choose}</span>
            <input data-testid="doctor-file" type="file" accept=".cpmodel,.bin,application/octet-stream"
              className="sr-only" onChange={(event) => void chooseFile(event)} />
          </label>
          <label className="mt-6 block text-sm" htmlFor="doctor-operation">{t.operation}</label>
          <select id="doctor-operation" value={operation} onChange={(e) => {
            setOperation(e.target.value as Operation)
            setReport(null)
          }} className="mt-2 w-full rounded-lg border border-white/20 bg-slate-900 p-3 text-base">
            {OPERATIONS.map((value, index) => <option key={value} value={value}>{t.operations[index]}</option>)}
          </select>
          <label className="mt-5 block text-sm" htmlFor="doctor-seconds">{t.limit}</label>
          <select id="doctor-seconds" value={seconds}
            onChange={(event) => setSeconds(Number(event.target.value) as 2 | 5)}
            className="mt-2 w-full rounded-lg border border-white/20 bg-slate-900 p-3 text-base">
            <option value={2}>2 s</option><option value={5}>5 s</option>
          </select>
          <button type="submit" disabled={session !== 'authenticated' || !model || running}
            className="mt-6 w-full rounded-lg bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">
            {running ? t.running : t.submit}
          </button>
          {error && <p className="mt-4 text-sm text-rose-300" role="alert">{error}</p>}
        </form>
        <div className="min-w-0 rounded-xl border border-white/15 bg-white/5 p-5 md:p-7" data-testid="doctor-result">
          <div className="flex items-center gap-3">
            <ShieldCheck size={20} className="text-cyan-200" aria-hidden />
            <h3 className="text-lg font-medium">{t.result}</h3>
          </div>
          {report ? (
            <div className="mt-5 min-w-0 space-y-5 text-sm">
              <dl className="grid grid-cols-2 gap-4">
                <div><dt className="text-slate-400">{t.execution}</dt><dd>{safeLabel(report.execution_status)}</dd></div>
                <div><dt className="text-slate-400">{t.solver}</dt><dd>{safeLabel(report.solver_status)}</dd></div>
              </dl>
              {report.validation_error && <p className="break-words text-rose-300">{report.validation_error}</p>}
              {report.error_code && <p className="break-words text-rose-300">{report.error_code}</p>}
              {typeof report.objective_value === 'number' && (
                <p>{t.objective}: {report.objective_value}</p>
              )}
              <div>
                <h4 className="font-medium">{t.diagnosis}</h4>
                <p className="mt-2 break-words text-slate-300">{safeLabel(diagnosis?.kind)}</p>
                {assumptionCore.length > 0 && <ol className="mt-2 list-inside list-decimal space-y-1 text-slate-300">
                  {assumptionCore.map((item, index) => {
                    const record = objectOf(item)
                    return <li key={index} className="break-words">
                      {safeLabel(record?.name ?? record?.literal ?? record?.variable_index)}
                    </li>
                  })}
                </ol>}
              </div>
              {repair && (
                <div>
                  <h4 className="font-medium">{t.repair}</h4>
                  <p className="mt-2 break-words text-slate-300">{safeLabel(repair.kind)}</p>
                  {proposals.map((item, index) => {
                    const candidate = objectOf(item)
                    const assumption = objectOf(candidate?.assumption)
                    return <div key={index} className="mt-3 rounded-lg border border-white/10 p-3 text-slate-300">
                      <p>{index + 1}. {safeLabel(assumption?.name ?? assumption?.literal)}</p>
                      <p>{safeLabel(candidate?.candidate_solver_status)} · {safeLabel(candidate?.verified_by)}</p>
                      <p className="break-all text-xs">{safeLabel(candidate?.candidate_wire_sha256)}</p>
                    </div>
                  })}
                  {proposals.length > 0 && <p className="mt-3 text-xs text-slate-400">{t.approval}</p>}
                </div>
              )}
              {solution.length > 0 && <div>
                <h4 className="font-medium">{t.solution}</h4>
                <p className="mt-2 break-words font-mono text-xs">{JSON.stringify(solution)}</p>
              </div>}
              <div><p className="text-slate-400">{t.hash}</p>
                <p className="mt-1 break-all font-mono text-xs">{safeLabel(report.model_wire_sha256)}</p>
              </div>
              <details>
                <summary className="cursor-pointer text-cyan-200">{t.evidence}</summary>
                <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-all text-xs">
                  {JSON.stringify(report, null, 2)}
                </pre>
              </details>
            </div>
          ) : (
            <p className="mt-5 text-sm text-slate-400">{t.noData}</p>
          )}
        </div>
      </div>
    </section>
  )
}
