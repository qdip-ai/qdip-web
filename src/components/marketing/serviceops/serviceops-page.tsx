import Link from 'next/link'
import { ArrowRight, ArrowUpRight, BookOpen, CheckCircle2, ClipboardList, ExternalLink } from 'lucide-react'
import { DesignSystemProvider } from '@/design-system'
import { marketingLocaleHref } from '@/lib/platform-urls'
import { MarketingHeader } from '../marketing-header'
import { MarketingFooter } from '../marketing-footer'
import { MarketingTrackedLink } from '../marketing-analytics'
import { DecisionInquiryForm } from '../decision-inquiry-form'
import type { MarketingLocale } from '../qdip-copy'
import { SERVICEOPS_URLS, serviceOpsCopy } from './serviceops-content'
import styles from './serviceops-page.module.css'
import atmosphere from '../marketing-atmosphere.module.css'
import burgundy from '../marketing-deep-burgundy.module.css'

type Role = 'owner' | 'worker' | 'customer'
const roles: readonly { id: Role; url: string }[] = [
  { id: 'owner', url: SERVICEOPS_URLS.ownerDemo },
  { id: 'worker', url: SERVICEOPS_URLS.workerDemo },
  { id: 'customer', url: SERVICEOPS_URLS.customerDemo },
]

