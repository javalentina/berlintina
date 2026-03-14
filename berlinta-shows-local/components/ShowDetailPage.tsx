import React, { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Show } from '../types';
import { ArrowLeft, Star, Clock, Users, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';

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

function FAQAccordionItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-warm-border overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full px-5 py-4 flex items-center justify-between text-left font-medium text-sm text-charcoal hover:bg-surface-alt transition-colors"
      >
        <span>{question}</span>
        {open
          ? <ChevronUp className="w-4 h-4 text-warm-muted flex-shrink-0 ml-3" />
          : <ChevronDown className="w-4 h-4 text-warm-muted flex-shrink-0 ml-3" />}
      </button>
      {open && (
        <div className="px-5 pb-4 pt-3 text-sm text-warm-muted whitespace-pre-line border-t border-warm-border bg-surface-alt">
          {answer}
        </div>
      )}
    </div>
  );
}

/** Per-category shimmer accent color for the show title */
const CATEGORY_SHIMMER: Record<string, string> = {
  CLASSICAL: '#9333ea',   // violet — elegant
  BAND:      '#6366f1',   // indigo — electric
  ACROBATICS:'#16a34a',   // green  — energetic
  DANCE:     '#db2777',   // pink   — expressive
};

const priceRangeFromShow = (show: Show): string => {
  if (show.priceType === 'POA') return '€€€';
  if (show.priceMin != null) {
    if (show.priceMin < 800) return '€€';
    if (show.priceMin < 2000) return '€€€';
    return '€€€€';
  }
  return '€€€';
};

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
  children?: React.ReactNode;
}

