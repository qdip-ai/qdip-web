import type { MetadataRoute } from 'next'
import { QDIP_DEFAULT_LOCALE, QDIP_LOCALES, qdipLocaleUrl } from './seo-copy'
const pages = [
  '',
  'how-it-works',
  'sdk',
  'use-cases',
  'serviceops',
  'serviceops/guide',
  'decision',
  'core',
  'core/architecture',
  'core/decision-model',
  'core/explainability',
  'core/research',
] as const
export default function sitemap(): MetadataRoute.Sitemap {
  return QDIP_LOCALES.flatMap((locale) =>
    pages.map((page) => ({
      url: qdipLocaleUrl(locale, page),
      changeFrequency: page.startsWith('core') ? 'monthly' : ('weekly' as const),
      priority: page === '' ? 1 : page === 'decision' ? 0.9 : 0.8,
      alternates: {
        languages: {
          ...Object.fromEntries(QDIP_LOCALES.map((l) => [l, qdipLocaleUrl(l, page)])),
          'x-default': qdipLocaleUrl(QDIP_DEFAULT_LOCALE, page),
        },
      },
    }))
  )
}
