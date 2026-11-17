'use client'

import { useState } from 'react'
import type { CoreApplicationPublication } from '@/lib/observatory-application-catalog'

export function ApplicationPublicationControls({
  application,
  locale,
}: {
  application: CoreApplicationPublication
  locale: 'uk' | 'en' | 'pl'
}) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const canPublish = application.status !== 'published' && application.admission.ready
  const canUnpublish = application.status === 'published'
  const label =
    locale === 'uk'
      ? { publish: 'Опублікувати', unpublish: 'Зняти з публікації', busy: 'Збереження…' }
      : locale === 'pl'
        ? { publish: 'Opublikuj', unpublish: 'Cofnij publikację', busy: 'Zapisywanie…' }
        : { publish: 'Publish', unpublish: 'Unpublish', busy: 'Saving…' }

  async function change(action: 'publish' | 'unpublish') {
    if (pending) return
    setPending(true)
    setError('')
    try {
      const response = await fetch(
        `/api/observatory/admin/applications/${encodeURIComponent(application.application_id)}/${action}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ expected_revision: application.revision }),
          cache: 'no-store',
        }
      )
      if (!response.ok) {
        const result: { error?: string; reasons?: string[] } = await response.json()
        throw new Error([result.error, ...(result.reasons ?? [])].filter(Boolean).join(': '))
      }
      window.location.reload()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Publication operation failed')
    } finally {
      setPending(false)
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2" aria-busy={pending}>
      <button
        type="button"
        disabled={!canPublish || pending}
        className="rounded border border-current px-2 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-40"
        onClick={() => void change('publish')}
      >
        {pending ? label.busy : label.publish}
      </button>
      <button
        type="button"
        disabled={!canUnpublish || pending}
        className="rounded border border-current px-2 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-40"
        onClick={() => void change('unpublish')}
      >
        {label.unpublish}
      </button>
      {error && (
        <span role="alert" className="text-sm text-red-400">
          {error}
        </span>
      )}
    </span>
  )
}
