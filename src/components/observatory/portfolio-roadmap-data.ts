export type PortfolioStatus = 'active' | 'gated' | 'blocked' | 'research' | 'paused' | 'closed'

export type PortfolioProject = {
  id: string
  title: string
  group: string
  status: PortfolioStatus
  stage: string
  next: string
  source: string
  dependencies: string[]
  steps: readonly [string, string, string]
}

export const PORTFOLIO_VERIFIED_AT = '2026-10-27'

/**
 * Editorial, dated snapshot of the canonical GitHub roadmaps.
 * This does not infer release qualification from commits, issue closure or a deploy.
 * Refresh only after reviewing the linked primary source / actual E2E evidence.
 */
export const portfolioProjects: PortfolioProject[] = [
  {
    id: 'sdk', title: 'QDIP Core / SDK', group: 'Платформа', status: 'active',
    stage: 'Безпека інтеграцій та SDK release gate',
    next: 'Реалізувати application identity, resource ownership, user grants; незалежні negative E2E.',
    source: 'https://github.com/qdip-ai/qdip-core/issues/555',
    dependencies: [],
    steps: ['SDK-01/02/03 створені', 'App identity + delegated permissions — у розробці', 'Security/E2E release gate — попереду']
  },
  {
    id: 'worker', title: 'SDK Worker security', group: 'Платформа', status: 'blocked',
    stage: 'Admit/revoke + verified artifact',
    next: 'Закрити #399, #400 та audit minimization PR #554; перевірити revoke і ізоляцію.',
    source: 'https://github.com/qdip-ai/qdip-core/issues/400',
    dependencies: ['sdk'],
    steps: ['Базові scopes / keys', 'Підпис артефакту та lifecycle — не прийняті', 'Third-party admission — заблоковано']
  },
  {
    id: 'provision', title: 'SDK Credential Provisioning', group: 'Платформа', status: 'active',
    stage: 'Автономна видача ключів + доставка',
    next: 'Довести issuance → Railway delivery → Worker REGISTER → rotate/revoke E2E.',
    source: 'https://github.com/qdip-ai/qdip-core/issues/383',
    dependencies: ['sdk'],
    steps: ['Базовий ключовий контракт', 'Автономна доставка / кваліфікація — в роботі', 'Production ротація — не прийнята']
  },
  {
    id: 'yara', title: 'Yara App', group: 'Персональні продукти', status: 'gated',
    stage: 'Production user acceptance',
    next: 'Перевірити реальні Zitadel/Google акаунти, calendar readback/write і iPhone Safari E2E.',
    source: 'https://github.com/qdip-ai/qdip-personal-secretary/issues/126',
    dependencies: ['sdk'],
    steps: ['PWA / API / worker розгорнуті', 'Real-account QA — не завершено', 'Повне release acceptance — очікує']
  },
  {
    id: 'voice', title: 'Yara Voice + AI', group: 'Персональні продукти', status: 'active',
    stage: 'Якість українського голосу + діалог',
    next: 'Перевірити український ASR, голосовий intent та дії після підтвердження.',
    source: 'https://github.com/qdip-ai/qdip-personal-secretary/blob/dev/docs/YARA_VOICE_ROADMAP.md',
    dependencies: ['yara'],
    steps: ['Whisper / voice pipeline реалізовано', 'UA ASR + end-to-end UX — в роботі', 'Повний user QA — очікує']
  },
  {
    id: 'dzvin', title: 'Dzvin.co B2C', group: 'Персональні продукти', status: 'active',
    stage: 'Корисний щоденний B2C-цикл',
    next: 'Завершити check-in → дію → фідбек → прогрес, потім auth/privacy E2E.',
    source: 'https://github.com/mentality-prj/mentality-web/issues/482',
    dependencies: [],
    steps: ['My Day / mood / diary / Guide в коді', 'Корисний цикл і QA — в роботі', 'Production acceptance — відкритий']
  },
  {
    id: 'dzvin-b2b', title: 'Dzvin B2B + R&D', group: 'Персональні продукти', status: 'gated',
    stage: 'B2B / R&D lead pipeline і доступ',
    next: 'Backend build, Mongo index, реальні intake E2E; окремо перевірити company roles.',
    source: 'https://github.com/mentality-prj/mentality-web/issues/445',
    dependencies: ['dzvin'],
    steps: ['Web форми / пропозиція у draft', 'Backend / authorization QA — відкриті', 'Production запуск — gated']
  },
  {
    id: 'bridge', title: 'Yara ⇄ Dzvin.co', group: 'Міжпродуктові інтеграції', status: 'blocked',
    stage: 'Чекає безпечного SDK data access',
    next: 'Після #555/#399/#400/#554: calendar → Dzvin feedback; потім derived preferences → Yara.',
    source: 'https://github.com/qdip-ai/qdip-personal-secretary/issues/99',
    dependencies: ['sdk', 'worker', 'yara', 'dzvin'],
    steps: ['Product contract узгоджений', 'User grants + sensitive data E2E — відсутні', 'Двосторонній обмін — ЗАБЛОКОВАНО']
  },
  {
    id: 'rr', title: 'Readiness Recovery', group: 'Операційні продукти', status: 'gated',
    stage: 'Real Zitadel operator / production acceptance',
    next: 'Вирішити org-key boundary та завершити live production operator E2E.',
    source: 'https://github.com/qdip-ai/qdip-core/issues/274',
    dependencies: ['sdk'],
    steps: ['11/11 synthetic-session E2E PASS', 'Live organization-scoped QA — відкритий', 'Production qualification — не пройдено']
  },
  {
    id: 'rr-sdk', title: 'RR → SDK Worker', group: 'Міжпродуктові інтеграції', status: 'active',
    stage: 'Migration + parity',
    next: 'Незалежний Worker REGISTER, caller E2E, parity; лише потім cutover з Core.',
    source: 'https://github.com/qdip-ai/qdip-core/issues/453',
    dependencies: ['sdk', 'provision', 'rr'],
    steps: ['Поточний RR у Core', 'Worker/caller E2E — у роботі', 'Вимкнення legacy — попереду']
  },
  {
    id: 'ro', title: 'Route Optimizer → SDK', group: 'Операційні продукти', status: 'gated',
    stage: 'SDK-02 Worker qualification',
    next: 'Автономний Worker key → REGISTER → manifest/replay → negative E2E.',
    source: 'https://github.com/qdip-ai/qdip-core/issues/418',
    dependencies: ['sdk', 'provision'],
    steps: ['SDK Worker-код merged', 'Реєстрація / live E2E — не пройдені', 'Безпечний cutover — попереду']
  },
  {
    id: 'cats', title: 'Котячий Картель', group: 'Операційні продукти', status: 'active',
    stage: 'Ігровий UX + real RO adapter',
    next: 'Робити карту/UX паралельно; окремо підключити private RO relay і порівнянний baseline.',
    source: 'https://github.com/qdip-ai/ro-cat-cartel/issues/3',
    dependencies: ['ro'],
    steps: ['Ігровий vertical slice є', 'Карта й UX — активно; real RO relay — gated', 'Production solver evidence — попереду']
  },
  {
    id: 'fe', title: 'Future Engine v1', group: 'R&D та прогнозування', status: 'gated',
    stage: 'Deployed; authenticated E2E / replay open',
    next: 'Tenant-positive forecast → SEALED → artifact replay і Mongo restart recovery.',
    source: 'https://github.com/qdip-ai/qdip-core/issues/275',
    dependencies: [],
    steps: ['FE v1 merged / deployed', 'Live authenticated E2E — відкрито', 'Повне release acceptance — попереду']
  },
  {
    id: 'economic', title: 'FE-04 + RR Economics', group: 'R&D та прогнозування', status: 'gated',
    stage: 'Польова економічна доказовість',
    next: 'Tenant E2E та реальні дані споживання/постачання для порівняння з baseline.',
    source: 'https://github.com/qdip-ai/qdip-core/issues/491',
    dependencies: ['rr', 'fe'],
    steps: ['FE-04 merged / deployed', 'Польовий датасет / економічний benchmark — відсутні', 'Доведена економія — не підтверджена']
  },
  {
    id: 'doctor', title: 'Model Doctor', group: 'Інструменти', status: 'gated',
    stage: 'Product live; independent security / MCP',
    next: 'Незалежний security review, реальний ChatGPT OAuth → MCP tools/list / tools/call.',
    source: 'https://github.com/qdip-ai/qdip-model-doctor/issues/24',
    dependencies: [],
    steps: ['Browser / solver E2E PASS', 'Security sign-off + external MCP — відкрито', 'External release qualification — попереду']
  },
  {
    id: 'autodev', title: 'AutoDev / Mission Control', group: 'Інструменти', status: 'blocked',
    stage: 'Перший наскрізний one-click run',
    next: 'Issue #388 → durable Copilot result → independent verifier → Draft PR; жодного mock PASS.',
    source: 'https://github.com/qdip-ai/qdip-core/issues/354',
    dependencies: [],
    steps: ['Controller + PWA база є', 'Durable AI result / verifier — BLOCKED', 'Реальний Draft PR — не отримано']
  },
  {
    id: 'observatory', title: 'QDIP Studio / Observatory', group: 'Інструменти', status: 'active',
    stage: 'Developer UX + admin authorization',
    next: 'Виправити RR org-key operator path; third-party каталог вмикати лише після #399/#400.',
    source: 'https://github.com/qdip-ai/qdip-web/issues/296',
    dependencies: ['sdk'],
    steps: ['Основний сайт / Studio / Observatory', 'RR auth + plugin каталог — в роботі', 'Повне third-party publish — gated']
  },
  {
    id: 'e2e', title: 'QDIP E2E', group: 'Інструменти', status: 'active',
    stage: 'Independent acceptance',
    next: 'Додати 2-user/3-app same-org negative authorization E2E та реальні provider перевірки.',
    source: 'https://github.com/qdip-ai/qdip-e2e',
    dependencies: ['sdk'],
    steps: ['Незалежні синтетичні тести є', 'Реальні app/user security кейси — в роботі', 'Release evidence ще не повне']
  },
  {
    id: 'psycho', title: 'Psychohistory', group: 'R&D та прогнозування', status: 'research',
    stage: 'Пошук фальсифікованих механізмів',
    next: 'Нові preregistered гіпотези та чесні independent validation дані без test leakage.',
    source: 'https://github.com/qdip-ai/qdip-core/issues/448',
    dependencies: ['fe'],
    steps: ['PH-R01/R02/R03 досліджені', 'Нові моделі / незалежні тести — research', 'Доведена перевага — відсутня']
  },
  {
    id: 'gf2', title: 'GF2', group: 'R&D та прогнозування', status: 'paused',
    stage: 'P3 — відкладено',
    next: 'Після FE release gate оцінити міграцію #255 та PIT readiness.',
    source: 'https://github.com/qdip-ai/qdip-core/issues/255',
    dependencies: ['fe'],
    steps: ['Legacy дослідження збережені', 'Пріоритет P3 — ПАУЗА', 'FE migration — не запущена']
  },
  {
    id: 'gas', title: 'Gas Forecast (legacy)', group: 'R&D та прогнозування', status: 'closed',
    stage: 'KILL / archived',
    next: 'Зберегти негативні результати та reproducibility; не відновлювати без нової гіпотези.',
    source: 'https://github.com/qdip-ai/qdip-core/blob/dev/docs/research/gas-forecast-closure-2026-09-23.md',
    dependencies: [],
    steps: ['Дослідження завершено', 'Вердикт KILL 23.09.2026', 'Комерційний розвиток зупинено']
  },
  {
    id: 'translator', title: 'Translator UA → PL', group: 'Інструменти', status: 'paused',
    stage: 'Підтримка',
    next: 'Не розширювати до появи виміряної потреби в додаткових мовах.',
    source: 'https://github.com/mentality-prj/mentality-translator',
    dependencies: [],
    steps: ['Базовий сервіс існує', 'Підтримка — без активної roadmap-стадії', 'Нові можливості — не пріоритет']
  },
  {
    id: 'docs', title: 'QDIP Docs / Grants', group: 'Інструменти', status: 'active',
    stage: 'Докази, гранти, інвесторські матеріали',
    next: 'Підтримувати перевірені evidence / TRL / grants, без недоведених performance claims.',
    source: 'https://github.com/qdip-ai/qdip-docs/blob/main/docs/portfolio-dependency-roadmap.md',
    dependencies: ['sdk'],
    steps: ['Документація й evidence pack є', 'Докази актуалізуються', 'Зовнішня кваліфікація триває']
  }
]

export const statusLabels: Record<PortfolioStatus, string> = {
  active: 'В розробці',
  gated: 'Очікує приймання',
  blocked: 'Заблоковано',
  research: 'Дослідження',
  paused: 'На паузі',
  closed: 'Завершено / KILL'
}

export function dependentsOf(projectId: string) {
  return portfolioProjects.filter((project) => project.dependencies.includes(projectId))
}
