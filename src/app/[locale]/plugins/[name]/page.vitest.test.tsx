import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PluginCatalogEntry } from '@qdip/client'

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NOT_FOUND')
  },
  redirect: (url: string) => {
    throw new Error('REDIRECT:' + url)
  },
}))
vi.mock('@/features/observatory', () => ({
  PrototypeShell: ({ children }: { children: ReactNode }) => <>{children}</>,
}))
vi.mock('@/lib/observatory-plugin-catalog', () => ({ publishedPlugins: vi.fn() }))
vi.mock('@/use-cases/registry', () => ({ DIP_USE_CASES: [] }))

import PluginDetailsPage from './page'
import { publishedPlugins } from '@/lib/observatory-plugin-catalog'

const vhv: PluginCatalogEntry = {
  name: 'remote-04e7c87d7b72111c-secretary',
  plugin_id: 'secretary',
  source: 'remote',
  slug: 'vhv',
  version: '0.1.0',
  published_version: '0.1.0',
  published: true,
  enabled: true,
  description: 'Decision-aware planning of commitments',
  capabilities: ['secretary.plan'],
  capability_versions: { 'secretary.plan': '1' },
  capability_id: 'secretary.plan',
  ui: { label: 'VHV — Decision Assistant', category: 'Decision support' },
  revision: 3,
}

const catalog = vi.mocked(publishedPlugins)

async function markup(locale: string, name: string): Promise<string> {
  const page = await PluginDetailsPage({ params: Promise.resolve({ locale, name }) })
  return renderToStaticMarkup(page)
}

beforeEach(() => {
  vi.resetAllMocks()
  catalog.mockResolvedValue([vhv])
})

describe('published plugin detail application launcher', () => {
  it.each([
    ['uk', 'Відкрити застосунок'],
    ['en', 'Open application'],
    ['pl', 'Otwórz aplikację'],
  ])('renders the visible, translated VHV launch CTA in %s', async (locale, label) => {
    const html = await markup(locale, 'vhv')
    expect(html).toContain(label + ' VHV')
    expect(html).toContain('href="https://vhv.qdip.ai"')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
    expect(html).toContain('secretary.plan')
  })

  it('does not show an outbound VHV launch for a different published plugin', async () => {
    catalog.mockResolvedValue([{ ...vhv, name: 'remote-unrelated', plugin_id: 'other', slug: 'other' }])
    const html = await markup('uk', 'other')
    expect(html).not.toContain('https://vhv.qdip.ai')
    expect(html).not.toContain('Відкрити застосунок VHV')
  })

  it('does not show a launch link when the catalog has no published VHV', async () => {
    catalog.mockResolvedValue([])
    await expect(markup('uk', 'vhv')).rejects.toThrow('NOT_FOUND')
  })

  it('redirects old VHV catalog URLs to the canonical slug while keeping the app target separate', async () => {
    await expect(markup('uk', vhv.name)).rejects.toThrow('REDIRECT:/uk/plugins/vhv')
  })
})
