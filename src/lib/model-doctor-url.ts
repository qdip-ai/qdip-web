import type { Locale } from '@/lib/observatory-i18n'

// The Doctor browser application owns its own Zitadel OAuth flow and protected
// CP-SAT API. An Observatory session cookie is never forwarded to this host.
const MODEL_DOCTOR_ORIGIN = 'https://doctor.qdip.ai'

export function modelDoctorHref(locale: Locale): string {
  return new URL(`/${locale}`, MODEL_DOCTOR_ORIGIN).toString()
}
