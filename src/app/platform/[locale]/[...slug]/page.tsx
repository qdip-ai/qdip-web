import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PublicPage } from '@/components/marketing/public-page'
import { SdkPage } from '@/components/marketing/sdk-page'
import { DepthPage } from '@/components/marketing/depth/depth-page'
import type { DepthPageKey } from '@/components/marketing/depth/content'
import { marketingLocales, type MarketingLocale } from '@/components/marketing/qdip-copy'

const pageKeys = [
  'how-it-works',
  'sdk',
  'use-cases',
  'decision',
  'core',
  'core/architecture',
  'core/decision-model',
  'core/explainability',
  'core/research',
] as const
type PageKey = (typeof pageKeys)[number]
type SeoCopy = Record<PageKey, { title: string; description: string }>
const depthKeys = new Set<DepthPageKey>(['how-it-works', 'use-cases', 'core', 'core/research'])

const seo: Record<MarketingLocale, SeoCopy> = {
  en: {
    sdk: {
      title: 'QDIP SDK — Python Worker and TypeScript client',
            description:
        'Build independent decision applications using SDK-02 Python Worker and SDK-03 TypeScript client with QDIP Gateway and managed Kernel.',
    },
    'how-it-works': {
      title: 'How QDIP Works',
      description:
        'From recurring decision to inspectable recommendation: alternatives, priorities, constraints, risk, uncertainty and evidence.',
    },
    'use-cases': {
      title: 'QDIP Solutions & Decision Demos',
      description:
        'Explore Resource Allocation and GTM Lab as working applications, plus reusable QDIP decision patterns for new domains.',
    },
    decision: {
      title: 'Describe Your Decision',
      description:
        'Describe a recurring decision your organization makes and determine whether it is a good fit for QDIP.',
    },
    core: {
      title: 'QDIP Core Technology',
      description:
        'Architecture of the QDIP Decision Engine: decision model, rules, constraints, evidence, trace, plugins and production boundaries.',
    },
    'core/architecture': {
      title: 'QDIP Core Architecture',
      description: 'Architecture, boundaries and execution flow of QDIP Core.',
    },
    'core/decision-model': {
      title: 'QDIP Decision Model',
      description: 'State, alternatives, objectives, effects, costs, risk, uncertainty, constraints and evidence.',
    },
    'core/explainability': {
      title: 'QDIP Explainability',
      description: 'How QDIP keeps recommendations, evidence and decision execution inspectable.',
    },
    'core/research': {
      title: 'QDIP Research & Validation',
      description:
        'QDIP research methodology, baselines, reproducibility, validation status and implemented decision experiments.',
    },
  },
  uk: {
    sdk: {
      title: 'QDIP SDK — Python Worker і TypeScript клієнт',
            description:
        'Розробляйте незалежні застосунки рішень через SDK-02 Python Worker і SDK-03 TypeScript клієнт, Gateway та Managed Kernel QDIP.',
    },
    'how-it-works': {
      title: 'Як працює QDIP',
      description:
        'Від регулярного рішення до перевірюваної рекомендації: альтернативи, пріоритети, обмеження, ризик, невизначеність та докази.',
    },
    'use-cases': {
      title: 'Рішення та демо QDIP',
      description:
        'Resource Allocation і GTM Lab — діючі застосунки QDIP; патерни рішень можна повторно використовувати в нових доменах.',
    },
    decision: {
      title: 'Опишіть ваше рішення',
      description: 'Опишіть регулярне рішення вашої організації та визначте, чи підходить для нього QDIP.',
    },
    core: {
      title: 'Технологія QDIP Core',
      description:
        'Архітектура рушія QDIP: модель рішення, правила, обмеження, докази, трасування, плагіни та production boundaries.',
    },
    'core/architecture': {
      title: 'Архітектура QDIP Core',
      description: 'Архітектура, межі компонентів і потік виконання QDIP Core.',
    },
    'core/decision-model': {
      title: 'Модель рішення QDIP',
      description: 'Стан, альтернативи, цілі, ефекти, витрати, ризик, невизначеність, обмеження та докази.',
    },
    'core/explainability': {
      title: 'Пояснюваність QDIP',
      description: 'Як QDIP зберігає рекомендації, докази та виконання доступними для перевірки.',
    },
    'core/research': {
      title: 'Дослідження та валідація QDIP',
      description: 'Методологія QDIP, baselines, відтворюваність, статус валідації та реалізовані експерименти.',
    },
  },
  pl: {
    sdk: {
      title: 'QDIP SDK — Python Worker i klient TypeScript',
            description:
        'Twórz niezależne aplikacje decyzyjne z SDK-02 Python Worker, SDK-03 TypeScript, Gateway i zarządzanym Kernelem QDIP.',
    },
    'how-it-works': {
      title: 'Jak działa QDIP',
      description:
        'Od powtarzalnej decyzji do weryfikowalnej rekomendacji: alternatywy, priorytety, ograniczenia, ryzyko, niepewność i dowody.',
    },
    'use-cases': {
      title: 'Rozwiązania i dema QDIP',
      description:
        'Resource Allocation i GTM Lab to działające aplikacje QDIP; wzorce decyzyjne można wykorzystywać w nowych domenach.',
    },
    decision: {
      title: 'Opisz swoją decyzję',
      description: 'Opisz powtarzalną decyzję w organizacji i sprawdź, czy QDIP jest odpowiednim rozwiązaniem.',
    },
    core: {
      title: 'Technologia QDIP Core',
      description:
        'Architektura silnika QDIP: model decyzji, reguły, ograniczenia, dowody, ślad wykonania, pluginy i granice produkcyjne.',
    },
    'core/architecture': {
      title: 'Architektura QDIP Core',
      description: 'Architektura, granice komponentów i przepływ wykonania QDIP Core.',
    },
    'core/decision-model': {
      title: 'Model decyzyjny QDIP',
      description: 'Stan, alternatywy, cele, efekty, koszty, ryzyko, niepewność, ograniczenia i dowody.',
    },
    'core/explainability': {
      title: 'Wyjaśnialność QDIP',
      description: 'Jak QDIP zachowuje rekomendacje, dowody i wykonanie do weryfikacji.',
    },
    'core/research': {
      title: 'Badania i walidacja QDIP',
      description: "Metodologia QDIP, baseline'y, odtwarzalność, status walidacji i zrealizowane eksperymenty.",
    },
  },
}
function isLocale(v: string): v is MarketingLocale {
  return marketingLocales.includes(v as MarketingLocale)
}
function isPageKey(v: string): v is PageKey {
  return pageKeys.includes(v as PageKey)
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string[] }>
}): Promise<Metadata> {
  const { locale, slug } = await params
  if (!isLocale(locale)) return {}
  const key = slug.join('/')
  if (!isPageKey(key)) return {}
  const { title, description } = seo[locale][key]
  const canonical = `https://qdip.ai/${locale}/${key}`
  return {
    title: { absolute: `${title} — QDIP` },
    description,
    alternates: {
      canonical,
      languages: { en: `https://qdip.ai/en/${key}`, uk: `https://qdip.ai/uk/${key}`, pl: `https://qdip.ai/pl/${key}` },
    },
    openGraph: {
      title: `${title} — QDIP`,
      description,
      url: canonical,
      type: 'website',
      locale: locale === 'en' ? 'en_US' : locale === 'uk' ? 'uk_UA' : 'pl_PL',
    },
  }
}
export default async function Page({ params }: { params: Promise<{ locale: string; slug: string[] }> }) {
  const { locale, slug } = await params
  if (!isLocale(locale)) notFound()
  const key = slug.join('/')
  if (!isPageKey(key)) notFound()
  if (key === 'sdk') return <SdkPage locale={locale} />
  if (depthKeys.has(key as DepthPageKey)) return <DepthPage locale={locale} page={key as DepthPageKey} />
  return <PublicPage locale={locale} slug={key} />
}
