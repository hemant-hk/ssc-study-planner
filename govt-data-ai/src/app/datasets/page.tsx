'use client'

import { useMemo, useState } from 'react'
import { ExternalLink, FileSpreadsheet } from 'lucide-react'
import { DATASETS, DATASET_FORMATS } from '@/lib/datasets'
import { DatasetFormat } from '@/types/govt'

const FORMAT_STYLES: Record<DatasetFormat, string> = {
  API: 'bg-govt-soft text-govt',
  CSV: 'bg-leaf-soft text-leaf',
  Dashboard: 'bg-saffron-soft text-saffron',
  PDF: 'bg-ink-100 text-ink-600',
  Web: 'bg-ink-100 text-ink-500',
}

export default function DatasetsPage() {
  const [format, setFormat] = useState<DatasetFormat | 'all'>('all')
  const [query, setQuery] = useState('')

  const items = useMemo(() => {
    let list = DATASETS
    if (format !== 'all') list = list.filter(d => d.format === format)
    const q = query.trim().toLowerCase()
    if (q) {
      list = list.filter(d =>
        [d.title, d.description, d.org, ...d.tags].join(' ').toLowerCase().includes(q)
      )
    }
    return list
  }, [format, query])

  return (
    <div className="container-page py-8">
      <header className="mb-5">
        <p className="eyebrow">Datasets</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink-950">
          Downloadable data catalog
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-600">
          {DATASETS.length} curated datasets from official statistical and
          administrative sources — census, budget, trade, labour, environment
          and more. Links go to the publisher&apos;s portal.
        </p>
      </header>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search datasets…"
          aria-label="Search datasets"
          className="h-10 w-full rounded-lg border border-ink-200 bg-surface px-3 text-sm placeholder:text-ink-400 focus:border-govt focus:outline-none sm:max-w-xs"
        />
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Format filters">
          <button
            type="button"
            onClick={() => setFormat('all')}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              format === 'all'
                ? 'border-govt bg-govt-soft text-govt'
                : 'border-ink-200 bg-surface text-ink-600'
            }`}
          >
            All formats
          </button>
          {DATASET_FORMATS.map(f => (
            <button
              key={f}
              type="button"
              onClick={() => setFormat(f)}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                format === f
                  ? 'border-govt bg-govt-soft text-govt'
                  : 'border-ink-200 bg-surface text-ink-600'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <p className="mb-3 text-xs text-ink-500" aria-live="polite">
        {items.length} dataset{items.length === 1 ? '' : 's'}
      </p>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(d => (
          <li key={d.id} className="card flex flex-col p-5 transition-shadow hover:shadow-lift">
            <div className="flex items-start justify-between gap-2">
              <FileSpreadsheet className="h-5 w-5 shrink-0 text-ink-400" aria-hidden />
              <span
                className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${FORMAT_STYLES[d.format]}`}
              >
                {d.format}
              </span>
            </div>
            <h2 className="mt-3 text-sm font-semibold leading-snug text-ink-950">
              {d.title}
            </h2>
            <p className="mt-1.5 flex-1 text-xs leading-relaxed text-ink-600">
              {d.description}
            </p>
            <div className="mt-3 flex flex-wrap gap-1">
              {d.tags.map(t => (
                <span
                  key={t}
                  className="rounded bg-ink-100 px-1.5 py-0.5 text-[10px] text-ink-500"
                >
                  {t}
                </span>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-ink-100 pt-3">
              <div className="min-w-0">
                <p className="truncate text-[11px] text-ink-500">{d.org}</p>
                <p className="text-[11px] text-ink-400">{d.region}</p>
              </div>
              <a
                href={d.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-govt hover:underline"
              >
                Open <ExternalLink className="h-3 w-3" aria-hidden />
              </a>
            </div>
          </li>
        ))}
      </ul>

      {items.length === 0 && (
        <div className="card p-8 text-center text-sm text-ink-500">
          No datasets match. Try clearing the format filter.
        </div>
      )}
    </div>
  )
}
