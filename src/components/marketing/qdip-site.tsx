import { ArrowRight, Play } from 'lucide-react'
import Image from 'next/image'
import { DesignSystemProvider } from '@/design-system'
import { marketingLocaleHref, observatoryHref } from '@/lib/platform-urls'
import { marketingCopy, type MarketingLocale } from './qdip-copy'
import { MarketingHeader } from './marketing-header'
import { MarketingFooter } from './marketing-footer'
import { MarketingTrackedLink } from './marketing-analytics'
import { DecisionWorkbenchPreview } from './decision-workbench-preview'
import { DecisionPatterns } from './decision-patterns'
import { DecisionPlayground } from './decision-playground'
import { EvidenceStrip } from './evidence-strip'
import { conversionBridgeCopy } from './conversion-copy'
import styles from './qdip-site.module.css'
import motionStyles from './marketing-cta-motion.module.css'
import shellStyles from './marketing-shell.module.css'
import atmosphereStyles from './marketing-atmosphere.module.css'
import burgundyStyles from './marketing-deep-burgundy.module.css'

const path = (locale: MarketingLocale, slug: string) => `${marketingLocaleHref(locale)}/${slug}`

export function QdipSite({ locale = 'en' }: { locale?: MarketingLocale }) {
  const c = marketingCopy[locale]
  const decisionHref = path(locale, 'decision')
  return (
    <DesignSystemProvider
      theme="burgundy"
      mode="dark"
      className={`${styles.site} ${shellStyles.stickyRoot} ${atmosphereStyles.atmosphere} ${burgundyStyles.theme}`}
    >
      <main id="main-content" lang={locale}>
        <MarketingHeader locale={locale} />
        <section className={`${styles.hero} ${styles.engineeredHero}`}>
          <div className={styles.heroCopy}>
            <div className={styles.eyebrow}>{c.hero[0]} / QDIP</div>
            <h1>{c.hero[1]}</h1>
            <p className={styles.lead}>{c.hero[2]}</p>
            <p>{c.hero[3]}</p>
            <div className={styles.heroActions}>
              <MarketingTrackedLink
                event="marketing_hero_observatory_click"
                locale={locale}
                placement="hero"
                className={`${styles.primaryButtonLarge} ${motionStyles.primary}`}
                href={observatoryHref('', locale)}
              >
                <Play size={16} />
                {c.hero[5]}
              </MarketingTrackedLink>
              <MarketingTrackedLink
                event="marketing_decision_intake_click"
                locale={locale}
                placement="hero"
                className={`${styles.secondaryButton} ${motionStyles.secondary}`}
                href={decisionHref}
              >
                {c.conversion[2]} <ArrowRight size={15} />
              </MarketingTrackedLink>
            </div>
            <div className={styles.heroProtocol} aria-label={c.hero[4]}>
              <span>01 / {c.diagram[3]}</span>
              <span>02 / {c.diagram[6]}</span>
              <span>03 / {c.diagram[7]}</span>
            </div>
          </div>
          <div className={styles.consoleFrame}>
            <DecisionWorkbenchPreview locale={locale} />
          </div>
        </section>
        <EvidenceStrip locale={locale} />
        <section className={`${styles.section} ${styles.editorialSection}`}>
          <div className={styles.sectionIntro}>
            <h2>{c.problem[0]}</h2>
          </div>
          <div className={styles.questionGrid}>
            {c.problem.slice(1, 5).map((x) => (
              <article key={x}>{x}</article>
            ))}
          </div>
          <p className={styles.centerCopy}>
            {c.problem[5]} <strong>{c.problem[6]}</strong>
          </p>
          <p className={styles.businessBridge}>{c.bridge}</p>
        </section>
        <DecisionPlayground locale={locale} />
        <section className={`${styles.section} ${styles.patternSection}`} id="demos">
          <div className={styles.sectionIntro}>
            <div className={styles.eyebrow}>ALLOCATE · DECIDE · PRIORITIZE</div>
            <h2>{c.cases[0]}</h2>
          </div>
          <DecisionPatterns locale={locale} cases={c.cases} />
          <div className={styles.demoBridge}>
            <span>{conversionBridgeCopy[locale].question}</span>
            <MarketingTrackedLink
              event="marketing_decision_intake_click"
              locale={locale}
              placement="demo_bridge"
              href={decisionHref}
            >
              {c.conversion[2]} <ArrowRight size={14} />
            </MarketingTrackedLink>
          </div>
        </section>
        <section className={styles.section} aria-labelledby="ecosystem-title">
          <div className={styles.sectionIntro}>
            <h2 id="ecosystem-title">{c.ecosystem.heading}</h2>
          </div>
          <article className={styles.ecosystemCard}>
            <h3 className={styles.ecosystemBrand}>
              <Image src="/brands/dzvin-wordmark.png" alt="Dzvin.co" width={183} height={64} />
            </h3>
            <span className={styles.ecosystemCategory}>{c.ecosystem.category}</span>
            <p>{c.ecosystem.description}</p>
            <a href="https://dzvin.co">
              {c.ecosystem.cta} <ArrowRight size={15} aria-hidden="true" />
            </a>
          </article>
        </section>
        <section className={styles.finalCta}>
          <h2>{c.conversion[0]}</h2>
          <p>{c.conversion[1]}</p>
          <MarketingTrackedLink
            event="marketing_decision_intake_click"
            locale={locale}
            placement="final_cta"
            className={`${styles.primaryButtonLarge} ${motionStyles.primary}`}
            href={decisionHref}
          >
            {c.conversion[2]} <ArrowRight size={16} />
          </MarketingTrackedLink>
        </section>
        <MarketingFooter locale={locale} />
      </main>
    </DesignSystemProvider>
  )
}
