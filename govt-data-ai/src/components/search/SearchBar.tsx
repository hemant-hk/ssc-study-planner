'use client'

import { useRouter } from 'next/navigation'
import { FormEvent, useEffect, useRef, useState } from 'react'
import { Search, Sparkles, X } from 'lucide-react'
import { analyzeQuery, getPopularQueries } from '@/lib/search'

interface SearchBarProps {
  initialQuery?: string
  autoFocus?: boolean
  large?: boolean
}

export function SearchBar({ initialQuery = '', autoFocus, large }: SearchBarProps) {
  const router = useRouter()
  const [value, setValue] = useState(initialQuery)
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const analysis = value.trim() ? analyzeQuery(value) : null

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus()
  }, [autoFocus])

  const submit = (q: string) => {
    const trimmed = q.trim()
    if (!trimmed) return
    router.push(`/search?q=${encodeURIComponent(trimmed)}`)
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    submit(value)
  }

  const showSuggestions = focused && value.trim().length === 0
  const showAnalysis =
    focused && value.trim().length > 0 && analysis?.interpretedAs.length

  return (
    <div className="relative w-full">
      <form onSubmit={onSubmit} role="search">
        <div
          className={`flex items-center gap-2 rounded-xl border bg-surface px-3 transition-shadow ${
            large ? 'h-12' : 'h-10'
          } ${focused ? 'border-govt shadow-lift' : 'border-ink-200 shadow-card'}`}
        >
          <Search
            className={`shrink-0 text-ink-400 ${large ? 'h-5 w-5' : 'h-4 w-4'}`}
            aria-hidden
          />
          <input
            ref={inputRef}
            type="search"
            value={value}
            onChange={e => setValue(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => window.setTimeout(() => setFocused(false), 150)}
            placeholder="Ask anything about govt data… e.g. “literacy rate of Bihar”"
            aria-label="Search government data"
            className={`min-w-0 flex-1 bg-transparent text-ink-900 placeholder:text-ink-400 focus:outline-none ${
              large ? 'text-base' : 'text-sm'
            }`}
          />
          {value && (
            <button
              type="button"
              onClick={() => {
                setValue('')
                inputRef.current?.focus()
              }}
              aria-label="Clear search"
              className="shrink-0 rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          )}
          <button
            type="submit"
            className={`shrink-0 rounded-lg bg-govt font-medium text-white transition-colors hover:bg-govt-dark ${
              large ? 'h-9 px-4 text-sm' : 'h-8 px-3 text-xs'
            }`}
          >
            Search
          </button>
        </div>
      </form>

      {showAnalysis && analysis && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="flex items-center gap-1 text-ink-500">
            <Sparkles className="h-3 w-3 text-saffron" aria-hidden />
            Reading as:
          </span>
          {analysis.interpretedAs.map(chip => (
            <span
              key={chip}
              className="rounded-full bg-saffron-soft px-2 py-0.5 text-saffron"
            >
              {chip}
            </span>
          ))}
        </div>
      )}

      {showSuggestions && (
        <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-xl border border-ink-200 bg-surface shadow-lift">
          <p className="border-b border-ink-100 px-4 py-2 text-xs font-medium text-ink-500">
            Popular questions
          </p>
          <ul>
            {getPopularQueries().map(s => (
              <li key={s}>
                <button
                  type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => submit(s)}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-ink-700 hover:bg-govt-soft"
                >
                  <Search className="h-3.5 w-3.5 shrink-0 text-ink-400" aria-hidden />
                  {s}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
