import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { PrototypeShell } from '@/features/observatory'
import {
  buildLocalePath,
  isSupportedLocale,
  SUPPORTED_LOCALES,
  type Locale,
} from '@/lib/observatory-i18n'

const copy = {
  uk: {
    eyebrow: 'QDIP / Developers',
    title: 'Розробка плагінів QDIP',
    lead: 'Створіть власний Python Worker із QDIP SDK-02 та викликайте його із серверного застосунку через SDK-03.',
    status: 'Developer preview · тільки контрольований доступ до Gateway',
    limits: 'Публічна документація не означає відкритий доступ до виконання. SDK надаються як перевірені артефакти через оператора; PyPI/npm-релізу та відкритого self-service наразі немає.',
    modes: 'Оберіть режим виконання',
    managed: 'Managed DecisionSpec',
    managedBody: 'Ваш Worker будує DecisionSpec. QDIP Kernel розв’язує задачу, формує результат, manifest та replay. Виклик: plugins.invoke. Це не локальний запуск Kernel у Worker.',
    external: 'Developer-owned structured_result',
    externalBody: 'Worker запускає власний алгоритм і повертає JSON за оголошеною схемою. QDIP перевіряє контракт, але не оптимальність чи правильність алгоритму. Виклик: plugins.evaluate.',
    prereq: '1. Доступ та артефакти',
    prereqBody: 'Потрібні Python 3.11+, Node.js 20+, дозволений Gateway HTTPS/WSS, plugin_id і два окремі ключі: Worker (plugins:register) та caller (plugins:read + plugins:execute) з точною allowlist capability. Оператор передає SDK-02 v0.1.3 ZIP, SDK-03 v0.1.2 TGZ і SHA-256 через довірений канал. Для розробника не потрібен checkout qdip-core.',
    verify: 'Перевірте SHA-256 та встановіть пакети',
    verifyNote: 'Змінні SDK02_SHA256 / SDK03_SHA256 беріть лише з незалежно підтверджених значень оператора. ZIP містить wheel-файли, сумісні з ОС і Python ABI розробника.',
    worker: '2. Напишіть власний Worker',
    workerBody: 'Приклад обчислює суму на стороні розробника та повертає structured_result. Збережіть як worker.py; замініть ідентифікатори на видані оператором. Ніяких ключів у вихідному коді.',
    run: 'Запуск Worker',
    runBody: 'Worker відкриває вихідне WSS-з’єднання, без вхідного порту. Ключ має бути прив’язаний до того самого plugin_id та capability_id.',
    caller: '3. Викличте capability із Node.js',
    callerBody: 'Збережіть код як caller/caller.mjs і запускайте лише на сервері. Caller key не можна передавати браузеру. Приклад повертає результат вашого алгоритму, а не сертифікований Kernel solution.',
    publish: '4. Реєстрація та публікація',
    publishBody: 'Підключений Worker надсилає REGISTER до Gateway. Це створює runtime-реєстрацію, але не публікує і не схвалює плагін. Після перевірки платформа може опублікувати його опис в каталозі Observatory; публікація не замінює security admission чи доступу до виконання.',
    errors: 'Помилки та межі',
    errorsBody: '401/403 — перевірте належність застосунку, scopes, allowlist та статус ключа; 422 — виправте input/schema; 429 — дотримуйтесь Retry-After; 503 — Worker недоступний або перевищено ліміти; 504/втрата відповіді — результат невідомий, без автоматичного повтору side effects. Відкликання ключів забороняє подальші виклики, але не гарантує зупинку вже прийнятої роботи.',
    catalog: 'Каталог плагінів',
    footer: 'Версії прикладів: SDK-02 0.1.3, SDK-03 0.1.2. Hosted E2E незалежного розробника та публічний admission ще не кваліфіковані.',
  },
  en: {
    eyebrow: 'QDIP / Developers',
    title: 'Build QDIP plugins',
    lead: 'Run your own algorithm in a Python SDK-02 Worker and call it from a server application through SDK-03.',
    status: 'Developer preview · controlled Gateway access only',
    limits: 'Public documentation does not imply public execution access. SDK packages are supplied as verified operator handoff artifacts; neither PyPI/npm distribution nor open self-service is available.',
    modes: 'Choose an execution mode',
    managed: 'Managed DecisionSpec',
    managedBody: 'Your Worker produces a DecisionSpec. QDIP Kernel solves it and produces the result, manifest and replay. Call plugins.invoke. The Kernel does not run inside your Worker.',
    external: 'Developer-owned structured_result',
    externalBody: 'Your Worker executes its own algorithm and returns JSON matching a declared schema. QDIP checks the contract, not the algorithm’s correctness or optimality. Call plugins.evaluate.',
    prereq: '1. Access and artifacts',
    prereqBody: 'Requires Python 3.11+, Node.js 20+, an authorized HTTPS/WSS Gateway, plugin_id, and separate Worker (plugins:register) and caller (plugins:read + plugins:execute) keys with an exact capability allowlist. Your operator supplies SDK-02 v0.1.3 ZIP, SDK-03 v0.1.2 TGZ and trusted SHA-256 values. No qdip-core checkout is required on the developer machine.',
    verify: 'Verify SHA-256 and install the packages',
    verifyNote: 'Obtain SDK02_SHA256 / SDK03_SHA256 from an independently trusted operator channel. Python wheels in the ZIP must match the developer OS and Python ABI.',
    worker: '2. Write your own Worker',
    workerBody: 'This original example sums integers inside the developer-owned Worker and returns a structured_result. Save as worker.py and use the operator-issued IDs. Never commit credentials.',
    run: 'Start the Worker',
    runBody: 'The Worker makes an outbound WSS connection. No inbound port is required. Its key must be bound to the same plugin_id and capability_id.',
    caller: '3. Call your capability from Node.js',
    callerBody: 'Save as caller/caller.mjs and run only on the server; never expose the caller key in a browser. The response is an algorithm-owned report, not a Kernel-certified solution.',
    publish: '4. Registration and publication',
    publishBody: 'The connected Worker sends REGISTER to Gateway. This creates runtime registration, not approval or publication. After review, the platform can publish the plugin’s catalog entry in Observatory. Catalog publication never bypasses security admission or execution authorization.',
    errors: 'Errors and boundaries',
    errorsBody: '401/403: check application ownership, scopes, allowlist and key status; 422: fix input/schema; 429: honor Retry-After; 503: Worker unavailable or at capacity; 504/lost response: outcome uncertain, do not auto-retry external side effects. Key revocation blocks future invocations, but cannot guarantee cancellation of already accepted work.',
    catalog: 'Plugin directory',
    footer: 'Example versions: SDK-02 0.1.3 and SDK-03 0.1.2. Independent hosted E2E and public third-party admission are not yet qualified.',
  },
  pl: {
    eyebrow: 'QDIP / Developers',
    title: 'Tworzenie wtyczek QDIP',
    lead: 'Uruchom własny algorytm w Python Worker SDK-02 i wywołaj go z aplikacji serwerowej przez SDK-03.',
    status: 'Developer preview · dostęp do Gateway tylko po zatwierdzeniu',
    limits: 'Publiczna dokumentacja nie oznacza publicznego dostępu do wykonywania. Pakiety SDK przekazuje operator wraz z weryfikowanymi artefaktami; nie ma publikacji PyPI/npm ani otwartego self-service.',
    modes: 'Wybierz tryb wykonania',
    managed: 'Managed DecisionSpec',
    managedBody: 'Worker tworzy DecisionSpec. QDIP Kernel rozwiązuje problem i zwraca wynik, manifest i replay. Wywołanie: plugins.invoke. Kernel nie działa wewnątrz Workera.',
    external: 'Developer-owned structured_result',
    externalBody: 'Worker uruchamia własny algorytm i zwraca JSON zgodny ze schematem. QDIP sprawdza kontrakt, ale nie poprawność ani optymalność algorytmu. Wywołanie: plugins.evaluate.',
    prereq: '1. Dostęp i artefakty',
    prereqBody: 'Wymagane Python 3.11+, Node.js 20+, zatwierdzony Gateway HTTPS/WSS, plugin_id i osobne klucze Worker (plugins:register) oraz caller (plugins:read + plugins:execute) z dokładną listą capability. Operator dostarcza SDK-02 v0.1.3 ZIP, SDK-03 v0.1.2 TGZ i sumy SHA-256. Nie jest potrzebny checkout qdip-core.',
    verify: 'Sprawdź SHA-256 i zainstaluj pakiety',
    verifyNote: 'Wartości SDK02_SHA256 / SDK03_SHA256 należy pobrać z niezależnie zaufanego kanału operatora. Wheel w ZIP musi pasować do systemu i ABI Pythona.',
    worker: '2. Napisz własny Worker',
    workerBody: 'Przykład sumuje liczby we własnym Workerze i zwraca structured_result. Zapisz jako worker.py i użyj identyfikatorów od operatora. Nie zapisuj kluczy w kodzie.',
    run: 'Uruchom Worker',
    runBody: 'Worker otwiera wychodzące połączenie WSS, bez portu przychodzącego. Klucz musi odpowiadać plugin_id i capability_id.',
    caller: '3. Wywołaj capability z Node.js',
    callerBody: 'Zapisz kod jako caller/caller.mjs i uruchom tylko na serwerze; nie ujawniaj caller key w przeglądarce. Wynik pochodzi z algorytmu użytkownika, nie z certyfikowanego Kernel.',
    publish: '4. Rejestracja i publikacja',
    publishBody: 'Po połączeniu Worker wysyła REGISTER do Gateway. Tworzy to rejestrację runtime, ale nie zatwierdza ani nie publikuje wtyczki. Po weryfikacji platforma może opublikować wpis w Observatory. Publikacja nie zastępuje kontroli bezpieczeństwa ani uprawnień wykonania.',
    errors: 'Błędy i ograniczenia',
    errorsBody: '401/403: sprawdź własność aplikacji, scopes, allowlist i klucz; 422: popraw input/schema; 429: przestrzegaj Retry-After; 503: Worker niedostępny lub brak zasobów; 504/utrata odpowiedzi: wynik nieznany, nie ponawiaj automatycznie zewnętrznych działań. Odwołanie klucza blokuje nowe wywołania, ale nie gwarantuje zatrzymania rozpoczętej pracy.',
    catalog: 'Katalog wtyczek',
    footer: 'Wersje przykładów: SDK-02 0.1.3 i SDK-03 0.1.2. Niezależne hosted E2E i publiczne dopuszczanie wtyczek pozostają niezweryfikowane.',
  },
} as const