export const ShowDetailPage: React.FC<Props> = ({
  show, locale, contactMode, contactForm, contactSubmitting, contactError,
  onContactModeChange, onContactFormChange, onContactSubmit,
}) => {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const photos = show.photoUrls || [];
  const heroImage = show.photoUrls?.[0] || '';
  const videos = show.videoUrls || [];
  const videoEmbeds = videos.map(u => getVideoEmbedUrl(u, false)).filter((u): u is string => !!u);
  const videoPreviewUrl = videoEmbeds[0] ? getVideoEmbedUrl(videos[0], true) : null;

  const priceRange = priceRangeFromShow(show);
  const priceLabel = show.priceType === 'POA'
    ? (locale === 'de' ? 'Auf Anfrage' : 'On request')
    : show.priceMin != null
      ? `${locale === 'de' ? 'ab' : 'from'} ${show.priceMin}€`
      : show.priceMax != null ? `≤ ${show.priceMax}€` : null;

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
        back: 'Zurück', cta: 'Jetzt anfragen', book: 'Show anfragen',
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
      }
    : {
        back: 'Back', cta: 'Request availability', book: 'Book This Show',
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
      };

  const faqItems = [
    show.faqOutdoor   && { q: t.faqOutdoor,  a: show.faqOutdoor },
    show.faqStage     && { q: t.faqStage,    a: show.faqStage },
    show.timingsShort && { q: t.faqTiming,   a: show.timingsShort },
    show.faqLanguage  && { q: t.faqLanguage, a: show.faqLanguage },
    show.faqCustom    && { q: t.faqCustom,   a: show.faqCustom },
    show.faqTravel    && { q: t.faqTravel,   a: show.faqTravel },
  ].filter((x): x is { q: string; a: string } => !!x);

  return (
    <div className="min-h-screen bg-parchment pb-28">

      {/* ── Back link ── */}
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 pt-20 sm:pt-24 pb-4">
        <Link
          to="/catalog"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-warm-muted hover:text-charcoal transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t.back}
        </Link>
      </div>

      {/* ── Hero image ── */}
      {heroImage && (
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 mb-10">
          <div className="relative rounded-3xl overflow-hidden">
            <img
              src={heroImage}
              alt={show.title}
              className="w-full aspect-video sm:aspect-[21/9] md:aspect-[16/7] object-cover"
            />
            {/* Category badge */}
            <div className="absolute bottom-4 left-4 flex gap-2">
              <span className="bg-glass text-charcoal text-[11px] font-semibold tracking-wider uppercase px-3 py-1.5 rounded-full">
                {show.category}
              </span>
              {show.durationMinutes && (
                <span className="bg-glass text-charcoal text-[11px] font-semibold px-3 py-1.5 rounded-full">
                  {show.durationMinutes} min
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Main content: 2-col ── */}
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] xl:grid-cols-[1fr_360px] gap-10 lg:gap-14 items-start">

          {/* ── LEFT: title + content ── */}
          <div className="min-w-0">

            {/* Title */}
            <h1 className="text-[1.75rem] sm:text-5xl md:text-[4.5rem] font-semibold tracking-[-0.04em] leading-[1.05] mb-3">
              <span
                className="shimmer-text"
                style={{ '--shimmer-accent': CATEGORY_SHIMMER[show.category] ?? '#6366f1' } as React.CSSProperties}
              >
                {show.title}
              </span>
            </h1>
            <p className="text-base text-warm-muted mb-8">
              {locale === 'de' ? 'von' : 'by'} <span className="font-medium text-charcoal">{show.artistName}</span>
            </p>

            {/* Stats pills */}
            <div className="flex flex-wrap gap-2 mb-10">
              <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-surface-alt text-sm font-medium text-charcoal border border-warm-border">
                <Star className="w-3.5 h-3.5 fill-charcoal text-charcoal" /> 5
              </span>
              {show.durationMinutes && (
                <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-surface-alt text-sm font-medium text-charcoal border border-warm-border">
                  <Clock className="w-3.5 h-3.5" /> {show.durationMinutes} min
                </span>
              )}
              {show.cast && (
                <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-surface-alt text-sm font-medium text-charcoal border border-warm-border">
                  <Users className="w-3.5 h-3.5" /> {show.cast}
                </span>
              )}
              <span className="inline-flex items-center px-4 py-2 rounded-full bg-surface-alt text-sm font-medium text-charcoal border border-warm-border">
                {priceRange}
              </span>
              {priceLabel && (
                <span className="inline-flex items-center px-4 py-2 rounded-full bg-terracotta-light text-sm font-semibold text-terracotta border border-terracotta/20">
                  {priceLabel}
                </span>
              )}
            </div>

            {/* About this show */}
            {show.shortDescriptionFacts && (
              <section className="mb-10">
                <h2 className="text-xl font-semibold text-charcoal mb-3">{t.about}</h2>
                <p className="text-base text-charcoal leading-relaxed whitespace-pre-line">
                  {show.shortDescriptionFacts}
                </p>
              </section>
            )}

            {/* Why it works / vibeTags checklist */}
            {(show.vibeTags?.length ?? 0) > 0 && (
              <section className="mb-10">
                <h2 className="text-xl font-semibold text-charcoal mb-4">
                  {locale === 'de' ? 'Was ist enthalten' : "What's Included"}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {show.vibeTags.slice(0, 6).map((tag, i) => (
                    <div key={i} className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-terracotta flex-shrink-0" />
                      <span className="text-sm text-charcoal">{tag}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Ideal for / audience tags */}
            {(show.idealFor || (show.vibeTags?.length ?? 0) > 0) && (
              <section className="mb-10">
                <h2 className="text-xl font-semibold text-charcoal mb-3">{t.idealFor}</h2>
                <div className="flex flex-wrap gap-2">
                  {(show.idealFor ? [show.idealFor] : show.vibeTags?.slice(0, 4) ?? []).map((tag, i) => (
                    <span key={i} className="text-sm text-warm-muted bg-surface-alt px-4 py-2 rounded-full border border-warm-border">
                      {tag}
                    </span>
                  ))}
                  {show.audienceRange && (
                    <span className="text-sm text-warm-muted bg-surface-alt px-4 py-2 rounded-full border border-warm-border">
                      {show.audienceRange}
                    </span>
                  )}
                </div>
              </section>
            )}

            {/* Artist bio */}
            {show.salesPitchText && (
              <section className="mb-10">
                <h2 className="text-xl font-semibold text-charcoal mb-3">{t.aboutArtist}</h2>
                <p className="text-base text-charcoal leading-relaxed whitespace-pre-line italic border-l-2 border-warm-border pl-4">
                  {show.salesPitchText}
                </p>
              </section>
            )}

            {/* Gallery — no heading */}
            {photos.length > 1 && (
              <section className="mb-10">
                <div className="overflow-x-auto scrollbar-hide -mx-4 sm:mx-0">
                  <div className="flex gap-3 pb-2 px-4 sm:px-0" style={{ width: 'max-content' }}>
                    {photos.map((url, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setLightboxIndex(i)}
                        className="flex-shrink-0 w-56 sm:w-72 aspect-[4/3] overflow-hidden rounded-2xl focus:outline-none hover:scale-[1.02] transition-transform"
                      >
                        <img src={url} alt={`${show.title} — ${i + 1}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {/* Video — no heading */}
            {videoPreviewUrl && (
              <section id="video" className="mb-10">
                <div className="relative w-full aspect-video overflow-hidden rounded-2xl shadow-soft">
                  <iframe
                    src={videoPreviewUrl}
                    className="absolute inset-0 w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title="Video preview"
                  />
                </div>
                {videoEmbeds.length > 1 && (
                  <div className="relative w-full aspect-video overflow-hidden rounded-2xl shadow-soft mt-4">
                    <iframe
                      src={videoEmbeds[1]}
                      className="absolute inset-0 w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      title="Video full"
                    />
                  </div>
                )}
              </section>
            )}

            {/* Testimonials */}
            {(show.testimonials?.length ?? 0) > 0 && (
              <section className="mb-10">
                <h2 className="text-xl font-semibold text-charcoal mb-4">
                  {locale === 'de' ? 'Stimmen' : 'What clients say'}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {show.testimonials!.map((test, i) => (
                    <blockquote key={i} className="p-5 rounded-2xl bg-surface border border-warm-border shadow-soft">
                      <p className="text-sm italic leading-relaxed text-charcoal mb-3">"{test.quote}"</p>
                      <footer className="text-xs font-semibold text-warm-muted not-italic">— {test.name}</footer>
                    </blockquote>
                  ))}
                </div>
              </section>
            )}

            {/* FAQ — only shown when at least one answer exists */}
            {faqItems.length > 0 && (
              <section id="faq" className="mb-10">
                <h2 className="text-xl font-semibold text-charcoal mb-4">{t.faq}</h2>
                <div className="space-y-2">
                  {faqItems.map((item, i) => (
                    <FAQAccordionItem key={i} question={item.q} answer={item.a} />
                  ))}
                </div>
              </section>
            )}

          </div>

          {/* ── RIGHT sidebar ── */}
          <div className="lg:sticky lg:top-24">
            <div className="bg-surface rounded-3xl border border-warm-border shadow-soft p-6">

              <p className="text-xs font-bold uppercase tracking-widest text-terracotta mb-1">{t.interested}</p>
              <h3 className="text-lg font-semibold text-charcoal tracking-tight leading-snug mb-1">
                {show.title}
              </h3>
              <p className="text-sm text-warm-muted mb-5">{t.sidebarSub}</p>

              {/* Price */}
              {priceLabel && (
                <div className="mb-5 px-4 py-3 bg-surface-alt rounded-2xl border border-warm-border">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-warm-muted mb-0.5">
                    {locale === 'de' ? 'Preis' : 'Price'}
                  </p>
                  <p className="text-base font-semibold text-charcoal">{priceLabel}</p>
                </div>
              )}

              {/* Quick facts */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                {show.durationMinutes && (
                  <div className="px-3 py-2.5 bg-surface-alt rounded-xl border border-warm-border">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-warm-faint mb-0.5">{t.duration}</p>
                    <p className="text-sm font-semibold text-charcoal">{show.durationMinutes} min</p>
                  </div>
                )}
                {(show.languageOptions || []).length > 0 && (
                  <div className="px-3 py-2.5 bg-surface-alt rounded-xl border border-warm-border">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-warm-faint mb-0.5">{t.languages}</p>
                    <p className="text-sm font-semibold text-charcoal">{(show.languageOptions || []).join(', ')}</p>
                  </div>
                )}
                <div className="px-3 py-2.5 bg-surface-alt rounded-xl border border-warm-border">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-warm-faint mb-0.5">{t.outdoor}</p>
                  <p className="text-sm font-semibold text-charcoal">{show.faqOutdoor || t.onRequest}</p>
                </div>
                <div className="px-3 py-2.5 bg-surface-alt rounded-xl border border-warm-border">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-warm-faint mb-0.5">{t.travel}</p>
                  <p className="text-sm font-semibold text-charcoal">{show.faqTravel || t.onRequest}</p>
                </div>
              </div>

              {/* CTA */}
              <button
                onClick={openContact}
                className="w-full py-3.5 bg-charcoal text-white text-sm font-semibold rounded-2xl hover:bg-charcoal/90 transition-colors shadow-soft mb-3"
              >
                {t.requestQuote}
              </button>

              {waLink(show.title, locale) && (
                <a
                  href={waLink(show.title, locale)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 border border-warm-border rounded-2xl text-sm font-medium text-charcoal hover:bg-surface-alt transition-colors flex items-center justify-center gap-2 mb-4"
                >
                  <WhatsAppIcon />
                  {locale === 'de' ? 'Per WhatsApp anfragen' : 'Ask via WhatsApp'}
                </a>
              )}

              <p className="text-[11px] text-center text-warm-faint leading-snug">{t.trustLine}</p>

              {/* Vibe tags */}
              {(show.vibeTags?.length ?? 0) > 0 && (
                <div className="mt-5 pt-4 border-t border-warm-border">
                  <div className="flex flex-wrap gap-1.5">
                    {show.vibeTags.slice(0, 5).map((tag, i) => (
                      <span key={i} className="text-[10px] text-warm-muted bg-surface-alt px-2.5 py-1 rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
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
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-2xl z-10"
            onClick={() => setLightboxIndex(null)}
          >×</button>
          {photos.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setLightboxIndex((i) => (i === 0 ? photos.length - 1 : i! - 1)); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white z-10"
              >←</button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setLightboxIndex((i) => (i === photos.length - 1 ? 0 : i! + 1)); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white z-10"
              >→</button>
            </>
          )}
          <img
            src={photos[lightboxIndex]}
            alt=""
            className="max-w-full max-h-[90vh] object-contain rounded-2xl"
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
            className="w-full sm:max-w-md bg-surface rounded-t-3xl sm:rounded-3xl p-6 sm:p-8 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {contactMode === 'form' && (
              <>
                <div className="w-8 h-1 rounded-full bg-terracotta mb-5" />
                <h3 className="text-xl font-semibold text-charcoal mb-1">{t.greetTitle}</h3>
                <p className="text-sm text-warm-muted mb-5">{t.greetSub}</p>
                {/* Steps */}
                <div className="mb-6 p-4 rounded-2xl bg-surface-alt space-y-2.5">
                  {t.steps.map((step, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="w-5 h-5 rounded-full bg-terracotta flex items-center justify-center text-[10px] font-black text-white flex-shrink-0">{i + 1}</span>
                      <span className="text-xs font-medium text-charcoal">{step}</span>
                    </div>
                  ))}
                </div>
                <form onSubmit={onContactSubmit} className="space-y-4">
                  {contactError && <p className="text-sm text-red-600 font-medium">{contactError}</p>}
                  <input type="text" required placeholder={t.name} value={contactForm.name} onChange={(e) => onContactFormChange({ ...contactForm, name: e.target.value })} className="w-full px-4 py-3 border border-warm-border rounded-2xl text-base text-charcoal bg-surface focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta transition" />
                  <input type="email" required placeholder={t.email} value={contactForm.email} onChange={(e) => onContactFormChange({ ...contactForm, email: e.target.value })} className="w-full px-4 py-3 border border-warm-border rounded-2xl text-base text-charcoal bg-surface focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta transition" />
                  <input type="text" placeholder={t.eventDate} value={contactForm.eventDate} onChange={(e) => onContactFormChange({ ...contactForm, eventDate: e.target.value })} className="w-full px-4 py-3 border border-warm-border rounded-2xl text-base text-charcoal bg-surface focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta transition" />
                  <textarea placeholder={t.formPlaceholder} rows={3} value={contactForm.message} onChange={(e) => onContactFormChange({ ...contactForm, message: e.target.value })} className="w-full px-4 py-3 border border-warm-border rounded-2xl text-base text-charcoal bg-surface focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta transition resize-y" />
                  <div className="flex gap-3 pt-2">
                    <button type="submit" disabled={contactSubmitting} className="flex-1 py-4 bg-charcoal text-white text-sm font-semibold rounded-2xl hover:bg-charcoal/90 disabled:opacity-50 transition">
                      {contactSubmitting ? t.sending : t.sendRequest}
                    </button>
                    <button type="button" onClick={() => onContactModeChange('options')} className="px-6 py-4 border border-warm-border text-warm-muted font-semibold text-sm rounded-2xl hover:bg-surface-alt transition">
                      {t.cancel}
                    </button>
                  </div>
                </form>
              </>
            )}
            {contactMode === 'success' && (
              <div className="text-center py-6">
                <div className="w-16 h-16 rounded-full bg-terracotta/10 flex items-center justify-center text-2xl font-semibold text-terracotta mx-auto mb-4">✓</div>
                <p className="text-lg font-medium text-charcoal mb-4">{t.thanks}</p>
                <button type="button" onClick={() => onContactModeChange('options')} className="text-sm font-semibold text-warm-muted">{t.another}</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Sticky footer ── */}
      <footer className="fixed bottom-0 left-0 right-0 z-40 bg-surface/95 backdrop-blur-md border-t border-warm-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-2 h-2 rounded-full bg-terracotta flex-shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold truncate text-sm text-charcoal">{show.title}</p>
              <div className="flex items-center gap-2 text-xs text-warm-muted">
                <span>{show.durationMinutes} min</span>
                <span>·</span>
                <span>{show.category}</span>
                {priceLabel && (
                  <>
                    <span>·</span>
                    <span className="font-semibold text-terracotta">{priceLabel}</span>
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
                className="p-3 flex items-center justify-center border border-warm-border rounded-2xl text-green-600 hover:bg-surface-alt transition"
                title="WhatsApp"
              >
                <WhatsAppIcon />
              </a>
            )}
            <button
              onClick={openContact}
              className="px-4 sm:px-6 py-3 bg-charcoal text-white font-semibold text-sm rounded-2xl hover:bg-charcoal/90 transition"
            >
              {t.cta}
            </button>
          </div>
        </div>
      </footer>

    </div>
  );
};
