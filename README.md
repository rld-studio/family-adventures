# The Family Board

A shared, low-pressure board of activity ideas. Everyone (Dad, Son, Daughter) opens the same
URL, scans ideas, taps **I'm in / Maybe / Not now / Hard pass**, adds their own, and moves a
few things toward **This Week** or **This Month**. No login, no accounts.

It's a Vite + React app that stores one shared board in **Supabase** (a hosted Postgres
database with a free tier). The browser talks to Supabase directly — there's no backend of
your own to run, so local dev is just `npm run dev`.

---

## What you need

- A free [Supabase](https://supabase.com) account
- A free [Vercel](https://vercel.com) account (or any static host)
- Node 18+ for local dev

---

## Set it up (about 5 minutes)

### 1. Create a Supabase project
- In Supabase, create a new project. Wait for it to finish provisioning.
- Go to **Project Settings → API** and copy two things:
  - **Project URL** (looks like `https://abcd1234.supabase.co`)
  - **anon public** key (the long one labeled `anon` / `public` — *not* `service_role`)

### 2. Create the table
- Open **SQL Editor → New query**, paste the contents of [`supabase/schema.sql`](supabase/schema.sql),
  and click **Run**. That creates the `cards` table and an access policy so the app can read
  and write it.

### 3. Add your keys locally
- Copy `.env.example` to `.env` and fill in your two values:

```
VITE_SUPABASE_URL=https://YOUR-PROJECT-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

### 4. Run it
```bash
npm install
npm run dev
```
Open the local URL. The first load seeds the board with the starter ideas. Add a card on one
browser and it shows up on another within a few seconds.

---

## Deploy to Vercel

1. Push this folder to a GitHub repo.
2. In Vercel: **Add New → Project**, import the repo (it auto-detects **Vite**).
3. Under **Environment Variables**, add the same two values:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. **Deploy**, open the URL, and share it with the family.

> Already have a Vercel site and just want this as one page? Build it (`npm run build`) and
> drop the contents of `dist/` wherever you serve static files, or add it as a route/subdomain.

---

## How it works

- **One shared board.** Each card is its own row in the `cards` table (`id`, `data` jsonb).
  Storing cards per-row means two people reacting to *different* cards at the same time never
  overwrite each other.
- **Auto-sync.** Every device refreshes the board every few seconds and right after any
  change, so everyone stays in step. The pill in the header shows Synced / Saving / Offline.
- **Offline-friendly.** The last-seen board is cached in the browser, so it loads instantly
  and survives a brief drop; changes sync when you're back.
- **Export / Import / Reset** live in the ⋯ menu. Export downloads the whole board as JSON,
  import replaces the shared board, reset restores the starter ideas.

### The lanes
Ideas · This Week · This Month · Someday · Done / Memories. Move a card with the dropdown at
the bottom of it. Cards in **Done** get a memory note and a "would do again?" toggle.

### A nice touch
When two or more people mark a card **I'm in**, it quietly lights up — so agreement surfaces
on its own, without anyone having to push for it.

---

## Security note (please read)

This app has no login, and the Supabase **anon key ships in the frontend** (that's normal —
it's the public key). With the open access policy from `schema.sql`, anyone who has your site
URL can read and edit the board. For a private family board shared by link that's usually
fine, and it's only activity ideas. If you want it locked down:

- Turn on [Vercel password protection](https://vercel.com/docs/security/deployment-protection)
  for the project, or
- Add Supabase Auth and tighten the row-level-security policy to signed-in users.

Never put the Supabase `service_role` key in this app.

---

## Project structure

```
family-board/
├── src/
│   ├── App.jsx        # the whole UI
│   ├── db.js          # Supabase reads/writes
│   ├── supabase.js    # Supabase client from env vars
│   ├── model.js       # the card shape + helpers
│   ├── seed.js        # the starter cards
│   ├── main.jsx
│   └── styles.css
├── supabase/
│   └── schema.sql     # run once to create the table + policy
├── index.html
├── package.json
├── vite.config.js
└── .env.example
```

## Editing the starter ideas
The seed lives in `src/seed.js`. Change it, then use **⋯ → Reset to starter ideas** to reload
from it. Categories, time / cost / energy options, and the lanes are at the top of
`src/App.jsx`.

## Optional: instant updates
The app refreshes every few seconds, which is plenty. If you want truly live updates, the
last line of `schema.sql` (commented out) enables Supabase Realtime for the table; you can
then subscribe with `supabase.channel(...)` in `db.js`. Not needed for normal use.
