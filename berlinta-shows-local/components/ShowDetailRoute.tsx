import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Show } from '../types';
import { useShows } from '../contexts/ShowsContext';
import { fetchShowByShortId, fetchShowBySlug } from '../services/showsService';
import { submitContactRequest } from '../services/contactService';
import * as apiClient from '../services/apiClient';
import { ShowDetailPage } from './ShowDetailPage';

/** Check if answer looks like "we don't know" / generic fallback */
function isGenericAnswer(text: string, locale: string): boolean {
  const lower = text.toLowerCase();
  const generic = ['details auf anfrage', 'on request', 'konnte nicht', 'could not', 'don\'t know', 'weiß ich nicht', 'contact the artist', 'kontaktieren sie'];
  return generic.some(g => lower.includes(g));
}

/** Try to find answer in show text (FAQ, facts, pitch) */
function findInShowText(show: Show, question: string, locale: string): string | null {
  const q = question.toLowerCase().trim();
  const faqMap: { keywords: string[]; value?: string }[] = [
    { keywords: ['outdoor', 'draußen', 'außen', 'open air'], value: show.faqOutdoor },
    { keywords: ['bühne', 'stage', 'fläche', 'space', 'größe', 'size'], value: show.faqStage },
    { keywords: ['sprache', 'language', 'deutsch', 'englisch', 'english'], value: show.faqLanguage },
    { keywords: ['anpassen', 'branding', 'theme', 'custom'], value: show.faqCustom },
    { keywords: ['reise', 'travel', 'anreise', 'kommen'], value: show.faqTravel },
  ];
  for (const { keywords, value } of faqMap) {
    if (keywords.some(k => q.includes(k)) && value && !isGenericAnswer(value, locale)) {
      return value;
    }
  }
  const allText = [show.shortDescriptionFacts, show.salesPitchText].filter(Boolean).join(' ').toLowerCase();
  if (allText && q.length >= 4 && allText.includes(q.slice(0, Math.min(10, q.length)))) {
    return null;
  }
  return null;
}

