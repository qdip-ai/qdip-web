'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { LoaderCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/design-system'
import { buildLocalePath, type Locale } from '@/lib/observatory-i18n'
import styles from './plugin-experience.module.css'

type Row = {
  name: string
  plugin_id?: string
  slug?: string | null
  slug_aliases?: string[]
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

type FormFields = {
  display_name: string
  description: string
  category: string
  capability_id: string
  slug: string
}
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
    slug: 'Коротка адреса (URL)',
    slugHint: 'Латинські малі літери, цифри й дефіс. Внутрішній ID плагіна не зміниться.',
    slugPreview: 'Публічна адреса',
    description: 'Опис',
    category: 'Категорія',
    capability: 'Можливість SDK',
    technical: 'Технічні деталі',
    registryId: 'Ідентифікатор реєстрації',
    capabilityHint: 'Визначено розробником через SDK. Це не окрема назва плану.',
    noDescription: 'Опис поки не додано.',
    version: 'Версія',
    publish: 'Зберегти й опублікувати',
    saveChanges: 'Зберегти зміни',
    edit: 'Редагувати',
    cancel: 'Скасувати',
    collapse: 'Згорнути',
    editing: 'Редагування плагіна',
    saved: 'Зміни збережено. Плагін опубліковано.',
    savedChanges: 'Зміни збережено.',
    verifying: 'Збережено. Перевіряю статус публікації…',
    unverified: 'Збережено, але не вдалося підтвердити новий статус. Оновіть список.',
    hidden: 'Плагін приховано з каталогу.',
    offlinePublish: 'Публікація недоступна, поки Remote Worker не підключений.',
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
    slug: 'Short URL (slug)',
    slugHint: 'Lowercase letters, numbers and hyphens. The SDK plugin ID does not change.',
    slugPreview: 'Public URL',
    description: 'Description',
    category: 'Category',
    capability: 'SDK capability',
    technical: 'Technical details',
    registryId: 'Registry identifier',
    capabilityHint: 'Declared by the developer through the SDK. It is not a separate plan.',
    noDescription: 'No description yet.',
    version: 'Version',
    publish: 'Save and publish',
    saveChanges: 'Save changes',
    edit: 'Edit',
    cancel: 'Cancel',
    collapse: 'Collapse',
    editing: 'Edit plugin',
    saved: 'Changes saved. Plugin published.',
    savedChanges: 'Changes saved.',
    verifying: 'Saved. Checking publication status…',
    unverified: 'Saved, but the new status could not be verified. Refresh the list.',
    hidden: 'Plugin unpublished from catalog.',
    offlinePublish: 'Publication is unavailable while the Remote Worker is offline.',
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
    slug: 'Krótki adres URL',
    slugHint: 'Małe litery, cyfry i łączniki. Identyfikator wtyczki SDK nie zmienia się.',
    slugPreview: 'Adres publiczny',
    description: 'Opis',
    category: 'Kategoria',
    capability: 'Funkcja SDK',
    technical: 'Szczegóły techniczne',
    registryId: 'Identyfikator rejestracji',
    capabilityHint: 'Określona przez dewelopera przez SDK. To nie osobny plan.',
    noDescription: 'Brak opisu.',
    version: 'Wersja',
    publish: 'Zapisz i opublikuj',
    saveChanges: 'Zapisz zmiany',
    edit: 'Edytuj',
    cancel: 'Anuluj',
    collapse: 'Zwiń',
    editing: 'Edytowanie wtyczki',
    saved: 'Zmiany zapisano. Wtyczka opublikowana.',
    savedChanges: 'Zmiany zapisano.',
    verifying: 'Zapisano. Sprawdzanie stanu publikacji…',
    unverified: 'Zapisano, ale nie udało się potwierdzić nowego stanu. Odśwież listę.',
    hidden: 'Wtyczka ukryta w katalogu.',
    offlinePublish: 'Publikacja jest niedostępna, gdy zdalny Worker jest rozłączony.',
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
  // Publication is a catalog state; remote Worker liveness is a separate state.
  return (
    (row.enabled || row.source === 'remote') &&
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
    capability_id:
      (row.capability_id && row.capabilities.includes(row.capability_id) ? row.capability_id : row.capabilities[0]) ||
      '',
    slug: row.slug || (/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(row.plugin_id || '') ? row.plugin_id || '' : ''),
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
    slug: '',
  })
  const [error, setError] = useState('')
  const [mutationError, setMutationError] = useState<{ name: string; message: string } | null>(null)
  const [mutationSuccess, setMutationSuccess] = useState<{ name: string; message: string } | null>(null)
  const editorTitleRef = useRef<HTMLHeadingElement | null>(null)
  const editButtonRef = useRef<HTMLButtonElement | null>(null)
  const confirmationRef = useRef<HTMLParagraphElement | null>(null)
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

  // The editor lives in the card that was clicked, never in a form above the viewport.
  useEffect(() => {
    if (!selected) return
    const title = editorTitleRef.current
    title?.focus({ preventScroll: true })
    title?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
  }, [selected])

  useEffect(() => {
    // A successful action returns focus to the same card, not a distant header.
    confirmationRef.current?.focus({ preventScroll: true })
  }, [mutationSuccess])

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

  function closeEditor() {
    setSelected('')
    setMutationError(null)
    editButtonRef.current?.focus()
  }

  async function update(row: Row, published: boolean, presentation?: FormFields) {
    setPending(true)
    setMutationError(null)
    setMutationSuccess(null)
    try {
      const response = await fetch('/api/observatory/admin/plugins/' + encodeURIComponent(row.name), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          published,
          expected_revision: row.revision,
          capability_id: presentation?.capability_id || row.capability_id || row.capabilities[0],
          ...(presentation ? { slug: presentation.slug } : {}),
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
      // PUT has succeeded: close the editor immediately, independent of the
      // follow-up GET. Keep feedback in this very card while verifying status.
      if (presentation) setSelected('')
      setMutationSuccess({ name: row.name, message: t.verifying })
      const refreshed = await refresh()
      if (!refreshed) {
        setMutationSuccess(null)
        setMutationError({ name: row.name, message: t.unverified })
        return
      }
      setMutationSuccess({
        name: row.name,
        message: published ? (isPublished(row) ? t.savedChanges : t.saved) : t.hidden,
      })
    } catch (cause) {
      setMutationError({ name: row.name, message: cause instanceof Error ? cause.message : t.error })
    } finally {
      setPending(false)
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <header className={styles.toolbar}>
          <div className={styles.hero}>
            <p className={styles.eyebrow}>QDIP / Observatory / Admin</p>
            <h1 className={styles.title}>{t.title}</h1>
            <p className={styles.lead}>{t.subtitle}</p>
          </div>
          <div className={styles.toolbarActions}>
            <Button
              type="button"
              variant="secondary"
              className={styles.control}
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
            <div role="status" aria-live="polite" aria-atomic="true" className={styles.note}>
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
        </header>
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
        {rows?.length === 0 && <p className={styles.empty}>{t.empty}</p>}
        <section className={styles.adminList} aria-label={t.registered}>
          {sorted.map((row) => {
            const published = isPublished(row)
            const offline = !row.enabled
            return (
              <article key={row.name} className={`${styles.card} ${styles.adminCard}`}>
                <div className={styles.adminTop}>
                  <div className={styles.adminSummary}>
                    <h3 className={styles.cardTitle}>{row.ui?.label || row.name}</h3>
                    <p className={styles.description}>{row.description || t.noDescription}</p>
                    <p className={styles.note} style={{ marginTop: '0.75rem' }}>
                      {t.version}: {row.version}
                    </p>
                  </div>
                  <div className={styles.meta} style={{ marginTop: 0 }}>
                    <span className={styles.pill} data-kind={published ? 'published' : 'unpublished'}>
                      {published ? t.published : t.unpublished}
                    </span>
                    {offline && (
                      <span className={styles.pill} data-kind="offline">
                        {row.source === 'remote' ? t.offline : t.disabled}
                      </span>
                    )}
                  </div>
                </div>
                <div className={styles.actionRow}>
                  <Button
                    ref={selected === row.name ? editButtonRef : undefined}
                    type="button"
                    variant="secondary"
                    className={styles.control}
                    disabled={pending}
                    aria-expanded={selected === row.name}
                    aria-controls={`editor-${row.name}`}
                    onClick={() => choose(row)}
                  >
                    {selected === row.name ? t.collapse : t.edit}
                  </Button>
                  {published && (
                    <>
                      <a className={styles.link} href={buildLocalePath(`/plugins/${row.slug || row.name}`, locale)}>
                        {t.details} <span aria-hidden="true">→</span>
                      </a>
                      <Button
                        type="button"
                        variant="secondary"
                        className={styles.control}
                        disabled={pending}
                        onClick={() => void update(row, false)}
                      >
                        {t.hide}
                      </Button>
                    </>
                  )}
                </div>
                {mutationSuccess?.name === row.name && (
                  <p ref={confirmationRef} role="status" tabIndex={-1} className={styles.status}>
                    {mutationSuccess.message}
                  </p>
                )}
                {mutationError?.name === row.name && (
                  <p role="alert" className={styles.error}>
                    {mutationError.message}
                  </p>
                )}
                {selected === row.name && (
                  <section
                    id={`editor-${row.name}`}
                    className={styles.editor}
                    aria-labelledby={`editor-title-${row.name}`}
                  >
                    <h4
                      ref={editorTitleRef}
                      tabIndex={-1}
                      id={`editor-title-${row.name}`}
                      className={styles.formHeading}
                    >
                      {t.editing}: {row.ui?.label || row.plugin_id || row.name}
                    </h4>
                    <form
                      className={styles.form}
                      style={{ marginTop: '1.2rem' }}
                      onSubmit={(event) => {
                        event.preventDefault()
                        if (row.enabled && fields.capability_id) void update(row, true, fields)
                      }}
                    >
                      <label className={styles.field}>
                        {t.name}
                        <input
                          className={styles.input}
                          value={fields.display_name}
                          required
                          minLength={2}
                          maxLength={120}
                          onChange={(event) => setFields((prev) => ({ ...prev, display_name: event.target.value }))}
                        />
                      </label>
                      <label className={styles.field}>
                        {t.slug}
                        <input
                          aria-label={t.slug}
                          className={styles.input}
                          value={fields.slug}
                          type="text"
                          placeholder="secretary"
                          autoCapitalize="none"
                          autoComplete="off"
                          spellCheck={false}
                          required
                          minLength={2}
                          maxLength={64}
                          pattern="[a-z0-9][a-z0-9-]*[a-z0-9]"
                          onChange={(event) =>
                            setFields((prev) => ({ ...prev, slug: event.target.value.toLowerCase() }))
                          }
                        />
                        <span className={styles.fieldHint}>{t.slugHint}</span>
                        {fields.slug && (
                          <span className={styles.preview}>
                            {t.slugPreview}: /{locale}/plugins/{fields.slug}
                          </span>
                        )}
                      </label>
                      <label className={styles.field}>
                        {t.description}
                        <textarea
                          className={styles.input}
                          value={fields.description}
                          rows={4}
                          maxLength={2000}
                          onChange={(event) => setFields((prev) => ({ ...prev, description: event.target.value }))}
                        />
                      </label>
                      <div className={styles.fieldRow}>
                        <label className={styles.field}>
                          {t.category}
                          <select
                            className={styles.input}
                            value={fields.category}
                            onChange={(event) => setFields((prev) => ({ ...prev, category: event.target.value }))}
                          >
                            {(categories.includes(fields.category) ? categories : [fields.category, ...categories]).map(
                              (category) => (
                                <option key={category}>{category}</option>
                              )
                            )}
                          </select>
                        </label>
                        {row.capabilities.length > 1 && (
                          <label className={styles.field}>
                            {t.capability}
                            <select
                              className={styles.input}
                              value={fields.capability_id}
                              onChange={(event) =>
                                setFields((prev) => ({ ...prev, capability_id: event.target.value }))
                              }
                            >
                              {row.capabilities.map((capability) => (
                                <option key={capability}>{capability}</option>
                              ))}
                            </select>
                          </label>
                        )}
                      </div>
                      <details className={styles.technical}>
                        <summary>{t.technical}</summary>
                        <dl className={styles.definition} style={{ marginTop: '0.85rem' }}>
                          <div>
                            <dt>{t.registryId}</dt>
                            <dd>
                              <code>{row.plugin_id || row.name}</code>
                            </dd>
                          </div>
                          <div>
                            <dt>{t.capability}</dt>
                            <dd>
                              <code>{fields.capability_id || '—'}</code>
                            </dd>
                          </div>
                        </dl>
                        <p className={styles.fieldHint} style={{ marginTop: '0.75rem' }}>
                          {t.capabilityHint}
                        </p>
                      </details>
                      {!row.enabled && <p className={styles.notice}>{t.offlinePublish}</p>}
                      <div className={styles.actionRow} style={{ marginTop: '0.2rem' }}>
                        <Button
                          type="submit"
                          className={styles.control}
                          disabled={
                            pending ||
                            !row.enabled ||
                            !fields.display_name.trim() ||
                            !fields.capability_id ||
                            !/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(fields.slug) ||
                            fields.slug.includes('--') ||
                            ['admin', 'api', 'new', 'edit', 'plugins', 'settings'].includes(fields.slug)
                          }
                        >
                          {pending ? (
                            <>
                              <LoaderCircle className="mr-2 inline-block h-4 w-4 animate-spin" aria-hidden="true" />
                              {t.busy}
                            </>
                          ) : published ? (
                            t.saveChanges
                          ) : (
                            t.publish
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          className={styles.control}
                          disabled={pending}
                          onClick={closeEditor}
                        >
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
      </div>
    </main>
  )
}
