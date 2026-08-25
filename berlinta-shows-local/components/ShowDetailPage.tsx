import React, { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Show } from '../types';
import { Clock, Users, ChevronDown, ChevronUp, ArrowLeft } from 'lucide-react';

// Set your WhatsApp number here (international format, no +, no spaces: e.g. '4917612345678')
const WHATSAPP_NUMBER = (typeof import.meta !== 'undefined' && (import.meta as Record<string, unknown>).env)
  ? ((import.meta as Record<string, Record<string, string>>).env.VITE_WHATSAPP || '')
  : '';
const waLink = (title: string, locale: 'de' | 'en') =>
  WHATSAPP_NUMBER
    ? `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(locale === 'de' ? `Hallo! Ich interessiere mich für die Show: ${title}` : `Hi! I'm interested in the show: ${title}`)}`
    : '';

const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

function getVideoEmbedUrl(url: string, preview15s = false): string | null {
  try {
    const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (ytMatch) {
      const base = `https://www.youtube.com/embed/${ytMatch[1]}`;
      return preview15s ? `${base}?rel=0&start=0&end=15` : `${base}?rel=0`;
    }
    const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    return null;
  } catch { return null; }
}

/**
 * Anzeigetext für den kuratierten Partner-Link: die blanke Domain, ohne `www.`.
 *
 * Bewusst abgeleitet statt gepflegt. Ein zweites Textfeld im CMS wäre eine Einladung,
 * Werbetext zu erfinden („Präsentiert von…"), und würde irgendwann von der URL abweichen.
 * Die Domain sagt dem Leser genau das, was er wissen muss: wohin der Klick führt.
 */
