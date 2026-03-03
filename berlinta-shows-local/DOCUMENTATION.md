# Berlintina Shows — What Is Already Done

This document describes what has been implemented in the project so far.

---

## Frontend

### Routing & Layout
- **HashRouter** with routes: `/`, `/catalog`, `/join`, `/about`, `/results/:briefId`, `/show/:slugShortId`
- **Layout component** with header (logo, nav links, language toggle), main content area, and footer
- Bilingual support (German / English) via `LanguageToggle` and `locale` state

### Pages / Views

| Route | Component | What It Does |
|-------|-----------|--------------|
| `/` | Landing | AI search bar; live text search; AI concierge extracts brief, scores shows, shows top picks; quick-view sidebar for show cards |
| `/catalog` | Catalog | Browse all shows; filter by category (CLASSICAL, BAND, ACROBATICS, DANCE); search by artist or show; masonry grid; quick-view sidebar |
| `/join` | Join | Artist onboarding flow: multi-step conversational UI (genre, show title, photo/video upload, duration, price, highlights, socials, bio, email) |
| `/about` | About | About Valiantsina; “Why for free?”; links to catalog and join |
| `/results/:briefId` | Results | Shows recommendations based on stored brief; masonry grid; quick-view sidebar |
| `/show/:slugShortId` | ShowDetail | Full show page with hero image, title, sales pitch, description, pricing, “Jetzt anfragen” button |

### Data & State
- **ShowsContext** loads shows from Supabase when `VITE_SUPABASE_*` env vars are set; falls back to mock data
- `sessionStorage` used for landing query and brief data for results page

### Components
- **ShowCard** – card for a show (image, title, artist, category, duration, vibe tags)
- **LanguageToggle** – DE/EN switch

---

## Backend (server/)

- **Express** app on port 3001
- CORS enabled, JSON body parser
- **AI endpoints:**
  - `POST /api/ai/extract-brief` – extracts `CustomerBrief` from natural-language event description (OpenAI or Gemini)
  - `POST /api/ai/answer-question` – answers questions about a show given its facts
- **Provider selection:** OpenAI if `OPENAI_API_KEY` set; else Gemini if `GEMINI_API_KEY` set; else mock responses
- **Health check:** `GET /api/health` returns `{ ok, ai }`

---

## AI & Matching

- **aiService** (frontend) delegates to `apiClient`, which calls backend `/api/...` endpoints
- **extractBrief** – turns user text into structured `CustomerBrief` (eventType, desiredCategories, desiredVibes, durationMinutes, budgetMax, etc.)
- **scoreShows** (`lib/matching.ts`) – scores shows against brief (category, vibes, language, budget), returns sorted list

---

## Database (Supabase)

- **Migration** `001_create_shows.sql`: creates `shows` table with columns for all `Show` fields
- **RLS:** public can read only rows with `status = 'PUBLISHED'`
- **showsService** fetches from Supabase and maps snake_case DB columns to camelCase `Show` type

---

## Configuration

- **Vite** proxies `/api` to backend (e.g. `http://localhost:3001`)
- **Env vars:**
  - Root: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (optional)
  - Server: `OPENAI_API_KEY`, `GEMINI_API_KEY`, `MOCK_MODE`, `PORT`

---

## What Works End-to-End

1. Landing search with natural language → AI brief extraction → show scoring → ranked results
2. Catalog with category filter and text search
3. Show detail page with hero, description, pricing
4. Artist onboarding flow (conversational steps)
5. Bilingual UI (DE/EN)
6. Quick-view sidebar from catalog, landing, and results
