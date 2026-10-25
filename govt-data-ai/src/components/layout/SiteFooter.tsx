import { Info } from 'lucide-react'

export function SiteFooter() {
  return (
    <footer className="border-t border-ink-200/70 bg-surface">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-6 text-xs text-ink-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="flex items-start gap-2">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-govt" aria-hidden />
          Index of <strong className="font-medium text-ink-700">public</strong>{' '}
          government sources only — links point to official portals. Verify
          details on the source site.
        </p>
        <p className="text-ink-400">
          Open data · No login · Client-side search
        </p>
      </div>
    </footer>
  )
}
