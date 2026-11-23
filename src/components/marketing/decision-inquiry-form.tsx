'use client'
import { FormEvent, useRef, useState } from 'react'
import type { MarketingLocale } from './qdip-copy'
import styles from './qdip-site.module.css'
import spacing from './decision-inquiry-spacing.module.css'

const text = {
  en: {
    fields: [
      'Name',
      'Organization',
      'Email',
      'What decision does your team make repeatedly?',
      'What information is used?',
      'What alternatives are usually considered?',
      'What constraints matter?',
      'Additional context',
    ],
    submit: 'Describe your decision',
    submitting: 'Sending…',
    success: 'Thank you. Your decision has been submitted.',
    successDetail: 'We’ll review whether it is a good fit for QDIP.',
    another: 'Submit another decision',
    error: 'We couldn’t send your request. Please try again.',
    invalid: 'Please check the highlighted fields.',
    rate: 'Too many attempts. Please try again later.',
    field: {
      name: 'Enter at least 2 characters.',
      organization: 'Enter at least 2 characters.',
      email: 'Enter a valid email address.',
      decision: 'Describe the recurring decision in at least 10 characters.',
    },
  },
  uk: {
    fields: [
      'Ім’я',
      'Організація',
      'Email',
      'Яке рішення ваша команда приймає регулярно?',
      'Яку інформацію ви використовуєте?',
      'Які альтернативи зазвичай розглядаєте?',
      'Які обмеження мають значення?',
      'Додатковий контекст',
    ],
    submit: 'Опишіть ваше рішення',
    submitting: 'Надсилання…',
    success: 'Дякуємо. Ваше рішення надіслано.',
    successDetail: 'Ми перевіримо, чи підходить воно для QDIP.',
    another: 'Надіслати ще одне рішення',
    error: 'Не вдалося надіслати запит. Спробуйте ще раз.',
    invalid: 'Перевірте виділені поля.',
    rate: 'Забагато спроб. Спробуйте пізніше.',
    field: {
      name: 'Введіть щонайменше 2 символи.',
      organization: 'Введіть щонайменше 2 символи.',
      email: 'Введіть коректну email-адресу.',
      decision: 'Опишіть регулярне рішення щонайменше 10 символами.',
    },
  },
  pl: {
    fields: [
      'Imię i nazwisko',
      'Organizacja',
      'Email',
      'Jaką decyzję Twój zespół podejmuje regularnie?',
      'Jakich informacji używacie?',
      'Jakie alternatywy zwykle rozważacie?',
      'Jakie ograniczenia mają znaczenie?',
      'Dodatkowy kontekst',
    ],
    submit: 'Opisz swoją decyzję',
    submitting: 'Wysyłanie…',
    success: 'Dziękujemy. Twoja decyzja została przesłana.',
    successDetail: 'Sprawdzimy, czy jest odpowiednim przypadkiem dla QDIP.',
    another: 'Wyślij kolejną decyzję',
    error: 'Nie udało się wysłać zgłoszenia. Spróbuj ponownie.',
    invalid: 'Sprawdź zaznaczone pola.',
    rate: 'Zbyt wiele prób. Spróbuj ponownie później.',
    field: {
      name: 'Wpisz co najmniej 2 znaki.',
      organization: 'Wpisz co najmniej 2 znaki.',
      email: 'Wpisz prawidłowy adres email.',
      decision: 'Opisz powtarzającą się decyzję w co najmniej 10 znakach.',
    },
  },
} as const

const serviceOpsForm = {
  en: {
    fields: ['Name', 'Organization', 'Email', 'Which service process would you like to pilot?',
      'What kinds of jobs and information do you manage?', 'How are work and workers assigned today?',
      'Which constraints, qualifications or deadlines matter?', 'Team size and any additional context'],
    submit: 'Request a ServiceOps pilot',
    success: 'Your ServiceOps pilot request has been sent.',
    successDetail: 'We will review the described workflow and contact you about fit and next steps.',
    another: 'Submit another pilot request',
    decisionValidation: 'Describe a service process in at least 10 characters.',
  },
  uk: {
    fields: ['Ім’я', 'Організація', 'Email', 'Який сервісний процес ви хочете перевірити в пілоті?',
      'Які замовлення й дані ви обробляєте?', 'Як зараз розподіляєте роботу між виконавцями?',
      'Які терміни, кваліфікації або обмеження важливі?', 'Розмір команди та додатковий контекст'],
    submit: 'Запросити пілот ServiceOps',
    success: 'Запит на пілот ServiceOps надіслано.',
    successDetail: 'Ми розглянемо описаний процес і зв’яжемося з вами щодо наступних кроків.',
    another: 'Надіслати інший запит',
    decisionValidation: 'Опишіть сервісний процес щонайменше 10 символами.',
  },
  pl: {
    fields: ['Imię i nazwisko', 'Organizacja', 'Email', 'Jaki proces usługowy chcesz sprawdzić w pilotażu?',
      'Jakimi zleceniami i informacjami zarządzacie?', 'Jak dzisiaj przydzielacie pracę zespołowi?',
      'Jakie terminy, kwalifikacje lub ograniczenia są ważne?', 'Wielkość zespołu i dodatkowy kontekst'],
    submit: 'Zapytaj o pilotaż ServiceOps',
    success: 'Wysłano zapytanie o pilotaż ServiceOps.',
    successDetail: 'Sprawdzimy opisany proces i skontaktujemy się w sprawie następnych kroków.',
    another: 'Wyślij kolejne zapytanie',
    decisionValidation: 'Opisz proces usługowy, używając co najmniej 10 znaków.',
  },
} as const

