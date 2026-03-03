import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Show } from '../types';

/** F&F theme tokens */
const THEME = {
  text: '#0B0B0C',
  muted: '#6B6B6B',
  rule: '#D9D9D9',
  surface: '#FFFFFF',
  surface_alt: '#FAFAFA',
  radius: '18px',
};

/** Category fallback accent colors for near-monochrome images */
const CATEGORY_COLORS: Record<string, string> = {
  CLASSICAL: '#7C3AED',
  BAND: '#1D4ED8',
  ACROBATICS: '#EA580C',
  DANCE: '#BE185D',
};

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [h * 360, s * 100, l * 100];
}

function hslToHex(h: number, s: number, l: number): string {
  h /= 360; s /= 100; l /= 100;
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return '#' + [hue2rgb(p, q, h + 1 / 3), hue2rgb(p, q, h), hue2rgb(p, q, h - 1 / 3)]
    .map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
}

function hexLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const toL = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * toL(r) + 0.7152 * toL(g) + 0.0722 * toL(b);
}

/** Finds the most saturated pixel in the image and returns a vivid, normalized accent color */
function useDominantColor(imageUrl: string | null, category?: string): string {
  const fallback = CATEGORY_COLORS[category ?? ''] ?? '#1a1a1a';
  const [color, setColor] = useState(fallback);
  useEffect(() => {
    if (!imageUrl) { setColor(fallback); return; }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const size = 120;
        canvas.width = size; canvas.height = size;
        ctx.drawImage(img, 0, 0, size, size);
        const data = ctx.getImageData(0, 0, size, size).data;
        let bestH = 0, bestS = 0, bestL = 50;
        for (let i = 0; i < data.length; i += 16) {
          const [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
          if (s > bestS && l > 12 && l < 88) {
            bestH = h; bestS = s; bestL = l;
          }
        }
        if (bestS > 15) {
          setColor(hslToHex(bestH, Math.min(100, Math.max(bestS, 72)), Math.max(32, Math.min(52, bestL))));
        } else {
          setColor(fallback);
        }
      } catch { setColor(fallback); }
    };
    img.onerror = () => setColor(fallback);
    img.src = imageUrl;
  }, [imageUrl, fallback]);
  return color;
}

function FAQAccordionItem({ question, answer, accent }: { question: string; answer: string; accent: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden" style={{ borderRadius: THEME.radius, border: `1px solid ${THEME.rule}` }}>
      <button type="button" onClick={() => setOpen(!open)} className="w-full px-5 py-4 flex items-center justify-between text-left font-semibold hover:bg-black/[0.02] transition" style={{ color: THEME.text }}>
        {question}
        <span className={`transition-transform flex-shrink-0 ml-3 ${open ? 'rotate-180' : ''}`}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: accent }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </span>
      </button>
      {open && <div className="px-5 pb-4 text-sm whitespace-pre-line border-t pt-3" style={{ color: THEME.muted, borderColor: THEME.rule }}>{answer}</div>}
    </div>
  );
}

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

function Rule() {
  return <hr className="border-0 h-px w-full my-0" style={{ backgroundColor: THEME.rule }} />;
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
  children?: React.ReactNode;
}

