import { PrototypeShell } from '@/features/observatory'
import { publishedPlugins, visiblePluginUseCaseIds } from '@/lib/observatory-plugin-catalog'
import { buildLocalePath, isSupportedLocale, type Locale } from '@/lib/observatory-i18n'
import { DIP_USE_CASES } from '@/use-cases/registry'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

const copy = {
  uk: {
    title: 'Каталог плагінів',
    intro: 'Опубліковані можливості QDIP Core та готові демонстраційні застосунки.',
    installed: 'Опубліковані плагіни',
    demos: 'Готові демонстрації',
    none: 'Наразі немає опублікованих плагінів.',
    details: 'Деталі',
    demo: 'Відкрити демонстрацію',
    capability: 'Можливість',
  },
  en: {
    title: 'Plugin catalog',
    intro: 'Published QDIP Core capabilities and existing demonstration applications.',
    installed: 'Published plugins',
    demos: 'Existing demonstrations',
    none: 'No plugins have been published yet.',
    details: 'Details',
    demo: 'Open demo',
    capability: 'Capability',
  },
  pl: {
    title: 'Katalog wtyczek',
    intro: 'Opublikowane funkcje QDIP Core i istniejące aplikacje demonstracyjne.',
    installed: 'Opublikowane wtyczki',
    demos: 'Dostępne demonstracje',
    none: 'Brak opublikowanych wtyczek.',
    details: 'Szczegóły',
    demo: 'Otwórz demonstrację',
    capability: 'Funkcja',
  },
} as const

export default async function PluginDirectoryPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isSupportedLocale(locale)) notFound()
  const t = copy[locale]
  const [plugins, visibleIds] = await Promise.all([publishedPlugins(), visiblePluginUseCaseIds()])
  const demos = DIP_USE_CASES.filter((demo) => visibleIds.includes(demo.id))
  return (
    <PrototypeShell locale={locale as Locale} activeRoute="/plugins">
      <main className="mx-auto max-w-6xl px-4 py-8 md:px-8">
        <h1 className="text-3xl font-semibold text-slate-100">{t.title}</h1>
        <p className="mt-3 max-w-3xl text-slate-400">{t.intro}</p>
        <h2 className="mt-10 text-xl font-semibold text-slate-100">{t.installed}</h2>
        {plugins.length === 0 && <p className="mt-4 text-slate-400">{t.none}</p>}
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {plugins.map((plugin) => (
            <a
              key={plugin.name}
              href={buildLocalePath(`/plugins/${plugin.slug || plugin.name}`, locale)}
              className="block min-w-0 rounded-xl border border-white/15 bg-slate-900 p-5 hover:border-cyan-300/50"
            >
              <h3 className="break-words text-lg font-semibold text-white">{plugin.ui?.label || plugin.name}</h3>
              <p className="mt-2 line-clamp-3 break-words text-sm leading-6 text-slate-400">{plugin.description}</p>
              <p className="mt-4 text-sm font-semibold text-cyan-300">{t.details} →</p>
            </a>
          ))}
        </div>
        {demos.length > 0 && (
          <section className="mt-12">
            <h2 className="text-xl font-semibold text-slate-100">{t.demos}</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {demos.map((demo) => (
                <a
                  key={demo.id}
                  href={buildLocalePath(demo.route, locale)}
                  className="block rounded-xl border border-white/15 bg-slate-900 p-5 text-slate-100 hover:border-cyan-300/50"
                >
                  <strong className="block break-words">{demo.id}</strong>
                  <span className="mt-3 block text-sm text-cyan-300">{t.demo} →</span>
                </a>
              ))}
            </div>
          </section>
        )}
      </main>
    </PrototypeShell>
  )
}
