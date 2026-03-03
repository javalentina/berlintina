# Technical Tasks Roadmap (Frontend + Backend + DB + AI + Admin)

## Current baseline (already done)
- Frontend routes: / (Landing), /catalog, /join, /about, /results/:briefId, /show/:slugShortId (HashRouter)
- ShowsContext loads shows from Supabase when env is set; falls back to mock
- Supabase shows table + RLS: public read only status='PUBLISHED'
- Backend Express endpoints: POST /api/ai/extract-brief, POST /api/ai/answer-question, GET /api/health
- EPIC 1 ✅: Production Supabase, pagination, loading/empty/error states
- EPIC 2 ✅: show_submissions, POST /api/submissions, media upload, /join submit
- EPIC 3 ✅: Conversation API, single concierge (Landing), Join uses conversation engine

---

## EPIC 1 — Shows page reads from Database (end-to-end "real data") ✅
- [x] Production Supabase config + fail loudly
- [x] Catalog/ShowDetail data completeness + loading/empty/error states
- [x] Pagination + server-side filtering

---

## EPIC 2 — Save "Welcome to Community" (artist onboarding) ✅
- [x] show_submissions table + migrations
- [x] Supabase Storage submissions-media
- [x] POST /api/submissions + rate limit + honeypot
- [x] /join submit + success screen

---

# EPIC 3 — FIX/REWORK: Conversational UX is the PRODUCT (Start + Join)

> Epic exists but UX is wrong / feels like helper chat / repeats questions.
> This epic makes it reliable, adaptive, and human.

## 3.0 Make it reliable first (observability + contract)

### 3.0.1 Strict response contract (prevents "doesn't work") ✅
- [x] Define ONE JSON response shape for every chat turn:
  - assistantMessage (string)
  - action (ASK_FOLLOWUP | SHOW_RESULTS | SAVE_SUBMISSION | NONE)
  - statePatch (json)      // brief or submission draft updates
  - nextQuestion (optional {slot, text, quickReplies[]})
  - recommendations (optional array)
  - errors (optional)
- [x] Validate this contract server-side (ensureContract)

### 3.0.2 Logging + debugging ✅
- [x] Add structured logs for each request:
  - requestId, conversationId, route, latency, action, error
- [x] Add frontend "API error banner" + retry button (no silent failure)

**Acceptance criteria** ✅
- You can see exactly why a request failed and what the AI returned

---

## 3.1 Start Page = ONE concierge conversation (no extra widget)

### Target UX
- The hero input is the entry point.
- User can paste anything → assistant replies on page → results appear.
- If missing info → assistant asks ONE follow-up question → then shows results.

### Tasks ✅
- [x] Remove/disable separate agency widget chat (bottom-right)
- [x] Start conversation on first submit:
  - POST /api/conversation/start (type='AGENCY') -> conversationId + greeting
  - POST /api/conversation/message -> assistantMessage + action + results
- [x] Store conversationId (state + localStorage)
- [x] When action=ASK_FOLLOWUP:
  - show assistant question and wait for user answer
- [x] When action=SHOW_RESULTS:
  - render top shows + "why" bullets per show (evidence-based)

**Acceptance criteria** ✅
- One flow: input → chat response → results
- Follow-up questions happen in same flow (not separate widget)

---

## 3.2 Join Page = AI-led onboarding conversation (no helper panel)

### Target UX
- The main chat interviews the artist.
- It adapts: if artist has a show → extract & ask missing only.
- If artist has no show → 5-question brainstorm → create "test show" draft.

### Tasks
- [x] Remove "Ask AI for help" panel (no second chat)
- [x] Use the same conversation engine (type='ARTIST') on Join page
- [ ] Add onboarding mode decision early:
  - "Hast du schon eine fertige Show?" -> EXISTING_SHOW | BRAINSTORM_SHOW
- [ ] EXISTING_SHOW mode:
  - ask 1 open question ("Describe in 3–5 sentences…")
  - extract into draft, then ask ONLY missing slots (email, media, price, duration…)
- [ ] BRAINSTORM_SHOW mode (5 questions):
  1) artist type/skill
  2) best-fit events
  3) vibe/style
  4) signature wow moment
  5) duration + requirements
  - generate "TEST SHOW" draft (status=DRAFT_TEST)
  - ask for confirmation/edits
- [ ] When draft complete:
  - call POST /api/submissions (save to show_submissions status=PENDING_REVIEW)
  - show success message

