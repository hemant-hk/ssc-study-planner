interface ProgressBarProps {
  value: number
  max?: number
  label?: string
  showValue?: boolean
  tone?: 'default' | 'risk'
}

export function ProgressBar({
  value,
  max = 100,
  label,
  showValue = true,
  tone = 'default',
}: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, Math.round((value / max) * 100)))
  const fill =
    tone === 'risk'
      ? pct >= 80
        ? 'bg-risk-low'
        : pct >= 55
          ? 'bg-risk-medium'
          : pct >= 30
            ? 'bg-risk-high'
            : 'bg-risk-critical'
      : 'bg-accent'

  return (
    <div className="w-full">
      {(label || showValue) && (
        <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
          {label && <span className="text-ink-600">{label}</span>}
          {showValue && (
            <span className="font-mono text-xs tabular-nums text-ink-500">
              {pct}%
            </span>
          )}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? 'progress'}
        className="h-1.5 w-full overflow-hidden rounded-full bg-ink-100"
      >
        <div
          className={`h-full rounded-full transition-[width] duration-500 ease-out ${fill}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
