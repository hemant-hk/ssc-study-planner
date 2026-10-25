import { Lock } from 'lucide-react'

export function SiteFooter() {
  return (
    <footer className="border-t border-ink-200/60 bg-surface">
      <div className="container-page flex flex-col gap-3 py-6 text-sm text-ink-500 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-accent" aria-hidden />
          All assessment data stays in your browser. Nothing is uploaded.
        </p>
        <p>
          Open-source privacy tool ·{' '}
          <span className="text-ink-400">Client-side only</span>
        </p>
      </div>
    </footer>
  )
}