### Anti-repetition (feels like a real person)
- [ ] Track asked slots in state:
  - asked_slots[], attempt_count_by_slot, last_slot
- [ ] Maintain question variants per slot (3+ variants) and rotate
- [ ] Add micro-summaries every 2–3 turns ("So far we have…")

**Acceptance criteria**
- No repeating fixed questionnaire
- "No show" path creates a believable draft show concept
- Submission saved at the end

---

## 3.3 Conversation State (what must be stored) ✅
- [x] Store conversation state (in memory first; DB optional):
  - mode (AGENCY|ARTIST)
  - locale
  - brief OR submissionDraft
  - asked_slots + attempt counts
  - last recommendations ids
  - completion status

### Optional DB persistence
- [ ] Tables:
  - conversations (id, type, locale, created_at)
  - conversation_messages (conversation_id, role, content, created_at)
  - conversation_state (conversation_id, state jsonb, updated_at)

---

## 3.4 Matching + "Why" explanations must be factual ✅
- [x] Recommendations must include evidence mapping:
  - each "why" line references a show field (category/tags/city/price/duration)
- [ ] If a show lacks a fact → do not invent; say "not specified" or ask admin to fill

**Acceptance criteria**
- No hallucinated facts in recommendations or answers

---

# EPIC 4 — Admin Backend + Publish Pipeline (submissions → shows) ✅

### 4.1 Admin auth & authorization ✅
- [x] Admin login (ADMIN_PASSWORD env, Bearer token)
- [x] Backend uses service_role for reads/writes

### 4.2 Admin UI ✅
- [x] /admin (login) and /admin/submissions (list, filter by status)
- [x] /admin/submissions/:id (preview + approve/reject/request changes + notes)

### 4.3 Publish pipeline ✅
- [x] Approve:
  - transform show_submissions → shows
  - shows.status='PUBLISHED', published_at
  - store original_submission_id
- [x] Reject / changes requested:
  - update submission status + review_notes

### 4.4 Notifications (optional)
- [ ] Email artist on received / approved / changes / rejected

**Acceptance criteria** ✅
- Admin can publish without opening Supabase UI
- Published shows appear publicly; pending do not

---

# EPIC 5 — Grounded AI (your domain only) + DB-first retrieval ✅

> This ensures OpenAI answers only your theme and uses your database & KB.

### 5.1 Domain guardrails (scope control) ✅
- [x] System policy in prompts: allowed = artists/shows/events/booking/platform; disallowed = unrelated topics
- [x] Out-of-scope: polite redirect (agency, artist, Q&A)

### 5.2 Knowledge Base (curated truth) ✅
- [x] `kb_articles` table (migration 007): slug, title, locale, content, category
- [x] fetchKBArticles + GET /api/kb; retrieval in answer-question

### 5.3 Retrieval + ranking pipeline (agency) ✅
- [x] SQL filter: category (desiredCategories), budget (price_min), duration
- [x] then scoreShows rank + getMatchEvidence "why" bullets

### 5.4 Optional semantic search (upgrade)
- [ ] Store embeddings for shows (description/tags)
- [ ] Hybrid: SQL filter + vector similarity + business rules

**Acceptance criteria** ✅
- AI answers stay in-domain
- Matching is explainable & grounded in DB fields

---

# EPIC 6 — Foundable in Google + LLMs (SEO + discoverability)

### 6.1 Indexable routing
- [ ] Replace HashRouter with BrowserRouter OR migrate to Next.js (SSR)
- [ ] Clean show URLs (/show/<slug>) crawlable

### 6.2 Metadata + schema
- [ ] Meta tags per show (title/description/OG)
- [ ] JSON-LD on show pages (PerformingGroup/Person + Offer + Location)
- [ ] sitemap.xml + robots.txt

### 6.3 LLM discoverability
- [ ] llms.txt (site purpose + key URLs)
- [ ] Indexable intent pages (Agencies / Private / Corporate / FAQ)

**Acceptance criteria**
- Show pages are crawlable, shareable, structured

---

# EPIC 7 — Quality, security, evaluation (so it keeps working)

- [ ] Sentry (or similar) + backend logs
- [ ] Rate limit all AI endpoints
- [ ] GDPR basics + retention policy
- [ ] Matching evaluation set:
  - 30 sample briefs → expected top 3 shows
- [ ] Conversation QA:
  - tests for repetition
  - tests for out-of-domain refusal
  - tests for "no show" → test show generated
