import { describe, expect, it } from 'vitest'
import type { PluginCatalogEntry } from '@qdip/client'
import { pluginPresentation } from './observatory-plugin-editorial'

const entry = (patch: Partial<PluginCatalogEntry>): PluginCatalogEntry => ({
  name: 'gtm-lab',
  source: 'embedded',
  version: '0.1.0',
  description:
    'Assesses sales opportunities with supporting evidence, uncertainty, research priorities and an outreach preview. Provides a demonstration and decision support; it does not send outreach automatically.',
  enabled: true,
  capabilities: ['gtm.demo.run'],
  capability_versions: { 'gtm.demo.run': '1' },
  ui: {
    label: 'GTM Lab — Market Opportunity Assessment',
    category: 'Decision support',
  },
  published: true,
  revision: 1,
  capability_id: 'gtm.demo.run',
  published_version: '0.1.0',
  ...patch,
})

describe('first-party catalog editorial translations', () => {
  it('translates human name and description into Ukrainian/Polish without changing SDK IDs', () => {
    const original = entry({})
    const uk = pluginPresentation(original, 'uk')
    const pl = pluginPresentation(original, 'pl')
    expect(uk.title).toBe('GTM Lab — оцінка ринкових можливостей')
    expect(uk.description).toContain('не надсилає')
    expect(pl.title).toBe('GTM Lab — ocena możliwości rynkowych')
    expect(pl.description).toContain('automatycznej')
    expect(pluginPresentation(original, 'en')).toEqual({
      title: original.ui.label,
      description: original.description,
    })
    expect(original.name).toBe('gtm-lab')
    expect(original.capability_id).toBe('gtm.demo.run')
  })

  it('supports previous GTM ID labeling until Core product metadata is deployed', () => {
    const old = entry({ name: 'GTM Lab', ui: { label: 'GTM Lab' } })
    expect(pluginPresentation(old, 'uk').title).toContain('ринкових')
  })

  it('keeps independently edited admin title and description untouched', () => {
    const updated = entry({
      ui: { label: 'Custom Product by Admin' },
      description: 'Custom approved editorial copy.',
    })
    expect(pluginPresentation(updated, 'uk')).toEqual({
      title: 'Custom Product by Admin',
      description: 'Custom approved editorial copy.',
    })
  })

  it('does not brand other tenants or third-party plugins with familiar names', () => {
    const spoof = entry({
      name: 'remote-other-secretary',
      plugin_id: 'secretary',
      source: 'remote',
      ui: { label: 'Another publisher assistant' },
      description: 'Private developer-provided description.',
    })
    expect(pluginPresentation(spoof, 'uk')).toEqual({
      title: 'Another publisher assistant',
      description: 'Private developer-provided description.',
    })
  })

  it('uses exact previously registered VHV / RO identities only', () => {
    const vhv = entry({
      source: 'remote',
      name: 'remote-04e7c87d7b72111c-secretary',
      plugin_id: 'secretary',
      ui: { label: 'VHV — Decision Assistant' },
      description: 'Decision-aware planning of commitments, tasks and calendar slots using QDIP.',
    })
    expect(pluginPresentation(vhv, 'uk').title).toBe('VHV — планування справ і часу')
    const ro = entry({
      source: 'remote',
      name: 'remote-b5843b4aa1e11211-route-optimizer-sdk02',
      plugin_id: 'route-optimizer-sdk02',
      ui: { label: 'Route Optimizer — Candidate Routes' },
      description: 'Optimizes a bounded set of precomputed routes; no customer addresses or coordinates',
    })
    expect(pluginPresentation(ro, 'pl').description).toContain('Nie wyznacza tras')
  })

  it('distinguishes archived market research and a demo from working planners', () => {
    const gas = entry({
      name: 'gas-forecast',
      ui: { label: 'Gas Forecast — Closed R&D' },
      description:
        'Closed research plugin retained for gas-market data acquisition, normalization, experiment reproducibility, and provider research. It is not a validated commercial forecasting or procurement product.',
    })
    expect(pluginPresentation(gas, 'uk').description.toLowerCase()).toContain('архів')
    const demo = entry({
      name: 'readiness-recovery',
      ui: { label: 'Readiness Recovery' },
      description:
        'Canonical Decision Studio demo. Exercises generic plugin, capability, profile, dimension-binding and execution contracts without domain-specific frontend logic.',
    })
    expect(pluginPresentation(demo, 'uk').description).toContain('демо')
  })
})
