'use client'

import { useMemo, useState } from 'react'
import { ExternalLink, Search, Star } from 'lucide-react'
import { PRIVACY_TOOLS, TOOL_CATEGORIES } from '@/lib/tools'
import { Badge } from '@/components/ui/Badge'

type CategoryFilter = 'all' | (typeof TOOL_CATEGORIES)[number]['id']

export function ToolDirectory() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [ossOnly, setOssOnly] = useState(false)
  const [freeOnly, setFreeOnly] = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return PRIVACY_TOOLS.filter(tool => {
      if (category !== 'all' && tool.category !== category) return false
      if (ossOnly && !tool.openSource) return false
      if (freeOnly && !tool.free) return false
      if (q) {
        const haystack = [tool.name, tool.description, ...tool.tags]
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [query, category, ossOnly, freeOnly])

  return (
    <div>
      <div className="card mb-6 p-4 sm:p-5">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search tools, tags… (e.g. encrypted, dns, alias)"
            aria-label="Search tools"
            className="h-10 w-full rounded-lg border border-ink-200 bg-canvas pl-9 pr-3 text-sm text-ink-900 placeholder:text-ink-400 focus:border-accent"
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by category">
            <button
              type="button"
              onClick={() => setCategory('all')}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                category === 'all'
                  ? 'border-accent bg-accent-soft text-ink-900'
                  : 'border-ink-200 bg-surface text-ink-600 hover:border-ink-300'
              }`}
            >
              All
            </button>
            {TOOL_CATEGORIES.map(tc => (
              <button
                key={tc.id}
                type="button"
                onClick={() => setCategory(tc.id)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  category === tc.id
                    ? 'border-accent bg-accent-soft text-ink-900'
                    : 'border-ink-200 bg-surface text-ink-600 hover:border-ink-300'
                }`}
              >
                {tc.label}
              </button>
            ))}
          </div>

          <div className="ml-auto flex gap-2">
            <ToggleChip
              label="Open source only"
              active={ossOnly}
              onClick={() => setOssOnly(v => !v)}
            />
            <ToggleChip
              label="Free tier"
              active={freeOnly}
              onClick={() => setFreeOnly(v => !v)}
            />
          </div>
        </div>
      </div>

      <p className="mb-3 text-xs text-ink-500" aria-live="polite">
        {filtered.length} of {PRIVACY_TOOLS.length} tools
      </p>

      {filtered.length === 0 ? (
        <div className="card p-8 text-center text-sm text-ink-500">
          No tools match those filters. Try clearing the search.
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(tool => (
            <li key={tool.id} className="card flex flex-col p-5 transition-shadow hover:shadow-lift">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-base font-semibold text-ink-900">{tool.name}</h3>
                <div className="flex shrink-0 gap-1">
                  {tool.openSource && <Badge tone="accent">OSS</Badge>}
                  {tool.free && <Badge tone="low">Free</Badge>}
                </div>
              </div>

              <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-600">
                {tool.description}
              </p>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {tool.tags.map(tag => (
                  <span
                    key={tag}
                    className="rounded bg-ink-100 px-1.5 py-0.5 text-[11px] text-ink-500"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-ink-100 pt-3">
                <div className="flex items-center gap-1 text-xs text-ink-400">
                  {tool.rating && (
                    <>
                      <Star className="h-3.5 w-3.5 fill-ink-400" aria-hidden />
                      <span className="sr-only">Rated {tool.rating} out of 5</span>
                      <span aria-hidden>{tool.rating}.0</span>
                    </>
                  )}
                  <span className="ml-1 text-ink-400">
                    {tool.platforms.length} platforms
                  </span>
                </div>
                <a
                  href={tool.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
                >
                  Visit <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ToggleChip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? 'border-accent bg-accent-soft text-ink-900'
          : 'border-ink-200 bg-surface text-ink-600 hover:border-ink-300'
      }`}
    >
      {label}
    </button>
  )
}
