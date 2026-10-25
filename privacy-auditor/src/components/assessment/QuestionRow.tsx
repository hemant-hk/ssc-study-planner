'use client'

import { Check, X } from 'lucide-react'
import { Question } from '@/types/audit'

interface QuestionRowProps {
  question: Question
  value: boolean | undefined
  onChange: (value: boolean) => void
}

export function QuestionRow({ question, value, onChange }: QuestionRowProps) {
  return (
    <li className="card p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink-900 sm:text-base">
            {question.text}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-ink-500">
            {question.description}
          </p>
        </div>

        <div
          className="grid shrink-0 grid-cols-2 gap-1.5 rounded-lg bg-ink-100 p-1"
          role="radiogroup"
          aria-label={question.text}
        >
          <button
            type="button"
            role="radio"
            aria-checked={value === true}
            onClick={() => onChange(true)}
            className={`flex h-9 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors ${
              value === true
                ? 'bg-surface text-risk-low shadow-card'
                : 'text-ink-500 hover:text-ink-800'
            }`}
          >
            <Check className="h-4 w-4" aria-hidden />
            Yes
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={value === false}
            onClick={() => onChange(false)}
            className={`flex h-9 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors ${
              value === false
                ? 'bg-surface text-risk-critical shadow-card'
                : 'text-ink-500 hover:text-ink-800'
            }`}
          >
            <X className="h-4 w-4" aria-hidden />
            No
          </button>
        </div>
      </div>
    </li>
  )
}
