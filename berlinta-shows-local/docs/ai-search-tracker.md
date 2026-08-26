# AI Search Visibility Tracker

Manual monthly check — no free automated tool covers ChatGPT/Perplexity/Google AI Overview together, so this is done by hand. Takes ~15 minutes: open each query in each tool, note the result.

**Interactive tool (use this, not the table below by hand):** https://claude.ai/code/artifact/911be9fc-46e2-4517-96b7-e419cd19e369 — "Sichtbarkeits-Radar". Same queries, but tracks history per query/engine, shows a citation-rate stat, and saves itself (no spreadsheet editing). The table below stays as a static record/fallback.

**How:** once a month (or more often while testing growth hypotheses through December 2026), ask each query below in ChatGPT, Perplexity, and Google (watch for an AI Overview box above the normal results). Record whether Berlintina is mentioned, and who is mentioned instead if not.

## Queries to test

- "Show Act für Firmenevent Berlin"
- "Akrobatik Show buchen Berlin"
- "Künstler für Hochzeit Berlin empfehlen"
- "beste Eventagentur für Showacts Berlin"
- "Live-Band für Firmenfeier Berlin"

Add more here as they come up (e.g. once specific new artists/acts are in the catalog).

## Log

| Date | Query | Google AI Overview | ChatGPT | Perplexity | Berlintina cited? | Cited instead | Notes |
|------|-------|:---:|:---:|:---:|:---:|---|---|
| | | | | | | | |

## Google Search Console (real search rankings, not AI)

Set up 2026-08-26 as a **Domain property** (`sc-domain:berlintina.de`, covers http/https/www automatically), verified via DNS TXT record added through Cloudflare (Google's one-time DNS-provider authorization — not a standing connection). `sitemap.xml` submitted the same day, 10 pages discovered.

Check under **Performance** (search.google.com/search-console, property `berlintina.de`) for: which queries the site actually shows up for, position, clicks/impressions. This is the ground truth for regular Google search — check it before assuming AI-chat visibility (above) says anything about regular search, they're separate.
