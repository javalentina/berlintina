import 'dotenv/config';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import express from 'express';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import nodemailer from 'nodemailer';
import OpenAI from 'openai';
import { GoogleGenAI, Type } from '@google/genai';
import { createClient } from '@supabase/supabase-js';

const app = express();
app.use(cors({
  origin: [
    'https://berlintina.de',
    'http://berlintina.de',
    'https://www.berlintina.de',
    'http://www.berlintina.de',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-token', 'x-artist-token'],
}));
app.use(express.json({ limit: '10mb' }));

function randomId() {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

app.use((req, res, next) => {
  req.requestId = randomId();
  const start = Date.now();
  res.on('finish', () => {
    const latency = Date.now() - start;
    console.log(JSON.stringify({
      requestId: req.requestId,
      route: req.method + ' ' + req.path,
      status: res.statusCode,
      latency,
    }));
  });
  next();
});

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

const submissionsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many submissions. Please try again later.' },
});

const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many contact requests. Please try again later.' },
});

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many AI requests. Please wait a moment.' },
});

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'password';
function requireAdmin(req, res, next) {
  if (!ADMIN_PASSWORD) {
    return res.status(503).json({ error: 'Admin not configured. Set ADMIN_PASSWORD.' });
  }
  const auth = req.headers.authorization;
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : req.headers['x-admin-token'];
  if (token !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Invalid or missing admin token.' });
  }
  next();
}

// --- Artist notification email (optional; visibility does not depend on it) ---
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_SECURE = process.env.SMTP_SECURE === 'true';
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const EMAIL_FROM = process.env.EMAIL_FROM || 'Berlintina <noreply@localhost>';
const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || 'info@berlintina.de';

async function sendArtistEmail(artistEmail, type, showInfo) {
  const email = (artistEmail || '').trim();
  if (!email) return false;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.warn('Artist email not sent: SMTP not configured. Show will not be visible until email is sent.');
    return false;
  }
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  const subject = type === 'approved'
    ? `Ihre Show "${showInfo.title}" ist jetzt auf Berlintina veröffentlicht`
    : `Änderungen an Ihrer Show "${showInfo.title}" auf Berlintina`;
  const text = type === 'approved'
    ? `Hallo,\n\nIhre Show "${showInfo.title}" wurde freigegeben und ist jetzt auf Berlintina sichtbar.\n\nViele Grüße,\nBerlintina`
    : `Hallo,\n\nAn Ihrer Show "${showInfo.title}" wurden Änderungen vorgenommen. Schauen Sie auf der Plattform nach.\n\nViele Grüße,\nBerlintina`;
  try {
    await transporter.sendMail({
      from: EMAIL_FROM,
      to: email,
      subject,
      text,
    });
    return true;
  } catch (err) {
    console.error('sendArtistEmail failed:', err.message);
    return false;
  }
}

const PORT = process.env.PORT || 3001;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MOCK_MODE = process.env.MOCK_MODE === 'true';

const useOpenAI = OPENAI_API_KEY && !MOCK_MODE;
const useGemini = !useOpenAI && GEMINI_API_KEY && !MOCK_MODE;

const openai = useOpenAI ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;
const gemini = useGemini ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

const mockBrief = (userInput) => ({
  eventType: 'Private Event',
  desiredCategories: ['CLASSICAL'],
  extraNotes: userInput,
});

const mockAnswer = () =>
  'Das ist eine gute Frage! Basierend auf den Informationen der Show scheint dies möglich zu sein. Für Details kontaktieren Sie bitte den Künstler.';

async function fetchKBArticles(locale, searchQuery) {
  if (!supabase) return [];
  const loc = locale === 'en' ? 'en' : 'de';
  let q = supabase.from('kb_articles').select('title, content, category').eq('locale', loc);
  if (searchQuery && typeof searchQuery === 'string' && searchQuery.trim()) {
    const term = `%${searchQuery.trim()}%`;
    q = q.or(`title.ilike.${term},content.ilike.${term}`);
  }
  const { data } = await q.limit(5);
  return data || [];
}

// --- OpenAI helpers ---
async function openaiExtractBrief(userInput) {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{
      role: 'user',
      content: `Extract the following details from this event query: "${userInput}". Return a JSON object with these keys only: eventType (string), eventDate (ISO string or null), locationCity (string or null), audienceCount (number or null), desiredCategories (array of: CLASSICAL, BAND, ACROBATICS, DANCE), desiredVibes (array of strings), durationMinutes (number or null), budgetMax (number or null), languagePreference (de, en, or both), extraNotes (string).`,
    }],
    response_format: { type: 'json_object' },
  });
  const text = completion.choices[0]?.message?.content ?? '{}';
  return JSON.parse(text);
}

const SCOPE_POLICY_QA = 'Scope: Only questions about this show or the platform. For off-topic questions, politely redirect: "I can only answer questions about this show. Do you have one?"';

async function openaiAnswerQuestion(question, showFacts) {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'You are the Berlintina show concierge — warm, knowledgeable, and direct. Answer questions about this show as if you personally know the artist. If the answer is not in the facts provided, say so honestly and encourage the visitor to send a booking inquiry — a real person at Berlintina will answer within 24 hours. Never speculate or invent details. ' + SCOPE_POLICY_QA },
      { role: 'user', content: `Question: "${question}"\n\nShow facts: "${showFacts}"` },
    ],
  });
  return completion.choices[0]?.message?.content?.trim() ?? 'Entschuldigung, ich konnte keine Antwort finden.';
}

// --- Gemini helpers ---
async function geminiExtractBrief(userInput) {
  const response = await gemini.models.generateContent({
    model: 'gemini-1.5-flash',
    contents: `Extract the following details from this event query: "${userInput}". Return JSON format with these keys: eventType, eventDate (ISO), locationCity, audienceCount (number), desiredCategories (CLASSICAL, BAND, ACROBATICS, DANCE), desiredVibes, durationMinutes, budgetMax, languagePreference (de, en, both), extraNotes.`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          eventType: { type: Type.STRING },
          eventDate: { type: Type.STRING },
          locationCity: { type: Type.STRING },
          audienceCount: { type: Type.NUMBER },
          desiredCategories: { type: Type.ARRAY, items: { type: Type.STRING } },
          desiredVibes: { type: Type.ARRAY, items: { type: Type.STRING } },
          durationMinutes: { type: Type.NUMBER },
          budgetMax: { type: Type.NUMBER },
          languagePreference: { type: Type.STRING },
          extraNotes: { type: Type.STRING },
        },
      },
    },
  });
  const text = response.text ?? '{}';
  return JSON.parse(text);
}

async function geminiAnswerQuestion(question, showFacts) {
  const response = await gemini.models.generateContent({
    model: 'gemini-1.5-flash',
    contents: `You are a helpful event concierge. Answer this question: "${question}" about a show with these facts: "${showFacts}". Be warm and professional. If the answer is not in the facts, politely say you don't know and suggest contacting the artist. ${SCOPE_POLICY_QA}`,
  });
  return response.text ?? 'Entschuldigung, ich konnte keine Antwort finden.';
}

const POLISH_PROMPTS = {
  shortDescriptionFacts: {
    de: `Du schreibst Show-Beschreibungen für Berlintina.de — eine kuratierte Berliner Künstleragentur für Galas, Firmenfeiern und private Events.

Zielgruppe: Eventplaner und HR-Manager, die einen unvergesslichen Moment für ihre Veranstaltung suchen. Sie brauchen keine Features — sie wollen das Gefühl im Raum, wenn diese Show beginnt.

Schreibe die folgende Rohbeschreibung um. Struktur:
1. Ein starker Eröffnungssatz — konkret, sinnlich, unvergesslich (kein "Das ist eine Show über...")
2. Was auf der Bühne passiert — präzise, lebendig, einzigartig
3. Wer der Künstler ist — kurz, persönlich, mit Energie
4. Format und Praktisches (Dauer, Sprache, technische Basis)

Regeln: Keine Buzzwords (atemberaubend, einzigartig, unvergesslich — zeig es statt es zu sagen). Keine Passivkonstruktionen. Maximal 4 Sätze. Nur den fertigen Text ausgeben, keine Erklärungen.`,
    en: `You write show descriptions for Berlintina.de — a curated Berlin artist agency for galas, corporate events, and private occasions.

Audience: Event planners and HR managers looking for an unforgettable moment at their event. They don't need features — they want to feel what the room will be like when this show begins.

Rewrite the following raw description. Structure:
1. One strong opening sentence — concrete, sensory, specific (not "This is a show about...")
2. What happens on stage — precise, vivid, specific
3. Who the artist is — brief, personal, with energy
4. Format and practicalities (duration, language, technical needs)

Rules: No buzzwords (breathtaking, unique, unforgettable — show it, don't say it). No passive constructions. Max 4 sentences. Output only the finished text, no explanations.`,
  },
  salesPitchText: {
    de: `Du schreibst den Einzeiler einer Show für Berlintina.de — sichtbar auf der Übersichtsseite für Eventplaner.

Ziel: Ein Satz, der sofort klar macht, warum genau diese Show die richtige ist — und Lust auf mehr macht.

Formel: [Was der Raum erlebt] + [wer das liefert] + [für welchen Anlass perfekt]

Beispiel: "Wenn ein Streichquartett auf elektronische Beats trifft — die Show, die Galas in Berlin seit Jahren unvergesslich macht."

Regeln: Maximal 2 Sätze. Kein "Diese Show ist...". Kein generisches Lob. Konkret und buchbar. Nur den fertigen Text ausgeben.`,
    en: `You write the one-liner for a show on Berlintina.de — visible on the overview page for event planners.

Goal: One sentence that immediately makes clear why this show is the right choice — and makes them want to know more.

Formula: [What the room experiences] + [who delivers it] + [perfect for which occasion]

Example: "When a string quartet meets electronic beats — the act that has made Berlin galas unforgettable for years."

Rules: Max 2 sentences. No "This show is...". No generic praise. Concrete and bookable. Output only the finished text.`,
  },
  artistBio: {
    de: `Du schreibst den Künstler-Steckbrief für eine Show-Seite auf Berlintina.de.

Zielgruppe: Eventplaner, die wissen wollen: Wer ist das? Kann ich dem vertrauen? Passt das zu meinem Event?

Schreibe die folgenden Rohdaten um. Was gezeigt werden soll:
- Kurze persönliche Vorstellung (Name, Hintergrund, was sie antreibt)
- Was sie auf die Bühne bringen, das andere nicht haben
- Ein konkretes Detail, das hängenbleibt (Auszeichnung, bekannte Bühne, besondere Geschichte)

Regeln: 3–4 Sätze. Warmherzig aber professionell. Erste Person NICHT verwenden. Kein "Der Künstler ist...". Nur den fertigen Text ausgeben.`,
    en: `You write the artist bio for a show page on Berlintina.de.

Audience: Event planners who want to know: Who is this? Can I trust them? Will they fit my event?

Rewrite the following raw info. What to convey:
- Brief personal introduction (name, background, what drives them)
- What they bring to the stage that others don't
- One concrete detail that sticks (award, famous stage, distinctive story)

Rules: 3–4 sentences. Warm but professional. Do NOT use first person. No "The artist is...". Output only the finished text.`,
  },
};

async function openaiPolishText(rawText, field, locale) {
  const l = locale === 'en' ? 'en' : 'de';
  const prompt = POLISH_PROMPTS[field]?.[l] || POLISH_PROMPTS.shortDescriptionFacts[l];
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'You are an editor. Output only the polished text, no explanations or quotes.' },
      { role: 'user', content: `${prompt}\n\nRaw input:\n${rawText || ''}` },
    ],
  });
  return ((completion.choices[0]?.message?.content ?? rawText) || '').trim();
}

async function geminiPolishText(rawText, field, locale) {
  const l = locale === 'en' ? 'en' : 'de';
  const prompt = POLISH_PROMPTS[field]?.[l] || POLISH_PROMPTS.shortDescriptionFacts[l];
  const response = await gemini.models.generateContent({
    model: 'gemini-1.5-flash',
    contents: `${prompt}\n\nRaw input:\n${rawText || ''}\n\nOutput only the polished text, nothing else.`,
  });
  return ((response.text ?? rawText) || '').trim();
}

// --- Website scraping helper ---
function extractTextFromHtml(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim()
    .slice(0, 5000);
}

async function scrapeWebsiteForShow(url, locale) {
  const loc = locale === 'en' ? 'en' : 'de';
  let html = '';
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Berlintina-Bot/1.0)' },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    html = await response.text();
  } catch (e) {
    throw new Error(loc === 'de' ? `Seite konnte nicht geladen werden: ${e.message}` : `Could not load page: ${e.message}`);
  }
  const pageText = extractTextFromHtml(html);
  if (!pageText.trim()) throw new Error(loc === 'de' ? 'Seite hat keinen lesbaren Text.' : 'Page has no readable text.');

  const prompt = loc === 'de'
    ? `Analysiere den folgenden Website-Text eines Künstlers oder einer Show und extrahiere alle relevanten Informationen für eine Show-Anmeldung. Gib das Ergebnis als JSON zurück.\n\nWebsite-Text:\n${pageText}\n\nJSON-Format:\n{ "artistName": "Künstlername oder Gruppenname", "showTitle": "Titel der Show", "shortDescriptionFacts": "2-3 Sätze Beschreibung", "artistBio": "Über den Künstler", "artistGenre": "Genre/Kunstform", "priceText": "Preis falls erwähnt", "durationMinutes": Zahl oder null, "faqOutdoor": "Outdoor möglich? falls erwähnt", "faqLanguage": "Sprachoptionen falls erwähnt", "photoUrls": ["gefundene Bild-URLs falls relevant"], "socialLinks": "Instagram/Website URLs" }\n\nNur JSON, keine Erklärungen.`
    : `Analyze the following artist or show website text and extract all relevant information for a show registration. Return results as JSON.\n\nWebsite text:\n${pageText}\n\nJSON format:\n{ "artistName": "Artist name or group name", "showTitle": "Show title", "shortDescriptionFacts": "2-3 sentence description", "artistBio": "About the artist", "artistGenre": "Genre/art form", "priceText": "Price if mentioned", "durationMinutes": number or null, "faqOutdoor": "Outdoor possible? if mentioned", "faqLanguage": "Language options if mentioned", "photoUrls": ["found image URLs if relevant"], "socialLinks": "Instagram/website URLs" }\n\nOnly JSON, no explanations.`;

  let extracted = {};
  try {
    if (useOpenAI) {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      });
      extracted = JSON.parse(completion.choices[0]?.message?.content ?? '{}');
    } else if (useGemini) {
      const resp = await gemini.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: prompt,
        config: { responseMimeType: 'application/json' },
      });
      extracted = JSON.parse(resp.text ?? '{}');
    }
  } catch (e) {
    extracted = {};
  }
  // Clean up: remove null/empty values, ensure photoUrls is array
  const clean = {};
  for (const [k, v] of Object.entries(extracted)) {
    if (v !== null && v !== undefined && v !== '' && v !== 0) clean[k] = v;
  }
  if (!Array.isArray(clean.photoUrls)) delete clean.photoUrls;
  return clean;
}

// --- Routes ---
app.post('/api/ai/extract-brief', aiLimiter, async (req, res) => {
  try {
    const { userInput } = req.body || {};
    if (!userInput || typeof userInput !== 'string') {
      return res.status(400).json({ error: 'userInput is required' });
    }
    let brief;
    if (useOpenAI) brief = await openaiExtractBrief(userInput);
    else if (useGemini) brief = await geminiExtractBrief(userInput);
    else brief = mockBrief(userInput);
    res.json({ brief });
  } catch (err) {
    console.error('extract-brief error:', err);
    res.status(500).json({ error: err.message || 'AI request failed', brief: mockBrief(req.body?.userInput || '') });
  }
});

