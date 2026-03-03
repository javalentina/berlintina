const base = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
const API_BASE = base ? `${base}/api` : '/api';

export interface ResolvedArtistAccount {
  id: string;
  displayName: string | null;
  instagramHandle: string | null;
  websiteUrl: string | null;
  hasPrivateEmail: boolean;
}

export interface ResolveArtistResponse {
  isReturning: boolean;
  artistAccount?: ResolvedArtistAccount;
}

export async function resolveArtistToken(artistToken: string): Promise<ResolveArtistResponse> {
  const res = await fetch(`${API_BASE}/artist/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ artistToken }),
  });
  const data = await res.json().catch(() => ({ isReturning: false }));
  return data as ResolveArtistResponse;
}

export const ARTIST_TOKEN_KEY = 'artist_token';

export function getStoredArtistToken(): string | null {
  if (typeof localStorage === 'undefined') return null;
  const t = localStorage.getItem(ARTIST_TOKEN_KEY);
  return t && t.trim() ? t : null;
}

export function setStoredArtistToken(token: string): void {
  localStorage.setItem(ARTIST_TOKEN_KEY, token);
}

export function clearStoredArtistToken(): void {
  localStorage.removeItem(ARTIST_TOKEN_KEY);
}

export interface ArtistShowSummary {
  id: string;
  slug: string;
  short_id: string;
  title: string;
  category: string;
  photo_urls: string[];
  vibe_tags: string[];
  duration_minutes: number;
  price_type: string;
  price_min?: number;
  price_max?: number;
  status: string;
  created_at: string;
}

export interface ArtistPortalData {
  artist: {
    id: string;
    display_name: string | null;
    instagram_handle: string | null;
    website_url: string | null;
    email: string | null;
  };
  shows: ArtistShowSummary[];
}

export async function fetchArtistShows(token: string): Promise<ArtistPortalData | null> {
  try {
    const res = await fetch(`${API_BASE}/artist/shows`, {
      headers: { 'x-artist-token': token },
    });
    if (!res.ok) return null;
    return res.json() as Promise<ArtistPortalData>;
  } catch {
    return null;
  }
}
