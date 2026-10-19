import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ObservatoryDeveloperKeys } from './observatory-developer-keys'

const ZITADEL_ID = '11111111111111111111'
const organizations = { organizations: [{ id: ZITADEL_ID, name: 'QDIP', state: 'active' }] }
const linked = {
  organization: organizations.organizations[0],
  linked: true,
  coreTenantId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  pluginMigrationComplete: false,
}

async function chooseOrganization(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    await screen.findByRole('button', {
      name: /Використовувати цю організацію|Use this organization|Użyj tej organizacji/,
    })
  )
}

function stubCatalog(capabilities: string[]) {
  const inventory = {
    available: [
      {
        id: 'customer-opportunity',
        label: 'Customer opportunity',
        registered: true,
        enabled: true,
        keys: [],
        capabilities,
      },
    ],
    connected: [],
  }
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, init?: RequestInit) => {
      const path = new URL(input, 'https://observatory.qdip.ai').pathname
      if (path.endsWith('/api/observatory/organizations'))
        return Response.json(init?.method === 'POST' ? linked : organizations)
      return Response.json(inventory)
    })
  )
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
  ...[truncated]