app.post('/api/ai/answer-question', aiLimiter, async (req, res) => {
  try {
    const { question, showFacts, locale } = req.body || {};
    if (!question || typeof question !== 'string') {
      return res.status(400).json({ error: 'question is required' });
    }
    const facts = showFacts || '';
    let kbContext = '';
    try {
      const kb = await fetchKBArticles(locale || 'de', question);
      if (kb.length) kbContext = '\n\nPlatform context:\n' + kb.map((a) => `[${a.title}] ${a.content}`).join('\n\n');
    } catch (e) { /* ignore */ }
    const context = facts + kbContext;
    let text;
    if (useOpenAI) text = await openaiAnswerQuestion(question, context);
    else if (useGemini) text = await geminiAnswerQuestion(question, context);
    else text = mockAnswer();
    res.json({ text });
  } catch (err) {
    console.error('answer-question error:', err);
    res.status(500).json({ error: err.message || 'AI request failed', text: mockAnswer() });
  }
});

app.post('/api/ai/polish-text', aiLimiter, async (req, res) => {
  try {
    const { rawText, field, locale } = req.body || {};
    const validFields = ['shortDescriptionFacts', 'salesPitchText', 'artistBio'];
    if (!validFields.includes(field)) {
      return res.status(400).json({ error: 'field must be one of: shortDescriptionFacts, salesPitchText, artistBio' });
    }
    const loc = locale === 'en' ? 'en' : 'de';
    let polished;
    if (useOpenAI) polished = await openaiPolishText(rawText || '', field, loc);
    else if (useGemini) polished = await geminiPolishText(rawText || '', field, loc);
    else polished = (rawText || '').trim();
    res.json({ polishedText: polished });
  } catch (err) {
    console.error('polish-text error:', err);
    res.status(500).json({ error: err.message || 'AI request failed', polishedText: (rawText || '').trim() });
  }
});

app.post('/api/scrape-url', aiLimiter, async (req, res) => {
  try {
    const { url, locale } = req.body || {};
    if (!url || typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
      return res.status(400).json({ error: 'Valid URL required.' });
    }
    const extracted = await scrapeWebsiteForShow(url, locale || 'de');
    res.json({ ok: true, extracted });
  } catch (err) {
    console.error('scrape-url error:', err);
    res.status(500).json({ ok: false, error: err.message || 'Could not scrape URL.' });
  }
});

function scoreShows(shows, brief) {
  return shows
    .map((show) => {
      let score = 0;
      if (brief.desiredCategories?.includes(show.category)) score += 50;
      const vibeOverlap = brief.desiredVibes?.filter((v) => show.vibe_tags?.includes(v)) || [];
      score += vibeOverlap.length * 15;
      if (brief.languagePreference && show.language_options?.some((l) => l?.toLowerCase() === brief.languagePreference?.toLowerCase())) score += 10;
      if (brief.budgetMax && show.price_min && show.price_min <= brief.budgetMax) score += 20;
      return { show, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((item) => item.show);
}

const NOT_SPECIFIED = { de: 'nicht angegeben', en: 'not specified' };

function getMatchEvidence(show, brief, locale) {
  const why = [];
  const ns = locale === 'de' ? NOT_SPECIFIED.de : NOT_SPECIFIED.en;
  if (brief.desiredCategories?.includes(show.category)) why.push(locale === 'de' ? `Kategorie: ${show.category}` : `Category: ${show.category}`);
  const vibes = brief.desiredVibes?.filter((v) => (show.vibe_tags || []).includes(v));
  if (vibes?.length) why.push(locale === 'de' ? `Vibe: ${vibes.join(', ')}` : `Vibe: ${vibes.join(', ')}`);
  if (brief.languagePreference && (show.language_options || []).some((l) => l?.toLowerCase() === brief.languagePreference?.toLowerCase())) {
    why.push(locale === 'de' ? `Sprache: ${(show.language_options || []).join(', ')}` : `Language: ${(show.language_options || []).join(', ')}`);
  }
  if (brief.budgetMax) {
    if (show.price_min != null && show.price_min <= brief.budgetMax) why.push(locale === 'de' ? `Preis: ab ${show.price_min}€` : `Price: from ${show.price_min}€`);
    else if (show.price_min == null && show.price_max == null) why.push(locale === 'de' ? `Preis: ${ns}` : `Price: ${ns}`);
  }
  if (brief.durationMinutes != null) {
    if (show.duration_minutes != null && show.duration_minutes >= brief.durationMinutes) why.push(locale === 'de' ? `Dauer: ${show.duration_minutes} Min` : `Duration: ${show.duration_minutes} min`);
    else if (show.duration_minutes == null) why.push(locale === 'de' ? `Dauer: ${ns}` : `Duration: ${ns}`);
  }
  if (why.length === 0) why.push(locale === 'de' ? 'Passt zur Beschreibung' : 'Matches your description');
  return why;
}

const conversationStore = new Map();

function ensureContract(res) {
  const next = res.nextQuestion && typeof res.nextQuestion === 'object' ? res.nextQuestion : undefined;
  return {
    assistantMessage: res.assistantMessage || '',
    action: ['ASK_FOLLOWUP', 'SHOW_RESULTS', 'SAVE_SUBMISSION', 'NONE'].includes(res.action) ? res.action : 'NONE',
    statePatch: res.statePatch && typeof res.statePatch === 'object' ? res.statePatch : undefined,
    nextQuestion: next,
    quickReplies: Array.isArray(res.quickReplies) ? res.quickReplies : (next?.quickReplies && Array.isArray(next.quickReplies) ? next.quickReplies : undefined),
    recommendations: Array.isArray(res.recommendations) ? res.recommendations : undefined,
    errors: Array.isArray(res.errors) ? res.errors : undefined,
  };
}

const SCOPE_POLICY_AGENCY_DE = 'Scope: Nur Events, Shows, Künstler, Buchung in Berlin. Bei fremden Themen (Politik, Wetter, Allgemeinwissen): freundlich umleiten: "Ich helfe gerne bei Events und Shows in Berlin. Haben Sie ein bestimmtes Event im Sinn?"';
const SCOPE_POLICY_AGENCY_EN = 'Scope: Only events, shows, artists, booking in Berlin. For unrelated topics (politics, weather, general knowledge): politely redirect: "I\'d be happy to help with events and shows in Berlin. Do you have a specific event in mind?"';

async function openaiAgencyChat(messages, userMessage, locale) {
  const scopePolicy = locale === 'de' ? SCOPE_POLICY_AGENCY_DE : SCOPE_POLICY_AGENCY_EN;
  const basePrompt = locale === 'de'
    ? 'Du bist ein freundlicher Event-Concierge. Frage höchstens 1–2 kurze Folgefragen, wenn Infos fehlen (Budget, Datum, Stimmung). Antworte kurz. Bei genug Infos: "Perfekt, hier sind passende Shows."'
    : 'You are a friendly event concierge. Ask at most 1–2 short follow-up questions if info is missing (budget, date, vibe). Reply briefly. When you have enough: "Perfect, here are matching shows."';
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: `${basePrompt}\n\n${scopePolicy}` },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: userMessage },
    ],
  });
  return completion.choices[0]?.message?.content?.trim() ?? '';
}

async function geminiAgencyChat(messages, userMessage, locale) {
  const basePrompt = locale === 'de'
    ? 'Du bist ein freundlicher Event-Concierge. Frage höchstens 1–2 kurze Folgefragen, wenn Infos fehlen (Budget, Datum, Stimmung). Antworte kurz.'
    : 'You are a friendly event concierge. Ask at most 1–2 short follow-up questions if info is missing (budget, date, vibe). Reply briefly.';
  const scopePolicy = locale === 'de' ? SCOPE_POLICY_AGENCY_DE : SCOPE_POLICY_AGENCY_EN;
  const history = messages.map((m) => `${m.role}: ${m.content}`).join('\n');
  const response = await gemini.models.generateContent({
    model: 'gemini-1.5-flash',
    contents: `${basePrompt}\n${scopePolicy}\n\n${history}\n\nuser: ${userMessage}`,
  });
  return response.text?.trim() ?? '';
}

const SCOPE_POLICY_ARTIST_DE = 'Scope: Nur Show-Anmeldung, Künstler-Onboarding. Bei fremden Themen: "Ich helfe dir bei der Show-Anmeldung. Möchtest du weitermachen?"';
const SCOPE_POLICY_ARTIST_EN = 'Scope: Only show registration, artist onboarding. For off-topic: "I help with show registration. Would you like to continue?"';

// ── Producer Stage Detection ─────────────────────────────────────────────────
function getOnboardingStage(draft) {
  if (!draft.artistName && !draft.showTitle) return 'identify_artist';
  if (!draft.showTitle) return 'title_creation';
  if (!draft.shortDescriptionFacts || String(draft.shortDescriptionFacts).trim().length < 80) return 'description_generation';
  if (!draft.durationMinutes || !draft.submitterEmail) return 'show_details';
  return 'preview';
}

function getStageInstruction(stage, locale) {
  const de = {
    identify_artist: 'Finde heraus, wer dieser Künstler ist. Wenn eine URL im Text ist, lies sie sofort aus. Stelle eine warme, direkte Einstiegsfrage nach Name ODER Website — nicht beide.',
    title_creation: 'Schlage GENAU 3 Show-Titel-Optionen vor, die auf berlintina.de und in Eventplaner-Katalogen sofort Aufmerksamkeit erzeugen: (1) Mutig/Unerwartet — 2–4 Wörter, wirkt auf einem Plakat, erzeugt sofort ein Bild im Kopf, (2) Elegant/Verfeinert — Prestige-Positionierung für Galas und Corporate, klingt nach echtem Programm, (3) Namensbasiert — Künstlername als Anker, professionell und persönlich. Erkläre jede in einem Satz warum sie funktioniert. Gib alle drei IMMER im Feld titleOptions zurück.',
    description_generation: 'Schreibe jetzt die fertige Show-Beschreibung — bucherfähig, in Producer-Stimme, KEIN Formular-Stil. Struktur: (1) Ein starker Eröffnungssatz — konkret und sinnlich, zeigt das Gefühl im Raum wenn die Show beginnt, (2) Was auf der Bühne passiert — präzise, lebendig, spezifisch für genau diese Show, (3) 1–2 Sätze über den Künstler — Energie, Hintergrund, was ihn von anderen unterscheidet, (4) Praktisches: Format, Dauer, technischer Bedarf. Keine Buzzwords ("atemberaubend", "einzigartig") — zeig es statt es zu sagen. Trage das Ergebnis SOFORT in shortDescriptionFacts ein — mindestens 150 Zeichen.',
    show_details: 'Sammle praktische Details in Bündeln — niemals einzeln. Frage nach Dauer UND Preis in einer Nachricht. Dann nach E-Mail. Maximal 2 Fragen total.',
    preview: 'Fasse die komplette Show in einer sauberen Zusammenfassung auf. Stelle EINE holistische Abschlussfrage: "Gibt es etwas, das sich nicht wie du anfühlt?"',
  };
  const en = {
    identify_artist: 'Find out who this artist is. If a URL is in the message, read it immediately. Ask one warm, direct opening question — name OR website, not both.',
    title_creation: 'Propose EXACTLY 3 show title options that instantly grab attention in the Berlintina catalog and event planner searches: (1) Bold/Unexpected — 2–4 words, great on a poster, creates an immediate image in the mind, (2) Refined/Elegant — prestige-positioned for galas and corporate events, sounds like a real programme, (3) Name-driven — artist name as anchor, professional and personal. Explain in one sentence why each one works. ALWAYS return all three in the titleOptions field.',
    description_generation: 'Write the finished show description — booker-ready, in producer voice, NOT form style. Structure: (1) One strong opening sentence — concrete and sensory, make the planner feel the room when the show begins, (2) What happens on stage — precise, vivid, specific to this show only, (3) 1–2 sentences about the artist — energy, background, what sets them apart, (4) Practicalities: format, duration, technical needs. No buzzwords ("breathtaking", "unique", "unforgettable") — show it, don\'t say it. Store the result IMMEDIATELY in shortDescriptionFacts — minimum 150 characters.',
    show_details: 'Collect practical details in bundles — never one by one. Ask for duration AND price in one message. Then email. Maximum 2 questions total.',
    preview: 'Summarize the complete show in a clean overview. Ask ONE single holistic question: "Is there anything that doesn\'t feel like you?"',
  };
  return (locale === 'de' ? de : en)[stage] || (locale === 'de' ? de : en)['show_details'];
}

async function openaiArtistChat(formState, userMessage, locale, mode) {
  const scopePolicy = locale === 'de' ? SCOPE_POLICY_ARTIST_DE : SCOPE_POLICY_ARTIST_EN;
  const stage = getOnboardingStage(formState);
  const stageInstruction = getStageInstruction(stage, locale);

  // Build known-fields summary so AI never re-asks what it has
  const knownFields = Object.entries(formState)
    .filter(([k, v]) => v && !k.startsWith('_') && typeof v !== 'object' && typeof v !== 'undefined')
    .map(([k, v]) => `  ${k}: ${v}`)
    .join('\n');

  const systemPrompt = locale === 'de'
    ? `Du bist ein Top-Show-Producer für Berlintina — eine Premium-Event-Booking-Plattform in Berlin, gegründet von Valiantsina Förster.

Du bist KEIN Formular und KEIN Chatbot. Du bist ein kreativer Partner — ein erfahrener Show-Producer, der die besten Bühnen Europas kennt. Du siehst die Show, bevor der Künstler sie sieht, und führst ihn mit Wärme, Selbstvertrauen und Vision dorthin.

Frag NIE, was ein Formular fragen würde. Frag, was ein Producer fragen würde.

AKTUELLE PHASE: ${stage}
AUFGABE IN DIESER PHASE: ${stageInstruction}

BEREITS BEKANNT — frag das NICHT nochmal:
${knownFields || '  (noch nichts bekannt)'}

KERN-REGELN:
1. Frage nie nach Infos, die du bereits hast
2. Maximal 2 Fragen pro Nachricht
3. Bei "Ich weiß nicht" → mach einen konkreten Vorschlag, wiederhole die Frage NICHT
4. Passe Sprache und Ton dem Künstler an — casual wenn sie casual sind
5. Klingt wie der beste Producer, den der Künstler je getroffen hat
6. Keine Emojis, keine Icons, keine Ausrufezeichen-Ketten — schreib klar, konkret und mit echtem Respekt, wie ein Mensch, kein Marketing-Text

ANTWORTFORMAT (reines JSON, kein Markdown):
{
  "message": "Deine Antwort an den Künstler",
  "showTitle": "Titel falls bekannt oder ausgewählt",
  "salesPitchText": "Einzeiler/Tagline der Show für Eventplaner",
  "shortDescriptionFacts": "Vollständige Show-Beschreibung in Producer-Stimme (mindestens 100 Zeichen wenn Phase description_generation)",
  "artistGenre": "Genre",
  "priceText": "Preis",
  "durationMinutes": Zahl_oder_null,
  "artistBio": "Bio",
  "submitterEmail": "email@adresse.de",
  "titleOptions": ["Mutige Option", "Elegante Option", "Namensbasierte Option"]
}`
    : `You are a top show producer for Berlintina — a premium event booking platform in Berlin, founded by Valiantsina Förster.

You are NOT a form or a chatbot. You are a creative partner — a seasoned show producer who has worked the best stages in Europe. You see the show before the artist does and guide them there with warmth, confidence, and vision.

Never ask what a form would ask. Ask what a producer would ask.

CURRENT STAGE: ${stage}
TASK FOR THIS STAGE: ${stageInstruction}

ALREADY KNOWN — do NOT ask for these again:
${knownFields || '  (nothing known yet)'}

CORE RULES:
1. Never ask for info you already have
2. Maximum 2 questions per message
3. When artist says "I don't know" → make a concrete proposal, do NOT repeat the question
4. Match artist's language and tone — casual if they're casual
5. Sound like the best producer the artist has ever met
6. No emojis, no icons, no exclamation-mark chains — write clear, concrete, with genuine respect, like a person, not marketing copy

RESPONSE FORMAT (pure JSON, no markdown):
{
  "message": "Your reply to the artist",
  "showTitle": "title if known or selected",
  "salesPitchText": "one-liner/tagline for event planners",
  "shortDescriptionFacts": "complete show description in producer voice (at least 100 chars if stage is description_generation)",
  "artistGenre": "genre",
  "priceText": "price",
  "durationMinutes": number_or_null,
  "artistBio": "bio",
  "submitterEmail": "email@address.com",
  "titleOptions": ["Bold option", "Refined option", "Name-driven option"]
}`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: `${systemPrompt}\n\n${scopePolicy}` },
      { role: 'user', content: `Current form state: ${JSON.stringify(formState)}\n\nArtist says: ${userMessage}` },
    ],
    response_format: { type: 'json_object' },
  });
  const text = completion.choices[0]?.message?.content ?? '{}';
  try {
    const parsed = JSON.parse(text);
    const msg = parsed.message || parsed.assistantMessage || parsed.reply;
    const updates = { ...parsed, message: undefined, assistantMessage: undefined, reply: undefined };
    const displayMsg = (typeof msg === 'string' && msg.trim() && !msg.trim().startsWith('{'))
      ? msg
      : '';
    return { assistantMessage: displayMsg, suggestedFieldUpdates: updates };
  } catch {
    const displayMsg = (typeof text === 'string' && text.trim() && !text.trim().startsWith('{'))
      ? text
      : '';
    return { assistantMessage: displayMsg, suggestedFieldUpdates: {} };
  }
}

