import type { Metadata } from 'next'
import { ToolDirectory } from '@/components/resources/ToolDirectory'

export const metadata: Metadata = {
  title: 'Resources',
  description:
    'A curated directory of trusted open-source privacy tools: password managers, encrypted mail, private DNS, VPNs, browsers and more.',
}

export default function ResourcesPage() {
  return (
    <div className="container-page py-8 sm:py-10">
      <header className="mb-6 max-w-2xl">
        <p className="eyebrow">Tool directory</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink-950">
          Trusted privacy tools
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-600">
          A hand-picked directory of tools recommended by the privacy community.
          Open-source and free options are labeled — pick what fits your threat
          model and comfort level.
        </p>
      </header>
      <ToolDirectory />
    </div>
  )
}
