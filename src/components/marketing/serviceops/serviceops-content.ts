import type { MarketingLocale } from '../qdip-copy'

export const SERVICEOPS_URLS = {
  app: 'https://ops.qdip.ai/app',
  ownerDemo: 'https://ops.qdip.ai/demo/owner',
  workerDemo: 'https://ops.qdip.ai/demo/worker',
  customerDemo: 'https://ops.qdip.ai/demo/customer',
} as const

type Feature = { title: string; body: string }
type GuideSection = { title: string; description: string; steps: readonly string[] }
type Copy = {
  eyebrow: string
  title: string
  summary: string
  boundary: string
  audience: string
  primary: string
  guideLink: string
  caseLink: string
  pilotLink: string
  appLink: string
  featuresTitle: string
  features: readonly Feature[]
  presetsTitle: string
  presetsDescription: string
  presets: readonly string[]
  demosTitle: string
  demosDescription: string
  roles: { owner: Feature; worker: Feature; customer: Feature }
  demoAction: string
  funnelTitle: string
  funnelSteps: readonly Feature[]
  formTitle: string
  formDescription: string
  guideTitle: string
  guideSummary: string
  guideSections: readonly GuideSection[]
  guideCaution: string
  faqTitle: string
  faq: readonly Feature[]
  backToCase: string
  seoTitle: string
  seoDescription: string
  guideSeoTitle: string
  guideSeoDescription: string
}