// Words that describe MEDIUM (not theme) — for slot-repair when user says "Musik" at theme question
const MEDIUM_KEYWORDS = /^(musik|music|tanz|dance|theater|theatre|akrobatik|acrobatics|comedy|komödie|zauberei|magic|jonglage|juggling|puppet|puppenspiel|circus|zirkus|varieté|variety)$/i;

function looksLikeMedium(text) {
  const t = (text || '').toLowerCase().trim();
  if (MEDIUM_KEYWORDS.test(t)) return true;
  if (t.length <= 25 && /musik|tanz|theater|akrobatik|comedy|magic|jonglage|circus|varieté/i.test(t)) return true;
  return false;
}

// Skip phrases: user doesn't want to answer (optional slot or move on)
function isSkipPhrase(text) {
  const t = (text || '').toLowerCase().trim();
  return /^(überspringen|skip|später|later|hab (ich )?nicht|keine?|will nicht|optional|egal)$/i.test(t) || /^(noch nicht|not yet|pass)$/i.test(t);
}

// Global extraction from any user message (email, instagram, website) — merge into draft
function extractContactIntoDraft(draft, userMessage) {
  if (!userMessage || typeof userMessage !== 'string') return draft;
  const msg = userMessage.trim();
  const out = { ...draft };
  const emailMatch = msg.match(/[^\s@]+@[^\s@]+\.[^\s@]+/);
  if (emailMatch && !out.submitterEmail) out.submitterEmail = emailMatch[0];
  const instagramMatch = msg.match(/(?:instagram\.com\/|@)([a-zA-Z0-9_.]+)/i);
  if (instagramMatch) {
    const handle = instagramMatch[1].replace(/^@/, '');
    const igPart = handle.startsWith('@') ? handle : `@${handle}`;
    out.socialLinks = out.socialLinks ? `${out.socialLinks} ${igPart}` : igPart;
  }
  const urlMatch = msg.match(/https?:\/\/[^\s]+/);
  if (urlMatch && !out.socialLinks?.includes(urlMatch[0])) {
    const url = urlMatch[0].replace(/[.,;:!?)]+$/, '');
    out.socialLinks = out.socialLinks ? `${out.socialLinks} ${url}` : url;
  }
  return out;
}

// Parse mediaLinks string into photoUrls and videoUrls (video hosts / extensions)
function parseMediaLinksIntoUrls(mediaLinksStr) {
  const urls = (mediaLinksStr || '').split(/[\s,]+/).filter(Boolean);
  const photoUrls = [];
  const videoUrls = [];
  const videoHosts = /youtube|youtu\.be|vimeo|dailymotion|\.mp4|\.webm|\.mov/i;
  for (const u of urls) {
    if (videoHosts.test(u)) videoUrls.push(u);
    else photoUrls.push(u);
  }
  return { photoUrls, videoUrls };
}

// Deterministic next question from state (no AI). Used for OpenAI/Gemini so next slot is always from state machine.
function getNextArtistQuestion(draft, loc, mode) {
  const readyToSave = () => {
    const hasEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(draft.submitterEmail || '').trim());
    const hasTitle = typeof draft.showTitle === 'string' && draft.showTitle.trim().length > 0;
    const hasArtistName = typeof draft.artistName === 'string' && draft.artistName.trim().length > 0;
    return hasEmail && hasTitle && hasArtistName;
  };

  if (mode === 'BRAINSTORM_SHOW') {
    const stepIndex = Math.min(draft._brainstormStep != null ? draft._brainstormStep : 0, BRAINSTORM_STEPS.length);
    if (stepIndex >= BRAINSTORM_STEPS.length) {
      const hasEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(draft.submitterEmail || '').trim());
      const hasTitle = typeof draft.showTitle === 'string' && draft.showTitle.trim().length > 0;
      if (hasEmail && hasTitle) {
        return { nextQuestion: undefined, readyToSave: true };
      }
      return {
        nextQuestion: { slot: 'submitterEmail', text: loc === 'de' ? 'E-Mail (optional)' : 'Email (optional)' },
        readyToSave: false,
      };
    }
    const step = BRAINSTORM_STEPS[stepIndex];
    const nextQ = { slot: step.slot, text: loc === 'de' ? step.de : step.en };
    if (step.slot === 'mediaLinks') nextQ.showMediaInput = true;
    if (step.optional) nextQ.quickReplies = loc === 'de' ? ['Überspringen'] : ['Skip'];
    return { nextQuestion: nextQ, readyToSave: false };
  }

  if (mode === 'EXISTING_SHOW') {
    const missing = HAS_SHOW_SLOTS.filter((s) => {
      if (s.optional && (draft._skippedSlots || []).includes(s.slot)) return false;
      const v = draft[s.slot];
      return (s.slot === 'submitterEmail' ? !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '')) : !v || String(v).trim() === '');
    });
    const next = missing[0];
    if (!next) {
      return { nextQuestion: undefined, readyToSave: readyToSave() };
    }
    const nextQ = {
      slot: next.slot,
      text: loc === 'de' ? next.de : next.en,
      showMediaInput: next.slot === 'mediaLinks',
    };
    if (next.slot === 'websiteUrl') nextQ.quickReplies = loc === 'de' ? ['Überspringen'] : ['Skip'];
    if (next.slot === 'mediaLinks') nextQ.quickReplies = loc === 'de' ? ['Link einfügen', 'Überspringen'] : ['Add link', 'Skip'];
    if (next.slot === 'socialLinks') nextQ.quickReplies = loc === 'de' ? ['Instagram/Website', 'Überspringen'] : ['Instagram/website', 'Skip'];
    // Use AI-proposed title options as quick replies when at showTitle slot
    if (next.slot === 'showTitle' && Array.isArray(draft.titleOptions) && draft.titleOptions.length) {
      nextQ.quickReplies = draft.titleOptions;
    }
    if (next.optional && !nextQ.quickReplies) nextQ.quickReplies = loc === 'de' ? ['Überspringen'] : ['Skip'];
    return { nextQuestion: nextQ, readyToSave: false };
  }

  return { nextQuestion: undefined, readyToSave: readyToSave() };
}

// NO_SHOW brainstorm steps (state machine); last two optional (media, artist links)
const BRAINSTORM_STEPS = [
  { slot: 'brainstorm_intro', de: 'Super, dann lass uns gemeinsam eine Show-Idee entwickeln. Worum soll es thematisch gehen?', en: 'Great, let\'s develop a show idea together. What should it be about thematically?' },
  { slot: 'brainstorm_medium', de: 'Welches Medium oder welche Kunstform? (z.B. Musik, Tanz, Akrobatik, Theater)', en: 'What medium or art form? (e.g. music, dance, acrobatics, theatre)' },
  { slot: 'brainstorm_effect', de: 'Welche Wirkung soll die Show haben? (z.B. unterhaltsam, berührend, überraschend)', en: 'What effect should the show have? (e.g. entertaining, moving, surprising)' },
  { slot: 'brainstorm_constraints', de: 'Gibt es Rahmenbedingungen? (Dauer, Raum, Technik, Publikum)', en: 'Any constraints? (duration, space, tech, audience)' },
  { slot: 'brainstorm_unique', de: 'Was macht die Idee unverwechselbar? Dein besonderer Twist.', en: 'What makes the idea unique? Your special twist.' },
  { slot: 'mediaLinks', de: 'Hast du Fotos oder Videos (Links)? Optional.', en: 'Do you have photos or videos (links)? Optional.', optional: true },
  { slot: 'socialLinks', de: 'Wo findet man dich? (Instagram, Website) Optional.', en: 'Where can people find you? (Instagram, website) Optional.', optional: true },
];

// HAS_SHOW steps (new order: name → website → show info → FAQ → media → contact)
const HAS_SHOW_SLOTS = [
  { slot: 'artistName', de: 'Wie lautet dein Künstlername oder der Name deiner Gruppe?', en: 'What is your artist name or group name?' },
  { slot: 'websiteUrl', de: 'Hast du eine Website oder einen Link zu deinem Auftritt? (optional – überspringen ist ok)', en: 'Do you have a website or link to your act? (optional – skipping is fine)', optional: true },
  { slot: 'showTitle', de: 'Wie heißt deine Show?', en: 'What is the name of your show?' },
  { slot: 'shortDescriptionFacts', de: 'Beschreibe deine Show in 2–3 Sätzen: Worum geht es, was macht sie besonders?', en: 'Describe your show in 2–3 sentences: what is it about, what makes it special?' },
  { slot: 'salesPitchText', de: 'Ein Satz, der Eventplaner sofort begeistert — dein Show-Einzeiler:', en: 'One sentence that instantly excites event planners — your show one-liner:', optional: true },
  { slot: 'artistGenre', de: 'Welches Genre oder welche Kunstform? (z.B. Klassik, Akrobatik, Tanz, Band)', en: 'What genre or art form? (e.g. classical, acrobatics, dance, band)' },
  { slot: 'priceText', de: 'In welchem Preisrahmen? z.B. "ab 800€" (optional – überspringen möglich)', en: 'What is the price range? e.g. "from 800€" (optional – you can skip)', optional: true },
  { slot: 'durationMinutes', de: 'Wie lange dauert die Show in Minuten? (optional)', en: 'How long is the show in minutes? (optional)', optional: true },
  { slot: 'artistBio', de: 'Kurze Vorstellung: Wer bist du, was macht dich besonders? (optional)', en: 'Short intro: who are you, what makes you special? (optional)', optional: true },
  { slot: 'faqOutdoor', de: 'Ist die Show auch outdoor möglich? (optional – kannst du überspringen)', en: 'Is the show possible outdoors? (optional – you can skip)', optional: true },
  { slot: 'faqStage', de: 'Wie groß muss die Bühne mindestens sein? (optional)', en: 'What is the minimum stage size needed? (optional)', optional: true },
  { slot: 'faqLanguage', de: 'Ist die Show sprachabhängig – und wenn ja, welche Sprachen? (optional)', en: 'Is the show language-dependent – and if so, which languages? (optional)', optional: true },
  { slot: 'faqCustom', de: 'Kann die Show angepasst werden, z.B. Branding oder Theme? (optional)', en: 'Can the show be customized, e.g. branding or theme? (optional)', optional: true },
  { slot: 'faqTravel', de: 'Reist du für die Show an? Wo bist du ansässig? (optional)', en: 'Do you travel for the show? Where are you based? (optional)', optional: true },
  { slot: 'mediaLinks', de: 'Hast du Fotos oder Video-Links? (optional)', en: 'Do you have photos or video links? (optional)', optional: true },
  { slot: 'socialLinks', de: 'Instagram oder weitere Links? (optional)', en: 'Instagram or other links? (optional)', optional: true },
  { slot: 'submitterEmail', de: 'Unter welcher E-Mail können wir dich für Buchungsanfragen erreichen?', en: 'What email can we reach you at for booking requests?' },
];

