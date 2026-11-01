import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { ObservatoryPluginAdmin } from './observatory-plugin-admin'

vi.mock('@/use-cases/registry', () => ({ DIP_USE_CASES: [] }))
vi.mock('@/design-system', () => ({
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
}))

const one = {
  plugins: [
    {
      name: 'remote-3b25f5ae494aa7bf-secretary',
      plugin_id: 'secretary',
      source: 'remote',
      description: 'Planning via QDIP',
      version: '0.1.0',
      enabled: true,
      capabilities: ['secretary.plan'],
      published: false,
      published_version: null,
      capability_id: 'secretary.plan',
      revision: 0,
      ui: { label: 'VHV — Decision Assistant', category: 'Productivity' },
    },
  ],
}

function json(data: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => data }
}

const tick = async () => await screen.findByText(/Перевірено: \d{2}:\d{2}:\d{2}/)

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

beforeEach(() => {
  vi.resetAllMocks()
})

describe('Observatory registry refresh feedback', () => {
  it('shows loading, then a count and last-checked time even on the first successful load', async () => {
    let resolve!: (value: ReturnType<typeof json>) => void
    const fetchMock = vi.fn(
      () =>
        new Promise<ReturnType<typeof json>>((done) => {
          resolve = done
        })
    )
    vi.stubGlobal('fetch', fetchMock)
    render(<ObservatoryPluginAdmin locale="uk" />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Оновлення…' })).toBeDisabled())
    expect(screen.getByRole('status')).toHaveTextContent('Завантаження реєстру…')
    resolve(json(one))
    await tick()
    expect(screen.getByRole('status')).toHaveTextContent('Плагінів: 1')
    expect(screen.getByRole('button', { name: 'Оновити список' })).toBeEnabled()
  })

  it('shows a spinner, blocks duplicate clicks and confirms no changes after refresh', async () => {
    let resolveRefresh!: (value: ReturnType<typeof json>) => void
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(one))
      .mockImplementationOnce(
        () =>
          new Promise<ReturnType<typeof json>>((done) => {
            resolveRefresh = done
          })
      )
    vi.stubGlobal('fetch', fetchMock)
    render(<ObservatoryPluginAdmin locale="uk" />)
    await tick()
    fireEvent.click(screen.getByRole('button', { name: 'Оновити список' }))
    expect(screen.getByRole('button', { name: 'Оновлення…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Оновлення…' }).querySelector('svg.animate-spin')).toBeTruthy()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    resolveRefresh(json(one))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Змін немає'))
    expect(screen.getByRole('status')).toHaveTextContent('Плагінів: 1')
    expect(screen.getByRole('button', { name: 'Оновити список' })).toBeEnabled()
  })

  it('reports an updated list when a capability appears', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(one))
      .mockResolvedValueOnce(json({ plugins: [...one.plugins, { ...one.plugins[0], name: 'second-plugin' }] }))
    vi.stubGlobal('fetch', fetchMock)
    render(<ObservatoryPluginAdmin locale="uk" />)
    await tick()
    fireEvent.click(screen.getByRole('button', { name: 'Оновити список' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Список оновлено'))
    expect(screen.getByRole('status')).toHaveTextContent('Плагінів: 2')
  })

  it('shows failure without removing the last known registry or claiming success', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(one))
      .mockResolvedValueOnce(json({ error: 'Unavailable' }, 503))
    vi.stubGlobal('fetch', fetchMock)
    render(<ObservatoryPluginAdmin locale="uk" />)
    await tick()
    fireEvent.click(screen.getByRole('button', { name: 'Оновити список' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Оновлення не вдалося'))
    expect(screen.getByRole('status')).toHaveTextContent('Не вдалося оновити список')
    expect(screen.getByRole('heading', { name: 'Yara — планування справ і часу' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Оновити список' })).toBeEnabled()
  })

  it('renders localized progress and confirmation in English', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ plugins: [] }))
    vi.stubGlobal('fetch', fetchMock)
    render(<ObservatoryPluginAdmin locale="en" />)
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Plugins: 0'))
    expect(screen.getByRole('button', { name: 'Refresh list' })).toBeEnabled()
  })
})

describe('Canonical Yara publication defaults', () => {
  it('replaces only the legacy first-party display name and uses the Yara URL slug', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(one)))
    render(<ObservatoryPluginAdmin locale="uk" />)
    await tick()
    fireEvent.click(screen.getByRole('button', { name: 'Редагувати' }))
    expect(screen.getByRole('textbox', { name: 'Назва' })).toHaveValue('Yara — Decision Assistant')
    expect(screen.getByRole('textbox', { name: 'Коротка адреса (URL)' })).toHaveValue('yara')
  })
})

