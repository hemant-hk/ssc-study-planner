# Study Planner

Video → study-plan web app with AI-generated summaries, quizzes, chapter notes,
PYQ bank, mock tests, and **cross-device cloud sync** of subjects and study plans
via Supabase.

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

## Cloud sync (Supabase) setup

The app saves subjects and study plans to Supabase so they survive refreshes
and sync across devices. It needs two things configured **once**:

1. **Create the table (one-time, in Supabase).**
   - Supabase Dashboard → your project → **SQL Editor**.
   - Open `supabase/schema.sql` from this repo, paste it, and click **Run**.
   - This creates the `study_cache` table and the RLS policies. Rows store both
     study plans (keyed by videoId) and subjects (keyed by `subject:<id>`), plus
     a one-time seed marker.

2. **Set the environment variables** (copy `.env.local.example` →
   `.env.local` for local dev, and set the same values in **Vercel → Settings →
   Environment Variables**):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` — optional but recommended (bypasses RLS; never
     expose this one to the browser).

> If the cloud is unreachable (offline, misconfigured, table missing), the app
> automatically falls back to the browser's localStorage so you never lose work.
> A **"Cloud: On / Cloud: Off"** badge in the header shows whether data is being
> saved to the cloud and syncing across devices or only kept on this one.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

Deploy this app on Vercel so it runs somewhere with a stable network that can
reach Supabase, and set the Supabase env vars listed above in the project
settings.