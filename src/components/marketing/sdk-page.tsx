import Link from 'next/link'
import { ArrowRight, Code2, Download, ShieldCheck } from 'lucide-react'
import { DesignSystemProvider } from '@/design-system'
import { marketingLocaleHref } from '@/lib/platform-urls'
import type { MarketingLocale } from './qdip-copy'
import { MarketingHeader } from './marketing-header'
import { MarketingFooter } from './marketing-footer'
import atmosphereStyles from './marketing-atmosphere.module.css'
import burgundyStyles from './marketing-deep-burgundy.module.css'
import styles from './sdk-page.module.css'

type SdkCopy = {
  eyebrow: string
  title: string
  lead: string
  overview: string
  workerTitle: string
  workerBody: string
  clientTitle: string
  clientBody: string
  packageStatus: string
  packageNote: string
  install: string
  installIntro: string
  connect: string
  connectBody: string
  managed: string
  managedBody: string
  external: string
  externalBody: string
  auth: string
  authBody: string
  integrity: string
  integrityBody: string
  next: string
  nextBody: string
  readArchitecture: string
}

const copy: Record<MarketingLocale, SdkCopy> = {
  en: {
    eyebrow: 'Developer platform / SDK',
    title: 'Build decision applications with QDIP',
    lead: 'Bring your own decision logic. Connect a remote Worker and invoke QDIP from a typed client.',
    overview:
      'SDK-02 runs in your Python environment. SDK-03 calls the hosted Gateway from a server-side Node.js application. QDIP manages authorization and routes supported DecisionSpec workloads to its Kernel.',
    workerTitle: 'Python Worker',
        workerBody:
      'Implement a domain adapter or an owned algorithm. Connect outbound over WSS without exposing a Worker port.',
    clientTitle: 'TypeScript / Node.js client',
    clientBody: 'Discover capabilities, invoke executions and handle typed errors from your backend.',
    packageStatus: 'Controlled distribution · Public downloads not yet available',
    packageNote:
      'These versions have been built and tested in CI, but release archives have not yet been published on qdip.ai. Do not use a repository checkout or an unverified package as a substitute.',
    install: 'Install from verified packages',
    installIntro:
      'An approved operator supplies the versioned archives and their SHA-256 digests. Verify both archives before installation. These examples do not require access to the QDIP Core repository.',
    connect: 'Connect and execute',
    connectBody:
      'Use a scoped Worker key for registration and a separate scoped caller key for invocation. Never embed caller credentials in a browser.',
    managed: 'Managed Kernel execution',
    managedBody:
      'Worker produces DecisionSpec. Gateway validates it; QDIP Kernel executes the decision and returns server-authored result, manifest and replay evidence.',
    external: 'Developer-owned algorithms',
    externalBody:
      'The Worker executes your algorithm and returns a typed structured_result. Externally reported outcomes are not presented as Kernel-certified optimality.',
    auth: 'Access boundaries',
    authBody:
      'A package download never grants Gateway access. Organization, application, capability and credential scope are enforced separately.',
    integrity: 'Release integrity',
    integrityBody:
      'Published artifacts will be paired with SHA-256 checksums and a pinned source revision. Downloads remain unavailable until the verified release files are hosted.',
    next: 'Start with an independently deployable Worker',
    nextBody:
      'Obtain approved SDK packages and staging credentials, then integrate through the Gateway. Public third-party Worker admission is a separate qualification gate.',
    readArchitecture: 'Explore QDIP Core',
  },
  uk: {
    eyebrow: 'Платформа розробника / SDK',
    title: 'Створюйте застосунки рішень на QDIP',
    lead: 'Використовуйте власний алгоритм. Підключайте віддалений Worker і викликайте QDIP через типізований клієнт.',
    overview:
      'SDK-02 працює у вашому Python-середовищі. SDK-03 викликає hosted Gateway із серверного Node.js застосунку. QDIP контролює доступ і виконує підтримувані DecisionSpec через Kernel.',
    workerTitle: 'Python Worker',
        workerBody:
      'Створюйте доменний адаптер або власний алгоритм. Підключайтеся через вихідний WSS без відкритого порту Worker.',
    clientTitle: 'TypeScript / Node.js клієнт',
    clientBody: 'Отримуйте перелік capabilities, запускайте виконання й обробляйте типізовані помилки на backend.',
    packageStatus: 'Контрольована дистрибуція · Публічне завантаження ще недоступне',
    packageNote:
      'Ці версії збиралися та тестувалися в CI, але релізні архіви ще не опубліковані на qdip.ai. Доступ до приватного Core або неперевірені пакети не потрібні.',
    install: 'Встановлення з перевірених пакетів',
    installIntro:
      'Уповноважений оператор надає версіоновані архіви та їхні SHA-256. Перевірте обидва архіви перед встановленням. Доступ до репозиторію QDIP Core не потрібен.',
    connect: 'Підключення та виконання',
    connectBody:
      'Для реєстрації використовуйте scoped Worker key, для викликів — окремий scoped caller key. Не передавайте caller credentials у браузер.',
    managed: 'Виконання через Managed Kernel',
    managedBody:
      'Worker створює DecisionSpec. Gateway перевіряє його, а Kernel QDIP виконує рішення й повертає серверні result, manifest і replay.',
    external: 'Власні алгоритми розробника',
    externalBody:
      'Worker виконує ваш алгоритм і повертає типізований structured_result. Зовнішній результат не видається за Kernel-certified оптимум.',
    auth: 'Межі доступу',
    authBody:
      'Завантаження пакета не відкриває доступ до Gateway. Організація, застосунок, capability і scopes ключів перевіряються окремо.',
    integrity: 'Цілісність релізу',
    integrityBody:
      'Опубліковані архіви повинні мати SHA-256 та прив’язку до source revision. Посилань на завантаження не буде до перевіреного розміщення файлів.',
    next: 'Почніть із незалежного Worker',
    nextBody:
      'Отримайте перевірені пакети та staging credentials, після чого інтегруйтеся через Gateway. Публічний допуск сторонніх Worker перевіряється окремо.',
    readArchitecture: 'Архітектура QDIP Core',
  },
  pl: {
    eyebrow: 'Platforma deweloperska / SDK',
    title: 'Buduj aplikacje decyzyjne na QDIP',
    lead: 'Wykorzystaj własny algorytm. Połącz zdalnego Workera i wywołuj QDIP przez typowanego klienta.',
    overview:
      'SDK-02 działa w Twoim środowisku Python. SDK-03 wywołuje hostowany Gateway z aplikacji Node.js po stronie serwera. QDIP kontroluje dostęp i wykonuje obsługiwane DecisionSpec w Kernelu.',
    workerTitle: 'Python Worker',
        workerBody:
      'Zaimplementuj adapter domenowy lub własny algorytm. Łącz się wychodząco przez WSS bez otwierania portu Workera.',
    clientTitle: 'Klient TypeScript / Node.js',
    clientBody: 'Odkrywaj capabilities, uruchamiaj wykonania i obsługuj typowane błędy w backendzie.',
    packageStatus: 'Dystrybucja kontrolowana · Publiczne pobieranie jeszcze niedostępne',
    packageNote:
      'Te wersje zostały zbudowane i przetestowane w CI, ale archiwa wydań nie zostały jeszcze opublikowane na qdip.ai. Dostęp do prywatnego repozytorium Core nie jest wymagany.',
    install: 'Instalacja ze zweryfikowanych pakietów',
    installIntro:
      'Uprawniony operator przekazuje wersjonowane archiwa i sumy SHA-256. Sprawdź oba archiwa przed instalacją. Nie potrzebujesz dostępu do repozytorium QDIP Core.',
    connect: 'Połączenie i wykonanie',
    connectBody:
      'Użyj scoped Worker key do rejestracji i osobnego scoped caller key do wywołań. Nie umieszczaj credentials w przeglądarce.',
    managed: 'Wykonanie przez Managed Kernel',
    managedBody:
      'Worker tworzy DecisionSpec. Gateway go weryfikuje, a Kernel QDIP wykonuje decyzję i zwraca wynik, manifest oraz dowody replay po stronie serwera.',
    external: 'Algorytmy dewelopera',
    externalBody:
      'Worker uruchamia Twój algorytm i zwraca typowany structured_result. Wynik zewnętrzny nie jest przedstawiany jako optimum certyfikowane przez Kernel.',
    auth: 'Granice dostępu',
    authBody:
      'Pobranie pakietu nie daje dostępu do Gateway. Organizacja, aplikacja, capability i zakres uprawnień kluczy są sprawdzane osobno.',
    integrity: 'Integralność wydania',
    integrityBody:
      'Opublikowane artefakty muszą zawierać sumy SHA-256 oraz powiązanie z rewizją źródła. Linki do pobrania pojawią się po weryfikacji plików.',
    next: 'Zacznij od niezależnego Workera',
    nextBody:
      'Uzyskaj zweryfikowane pakiety i staging credentials, a następnie integruj się przez Gateway. Publiczne dopuszczanie zewnętrznych Workerów wymaga osobnej kwalifikacji.',
    readArchitecture: 'Architektura QDIP Core',
  },
}

