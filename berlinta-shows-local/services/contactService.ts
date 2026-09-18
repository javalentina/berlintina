import { track, ANFRAGE_GESENDET } from '../lib/track';

const base = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
const API_BASE = base ? `${base}/api` : '/api';

export interface ContactRequestPayload {
  showId?: string;
  showTitle?: string;
  requesterName: string;
  requesterEmail: string;
  message?: string;
  eventDate?: string;
}

export async function submitContactRequest(payload: ContactRequestPayload): Promise<{ success: boolean; error?: string }> {
  const res = await fetch(`${API_BASE}/contact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { success: false, error: (data as { error?: string }).error || `Request failed: ${res.status}` };
  }
  // Fired here rather than in the forms: every enquiry, wherever it was typed,
  // passes through this one place — so it is counted once and never twice.
  track(ANFRAGE_GESENDET, { show: payload.showTitle, show_id: payload.showId });
  return { success: true };
}