function mockArtistChat(form, userMessage, loc, mode) {
  const draft = { ...form };
  const lower = userMessage.toLowerCase().trim();
  const emailMatch = userMessage.match(/[^\s@]+@[^\s@]+\.[^\s@]+/);
  if (emailMatch) draft.submitterEmail = emailMatch[0];
  const numMatch = userMessage.match(/\d+/);
  if (numMatch && (lower.includes('min') || lower.includes('minute'))) draft.durationMinutes = parseInt(numMatch[0], 10);
  if (numMatch && (lower.includes('€') || lower.includes('eur') || lower.includes('euro') || lower.includes('preis') || lower.includes('price'))) draft.priceText = userMessage.trim();
  if (userMessage.length > 30 && !draft.shortDescriptionFacts) draft.shortDescriptionFacts = userMessage.trim();
  if (userMessage.length >= 2 && userMessage.length < 100 && !draft.showTitle && !lower.includes('@')) draft.showTitle = userMessage.trim();

  // NO_SHOW / BRAINSTORM path: use brainstorm steps, not "describe your show"
  if (mode === 'BRAINSTORM_SHOW') {
    // Slot-repair: user said "Musik" (etc.) at theme question → ask if they meant medium
    if (draft._slotRepair) {
      const lower = userMessage.toLowerCase().trim();
      const yesRepair = /^ja\b|yes|genau|richtig|medium\s*=\s*\w+/i.test(lower) || lower.startsWith('ja,');
      const noRepair = /^nein\b|no\b|thema\s+ist/i.test(lower) || lower.startsWith('nein,');
      const repairValue = draft._slotRepair.value || '';
      if (yesRepair) {
        draft.brainstorm_medium = repairValue;
        draft._brainstormStep = 2;
        delete draft._slotRepair;
        const step = BRAINSTORM_STEPS[2];
        return {
          assistantMessage: loc === 'de' ? step.de : step.en,
          suggestedFieldUpdates: draft,
          nextQuestion: { slot: step.slot, text: loc === 'de' ? step.de : step.en },
        };
      }
      if (noRepair) {
        draft.brainstorm_intro = repairValue;
        draft._brainstormStep = 1;
        delete draft._slotRepair;
        const step = BRAINSTORM_STEPS[1];
        return {
          assistantMessage: loc === 'de' ? step.de : step.en,
          suggestedFieldUpdates: draft,
          nextQuestion: { slot: step.slot, text: loc === 'de' ? step.de : step.en, quickReplies: loc === 'de' ? ['Musik', 'Tanz', 'Theater', 'Akrobatik'] : ['Music', 'Dance', 'Theatre', 'Acrobatics'] },
        };
      }
    }

    const stepIndex = Math.min(draft._brainstormStep != null ? draft._brainstormStep + 1 : 0, BRAINSTORM_STEPS.length);
    draft._brainstormStep = stepIndex;
    if (stepIndex < BRAINSTORM_STEPS.length) {
      const step = BRAINSTORM_STEPS[stepIndex];
      // Slot-repair: at step 1 we just got the answer to step 0 (theme). If it looks like a medium, offer repair.
      if (stepIndex === 1 && looksLikeMedium(userMessage)) {
        draft._brainstormStep = 0;
        draft._slotRepair = { value: userMessage.trim() };
        const repairDe = `Meinst du „${userMessage.trim()}“ als Medium (Kunstform)? Dann trage ich das so ein.`;
        const repairEn = `Do you mean "${userMessage.trim()}" as the medium (art form)? I'll enter it that way.`;
        return {
          assistantMessage: loc === 'de' ? repairDe : repairEn,
          suggestedFieldUpdates: draft,
          nextQuestion: {
            slot: 'slot_repair_medium',
            text: loc === 'de' ? repairDe : repairEn,
            quickReplies: loc === 'de' ? ['Ja, Medium = ' + userMessage.trim(), 'Nein, Thema ist …'] : ['Yes, medium = ' + userMessage.trim(), 'No, theme is …'],
          },
        };
      }
      if (stepIndex > 0 && step.optional && isSkipPhrase(userMessage)) {
        draft[step.slot] = null;
        draft._brainstormStep = stepIndex + 1;
        const nextStep = BRAINSTORM_STEPS[stepIndex + 1];
        if (nextStep) {
          const nextQ = { slot: nextStep.slot, text: loc === 'de' ? nextStep.de : nextStep.en };
          if (nextStep.slot === 'mediaLinks') nextQ.showMediaInput = true;
          if (nextStep.optional) nextQ.quickReplies = loc === 'de' ? ['Überspringen'] : ['Skip'];
          return {
            assistantMessage: loc === 'de' ? 'Alles klar, weiter.' : 'Sure, moving on.',
            suggestedFieldUpdates: draft,
            nextQuestion: nextQ,
          };
        }
      }
      const nextQuestion = { slot: step.slot, text: loc === 'de' ? step.de : step.en };
      if (step.slot === 'mediaLinks') nextQuestion.showMediaInput = true;
      if (step.optional) nextQuestion.quickReplies = loc === 'de' ? ['Überspringen'] : ['Skip'];
      return {
        assistantMessage: loc === 'de' ? step.de : step.en,
        suggestedFieldUpdates: draft,
        nextQuestion,
      };
    }
    return {
      assistantMessage: loc === 'de' ? 'Danke, das reicht für eine erste Idee! Wir erstellen daraus einen Entwurf. Unter welcher E-Mail können wir dich erreichen?' : 'Thanks, that\'s enough for a first idea! We\'ll create a draft. What email can we reach you at?',
      suggestedFieldUpdates: { ...draft, _brainstormDone: true },
      nextQuestion: { slot: 'submitterEmail', text: loc === 'de' ? 'E-Mail (optional)' : 'Email (optional)' },
    };
  }

  // HAS_SHOW path
  const asked = draft._askedSlots || [];
  const missing = HAS_SHOW_SLOTS.filter((s) => {
    if (s.optional && (draft._skippedSlots || []).includes(s.slot)) return false;
    const v = draft[s.slot];
    return (s.slot === 'submitterEmail' ? !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '')) : !v || String(v).trim() === '');
  });
  const next = missing[0];
  if (next) {
    if (next.optional && isSkipPhrase(userMessage)) {
      draft._skippedSlots = [...new Set([...(draft._skippedSlots || []), next.slot])];
      const after = missing.slice(1)[0];
      draft._askedSlots = [...new Set([...asked, next.slot, ...(after ? [after.slot] : [])])];
      if (after) {
        return {
          assistantMessage: loc === 'de' ? 'Alles klar, weiter.' : 'Sure, moving on.',
          suggestedFieldUpdates: draft,
          nextQuestion: {
            slot: after.slot,
            text: loc === 'de' ? after.de : after.en,
            showMediaInput: after.slot === 'mediaLinks',
          },
        };
      }
    }
    draft._askedSlots = [...new Set([...asked, next.slot])];
    const nextQ = {
      slot: next.slot,
      text: loc === 'de' ? next.de : next.en,
      showMediaInput: next.slot === 'mediaLinks',
    };
    if (next.slot === 'mediaLinks') nextQ.quickReplies = loc === 'de' ? ['Link einfügen', 'Überspringen'] : ['Add link', 'Skip'];
    if (next.slot === 'socialLinks') nextQ.quickReplies = loc === 'de' ? ['Instagram/Website', 'Überspringen'] : ['Instagram/website', 'Skip'];
    return {
      assistantMessage: loc === 'de' ? next.de : next.en,
      suggestedFieldUpdates: draft,
      nextQuestion: nextQ,
    };
  }
  return {
    assistantMessage: loc === 'de' ? 'Perfekt, das reicht! Ich sende deine Angaben jetzt weiter.' : 'Perfect, that\'s enough! I\'ll submit your info now.',
    suggestedFieldUpdates: draft,
  };
}

async function geminiArtistChat(formState, userMessage, locale, mode) {
  const scopePolicy = locale === 'de' ? SCOPE_POLICY_ARTIST_DE : SCOPE_POLICY_ARTIST_EN;
  const modeHint = mode === 'EXISTING_SHOW'
    ? (locale === 'de' ? 'Künstler hat fertige Show. Extrahiere: showTitle, shortDescriptionFacts, artistGenre, priceText, durationMinutes, artistBio, submitterEmail.' : 'Artist has existing show. Extract: showTitle, shortDescriptionFacts, artistGenre, priceText, durationMinutes, artistBio, submitterEmail.')
    : (locale === 'de' ? 'Künstler brainstormt. Frage 1–2 kurze Fragen, extrahiere: artistGenre, showTitle, shortDescriptionFacts, priceText, durationMinutes, artistBio, submitterEmail.' : 'Artist brainstorming. Ask 1–2 short questions, extract: artistGenre, showTitle, shortDescriptionFacts, priceText, durationMinutes, artistBio, submitterEmail.');
  const baseContent = locale === 'de'
    ? `Hilf dem Künstler. Formular: ${JSON.stringify(formState)}\n\nKünstler: ${userMessage}\n\nAntworte kurz. JSON: { "message": "Deine Antwort", "showTitle": "...", "shortDescriptionFacts": "...", "artistGenre": "...", "priceText": "...", "durationMinutes": number, "artistBio": "...", "submitterEmail": "..." }. ${modeHint}`
    : `Help the artist. Form: ${JSON.stringify(formState)}\n\nArtist: ${userMessage}\n\nReply briefly. JSON: { "message": "Your reply", "showTitle": "...", "shortDescriptionFacts": "...", "artistGenre": "...", "priceText": "...", "durationMinutes": number, "artistBio": "...", "submitterEmail": "..." }. ${modeHint}`;
  const response = await gemini.models.generateContent({
    model: 'gemini-1.5-flash',
    contents: `${baseContent}\n${scopePolicy}`,
    config: { responseMimeType: 'application/json' },
  });
  const text = response.text ?? '{}';
  try {
    const parsed = JSON.parse(text);
    const msg = parsed.message || parsed.assistantMessage || parsed.reply;
    const updates = { ...parsed, message: undefined, assistantMessage: undefined, reply: undefined };
    // Never show raw JSON to user; use empty so handler uses nextQ.text
    const displayMsg = (typeof msg === 'string' && msg.trim() && !msg.trim().startsWith('{'))
      ? msg
      : '';
    return { assistantMessage: displayMsg, suggestedFieldUpdates: updates };
  } catch {
    const displayMsg = (typeof text === 'string' && text.trim() && !text.trim().startsWith('{'))
      ? text
      : '';
    return { assistantMessage: displayMsg, suggestedFieldUpdates: {} };
  }
}

// --- EPIC 3: Conversation API (strict contract) ---
app.post('/api/conversation/start', aiLimiter, async (req, res) => {
  const reqId = req.requestId;
  const start = Date.now();
  try {
    const { type, locale } = req.body || {};
    const loc = locale === 'en' ? 'en' : 'de';
    const conversationId = `conv_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    let greeting, response;
    // For ARTIST we keep an explicit initial state so we don't reference an undefined variable later
    let initialStateArtist = null;
    if (type === 'AGENCY') {
      greeting = loc === 'de' ? 'Hallo! Beschreiben Sie Ihr Event — Datum, Budget, Stimmung, Gästezahl. Ich finde passende Shows.' : 'Hi! Describe your event — date, budget, vibe, guest count. I\'ll find matching shows.';
      response = ensureContract({
        assistantMessage: greeting,
        action: 'NONE',
        nextQuestion: { slot: 'event_description', text: greeting, quickReplies: loc === 'de' ? ['Gala Berlin', 'Hochzeit 80 Gäste', 'Corporate Event'] : ['Gala Berlin', 'Wedding 80 guests', 'Corporate event'] },
      });
    } else if (type === 'ARTIST') {
      const { returningArtist, artistToken } = req.body || {};
      if (returningArtist) {
        // Fetch how many shows this artist already has
        let existingShowCount = 0;
        if (supabase && artistToken && typeof artistToken === 'string') {
          const tokenHash = hashToken(artistToken.trim());
          const account = await findArtistByTokenHash(tokenHash);
          if (account?.id) {
            const { count } = await supabase.from('shows').select('id', { count: 'exact', head: true }).eq('artist_account_id', account.id).eq('status', 'PUBLISHED');
            existingShowCount = count || 0;
          }
        }
        const countNote = existingShowCount > 0
          ? (loc === 'de' ? ` Du hast bereits ${existingShowCount} Show${existingShowCount > 1 ? 's' : ''} auf Berlintina.` : ` You already have ${existingShowCount} show${existingShowCount > 1 ? 's' : ''} on Berlintina.`)
          : '';
        greeting = loc === 'de'
          ? `Willkommen zurück!${countNote} Ich helfe dir, eine weitere Show einzutragen. Wie lautet der Titel?`
          : `Welcome back!${countNote} I'll help you add another show. What is the title?`;
        response = ensureContract({
          assistantMessage: greeting,
          action: 'ASK_FOLLOWUP',
          nextQuestion: {
            slot: 'showTitle',
            text: loc === 'de' ? 'Wie lautet der Titel deiner Show?' : 'What is the title of your show?',
          },
        });
        initialStateArtist = {
          joinState: 'HAS_SHOW_TITLE',
          intent: 'HAS_SHOW',
          mode: 'EXISTING_SHOW',
          lastSlot: 'showTitle',
          askedQuestionIds: [],
        };
      } else {
        greeting = loc === 'de'
          ? 'Hallo, ich bin Valiantsinas KI-Producer. Schreib mir einfach, was du machst — egal ob eine fertige Show, dein erster Auftritt, oder nur eine Idee, die noch keine feste Form hat.\n\nHast du eine Website? Dann schick sie mir, ich lese sie automatisch aus. Sonst reicht auch: Wie heißt du, und was hast du im Kopf?'
          : "Hello, I'm Valiantsina's AI producer. Just write what you do — a finished show, your first performance, or just an idea that doesn't have a fixed shape yet.\n\nDo you have a website? Send it and I'll read it automatically. Otherwise: what's your name, and what do you have in mind?";
        response = ensureContract({
          assistantMessage: greeting,
          action: 'ASK_FOLLOWUP',
          nextQuestion: {
            slot: 'artistName',
            text: loc === 'de' ? 'Wie lautet dein Künstlername?' : 'What is your artist name?',
          },
        });
        initialStateArtist = { joinState: 'HAS_SHOW', intent: 'HAS_SHOW', mode: 'EXISTING_SHOW', lastSlot: 'artistName', askedQuestionIds: [] };
      }
    } else {
      return res.status(400).json({ error: 'type must be AGENCY or ARTIST' });
    }

    const initialState =
      type === 'ARTIST'
        ? (initialStateArtist || { joinState: 'INTENT', askedQuestionIds: [] })
        : {};
    conversationStore.set(conversationId, { type, locale: loc, state: initialState, createdAt: Date.now() });
    console.log(JSON.stringify({ requestId: reqId, conversationId, route: 'conversation/start', action: response.action, latency: Date.now() - start }));
    res.json({ conversationId, greeting, response });
  } catch (err) {
    console.error(JSON.stringify({ requestId: reqId, route: 'conversation/start', error: err.message, latency: Date.now() - start }));
    res.status(500).json({ error: err.message || 'Request failed' });
  }
});

