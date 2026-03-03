# Berlintina Shows — Use Case Documentation

## Actors

| Actor | Description |
|-------|-------------|
| **Event planner / Customer** | Someone looking for a show for an event (gala, wedding, corporate, etc.). Uses Landing and Catalog. |
| **Artist** | Performer or group who wants to list a show. Uses Join (Welcome to Community). |
| **Admin** | Platform operator (e.g. Valiantsina). Reviews submissions and publishes or rejects. |

---

## Public / Customer Use Cases

### UC-01 — Find shows via AI concierge (Landing)

| Field | Description |
|-------|-------------|
| **Actor** | Event planner |
| **Goal** | Get show recommendations for an event by describing it in natural language. |
| **Preconditions** | User is on `/` (Landing). Backend and (optionally) Supabase are available. |
| **Main flow** | 1. User enters a short event description (e.g. “elegant live music, gala, Berlin”) and submits. 2. If no conversation yet: system calls `POST /api/conversation/start` (type=AGENCY) and shows greeting. 3. System sends user message with `POST /api/conversation/message`. 4. Backend extracts a brief (event type, categories, vibes, budget, duration, etc.), optionally asks one follow-up. 5. If action=SHOW_RESULTS: system displays top shows with “why” bullets. 6. User can open quick-view sidebar or go to show detail. |
| **Alternative flows** | 4a. Action=ASK_FOLLOWUP: system shows one follow-up question; user answers and flow continues until SHOW_RESULTS. 4b. API error: system shows error banner and “Retry”. |
| **Postconditions** | Conversation ID stored (e.g. localStorage). User sees ranked recommendations with evidence. |

---

### UC-02 — Browse catalog

| Field | Description |
|-------|-------------|
| **Actor** | Event planner (or any visitor) |
| **Goal** | Browse all published shows with filters and search. |
| **Preconditions** | User is on `/catalog`. |
| **Main flow** | 1. System loads first page of shows (e.g. 12) via `fetchShowsPage` (category/search optional). 2. User can filter by category (ALL, CLASSICAL, BAND, ACROBATICS, DANCE). 3. User can type in search (artist or show name). 4. Results update (filter/search/page). 5. User can click “Load more” for next page. 6. User can open quick-view sidebar or “Zur Show” to go to show detail. |
| **Alternative flows** | 2a. No results: system shows “Keine Shows gefunden” and suggests changing filters. 2b. API error: system shows error banner. |
| **Postconditions** | None (read-only). |

---

### UC-03 — View show detail

| Field | Description |
|-------|-------------|
| **Actor** | Event planner (or any visitor) |
| **Goal** | See full show information (title, pitch, description, media, pricing). |
| **Preconditions** | User has navigated to `/show/:slugShortId` (from Landing, Catalog, or Results). |
| **Main flow** | 1. System resolves show by `shortId` (from context or `fetchShowByShortId`). 2. Page shows hero image, title, sales pitch, description, extra photos/videos, pricing. 3. User can click “Jetzt anfragen” or use the Q&A widget. |
| **Alternative flows** | 1a. Show not found: system shows “Show nicht gefunden” and back button. 1b. Load/API error: system shows error and back button. |
| **Postconditions** | None (read-only). |

---

### UC-04 — Request contact / “Jetzt anfragen”

| Field | Description |
|-------|-------------|
| **Actor** | Event planner |
| **Goal** | Express interest in a show (contact/booking). |
| **Preconditions** | User is on show detail page. |
| **Main flow** | 1. User clicks “Jetzt anfragen”. 2. System switches to contact form (contactMode=form). 3. User fills form and submits. 4. System shows success (contactMode=success). (Exact form fields and backend endpoint are implementation details.) |
| **Alternative flows** | User closes form without submitting. |
| **Postconditions** | Contact request recorded or success message shown. |

---

### UC-05 — Ask a question about a show (Q&A widget)

