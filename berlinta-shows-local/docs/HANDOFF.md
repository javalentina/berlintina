# Berlintina Shows — Handoff & Shared Context

This file exists so any Claude Code session working on this repo — the owner's or her husband's (`berlinjohnny`) — starts from the same picture. Keep it updated when something here goes stale; it's meant to be read first, not archived.

## What this is

Family-run business: Valiantsina Förster curates and books Berlin show acts (acrobatics, live music, etc.) for event planners and private clients, and lets artists self-onboard via an AI-guided chat. Profit-oriented — the goal is real bookings, not a portfolio piece.

- Live site: https://berlintina.de
- Owner/operator: Valiantsina (writes German at B1/B2 level — keep copy concrete and direct, not literary)
- Active collaborators: Valiantsina + her husband (GitHub `berlinjohnny`, `write` access on this repo) + their respective Claude Code sessions

## Where things live

- **Code**: this repo. `App.tsx` (all frontend routes/components), `server/index.js` (API + AI conversation engine), `scripts/prerender.mjs` (static prerendering for SEO/GEO, runs at build time — **DB content fixes need a redeploy to reach the live page, a data-only fix is invisible until then**).
- **Marketing plan**: `docs/marketing-plan.md` (copied into this repo 2026-08-25 — previously only existed on the owner's Desktop, not visible to anyone working from a clone). Goal: validate 4–5 growth hypotheses by December 2026. Read it before proposing marketing/growth work so effort doesn't duplicate or contradict what's already planned.
- **Infra**: Railway (hosting, auto-deploys on push to `main`), Supabase (Postgres — shows/submissions), Cloudflare (DNS/CDN in front of the domain). None of these are in this repo; ask the owner for access if a task needs them directly rather than assuming it's already granted.

## Working conventions (learned the hard way — don't relitigate these)

- **No emoji or decorative pictographic icons anywhere user-facing** (AI chat text, UI labels) — explicit standing instruction from the owner, tied to her own writing voice. Plain typographic glyphs used as UI affordances (→ ✓ ✕) are fine and already used throughout; pictographic emoji (🎭🎉📸✨👉 etc.) are not.
- **Don't fabricate stats or social proof.** Placeholder testimonials and invented numbers were explicitly rejected and removed, not replaced with different fake ones. If a real number isn't known, say so.
- **Match the real design tokens** — `background/foreground/accent/muted-foreground` + `font-display`/`label-style` utilities (`index.css`). A legacy parallel token set (`warm-*`, `terracotta`, `charcoal`, `surface`) still lingers in a few older components and reads as off-brand when extended — migrate away from it, don't add to it.
- **Test onboarding/form changes live in a browser, end-to-end**, not just by reading the code — a real live run (paste a real artist's website → chat → submit) surfaced two bugs that code review alone had missed.
- **Data fixes vs. code fixes**: if something's wrong with live show content (bad copy, wrong field), it's usually a Supabase data issue, not a code bug — check the actual DB row before assuming the template/logic is broken. Filing a GitHub issue with a grounded, non-invented suggested fix (as `berlinjohnny` did for #12) works well as a handoff when you've found the problem but don't want to touch production data unreviewed.

## Current state (2026-08-25)

3 real published shows (Jim & John ×2, Monoliza). ~1–2 bookings/month via the owner's personal network so far — marketing hasn't been systematically tested yet, which is exactly what `docs/marketing-plan.md` is for. Two known candidate artists not yet onboarded: "Maria" (30-min sport-break format) and a pianist friend (20-min opening act).

## Note from `berlinjohnny`'s Claude session (2026-08-25)

Read this file and `marketing-plan.md` in full — thank you for writing them, this is exactly what a session working from a fresh clone needs. Two things from this side:

1. **Cross-marketing gap found, not fixed:** `jim-john.de` already links to `berlintina.de` in four places (`src/lib/crosslinks.ts`, `EcosystemBanner.tsx`, `WorkshopsPage.tsx`) — but nothing in this repo links back to `jim-john.de`. There's no `websiteUrl`/`socialLinks` field exposed on the published show record itself (checked via the read-only show API) — only on the onboarding draft. This is exactly the "Кто что делает → Вместе" territory from the marketing plan (a content/product decision, not a pure technical fix), so flagging it here rather than editing live show copy unreviewed — same convention this file already names for issue #12. Worth deciding together: does the Jim & John show page get a link/mention pointing back, and where?
2. **Working convention on this repo going forward:** this session will use branch + PR (like this one) rather than pushing straight to `main`, so nothing lands without you seeing it first — no change to how you work, just how this session works when it touches this repo.

No code/data changes in this PR — documentation only.

## Update from `berlinjohnny`'s Claude session (2026-08-25, evening)

Two PRs were merged and are live. **Both landed without your review** — John authorised the
merges directly, as co-owner with write access. That's a deliberate exception, not a change
to the convention above: branch + PR still stands, and the next thing this session touches
will wait for you unless John says otherwise again. Writing it down here so two merges you
didn't see don't come as a surprise.

### #15 — the catalog endpoint was leaking artist emails

`GET /api/shows/page` used `select('*')`, so **every column of the row went out to anyone**,
including `artist_email`. Measured against the live site before the fix. The allowlist
`OEFFENTLICHE_SHOW_SPALTEN` that the other three public show endpoints use had never been
applied to this one.

Today the field holds a company address, so the actual damage was small. The reason it
mattered: **the next artist who onboards themselves puts their own email in that column**,
and it would have been public from the moment their show was published.

Fixed and verified live — the field is gone from the response, search and all routes still
work. Worth knowing for the future: the RLS policy on `shows` is row-based
(`using (status = 'PUBLISHED')`), not column-based, so the protection currently rests on the
Express layer plus the fact that no Supabase anon key is shipped in the frontend bundle
(checked — the built bundle contains only the placeholder from `.env.production`). A
column-scoped `grant select` for `anon` would make that independent of both. Needs Supabase
access, so it's yours to decide.

### #16 — mechanism for the cross-marketing link (issue #14)

Issue #14 asks whether the Jim & John show page should link back to `jim-john.de`. **This
does not answer that** — it makes the answer a CMS entry instead of a code change.

New column `shows.partner_link_url` (migration `016`, already applied to the database).
In the CMS it appears under **Basic Info → "Public partner link (optional)"**, next to the
sales pitch. On the public page it renders under "Über die Künstler" as a plain text link.

**It ships empty, so nothing on the site changed.** When you do set a value, remember the
prerender: the page only shows it after a redeploy, like any other show data.

Two decisions in there that are yours to overrule:

1. **It is not auto-filled from onboarding.** `artist_accounts` already holds `website_url`
   and `instagram_handle`, and joining them would have been less work. Deliberately not
   done: what someone gives as a contact route during signup is not permission to publish it
   on their show page. This way you decide per show.
2. **There is no second field for custom link text.** The label is the domain, derived from
   the URL. A free text field invites invented marketing copy and would drift from the URL
   over time. If you'd rather write your own label there, say so — then it's a deliberate
   addition rather than an open door.

The server only accepts `http(s)` URLs; anything else (including a pasted `javascript:`
target) is discarded rather than written into an `href`. Typing a bare domain like
`jim-john.de` works — it gets `https://` prepended instead of being silently dropped.
