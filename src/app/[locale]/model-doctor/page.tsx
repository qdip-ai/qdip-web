import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ArrowUpRight, LockKeyhole, ShieldCheck } from 'lucide-react'

import { PrototypeShell } from '@/features/observatory'
import { ModelDoctorWorkspace } from '@/components/observatory/model-doctor-workspace'
import { isSupportedLocale, type Locale } from '@/lib/observatory-i18n'
import { modelDoctorHref } from '@/lib/model-doctor-url'

export const metadata: Metadata = {
  title: 'Model Doctor — QDIP Observatory',
  description: 'Open the QDIP Model Doctor workspace for native OR-Tools CP-SAT diagnostics.',
}

const copy = {
  uk: {
    eyebrow: 'ДІАГНОСТИКА МОДЕЛЕЙ',
    title: 'Model Doctor',
    description:
      'Перевіряйте нативні моделі OR-Tools CP-SAT: валідація, розв’язання, аналіз конфліктів та пропозиції виправлень із незалежною перевіркою.',
    launch: 'Відкрити Doctor',
    newTab: 'Застосунок відкриється в окремій вкладці.',
    accessTitle: 'Окремий захищений вхід',
    access:
      'Doctor використовує власну сесію Zitadel і роль doctor_user. Вхід в Observatory сам по собі не надає доступу до виконання моделей.',
    boundaryTitle: 'Незалежний обчислювальний контур',
    boundary:
      'Моделі обробляються окремим захищеним Doctor Worker. Вони не передаються до Kernel v1, не створюють Kernel Replay і не публікуються як SDK-плагіни.',
  },
  en: {
    eyebrow: 'MODEL DIAGNOSTICS',
    title: 'Model Doctor',
    description:
      'Inspect native OR-Tools CP-SAT models: validation, solving, conflict analysis and independently verified repair proposals.',
    launch: 'Open Doctor',
    newTab: 'The workspace opens in a separate tab.',
    accessTitle: 'Separate protected sign-in',
    access:
      'Doctor has its own Zitadel session and doctor_user role. Signing in to Observatory alone does not grant access to model execution.',
    boundaryTitle: 'Independent compute boundary',
    boundary:
      'Models run in the isolated Doctor Worker, not Kernel v1. No Kernel Replay is generated, and the application is not an SDK plugin.',
  },
  pl: {
    eyebrow: 'DIAGNOSTYKA MODELI',
    title: 'Model Doctor',
    description:
      'Sprawdzaj natywne modele OR-Tools CP-SAT: walidacja, rozwiązywanie, analiza konfliktów i niezależnie zweryfikowane propozycje napraw.',
    launch: 'Otwórz Doctor',
    newTab: 'Aplikacja otworzy się w osobnej karcie.',
    accessTitle: 'Osobne zabezpieczone logowanie',
    access:
      'Doctor używa własnej sesji Zitadel i roli doctor_user. Logowanie do Observatory nie nadaje automatycznie prawa do uruchamiania modeli.',
    boundaryTitle: 'Oddzielne środowisko obliczeniowe',
    boundary:
      'Modele przetwarza odizolowany Doctor Worker, a nie Kernel v1. Nie powstaje Kernel Replay, a aplikacja nie jest wtyczką SDK.',
  },
} as const

export default async function ModelDoctorPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isSupportedLocale(locale)) notFound()
  const t = copy[locale]

  return (
    <PrototypeShell locale={locale as Locale} activeRoute="/model-doctor" theme="violet">
      <main className="mx-auto max-w-5xl px-4 pb-20 pt-8 text-slate-100 md:px-8 md:pt-12">
        <p className="text-xs font-medium tracking-[.16em] text-cyan-300">{t.eyebrow}</p>
        <h1 className="mt-4 text-3xl font-medium tracking-tight md:text-5xl">{t.title}</h1>
        <p className="mt-6 max-w-3xl text-base leading-8 text-slate-300 md:text-lg">{t.description}</p>
        <a
          href={modelDoctorHref(locale)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-8 inline-flex min-h-12 items-center gap-3 rounded-lg border border-cyan-300/40 bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300"
        >
          {t.launch}
          <ArrowUpRight size={18} aria-hidden />
        </a>
        <p className="mt-3 text-sm text-slate-400">{t.newTab}</p>
        <ModelDoctorWorkspace locale={locale} />
        <div className="mt-12 grid gap-5 md:grid-cols-2">
          <section className="rounded-xl border border-white/15 bg-white/5 p-6">
            <LockKeyhole className="mb-4 text-cyan-300" size={24} aria-hidden />
            <h2 className="text-lg font-medium">{t.accessTitle}</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">{t.access}</p>
          </section>
          <section className="rounded-xl border border-white/15 bg-white/5 p-6">
            <ShieldCheck className="mb-4 text-cyan-300" size={24} aria-hidden />
            <h2 className="text-lg font-medium">{t.boundaryTitle}</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">{t.boundary}</p>
          </section>
        </div>
      </main>
    </PrototypeShell>
  )
}