const verifyInstall = [
  "printf '%s  %s\\n' \"$SDK02_SHA256\" qdip-sdk02-bundle-0.1.3.zip | sha256sum -c -",
  "printf '%s  %s\\n' \"$SDK03_SHA256\" qdip-client-0.1.2.tgz | sha256sum -c -",
  'unzip -q qdip-sdk02-bundle-0.1.3.zip -d sdk02',
  'python3 -m venv .venv-qdip',
  'source .venv-qdip/bin/activate',
  'python -m pip install --no-index --find-links sdk02/wheels qdip-remote-sdk==0.1.3',
  'mkdir caller && cd caller',
  'npm init -y && npm pkg set type=module',
  'npm install ../qdip-client-0.1.2.tgz',
  'cd ..',
].join('\n')

const workerExample = [
  'import asyncio',
  'import os',
  'from qdip_remote_sdk import Worker, WorkerConfig',
  '',
  'config = WorkerConfig(',
  '    server_url=os.environ["QDIP_WORKER_URL"],',
  '    api_key=os.environ["QDIP_WORKER_KEY"],',
  '    plugin_id=os.environ["QDIP_PLUGIN_ID"],',
  '    plugin_version="1",',
  '    capability_id="example.total",',
  '    output_type="structured_result",',
  '    input_schema={',
  '        "type": "object",',
  '        "properties": {"values": {',
  '            "type": "array", "maxItems": 64,',
  '            "items": {"type": "integer"},',
  '        }},',
  '        "required": ["values"],',
  '        "additionalProperties": False,',
  '    },',
  '    result_schema={',
  '        "type": "object",',
  '        "properties": {"total": {"type": "integer"}},',
  '        "required": ["total"],',
  '        "additionalProperties": False,',
  '    },',
  ')',
  '',
  'def evaluate(payload, _decision_id):',
  '    return {"total": sum(payload["values"])}',
  '',
  'asyncio.run(Worker(config, evaluate).run_forever())',
].join('\n')

