import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { DesignSystemProvider } from '@/design-system'
import { marketingLocaleHref, observatoryHref } from '@/lib/platform-urls'
import { serviceOpsCopy } from './serviceops/serviceops-content'
import { MarketingTrackedLink } from './marketing-analytics'
import { marketingCopy, type MarketingLocale } from './qdip-copy'
import { PUBLIC_DEMO_NAMES } from '@/product/public-product-policy'
import { DecisionInquiryForm } from './decision-inquiry-form'
import { QdipLogo } from './qdip-logo'
import { MarketingHeader } from './marketing-header'
import styles from './qdip-site.module.css'
import motionStyles from './marketing-cta-motion.module.css'
import atmosphereStyles from './marketing-atmosphere.module.css'
import burgundyStyles from './marketing-deep-burgundy.module.css'
import { MarketingTechIcon, type TechIconName } from './marketing-tech-icon'

type Copy = {
  decision: string
  context: string
  alternatives: string
  objectives: string
  effects: string
  costs: string
  risk: string
  uncertainty: string
  constraints: string
  recommendation: string
  human: string
  see: string
  describe: string
  core: string
  architecture: string
  model: string
  explain: string
  research: string
  how: readonly string[]
  useIntro: string
  flow: string
  flowBody: string
  coreIntro: string
  coreBody: string
  lifecycle: readonly string[]
  sections: readonly (readonly [string, string])[]
  subs: Record<'architecture' | 'decision-model' | 'explainability' | 'research', readonly [string, string, string]>
}
const copy: Record<MarketingLocale, Copy> = {
  en: {
    decision: 'Describe your decision',
    context: 'Context',
    alternatives: 'Alternatives',
    objectives: 'Objectives',
    effects: 'Expected effects',
    costs: 'Costs',
    risk: 'Risk',
    uncertainty: 'Uncertainty',
    constraints: 'Constraints',
    recommendation: 'Recommendation',
    human: 'Human decision',
    see: 'See QDIP in action',
    describe: 'Describe your decision',
    core: 'QDIP Core',
    architecture: 'Architecture',
    model: 'Decision model',
    explain: 'Explainability',
    research: 'Research',
    how: [
      'What is happening now and what supporting information is available?',
      'What can actually be done?',
      'What outcomes matter?',
      'What is expected under each alternative?',
      'What does each alternative require?',
      'What can go wrong and with what consequence?',
      'What do we not know confidently?',
      'What options are impossible or unacceptable?',
      'QDIP evaluates the alternatives using the configured decision model.',
    ],
    useIntro: 'Different domains. The same underlying decision structure.',
    flow: 'State → alternatives → objectives → effects → costs → risk → uncertainty → constraints',
    flowBody: 'QDIP evaluates the available alternatives and provides a recommendation with supporting evidence.',
    coreIntro: 'A runtime for explainable decision systems.',
    coreBody:
      'QDIP Core is the technical foundation behind QDIP. It evaluates explicit alternatives against decision context, rules, constraints, risk, uncertainty and available evidence, then returns an inspectable recommendation. Execution and supporting evidence remain connected without turning the decision into an opaque process.',
    lifecycle: [
      'One decision layer',
      'Stable Decision API',
      'Evidence on every run',
      'Human authority remains explicit',
    ],
    sections: [
      [
        'Decision Engine',
        'Evaluate alternatives through a consistent execution path while keeping the decision contract explicit.',
      ],
      [
        'Rules and constraints',
        'Represent business or program rules and hard limitations as part of evaluation rather than leaving them implicit.',
      ],
      [
        'Risk and uncertainty',
        'Keep risk and uncertainty visible instead of silently treating uncertain inputs as facts.',
      ],
      [
        'Decision evidence',
        'Preserve supporting information behind a recommendation so reviewers can inspect why an alternative was selected.',
      ],
      ['Execution trace', 'Keep the evaluated path inspectable for technical review, debugging and governance.'],
      [
        'Extensible decision domains',
        'Domain-specific plugins supply decision logic without redefining QDIP Core or turning each demonstration into a separate product.',
      ],
    ],
    subs: {
      architecture: [
        'Architecture',
        'Inputs / features → Decision context → Decision Engine → alternative evaluation → recommendation → evidence / trace / audit.',
        'The public architecture describes boundaries and execution flow without exposing demo-specific domain logic.',
      ],
      'decision-model': [
        'Decision model',
        'State, alternatives, objectives, expected effects, costs, risk, uncertainty, constraints and evidence form the reusable decision abstraction.',
        'The decision model is distinct from implementation architecture and individual demo logic.',
      ],
      explainability: [
        'Explainability',
        'Why was this alternative recommended?',
        'QDIP keeps supporting evidence and the evaluated decision path inspectable so a responsible person can review the recommendation. Explainability is part of decision governance, not a marketing badge.',
      ],
      research: [
        'Research',
        'Applied research into repeatable decisions under constraints and uncertainty.',
        'Public demonstrations currently include Resource Allocation, Supply Network Optimization and GTM Lab. Claims are limited to implemented demonstrations; no publication, institutional validation or customer outcome is implied.',
      ],
    },
  },
  uk: {
    decision: 'Опишіть ваше рішення',
    context: 'Контекст',
    alternatives: 'Альтернативи',
    objectives: 'Цілі',
    effects: 'Очікувані ефекти',
    costs: 'Витрати',
    risk: 'Ризик',
    uncertainty: 'Невизначеність',
    constraints: 'Обмеження',
    recommendation: 'Рекомендація',
    human: 'Рішення людини',
    see: 'Подивитися QDIP у дії',
    describe: 'Опишіть ваше рішення',
    core: 'QDIP Core',
    architecture: 'Архітектура',
    model: 'Модель рішення',
    explain: 'Пояснюваність',
    research: 'Дослідження',
    how: [
      'Що відбувається зараз і яка інформація доступна для оцінювання?',
      'Які дії реально доступні?',
      'Які результати мають значення?',
      'Які наслідки очікуються для кожної альтернативи?',
      'Яких витрат або ресурсів потребує кожна альтернатива?',
      'Що може піти не так і якими будуть наслідки?',
      'У чому ми не можемо бути достатньо впевнені?',
      'Які варіанти неможливі або неприйнятні?',
      'QDIP оцінює альтернативи відповідно до налаштованої моделі рішення.',
    ],
    useIntro: 'Різні сфери. Та сама базова структура рішення.',
    flow: 'Стан → альтернативи → цілі → ефекти → витрати → ризик → невизначеність → обмеження',
    flowBody: 'QDIP оцінює доступні альтернативи та надає рекомендацію з обґрунтуванням.',
    coreIntro: 'Середовище виконання для пояснюваних систем підтримки рішень.',
    coreBody:
      'QDIP Core — технічна основа QDIP. Він оцінює явні альтернативи з урахуванням контексту рішення, правил, обмежень, ризику, невизначеності та доступної інформації, а потім повертає рекомендацію, яку можна перевірити. Перебіг оцінювання та його обґрунтування залишаються пов’язаними, тому рішення не перетворюється на непрозорий процес.',
    lifecycle: [
      'Єдиний шар рішень',
      'Стабільний Decision API',
      'Обґрунтування кожного запуску',
      'Повноваження людини залишаються явними',
    ],
    sections: [
      [
        'Рушій прийняття рішень',
        'Оцінює альтернативи через послідовний шлях виконання зі збереженням явного контракту рішення.',
      ],
      [
        'Правила та обмеження',
        'Бізнес- або програмні правила та жорсткі обмеження є частиною оцінювання, а не прихованими припущеннями.',
      ],
      [
        'Ризик і невизначеність',
        'Ризик та невизначеність залишаються видимими в контексті рішення і не маскуються під достовірні факти.',
      ],
      [
        'Обґрунтування рішення',
        'Зберігає інформацію, на якій ґрунтується рекомендація, щоб можна було перевірити причини вибору альтернативи.',
      ],
      [
        'Трасування виконання',
        'Шлях оцінювання залишається доступним для технічної перевірки, діагностики та контролю.',
      ],
      [
        'Розширювані домени рішень',
        'Доменні модулі додають специфічну логіку без перевизначення QDIP Core і без перетворення кожного демо на окремий продукт.',
      ],
    ],
    subs: {
      architecture: [
        'Архітектура',
        'Вхідні дані / ознаки → контекст рішення → рушій прийняття рішень → оцінювання альтернатив → рекомендація → обґрунтування / трасування / аудит.',
        'Публічний опис архітектури показує межі компонентів і потік виконання без розкриття доменної логіки окремих демо.',
      ],
      'decision-model': [
        'Модель рішення',
        'Стан, альтернативи, цілі, очікувані ефекти, витрати, ризик, невизначеність, обмеження та обґрунтувальна інформація формують універсальну модель рішення.',
        'Модель рішення відокремлена від архітектури реалізації та від доменної логіки окремих демо.',
      ],
      explainability: [
        'Пояснюваність',
        'Чому була рекомендована саме ця альтернатива?',
        'QDIP зберігає обґрунтування та шлях оцінювання доступними для перевірки, щоб відповідальна людина могла переглянути рекомендацію. Пояснюваність є частиною контролю процесу прийняття рішень, а не маркетинговою характеристикою.',
      ],
      research: [
        'Дослідження',
        'Прикладні дослідження регулярних рішень за наявності обмежень і невизначеності.',
        'Публічні демонстрації наразі включають Resource Allocation, Supply Network Optimization і GTM Lab. Твердження обмежені реалізованими демонстраціями; ми не заявляємо про публікації, інституційну валідацію чи результати клієнтів.',
      ],
    },
  },
  pl: {
    decision: 'Opisz swoją decyzję',
    context: 'Kontekst',
    alternatives: 'Alternatywy',
    objectives: 'Cele',
    effects: 'Oczekiwane efekty',
    costs: 'Koszty',
    risk: 'Ryzyko',
    uncertainty: 'Niepewność',
    constraints: 'Ograniczenia',
    recommendation: 'Rekomendacja',
    human: 'Decyzja człowieka',
    see: 'Zobacz QDIP w działaniu',
    describe: 'Opisz swoją decyzję',
    core: 'QDIP Core',
    architecture: 'Architektura',
    model: 'Model decyzji',
    explain: 'Wyjaśnialność',
    research: 'Badania',
    how: [
      'Co dzieje się teraz i jakie informacje są dostępne do oceny?',
      'Jakie działania są rzeczywiście możliwe?',
      'Jakie rezultaty są istotne?',
      'Jakich skutków oczekujemy dla każdej alternatywy?',
      'Jakich kosztów lub zasobów wymaga każda alternatywa?',
      'Co może pójść nie tak i jakie będą konsekwencje?',
      'Czego nie wiemy z wystarczającą pewnością?',
      'Które opcje są niemożliwe lub nieakceptowalne?',
      'QDIP ocenia alternatywy zgodnie ze skonfigurowanym modelem decyzji.',
    ],
    useIntro: 'Różne dziedziny. Ta sama podstawowa struktura decyzji.',
    flow: 'Stan → alternatywy → cele → efekty → koszty → ryzyko → niepewność → ograniczenia',
    flowBody: 'QDIP ocenia dostępne alternatywy i przedstawia rekomendację wraz z uzasadnieniem.',
    coreIntro: 'Środowisko wykonawcze dla wyjaśnialnych systemów decyzyjnych.',
    coreBody:
      'QDIP Core jest techniczną podstawą QDIP. Ocenia jawne alternatywy w kontekście decyzji, reguł, ograniczeń, ryzyka, niepewności i dostępnych informacji, a następnie zwraca możliwą do prześledzenia rekomendację. Przebieg wykonania i uzasadnienie pozostają powiązane, dzięki czemu proces decyzyjny nie staje się nieprzejrzysty.',
    lifecycle: [
      'Jedna warstwa decyzyjna',
      'Stabilne Decision API',
      'Uzasadnienie każdego uruchomienia',
      'Rola człowieka pozostaje jawna',
    ],
    sections: [
      ['Silnik decyzyjny', 'Ocenia alternatywy w spójnej ścieżce wykonania przy zachowaniu jawnego kontraktu decyzji.'],
      [
        'Reguły i ograniczenia',
        'Reguły biznesowe lub programowe oraz twarde ograniczenia są częścią oceny, a nie ukrytymi założeniami.',
      ],
      [
        'Ryzyko i niepewność',
        'Ryzyko i niepewność pozostają widoczne w kontekście decyzji zamiast być traktowane jak pewne fakty.',
      ],
      [
        'Uzasadnienie decyzji',
        'Zachowuje informacje stojące za rekomendacją, aby można było sprawdzić, dlaczego wybrano daną alternatywę.',
      ],
      ['Ślad wykonania', 'Ścieżka oceny pozostaje dostępna do przeglądu technicznego, debugowania i nadzoru.'],
      [
        'Rozszerzalne domeny decyzyjne',
        'Moduły domenowe dostarczają specyficzną logikę bez redefiniowania QDIP Core i bez przekształcania każdego demo w osobny produkt.',
      ],
    ],
    subs: {
      architecture: [
        'Architektura',
        'Dane wejściowe / cechy → kontekst decyzji → silnik decyzyjny → ocena alternatyw → rekomendacja → uzasadnienie / ślad / audyt.',
        'Publiczny opis architektury pokazuje granice komponentów i przepływ wykonania bez ujawniania logiki domenowej poszczególnych demonstracji.',
      ],
      'decision-model': [
        'Model decyzji',
        'Stan, alternatywy, cele, oczekiwane efekty, koszty, ryzyko, niepewność, ograniczenia i uzasadnienie tworzą uniwersalną abstrakcję decyzji.',
        'Model decyzji jest oddzielony od architektury implementacji i logiki poszczególnych demonstracji.',
      ],
      explainability: [
        'Wyjaśnialność',
        'Dlaczego rekomendowano właśnie tę alternatywę?',
        'QDIP zachowuje uzasadnienie i ścieżkę oceny do wglądu, aby odpowiedzialna osoba mogła zweryfikować rekomendację. Wyjaśnialność jest elementem nadzoru nad decyzją, a nie etykietą marketingową.',
      ],
      research: [
        'Badania',
        'Badania stosowane nad powtarzalnymi decyzjami przy ograniczeniach i niepewności.',
        'Publiczne demonstracje obejmują obecnie Resource Allocation, Supply Network Optimization i GTM Lab. Twierdzenia ograniczają się do zaimplementowanych demonstracji; nie deklarujemy publikacji, walidacji instytucjonalnej ani wyników klientów.',
      ],
    },
  },
}
const supplyCaseCopy = {
  en: {
    pattern: 'ALLOCATE',
    question:
      'Where should inventory be stored, how should demand be fulfilled, and how should the network adapt when capacity changes?',
    body: 'Optimize inventory placement, inbound allocation and store fulfillment, then recalculate the network when a warehouse becomes unavailable or a candidate is added.',
    cta: 'Open Supply Network Optimization',
  },
  uk: {
    pattern: 'РОЗПОДІЛИТИ',
    question:
      'Де зберігати запаси, як покривати попит і як перебудовувати мережу при зміні доступної складської потужності?',
    body: 'Оптимізуйте розміщення запасів, вхідні поставки та постачання точок попиту, а потім перераховуйте мережу при недоступності або додаванні складу.',
    cta: 'Відкрити Supply Network Optimization',
  },
  pl: {
    pattern: 'ALOKUJ',
    question:
      'Gdzie przechowywać zapasy, jak obsługiwać popyt i jak przebudować sieć po zmianie dostępnej przepustowości magazynowej?',
    body: 'Optymalizuj rozmieszczenie zapasów, dostawy przychodzące i obsługę punktów popytu, a następnie przeliczaj sieć po niedostępności lub dodaniu magazynu.',
    cta: 'Otwórz Supply Network Optimization',
  },
} as const

