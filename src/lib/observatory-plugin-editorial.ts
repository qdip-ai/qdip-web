import type { PluginCatalogEntry } from '@qdip/client'
import type { Locale } from '@/lib/observatory-i18n'

type Presentation = { title: string; description: string }
type ProductCopy = {
  uk: Presentation
  pl: Presentation
  /** Exact default English titles, including previously deployed titles. */
  englishLabels: readonly string[]
  /** Exact default descriptions; never translate custom admin-edited text. */
  englishDescriptions: readonly string[]
}

const COPY: Record<string, ProductCopy> = {
  'futures-mispricing': {
    uk: {
      title: 'Аналіз ф’ючерсів і сигналів хеджування',
      description:
        'Досліджує ціни ф’ючерсів, оцінку справедливої вартості та невизначеність. Експериментальні сигнали для досліджень, а не перевірений прогноз чи інвестиційна порада.',
    },
    pl: {
      title: 'Analiza wyceny kontraktów futures',
      description:
        'Porównuje ceny kontraktów z szacowanym zakresem wartości i ocenia niepewność oraz moment zabezpieczenia. Sygnały badawcze, a nie sprawdzona prognoza ani porada inwestycyjna.',
    },
    englishLabels: ['Futures Mispricing — Research Signals', 'futures-mispricing'],
    englishDescriptions: [
      'Futures mispricing detection and hedge-timing decision plugin. Implements a deterministic robust/minimax baseline for forward-curve analysis. Research-grade and client-independent.',
      'Research tool for comparing futures prices with an estimated fair-value range, quantifying uncertainty and exploring potential hedge timing. Its signals are experimental, not investment advice or a verified forecast.',
    ],
  },
  'gas-forecast': {
    uk: {
      title: 'Дослідження газового ринку — архів',
      description:
        'Архів експериментів із даними цін на газ, запасів та прогнозування. Не є активним або перевіреним сервісом рекомендацій із закупівель.',
    },
    pl: {
      title: 'Badania rynku gazu — archiwum',
      description:
        'Archiwum eksperymentów dotyczących cen gazu, zapasów i prognozowania. Nie jest aktywną ani zweryfikowaną usługą rekomendacji zakupowych.',
    },
    englishLabels: ['Gas Market Research — Archived Experiments', 'Gas Forecast — Closed R&D', 'gas-forecast'],
    englishDescriptions: [
      'Closed research plugin retained for gas-market data acquisition, normalization, experiment reproducibility, and provider research. It is not a validated commercial forecasting or procurement product.',
      'Archived gas-market research for collecting and normalizing market and storage data, checking providers and reproducing forecasting experiments. This is not an active or validated procurement recommendation service.',
    ],
  },
  'gtm-lab': {
    uk: {
      title: 'GTM Lab — оцінка ринкових можливостей',
      description:
        'Аналізує бізнес-можливості на основі доказів, рівня невизначеності й дослідницьких пріоритетів. Формує попередній план звернення, але не надсилає його автоматично.',
    },
    pl: {
      title: 'GTM Lab — ocena możliwości rynkowych',
      description:
        'Analizuje szanse biznesowe na podstawie dowodów, niepewności i priorytetów badawczych. Przygotowuje szkic kontaktu bez automatycznej wysyłki.',
    },
    englishLabels: ['GTM Lab — Market Opportunity Assessment', 'GTM Lab', 'gtm-lab'],
    englishDescriptions: [
      'Evidence-driven GTM funnel: prospect evidence, opportunity decisions, uncertainty, research objectives and outreach preview.',
      'Assesses sales opportunities with supporting evidence, uncertainty, research priorities and an outreach preview. Provides a demonstration and decision support; it does not send outreach automatically.',
    ],
  },
  'readiness-recovery': {
    uk: {
      title: 'Відновлення готовності — демонстрація',
      description:
        'Показує, як умовні дії відновлення змінюють готовність, ризик, невизначеність і витрати. Це демо Decision Studio, а не оперативний планувальник ремонту.',
    },
    pl: {
      title: 'Odtwarzanie gotowości — demonstracja',
      description:
        'Pokazuje, jak działania naprawcze wpływają na gotowość, ryzyko, niepewność i koszt. To demo Decision Studio, nie operacyjny harmonogram napraw.',
    },
    englishLabels: ['Readiness Recovery — Studio Demonstration', 'Readiness Recovery', 'readiness-recovery'],
    englishDescriptions: [
      'Canonical Decision Studio demo. Exercises generic plugin, capability, profile, dimension-binding and execution contracts without domain-specific frontend logic.',
      'Reference demonstration of how recovery actions change readiness, risk, uncertainty and cost. This Studio example is distinct from the authenticated repair scheduling and recovery application.',
    ],
  },
  'resource-allocation': {
    uk: {
      title: 'Гуманітарний розподіл ресурсів',
      description:
        'Допомагає планувати розподіл команд і ресурсів між громадами, порівнювати сценарії та знаходити дефіцит спроможностей. Не запускає польові операції автоматично.',
    },
    pl: {
      title: 'Planowanie zasobów humanitarnych',
      description:
        'Pomaga przydzielać zespoły i zasoby społecznościom, porównywać scenariusze i wykrywać braki potencjału. Nie uruchamia działań terenowych automatycznie.',
    },
    englishLabels: ['Resource Allocation — Humanitarian Planning', 'resource-allocation'],
    englishDescriptions: [
      'Multi-period humanitarian resource allocation, scenario evaluation and decision intelligence.',
      'Helps plan allocation of limited teams and resources across communities and time periods, compare scenarios and identify capacity shortfalls. Results are planning support, not automatic field deployment.',
    ],
  },
  secretary: {
    uk: {
      title: 'VHV — планування справ і часу',
      description:
        'Допомагає складати плани справ і зобов’язань з урахуванням часу. Виконання дій та оновлення календаря потребують окремого підтвердження в VHV.',
    },
    pl: {
      title: 'VHV — planowanie zadań i czasu',
      description:
        'Pomaga planować zadania i zobowiązania w czasie. Wykonywanie działań i zmiany w kalendarzu wymagają osobnego potwierdzenia w VHV.',
    },
    englishLabels: ['VHV — Decision Assistant', 'VHV — Task & Time Planning', 'secretary'],
    englishDescriptions: [
      'Decision-aware planning of commitments, tasks and calendar slots using QDIP.',
      'Turns a task or scheduling request into a bounded plan; execution and calendar changes require confirmation in VHV.',
    ],
  },
}

