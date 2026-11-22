# @qdip/client — przewodnik

Node.js >=20, TypeScript tylko po stronie serwera. SDK-03 wywołuje QDIP HTTP, Python SDK-02 obsługuje Workera. Pakiet nie został jeszcze opublikowany w npm. Zbuduj z ustalonego commita: `npm install && npm run build && npm pack`. Sprawdź SHA-256 i zainstaluj archiwum w osobnym projekcie: `npm install /path/to/qdip-client-0.2.0.tgz`.

Uzyskaj osobne klucze organizacyjne z uprawnieniami `plugins:read` i `plugins:execute`. Nie przekazuj ich do przeglądarki ani logów. baseUrl to serwerowy HTTPS origin bez /api.

```ts
import { QdipClient, isActionable } from '@qdip/client';
const client = new QdipClient({
  baseUrl: process.env.QDIP_GATEWAY_URL!,
  apiKey: process.env.QDIP_API_KEY! // tylko serwer: plugins:read + plugins:execute
});
const items = (await client.capabilities.list()).items;
const result = await client.plugins.invoke({capabilityId: 'repairs.plan', input: {capacity_hours: 4, jobs: []}, capabilityVersion: '1'});
if (isActionable(result)) { /* dodatkowo wymagane są reguły biznesowe i autoryzacja */ }
```

SDK waliduje ExecutionResult, ExecutionManifest, SemanticReplayContract, wersje i powiązane skróty. Tylko EXACT + OPTIMAL z rozwiązaniem może być kandydatem do działania. Obsługuj QdipError.code, httpStatus, retryAfter i diagnosticId. Automatyczny retry jest wyłączony, ponieważ brak gwarancji idempotencji. Replay sprawdza tożsamość semantyczną, nie uruchamia ponownie solvera. Lokalne testy kontraktu nie zastępują E2E z prawdziwym Python Workerem.


**Aktualny artefakt:** `@qdip/client` `0.2.0` jest wersją źródłową; tarball dostarcza zatwierdzony operator, a nie publiczny rejestr npm. [Trójjęzyczna instrukcja hosted Gateway](../../docs/i18n/pl/sdk-hosted-gateway-quickstart.md) wymaga osobnych kluczy Workera i klienta; lokalny mock nie dowodzi integracji E2E.
