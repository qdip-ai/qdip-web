'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { LoaderCircle, RefreshCw } from 'lucide-react'
import { Badge, Button } from '@/design-system'
import { buildLocalePath, type Locale } from '@/lib/observatory-i18n'
import { DIP_USE_CASES } from '@/use-cases/registry'

type Row = {
  name: string
  plugin_id?: string
  source?: 'embedded' | 'remote'
  description: string
  version: string
  enabled: boolean
  capabilities: string[]
  published: boolean | null
  published_version: string | null
  capability_id: string | null
  revision: number
  ui: { label?: string; category?: string }
}

type FormFields = { display_name: string; description: string; category: string; capability_id: string }
const categories = ['Operations', 'Optimization', 'Analytics', 'Decision support', 'Other']
const copy = {
  uk: {
    title: 'Керування плагінами',
    subtitle:
      'Плагіни автоматично реєструються через QDIP SDK. Тут можна заповнити опис і керувати публікацією в каталозі.',
    refresh: 'Оновити список',
    refreshing: 'Оновлення…',
    loading: 'Завантаження реєстру…',
    refreshed: 'Перевірено',
    changed: 'Список оновлено',
    unchanged: 'Змін немає',
    count: 'Плагінів',
    refreshError: 'Оновлення не вдалося. Перевірте підключення до QDIP Core та повторіть.',
    failed: 'Не вдалося оновити список',

    empty: 'Через QDIP SDK ще не зареєстровано плагінів.',
    formTitle: 'Публікація плагіна',
    registered: 'Публікація в каталозі',
    choose: 'Зареєстрований через SDK плагін',
    select: 'Виберіть плагін…',
    name: 'Назва',
    description: 'Опис',
    category: 'Категорія',
    capability: 'Можливість',
    version: 'Версія',
    publish: 'Зберегти й опублікувати',
    edit: 'Редагувати',
    cancel: 'Скасувати',
    close: 'Згорнути',
    editing: 'Редагування плагіна',
    saved: 'Зміни збережено. Плагін опубліковано.',
    hidden: 'Плагін приховано з каталогу.',
    verifying: 'Збережено. Перевіряю статус…',
    unverified: 'Збережено, але оновлений статус не підтверджено. Оновіть список.',
    published: 'Опубліковано',
    unpublished: 'Не опубліковано',
    disabled: 'Вимкнено в Core',
    offline: 'Remote Worker не підключений',
    demo: 'Готова демосторінка',
    generic: 'Стандартна сторінка каталогу',
    details: 'Переглянути сторінку',
    hide: 'Приховати з каталогу',
    busy: 'Збереження…',
    error: 'Не вдалося зберегти. Перевірте доступність Core та права адміністратора.',
    conflict: 'Запис змінився. Оновіть список і повторіть.',
    hint: 'Реєстрація відбувається автоматично через SDK незалежно від розташування Worker. Ця форма змінює лише дані каталогу та стан публікації.',
    demosTitle: 'Наявні спеціалізовані сторінки',
    demosHint: 'Ці демонстрації вже реалізовані у Web. Вони не є автоматично встановленими плагінами Core.',
  },
  en: {
    title: 'Manage plugins',
    subtitle: 'Plugins register automatically through the QDIP SDK. Edit catalog metadata and publication here.',
    refresh: 'Refresh list',
    refreshing: 'Refreshing…',
    loading: 'Loading registry…',
    refreshed: 'Checked',
    changed: 'List updated',
    unchanged: 'No changes',
    count: 'Plugins',
    refreshError: 'Unable to refresh. Check the QDIP Core connection and retry.',
    failed: 'Refresh failed',

    empty: 'No plugins have registered through the QDIP SDK yet.',
    formTitle: 'Publish plugin',
    registered: 'Catalog publication',
    choose: 'SDK-registered plugin',
    select: 'Select a plugin…',
    name: 'Display name',
    description: 'Description',
    category: 'Category',
    capability: 'Capability',
    version: 'Version',
    publish: 'Save and publish',
    edit: 'Edit',
    cancel: 'Cancel',
    close: 'Collapse',
    editing: 'Edit plugin',
    saved: 'Changes saved. Plugin published.',
    hidden: 'Plugin unpublished from catalog.',
    verifying: 'Saved. Checking status…',
    unverified: 'Saved, but the new status could not be verified. Refresh the list.',
    published: 'Published',
    unpublished: 'Unpublished',
    disabled: 'Disabled in Core',
    offline: 'Remote Worker is offline',
    demo: 'Existing demo workspace',
    generic: 'Standard catalog page',
    details: 'View page',
    hide: 'Unpublish from catalog',
    busy: 'Saving…',
    error: 'Unable to save. Check Core connectivity and administrative permissions.',
    conflict: 'The registry changed. Refresh and retry.',
    hint: 'The SDK registers the plugin regardless of worker location. This form only manages catalog metadata and publication.',
    demosTitle: 'Existing application workspaces',
    demosHint: 'These demos are implemented in Web and are not automatically installed Core plugins.',
  },
  pl: {
    title: 'Zarządzanie wtyczkami',
    subtitle: 'Wtyczki rejestrują się automatycznie przez QDIP SDK. Tutaj edytujesz opis i publikację w katalogu.',
    refresh: 'Odśwież listę',
    refreshing: 'Odświeżanie…',
    loading: 'Ładowanie rejestru…',
    refreshed: 'Sprawdzono',
    changed: 'Lista zaktualizowana',
    unchanged: 'Bez zmian',
    count: 'Wtyczki',
    refreshError: 'Odświeżanie nie powiodło się. Sprawdź połączenie z QDIP Core i spróbuj ponownie.',
    failed: 'Nie udało się odświeżyć listy',

    empty: 'Nie zarejestrowano jeszcze wtyczek przez QDIP SDK.',
    formTitle: 'Publikacja wtyczki',
    registered: 'Publikacja w katalogu',
    choose: 'Wtyczka zarejestrowana przez SDK',
    select: 'Wybierz wtyczkę…',
    name: 'Nazwa wyświetlana',
    description: 'Opis',
    category: 'Kategoria',
    capability: 'Funkcja',
    version: 'Wersja',
    publish: 'Zapisz i opublikuj',
    edit: 'Edytuj',
    cancel: 'Anuluj',
    close: 'Zwiń',
    editing: 'Edycja wtyczki',
    saved: 'Zmiany zapisano. Wtyczka opublikowana.',
    hidden: 'Wtyczka ukryta w katalogu.',
    verifying: 'Zapisano. Sprawdzanie stanu…',
    unverified: 'Zapisano, ale nie potwierdzono nowego stanu. Odśwież listę.',
    published: 'Opublikowano',
    unpublished: 'Nieopublikowano',
    disabled: 'Wyłączona w Core',
    offline: 'Zdalny Worker niedostępny',
    demo: 'Gotowa strona demo',
    generic: 'Standardowa strona katalogu',
    details: 'Zobacz stronę',
    hide: 'Ukryj w katalogu',
    busy: 'Zapisywanie…',
    error: 'Nie udało się zapisać. Sprawdź Core i uprawnienia administratora.',
    conflict: 'Stan rejestru się zmienił. Odśwież i spróbuj ponownie.',
    hint: 'SDK rejestruje wtyczkę niezależnie od lokalizacji Workera. Formularz zarządza tylko opisem i publikacją.',
    demosTitle: 'Istniejące strony demonstracyjne',
    demosHint: 'Te aplikacje istnieją w Web i nie są automatycznie zainstalowanymi wtyczkami Core.',
  },
} as const

