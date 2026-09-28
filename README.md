# Study Planner

Video → study-plan web app with AI-generated summaries, quizzes, chapter notes,
PYQ bank, mock tests, and **cross-device cloud sync** of subjects and study plans
via Upstash Redis.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Cloud sync (Upstash Redis) setup

The app saves subjects and study plans to Upstash Redis so they survive refreshes
and sync across devices. It needs two environment variables configured **once**:

1. Create a free database at [Upstash Redis](https://console.upstash.com/redis)
   (Serverless Redis, REST region nearest to your users).
2. Copy `.env.local.example` → `.env.local` for local dev and set the same values
   in your deployed environment:
   - `UPSTASH_REDIS_REST_URL` — the `UPSTASH_REDIS_REST_URL` value from your
     Upstash database's **REST API** tab (e.g. `https://your-db.upstash.io`).
   - `UPSTASH_REDIS_REST_TOKEN` — the `UPSTASH_REDIS_REST_TOKEN` value from the
     same tab (a long `eyJ...` bearer token).

No table schema is needed: subjects live in a Redis hash `subjects` (one field
`subject:<id>` per subject, plus a `subject:__seeded__` marker) and study plans
live in the Redis hash `study_cache` (one field per videoId).

> If the cloud is unreachable (offline, misconfigured, no credentials yet), the
> app automatically falls back to the server's local file mirror
> (`data/subjects.json`, `data/study-cache.json`) and then to the browser's
> localStorage, so you never lose work. A **server/cloud sync** badge in the
> header shows whether data syncs across devices or is only kept on this one.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

Deploy this app on Vercel so it runs somewhere with a stable network that can
reach Upstash Redis, and set the `UPSTASH_REDIS_REST_URL` and
`UPSTASH_REDIS_REST_TOKEN` env vars listed above in the project settings.