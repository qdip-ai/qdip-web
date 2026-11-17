import { createServer } from 'node:http'

// Isolated Playwright Core stand-in: the plugin catalog is unavailable, so the
// legacy demo catalog harness (QDIP_PLAYWRIGHT_LEGACY_CATALOG) is exercised.
createServer((request, response) => {
  if (request.url === '/health') {
    response.writeHead(200).end('ok')
    return
  }
  response.writeHead(503).end('unavailable')
}).listen(3199, '127.0.0.1')