| Field | Description |
|-------|-------------|
| **Actor** | Event planner |
| **Goal** | Get an answer about the show (e.g. “Can they play outdoors?”) based on show facts. |
| **Preconditions** | User is on show detail page. |
| **Main flow** | 1. User types a question in the “Frage zur Show” input. 2. User submits (button or Enter). 3. Frontend calls `answerShowQuestion` (backend `POST /api/ai/answer-question`) with question, show facts, and locale. 4. System displays the answer under the input. |
| **Alternative flows** | 3a. API error: system shows “Konnte nicht beantwortet werden” (or equivalent). 3b. Out-of-scope question: backend returns polite redirect (EPIC 5 domain guardrails). |
| **Postconditions** | Answer shown; no persistent state. |

---

### UC-06 — View results for a stored brief

| Field | Description |
|-------|-------------|
| **Actor** | Event planner |
| **Goal** | See recommendations for a previously stored brief (e.g. from legacy flow or shared link). |
| **Preconditions** | User navigates to `/results/:briefId` and brief is stored in sessionStorage under `brief_${briefId}`. |
| **Main flow** | 1. System reads brief from sessionStorage. 2. Shows are scored with `scoreShows(shows, brief)`. 3. Top results are shown in masonry grid. 4. User can open quick-view or go to show detail. |
| **Alternative flows** | 1a. No brief for briefId: system shows “Loading recommendations…” (or empty state). |
| **Postconditions** | None (read-only). |

---

### UC-07 — Artist onboarding (Join — conversational)

| Field | Description |
|-------|-------------|
| **Actor** | Artist |
| **Goal** | Submit a show for review via an AI-led conversation. |
| **Preconditions** | User is on `/join`. Optional: returning artist token in storage. |
| **Main flow** | 1. If returning artist (UC-08): resolve token and optionally “use saved” or “start fresh”. 2. System calls `POST /api/conversation/start` (type=ARTIST, locale). 3. Backend asks: “Hast du schon eine fertige Show?” with quick replies (e.g. “Ja, habe eine Show” / “Nein, brainstormen”). 4. User answers; backend sets mode (EXISTING_SHOW or BRAINSTORM) and continues conversation (title, genre, description, duration, price, media, email, etc.). 5. When backend returns action=SAVE_SUBMISSION, frontend builds payload from submissionDraft and calls `POST /api/submissions`. 6. On success: system shows thank-you screen and submission ID. |
| **Alternative flows** | 4a. Honeypot filled: submission not sent (spam). 4b. API error: error message shown; user can retry. 4c. Submit error: “Submission failed” (or similar) shown. |
| **Postconditions** | Row in `show_submissions` with status PENDING_REVIEW; optional artist token stored. |

---

### UC-08 — Returning artist: use saved data or start fresh

| Field | Description |
|-------|-------------|
| **Actor** | Artist |
| **Goal** | Reuse saved artist data for a new submission or start a new application. |
| **Preconditions** | Artist has a stored artist token (from a previous submission). User is on `/join`. |
| **Main flow** | 1. System calls `resolveArtistToken` (e.g. `POST /api/artist/resolve`). 2. If returning: system shows “Willkommen zurück!” and “Soll ich deine gespeicherten Artist-Daten verwenden?” with (e.g.) “Ja, verwenden” / “Nein, neu starten”. 3a. “Ja, verwenden”: conversation starts with returningArtist=true; backend pre-fills where possible (e.g. socials). 3b. “Nein, neu starten”: token cleared; conversation starts with returningArtist=false. |
| **Alternative flows** | 1a. No token or not returning: no welcome-back screen; normal start. |
| **Postconditions** | Either conversation started with prior data, or token cleared and fresh start. |

---

### UC-09 — Switch language (DE/EN)

| Field | Description |
|-------|-------------|
| **Actor** | Any visitor |
| **Goal** | Use the site in German or English. |
| **Preconditions** | User is on any public page (with Layout). |
| **Main flow** | 1. User toggles language (LanguageToggle). 2. Locale state updates (de \| en). 3. All UI labels, placeholders, and conversation locale use the chosen language. |
| **Postconditions** | UI and API (locale) use selected language until changed again. |

---

### UC-10 — View About page

| Field | Description |
|-------|-------------|
| **Actor** | Any visitor |
| **Goal** | Read about Valiantsina, the project, “Why for free?”, and get links to catalog/join. |
| **Preconditions** | User is on `/about`. |
| **Main flow** | 1. User reads About content (and optional blog filter). 2. User can click “Shows entdecken” → Catalog or “Künstler werden” → Join. |
| **Postconditions** | None (informational). |

