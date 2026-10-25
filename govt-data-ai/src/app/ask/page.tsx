import type { Metadata } from 'next'
import { AskChat } from '@/components/ask/AskChat'

export const metadata: Metadata = {
  title: 'Ask AI',
  description:
    'Plain-language questions over an index of public government schemes, datasets, laws, tenders, helplines and statistics — with cited sources.',
}

export default function AskPage() {
  return (
    <div className="container-page py-8">
      <header className="mb-5 max-w-2xl">
        <p className="eyebrow">AI assistant</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink-950">
          Ask about public government data
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-600">
          The assistant reads a curated index of official sources and answers
          with citations. It does not send your questions anywhere — matching
          runs locally in your browser.
        </p>
      </header>
      <AskChat />
    </div>
  )
}
