import Link from 'next/link'
import {
  ArrowRight,
  ClipboardCheck,
  Gauge,
  ListChecks,
  HardDrive,
  Wrench,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'

const FEATURES = [
  {
    icon: ClipboardCheck,
    title: 'Interactive assessment',
    body: 'A short, multi-step questionnaire covering passwords, 2FA, sharing settings, permissions and device hardening.',
  },
  {
    icon: Gauge,
    title: 'Risk analysis dashboard',
    body: 'A live Privacy Footprint Score with a per-category breakdown: browsing, social media, credentials, mobile, data brokers, devices.',
  },
  {
    icon: ListChecks,
    title: 'Mitigation checklist',
    body: 'Prioritized, step-by-step fixes — ordered by impact — so you know exactly what to harden first.',
  },
  {
    icon: HardDrive,
    title: 'Local-only processing',
    body: 'Every answer is computed and stored in your browser. No accounts, no servers, no telemetry, no network calls with your data.',
  },
] as const

const FLOW = [
  { step: '01', title: 'Answer honestly', body: 'Six categories, 24 questions, about four minutes.' },
  { step: '02', title: 'Read the score', body: 'See where your digital footprint leaks the most.' },
  { step: '03', title: 'Work the checklist', body: 'Tick off remediation tasks as you harden each area.' },
] as const

export default function HomePage() {
  return (
    <div className="animate-fade-in">
      <section className="border-b border-ink-200/60 bg-surface">
        <div className="container-page flex flex-col gap-8 py-14 sm:py-20 lg:flex-row lg:items-center lg:gap-16">
          <div className="flex-1">
            <p className="eyebrow">Open-source · Client-side · Free</p>
            <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-ink-950 sm:text-4xl lg:text-[2.75rem]">
              Audit your digital footprint
              <span className="block text-ink-400">before someone else does.</span>
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-600">
              A minimalist privacy checkup: answer a few questions about your
              habits, get a Privacy Footprint Score with a vulnerability
              breakdown, and walk away with a prioritized hardening checklist —
              computed entirely in your browser.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link href="/assessment">
                <Button size="lg">
                  Start assessment <ArrowRight className="h-4 w-4" aria-hidden />
                </Button>
              </Link>
              <Link href="/resources">
                <Button variant="secondary" size="lg">
                  Browse tool directory
                </Button>
              </Link>
            </div>
            <p className="mt-4 flex items-center gap-2 text-xs text-ink-500">
              <HardDrive className="h-3.5 w-3.5 text-accent" aria-hidden />
              Your answers never leave this device — no data is sent to any server.
            </p>
          </div>

          <div className="w-full max-w-sm shrink-0 lg:ml-auto">
            <div className="card p-5">
              <div className="flex items-center justify-between border-b border-ink-100 pb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-500">
                  Sample report
                </span>
                <span className="rounded-full bg-risk-medium/15 px-2 py-0.5 text-xs font-medium text-risk-medium">
                  Fair
                </span>
              </div>
              <ul className="mt-4 space-y-4">
                {[
                  { name: 'Credentials & Auth', pct: 75, tone: 'bg-risk-medium' },
                  { name: 'Browsing & Network', pct: 62, tone: 'bg-risk-medium' },
                  { name: 'Device Security', pct: 88, tone: 'bg-risk-low' },
                  { name: 'Mobile Permissions', pct: 41, tone: 'bg-risk-high' },
                  { name: 'Data Brokers', pct: 24, tone: 'bg-risk-critical' },
                ].map(row => (
                  <li key={row.name}>
                    <div className="mb-1 flex items-baseline justify-between text-sm">
                      <span className="text-ink-700">{row.name}</span>
                      <span className="font-mono text-xs tabular-nums text-ink-400">
                        {row.pct}%
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-ink-100">
                      <div
                        className={`h-full rounded-full ${row.tone}`}
                        style={{ width: `${row.pct}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="container-page py-12 sm:py-16">
        <p className="eyebrow">What you get</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {FEATURES.map(f => (
            <article key={f.title} className="card p-5 transition-shadow hover:shadow-lift">
              <f.icon className="h-5 w-5 text-accent" aria-hidden />
              <h2 className="mt-3 text-base font-semibold text-ink-900">{f.title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{f.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-t border-ink-200/60 bg-surface">
        <div className="container-page py-12 sm:py-16">
          <p className="eyebrow">How it works</p>
          <ol className="mt-6 grid gap-6 sm:grid-cols-3">
            {FLOW.map(item => (
              <li key={item.step} className="flex gap-3">
                <span className="font-mono text-sm font-semibold text-accent">
                  {item.step}
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-ink-900">{item.title}</h3>
                  <p className="mt-1 text-sm text-ink-600">{item.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-10 flex justify-center">
            <Link href="/assessment">
              <Button>
                Begin the audit <ArrowRight className="h-4 w-4" aria-hidden />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="container-page py-12 sm:py-16">
        <div className="card flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <Wrench className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden />
            <div>
              <h2 className="text-base font-semibold text-ink-900">
                Curated open-source tool directory
              </h2>
              <p className="mt-1 text-sm text-ink-600">
                Trusted, audited tools for every category — password managers,
                encrypted mail, private DNS, browsers and more.
              </p>
            </div>
          </div>
          <Link href="/resources" className="shrink-0">
            <Button variant="secondary">Open directory</Button>
          </Link>
        </div>
      </section>
    </div>
  )
}
