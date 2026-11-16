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
  if (path[0] === 'forecasts') {
    // RR Future Engine (mode B) on the standalone RR API; sealed artifacts only.
    const [, kind, id, action] = path
    if (path.length === 2) return method === 'POST' && ['parts', 'decisions', 'portfolio'].includes(kind)
    if (path.length === 3)
      return method === 'GET' && ['parts', 'decisions', 'portfolio', 'purchase-order-reviews'].includes(kind) && !!id
    if (path.length === 4 && kind === 'portfolio')
      return (
        (action === 'purchase-order-drafts' && method === 'GET') ||
        (action === 'purchase-order-reviews' && method === 'POST')
      )
    if (path.length === 4 && kind === 'purchase-order-reviews') return action === 'export.csv' && method === 'GET'
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
