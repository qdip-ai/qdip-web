import type { Locale } from '@/lib/observatory-i18n'

// The Doctor browser application owns its own Zitadel OAuth flow and protected
// CP-SAT API. An Observatory session cookie is never forwarded to this host.
const MODEL_DOCTOR_ORIGIN = 'https://doctor.qdip.ai'

export const MODEL_DOCTOR_BRIDGE = {
  session: 'https://doctor.qdip.ai/api/observatory/session',
  execute: 'https://doctor.qdip.ai/api/observatory/doctor',
} as const

export function modelDoctorSignInHref(locale: Locale): string {
  return new URL(`/auth/login?lang=${locale}`, MODEL_DOCTOR_ORIGIN).toString()
}

export function modelDoctorHref(locale: Locale): string {
  return new URL(`/${locale}`, MODEL_DOCTOR_ORIGIN).toString()
}
