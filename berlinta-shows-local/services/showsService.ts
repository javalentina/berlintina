import type { Show } from '../types';
import { Category, PriceType, ArtistStatus } from '../types';

/**
 * Shows kommen ausschliesslich über die Express-API.
 *
 * Bis 2026-08-31 stand hier zusätzlich ein zweiter Weg: ein Supabase-Client im Browser,
 * eingeschaltet über `const useApiForShows = true`. Weil diese Konstante fest verdrahtet
 * war, lief nie etwas darüber — der Zweig war toter Code, aber `import { supabase }` hielt
 * `@supabase/supabase-js` samt Auth (GoTrue) und Realtime-Websockets im Bundle, das jeder
 * Besucher lädt. Am ausgelieferten Bundle nachgewiesen (`phx_join`, `gotrue`,
 * `onAuthStateChange`), obwohl der Client in Produktion mangels Schlüssel `null` war.
 *
 * Der Zweig war ausserdem ein Sicherheitsrisiko auf Vorrat: er fragte dreimal mit
 * `select('*')` direkt gegen Supabase ab. Genau dieses Muster war das Leck, das die
 * Künstler-E-Mail öffentlich machte (PR #15) — hätte jemand die Konstante umgestellt, wäre
 * es an der Spalten-Allowlist des Servers vorbei zurückgekommen.
 *
 * Wer wieder direkt aus dem Browser lesen will: nicht diese Konstante zurückholen, sondern
 * bewusst einen Client mit `grant`-geprüften Spalten aufsetzen.
 */
const apiBase = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

export type FetchShowsResult = { shows: Show[]; error: string | null };

export type ShowsPageFilters = {
  category?: string;
  search?: string;
  priceMin?: number;
  priceMax?: number;
  durationMin?: number;
  durationMax?: number;
};

type ShowRow = {
  id: string;
  short_id: string;
  slug: string;
  artist_id: string;
  artist_name: string;
  title: string;
  category: string;
  instrumentation_text?: string | null;
  extracted_tags: string[];
  vibe_tags: string[];
  short_description_facts: string;
  sales_pitch_text: string;
  duration_minutes: number;
  language_options: string[];
  price_type: string;
  price_min?: number | null;
  price_max?: number | null;
  photo_urls: string[];
  video_urls: string[];
  status: string;
  cast?: string | null;
  ideal_for?: string | null;
  placement?: string | null;
  audience_range?: string | null;
  stage_min?: string | null;
  stage_ideal?: string | null;
  ceiling_min?: string | null;
  sound_short?: string | null;
  light_short?: string | null;
  timings_short?: string | null;
  rider_pdf_url?: string | null;
  testimonials?: { quote: string; name: string }[] | null;
  faq_outdoor?: string | null;
  faq_stage?: string | null;
  faq_language?: string | null;
  faq_custom?: string | null;
  faq_travel?: string | null;
  partner_link_url?: string | null;
};

