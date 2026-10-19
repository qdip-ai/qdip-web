import 'server-only'

import { createHash, randomUUID } from 'node:crypto'
import { corePluginConnection } from '@/lib/observatory-plugin-catalog'

/** One generic, admin-only key manager. Plugin identity is data from Core. */
const PLUGIN_ID = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/
const CAPABILITY = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/
const UUID = /^[a-f0-9-]{36}$/i
const RAW_KEY = /^dip-[a-f0-9]{32}$/
const LIMIT = 131_072
const PREFIXES = ['qdip-sdk-app:', 'qdip-sdk-plugin:'] as const
const ROLE_SCOPES = {
  execute: ['plugins:read', 'plugins:execute'],
  worker: ['plugins:register'],
} as const

type Role = keyof typeof ROLE_SCOPES
type CoreOrg = {
  id: string
  name: string
  status?: string
  identity_provider?: string | null
  zitadel_organization_id?: string | null
  zitadel_issuer?: string | null
}
export type VerifiedOrganization = { id: string; issuer: string }
type CoreKey = {
  id: string
  key?: string
  org_id: string
  name: string
  environment: string
  scopes: string[]
  allowed_capabilities: string[] | null
  expires_at: string | null
  revoked_at: string | null
}
type CatalogPlugin = {
  name: string
  plugin_id?: string
  source?: 'embedded' | 'remote'
  enabled: boolean
  capabilities: string[]
  ui?: { label?: string }
  published?: boolean | null
}
export type ConnectedKey = {
  id: string
  orgId: string
  role: Role
  expiresAt: string
  capabilities: string[]
}
export type PluginKeyEntry = {
  id: string
  label: string
  capabilities: string[]
  registered: boolean
  enabled: boolean
  keys: ConnectedKey[]
}
export type PluginKeyInventory = {
  available: PluginKeyEntry[]
  connected: PluginKeyEntry[]
}
export type IssuedPluginKey = {
  pluginId: string
  key: string
  keyId: string
  expiresAt: string
  capabilities: string[]
  role: Role
}

export class DeveloperKeyError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message)
  }
}

const exact = (actual: unknown, expected: read...[truncated]