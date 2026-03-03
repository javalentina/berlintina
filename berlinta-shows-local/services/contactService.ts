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
  return { success: true };
}
