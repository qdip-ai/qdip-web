import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const renderDirectories = [
  new URL('../components/observatory/', import.meta.url),
  new URL('../features/supply-network-optimization/', import.meta.url),
  new URL('../features/resource-allocation/components/', import.meta.url),
  new URL('../features/decision-challenge/', import.meta.url),
  new URL('../features/gtm-lab/components/', import.meta.url),
  new URL('../use-cases/contractor-allocation/', import.meta.url),
  new URL('../app/[locale]/challenges/', import.meta.url),
]

function renderFiles() {
  return renderDirectories.flatMap((directory) =>
    readdirSync(fileURLToPath(directory), { withFileTypes: true })
      .filter(
        (entry) =>
          entry.isFile() &&
          entry.name.endsWith('.tsx') &&
          !entry.name.includes('.test.') &&
          !entry.name.includes('.spec.')
      )
      .map((entry) => new URL(entry.name, directory))
  )
}

describe('Observatory i18n architecture', () => {
  it('keeps locale resources out of render components and route pages', () => {
    for (const file of renderFiles()) {
      const source = readFileSync(file, 'utf8')
      expect(source, file.pathname).not.toContain('const copy =')
      expect(source, file.pathname).not.toContain('const labels =')
      expect(source, file.pathname).not.toContain("locale === 'uk'")
      expect(source, file.pathname).not.toContain("locale === 'pl'")
      expect(source, file.pathname).not.toMatch(/[\u0400-\u04FF]/)
      expect(source, file.pathname).not.toMatch(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/)
      expect(source, file.pathname).not.toMatch(/\b(?:en|uk|pl)\s*:/)
      expect(source, file.pathname).not.toContain('Record<Locale')
    }
  })
})
