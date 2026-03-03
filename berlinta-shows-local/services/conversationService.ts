const base = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
const API_BASE = base ? `${base}/api` : '/api';

export type ConversationAction = 'ASK_FOLLOWUP' | 'SHOW_RESULTS' | 'SAVE_SUBMISSION' | 'NONE';

export interface NextQuestion {
  slot: string;
  text: string;
  quickReplies?: string[];
  showMediaInput?: boolean;
}

export interface Recommendation {
  showId: string;
  why: string[];
}

export interface ConversationResponse {
  assistantMessage: string;
  action: ConversationAction;
  statePatch?: Record<string, unknown>;
  nextQuestion?: NextQuestion;
  quickReplies?: string[];
  recommendations?: Recommendation[];
  errors?: string[];
}

async function post<T>(path: string, body: object): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed: ${res.status}`);
  }
  return data as T;
}

export async function conversationStart(
  type: 'AGENCY' | 'ARTIST',
  locale: string,
  options?: { returningArtist?: boolean }
): Promise<{ conversationId: string; greeting: string; response: ConversationResponse }> {
  return post('/conversation/start', { type, locale, ...options });
}

export async function conversationMessage(
  conversationId: string,
  userMessage: string,
  state: Record<string, unknown>,
  options?: { action?: string; value?: string }
): Promise<ConversationResponse> {
  return post('/conversation/message', {
    conversationId,
    userMessage,
    state,
    ...(options?.action && { action: options.action }),
    ...(options?.value && { value: options.value }),
  });
}
