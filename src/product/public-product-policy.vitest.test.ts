import { describe, expect, it } from 'vitest'
import { marketingCopy } from '@/components/marketing/qdip-copy'
import { observatoryHomeI18n } from '@/lib/product-i18n'
import { createTranslator } from '@/i18n/runtime'
import { DECISION_PATTERN_LABELS, PRODUCT_SURFACE_COPY } from '@/product/experience'
import { PUBLIC_DEMO_NAMES } from '@/product/public-product-policy'
import { studioCopy } from '@/studio/studio-copy'
import { DIP_USE_CASES } from '@/use-cases/registry'

function collectStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(collectStrings)
  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).flatMap(collectStrings)
  }
  return []
}

describe('public product naming policy', () => {
  it('keeps canonical English demo names and localized Observatory titles', () => {
    const expected = {
      'resource-allocation': {
        en: PUBLIC_DEMO_NAMES.resourceAllocation,
        uk: 'Розподіл ресурсів',
        pl: 'Alokacja zasobów',
      },
      'supply-network-optimization': {
        en: PUBLIC_DEMO_NAMES.supplyNetworkOptimization,
        uk: 'Оптимізація мережі постачання',
        pl: 'Optymalizacja sieci dostaw',
      },
      'contractor-allocation': {
        en: PUBLIC_DEMO_NAMES.contractorAllocation,
        uk: 'Розподіл робіт між підрядниками',
        pl: 'Przydział prac wykonawcom',
      },
      'gtm-lab': {
        en: PUBLIC_DEMO_NAMES.gtmLab,
        uk: 'Лабораторія виходу на ринок',
        pl: 'Laboratorium wejścia na rynek',
      },
    } as const

    for (const useCase of DIP_USE_CASES) {
      const titles = expected[useCase.id as keyof typeof expected]
      for (const locale of ['en', 'uk', 'pl'] as const) {
        const messages = createTranslator(locale, `useCases.${useCase.id}`)
        expect(messages('title')).toBe(titles[locale])
      }
    }
  })

  it('keeps marketing application titles canonical', () => {
    const titleIndexes = [
      [2, PUBLIC_DEMO_NAMES.resourceAllocation],
      [12, PUBLIC_DEMO_NAMES.gtmLab],
    ] as const

    for (const locale of ['en', 'uk', 'pl'] as const) {
      for (const [index, expected] of titleIndexes) {
        expect(marketingCopy[locale].cases[index]).toBe(expected)
      }
    }
  })
})

describe('localized Studio terminology policy', () => {
  const forbiddenEnglishUiTerms = [
    /\bdimensions?\b/i,
    /\bruntime\b/i,
    /\bscore\b/i,
    /\bframeworks?\b/i,
    /\bevaluators?\b/i,
    /\bbaseline\b/i,
    /\bproduction\b/i,
    /\bplugin\b/i,
    /\bapplication view\b/i,
    /\bresearch\b/i,
    /\breplay\b/i,
    /\btrace\b/i,
  ]

  for (const locale of ['uk', 'pl'] as const) {
    it(`${locale} does not mix ordinary English UI terminology into localized copy`, () => {
      const values = collectStrings(studioCopy(locale))
      const violations = values.filter((value) => forbiddenEnglishUiTerms.some((pattern) => pattern.test(value)))
      expect(violations).toEqual([])
    })
  }
})

describe('localized Observatory terminology policy', () => {
  const forbiddenEnglishUiTerms = [
    /\bpreview\b/i,
    /\boverride\b/i,
    /\btrace\b/i,
    /\bdecision applications?\b/i,
    /\bdecision demos?\b/i,
    /\bgo-to-market\b/i,
    /\ballocate\b/i,
    /\bdecide\b/i,
    /\bprioritize\b/i,
  ]

  for (const locale of ['uk', 'pl'] as const) {
    it(`${locale} does not mix ordinary English UI terminology into Observatory copy`, () => {
      const values = collectStrings([
        observatoryHomeI18n[locale],
        PRODUCT_SURFACE_COPY[locale],
        Object.values(DECISION_PATTERN_LABELS).map((labels) => labels[locale]),
        DIP_USE_CASES.map((useCase) => {
          const messages = createTranslator(locale, `useCases.${useCase.id}`)
          return {
            description: messages('description'),
            tag: messages('tag'),
          }
        }),
      ])
      const violations = values.filter((value) => forbiddenEnglishUiTerms.some((pattern) => pattern.test(value)))
      expect(violations).toEqual([])
    })
  }
})
