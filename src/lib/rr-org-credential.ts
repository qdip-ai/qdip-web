import 'server-only'

/**
 * Standalone RR API (qdip-ai/qdip-rr) organization credential for the RR
 * operator BFF. There is no Core RR backend and no shared platform-key
 * fallback: a missing dedicated credential fails closed everywhere.
 */
export function rrOrgApiKey(): string {
  return process.env.RR_ORG_API_KEY?.trim() ?? ''
}
