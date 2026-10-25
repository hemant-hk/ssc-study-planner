# Privacy Auditor

A minimalist, **local-only** personal privacy & digital footprint auditor built
with Next.js (App Router), TypeScript, and Tailwind CSS.

## Features

- **Interactive assessment** — 24 questions across six categories (credentials,
  browsing, device security, mobile permissions, social media, data brokers) in
  a multi-step wizard.
- **Risk analysis dashboard** — real-time *Privacy Footprint Score* with an
  animated score ring, per-category weighted breakdown, and risk levels
  (low / medium / high / critical).
- **Mitigation checklist** — auto-generated from your negative answers, sorted
  by impact priority, with step-by-step instructions, time estimates, and
  curated resource links.
- **Resource directory** — 26 curated privacy tools (password managers,
  encrypted mail, private DNS, VPNs, browsers, search, messaging) with
  open-source / free filters and search.
- **Privacy first** — every answer is computed and persisted in
  `localStorage`. No accounts, no servers, no network calls with your data.

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Scripts

| Script          | Purpose                     |
| --------------- | --------------------------- |
| `npm run dev`   | Development server          |
| `npm run build` | Production build            |
| `npm start`     | Serve the production build  |
| `npm run typecheck` | Strict TypeScript check |

## Architecture

```
src/
├── app/                  # App Router pages (/, /assessment, /dashboard, /resources)
├── components/
│   ├── assessment/       # Multi-step questionnaire wizard
│   ├── dashboard/        # Score overview + mitigation checklist
│   ├── layout/           # Header / footer
│   ├── resources/        # Filterable tool directory
│   └── ui/               # Button, Badge, ProgressBar, ScoreRing
├── hooks/useAssessment.ts # Client-side state + localStorage persistence
├── lib/
│   ├── questions.ts       # Question & category definitions with weights
│   ├── scoring.ts         # Score math + mitigation action templates
│   └── tools.ts           # Curated privacy tool directory
└── types/audit.ts         # Strict typing for all audit metrics/states
```
