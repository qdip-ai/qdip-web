import { notFound, redirect } from 'next/navigation'
import { PrototypeShell } from '@/features/observatory'
import { publishedPlugins } from '@/lib/observatory-plugin-catalog'
import { launchLinkForPlugin } from '@/lib/observatory-plugin-launch'
import { pluginCategoryLabel } from '@/lib/observatory-plugin-categories'
import { buildLocalePath, isSupportedLocale, type Locale } from '@/lib/observatory-i18n'
import { DIP_USE_CASES } from '@/use-cases/registry'
import styles from '@/components/observatory/plugin-experience.module.css'
import { PluginLaunchLink } from '@/components/observatory/plugin-launch-link'
import { pluginPresentation } from '@/lib/observatory-plugin-editorial'

export const dynamic = 'force-dynamic'

const copy = {
  uk: {
    back: 'До всіх плагінів',
    eyebrow: 'QDIP / Плагін',
    overview: 'Про плагін',
    version: 'Версія',
    capability: 'Технічна можливість',
    category: 'Категорія',
    identity: 'Ідентифікатор SDK',
    technical: 'Технічна інформація',
    demo: 'Переглянути демонстрацію',
    launch: 'Відкрити застосунок',
    launchNote: 'Застосунок відкриється у новій вкладці. Може знадобитися авторизація.',
    unavailable:
      'Для цього плагіна ще не налаштовано перевірене посилання на застосунок. Публікація опису не означає можливості запуску.',
    offline: 'Remote Worker наразі відключений. Функції QDIP можуть бути тимчасово недоступними.',
    noDescription: 'Автор плагіна ще не додав опис.',
    note: 'Доступ до виконання плагіна перевіряється QDIP окремо від публікації в каталозі.',
  },
  en: {
    back: 'All plugins',
    eyebrow: 'QDIP / Plugin',
    overview: 'About this plugin',
    version: 'Version',
    capability: 'Technical capability',
    category: 'Category',
    identity: 'SDK identifier',
    technical: 'Technical information',
    demo: 'View demonstration',
    launch: 'Open application',
    launchNote: 'The application opens in a new tab. Sign-in may be required.',
    unavailable:
      'This plugin has no verified application link yet. Publishing a description does not enable execution.',
    offline: 'The remote Worker is disconnected. QDIP execution may be temporarily unavailable.',
    noDescription: 'The author has not provided a description yet.',
    note: 'QDIP checks execution permission separately from catalog publication.',
  },
  pl: {
    back: 'Wszystkie wtyczki',
    eyebrow: 'QDIP / Wtyczka',
    overview: 'O wtyczce',
    version: 'Wersja',
    capability: 'Funkcja techniczna',
    category: 'Kategoria',
    identity: 'Identyfikator SDK',
    technical: 'Informacje techniczne',
    demo: 'Zobacz demonstrację',
    launch: 'Otwórz aplikację',
    launchNote: 'Aplikacja otworzy się w nowej karcie. Może być wymagane logowanie.',
    unavailable:
      'Wtyczka nie ma jeszcze zweryfikowanego łącza do aplikacji. Publikacja opisu nie oznacza możliwości uruchomienia.',
    offline: 'Zdalny Worker jest rozłączony. Funkcje QDIP mogą być tymczasowo niedostępne.',
    noDescription: 'Autor nie dodał jeszcze opisu.',
    note: 'QDIP sprawdza uprawnienia wykonania niezależnie od publikacji w katalogu.',
  },
} as const

export default async function PluginDetailsPage({ params }: { params: Promise<{ locale: string; name: string }> }) {
  const { locale, name } = await params
  if (!isSupportedLocale(locale) || !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(name)) notFound()
  const plugins = await publishedPlugins()
  // Historic URLs redirect to the canonical, admin-selected slug.
  const plugin =
    plugins.find((item) => (item.slug || item.name) === name) ??
    plugins.find((item) => item.name === name || item.slug_aliases?.includes(name))
  if (!plugin) notFound()
  const canonicalName = plugin.slug || plugin.name
  if (name !== canonicalName) redirect(buildLocalePath(`/plugins/${canonicalName}`, locale))
  const t = copy[locale]
  const launch = launchLinkForPlugin(plugin)
  const presentation = pluginPresentation(plugin, locale)
  const demo = DIP_USE_CASES.find(
    (item) => item.plugin.id === plugin.name && item.plugin.capability === plugin.capability_id
  )
  return (
    <PrototypeShell locale={locale as Locale} activeRoute="/plugins" theme="burgundy">
      <main className={styles.page}>
        <div className={styles.narrow}>
          <a className={styles.link} href={buildLocalePath('/plugins', locale)}>
            <span aria-hidden="true">←</span> {t.back}
          </a>
          <header className={styles.hero} style={{ marginTop: '1.5rem' }}>
            <p className={styles.eyebrow}>{t.eyebrow}</p>
            <h1 className={styles.title}>{presentation.title}</h1>
            {plugin.ui?.category && (
              <div className={styles.meta}>
                <span className={styles.pill}>{pluginCategoryLabel(plugin.ui.category, locale)}</span>
              </div>
            )}
            <p className={styles.lead}>{presentation.description || t.noDescription}</p>
          </header>
          {launch ? (
            <section className={styles.launchPanel} aria-label={t.launch}>
              <PluginLaunchLink href={launch.href} label={`${t.launch} ${launch.application}`} />
              <p className={styles.launchNote}>{t.launchNote}</p>
            </section>
          ) : (
            <p className={styles.empty}>{t.unavailable}</p>
          )}
          {plugin.source === 'remote' && !plugin.enabled && (
            <p className={styles.notice} role="status">
              {t.offline}
            </p>
          )}
          {demo && (
            <div className={styles.actionRow}>
              <a className={styles.link} href={buildLocalePath(demo.route, locale)}>
                {t.demo} <span aria-hidden="true">→</span>
              </a>
            </div>
          )}
          <details className={styles.technical}>
            <summary>{t.technical}</summary>
            <dl className={styles.definition} style={{ marginTop: '1rem' }}>
              <div>
                <dt>{t.version}</dt>
                <dd>{plugin.version}</dd>
              </div>
              <div>
                <dt>{t.category}</dt>
                <dd>{pluginCategoryLabel(plugin.ui?.category, locale)}</dd>
              </div>
              <div>
                <dt>{t.capability}</dt>
                <dd>
                  <code>{plugin.capability_id}</code>
                </dd>
              </div>
              <div>
                <dt>{t.identity}</dt>
                <dd>
                  <code>{plugin.plugin_id || plugin.name}</code>
                </dd>
              </div>
            </dl>
            <p className={styles.note} style={{ marginTop: '1rem' }}>
              {t.note}
            </p>
          </details>
        </div>
      </main>
    </PrototypeShell>
  )
}