describe('Audited remote Worker approval', () => {
  it('does not approve before explicit review reference, reason and risk acknowledgement', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(one))
    vi.stubGlobal('fetch', fetchMock)
    render(<ObservatoryPluginAdmin locale="uk" />)
    await tick()
    fireEvent.click(screen.getByRole('button', { name: 'Редагувати' }))
    const approve = screen.getByRole('button', { name: 'Схвалити Worker' })
    expect(approve).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Посилання на перевірку (review reference)'), {
      target: { value: 'SECURITY-REVIEW-01' },
    })
    fireEvent.change(screen.getByLabelText('Причина схвалення та результат перевірки'), {
      target: { value: 'Verified the deployed first-party manifest and accepted its bounded risk.' },
    })
    expect(approve).toBeDisabled()
    fireEvent.click(screen.getByLabelText(/усвідомлено приймаю ризик допуску/))
    expect(approve).toBeEnabled()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('calls only the approved server endpoint, then refreshes revision before publication', async () => {
    const approved = {
      name: 'remote-3b25f5ae494aa7bf-secretary',
      revision: 1,
      security: { state: 'approved' },
      published: false,
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(one))
      .mockResolvedValueOnce(json(approved))
      .mockResolvedValueOnce(
        json({
          plugins: [{ ...one.plugins[0], revision: 1, published: false }],
        })
      )
    vi.stubGlobal('fetch', fetchMock)
    render(<ObservatoryPluginAdmin locale="uk" />)
    await tick()
    fireEvent.click(screen.getByRole('button', { name: 'Редагувати' }))
    fireEvent.change(screen.getByLabelText('Посилання на перевірку (review reference)'), {
      target: { value: 'SECURITY-REVIEW-01' },
    })
    fireEvent.change(screen.getByLabelText('Причина схвалення та результат перевірки'), {
      target: { value: 'Verified the deployed first-party manifest and accepted its bounded risk.' },
    })
    fireEvent.click(screen.getByLabelText(/усвідомлено приймаю ризик допуску/))
    fireEvent.click(screen.getByRole('button', { name: 'Схвалити Worker' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      '/api/observatory/admin/plugins/remote-3b25f5ae494aa7bf-secretary/security/approve'
    )
    const options = fetchMock.mock.calls[1]?.[1] as RequestInit
    expect(options.method).toBe('POST')
    expect(options.credentials).toBe('same-origin')
    expect(JSON.parse(String(options.body))).toEqual({
      expected_revision: 0,
      plugin_version: '0.1.0',
      review_reference: 'SECURITY-REVIEW-01',
      reason: 'Verified the deployed first-party manifest and accepted its bounded risk.',
      risk_acknowledged: true,
    })
    expect(await screen.findByText(/Security approval підтверджено Core/)).toBeInTheDocument()
    // Approval may be invalidated by a future REGISTER; never cache a trusted state in the browser.
    expect(screen.getByRole('button', { name: 'Схвалити Worker' })).toBeInTheDocument()
  })

  it('does not claim approval when Core rejects missing trusted manifest', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(one))
      .mockResolvedValueOnce(json({ error: 'not allowed' }, 403))
    vi.stubGlobal('fetch', fetchMock)
    render(<ObservatoryPluginAdmin locale="uk" />)
    await tick()
    fireEvent.click(screen.getByRole('button', { name: 'Редагувати' }))
    fireEvent.change(screen.getByLabelText('Посилання на перевірку (review reference)'), {
      target: { value: 'SECURITY-REVIEW-01' },
    })
    fireEvent.change(screen.getByLabelText('Причина схвалення та результат перевірки'), {
      target: { value: 'Verified the deployed first-party manifest and accepted its bounded risk.' },
    })
    fireEvent.click(screen.getByLabelText(/усвідомлено приймаю ризик допуску/))
    fireEvent.click(screen.getByRole('button', { name: 'Схвалити Worker' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('trusted manifest allowlist')
    expect(screen.getByRole('button', { name: 'Схвалити Worker' })).toBeEnabled()
  })
})