app.post('/api/conversation/message', aiLimiter, async (req, res) => {
  const reqId = req.requestId;
  const start = Date.now();
  try {
    const { conversationId, userMessage, state, action: bodyAction, value: bodyValue } = req.body || {};
    if (!conversationId || typeof userMessage !== 'string') {
      return res.status(400).json({ error: 'conversationId and userMessage required' });
    }
    const conv = conversationStore.get(conversationId);
    const loc = conv?.locale || 'de';
    const type = conv?.type || 'AGENCY';
    const mergedState = { ...(conv?.state || {}), ...(state && typeof state === 'object' ? state : {}) };
    // ARTIST: backend's accumulated submissionDraft is source of truth (frontend can be stale due to async setState)
    if (type === 'ARTIST' && (conv?.state?.submissionDraft || state?.submissionDraft)) {
      mergedState.submissionDraft = { ...(state?.submissionDraft || {}), ...(conv?.state?.submissionDraft || {}) };
    }
    let lastSlotIn = null; // Phase 0 diagnostic (set in ARTIST branch)

    let response;

    if (type === 'AGENCY') {
      let brief;
      try {
        if (useOpenAI) brief = await openaiExtractBrief(userMessage);
        else if (useGemini) brief = await geminiExtractBrief(userMessage);
        else brief = mockBrief(userMessage);
      } catch (e) {
        brief = mockBrief(userMessage);
      }
      const hasEnoughToSearch = (brief.desiredCategories?.length || brief.desiredVibes?.length || brief.eventType || (brief.extraNotes && brief.extraNotes.length > 10));
      const needsFollowUp = !hasEnoughToSearch;
      let assistantMessage;
      if (useOpenAI) assistantMessage = await openaiAgencyChat([{ role: 'user', content: userMessage }], userMessage, loc);
      else if (useGemini) assistantMessage = await geminiAgencyChat([{ role: 'user', content: userMessage }], userMessage, loc);
      else assistantMessage = needsFollowUp
        ? (loc === 'de' ? 'Können Sie mir Budget, Datum und gewünschte Stimmung nennen?' : 'Can you tell me budget, date, and desired vibe?')
        : (loc === 'de' ? 'Perfekt, hier sind passende Shows.' : 'Perfect, here are matching shows.');

      let recommendations = [];
      if (hasEnoughToSearch && supabase) {
        let q = supabase.from('shows').select(OEFFENTLICHE_SHOW_SPALTEN).eq('status', 'PUBLISHED');
        if (brief.desiredCategories?.length) {
          q = q.in('category', brief.desiredCategories);
        }
        if (brief.budgetMax != null && brief.budgetMax > 0) {
          q = q.or(`price_min.is.null,price_min.lte.${brief.budgetMax}`);
        }
        if (brief.durationMinutes != null && brief.durationMinutes > 0) {
          const maxDur = Math.max(120, brief.durationMinutes + 60);
          q = q.lte('duration_minutes', maxDur);
        }
        const { data: rows } = await q;
        const shows = rows || [];
        const scored = scoreShows(shows, brief);
        recommendations = scored.slice(0, 6).map((s) => ({ showId: s.id, why: getMatchEvidence(s, brief, loc) }));
      }

      response = ensureContract({
        assistantMessage,
        action: needsFollowUp ? 'ASK_FOLLOWUP' : 'SHOW_RESULTS',
        statePatch: { brief },
        nextQuestion: needsFollowUp ? { slot: 'budget_date_vibe', text: assistantMessage } : undefined,
        recommendations: recommendations.length ? recommendations : undefined,
      });
      mergedState.brief = brief;
    } else {
      lastSlotIn = mergedState.lastSlot;
      let form = mergedState.submissionDraft || {};
      const lastSlot = mergedState.lastSlot;
      // Global extraction (email, instagram, URL) from every message
      form = extractContactIntoDraft(form, userMessage);

      // Auto-scrape website: triggers on websiteUrl slot OR any non-media URL in any message (once per session)
      let scrapeMessage = null;
      let scrapedLastSlot = false; // true if the website scraper just found a proper value for `lastSlot` this turn
      const urlInMessage = (userMessage.match(/https?:\/\/[^\s]+/) || [])[0]?.replace(/[.,;:!?)]+$/, '');
      const isMediaUrl = urlInMessage && /youtube|youtu\.be|vimeo|\.mp4|\.webm|\.mov/i.test(urlInMessage);
      const isWebsiteSlot = lastSlot === 'websiteUrl';
      if (urlInMessage && !isMediaUrl && !mergedState.urlScraped && (isWebsiteSlot || true)) {
        mergedState.urlScraped = true;
        try {
          const scraped = await scrapeWebsiteForShow(urlInMessage, loc);
          scrapedLastSlot = !!(lastSlot && scraped[lastSlot]);
          // Merge scraped fields without overwriting already-filled fields
          const mergedForm = { ...scraped };
          for (const [k, v] of Object.entries(form)) {
            if (v !== null && v !== undefined && v !== '') mergedForm[k] = v;
          }
          form = mergedForm;
          mergedState.submissionDraft = form;
          const foundFields = Object.keys(scraped).filter(k => scraped[k] && k !== 'photoUrls');
          const fieldLabels = { artistName: { de: 'Name', en: 'name' }, showTitle: { de: 'Titel', en: 'title' }, shortDescriptionFacts: { de: 'Beschreibung', en: 'description' }, artistBio: { de: 'Bio', en: 'bio' }, artistGenre: { de: 'Genre', en: 'genre' }, priceText: { de: 'Preis', en: 'price' }, durationMinutes: { de: 'Dauer', en: 'duration' }, socialLinks: { de: 'Links', en: 'links' }, faqLanguage: { de: 'Sprachen', en: 'languages' } };
          if (foundFields.length > 0) {
            const labelList = foundFields.map(k => (fieldLabels[k]?.[loc] || k)).join(', ');
            const artistHint = scraped.artistName ? ` (${scraped.artistName})` : '';
            if (!scraped.showTitle) {
              // General artist website — no show title found, ask specifically
              scrapeMessage = loc === 'de'
                ? `Website ausgelesen${artistHint}. Gefunden: ${labelList}.\n\nSchau mal rechts — so sieht deine Seite schon aus.\n\nNoch eine Frage: Wie heißt die konkrete Show, die du listen möchtest? (z.B. "Solo-Abend", "Duo Act")`
                : `Website analyzed${artistHint}. Found: ${labelList}.\n\nCheck the right side — that's how your page already looks.\n\nOne question: What's the specific show you want to list? (e.g. "Solo Evening", "Duo Act")`;
            } else {
              scrapeMessage = loc === 'de'
                ? `Ich hab deine Website gelesen${artistHint}.\n\nSchau mal rechts — so sieht deine Show-Seite schon aus. Übernommen: ${labelList}.\n\nFehlt noch etwas oder passt alles?`
                : `I read your website${artistHint}.\n\nLook to the right — that's how your show page already looks. Imported: ${labelList}.\n\nAnything missing or does it all look good?`;
            }
          } else {
            scrapeMessage = loc === 'de'
              ? `Ich habe deine Website geladen, konnte aber keine Show-Infos auslesen. Kein Problem — beschreib deine Show kurz und die Vorschau rechts füllt sich mit deinen Antworten!`
              : `I loaded your website but couldn't extract show info. No problem — describe your show briefly and the preview on the right will fill up with your answers!`;
          }
        } catch (e) {
          // Scraping failed silently — continue normal flow
        }
      }

      // Store user's reply into the slot we asked for last (AI can override via suggestedFieldUpdates)
      const useAI = useOpenAI || useGemini;
      const trimmedMsg = (typeof userMessage === 'string' ? userMessage : '').trim();
      const isPlaceholderQuickReply = /^(Link einfügen|Add link)$/i.test(trimmedMsg)
        || /^(Instagram\/Website|Instagram\/website)$/i.test(trimmedMsg);
      // Handle skip phrases for optional slots — return early to avoid AI storing "Überspringen" as a value
      const currentSlotDef = HAS_SHOW_SLOTS.find(s => s.slot === lastSlot);
      if (lastSlot && isSkipPhrase(trimmedMsg) && currentSlotDef?.optional) {
        form._skippedSlots = [...new Set([...(form._skippedSlots || []), lastSlot])];
        // Track skip count — after 2 skips enter quick mode (AI fills everything)
        form._skipCount = (form._skipCount || 0) + 1;
        if (form._skipCount >= 2 && !form._quickMode) {
          form._quickMode = true;
        }
        const { nextQuestion: nextFromState, readyToSave } = getNextArtistQuestion(form, loc, mergedState.mode);
        mergedState.submissionDraft = form;
        mergedState.lastSlot = nextFromState?.slot ?? null;
        conversationStore.set(conversationId, { ...conv, state: mergedState, updatedAt: Date.now() });
        const skipMsg = form._quickMode && form._skipCount >= 2
          ? (loc === 'de'
            ? 'Kein Problem — ich fülle den Rest aus deiner Website und deinen Angaben. Du kannst alles rechts noch anpassen.'
            : "No problem — I'll fill in the rest from your website and what you've told me. You can still adjust everything on the right.")
          : (loc === 'de' ? 'Kein Problem, übersprungen.' : 'No problem, skipped.');
        const nextQ = readyToSave ? undefined : nextFromState;
        return res.json(ensureContract({
          assistantMessage: nextQ ? `${skipMsg}\n\n${nextQ.text}` : skipMsg,
          action: readyToSave ? 'SAVE_SUBMISSION' : 'ASK_FOLLOWUP',
          statePatch: { submissionDraft: form },
          nextQuestion: nextQ,
          quickReplies: nextQ?.quickReplies,
        }));
      } else if (lastSlot && trimmedMsg && !isPlaceholderQuickReply && !scrapedLastSlot) {
        form[lastSlot] = trimmedMsg;
      }
      // Intent: from slot has_show or joinState INTENT. Phase 1.2: button sends action=BUTTON + value=HAS_SHOW|NO_SHOW.
      const inIntentStep = mergedState.joinState === 'INTENT' || lastSlot === 'has_show' || !lastSlot;
      if (inIntentStep && !mergedState.intent) {
        if (bodyAction === 'BUTTON' && (bodyValue === 'HAS_SHOW' || bodyValue === 'NO_SHOW')) {
          if (bodyValue === 'HAS_SHOW') {
            mergedState.intent = 'HAS_SHOW';
            mergedState.mode = 'EXISTING_SHOW';
            mergedState.joinState = 'HAS_SHOW_TITLE';
          } else {
            mergedState.intent = 'NO_SHOW';
            mergedState.mode = 'BRAINSTORM_SHOW';
            mergedState.joinState = 'NO_SHOW_BRAINSTORM';
          }
        } else {
          const lower = userMessage.toLowerCase().trim();
          const yes = /^(ja|yes|yeah|yep|y)$/i.test(lower) || /\bja\b/.test(lower) || lower.includes('ja,') || lower.includes('yes,') || lower.includes('habe eine show');
          const no = /^(nein|no|nope|n)$/i.test(lower) || /\bnein\b/.test(lower) || lower.includes('nein,') || lower.includes('no,') || /hab (ich )?nicht|keine show|no show|brainstorm/i.test(lower);
          if (yes) {
            mergedState.intent = 'HAS_SHOW';
            mergedState.mode = 'EXISTING_SHOW';
            mergedState.joinState = 'HAS_SHOW_TITLE';
          } else if (no) {
            mergedState.intent = 'NO_SHOW';
            mergedState.mode = 'BRAINSTORM_SHOW';
            mergedState.joinState = 'NO_SHOW_BRAINSTORM';
          } else {
          // Unclear: ask again with buttons (no guessing)
          const againDe = 'Einfach eine Option wählen: Hast du schon eine Show oder möchtest du brainstormen?';
          const againEn = 'Just pick an option: Do you already have a show or want to brainstorm?';
            response = ensureContract({
              assistantMessage: loc === 'de' ? againDe : againEn,
              action: 'ASK_FOLLOWUP',
              statePatch: { submissionDraft: form },
              nextQuestion: {
                slot: 'has_show',
                text: loc === 'de' ? againDe : againEn,
                quickReplies: loc === 'de' ? ['Ja, habe eine Show', 'Nein, brainstormen'] : ['Yes, I have a show', 'No, brainstorm'],
              },
              quickReplies: loc === 'de' ? ['Ja, habe eine Show', 'Nein, brainstormen'] : ['Yes, I have a show', 'No, brainstorm'],
            });
            conversationStore.set(conversationId, { ...conv, state: mergedState, updatedAt: Date.now() });
            return res.json(response);
          }
        }
      }
      let result;
      let updates;
      if (useAI) {
        result = useOpenAI
          ? await openaiArtistChat(form, userMessage, loc, mergedState.mode)
          : await geminiArtistChat(form, userMessage, loc, mergedState.mode);
        updates = result.suggestedFieldUpdates ? { ...form, ...result.suggestedFieldUpdates } : form;
        if (updates._brainstormDone && !updates.showTitle) {
          const emailMatch = userMessage.match(/[^\s@]+@[^\s@]+\.[^\s@]+/);
          if (emailMatch) updates.submitterEmail = emailMatch[0];
          updates.showTitle = (loc === 'de' ? 'Test-Show (Brainstorm)' : 'Test Show (Brainstorm)');
        }
        // Advance state so getNextArtistQuestion knows where we are
        if (mergedState.mode === 'BRAINSTORM_SHOW') {
          updates._brainstormStep = lastSlot
            ? Math.min(BRAINSTORM_STEPS.findIndex((s) => s.slot === lastSlot) + 1, BRAINSTORM_STEPS.length)
            : 0;
        }
        const { nextQuestion: nextFromState, readyToSave } = getNextArtistQuestion(updates, loc, mergedState.mode);
        mergedState.submissionDraft = updates;
        const draft = mergedState.submissionDraft;
        const patch = { submissionDraft: updates };
        const nextQ = readyToSave ? undefined : nextFromState;
        const baseMsg = result.assistantMessage || (nextQ ? nextQ.text : '');
        response = ensureContract({
          assistantMessage: scrapeMessage ? `${scrapeMessage}\n\n${baseMsg}`.trim() : baseMsg,
          action: readyToSave ? 'SAVE_SUBMISSION' : 'ASK_FOLLOWUP',
          statePatch: {
            ...patch,
            extracted: {
              intent: mergedState.intent || null,
              fields: mergedState.submissionDraft || {},
              media: (() => {
                const parsed = parseMediaLinksIntoUrls(mergedState.submissionDraft?.mediaLinks);
                return { images: [], videos: parsed.videoUrls, links: parsed.photoUrls };
              })(),
              contact: (() => {
                const { instagram, website } = parseSocialLinks(mergedState.submissionDraft?.socialLinks);
                return {
                  email: mergedState.submissionDraft?.submitterEmail || null,
                  instagram,
                  website,
                };
              })(),
            },
          },
          nextQuestion: nextQ,
          quickReplies: nextQ?.quickReplies,
        });
        mergedState.lastSlot = nextQ?.slot;
      } else {
        result = mockArtistChat(form, userMessage, loc, mergedState.mode);
        updates = result.suggestedFieldUpdates ? { ...form, ...result.suggestedFieldUpdates } : form;
        if (updates._brainstormDone && !updates.showTitle) {
          const emailMatch = userMessage.match(/[^\s@]+@[^\s@]+\.[^\s@]+/);
          if (emailMatch) updates.submitterEmail = emailMatch[0];
          updates.showTitle = (loc === 'de' ? 'Test-Show (Brainstorm)' : 'Test Show (Brainstorm)');
        }
        mergedState.submissionDraft = updates;
        const draft = mergedState.submissionDraft;
        const hasEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(draft.submitterEmail || '').trim());
        const hasTitle = typeof draft.showTitle === 'string' && draft.showTitle.trim().length > 0;
        const readyToSave = hasEmail && hasTitle;
        const patch = { submissionDraft: updates };
        const nextQ = readyToSave ? undefined : (result.nextQuestion || { slot: 'next', text: result.assistantMessage });
        response = ensureContract({
          assistantMessage: scrapeMessage ? `${scrapeMessage}\n\n${result.assistantMessage}`.trim() : result.assistantMessage,
          action: readyToSave ? 'SAVE_SUBMISSION' : 'ASK_FOLLOWUP',
          statePatch: {
            ...patch,
            extracted: {
              intent: mergedState.intent || null,
              fields: mergedState.submissionDraft || {},
              media: (() => {
                const parsed = parseMediaLinksIntoUrls(mergedState.submissionDraft?.mediaLinks);
                return { images: [], videos: parsed.videoUrls, links: parsed.photoUrls };
              })(),
              contact: (() => {
                const { instagram, website } = parseSocialLinks(mergedState.submissionDraft?.socialLinks);
                return {
                  email: mergedState.submissionDraft?.submitterEmail || null,
                  instagram,
                  website,
                };
              })(),
            },
          },
          nextQuestion: nextQ,
          quickReplies: nextQ?.quickReplies,
        });
        mergedState.lastSlot = nextQ?.slot;
      }
    }

    conversationStore.set(conversationId, { ...conv, state: mergedState, updatedAt: Date.now() });
    // Phase 0 diagnostic: log state machine for ARTIST to debug intent/slot flow
    if (type === 'ARTIST') {
      const nextSlotOut = response.nextQuestion?.slot ?? null;
      const readyToSave = response.action === 'SAVE_SUBMISSION';
      console.log(JSON.stringify({
        requestId: reqId,
        route: 'conversation/message',
        state_in: { joinState: mergedState.joinState, intent: mergedState.intent, mode: mergedState.mode },
        lastSlot_in: lastSlotIn,
        nextSlot_out: nextSlotOut,
        readyToSave,
        action: response.action,
        latency: Date.now() - start,
      }));
    } else {
      console.log(JSON.stringify({ requestId: reqId, conversationId, route: 'conversation/message', action: response.action, latency: Date.now() - start }));
    }
    res.json(response);
  } catch (err) {
    console.error(JSON.stringify({ requestId: reqId, route: 'conversation/message', error: err.message, latency: Date.now() - start }));
    res.status(500).json(ensureContract({ assistantMessage: '', action: 'NONE', errors: [err.message] }));
  }
});

app.get('/api/kb', async (req, res) => {
  try {
    const { locale, q } = req.query || {};
    const articles = await fetchKBArticles(locale || 'de', q);
    res.json({ articles });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to fetch KB.' });
  }
});

// --- Contact (UC-04: Jetzt anfragen) ---
app.post('/api/contact', contactLimiter, async (req, res) => {
  try {
    const { showId, showTitle, requesterName, requesterEmail, message, eventDate } = req.body || {};
    if (!requesterName || typeof requesterName !== 'string' || !requesterName.trim()) {
      return res.status(400).json({ error: 'Name is required.' });
    }
    if (!requesterEmail || typeof requesterEmail !== 'string' || !requesterEmail.includes('@')) {
      return res.status(400).json({ error: 'Valid email is required.' });
    }
    if (supabase) {
      const { error } = await supabase.from('contact_requests').insert({
        show_id: showId || null,
        show_title: showTitle || null,
        requester_name: requesterName.trim(),
        requester_email: requesterEmail.trim(),
        message: typeof message === 'string' ? message.trim() || null : null,
        event_date: typeof eventDate === 'string' ? eventDate.trim() || null : null,
      });
      if (error) {
        console.error('contact insert:', error);
        return res.status(500).json({ error: 'Could not save request.' });
      }
    }
    // --- Notify Valiantsina by email ---
    if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
      try {
        const transporter = nodemailer.createTransport({
          host: SMTP_HOST, port: SMTP_PORT, secure: SMTP_SECURE,
          auth: { user: SMTP_USER, pass: SMTP_PASS },
        });
        await transporter.sendMail({
          from: EMAIL_FROM,
          to: NOTIFY_EMAIL,
          subject: `Neue Anfrage: ${showTitle || 'Allgemeine Anfrage'}`,
          text: [
            `Show: ${showTitle || '—'}`,
            `Name: ${requesterName}`,
            `E-Mail: ${requesterEmail}`,
            eventDate ? `Datum: ${eventDate}` : '',
            message ? `Nachricht: ${message}` : '',
          ].filter(Boolean).join('\n'),
        });
      } catch (emailErr) {
        console.warn('Notification email failed:', emailErr.message);
      }
    }
    res.json({ success: true });
  } catch (err) {
    console.error('contact error:', err);
    res.status(500).json({ error: err.message || 'Request failed.' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    ai: useOpenAI ? 'openai' : useGemini ? 'gemini' : 'mock',
    submissions: !!supabase,
    admin: !!ADMIN_PASSWORD,
  });
});

