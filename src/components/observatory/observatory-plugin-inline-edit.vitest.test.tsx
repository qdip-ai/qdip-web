import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { ObservatoryPluginAdmin } from './observatory-plugin-admin'

vi.mock('@/use-cases/registry', () => ({ DIP_USE_CASES: [] }))
vi.mock('@/design-system', () => ({
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
}))

const secretary = {
  name: 'remote-qa-secretary',
  plugin_id: 'secretary',
  source: 'remote',
  description: 'Decision-aware planning of commitments',
  version: '0.1.0',
  enabled: true,
  capabilities: ['secretary.plan'],
  published: false,
  published_version: null,
  capability_id: 'secretary.plan',
  revision: 1,
  ui: { label: 'VHV — Decision Assistant', category: 'Productivity' },
}

const second = {
  ...secretary,
  name: 'second-plugin',
  plugin_id: 'second',
  description: 'Independent second plugin',
  capabilities: ['second.plan'],
  capability_id: 'second.plan',
  ui: { label: 'Second plugin', category: 'Other' },
}

function reply(value: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => value }
}

async function loaded() {
  await screen.findByText(/Плагінів: \d/)
}

function card(name: string) {
  const heading = screen.getByRole('heading', { name })
  const article = heading.closest('article')
  if (!article) throw new Error('Expected an article for plugin')
  return within(article)
}

