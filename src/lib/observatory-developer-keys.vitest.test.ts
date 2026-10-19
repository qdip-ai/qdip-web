import { createHash } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/observatory-plugin-catalog', () => ({
  corePluginConnection: () => ({
    base: 'https://core.qdip.test',
    key: 'PRIVATE-PLATFORM-ADMIN',
  }),
}))
import { issuePluginCredential, listPluginCredentials, revokePluginCredential } from './observatory-developer-keys'

const ORG = '12345678-1234-4234-8234-123456789abc'
const ZITADEL_ID = '11111111111111111111'
const OWNER = { id: ZITADEL_ID, issuer: 'https://zitadel.example.test' }
const WRONG_OWNER = { id: '22222222222222222222', issuer: OWNER.issuer }
const KEY_ID = '12345678-1234-4234-8234-123456789abd'
const SECRET = 'dip-' + 'a'.repeat(32)
const CAPS = ['sample.plan', 'sample.validate']
const remoteId = (tenant: string, pluginId: string) => {
  const fingerprint = createHash('sha256')
    .update(tenant + '\0' + pluginId)
    .digest('hex')
    .slice(0, 16)
  return 'remote-' + fingerprint + '-' + pluginId
}
const expires = () => new Date(Date.now() + 30 * 86_400_000).toISOString()
const plugin = {
  name: 'sample',
  plugin_id: 'sample',
  enabled: true,
  capabilities: CAPS,
  ui: { label: 'Sample Planner' },
}
const org = {
  id: ORG,
  name: 'QDIP',
  status: 'active',
  identity_provider: 'zitadel',
  zitadel_organization_id: ZITADEL_ID,
  zitadel_issuer: OWNER.issuer,
}

const key = () => ({
  id: KEY_ID,
  key: SECRET,
  org_id: ORG,
  name: 'access/sample/' + KEY_ID,
  environment: 'production',
  scopes: ['plugins:read', 'plugins:execute'],
  allowed_capabilities: CAPS,
  expires_at: expires(),
  revoked_at: null,
})

afterEach(() => vi.unstubAllGlobals())

describe('Generic developer plugin keys', () => {
  it('issues scoped Worker credentials into the linked Core UUID, not a new pseudo-organization', async () => {
    const capability = 'new-plugin.run'
    let createdName = ''
    let keySaved = false
    const calls: string[] = []
    vi.stubGlobal...[truncated]