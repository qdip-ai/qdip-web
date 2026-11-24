import { render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { I18nProvider } from './provider'

afterEach(() => {
  document.documentElement.lang = 'en'
})

describe('I18nProvider document language', () => {
  it.each(['en', 'uk', 'pl'] as const)('sets html lang to %s', (locale) => {
    render(
      <I18nProvider locale={locale}>
        <span>Content</span>
      </I18nProvider>
    )

    expect(document.documentElement.lang).toBe(locale)
  })

  it('updates html lang when locale changes without a page reload', () => {
    const { rerender } = render(
      <I18nProvider locale="uk">
        <span>Content</span>
      </I18nProvider>
    )
    expect(document.documentElement.lang).toBe('uk')

    rerender(
      <I18nProvider locale="pl">
        <span>Content</span>
      </I18nProvider>
    )
    expect(document.documentElement.lang).toBe('pl')
  })
})
