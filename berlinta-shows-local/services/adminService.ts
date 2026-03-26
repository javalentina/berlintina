const base = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
const API_BASE = base ? `${base}/api` : '/api';

export interface Submission {
  id: string;
  artist_genre?: string | null;
  show_title: string;
  photo_urls?: string[] | null;
  video_urls?: string[] | null;
  duration_minutes?: number | null;
  language_options?: string[] | null;
  price_text?: string | null;
  short_description_facts?: string | null;
  sales_pitch_text?: string | null;
  social_links?: string | null;
  artist_bio?: string | null;
  submitter_email: string;
  status: string;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  review_notes?: string | null;
}

async function adminFetch(path: string, opts: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? sessionStorage.getItem('admin_token') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed: ${res.status}`);
  }
  return data;
}

export async function adminLogin(password: string): Promise<{ ok: boolean }> {
  const data = await adminFetch('/admin/login', {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
  if ((data as { ok?: boolean }).ok && typeof window !== 'undefined') {
    sessionStorage.setItem('admin_token', password);
  }
  return data as { ok: boolean };
}

export function adminLogout(): void {
  if (typeof window !== 'undefined') sessionStorage.removeItem('admin_token');
}

export function adminIsLoggedIn(): boolean {
  return !!(typeof window !== 'undefined' && sessionStorage.getItem('admin_token'));
}

export async function adminGetSubmissions(status?: string): Promise<{ submissions: Submission[] }> {
  const q = status ? `?status=${encodeURIComponent(status)}` : '';
  return adminFetch(`/admin/submissions${q}`) as Promise<{ submissions: Submission[] }>;
}

export async function adminGetSubmission(id: string): Promise<Submission> {
  return adminFetch(`/admin/submissions/${id}`) as Promise<Submission>;
}

/** Update submission fields in any status (PENDING_REVIEW, APPROVED, CHANGES_REQUESTED, REJECTED). */
export interface AdminSubmissionUpdatePayload {
  show_title?: string;
  short_description_facts?: string;
  sales_pitch_text?: string;
  artist_genre?: string;
  duration_minutes?: number;
  price_text?: string;
  language_options?: string[];
  photo_urls?: string[];
  video_urls?: string[];
  artist_bio?: string;
  social_links?: string;
  submitter_email?: string;
  photoBase64?: string;
  /** Multiple images (base64 data URLs). */
  photoBase64s?: string[];
  /** Change submission status (PENDING_REVIEW | APPROVED | REJECTED | CHANGES_REQUESTED). */
  status?: string;
}

export async function adminUpdateSubmission(
  id: string,
  payload: AdminSubmissionUpdatePayload
): Promise<{ ok: boolean; submission: Submission }> {
  return adminFetch(`/admin/submissions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }) as Promise<{ ok: boolean; submission: Submission }>;
}

export interface AdminApproveOverrides {
  title?: string;
  short_description_facts?: string;
  sales_pitch_text?: string;
  artist_genre?: string;
  artist_name?: string;
  duration_minutes?: number;
  price_text?: string;
  language_options?: string[];
  photo_urls?: string[];
  video_urls?: string[];
  photoBase64?: string;
  photoBase64s?: string[];
}

export async function adminApprove(id: string, overrides?: AdminApproveOverrides): Promise<{ ok: boolean; showId?: string }> {
  return adminFetch(`/admin/submissions/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify(overrides || {}),
  }) as Promise<{ ok: boolean; showId?: string }>;
}

export async function adminReject(id: string, reviewNotes?: string): Promise<{ ok: boolean }> {
  return adminFetch(`/admin/submissions/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ review_notes: reviewNotes }),
  }) as Promise<{ ok: boolean }>;
}

export async function adminDeleteSubmission(id: string): Promise<{ ok: boolean }> {
  return adminFetch(`/admin/submissions/${id}`, { method: 'DELETE' }) as Promise<{ ok: boolean }>;
}

export async function adminRequestChanges(id: string, reviewNotes?: string): Promise<{ ok: boolean }> {
  return adminFetch(`/admin/submissions/${id}/changes`, {
    method: 'POST',
    body: JSON.stringify({ review_notes: reviewNotes }),
  }) as Promise<{ ok: boolean }>;
}