/**
 * Spalten, die eine Show-Antwort nach AUSSEN tragen darf.
 *
 * 🔴 Vorher stand an den vier öffentlichen Show-Endpunkten `select('*')` — die Antwort
 * enthielt damit jede Spalte der Tabelle, darunter `artist_email`. Gemessen am 2026-08-23:
 * `curl https://berlintina.de/api/shows` gab ohne jede Anmeldung die Mailadressen aller
 * veröffentlichten Künstler heraus, dazu `artist_id`, `artist_account_id` und
 * `original_submission_id`. Das Frontend benutzt keines dieser Felder — sie wurden nur
 * mitgeliefert. Für eine Künstleragentur ist die Mailliste ihrer Künstler genau das, was
 * ein Wettbewerber oder ein Absender von Massenmail als Erstes abgreift.
 *
 * Bewusst eine ERLAUBNIS-Liste, keine Verbotsliste: Eine neue Spalte in der Tabelle ist
 * damit standardmäßig **nicht** öffentlich. Bei einer Verbotsliste wäre jedes künftige
 * Feld sofort draußen, und niemand würde es merken.
 *
 * Kommt ein Feld dazu, das die Seite anzeigen soll, gehört es hier hinein — fehlt es,
 * bleibt die Anzeige leer, und das fällt beim ersten Ansehen auf. Das ist die richtige
 * Richtung zu scheitern.
 *
 * Die Admin-Endpunkte (`requireAdmin`) behalten `select('*')`: dort ist der Zugriff
 * geprüft, und die Verwaltung braucht die vollständige Zeile.
 */
const OEFFENTLICHE_SHOW_SPALTEN = [
  'id', 'slug', 'short_id', 'status', 'title', 'category', 'artist_name',
  'sales_pitch_text', 'short_description_facts', 'ideal_for', 'vibe_tags',
  'photo_urls', 'video_urls', 'testimonials',
  'duration_minutes', 'audience_range', 'cast', 'placement',
  'stage_min', 'stage_ideal', 'ceiling_min',
  'light_short', 'sound_short', 'timings_short', 'rider_pdf_url',
  'price_min', 'price_max', 'price_type',
  'faq_stage', 'faq_travel', 'faq_language', 'faq_outdoor', 'faq_custom',
  'created_at',
  // Diese vier liest services/showsService.ts aus der Antwort und bildet sie auf sein
  // Modell ab (artistId, instrumentationText, extractedTags, languageOptions). Nimmt man
  // sie weg, laufen die Felder still auf undefined bzw. leeres Array — die Anzeige bliebe
  // ohne Fehlermeldung unvollständig. `artist_id` ist eine interne Kennung ohne
  // Kontaktwert; sie bleibt, weil ein Typbruch teurer wäre als der Gewinn.
  'artist_id', 'instrumentation_text', 'extracted_tags', 'language_options',
].join(', ');

// --- Public Shows API (proxies Supabase to avoid client CORS) ---
app.get('/api/shows', async (req, res) => {
  try {
    if (!supabase) {
      return res.json({ shows: [] });
    }
    const { data, error } = await supabase.from('shows').select(OEFFENTLICHE_SHOW_SPALTEN).eq('status', 'PUBLISHED').order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ shows: data || [] });
  } catch (err) {
    console.error('api/shows:', err);
    res.status(500).json({ shows: [], error: err.message });
  }
});

app.get('/api/shows/page', async (req, res) => {
  try {
    if (!supabase) {
      return res.json({ shows: [], totalCount: 0 });
    }
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 12));
    const category = req.query.category;
    const search = req.query.search;
    let q = supabase.from('shows').select('*', { count: 'exact' }).eq('status', 'PUBLISHED');
    if (category && category !== 'ALL') q = q.eq('category', category);
    if (search && typeof search === 'string' && search.trim()) {
      const term = search.trim().replace(/,/g, ' ');
      // Use full-text search if fts column exists, fall back to ilike on title/artist
      try {
        q = q.textSearch('fts', term, { type: 'websearch', config: 'german' });
      } catch {
        q = q.or(`title.ilike.%${term}%,artist_name.ilike.%${term}%`);
      }
    }
    q = q.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
    const { data, error, count } = await q;
    if (error) throw error;
    res.json({ shows: data || [], totalCount: count ?? 0 });
  } catch (err) {
    console.error('api/shows/page:', err);
    res.status(500).json({ shows: [], totalCount: 0, error: err.message });
  }
});

app.get('/api/shows/by/:shortId', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(404).json({ error: 'Not found.' });
    }
    const { shortId } = req.params;
    const { data, error } = await supabase.from('shows').select(OEFFENTLICHE_SHOW_SPALTEN).eq('short_id', shortId).eq('status', 'PUBLISHED').single();
    if (error || !data) return res.status(404).json({ error: 'Not found.' });
    res.json({ show: data });
  } catch (err) {
    console.error('api/shows/by:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/shows/slug/:slug', async (req, res) => {
  try {
    if (!supabase) return res.status(404).json({ error: 'Not found.' });
    const { slug } = req.params;
    const { data, error } = await supabase.from('shows').select(OEFFENTLICHE_SHOW_SPALTEN).eq('slug', slug).eq('status', 'PUBLISHED').single();
    if (error || !data) return res.status(404).json({ error: 'Not found.' });
    res.json({ show: data });
  } catch (err) {
    console.error('api/shows/slug:', err);
    res.status(500).json({ error: err.message });
  }
});

// --- Admin (EPIC 4) ---
/**
 * Bremse gegen Durchprobieren.
 *
 * Der Zugang ist EIN Passwort, und dasselbe Passwort ist zugleich der API-Token
 * (`requireAdmin` vergleicht direkt damit). Wer es errät, kann Shows aendern und loeschen.
 * Bis eben war dieser Endpunkt der einzige ohne Limiter — waehrend Formular, Kontakt und
 * KI-Aufrufe laengst gedeckelt sind. Ausgerechnet die Tuer stand ohne Bremse offen.
 *
 * 10 Versuche pro IP und Stunde reichen fuer Vertipper und sind fuer eine Wortliste
 * unbrauchbar. `skipSuccessfulRequests`: wer das richtige Passwort hat, verbraucht nichts.
 */
const adminLoginLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  message: { error: 'Zu viele Versuche. Bitte spaeter erneut.' },
});

app.post('/api/admin/login', adminLoginLimiter, (req, res) => {
  if (!ADMIN_PASSWORD) {
    return res.status(503).json({ error: 'Admin not configured.' });
  }
  const { password } = req.body || {};
  if (password === ADMIN_PASSWORD) {
    res.json({ ok: true });
  } else {
    res.status(401).json({ error: 'Invalid password.' });
  }
});

app.get('/api/admin/submissions', requireAdmin, async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: 'Submissions not configured.' });
    }
    const { status } = req.query;
    let q = supabase.from('show_submissions').select('*').order('submitted_at', { ascending: false });
    if (status && typeof status === 'string') {
      q = q.eq('status', status);
    }
    const { data: rows, error } = await q;
    if (error) throw error;
    res.json({ submissions: rows || [] });
  } catch (err) {
    console.error('admin submissions list:', err);
    res.status(500).json({ error: err.message || 'Failed to list submissions.' });
  }
});

app.get('/api/admin/submissions/:id', requireAdmin, async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: 'Submissions not configured.' });
    }
    const { id } = req.params;
    const { data: row, error } = await supabase.from('show_submissions').select('*').eq('id', id).single();
    if (error || !row) {
      return res.status(404).json({ error: 'Submission not found.' });
    }
    res.json(row);
  } catch (err) {
    console.error('admin submission get:', err);
    res.status(500).json({ error: err.message || 'Failed to get submission.' });
  }
});

// Admin can change all fields on a submission in any status (PENDING_REVIEW, APPROVED, CHANGES_REQUESTED, REJECTED).
app.patch('/api/admin/submissions/:id', requireAdmin, async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: 'Submissions not configured.' });
    }
    const { id } = req.params;
    const body = req.body || {};
    const { data: existing, error: fetchErr } = await supabase.from('show_submissions').select('*').eq('id', id).single();
    if (fetchErr || !existing) {
      return res.status(404).json({ error: 'Submission not found.' });
    }

    const updates = {};
    if (body.show_title !== undefined) updates.show_title = body.show_title != null ? String(body.show_title).trim() : existing.show_title;
    if (body.short_description_facts !== undefined) updates.short_description_facts = body.short_description_facts != null ? String(body.short_description_facts) : null;
    if (body.sales_pitch_text !== undefined) updates.sales_pitch_text = body.sales_pitch_text != null ? String(body.sales_pitch_text) : null;
    if (body.artist_genre !== undefined) updates.artist_genre = body.artist_genre != null ? String(body.artist_genre) : null;
    if (body.duration_minutes !== undefined) updates.duration_minutes = typeof body.duration_minutes === 'number' ? body.duration_minutes : (body.duration_minutes != null ? parseInt(body.duration_minutes, 10) : null);
    if (body.price_text !== undefined) updates.price_text = body.price_text != null ? String(body.price_text) : null;
    if (body.language_options !== undefined) updates.language_options = Array.isArray(body.language_options) ? body.language_options : existing.language_options;
    if (body.photo_urls !== undefined) updates.photo_urls = Array.isArray(body.photo_urls) ? body.photo_urls.filter(Boolean) : existing.photo_urls;
    if (body.video_urls !== undefined) updates.video_urls = Array.isArray(body.video_urls) ? body.video_urls.filter(Boolean) : existing.video_urls;
    if (body.artist_bio !== undefined) updates.artist_bio = body.artist_bio != null ? String(body.artist_bio) : null;
    if (body.social_links !== undefined) updates.social_links = body.social_links != null ? String(body.social_links) : null;
    if (body.submitter_email !== undefined) {
      const v = body.submitter_email != null ? String(body.submitter_email).trim() : '';
      if (v) updates.submitter_email = v;
    }
    const allowedStatuses = ['PENDING_REVIEW', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED'];
    if (body.status !== undefined && allowedStatuses.includes(String(body.status))) {
      updates.status = String(body.status);
      updates.reviewed_at = new Date().toISOString();
    }

    const newPhotoUrls = [];
    if (body.photoBase64 && typeof body.photoBase64 === 'string') {
      const base64Data = body.photoBase64.replace(/^data:image\/\w+;base64,/, '');
      const buf = Buffer.from(base64Data, 'base64');
      const ext = body.photoBase64.startsWith('data:image/png') ? 'png' : 'jpg';
      const filename = `admin-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { data: uploadData, error: uploadErr } = await supabase.storage.from('submissions-media').upload(filename, buf, { contentType: `image/${ext}`, upsert: false });
      if (!uploadErr) {
        const { data: { publicUrl } } = supabase.storage.from('submissions-media').getPublicUrl(uploadData.path);
        newPhotoUrls.push(publicUrl);
      }
    }
    if (Array.isArray(body.photoBase64s) && body.photoBase64s.length > 0) {
      for (const photoBase64 of body.photoBase64s) {
        if (typeof photoBase64 !== 'string') continue;
        const base64Data = photoBase64.replace(/^data:image\/\w+;base64,/, '');
        const buf = Buffer.from(base64Data, 'base64');
        const ext = photoBase64.startsWith('data:image/png') ? 'png' : 'jpg';
        const filename = `admin-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { data: uploadData, error: uploadErr } = await supabase.storage.from('submissions-media').upload(filename, buf, { contentType: `image/${ext}`, upsert: false });
        if (!uploadErr) {
          const { data: { publicUrl } } = supabase.storage.from('submissions-media').getPublicUrl(uploadData.path);
          newPhotoUrls.push(publicUrl);
        }
      }
    }
    if (newPhotoUrls.length > 0) {
      const current = Array.isArray(updates.photo_urls) ? updates.photo_urls : (Array.isArray(existing.photo_urls) ? existing.photo_urls : []);
      updates.photo_urls = [...newPhotoUrls, ...current];
    }

    const { data: updated, error: updateErr } = await supabase.from('show_submissions').update(updates).eq('id', id).select('*').single();
    if (updateErr) throw updateErr;
    res.json({ ok: true, submission: updated });
  } catch (err) {
    console.error('admin submission patch:', err);
    res.status(500).json({ error: err.message || 'Failed to update submission.' });
  }
});

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function makeUniqueSlug(base) {
  if (!supabase || !base) return base;
  const { data } = await supabase.from('shows').select('slug').like('slug', `${base}%`);
  const existing = (data || []).map(r => r.slug);
  if (!existing.includes(base)) return base;
  let i = 2;
  while (existing.includes(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

function mapGenreToCategory(genre) {
  const g = String(genre || '').toLowerCase();
  if (/akrobatik|acrobat|circus/i.test(g)) return 'ACROBATICS';
  if (/tanz|dance|ballett/i.test(g)) return 'DANCE';
  if (/band|rock|jazz|pop/i.test(g)) return 'BAND';
  return 'CLASSICAL';
}

app.post('/api/admin/submissions/:id/approve', requireAdmin, async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: 'Submissions not configured.' });
    }
    const { id } = req.params;
    const body = req.body || {};
    const { data: sub, error: subErr } = await supabase.from('show_submissions').select('*').eq('id', id).single();
    if (subErr || !sub) {
      return res.status(404).json({ error: 'Submission not found.' });
    }
    if (sub.status !== 'PENDING_REVIEW') {
      return res.status(400).json({ error: 'Submission already reviewed.' });
    }

    // Admin overrides (edit before approve): merge body over submission
    const title = (body.title != null && body.title !== '') ? String(body.title).trim() : sub.show_title;
    const shortDescriptionFacts = body.short_description_facts != null ? String(body.short_description_facts) : (sub.short_description_facts || '');
    const salesPitchText = body.sales_pitch_text != null ? String(body.sales_pitch_text) : (sub.sales_pitch_text || sub.short_description_facts || '');
    const artistGenre = body.artist_genre != null ? String(body.artist_genre) : sub.artist_genre;
    const artistName = (body.artist_name != null && body.artist_name !== '') ? String(body.artist_name).trim() : (sub.artist_genre || sub.artist_bio?.slice(0, 50) || sub.submitter_email?.split('@')[0] || 'Artist');
    const durationMinutes = body.duration_minutes != null ? (typeof body.duration_minutes === 'number' ? body.duration_minutes : parseInt(body.duration_minutes, 10) || 0) : (sub.duration_minutes || 0);
    let photoUrls = Array.isArray(body.photo_urls) ? body.photo_urls.filter(Boolean) : (sub.photo_urls || []);
    let videoUrls = Array.isArray(body.video_urls) ? body.video_urls.filter(Boolean) : (sub.video_urls || []);

    if (body.photoBase64 && typeof body.photoBase64 === 'string') {
      const base64Data = body.photoBase64.replace(/^data:image\/\w+;base64,/, '');
      const buf = Buffer.from(base64Data, 'base64');
      const ext = body.photoBase64.startsWith('data:image/png') ? 'png' : 'jpg';
      const filename = `admin-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { data: uploadData, error: uploadErr } = await supabase.storage.from('submissions-media').upload(filename, buf, { contentType: `image/${ext}`, upsert: false });
      if (!uploadErr) {
        const { data: { publicUrl } } = supabase.storage.from('submissions-media').getPublicUrl(uploadData.path);
        photoUrls = [publicUrl, ...photoUrls];
      }
    }
    if (Array.isArray(body.photoBase64s) && body.photoBase64s.length > 0) {
      for (const photoBase64 of body.photoBase64s) {
        if (typeof photoBase64 !== 'string') continue;
        const base64Data = photoBase64.replace(/^data:image\/\w+;base64,/, '');
        const buf = Buffer.from(base64Data, 'base64');
        const ext = photoBase64.startsWith('data:image/png') ? 'png' : 'jpg';
        const filename = `admin-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { data: uploadData, error: uploadErr } = await supabase.storage.from('submissions-media').upload(filename, buf, { contentType: `image/${ext}`, upsert: false });
        if (!uploadErr) {
          const { data: { publicUrl } } = supabase.storage.from('submissions-media').getPublicUrl(uploadData.path);
          photoUrls = [publicUrl, ...photoUrls];
        }
      }
    }

    const shortId = Math.random().toString(36).slice(2, 8);
    const baseSlug = slugify(title) || shortId;
    const slug = await makeUniqueSlug(baseSlug);
    let priceMin, priceMax;
    const priceText = body.price_text != null ? String(body.price_text) : (sub.price_text || '');
    const priceMatch = priceText.match(/\d+/g);
    if (priceMatch?.length) {
      priceMin = parseInt(priceMatch[0], 10);
      priceMax = priceMatch[1] ? parseInt(priceMatch[1], 10) : priceMin;
    }
    const artistEmail = (sub.submitter_email || '').trim() || null;
    const showRow = {
      short_id: shortId,
      slug,
      artist_id: sub.id,
      artist_name: artistName,
      title,
      category: mapGenreToCategory(artistGenre),
      short_description_facts: shortDescriptionFacts,
      sales_pitch_text: salesPitchText,
      duration_minutes: durationMinutes,
      language_options: Array.isArray(body.language_options) ? body.language_options : (sub.language_options || []),
      price_type: priceMin != null ? 'RANGE' : 'POA',
      price_min: priceMin ?? null,
      price_max: priceMax ?? null,
      photo_urls: photoUrls,
      video_urls: videoUrls,
      status: 'PUBLISHED',
      artist_email: artistEmail,
      ...(sub.artist_account_id && { artist_account_id: sub.artist_account_id }),
    };
    let { data: show, error: insErr } = await supabase.from('shows').insert({ ...showRow, original_submission_id: sub.id }).select('id').single();
    if (insErr && insErr.code === '42703') {
      const r = await supabase.from('shows').insert(showRow).select('id').single();
      show = r.data; insErr = r.error;
    }
    if (insErr) throw insErr;
    let emailSent = false;
    if (show?.id && artistEmail) {
      emailSent = await sendArtistEmail(artistEmail, 'approved', { title });
      if (emailSent) {
        await supabase.from('shows').update({ artist_notified_at: new Date().toISOString() }).eq('id', show.id);
      }
    }
    await supabase.from('show_submissions').update({ status: 'APPROVED', reviewed_at: new Date().toISOString() }).eq('id', id);
    res.json({ ok: true, showId: show?.id, emailSent });
  } catch (err) {
    console.error('admin approve:', err);
    res.status(500).json({ error: err.message || 'Failed to approve.' });
  }
});

