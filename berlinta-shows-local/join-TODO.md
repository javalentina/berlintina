# /join TODO (English) — Clear Logic, Stable State Machine, Better AI, Returning Artist

Date: 2026-02-09

This TODO is written for the current architecture you described (React + Express + Supabase + OpenAI/Gemini/mock).
Some earlier code files in this chat session have expired, so this plan is **implementation-ready but not line-by-line**.
If you re-upload the latest `server/index.js` + join UI files, I can adapt the TODO to exact functions and filenames.

---

## Goal (Definition of Done)

1. **New person**: `/join` asks only **two choices**:
   - ✅ “Yes, I have a show”
   - 💡 “No, brainstorm a show”
   and always follows the correct branch.
2. **Returning artist (token detected)**: `/join` asks:
   - ➕ “Add a new show”
   - (optional v2) ✏️ “Update an existing show”
   - ⚙️ “Update Instagram/website”
3. The flow is **deterministic** (state machine), never falls back to `slot="next"`.
4. The dialog feels **ChatGPT-like**:
   - short acknowledgement + one clear question
   - good examples
   - repair prompts when user answers the “wrong slot”
5. Submissions are saved reliably to Supabase, and can be reviewed/approved in Admin.
6. OpenAI/Gemini can be enabled **without breaking slot tracking**.

---

## Phase 0 — Quick Diagnosis (30 minutes)

- [ ] Verify which AI provider you are currently using (OpenAI/Gemini/mock).
  - Use `GET /api/health` and check `{ ai: "openai" | "gemini" | "mock" }`.
- [ ] Add server logs on every `/api/conversation/message`:
  - state_in, lastSlot_in, intent, mode, nextSlot_out, readyToSave
- [ ] Confirm the exact bug path:
  - Click “Yes, I have a show” → ensure backend stores `intent=HAS_SHOW` and goes to `SHOW_TITLE` (not profile).

**Acceptance**
- You can see in logs why “Yes” ends up in the wrong branch.

---

## Phase 1 — Make /join Deterministic (P0)

### 1.1 Remove “Profile only” from the first step (or make it non-blocking)
You sell **shows**, not artists, so “profile-only” causes confusion and can block saving.

- [ ] Option A (recommended MVP): remove “Profile only” button from the first question.
- [ ] Option B: keep it, but it must still finish and save something (artist account only), without requiring `showTitle`.

**Acceptance**
- The first step shows only: “Yes show” / “No brainstorm” (or profile-only can finish independently).

---

### 1.2 Replace text-guessing with explicit button actions
Do not infer intent from raw text for quick replies. Buttons should send structured values.

- [ ] Frontend: quick reply click sends:
  - `action="BUTTON"` and `value="HAS_SHOW" | "NO_SHOW"`
- [ ] Backend: when `action==="BUTTON"`, set `intent` directly and ignore text heuristics.

**Acceptance**
- Clicking a button always sets the exact intent and branch.

---

### 1.3 Enforce a stable state machine on the backend
Backend is the “source of truth” for next slot.

- [ ] Define canonical slot lists:
  - `HAS_SHOW_SLOTS = [showTitle, shortDescriptionFacts, artistGenre, priceText, durationMinutes, artistBio, mediaLinks?, socialLinks?, submitterEmail]`
  - `BRAINSTORM_SLOTS = [brain_medium, brain_theme, brain_impact, brain_constraints, brain_unique, concept_pick, ...]`
- [ ] Implement `getNextSlot(state)`:
  - returns the next required slot that is still missing
  - returns `null` only when all required slots are filled
- [ ] NEVER allow fallback `slot: "next"`.

**Acceptance**
- Every assistant response contains a real, known slot.
- Slot tracking never breaks.

---

### 1.4 Improve “readyToSave”
Current “email + title” is too weak.

- [ ] Update save criteria by mode:
  - **HAS_SHOW** requires: title, description facts, genre, price, duration, email (and optionally media/social)
  - **BRAINSTORM** requires: chosen concept + at least title/logline + email
- [ ] If fields are missing, ask the next slot.

**Acceptance**
- Submissions are not saved too early with missing critical info.

---

## Phase 2 — Make OpenAI/Gemini Helpful Without Breaking Flow (P0/P1)

### 2.1 Unify provider response contract
All providers must return the same shape:

```json
{
  "assistantMessage": "string",
  "suggestedFieldUpdates": {},
  "nextQuestion": { "slot": "string", "text": "string", "quickReplies": ["..."] }
}
```

- [ ] Update OpenAI prompt to **require**:
  - `assistantMessage` (human text)
  - `suggestedFieldUpdates`
  - `nextQuestion` (optional, but if missing the server will compute next slot + server will create question)
- [ ] Update Gemini prompt similarly.
- [ ] Update mock to match the same contract.

**Acceptance**
- Switching providers does not change flow behavior.

---

### 2.2 Server computes next slot; model only helps with language + extraction
- [ ] Backend flow:
  1) Apply robust extraction from userMessage (email, URLs, IG handle).
  2) Ask provider to extract/clean values for the **current slot** only.
  3) Apply `suggestedFieldUpdates` (validated).
  4) Compute `nextSlot = getNextSlot(state)`.
  5) Ask provider to write a **short, friendly** question for `nextSlot` (or use templates).

