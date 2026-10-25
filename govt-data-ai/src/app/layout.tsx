import type { Metadata } from 'next'
import { SiteHeader } from '@/components/layout/SiteHeader'
import { SiteFooter } from '@/components/layout/SiteFooter'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'BharatData AI — Public Government Data Explorer',
    template: '%s · BharatData AI',
  },
  description:
    'AI-powered explorer for public government data: schemes, open datasets, census statistics, laws & RTI, tenders, helplines and budget documents — with cited official sources.',
  keywords: [
    'government data',
    'open data india',
    'data.gov.in',
    'schemes',
    'census',
    'RTI',
    'tenders',
    'helplines',
  ],
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  )
}
