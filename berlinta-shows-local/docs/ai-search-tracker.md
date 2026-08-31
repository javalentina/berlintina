# AI Search Visibility Tracker

**Tool:** https://too-good-to-know-neon.vercel.app — "too good to know", a small
Next.js + Neon app (password-protected; ask JaVa for the password). It tracks any
number of sites, not just berlintina.de, and replaces the earlier
Sichtbarkeits-Radar artifact.

Per query it logs, per engine, whether the site was cited — and who was cited
instead. Two of the engines check themselves automatically:

| Engine | How | Notes |
|---|---|---|
| Google (normal search) | Google Programmable Search JSON API | **Not configured yet** — needs `GOOGLE_CSE_KEY` + `GOOGLE_CSE_CX` |
| Claude (web search) | Anthropic API, `web_search` tool forced via `tool_choice` | Works. ~7s per check |
| ChatGPT | manual | no public API for "was I cited" |
| Perplexity | manual | same |
| Google AI Overview | manual | same |

Repo path is not relevant — the tracker lives in its own project at
`~/Documents/Claude/Projects/too-good-to-know`.

## Findings, 2026-08-31 — first real automated run

14 category queries checked against **berlintina.de** via Claude web search
("Akrobatik Show buchen Berlin", "Künstler für Hochzeit Berlin empfehlen",
"beste Eventagentur für Showacts Berlin", "Live-Band für Firmenfeier Berlin",
"Eventagentur Berlin Künstler buchen", "Künstlervermittlung Berlin",
"Show Act für Gala buchen", and 7 more in the same shape).

**Result: 0 of 14 cited.** A control check on the plain brand name
("Berlintina Shows Berlin") also returned nothing — the search surfaced only
generic Berlin tourism pages (visitberlin, GetYourGuide, TripAdvisor, Wikipedia).
So the site is currently not surfaced by AI web search *at all*, not even by name.

### The comparison that explains why

The same run against **jim-john.de** (14 queries) found it cited on 2:
"Jim und John Akrobaten" and "Akrobatik Duo aus dem Supertalent buchen" — both
brand-ish. All 12 generic category queries: not cited.

The difference is visible in the sources the search actually returned for
jim-john.de: `agentur-new-style.de`, `kuenstler-manager.de`, `stagend.com`,
`berlinjohn.de`, Facebook, YouTube. **Third-party pages.** berlintina.de has no
equivalent footprint anywhere, which is why even its own name finds nothing.

### What this implies for priorities

Technically the site is fine — robots.txt open, sitemap live and complete,
pages served with correct titles. The bottleneck is not on-page SEO or copy.
It is the absence of external mentions:

1. **Artist/event directory listings** — the same class of site where Jim & John
   appears (stagend, künstler-manager, agency portals). This is where AI search
   sources its answers from.
2. **Google Business Profile** — matters for local "Berlin" intent and is read by
   AI assistants too.
3. On-page copy/SEO — only worth optimising once 1 and 2 exist.

Directory sign-ups need JaVa's own data and email confirmation, so they cannot be
automated; the list of portals and the copy to paste is the part to prepare.

## Re-running

Open the tracker, pick the site, and hit "Claude automatisch prüfen" per query.
The 14 queries per site are already saved there, so a re-run is just clicking
through them. Worth repeating monthly, and after any directory listing goes live —
that is the change we expect to actually move the number.

## Google Search Console (real search rankings, not AI)

Set up 2026-08-26 as a **Domain property** (`sc-domain:berlintina.de`, covers
http/https/www automatically), verified via DNS TXT record added through
Cloudflare. `sitemap.xml` submitted the same day, 10 pages discovered.

Check under **Performance** (search.google.com/search-console, property
`berlintina.de`) for which queries the site actually shows up for, position, and
clicks/impressions. This is the ground truth for regular Google search — and the
place to look *before* drawing conclusions from the AI numbers above, since the
two are separate systems.
