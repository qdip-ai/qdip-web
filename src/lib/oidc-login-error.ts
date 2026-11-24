import { NextResponse } from 'next/server'

import { PLATFORM_ORIGINS } from '@/routing-config'
import { safeReturnTo } from './qdip-oidc'

type FailureReason = 'missing-role' | 'expired-flow' | 'invalid-token'

const messages = {
  en: {
    'missing-role': {
      title: 'QDIP access is not assigned',
      detail:
        'Zitadel authenticated your account, but QDIP could not verify the studio or observatory_admin grant for its configured project and organization. If your roles are already assigned, check that the project and organization identifiers match the grant.',
    },
    'expired-flow': {
      title: 'Sign-in session expired',
      detail: 'Start a new sign-in. The Zitadel callback can only be used once; refreshing it will not work.',
    },
    'invalid-token': {
      title: 'Sign-in could not be verified',
      detail: 'Try signing in again. If the problem persists, check the Zitadel application configuration.',
    },
    retry: 'Try signing in again',
    back: 'Back to QDIP',
  },
  uk: {
    'missing-role': {
      title: 'Немає призначеної ролі QDIP',
      detail:
        'Zitadel підтвердив вхід, але QDIP не зміг перевірити роль studio або observatory_admin для налаштованих проєкту й організації. Якщо ролі вже призначені, перевір відповідність ідентифікаторів проєкту й організації.',
    },
    'expired-flow': {
      title: 'Сеанс входу завершився',
      detail: 'Почни новий вхід. OIDC callback одноразовий: оновлювати або повторно відкривати його не можна.',
    },
    'invalid-token': {
      title: 'Не вдалося перевірити вхід',
      detail: 'Спробуй увійти повторно. Якщо помилка повториться, перевір налаштування застосунку Zitadel.',
    },
    retry: 'Спробувати увійти знову',
    back: 'Повернутися на QDIP',
  },
  pl: {
    'missing-role': {
      title: 'Nie przypisano roli QDIP',
      detail:
        'Zitadel uwierzytelnił konto, ale QDIP nie mógł potwierdzić roli studio ani observatory_admin dla skonfigurowanego projektu i organizacji. Jeśli role są już przypisane, sprawdź identyfikatory projektu i organizacji.',
    },
    'expired-flow': {
      title: 'Sesja logowania wygasła',
      detail: 'Rozpocznij nowe logowanie. Adres callback OIDC jest jednorazowy i nie należy go odświeżać.',
    },
    'invalid-token': {
      title: 'Nie udało się zweryfikować logowania',
      detail: 'Spróbuj zalogować się ponownie. Jeśli problem występuje nadal, sprawdź konfigurację Zitadel.',
    },
    retry: 'Zaloguj się ponownie',
    back: 'Wróć do QDIP',
  },
} as const

function htmlEscape(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!
  )
}

export function loginFailurePage(reason: FailureReason, returnTo: string | null | undefined) {
  const safeTarget = safeReturnTo(returnTo)
  const locale = new URL(safeTarget).pathname.split('/')[1]
  const selected = locale === 'pl' || locale === 'uk' ? locale : 'en'
  const copy = messages[selected]
  const message = copy[reason]
  const login = new URL('/api/auth/login', PLATFORM_ORIGINS.site)
  login.searchParams.set('return_to', safeTarget)

  const html = `<!doctype html>
<html lang="${selected}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${htmlEscape(message.title)} · QDIP</title>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#101b2b;color:#f8fafc;font:16px/1.65 system-ui,sans-serif;padding:20px;box-sizing:border-box}
  main{max-width:600px;padding:36px;border:1px solid #334155;border-radius:16px;background:#172338}
  h1{font-size:1.75rem;line-height:1.3;margin:0 0 16px}
  p{color:#cbd5e1;margin:0 0 24px}
  a{display:inline-block;color:#a5f3fc;padding:8px 4px;margin-right:20px}
  a:focus-visible{outline:3px solid #a5f3fc;outline-offset:3px}
</style>
</head>
<body><main><h1>${htmlEscape(message.title)}</h1><p>${htmlEscape(message.detail)}</p>
<a href="${htmlEscape(login.toString())}">${htmlEscape(copy.retry)}</a>
<a href="${htmlEscape(PLATFORM_ORIGINS.site + '/' + selected)}">${htmlEscape(copy.back)}</a>
</main></body></html>`

  return new NextResponse(html, {
    status: reason === 'missing-role' ? 403 : 401,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy':
        "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
    },
  })
}
