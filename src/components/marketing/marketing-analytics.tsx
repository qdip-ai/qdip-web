'use client'

import Link from 'next/link'
import type { ComponentProps, MouseEvent } from 'react'
import type { MarketingLocale } from './qdip-copy'

export type FunnelEvent =
  | 'marketing_hero_observatory_click'
  | 'marketing_hero_explainer_click'
  | 'marketing_demo_click'
  | 'marketing_serviceops_page_view'
  | 'marketing_decision_intake_click'

export type MarketingFunnelPayload = {
  event: FunnelEvent
  locale: MarketingLocale
  placement: string
}

type AnalyticsWindow = Window & {
  dataLayer?: MarketingFunnelPayload[]
}

type Props = ComponentProps<typeof Link> & {
  event: FunnelEvent
  locale: MarketingLocale
  placement: string
}

export function trackMarketingFunnel(event: FunnelEvent, locale: MarketingLocale, placement: string) {
  if (typeof window === 'undefined') return
  const target = window as AnalyticsWindow
  const dataLayer = target.dataLayer ?? (target.dataLayer = [])
  dataLayer.push({ event, locale, placement })
}

export function MarketingTrackedLink({ event, locale, placement, onClick, ...props }: Props) {
  const handleClick = (click: MouseEvent<HTMLAnchorElement>) => {
    trackMarketingFunnel(event, locale, placement)
    onClick?.(click)
  }
  return <Link {...props} onClick={handleClick} />
}