app.post('/api/admin/submissions/:id/reject', requireAdmin, async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: 'Submissions not configured.' });
    }
    const { id } = req.params;
    const { review_notes } = req.body || {};
    const { data, error } = await supabase.from('show_submissions').update({
      status: 'REJECTED',
      reviewed_at: new Date().toISOString(),
      review_notes: review_notes || null,
    }).eq('id', id).select('id').single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Submission not found.' });
    res.json({ ok: true });
  } catch (err) {
    console.error('admin reject:', err);
    res.status(500).json({ error: err.message || 'Failed to reject.' });
  }
});

app.delete('/api/admin/submissions/:id', requireAdmin, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Not configured.' });
    const { id } = req.params;
    const { error } = await supabase.from('show_submissions').delete().eq('id', id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    console.error('admin delete submission:', err);
    res.status(500).json({ error: err.message || 'Failed to delete.' });
  }
});

app.post('/api/admin/submissions/:id/changes', requireAdmin, async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: 'Submissions not configured.' });
    }
    const { id } = req.params;
    const { review_notes } = req.body || {};
    const { data, error } = await supabase.from('show_submissions').update({
      status: 'CHANGES_REQUESTED',
      reviewed_at: new Date().toISOString(),
      review_notes: review_notes || null,
    }).eq('id', id).select('id').single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Submission not found.' });
    res.json({ ok: true });
  } catch (err) {
    console.error('admin changes:', err);
    res.status(500).json({ error: err.message || 'Failed to request changes.' });
  }
});

// --- Admin: list and edit published shows (text + pictures); notify artist by email; if email fails, show is hidden ---
app.get('/api/admin/shows', requireAdmin, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Supabase not configured.' });
    const { data, error } = await supabase.from('shows').select('id, short_id, slug, title, artist_name, status, artist_email, artist_notified_at, created_at').eq('status', 'PUBLISHED').order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ shows: data || [] });
  } catch (err) {
    console.error('admin shows list:', err);
    res.status(500).json({ error: err.message || 'Failed to load shows.' });
  }
});

app.get('/api/admin/shows/:id', requireAdmin, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Supabase not configured.' });
    const { id } = req.params;
    const { data, error } = await supabase.from('shows').select('*').eq('id', id).single();
    if (error || !data) return res.status(404).json({ error: 'Show not found.' });
    res.json(data);
  } catch (err) {
    console.error('admin show get:', err);
    res.status(500).json({ error: err.message || 'Failed to load show.' });
  }
});

app.patch('/api/admin/shows/:id', requireAdmin, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Supabase not configured.' });
    const { id } = req.params;
    const body = req.body || {};
    const { data: existing, error: fetchErr } = await supabase.from('shows').select('*').eq('id', id).single();
    if (fetchErr || !existing) return res.status(404).json({ error: 'Show not found.' });

    const updates = { updated_at: new Date().toISOString() };
    if (body.title != null && String(body.title).trim() !== '') updates.title = String(body.title).trim();
    if (body.short_description_facts != null) updates.short_description_facts = String(body.short_description_facts);
    if (body.sales_pitch_text != null) updates.sales_pitch_text = String(body.sales_pitch_text);
    if (body.artist_name != null && String(body.artist_name).trim() !== '') updates.artist_name = String(body.artist_name).trim();
    if (body.duration_minutes != null) updates.duration_minutes = typeof body.duration_minutes === 'number' ? body.duration_minutes : parseInt(body.duration_minutes, 10) || 0;
    if (body.price_text !== undefined) {
      const priceText = String(body.price_text || '');
      const priceMatch = priceText.match(/\d+/g);
      if (priceMatch?.length) {
        updates.price_min = parseInt(priceMatch[0], 10);
        updates.price_max = priceMatch[1] ? parseInt(priceMatch[1], 10) : updates.price_min;
        updates.price_type = 'RANGE';
      } else {
        updates.price_type = 'POA';
        updates.price_min = null;
        updates.price_max = null;
      }
    }
    if (Array.isArray(body.photo_urls)) updates.photo_urls = body.photo_urls.filter(Boolean);
    if (Array.isArray(body.video_urls)) updates.video_urls = body.video_urls.filter(Boolean);

    if (body.cast !== undefined) updates.cast = body.cast === '' || body.cast == null ? null : String(body.cast).trim();
    if (body.ideal_for !== undefined) updates.ideal_for = body.ideal_for === '' || body.ideal_for == null ? null : String(body.ideal_for).trim();
    if (body.placement !== undefined) updates.placement = body.placement === '' || body.placement == null ? null : String(body.placement).trim();
    if (body.audience_range !== undefined) updates.audience_range = body.audience_range === '' || body.audience_range == null ? null : String(body.audience_range).trim();
    if (body.stage_min !== undefined) updates.stage_min = body.stage_min === '' || body.stage_min == null ? null : String(body.stage_min).trim();
    if (body.stage_ideal !== undefined) updates.stage_ideal = body.stage_ideal === '' || body.stage_ideal == null ? null : String(body.stage_ideal).trim();
    if (body.ceiling_min !== undefined) updates.ceiling_min = body.ceiling_min === '' || body.ceiling_min == null ? null : String(body.ceiling_min).trim();
    if (body.sound_short !== undefined) updates.sound_short = body.sound_short === '' || body.sound_short == null ? null : String(body.sound_short).trim();
    if (body.light_short !== undefined) updates.light_short = body.light_short === '' || body.light_short == null ? null : String(body.light_short).trim();
    if (body.timings_short !== undefined) updates.timings_short = body.timings_short === '' || body.timings_short == null ? null : String(body.timings_short).trim();
    if (body.rider_pdf_url !== undefined) updates.rider_pdf_url = body.rider_pdf_url === '' || body.rider_pdf_url == null ? null : String(body.rider_pdf_url).trim();
    if (Array.isArray(body.testimonials)) updates.testimonials = body.testimonials.filter(t => t && (t.quote || t.name));
    if (body.faq_outdoor !== undefined) updates.faq_outdoor = body.faq_outdoor === '' || body.faq_outdoor == null ? null : String(body.faq_outdoor).trim();
    if (body.faq_stage !== undefined) updates.faq_stage = body.faq_stage === '' || body.faq_stage == null ? null : String(body.faq_stage).trim();
    if (body.faq_language !== undefined) updates.faq_language = body.faq_language === '' || body.faq_language == null ? null : String(body.faq_language).trim();
    if (body.faq_custom !== undefined) updates.faq_custom = body.faq_custom === '' || body.faq_custom == null ? null : String(body.faq_custom).trim();
    if (body.faq_travel !== undefined) updates.faq_travel = body.faq_travel === '' || body.faq_travel == null ? null : String(body.faq_travel).trim();

    const newPhotoUrls = [];
    if (body.photoBase64 && typeof body.photoBase64 === 'string') {
      const base64Data = body.photoBase64.replace(/^data:image\/\w+;base64,/, '');
      const buf = Buffer.from(base64Data, 'base64');
      const ext = body.photoBase64.startsWith('data:image/png') ? 'png' : 'jpg';
      const filename = `admin-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { data: uploadData, error: uploadErr } = await supabase.storage.from('submissions-media').upload(filename, buf, { contentType: `image/${ext}`, upsert: false });
      if (!uploadErr) {
        const { data: { publicUrl } } = supabase.storage.from('submissions-media').getPublicUrl(uploadData.path);
        newPhotoUrls.push(publicUrl);
      }
    }
    if (Array.isArray(body.photoBase64s) && body.photoBase64s.length > 0) {
      for (const photoBase64 of body.photoBase64s) {
        if (typeof photoBase64 !== 'string') continue;
        const base64Data = photoBase64.replace(/^data:image\/\w+;base64,/, '');
        const buf = Buffer.from(base64Data, 'base64');
        const ext = photoBase64.startsWith('data:image/png') ? 'png' : 'jpg';
        const filename = `admin-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { data: uploadData, error: uploadErr } = await supabase.storage.from('submissions-media').upload(filename, buf, { contentType: `image/${ext}`, upsert: false });
        if (!uploadErr) {
          const { data: { publicUrl } } = supabase.storage.from('submissions-media').getPublicUrl(uploadData.path);
          newPhotoUrls.push(publicUrl);
        }
      }
    }
    if (newPhotoUrls.length > 0) {
      const current = Array.isArray(existing.photo_urls) ? existing.photo_urls : [];
      updates.photo_urls = [...newPhotoUrls, ...current];
    }

    const { data: updated, error: updateErr } = await supabase.from('shows').update(updates).eq('id', id).select('*').single();
    if (updateErr) throw updateErr;

    const notifyArtist = body.notify_artist === true;
    let emailSent = false;
    if (notifyArtist && existing.artist_email) {
      emailSent = await sendArtistEmail(existing.artist_email, 'updated', { title: updates.title || existing.title });
      if (emailSent) {
        await supabase.from('shows').update({ artist_notified_at: new Date().toISOString() }).eq('id', id);
      }
    }

    res.json({ ok: true, show: updated, emailSent: notifyArtist ? emailSent : undefined });
  } catch (err) {
    console.error('admin show patch:', err);
    res.status(500).json({ error: err.message || 'Failed to update show.' });
  }
});

app.delete('/api/admin/shows/:id', requireAdmin, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Supabase not configured.' });
    const { id } = req.params;
    const { error } = await supabase.from('shows').delete().eq('id', id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    console.error('admin show delete:', err);
    res.status(500).json({ error: err.message || 'Failed to delete show.' });
  }
});

// --- Returning Artist token (hash, no plaintext in DB) ---
const ARTIST_TOKEN_PEPPER = process.env.ARTIST_TOKEN_PEPPER || 'artist-token-pepper-change-in-production';

function hashToken(token) {
  return crypto.createHash('sha256').update(token + ARTIST_TOKEN_PEPPER).digest('hex');
}

function randomArtistToken() {
  return crypto.randomUUID();
}

function parseSocialLinks(socialLinks) {
  const raw = (socialLinks || '').trim();
  const instagram = raw.match(/(?:instagram\.com\/|@)([a-zA-Z0-9_.]+)/i)?.[1]?.replace(/^@/, '')?.trim() || null;
  const website = raw.match(/https?:\/\/[^\s]+/)?.[0]?.trim() || (raw.startsWith('http') ? raw : null) || null;
  return { instagram, website };
}

async function resolveOrCreateArtistAccount(email, socialLinks) {
  const { instagram, website } = parseSocialLinks(socialLinks);
  const emailNorm = (email || '').trim() || null;
  if (!instagram && !website && !emailNorm) return null;

  const instagramNorm = instagram ? instagram.toLowerCase().trim() : null;
  const emailNormLower = emailNorm ? emailNorm.toLowerCase().trim() : null;
  const websiteNorm = website ? website.toLowerCase().trim() : null;

  let existing = null;
  if (instagramNorm) {
    const { data } = await supabase.from('artist_accounts').select('id, email, website_url').eq('instagram_handle', instagramNorm).limit(1).maybeSingle();
    existing = data;
  }
  if (!existing && emailNormLower) {
    const { data } = await supabase.from('artist_accounts').select('id, email, website_url').eq('email', emailNormLower).limit(1).maybeSingle();
    existing = data;
  }
  if (!existing && websiteNorm) {
    const { data } = await supabase.from('artist_accounts').select('id, email, website_url').eq('website_url', websiteNorm).limit(1).maybeSingle();
    existing = data;
  }

  if (existing?.id) {
    await supabase.from('artist_accounts').update({
      email: emailNormLower || existing.email,
      website_url: websiteNorm || existing.website_url,
      updated_at: new Date().toISOString(),
    }).eq('id', existing.id);
    return existing.id;
  }
  const { data: inserted, error } = await supabase.from('artist_accounts').insert({
    display_name: null,
    instagram_handle: instagramNorm,
    website_url: websiteNorm,
    email: emailNormLower,
  }).select('id').single();
  if (error) throw error;
  return inserted.id;
}

