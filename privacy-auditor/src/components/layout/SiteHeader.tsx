'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/', label: 'Home' },
  { href: '/assessment', label: 'Assessment' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/resources', label: 'Resources' },
] as const

export function SiteHeader() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-40 border-b border-ink-200/60 bg-canvas/85 backdrop-blur-sm">
      <div className="container-page flex h-14 items-center justify-between gap-4">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm font-semibold text-ink-900"
          aria-label="Privacy Auditor home"
        >
          <ShieldCheck className="h-5 w-5 text-accent" aria-hidden />
          <span className="tracking-tight">
            Privacy<span className="text-ink-500">Auditor</span>
          </span>
        </Link>

        <nav aria-label="Primary">
          <ul className="flex items-center gap-1 sm:gap-2">
            {NAV_ITEMS.map(item => {
              const active =
                item.href === '/'
                  ? pathname === '/'
                  : pathname.startsWith(item.href)
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`rounded-lg px-2.5 py-1.5 text-sm transition-colors sm:px-3 ${
                      active
                        ? 'bg-accent-soft font-medium text-ink-900'
                        : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900'
                    }`}
                    aria-current={active ? 'page' : undefined}
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
