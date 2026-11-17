import { createServer } from 'node:http'

// Isolated Playwright Core stand-in. The plugin catalog is unavailable, so the
// legacy demo catalog harness (QDIP_PLAYWRIGHT_LEGACY_CATALOG) is exercised.
// One independent application (APP-PUBLISH-01) is admitted by Core and
// published with an external launch URL; a second one is not admitted.
const application = (over) => ({
  application_id: 'readiness-recovery',
  version: '1',
  launch_url: 'https://rr.qdip.ai',
  required_capabilities: [],
  runtime_binding: { kind: 'sdk-plugin', organization_id: 'e2e-org', plugin_id: 'qdip-rr', plugin_version: '1.0.0' },
  status: 'published',
  revision: 1,
  published_at: '2026-11-17T00:00:00Z',
  published_by: 'e2e-fixture',
  admission: { ready: true, reasons: [] },
  visible: true,
  ...over,
})

const items = [
  application({}),
  application({
    application_id: 'blocked-app',
    launch_url: 'https://blocked.qdip.ai',
    status: 'draft',
    revision: 0,
    admission: { ready: false, reasons: ['RUNTIME_UNAVAILABLE'] },
    visible: false,
  }),
]

createServer((request, response) => {
  if (request.url === '/health') {
    response.writeHead(200).end('ok')
    return
  }
  if (request.url === '/api/v1/applications' && request.headers['x-api-key'] === 'playwright-catalog-only') {
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ items }))
    return
  }
  response.writeHead(503).end('unavailable')
}).listen(3199, '127.0.0.1')
