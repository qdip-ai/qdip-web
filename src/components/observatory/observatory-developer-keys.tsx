'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type { Locale } from '@/lib/observatory-i18n'
import styles from './observatory-developer-keys.module.css'

type ConnectedKey = {
  id: string
  orgId: string
  role: 'execute' | 'worker'
  expiresAt: string
  capabilities: string[]
}
type Plugin = {
  id: string
  label: string
  capabilities: string[]
  registered: boolean
  enabled: boolean
  keys: ConnectedKey[]
}
type Inventory = { available: Plugin[]; connected: Plugin[] }
type OwnedOrganization = { id: string; name: string; state: 'active' }
type Issued = {
  pluginId: string
  key: string
  keyId: string
  role: 'execute' | 'worker'
  expiresAt: string
  capabilities: string[]
}

const translations = {
  uk: {
    ownerTitle: 'Мої організації Zitadel',
    ownerHelp:
      'Підтверджені організації, де ви маєте роль ORG_OWNER. Це перевірка власності, а не привʼязка плагінів. Міграцію чинних плагінів ще не виконано.',
    ownerEmpty: 'Організацій з підтвердженими правами власника не знайдено.',
    ownerUnavailable: 'Перевірка власності через Zitadel недоступна. Нову організацію QDIP автоматично не створюємо.',
    ownerSelect: 'Використовувати цю організацію',
    ownerSelecting: 'Перевірка…',
    ownerLinked: 'Організацію підтверджено. Міграцію плагінів ще не виконано.',
    ownerLinkError: 'Прив’язку організації відхилено. Ключі плагінів не змінено.',
    title: 'Ключі та підключення плагінів',
    description:
      'Виберіть будь-який зареєстрований плагін або підготуйте ключ для нового. Ключ обмежений обраними можливостями.',
    available: 'Доступні для підключення',
    connected: 'Ключі вже видано',
    emptyAvailable: 'Усі доступні плагіни мають активні ключі.',
    emptyConnected: 'Активних ключів поки немає.',
    loading: 'Завантаження каталогу…',
    error: 'Не вдалося завантажити каталог і ключі QDIP.',
    select: 'Плагін',
    capabilities: 'Дозволені можливості',
    role: 'Тип ключа',
    execute: ...[truncated]