type FieldName =
  'name' | 'organization' | 'email' | 'decision' | 'information' | 'alternatives' | 'constraints' | 'context'
type AnalyticsEvent = 'decision_form_started' | 'decision_form_submit' | 'decision_form_success' | 'decision_form_error'
function track(event: AnalyticsEvent, locale: MarketingLocale, placement: 'decision' | 'serviceops') {
  if (typeof window === 'undefined') return
  const w = window as Window & { dataLayer?: Array<Record<string, string>> }
  w.dataLayer?.push({ event, locale, placement })
}

export function DecisionInquiryForm({ locale, variant = 'decision' }: {
  locale: MarketingLocale
  variant?: 'decision' | 'serviceops'
}) {
  const base = text[locale],
    service = serviceOpsForm[locale],
    c = variant === 'serviceops'
      ? { ...base, ...service, field: { ...base.field, decision: service.decisionValidation } }
      : base,
    started = useRef(false),
    [state, setState] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle'),
    [message, setMessage] = useState(''),
    [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({})
  function onFocus() {
    if (!started.current) {
      started.current = true
      track('decision_form_started', locale, variant)
    }
  }
  function submitAnother() {
    started.current = false
    setErrors({})
    setMessage('')
    setState('idle')
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (state === 'submitting') return
    const form = event.currentTarget
    setErrors({})
    setMessage('')
    setState('submitting')
    track('decision_form_submit', locale, variant)
    const fd = new FormData(form)
    const payload = {
      name: fd.get('name'),
      organization: fd.get('organization'),
      email: fd.get('email'),
      decision: fd.get('decision'),
      information: fd.get('information'),
      alternatives: fd.get('alternatives'),
      constraints: fd.get('constraints'),
      context: variant === 'serviceops'
        ? ['ServiceOps pilot inquiry', String(fd.get('context') ?? '')].join('\n').slice(0, 4000)
        : fd.get('context'),
      website: fd.get('website'),
      locale,
    }
    try {
      const response = await fetch('/api/decision-inquiry', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        if (body.error === 'validation_failed') {
          const fieldErrors: Partial<Record<FieldName, string>> = {}
          for (const name of ['name', 'organization', 'email', 'decision'] as const)
            if (body.fields?.[name]) fieldErrors[name] = c.field[name]
          setErrors(fieldErrors)
          setMessage(c.invalid)
        } else setMessage(body.error === 'rate_limited' ? c.rate : c.error)
        setState('error')
        track('decision_form_error', locale, variant)
        return
      }
      setState('success')
      track('decision_form_success', locale, variant)
      form.reset()
    } catch {
      setMessage(c.error)
      setState('error')
      track('decision_form_error', locale, variant)
    }
  }
  if (state === 'success')
    return (
      <div className={styles.formStatus} role="status">
        <h3>{c.success}</h3>
        <p>{c.successDetail}</p>
        <button className={styles.secondaryButton} type="button" onClick={submitAnother}>
          {c.another}
        </button>
      </div>
    )
  const names: FieldName[] = [
    'name',
    'organization',
    'email',
    'decision',
    'information',
    'alternatives',
    'constraints',
    'context',
  ]
  return (
    <form
      className={`${styles.valueGrid} ${spacing.form}`}
      style={{ gridTemplateColumns: 'minmax(0, 720px)', maxWidth: 720, gap: 20 }}
      onSubmit={submit}
      onFocus={onFocus}
    >
      {names.map((name, i) => {
        const required = i < 4,
          long = i >= 3,
          error = errors[name],
          errorId = `${name}-error`
        return (
          <label key={name}>
            {c.fields[i]}
            {long ? (
              <textarea
                name={name}
                required={required}
                minLength={name === 'decision' ? 10 : undefined}
                maxLength={name === 'decision' || name === 'context' ? 4000 : 3000}
                aria-invalid={!!error}
                aria-describedby={error ? errorId : undefined}
              />
            ) : (
              <input
                name={name}
                required={required}
                minLength={name === 'name' || name === 'organization' ? 2 : undefined}
                type={name === 'email' ? 'email' : 'text'}
                maxLength={name === 'email' ? 254 : name === 'organization' ? 160 : 120}
                aria-invalid={!!error}
                aria-describedby={error ? errorId : undefined}
              />
            )}{' '}
            {error && (
              <span id={errorId} className={styles.formError}>
                {error}
              </span>
            )}
          </label>
        )
      })}
      <label className={styles.honeypot} aria-hidden="true">
        Website
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
      <button
        className={styles.primaryButtonLarge}
        type="submit"
        disabled={state === 'submitting'}
        aria-disabled={state === 'submitting'}
      >
        {state === 'submitting' ? c.submitting : c.submit}
      </button>
      {state === 'error' && message && (
        <p className={styles.formError} role="alert">
          {message}
        </p>
      )}
    </form>
  )
}
