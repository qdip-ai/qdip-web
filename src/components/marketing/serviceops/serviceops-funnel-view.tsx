'use client'

import { useEffect, useRef } from 'react'
import type { MarketingLocale } from '../qdip-copy'
import { trackMarketingFunnel } from '../marketing-analytics'

/** Page-view denominator for the ServiceOps funnel. Emits only stable non-PII values. */
export function ServiceOpsFunnelView({ locale, page }: { locale: MarketingLocale; page: 'case' | 'guide' }) {
  const previous = useRef('')
  useEffect(() => {
    const key = locale + ':' + page
    if (previous.current === key) return
    previous.current = key
    trackMarketingFunnel('marketing_serviceops_page_view', locale, page)
  }, [locale, page])
  return null
}
