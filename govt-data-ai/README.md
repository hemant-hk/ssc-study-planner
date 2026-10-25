# BharatData AI — Public Government Data Explorer

An AI-assisted website that makes **public** government data easy to find and
query: welfare schemes, open datasets, census & economic statistics, laws &
RTI, tenders, helplines and budget documents — always linking back to the
official source.

> Scope: this is an index of **officially published, public** government
> sources only. It does not access restricted or non-public systems.

## Features

- **AI search** (`/search`) — intent detection (scheme / data / law / tender /
  job / finance / stat), state & year entity extraction, typo-tolerant fuzzy
  matching, and "Reading as:" interpretation chips.
- **Ask AI** (`/ask`) — chat assistant answering plain-language questions
  ("literacy rate of Kerala", "how do I file an RTI") from a curated fact base,
  with cited sources and related resources. Runs fully client-side.
- **Explore** (`/explore`) — 43 official sources in 7 categories with filters.
- **Datasets** (`/datasets`) — 20-entry catalog with format filters
  (API / CSV / Dashboard / PDF / Web).
- Static-first: every route prerendered; no accounts, no server-side storage.

## Stack

Next.js 14 (App Router) · TypeScript (strict) · Tailwind CSS 3 · lucide-react

## Run

```bash
npm install
npm run dev      # http://localhost:3000
npm run build && npm start
npm run typecheck
```

## Structure

```
src/
├── app/            # /, /search, /ask, /explore, /datasets
├── components/     # layout, SearchBar, ResultCard, AskChat
├── lib/
│   ├── resources.ts  # 43 curated official sources by category
│   ├── datasets.ts   # dataset catalog
│   ├── facts.ts      # published statistics + state census facts
│   ├── search.ts     # intent/entity analysis + scoring engine
│   └── ask.ts        # NL question routing + cited answers
└── types/govt.ts    # shared strict types
```
