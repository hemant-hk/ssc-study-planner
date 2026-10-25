'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { SearchX } from 'lucide-react'
import { SearchBar } from '@/components/search/SearchBar'
import { ResultCard } from '@/components/search/ResultCard'
import { search, analyzeQuery } from '@/lib/search'
import { CATEGORIES } from '@/lib/resources'

function SearchResults() {
  const params = useSearchParams()
  const q = params.get('q') ?? ''
  const results = q ? search(q) : []
  const analysis = q ? analyzeQuery(q) : null

  return (
    <div className="container-page py-8">
      <header className="mb-5">
        <p className="eyebrow">Search</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink-950">
          {q ? `Results for “${q}”` : 'Search public govt data'}
        </h1>
      </header>

      <div className="mb-6">
        <SearchBar initialQuery={q} />
      </div>

      {q && (
        <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-ink-600">
          <span>
            <strong className="font-mono text-ink-900">{results.length}</strong>{' '}
            result{results.length === 1 ? '' : 's'}
          </span>
          {analysis && analysis.intent !== 'general' && (
            <span className="rounded-full bg-govt-soft px-2 py-0.5 text-xs text-govt">
              intent: {analysis.intent}
            </span>
          )}
          {analysis?.states.map(s => (
            <span key={s} className="rounded-full bg-saffron-soft px-2 py-0.5 text-xs text-saffron">
              {s}
            </span>
          ))}
        </div>
      )}

      {q && results.length === 0 && (
        <div className="card p-8 text-center">
          <SearchX className="mx-auto h-8 w-8 text-ink-300" aria-hidden />
          <p className="mt-3 text-sm font-medium text-ink-800">No matches found</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-500">
            Try a different phrasing, a scheme name, a state, or a topic like
            “census”, “tender” or “budget”.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {Object.keys(CATEGORIES).slice(0, 5).map(c => (
              <Link
                key={c}
                href={`/explore?cat=${c}`}
                className="rounded-full border border-ink-200 px-3 py-1.5 text-xs text-ink-700 hover:border-govt hover:text-govt"
              >
                {CATEGORIES[c as keyof typeof CATEGORIES].name}
              </Link>
            ))}
          </div>
        </div>
      )}

      {results.length > 0 && (
        <ul className="space-y-3">
          {results.map((r, i) => (
            <ResultCard
              key={r.resource.id}
              resource={r.resource}
              score={r.score}
              matchedOn={r.matchedOn}
              index={i}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="container-page py-8 text-sm text-ink-500 animate-pulse">
          Loading results…
        </div>
      }
    >
      <SearchResults />
    </Suspense>
  )
}
