import Link from 'next/link'
import {
  ArrowRight,
  BarChart3,
  Database,
  FileSearch,
  Landmark,
  MessageSquareText,
  Phone,
} from 'lucide-react'
import { SearchBar } from '@/components/search/SearchBar'
import { CATEGORIES, CATEGORY_ORDER, RESOURCES } from '@/lib/resources'
import { DATASETS } from '@/lib/datasets'

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  flag: Landmark,
  database: Database,
  'bar-chart': BarChart3,
  scale: FileSearch,
  briefcase: Database,
  phone: Phone,
  'indian-rupee': BarChart3,
}

const HIGHLIGHTS = [
  {
    icon: MessageSquareText,
    title: 'Ask in plain language',
    body: '“Literacy rate of Kerala” or “How do I file an RTI” — the assistant answers with cited official sources.',
    href: '/ask',
    cta: 'Try the assistant',
  },
  {
    icon: Database,
    title: `${DATASETS.length} curated datasets`,
    body: 'Census, budget, trade, crime, labour and environment datasets with direct links to official portals.',
    href: '/datasets',
    cta: 'Browse datasets',
  },
  {
    icon: FileSearch,
    title: 'Smart search',
    body: 'Intent detection over schemes, laws, tenders, helplines and finance — with fuzzy matching for typos.',
    href: '/search',
    cta: 'Search now',
  },
] as const

export default function HomePage() {
  const featured = RESOURCES.filter(r =>
    ['pmjay', 'data-gov-in', 'rti-portal', 'india-budget', 'helpline-112', 'nsp'].includes(r.id)
  )

  return (
    <div className="animate-fade-in">
      <section className="border-b border-ink-200/70 bg-surface">
        <div className="container-page py-14 text-center sm:py-20">
          <p className="eyebrow">Open government data · India & global</p>
          <h1 className="mx-auto mt-3 max-w-3xl text-3xl font-semibold leading-tight tracking-tight text-ink-950 sm:text-4xl lg:text-[2.75rem]">
            Every public government dataset,
            <span className="block text-ink-400">findable in one search.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-ink-600">
            BharatData AI indexes official portals — welfare schemes, census
            statistics, laws & RTI, tenders, helplines and budgets — and lets
            you query them in plain language. Every answer links back to the
            government source.
          </p>

          <div className="mx-auto mt-8 max-w-2xl text-left">
            <SearchBar large autoFocus />
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-xs text-ink-500">
            <span className="flex items-center gap-1">
              <Landmark className="h-3.5 w-3.5 text-govt" aria-hidden />
              {RESOURCES.length} official sources
            </span>
            <span aria-hidden>·</span>
            <span>{CATEGORY_ORDER.length} categories</span>
            <span aria-hidden>·</span>
            <span>{DATASETS.length} datasets</span>
            <span aria-hidden>·</span>
            <span className="text-leaf">no login, client-side</span>
          </div>
        </div>
      </section>

      <section className="container-page py-12">
        <p className="eyebrow">Explore by category</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {CATEGORY_ORDER.map(id => {
            const cat = CATEGORIES[id]
            const Icon = ICONS[cat.icon] ?? Database
            const count = RESOURCES.filter(r => r.category === id).length
            return (
              <Link
                key={id}
                href={`/explore?cat=${id}`}
                className="card group p-4 transition-shadow hover:shadow-lift"
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-govt-soft text-govt">
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="font-mono text-xs text-ink-400">
                    {count}
                  </span>
                </div>
                <h2 className="mt-3 text-sm font-semibold text-ink-900 group-hover:text-govt">
                  {cat.name}
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-ink-500">
                  {cat.description}
                </p>
              </Link>
            )
          })}
        </div>
      </section>

      <section className="border-y border-ink-200/70 bg-surface">
        <div className="container-page py-12">
          <p className="eyebrow">Featured sources</p>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map(r => (
              <li key={r.id}>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="card block h-full p-4 transition-shadow hover:shadow-lift"
                >
                  <span className="rounded bg-govt-soft px-1.5 py-0.5 text-[11px] font-medium text-govt">
                    {CATEGORIES[r.category].name}
                  </span>
                  <h3 className="mt-2 text-sm font-semibold text-ink-950">
                    {r.title}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-500">
                    {r.description}
                  </p>
                  <p className="mt-2 text-[11px] text-ink-400">{r.org}</p>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="container-page py-12">
        <div className="grid gap-4 md:grid-cols-3">
          {HIGHLIGHTS.map(h => (
            <article key={h.title} className="card flex flex-col p-5">
              <h.icon className="h-5 w-5 text-saffron" aria-hidden />
              <h2 className="mt-3 text-sm font-semibold text-ink-900">
                {h.title}
              </h2>
              <p className="mt-1.5 flex-1 text-sm leading-relaxed text-ink-600">
                {h.body}
              </p>
              <Link
                href={h.href}
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-govt hover:underline"
              >
                {h.cta} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
