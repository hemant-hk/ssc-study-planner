'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react'
import { CATEGORIES, CATEGORY_ORDER, getQuestionsByCategory } from '@/lib/questions'
import { useAssessment } from '@/hooks/useAssessment'
import { QuestionRow } from './QuestionRow'
import { Button } from '@/components/ui/Button'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Badge } from '@/components/ui/Badge'
import { CategoryId } from '@/types/audit'

const ICON_MAP: Record<string, string> = {
  key: '🔐',
  globe: '🌐',
  shield: '🛡',
  smartphone: '📱',
  users: '👥',
  database: '🗄',
}

export function AssessmentWizard() {
  const {
    state,
    hydrated,
    answeredCount,
    totalQuestions,
    setAnswer,
    goNext,
    goPrev,
    goToStep,
    reset,
  } = useAssessment()
  const [touched, setTouched] = useState(false)

  // steps: 0 = intro, 1..6 = categories, 7 = summary
  const step = state?.currentStep ?? 0

  const currentCategory: CategoryId | null =
    step >= 1 && step <= CATEGORY_ORDER.length
      ? CATEGORY_ORDER[step - 1]
      : null

  const questions = useMemo(
    () => (currentCategory ? getQuestionsByCategory(currentCategory) : []),
    [currentCategory]
  )

  if (!hydrated || !state) {
    return (
      <div className="card flex items-center justify-center p-10 text-sm text-ink-500 animate-pulse">
        Loading your assessment…
      </div>
    )
  }

  const category = currentCategory ? CATEGORIES[currentCategory] : null
  const categoryAnswered = category
    ? category.questions.filter(q => state.answers[q] !== undefined).length
    : 0
  const categoryComplete =
    category && categoryAnswered === category.questions.length
  const allAnswered = answeredCount === totalQuestions

  const handleContinue = () => {
    if (currentCategory && !categoryComplete) {
      setTouched(true)
      return
    }
    setTouched(false)
    goNext()
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex-1">
          <ProgressBar
            value={answeredCount}
            max={totalQuestions}
            showValue={false}
          />
          <p className="mt-1.5 font-mono text-xs tabular-nums text-ink-500">
            {answeredCount} / {totalQuestions} questions answered
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (
              answeredCount === 0 ||
              window.confirm(
                'Clear all answers and start over? This removes your saved progress from this browser.'
              )
            ) {
              reset()
            }
          }}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-800"
          title="Clear all answers and start over"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          Reset
        </button>
      </div>

      <div className="mb-4 flex items-center gap-2 overflow-x-auto pb-1">
        {CATEGORY_ORDER.map((id, i) => {
          const cat = CATEGORIES[id]
          const done = cat.questions.every(q => state.answers[q] !== undefined)
          const active = step === i + 1
          const reachable = step > i + 1 || done || active
          return (
            <button
              key={id}
              type="button"
              disabled={!reachable}
              onClick={() => reachable && goToStep(i + 1)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
                active
                  ? 'border-accent bg-accent-soft text-ink-900'
                  : done
                    ? 'border-transparent bg-risk-low/12 text-risk-low hover:bg-risk-low/20'
                    : 'border-ink-200 bg-surface text-ink-400'
              } ${reachable ? '' : 'cursor-not-allowed opacity-60'}`}
              aria-current={active ? 'step' : undefined}
              aria-label={cat.name}
            >
              {done && step !== i + 1 ? (
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <span className="font-mono">{i + 1}</span>
              )}
              <span className="hidden sm:inline">{cat.name}</span>
            </button>
          )
        })}
      </div>

      {step === 0 && (
        <section className="card animate-fade-up p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-6 w-6 text-accent" aria-hidden />
            <h1 className="text-xl font-semibold tracking-tight text-ink-950">
              Digital footprint checkup
            </h1>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-ink-600">
            You&apos;ll answer <strong>24 questions</strong> across six areas:
            credentials, browsing, device security, mobile permissions, social
            media, and data brokers. Answer honestly — every response stays in
            this browser&apos;s local storage and is never transmitted.
          </p>
          <ul className="mt-5 grid gap-2.5 sm:grid-cols-2">
            {CATEGORY_ORDER.map((id, i) => (
              <li
                key={id}
                className="flex items-center gap-2.5 rounded-lg bg-ink-50 px-3 py-2.5 text-sm text-ink-700"
              >
                <span className="font-mono text-xs text-ink-400">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span aria-hidden>{ICON_MAP[CATEGORIES[id].icon]}</span>
                {CATEGORIES[id].name}
              </li>
            ))}
          </ul>
          <div className="mt-7 flex items-center gap-3">
            <Button onClick={goNext}>
              Begin <ArrowRight className="h-4 w-4" aria-hidden />
            </Button>
            <p className="text-xs text-ink-500">~4 minutes · nothing is uploaded</p>
          </div>
        </section>
      )}

      {currentCategory && category && (
        <section className="animate-fade-up" key={currentCategory}>
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <p className="eyebrow">
                Step {step} of {CATEGORY_ORDER.length}
              </p>
              <h1 className="mt-1 text-xl font-semibold tracking-tight text-ink-950">
                <span aria-hidden>{ICON_MAP[category.icon]}</span> {category.name}
              </h1>
              <p className="mt-1 text-sm text-ink-500">{category.description}</p>
            </div>
            <Badge tone={categoryComplete ? 'low' : 'neutral'}>
              {categoryAnswered}/{category.questions.length}
            </Badge>
          </div>

          <ul className="space-y-3">
            {questions.map(q => (
              <QuestionRow
                key={q.id}
                question={q}
                value={state.answers[q.id]}
                onChange={val => setAnswer(q.id, val)}
              />
            ))}
          </ul>

          {touched && !categoryComplete && (
            <p
              role="alert"
              className="mt-4 rounded-lg border border-risk-medium/40 bg-risk-medium/8 px-3 py-2 text-sm text-risk-medium"
            >
              Answer every question in this section before continuing.
            </p>
          )}

          <div className="mt-6 flex items-center justify-between gap-3">
            <Button variant="ghost" onClick={goPrev}>
              <ArrowLeft className="h-4 w-4" aria-hidden /> Back
            </Button>
            <Button onClick={handleContinue} disabled={!categoryComplete}>
              {categoryComplete ? (
                <>
                  Continue <ArrowRight className="h-4 w-4" aria-hidden />
                </>
              ) : (
                `${category.questions.length - categoryAnswered} remaining`
              )}
            </Button>
          </div>
        </section>
      )}

      {step === CATEGORY_ORDER.length + 1 && (
        <section className="card animate-fade-up p-6 text-center sm:p-8">
          <CheckCircle2
            className="mx-auto h-10 w-10 text-risk-low"
            aria-hidden
          />
          <h1 className="mt-4 text-xl font-semibold text-ink-950">
            Assessment {allAnswered ? 'complete' : 'saved'}
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-600">
            {allAnswered
              ? 'Your Privacy Footprint Score is ready, along with a prioritized mitigation checklist based on your answers.'
              : 'You can leave and come back — progress is saved in this browser. Finish the remaining questions whenever you like.'}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link href="/dashboard">
              <Button>
                Open dashboard <ArrowRight className="h-4 w-4" aria-hidden />
              </Button>
            </Link>
            {!allAnswered && (
              <Button variant="secondary" onClick={goPrev}>
                Back to questions
              </Button>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