export const serviceOpsCopy: Record<MarketingLocale, Copy> = {
  en: {
    eyebrow: 'QDIP ecosystem · Working application',
    title: 'ServiceOps — one workflow from order to customer acceptance',
    summary:
      'Coordinate service jobs in one configurable workspace: the owner sets up a process, workers handle assigned tasks, and the customer sees confirmed progress. Explore the three roles with an interactive demo before discussing a pilot.',
    boundary:
      'Available today: manual order management and an isolated demo. QDIP Kernel auto-assignment, measured savings and production-scale readiness have not been verified. Demo actions do not change real orders.',
    audience:
      'Built for service teams with repeatable jobs, including repair shops, cleaning, installation and on-site services.',
    primary: 'Explore the working demo',
    guideLink: 'User guide',
    caseLink: 'Explore ServiceOps',
    pilotLink: 'Discuss a ServiceOps pilot',
    appLink: 'Existing account sign in',
    featuresTitle: 'A connected workflow for three roles',
    features: [
      {
        title: 'Owner & operator',
        body: 'Create an order and customer, configure board columns and workflows, assign tasks, review evidence and accept work.',
      },
      {
        title: 'Worker',
        body: 'See only assigned tasks, checklists and permitted details. Record work offline, then sync queued actions when online.',
      },
      {
        title: 'Customer',
        body: 'Open a time-limited, order-specific link for server-confirmed progress and acceptance when enabled by the workflow.',
      },
    ],
    presetsTitle: 'Twelve editable service templates',
    presetsDescription:
      'Start with an example process, then adapt the stages, task requirements and board. Templates are not separate products.',
    presets: [
      'Auto repair',
      'Auto detailing',
      'Cleaning',
      'Appliance repair',
      'Plumbing',
      'Electrical services',
      'HVAC',
      'Events and entertainers',
      'Sign production and installation',
      'Landscaping',
      'Computer and phone repair',
      'Laundry and dry cleaning',
    ],
    demosTitle: 'Walk through the actual interfaces',
    demosDescription:
      'The public demo is an isolated browser simulation. It shows a sample order across the three roles and does not require an account or modify the server.',
    roles: {
      owner: {
        title: '1. Owner / operator',
        body: 'Inspect example customers, team members and orders. Assign the technician to start the shared scenario.',
      },
      worker: {
        title: '2. Worker PWA',
        body: 'Start the assigned work, complete the demonstration checklist and submit the job.',
      },
      customer: {
        title: '3. Customer',
        body: 'Review the simulated progress and either accept the result or request rework.',
      },
    },
    demoAction: 'Open role demo',
    funnelTitle: 'Evaluate fit without a rollout',
    funnelSteps: [
      { title: 'Explore', body: 'Start with the open demo and inspect the full owner → worker → customer path.' },
      {
        title: 'Map your process',
        body: 'Compare your stages, team qualifications, checklists and handover rules with the example.',
      },
      {
        title: 'Scope a pilot',
        body: 'Send one representative workflow and the constraints that matter. A pilot is discussed, not automatically activated.',
      },
    ],
    formTitle: 'Request a scoped pilot',
    formDescription:
      'Describe your service process, team size, job stages and the hardest coordination problem. We use the existing QDIP inquiry channel; submitting is not account registration.',
    guideTitle: 'ServiceOps user guide',
    guideSummary:
      'Step-by-step reference for owners, operators, workers and customers. Live access requires a provisioned organization and the correct role. Public demos are separate from production data.',
    guideSections: [
      {
        title: '1. Choose the right entry',
        description: 'One service, three interfaces, with different access rights.',
        steps: [
          'Use the open Owner, Worker and Customer demos to explore without signing in. Demo progress is stored in this browser only.',
          'For real work, an organization owner or operator signs in at ops.qdip.ai/app; an assigned worker uses ops.qdip.ai/worker.',
          'Customers do not create an account: the business sends an order-specific link generated from a real order.',
          'If you do not have an organization provisioned or a linked membership, request a pilot instead of assuming public self-registration is available.',
        ],
      },
      {
        title: '2. Set up a business',
        description: 'Owner onboarding through the setup wizard.',
        steps: [
          'Sign in with the authorized owner account. A new, eligible organization opens the setup wizard.',
          'Choose one of the 12 editable service templates. Review its stages, tasks and checklists instead of treating a preset as a finished business process.',
          'Adjust the board columns and publish the workflow. Edits to later workflow versions do not silently rewrite existing orders.',
          'Inspect the generated example orders, customers and demo team. Clear the sample data through the explicit demo-cleanup action before real use; that action targets only marked examples.',
        ],
      },
      {
        title: '3. Manage customers and create orders',
        description: 'Owner/operator order management.',
        steps: [
          'Open Dashboard and select New order. Enter the subject and choose an existing customer or add a new customer in the same form.',
          'Select the appropriate published process and supply required context, instructions, schedule or deadline.',
          'Confirm the order and assign qualified workers to the individual tasks, not just to the entire order.',
          'Use the board to organize orders. Moving a Kanban card changes board placement, not the server-owned task or order lifecycle.',
        ],
      },
      {
        title: '4. Manage your team and workflows',
        description: 'Qualifications, availability and versioned processes.',
        steps: [
          'Under Team, create or update staff profiles, qualifications, working days and unavailability.',
          'Workers need their own linked identity and an active worker membership before they can sign in and receive task assignments.',
          'Under Settings, edit process stages, tasks, dependencies, required checklists, evidence and handover conditions; publish changes explicitly.',
          'Owners can inspect the audit history and configure optional modules. Do not assume QDIP optimization is enabled: the basic system is manual-first.',
        ],
      },
      {
        title: '5. Perform work in Worker PWA',
        description: 'Phone, tablet and desktop access for an assigned worker.',
        steps: [
          'Open ops.qdip.ai/worker as a worker with active assignments. The owner role does not grant access to worker-only task data.',
          'Open a task to review the stage, instructions, permitted location information, dependencies and required checklist.',
          'Start the task, complete checklist items, attach photos where required and submit it for acceptance.',
          'On iPhone, install from Safari using Share → Add to Home Screen. On supported devices, install via the browser menu.',
          'Offline actions remain pending locally; reopen or return online and use Sync. Inspect synced, pending or conflict states. Resolve a conflict explicitly rather than assuming offline actions were accepted.',
        ],
      },
      {
        title: '6. Review and hand over work',
        description: 'Human acceptance controls completion.',
        steps: [
          'The owner/operator reviews submitted tasks and any required evidence, then accepts or rejects each submission.',
          'When task and handover conditions are satisfied, the order can move to customer acceptance if configured.',
          'Create a customer link from the real order. It is valid for one order, has an expiry (1–90 days), can be revoked, and its token is displayed only when created.',
          'Do not forward the link publicly. The customer can inspect server-confirmed progress and accept or request changes when the workflow permits it.',
          'A sample order cannot issue a real customer token; use the public Customer demo to review the simulated UX.',
        ],
      },
      {
        title: '7. Run the full demo',
        description: 'A browser-only learning flow, not a production execution.',
        steps: [
          'Open the Owner demo. Review the six fictitious customers, three demo team members and six example orders.',
          'Assign a technician to example order #1, then switch to Worker demo on the same browser.',
          'Start work, complete the sample checklist and submit the result.',
          'Switch to Customer demo to accept the work or request rework. Use Reset to restart the simulation.',
          'Separate browsers/devices do not share this local demo state. The demo does not send API commands or demonstrate Kernel optimization.',
        ],
      },
      {
        title: '8. Access, data and troubleshooting',
        description: 'Common causes and safe recovery.',
        steps: [
          'If /worker says your account is an owner/operator, use Dashboard or the public Worker demo. This is not a revocation.',
          'If a real worker sees no tasks, check the membership, task assignment and order confirmation with the owner.',
          'If an offline item remains pending, restore connectivity, reopen the PWA and sync; for conflicts, review the conflict rather than discarding evidence without assessment.',
          'If a customer link fails, confirm its expiry, revocation and order scope; request a fresh link from the owner if necessary.',
          'Do not use sample data for real workers or customers. Billing, autonomous optimization and verified performance gains are not part of the currently validated base workflow.',
        ],
      },
    ],
    guideCaution:
      'Availability note: browser screens and documented API behavior exist; full external production E2E, public self-service onboarding, Kernel assignment and measured business ROI are not verified.',
    faqTitle: 'Before you start',
    faq: [
      {
        title: 'Is ServiceOps an automated optimizer?',
        body: 'Not in the validated base experience. A person assigns and accepts work; optional QDIP optimization requires a separate verified integration.',
      },
      {
        title: 'Can I sign up and use live data from the demo?',
        body: 'No. Public demos use fictitious browser-local records. Live work requires an onboarded organization and authorized users.',
      },
      {
        title: 'Does the customer see offline edits immediately?',
        body: 'No. Customer progress reflects only server-confirmed actions after synchronization.',
      },
    ],
    backToCase: 'Back to ServiceOps case',
    seoTitle: 'ServiceOps — service business workflow demo and pilot',
    seoDescription:
      'Explore ServiceOps: configurable service orders, team tasks, offline Worker PWA and customer progress. Open the three-role demo, read the guide and discuss a pilot.',
    guideSeoTitle: 'ServiceOps user guide — owners, workers and customers',
    guideSeoDescription:
      'Learn ServiceOps setup, orders, team assignments, worker offline sync, customer links and demo walkthrough. Includes access rules and current limits.',
  },
  uk: {
    eyebrow: 'Екосистема QDIP · Працюючий застосунок',
    title: 'ServiceOps — від замовлення до приймання клієнтом',
    summary:
      'Керуйте сервісними замовленнями в одному налаштовуваному просторі: власник визначає процес, виконавець працює зі своїми задачами, а клієнт бачить підтверджений прогрес. Спробуйте три ролі в інтерактивному демо.',
    boundary:
      'Наразі доступні ручне керування замовленнями та ізольоване демо. Автоматичний розподіл через QDIP Kernel, економію коштів і готовність до промислового навантаження не підтверджено. Дії в демо не змінюють реальні замовлення.',
    audience:
      'Для сервісного бізнесу з повторюваними замовленнями: СТО, клінінг, монтаж, ремонт і виїзне обслуговування.',
    primary: 'Відкрити інтерактивне демо',
    guideLink: 'Інструкція користувача',
    caseLink: 'Переглянути кейс',
    pilotLink: 'Обговорити пілот ServiceOps',
    appLink: 'Вхід для чинних користувачів',
    featuresTitle: 'Один процес — три інтерфейси',
    features: [
      {
        title: 'Власник і оператор',
        body: 'Створення клієнтів і замовлень, налаштування дошки та процесів, призначення задач, перевірка доказів і приймання роботи.',
      },
      {
        title: 'Виконавець',
        body: 'Лише власні призначені задачі, чеклісти й дозволені дані. Робота офлайн із подальшою синхронізацією.',
      },
      {
        title: 'Замовник',
        body: 'Посилання на одне замовлення з обмеженим строком дії, підтверджений сервером прогрес і погодження за правилами процесу.',
      },
    ],
    presetsTitle: '12 редагованих шаблонів бізнесу',
    presetsDescription:
      'Оберіть початковий процес, а потім адаптуйте етапи, вимоги до задач і дошку. Це не окремі застосунки.',
    presets: [
      'СТО',
      'Автодетейлінг',
      'Клінінг',
      'Ремонт побутової техніки',
      'Сантехнічні послуги',
      'Електромонтаж',
      'Опалення та вентиляція',
      'Заходи й аніматори',
      'Зовнішня реклама',
      'Озеленення',
      'Ремонт комп’ютерів і телефонів',
      'Пральні та хімчистки',
    ],
    demosTitle: 'Перегляньте всі три інтерфейси',
    demosDescription:
      'Публічне демо — ізольована симуляція в браузері. Вона показує один приклад замовлення з трьох ролей, не потребує входу та не змінює серверні дані.',
    roles: {
      owner: {
        title: '1. Власник / оператор',
        body: 'Перегляньте приклади клієнтів, команди й замовлень. Призначте майстра для початку сценарію.',
      },
      worker: {
        title: '2. PWA виконавця',
        body: 'Почніть призначену роботу, виконайте демонстраційний чекліст і здайте задачу.',
      },
      customer: {
        title: '3. Замовник',
        body: 'Перегляньте імітований прогрес, прийміть результат або поверніть на доопрацювання.',
      },
    },
    demoAction: 'Відкрити демо ролі',
    funnelTitle: 'Оцініть придатність без впровадження',
    funnelSteps: [
      { title: 'Подивіться', body: 'Пройдіть відкритий сценарій від власника через виконавця до замовника.' },
      {
        title: 'Зіставте процес',
        body: 'Порівняйте свої етапи, кваліфікації, чеклісти й правила приймання з прикладом.',
      },
      {
        title: 'Узгодьте пілот',
        body: 'Опишіть один типовий процес та обмеження. Запит запускає обговорення, а не автоматичне підключення.',
      },
    ],
    formTitle: 'Запропонуйте пілот',
    formDescription:
      'Опишіть ваш сервісний процес, команду, етапи замовлення і головну проблему координації. Форма використовує наявний канал звернень QDIP та не створює обліковий запис.',
    guideTitle: 'Посібник користувача ServiceOps',
    guideSummary:
      'Покрокова інструкція для власника, оператора, виконавця і замовника. Для реальних задач потрібні налаштована організація й відповідна роль. Публічне демо ізольовано від робочих даних.',
    guideSections: [
      {
        title: '1. Як зайти до системи',
        description: 'Один сервіс із трьома інтерфейсами та різними правами.',
        steps: [
          'Відкрийте демо власника, виконавця або замовника без входу. Прогрес симуляції зберігається лише у поточному браузері.',
          'Для реальної роботи власник або оператор входить через ops.qdip.ai/app, призначений працівник — через ops.qdip.ai/worker.',
          'Клієнтові не потрібен акаунт: він отримує посилання на конкретне замовлення від вашої компанії.',
          'Якщо організацію або ваш профіль ще не підключено, надішліть запит на пілот. Публічну самостійну реєстрацію не підтверджено.',
        ],
      },
      {
        title: '2. Налаштування бізнесу',
        description: 'Перший запуск через майстер налаштування.',
        steps: [
          'Увійдіть як власник організації. Для нової організації без налаштувань відкриється майстер.',
          'Оберіть один із 12 редагованих шаблонів. Перевірте етапи, задачі, чеклісти та вимоги перед роботою.',
          'Налаштуйте колонки дошки й опублікуйте процес. Нова версія процесу не змінює автоматично активні замовлення.',
          'Перегляньте демонстраційні замовлення, клієнтів і команду. Перед реальним використанням видаліть лише позначені демодані через явну дію очищення.',
        ],
      },
      {
        title: '3. Клієнти та нові замовлення',
        description: 'Дії власника й оператора.',
        steps: [
          'На Дошці виберіть «Нове замовлення». Вкажіть назву, оберіть існуючого клієнта або створіть нового в цій же формі.',
          'Оберіть опублікований процес, додайте потрібні інструкції, адресу, дату та строк виконання.',
          'Підтвердьте замовлення та призначте працівників на конкретні задачі з урахуванням кваліфікацій.',
          'Переміщення картки між колонками Kanban змінює представлення на дошці, але не життєвий цикл задачі чи замовлення.',
        ],
      },
      {
        title: '4. Команда та процеси',
        description: 'Кваліфікації, графіки й версії робочих процесів.',
        steps: [
          'У розділі «Команда» додайте або змініть працівників, кваліфікації, робочі дні та відсутності.',
          'Для реального доступу виконавець повинен мати прив’язаний обліковий запис та активну роль worker.',
          'У «Налаштуваннях» визначте етапи процесу, задачі, залежності, чеклісти, фото й умови здачі; зміни публікуються явно.',
          'Власник може переглядати історію змін та додаткові модулі. Базова система працює з ручними призначеннями; QDIP-оптимізація не вважається увімкненою.',
        ],
      },
      {
        title: '5. Робота виконавця в PWA',
        description: 'Телефон, планшет і комп’ютер для призначених задач.',
        steps: [
          'Відкрийте ops.qdip.ai/worker під обліковим записом виконавця. Роль власника не надає доступу до задач worker.',
          'Відкрийте задачу, перевірте етап, інструкції, адресу, залежності та чекліст.',
          'Почніть роботу, відмітьте пункти чекліста, додайте фото за вимогою й передайте задачу на приймання.',
          'На iPhone відкрийте Safari → «Поділитися» → «На початковий екран». На інших підтримуваних пристроях використайте встановлення через браузер.',
          'Офлайн-дії залишаються локально в черзі. Після відновлення мережі відкрийте застосунок і синхронізуйте. Контролюйте «очікує», «синхронізовано», «конфлікт». Конфлікти вирішуються явно.',
        ],
      },
      {
        title: '6. Приймання та передача замовнику',
        description: 'Завершення потребує підтвердження.',
        steps: [
          'Власник або оператор переглядає здані задачі й докази та приймає або відхиляє виконання.',
          'Після виконання умов завершення можна передати замовлення на погодження клієнту, якщо це дозволяє процес.',
          'Створіть клієнтське посилання із реального замовлення: доступ обмежений одним замовленням, діє 1–90 днів і може бути відкликаний. Токен показується лише під час створення.',
          'Не публікуйте посилання відкрито. Клієнт бачить лише підтверджений сервером прогрес і може погодити результат або запросити зміни, якщо функція доступна.',
          'Для демозамовлень реальні клієнтські токени не видаються; скористайтеся окремим демо замовника.',
        ],
      },
      {
        title: '7. Повний демонстраційний сценарій',
        description: 'Навчальна симуляція браузера, а не реальні команди.',
        steps: [
          'Відкрийте демо власника. Перегляньте шість вигаданих клієнтів, трьох демопрацівників і шість замовлень.',
          'Призначте майстра на замовлення №1, потім у тому самому браузері перейдіть до демо виконавця.',
          'Почніть роботу, виконайте демонстраційний чекліст і здайте результат.',
          'Перейдіть до демо замовника: прийміть виконання або поверніть на доопрацювання. Кнопка скидання починає сценарій спочатку.',
          'Окремі браузери не поділяють локальний стан. Демо не надсилає API-команди й не демонструє оптимізацію Kernel.',
        ],
      },
      {
        title: '8. Доступ, дані та усунення проблем',
        description: 'Типові помилки і безпечні дії.',
        steps: [
          'Якщо /worker повідомляє, що ви власник або оператор, відкрийте Дошку чи публічне демо. Це не відкликання доступу.',
          'Якщо виконавець не бачить задач, власник має перевірити роль, активне призначення та підтвердження замовлення.',
          'Якщо офлайн-команда очікує синхронізації, відновіть мережу й відкрийте PWA. Конфлікт не варто очищати без перегляду його причин.',
          'Якщо клієнтське посилання не працює, перевірте строк дії, відкликання й відповідність замовленню; попросіть власника створити нове.',
          'Демонстраційні записи не призначені для реальних користувачів. Автоматична оптимізація, виставлення рахунків і виміряна економія не підтверджені для базового сценарію.',
        ],
      },
    ],
    guideCaution:
      'Межа доказів: інтерфейси й API присутні в коді. Повний зовнішній E2E, публічний self-service onboarding, розподіл через Kernel та виміряний ROI не підтверджено.',
    faqTitle: 'Перед початком',
    faq: [
      {
        title: 'ServiceOps автоматично оптимізує роботу?',
        body: 'Не в підтвердженій базовій версії. Людина призначає та приймає задачі; опційна оптимізація QDIP потребує окремо перевіреної інтеграції.',
      },
      {
        title: 'Чи можна увійти в реальний бізнес із демо?',
        body: 'Ні. Публічне демо використовує вигадані локальні дані. Для реальної роботи потрібні організація та авторизовані користувачі.',
      },
      {
        title: 'Клієнт бачить офлайн-зміни одразу?',
        body: 'Ні. Портал показує лише зміни, підтверджені сервером після синхронізації.',
      },
    ],
    backToCase: 'Повернутися до кейсу ServiceOps',
    seoTitle: 'ServiceOps — демо керування сервісним бізнесом і пілот',
    seoDescription:
      'Дослідіть ServiceOps: замовлення, задачі команди, офлайн-PWA виконавця та прогрес клієнта. Три демонстраційні ролі, інструкція і запит на пілот.',
    guideSeoTitle: 'ServiceOps — інструкція для власника, виконавця і клієнта',
    guideSeoDescription:
      'Налаштування ServiceOps, замовлення, призначення, робота офлайн, клієнтські посилання і демо-сценарій. Права доступу й відомі обмеження.',
  },
  pl: {
    eyebrow: 'Ekosystem QDIP · Działająca aplikacja',
    title: 'ServiceOps — od zlecenia do akceptacji klienta',
    summary:
      'Zarządzaj zleceniami serwisowymi w jednym konfigurowalnym miejscu: właściciel ustala proces, wykonawca realizuje zadania, a klient widzi potwierdzony postęp. Sprawdź trzy role w interaktywnym demo.',
    boundary:
      'Obecnie dostępne są ręczne zarządzanie zleceniami i izolowane demo. Automatyczny przydział przez QDIP Kernel, oszczędności i gotowość do dużego obciążenia nie zostały potwierdzone. Akcje demo nie modyfikują prawdziwych zleceń.',
    audience:
      'Dla firm usługowych z powtarzalnymi zleceniami: warsztatów, firm sprzątających, instalacyjnych, naprawczych i mobilnych.',
    primary: 'Otwórz interaktywne demo',
    guideLink: 'Instrukcja użytkownika',
    caseLink: 'Poznaj ServiceOps',
    pilotLink: 'Porozmawiajmy o pilotażu ServiceOps',
    appLink: 'Logowanie dla obecnych użytkowników',
    featuresTitle: 'Jeden proces — trzy interfejsy',
    features: [
      {
        title: 'Właściciel i operator',
        body: 'Klienci i zlecenia, tablica i procesy, przydzielanie zadań, weryfikacja dowodów oraz akceptacja pracy.',
      },
      {
        title: 'Wykonawca',
        body: 'Tylko przypisane zadania, listy kontrolne i dozwolone dane. Praca offline z późniejszą synchronizacją.',
      },
      {
        title: 'Klient',
        body: 'Link do jednego zlecenia o ograniczonym terminie ważności, postęp potwierdzony przez serwer i akceptacja według reguł procesu.',
      },
    ],
    presetsTitle: '12 edytowalnych szablonów usług',
    presetsDescription:
      'Wybierz proces startowy, a następnie dostosuj etapy, wymagania zadań i tablicę. To nie są oddzielne produkty.',
    presets: [
      'Warsztat samochodowy',
      'Auto detailing',
      'Sprzątanie',
      'Naprawa AGD',
      'Hydraulika',
      'Elektryka',
      'HVAC',
      'Wydarzenia i animatorzy',
      'Produkcja i montaż reklam',
      'Pielęgnacja zieleni',
      'Serwis komputerów i telefonów',
      'Pralnie i czyszczenie chemiczne',
    ],
    demosTitle: 'Poznaj wszystkie trzy interfejsy',
    demosDescription:
      'Publiczne demo to izolowana symulacja w przeglądarce. Pokazuje przykładowe zlecenie z perspektywy trzech ról, nie wymaga logowania i nie zmienia danych serwera.',
    roles: {
      owner: {
        title: '1. Właściciel / operator',
        body: 'Sprawdź przykładowych klientów, zespół i zlecenia. Przydziel fachowca, aby uruchomić scenariusz.',
      },
      worker: {
        title: '2. PWA wykonawcy',
        body: 'Rozpocznij przydzieloną pracę, wykonaj listę kontrolną demo i zgłoś zadanie do odbioru.',
      },
      customer: { title: '3. Klient', body: 'Sprawdź symulowany postęp, zaakceptuj wynik lub zgłoś poprawki.' },
    },
    demoAction: 'Otwórz demo roli',
    funnelTitle: 'Sprawdź dopasowanie bez wdrożenia',
    funnelSteps: [
      { title: 'Sprawdź', body: 'Przejdź przez otwarte demo od właściciela przez wykonawcę do klienta.' },
      {
        title: 'Porównaj proces',
        body: 'Zestaw etapy, kwalifikacje, listy kontrolne i zasady odbioru z własną pracą.',
      },
      {
        title: 'Zaproponuj pilotaż',
        body: 'Opisz jeden typowy proces i jego ograniczenia. Formularz rozpoczyna rozmowę, nie aktywuje konta.',
      },
    ],
    formTitle: 'Zapytaj o pilotaż',
    formDescription:
      'Opisz proces usługowy, zespół, etapy zlecenia i największy problem koordynacji. Formularz korzysta z obecnego kanału kontaktu QDIP i nie zakłada konta.',
    guideTitle: 'Instrukcja użytkownika ServiceOps',
    guideSummary:
      'Instrukcje krok po kroku dla właściciela, operatora, pracownika i klienta. Prawdziwa praca wymaga skonfigurowanej organizacji i odpowiedniej roli. Publiczne demo jest odseparowane od danych produkcyjnych.',
    guideSections: [
      {
        title: '1. Wybór odpowiedniego wejścia',
        description: 'Jedna usługa, trzy interfejsy i różne uprawnienia.',
        steps: [
          'Otwórz demo właściciela, wykonawcy lub klienta bez logowania. Postęp symulacji zapisuje się tylko w tej przeglądarce.',
          'Do realnej pracy właściciel lub operator loguje się przez ops.qdip.ai/app, a przypisany wykonawca przez ops.qdip.ai/worker.',
          'Klient nie zakłada konta; firma przesyła mu link do konkretnego zlecenia.',
          'Jeśli organizacja lub członkostwo nie zostały skonfigurowane, zapytaj o pilotaż. Publiczna samoobsługowa rejestracja nie jest potwierdzona.',
        ],
      },
      {
        title: '2. Konfiguracja firmy',
        description: 'Pierwsze uruchomienie za pomocą kreatora.',
        steps: [
          'Zaloguj się jako właściciel organizacji. Kreator pojawi się dla nowej organizacji bez konfiguracji.',
          'Wybierz jeden z 12 edytowalnych szablonów, a następnie sprawdź etapy, zadania, listy i wymagania.',
          'Ustaw kolumny tablicy i opublikuj proces. Nowa wersja procesu nie zmienia po cichu aktywnych zleceń.',
          'Sprawdź wygenerowane przykładowe zlecenia, klientów i zespół. Przed realną pracą usuń tylko oznaczone rekordy demo przez wyraźne polecenie czyszczenia.',
        ],
      },
      {
        title: '3. Klienci i nowe zlecenia',
        description: 'Czynności właściciela i operatora.',
        steps: [
          'Na Tablicy wybierz Nowe zlecenie. Podaj temat i wybierz istniejącego klienta lub dodaj nowego w tym samym formularzu.',
          'Wybierz opublikowany proces, wpisz instrukcje, adres i ewentualny termin.',
          'Potwierdź zlecenie i przydziel odpowiednio wykwalifikowanych pracowników do poszczególnych zadań.',
          'Przenoszenie karty między kolumnami Kanban zmienia jej miejsce na tablicy, a nie serwerowy stan zadania lub zlecenia.',
        ],
      },
      {
        title: '4. Zespół i procesy',
        description: 'Kwalifikacje, grafiki i wersje workflow.',
        steps: [
          'W sekcji Zespół dodawaj i aktualizuj profile, kwalifikacje, dni pracy i nieobecności.',
          'Wykonawca musi mieć powiązaną tożsamość i aktywne członkostwo worker, aby zobaczyć przydziały.',
          'W Ustawieniach określ etapy, zadania, zależności, listy kontrolne, zdjęcia i warunki odbioru, a następnie opublikuj zmiany.',
          'Właściciel może przeglądać historię i moduły dodatkowe. Podstawowy produkt działa z ręcznym przydziałem, a optymalizacja QDIP nie jest domyślnie aktywna.',
        ],
      },
      {
        title: '5. Praca wykonawcy w PWA',
        description: 'Telefon, tablet i komputer do przydzielonych zadań.',
        steps: [
          'Otwórz ops.qdip.ai/worker jako wykonawca z aktywnymi przydziałami. Rola właściciela nie daje wglądu w dane worker.',
          'Otwórz zadanie i sprawdź etap, instrukcje, adres, zależności i listę kontrolną.',
          'Rozpocznij pracę, zaznacz listę, dodaj wymagane zdjęcia i wyślij zadanie do akceptacji.',
          'Na iPhone: Safari → Udostępnij → Do ekranu początkowego. Na innych obsługiwanych urządzeniach skorzystaj z instalacji przez przeglądarkę.',
          'Działania offline oczekują lokalnie. Po odzyskaniu sieci otwórz PWA i synchronizuj. Sprawdzaj statusy pending, synced i conflict; konflikty rozwiązuje się świadomie.',
        ],
      },
      {
        title: '6. Odbiór i przekazanie klientowi',
        description: 'Zakończenie wymaga zatwierdzenia.',
        steps: [
          'Właściciel lub operator sprawdza zgłoszone zadania i dowody, następnie akceptuje je lub odrzuca.',
          'Po spełnieniu warunków można przekazać zlecenie do akceptacji klienta, jeśli proces na to pozwala.',
          'Utwórz link klienta z prawdziwego zlecenia. Obejmuje jedno zlecenie, jest ważny od 1 do 90 dni, można go unieważnić, a token widać tylko przy tworzeniu.',
          'Nie publikuj linku. Klient widzi tylko postęp potwierdzony przez serwer i może zaakceptować lub zgłosić zmiany, jeżeli proces to umożliwia.',
          'Przykładowe zlecenia nie wydają rzeczywistych tokenów klienta; użyj osobnego dema klienta.',
        ],
      },
      {
        title: '7. Pełny scenariusz demo',
        description: 'Lokalna symulacja do nauki, a nie prawdziwe polecenia.',
        steps: [
          'Otwórz demo właściciela. Zobacz sześciu fikcyjnych klientów, trzech pracowników i sześć zleceń.',
          'Przydziel pracownika do zlecenia nr 1, a następnie w tej samej przeglądarce przejdź do dema wykonawcy.',
          'Rozpocznij pracę, wykonaj listę kontrolną i zgłoś wynik.',
          'Przejdź do dema klienta: zaakceptuj pracę lub poproś o poprawki. Zresetuj, aby powtórzyć scenariusz.',
          'Inne przeglądarki nie współdzielą lokalnego stanu. Demo nie wysyła poleceń API i nie pokazuje optymalizacji Kernel.',
        ],
      },
      {
        title: '8. Dostęp, dane i rozwiązywanie problemów',
        description: 'Częste sytuacje i bezpieczne działania.',
        steps: [
          'Jeżeli /worker pokazuje rolę właściciela/operatora, otwórz Tablicę albo publiczne demo. Nie oznacza to cofnięcia dostępu.',
          'Jeżeli wykonawca nie widzi zadań, sprawdź z właścicielem członkostwo, przydział i zatwierdzenie zlecenia.',
          'Jeśli działanie offline czeka, przywróć połączenie i otwórz PWA. Nie usuwaj konfliktu bez sprawdzenia przyczyny.',
          'Gdy link klienta nie działa, sprawdź ważność, unieważnienie i zakres zlecenia; poproś właściciela o nowy.',
          'Rekordy demo nie nadają się do realnej pracy. Automatyczna optymalizacja, fakturowanie i mierzalne oszczędności nie są potwierdzonymi funkcjami podstawowego scenariusza.',
        ],
      },
    ],
    guideCaution:
      'Granice dowodów: interfejsy i API są obecne w kodzie. Pełne zewnętrzne E2E, publiczny onboarding samoobsługowy, przydział przez Kernel i zmierzony zwrot z inwestycji nie zostały potwierdzone.',
    faqTitle: 'Przed rozpoczęciem',
    faq: [
      {
        title: 'Czy ServiceOps sam optymalizuje pracę?',
        body: 'Nie w potwierdzonej wersji podstawowej. Pracę przydziela i akceptuje człowiek; dodatkowa optymalizacja QDIP wymaga oddzielnie zweryfikowanej integracji.',
      },
      {
        title: 'Czy demo tworzy konto do pracy z danymi?',
        body: 'Nie. Publiczne demo korzysta z fikcyjnych danych lokalnych. Praca na realnych danych wymaga organizacji i uprawnionych użytkowników.',
      },
      {
        title: 'Czy klient od razu widzi zmiany offline?',
        body: 'Nie. Portal pokazuje wyłącznie akcje potwierdzone przez serwer po synchronizacji.',
      },
    ],
    backToCase: 'Wróć do ServiceOps',
    seoTitle: 'ServiceOps — demo zarządzania zleceniami usługowymi i pilotaż',
    seoDescription:
      'Poznaj ServiceOps: zlecenia, zadania zespołu, PWA offline i postęp klienta. Trzy role demo, instrukcja i zapytanie o pilotaż.',
    guideSeoTitle: 'Instrukcja ServiceOps — właściciel, wykonawca, klient',
    guideSeoDescription:
      'Konfiguracja ServiceOps, zlecenia, przydziały, PWA offline, linki klientów i demo. Zasady dostępu i ograniczenia.',
  },
}
