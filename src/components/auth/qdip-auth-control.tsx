'use client'

import Image from 'next/image'

import { LogIn, LogOut, UserRound } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { PLATFORM_URLS, type PlatformLocale } from '@/lib/platform-urls'
import styles from './qdip-auth-control.module.css'

type ProfilePlacement = {
  top: number
  maxHeight: number
  theme: string
  mode: string
}

type AuthSession = {
  configured: boolean
  authenticated: boolean
  studio: boolean
  operator: boolean
  observatoryAdmin?: boolean
  user?: { id: string; displayName: string | null; email: string | null }
}

const labels = {
  en: {
    signIn: 'Sign in',
    signOut: 'Sign out',
    signedIn: 'Signed in',
    signOutFailed: 'Could not sign out',
    account: 'Account',
    roles: 'Access roles',
    admin: 'Observatory admin',
    studio: 'Studio',
    operator: 'RR operator',
  },
  uk: {
    signIn: 'Увійти',
    signOut: 'Вийти',
    signedIn: 'Ви увійшли',
    signOutFailed: 'Не вдалося вийти',
    account: 'Обліковий запис',
    roles: 'Ролі доступу',
    admin: 'Адміністратор Observatory',
    studio: 'Studio',
    operator: 'Оператор RR',
  },
  pl: {
    signIn: 'Zaloguj się',
    signOut: 'Wyloguj się',
    signedIn: 'Zalogowano',
    signOutFailed: 'Nie udało się wylogować',
    account: 'Konto',
    roles: 'Role dostępu',
    admin: 'Administrator Observatory',
    studio: 'Studio',
    operator: 'Operator RR',
  },
} as const

function loginHref(returnTo: string) {
  const url = new URL('/api/auth/login', PLATFORM_URLS.site)
  url.searchParams.set('return_to', returnTo)
  return url.toString()
}