// --- Admin: edit published shows (text + pictures); send email to artist; if email fails, show is hidden ---
export interface AdminShowListItem {
  id: string;
  short_id: string;
  slug: string;
  title: string;
  artist_name: string;
  status: string;
  artist_email?: string | null;
  artist_notified_at?: string | null;
  created_at?: string | null;
}

export interface AdminShowFull {
  id: string;
  short_id: string;
  slug: string;
  artist_id: string;
  artist_name: string;
  title: string;
  category: string;
  short_description_facts?: string | null;
  sales_pitch_text?: string | null;
  duration_minutes: number;
  language_options?: string[] | null;
  price_type: string;
  price_min?: number | null;
  price_max?: number | null;
  photo_urls?: string[] | null;
  video_urls?: string[] | null;
  status: string;
  artist_email?: string | null;
  artist_notified_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
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
}

export interface AdminShowUpdatePayload {
  title?: string;
  short_description_facts?: string;
  sales_pitch_text?: string;
  artist_name?: string;
  duration_minutes?: number;
  price_text?: string;
  photo_urls?: string[];
  video_urls?: string[];
  photoBase64?: string;
  photoBase64s?: string[];
  notify_artist?: boolean;
  cast?: string;
  ideal_for?: string;
  placement?: string;
  audience_range?: string;
  stage_min?: string;
  stage_ideal?: string;
  ceiling_min?: string;
  sound_short?: string;
  light_short?: string;
  timings_short?: string;
  rider_pdf_url?: string;
  testimonials?: { quote: string; name: string }[];
  faq_outdoor?: string;
  faq_stage?: string;
  faq_language?: string;
  faq_custom?: string;
  faq_travel?: string;
}

export async function adminGetShows(): Promise<{ shows: AdminShowListItem[] }> {
  return adminFetch('/admin/shows') as Promise<{ shows: AdminShowListItem[] }>;
}

export async function adminGetShow(id: string): Promise<AdminShowFull> {
  return adminFetch(`/admin/shows/${id}`) as Promise<AdminShowFull>;
}

export async function adminUpdateShow(
  id: string,
  payload: AdminShowUpdatePayload
): Promise<{ ok: boolean; show: AdminShowFull; emailSent?: boolean }> {
  return adminFetch(`/admin/shows/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }) as Promise<{ ok: boolean; show: AdminShowFull; emailSent?: boolean }>;
}

export async function adminDeleteShow(id: string): Promise<{ ok: boolean }> {
  return adminFetch(`/admin/shows/${id}`, { method: 'DELETE' }) as Promise<{ ok: boolean }>;
}

// --- Blog admin ---
export interface AdminBlogPostSummary {
  id: string;
  slug: string;
  title_de: string;
  title_en: string;
  published_at: string | null;
  created_at: string;
}

export interface AdminBlogPostFull extends AdminBlogPostSummary {
  excerpt_de: string;
  excerpt_en: string;
  content_de: string;
  content_en: string;
  cover_image_url: string | null;
}

export type AdminBlogPostPayload = Partial<Omit<AdminBlogPostFull, 'id' | 'created_at'>>;

export async function adminListBlogPosts(): Promise<{ posts: AdminBlogPostSummary[] }> {
  return adminFetch('/admin/blog') as Promise<{ posts: AdminBlogPostSummary[] }>;
}

export async function adminGetBlogPost(id: string): Promise<AdminBlogPostFull> {
  return adminFetch(`/admin/blog/${id}`) as Promise<AdminBlogPostFull>;
}

export async function adminCreateBlogPost(payload: AdminBlogPostPayload): Promise<{ post: AdminBlogPostSummary }> {
  return adminFetch('/admin/blog', { method: 'POST', body: JSON.stringify(payload) }) as Promise<{ post: AdminBlogPostSummary }>;
}

export async function adminUpdateBlogPost(id: string, payload: AdminBlogPostPayload): Promise<{ post: AdminBlogPostSummary }> {
  return adminFetch(`/admin/blog/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }) as Promise<{ post: AdminBlogPostSummary }>;
}

export async function adminDeleteBlogPost(id: string): Promise<{ ok: boolean }> {
  return adminFetch(`/admin/blog/${id}`, { method: 'DELETE' }) as Promise<{ ok: boolean }>;
}
