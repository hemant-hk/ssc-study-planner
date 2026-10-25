'use client'

import { useEffect, useState } from 'react'

interface ScoreRingProps {
  score: number
  size?: number
  strokeWidth?: number
  label?: string
  caption?: string
}

function toneClass(score: number): string {
  if (score >= 80) return 'text-risk-low'
  if (score >= 55) return 'text-risk-medium'
  if (score >= 30) return 'text-risk-high'
  return 'text-risk-critical'
}

function ringColor(score: number): string {
  if (score >= 80) return '#6E8B74'
  if (score >= 55) return '#B4975A'
  if (score >= 30) return '#B57658'
  return '#A9564E'
}

export function ScoreRing({
  score,
  size = 180,
  strokeWidth = 10,
  label = 'Privacy Footprint Score',
  caption,
}: ScoreRingProps) {
  const [displayed, setDisplayed] = useState(0)
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(100, score))
  const offset = circumference - (clamped / 100) * circumference

  useEffect(() => {
    let raf = 0
    const start = performance.now()
    const duration = 700
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplayed(Math.round(clamped * eased))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [clamped])

  return (
    <div
      className="flex flex-col items-center gap-2"
      role="img"
      aria-label={`${label}: ${clamped} out of 100`}
    >
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" aria-hidden>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-ink-100"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={ringColor(clamped)}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.7s cubic-bezier(0.22, 1, 0.36, 1)' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={`font-mono text-4xl font-semibold tabular-nums ${toneClass(clamped)}`}
          >
            {displayed}
          </span>
          <span className="text-[11px] text-ink-400">/ 100</span>
        </div>
      </div>
      <p className="text-sm font-medium text-ink-700">{label}</p>
      {caption && <p className="text-xs text-ink-500">{caption}</p>}
    </div>
  )
}