// --- Show Q&A Widget (EPIC 3.3) ---
const ShowQAWidget: React.FC<{ show: Show; locale: 'de' | 'en' }> = ({ show, locale }) => {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [needsEmail, setNeedsEmail] = useState(false);
  const [email, setEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);

  const handleAsk = async () => {
    if (!question.trim()) return;
    setLoading(true);
    setAnswer(null);
    setNeedsEmail(false);
    try {
      const found = findInShowText(show, question, locale);
      if (found) {
        setAnswer(found);
        setLoading(false);
        return;
      }
      const facts = `${show.title} – ${show.shortDescriptionFacts} ${show.salesPitchText} Dauer: ${show.durationMinutes} Min. FAQ: Outdoor: ${show.faqOutdoor || '-'} Stage: ${show.faqStage || '-'} Language: ${show.faqLanguage || '-'}`;
      const text = await apiClient.answerShowQuestion(question.trim(), facts, locale);
      if (isGenericAnswer(text, locale)) {
        setAnswer(locale === 'de' ? 'Diese Info haben wir noch nicht. Gib uns deine E-Mail – wir fragen nach und melden uns bei dir.' : "We don't have this info yet. Give us your email – we'll ask and get back to you.");
        setNeedsEmail(true);
      } else {
        setAnswer(text);
      }
    } catch {
      setAnswer(locale === 'de' ? 'Konnte nicht beantwortet werden.' : 'Could not answer.');
      setNeedsEmail(true);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async () => {
    if (!email.trim() || !email.includes('@')) return;
    try {
      await submitContactRequest({
        showId: show.id,
        showTitle: show.title,
        requesterName: `Q&A: ${question}`,
        requesterEmail: email.trim(),
        message: `Frage: ${question}`,
      });
      setEmailSent(true);
    } catch {
      setAnswer(locale === 'de' ? 'Fehler beim Senden. Bitte versuche es erneut.' : 'Error sending. Please try again.');
    }
  };

  return (
    <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-2xl p-6">
      <h3 className="font-bold text-sm mb-3">{locale === 'de' ? 'Frage zur Show' : 'Ask about this show'}</h3>
      <input
        type="text"
        placeholder={locale === 'de' ? 'z. B. Outdoor möglich?' : 'e.g. Can they play outdoors?'}
        className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm mb-3 focus:outline-none focus:border-black"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
      />
      <button onClick={handleAsk} disabled={loading} className="w-full py-3 bg-[#f1f1ef] rounded-xl font-bold text-xs hover:bg-gray-200 transition disabled:opacity-50">
        {loading ? '…' : (locale === 'de' ? 'Fragen' : 'Ask')}
      </button>
      {answer && (
        <div className="mt-4">
          <p className="text-sm text-gray-600 whitespace-pre-line">{answer}</p>
          {needsEmail && !emailSent && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs font-medium text-gray-500 mb-2">{locale === 'de' ? 'Deine E-Mail (für Rückmeldung):' : 'Your email (for reply):'}</p>
              <div className="flex gap-2">
                <input type="email" placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
                <button onClick={handleEmailSubmit} disabled={!email.includes('@')} className="px-4 py-2 bg-black text-white rounded-lg text-xs font-bold hover:opacity-90 disabled:opacity-50">
                  {locale === 'de' ? 'Senden' : 'Send'}
                </button>
              </div>
            </div>
          )}
          {emailSent && <p className="mt-2 text-xs text-green-600 font-medium">{locale === 'de' ? '✓ Wir melden uns bei dir.' : '✓ We\'ll get back to you.'}</p>}
        </div>
      )}
    </div>
  );
};

// --- Show Detail View ---
export const ShowDetail: React.FC<{ locale: 'de' | 'en' }> = ({ locale }) => {
  const { shows, loading: showsLoading } = useShows();
  const { slugShortId } = useParams();
  const [show, setShow] = useState<Show | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [contactMode, setContactMode] = useState<'options' | 'form' | 'success'>('options');
  const [contactForm, setContactForm] = useState({ name: '', email: '', message: '', eventDate: '' });
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!show || contactSubmitting) return;
    const name = contactForm.name.trim();
    const email = contactForm.email.trim();
    if (!name || !email.includes('@')) {
      setContactError(locale === 'de' ? 'Name und gültige E-Mail sind erforderlich.' : 'Name and valid email are required.');
      return;
    }
    setContactSubmitting(true);
    setContactError(null);
    try {
      const result = await submitContactRequest({
        showId: show.id,
        showTitle: show.title,
        requesterName: name,
        requesterEmail: email,
        message: contactForm.message.trim() || undefined,
        eventDate: contactForm.eventDate.trim() || undefined,
      });
      if (result.success) setContactMode('success');
      else setContactError(result.error || (locale === 'de' ? 'Fehler beim Senden.' : 'Failed to send.'));
    } catch {
      setContactError(locale === 'de' ? 'Fehler beim Senden.' : 'Failed to send.');
    } finally {
      setContactSubmitting(false);
    }
  };

  useEffect(() => {
    if (!slugShortId) return;
    // Try exact slug match first (clean SEO URLs like /show/berlintina-cello-trio)
    const foundBySlug = shows.find(s => s.slug === slugShortId);
    if (foundBySlug) {
      setShow(foundBySlug);
      setDetailError(null);
      setDetailLoading(false);
      return;
    }
    // Backward compat: try shortId extracted from last segment (old format: title-shortId)
    const shortId = slugShortId.split('-').pop();
    if (shortId) {
      const foundById = shows.find(s => s.shortId === shortId);
      if (foundById) {
        setShow(foundById);
        setDetailError(null);
        setDetailLoading(false);
        return;
      }
    }
    if (showsLoading) return;
    setDetailLoading(true);
    // Fetch from API: try slug first, then shortId fallback
    fetchShowBySlug(slugShortId).then(({ show: s, error }) => {
      if (s) {
        setShow(s);
        setDetailError(null);
        setDetailLoading(false);
      } else if (shortId) {
        fetchShowByShortId(shortId).then(({ show: s2, error: e2 }) => {
          setShow(s2 ?? null);
          setDetailError(e2 ?? null);
          setDetailLoading(false);
        });
      } else {
        setShow(null);
        setDetailError(error ?? null);
        setDetailLoading(false);
      }
    });
  }, [slugShortId, shows, showsLoading]);

  if (detailLoading || (showsLoading && !show)) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-32 text-center text-gray-500 font-medium">
        {locale === 'de' ? 'Lade Show…' : 'Loading show…'}
      </div>
    );
  }
  if (detailError) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-32 text-center">
        <p className="text-amber-600 font-medium mb-4">{detailError}</p>
        <button onClick={() => navigate(-1)} className="px-6 py-2 bg-gray-100 rounded-xl font-medium hover:bg-gray-200">
          Zurück
        </button>
      </div>
    );
  }
  if (!show) return <div className="p-20 text-center font-bold text-gray-300">Show nicht gefunden.</div>;

  return (
    <ShowDetailPage
      show={show}
      locale={locale}
      contactMode={contactMode}
      contactForm={contactForm}
      contactSubmitting={contactSubmitting}
      contactError={contactError}
      onContactModeChange={setContactMode}
      onContactFormChange={setContactForm}
      onContactSubmit={handleContactSubmit}
    >
      <ShowQAWidget show={show} locale={locale} />
    </ShowDetailPage>
  );
};