export const ShowDetailPage: React.FC<Props> = ({
  show, locale, contactMode, contactForm, contactSubmitting, contactError,
  onContactModeChange, onContactFormChange, onContactSubmit, children,
}) => {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const photos = show.photoUrls || [];
  const heroImage = show.photoUrls?.[0] || 'https://placehold.co/1920x1080/f5f5f0/999?text=No+image';
  const videos = show.videoUrls || [];
  const videoEmbeds = videos.map(u => getVideoEmbedUrl(u, false)).filter((u): u is string => !!u);
  const videoPreviewUrl = videoEmbeds[0] ? getVideoEmbedUrl(videos[0], true) : null;

  const accent = useDominantColor(heroImage, show.category);
  const accentText = hexLuminance(accent) > 0.35 ? '#0B0B0C' : '#FFFFFF';

  const shortPromise = (show.salesPitchText || show.shortDescriptionFacts || '').slice(0, 120);
  const promisePullquote = (show.salesPitchText || show.shortDescriptionFacts || '').split('\n')[0]?.trim().slice(0, 220) || '';

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
    document.title = `${show.title} — SHOW | berlintina.de`;
    const meta = document.querySelector('meta[name="description"]');
    const metaDesc = `${show.title}: ${shortPromise} Highlights, Galerie, Video-Preview, FAQ und Booking.`;
    if (meta) meta.setAttribute('content', metaDesc.slice(0, 160));
    return () => {
      document.title = 'Berlintina Shows';
      if (meta) meta.setAttribute('content', 'Berlintina Shows – Find curated live performances in Berlin.');
    };
  }, [show.title, shortPromise]);

  const t = locale === 'de'
    ? {
        back: 'Zurück', ctaPrimary: 'Jetzt anfragen →', ctaSecondary: 'Video ansehen',
        duration: 'Dauer', cast: 'Besetzung', idealFor: 'Ideal für',
        placement: 'Platzierung im Ablauf', audience: 'Publikum', languages: 'Sprache',
        outdoor: 'Outdoor', travel: 'Reise',
        highlights: 'Highlights', video: 'Video', gallery: 'Gallery',
        gallerySub: 'Weniger Bilder. Stärkere Wirkung.',
        onRequest: 'Auf Anfrage.',
        faq: 'FAQ',
        booking: 'Booking',
        contactAufnehmen: 'Kontakt aufnehmen', name: 'Dein Name', email: 'E-Mail',
        eventDate: 'Event-Datum (optional)', message: 'Nachricht', sendRequest: 'Anfrage senden',
        sending: 'Wird gesendet…', cancel: 'Abbrechen', thanks: 'Vielen Dank! Wir melden uns bei dir.',
        another: 'Weitere Anfrage', formPlaceholder: 'z. B. Outdoor möglich? Bühne 6×4m?',
        faqOutdoor: 'Outdoor möglich?', faqStage: 'Wie groß muss die Bühne sein?',
        faqTiming: 'Wie lange dauert Aufbau / Soundcheck / Abbau?',
        faqLanguage: 'Ist die Show sprachabhängig?', faqCustom: 'Kann man die Show anpassen (Branding/Theme)?',
        faqPromoterNeeds: 'Was braucht ihr vom Veranstalter?', faqTravel: 'Reist ihr an?', faqAnswer: 'Details auf Anfrage.',
        moreShows: 'Weitere Shows', toCatalog: 'Alle Shows →',
        aboutArtist: 'Über die Künstler',
        whyItWorks: 'Warum es funktioniert',
        grandHeadline: 'Bereit, diese Show zu buchen?',
        grandSub: 'Sende uns deine Event-Details — wir melden uns innerhalb von 24 Stunden.',
        grandTrust: 'Persönlich geprüft · Kein Mittelsmann · Immer kostenlos',
        atAGlance: 'Auf einen Blick',
        price: 'Preis',
        priceOnRequest: 'Auf Anfrage',
        priceFrom: 'ab',
        checklist: [
          '📅 Datum + Stadt + Venue',
          '👥 Gästezahl',
          '🎭 Event-Typ (Gala, Hochzeit, Corporate…)',
          '⏱ Platzierung im Ablauf (Opener / Finale)',
        ],
      }
    : {
        back: 'Back', ctaPrimary: 'Request availability →', ctaSecondary: 'Watch video',
        duration: 'Duration', cast: 'Cast', idealFor: 'Best for',
        placement: 'Placement in schedule', audience: 'Audience', languages: 'Language',
        outdoor: 'Outdoor', travel: 'Travel',
        highlights: 'Highlights', video: 'Video', gallery: 'Gallery',
        gallerySub: 'Fewer images. Stronger impact.',
        onRequest: 'Details on request.',
        faq: 'FAQ',
        booking: 'Booking',
        contactAufnehmen: 'Get in touch', name: 'Your name', email: 'Email',
        eventDate: 'Event date (optional)', message: 'Message', sendRequest: 'Send request',
        sending: 'Sending…', cancel: 'Cancel', thanks: 'Thank you! We will get back to you.',
        another: 'Another inquiry', formPlaceholder: 'e.g. Outdoor possible? Stage 6×4m?',
        faqOutdoor: 'Outdoor possible?', faqStage: 'How big must the stage be?',
        faqTiming: 'How long for load-in / soundcheck / strike?',
        faqLanguage: 'Is the show language-dependent?', faqCustom: 'Can the show be adapted (branding/theme)?',
        faqPromoterNeeds: 'What do you need from the promoter?', faqTravel: 'Do you travel?', faqAnswer: 'Details on request.',
        moreShows: 'More SHOWS', toCatalog: 'All shows →',
        aboutArtist: 'About the artist',
        whyItWorks: 'Why it works',
        grandHeadline: 'Ready to book this show?',
        grandSub: "Send us your event details — we'll get back to you within 24 hours.",
        grandTrust: 'Personally reviewed · No middleman · Always free',
        atAGlance: 'At a glance',
        price: 'Price',
        priceOnRequest: 'On request',
        priceFrom: 'from',
        checklist: [
          '📅 Date + city + venue',
          '👥 Audience size',
          '🎭 Event type (gala, wedding, corporate…)',
          '⏱ Placement in schedule (opener / finale)',
        ],
      };

  const openContact = useCallback(() => onContactModeChange('form'), [onContactModeChange]);

  const priceLabel = show.priceType === 'POA'
    ? t.priceOnRequest
    : show.priceMin != null
      ? `${t.priceFrom} ${show.priceMin}€`
      : show.priceMax != null ? `≤ ${show.priceMax}€` : null;

  return (
    <div className="min-h-screen pb-28 sm:pb-24" style={{ backgroundColor: THEME.surface }}>

      {/* ── CONSTRAINED: Back + Hero ── */}
      <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6">
        <Link to="/catalog" className="text-sm font-medium pt-6 pb-4 inline-block" style={{ color: THEME.muted }}>← {t.back}</Link>

        {/* Hero */}
        <section className="w-full py-6 sm:py-10 flex flex-col lg:flex-row gap-10 lg:gap-14 items-start">
          {/* Left: image with gradient overlay */}
          <div className="relative w-full lg:w-1/2 flex-shrink-0 group">
            <img
              src={heroImage}
              alt={show.title}
              className="w-full aspect-[3/2] object-cover"
              style={{ borderRadius: THEME.radius }}
            />
            {/* Accent gradient overlay at image bottom */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ borderRadius: THEME.radius, background: `linear-gradient(to top, ${accent}cc 0%, ${accent}30 35%, transparent 65%)` }}
            />
            {/* Category badge on image */}
            <div className="absolute bottom-4 left-4 flex gap-2 flex-wrap">
              <span className="px-3 py-1 text-[11px] font-black uppercase tracking-widest rounded-full" style={{ backgroundColor: accent, color: accentText }}>
                {show.category}
              </span>
              {show.durationMinutes && (
                <span className="px-3 py-1 text-[11px] font-black uppercase tracking-widest rounded-full bg-black/50 text-white backdrop-blur-sm">
                  {show.durationMinutes} min
                </span>
              )}
            </div>
          </div>

          {/* Right: info panel */}
          <div className="w-full lg:w-1/2 flex-1">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight leading-[1.1] mb-3" style={{ color: THEME.text }}>
              {show.title}
            </h1>

            {/* Price badge */}
            {priceLabel && (
              <div className="mb-4">
                <span className="px-4 py-1.5 text-sm font-bold rounded-full" style={{ backgroundColor: `${accent}18`, color: accent }}>
                  {priceLabel}
                </span>
              </div>
            )}

            {shortPromise && (
              <p className="text-base sm:text-lg mb-6 leading-relaxed" style={{ color: THEME.text }}>{shortPromise}</p>
            )}

            {/* Agency quick-scan grid */}
            <div className="grid grid-cols-2 gap-3 mb-6 p-4 rounded-2xl" style={{ backgroundColor: '#f9f9f7', border: `1px solid ${THEME.rule}` }}>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: THEME.muted }}>{t.duration}</p>
                <p className="text-sm font-semibold" style={{ color: THEME.text }}>{show.durationMinutes} min</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: THEME.muted }}>{t.languages}</p>
                <p className="text-sm font-semibold" style={{ color: THEME.text }}>{(show.languageOptions || []).join(', ') || '—'}</p>
              </div>
              {(show.idealFor || (show.vibeTags?.length ?? 0) > 0) && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: THEME.muted }}>{t.idealFor}</p>
                  <p className="text-sm font-semibold" style={{ color: THEME.text }}>{show.idealFor || (show.vibeTags || []).slice(0, 2).join(', ')}</p>
                </div>
              )}
              {show.audienceRange && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: THEME.muted }}>{t.audience}</p>
                  <p className="text-sm font-semibold" style={{ color: THEME.text }}>{show.audienceRange}</p>
                </div>
              )}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: THEME.muted }}>{t.outdoor}</p>
                <p className="text-sm font-semibold" style={{ color: THEME.text }}>{show.faqOutdoor || t.onRequest}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: THEME.muted }}>{t.travel}</p>
                <p className="text-sm font-semibold" style={{ color: THEME.text }}>{show.faqTravel || t.onRequest}</p>
              </div>
              {show.cast && (
                <div className="col-span-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: THEME.muted }}>{t.cast}</p>
                  <p className="text-sm font-semibold whitespace-pre-line" style={{ color: THEME.text }}>{show.cast}</p>
                </div>
              )}
            </div>

            {/* CTAs */}
            <div className="flex flex-wrap gap-3 mb-5">
              <button onClick={openContact} className="px-6 py-3 font-semibold text-sm hover:opacity-90 transition shadow-lg" style={{ backgroundColor: accent, color: accentText, borderRadius: THEME.radius }}>
                {t.ctaPrimary}
              </button>
              {videoPreviewUrl && (
                <a href="#video" className="px-6 py-3 font-semibold text-sm border-2 hover:opacity-80 transition" style={{ borderRadius: THEME.radius, borderColor: accent, color: accent }}>
                  {t.ctaSecondary}
                </a>
              )}
              <a href="#faq" className="px-6 py-3 font-semibold text-sm border hover:opacity-80 transition" style={{ borderRadius: THEME.radius, borderColor: THEME.rule, color: THEME.muted }}>
                {t.faq}
              </a>
            </div>

            {show.placement && (
              <p className="text-sm" style={{ color: THEME.muted }}>
                <span className="font-semibold" style={{ color: THEME.text }}>{t.placement}:</span> {show.placement}
              </p>
            )}
          </div>
        </section>
      </div>

      {/* ── FULL-WIDTH: Promise band ── */}
      {promisePullquote && (
        <div style={{ backgroundColor: `${accent}10` }} className="py-14 sm:py-20">
          <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 text-center">
            {/* Accent rule */}
            <div className="w-12 h-1 rounded-full mx-auto mb-8" style={{ backgroundColor: accent }} />
            <blockquote
              className="text-xl sm:text-2xl md:text-3xl font-medium italic leading-relaxed max-w-3xl mx-auto mb-8"
              style={{ color: THEME.text }}
            >
              "{promisePullquote}{promisePullquote.length >= 220 ? '…' : '"'}
            </blockquote>
            {(show.vibeTags?.length ?? 0) > 0 && (
              <div className="flex flex-wrap justify-center gap-2">
                {show.vibeTags.slice(0, 7).map((v, i) => (
                  <span key={i} className="px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide" style={{ backgroundColor: `${accent}22`, color: accent }}>
                    {v}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── CONSTRAINED: Gallery, About, Video, Artist, Testimonials, Q&A, FAQ ── */}
      <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6">

        {/* Gallery */}
        {photos.length > 0 && (
          <>
            <section id="gallery" className="py-10 overflow-hidden w-full">
              <h2 className="text-xl font-semibold mb-1" style={{ color: THEME.text }}>{t.gallery}</h2>
              <p className="text-sm mb-6" style={{ color: THEME.muted }}>{t.gallerySub}</p>
              <div className="overflow-x-auto scrollbar-hide scroll-smooth -mx-4 sm:-mx-6 px-4 sm:px-6">
                <div className="flex gap-4 pb-4" style={{ width: 'max-content' }}>
                  {photos.map((url, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setLightboxIndex(i)}
                      className="flex-shrink-0 w-64 sm:w-80 aspect-[4/3] overflow-hidden focus:outline-none hover:scale-[1.02] transition-transform"
                      style={{ borderRadius: THEME.radius }}
                    >
                      <img src={url} alt={`${show.title} — ${i + 1}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            </section>
            {lightboxIndex !== null && (
              <div className="fixed inset-0 z-50 bg-black/96 flex items-center justify-center p-4" onClick={() => setLightboxIndex(null)}>
                <button className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-2xl z-10" onClick={() => setLightboxIndex(null)}>×</button>
                {photos.length > 1 && (
                  <>
                    <button type="button" onClick={(e) => { e.stopPropagation(); setLightboxIndex((i) => (i === 0 ? photos.length - 1 : i! - 1)); }} className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white z-10">←</button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); setLightboxIndex((i) => (i === photos.length - 1 ? 0 : i! + 1)); }} className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white z-10">→</button>
                  </>
                )}
                <img src={photos[lightboxIndex]} alt="" className="max-w-full max-h-[90vh] object-contain" onClick={(e) => e.stopPropagation()} style={{ borderRadius: THEME.radius }} />
              </div>
            )}
            <Rule />
          </>
        )}

        {/* About this show */}
        <section id="video" className="py-12">
          <div className="flex flex-col lg:flex-row gap-12 lg:gap-16">
            {/* Left: description */}
            <div className="w-full lg:w-1/2">
              <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: accent }}>About</p>
              <h2 className="text-xl font-semibold mb-4" style={{ color: THEME.text }}>
                {locale === 'de' ? 'About this SHOW' : 'About this SHOW'}
              </h2>
              {show.shortDescriptionFacts && (
                <p className="text-base leading-relaxed whitespace-pre-line mb-6" style={{ color: THEME.text }}>
                  {show.shortDescriptionFacts}
                </p>
              )}
              {(show.vibeTags?.length ?? 0) > 0 && (
                <>
                  <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: THEME.muted }}>{t.whyItWorks}</p>
                  <ul className="space-y-2">
                    {show.vibeTags.slice(0, 5).map((v, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm font-medium" style={{ color: THEME.text }}>
                        <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] flex-shrink-0" style={{ backgroundColor: `${accent}20`, color: accent }}>✓</span>
                        {v}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>

            {/* Right: video */}
            <div className="w-full lg:w-1/2">
              {videoPreviewUrl ? (
                <>
                  <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: accent }}>{t.video}</p>
                  <h2 className="text-xl font-semibold mb-2" style={{ color: THEME.text }}>
                    {locale === 'de' ? 'Preview (15 Sek.)' : 'Preview (15 sec)'}
                  </h2>
                  <div className="relative w-full aspect-video overflow-hidden shadow-xl mb-4" style={{ borderRadius: THEME.radius }}>
                    <iframe src={videoPreviewUrl} className="absolute inset-0 w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen title="Video preview" />
                  </div>
                  {videoEmbeds.length > 1 && (
                    <div className="relative w-full aspect-video overflow-hidden" style={{ borderRadius: THEME.radius }}>
                      <iframe src={videoEmbeds[1]} className="absolute inset-0 w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen title="Video full" />
                    </div>
                  )}
                </>
              ) : (
                /* No video: show a vibe-tag card grid as visual filler */
                (show.vibeTags?.length ?? 0) > 3 && (
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    {show.vibeTags.slice(0, 4).map((v, i) => (
                      <div key={i} className="p-4 rounded-2xl text-sm font-semibold" style={{ backgroundColor: `${accent}${i % 2 === 0 ? '12' : '08'}`, color: THEME.text }}>
                        {v}
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          </div>
        </section>

        <Rule />

        {/* Artist bio */}
        {show.salesPitchText && (
          <>
            <section className="py-12">
              <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: accent }}>{t.aboutArtist}</p>
              <div className="flex flex-col lg:flex-row gap-8 items-start">
                <div className="w-1 self-stretch rounded-full flex-shrink-0 hidden lg:block" style={{ backgroundColor: `${accent}40` }} />
                <p className="text-lg leading-relaxed whitespace-pre-line flex-1 italic" style={{ color: THEME.text }}>
                  {show.salesPitchText}
                </p>
              </div>
            </section>
            <Rule />
          </>
        )}

        {/* Testimonials */}
        {(show.testimonials?.length ?? 0) > 0 && (
          <>
            <section className="py-12">
              <p className="text-[10px] font-black uppercase tracking-widest mb-6" style={{ color: accent }}>
                {locale === 'de' ? 'Stimmen' : 'What clients say'}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {show.testimonials!.map((test, i) => (
                  <blockquote key={i} className="p-6 rounded-2xl" style={{ backgroundColor: `${accent}08`, border: `1px solid ${accent}20` }}>
                    <p className="text-base italic leading-relaxed mb-4" style={{ color: THEME.text }}>"{test.quote}"</p>
                    <footer className="text-xs font-bold uppercase tracking-widest not-italic" style={{ color: accent }}>— {test.name}</footer>
                  </blockquote>
                ))}
              </div>
            </section>
            <Rule />
          </>
        )}

        {/* Q&A widget */}
        {children && (
          <>
            <section className="py-10">
              <div style={{ maxWidth: '600px' }}>{children}</div>
            </section>
            <Rule />
          </>
        )}

        {/* FAQ */}
        <section id="faq" className="py-12">
          <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: accent }}>{t.faq}</p>
          <h2 className="text-xl font-semibold mb-6" style={{ color: THEME.text }}>
            {locale === 'de' ? 'Häufige Fragen' : 'Frequently asked questions'}
          </h2>
          <div className="space-y-2">
            {([
              { q: t.faqOutdoor, a: show.faqOutdoor || t.faqAnswer },
              { q: t.faqStage, a: show.faqStage || t.faqAnswer },
              { q: t.faqTiming, a: show.timingsShort || t.faqAnswer },
              { q: t.faqLanguage, a: show.faqLanguage || t.faqAnswer },
              { q: t.faqCustom, a: show.faqCustom || t.faqAnswer },
              { q: t.faqPromoterNeeds, a: t.faqAnswer },
              { q: t.faqTravel, a: show.faqTravel || t.faqAnswer },
            ] as { q: string; a: string }[]).map((item, i) => (
              <FAQAccordionItem key={i} question={item.q} answer={item.a} accent={accent} />
            ))}
          </div>
        </section>

      </div>

      {/* ── FULL-WIDTH: Grand Slam Booking CTA ── */}
      <div style={{ backgroundColor: '#0f0f10' }} className="py-16 sm:py-24">
        <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6">
          <div className="flex flex-col lg:flex-row gap-12 lg:gap-20 items-start">

            {/* Left: headline + checklist + CTA */}
            <div className="flex-1">
              <p className="text-[10px] font-black uppercase tracking-widest mb-4" style={{ color: accent }}>
                {t.booking}
              </p>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-semibold text-white mb-5 tracking-tight leading-[1.1]">
                {t.grandHeadline}
              </h2>
              <p className="text-gray-400 text-base leading-relaxed mb-10 max-w-md">
                {t.grandSub}
              </p>

              {/* Checklist */}
              <ul className="space-y-3 mb-10">
                {t.checklist.map((item, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0" style={{ backgroundColor: `${accent}25`, color: accent }}>✓</span>
                    <span className="text-sm text-gray-300 font-medium">{item}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={openContact}
                className="inline-flex items-center gap-2 px-10 py-5 text-base font-bold hover:opacity-90 transition shadow-2xl"
                style={{ backgroundColor: accent, color: accentText, borderRadius: THEME.radius }}
              >
                {t.contactAufnehmen} →
              </button>

              <p className="mt-5 text-xs text-gray-600 font-medium">
                ✓ {t.grandTrust}
              </p>
            </div>

            {/* Right: at-a-glance card */}
            <div
              className="w-full lg:w-80 shrink-0 rounded-3xl p-7"
              style={{ backgroundColor: '#1a1a1c', border: `1px solid ${accent}30` }}
            >
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-5">{t.atAGlance}</p>
              <div className="space-y-4">
                {priceLabel && (
                  <div className="flex justify-between items-baseline">
                    <span className="text-sm text-gray-400">{t.price}</span>
                    <span className="text-base font-bold" style={{ color: accent }}>{priceLabel}</span>
                  </div>
                )}
                <div className="flex justify-between items-baseline">
                  <span className="text-sm text-gray-400">{t.duration}</span>
                  <span className="text-sm font-bold text-white">{show.durationMinutes} min</span>
                </div>
                {show.audienceRange && (
                  <div className="flex justify-between items-baseline">
                    <span className="text-sm text-gray-400">{t.audience}</span>
                    <span className="text-sm font-bold text-white">{show.audienceRange}</span>
                  </div>
                )}
                <div className="flex justify-between items-baseline">
                  <span className="text-sm text-gray-400">{t.outdoor}</span>
                  <span className="text-sm font-bold text-white">{show.faqOutdoor || t.onRequest}</span>
                </div>
                {show.cast && (
                  <div className="pt-4 border-t" style={{ borderColor: '#2a2a2c' }}>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">{t.cast}</p>
                    <p className="text-sm font-semibold text-white">{show.cast}</p>
                  </div>
                )}
                {show.placement && (
                  <div className="pt-3 border-t" style={{ borderColor: '#2a2a2c' }}>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">{t.placement}</p>
                    <p className="text-sm font-semibold text-white">{show.placement}</p>
                  </div>
                )}
              </div>

              {/* Show color swatch — subtle identity mark */}
              <div className="mt-6 pt-5 border-t flex items-center gap-3" style={{ borderColor: '#2a2a2c' }}>
                <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: accent }} />
                <p className="text-xs text-gray-600 font-medium truncate">{show.title}</p>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ── CONSTRAINED: More shows ── */}
      <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6">
        <section className="py-10 text-center">
          <h2 className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: THEME.muted }}>{t.moreShows}</h2>
          <Link to="/catalog" className="inline-block px-8 py-3.5 rounded-2xl font-bold text-sm hover:opacity-90 transition" style={{ backgroundColor: accent, color: accentText }}>
            {t.toCatalog}
          </Link>
        </section>
        <Rule />
      </div>

      {/* ── Contact modal ── */}
      {(contactMode === 'form' || contactMode === 'success') && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50" onClick={() => onContactModeChange('options')}>
          <div className="w-full sm:max-w-md bg-white p-6 sm:p-8 shadow-2xl" style={{ borderRadius: THEME.radius }} onClick={e => e.stopPropagation()}>
            {contactMode === 'form' && (
              <>
                <div className="w-8 h-1 rounded-full mb-5" style={{ backgroundColor: accent }} />
                <h3 className="text-xl font-semibold mb-1" style={{ color: THEME.text }}>
                  {locale === 'de' ? 'Schön, dass du da bist!' : "Great you're here!"}
                </h3>
                <p className="text-sm mb-6" style={{ color: THEME.muted }}>
                  {locale === 'de' ? "Schick uns kurz deine Infos – wir melden uns zeitnah." : "Send us a quick note – we'll get back to you soon."}
                </p>
                <form onSubmit={onContactSubmit} className="space-y-4">
                  {contactError && <p className="text-sm text-red-600 font-medium">{contactError}</p>}
                  <input type="text" required placeholder={t.name} value={contactForm.name} onChange={(e) => onContactFormChange({ ...contactForm, name: e.target.value })} className="w-full px-4 py-3 border text-base focus:outline-none focus:ring-2" style={{ borderRadius: THEME.radius, borderColor: THEME.rule, ['--tw-ring-color' as string]: accent }} />
                  <input type="email" required placeholder={t.email} value={contactForm.email} onChange={(e) => onContactFormChange({ ...contactForm, email: e.target.value })} className="w-full px-4 py-3 border text-base focus:outline-none focus:ring-2" style={{ borderRadius: THEME.radius, borderColor: THEME.rule, ['--tw-ring-color' as string]: accent }} />
                  <input type="text" placeholder={t.eventDate} value={contactForm.eventDate} onChange={(e) => onContactFormChange({ ...contactForm, eventDate: e.target.value })} className="w-full px-4 py-3 border text-base focus:outline-none focus:ring-2" style={{ borderRadius: THEME.radius, borderColor: THEME.rule, ['--tw-ring-color' as string]: accent }} />
                  <textarea placeholder={t.formPlaceholder} rows={3} value={contactForm.message} onChange={(e) => onContactFormChange({ ...contactForm, message: e.target.value })} className="w-full px-4 py-3 border text-base focus:outline-none focus:ring-2 resize-y" style={{ borderRadius: THEME.radius, borderColor: THEME.rule, ['--tw-ring-color' as string]: accent }} />
                  <div className="flex gap-3 pt-2">
                    <button type="submit" disabled={contactSubmitting} className="flex-1 py-4 text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition" style={{ backgroundColor: accent, color: accentText, borderRadius: THEME.radius }}>
                      {contactSubmitting ? t.sending : t.sendRequest}
                    </button>
                    <button type="button" onClick={() => onContactModeChange('options')} className="px-6 py-4 border font-semibold text-sm transition" style={{ borderRadius: THEME.radius, borderColor: THEME.rule, color: THEME.muted }}>
                      {t.cancel}
                    </button>
                  </div>
                </form>
              </>
            )}
            {contactMode === 'success' && (
              <div className="text-center py-6">
                <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-semibold mx-auto mb-4" style={{ backgroundColor: `${accent}20`, color: accent }}>✓</div>
                <p className="text-lg font-medium mb-4" style={{ color: THEME.text }}>{t.thanks}</p>
                <button type="button" onClick={() => onContactModeChange('options')} className="text-sm font-semibold" style={{ color: THEME.muted }}>{t.another}</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Sticky footer ── */}
      <footer className="fixed bottom-0 left-0 right-0 z-40 w-full bg-white/95 backdrop-blur-md border-t" style={{ borderColor: THEME.rule }}>
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: accent }} />
            <div className="min-w-0">
              <p className="font-semibold truncate text-sm" style={{ color: THEME.text }}>{show.title}</p>
              <div className="flex items-center gap-2 text-xs" style={{ color: THEME.muted }}>
                <span>{show.durationMinutes} min</span>
                <span>·</span>
                <span>{show.category}</span>
                {priceLabel && (
                  <>
                    <span>·</span>
                    <span className="font-semibold" style={{ color: accent }}>{priceLabel}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <button onClick={openContact} className="shrink-0 px-6 py-3 font-semibold text-sm hover:opacity-90 transition" style={{ backgroundColor: accent, color: accentText, borderRadius: THEME.radius }}>
            {t.contactAufnehmen}
          </button>
        </div>
      </footer>
    </div>
  );
};