function linkBeschriftung(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

// ── Inline edit helper (admin only) ─────────────────────────────────────────
function InlineEdit({ value, onChange, as = 'textarea', className = '', placeholder = '—', rows = 4 }: {
  value: string; onChange: (v: string) => void;
  as?: 'input' | 'textarea'; className?: string; placeholder?: string; rows?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const save = () => { onChange(draft); setEditing(false); };
  React.useEffect(() => { if (!editing) setDraft(value); }, [value, editing]);

  if (editing) {
    const shared = {
      autoFocus: true, value: draft,
      onChange: (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => setDraft(e.target.value),
      onBlur: save,
      onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Escape') { setDraft(value); setEditing(false); } },
    };
    const editCls = 'w-full bg-amber-50 border-0 border-b-2 border-amber-400 outline-none p-0 resize-none';
    return as === 'input'
      ? <input {...shared} className={`${className} ${editCls}`} />
      : <textarea {...shared} rows={rows} className={`${className} ${editCls}`} />;
  }

  return (
    <div className="group/ie relative cursor-pointer" onClick={() => { setDraft(value); setEditing(true); }}>
      <span className={`${className} ${!value ? 'opacity-30 italic !text-base' : ''}`}>{value || placeholder}</span>
      <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-amber-400 text-white text-xs flex items-center justify-center shadow-lg opacity-0 group-hover/ie:opacity-100 transition-opacity pointer-events-none z-20 select-none">✏</span>
    </div>
  );
}

function FAQAccordionItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full px-0 py-5 flex items-center justify-between text-left font-medium text-sm text-foreground hover:text-muted-foreground transition-colors"
      >
        <span>{question}</span>
        {open
          ? <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0 ml-3" />
          : <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0 ml-3" />}
      </button>
      {open && (
        <div className="pb-5 pt-1 text-sm text-muted-foreground whitespace-pre-line">
          {answer}
        </div>
      )}
    </div>
  );
}

const priceRangeFromShow = (show: Show): string => {
  if (show.priceType === 'POA') return '€€€';
  if (show.priceMin != null) {
    if (show.priceMin < 800) return '€€';
    if (show.priceMin < 2000) return '€€€';
    return '€€€€';
  }
  return '€€€';
};

export interface ShowEditProps {
  onTitleChange: (v: string) => void;
  onDescChange: (v: string) => void;
  onPitchChange: (v: string) => void;
  onPhotoAdd: (url: string) => void;
  onPhotoRemove: (i: number) => void;
  onPhotoMove: (i: number, dir: -1 | 1) => void;
}

interface Props {
  show: Show;
  locale: 'de' | 'en';
  contactMode: 'options' | 'form' | 'success';
  contactForm: { name: string; email: string; message: string; eventDate: string };
  contactSubmitting: boolean;
  contactError: string | null;
  onContactModeChange: (mode: 'options' | 'form' | 'success') => void;
  onContactFormChange: (form: { name: string; email: string; message: string; eventDate: string }) => void;
  onContactSubmit: (e: React.FormEvent) => void;
  editProps?: ShowEditProps;
  children?: React.ReactNode;
}

export const ShowDetailPage: React.FC<Props> = ({
  show, locale, contactMode, contactForm, contactSubmitting, contactError,
  onContactModeChange, onContactFormChange, onContactSubmit, editProps,
}) => {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  const [newPhotoUrl, setNewPhotoUrl] = useState('');
  const photos = show.photoUrls || [];
  const videos = show.videoUrls || [];
  const videoEmbeds = videos.map(u => getVideoEmbedUrl(u, false)).filter((u): u is string => !!u);
  const videoPreviewUrl = videoEmbeds[0] ? getVideoEmbedUrl(videos[0], true) : null;

  /**
   * Preisangabe mit Steuerhinweis.
   *
   * Bisher stand hier nur „ab 800€" — ohne jeden Hinweis, ob das mit oder ohne Umsatzsteuer
   * gemeint ist. Die Beträge sind NETTO (Entscheid John, 23.08.2026). Für gewerbliche
   * Kunden ist das die übliche Angabe; buchen aber auch Privatpersonen, muss der Endpreis
   * erkennbar sein (Preisangabenverordnung). Deshalb beides: „netto" direkt am Betrag,
   * und der Bruttowert als eigene, kleine Zeile im Preisblock.
   *
   * Der Bruttowert wird gerechnet, nicht gepflegt — eine zweite gepflegte Zahl würde
   * irgendwann von der ersten abweichen. Kaufmännisch gerundet; bei 800 € geht es glatt auf.
   *
   * ⚠️ MWST_SATZ steht bewusst als benannte Konstante an EINER Stelle: künstlerische
   * Leistungen können je nach Vertragsgestaltung dem ermäßigten Satz unterliegen. Wenn die
   * Steuerberatung das für diese Vermittlungen sagt, ist es hier eine Zahl.
   */
  const MWST_SATZ = 0.19;
  const brutto = (netto: number) => Math.round(netto * (1 + MWST_SATZ));

  const priceLabel = show.priceType === 'POA'
    ? (locale === 'de' ? 'Auf Anfrage' : 'On request')
    : show.priceMin != null
      ? `${locale === 'de' ? 'ab' : 'from'} ${show.priceMin}€ ${locale === 'de' ? 'netto' : 'net'}`
      : show.priceMax != null
        ? `≤ ${show.priceMax}€ ${locale === 'de' ? 'netto' : 'net'}`
        : null;

  const priceTaxNote = show.priceType === 'POA'
    ? null
    : (show.priceMin ?? show.priceMax) != null
      ? (locale === 'de'
          ? `entspricht ${brutto((show.priceMin ?? show.priceMax)!)}€ inkl. ${MWST_SATZ * 100} % MwSt.`
          : `= €${brutto((show.priceMin ?? show.priceMax)!)} incl. ${MWST_SATZ * 100}% VAT`)
      : null;

  React.useEffect(() => {
    if (lightboxIndex !== null) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [lightboxIndex]);

  React.useEffect(() => {
    if (lightboxIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxIndex(null);
      if (photos.length <= 1) return;
      if (e.key === 'ArrowLeft') setLightboxIndex((i) => (i === 0 ? photos.length - 1 : i! - 1));
      if (e.key === 'ArrowRight') setLightboxIndex((i) => (i === photos.length - 1 ? 0 : i! + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxIndex, photos.length]);

  React.useEffect(() => {
    document.title = `${show.title} — berlintina.de`;
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', `${show.title} — ${show.shortDescriptionFacts?.slice(0, 120) || 'Show booking Berlin'}`.slice(0, 160));
    return () => {
      document.title = 'Berlintina Shows';
      if (meta) meta.setAttribute('content', 'Berlintina Shows – Find curated live performances in Berlin.');
    };
  }, [show.title, show.shortDescriptionFacts]);

  const openContact = useCallback(() => onContactModeChange('form'), [onContactModeChange]);

  const t = locale === 'de'
    ? {
        back: '← Zurück zu Shows', cta: 'Jetzt anfragen', book: 'Show anfragen',
        duration: 'Dauer', cast: 'Besetzung', idealFor: 'Ideal für',
        outdoor: 'Outdoor', travel: 'Reise', languages: 'Sprache',
        about: 'Über die Show', whyItWorks: 'Warum es funktioniert',
        gallery: 'Galerie', video: 'Video', faq: 'FAQ',
        onRequest: 'Auf Anfrage', interested: 'Interesse?',
        sidebarSub: 'Kostenlose Anfrage · Antwort in 24h',
        requestQuote: 'Anfrage senden →',
        trustLine: '✓ 0% Provision · Persönlich geprüft · Keine Wartezeiten',
        faqOutdoor: 'Outdoor möglich?', faqStage: 'Wie groß muss die Bühne sein?',
        faqTiming: 'Wie lange dauert Aufbau / Soundcheck / Abbau?',
        faqLanguage: 'Ist die Show sprachabhängig?', faqCustom: 'Kann man die Show anpassen?',
        faqPromoterNeeds: 'Was braucht ihr vom Veranstalter?', faqTravel: 'Reist ihr an?', faqAnswer: 'Details auf Anfrage.',
        name: 'Dein Name', email: 'E-Mail', eventDate: 'Event-Datum (optional)',
        message: 'Nachricht', sendRequest: 'Anfrage senden', sending: 'Wird gesendet…',
        cancel: 'Abbrechen', thanks: 'Vielen Dank! Wir melden uns bei dir.',
        another: 'Weitere Anfrage', formPlaceholder: 'z. B. Outdoor möglich? Bühne 6×4m?',
        grandHeadline: 'Bereit, diese Show zu buchen?',
        grandSub: 'Sende uns deine Event-Details — wir melden uns innerhalb von 24 Stunden.',
        contactAufnehmen: 'Kontakt aufnehmen',
        greetTitle: 'Schön, dass du da bist!',
        greetSub: 'Schick uns kurz deine Infos – wir melden uns zeitnah.',
        steps: ['Anfrage senden (2 Min)', 'Antwort innerhalb von 24 Stunden', 'Direkt mit dem Künstler buchen — 0% Provision'],
        aboutArtist: 'Über die Künstler',
        artistBio: show.salesPitchText,
        highlights: 'Highlights',
        price: 'Preis',
        kategorie: 'Kategorie',
      }
    : {
        back: '← Back to Shows', cta: 'Request availability', book: 'Book This Show',
        duration: 'Duration', cast: 'Cast', idealFor: 'Best for',
        outdoor: 'Outdoor', travel: 'Travel', languages: 'Language',
        about: 'About this show', whyItWorks: 'Why it works',
        gallery: 'Gallery', video: 'Video', faq: 'FAQ',
        onRequest: 'On request', interested: 'Interested?',
        sidebarSub: 'Free inquiry · Reply within 24h',
        requestQuote: 'Request a Quote →',
        trustLine: '✓ 0% commission · Personally reviewed · No waiting',
        faqOutdoor: 'Outdoor possible?', faqStage: 'How big must the stage be?',
        faqTiming: 'How long for load-in / soundcheck / strike?',
        faqLanguage: 'Is the show language-dependent?', faqCustom: 'Can the show be adapted?',
        faqPromoterNeeds: 'What do you need from the promoter?', faqTravel: 'Do you travel?', faqAnswer: 'Details on request.',
        name: 'Your name', email: 'Email', eventDate: 'Event date (optional)',
        message: 'Message', sendRequest: 'Send request', sending: 'Sending…',
        cancel: 'Cancel', thanks: 'Thank you! We will get back to you.',
        another: 'Another inquiry', formPlaceholder: 'e.g. Outdoor possible? Stage 6×4m?',
        grandHeadline: 'Ready to book this show?',
        grandSub: "Send us your event details — we'll get back to you within 24 hours.",
        contactAufnehmen: 'Get in touch',
        greetTitle: "Great you're here!",
        greetSub: "Send us a quick note – we'll get back to you soon.",
        steps: ['Send request (2 min)', 'Reply within 24 hours', 'Book directly with the artist — 0% commission'],
        aboutArtist: 'About the artist',
        artistBio: show.salesPitchText,
        highlights: 'Highlights',
        price: 'Price',
        kategorie: 'Category',
      };

  const faqItems = [
    show.faqOutdoor   && { q: t.faqOutdoor,  a: show.faqOutdoor },
    show.faqStage     && { q: t.faqStage,    a: show.faqStage },
    show.timingsShort && { q: t.faqTiming,   a: show.timingsShort },
    show.faqLanguage  && { q: t.faqLanguage, a: show.faqLanguage },
    show.faqCustom    && { q: t.faqCustom,   a: show.faqCustom },
    show.faqTravel    && { q: t.faqTravel,   a: show.faqTravel },
  ].filter((x): x is { q: string; a: string } => !!x);

  const activePhoto = photos[activePhotoIdx] || photos[0];

  return (
    <div className="min-h-screen bg-background pb-28">

      {/* ── Back link (hidden in admin/edit mode) ── */}
      {!editProps && (
        <div className="container pt-20 sm:pt-24 pb-6">
          <Link
            to="/catalog"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors no-underline"
          >
            <ArrowLeft className="w-4 h-4" />
            {t.back}
          </Link>
        </div>
      )}

      {/* ── Main 12-col grid ── */}
      <div className={`container ${editProps ? 'pt-6' : 'pt-0'}`}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">

          {/* ── LEFT: Image col (7 cols) ── */}
          <div className="lg:col-span-7">
            {/* Main image or placeholder */}
            {activePhoto ? (
              <div className="relative overflow-hidden border border-border mb-4 group/photo">
                <img
                  src={activePhoto}
                  alt={show.title}
                  className={`w-full aspect-[4/3] object-cover ${!editProps ? 'cursor-pointer' : ''}`}
                  onClick={() => !editProps && setLightboxIndex(activePhotoIdx)}
                />
                {editProps && (
                  <button
                    onClick={() => editProps.onPhotoRemove(activePhotoIdx)}
                    className="absolute top-2 right-2 w-8 h-8 bg-red-500 text-white rounded-full text-sm flex items-center justify-center shadow opacity-0 group-hover/photo:opacity-100 transition"
                    title="Remove photo"
                  >✕</button>
                )}
              </div>
            ) : editProps ? (
              <div className="aspect-[4/3] border-2 border-dashed border-gray-200 flex flex-col items-center justify-center bg-gray-50 mb-4 rounded-sm">
                <p className="text-sm text-gray-400 font-medium">Noch kein Foto</p>
                <p className="text-xs text-gray-300 mt-1">URL unten einfügen</p>
              </div>
            ) : null}

            {/* Thumbnail row */}
            {photos.length > 1 && (
              <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 mb-2">
                {photos.map((url, i) => (
                  <div key={i} className="relative flex-shrink-0 group/thumb">
                    <button
                      type="button"
                      onClick={() => setActivePhotoIdx(i)}
                      className={`w-20 h-16 overflow-hidden border transition-all ${
                        i === activePhotoIdx ? 'border-accent scale-105' : 'border-border hover:border-foreground/30'
                      }`}
                    >
                      <img src={url} alt={`${show.title} — ${i + 1}`} className="w-full h-full object-cover" />
                    </button>
                    {editProps && (
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/thumb:opacity-100 transition flex items-center justify-center gap-0.5">
                        {i > 0 && <button onClick={() => editProps.onPhotoMove(i, -1)} className="w-5 h-5 bg-white/90 text-gray-900 rounded text-[10px] font-bold">←</button>}
                        <button onClick={() => editProps.onPhotoRemove(i)} className="w-5 h-5 bg-red-500 text-white rounded text-[10px] font-bold">✕</button>
                        {i < photos.length - 1 && <button onClick={() => editProps.onPhotoMove(i, 1)} className="w-5 h-5 bg-white/90 text-gray-900 rounded text-[10px] font-bold">→</button>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Add photo URL (edit mode only) */}
            {editProps && (
              <div className="flex gap-2 mb-6">
                <input
                  type="text"
                  value={newPhotoUrl}
                  onChange={e => setNewPhotoUrl(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); const u = newPhotoUrl.trim(); if (u) { editProps.onPhotoAdd(u); setNewPhotoUrl(''); } } }}
                  placeholder="https://… Foto-URL einfügen"
                  className="flex-1 text-sm px-3 py-2 border border-dashed border-gray-300 rounded-lg bg-white outline-none focus:border-amber-400"
                />
                <button
                  type="button"
                  onClick={() => { const u = newPhotoUrl.trim(); if (u) { editProps.onPhotoAdd(u); setNewPhotoUrl(''); } }}
                  disabled={!newPhotoUrl.trim()}
                  className="px-3 py-2 bg-amber-400 text-white rounded-lg text-sm font-bold disabled:opacity-40 hover:bg-amber-500 transition"
                >+ Add</button>
              </div>
            )}

            {/* Video */}
            {videoPreviewUrl && (
              <div className="mt-8">
                <div className="relative w-full aspect-video overflow-hidden border border-border">
                  <iframe
                    src={videoPreviewUrl}
                    className="absolute inset-0 w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title="Video preview"
                  />
                </div>
                {videoEmbeds.length > 1 && (
                  <div className="relative w-full aspect-video overflow-hidden border border-border mt-4">
                    <iframe
                      src={videoEmbeds[1]}
                      className="absolute inset-0 w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      title="Video full"
                    />
                  </div>
                )}
              </div>
            )}

            {/* About the show */}
            {(show.shortDescriptionFacts || editProps) && (
              <section className="mt-10">
                <h2 className="font-display text-2xl font-bold text-foreground mb-4">{t.about}</h2>
                {editProps ? (
                  <InlineEdit
                    value={show.shortDescriptionFacts || ''}
                    onChange={editProps.onDescChange}
                    as="textarea"
                    rows={6}
                    className="text-base text-muted-foreground leading-relaxed whitespace-pre-line"
                    placeholder="Beschreibung eingeben…"
                  />
                ) : (
                  <p className="text-base text-muted-foreground leading-relaxed whitespace-pre-line">
                    {show.shortDescriptionFacts}
                  </p>
                )}
              </section>
            )}

            {/* Highlights / vibeTags */}
            {(show.vibeTags?.length ?? 0) > 0 && (
              <section className="mt-10">
                <h2 className="font-display text-2xl font-bold text-foreground mb-4">{t.highlights}</h2>
                <ul className="space-y-3">
                  {show.vibeTags.slice(0, 6).map((tag, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                      <span className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0 mt-2" />
                      {tag}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Artist bio */}
            {/* partnerLinkUrl gehört in die Bedingung: sonst verschluckt eine Show ohne
                Pitch-Text den Link mit, obwohl die Redaktion ihn gesetzt hat. */}
            {(show.salesPitchText || show.partnerLinkUrl || editProps) && (
              <section className="mt-10">
                <h2 className="font-display text-2xl font-bold text-foreground mb-4">{t.aboutArtist}</h2>
                {editProps ? (
                  <InlineEdit
                    value={show.salesPitchText || ''}
                    onChange={editProps.onPitchChange}
                    as="textarea"
                    rows={3}
                    className="text-base text-muted-foreground leading-relaxed whitespace-pre-line"
                    placeholder="Einzeiler für Eventplaner…"
                  />
                ) : (
                  <p className="text-base text-muted-foreground leading-relaxed whitespace-pre-line">
                    {show.salesPitchText}
                  </p>
                )}

                {/* Kuratierter Link nach außen (Issue #14). Erscheint nur, wenn die Redaktion
                    im CMS einen Wert gesetzt hat — ohne Wert steht hier nichts, die Seite sieht
                    dann exakt aus wie vorher. */}
                {show.partnerLinkUrl && (
                  <a
                    href={show.partnerLinkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-4 text-sm font-medium text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground transition-colors"
                  >
                    {linkBeschriftung(show.partnerLinkUrl)} →
                  </a>
                )}
              </section>
            )}

            {/* Testimonials */}
            {(show.testimonials?.length ?? 0) > 0 && (
              <section className="mt-10">
                <h2 className="font-display text-2xl font-bold text-foreground mb-4">
                  {locale === 'de' ? 'Stimmen' : 'What clients say'}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {show.testimonials!.map((test, i) => (
                    <blockquote key={i} className="p-5 border border-border bg-card">
                      <p className="text-sm italic leading-relaxed text-muted-foreground mb-3">"{test.quote}"</p>
                      <footer className="text-xs font-semibold text-foreground not-italic">— {test.name}</footer>
                    </blockquote>
                  ))}
                </div>
              </section>
            )}

            {/* FAQ */}
            {faqItems.length > 0 && (
              <section className="mt-10">
                <h2 className="font-display text-2xl font-bold text-foreground mb-4">{t.faq}</h2>
                <div>
                  {faqItems.map((item, i) => (
                    <FAQAccordionItem key={i} question={item.q} answer={item.a} />
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* ── RIGHT: Info col (5 cols) ── */}
          <div className="lg:col-span-5 lg:sticky lg:top-24">

            {/* Category label */}
            <span className="label-style text-accent mb-3 block">{show.category}</span>

            {/* Title */}
            {editProps ? (
              <InlineEdit
                value={show.title}
                onChange={editProps.onTitleChange}
                as="input"
                className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-[0.95] mb-4 block"
                placeholder="Show-Titel…"
              />
            ) : (
              <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-[0.95] mb-4">
                {show.title}
              </h1>
            )}

            {/* Artist */}
            <p className="text-base text-muted-foreground mb-8">
              {locale === 'de' ? 'von' : 'by'} <span className="font-medium text-foreground">{show.artistName}</span>
            </p>

            {/* Meta row */}
            <div className="border-t border-b border-border py-5 flex flex-wrap gap-6 mb-8">
              {show.durationMinutes && (
                <div>
                  <p className="label-style mb-1">{t.duration}</p>
                  <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" /> {show.durationMinutes} min
                  </p>
                </div>
              )}
              <div>
                <p className="label-style mb-1">{t.kategorie}</p>
                <p className="text-sm font-medium text-foreground">{show.category}</p>
              </div>
              {show.cast && (
                <div>
                  <p className="label-style mb-1">{t.cast}</p>
                  <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" /> {show.cast}
                  </p>
                </div>
              )}
              {(show.languageOptions || []).length > 0 && (
                <div>
                  <p className="label-style mb-1">{t.languages}</p>
                  <p className="text-sm font-medium text-foreground">{(show.languageOptions || []).join(', ')}</p>
                </div>
              )}
            </div>

            {/* Price */}
            {priceLabel && (
              <div className="mb-8 p-5 border border-border">
                <p className="label-style mb-1">{t.price}</p>
                <p className="font-display text-2xl font-bold text-foreground">{priceLabel}</p>
                {priceTaxNote && (
                  <p className="mt-1 text-xs text-muted-foreground">{priceTaxNote}</p>
                )}
              </div>
            )}

            {/* CTA */}
            <button
              onClick={openContact}
              className="w-full bg-accent text-accent-foreground font-semibold rounded-full px-8 py-3.5 hover:opacity-90 transition-opacity mb-4"
            >
              {t.requestQuote}
            </button>

            {waLink(show.title, locale) && (
              <a
                href={waLink(show.title, locale)}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors flex items-center justify-center gap-2 mb-5 no-underline"
              >
                <WhatsAppIcon />
                {locale === 'de' ? 'Per WhatsApp anfragen' : 'Ask via WhatsApp'}
              </a>
            )}

            <p className="text-xs text-center text-muted-foreground leading-snug">{t.trustLine}</p>

            {/* Ideal for / audience tags */}
            {(show.idealFor || (show.vibeTags?.length ?? 0) > 0) && (
              <div className="mt-8 pt-6 border-t border-border">
                <p className="label-style mb-3">{t.idealFor}</p>
                <div className="flex flex-wrap gap-2">
                  {(show.idealFor ? [show.idealFor] : show.vibeTags?.slice(0, 4) ?? []).map((tag, i) => (
                    <span key={i} className="text-xs text-muted-foreground border border-border px-3 py-1.5">
                      {tag}
                    </span>
                  ))}
                  {show.audienceRange && (
                    <span className="text-xs text-muted-foreground border border-border px-3 py-1.5">
                      {show.audienceRange}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Outdoor & Travel quick info */}
            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="border border-border p-4">
                <p className="label-style mb-1">{t.outdoor}</p>
                <p className="text-sm font-medium text-foreground">{show.faqOutdoor || t.onRequest}</p>
              </div>
              <div className="border border-border p-4">
                <p className="label-style mb-1">{t.travel}</p>
                <p className="text-sm font-medium text-foreground">{show.faqTravel || t.onRequest}</p>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ── Lightbox ── */}
      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/96 flex items-center justify-center p-4"
          onClick={() => setLightboxIndex(null)}
        >
          <button
            className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center text-white text-2xl z-10 hover:opacity-70 transition"
            onClick={() => setLightboxIndex(null)}
          >×</button>
          {photos.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setLightboxIndex((i) => (i === 0 ? photos.length - 1 : i! - 1)); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center text-white z-10 hover:opacity-70 transition"
              >←</button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setLightboxIndex((i) => (i === photos.length - 1 ? 0 : i! + 1)); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center text-white z-10 hover:opacity-70 transition"
              >→</button>
            </>
          )}
          <img
            src={photos[lightboxIndex]}
            alt=""
            className="max-w-full max-h-[90vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* ── Contact modal ── */}
      {(contactMode === 'form' || contactMode === 'success') && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50"
          onClick={() => onContactModeChange('options')}
        >
          <div
            className="w-full sm:max-w-md bg-background border border-border p-6 sm:p-8 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {contactMode === 'form' && (
              <>
                <div className="w-8 h-1 bg-accent mb-5" />
                <h3 className="font-display text-xl font-bold text-foreground mb-1">{t.greetTitle}</h3>
                <p className="text-sm text-muted-foreground mb-5">{t.greetSub}</p>
                {/* Steps */}
                <div className="mb-6 p-4 border border-border space-y-2.5">
                  {t.steps.map((step, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="w-5 h-5 rounded-full bg-accent flex items-center justify-center text-[10px] font-black text-accent-foreground flex-shrink-0">{i + 1}</span>
                      <span className="text-xs font-medium text-foreground">{step}</span>
                    </div>
                  ))}
                </div>
                <form onSubmit={onContactSubmit} className="space-y-4">
                  {contactError && <p className="text-sm text-red-600 font-medium">{contactError}</p>}
                  <input type="text" required placeholder={t.name} value={contactForm.name} onChange={(e) => onContactFormChange({ ...contactForm, name: e.target.value })} className="w-full px-4 py-3 border border-border text-base text-foreground bg-background focus:outline-none focus:border-foreground transition" />
                  <input type="email" required placeholder={t.email} value={contactForm.email} onChange={(e) => onContactFormChange({ ...contactForm, email: e.target.value })} className="w-full px-4 py-3 border border-border text-base text-foreground bg-background focus:outline-none focus:border-foreground transition" />
                  <input type="text" placeholder={t.eventDate} value={contactForm.eventDate} onChange={(e) => onContactFormChange({ ...contactForm, eventDate: e.target.value })} className="w-full px-4 py-3 border border-border text-base text-foreground bg-background focus:outline-none focus:border-foreground transition" />
                  <textarea placeholder={t.formPlaceholder} rows={3} value={contactForm.message} onChange={(e) => onContactFormChange({ ...contactForm, message: e.target.value })} className="w-full px-4 py-3 border border-border text-base text-foreground bg-background focus:outline-none focus:border-foreground transition resize-y" />
                  <div className="flex gap-3 pt-2">
                    <button type="submit" disabled={contactSubmitting} className="flex-1 py-4 bg-accent text-accent-foreground text-sm font-semibold rounded-full hover:opacity-90 disabled:opacity-50 transition">
                      {contactSubmitting ? t.sending : t.sendRequest}
                    </button>
                    <button type="button" onClick={() => onContactModeChange('options')} className="px-6 py-4 border border-border text-muted-foreground font-semibold text-sm hover:bg-muted transition">
                      {t.cancel}
                    </button>
                  </div>
                </form>
              </>
            )}
            {contactMode === 'success' && (
              <div className="text-center py-6">
                <div className="w-16 h-16 border border-accent flex items-center justify-center text-2xl font-semibold text-accent mx-auto mb-4">✓</div>
                <p className="text-lg font-medium text-foreground mb-4">{t.thanks}</p>
                <button type="button" onClick={() => onContactModeChange('options')} className="text-sm font-semibold text-muted-foreground">{t.another}</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Sticky footer ── */}
      <footer className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-md border-t border-border">
        <div className="container py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-2 h-2 rounded-full bg-accent flex-shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold truncate text-sm text-foreground">{show.title}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {show.durationMinutes && <span>{show.durationMinutes} min</span>}
                {show.durationMinutes && <span>·</span>}
                <span>{show.category}</span>
                {priceLabel && (
                  <>
                    <span>·</span>
                    <span className="font-semibold text-accent">{priceLabel}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {waLink(show.title, locale) && (
              <a
                href={waLink(show.title, locale)}
                target="_blank"
                rel="noopener noreferrer"
                className="p-3 flex items-center justify-center border border-border text-green-600 hover:bg-muted transition no-underline"
                title="WhatsApp"
              >
                <WhatsAppIcon />
              </a>
            )}
            <button
              onClick={openContact}
              className="px-4 sm:px-6 py-3 bg-accent text-accent-foreground font-semibold text-sm rounded-full hover:opacity-90 transition"
            >
              {t.cta}
            </button>
          </div>
        </div>
      </footer>

    </div>
  );
};
