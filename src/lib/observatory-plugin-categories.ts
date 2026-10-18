import type { Locale } from '@/lib/observatory-i18n'

const labels: Record<string, Record<Locale, string>> = {
  Operations: { uk: 'Операційні процеси', en: 'Operations', pl: 'Operacje' },
  Optimization: { uk: 'Оптимізація', en: 'Optimization', pl: 'Optymalizacja' },
  Analytics: { uk: 'Аналітика', en: 'Analytics', pl: 'Analityka' },
  'Decision support': { uk: 'Підтримка рішень', en: 'Decision support', pl: 'Wsparcie decyzji' },
  Productivity: { uk: 'Продуктивність', en: 'Productivity', pl: 'Produktywność' },
  Other: { uk: 'Інше', en: 'Other', pl: 'Inne' },
}

/** Display only: never mutate the canonical SDK/catalog category sent to Core. */
export function pluginCategoryLabel(category: string | null | undefined, locale: Locale): string {
  const value = category?.trim() || ''
  return value ? (labels[value]?.[locale] ?? value) : '—'
}