const workerRun = [
  "export QDIP_WORKER_URL='wss://<gateway-host>/api/v1/remote-plugins/connect'",
  "export QDIP_PLUGIN_ID='<operator-issued-plugin-id>'",
  "read -r -s -p 'Worker key: ' QDIP_WORKER_KEY; printf '\\n'",
  'export QDIP_WORKER_KEY',
  'python worker.py',
].join('\n')

const callerRun = [
  'cd caller',
  "export QDIP_GATEWAY_URL='https://<gateway-host>/'",
  "read -r -s -p 'Caller key: ' QDIP_CALLER_KEY; printf '\\n'",
  'export QDIP_CALLER_KEY',
  'node caller.mjs',
].join('\n')

const callerExample = [
  "import { QdipClient } from '@qdip/client';",
  '',
  'const client = new QdipClient({',
  '  baseUrl: process.env.QDIP_GATEWAY_URL,',
  '  apiKey: process.env.QDIP_CALLER_KEY,',
  '});',
  'const response = await client.plugins.evaluate({',
  "  capabilityId: 'example.total',",
  "  capabilityVersion: '1',",
  '  input: { values: [1, 2, 3] },',
  '  timeoutSeconds: 10, deadlineMs: 45_000,',
  '});',
  'console.log(response.result); // { total: 6 }; not Kernel-verified',
].join('\n')

