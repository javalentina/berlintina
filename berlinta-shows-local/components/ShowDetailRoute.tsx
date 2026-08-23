import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageSEO } from './PageSEO';
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

/** Try to find answer in show text (FAQ, facts, pitch) — matches any word of the query */
function findInShowText(show: Show, question: string, locale: string): string | null {
  const words = question.toLowerCase().trim().split(/\s+/).filter(w => w.length >= 2);
  if (words.length === 0) return null;

  // FAQ fields with keyword triggers — matched against any query word
  const faqMap: { keywords: string[]; value?: string }[] = [
    { keywords: ['outdoor', 'draußen', 'außen', 'open', 'air', 'außerhalb', 'outside'], value: show.faqOutdoor },
    { keywords: ['bühne', 'stage', 'fläche', 'space', 'größe', 'size', 'platz', 'floor', 'bühnengröße'], value: show.faqStage },
    { keywords: ['sprache', 'language', 'deutsch', 'englisch', 'english', 'french', 'sprachlos', 'wortlos'], value: show.faqLanguage },
    { keywords: ['anpassen', 'branding', 'theme', 'custom', 'individuell', 'ändern', 'modify', 'logo'], value: show.faqCustom },
    { keywords: ['reise', 'travel', 'anreise', 'kommen', 'fahren', 'come', 'reach', 'available', 'verfügbar'], value: show.faqTravel },
    { keywords: ['aufbau', 'abbau', 'soundcheck', 'timing', 'dauer', 'duration', 'how', 'long', 'lange', 'zeit', 'time'], value: show.timingsShort },
    { keywords: ['veranstalter', 'promoter', 'braucht', 'need', 'needs', 'requirement', 'technical', 'technisch', 'rider'], value: (show as Record<string, unknown>).faqPromoterNeeds as string | undefined },
  ];

  for (const { keywords, value } of faqMap) {
    if (words.some(w => keywords.some(k => k.includes(w) || w.includes(k))) && value && !isGenericAnswer(value, locale)) {
      return value;
    }
  }

  // Full-text search: score each text block by how many query words it contains
  const blocks: string[] = [
    show.shortDescriptionFacts,
    show.salesPitchText,
    (show.vibeTags ?? []).join(', '),
    (show.extractedTags ?? []).join(', '),
  ].filter((t): t is string => !!t && t.trim().length > 0);

  let best: { text: string; score: number } | null = null;
  for (const text of blocks) {
    const lower = text.toLowerCase();
    const score = words.filter(w => lower.includes(w)).length;
    if (score > 0 && (!best || score > best.score)) {
      best = { text, score };
    }
  }

  if (best && !isGenericAnswer(best.text, locale)) {
    return best.text.length > 320 ? best.text.slice(0, 320) + '…' : best.text;
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
    <div className="bg-card border border-border p-6">
      <h3 className="font-display font-bold text-sm text-foreground mb-3">{locale === 'de' ? 'Frage zur Show' : 'Ask about this show'}</h3>
      <input
        type="text"
        placeholder={locale === 'de' ? 'z. B. Outdoor möglich?' : 'e.g. Can they play outdoors?'}
        className="w-full px-4 py-3 border border-border bg-background text-foreground text-sm mb-3 focus:outline-none focus:border-foreground transition"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
      />
      <button onClick={handleAsk} disabled={loading} className="w-full py-3 bg-secondary text-foreground font-bold text-xs hover:bg-muted transition disabled:opacity-50">
        {loading ? '…' : (locale === 'de' ? 'Fragen' : 'Ask')}
      </button>
      {answer && (
        <div className="mt-4">
          <p className="text-sm text-muted-foreground whitespace-pre-line">{answer}</p>
          {needsEmail && !emailSent && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs font-medium text-muted-foreground mb-2">{locale === 'de' ? 'Deine E-Mail (für Rückmeldung):' : 'Your email (for reply):'}</p>
              <div className="flex gap-2">
                <input type="email" placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="flex-1 px-3 py-2 border border-border bg-background text-foreground text-sm focus:outline-none focus:border-foreground transition" />
                <button onClick={handleEmailSubmit} disabled={!email.includes('@')} className="px-4 py-2 bg-foreground text-background text-xs font-bold hover:opacity-90 disabled:opacity-50">
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

  // SEO is handled declaratively via <PageSEO> in the render below

  if (detailLoading || (showsLoading && !show)) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-32 text-center text-muted-foreground font-medium">
        {locale === 'de' ? 'Lade Show…' : 'Loading show…'}
      </div>
    );
  }
  if (detailError) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-32 text-center">
        <p className="text-amber-600 font-medium mb-4">{detailError}</p>
        <button onClick={() => navigate(-1)} className="px-6 py-2 bg-muted text-foreground font-medium hover:opacity-80 transition">
          Zurück
        </button>
      </div>
    );
  }
  if (!show) return <div className="p-20 text-center font-bold text-muted-foreground">Show nicht gefunden.</div>;

  const showDescription = (show.salesPitchText || show.shortDescriptionFacts || '').slice(0, 160);
  const priceMin = show.priceMin ?? show.priceMax;

  /**
   * `show.category` ist eine Enum-Schreibweise (`ACROBATICS`) — für einen Datensatz
   * gedacht, nicht für Leser. Hier wird NUR die Schreibweise normalisiert. Eine
   * Übersetzung wäre erfunden: das deutsche Label existiert bisher allein als lokale
   * Filterliste in App.tsx und deckt nicht alle Kategorien ab.
   */
  const serviceType = String(show.category)
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <>
      <PageSEO
        title={`${show.title} | Berlintina Berlin`}
        description={showDescription || `${show.title} – persönlich kuratierter Showact aus Berlin. Jetzt anfragen über Berlintina.`}
        ogImage={show.photoUrls?.[0]}
        ogType="article"
        /**
         * Schema: Service, nicht PerformingArtsTheater.
         *
         * `PerformingArtsTheater` ist in schema.org ein ORT (Unterklasse von
         * CivicStructure/LocalBusiness) — ein Theatergebäude, keine Darbietung. Auf einer
         * Showseite stand damit sinngemäß „diese Show ist ein Theater in Berlin". Dazu
         * trug der Datensatz `performer`, `organizer` und `offers`: allesamt Eigenschaften,
         * die es an einem Ort/LocalBusiness nicht gibt (`Organization` kennt `makesOffer`,
         * nicht `offers`). Der Block war also nicht nur schief, sondern in Teilen ungültig
         * — ein Crawler verwirft ihn oder liest ihn widersprüchlich.
         *
         * Warum NICHT `Event`/`TheaterEvent`, obwohl es naheliegt: eine Show hat hier
         * keinen Termin. Das Feld `eventDate` sitzt an `CustomerBrief` (types.ts) — es ist
         * die Frage „wann soll das stattfinden", nicht die Angabe „das findet statt".
         * `startDate` ist bei Google für Event aber Pflichtfeld; ein Event ohne Datum wird
         * als fehlerhaft abgelehnt. Wir hätten eine falsche Auszeichnung gegen eine
         * ungültige getauscht. Sobald eine Show ein echtes Datum trägt, ist `TheaterEvent`
         * für genau diese Seiten der richtige nächste Schritt — dann bedingt, nicht pauschal.
         *
         * `Service` trägt `provider`, `serviceType`, `areaServed`, `broker` und `offers`
         * legal und verlangt kein Feld, das die Daten nicht haben.
         *
         * ⚠️ Das `offers`-Objekt bleibt absichtlich UNVERÄNDERT (dieselben Felder, derselbe
         * Preis). Es stammt aus `8883ab5` und ist eine bestehende Entscheidung der
         * Eigentümerin — sie hier zu ändern oder zu entfernen wäre ein Eingriff in eine
         * Preisfrage, die nicht an diesem Schema hängt.
         */
        structuredData={{
          '@context': 'https://schema.org',
          '@type': 'Service',
          name: show.title,
          description: showDescription,
          image: show.photoUrls?.[0],
          url: `https://berlintina.de/show/${show.slug}`,
          serviceType,
          areaServed: {
            '@type': 'City',
            name: 'Berlin',
            address: { '@type': 'PostalAddress', addressLocality: 'Berlin', addressCountry: 'DE' },
          },
          provider: {
            '@type': 'PerformingGroup',
            name: show.artistName,
            description: show.shortDescriptionFacts,
          },
          broker: { '@type': 'Organization', name: 'Berlintina', url: 'https://berlintina.de' },
          ...(priceMin != null ? {
            offers: {
              '@type': 'Offer',
              price: priceMin,
              priceCurrency: 'EUR',
              availability: 'https://schema.org/InStock',
              url: `https://berlintina.de/show/${show.slug}`,
            },
          } : {}),
          /**
           * `keywords` gab es an der alten LocalBusiness-Fassung (über `Organization`),
           * an `Service` ist es nicht definiert — `category` schon. Gleicher Inhalt,
           * gültiges Feld; sonst hätten wir denselben Fehler im Kleinen wiederholt.
           */
          category: [show.category, ...(show.extractedTags ?? []), ...(show.vibeTags ?? [])].join(', '),
        }}
      />
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
    />
    </>
  );
};
