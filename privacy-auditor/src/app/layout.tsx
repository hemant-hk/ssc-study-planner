import type { Metadata } from 'next'
import { SiteHeader } from '@/components/layout/SiteHeader'
import { SiteFooter } from '@/components/layout/SiteFooter'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'Privacy Auditor — Personal Digital Footprint Checkup',
    template: '%s · Privacy Auditor',
  },
  description:
    'A minimalist, open-source personal privacy auditor. Assess your digital footprint, get a risk breakdown, and receive an actionable hardening checklist — all processed locally in your browser.',
  keywords: [
    'privacy',
    'digital footprint',
    'security audit',
    'privacy score',
    'open source',
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