**Acceptance**
- AI never decides the branch/sequence. Only helps with wording + parsing.

---

### 2.3 “ChatGPT-like” templates + variation (optional but recommended)
- [ ] Create a question template bank per slot (DE/EN).
- [ ] Add “micro-acknowledgement”:
  - “Got it.” / “Nice!” / “Perfect.”
- [ ] Repair prompts:
  - If user answers medium instead of theme → ask “Did you mean medium?”

**Acceptance**
- Dialog feels conversational, not like a form prompt.

---

## Phase 3 — Returning Artist Without Login (Token Flow) (P1)

### 3.1 Supabase migrations
- [ ] Create `artist_accounts`
- [ ] Create `artist_tokens` (store only **hashed tokens**)
- [ ] Add `artist_account_id` to:
  - `show_submissions`
  - `shows`

**Acceptance**
- A single artist account can own multiple submissions/shows.

---

### 3.2 Backend endpoints
- [ ] `POST /api/artist/resolve`:
  - input: `artistToken`
  - output: `{ isReturning, artistAccountSummary }`
- [ ] Extend submission completion:
  - upsert/resolve `artist_account_id` by IG/website/email
  - create token (hashed) and return clear token once
  - save `artist_account_id` on the submission

**Acceptance**
- Returning artist is detected on the next visit using localStorage token.

---

### 3.3 Frontend welcome screen for returning artists
- [ ] On `/join` mount:
  - read token from localStorage
  - call `/api/artist/resolve`
- [ ] If returning:
  - show buttons:
    - ➕ Add new show
    - ⚙️ Update IG/website
    - Start fresh (ignore token)
- [ ] Default action: Add new show → skip intent step

**Acceptance**
- Returning artist does not see “Do you already have a show?” again.

---

## Phase 4 — Media (Photos/Videos/Links) Improvements (P1)

### 4.1 Make media collection a dedicated step
- [ ] Only show upload/links UI in `SHOW_MEDIA` (or `DRAFT_MEDIA`).
- [ ] Support:
  - image upload (Supabase storage) **or**
  - photo links
  - video links (YouTube/Vimeo/Drive)

**Acceptance**
- Media UI does not distract earlier steps.
- Submission stores media in consistent fields.

---

## Phase 5 (Optional) — Website/Instagram “Auto-Collect Text” (Nice-to-have)

You asked: “If a person gives a website or Instagram, can we open it and collect text from the first page?”

### 5.1 Website scraping (generally feasible)
✅ For normal websites, yes — in the backend you can fetch the HTML and extract readable text.

- [ ] Backend: `fetchWebsitePreview(url)`:
  - fetch with timeout (e.g. 5s)
  - parse HTML (e.g. `jsdom` + `@mozilla/readability`)
  - extract title + main text, limit length (e.g. 3–8k chars)
  - store as `artistWebsitePreviewText` (submissionDraft / artist_account)
- [ ] Add rate limit + caching (avoid repeated fetches).
- [ ] Handle failures gracefully:
  - return `null`, continue flow without blocking.

**Acceptance**
- Website text enrichment is optional and never breaks /join.

### 5.2 Instagram scraping (often NOT feasible/reliable)
⚠️ Instagram pages frequently block automated scraping and require official APIs / permissions.
For MVP, best practice is:

- [ ] Store the IG handle/link as-is.
- [ ] (Optional) Ask the artist to paste a short bio/press text:
  - “If you want, paste 2–3 lines about your work.”

**Acceptance**
- No dependency on Instagram scraping (avoids fragile/blocked implementation).

> If you still want IG data later, consider the official Instagram Graph API / Basic Display (requires setup and permissions).

---

## QA / Testing Checklist

- [ ] New person:
  - “Yes, I have a show” → goes through HAS_SHOW slots in order
  - “No, brainstorm” → 5 questions → generates 2–3 concepts → pick one → draft show
- [ ] Returning artist:
  - token present → welcome back → add new show works
  - “Start fresh” ignores token
- [ ] Robust parsing:
  - “my email is name@site.com” → email extracted
  - “insta @name” → IG extracted
  - random text / “I don’t have that” → skip or clarify, no crash
- [ ] Provider switching:
  - OpenAI vs Gemini vs mock does not break slot flow
- [ ] Admin:
  - submission appears as PENDING_REVIEW
  - approve publishes to `shows`

---

## Deliverables (Files/Changes You Expect)

- Backend:
  - deterministic `getNextSlot()` + strict slot list
  - unified provider contract
  - remove/replace `slot:"next"` fallback
  - new endpoints for returning artist
  - DB migrations for artist accounts/tokens
  - improved extraction utilities (email/url/ig)
- Frontend:
  - quick replies send structured actions
  - returning artist welcome screen
  - media step UI is only shown at the correct step
- Docs:
  - update README/DOCUMENTATION to include conversation endpoints + returning artist flow