---

## Admin Use Cases

### UC-11 — Admin login

| Field | Description |
|-------|-------------|
| **Actor** | Admin |
| **Goal** | Authenticate to access admin area. |
| **Preconditions** | User opens `/#/admin`. ADMIN_PASSWORD configured on server. |
| **Main flow** | 1. User enters password and submits. 2. Frontend calls `adminLogin(password)` → `POST /api/admin/login`. 3. Backend validates password and returns token. 4. Frontend stores token; admin sees Submissions list. |
| **Alternative flows** | 2a. Wrong password: “Login failed” (or similar). |
| **Postconditions** | Admin is logged in; token used for subsequent admin API calls. |

---

### UC-12 — Admin list submissions

| Field | Description |
|-------|-------------|
| **Actor** | Admin |
| **Goal** | See all (or filtered) artist submissions. |
| **Preconditions** | Admin is logged in. User is on `/#/admin` or `/#/admin/submissions`. |
| **Main flow** | 1. System calls `adminGetSubmissions(filter)` → GET `/api/admin/submissions` with optional status filter. 2. List shows: show_title, submitter_email, status, artist_genre; each row has “View”. 3. Admin can filter by: All, PENDING_REVIEW, APPROVED, REJECTED, CHANGES_REQUESTED. 4. Admin clicks “View” → submission detail (UC-13). |
| **Alternative flows** | 1a. API/ auth error: error message shown. 2a. No submissions: “No submissions.” |
| **Postconditions** | None (read-only). |

---

### UC-13 — Admin view submission detail

| Field | Description |
|-------|-------------|
| **Actor** | Admin |
| **Goal** | See full submission and (if PENDING_REVIEW) edit before approving or reject/request changes. |
| **Preconditions** | Admin is logged in. User is on `/#/admin/submissions/:id`. |
| **Main flow** | 1. System calls `adminGetSubmission(id)` → GET `/api/admin/submissions/:id`. 2. If status is PENDING_REVIEW: form is shown with editable fields (title, artist name, genre, description, pitch, duration, price, photo URLs, video URLs, optional file upload). 3. Admin can Approve (UC-14), Reject (UC-15), or Request changes (UC-16). 4. If status is not PENDING_REVIEW: read-only view of submission data (and review_notes if present). |
| **Alternative flows** | 1a. Not found or API error: error message. |
| **Postconditions** | None until an action is taken. |

---

### UC-14 — Admin approve and publish submission

| Field | Description |
|-------|-------------|
| **Actor** | Admin |
| **Goal** | Turn a submission into a published show and notify the artist by email. |
| **Preconditions** | Admin is on submission detail; submission status is PENDING_REVIEW. |
| **Main flow** | 1. Admin optionally edits fields (and/or adds photo file). 2. Admin clicks “Approve & Publish”. 3. Frontend calls `adminApprove(id, overrides)` → POST `/api/admin/submissions/:id/approve`. 4. Backend creates row in `shows` (status=PUBLISHED, artist_email from submitter). 5. Show is visible on catalog immediately. Optionally the backend sends notification email to the artist and sets `artist_notified_at` if configured. 6. Admin is redirected to submissions list; submission status is APPROVED. |
| **Alternative flows** | 3a. Server error: “Action failed” (or similar). |
| **Postconditions** | Show exists and is visible on catalog; submission status APPROVED. |

---

### UC-15 — Admin reject submission

| Field | Description |
|-------|-------------|
| **Actor** | Admin |
| **Goal** | Reject a submission and optionally add notes. |
| **Preconditions** | Admin is on submission detail; submission is PENDING_REVIEW. |
| **Main flow** | 1. Admin optionally enters review notes. 2. Admin clicks “Reject”. 3. Frontend calls `adminReject(id, reviewNotes)` → POST `/api/admin/submissions/:id/reject`. 4. Backend sets submission status to REJECTED and stores review_notes. 5. Admin is redirected to submissions list. |
| **Postconditions** | Submission status REJECTED; no show created/updated. |

---

### UC-16 — Admin request changes

