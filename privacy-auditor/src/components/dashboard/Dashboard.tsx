'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  ExternalLink,
  ListChecks,
} from 'lucide-react'
import { CATEGORIES } from '@/lib/questions'
import { buildMitigationChecklist, getScoreLabel } from '@/lib/scoring'
import { useAssessment, useMitigations } from '@/hooks/useAssessment'
import { ScoreRing } from '@/components/ui/ScoreRing'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { MitigationAction } from '@/types/audit'

const DIFFICULTY_LABEL: Record<MitigationAction['difficulty'], string> = {
  easy: 'Easy',
  medium: 'Moderate',
  hard: 'Advanced',
}

export function Dashboard() {
  const { state, score, hydrated, answeredCount, totalQuestions, reset } =
    useAssessment()
  const { items, hydrated: mitHydrated, regenerate, toggle, completedCount } =
    useMitigations()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (hydrated && mitHydrated && state) {
      regenerate(state.answers)
      setReady(true)
    }
  }, [hydrated, mitHydrated]) // eslint-disable-line react-hooks/exhaustive-deps

  const scoreLabel = useMemo(
    () => (score ? getScoreLabel(score.overall) : null),
    [score]
  )

  if (!hydrated || !state || !score || !scoreLabel) {
    return (
      <div className="card flex items-center justify-center p-10 text-sm text-ink-500 animate-pulse">
        Loading dashboard…
      </div>
    )
  }

  const hasAnswers = answeredCount > 0

  if (!hasAnswers) {
    return (
      <div className="card mx-auto max-w-xl p-8 text-center">
        <CircleDashed className="mx-auto h-10 w-10 text-ink-300" aria-hidden />
        <h1 className="mt-4 text-lg font-semibold text-ink-900">
          No assessment yet
        </h1>
        <p className="mt-2 text-sm text-ink-600">
          Complete the questionnaire to see your Privacy Footprint Score,
          category breakdown, and mitigation checklist.
        </p>
        <Link href="/assessment" className="mt-6 inline-block">
          <Button>
            Start assessment <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
        </Link>
      </div>
    )
  }

  const topIssues = items.filter(i => !i.completed).slice(0, 3)
  const openItems = items.filter(i => !i.completed)
  const totalMitigations = items.length

  return (
    <div className="space-y-8">
      <section className="grid gap-4 lg:grid-cols-[auto_1fr]">
        <div className="card flex items-center justify-center p-6">
          <ScoreRing
            score={score.overall}
            caption={`${scoreLabel.label} posture · ${answeredCount}/${totalQuestions} answered`}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="card p-5">
            <p className="eyebrow">Status</p>
            <p className={`mt-2 text-2xl font-semibold ${scoreLabel.color}`}>
              {scoreLabel.label}
            </p>
            <p className="mt-1 text-sm text-ink-500">
              {score.overall >= 70
                ? 'Solid baseline — polish the weak categories below.'
                : 'Meaningful gaps found — work the checklist by priority.'}
            </p>
          </div>
          <div className="card p-5">
            <p className="eyebrow">Checklist</p>
            <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-ink-900">
              {completedCount}
              <span className="text-base font-normal text-ink-400">
                /{totalMitigations}
              </span>
            </p>
            <p className="mt-1 text-sm text-ink-500">
              remediation tasks completed
            </p>
          </div>

          <div className="card p-5 sm:col-span-2">
            <div className="flex items-start gap-3">
              <AlertTriangle
                className="mt-0.5 h-4 w-4 shrink-0 text-risk-high"
                aria-hidden
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink-900">
                  Highest-risk areas
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[...score.categories]
                    .sort((a, b) => a.score - b.score)
                    .slice(0, 3)
                    .map(c => (
                      <Badge key={c.categoryId} tone={c.riskLevel}>
                        {CATEGORIES[c.categoryId].name} · {c.score}%
                      </Badge>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="breakdown-heading">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 id="breakdown-heading" className="text-lg font-semibold text-ink-950">
            Category breakdown
          </h2>
          <span className="text-xs text-ink-400">
            weighted by question impact
          </span>
        </div>
        <div className="card divide-y divide-ink-100">
          {score.categories.map(c => {
            const cat = CATEGORIES[c.categoryId]
            return (
              <div key={c.categoryId} className="p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-ink-900">
                      {cat.name}
                    </p>
                    <p className="text-xs text-ink-500">
                      {c.answeredQuestions}/{c.totalQuestions} questions answered
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge tone={c.riskLevel}>{c.riskLevel} risk</Badge>
                    <span className="font-mono text-sm tabular-nums text-ink-700">
                      {c.score}%
                    </span>
                  </div>
                </div>
                <div className="mt-3">
                  <ProgressBar value={c.score} showValue={false} tone="risk" />
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section aria-labelledby="mitigations-heading">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2
            id="mitigations-heading"
            className="flex items-center gap-2 text-lg font-semibold text-ink-950"
          >
            <ListChecks className="h-5 w-5 text-accent" aria-hidden />
            Mitigation checklist
          </h2>
          <span className="text-xs text-ink-400">
            {openItems.length} open · sorted by priority
          </span>
        </div>

        {topIssues.length > 0 && (
          <p className="mb-3 text-sm text-ink-600">
            Start with{' '}
            <span className="font-medium text-ink-900">
              {topIssues[0].title}
            </span>{' '}
            — the single highest-impact fix for your profile.
          </p>
        )}

        {items.length === 0 ? (
          <div className="card p-6 text-sm text-ink-500">
            {ready
              ? 'No vulnerabilities flagged — every answer indicated a good practice. Nothing to fix right now.'
              : 'Building your checklist…'}
          </div>
        ) : (
          <ol className="space-y-3">
            {items.map((item, idx) => {
              const expanded = expandedId === item.id
              return (
                <li
                  key={item.id}
                  className={`card overflow-hidden transition-shadow ${
                    item.completed ? 'opacity-65' : ''
                  }`}
                >
                  <div className="flex items-start gap-3 p-4 sm:p-5">
                    <button
                      type="button"
                      onClick={() => toggle(item.id)}
                      aria-pressed={item.completed}
                      aria-label={
                        item.completed
                          ? `Mark "${item.title}" as not done`
                          : `Mark "${item.title}" as done`
                      }
                      className="mt-0.5 shrink-0 text-ink-400 transition-colors hover:text-accent"
                    >
                      {item.completed ? (
                        <CheckCircle2 className="h-5 w-5 text-risk-low" aria-hidden />
                      ) : (
                        <CircleDashed className="h-5 w-5" aria-hidden />
                      )}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-ink-400">
                          P{item.priority}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedId(expanded ? null : item.id)
                          }
                          aria-expanded={expanded}
                          className="text-left text-sm font-semibold text-ink-900 hover:text-accent"
                        >
                          {idx + 1}. {item.title}
                        </button>
                      </div>
                      <p className="mt-1 text-sm leading-relaxed text-ink-600">
                        {item.description}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Badge tone="neutral">
                          {CATEGORIES[item.categoryId].name}
                        </Badge>
                        <Badge tone="neutral">
                          {DIFFICULTY_LABEL[item.difficulty]}
                        </Badge>
                        <Badge tone="neutral">{item.timeEstimate}</Badge>
                      </div>

                      {expanded && (
                        <div className="mt-4 animate-fade-up border-t border-ink-100 pt-4">
                          <ol className="space-y-2">
                            {item.steps.map((s, i) => (
                              <li
                                key={i}
                                className="flex gap-2.5 text-sm text-ink-700"
                              >
                                <span className="font-mono text-xs text-ink-400">
                                  {i + 1}.
                                </span>
                                <span>{s}</span>
                              </li>
                            ))}
                          </ol>
                          {item.resources.length > 0 && (
                            <div className="mt-4">
                              <p className="eyebrow">Helpful resources</p>
                              <ul className="mt-2 flex flex-wrap gap-2">
                                {item.resources.map(r => (
                                  <li key={r.url}>
                                    <a
                                      href={r.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-canvas px-2.5 py-1.5 text-xs font-medium text-ink-700 transition-colors hover:border-accent hover:text-accent"
                                    >
                                      {r.title}
                                      <ExternalLink className="h-3 w-3" aria-hidden />
                                    </a>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </section>

      <section className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-200/60 pt-6">
        <p className="text-xs text-ink-500">
          Stored locally · clear anytime with reset
        </p>
        <div className="flex gap-3">
          <Link href="/resources">
            <Button variant="secondary" size="sm">
              Browse tools
            </Button>
          </Link>
          <Button variant="danger" size="sm" onClick={reset}>
            Reset all data
          </Button>
        </div>
      </section>
    </div>
  )
}