beforeEach(() => {
  vi.resetAllMocks()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('Observatory inline plugin editing', () => {
  it('opens the editor next to the clicked plugin, not above the list, with focus and no keyboard pop-up', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply({ plugins: [secretary] })))
    render(<ObservatoryPluginAdmin locale="uk" />)
    await loaded()
    expect(screen.queryByText('Публікація плагіна')).not.toBeInTheDocument()
    fireEvent.click(card('VHV — Decision Assistant').getByRole('button', { name: 'Редагувати' }))
    expect(
      card('VHV — Decision Assistant').getByRole('heading', {
        name: 'Редагування плагіна: VHV — Decision Assistant',
      })
    ).toHaveFocus()
    expect(card('VHV — Decision Assistant').getByRole('textbox', { name: 'Назва' })).toHaveValue(
      'VHV — Decision Assistant'
    )
    expect(card('VHV — Decision Assistant').getByRole('combobox', { name: 'Категорія' })).toHaveValue('Productivity')
    expect(card('VHV — Decision Assistant').getByRole('textbox', { name: 'Коротка адреса (URL)' })).toHaveValue(
      'secretary'
    )
    expect(card('VHV — Decision Assistant').getByText(/\/uk\/plugins\/secretary/)).toBeInTheDocument()
    expect(card('VHV — Decision Assistant').getByRole('button', { name: 'Зберегти й опублікувати' })).toBeEnabled()
    expect(screen.queryByLabelText('Зареєстрований через SDK плагін')).not.toBeInTheDocument()
  })

  it('cancel closes the editor without saving', async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply({ plugins: [secretary] }))
    vi.stubGlobal('fetch', fetchMock)
    render(<ObservatoryPluginAdmin locale="uk" />)
    await loaded()
    fireEvent.click(card('VHV — Decision Assistant').getByRole('button', { name: 'Редагувати' }))
    fireEvent.change(card('VHV — Decision Assistant').getByRole('textbox', { name: 'Назва' }), {
      target: { value: 'Unsaved title' },
    })
    fireEvent.click(card('VHV — Decision Assistant').getByRole('button', { name: 'Скасувати' }))
    expect(screen.queryByRole('heading', { name: /Редагування плагіна:/ })).not.toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('editing a different plugin switches inline editors and does not show two forms', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply({ plugins: [secretary, second] })))
    render(<ObservatoryPluginAdmin locale="uk" />)
    await loaded()
    fireEvent.click(card('VHV — Decision Assistant').getByRole('button', { name: 'Редагувати' }))
    fireEvent.click(card('Second plugin').getByRole('button', { name: 'Редагувати' }))
    expect(screen.getAllByRole('heading', { name: /Редагування плагіна:/ })).toHaveLength(1)
    expect(card('Second plugin').getByRole('textbox', { name: 'Назва' })).toHaveValue('Second plugin')
    expect(card('VHV — Decision Assistant').queryByRole('textbox', { name: 'Назва' })).not.toBeInTheDocument()
  })

  it('publishes from the same card and displays confirmation without a page jump', async () => {
    const published = { ...secretary, published: true, published_version: '0.1.0', revision: 2 }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(reply({ plugins: [secretary] }))
      .mockResolvedValueOnce(reply({ updated: true }))
      .mockResolvedValueOnce(reply({ plugins: [published] }))
    vi.stubGlobal('fetch', fetchMock)
    render(<ObservatoryPluginAdmin locale="uk" />)
    await loaded()
    fireEvent.click(card('VHV — Decision Assistant').getByRole('button', { name: 'Редагувати' }))
    fireEvent.click(card('VHV — Decision Assistant').getByRole('button', { name: 'Зберегти й опублікувати' }))
    await waitFor(() =>
      expect(card('VHV — Decision Assistant').getByRole('status')).toHaveTextContent('Плагін опубліковано')
    )
    const request = fetchMock.mock.calls.find((args) => args[1]?.method === 'PUT')
    expect(request?.[0]).toContain('remote-qa-secretary')
    expect(JSON.parse(request?.[1].body as string)).toMatchObject({
      published: true,
      expected_revision: 1,
      capability_id: 'secretary.plan',
      category: 'Productivity',
      slug: 'secretary',
    })
    expect(screen.queryByRole('heading', { name: /Редагування плагіна:/ })).not.toBeInTheDocument()
    expect(card('VHV — Decision Assistant').getByText('Опубліковано')).toBeInTheDocument()
  })

  it('closes the editor as soon as PUT succeeds and confirms status in the card while refreshing', async () => {
    let resolveRefresh!: (value: ReturnType<typeof reply>) => void
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(reply({ plugins: [secretary] }))
      .mockResolvedValueOnce(reply({ updated: true }))
      .mockImplementationOnce(
        () =>
          new Promise<ReturnType<typeof reply>>((done) => {
            resolveRefresh = done
          })
      )
    vi.stubGlobal('fetch', fetchMock)
    render(<ObservatoryPluginAdmin locale="uk" />)
    await loaded()
    fireEvent.click(card('VHV — Decision Assistant').getByRole('button', { name: 'Редагувати' }))
    fireEvent.click(card('VHV — Decision Assistant').getByRole('button', { name: 'Зберегти й опублікувати' }))
    await waitFor(() =>
      expect(card('VHV — Decision Assistant').getByRole('status')).toHaveTextContent('Перевіряю статус')
    )
    expect(
      card('VHV — Decision Assistant').queryByRole('heading', { name: /Редагування плагіна/ })
    ).not.toBeInTheDocument()
    expect(card('VHV — Decision Assistant').getByRole('status')).toHaveFocus()
    resolveRefresh(reply({ plugins: [{ ...secretary, published: true, published_version: '0.1.0' }] }))
    await waitFor(() =>
      expect(card('VHV — Decision Assistant').getByRole('status')).toHaveTextContent('Плагін опубліковано')
    )
  })

  it('keeps the editor closed but shows a local warning when verification fails after a successful save', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(reply({ plugins: [secretary] }))
      .mockResolvedValueOnce(reply({ updated: true }))
      .mockResolvedValueOnce(reply({ error: 'Core unavailable' }, 503))
    vi.stubGlobal('fetch', fetchMock)
    render(<ObservatoryPluginAdmin locale="uk" />)
    await loaded()
    fireEvent.click(card('VHV — Decision Assistant').getByRole('button', { name: 'Редагувати' }))
    fireEvent.click(card('VHV — Decision Assistant').getByRole('button', { name: 'Зберегти й опублікувати' }))
    await waitFor(() =>
      expect(card('VHV — Decision Assistant').getByRole('alert')).toHaveTextContent('Збережено, але не вдалося')
    )
    expect(
      card('VHV — Decision Assistant').queryByRole('heading', { name: /Редагування плагіна/ })
    ).not.toBeInTheDocument()
    expect(card('VHV — Decision Assistant').queryByRole('status')).not.toBeInTheDocument()
  })

  it('updates the canonical public URL without changing the SDK registry plugin ID', async () => {
    const changed = { ...secretary, slug: 'vhv-planner', published: true, published_version: '0.1.0' }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(reply({ plugins: [secretary] }))
      .mockResolvedValueOnce(reply({ updated: true }))
      .mockResolvedValueOnce(reply({ plugins: [changed] }))
    vi.stubGlobal('fetch', fetchMock)
    render(<ObservatoryPluginAdmin locale="uk" />)
    await loaded()
    fireEvent.click(card('VHV — Decision Assistant').getByRole('button', { name: 'Редагувати' }))
    fireEvent.change(card('VHV — Decision Assistant').getByRole('textbox', { name: 'Коротка адреса (URL)' }), {
      target: { value: 'vhv-planner' },
    })
    fireEvent.click(card('VHV — Decision Assistant').getByRole('button', { name: 'Зберегти й опублікувати' }))
    await waitFor(() =>
      expect(card('VHV — Decision Assistant').getByRole('status')).toHaveTextContent('Плагін опубліковано')
    )
    const put = fetchMock.mock.calls.find((args) => args[1]?.method === 'PUT')
    expect(put?.[0]).toContain('remote-qa-secretary')
    expect(JSON.parse(put?.[1].body as string).slug).toBe('vhv-planner')
    expect(card('VHV — Decision Assistant').getByRole('link', { name: /Переглянути сторінку/ })).toHaveAttribute(
      'href',
      '/uk/plugins/vhv-planner'
    )
  })

  it('disables publishing an invalid reserved URL slug', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply({ plugins: [secretary] })))
    render(<ObservatoryPluginAdmin locale="uk" />)
    await loaded()
    fireEvent.click(card('VHV — Decision Assistant').getByRole('button', { name: 'Редагувати' }))
    fireEvent.change(card('VHV — Decision Assistant').getByRole('textbox', { name: 'Коротка адреса (URL)' }), {
      target: { value: 'admin' },
    })
    expect(card('VHV — Decision Assistant').getByRole('button', { name: 'Зберегти й опублікувати' })).toBeDisabled()
  })

  it('keeps editor and previously loaded data visible after rejected publication', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(reply({ plugins: [secretary] }))
      .mockResolvedValueOnce(reply({ error: 'Registry changed' }, 409))
    vi.stubGlobal('fetch', fetchMock)
    render(<ObservatoryPluginAdmin locale="uk" />)
    await loaded()
    fireEvent.click(card('VHV — Decision Assistant').getByRole('button', { name: 'Редагувати' }))
    fireEvent.click(card('VHV — Decision Assistant').getByRole('button', { name: 'Зберегти й опублікувати' }))
    await waitFor(() => expect(card('VHV — Decision Assistant').getByRole('alert')).toHaveTextContent('Запис змінився'))
    expect(card('VHV — Decision Assistant').getByRole('textbox', { name: 'Назва' })).toBeInTheDocument()
  })

  it('explains why an offline worker cannot publish instead of offering an inert button', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply({ plugins: [{ ...secretary, enabled: false }] })))
    render(<ObservatoryPluginAdmin locale="uk" />)
    await loaded()
    fireEvent.click(card('VHV — Decision Assistant').getByRole('button', { name: 'Редагувати' }))
    expect(card('VHV — Decision Assistant').getByText(/поки Remote Worker не підключений/)).toBeInTheDocument()
    expect(card('VHV — Decision Assistant').getByRole('button', { name: 'Зберегти й опублікувати' })).toBeDisabled()
  })

  it('renders a registered singleton capability as technical information, never an empty-choice dropdown', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply({ plugins: [secretary] })))
    render(<ObservatoryPluginAdmin locale="uk" />)
    await loaded()
    fireEvent.click(card('VHV — Decision Assistant').getByRole('button', { name: 'Редагувати' }))
    const editor = card('VHV — Decision Assistant')
    expect(editor.queryByRole('combobox', { name: 'Можливість SDK' })).not.toBeInTheDocument()
    expect(editor.getByRole('combobox', { name: 'Категорія' })).toBeInTheDocument()
    expect(editor.getByText('secretary.plan')).toBeInTheDocument()
    expect(editor.getByText(/Визначено розробником через SDK/)).toBeInTheDocument()
  })

  it('offers capability selection only when SDK registers multiple capabilities', async () => {
    const multi = { ...secretary, capabilities: ['secretary.plan', 'secretary.check'] }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(reply({ plugins: [multi] }))
      .mockResolvedValueOnce(reply({ updated: true }))
      .mockResolvedValueOnce(
        reply({
          plugins: [
            {
              ...multi,
              capability_id: 'secretary.check',
              published: true,
              published_version: '0.1.0',
            },
          ],
        })
      )
    vi.stubGlobal('fetch', fetchMock)
    render(<ObservatoryPluginAdmin locale="uk" />)
    await loaded()
    fireEvent.click(card('VHV — Decision Assistant').getByRole('button', { name: 'Редагувати' }))
    const capability = card('VHV — Decision Assistant').getByRole('combobox', { name: 'Можливість SDK' })
    fireEvent.change(capability, { target: { value: 'secretary.check' } })
    expect(capability).toHaveValue('secretary.check')
    fireEvent.click(card('VHV — Decision Assistant').getByRole('button', { name: 'Зберегти й опублікувати' }))
    await waitFor(() => expect(fetchMock.mock.calls.some((call) => call[1]?.method === 'PUT')).toBe(true))
    const put = fetchMock.mock.calls.find((call) => call[1]?.method === 'PUT')
    expect(JSON.parse(put?.[1].body as string).capability_id).toBe('secretary.check')
  })

  it('keeps an offline but published plugin visible as published and allows unpublishing', async () => {
    const offline = { ...secretary, published: true, published_version: '0.1.0', enabled: false }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(reply({ plugins: [offline] }))
      .mockResolvedValueOnce(reply({ updated: true }))
      .mockResolvedValueOnce(reply({ plugins: [{ ...offline, published: false, published_version: null }] }))
    vi.stubGlobal('fetch', fetchMock)
    render(<ObservatoryPluginAdmin locale="uk" />)
    await loaded()
    const entry = card('VHV — Decision Assistant')
    expect(entry.getByText('Опубліковано')).toBeInTheDocument()
    expect(entry.getByText('Remote Worker не підключений')).toBeInTheDocument()
    fireEvent.click(entry.getByRole('button', { name: 'Приховати з каталогу' }))
    await waitFor(() => expect(fetchMock.mock.calls.some((call) => call[1]?.method === 'PUT')).toBe(true))
    const put = fetchMock.mock.calls.find((call) => call[1]?.method === 'PUT')
    expect(JSON.parse(put?.[1].body as string).published).toBe(false)
  })

  it('requires explicit administrator URL review and persists a verified third-party link', async () => {
    const next = {
      ...secretary,
      application_launch_url: 'https://routing.partner-example.org/app',
      launch_url_verified: true,
      published: true,
      published_version: '0.1.0',
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(reply({ plugins: [secretary] }))
      .mockResolvedValueOnce(reply({ updated: true }))
      .mockResolvedValueOnce(reply({ plugins: [next] }))
    vi.stubGlobal('fetch', fetchMock)
    render(<ObservatoryPluginAdmin locale="uk" />)
    await loaded()
    const entry = card('VHV — Decision Assistant')
    fireEvent.click(entry.getByRole('button', { name: 'Редагувати' }))
    const launch = entry.getByRole('textbox', { name: 'URL запуску застосунку' })
    fireEvent.change(launch, { target: { value: 'http://localhost/worker' } })
    expect(entry.getByRole('button', { name: 'Зберегти й опублікувати' })).toBeDisabled()
    fireEvent.change(launch, { target: { value: 'https://routing.partner-example.org/app' } })
    const approve = entry.getByRole('checkbox', { name: /перевірив власника домену/ })
    expect(approve).not.toBeChecked()
    expect(entry.getByRole('button', { name: 'Зберегти й опублікувати' })).toBeDisabled()
    fireEvent.click(approve)
    expect(entry.getByRole('button', { name: 'Зберегти й опублікувати' })).toBeEnabled()
    fireEvent.click(entry.getByRole('button', { name: 'Зберегти й опублікувати' }))
    await waitFor(() => expect(fetchMock.mock.calls.some((call) => call[1]?.method === 'PUT')).toBe(true))
    const put = fetchMock.mock.calls.find((call) => call[1]?.method === 'PUT')
    expect(JSON.parse(put?.[1].body as string)).toMatchObject({
      application_launch_url: 'https://routing.partner-example.org/app',
      launch_url_verified: true,
    })
  })

  it('can revoke a previously verified launch link without revoking the plugin', async () => {
    const installed = {
      ...secretary,
      application_launch_url: 'https://routing.partner-example.org/app',
      launch_url_verified: true,
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(reply({ plugins: [installed] }))
      .mockResolvedValueOnce(reply({ updated: true }))
      .mockResolvedValueOnce(
        reply({ plugins: [{ ...installed, application_launch_url: null, launch_url_verified: false }] })
      )
    vi.stubGlobal('fetch', fetchMock)
    render(<ObservatoryPluginAdmin locale="uk" />)
    await loaded()
    const entry = card('VHV — Decision Assistant')
    fireEvent.click(entry.getByRole('button', { name: 'Редагувати' }))
    fireEvent.change(entry.getByRole('textbox', { name: 'URL запуску застосунку' }), { target: { value: '' } })
    fireEvent.click(entry.getByRole('button', { name: 'Зберегти й опублікувати' }))
    await waitFor(() => expect(fetchMock.mock.calls.some((call) => call[1]?.method === 'PUT')).toBe(true))
    const put = fetchMock.mock.calls.find((call) => call[1]?.method === 'PUT')
    expect(JSON.parse(put?.[1].body as string)).toMatchObject({
      published: true,
      application_launch_url: '',
      launch_url_verified: false,
    })
  })
})
