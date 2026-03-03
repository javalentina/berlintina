import { supabase } from '../lib/supabase';
import type { Show } from '../types';
import { Category, PriceType, ArtistStatus } from '../types';
import { MOCK_SHOWS } from '../constants';

const isProduction = import.meta.env.PROD;
const apiBase = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
const useApiForShows = !!apiBase;

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
  };
}

export async function fetchShowsFromSupabase(): Promise<FetchShowsResult> {
  if (useApiForShows) {
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
  if (!supabase) {
    if (isProduction) {
      return { shows: [], error: 'Supabase not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.' };
    }
    return { shows: MOCK_SHOWS, error: null };
  }
  const { data, error } = await supabase
    .from('shows')
    .select('*')
    .eq('status', 'PUBLISHED');
  if (error) {
    if (isProduction) {
      return { shows: [], error: `Could not load shows: ${error.message}` };
    }
    console.warn('Supabase shows fetch failed, using mock data:', error.message);
    return { shows: MOCK_SHOWS, error: null };
  }
  if (!data?.length) {
    return { shows: [], error: null };
  }
  return { shows: (data as ShowRow[]).map(rowToShow), error: null };
}

export async function fetchShowsPage(
  offset: number,
  limit: number,
  filters?: ShowsPageFilters
): Promise<{ shows: Show[]; totalCount: number; error: string | null }> {
  if (useApiForShows) {
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
  if (!supabase) {
    if (isProduction) {
      return { shows: [], totalCount: 0, error: 'Supabase not configured.' };
    }
    const all = MOCK_SHOWS;
    const filtered = applyFilters(all, filters);
    const page = filtered.slice(offset, offset + limit);
    return { shows: page, totalCount: filtered.length, error: null };
  }
  let query = supabase.from('shows').select('*', { count: 'exact' }).eq('status', 'PUBLISHED');
  if (filters?.category) query = query.eq('category', filters.category);
  if (filters?.search?.trim()) {
    const search = filters.search.trim().replace(/,/g, ' ');
    const term = `%${search}%`;
    query = query.or(`title.ilike.${term},artist_name.ilike.${term}`);
  }
  if (filters?.priceMin != null) query = query.gte('price_min', filters.priceMin);
  if (filters?.priceMax != null) query = query.lte('price_max', filters.priceMax);
  if (filters?.durationMin != null) query = query.gte('duration_minutes', filters.durationMin);
  if (filters?.durationMax != null) query = query.lte('duration_minutes', filters.durationMax);
  query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
  const { data, error, count } = await query;
  if (error) {
    return { shows: [], totalCount: 0, error: error.message };
  }
  const rows = (data ?? []) as ShowRow[];
  return { shows: rows.map(rowToShow), totalCount: count ?? rows.length, error: null };
}

function applyFilters(shows: Show[], filters?: ShowsPageFilters): Show[] {
  if (!filters) return shows;
  return shows.filter((s) => {
    if (filters.category && s.category !== filters.category) return false;
    if (filters.search?.trim()) {
      const q = filters.search.trim().toLowerCase();
      if (!s.title.toLowerCase().includes(q) && !s.artistName.toLowerCase().includes(q)) return false;
    }
    if (filters.priceMin != null && (s.priceMax ?? s.priceMin ?? 0) < filters.priceMin) return false;
    if (filters.priceMax != null && (s.priceMin ?? Infinity) > filters.priceMax) return false;
    if (filters.durationMin != null && s.durationMinutes < filters.durationMin) return false;
    if (filters.durationMax != null && s.durationMinutes > filters.durationMax) return false;
    return true;
  });
}

export async function fetchShowBySlug(slug: string): Promise<{ show: Show | null; error: string | null }> {
  if (useApiForShows) {
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
  if (!supabase) {
    if (isProduction) return { show: null, error: 'Supabase not configured.' };
    const found = MOCK_SHOWS.find((s) => s.slug === slug) ?? null;
    return { show: found, error: null };
  }
  const { data, error } = await supabase
    .from('shows')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'PUBLISHED')
    .single();
  if (error || !data) return { show: null, error: error?.message ?? null };
  return { show: rowToShow(data as ShowRow), error: null };
}

export async function fetchShowByShortId(shortId: string): Promise<{ show: Show | null; error: string | null }> {
  if (useApiForShows) {
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
  if (!supabase) {
    if (isProduction) return { show: null, error: 'Supabase not configured.' };
    const found = MOCK_SHOWS.find((s) => s.shortId === shortId) ?? null;
    return { show: found, error: null };
  }
  const { data, error } = await supabase
    .from('shows')
    .select('*')
    .eq('short_id', shortId)
    .eq('status', 'PUBLISHED')
    .single();
  if (error || !data) return { show: null, error: error?.message ?? null };
  return { show: rowToShow(data as ShowRow), error: null };
}
