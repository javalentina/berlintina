import type { CustomerBrief } from '../types';

const base = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
const API_BASE = base ? `${base}/api` : '/api';

async function post<T>(path: string, body: object): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export async function extractBrief(userInput: string): Promise<CustomerBrief> {
  const { brief } = await post<{ brief: CustomerBrief }>('/ai/extract-brief', { userInput });
  return brief;
}

export async function answerShowQuestion(question: string, showFacts: string, locale?: string): Promise<string> {
  const { text } = await post<{ text: string }>('/ai/answer-question', { question, showFacts, locale });
  return text;
}

export type PolishField = 'shortDescriptionFacts' | 'salesPitchText' | 'artistBio';

export async function polishText(rawText: string, field: PolishField, locale?: string): Promise<string> {
  const { polishedText } = await post<{ polishedText: string }>('/ai/polish-text', { rawText, field, locale: locale || 'de' });
  return polishedText;
}

export interface AgencyChatResponse {
  assistantMessage: string;
  brief?: Record<string, unknown>;
  recommendedShowIds?: string[];
  matchExplanations?: { showId: string; reason: string }[];
}

export async function agencyChat(
  conversationId: string | null,
  userMessage: string,
  locale: string
): Promise<AgencyChatResponse> {
  return post<AgencyChatResponse>('/ai/agency-chat', {
    conversationId,
    userMessage,
    locale,
  });
}

export interface ArtistChatResponse {
  assistantMessage: string;
  suggestedFieldUpdates?: Record<string, unknown>;
}

export async function artistChat(
  conversationId: string | null,
  currentFormState: Record<string, unknown>,
  userMessage: string,
  locale: string
): Promise<ArtistChatResponse> {
  return post<ArtistChatResponse>('/ai/artist-chat', {
    conversationId,
    currentFormState,
    userMessage,
    locale,
  });
}