const href = (l: MarketingLocale, path: string) => `${marketingLocaleHref(l)}/${path}`
function Shell({ locale, slug, children }: { locale: MarketingLocale; slug: string; children: React.ReactNode }) {
  const x = copy[locale]
  return (
    <DesignSystemProvider
      theme="burgundy"
      mode="dark"
      className={`${styles.site} ${atmosphereStyles.atmosphere} ${burgundyStyles.theme}`}
    >
      <main id="main-content" lang={locale}>
        <MarketingHeader locale={locale} currentPath={slug} />
        {children}
        <footer className={styles.footer}>
          <Link className={styles.logo} href={marketingLocaleHref(locale)} aria-label="QDIP home">
            <QdipLogo className={styles.logoWordmark} />
          </Link>
          <nav aria-label="Footer">
            <Link href={href(locale, 'how-it-works')}>{marketingCopy[locale].nav[0]}</Link>
            <Link href={href(locale, 'use-cases')}>{marketingCopy[locale].nav[1]}</Link>
            <Link href={href(locale, 'core')}>QDIP Core</Link>
            <Link href={href(locale, 'core/research')}>{x.research}</Link>
          </nav>
          <span>© {new Date().getFullYear()} QDIP</span>
        </footer>
      </main>
    </DesignSystemProvider>
  )
}
function PageHero({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionIntro}>
        <div className={styles.eyebrow}>{eyebrow}</div>
        <h1>{title}</h1>
        <p className={styles.centerCopy}>{body}</p>
      </div>
    </section>
  )
}
function InlineHeading({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <div className={styles.sectionIntro}>
      <div className={styles.eyebrow}>{eyebrow}</div>
      <h2>{title}</h2>
      <p className={styles.centerCopy}>{body}</p>
    </div>
  )
}
function CoreNav({ l }: { l: MarketingLocale }) {
  const x = copy[l]
  return (
    <div className={styles.centerAction}>
      <Link className={`${styles.secondaryButton} ${motionStyles.secondary}`} href={href(l, 'core/architecture')}>
        {x.architecture}
      </Link>
      <Link className={`${styles.secondaryButton} ${motionStyles.secondary}`} href={href(l, 'core/decision-model')}>
        {x.model}
      </Link>
      <Link className={`${styles.secondaryButton} ${motionStyles.secondary}`} href={href(l, 'core/explainability')}>
        {x.explain}
      </Link>
      <Link className={`${styles.secondaryButton} ${motionStyles.secondary}`} href={href(l, 'core/research')}>
        {x.research}
      </Link>
    </div>
  )
}
const decisionStepIcons: readonly TechIconName[] = [
  'modeling',
  'simulation',
  'optimization',
  'comparison',
  'allocation',
  'policy',
  'explainability',
  'constraints',
  'human-approval',
]
const coreSectionIcons: readonly TechIconName[] = [
  'modeling',
  'constraints',
  'simulation',
  'evidence',
  'audit',
  'workflow',
]