export function ServiceOpsPage({ locale, guide = false }: { locale: MarketingLocale; guide?: boolean }) {
  const c = serviceOpsCopy[locale]
  const caseHref = marketingLocaleHref(locale) + '/serviceops'
  const guideHref = caseHref + '/guide'

  return (
    <DesignSystemProvider theme="burgundy" mode="dark" className={styles.root + ' ' + atmosphere.atmosphere + ' ' + burgundy.theme}>
      <main id="main-content" lang={locale}>
        <MarketingHeader locale={locale} currentPath={guide ? 'serviceops/guide' : 'serviceops'} />
        {guide ? (
          <>
            <section className={styles.hero}>
              <div className={styles.kicker}>ServiceOps / {c.guideLink}</div>
              <h1>{c.guideTitle}</h1>
              <p className={styles.lead}>{c.guideSummary}</p>
              <div className={styles.actions}>
                <Link href={caseHref} className={styles.secondary}>{c.backToCase} <ArrowRight size={16} /></Link>
                <MarketingTrackedLink event="marketing_demo_click" locale={locale} placement="serviceops_guide_demo"
                  href={SERVICEOPS_URLS.ownerDemo} className={styles.primary}>
                  {c.primary} <ArrowUpRight size={16} />
                </MarketingTrackedLink>
              </div>
            </section>
            <section className={styles.section}>
              <div className={styles.sectionHead}>
                <span className={styles.kicker}>01 — 08</span>
                <h2>{c.guideTitle}</h2>
              </div>
              <div className={styles.guideLayout}>
                <nav aria-label={c.guideTitle} className={styles.contents}>
                  {c.guideSections.map((section, index) => (
                    <a key={section.title} href={'#guide-' + (index + 1)}>{section.title}</a>
                  ))}
                </nav>
                <div className={styles.guideContent}>
                  {c.guideSections.map((section, index) => (
                    <section className={styles.guideBlock} key={section.title} id={'guide-' + (index + 1)}>
                      <div className={styles.kicker}>{String(index + 1).padStart(2, '0')}</div>
                      <h2>{section.title}</h2>
                      <p>{section.description}</p>
                      <ol>
                        {section.steps.map((step) => <li key={step}>{step}</li>)}
                      </ol>
                    </section>
                  ))}
                </div>
              </div>
            </section>
            <section className={styles.section}>
              <div className={styles.sectionHead}>
                <BookOpen size={24} aria-hidden="true" />
                <h2>{c.faqTitle}</h2>
              </div>
              <div className={styles.featureGrid}>
                {c.faq.map((item) => <article className={styles.featureCard} key={item.title}><h3>{item.title}</h3><p>{item.body}</p></article>)}
              </div>
              <p className={styles.boundary}>{c.guideCaution}</p>
            </section>
            <section className={styles.finalAction}>
              <h2>{c.formTitle}</h2>
              <p>{c.formDescription}</p>
              <MarketingTrackedLink className={styles.primary} href={caseHref + '#pilot'}
                event="marketing_decision_intake_click" locale={locale} placement="serviceops_guide_pilot">
                {c.pilotLink} <ArrowRight size={16} />
              </MarketingTrackedLink>
            </section>
          </>
        ) : (
          <>
            <section className={styles.hero}>
              <div className={styles.kicker}>{c.eyebrow}</div>
              <h1>{c.title}</h1>
              <p className={styles.lead}>{c.summary}</p>
              <p className={styles.audience}>{c.audience}</p>
              <div className={styles.actions}>
                <MarketingTrackedLink event="marketing_demo_click" locale={locale} placement="serviceops_hero_owner"
                  href={SERVICEOPS_URLS.ownerDemo} className={styles.primary}>
                  {c.primary} <ArrowUpRight size={16} />
                </MarketingTrackedLink>
                <MarketingTrackedLink event="marketing_demo_click" locale={locale} placement="serviceops_hero_guide"
                  href={guideHref} className={styles.secondary}>
                  <BookOpen size={16} /> {c.guideLink}
                </MarketingTrackedLink>
              </div>
              <p className={styles.boundary}>{c.boundary}</p>
            </section>

            <section className={styles.section} id="features">
              <div className={styles.sectionHead}><span className={styles.kicker}>SERVICEOPS / 01</span><h2>{c.featuresTitle}</h2></div>
              <div className={styles.featureGrid}>
                {c.features.map((feature) => <article className={styles.featureCard} key={feature.title}>
                  <CheckCircle2 aria-hidden="true" size={23} />
                  <h3>{feature.title}</h3>
                  <p>{feature.body}</p>
                </article>)}
              </div>
            </section>

            <section className={styles.section} id="demo">
              <div className={styles.sectionHead}><span className={styles.kicker}>SERVICEOPS / 02</span><h2>{c.demosTitle}</h2><p>{c.demosDescription}</p></div>
              <div className={styles.demoGrid}>
                {roles.map(({ id, url }) => <article className={styles.demoCard} key={id}>
                  <div className={styles.demoIcon}><ClipboardList size={22} aria-hidden="true" /></div>
                  <h3>{c.roles[id].title}</h3>
                  <p>{c.roles[id].body}</p>
                  <MarketingTrackedLink event="marketing_demo_click" locale={locale} placement={'serviceops_demo_' + id}
                    href={url}>
                    {c.demoAction} <ArrowUpRight size={16} />
                  </MarketingTrackedLink>
                </article>)}
              </div>
            </section>

            <section className={styles.section} id="templates">
              <div className={styles.sectionHead}><span className={styles.kicker}>SERVICEOPS / 03</span><h2>{c.presetsTitle}</h2><p>{c.presetsDescription}</p></div>
              <ul className={styles.presetList}>
                {c.presets.map((preset) => <li key={preset}>{preset}</li>)}
              </ul>
              <MarketingTrackedLink event="marketing_demo_click" locale={locale} placement="serviceops_presets_guide"
                href={guideHref} className={styles.textLink}>
                {c.guideLink} <ArrowRight size={16} />
              </MarketingTrackedLink>
            </section>

            <section className={styles.section} id="journey">
              <div className={styles.sectionHead}><span className={styles.kicker}>SERVICEOPS / 04</span><h2>{c.funnelTitle}</h2></div>
              <div className={styles.featureGrid}>
                {c.funnelSteps.map((step, index) => <article className={styles.stepCard} key={step.title}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </article>)}
              </div>
            </section>

            <section className={styles.pilot} id="pilot">
              <div className={styles.sectionHead}><span className={styles.kicker}>SERVICEOPS / PILOT</span><h2>{c.formTitle}</h2><p>{c.formDescription}</p></div>
              <DecisionInquiryForm locale={locale} variant="serviceops" />
              <div className={styles.existingLink}>
                <Link href={SERVICEOPS_URLS.app}>{c.appLink} <ExternalLink size={15} /></Link>
              </div>
            </section>
          </>
        )}
        <MarketingFooter locale={locale} />
      </main>
    </DesignSystemProvider>
  )
}
