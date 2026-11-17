import type { Locale } from './config'

type UseCaseCatalogEntry = {
  title: string
  description: string
  tag: string
}

export const USE_CASE_MESSAGE_ADDITIONS: Record<Locale, Record<string, UseCaseCatalogEntry>> = {
  en: {
    'contractor-allocation': {
      title: 'Contractor Allocation',
      description:
        'Non-discretionary contractor assignment from approved scope, contracts, rates and capacity, optimized for portfolio cost.',
      tag: 'COST CONTROL',
    },
  },
  uk: {
    'contractor-allocation': {
      title: 'Розподіл робіт між підрядниками',
      description:
        'Недискреційний вибір підрядника за затвердженим обсягом робіт, договорами, ставками та доступною потужністю з оптимізацією сукупних витрат.',
      tag: 'КОНТРОЛЬ ВИТРАТ',
    },
  },
  pl: {
    'contractor-allocation': {
      title: 'Przydział prac wykonawcom',
      description:
        'Niedyskrecjonalny wybór wykonawcy na podstawie zatwierdzonego zakresu, umów, stawek i dostępnej mocy z optymalizacją łącznego kosztu.',
      tag: 'KONTROLA KOSZTÓW',
    },
  },
}