function isPublished(row: Row) {
  return (
    row.enabled &&
    row.published === true &&
    row.published_version === row.version &&
    typeof row.capability_id === 'string' &&
    row.capabilities.includes(row.capability_id)
  )
}
function initialFields(row: Row): FormFields {
  return {
    display_name: row.ui?.label || row.name,
    description: row.description || '',
    category: row.ui?.category || 'Other',
    capability_id: row.capability_id || row.capabilities[0] || '',
  }
}

export function ObservatoryPluginAdmin({ locale }: { locale: Locale }) {
  const t = copy[locale]
  const [rows, setRows] = useState<Row[] | null>(null)
  const [selected, setSelected] = useState('')
  const [fields, setFields] = useState<FormFields>({
    display_name: '',
    description: '',
    category: 'Other',
    capability_id: '',
  })
  const [error, setError] = useState('')
  const [mutationError, setMutationError] = useState<{ name: string; message: string } | null>(null)
  const [mutationSuccess, setMutationSuccess] = useState<{ name: string; message: string } | null>(null)
  const editorInputRef = useRef<HTMLInputElement | null>(null)
  const editButtonRef = useRef<HTMLButtonElement | null>(null)
  const [pending, setPending] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshResult, setRefreshResult] = useState<{
    checkedAt: Date
    count: number
    changed: boolean | null
  } | null>(null)
  const [refreshFailed, setRefreshFailed] = useState(false)
  const requestRef = useRef<AbortController | null>(null)
  const rowsRef = useRef<Row[] | null>(null)
  const sorted = [...(rows ?? [])].sort((a, b) => a.name.localeCompare(b.name))

  const refresh = useCallback(async () => {
    // Cancel the previous request so older responses cannot overwrite newer data.
    requestRef.current?.abort()
    const controller = new AbortController()
    requestRef.current = controller
    setRefreshing(true)
    setRefreshFailed(false)
    setError('')
    try {
      const response = await fetch('/api/observatory/admin/plugins', {
        cache: 'no-store',
        credentials: 'same-origin',
        signal: controller.signal,
      })
      if (!response.ok) throw new Error(String(response.status))
      const data: unknown = await response.json()
      if (!data || typeof data !== 'object' || !('plugins' in data) || !Array.isArray(data.plugins))
        throw new Error('Invalid catalog response')
      if (controller.signal.aborted) return false
      const next = data.plugins as Row[]
      const fingerprint = (entries: Row[]) => JSON.stringify([...entries].sort((a, b) => a.name.localeCompare(b.name)))
      const previous = rowsRef.current
      const changed = previous === null ? null : fingerprint(previous) !== fingerprint(next)
      rowsRef.current = next
      setRows(next)
      setRefreshResult({ checkedAt: new Date(), count: next.length, changed })
      setRefreshFailed(false)
      return true
    } catch {
      if (!controller.signal.aborted) {
        setError(t.refreshError)
        setRefreshFailed(true)
      }
      return false
    } finally {
      if (!controller.signal.aborted) setRefreshing(false)
      if (requestRef.current === controller) requestRef.current = null
    }
  }, [t.refreshError])

  useEffect(() => {
    let active = true
    // Start the external request in a microtask, not a synchronous effect state update.
    void Promise.resolve().then(() => {
      if (active) void refresh()
    })
    return () => {
      active = false
      requestRef.current?.abort()
    }
  }, [refresh])

  useEffect(() => {
    if (selected) editorInputRef.current?.focus()
  }, [selected])

  function closeEditor() {
    setSelected('')
    setMutationError(null)
    editButtonRef.current?.focus()
  }

  function choose(row: Row) {
    if (selected === row.name) {
      closeEditor()
      return
    }
    setMutationError(null)
    setMutationSuccess(null)
    setFields(initialFields(row))
    setSelected(row.name)
  }

  async function update(row: Row, published: boolean, presentation?: FormFields) {
    setPending(true)
    setMutationError(null)
    setMutationSuccess(null)
    try {
      const response = await fetch('/api/observatory/admin/plugins/' + encodeURIComponent(row.name), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          published,
          expected_revision: row.revision,
          capability_id: presentation?.capability_id || row.capability_id || row.capabilities[0],
          ...(presentation
            ? {
                display_name: presentation.display_name,
                description: presentation.description,
                category: presentation.category,
              }
            : {}),
        }),
      })
      if (!response.ok) throw new Error(response.status === 409 ? t.conflict : t.error)
      // Close the editor immediately after the successful PUT; GET may take longer.
      setSelected('')
      setMutationSuccess({ name: row.name, message: t.verifying })
      const refreshed = await refresh()
      setMutationSuccess({
        name: row.name,
        message: refreshed ? (published ? t.saved : t.hidden) : t.unverified,
      })
    } catch (cause) {
      setMutationError({ name: row.name, message: cause instanceof Error ? cause.message : t.error })
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 text-slate-100 md:px-8 md:py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-cyan-300">QDIP / Observatory / Admin</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">{t.title}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">{t.subtitle}</p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <Button
            type="button"
            variant="secondary"
            disabled={pending || refreshing}
            aria-busy={refreshing}
            onClick={() => void refresh()}
          >
            {refreshing ? (
              <LoaderCircle className="mr-2 inline-block h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="mr-2 inline-block h-4 w-4" aria-hidden="true" />
            )}
            {refreshing ? t.refreshing : t.refresh}
          </Button>
          <div role="status" aria-live="polite" aria-atomic="true" className="text-sm text-slate-300">
            {refreshing
              ? t.loading
              : refreshFailed
                ? t.failed
                : refreshResult
                  ? `${refreshResult.changed === null ? t.refreshed : refreshResult.changed ? t.changed : t.unchanged} · ${t.count}: ${refreshResult.count} · ${t.refreshed}: ${refreshResult.checkedAt.toLocaleTimeString(
                      locale === 'uk' ? 'uk-UA' : locale === 'pl' ? 'pl-PL' : 'en-GB',
                      { hour: '2-digit', minute: '2-digit', second: '2-digit' }
                    )}`
                  : ''}
          </div>
        </div>
      </div>
      {error && (
        <p role="alert" className="mt-5 rounded-lg border border-rose-500/50 px-4 py-3 text-sm text-rose-300">
          {error}
        </p>
      )}
      {rows?.length === 0 && <p className="mt-6 text-sm text-slate-400">{t.empty}</p>}
      <section className="mt-8 grid gap-4" aria-label={t.registered}>
        {sorted.map((row) => {
          const published = isPublished(row)
          const demo = DIP_USE_CASES.find(
            (item) => item.plugin.id === row.name && row.capabilities.includes(item.plugin.capability)
          )
          return (
            <article key={row.name} className="min-w-0 rounded-xl border border-white/15 bg-slate-900 p-4 sm:p-6">
              <div className="flex min-w-0 flex-col items-start gap-3 sm:flex-row sm:justify-between">
                <div className="w-full min-w-0 flex-1">
                  <h3 className="break-words text-lg font-semibold">{row.ui?.label || row.name}</h3>
                  <p className="mt-1 break-all text-xs text-slate-500">{row.plugin_id || row.name}</p>
                  {row.description && (
                    <p className="mt-3 whitespace-pre-line break-words text-sm leading-6 text-slate-400">
                      {row.description}
                    </p>
                  )}
                </div>
                <Badge variant={published ? 'emerald' : 'neutral'}>
                  {published
                    ? t.published
                    : row.enabled
                      ? t.unpublished
                      : row.source === 'remote'
                        ? t.offline
                        : t.disabled}
                </Badge>
              </div>
              <p className="mt-4 break-words text-xs text-slate-400">
                {t.version}: {row.version} · {demo ? t.demo : t.generic}
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Button
                  ref={selected === row.name ? editButtonRef : undefined}
                  type="button"
                  variant="secondary"
                  disabled={pending}
                  aria-expanded={selected === row.name}
                  aria-controls={selected === row.name ? `plugin-editor-${encodeURIComponent(row.name)}` : undefined}
                  onClick={() => choose(row)}
                >
                  {selected === row.name ? t.close : t.edit}
                </Button>
                {published && (
                  <>
                    <a
                      className="text-sm font-semibold text-cyan-300"
                      href={buildLocalePath(`/plugins/${row.name}`, locale)}
                    >
                      {t.details} →
                    </a>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={pending}
                      onClick={() => void update(row, false)}
                    >
                      {t.hide}
                    </Button>
                  </>
                )}
              </div>
              {mutationSuccess?.name === row.name && (
                <p role="status" className="mt-4 text-sm text-emerald-300">
                  {mutationSuccess.message}
                </p>
              )}
              {mutationError?.name === row.name && (
                <p role="alert" className="mt-4 text-sm text-rose-300">
                  {mutationError.message}
                </p>
              )}
              {selected === row.name && (
                <section
                  id={`plugin-editor-${encodeURIComponent(row.name)}`}
                  className="mt-5 min-w-0 border-t border-white/15 pt-5"
                  aria-label={`${t.editing}: ${row.ui?.label || row.name}`}
                >
                  <h4 className="text-base font-semibold">
                    {t.editing}: {row.ui?.label || row.name}
                  </h4>
                  <form
                    className="mt-5 grid gap-4"
                    onSubmit={(event) => {
                      event.preventDefault()
                      if (row.enabled && fields.capability_id) void update(row, true, fields)
                    }}
                  >
                    <label className="grid min-w-0 gap-2 text-sm font-semibold">
                      {t.name}
                      <input
                        ref={editorInputRef}
                        className="min-h-11 w-full min-w-0 rounded-lg border border-white/20 bg-slate-950 px-3 py-2 text-slate-100"
                        value={fields.display_name}
                        required
                        minLength={2}
                        maxLength={120}
                        onChange={(event) => setFields((prev) => ({ ...prev, display_name: event.target.value }))}
                      />
                    </label>
                    <label className="grid min-w-0 gap-2 text-sm font-semibold">
                      {t.description}
                      <textarea
                        className="w-full min-w-0 rounded-lg border border-white/20 bg-slate-950 px-3 py-2 text-slate-100"
                        value={fields.description}
                        rows={4}
                        maxLength={2000}
                        onChange={(event) => setFields((prev) => ({ ...prev, description: event.target.value }))}
                      />
                    </label>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="grid min-w-0 gap-2 text-sm font-semibold">
                        {t.category}
                        <select
                          className="min-h-11 w-full min-w-0 rounded-lg border border-white/20 bg-slate-950 px-3 py-2 text-slate-100"
                          value={fields.category}
                          onChange={(event) => setFields((prev) => ({ ...prev, category: event.target.value }))}
                        >
                          {categories.map((category) => (
                            <option key={category}>{category}</option>
                          ))}
                        </select>
                      </label>
                      <label className="grid min-w-0 gap-2 text-sm font-semibold">
                        {t.capability}
                        <select
                          className="min-h-11 w-full min-w-0 rounded-lg border border-white/20 bg-slate-950 px-3 py-2 text-slate-100"
                          value={fields.capability_id}
                          onChange={(event) => setFields((prev) => ({ ...prev, capability_id: event.target.value }))}
                        >
                          {row.capabilities.map((capability) => (
                            <option key={capability}>{capability}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <Button
                        type="submit"
                        aria-busy={pending}
                        disabled={pending || !row.enabled || !fields.display_name.trim() || !fields.capability_id}
                      >
                        {pending && (
                          <LoaderCircle className="mr-2 inline-block h-4 w-4 animate-spin" aria-hidden="true" />
                        )}
                        {pending ? t.busy : t.publish}
                      </Button>
                      <Button type="button" variant="secondary" disabled={pending} onClick={closeEditor}>
                        {t.cancel}
                      </Button>
                    </div>
                  </form>
                </section>
              )}
            </article>
          )
        })}
      </section>
      <section className="mt-10">
        <h2 className="text-xl font-semibold">{t.demosTitle}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">{t.demosHint}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          {DIP_USE_CASES.map((useCase) => (
            <a
              key={useCase.id}
              href={buildLocalePath(useCase.route, locale)}
              className="max-w-full break-words rounded-lg border border-white/15 px-3 py-2 text-sm text-cyan-300"
            >
              {useCase.id}
            </a>
          ))}
        </div>
      </section>
    </main>
  )
}