export function SdkPage({ locale }: { locale: MarketingLocale }) {
  const c = copy[locale]
  return (
    <DesignSystemProvider
      theme="burgundy"
      mode="dark"
      className={[styles.page, atmosphereStyles.atmosphere, burgundyStyles.theme].join(' ')}
    >
      <main id="main-content" lang={locale}>
        <MarketingHeader locale={locale} currentPath="sdk" />
        <section className={styles.hero}>
          <p className={styles.eyebrow}>{c.eyebrow}</p>
          <h1>{c.title}</h1>
          <p className={styles.lead}>{c.lead}</p>
          <p className={styles.description}>{c.overview}</p>
          <a className={styles.heroLink} href="#packages">
            {c.install} <ArrowRight size={16} aria-hidden />
          </a>
        </section>

        <section id="packages" className={styles.section}>
          <div className={styles.sectionHeading}>
            <p className={styles.eyebrow}>SDK-02 / SDK-03</p>
            <h2>{c.install}</h2>
            <p>{c.installIntro}</p>
          </div>
          <div className={styles.packageGrid}>
            <article className={styles.package}>
              <Code2 className={styles.packageIcon} size={26} aria-hidden />
              <div className={styles.packageVersion}>SDK-02 · v0.1.3 · Python 3.11+</div>
              <h3>{c.workerTitle}</h3>
              <p>{c.workerBody}</p>
              <pre>
                <code>pip install --no-index --find-links wheels qdip-remote-sdk==0.1.3</code>
              </pre>
              <div className={styles.packageName}>qdip-sdk02-bundle-0.1.3.zip</div>
            </article>
            <article className={styles.package}>
              <Code2 className={styles.packageIcon} size={26} aria-hidden />
              <div className={styles.packageVersion}>SDK-03 · v0.1.2 · Node.js</div>
              <h3>{c.clientTitle}</h3>
              <p>{c.clientBody}</p>
              <pre>
                <code>npm install ./qdip-client-0.1.2.tgz</code>
              </pre>
              <div className={styles.packageName}>qdip-client-0.1.2.tgz</div>
            </article>
          </div>
          <div className={styles.releaseNotice} role="status">
            <Download size={19} aria-hidden />
            <div>
              <strong>{c.packageStatus}</strong>
              <p>{c.packageNote}</p>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeading}>
            <p className={styles.eyebrow}>Gateway / Worker / Kernel</p>
            <h2>{c.connect}</h2>
            <p>{c.connectBody}</p>
          </div>
          <div className={styles.flow} aria-label="Worker, Gateway, Kernel, Result">
            <span>Python Worker</span>
            <ArrowRight size={18} aria-hidden />
            <span>Gateway</span>
            <ArrowRight size={18} aria-hidden />
            <span>Managed Kernel</span>
            <ArrowRight size={18} aria-hidden />
            <span>Result / Replay</span>
          </div>
          <div className={styles.featureGrid}>
            <article>
              <h3>{c.managed}</h3>
              <p>{c.managedBody}</p>
            </article>
            <article>
              <h3>{c.external}</h3>
              <p>{c.externalBody}</p>
            </article>
            <article>
              <ShieldCheck size={22} aria-hidden />
              <h3>{c.auth}</h3>
              <p>{c.authBody}</p>
            </article>
            <article>
              <ShieldCheck size={22} aria-hidden />
              <h3>{c.integrity}</h3>
              <p>{c.integrityBody}</p>
            </article>
          </div>
        </section>

        <section className={styles.lastSection}>
          <h2>{c.next}</h2>
          <p>{c.nextBody}</p>
          <Link href={marketingLocaleHref(locale) + '/core'} className={styles.heroLink}>
            {c.readArchitecture} <ArrowRight size={16} aria-hidden />
          </Link>
        </section>
        <MarketingFooter locale={locale} />
      </main>
    </DesignSystemProvider>
  )
}
