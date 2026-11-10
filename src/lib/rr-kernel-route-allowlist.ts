/** Strict, deny-by-default RR proxy surface. Never proxy arbitrary plugin paths. */
const identifier = /^[A-Za-z0-9_.-]{1,128}$/

export function allowedKernelPath(path: string[], method: string) {
  if (path.some((part) => !identifier.test(part) || part === '.' || part === '..')) return false
  if (path.length === 1 && path[0] === 'preflight') return method === 'POST'
  if (path[0] === 'economic-v2') {
    if (path.length === 2 && path[1] === 'scenario-advice') return method === 'POST'
    if (path.length === 3 && path[1] === 'scenario-advice') return method === 'GET'
    if (path.length === 2 && path[1] === 'advice') return method === 'POST' || method === 'GET'
    if (path.length === 2 && ['preflight', 'snapshots'].includes(path[1])) return method === 'POST'
    if (path.length === 3 && path[1] === 'advice') return method === 'GET'
    if (path.length === 4 && path[1] === 'advice' && path[3] === 'integrity') return method === 'GET'
    return false
  }
  if (path[0] === 'source-import') {
    if (path.length === 2 && ['preflight', 'executions'].includes(path[1])) return method === 'POST'
    if (path.length === 4 && path[1] === 'executions' && path[3] === 'replan') return method === 'POST'
    return false
  }
  if (path.length === 1 && path[0] === 'executions') return method === 'POST'
  if (path[0] === 'executions' && path.length === 2) return method === 'GET'
  if (path[0] === 'executions' && path.length === 3) {
    return (
      (path[2] === 'replan' && method === 'POST') ||
      (['replay-verification', 'presentation'].includes(path[2]) && method === 'GET')
    )
  }
  if (path[0] === 'decisions' && path.length === 3) {
    return method === 'GET' && ['history', 'history-integrity'].includes(path[2])
  }
  if (path[0] === 'decisions' && path.length === 4) {
    return method === 'GET' && path[2] === 'history' && path[3] === 'verified-export-page'
  }
  return false
}
