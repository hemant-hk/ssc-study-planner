import type { Metadata } from 'next'
import { Dashboard } from '@/components/dashboard/Dashboard'

export const metadata: Metadata = {
  title: 'Dashboard',
  description:
    'Your Privacy Footprint Score with per-category risk breakdown and a prioritized mitigation checklist.',
}

export default function DashboardPage() {
  return (
    <div className="container-page py-8 sm:py-10">
      <header className="mb-6">
        <p className="eyebrow">Risk analysis</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink-950">
          Dashboard
        </h1>
      </header>
      <Dashboard />
    </div>
  )
}
