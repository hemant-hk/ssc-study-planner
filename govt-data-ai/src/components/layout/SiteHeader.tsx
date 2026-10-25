'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Landmark } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/', label: 'Home' },
  { href: '/search', label: 'Search' },
  { href: '/ask', label: 'Ask AI' },
  { href: '/explore', label: 'Explore' },
  { href: '/datasets', label: 'Datasets' },
] as const

export function SiteHeader() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-40 border-b border-ink-200/70 bg-canvas/90 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 text-sm font-semibold text-ink-950">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-govt text-white">
            <Landmark className="h-4 w-4" aria-hidden />
          </span>
          <span className="tracking-tight">
            Bharat<span className="font-normal text-govt">Data</span>
            <span className="ml-1 hidden text-xs font-normal text-ink-400 sm:inline">
              AI · public govt data
            </span>
          </span>
        </Link>

        <nav aria-label="Primary">
          <ul className="flex items-center gap-0.5 sm:gap-1">
            {NAV_ITEMS.map(item => {
              const active =
                item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={`rounded-lg px-2 py-1.5 text-[13px] transition-colors sm:px-2.5 ${
                      active
                        ? 'bg-govt-soft font-medium text-govt'
                        : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900'
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
      </div>
    </header>
  )
}
