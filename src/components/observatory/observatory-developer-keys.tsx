'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type { Locale } from '@/lib/observatory-i18n'
import styles from './observatory-developer-keys.module.css'

type ConnectedKey = {
  id: string
  orgId: string
  role: 'execute' | 'worker'
  expiresAt: string
  capabilities: string[]
}
type Plugin = {
  id: string
  label: string
  capabilities: string[]
  registered: boolean
  enabled: boolean
  keys: ConnectedKey[]
}
type Inventory = { available: Plugin[]; connected: Plugin[] }
type Issued = {
  pluginId: string
  key: string
  keyId: string
  role: 'execute' | 'worker'
  expiresAt: string
  capabilities: string[]
}

const translations = {
  uk: {
    title: 'Ключі та підключення плагінів',
    description:
      'Виберіть будь-який зареєстрований плагін або підготуйте ключ для нового. Ключ обмежений обраними можливостями.',
    available: 'Доступні для підключення',
    connected: 'Ключі вже видано',
    emptyAvailable: 'Усі доступні плагіни мають активні ключі.',
    emptyConnected: 'Активних ключів поки немає.',
    loading: 'Завантаження каталогу…',
    error: 'Не вдалося завантажити каталог і ключі QDIP.',
    select: 'Плагін',
    capabilities: 'Дозволені можливості',
    role: 'Тип ключа',
    execute: 'Виклик плагіна',
    worker: 'Реєстрація Worker',
    custom: 'Плагін ще не зареєстрований',
    customId: 'ID плагіна',
    customCaps: 'Capability ID (через кому або з нового рядка)',
    customHint:
      'Для нового SDK Worker спершу видайте ключ реєстрації, потім зареєструйте Manifest через SDK. Ключ сам не встановлює плагін.',
    create: 'Згенерувати ключ',
    creating: 'Створення…',
    copy: 'Копіювати ключ',
    copied: 'Скопійовано',
    once: 'Новий ключ показується один раз. Збережіть його лише на сервері застосунку або Worker, ніколи в браузерному коді.',
    cancel: 'Закрити',
    revoke: 'Відкликати',
    revokeConfirm: 'Відкликати ключ? Застосунок може втратити доступ.',
    scope: 'Тип',
    expiry: 'Діє до',
    keyActive: 'Активний ключ',
    registered: 'Зареєстровано в Core',
    pending: 'Маніфест ще не зареєстровано',
    warning: 'Наявність ключа не підтверджує, що Worker запущений. Стан виконання перевіряється окремо.',
  },
  en: {
    title: 'Plugin connections and keys',
    description:
      'Choose any registered plugin, or bootstrap a new one. Each key is restricted to selected capabilities.',
    available: 'Available to connect',
    connected: 'Credentials issued',
    emptyAvailable: 'All available plugins already have active keys.',
    emptyConnected: 'No active credentials yet.',
    loading: 'Loading catalog…',
    error: 'Could not load QDIP catalog and keys.',
    select: 'Plugin',
    capabilities: 'Allowed capabilities',
    role: 'Key purpose',
    execute: 'Invoke plugin',
    worker: 'Register Worker',
    custom: 'Plugin not yet registered',
    customId: 'Plugin ID',
    customCaps: 'Capability IDs (comma or newline separated)',
    customHint:
      'For a new SDK Worker, create a registration key and register its Manifest with the SDK. A key alone does not install a plugin.',
    create: 'Generate key',
    creating: 'Creating…',
    copy: 'Copy key',
    copied: 'Copied',
    once: 'Key shown once. Store only in the server-side application or Worker, never browser code.',
    cancel: 'Close',
    revoke: 'Revoke',
    revokeConfirm: 'Revoke this credential? The application may lose access.',
    scope: 'Purpose',
    expiry: 'Expires',
    keyActive: 'Active credential',
    registered: 'Registered in Core',
    pending: 'Manifest not registered',
    warning: 'An issued key does not prove that the Worker is running; runtime status is separate.',
  },
  pl: {
    title: 'Połączenia i klucze wtyczek',
    description:
      'Wybierz dowolną zarejestrowaną wtyczkę lub przygotuj klucz dla nowej. Klucz ma ograniczone uprawnienia.',
    available: 'Dostępne do podłączenia',
    connected: 'Wydane klucze',
    emptyAvailable: 'Wszystkie dostępne wtyczki mają już aktywne klucze.',
    emptyConnected: 'Brak aktywnych kluczy.',
    loading: 'Ładowanie katalogu…',
    error: 'Nie udało się pobrać katalogu i kluczy QDIP.',
    select: 'Wtyczka',
    capabilities: 'Dozwolone możliwości',
    role: 'Rodzaj klucza',
    execute: 'Wywołanie wtyczki',
    worker: 'Rejestracja Workera',
    custom: 'Wtyczka nie jest jeszcze zarejestrowana',
    customId: 'ID wtyczki',
    customCaps: 'Capability ID (rozdzielone przecinkiem lub nową linią)',
    customHint:
      'Dla nowego SDK Workera najpierw utwórz klucz rejestracji, potem zarejestruj Manifest przez SDK. Klucz nie instaluje wtyczki.',
    create: 'Wygeneruj klucz',
    creating: 'Tworzenie…',
    copy: 'Kopiuj klucz',
    copied: 'Skopiowano',
    once: 'Klucz jest widoczny tylko raz. Przechowuj go wyłącznie w backendzie lub Workerze.',
    cancel: 'Zamknij',
    revoke: 'Unieważnij',
    revokeConfirm: 'Unieważnić klucz? Aplikacja może utracić dostęp.',
    scope: 'Rodzaj',
    expiry: 'Ważny do',
    keyActive: 'Aktywny klucz',
    registered: 'Zarejestrowano w Core',
    pending: 'Manifest nie jest zarejestrowany',
    warning: 'Wydanie klucza nie oznacza, że Worker działa. To osobny status.',
  },
} as const