/** Only explicitly known first-party identities receive editorial translations.
 * Arbitrary third-party SDK plugins always retain the publisher's own copy.
 */
const LEGACY_IDENTITIES = new Set([
  'futures-mispricing',
  'gas-forecast',
  'gtm-lab',
  'readiness-recovery',
  'resource-allocation',
])
const VERIFIED_REMOTE_IDENTITIES = new Map<string, string>([
  ['remote-04e7c87d7b72111c-secretary', 'secretary'],
  ['remote-3b25f5ae494aa7bf-secretary', 'secretary'],
])

export function pluginPresentation(
  plugin: Pick<PluginCatalogEntry, 'name' | 'description' | 'ui' | 'plugin_id' | 'source'>,
  locale: Locale
): Presentation {
  const originalTitle = plugin.ui?.label || plugin.name
  const originalDescription = plugin.description || ''
  if (locale === 'en') return { title: originalTitle, description: originalDescription }

  const identity =
    plugin.source === 'embedded' && LEGACY_IDENTITIES.has(plugin.name)
      ? plugin.name
      : plugin.source === 'embedded' && plugin.name === 'GTM Lab'
        ? 'gtm-lab' // Before the stable technical name normalization is deployed.
        : plugin.source === 'remote' && VERIFIED_REMOTE_IDENTITIES.get(plugin.name) === plugin.plugin_id
          ? plugin.plugin_id
          : null
  const catalog = identity ? COPY[identity] : undefined
  if (!catalog) return { title: originalTitle, description: originalDescription }

  // Administrative edits win over editorial defaults. Do not overwrite custom
  // names/descriptions or guess based on similar-looking third-party plugin IDs.
  const translated = catalog[locale]
  return {
    title: catalog.englishLabels.includes(originalTitle) ? translated.title : originalTitle,
    description:
      !originalDescription || catalog.englishDescriptions.includes(originalDescription)
        ? translated.description
        : originalDescription,
  }
}
