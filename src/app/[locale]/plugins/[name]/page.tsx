import { notFound, redirect } from 'next/navigation'
import { PrototypeShell } from '@/features/observatory'
import { publishedPlugins } from '@/lib/observatory-plugin-catalog'
import { buildLocalePath, isSupportedLocale, type Locale } from '@/lib/observatory-i18n'
import { DIP_USE_CASES } from '@/use-cases/registry'

export const dynamic = 'force-dynamic'

const copy = {
  uk: {
    back: 'Усі плагіни',
    version: 'Версія',
    capability: 'Можливість',
    category: 'Категорія',
    demo: 'Відкрити демонстрацію',
    note: 'Публікація в каталозі не надає доступу до виконання плагіна.',
  },
  en: {
    back: 'All plugins',
    version: 'Version',
    capability: 'Capability',
    category: 'Category',
    demo: 'Open demo',
    note: 'Catalog publication does not grant plugin execution permissions.',
  },
  pl: {
    back: 'Wszystkie wtyczki',
    version: 'Wersja',
    capability: 'Funkcja',
    category: 'Kategoria',
    demo: 'Otwórz demo',
    note: 'Publikacja w katalogu nie nadaje uprawnień do wykonania wtyczki.',
  },
} as const

export default async function PluginDetailsPage({ params }: { params: Promise<{ locale: string; name: string }> }) {
  const { locale, name } = await params
  if (!isSupportedLocale(locale) || !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(name)) notFound()
  const plugins = await publishedPlugins()
  // Resolve immutable SDK identity and historical URLs, but expose only published entries.
  const plugin =
    plugins.find((item) => (item.slug || item.name) === name) ??
    plugins.find((item) => item.name === name || item.slug_aliases?.includes(name))
  if (!plugin) notFound()
  const canonicalName = plugin.slug || plugin.name
  if (name !== canonicalName) redirect(buildLocalePath(`/plugins/${canonicalName}`, locale))
  const t = copy[locale]
  const demo = DIP_USE_CASES.find((item) => item.plugin.id === name && item.plugin.capability === plugin.capability_id)
  return (
    <PrototypeShell locale={locale as Locale} activeRoute="/plugins">
      <main className="mx-auto max-w-4xl px-4 py-8 text-slate-100 md:px-8">
        <a className="text-sm font-semibold text-cyan-300" href={buildLocalePath('/plugins', locale)}>
          ← {t.back}
        </a>
        <h1 className="mt-6 break-words text-3xl font-semibold">{plugin.ui?.label || plugin.name}</h1>
        <p className="mt-5 whitespace-pre-line break-words text-base leading-7 text-slate-300">{plugin.description}</p>
        <dl className="mt-8 grid gap-4 rounded-xl border border-white/15 bg-slate-900 p-5 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-slate-400">{t.version}</dt>
            <dd className="mt-1">{plugin.version}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">{t.category}</dt>
            <dd className="mt-1">{plugin.ui?.category || '—'}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs text-slate-400">{t.capability}</dt>
            <dd className="mt-1 break-all font-mono text-sm">{plugin.capability_id}</dd>
          </div>
        </dl>
        {demo && (
          <a
            className="mt-6 inline-block rounded-lg border border-cyan-300/40 px-4 py-3 text-sm font-semibold text-cyan-300"
            href={buildLocalePath(demo.route, locale)}
          >
            {t.demo} →
          </a>
        )}
        <p className="mt-7 text-xs text-slate-500">{t.note}</p>
      </main>
    </PrototypeShell>
  )
}