function rowToShow(row: ShowRow): Show {
  const testimonials = Array.isArray(row.testimonials) ? row.testimonials : [];
  return {
    id: row.id,
    shortId: row.short_id,
    slug: row.slug,
    artistId: row.artist_id,
    artistName: row.artist_name,
    title: row.title,
    category: row.category as Category,
    instrumentationText: row.instrumentation_text ?? undefined,
    extractedTags: Array.isArray(row.extracted_tags) ? row.extracted_tags : [],
    vibeTags: Array.isArray(row.vibe_tags) ? row.vibe_tags : [],
    shortDescriptionFacts: row.short_description_facts,
    salesPitchText: row.sales_pitch_text,
    durationMinutes: row.duration_minutes,
    languageOptions: Array.isArray(row.language_options) ? row.language_options : [],
    priceType: row.price_type as PriceType,
    priceMin: row.price_min ?? undefined,
    priceMax: row.price_max ?? undefined,
    photoUrls: Array.isArray(row.photo_urls) ? row.photo_urls : [],
    videoUrls: Array.isArray(row.video_urls) ? row.video_urls : [],
    status: row.status as ArtistStatus,
    cast: row.cast ?? undefined,
    idealFor: row.ideal_for ?? undefined,
    placement: row.placement ?? undefined,
    audienceRange: row.audience_range ?? undefined,
    stageMin: row.stage_min ?? undefined,
    stageIdeal: row.stage_ideal ?? undefined,
    ceilingMin: row.ceiling_min ?? undefined,
    soundShort: row.sound_short ?? undefined,
    lightShort: row.light_short ?? undefined,
    timingsShort: row.timings_short ?? undefined,
    riderPdfUrl: row.rider_pdf_url ?? undefined,
    testimonials: testimonials.length ? testimonials : undefined,
    faqOutdoor: row.faq_outdoor ?? undefined,
    faqStage: row.faq_stage ?? undefined,
    faqLanguage: row.faq_language ?? undefined,
    faqCustom: row.faq_custom ?? undefined,
    faqTravel: row.faq_travel ?? undefined,
    partnerLinkUrl: row.partner_link_url ?? undefined,
  };
}

export async function fetchShowsFromSupabase(): Promise<FetchShowsResult> {
  try {
    const res = await fetch(`${apiBase}/api/shows`);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { shows: [], error: (json as { error?: string }).error || `Request failed: ${res.status}` };
    const rows = (json as { shows?: ShowRow[] }).shows || [];
    return { shows: rows.map(rowToShow), error: null };
  } catch (e) {
    return { shows: [], error: `Could not load shows: ${e instanceof Error ? e.message : 'Failed to fetch'}` };
  }
}

export async function fetchShowsPage(
  offset: number,
  limit: number,
  filters?: ShowsPageFilters
): Promise<{ shows: Show[]; totalCount: number; error: string | null }> {
  try {
    const params = new URLSearchParams({ offset: String(offset), limit: String(limit) });
    if (filters?.category && filters.category !== 'ALL') params.set('category', filters.category);
    if (filters?.search?.trim()) params.set('search', filters.search.trim());
    const res = await fetch(`${apiBase}/api/shows/page?${params}`);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { shows: [], totalCount: 0, error: (json as { error?: string }).error || `Request failed: ${res.status}` };
    const rows = ((json as { shows?: ShowRow[] }).shows || []) as ShowRow[];
    const totalCount = (json as { totalCount?: number }).totalCount ?? rows.length;
    return { shows: rows.map(rowToShow), totalCount, error: null };
  } catch (e) {
    return { shows: [], totalCount: 0, error: e instanceof Error ? e.message : 'Failed to fetch' };
  }
}

export async function fetchShowBySlug(slug: string): Promise<{ show: Show | null; error: string | null }> {
  try {
    const res = await fetch(`${apiBase}/api/shows/slug/${encodeURIComponent(slug)}`);
    if (!res.ok) return { show: null, error: res.status === 404 ? null : `Request failed: ${res.status}` };
    const json = await res.json().catch(() => ({}));
    const row = (json as { show?: ShowRow }).show;
    if (!row) return { show: null, error: null };
    return { show: rowToShow(row), error: null };
  } catch (e) {
    return { show: null, error: e instanceof Error ? e.message : 'Failed to fetch' };
  }
}

export async function fetchShowByShortId(shortId: string): Promise<{ show: Show | null; error: string | null }> {
  try {
    const res = await fetch(`${apiBase}/api/shows/by/${encodeURIComponent(shortId)}`);
    if (!res.ok) return { show: null, error: res.status === 404 ? null : `Request failed: ${res.status}` };
    const json = await res.json().catch(() => ({}));
    const row = (json as { show?: ShowRow }).show;
    if (!row) return { show: null, error: null };
    return { show: rowToShow(row), error: null };
  } catch (e) {
    return { show: null, error: e instanceof Error ? e.message : 'Failed to fetch' };
  }
}
