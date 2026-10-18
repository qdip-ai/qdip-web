import type { Locale } from '@/lib/observatory-i18n'

type Copy = { title: string; description: string; tag: string; pattern: string }
const copy: Record<Locale, Record<'decision-challenge' | 'decision-intake' | 'model-doctor', Copy>> = {
  en: {
    'decision-challenge': {
      title: 'Decision Challenge',
      description:
        'Make the decision yourself, then compare it with QDIP under the same information and economic evaluation model.',
      tag: 'INTERACTIVE',
      pattern: 'COMPARE',
    },
    'decision-intake': {
      title: 'Decision Intake',
      description:
        'Upload operational data, verify the inferred business semantics and turn the dataset into a DecisionContract for QDIP.',
      tag: 'DATA INTAKE',
      pattern: 'FRAME',
    },
    'model-doctor': {
      title: 'Model Doctor',
      description:
        'Inspect native CP-SAT models, validate solutions, diagnose conflicts and review verified repair proposals in an isolated QDIP workspace.',
      tag: 'SEPARATE WORKSPACE',
      pattern: 'DIAGNOSE',
    },
  },
  uk: {
    'decision-challenge': {
      title: 'Виклик рішень',
      description:
        'Прийміть рішення самостійно, а потім порівняйте його з QDIP за однакової інформації та моделі економічної оцінки.',
      tag: 'ІНТЕРАКТИВ',
      pattern: 'ПОРІВНЯННЯ',
    },
    'decision-intake': {
      title: 'Підготовка рішення',
      description:
        'Завантажте операційні дані, перевірте визначену семантику бізнесу та сформуйте DecisionContract для QDIP.',
      tag: 'ВХІДНІ ДАНІ',
      pattern: 'ФОРМУВАННЯ',
    },
    'model-doctor': {
      title: 'Model Doctor',
      description:
        'Перевірка нативних CP-SAT моделей, діагностика конфліктів і пропозиції виправлень з перевіреним результатом в окремому середовищі QDIP.',
      tag: 'ОКРЕМИЙ ЗАСТОСУНОК',
      pattern: 'ДІАГНОСТИКА',
    },
  },
  pl: {
    'decision-challenge': {
      title: 'Wyzwanie decyzyjne',
      description:
        'Podejmij decyzję samodzielnie, a następnie porównaj ją z QDIP przy tej samej informacji i modelu oceny ekonomicznej.',
      tag: 'INTERAKTYWNE',
      pattern: 'PORÓWNANIE',
    },
    'decision-intake': {
      title: 'Przygotowanie decyzji',
      description:
        'Prześlij dane operacyjne, zweryfikuj rozpoznaną semantykę biznesową i utwórz DecisionContract dla QDIP.',
      tag: 'DANE WEJŚCIOWE',
      pattern: 'FORMUŁOWANIE',
    },
    'model-doctor': {
      title: 'Model Doctor',
      description:
        'Sprawdzanie natywnych modeli CP-SAT, diagnozowanie konfliktów i zweryfikowane propozycje napraw w odizolowanej aplikacji QDIP.',
      tag: 'OSOBNA APLIKACJA',
      pattern: 'DIAGNOSTYKA',
    },
  },
}
export function systemApplicationCopy(locale: Locale, id: 'decision-challenge' | 'decision-intake' | 'model-doctor') {
  return copy[locale][id]
}
