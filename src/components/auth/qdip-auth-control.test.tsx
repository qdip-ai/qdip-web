import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { PLATFORM_URLS } from '@/lib/platform-urls'
import { QdipAuthControl } from './qdip-auth-control'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('QDIP shared authentication control', () => {
  it('exposes the Zitadel login from Observatory without requiring a valid browser session', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ configured: true, authenticated: false, studio: false, operator: false }),
      }))
    )
    render(<QdipAuthControl locale="uk" returnTo="https://observatory.qdip.ai/uk/challenges" />)

    const login = screen.getByRole('link', { name: 'Увійти' })
    const url = new URL(login.getAttribute('href')!)
    expect(url.origin).toBe('https://qdip.ai')
    expect(url.pathname).toBe('/api/auth/login')
    expect(url.searchParams.get('return_to')).toBe('https://observatory.qdip.ai/uk/challenges')
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith('/api/auth/session', expect.objectContaining({ cache: 'no-store' }))
    )
  })

  it('keeps the isolated Railway RR sign-in on its origin without redirecting other surfaces', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ configured: true, authenticated: false, studio: false, operator: false }),
      }))
    )
    const urls = PLATFORM_URLS as unknown as { observatory: string }
    const original = urls.observatory
    const qaOrigin = 'https://rr-standalone-web-qa-qa.up.railway.app'
    urls.observatory = qaOrigin
    try {
      const { rerender } = render(
        <QdipAuthControl locale="en" returnTo={qaOrigin + '/en/readiness-recovery'} />
      )
      let login = screen.getByRole('link', { name: 'Sign in' })
      let target = new URL(login.getAttribute('href')!)
      expect(target.origin).toBe(qaOrigin)
      expect(target.pathname).toBe('/api/auth/login')
      expect(target.searchParams.get('return_to')).toBe(qaOrigin + '/en/readiness-recovery')

      rerender(<QdipAuthControl locale="en" returnTo={qaOrigin + '/en/admin/plugins'} />)
      login = screen.getByRole('link', { name: 'Sign in' })
      target = new URL(login.getAttribute('href')!)
      expect(target.origin).toBe('https://qdip.ai')

      rerender(<QdipAuthControl locale="en" returnTo="https://qdip.ai/en" />)
      expect(new URL(screen.getByRole('link', { name: 'Sign in' }).getAttribute('href')!).origin).toBe(
        'https://qdip.ai'
      )
    } finally {
      urls.observatory = original
    }
  })

  it('provides an explicit sign out when the signed session is authenticated', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ configured: true, authenticated: true, studio: true, operator: false }),
      }))
    )
    render(<QdipAuthControl locale="en" returnTo="https://qdip.ai/en" />)

    expect(await screen.findByRole('button', { name: 'Sign out' })).toBeVisible()
    expect(screen.getByText('Signed in')).toBeVisible()
    expect(screen.queryByRole('link', { name: 'Sign in' })).not.toBeInTheDocument()
  })

  it('shows the signed-in identity and authorized roles in Observatory profile menu', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          configured: true,
          authenticated: true,
          studio: true,
          operator: true,
          observatoryAdmin: true,
          user: { id: 'qa-id-001', displayName: 'QA Tester', email: 'qa@qdip.ai' },
        }),
      }))
    )
    render(<QdipAuthControl locale="uk" returnTo="https://observatory.qdip.ai/uk/admin/plugins" showProfile />)

    expect(await screen.findByTestId('observatory-profile')).toBeVisible()
    const avatar = screen.getByRole('button', { name: 'Обліковий запис: QA Tester' })
    expect(avatar).toHaveAttribute('aria-expanded', 'false')
    expect(avatar.querySelector('svg')).not.toBeNull()
    fireEvent.click(avatar)
    expect(avatar).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('dialog', { name: 'Обліковий запис' })).toBeVisible()
    expect(screen.getByText('QA Tester')).toBeInTheDocument()
    expect(screen.getByText('qa@qdip.ai')).toBeInTheDocument()
    expect(screen.getByText('qa@qdip.ai').closest('a')).toBeNull()
    expect(screen.queryByText(/ID користувача:/)).not.toBeInTheDocument()
    expect(screen.getByText('Адміністратор Observatory')).toBeInTheDocument()
    expect(screen.getByText('Оператор RR')).toBeInTheDocument()
    expect(screen.getByText('Studio')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Вийти' })).toBeInTheDocument()
  })

  it('does not show a technical ID even when the OIDC session has no display identity', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          configured: true,
          authenticated: true,
          studio: false,
          operator: false,
          observatoryAdmin: true,
          user: { id: 'old-sub-123', displayName: null, email: null },
        }),
      }))
    )
    render(<QdipAuthControl locale="en" returnTo="https://observatory.qdip.ai/en" showProfile />)
    const avatar = await screen.findByRole('button', { name: 'Account: Account' })
    fireEvent.click(avatar)
    expect(screen.getByRole('dialog', { name: 'Account' })).toBeVisible()
    expect(screen.queryByText(/old-sub-123|Account ID/)).not.toBeInTheDocument()
    expect(screen.getByText('Observatory admin')).toBeInTheDocument()
  })

  it('uses the vector smile-lock instead of an arrow for icon-only marketing sign-in', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ configured: true, authenticated: false, studio: false, operator: false }),
      }))
    )
    render(<QdipAuthControl locale="uk" returnTo="https://qdip.ai/uk" iconOnly />)

    const login = screen.getByRole('link', { name: 'Увійти' })
    expect(login.querySelector('img')?.getAttribute('src')).toBe('/auth-smile-lock.svg')
    expect(login.querySelector('img')?.getAttribute('width')).toBe('24')
    expect(login.querySelector('img')?.getAttribute('height')).toBe('24')
    expect(login.querySelector('img')?.getAttribute('alt')).toBe('')
    expect(login.querySelector('svg')).toBeNull()
    await waitFor(() => expect(fetch).toHaveBeenCalled())
  })

  it('uses a distinct sign-out symbol for authenticated marketing users', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ configured: true, authenticated: true, studio: false, operator: false }),
      }))
    )
    render(<QdipAuthControl locale="en" returnTo="https://qdip.ai/en" iconOnly />)

    const signOut = await screen.findByRole('button', { name: 'Sign out' })
    expect(signOut.querySelector('img')).toBeNull()
    expect(signOut.querySelector('svg')).not.toBeNull()
  })

  it('keeps the session if sign-out fails and offers an error message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === 'POST') return { ok: false }
        return { ok: true, json: async () => ({ configured: true, authenticated: true, studio: true, operator: true }) }
      })
    )
    render(<QdipAuthControl locale="pl" returnTo="https://studio.qdip.ai/pl" />)

    fireEvent.click(await screen.findByRole('button', { name: 'Wyloguj się' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Nie udało się wylogować')
    expect(fetch).toHaveBeenCalledWith('/api/auth/logout', expect.objectContaining({ method: 'POST' }))
    expect(screen.getByRole('button', { name: 'Wyloguj się' })).toBeEnabled()
  })
})