async function findArtistByTokenHash(tokenHash) {
  const { data: row } = await supabase.from('artist_tokens').select('artist_account_id').eq('token_hash', tokenHash).is('revoked_at', null).single();
  if (!row) return null;
  await supabase.from('artist_tokens').update({ last_seen_at: new Date().toISOString() }).eq('token_hash', tokenHash);
  const { data: acc } = await supabase.from('artist_accounts').select('id, display_name, instagram_handle, website_url, email').eq('id', row.artist_account_id).single();
  return acc;
}

async function createArtistToken(artistAccountId) {
  const token = randomArtistToken();
  const tokenHash = hashToken(token);
  await supabase.from('artist_tokens').insert({ artist_account_id: artistAccountId, token_hash: tokenHash });
  return token;
}

app.post('/api/artist/resolve', async (req, res) => {
  try {
    if (!supabase) {
      return res.json({ isReturning: false });
    }
    const { artistToken } = req.body || {};
    if (!artistToken || typeof artistToken !== 'string') {
      return res.json({ isReturning: false });
    }
    const tokenHash = hashToken(artistToken.trim());
    const account = await findArtistByTokenHash(tokenHash);
    if (!account) return res.json({ isReturning: false });
    res.json({
      isReturning: true,
      artistAccount: {
        id: account.id,
        displayName: account.display_name || null,
        instagramHandle: account.instagram_handle || null,
        websiteUrl: account.website_url || null,
        hasPrivateEmail: !!account.email,
      },
    });
  } catch (err) {
    console.error('artist resolve:', err);
    res.status(500).json({ isReturning: false });
  }
});

// --- Submissions (EPIC 2 + Returning Artist) ---
app.post('/api/submissions', submissionsLimiter, async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: 'Submissions not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.' });
    }
    const { honeypot, submitterEmail, showTitle, artistName, artistGenre, photoBase64, photoBase64Array, photoUrls: urls, videoUrls, mediaLinks: mediaLinksStr, durationMinutes, languageOptions, priceText, shortDescriptionFacts, salesPitchText, socialLinks, artistBio, faqOutdoor, faqStage, faqLanguage, faqCustom, faqTravel, websiteUrl, artistToken } = req.body || {};
    if (honeypot) {
      return res.status(400).json({ error: 'Invalid submission.' });
    }
    if (!submitterEmail || typeof submitterEmail !== 'string' || !submitterEmail.includes('@')) {
      return res.status(400).json({ error: 'Valid email is required.' });
    }
    if (!showTitle || typeof showTitle !== 'string' || !showTitle.trim()) {
      return res.status(400).json({ error: 'Show title is required.' });
    }

    let photoUrls = Array.isArray(urls) ? urls.filter(Boolean) : [];
    let videoUrlsFinal = Array.isArray(videoUrls) ? videoUrls.filter(Boolean) : [];
    if (mediaLinksStr && typeof mediaLinksStr === 'string') {
      const parsed = parseMediaLinksIntoUrls(mediaLinksStr);
      photoUrls = [...photoUrls, ...parsed.photoUrls];
      videoUrlsFinal = [...videoUrlsFinal, ...parsed.videoUrls];
    }
    const base64Images = [];
    if (photoBase64 && typeof photoBase64 === 'string') base64Images.push(photoBase64);
    if (Array.isArray(photoBase64Array)) base64Images.push(...photoBase64Array.filter((s) => typeof s === 'string' && s.length));
    for (const photoB64 of base64Images) {
      const base64Data = photoB64.replace(/^data:image\/\w+;base64,/, '');
      const buf = Buffer.from(base64Data, 'base64');
      const ext = photoB64.startsWith('data:image/png') ? 'png' : 'jpg';
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { data, error } = await supabase.storage.from('submissions-media').upload(filename, buf, {
        contentType: `image/${ext}`,
        upsert: false,
      });
      if (error) {
        console.error('Storage upload error:', error);
      } else {
        const { data: { publicUrl } } = supabase.storage.from('submissions-media').getPublicUrl(data.path);
        photoUrls = [publicUrl, ...photoUrls];
      }
    }

    let artistAccountId = null;
    let returnedArtistToken = null;
    if (artistToken && typeof artistToken === 'string') {
      const tokenHash = hashToken(artistToken.trim());
      const account = await findArtistByTokenHash(tokenHash);
      if (account) artistAccountId = account.id;
    }
    if (!artistAccountId) {
      artistAccountId = await resolveOrCreateArtistAccount(submitterEmail.trim(), socialLinks);
      if (artistAccountId) returnedArtistToken = await createArtistToken(artistAccountId);
    }

    const { data: row, error } = await supabase.from('show_submissions').insert({
      artist_account_id: artistAccountId,
      artist_genre: artistGenre || null,
      show_title: showTitle.trim(),
      photo_urls: photoUrls,
      video_urls: videoUrlsFinal,
      duration_minutes: typeof durationMinutes === 'number' ? durationMinutes : null,
      language_options: Array.isArray(languageOptions) ? languageOptions : [],
      price_text: priceText || null,
      short_description_facts: shortDescriptionFacts || null,
      sales_pitch_text: salesPitchText || null,
      social_links: socialLinks || null,
      // artist_name column may not exist yet — prefix into artist_bio until migration runs:
      // ALTER TABLE show_submissions ADD COLUMN IF NOT EXISTS artist_name text;
      artist_bio: artistName && !artistBio
        ? String(artistName).trim()
        : artistName && artistBio
          ? `${String(artistName).trim()}\n\n${artistBio}`
          : (artistBio || null),
      submitter_email: submitterEmail.trim(),
      status: 'PENDING_REVIEW',
      ...(websiteUrl && { website_url: String(websiteUrl).trim() }),
      ...(faqOutdoor && { faq_outdoor: String(faqOutdoor).trim() }),
      ...(faqStage && { faq_stage: String(faqStage).trim() }),
      ...(faqLanguage && { faq_language: String(faqLanguage).trim() }),
      ...(faqCustom && { faq_custom: String(faqCustom).trim() }),
      ...(faqTravel && { faq_travel: String(faqTravel).trim() }),
    }).select('id').single();

    if (error) {
      console.error('Submission insert error:', error);
      return res.status(500).json({ error: error.message || 'Could not save submission.' });
    }
    const payload = { submissionId: row.id, message: 'Submission received. We will review and contact you.' };
    if (returnedArtistToken) payload.artistToken = returnedArtistToken;
    res.json(payload);
  } catch (err) {
    console.error('submissions error:', err);
    res.status(500).json({ error: err.message || 'Submission failed.' });
  }
});

// --- Artist portal: list own published shows ---
app.get('/api/artist/shows', async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Not configured.' });
    const artistToken = req.headers['x-artist-token'];
    if (!artistToken) return res.status(401).json({ error: 'Missing artist token.' });
    const tokenHash = hashToken(String(artistToken).trim());
    const account = await findArtistByTokenHash(tokenHash);
    if (!account) return res.status(401).json({ error: 'Invalid or expired token.' });
    const { data: shows, error } = await supabase
      .from('shows')
      .select('id, slug, short_id, title, category, photo_urls, vibe_tags, duration_minutes, price_type, price_min, price_max, status, created_at')
      .eq('artist_account_id', account.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ artist: account, shows: shows || [] });
  } catch (err) {
    console.error('artist/shows:', err);
    res.status(500).json({ error: err.message || 'Failed.' });
  }
});

// --- Blog: public endpoints ---
app.get('/api/blog', async (req, res) => {
  try {
    if (!supabase) return res.json({ posts: [] });
    const { data, error } = await supabase
      .from('blog_posts')
      .select('id, slug, title_de, title_en, excerpt_de, excerpt_en, cover_image_url, published_at, created_at')
      .not('published_at', 'is', null)
      .lte('published_at', new Date().toISOString())
      .order('published_at', { ascending: false });
    if (error) throw error;
    res.json({ posts: data || [] });
  } catch (err) {
    console.error('blog list:', err);
    res.status(500).json({ posts: [], error: err.message });
  }
});

app.get('/api/blog/:slug', async (req, res) => {
  try {
    if (!supabase) return res.status(404).json({ error: 'Not found.' });
    const { data, error } = await supabase
      .from('blog_posts')
      .select('*')
      .eq('slug', req.params.slug)
      .not('published_at', 'is', null)
      .lte('published_at', new Date().toISOString())
      .single();
    if (error || !data) return res.status(404).json({ error: 'Post not found.' });
    res.json({ post: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Blog: admin endpoints ---
app.get('/api/admin/blog', requireAdmin, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Not configured.' });
    const { data, error } = await supabase
      .from('blog_posts')
      .select('id, slug, title_de, title_en, published_at, created_at')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ posts: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/blog', requireAdmin, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Not configured.' });
    const b = req.body || {};
    const slug = (b.slug || b.title_de || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `post-${Date.now()}`;
    const { data, error } = await supabase.from('blog_posts').insert({
      slug,
      title_de: b.title_de || '',
      title_en: b.title_en || '',
      excerpt_de: b.excerpt_de || '',
      excerpt_en: b.excerpt_en || '',
      content_de: b.content_de || '',
      content_en: b.content_en || '',
      cover_image_url: b.cover_image_url || null,
      published_at: b.published_at || null,
    }).select('id, slug').single();
    if (error) throw error;
    res.json({ post: data });
  } catch (err) {
    console.error('admin blog create:', err);
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/admin/blog/:id', requireAdmin, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Not configured.' });
    const b = req.body || {};
    const updates = {};
    if (b.slug != null) updates.slug = b.slug;
    if (b.title_de != null) updates.title_de = b.title_de;
    if (b.title_en != null) updates.title_en = b.title_en;
    if (b.excerpt_de != null) updates.excerpt_de = b.excerpt_de;
    if (b.excerpt_en != null) updates.excerpt_en = b.excerpt_en;
    if (b.content_de != null) updates.content_de = b.content_de;
    if (b.content_en != null) updates.content_en = b.content_en;
    if (b.cover_image_url !== undefined) updates.cover_image_url = b.cover_image_url || null;
    if ('published_at' in b) updates.published_at = b.published_at || null;
    const { data, error } = await supabase.from('blog_posts').update(updates).eq('id', req.params.id).select('id, slug').single();
    if (error) throw error;
    res.json({ post: data });
  } catch (err) {
    console.error('admin blog update:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/blog/:id', requireAdmin, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Not configured.' });
    const { error } = await supabase.from('blog_posts').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Serve built frontend + SPA fallback ──────────────────────────────────────
const distPath = join(__dirname, '..', 'dist');

// Prerenderte Seiten zuerst: für die Routen aus der sitemap.xml liegt nach dem Build ein
// fertiger HTML-Schnappschuss unter dist/<route>/index.html (scripts/prerender.mjs).
// Ohne diesen Block würde der SPA-Fallback weiter unten die leere Hülle ausliefern —
// dann wäre der ganze Prerender-Schritt wirkungslos, und zwar unbemerkt, weil beides 200
// antwortet.
//
// Warum nicht einfach express.static das erledigen lassen: static antwortet auf ein
// Verzeichnis mit einer 301 auf die Fassung MIT Schrägstrich. Verlinkt und in der Sitemap
// steht aber die Fassung OHNE — jeder Direktaufruf und jeder Crawler liefe erst über eine
// Weiterleitung. Deshalb hier direkt ausliefern und `redirect: false` darunter.
app.get('*', (req, res, next) => {
  if (req.path === '/' || req.path.startsWith('/api/')) return next();

  // Nur harmlose Routennamen. Diese Prüfung ist der Schutz gegen Pfad-Ausbrüche wie
  // `/../../etc/passwd`: erlaubt sind ausschliesslich Buchstaben, Ziffern, Bindestrich,
  // Unterstrich und Schrägstrich — ein Punkt kommt gar nicht erst durch. Das ergäbe sich
  // nebenbei auch aus einem Dateiendungs-Filter, aber Sicherheit als Nebenwirkung hält
  // nur, bis jemand den Filter aus einem anderen Grund lockert.
  const route = req.path.replace(/^\/+|\/+$/g, '');
  if (!/^[A-Za-z0-9\-_]+(?:\/[A-Za-z0-9\-_]+)*$/.test(route)) return next();

  const datei = join(distPath, route, 'index.html');
  if (existsSync(datei)) return res.sendFile(datei);
  next(); // kein Schnappschuss (z.B. Build ohne Prerender) → normaler SPA-Weg
});

app.use(express.static(distPath, { redirect: false }));

/**
 * Echte 404 statt Startseite.
 *
 * Vorher beantwortete der SPA-Fallback JEDE unbekannte URL mit Status 200 und der
 * Startseite. Seit dem Prerender ist das gewichtiger geworden: früher bekam ein Crawler
 * dort eine leere Hülle, jetzt den vollständigen Startseiteninhalt — dieselbe Seite unter
 * beliebig vielen Adressen.
 *
 * ⚠️ Die Liste stammt aus App.tsx, NICHT aus der sitemap.xml. Ein Prerender-Schnappschuss
 * ist kein Existenznachweis für eine Route: `/artist` und `/join/start` sind echte Seiten
 * ohne Sitemap-Eintrag, und `/show/:slug` ist der Umsatzpfad der Agentur. Wer hier die
 * Sitemap als Wahrheit nimmt, setzt jede einzelne Showseite auf 404.
 *
 * ⚠️ Diese Prüfung MUSS nach express.static stehen. Davor würde sie /assets/*, /llms.txt,
 * /robots.txt und /sitemap.xml mit 404 beantworten — also die Seite weiß machen.
 */
const SEITEN = new Set([
  '', 'catalog', 'blog', 'about', 'impressum', 'datenschutz', 'join', 'join/start', 'artist',
]);

/**
 * Parametrisierte Routen: Präfix erlaubt, Wert ungeprüft.
 *
 * Bewusst offen gelassen: Ob eine Show-Slug wirklich existiert, weiß nur die Datenbank.
 * Eine Abfrage pro Anfrage wäre ein Roundtrip auf dem Umsatzpfad, und ein Fehlgriff dort
 * kostet eine echte Buchung — teurer als das, was hier gewonnen wird. Erfundene Adressen
 * unter diesen Präfixen antworten deshalb weiterhin mit 200 und der Hülle.
 *
 * Billige Verschärfung, falls das später stört: die Slug-Menge einmal beim Start laden und
 * im Speicher halten (Set-Lookup statt DB-Runde); dann muss beim Anlegen einer Show der
 * Speicher aufgefrischt werden. Erst tun, wenn jemand das Problem tatsächlich hat.
 */
const PRAEFIXE = ['show', 'blog', 'results', 'admin'];

app.get('*', (req, res) => {
  const pfad = req.path.replace(/^\/+|\/+$/g, ''); // /about/ und /about sind dieselbe Seite
  const ersterTeil = pfad.split('/')[0];
  const bekannt = SEITEN.has(pfad) || PRAEFIXE.includes(ersterTeil);

  if (bekannt) return res.sendFile(join(distPath, 'index.html'));

  const fehlerseite = join(distPath, '404.html');
  if (existsSync(fehlerseite)) return res.status(404).sendFile(fehlerseite);
  res.status(404).type('text/plain').send('404 — Seite nicht gefunden');
});
// ─────────────────────────────────────────────────────────────────────────────

async function ensureStorageBucket() {
  if (!supabase) return;
  try {
    await supabase.storage.createBucket('submissions-media', { public: true });
    console.log('Created storage bucket: submissions-media');
  } catch (e) {
    if (e?.message?.includes('already exists')) return;
    console.warn('Storage bucket setup:', e?.message || e);
  }
}

ensureStorageBucket().then(() => {
  app.listen(PORT, () => {
    console.log(`Berlintina backend running at http://localhost:${PORT}`);
    console.log(`AI: ${useOpenAI ? 'OpenAI' : useGemini ? 'Gemini' : 'mock (no keys)'}`);
    console.log(`Submissions: ${supabase ? 'enabled' : 'disabled (no Supabase)'}`);
  });
});
