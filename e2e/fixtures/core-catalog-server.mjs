import { createServer } from 'node:http'

// Isolated Playwright fixture: published RR is admitted by Core, not by a UI bypass.
const record = {
  application_id: 'readiness-recovery',
  version: '1.0.0',
  launch_route: '/readiness-recovery',
  required_capabilities: [],
  runtime_binding: { kind: 'sdk_worker', organization_id: 'e2e-org' },
  status: 'published',
  revision: 1,
  published_at: '2026-11-12T00:00:00Z',
  published_by: 'e2e-fixture',
  admission: { ready: true, reasons: [] },
  visible: true,
}

createServer((request, response) => {
  if (request.url === '/health') {
    response.writeHead(200).end('ok')
    return
  }
  if (request.url === '/api/v1/applications' && request.headers['x-api-key'] === 'playwright-catalog-only') {
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ items: [record] }))
    return
  }
  response.writeHead(503).end('unavailable')
}).listen(3199, '127.0.0.1')
