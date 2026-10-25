import { ExternalLink } from 'lucide-react'
import { Resource } from '@/types/govt'
import { CATEGORIES } from '@/lib/resources'

interface ResultCardProps {
  resource: Resource
  score?: number
  matchedOn?: string[]
  index?: number
}

export function ResultCard({ resource, matchedOn, index }: ResultCardProps) {
  const cat = CATEGORIES[resource.category]
  return (
    <li className="card animate-fade-up p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-govt-soft px-1.5 py-0.5 text-[11px] font-medium text-govt">
              {cat.name}
            </span>
            {resource.hint && (
              <span className="text-[11px] text-ink-400">{resource.hint}</span>
            )}
            {index !== undefined && (
              <span className="font-mono text-[11px] text-ink-300">
                #{index + 1}
              </span>
            )}
          </div>
          <h3 className="mt-2 text-[15px] font-semibold leading-snug text-ink-950">
            {resource.title}
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-ink-600">
            {resource.description}
          </p>
        </div>
        <a
          href={resource.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-ink-200 bg-canvas px-3 py-1.5 text-xs font-medium text-govt transition-colors hover:border-govt hover:bg-govt-soft"
        >
          Open source <ExternalLink className="h-3 w-3" aria-hidden />
        </a>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-ink-100 pt-3 text-xs text-ink-500">
        <span className="font-medium text-ink-600">{resource.org}</span>
        <span className="hidden sm:inline">·</span>
        <span>{resource.tags.slice(0, 4).join(' · ')}</span>
        {matchedOn && matchedOn.length > 0 && (
          <span className="ml-auto rounded-full bg-leaf-soft px-2 py-0.5 text-[11px] text-leaf">
            matched: {matchedOn.join(', ')}
          </span>
        )}
      </div>
    </li>
  )
}
