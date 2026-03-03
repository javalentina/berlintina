import { Show, CustomerBrief } from "../types";

export function scoreShows(shows: Show[], brief: CustomerBrief): Show[] {
  return shows
    .map(show => {
      let score = 0;

      if (brief.desiredCategories?.includes(show.category)) {
        score += 50;
      }

      const vibeOverlap = brief.desiredVibes?.filter(v => (show.vibeTags ?? []).includes(v)) || [];
      score += vibeOverlap.length * 15;

      if (brief.languagePreference && (show.languageOptions ?? []).some(l =>
        l.toLowerCase() === brief.languagePreference?.toLowerCase() || brief.languagePreference === 'both'
      )) {
        score += 10;
      }

      if (brief.budgetMax && show.priceMin && show.priceMin <= brief.budgetMax) {
        score += 20;
      }

      return { show, score };
    })
    .sort((a, b) => b.score - a.score)
    .map(item => item.show);
}

const NOT_SPECIFIED = { de: 'nicht angegeben', en: 'not specified' };

/** Factual evidence bullets: each line references a show field. No invented facts. */
export function getMatchEvidence(show: Show, brief: CustomerBrief, locale: 'de' | 'en'): string[] {
  const why: string[] = [];
  const ns = locale === 'de' ? NOT_SPECIFIED.de : NOT_SPECIFIED.en;

  if (brief.desiredCategories?.includes(show.category)) {
    why.push(locale === 'de' ? `Kategorie: ${show.category}` : `Category: ${show.category}`);
  }
  const vibes = brief.desiredVibes?.filter((v) => (show.vibeTags ?? []).includes(v));
  if (vibes?.length) {
    why.push(locale === 'de' ? `Vibe: ${vibes.join(', ')}` : `Vibe: ${vibes.join(', ')}`);
  }
  if (brief.languagePreference) {
    const langs = show.languageOptions ?? [];
    if (langs.some((l) => l?.toLowerCase() === brief.languagePreference?.toLowerCase())) {
      why.push(locale === 'de' ? `Sprache: ${langs.join(', ')}` : `Language: ${langs.join(', ')}`);
    }
  }
  if (brief.budgetMax) {
    if (show.priceMin != null && show.priceMin <= brief.budgetMax) {
      why.push(locale === 'de' ? `Preis: ab ${show.priceMin}€` : `Price: from ${show.priceMin}€`);
    } else if (show.priceMin == null && show.priceMax == null) {
      why.push(locale === 'de' ? `Preis: ${ns}` : `Price: ${ns}`);
    }
  }
  if (brief.durationMinutes != null) {
    if (show.durationMinutes != null && show.durationMinutes >= brief.durationMinutes) {
      why.push(locale === 'de' ? `Dauer: ${show.durationMinutes} Min` : `Duration: ${show.durationMinutes} min`);
    } else if (show.durationMinutes == null) {
      why.push(locale === 'de' ? `Dauer: ${ns}` : `Duration: ${ns}`);
    }
  }
  if (why.length === 0) {
    why.push(locale === 'de' ? 'Passt zur Beschreibung' : 'Matches your description');
  }
  return why;
}
