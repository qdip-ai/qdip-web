'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Locale } from '@/lib/observatory-i18n'
import styles from './observatory-plugin-submission-review.module.css'

type Submission = {
  plugin_name: string
  capability_id: string
  plugin_version: string
  expected_revision: number
  status: string
  catalog: {
    display_name: string
    description: string
    application_launch_url?: string | null
    launch_url_verified: boolean
  }
}
type Queue = { items: Submission[] }

async function fetchQueue(): Promise<Queue> {
  const response = await fetch('/api/observatory/admin/plugin-publication-submissions', {
    credentials: 'same-origin',
    cache: 'no-store',
  })
  if (!response.ok) throw Error('queue_http_failure')
  const data: Queue = await response.json()
  if (!Array.isArray(data.items)) throw Error('queue_schema_failure')
  return data
}

const t = {
  uk: {
    title: 'Заявки сторонніх розробників',
    note: 'Заявки не публікують Worker автоматично. Domain proof і security admission перевіряє Core.',
    load: 'Оновити заявки',
    empty: 'Немає заявок, які потребують перевірки.',
    reason: 'Причина рішення (обов’язково)',
    reject: 'Відхилити',
    suspend: 'Призупинити й заблокувати Worker',
    pending: 'Очікує перевірки',
    domain: 'Домен не підтверджено',
    verified: 'Домен підтверджено. Security review не завершено',
    failure: 'Не вдалося завантажити заявки.',
    conflict: 'Стан заявки змінився. Оновіть дані.',
    actionFailure: 'Core відхилив рішення. Перевірте актуальний стан.',
    busy: 'Застосовую рішення…',
  },
  en: {
    title: 'Third-party developer submissions',
    note: 'Submissions never publish Workers automatically. Core enforces domain and security admission.',
    load: 'Refresh submissions',
    empty: 'No submissions requiring review.',
    reason: 'Review reason (required)',
    reject: 'Reject',
    suspend: 'Suspend and quarantine Worker',
    pending: 'Pending verification',
    domain: 'Domain not verified',
    verified: 'Domain verified; security review not completed',
    failure: 'Could not load the review queue.',
    conflict: 'Submission changed; refresh before retrying.',
    actionFailure: 'Core rejected the decision. Check the current state.',
    busy: 'Applying decision…',
  },
}

export function ObservatoryPluginSubmissionReview({ locale }: { locale: Locale }) {
  const copy = locale === 'uk' ? t.uk : t.en
  const [items, setItems] = useState<Submission[]>([])
  const [reason, setReason] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await fetchQueue()
      setItems(data.items)
    } catch {
      setError(copy.failure)
    } finally {
      setLoading(false)
    }
  }, [copy.failure])

  useEffect(() => {
    let active = true
    void fetchQueue()
      .then((data) => {
        if (active) {
          setItems(data.items)
          setLoading(false)
        }
      })
      .catch(() => {
        if (active) {
          setError(copy.failure)
          setLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [copy.failure])

  const decide = async (item: Submission, action: 'reject' | 'suspend') => {
    const why = reason[item.plugin_name]?.trim()
    if (!why || why.length < 8 || why.length > 500) return
    setBusy(item.plugin_name)
    setError('')
    try {
      const response = await fetch(
        '/api/observatory/admin/plugin-publication-submissions/' + encodeURIComponent(item.plugin_name) + '/moderate',
        {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            expected_revision: item.expected_revision,
            action,
            reason: why,
          }),
        }
      )
      if (!response.ok) throw Error(response.status === 409 ? 'stale' : 'rejected')
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error && cause.message === 'stale' ? copy.conflict : copy.actionFailure)
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className={styles.panel} aria-label={copy.title}>
      <div className={styles.heading}>
        <div>
          <h2>{copy.title}</h2>
          <p>{copy.note}</p>
        </div>
        <button type="button" onClick={() => void refresh()} disabled={loading || busy !== null}>
          {copy.load}
        </button>
      </div>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {loading ? (
        <p role="status">{copy.pending}</p>
      ) : items.length === 0 ? (
        <p>{copy.empty}</p>
      ) : (
        <div className={styles.items}>
          {items.map((item) => {
            const disabled = busy !== null || (reason[item.plugin_name]?.trim().length ?? 0) < 8
            return (
              <article className={styles.item} key={item.plugin_name}>
                <h3>{item.catalog.display_name}</h3>
                <p className={styles.metadata}>
                  {item.plugin_name} · {item.plugin_version} · {item.capability_id}
                </p>
                <p>{item.status === 'PENDING_SECURITY_REVIEW' ? copy.verified : copy.domain}</p>
                {item.catalog.application_launch_url && (
                  <p className={styles.metadata}>{item.catalog.application_launch_url}</p>
                )}
                <label htmlFor={'review-reason-' + item.plugin_name}>{copy.reason}</label>
                <textarea
                  id={'review-reason-' + item.plugin_name}
                  value={reason[item.plugin_name] ?? ''}
                  maxLength={500}
                  onChange={(event) => setReason((r) => ({ ...r, [item.plugin_name]: event.target.value }))}
                />
                <div className={styles.actions}>
                  <button type="button" disabled={disabled} onClick={() => void decide(item, 'reject')}>
                    {copy.reject}
                  </button>
                  <button type="button" disabled={disabled} onClick={() => void decide(item, 'suspend')}>
                    {copy.suspend}
                  </button>
                  {busy === item.plugin_name && <span role="status">{copy.busy}</span>}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
