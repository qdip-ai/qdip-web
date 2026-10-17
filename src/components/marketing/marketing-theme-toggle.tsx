'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { Moon, Sun } from 'lucide-react'
import type { MarketingLocale } from './qdip-copy'
import styles from './marketing-theme-toggle.module.css'

type Appearance = 'dark' | 'light'
const key = 'qdip-marketing-appearance'
const eventName = 'qdip-marketing-appearance-change'
let volatileAppearance: Appearance = 'dark'

const labels = {
  en: { toLight: 'Switch to light theme', toDark: 'Switch to dark theme', light: 'Light theme', dark: 'Dark theme' },
  uk: { toLight: 'Увімкнути світлу тему', toDark: 'Увімкнути темну тему', light: 'Світла тема', dark: 'Темна тема' },
  pl: { toLight: 'Włącz jasny motyw', toDark: 'Włącz ciemny motyw', light: 'Jasny motyw', dark: 'Ciemny motyw' },
} as const

function currentAppearance(): Appearance {
  try {
    return window.localStorage.getItem(key) === 'light' ? 'light' : 'dark'
  } catch {
    return volatileAppearance
  }
}

function subscribeAppearance(callback: () => void) {
  window.addEventListener(eventName, callback)
  window.addEventListener('storage', callback)
  return () => {
    window.removeEventListener(eventName, callback)
    window.removeEventListener('storage', callback)
  }
}

function applyAppearance(appearance: Appearance) {
  const root = document.querySelector<HTMLElement>('[data-ds-theme="burgundy"]')
  if (root) {
    root.dataset.marketingAppearance = appearance
    root.dataset.dsMode = appearance
  }
}

export function MarketingThemeToggle({ locale, onChange }: { locale: MarketingLocale; onChange?: () => void }) {
  const appearance = useSyncExternalStore(subscribeAppearance, currentAppearance, (): Appearance => 'dark')
  useEffect(() => applyAppearance(appearance), [appearance])

  const changeAppearance = () => {
    const next: Appearance = appearance === 'dark' ? 'light' : 'dark'
    volatileAppearance = next
    applyAppearance(next)
    try {
      window.localStorage.setItem(key, next)
    } catch {
      // Keep the in-page switch usable when storage is blocked.
    }
    window.dispatchEvent(new Event(eventName))
    onChange?.()
  }

  const l = labels[locale]
  return (
    <button
      type="button"
      className={styles.toggle}
      data-testid="marketing-theme-toggle"
      aria-pressed={appearance === 'light'}
      aria-label={appearance === 'dark' ? l.toLight : l.toDark}
      title={appearance === 'dark' ? l.toLight : l.toDark}
      onClick={changeAppearance}
    >
      {appearance === 'dark' ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
      <span>{appearance === 'dark' ? l.light : l.dark}</span>
    </button>
  )
}
