import { PrototypeShell } from '@/features/observatory'
import { publishedPlugins, visiblePluginUseCaseIds } from '@/lib/observatory-plugin-catalog'
import { launchLinkForPlugin } from '@/lib/observatory-plugin-launch'
import { pluginCategoryLabel } from '@/lib/observatory-plugin-categories'
import { buildLocalePath, isSupportedLocale, type Locale } from '@/lib/observatory-i18n'
import { DIP_USE_CASES } from '@/use-cases/registry'
import { notFound } from 'next/navigation'
import styles from '@/components/observatory/plugin-experience.module.css'
import { PluginLaunchLink } from '@/components/observatory/plugin-launch-link'

export const dynamic = 'force-dynamic'

const copy = {
  uk: {
    eyebrow: 'QDIP / Плагіни',
    title: 'Плагіни та застосунки',
    intro: 'Інструменти на базі QDIP. Відкрийте застосунок або перегляньте його можливості перед використанням.',
    installed: 'Опубліковані плагіни',
    demos: 'Демонстрації',
    demosHint: 'Окремі приклади роботи платформи, не обов’язково доступні як плагіни.',
    none: 'Поки немає опублікованих плагінів. Нові з’являться після перевірки та публікації адміністраторам.',
    details: 'Деталі плагіна',
    demo: 'Переглянути демонстрацію',
    launch: 'Відкрити',
    noDescription: 'Опис плагіна ще не додано.',
    offline: 'Виконання тимчасово недоступне',
    published: 'У каталозі',
  },
  en: {
    eyebrow: 'QDIP / Plugins',
    title: 'Plugins & applications',
    intro: 'Tools powered by QDIP. Open an application or review its capabilities before use.',
    installed: 'Published plugins',
    demos: 'Demonstrations',
    demosHint: 'Separate platform examples; these are not necessarily installable plugins.',
    none: 'No plugins are published yet. Verified plugins will appear here after administrator approval.',
    details: 'Plugin details',
    demo: 'View demonstration',
    launch: 'Open',
    noDescription: 'The plugin description is not available yet.',
    offline: 'Execution temporarily unavailable',
    published: 'In the catalog',
  },
  pl: {
    eyebrow: 'QDIP / Wtyczki',
    title: 'Wtyczki i aplikacje',
    intro: 'Narzędzia oparte na QDIP. Otwórz aplikację lub poznaj jej funkcje.',
    installed: 'Opublikowane wtyczki',
    demos: 'Demonstracje',
    demosHint: 'Osobne przykłady platformy; nie każda demonstracja jest wtyczką.',
    none: 'Nie ma jeszcze opublikowanych wtyczek. Zweryfikowane wtyczki pojawią się tutaj po zatwierdzeniu.',
    details: 'Szczegóły wtyczki',
    demo: 'Zobacz demonstrację',
    launch: 'Otwórz',
    noDescription: 'Opis wtyczki nie jest jeszcze dostępny.',
    offline: 'Uruchomienie tymczasowo niedostępne',
    published: 'W katalogu',
  },
} as const

const demoTitles: Record<Locale, Record<string, string>> = {
  uk: {
    'resource-allocation': 'Розподіл ресурсів',
    'supply-network-optimization': 'Оптимізація мережі постачання',
    'contractor-allocation': 'Розподіл підрядників',
    'readiness-recovery': 'Відновлення готовності',
    'gtm-lab': 'GTM Lab',
  },
  en: {
    'resource-allocation': 'Resource allocation',
    'supply-network-optimization': 'Supply network optimization',
    'contractor-allocation': 'Contractor allocation',
    'readiness-recovery': 'Readiness recovery',
    'gtm-lab': 'GTM Lab',
  },
  pl: {
    'resource-allocation': 'Alokacja zasobów',
    'supply-network-optimization': 'Optymalizacja sieci dostaw',
    'contractor-allocation': 'Alokacja wykonawców',
    'readiness-recovery': 'Przywracanie gotowości',
    'gtm-lab': 'GTM Lab',
  },
}

export default async function PluginDirectoryPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isSupportedLocale(locale)) notFound()
  const t = copy[locale]
  const [plugins, visibleIds] = await Promise.all([publishedPlugins(), visiblePluginUseCaseIds()])
  const demos = DIP_USE_CASES.filter(
    (item) =>
      visibleIds.includes(item.id) &&
      !plugins.some((plugin) => plugin.name === item.plugin.id && plugin.capability_id === item.plugin.capability)
  )
  return (
    <PrototypeShell locale={locale as Locale} activeRoute="/plugins" theme="burgundy">
      <main className={styles.page}>
        <div className={styles.container}>
          <header className={styles.hero}>
            <p className={styles.eyebrow}>{t.eyebrow}</p>
            <h1 className={styles.title}>{t.title}</h1>
            <p className={styles.lead}>{t.intro}</p>
          </header>
          <section aria-labelledby="published-plugins">
            <h2 id="published-plugins" className={styles.sectionTitle}>
              {t.installed}
            </h2>
            {plugins.length === 0 ? (
              <p className={styles.empty}>{t.none}</p>
            ) : (
              <div className={styles.grid}>
                {plugins.map((plugin) => {
                  const launch = launchLinkForPlugin(plugin)
                  return (
                    <article key={plugin.name} className={`${styles.card} ${styles.publicCard}`}>
                      <div className={styles.meta}>
                        <span className={styles.pill} data-kind="published">
                          {t.published}
                        </span>
                        {!plugin.enabled && plugin.source === 'remote' && (
                          <span className={styles.pill} data-kind="offline">
                            {t.offline}
                          </span>
                        )}
                        {plugin.ui?.category && (
                          <span className={styles.pill}>{pluginCategoryLabel(plugin.ui.category, locale)}</span>
                        )}
                      </div>
                      <h3 className={styles.cardTitle} style={{ marginTop: '1rem' }}>
                        {plugin.ui?.label || plugin.name}
                      </h3>
                      <p className={styles.description}>{plugin.description || t.noDescription}</p>
                      <div className={styles.actionRow}>
                        <a
                          className={styles.link}
                          href={buildLocalePath(`/plugins/${plugin.slug || plugin.name}`, locale)}
                        >
                          {t.details} <span aria-hidden="true">→</span>
                        </a>
                        {launch && (
                          <PluginLaunchLink href={launch.href} label={`${t.launch} ${launch.application}`} />
                        )}
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </section>
          {demos.length > 0 && (
            <section className={styles.secondarySection} aria-labelledby="plugin-demonstrations">
              <h2 className={styles.sectionTitle} id="plugin-demonstrations">
                {t.demos}
              </h2>
              <p className={styles.note}>{t.demosHint}</p>
              <div className={styles.grid} style={{ marginTop: '1.25rem' }}>
                {demos.map((demo) => (
                  <a
                    key={demo.id}
                    className={`${styles.card} ${styles.cardLink}`}
                    href={buildLocalePath(demo.route, locale)}
                  >
                    <h3 className={styles.cardTitle}>{demoTitles[locale][demo.id] || demo.id}</h3>
                    <span className={`${styles.link} ${styles.cardFooter}`}>
                      {t.demo} <span aria-hidden="true">→</span>
                    </span>
                  </a>
                ))}
              </div>
            </section>
          )}
        </div>
      </main>
    </PrototypeShell>
  )
}
