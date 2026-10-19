import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ObservatoryDeveloperKeys } from './observatory-developer-keys'

const ZITADEL_ID = '11111111111111111111'
const organizations = { organizations: [{ id: ZITADEL_ID, name: 'QDIP', state: 'active' }] }
const linked = {
  organization: organizations.organizations[0], linked: true,
  coreTenantId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  pluginMigrationComplete: false,
}

async function chooseOrganization(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', {
    name: /Використовувати цю організацію|Use this organization|Użyj tej organizacji/,
  }))
}

function stubCatalog(capabilities: string[]) {
  const inventory = {
    available: [{
      id: 'customer-opportunity', label: 'Customer opportunity',
      registered: true, enabled: true, keys: [], capabilities,
    }],
    connected: [],
  }
  vi.stubGlobal('fetch', vi.fn(async (input: string, init?: RequestInit) => {
    const path = new URL(input, 'https://observatory.qdip.ai').pathname
    if (path.endsWith('/api/observatory/organizations'))
      return Response.json(init?.method === 'POST' ? linked : organizations)
    return Response.json(inventory)
  }))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Observatory mobile SDK key form', () => {
  it('keeps each long capability ID attached to its checkbox and supports toggling', async () => {
    stubCatalog(['customer-opportunity-evaluation', 'outreach-prioritization'])
    const user = userEvent.setup()
    render(<ObservatoryDeveloperKeys locale="uk" />)
    await chooseOrganization(user)

    const first = await screen.findByText('customer-opportunity-evaluation')
    const second = screen.getByText('outreach-prioritization')
    expect(screen.getByText('Customer opportunity evaluation')).toBeTruthy()
    expect(screen.getByText('Outreach prioritization')).toBeTruthy()

    const firstLabel = first.closest('label')
    const secondLabel = second.closest('label')
    expect(firstLabel).toBeTruthy()
    expect(secondLabel).toBeTruthy()
    expect(firstLabel).not.toBe(secondLabel)
    const firstCheckbox = within(firstLabel as HTMLElement).getByRole('checkbox') as HTMLInputElement
    const secondCheckbox = within(secondLabel as HTMLElement).getByRole('checkbox') as HTMLInputElement
    expect(firstCheckbox.checked).toBe(true)
    expect(secondCheckbox.checked).toBe(true)

    await user.click(firstLabel as HTMLElement)
    await waitFor(() => expect(firstCheckbox.checked).toBe(false))
    expect(secondCheckbox.checked).toBe(true)

    const manual = screen.getByRole('checkbox', { name: 'Плагін ще не зареєстрований' })
    expect(manual.closest('label')).toBeTruthy()
    await user.click(manual)
    expect((manual as HTMLInputElement).checked).toBe(true)
  })

  it('keeps a very long capability slug in the same label as its checkbox', async () => {
    const slug = 'very-long-capability-identifier-for-an-unusually-long-third-party-plugin-integration'
    stubCatalog([slug])
    const user = userEvent.setup()
    render(<ObservatoryDeveloperKeys locale="en" />)
    await chooseOrganization(user)

    const slugNode = await screen.findByText(slug)
    expect(slugNode.closest('label')?.querySelector('input[type="checkbox"]')).toBeTruthy()
    expect(slugNode.closest('label')?.querySelector('span')).toBeTruthy()
  })

  it('uses a full-width readable field and a separate two-button action row', async () => {
    const inventory = {
      available: [
        {
          id: 'sample-plugin',
          label: 'Sample',
          registered: true,
          enabled: true,
          keys: [],
          capabilities: ['sample.process'],
        },
      ],
      connected: [],
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, options?: RequestInit) => {
        const url = new URL(input, 'https://observatory.qdip.ai')
        if (url.pathname.endsWith('/api/observatory/organizations'))
          return Response.json(options?.method === 'POST' ? linked : organizations)
        return Response.json(options?.method === 'POST'
          ? {
              pluginId: 'sample-plugin',
              key: 'placeholder',
              keyId: 'fixture',
              role: 'execute',
              expiresAt: '2026-12-01T00:00:00Z',
              capabilities: ['sample.process'],
            }
          : inventory)
      })
    )
    const user = userEvent.setup()
    render(<ObservatoryDeveloperKeys locale="en" />)
    await chooseOrganization(user)
    await screen.findByText('sample.process')
    await user.click(screen.getByRole('button', { name: 'Generate key' }))
    const field = (await screen.findByRole('textbox', { name: 'Active credential' })) as HTMLInputElement
    expect(field.type).toBe('text')
    expect(field.readOnly).toBe(true)
    expect(field.className).toContain('w-full')
    const actions = field.nextElementSibling as HTMLElement
    expect(actions.className).toContain('grid-cols-2')
    expect(within(actions).getByRole('button', { name: 'Copy key' })).toBeTruthy()
    await user.click(within(actions).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('textbox', { name: 'Active credential' })).toBeNull()
  })
})