export function PublicPage({ locale, slug }: { locale: MarketingLocale; slug: string }) {
  const x = copy[locale],
    c = marketingCopy[locale]
  if (slug === 'how-it-works')
    return (
      <Shell locale={locale} slug={slug}>
        <PageHero eyebrow={c.nav[0]} title={c.hero[1]} body={c.hero[3]} />
        <section className={styles.section}>
          <div className={styles.valueGrid}>
            {[
              x.context,
              x.alternatives,
              x.objectives,
              x.effects,
              x.costs,
              x.risk,
              x.uncertainty,
              x.constraints,
              x.recommendation,
            ].map((label, i) => (
              <article key={label}>
                <MarketingTechIcon name={decisionStepIcons[i] ?? 'modeling'} className={styles.techFeatureIcon} />
                <span>0{i + 1}</span>
                <h3>{label}</h3>
                <p>{x.how[i]}</p>
              </article>
            ))}
          </div>
          <div className={styles.centerAction}>
            <Link className={`${styles.primaryButtonLarge} ${motionStyles.primary}`} href={href(locale, 'use-cases')}>
              {x.see} <ArrowRight size={15} />
            </Link>
          </div>
        </section>
      </Shell>
    )
  if (slug === 'use-cases')
    return (
      <Shell locale={locale} slug={slug}>
        <PageHero eyebrow={c.nav[1]} title={c.cases[0]} body={x.useIntro} />
        <section className={styles.section} id="demos">
          <div className={styles.caseGrid}>
            <article className={styles.featuredCase}>
              <MarketingTechIcon name="allocation" className={styles.techFeatureIcon} />
              <span>{c.cases[1]}</span>
              <h3>{c.cases[2]}</h3>
              <strong>{c.cases[3]}</strong>
              <p>{c.cases[4]}</p>
              <Link href={observatoryHref('resource-allocation', locale)}>
                {c.cases[5]} <ArrowRight size={15} />
              </Link>
            </article>
            <article>
              <MarketingTechIcon name="workflow" className={styles.techFeatureIcon} />
              <span>{supplyCaseCopy[locale].pattern}</span>
              <h3>{PUBLIC_DEMO_NAMES.supplyNetworkOptimization}</h3>
              <strong>{supplyCaseCopy[locale].question}</strong>
              <p>{supplyCaseCopy[locale].body}</p>
              <Link
                aria-label="Open Supply Network Optimization"
                href={observatoryHref('supply-network-optimization', locale)}
              >
                {supplyCaseCopy[locale].cta} <ArrowRight size={15} />
              </Link>
            </article>
            <article>
              <MarketingTechIcon name="comparison" className={styles.techFeatureIcon} />
              <span>{c.cases[6]}</span>
              <h3>{c.cases[7]}</h3>
              <strong>{c.cases[8]}</strong>
              <p>{c.cases[9]}</p>
              <Link href={href(locale, 'decision')}>
                {c.cases[10]} <ArrowRight size={15} />
              </Link>
            </article>
            <article>
              <MarketingTechIcon name="optimization" className={styles.techFeatureIcon} />
              <span>{c.cases[11]}</span>
              <h3>{c.cases[12]}</h3>
              <strong>{c.cases[13]}</strong>
              <p className={styles.comingSoon}>{c.cases[14]}</p>
            </article>
          </div>
          <article className={styles.ecosystemCard} id="serviceops">
            <span className={styles.ecosystemCategory}>{serviceOpsCopy[locale].eyebrow}</span>
            <h3>ServiceOps</h3>
            <p>{serviceOpsCopy[locale].summary}</p>
            <p>{serviceOpsCopy[locale].demosDescription}</p>
            <div className={styles.ecosystemActions}>
              <MarketingTrackedLink event="marketing_demo_click" locale={locale} placement="serviceops_usecases_case"
                href={href(locale, 'serviceops')}>
                {serviceOpsCopy[locale].guideLink} <ArrowRight size={15} />
              </MarketingTrackedLink>
            </div>
          </article>
          <div className={styles.embeddedSection}>
            <InlineHeading eyebrow="QDIP" title={x.flow} body={x.flowBody} />
            <div className={styles.centerAction}>
              <Link className={`${styles.primaryButtonLarge} ${motionStyles.primary}`} href={href(locale, 'decision')}>
                {x.describe}
              </Link>
            </div>
          </div>
        </section>
      </Shell>
    )
  if (slug === 'decision')
    return (
      <Shell locale={locale} slug={slug}>
        <div className={styles.decisionInquiry}>
          <PageHero eyebrow="QDIP" title={c.conversion[0]} body={c.conversion[1]} />
          <section className={`${styles.section} ${styles.decisionFormSection}`}>
            <DecisionInquiryForm locale={locale} />
          </section>
        </div>
      </Shell>
    )
  if (slug === 'core')
    return (
      <Shell locale={locale} slug={slug}>
        <PageHero eyebrow={x.core} title="QDIP Core" body={x.coreIntro} />
        <section className={styles.section}>
          <p className={styles.coreLead}>{x.coreBody}</p>
          <div className={styles.coreProof}>
            {x.lifecycle.map((v) => (
              <span key={v}>{v}</span>
            ))}
          </div>
          <div className={styles.valueGrid}>
            {x.sections.map(([title, body], i) => (
              <article key={title}>
                <MarketingTechIcon name={coreSectionIcons[i] ?? 'modeling'} className={styles.techFeatureIcon} />
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
          <CoreNav l={locale} />
        </section>
      </Shell>
    )
  if (slug.startsWith('core/')) {
    const sub = slug.slice(5) as keyof Copy['subs'],
      content = x.subs[sub]
    if (content)
      return (
        <Shell locale={locale} slug={slug}>
          <PageHero eyebrow={x.core} title={content[0]} body={content[1]} />
          <section className={styles.section}>
            <p className={styles.coreLead}>{content[2]}</p>
            <CoreNav l={locale} />
          </section>
        </Shell>
      )
  }
  return null
}
