import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ObservatoryPluginAdmin } from './observatory-plugin-admin'

vi.mock('@/use-cases/registry', () => ({ DIP_USE_CASES: [] }))
vi.mock('@/design-system', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}))

const one = {
  plugins: [{
    name: 'remote-demo-secretary',
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
  }],
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
    const fetchMock = vi.fn(() => new Promise<ReturnType<typeof json>>((done) => { resolve = done }))
    vi.stubGlobal('fetch', fetchMock)
    render(<ObservatoryPluginAdmin locale="uk" />)
    expect(screen.getByRole('button', { name: 'Оновлення…' })).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent('Завантаження реєстру…')
    resolve(json(one))
    await tick()
    expect(screen.getByRole('status')).toHaveTextContent('Плагінів: 1')
    expect(screen.getByRole('button', { name: 'Оновити список' })).toBeEnabled()
  })

  it('shows a spinner, blocks duplicate clicks and confirms no changes after refresh', async () => {
    let resolveRefresh!: (value: ReturnType<typeof json>) => void
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json(one))
      .mockImplementationOnce(() => new Promise<ReturnType<typeof json>>((done) => { resolveRefresh = done }))
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
    const fetchMock = vi.fn().mockResolvedValueOnce(json(one))
      .mockResolvedValueOnce(json({plugins: [...one.plugins, { ...one.plugins[0], name: 'second-plugin' }]}))
    vi.stubGlobal('fetch', fetchMock)
    render(<ObservatoryPluginAdmin locale="uk" />)
    await tick()
    fireEvent.click(screen.getByRole('button', { name: 'Оновити список' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Список оновлено'))
    expect(screen.getByRole('status')).toHaveTextContent('Плагінів: 2')
  })

  it('shows failure without removing the last known registry or claiming success', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(json(one))
      .mockResolvedValueOnce(json({error:'Unavailable'},503))
    vi.stubGlobal('fetch', fetchMock)
    render(<ObservatoryPluginAdmin locale="uk" />)
    await tick()
    fireEvent.click(screen.getByRole('button', { name: 'Оновити список' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Оновлення не вдалося'))
    expect(screen.getByRole('status')).toHaveTextContent('Не вдалося оновити список')
    expect(screen.getByText('VHV — Decision Assistant')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Оновити список' })).toBeEnabled()
  })

  it('renders localized progress and confirmation in English', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({plugins: []}))
    vi.stubGlobal('fetch', fetchMock)
    render(<ObservatoryPluginAdmin locale="en" />)
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Plugins: 0'))
    expect(screen.getByRole('button', { name: 'Refresh list' })).toBeEnabled()
  })
})
