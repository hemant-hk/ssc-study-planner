'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense, useMemo, useState } from 'react'
import { ResultCard } from '@/components/search/ResultCard'
import { CATEGORIES, CATEGORY_ORDER, RESOURCES } from '@/lib/resources'
import { CategoryId } from '@/types/govt'

function ExploreContent() {
  const params = useSearchParams()
  const initial = params.get('cat')
  const [active, setActive] = useState<CategoryId | 'all'>(
    initial && initial in CATEGORIES ? (initial as CategoryId) : 'all'
  )
  const [query, setQuery] = useState('')

  const items = useMemo(() => {
    let list = RESOURCES
    if (active !== 'all') list = list.filter(r => r.category === active)
    const q = query.trim().toLowerCase()
    if (q) {
      list = list.filter(r =>
        [r.title, r.description, r.org, ...r.tags]
          .join(' ')
          .toLowerCase()
          .includes(q)
      )
    }
    return list
  }, [active, query])

  return (
    <div className="container-page py-8">
      <header className="mb-5">
        <p className="eyebrow">Explore</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink-950">
          Government resource index
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-600">
          {RESOURCES.length} official sources across{' '}
          {CATEGORY_ORDER.length} categories — schemes, portals, statistics,
          laws, tenders, helplines and finance.
        </p>
      </header>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Filter resources…"
          aria-label="Filter resources"
          className="h-10 w-full rounded-lg border border-ink-200 bg-surface px-3 text-sm placeholder:text-ink-400 focus:border-govt focus:outline-none sm:max-w-xs"
        />
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Categories">
          <button
            type="button"
            onClick={() => setActive('all')}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              active === 'all'
                ? 'border-govt bg-govt-soft text-govt'
                : 'border-ink-200 bg-surface text-ink-600 hover:border-ink-300'
            }`}
          >
            All
          </button>
          {CATEGORY_ORDER.map(id => (
            <button
              key={id}
              type="button"
              onClick={() => setActive(id)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                active === id
                  ? 'border-govt bg-govt-soft text-govt'
                  : 'border-ink-200 bg-surface text-ink-600 hover:border-ink-300'
              }`}
            >
              {CATEGORIES[id].name}
            </button>
          ))}
        </div>
      </div>

      <p className="mb-3 text-xs text-ink-500" aria-live="polite">
        {items.length} resource{items.length === 1 ? '' : 's'}
        {active !== 'all' ? ` in ${CATEGORIES[active].name}` : ''}
      </p>

      {items.length === 0 ? (
        <div className="card p-8 text-center text-sm text-ink-500">
          Nothing matches that filter.{' '}
          <button
            type="button"
            onClick={() => {
              setQuery('')
              setActive('all')
            }}
            className="font-medium text-govt underline"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map(r => (
            <ResultCard key={r.id} resource={r} />
          ))}
        </ul>
      )}

      <div className="mt-8 rounded-xl border border-dashed border-ink-300 bg-surface p-5 text-center text-sm text-ink-600">
        Looking for downloadable data instead?{' '}
        <Link href="/datasets" className="font-medium text-govt underline">
          Browse the dataset catalog →
        </Link>
      </div>
    </div>
  )
}

export default function ExplorePage() {
  return (
    <Suspense
      fallback={
        <div className="container-page py-8 text-sm text-ink-500 animate-pulse">
          Loading…
        </div>
      }
    >
      <ExploreContent />
    </Suspense>
  )
}
