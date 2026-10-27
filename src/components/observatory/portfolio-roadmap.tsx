'use client'

import { Fragment, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, GitBranch, Search, ShieldAlert, X } from 'lucide-react'

import { dependentsOf, statusLabels, type PortfolioProject, type PortfolioStatus } from './portfolio-roadmap-data'
import styles from './portfolio-roadmap.module.css'

type Filter = PortfolioStatus | 'all'
const filters: Filter[] = ['all', 'active', 'gated', 'blocked', 'research', 'paused', 'closed']

export function PortfolioRoadmap({
  projects,
  fetchedAt,
  error,
}: {
  projects: PortfolioProject[]
  fetchedAt: string | null
  error?: string
}) {
  const router = useRouter()
  const [selectedId, setSelectedId] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [view, setView] = useState<'map' | 'stages'>('map')
  const selected = projects.find((project) => project.id === selectedId) ?? projects[0]
  const prerequisites = (selected?.dependencies ?? [])
    .map((id) => projects.find((project) => project.id === id))
    .filter((value) => value !== undefined)
  const dependents = selected ? dependentsOf(selected.id, projects) : []
  const filtered = useMemo(
    () =>
      projects.filter((p) => {
        if (filter !== 'all' && p.status !== filter) return false
        const haystack = [p.title, p.group, p.stage, p.next].join(' ').toLocaleLowerCase('uk')
        return haystack.includes(query.trim().toLocaleLowerCase('uk'))
      }),
    [filter, query]
  )

  function focusProject(id: string) {
    setSelectedId(id)
    setView('map')
  }

  return (
    <main id="main-content" className={styles.main}>
      <header className={styles.header}>
        <div>
          <div className={styles.eyebrow}>
            <GitBranch size={15} aria-hidden="true" /> QDIP / PORTFOLIO CONTROL
          </div>
          <h1 className={styles.h1}>Карта розвитку проєктів</h1>
          <p className={styles.subtitle}>
            Поточні етапи, залежності, блокери та наступний крок. Натисніть на проєкт, щоб побачити шлях уперед.
          </p>
        </div>
        <div className={styles.freshness}>
          <div className={styles.snapshot}>GitHub Issues · серверна синхронізація</div>
          <strong>{fetchedAt ? new Date(fetchedAt).toLocaleString('uk-UA') : 'Немає даних'}</strong>
          <button type="button" className={styles.sourceLink} onClick={() => router.refresh()}>
            Оновити з GitHub
          </button>
          <span>Дані GitHub можуть кешуватися до 60 секунд.</span>
        </div>
      </header>

      {(!selected || error) && (
        <div role="alert" className={styles.warning}>
          {error ?? 'Поки немає відстежуваних GitHub Issues. Карту не сформовано.'}
        </div>
      )}
      {selected && (
        <Fragment>
          <div className={styles.summary} aria-label="Підсумок портфеля">
            {(['active', 'gated', 'blocked', 'paused'] as const).map((status) => (
              <button
                key={status}
                className={[styles.counter, styles[status], filter === status ? styles.counterSelected : ''].join(' ')}
                type="button"
                onClick={() => setFilter(filter === status ? 'all' : status)}
                aria-pressed={filter === status}
              >
                <b>{projects.filter((p) => p.status === status).length}</b>
                <span>{statusLabels[status]}</span>
              </button>
            ))}
          </div>

          <div className={styles.layout}>
            <aside className={styles.sidebar} aria-label="Усі проєкти">
              <div className={styles.sidebarTop}>
                <h2>
                  Проєкти <span>{projects.length}</span>
                </h2>
                <label className={styles.search}>
                  <Search size={16} aria-hidden="true" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    aria-label="Знайти проєкт"
                    placeholder="Пошук за назвою або етапом"
                  />
                  {query && (
                    <button type="button" aria-label="Очистити пошук" onClick={() => setQuery('')}>
                      <X size={14} />
                    </button>
                  )}
                </label>
                <div className={styles.filters} aria-label="Фільтр станів">
                  {filters.map((item) => (
                    <button
                      key={item}
                      type="button"
                      aria-pressed={filter === item}
                      className={filter === item ? styles.filterSelected : ''}
                      onClick={() => setFilter(item)}
                    >
                      {item === 'all' ? 'Усі' : statusLabels[item]}
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.projectList}>
                {filtered.length === 0 && <p className={styles.empty}>Проєктів за цим фільтром немає.</p>}
                {filtered.map((project) => (
                  <button
                    className={[styles.project, selected.id === project.id ? styles.projectSelected : ''].join(' ')}
                    type="button"
                    aria-pressed={selected.id === project.id}
                    key={project.id}
                    onClick={() => focusProject(project.id)}
                  >
                    <span className={[styles.dot, styles[project.status]].join(' ')} aria-hidden="true" />
                    <span className={styles.projectWords}>
                      <strong>{project.title}</strong>
                      <span>{project.stage}</span>
                    </span>
                    <ArrowRight size={15} aria-hidden="true" />
                  </button>
                ))}
              </div>
            </aside>

            <section className={styles.content} aria-live="polite">
              <div className={styles.selectedHeader}>
                <div className={styles.selectedHeadLeft}>
                  <div className={styles.muted}>{selected.group}</div>
                  <h2>{selected.title}</h2>
                  <span className={[styles.status, styles[selected.status]].join(' ')}>
                    {statusLabels[selected.status]}
                  </span>
                </div>
                <a className={styles.sourceLink} href={selected.source} rel="noopener noreferrer" target="_blank">
                  Джерело <ArrowUpRight size={15} aria-hidden="true" />
                </a>
              </div>
              <div className={styles.currentStage}>
                <span>ПОТОЧНИЙ ЕТАП</span>
                <h3>{selected.stage}</h3>
                <div className={styles.next}>
                  <b>Наступний крок:</b> {selected.next}
                </div>
              </div>

              <div className={styles.switcher} role="group" aria-label="Вид карти">
                <button
                  className={view === 'map' ? styles.viewActive : ''}
                  type="button"
                  aria-pressed={view === 'map'}
                  onClick={() => setView('map')}
                >
                  Залежності
                </button>
                <button
                  className={view === 'stages' ? styles.viewActive : ''}
                  type="button"
                  aria-pressed={view === 'stages'}
                  onClick={() => setView('stages')}
                >
                  Етапи
                </button>
              </div>

              {view === 'map' ? (
                <div className={styles.diagram}>
                  <div className={styles.diagramTitle}>Що блокує цей проєкт та що залежить від нього</div>
                  <div className={styles.diagramGrid}>
                    <div className={styles.diagramColumn}>
                      <h4>ПОПЕРЕДНІ УМОВИ</h4>
                      {prerequisites.length === 0 && selected.missingDependencies.length === 0 && (
                        <span className={styles.noDeps}>Немає жорсткої залежності в цій карті</span>
                      )}
                      {selected.missingDependencies.map((url) => (
                        <a key={url} className={styles.node} href={url} target="_blank" rel="noopener noreferrer">
                          <span className={[styles.dot, styles.blocked].join(' ')} aria-hidden="true" />
                          <span>
                            <b>Зовнішній GitHub блокер</b>
                            <small>Issue ще не додано до портфеля</small>
                          </span>
                          <ArrowUpRight size={14} aria-hidden="true" />
                        </a>
                      ))}
                      {prerequisites.map((dependency) => (
                        <button
                          key={dependency.id}
                          className={styles.node}
                          type="button"
                          onClick={() => focusProject(dependency.id)}
                        >
                          <span className={[styles.dot, styles[dependency.status]].join(' ')} aria-hidden="true" />
                          <span>
                            <b>{dependency.title}</b>
                            <small>
                              {statusLabels[dependency.status]} · {dependency.stage}
                            </small>
                          </span>
                          <ArrowRight size={14} aria-hidden="true" />
                        </button>
                      ))}
                    </div>
                    <div className={styles.arrowColumn} aria-hidden="true">
                      <ArrowRight size={22} />
                    </div>
                    <div className={styles.centralNode}>
                      <div className={styles.centralTag}>ОБРАНИЙ ПРОЄКТ</div>
                      <strong>{selected.title}</strong>
                      <span>{selected.stage}</span>
                      {selected.status === 'blocked' && (
                        <div className={styles.critical}>
                          <ShieldAlert size={15} /> Не переходити до інтеграції
                        </div>
                      )}
                    </div>
                    <div className={styles.arrowColumn} aria-hidden="true">
                      <ArrowRight size={22} />
                    </div>
                    <div className={styles.diagramColumn}>
                      <h4>ЗАЛЕЖНІ ПРОЄКТИ</h4>
                      {dependents.length === 0 && <span className={styles.noDeps}>Прямих залежних проєктів немає</span>}
                      {dependents.map((dependency) => (
                        <button
                          key={dependency.id}
                          className={styles.node}
                          type="button"
                          onClick={() => focusProject(dependency.id)}
                        >
                          <span className={[styles.dot, styles[dependency.status]].join(' ')} aria-hidden="true" />
                          <span>
                            <b>{dependency.title}</b>
                            <small>
                              {statusLabels[dependency.status]} · {dependency.stage}
                            </small>
                          </span>
                          <ArrowRight size={14} aria-hidden="true" />
                        </button>
                      ))}
                    </div>
                  </div>
                  {selected.status === 'blocked' && (
                    <div className={styles.warning}>
                      Інтеграцію заблоковано до виконання вказаних залежностей та перевірки acceptance criteria у GitHub
                      Issue.
                    </div>
                  )}
                  <div className={styles.diagramHelp}>
                    <ArrowLeft size={13} /> Залежність <ArrowDown size={13} /> обраний проєкт <ArrowRight size={13} />{' '}
                    споживач результату
                  </div>
                </div>
              ) : (
                <div className={styles.stages}>
                  <div className={styles.diagramTitle}>
                    Послідовність контрольних етапів (без вигаданого відсотка готовності)
                  </div>
                  {selected.steps.map((step, index) => (
                    <div className={styles.step} key={step}>
                      <div
                        className={[
                          styles.stepNumber,
                          index === 0 ? styles.stepDone : index === 1 ? styles.stepNow : styles.stepFuture,
                        ].join(' ')}
                      >
                        {index + 1}
                      </div>
                      <div className={styles.stepBody}>
                        <div className={styles.stepLabel}>
                          {index === 0
                            ? 'Підтверджений або існуючий базис'
                            : index === 1
                              ? 'Поточний етап / обмеження'
                              : 'Умова завершення'}
                        </div>
                        <strong>{step}</strong>
                      </div>
                    </div>
                  ))}
                  <a className={styles.bottomLink} href={selected.source} target="_blank" rel="noopener noreferrer">
                    Відкрити acceptance criteria у GitHub <ArrowUpRight size={15} />
                  </a>
                </div>
              )}
            </section>
          </div>
        </Fragment>
      )}
      <footer className={styles.footer}>
        Джерело: GitHub Issues із явними метаданими QDIP Portfolio. Статуси та залежності оновлюються на сервері; деплой
        або merge сам по собі не означає acceptance PASS.
      </footer>
    </main>
  )
}
