import { notFound, redirect } from 'next/navigation'
import { PrototypeShell } from '@/features/observatory'
import { publishedPlugins } from '@/lib/observatory-plugin-catalog'
import { launchLinkForPlugin } from '@/lib/observatory-plugin-launch'
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
    launch: 'Відкрити застосунок',
    launchNote: 'Відкриється у новій вкладці. Може знадобитися авторизація.',
    note: 'Публікація в каталозі не надає доступу до виконання плагіна.',
  },
  en: {
    back: 'All plugins',
    version: 'Version',
    capability: 'Capability',
    category: 'Category',
    demo: 'Open demo',
    launch: 'Open application',
    launchNote: 'Opens in a new tab. Sign-in may be required.',
    note: 'Catalog publication does not grant plugin execution permissions.',
  },
  pl: {
    back: 'Wszystkie wtyczki',
    version: 'Wersja',
    capability: 'Funkcja',
    category: 'Kategoria',
    demo: 'Otwórz demo',
    launch: 'Otwórz aplikację',
    launchNote: 'Otwiera się w nowej karcie. Może być wymagane logowanie.',
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
  const launch = launchLinkForPlugin(plugin)
  const demo = DIP_USE_CASES.find((item) => item.plugin.id === name && item.plugin.capability === plugin.capability_id)
  return (
    <PrototypeShell locale={locale as Locale} activeRoute="/plugins">
      <main className="mx-auto max-w-4xl px-4 py-8 text-slate-100 md:px-8">
        <a className="text-sm font-semibold text-cyan-300" href={buildLocalePath('/plugins', locale)}>
          ← {t.back}
        </a>
        <h1 className="mt-6 break-words text-3xl font-semibold">{plugin.ui?.label || plugin.name}</h1>
        <p className="mt-5 whitespace-pre-line break-words text-base leading-7 text-slate-300">{plugin.description}</p>
        {launch && (
          <div className="mt-7 flex flex-col items-start gap-2">
            <a
              href={launch.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-12 items-center justify-center rounded-lg border border-rose-500/60 bg-rose-950 px-6 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-rose-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-300"
            >
              {t.launch} {launch.application} ↗
            </a>
            <p className="text-xs text-slate-400">{t.launchNote}</p>
          </div>
        )}
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
