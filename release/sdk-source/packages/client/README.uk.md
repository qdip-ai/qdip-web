# @qdip/client — короткий посібник

Node.js >=20, тільки серверний TypeScript. SDK-03 — клієнт виклику QDIP, тоді як Python SDK-02 — Worker. npm-реліз ще не виконаний. Зберіть пакет з точного коміту командами `npm install && npm run build && npm pack`, перевірте SHA-256 і встановіть архів в окремому проєкті: `npm install /path/to/qdip-client-0.2.0.tgz`.

Створіть два організаційні ключі з окремими правами `plugins:read` та `plugins:execute`. Не передавайте їх у браузер або журнали. Адреса — HTTPS origin без /api.

```ts
import { QdipClient, isActionable } from '@qdip/client';
const client = new QdipClient({
  baseUrl: process.env.QDIP_GATEWAY_URL!,
  apiKey: process.env.QDIP_API_KEY! // лише сервер: plugins:read + plugins:execute
});
const items = (await client.capabilities.list()).items;
const result = await client.plugins.invoke({capabilityId: 'repairs.plan', input: {capacity_hours: 4, jobs: []}, capabilityVersion: '1'});
if (isActionable(result)) { /* ще потрібні доменні перевірки та схвалення користувача */ }
```

SDK перевіряє ExecutionResult, ExecutionManifest, SemanticReplayContract, версії й хеші. Тільки EXACT + OPTIMAL із розв’язком може бути кандидатом на дію. Обробляйте QdipError.code, httpStatus, retryAfter, diagnosticId. Немає автоматичних повторів, бо платформа не гарантує ідемпотентності. Replay засвідчує семантичну відповідність, а не повторне виконання solver. Локальні контрактні тести не замінюють E2E із реальним Python Worker.


## Єдина реєстрація плагінів у каталозі

Усі плагіни реєструються через відповідний SDK. Віддалений Python Worker
надсилає Manifest у `REGISTER` через SDK-02; встановлений локально плагін
реєструється через Python SDK-01. Різниця місця виконання не створює
другого реєстру. Gateway формує єдину проєкцію для каталогу QDIP.

Тільки **серверний** адміністратор Observatory використовує клієнтські методи:

```ts
const sdk = new QdipClient({
  baseUrl: process.env.QDIP_API_URL!,
  adminApiKey: process.env.QDIP_PLATFORM_ADMIN_API_KEY!,
})
const registered = await sdk.catalog.list()
await sdk.catalog.publish(registered[0].name, {
  published: true,
  expectedRevision: registered[0].revision,
  capabilityId: registered[0].capabilities[0],
  pluginVersion: registered[0].version,
  actor: verifiedZitadelSession.sub,
  displayName: 'Yara — AI-помічник',
  description: 'Планування задач та календаря',
  category: 'Productivity',
})
```

`adminApiKey` ніколи не передається до браузера. SDK не створює API-ключ,
не завантажує код і не обходить permission gates Core. Ідентифікатори
внутрішніх організацій не є полями інтерфейсу Observatory. Якщо Worker
від’єднався, його публікація приховується до відновлення з’єднання.


## Route Optimizer через наявний @qdip/client (приватний канал)

`routes.solveAddresses()` та `routes.solveCoordinates()` — додані методи
того самого SDK, **без другого Gateway чи зміни Kernel**. Вони надсилають
дані тільки приватному SDK-входу, який перевіряє організацію та викликає Route Worker, а не до
`plugins.invoke()` / `PluginRuntime`: звичайний audit QDIP записував би
повні адреси й координати. Для маршрутизації потрібен *окремий*
організаційний API-ключ із `plugins:execute` і capability
`route-optimizer.customer-address-vrp.v1` або
`route-optimizer.customer-coordinate-vrp.v1`. Платформний ключ не підходить.

```ts
import { QdipClient } from '@qdip/client';

const sdk = new QdipClient({
  // Відкритий QDIP API залишається для інших дій; маршрути сюди не надсилаються.
  baseUrl: process.env.QDIP_API_URL!,
  privateRouteBaseUrl: process.env.QDIP_RO_SDK_INGRESS_PRIVATE_URL!,
  routeApiKey: process.env.QDIP_ROUTE_ORG_API_KEY!,
});

const route = await sdk.routes.solveAddresses({
  city: 'warsaw',
  depot_address: 'Marszałkowska 18, Warsaw',
  driver_count: 2,
  deliveries: [
    { id: 'ORDER_001', address: 'Marszałkowska 32, Warsaw' },
  ],
});
if (route.status === 'FEASIBLE') {
  // Далі перевірка/підтвердження маршруту в застосунку.
}
```

Адреса SDK-входу дозволена тільки у приватній мережі: `route-worker` Docker,
`.railway.internal`, `.svc.cluster.local` або приватний IPv4.
Для локального `http://127.0.0.1:8018` потрібно явно вказати
`allowInsecureLoopback: true`. Ключ **тільки на backend**, не в браузері.
Немає автоматичних retry, бо збережена ідемпотентність ще не реалізована.
На production SDK-вході прапорці маршрутизації вже ввімкнені; у публічному Core customer route endpoints не змонтовані. Не відкривайте
SDK-вхід або Route Worker публічним доменом: при звичайному SDK-виклику через QDIP Gateway
не можна обійти його Mongo audit. Приватний канал — це навмисно окрема
транспортна ціль в існуючому SDK, а не нова реєстрація публічної capability.

Щоб запустити локальний стек, дивіться
`docs/plugins/route-optimizer.md` і
`docker-compose.route-optimizer.yml`. Приватну production-авторизацію,
доробку idempotency і економіку даних відстежує #393.


**Поточний артефакт:** `@qdip/client` `0.2.0` у вихідному коді. Tarball передає уповноважений оператор; публічний npm-реліз не підтверджено. [Hosted Gateway інструкція українською](../../docs/i18n/uk/sdk-hosted-gateway-quickstart.md) розділяє Worker і caller ключі. Локальний mock не доводить E2E.
