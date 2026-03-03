const base = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
const API_BASE = base ? `${base}/api` : '/api';

export interface SubmissionPayload {
  artistName?: string;
  artistGenre?: string;
  showTitle: string;
  websiteUrl?: string;
  photoUrls?: string[];
  photoBase64?: string;
  /** Multiple photos as base64 (overview step multi-upload) */
  photoBase64Array?: string[];
  videoUrls?: string[];
  durationMinutes?: number;
  languageOptions?: string[];
  priceText?: string;
  shortDescriptionFacts?: string;
  salesPitchText?: string;
  socialLinks?: string;
  artistBio?: string;
  faqOutdoor?: string;
  faqStage?: string;
  faqLanguage?: string;
  faqCustom?: string;
  faqTravel?: string;
  submitterEmail: string;
  honeypot?: string;
  /** Returning artist: send stored token so backend links to existing account */
  artistToken?: string;
  /** Raw media links string (backend parses into photoUrls + videoUrls) */
  mediaLinks?: string;
}

export interface SubmissionResponse {
  submissionId: string;
  message: string;
  /** Set when a new token was issued (first submit or new device) */
  artistToken?: string;
}

export async function submitArtistOnboarding(payload: SubmissionPayload): Promise<SubmissionResponse> {
  const res = await fetch(`${API_BASE}/submissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed: ${res.status}`);
  }
  return data as SubmissionResponse;
}
