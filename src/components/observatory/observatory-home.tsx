import { ArrowRight, BrainCircuit, FileUp, Network, Route, Scale, Stethoscope } from 'lucide-react'

import { DecisionWorkflow } from '@/components/product/decision-workflow'
import { buildLocalePath, type Locale } from '@/lib/observatory-i18n'
import { createTranslator } from '@/i18n/runtime'
import { systemApplicationCopy } from '@/observatory/application-copy'
import { observableApplications } from '@/observatory/applications'

const demoIcons = {
  'decision-challenge': Scale,
  'decision-intake': FileUp,
  'model-doctor': Stethoscope,
  'resource-allocation': Route,
  'supply-network-optimization': Network,
} as const

export function ObservatoryHome({ locale, visibleIds }: { locale: Locale; visibleIds?: string[] }) {
  const t = createTranslator(locale, 'observatoryHome')
  const caseMessages = createTranslator(locale, 'useCases')
  const decisionPatterns = createTranslator(locale, 'decisionPatterns')
  const questions = t.raw<Array<[string, string]>>('questions')
  const applications = observableApplications(visibleIds)
  const challengeCopy = systemApplicationCopy(locale, 'decision-challenge')
  const intakeCopy = systemApplicationCopy(locale, 'decision-intake')
  return (
    <main className="observatory-home relative min-h-[calc(100vh-6.5rem)] overflow-hidden px-4 pb-20 pt-8 text-white md:px-6 md:pt-12 xl:px-10">
      <div className="relative z-10 mx-auto max-w-[1500px]">
        <header className="max-w-5xl">
          <div className="observatory-eyebrow">{t('eyebrow')}</div>
          <h1 className="mt-5 max-w-4xl text-3xl font-normal tracking-[-.025em] md:text-5xl lg:text-[3.5rem]">
            {t('title')}
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-slate-400 md:text-lg">{t('subtitle')}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a
              className="inline-flex items-center gap-2 rounded-lg bg-cyan-300 px-4 py-2.5 text-sm font-semibold text-slate-950"
              href={buildLocalePath('/challenges', locale)}
            >
              {challengeCopy.title} <ArrowRight className="h-4 w-4" />
            </a>
            <a
              className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2.5 text-sm font-semibold text-slate-200"
              href={buildLocalePath('/decision-intake', locale)}
            >
              {intakeCopy.title} <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </header>

        <DecisionWorkflow locale={locale} tone="dark" />

        <section className="mt-12" aria-labelledby="observatory-inspect">
          <div className="max-w-3xl">
            <h2 id="observatory-inspect" className="text-xs font-semibold uppercase tracking-[.2em] text-cyan-300">
              {t('inspect')}
            </h2>
          </div>
          <div className="mt-6 grid gap-x-8 gap-y-5 md:grid-cols-2 xl:grid-cols-4">
            {questions.map(([title, body], index) => (
              <div key={title} className="border-t border-white/10 pt-5">
                <div className="text-xs font-semibold text-cyan-300">0{index + 1}</div>
                <h3 className="mt-4 text-base font-medium">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-14" aria-labelledby="observatory-demos">
          <div className="mb-7 max-w-3xl">
            <h2 id="observatory-demos" className="text-xs font-semibold uppercase tracking-[.2em] text-cyan-300">
              {t('demos')}
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-500">{t('demosBody')}</p>
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            {applications.map((application) => {
              const Icon = demoIcons[application.id as keyof typeof demoIcons] ?? BrainCircuit
              const systemCopy =
                application.kind === 'use-case'
                  ? null
                  : systemApplicationCopy(locale, application.id as 'decision-challenge' | 'decision-intake' | 'model-doctor')
              const title = systemCopy?.title ?? caseMessages(`${application.useCaseId}.title`)
              const description = systemCopy?.description ?? caseMessages(`${application.useCaseId}.description`)
              const tag = systemCopy?.tag ?? caseMessages(`${application.useCaseId}.tag`)
              const pattern =
                systemCopy?.pattern ?? decisionPatterns(application.id === 'gtm-lab' ? 'prioritize' : 'allocate')
              return (
                <a
                  key={application.id}
                  href={buildLocalePath(application.route, locale)}
                  data-use-case={application.id}
                  data-theme={application.theme}
                  className="observatory-demo-card group flex min-h-64 flex-col p-6 md:p-8"
                >
                  <div className="flex items-center justify-between gap-4">
                    <span className="observatory-icon-frame">
                      <Icon className="h-5 w-5 text-cyan-200" />
                    </span>
                    <span className="flex items-center gap-2 text-[10px] font-semibold tracking-[.14em] text-slate-500">
                      <b className="text-cyan-300">{pattern}</b>
                      <span>·</span>
                      {tag}
                    </span>
                  </div>
                  <h3 className="mt-8 text-xl font-medium tracking-[-.02em] md:text-2xl">{title}</h3>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">{description}</p>
                  <div className="mt-auto flex items-center gap-2 pt-7 text-sm font-semibold text-cyan-200">
                    {t('open')}
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                  </div>
                </a>
              )
            })}
          </div>
        </section>

        <p className="mt-12 max-w-4xl border-t border-white/10 pt-8 text-sm leading-6 text-slate-500">{t('note')}</p>
      </div>
    </main>
  )
}