// Presentation only: keep the exact capability ID in a separate secondary line.
function capabilityTitle(capability: string): string {
  return capability.replace(/[-_.]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/^\w/, (first) => first.toUpperCase())
}

const endpoint = '/api/observatory/admin/applications'

async function send<T>(method: 'GET' | 'POST' | 'DELETE', body?: object): Promise<T> {
  const response = await fetch(endpoint, {
    method,
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  let data: unknown
  try {
    data = await response.json()
  } catch {
    throw new Error(response.ok ? 'Invalid server response' : `Server responded HTTP ${response.status}`)
  }
  if (!response.ok) {
    const reason =
      data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
        ? data.error
        : 'Request failed'
    throw new Error(reason)
  }
  return data as T
}

export function ObservatoryDeveloperKeys({ locale }: { locale: Locale }) {
  const t = translations[locale]
  const [inventory, setInventory] = useState<Inventory | null>(null)
  const [selectedId, setSelectedId] = useState('')
  const [selectedCapabilities, setSelectedCapabilities] = useState<string[]>([])
  const [manual, setManual] = useState(false)
  const [manualId, setManualId] = useState('')
  const [manualCapabilities, setManualCapabilities] = useState('')
  const [role, setRole] = useState<'execute' | 'worker'>('execute')
  const [issued, setIssued] = useState<Issued | null>(null)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const result = await send<Inventory>('GET')
    setInventory(result)
    return result
  }, [])

  useEffect(() => {
    let active = true
    void send<Inventory>('GET')
      .then((result) => {
        if (!active) return
        setInventory(result)
        if (result.available.length) {
          setSelectedId(result.available[0].id)
          setSelectedCapabilities(result.available[0].capabilities)
        }
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : t.error)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [load, t.error])

  const selected = inventory?.available.find((p) => p.id === selectedId)
  const allowed = manual
    ? [
        ...new Set(
          manualCapabilities
            .split(/[,\n]/)
            .map((s) => s.trim())
            .filter(Boolean)
        ),
      ]
    : selectedCapabilities

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setIssued(null)
    setPending(true)
    try {
      const output = await send<Issued>('POST', {
        pluginId: manual ? manualId.trim() : selectedId,
        capabilities: allowed,
        role,
        manual,
      })
      if (!output.key || !output.keyId) throw new Error(t.error)
      setIssued(output)
      setCopied(false)
      const result = await load()
      const next = result.available[0]
      setSelectedId(next?.id ?? '')
      setSelectedCapabilities(next?.capabilities ?? [])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.error)
    } finally {
      setPending(false)
    }
  }

  async function revoke(key: ConnectedKey) {
    if (!window.confirm(t.revokeConfirm)) return
    setPending(true)
    setError('')
    try {
      await send('DELETE', { orgId: key.orgId, keyId: key.id })
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.error)
    } finally {
      setPending(false)
    }
  }

  async function copy() {
    if (!issued) return
    try {
      await navigator.clipboard.writeText(issued.key)
      setCopied(true)
    } catch {
      setError(t.error)
    }
  }

  return (
    <main className="mx-auto min-w-0 max-w-4xl px-4 py-8 text-slate-100 md:px-8 md:py-12">
      <p className="text-xs uppercase tracking-widest text-slate-400">QDIP / Observatory / SDK</p>
      <h1 className="mt-3 text-3xl font-semibold">{t.title}</h1>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">{t.description}</p>

      {loading ? <p className="mt-6 text-sm text-slate-400">{t.loading}</p> : null}
      {error ? (
        <p role="alert" className="mt-6 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      {inventory && (
        <>
          <section className="mt-8 min-w-0 rounded-xl border border-white/15 bg-slate-900 p-5 sm:p-7">
            <h2 className="text-lg font-semibold">{t.available}</h2>
            {!inventory.available.length && !manual && (
              <p className="mt-3 text-sm text-slate-400">{t.emptyAvailable}</p>
            )}
            <form className="mt-5 grid min-w-0 gap-4" onSubmit={(event) => void create(event)}>
              {!manual && !!inventory.available.length && (
                <>
                  <label className="grid min-w-0 gap-2 text-sm">
                    {t.select}
                    <select
                      value={selectedId}
                      onChange={(event) => {
                        const plugin = inventory.available.find((p) => p.id === event.target.value)
                        setSelectedId(event.target.value)
                        setSelectedCapabilities(plugin?.capabilities ?? [])
                      }}
                      className="min-h-11 rounded-lg border border-white/20 bg-slate-950 px-3"
                    >
                      {inventory.available.map((plugin) => (
                        <option key={plugin.id} value={plugin.id}>
                          {plugin.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <fieldset className="min-w-0">
                    <legend className="mb-2 text-sm">{t.capabilities}</legend>
                    <div className={styles.capabilityList}>
                      {selected?.capabilities.map((cap) => (
                        <label key={cap} className={styles.capabilityOption}>
                          <input
                            type="checkbox"
                            className={styles.capabilityInput}
                            checked={selectedCapabilities.includes(cap)}
                            onChange={(event) =>
                              setSelectedCapabilities((old) =>
                                event.target.checked ? [...old, cap] : old.filter((c) => c !== cap)
                              )
                            }
                          />
                          <span className={styles.capabilityText}>
                            <span className={styles.capabilityName}>{capabilityTitle(cap)}</span>
                            <span className={styles.capabilitySlug}>{cap}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </>
              )}
              <label className={`${styles.capabilityOption} ${styles.manualOption}`}>
                <input
                  type="checkbox"
                  className={styles.capabilityInput}
                  checked={manual}
                  onChange={(event) => setManual(event.target.checked)}
                />
                <span className={styles.capabilityText}>{t.custom}</span>
              </label>
              {manual && (
                <>
                  <p className="text-sm text-slate-400">{t.customHint}</p>
                  <label className="grid gap-2 text-sm">
                    {t.customId}
                    <input
                      value={manualId}
                      onChange={(event) => setManualId(event.target.value)}
                      autoComplete="off"
                      className="min-h-11 rounded-lg border border-white/20 bg-slate-950 px-3"
                    />
                  </label>
                  <label className="grid gap-2 text-sm">
                    {t.customCaps}
                    <textarea
                      value={manualCapabilities}
                      onChange={(event) => setManualCapabilities(event.target.value)}
                      rows={2}
                      className="rounded-lg border border-white/20 bg-slate-950 px-3 py-2"
                    />
                  </label>
                </>
              )}
              <label className="grid gap-2 text-sm">
                {t.role}
                <select
                  value={role}
                  onChange={(event) => setRole(event.target.value as 'execute' | 'worker')}
                  className="min-h-11 rounded-lg border border-white/20 bg-slate-950 px-3"
                >
                  <option value="execute">{t.execute}</option>
                  <option value="worker">{t.worker}</option>
                </select>
              </label>
              <button
                type="submit"
                disabled={pending || allowed.length === 0 || (!manual && !selected) || (manual && !manualId.trim())}
                className="min-h-11 justify-self-start rounded-lg bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-900 disabled:opacity-40"
              >
                {pending ? t.creating : t.create}
              </button>
            </form>
          </section>

          {issued && (
            <section className="mt-6 rounded-xl border border-white/25 bg-slate-900 p-5 sm:p-7">
              <h2 className="text-lg font-semibold">{issued.pluginId}</h2>
              <p className="mt-2 text-sm text-slate-300">{t.once}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <input
                  readOnly
                  type="password"
                  aria-label={t.keyActive}
                  value={issued.key}
                  className="min-h-11 min-w-0 flex-1 rounded-lg border border-white/20 bg-slate-950 px-3 font-mono"
                />
                <button
                  type="button"
                  onClick={() => void copy()}
                  className="min-h-11 rounded-lg border border-white/20 px-4 text-sm"
                >
                  {copied ? t.copied : t.copy}
                </button>
                <button
                  type="button"
                  onClick={() => setIssued(null)}
                  className="min-h-11 rounded-lg border border-white/20 px-4 text-sm"
                >
                  {t.cancel}
                </button>
              </div>
            </section>
          )}

          <section className="mt-8">
            <h2 className="text-lg font-semibold">{t.connected}</h2>
            <p className="mt-2 text-sm text-slate-400">{t.warning}</p>
            {!inventory.connected.length && <p className="mt-5 text-sm text-slate-400">{t.emptyConnected}</p>}
            <div className="mt-5 grid gap-3">
              {inventory.connected.map((plugin) => (
                <article key={plugin.id} className="rounded-xl border border-white/15 bg-slate-900 p-5">
                  <h3 className="text-base font-semibold">{plugin.label}</h3>
                  <p className="mt-1 text-xs text-slate-400">{plugin.registered ? t.registered : t.pending}</p>
                  {plugin.keys.map((key) => (
                    <div
                      key={key.id}
                      className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4"
                    >
                      <div className="min-w-0 text-sm">
                        <p>
                          {t.keyActive} · {key.role === 'worker' ? t.worker : t.execute}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          {t.expiry}: {new Date(key.expiresAt).toLocaleDateString(locale)}
                        </p>
                        <p className="mt-1 break-all text-xs text-slate-500">{key.capabilities.join(', ')}</p>
                      </div>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => void revoke(key)}
                        className="min-h-10 rounded-lg border border-red-400/35 px-4 text-sm text-red-200 disabled:opacity-50"
                      >
                        {t.revoke}
                      </button>
                    </div>
                  ))}
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  )
}
