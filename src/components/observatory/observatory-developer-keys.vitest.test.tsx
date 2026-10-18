import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ObservatoryDeveloperKeys } from './observatory-developer-keys'

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
  vi.stubGlobal('fetch', vi.fn(async () => Response.json(inventory)))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Observatory mobile SDK key form', () => {
  it('keeps each long capability ID attached to its checkbox and supports toggling', async () => {
    stubCatalog(['customer-opportunity-evaluation', 'outreach-prioritization'])
    const user = userEvent.setup()
    render(<ObservatoryDeveloperKeys locale="uk" />)

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
    render(<ObservatoryDeveloperKeys locale="en" />)

    const slugNode = await screen.findByText(slug)
    expect(slugNode.closest('label')?.querySelector('input[type="checkbox"]')).toBeTruthy()
    expect(slugNode.closest('label')?.querySelector('span')).toBeTruthy()
  })
})