/** Only public session flags are read; roles and tokens are never stored in browser state. */
export function QdipAuthControl({
  locale,
  returnTo,
  iconOnly = false,
  showProfile = false,
}: {
  locale: PlatformLocale
  returnTo: string
  /** Marketing header can render an accessible icon-only control without changing product headers. */
  iconOnly?: boolean
  /** Use the full account menu in Observatory; other surfaces retain their compact auth control. */
  showProfile?: boolean
}) {
  const copy = labels[locale]
  const [session, setSession] = useState<AuthSession | null>(null)
  const [signingOut, setSigningOut] = useState(false)
  const [error, setError] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)
  const profilePanelRef = useRef<HTMLDivElement>(null)
  const [profilePlacement, setProfilePlacement] = useState<ProfilePlacement | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    void fetch('/api/auth/session', { cache: 'no-store', credentials: 'same-origin', signal: controller.signal })
      .then(async (response): Promise<AuthSession | null> => (response.ok ? response.json() : null))
      .then((value) => {
        if (!controller.signal.aborted) setSession(value)
      })
      .catch(() => {
        // A failed session check must not prevent the user from reaching login.
      })
    return () => controller.abort()
  }, [])

  // Match Yara's avatar button: close the popover on outside press or Escape.
  useEffect(() => {
    if (!profileOpen) return
    const measure = () => {
      const trigger = profileRef.current?.querySelector('button')
      if (!trigger) return
      const box = trigger.getBoundingClientRect()
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight
      const top = Math.max(12, Math.min(Math.round(box.bottom + 8), viewportHeight - 132))
      const shell = trigger.closest('[data-ds-theme]')
      setProfilePlacement({
        top,
        maxHeight: Math.max(120, viewportHeight - top - 12),
        theme: shell?.getAttribute('data-ds-theme') ?? 'cyan',
        mode: shell?.getAttribute('data-ds-mode') ?? 'dark',
      })
    }
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    window.visualViewport?.addEventListener('resize', measure)
    const onPointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !profileRef.current?.contains(event.target) &&
        !profilePanelRef.current?.contains(event.target)
      ) {
        setProfileOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setProfileOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
      window.visualViewport?.removeEventListener('resize', measure)
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [profileOpen])

  async function signOut() {
    if (signingOut) return
    setSigningOut(true)
    setError(false)
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
      })
      if (!response.ok) throw new Error('Logout failed')
      setSession(null)
      // Refresh privileged surfaces so no stale operator view remains on screen.
      window.location.reload()
    } catch {
      setError(true)
    } finally {
      setSigningOut(false)
    }
  }

  if (session?.authenticated && showProfile) {
    const identity = session.user
    const display = identity?.displayName || identity?.email || copy.account
    const roles = [
      ...(session.observatoryAdmin ? [copy.admin] : []),
      ...(session.studio ? [copy.studio] : []),
      ...(session.operator ? [copy.operator] : []),
    ]
    return (
      <div ref={profileRef} className={styles.authControl} data-qdip-auth="signed-in" data-testid="observatory-profile">
        <button
          type="button"
          className={styles.profileToggle}
          aria-label={`${copy.account}: ${display}`}
          aria-haspopup="dialog"
          aria-expanded={profileOpen}
          onClick={() => setProfileOpen((open) => !open)}
        >
          <UserRound size={22} aria-hidden />
        </button>
        {profileOpen &&
          profilePlacement &&
          createPortal(
            <div
              className={styles.profilePortal}
              data-ds-theme={profilePlacement.theme}
              data-ds-mode={profilePlacement.mode}
            >
              <div
                ref={profilePanelRef}
                className={styles.profilePanel}
                role="dialog"
                aria-label={copy.account}
                style={{ top: profilePlacement.top, maxHeight: profilePlacement.maxHeight }}
              >
                <p className={styles.profileTitle}>{copy.account}</p>
                <strong className={styles.profileName}>{display}</strong>
                {identity?.email && identity.email !== display ? (
                  <span className={styles.profileEmail}>{identity.email}</span>
                ) : null}
                <p className={styles.profileTitle}>{copy.roles}</p>
                <div className={styles.roleList}>
                  {roles.length ? (
                    roles.map((role) => (
                      <span className={styles.roleChip} key={role}>
                        {role}
                      </span>
                    ))
                  ) : (
                    <span className={styles.profileEmpty}>—</span>
                  )}
                </div>
                <button
                  className={styles.profileSignOut}
                  type="button"
                  disabled={signingOut}
                  onClick={() => void signOut()}
                >
                  <LogOut size={16} aria-hidden />
                  {copy.signOut}
                </button>
                {error ? (
                  <span className={styles.error} role="alert">
                    {copy.signOutFailed}
                  </span>
                ) : null}
              </div>
            </div>,
            document.body
          )}
      </div>
    )
  }

  if (session?.authenticated) {
    return (
      <div className={styles.authControl} data-qdip-auth="signed-in">
        {!iconOnly && <span className={styles.signedIn}>{copy.signedIn}</span>}
        <button
          className={iconOnly ? `${styles.action} ${styles.iconOnly}` : styles.action}
          type="button"
          disabled={signingOut}
          onClick={() => void signOut()}
          aria-label={copy.signOut}
        >
          {iconOnly ? <LogOut size={24} aria-hidden /> : <LogOut size={16} aria-hidden />}
          {!iconOnly && <span>{copy.signOut}</span>}
        </button>
        {error ? (
          <span className={styles.error} role="alert">
            {copy.signOutFailed}
          </span>
        ) : null}
      </div>
    )
  }

  return (
    <a
      className={iconOnly ? `${styles.action} ${styles.iconOnly}` : styles.action}
      data-qdip-auth="signed-out"
      href={loginHref(returnTo)}
      aria-label={copy.signIn}
      title={copy.signIn}
    >
      {iconOnly ? (
        <Image src="/auth-smile-lock.svg" width={24} height={24} alt="" aria-hidden unoptimized />
      ) : (
        <LogIn size={16} aria-hidden />
      )}
      {!iconOnly && <span>{copy.signIn}</span>}
    </a>
  )
}