| Field | Description |
|-------|-------------|
| **Actor** | Admin |
| **Goal** | Ask the artist to revise the submission. |
| **Preconditions** | Admin is on submission detail; submission is PENDING_REVIEW. |
| **Main flow** | 1. Admin enters review notes (what to change). 2. Admin clicks “Request Changes”. 3. Frontend calls `adminRequestChanges(id, reviewNotes)` → POST `/api/admin/submissions/:id/changes`. 4. Backend sets submission status to CHANGES_REQUESTED and stores review_notes. 5. Admin is redirected to submissions list. |
| **Postconditions** | Submission status CHANGES_REQUESTED; artist can resubmit (future flow). |

---

### UC-17 — Admin logout

| Field | Description |
|-------|-------------|
| **Actor** | Admin |
| **Goal** | End admin session. |
| **Preconditions** | Admin is logged in. |
| **Main flow** | 1. Admin clicks “Logout” on submissions list. 2. Frontend calls `adminLogout()` (clears token) and redirects to `/#/admin`. 3. Login screen is shown. |
| **Postconditions** | Admin token cleared; admin area requires login again. |

---

### UC-18 — Admin list published shows

| Field | Description |
|-------|-------------|
| **Actor** | Admin |
| **Goal** | See all published shows and whether each is visible (artist notified) or hidden. |
| **Preconditions** | Admin is logged in. |
| **Main flow** | 1. Admin opens `/#/admin/shows`. 2. System calls GET `/api/admin/shows` and displays list: title, artist name, artist email, and “Visible” or “Hidden (email not sent)”. 3. Admin can click “Edit” to go to show edit (UC-19). |
| **Postconditions** | None (read-only). |

---

### UC-19 — Admin edit show (text and pictures) and send email to artist

| Field | Description |
|-------|-------------|
| **Actor** | Admin |
| **Goal** | Change text and one or more pictures of an already accepted/published show, and notify the artist by email; if email cannot be sent, the show is not shown. |
| **Preconditions** | Admin is logged in; show is published (status=PUBLISHED). |
| **Main flow** | 1. Admin opens show edit (e.g. from Shows list). 2. Admin edits title, artist name, description, sales pitch, duration, price, photo URLs (one or more), video URLs, and/or uploads a new photo. 3. Optionally leaves “Send email to artist when saving” checked and clicks “Save and notify artist”. 4. Frontend calls PATCH `/api/admin/shows/:id` with updated fields and optional `notify_artist: true`. 5. Backend updates the show. If notify_artist was true, it attempts to send notification email to the artist and sets or clears `artist_notified_at` for tracking. 6. Admin sees success or email warning. Show remains visible on catalog regardless of email. |
| **Alternative flows** | 3a. Admin unchecks “Send email to artist”: changes are saved; visibility unchanged. 3b. Server error: update fails; error message shown. |
| **Postconditions** | Show content updated; show stays visible on catalog. |

---

## Summary Table

| ID | Use case | Actor | Route / area |
|----|----------|-------|--------------|
| UC-01 | Find shows via AI concierge | Event planner | `/` (Landing) |
| UC-02 | Browse catalog | Visitor | `/catalog` |
| UC-03 | View show detail | Visitor | `/show/:slugShortId` |
| UC-04 | Request contact (“Jetzt anfragen”) | Event planner | Show detail |
| UC-05 | Ask question about show | Event planner | Show detail (Q&A) |
| UC-06 | View results for stored brief | Event planner | `/results/:briefId` |
| UC-07 | Artist onboarding (Join) | Artist | `/join` |
| UC-08 | Returning artist | Artist | `/join` |
| UC-09 | Switch language | Any | All (Layout) |
| UC-10 | View About | Any | `/about` |
| UC-11 | Admin login | Admin | `/#/admin` |
| UC-12 | Admin list submissions | Admin | `/#/admin/submissions` |
| UC-13 | Admin view submission | Admin | `/#/admin/submissions/:id` |
| UC-14 | Admin approve & publish | Admin | Submission detail |
| UC-15 | Admin reject | Admin | Submission detail |
| UC-16 | Admin request changes | Admin | Submission detail |
| UC-17 | Admin logout | Admin | Admin area |
| UC-18 | Admin list published shows | Admin | `/#/admin/shows` |
| UC-19 | Admin edit show (text + pictures, notify artist; if email fails, show hidden) | Admin | `/#/admin/shows/:id` |
