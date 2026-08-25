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
