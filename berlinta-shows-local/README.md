# Berlintina Shows

A web platform connecting event planners with curated shows and artists in Berlin. Features an AI-powered search concierge that matches event descriptions to the right performances—from classical music to acrobatics and dance.

## Overview

**Berlintina Shows** is a bilingual (German/English) marketplace for event entertainment. Every show on the platform is personally vetted. The AI concierge extracts event details from natural language (e.g. *"elegant live music for a gala in Berlin"*) and recommends the best-matching shows.

### Features

- **AI Concierge Search** – Describe your event in plain language; the app extracts event type, budget, vibe, duration, and more, then scores and ranks shows
- **Show Catalog** – Browse all shows by category (Classical, Band, Acrobatics, Dance) with filters and search
- **Show Detail Pages** – Full descriptions, pricing, photos, and contact/booking
- **Artist Onboarding** – Conversational flow for artists to register and submit shows
- **Bilingual** – German and English throughout

## Tech Stack

| Layer | Stack |
|-------|--------|
| Frontend | React 19, Vite 6, TypeScript, Tailwind CSS |
| Backend | Express.js (Node) |
| Database | Postgres, hosted on Railway |
| AI | OpenAI GPT-4o-mini or Google Gemini 1.5 Flash |

## Project Structure

```
├── App.tsx                 # Main app & routes
├── components/             # UI components (ShowCard, LanguageToggle)
├── contexts/               # ShowsContext (loads from the Express API, or mock data)
├── lib/                    # matching.ts (show scoring), db.js (Postgres query builder), storage.js (file uploads)
├── services/               # aiService, apiClient, showsService
├── server/                 # Express backend (AI endpoints, shows/submissions/admin API)
│   ├── index.js            # POST /api/ai/extract-brief, /api/ai/answer-question, ...
│   └── .env.example
├── db/schema.sql            # Full Postgres schema — the one source of truth, no migrations to run in order
├── types.ts                # Show, CustomerBrief, Category, etc.
└── vite.config.ts
```

## Getting Started

### Run with Backend (recommended – API keys stay on server)

1. **Backend** (terminal 1):
   ```bash
   cd server
   cp .env.example .env
   # Edit .env: add OPENAI_API_KEY and/or GEMINI_API_KEY
   npm install
   npm run dev
   ```
   Backend runs at http://localhost:3001. The frontend proxies `/api` to it.

2. **Frontend** (terminal 2):
   ```bash
   npm install
   npm run dev
   ```
   Open http://localhost:3000 (or http://localhost:0/#/)

API keys live only in `server/.env` and are never sent to the browser.

### Database (Postgres on Railway)

Shows, submissions, artist accounts, the KB and the blog all live in one Postgres
database. There is no separate database project to create and no migrations to run
in order — `db/schema.sql` is the single, current source of truth for the schema
(see `RAILWAY.md` for how the earlier Supabase setup was consolidated into it).

1. Provision a Postgres instance (on Railway: **New** → **Database** → **PostgreSQL**,
   which gives you a `DATABASE_URL` automatically).
2. Load the schema:
   ```bash
   psql "$DATABASE_URL" -f db/schema.sql
   ```
3. In `server/.env`, set:
   ```bash
   DATABASE_URL=postgresql://user:password@host:5432/railway
   UPLOAD_DIR=./uploads   # on Railway: the path your volume is mounted at, e.g. /data
   ```
4. Restart the backend. The frontend always talks to the Express API (`services/showsService.ts`), never to Postgres directly; if a request fails it falls back to mock shows.

To add shows: use the admin panel (below) or write directly to the `shows` table.
Columns match the `Show` type (snake_case in DB: `short_id`, `artist_name`,
`photo_urls` jsonb, etc.).

Full deploy instructions, including the required volume for uploaded photos, are in
`RAILWAY.md`.

## Artist Submissions (EPIC 2)

1. Already covered by `db/schema.sql` — no separate step needed.
2. Uploaded photos are written to `UPLOAD_DIR` (see above) and served from `/media`
   via `lib/storage.js`.
3. Artists complete the /join flow; data is saved to `show_submissions` with `status='PENDING_REVIEW'`.
4. Spam protection: rate limit (5 per 15 min), honeypot field.

## Admin (EPIC 4)

1. Add to `server/.env`:
   ```bash
   ADMIN_PASSWORD=your-secret-password
   ```
2. Open `/#/admin` in the browser and log in with the password.
3. List submissions (filter by status), open a submission, and approve (publish to shows) or reject/request changes. Once approved, the show appears on the catalog immediately.
4. **Shows** (`/#/admin/shows`): list all published shows; edit any show (text and one or more pictures). Optionally use “Send email to artist” when saving to notify the artist of changes.

### Artist notification email (optional)

To notify the artist by email when a show is approved or when you edit it, configure SMTP in `server/.env`:

```bash
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-user
SMTP_PASS=your-password
EMAIL_FROM=Berlintina <noreply@example.com>
```

Visibility on the catalog does not depend on email; shows are visible as soon as they are Approved.

## Knowledge Base (EPIC 5.2)

1. Already covered by `db/schema.sql` (`kb_articles` table) — no separate step needed.
2. GET `/api/kb?locale=de&q=booking` returns relevant KB articles. Used in Q&A for platform context.

## AI Endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /api/ai/extract-brief` | Extracts a `CustomerBrief` (eventType, desiredCategories, desiredVibes, budgetMax, etc.) from natural-language event description |
| `POST /api/ai/answer-question` | Answers questions about a show using its facts (e.g. “Can they play outdoors?”) |

The backend prefers OpenAI if `OPENAI_API_KEY` is set; otherwise uses Gemini if `GEMINI_API_KEY` is set. With neither, it falls back to mock responses.

## Show Matching

Shows are scored against a `CustomerBrief` in `lib/matching.ts`:

- Category match: +50
- Vibe overlap: +15 per tag
- Language preference: +10
- Budget compatibility: +20

Results are sorted by score descending.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `cd server && npm run dev` | Start backend with watch |

## License

© 2024 Berlintina • Created with care in Berlin
