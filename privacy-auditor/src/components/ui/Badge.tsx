import { ReactNode } from 'react'

type Tone = 'neutral' | 'low' | 'medium' | 'high' | 'critical' | 'accent'

const TONE_CLASSES: Record<Tone, string> = {
  neutral: 'bg-ink-100 text-ink-600',
  low: 'bg-risk-low/12 text-risk-low',
  medium: 'bg-risk-medium/15 text-risk-medium',
  high: 'bg-risk-high/15 text-risk-high',
  critical: 'bg-risk-critical/12 text-risk-critical',
  accent: 'bg-accent-soft text-accent',
}

interface BadgeProps {
  tone?: Tone
  children: ReactNode
  className?: string
}

export function Badge({ tone = 'neutral', children, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE_CLASSES[tone]} ${className}`}
    >
      {children}
    </span>
  )
}

export function riskTone(level: 'low' | 'medium' | 'high' | 'critical'): Tone {
  return level
}
