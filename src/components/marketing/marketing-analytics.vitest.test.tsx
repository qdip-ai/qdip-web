import { afterEach, describe, expect, it } from 'vitest'
import { trackMarketingFunnel, type MarketingFunnelPayload } from './marketing-analytics'

type AnalyticsWindow = Window & { dataLayer?: MarketingFunnelPayload[] }

describe('marketing funnel analytics', () => {
  afterEach(() => {
    delete (window as AnalyticsWindow).dataLayer
  })

  it('creates the dataLayer when the analytics transport has not initialized it yet', () => {
    trackMarketingFunnel('marketing_hero_observatory_click', 'uk', 'hero')

    expect((window as AnalyticsWindow).dataLayer).toEqual([
      {
        event: 'marketing_hero_observatory_click',
        locale: 'uk',
        placement: 'hero',
      },
    ])
  })

  it('records a ServiceOps page view without customer or organization information', () => {
    trackMarketingFunnel('marketing_serviceops_page_view', 'pl', 'case')
    expect((window as AnalyticsWindow).dataLayer).toEqual([
      { event: 'marketing_serviceops_page_view', locale: 'pl', placement: 'case' },
    ])
  })

  it('appends events to an existing dataLayer', () => {
    const target = window as AnalyticsWindow
    target.dataLayer = [
      {
        event: 'marketing_demo_click',
        locale: 'en',
        placement: 'demo_allocate',
      },
    ]

    trackMarketingFunnel('marketing_decision_intake_click', 'pl', 'final_cta')

    expect(target.dataLayer).toHaveLength(2)
    expect(target.dataLayer?.[1]).toEqual({
      event: 'marketing_decision_intake_click',
      locale: 'pl',
      placement: 'final_cta',
    })
  })
})
