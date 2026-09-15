# StayNest

Verified PG, hostel and co-living listings across India — Bangalore, Delhi, Mumbai, Pune,
Hyderabad and Chennai. Next.js 16 (App Router) + TypeScript + Supabase (Auth, Postgres, Storage).

## Local development

```bash
npm install
cp .env.example .env.local   # fill in your Supabase project values
npm run dev
```

Open http://localhost:3000.

## Database setup

In your Supabase project's SQL Editor, run in order:
1. `supabase/schema.sql`
2. `supabase/002_features.sql`

## Photos

Listing photos are hosted on Supabase Storage (public `pg-photos` bucket), not in this repo.
`scripts/migrate-photos-to-storage.ts` is the one-time script that uploaded them from the old
vanilla-JS app's `legacy-vanilla-app/data/photos/` folder — it's kept for reference and doesn't
need to run again unless that bucket is rebuilt from scratch.

## Adding more cities / listings later

`scripts/generate-bangalore-pgs.js` and `scripts/generate-india-pgs.js` are the original Google
Places + Tavily-based scrapers, carried over unchanged. They still write to local
`data/*.js`/photo files, so after running one you'd re-run the photo migration script and merge
the new records into `data/bangalore-pgs.json` / `data/india-pgs.json`. Needs `GOOGLE_API_KEY`
and `TAVILY_API_KEY` in `.env.local`.

## Production build

```bash
npm run build
npm run start:standalone   # node .next/standalone/server.js — needs static assets copied first, see below
```

`next.config.ts` sets `output: "standalone"`. Before running `start:standalone` on a fresh
checkout, copy the static assets the standalone server doesn't bundle on its own:

```bash
cp -r public .next/standalone/public
cp -r .next/static .next/standalone/.next/static
```

Put a reverse proxy (nginx / Caddy) with HTTPS in front of the Node process for real deployments.

## Legacy app

`legacy-vanilla-app/` is the original vanilla HTML/JS/CSS version of this app, kept for reference.
It's no longer deployed or maintained — this Next.js app replaced it.