function CodeSample({ children }: { children: string }) {
  return (
    <pre
      className="mt-4 overflow-x-auto rounded-xl border border-white/15 bg-slate-950/80 p-4 text-sm leading-6 text-slate-100"
    >
      <code>{children}</code>
    </pre>
  )
}

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }))
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  if (!isSupportedLocale(locale)) return {}
  return {
    title: copy[locale].title + ' — QDIP Observatory',
    description: copy[locale].lead,
  }
}

export default async function DeveloperGuidePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isSupportedLocale(locale)) notFound()
  const t = copy[locale]
  const section = 'mt-12 border-t border-white/15 pt-8'
  const heading = 'text-xl font-semibold text-white md:text-2xl'
  const paragraph = 'mt-4 max-w-4xl text-base leading-8 text-slate-300'

  return (
    <PrototypeShell locale={locale as Locale} activeRoute="/developers" theme="cyan">
      <main className="mx-auto max-w-5xl px-4 pb-20 pt-8 text-slate-100 md:px-8 md:pt-12">
        <p className="text-xs font-semibold uppercase tracking-[.16em] text-cyan-300">{t.eyebrow}</p>
        <h1 className="mt-4 text-3xl font-medium tracking-tight md:text-5xl">{t.title}</h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-200">{t.lead}</p>
        <p className="mt-5 text-sm font-semibold text-amber-200">{t.status}</p>
        <p className={paragraph}>{t.limits}</p>

        <section className={section} aria-labelledby="sdk-modes">
          <h2 id="sdk-modes" className={heading}>{t.modes}</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <article className="rounded-xl border border-white/15 bg-white/5 p-5">
              <h3 className="text-lg font-semibold">{t.managed}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-300">{t.managedBody}</p>
            </article>
            <article className="rounded-xl border border-white/15 bg-white/5 p-5">
              <h3 className="text-lg font-semibold">{t.external}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-300">{t.externalBody}</p>
            </article>
          </div>
        </section>

        <section className={section} aria-labelledby="sdk-prerequisites">
          <h2 id="sdk-prerequisites" className={heading}>{t.prereq}</h2>
          <p className={paragraph}>{t.prereqBody}</p>
          <h3 className="mt-6 text-lg font-semibold">{t.verify}</h3>
          <p className={paragraph}>{t.verifyNote}</p>
          <CodeSample>{verifyInstall}</CodeSample>
        </section>

        <section className={section} aria-labelledby="sdk-worker">
          <h2 id="sdk-worker" className={heading}>{t.worker}</h2>
          <p className={paragraph}>{t.workerBody}</p>
          <CodeSample>{workerExample}</CodeSample>
          <h3 className="mt-6 text-lg font-semibold">{t.run}</h3>
          <p className={paragraph}>{t.runBody}</p>
          <CodeSample>{workerRun}</CodeSample>
        </section>

        <section className={section} aria-labelledby="sdk-caller">
          <h2 id="sdk-caller" className={heading}>{t.caller}</h2>
          <p className={paragraph}>{t.callerBody}</p>
          <CodeSample>{callerExample}</CodeSample>
          <CodeSample>{callerRun}</CodeSample>
        </section>

        <section className={section} aria-labelledby="sdk-publication">
          <h2 id="sdk-publication" className={heading}>{t.publish}</h2>
          <p className={paragraph}>{t.publishBody}</p>
          <a
            href={buildLocalePath('/plugins', locale)}
            className="mt-5 inline-flex min-h-11 items-center rounded-lg border border-cyan-400/40 px-4 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-400/10"
          >
            {t.catalog}
          </a>
        </section>

        <section className={section} aria-labelledby="sdk-errors">
          <h2 id="sdk-errors" className={heading}>{t.errors}</h2>
          <p className={paragraph}>{t.errorsBody}</p>
          <p className="mt-8 border-t border-white/10 pt-5 text-sm leading-7 text-slate-400">{t.footer}</p>
        </section>
      </main>
    </PrototypeShell>
  )
}
