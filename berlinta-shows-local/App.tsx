import React, { useState, useEffect, useMemo, useRef, lazy, Suspense } from 'react';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence, useScroll, useTransform, useMotionValue } from 'framer-motion';
import { Search, Sparkles, ArrowRight, X, Heart, ArrowUpRight, Star, CheckCircle2, Zap, Users, HeartHandshake } from 'lucide-react';
import { BrowserRouter, Routes, Route, Outlet, useNavigate, useParams, Link, useLocation, Navigate } from 'react-router-dom';
import { Category, Show, CustomerBrief, ArtistStatus } from './types';
import { VIBE_OPTIONS } from './constants';
import { aiService } from './services/aiService';
import * as apiClient from './services/apiClient';
import { scoreShows } from './lib/matching';
import { conversationStart, conversationMessage } from './services/conversationService';
import { LanguageToggle } from './components/LanguageToggle';
import { PageSEO } from './components/PageSEO';
import { ShowCard } from './components/ShowCard';
import { JoinOverview } from './components/JoinOverview';
import { useShows } from './contexts/ShowsContext';
import { fetchShowsPage } from './services/showsService';
import { submitArtistOnboarding } from './services/submissionsService';
import { resolveArtistToken, getStoredArtistToken, setStoredArtistToken, clearStoredArtistToken, fetchArtistShows, type ResolveArtistResponse, type ArtistPortalData } from './services/artistService';
import { adminIsLoggedIn } from './services/adminService';
import { fetchBlogPosts, fetchBlogPost } from './services/blogService';
import type { BlogPost } from './types';

const AdminLogin = lazy(() => import('./components/Admin').then(m => ({ default: m.AdminLogin })));
const AdminDashboard = lazy(() => import('./components/Admin').then(m => ({ default: m.AdminDashboard })));
const AdminSubmissionDetail = lazy(() => import('./components/Admin').then(m => ({ default: m.AdminSubmissionDetail })));
const AdminShowEdit = lazy(() => import('./components/Admin').then(m => ({ default: m.AdminShowEdit })));
const AdminBlogList = lazy(() => import('./components/Admin').then(m => ({ default: m.AdminBlogList })));
const AdminBlogEditor = lazy(() => import('./components/Admin').then(m => ({ default: m.AdminBlogEditor })));
const ShowDetail = lazy(() => import('./components/ShowDetailRoute').then(m => ({ default: m.ShowDetail })));

// --- Layout Component ---
const Layout: React.FC<{ children: React.ReactNode, locale: 'de' | 'en', setLocale: (l: 'de' | 'en') => void }> = ({ children, locale, setLocale }) => {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const path = location.pathname || '/';
    const titles: Record<string, string> = {
      '/': 'Berlintina Shows – Events & Shows in Berlin',
      '/catalog': 'Alle Shows | Berlintina',
      '/join': locale === 'de' ? 'Für Künstler | Berlintina' : 'For Artists | Berlintina',
      '/join/start': locale === 'de' ? 'Show eintragen | Berlintina' : 'Add your show | Berlintina',
      '/blog': 'Blog | Berlintina',
      '/artist': locale === 'de' ? 'Meine Shows | Berlintina' : 'My Shows | Berlintina',
      '/about': 'Über mich | Berlintina',
      '/impressum': 'Impressum | Berlintina',
      '/datenschutz': 'Datenschutz | Berlintina',
    };
    if (path.startsWith('/show/') || path.startsWith('/blog/')) return;
    document.title = titles[path] ?? 'Berlintina Shows';
  }, [location.pathname]);

  useEffect(() => { setMobileMenuOpen(false); }, [location.pathname]);

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      {/* ── Navbar ── */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 transition-all duration-300 ${
          scrolled
            ? 'bg-glass shadow-[0_1px_2px_rgba(10,12,20,.04),0_4px_16px_rgba(10,12,20,.04)]'
            : ''
        }`}
      >
        <Link to="/" className="text-[1.1rem] font-semibold tracking-[-0.02em] text-charcoal no-underline">
          berlintina<span className="text-terracotta">.</span>
        </Link>

        <nav className="hidden md:flex items-center gap-6">
          <Link to="/catalog" className="text-sm font-semibold tracking-[0.3px] text-warm-muted hover:text-charcoal transition no-underline">
            {locale === 'de' ? 'Shows' : 'Shows'}
          </Link>
          <Link to="/about" className="text-sm font-semibold tracking-[0.3px] text-warm-muted hover:text-charcoal transition no-underline">
            {locale === 'de' ? 'Kontakt' : 'Contact'}
          </Link>
          <Link to="/join" className="text-sm font-semibold tracking-[0.3px] text-warm-muted hover:text-charcoal transition no-underline">
            {locale === 'de' ? 'Für Künstler' : 'For Artists'}
          </Link>
          <a
            href={`mailto:info@berlintina.de?subject=${encodeURIComponent(locale === 'de' ? 'Buchungsanfrage' : 'Booking Inquiry')}`}
            className="text-sm font-medium bg-charcoal text-white px-5 py-2 rounded-[10px] hover:opacity-85 transition no-underline inline-flex items-center gap-1"
          >
            {locale === 'de' ? 'Act buchen ↗' : 'Book a Show ↗'}
          </a>
          <LanguageToggle locale={locale} onChange={setLocale} />
        </nav>

        <div className="flex items-center gap-3 md:hidden">
          <LanguageToggle locale={locale} onChange={setLocale} />
          <button
            onClick={() => setMobileMenuOpen((o) => !o)}
            className="p-2 -mr-1 rounded-lg hover:bg-surface-alt"
            aria-label="Menu"
          >
            <svg className="w-5 h-5 text-warm-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={mobileMenuOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="absolute top-full left-0 right-0 bg-glass border-t border-warm-border px-6 py-4 space-y-1 md:hidden">
            <Link to="/catalog" className="block py-2.5 text-sm text-warm-muted hover:text-charcoal transition">Shows</Link>
            <Link to="/about" className="block py-2.5 text-sm text-warm-muted hover:text-charcoal transition">{locale === 'de' ? 'Kontakt' : 'Contact'}</Link>
            <Link to="/join" className="block py-2.5 text-sm text-warm-muted hover:text-charcoal transition">{locale === 'de' ? 'Für Künstler' : 'For Artists'}</Link>
            <a
              href={`mailto:info@berlintina.de?subject=${encodeURIComponent(locale === 'de' ? 'Buchungsanfrage' : 'Booking Inquiry')}`}
              className="block py-2.5 text-sm font-medium text-charcoal"
            >
              {locale === 'de' ? 'Act buchen ↗' : 'Book a Show ↗'}
            </a>
          </div>
        )}
      </header>

      <main className="flex-grow">
        {children}
      </main>

      {/* ── Footer ── */}
      {(
        <footer className="bg-surface border-t border-warm-border px-6 py-10">
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:flex-wrap items-center sm:items-start justify-between gap-6 text-center sm:text-left">
            {/* Brand */}
            <div className="flex flex-col items-center sm:items-start gap-1">
              <span className="text-[0.95rem] font-semibold tracking-[-0.02em] text-charcoal">
                berlintina<span className="text-terracotta">.</span>
              </span>
              <p className="text-[0.72rem] text-warm-muted">
                © 2026 Berlintina · {locale === 'de' ? 'Boutique Entertainment, Berlin' : 'Boutique entertainment, Berlin'}
              </p>
            </div>

            {/* Contact */}
            <div className="flex flex-col items-center sm:items-start gap-1.5">
              <span className="text-[0.72rem] font-semibold uppercase tracking-wider text-warm-faint mb-0.5">
                {locale === 'de' ? 'Kontakt' : 'Contact'}
              </span>
              <a href="tel:+4916081068880" className="text-[0.75rem] text-warm-muted hover:text-charcoal transition">+49 160 8106880</a>
              <a href="mailto:info@berlintina.de" className="text-[0.75rem] text-warm-muted hover:text-charcoal transition">info@berlintina.de</a>
              <a href="https://wa.me/4916081068880" target="_blank" rel="noopener noreferrer" className="text-[0.75rem] text-warm-muted hover:text-charcoal transition">WhatsApp</a>
            </div>

            {/* Links */}
            <div className="flex flex-col items-center sm:items-start gap-1.5">
              <span className="text-[0.72rem] font-semibold uppercase tracking-wider text-warm-faint mb-0.5">Links</span>
              <a href="https://www.instagram.com/berlintina.shows" target="_blank" rel="noopener noreferrer" className="text-[0.75rem] text-warm-muted hover:text-charcoal transition flex items-center gap-1">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                Instagram
              </a>
              <Link to="/impressum" className="text-[0.75rem] text-warm-muted hover:text-charcoal transition">Impressum</Link>
              <Link to="/datenschutz" className="text-[0.75rem] text-warm-muted hover:text-charcoal transition">Datenschutz</Link>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
};

// --- About View ---
const About: React.FC<{ locale: 'de' | 'en' }> = ({ locale }) => {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
      <PageSEO
        title={locale === 'de' ? 'Über Berlintina — Valiantsina, Boutique-Künstleragentur Berlin' : 'About Berlintina — Valiantsina, Boutique Artist Agency Berlin'}
        description={locale === 'de'
          ? 'Hinter Berlintina steht Valiantsina — eine persönlich kuratierte Künstleragentur in Berlin für Showacts, Live-Musik, Akrobatik und mehr.'
          : 'Berlintina is Valiantsina — a personally curated artist agency in Berlin for show acts, live music, acrobatics and more.'}
        structuredData={{
          '@context': 'https://schema.org',
          '@type': 'Person',
          name: 'Valiantsina Förster',
          jobTitle: 'Founder & Curator',
          worksFor: { '@type': 'Organization', name: 'Berlintina' },
          url: 'https://berlintina.de/about',
          sameAs: ['https://www.instagram.com/berlintina.shows'],
        }}
      />
      <div className="flex flex-col items-center text-center mb-24">
        <div className="w-40 h-40 rounded-3xl overflow-hidden shadow-2xl mb-12">
          <img src="/images/valiantsina.png" alt="Valiantsina — Berlintina" className="w-full h-full object-cover object-top" />
        </div>
        <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-normal mb-6 sm:mb-8 tracking-tight">
          {locale === 'de' ? 'Hallo, ich bin Valiantsina.' : "Hi, I'm Valiantsina."}
        </h1>
        <div className="max-w-3xl text-left space-y-6 text-warm-muted text-lg leading-relaxed font-medium">
          <p className="text-charcoal font-semibold text-xl">
            {locale === 'de' ? 'Berlintina bin ich — Valiantsina.' : 'Berlintina is me — Valiantsina.'}
          </p>
          <p>
            {locale === 'de'
              ? 'Ich lebe seit Jahren in Berlin, kenne die Kunstszene aus erster Hand, und habe selbst erlebt, wie schwierig es ist, den richtigen Act für ein Event zu finden.'
              : "I've lived in Berlin for years, I know the arts scene intimately, and I've experienced first-hand how hard it is to find the right act for an event."}
          </p>
          <p>
            {locale === 'de'
              ? 'Deshalb habe ich Berlintina gegründet: Eine Plattform, auf der echte Berliner Künstler sichtbar werden — und Veranstalter den perfekten Match finden, ohne stundenlang suchen zu müssen.'
              : "So I built Berlintina: a platform where Berlin's finest artists get the visibility they deserve — and event organisers find their perfect match without hours of searching."}
          </p>
          <p>
            {locale === 'de'
              ? 'Jeder Künstler auf dieser Seite wurde von mir persönlich ausgewählt. Ich begleite Sie durch den gesamten Buchungsprozess — von der ersten Anfrage bis zur Unterschrift unter den Vertrag.'
              : 'Every artist on this site has been personally selected by me. I guide you through the entire booking process — from your first enquiry to the signed contract.'}
          </p>
          <div className="bg-surface-alt p-8 rounded-3xl border border-warm-border mt-6">
            <p className="text-charcoal font-semibold italic">
              {locale === 'de' ? 'Berlintina ist kein Algorithmus. Berlintina bin ich.' : "Berlintina isn't an algorithm. Berlintina is me."}
            </p>
          </div>
          <div className="pt-8 border-t border-warm-border mt-8">
            <p className="mt-4">
              <Link to="/blog" className="text-sm font-semibold text-terracotta underline underline-offset-4 hover:opacity-70 transition">
                {locale === 'de' ? 'Zum Blog →' : 'Read the Blog →'}
              </Link>
            </p>
          </div>
        </div>
      </div>
      <div className="flex flex-col md:flex-row gap-4 justify-center items-center mb-32">
        <Link to="/catalog" className="px-10 py-5 bg-terracotta text-white rounded-2xl font-semibold text-sm shadow-lg hover:bg-terracotta-dark transition">
          {locale === 'de' ? 'Shows entdecken' : 'Discover Shows'}
        </Link>
        <Link to="/join" className="px-10 py-5 border-2 border-warm-border rounded-2xl font-semibold text-sm text-warm-muted hover:text-charcoal hover:border-charcoal transition">
          {locale === 'de' ? 'Künstler werden' : 'Become an Artist'}
        </Link>
      </div>
    </div>
  );
};

// --- Impressum View ---
const Impressum: React.FC<{ locale: 'de' | 'en' }> = ({ locale }) => (
  <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
    <PageSEO
      title="Impressum | Berlintina"
      description="Impressum der Berlintina Showact-Agentur Berlin — Angaben gemäß § 5 TMG."
      noindex={true}
    />
    <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-charcoal mb-2">Impressum</h1>
    <p className="text-warm-muted text-sm mb-10">{locale === 'de' ? 'Angaben gemäß § 5 TMG' : 'Information according to § 5 TMG'}</p>
    <div className="space-y-8 text-sm text-charcoal leading-relaxed">
      <section>
        <h2 className="font-semibold text-base mb-2">{locale === 'de' ? 'Anbieter' : 'Service Provider'}</h2>
        <p>Valiantsina Förster<br />Berlintina Shows<br />Berlin, Deutschland</p>
      </section>
      <section>
        <h2 className="font-semibold text-base mb-2">Kontakt</h2>
        <p>
          Telefon: <a href="tel:+4916081068880" className="text-terracotta hover:underline">+49 160 8106880</a><br />
          E-Mail: <a href="mailto:info@berlintina.de" className="text-terracotta hover:underline">info@berlintina.de</a>
        </p>
      </section>
      <section>
        <h2 className="font-semibold text-base mb-2">{locale === 'de' ? 'Verantwortlich für den Inhalt (§ 18 Abs. 2 MStV)' : 'Responsible for Content (§ 18 Abs. 2 MStV)'}</h2>
        <p>Valiantsina Förster<br />Berlin, Deutschland</p>
      </section>
      <section>
        <h2 className="font-semibold text-base mb-2">{locale === 'de' ? 'Haftungsausschluss' : 'Disclaimer'}</h2>
        <p className="text-warm-muted">
          {locale === 'de'
            ? 'Die Inhalte dieser Seite wurden mit größter Sorgfalt erstellt. Für die Richtigkeit, Vollständigkeit und Aktualität der Inhalte kann keine Gewähr übernommen werden. Als Diensteanbieter sind wir gemäß § 7 Abs. 1 TMG für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich.'
            : 'The contents of this site have been created with the greatest care. No guarantee can be given for the correctness, completeness and topicality of the content. As a service provider, we are responsible for our own content on these pages in accordance with general laws pursuant to § 7 Abs. 1 TMG.'}
        </p>
      </section>
      <section>
        <h2 className="font-semibold text-base mb-2">{locale === 'de' ? 'Urheberrecht' : 'Copyright'}</h2>
        <p className="text-warm-muted">
          {locale === 'de'
            ? 'Die durch den Betreiber dieser Seite erstellten Inhalte und Werke unterliegen dem deutschen Urheberrecht. Vervielfältigung, Bearbeitung, Verbreitung und jede Art der Verwertung außerhalb der Grenzen des Urheberrechts bedürfen der schriftlichen Zustimmung des jeweiligen Autors bzw. Erstellers.'
            : 'The content and works created by the operator of this site are subject to German copyright law. Reproduction, editing, distribution and any kind of use outside the limits of copyright law require the written consent of the respective author or creator.'}
        </p>
      </section>
    </div>
  </div>
);

// --- Datenschutz View ---
const Datenschutz: React.FC<{ locale: 'de' | 'en' }> = ({ locale }) => (
  <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
    <PageSEO
      title="Datenschutzerklärung | Berlintina"
      description="Datenschutzerklärung der Berlintina Showact-Agentur — DSGVO-konform, Berlin."
      noindex={true}
    />
    <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-charcoal mb-2">Datenschutzerklärung</h1>
    <p className="text-warm-muted text-sm mb-10">
      {locale === 'de' ? 'Gemäß DSGVO / Art. 13 DSGVO' : 'Privacy Policy pursuant to GDPR'}
    </p>
    <div className="space-y-8 text-sm text-charcoal leading-relaxed">
      <section>
        <h2 className="font-semibold text-base mb-2">{locale === 'de' ? '1. Verantwortliche Stelle' : '1. Controller'}</h2>
        <p>
          Valiantsina Förster · Berlintina Shows · Berlin<br />
          E-Mail: <a href="mailto:info@berlintina.de" className="text-terracotta hover:underline">info@berlintina.de</a><br />
          Tel.: <a href="tel:+4916081068880" className="text-terracotta hover:underline">+49 160 8106880</a>
        </p>
      </section>
      <section>
        <h2 className="font-semibold text-base mb-2">{locale === 'de' ? '2. Erhebung und Speicherung personenbezogener Daten' : '2. Collection and Storage of Personal Data'}</h2>
        <p className="text-warm-muted">
          {locale === 'de'
            ? 'Beim Besuch dieser Website werden automatisch Informationen vom Browser des Nutzers übermittelt (Server-Log-Files): IP-Adresse, Datum und Uhrzeit des Zugriffs, Name und URL der abgerufenen Datei, Browser und Betriebssystem. Diese Daten werden nur zur Sicherstellung eines störungsfreien Betriebs der Seite verwendet und nicht mit anderen Daten zusammengeführt.'
            : 'When visiting this website, the browser automatically transmits information (server log files): IP address, date and time of access, name and URL of the retrieved file, browser and operating system. This data is only used to ensure smooth operation of the site and is not combined with other data.'}
        </p>
      </section>
      <section>
        <h2 className="font-semibold text-base mb-2">{locale === 'de' ? '3. Kontaktaufnahme' : '3. Contact'}</h2>
        <p className="text-warm-muted">
          {locale === 'de'
            ? 'Wenn Sie uns per E-Mail oder WhatsApp kontaktieren, werden die von Ihnen übermittelten Daten (Name, E-Mail-Adresse, Nachrichteninhalt) ausschließlich zur Bearbeitung Ihrer Anfrage gespeichert. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Vertragsanbahnung) bzw. Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse).'
            : 'When you contact us by email or WhatsApp, the data you provide (name, email address, message content) is stored solely for the purpose of processing your enquiry. The legal basis is Art. 6(1)(b) GDPR (pre-contractual measures) or Art. 6(1)(f) GDPR (legitimate interest).'}
        </p>
      </section>
      <section>
        <h2 className="font-semibold text-base mb-2">{locale === 'de' ? '4. Weitergabe an Dritte' : '4. Sharing with Third Parties'}</h2>
        <p className="text-warm-muted">
          {locale === 'de'
            ? 'Personenbezogene Daten werden nicht an Dritte weitergegeben, es sei denn, dies ist zur Erfüllung des Vertrags erforderlich (z. B. Vermittlung an Künstler) oder Sie haben ausdrücklich eingewilligt.'
            : 'Personal data is not passed on to third parties unless this is necessary for the fulfilment of the contract (e.g. referral to artists) or you have given your express consent.'}
        </p>
      </section>
      <section>
        <h2 className="font-semibold text-base mb-2">{locale === 'de' ? '5. Hosting & Dienste' : '5. Hosting & Services'}</h2>
        <p className="text-warm-muted">
          {locale === 'de'
            ? 'Diese Website wird gehostet über Railway / Vercel. Die Datenbank wird über Supabase (PostgreSQL) betrieben. Beide Anbieter sind DSGVO-konform.'
            : 'This website is hosted via Railway / Vercel. The database is operated via Supabase (PostgreSQL). Both providers are GDPR-compliant.'}
        </p>
      </section>
      <section>
        <h2 className="font-semibold text-base mb-2">{locale === 'de' ? '6. Ihre Rechte' : '6. Your Rights'}</h2>
        <p className="text-warm-muted">
          {locale === 'de'
            ? 'Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch. Wenden Sie sich hierzu an: info@berlintina.de. Sie haben außerdem das Recht, Beschwerde bei einer Datenschutzbehörde einzulegen.'
            : 'You have the right to access, rectification, erasure, restriction of processing, data portability and objection. Please contact: info@berlintina.de. You also have the right to lodge a complaint with a data protection authority.'}
        </p>
      </section>
      <section>
        <h2 className="font-semibold text-base mb-2">{locale === 'de' ? '7. Cookies' : '7. Cookies'}</h2>
        <p className="text-warm-muted">
          {locale === 'de'
            ? 'Diese Website verwendet ausschließlich technisch notwendige Cookies (z. B. Sitzungsdaten, Spracheinstellung). Es werden keine Tracking- oder Werbe-Cookies eingesetzt.'
            : 'This website uses only technically necessary cookies (e.g. session data, language setting). No tracking or advertising cookies are used.'}
        </p>
      </section>
      <p className="text-warm-faint text-xs pt-4 border-t border-warm-border">
        {locale === 'de' ? 'Stand: März 2026' : 'Last updated: March 2026'}
      </p>
    </div>
  </div>
);

// --- Landing View ---
const Landing: React.FC<{ locale: 'de' | 'en' }> = ({ locale }) => {
  const { shows, loading: showsLoading, error: showsError } = useShows();
  const [query, setQuery] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(() => {
    try { return localStorage.getItem('agency_conversation_id'); } catch { return null; }
  });
  const [messages, setMessages] = useState<{ role: 'ai' | 'user'; text: string }[]>([]);
  const [rawRecommendations, setRawRecommendations] = useState<{ showId: string; why: string[] }[]>([]);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [retryFn, setRetryFn] = useState<(() => void) | null>(null);
  const navigate = useNavigate();
  const resultsRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress: heroScroll } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });
  const sliderTrackRef = useRef<HTMLDivElement>(null);
  const sliderXVal = useMotionValue(0);

  const recommendations = useMemo(() => {
    if (!rawRecommendations.length || !shows.length) return [];
    return rawRecommendations
      .map((r) => {
        const show = shows.find((s) => s.id === r.showId);
        return show ? { show, why: r.why } : null;
      })
      .filter((x): x is { show: Show; why: string[] } => x != null);
  }, [rawRecommendations, shows]);

  const hasResults = recommendations.length > 0;

  // Scroll results into view as soon as they arrive
  useEffect(() => {
    if (hasResults && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [hasResults]);

  const sendMessage = async (userText: string, retrying = false) => {
    if (!userText.trim() || loading) return;
    setLoading(true);
    setApiError(null);
    setRetryFn(null);
    setMessages((m) => [...m, { role: 'user', text: userText }]);
    if (!retrying) setQuery('');
    let cid = conversationId;
    try {
      if (!cid) {
        const { conversationId: newId, greeting } = await conversationStart('AGENCY', locale);
        cid = newId;
        setConversationId(cid);
        try { localStorage.setItem('agency_conversation_id', cid); } catch {}
        setMessages((m) => [...m, { role: 'ai', text: greeting }]);
      }
      const res = await conversationMessage(cid!, userText, {});
      setMessages((m) => [...m, { role: 'ai', text: res.assistantMessage }]);
      if (res.recommendations?.length) {
        setRawRecommendations(res.recommendations.map((r) => ({ showId: r.showId, why: r.why || [] })));
      }
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Request failed');
      setRetryFn(() => () => sendMessage(userText, true));
      if (!retrying) setMessages((m) => m.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  const audienceChips = locale === 'de'
    ? [
        { label: 'Corporate & Gala', query: 'elegante Live-Musik für Gala oder Corporate Event' },
        { label: 'Private Feier', query: 'Show für private Feier oder Geburtstag' },
        { label: 'Hochzeit & Party', query: 'Unterhaltung für Hochzeit oder Party' },
      ]
    : [
        { label: 'Corporate & Gala', query: 'elegant live music for gala or corporate event' },
        { label: 'Private Celebration', query: 'show for private celebration or birthday' },
        { label: 'Wedding & Party', query: 'entertainment for wedding or party' },
      ];

  const handleChip = (chipQuery: string) => {
    setQuery(chipQuery);
    sendMessage(chipQuery);
  };

  const defaultShows = useMemo(() => shows.slice(0, 12), [shows]);
  const [faqOpen, setFaqOpen] = useState<number | null>(null);
  const [activeCat, setActiveCat] = useState<string>('all');
  const [searchFocused, setSearchFocused] = useState(false);
  const filteredShows = useMemo(() => {
    if (activeCat === 'all') return defaultShows;
    return defaultShows.filter((s) => s.category === activeCat);
  }, [defaultShows, activeCat]);

  useEffect(() => {
    const onScroll = () => {
      const hero = heroRef.current;
      const track = sliderTrackRef.current;
      if (!hero || !track) return;
      const heroTop = hero.offsetTop;
      const heroH = hero.offsetHeight;
      const scrolled = window.scrollY - heroTop;
      const progress = Math.max(0, Math.min(1, scrolled / (heroH * 0.75)));
      const containerW = track.parentElement?.offsetWidth ?? 0;
      const maxShift = Math.max(0, track.scrollWidth - containerW);
      sliderXVal.set(-progress * maxShift);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [filteredShows.length]);

  const catPills = locale === 'de'
    ? [
        { label: 'Alle Shows', value: 'all' },
        { label: 'Akrobatik', value: Category.ACROBATICS },
        { label: 'Bands', value: Category.BAND },
        { label: 'Klassik', value: Category.CLASSICAL },
        { label: 'Tanz', value: Category.DANCE },
      ]
    : [
        { label: 'All Shows', value: 'all' },
        { label: 'Acrobatics', value: Category.ACROBATICS },
        { label: 'Live Bands', value: Category.BAND },
        { label: 'Classical', value: Category.CLASSICAL },
        { label: 'Dance', value: Category.DANCE },
      ];

  const dropSuggestions = locale === 'de'
    ? [
        'Akrobatik für Corporate-Gala',
        'Festival-Headliner Act',
        'Live-Band für Hochzeit',
        'Feuershow für Outdoor-Event',
        'Elegante Cocktailhour-Musik',
      ]
    : [
        'Acrobatics for corporate gala',
        'Festival headliner acts',
        'Live band for wedding',
        'Fire show for outdoor event',
        'Elegant cocktail hour music',
      ];

  return (
    <>
    <PageSEO
      title={locale === 'de'
        ? 'Berlintina | Showacts & Künstler Berlin buchen — persönlich kuratiert'
        : 'Berlintina | Book Show Acts & Artists in Berlin — Personally Curated'}
      description={locale === 'de'
        ? 'Berliner Showacts, Akrobatik, Live-Musik, Tanz & mehr — persönlich ausgewählt von Valiantsina. Kostenlose Anfrage. Antwort in 24 h.'
        : 'Berlin show acts, acrobatics, live music, dance & more — personally curated by Valiantsina. Free enquiry. Reply within 24 h.'}
      structuredData={{
        '@context': 'https://schema.org',
        '@type': 'EntertainmentBusiness',
        name: 'Berlintina',
        description: locale === 'de'
          ? 'Persönlich kuratierte Showact-Agentur Berlin'
          : 'Personally curated show act agency Berlin',
        url: 'https://berlintina.de',
        telephone: '+4916081068880',
        email: 'info@berlintina.de',
        address: { '@type': 'PostalAddress', addressLocality: 'Berlin', addressCountry: 'DE' },
        areaServed: { '@type': 'City', name: 'Berlin' },
        sameAs: ['https://www.instagram.com/berlintina.shows'],
        priceRange: '€€–€€€',
      }}
    />
    {/* ── Hero ── */}
    <section
      ref={heroRef}
      className="relative bg-[#f5f4f1] overflow-hidden pt-24 pb-0 min-h-screen flex flex-col"
    >
      {/* Subtle noise texture */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.025]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />

      <div className="relative z-10 flex-1 flex flex-col">
        {/* ── Top: H1 left + description right — both bottom-aligned ── */}
        <div className="flex items-end justify-between px-[5rem] pt-8 pb-10" style={{ gap: '5rem' }}>

          {/* Left: Big shimmer H1 */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="text-[clamp(3rem,6.5vw,7rem)] font-bold tracking-[-0.03em] leading-[0.93] shimmer-text flex-shrink-0"
            style={{ '--shimmer-accent': '#6366f1', width: '90ch', maxWidth: '55vw' } as React.CSSProperties}
          >
            {locale === 'de'
              ? <>Shows die<br />Köpfe drehen<br />und Herzen<br />gewinnen.</>
              : <>Shows that<br />turn heads<br />and conquer<br />hearts.</>}
          </motion.h1>

          {/* Right: Description + CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col gap-6 pb-1"
          >
            <p className="text-base text-charcoal leading-relaxed font-light">
              {locale === 'de'
                ? 'Berlintina ist eine Boutique Artist Agentur — spezialisiert auf Live Show Acts für Events, Galas und private Anlässe.'
                : 'Berlintina is a boutique artist agency — specialised in live show acts for events, galas and private occasions.'}
            </p>
            <Link
              to="/catalog"
              className="inline-flex items-center gap-2 bg-charcoal text-white text-sm font-semibold rounded-2xl hover:opacity-85 transition w-fit"
              style={{ padding: '1.25rem 1.625rem' }}
            >
              {locale === 'de' ? 'Shows entdecken' : 'Explore shows'} <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
        </div>

        {/* ── Show slider: scroll-driven, full width ── */}
        <div className="mt-auto overflow-hidden">
          {showsLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="flex items-center gap-1.5">
                {[0, 160, 320].map((d) => (
                  <span key={d} className="typing-dot w-2 h-2 rounded-full bg-charcoal/30 inline-block" style={{ animationDelay: `${d}ms` }} />
                ))}
              </div>
            </div>
          ) : filteredShows.length > 0 ? (
            <motion.div
              ref={sliderTrackRef}
              style={{ x: sliderXVal, gap: '2rem' }}
              className="flex will-change-transform"
            >
              {filteredShows.map((show) => (
                <div
                  key={show.id}
                  onClick={() => navigate(`/show/${show.slug}`)}
                  className="cursor-pointer group flex-shrink-0"
                  style={{ width: 'calc((100vw - 4rem) / 3.1)' }}
                >
                  <div className="rounded-2xl overflow-hidden aspect-[3/4] bg-surface-alt relative">
                    <img
                      src={show.photoUrls?.[0] || ''}
                      alt={show.title}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      loading="lazy"
                    />
                    {/* Hover liquidglass overlay */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-400">
                      <div style={{
                        background: 'rgba(255,255,255,0.18)',
                        backdropFilter: 'blur(18px) saturate(1.6)',
                        WebkitBackdropFilter: 'blur(18px) saturate(1.6)',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.4)',
                        borderRadius: '1rem',
                        padding: '5rem',
                        textAlign: 'center',
                      }}>
                        <p style={{ fontFamily: 'var(--font-display, inherit)', fontSize: '1.05rem', fontWeight: 700, color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.35)', lineHeight: 1.25, marginBottom: '0.35rem' }}>{show.title}</p>
                        <p style={{ fontFamily: 'var(--font-display, inherit)', fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.85)', textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>{show.category}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </motion.div>
          ) : null}
        </div>

        {/* ── Under-slider text ── */}
        <div className="px-[5rem] py-12">
          <p className="text-base text-charcoal leading-relaxed max-w-[75ch]">
            Wir sind eine Community aus außergewöhnlichen Künstlern und kreativen Talenten. Wir glauben fest an die Kraft von Live-Performances und echten menschlichen Emotionen. Jeder Act erzählt eine Geschichte und verleiht deinem Event Strahlkraft, Glaubwürdigkeit und eine besondere Energie. Bei uns findest du fertige Shows und handverlesene Künstler, die du direkt anfragen kannst. Auf Wunsch übernehmen wir die komplette Organisation für dich. Wir entwickeln und realisieren auch individuelle Shows und Performances, die genau zu deinem Event passen. Dafür bringen wir alles zusammen, was es braucht — von Künstlern über Konzept bis hin zu Kostüm und Maske. Begeistere dein Publikum wie nie zuvor.
          </p>
        </div>
      </div>
    </section>

    {/* ── AI Recommendations — full width ── */}
    {hasResults && (
      <div ref={resultsRef} className="w-full border-t border-warm-border scroll-mt-20">
        <div className="sticky top-0 z-20 bg-surface/95 backdrop-blur-sm border-b border-warm-border py-3 px-4 sm:px-6 shadow-soft">
          <form onSubmit={(e) => { e.preventDefault(); if (query.trim()) sendMessage(query.trim()); }} className="max-w-2xl mx-auto flex gap-2">
            <div className="relative flex-grow">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-faint pointer-events-none" />
              <input
                type="search"
                placeholder={locale === 'de' ? 'Neue Suche…' : 'New search…'}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-warm-border bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/10 focus:border-charcoal/30 placeholder:text-warm-faint font-light text-charcoal"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <button type="submit" disabled={loading} className="px-5 py-2.5 rounded-xl bg-charcoal text-white font-medium text-sm hover:opacity-85 transition disabled:opacity-50 whitespace-nowrap">
              {loading ? '…' : (locale === 'de' ? 'Suchen' : 'Search')}
            </button>
          </form>
        </div>
        <div className="w-full py-12 px-4 sm:px-6" style={{ background: 'linear-gradient(180deg,hsl(0 0% 100%) 0%,hsl(220 20% 98.5%) 100%)' }}>
          <div className="masonry-col">
            {recommendations.map(({ show, why }) => (
              <div key={show.id} className="masonry-col-item">
                <ShowCard show={show} locale={locale} onViewDetails={(s) => navigate(`/show/${s.slug}`)} />
                {why.length > 0 && (
                  <ul className="mt-2 text-xs text-warm-faint list-disc list-inside px-1">
                    {why.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    )}

    {/* ══ Default sections ══ */}
    {!hasResults && (<>

      {/* ── Roster — 100% width masonry ── */}
      <section className="w-full py-16 md:py-24 bg-noise" style={{ background: 'linear-gradient(180deg,hsl(0 0% 100%) 0%,hsl(220 20% 98.5%) 100%)' }}>
        <div className="w-full px-4" style={{ position: 'relative' }}>
          {/* noise overlay handled by bg-noise pseudo */}
          <div className="masonry-col-lg">
            {showsLoading ? (
              <div className="col-span-full flex items-center justify-center py-20">
                <div className="flex items-center gap-1.5">
                  {[0, 160, 320].map((d) => (
                    <span key={d} className="typing-dot w-2 h-2 rounded-full bg-charcoal/30 inline-block" style={{ animationDelay: `${d}ms` }} />
                  ))}
                </div>
              </div>
            ) : (
              filteredShows.map((show, i) => (
                <ShowCard key={show.id} show={show} locale={locale} onViewDetails={(s) => navigate(`/show/${s.slug}`)} index={i} />
              ))
            )}
          </div>
          {!showsLoading && (
            <div className="mt-12 text-center">
              <Link
                to="/catalog"
                className="inline-flex items-center gap-2 font-medium text-sm text-charcoal bg-surface border border-warm-border px-8 py-3.5 rounded-xl hover:shadow-card-hover hover:border-charcoal/20 transition"
              >
                {locale === 'de' ? 'Mehr laden' : 'Load more'} <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ── Why section ── */}
      <section className="relative py-20 md:py-28 bg-surface overflow-hidden">
        {/* Center orb */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none" style={{ background: 'hsla(250,100%,65%,.03)', filter: 'blur(120px)' }} />
        {/* Noise texture */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.015]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />

        <div className="relative z-10 max-w-[860px] mx-auto px-6">
          <div className="text-center mb-16 rounded-3xl px-8 py-10 mx-auto max-w-[520px]"
            style={{
              background: 'rgba(248,250,252,0.45)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(15,23,42,0.06)',
            }}
          >
            <span className="block text-[0.7rem] font-medium text-warm-muted uppercase tracking-[0.15em] mb-3">
              {locale === 'de' ? 'Warum Berlintina' : 'Why Berlintina'}
            </span>
            <h2 className="text-[clamp(1.9rem,4vw,3rem)] font-semibold tracking-[-0.04em] text-charcoal leading-[1.1] mb-4">
              {locale === 'de'
                ? <>Kein Marktplatz.<br /><span className="shimmer-text">Eine Boutique-Agentur.</span></>
                : <>Not a marketplace.<br /><span className="shimmer-text">A boutique agency.</span></>}
            </h2>
            <p className="text-base text-warm-muted font-light max-w-[380px] mx-auto leading-relaxed">
              {locale === 'de'
                ? 'Ich liste keine hundert Acts. Ich vertrete die Außergewöhnlichen.'
                : "We don't list hundreds of acts. We represent the exceptional ones."}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {([
              { Icon: CheckCircle2, title: locale === 'de' ? 'Persönlich kuratiert' : 'Personally Curated', text: locale === 'de' ? 'Jeder Künstler wurde von mir handverlesen. Kein Algorithmus — echte Expertise.' : 'Every performer is handpicked by our team. No algorithms — real expertise.' },
              { Icon: Zap, title: locale === 'de' ? 'Schnell & einfach' : 'Fast & Simple', text: locale === 'de' ? 'Eine Anfrage, ein Kontakt. Ich kümmere mich um Casting, Logistik und Verträge.' : 'One inquiry, one contact. We handle casting, logistics, and contracts.' },
              { Icon: Users, title: locale === 'de' ? 'Für jeden Anlass' : 'For Every Occasion', text: locale === 'de' ? 'Corporate Galas, Festivals, Hochzeiten — ich kenne die richtige Besetzung.' : 'Corporate galas, festivals, weddings, product launches — we\'ve seen it all.' },
              { Icon: HeartHandshake, title: locale === 'de' ? 'Künstler-zuerst' : 'Artist-First', text: locale === 'de' ? 'Ich stehe hinter jedem meiner Künstler. Glückliche Künstler liefern unvergessliche Shows.' : 'We invest in our artists like family. Happy artists deliver unforgettable shows.' },
            ] as const).map((card, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.4, delay: i * 0.05 + 0.05 }}
                className="group rounded-2xl p-6 flex flex-col gap-4 cursor-default transition-all duration-500 hover:-translate-y-[5px]"
                style={{
                  background: 'rgba(248,250,252,0.55)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  border: '1px solid rgba(15,23,42,0.08)',
                  boxShadow: '0 2px 8px rgba(15,23,42,0.04), 0 0 0 0.5px rgba(15,23,42,0.04)',
                }}
                whileHover={{ boxShadow: '0 12px 32px rgba(15,23,42,0.10), 0 0 0 0.5px rgba(15,23,42,0.06)' }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300 group-hover:scale-110"
                  style={{ background: 'rgba(99,102,241,0.10)', border: '1px solid rgba(99,102,241,0.15)' }}>
                  <card.Icon className="w-5 h-5 text-terracotta" />
                </div>
                <h3 className="text-[0.9rem] font-semibold text-charcoal leading-snug tracking-[-0.015em]">{card.title}</h3>
                <p className="text-[0.85rem] text-warm-muted font-light leading-relaxed flex-1">{card.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Featured Slider ── */}
      <FeaturedSlider locale={locale} />

      {/* ── Testimonials ── */}
      <section className="py-20 bg-surface-alt border-t border-warm-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-charcoal mb-3 text-center">
            {locale === 'de' ? 'Was Kunden sagen' : 'What clients say'}
          </h2>
          <p className="text-warm-muted text-center mb-12 font-light">
            {locale === 'de' ? 'Persönlich kuratiert. Professionell vermittelt.' : 'Personally curated. Professionally arranged.'}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                quote: locale === 'de'
                  ? '"Valiantsina hat für unsere Gala genau den richtigen Act gefunden — schnell, unkompliziert, perfekt. Wir buchen wieder."'
                  : '"Valiantsina found exactly the right act for our gala — fast, straightforward, perfect. We\'ll book again."',
                name: 'Sophie K.',
                role: locale === 'de' ? 'Eventmanagerin, Berlin' : 'Event Manager, Berlin',
              },
              {
                quote: locale === 'de'
                  ? '"Unsere Hochzeitsgesellschaft war begeistert. Der Cello-Act war eine Überraschung, die noch Monate danach erwähnt wird."'
                  : '"Our wedding guests were blown away. The cello act was a surprise that people still talk about months later."',
                name: 'Markus & Lena',
                role: locale === 'de' ? 'Hochzeitspaar, Potsdam' : 'Wedding couple, Potsdam',
              },
              {
                quote: locale === 'de'
                  ? '"Als Künstlerin schätze ich die persönliche Betreuung sehr. Berlintina vermittelt nur Anfragen, die wirklich passen."'
                  : '"As an artist I really appreciate the personal attention. Berlintina only passes on enquiries that are a genuine match."',
                name: 'Alina V.',
                role: locale === 'de' ? 'Sängerin & Performerin' : 'Singer & Performer',
              },
            ].map((t, i) => (
              <div key={i} className="rounded-2xl p-6 flex flex-col gap-4 transition-all duration-400 hover:-translate-y-1" style={{ background: 'rgba(248,250,252,0.6)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(15,23,42,0.07)', boxShadow: '0 2px 8px rgba(15,23,42,0.04)' }}>
                <div className="flex gap-1">
                  {[0,1,2,3,4].map(s => (
                    <svg key={s} className="w-4 h-4 text-terracotta" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                  ))}
                </div>
                <p className="text-sm text-warm-muted font-light leading-relaxed italic flex-1">{t.quote}</p>
                <div>
                  <p className="text-sm font-semibold text-charcoal">{t.name}</p>
                  <p className="text-xs text-warm-faint">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing Transparency ── */}
      <section className="py-16 bg-surface border-t border-warm-border">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-charcoal mb-3">
            {locale === 'de' ? 'Was kostet eine Buchung?' : 'What does a booking cost?'}
          </h2>
          <p className="text-warm-muted font-light mb-10">
            {locale === 'de' ? 'Keine versteckten Gebühren. Transparenz von Anfang an.' : 'No hidden fees. Transparent from the start.'}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            {[
              { tier: locale === 'de' ? 'Solo-Acts' : 'Solo Acts', price: locale === 'de' ? 'ab 800 €' : 'from €800', desc: locale === 'de' ? 'Musiker, Sänger, Akrobatik' : 'Musicians, singers, acrobatics' },
              { tier: locale === 'de' ? 'Premium-Acts' : 'Premium Acts', price: locale === 'de' ? '1.500–4.000 €' : '€1,500–4,000', desc: locale === 'de' ? 'Ensemble, Tanz, Live-Bands' : 'Ensembles, dance, live bands' },
              { tier: locale === 'de' ? 'Exklusive Shows' : 'Exclusive Shows', price: locale === 'de' ? 'Auf Anfrage' : 'On request', desc: locale === 'de' ? 'Maßgeschneiderte Produktionen' : 'Bespoke productions' },
            ].map((p, i) => (
              <div key={i} className={`rounded-2xl border p-5 text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover ${i === 1 ? 'border-terracotta bg-terracotta-light' : 'border-warm-border bg-surface-alt'}`}>
                <p className="text-xs font-semibold uppercase tracking-wider text-warm-faint mb-1">{p.tier}</p>
                <p className={`text-2xl font-bold tracking-tight mb-1 ${i === 1 ? 'text-terracotta' : 'text-charcoal'}`}>{p.price}</p>
                <p className="text-sm text-warm-muted font-light">{p.desc}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-warm-faint">
            {locale === 'de'
              ? 'Anfrage kostenlos · Vermittlungsgebühr 15–20 % des Künstlerhonorars · Angebot innerhalb von 24 h'
              : 'Enquiry free · Agency fee 15–20% of artist fee · Quote within 24 hours'}
          </p>
        </div>
      </section>

      {/* ── FAQ ── */}
      <div className="py-20 bg-surface border-t border-warm-border">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-charcoal mb-3 text-center">
            {locale === 'de' ? 'Häufige Fragen' : 'Frequently asked questions'}
          </h2>
          <p className="text-warm-muted text-center mb-12 font-light">
            {locale === 'de' ? 'Antworten auf die wichtigsten Fragen.' : 'Answers to the most common questions.'}
          </p>
          <div className="space-y-0">
            {(locale === 'de' ? [
              { q: 'Wie funktioniert die Buchung?', a: 'Sie beschreiben Ihr Event — Anlass, Datum, Budget, Stil. Ich suche persönlich den passenden Act aus meinem kuratierten Netzwerk heraus und sende Ihnen innerhalb von 24 Stunden konkrete Vorschläge. Bei Interesse stelle ich den Kontakt her und begleite Sie bis zur finalen Buchung.' },
              { q: 'Was kostet Berlintina?', a: 'Die Anfrage ist völlig kostenlos. Wenn es zur Buchung kommt, fällt eine Vermittlungsgebühr von 15–20% auf das vereinbarte Künstlerhonorar an. Bei komplexen Anfragen (mehrere Künstler, Produktionsbegleitung) kann eine zusätzliche Handling-Fee entstehen — das wird immer vorab transparent kommuniziert. Keine Überraschungen.' },
              { q: 'Kann ich die Künstler direkt kontaktieren?', a: 'Ja — sobald ich die Verbindung hergestellt habe. Berlintina ist keine Sperrschicht zwischen Ihnen und dem Künstler. Ich sorge für den richtigen Match, danach kommunizieren Sie direkt.' },
              { q: 'Wie schnell bekomme ich eine Antwort?', a: 'Innerhalb von 24 Stunden — meistens schneller. Bei dringenden Anfragen bitte direkt per WhatsApp oder Telefon kontaktieren.' },
              { q: 'Wie werden Shows auf Berlintina aufgenommen?', a: 'Jeder Künstler auf Berlintina wurde von mir persönlich ausgewählt. Entweder habe ich ihre Show live erlebt, oder sie wurden mir von vertrauenswürdigen Personen empfohlen. Kein automatisches Listing — nur geprüfte Qualität.' },
              { q: 'Was, wenn ich keinen passenden Act finde?', a: 'Dann suche ich weiter. Mein Netzwerk geht über die Website hinaus. Sagen Sie mir, was Sie suchen — ich finde eine Lösung.' },
            ] : [
              { q: 'How does booking work?', a: 'Describe your event — occasion, date, budget, style. I personally search my curated network and send you concrete suggestions within 24 hours. If you\'re interested, I make the introduction and guide you to the final booking.' },
              { q: 'What does Berlintina cost?', a: "The enquiry is completely free. When a booking is made, a booking fee of 15–20% of the agreed artist fee applies. For complex requests (multiple artists, production support) an additional handling fee may apply — always communicated transparently upfront. No surprises." },
              { q: 'Can I contact artists directly?', a: "Yes — once I've made the connection. Berlintina is not a barrier between you and the artist. I find the right match, then you communicate directly." },
              { q: 'How quickly will I get a reply?', a: 'Within 24 hours — usually faster. For urgent requests, please contact me directly via WhatsApp or phone.' },
              { q: 'How are artists selected for Berlintina?', a: "Every artist on Berlintina has been personally selected by me. I've either seen their show live, or they've been recommended by trusted contacts. No automatic listings — only vetted quality." },
              { q: "What if I can't find a suitable act?", a: "Then I keep searching. My network extends beyond the website. Tell me what you're looking for — I'll find a solution." },
            ]).map((item, i) => (
              <div key={i} className="border-b border-warm-border">
                <button
                  type="button"
                  onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                  className="w-full text-left py-5 flex items-center justify-between gap-4 text-charcoal font-medium hover:text-warm-muted transition text-sm"
                >
                  <span>{item.q}</span>
                  <span className={`text-2xl font-light flex-shrink-0 transition-transform duration-200 ${faqOpen === i ? 'rotate-45' : ''}`}>+</span>
                </button>
                {faqOpen === i && (
                  <div className="pb-5 text-warm-muted text-sm font-light leading-relaxed">{item.a}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

    </>)}
</>
  );
};

// --- Results View ---
const Results: React.FC<{ locale: 'de' | 'en' }> = ({ locale }) => {
  const { shows, loading: showsLoading, error: showsError } = useShows();
  const { briefId } = useParams();
  const [brief, setBrief] = useState<CustomerBrief | null>(null);
  const [limit, setLimit] = useState(3);
  const navigate = useNavigate();

  useEffect(() => {
    const data = sessionStorage.getItem(`brief_${briefId}`);
    if (data) setBrief(JSON.parse(data));
  }, [briefId]);

  const sortedShows = useMemo(() => {
    if (!brief) return [];
    return scoreShows(shows, brief);
  }, [brief, shows]);

  if (!brief) return <div className="p-20 text-center font-medium text-warm-faint">{locale === 'de' ? 'Lade Empfehlungen…' : 'Loading recommendations…'}</div>;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
      {showsError && (
        <div className="mb-8 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm font-medium">
          {showsError}
        </div>
      )}
      <div className="mb-12">
        <h2 className="text-3xl font-bold mb-3 tracking-tight">
          {locale === 'de' ? 'Unsere Empfehlungen' : 'Our Recommendations'}
        </h2>
        <p className="text-warm-muted font-medium">
          {locale === 'de'
            ? 'Basierend auf deiner Suche haben wir diese Highlights gefunden.'
            : 'Based on your search, we found these highlights.'}
        </p>
      </div>
      <div className="masonry-grid">
        {sortedShows.slice(0, limit).map(show => (
          <div key={show.id} className="masonry-item">
            <ShowCard show={show} locale={locale} onViewDetails={(s) => navigate(`/show/${s.slug}`)} />
          </div>
        ))}
      </div>
    </div>
  );
};

interface SubmissionForm {
  artistGenre?: string;
  showTitle?: string;
  photoFile?: File;
  videoUrls?: string[];
  durationMinutes?: number;
  languageOptions?: string[];
  priceText?: string;
  shortDescriptionFacts?: string;
  salesPitchText?: string;
  socialLinks?: string;
  artistBio?: string;
  submitterEmail?: string;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// --- Featured Slider ---
const SLIDER_TABS = [
  { key: 'all',     de: 'Alle',      en: 'All' },
  { key: 'shows',   de: 'Shows',     en: 'Shows' },
  { key: 'artists', de: 'Künstler',  en: 'Artists' },
  { key: 'new',     de: 'Newcomer',  en: 'New Comers' },
] as const;

const CATEGORY_SHIMMER_SLIDER: Record<string, string> = {
  CLASSICAL: '#9333ea', BAND: '#6366f1', ACROBATICS: '#16a34a', DANCE: '#db2777',
};

const FeaturedSlider: React.FC<{ locale: 'de' | 'en' }> = ({ locale }) => {
  const { shows } = useShows();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'all' | 'shows' | 'artists' | 'new'>('all');
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  const jimJohn = {
    id: 'jim-john', type: 'featured' as const,
    image: '/images/jim-john.jpeg',
    category: 'ACROBATICS',
    title: 'Jim & John',
    artist: locale === 'de' ? 'Berlintinas Top-Act' : "Berlintina's Top Act",
    description: locale === 'de'
      ? 'Bekannt aus Das Supertalent, America\'s Got Talent & Cirque du Soleil. 8 deutsche Meistertitel, Guinness-Weltrekord.'
      : "As seen on Das Supertalent, America's Got Talent & Cirque du Soleil. 8 German championship titles, Guinness World Record.",
    link: null as string | null,
  };

  const showSlides = shows.slice(0, 6).map(s => ({
    id: s.id, type: 'show' as const,
    image: s.photoUrls?.[0] || '',
    category: s.category,
    title: s.title,
    artist: `${locale === 'de' ? 'von' : 'by'} ${s.artistName}`,
    description: s.shortDescriptionFacts?.slice(0, 120) || '',
    link: `/show/${s.slug}` as string | null,
  }));

  const allSlides = [jimJohn, ...showSlides];
  const filtered =
    tab === 'all' ? allSlides
    : tab === 'shows' ? showSlides
    : tab === 'artists' ? [jimJohn]
    : showSlides.slice(-3);

  const slides = filtered.length > 0 ? filtered : allSlides;
  const clampedIdx = Math.min(idx, slides.length - 1);
  const active = slides[clampedIdx];

  useEffect(() => { setIdx(0); }, [tab]);

  useEffect(() => {
    if (paused || slides.length <= 1) return;
    const t = setInterval(() => setIdx(i => (i + 1) % slides.length), 5000);
    return () => clearInterval(t);
  }, [paused, slides.length]);

  return (
    <section
      className="relative w-full overflow-hidden"
      style={{ background: '#0d0d1a' }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-10 py-14 sm:py-20">

        {/* Tabs */}
        <div className="flex items-center gap-2 mb-10 flex-wrap">
          {SLIDER_TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                tab === t.key
                  ? 'bg-white/10 text-white border border-white/20'
                  : 'text-white/35 hover:text-white/60 border border-transparent'
              }`}
            >
              {locale === 'de' ? t.de : t.en}
            </button>
          ))}
        </div>

        {/* Headline — static gradient, no animation */}
        <h2 className="text-[1.75rem] sm:text-4xl md:text-5xl lg:text-[3.5rem] font-semibold tracking-[-0.04em] leading-[1.05] mb-3 gradient-text-static">
          {locale === 'de' ? 'Berlintinas Top-Acts.' : "Berlintina's Top Acts."}
        </h2>
        <p className="text-white/40 text-base mb-8 max-w-xl">
          {locale === 'de'
            ? 'Persönlich kuratiert — jeder Act geprüft, jede Show außergewöhnlich.'
            : 'Personally curated — every act vetted, every show extraordinary.'}
        </p>

        {/* CTA buttons */}
        <div className="flex flex-wrap gap-3 mb-12">
          <a
            href={`mailto:info@berlintina.de?subject=${encodeURIComponent(locale === 'de' ? 'Buchungsanfrage' : 'Booking Inquiry')}`}
            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-charcoal text-sm font-bold rounded-2xl hover:opacity-90 transition shadow-lg"
          >
            <span>berlintina<span className="text-terracotta">.</span></span>
            {locale === 'de' ? 'anfragen →' : 'enquire →'}
          </a>
          <Link
            to="/join/start"
            className="inline-flex items-center gap-2 px-6 py-3 border border-white/20 text-white text-sm font-semibold rounded-2xl hover:bg-white/10 transition"
          >
            {locale === 'de' ? 'Künstler werden ↗' : 'Join as artist ↗'}
          </Link>
        </div>

        {/* 2-column: list left · image right */}
        <div className="flex flex-col-reverse lg:flex-row gap-8 lg:gap-12 items-start">

          {/* LEFT: show list */}
          <div className="w-full lg:w-[340px] xl:w-[380px] flex-shrink-0 space-y-2">
            {slides.map((s, i) => {
              const isActive = i === clampedIdx;
              return (
                <button
                  key={s.id}
                  onClick={() => setIdx(i)}
                  className={`w-full text-left rounded-2xl px-5 py-4 transition-all duration-300 ${
                    isActive
                      ? 'bg-white/8 border border-white/15'
                      : 'border border-transparent hover:bg-white/4'
                  }`}
                  style={isActive ? { background: 'rgba(255,255,255,0.07)' } : {}}
                >
                  <div className="flex items-start gap-3">
                    <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 transition-colors ${isActive ? 'bg-terracotta' : 'bg-white/15'}`} />
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-semibold leading-snug mb-1 transition-colors ${isActive ? 'text-white' : 'text-white/40'}`}>
                        {s.title}
                      </p>
                      <p className={`text-xs leading-relaxed transition-colors ${isActive ? 'text-white/55' : 'text-white/20'}`}>
                        {isActive ? s.description : s.artist}
                      </p>
                    </div>
                    {isActive && (
                      <ArrowUpRight className="w-4 h-4 text-white/30 flex-shrink-0 mt-0.5" />
                    )}
                  </div>
                </button>
              );
            })}

            {/* CTA to catalog */}
            <div className="pt-2">
              <Link
                to="/catalog"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-white/35 hover:text-white/70 transition px-5"
              >
                {locale === 'de' ? 'Alle Shows ansehen' : 'View all shows'} →
              </Link>
            </div>
          </div>

          {/* RIGHT: big image */}
          <div className="flex-1 min-w-0">
            <div className="relative rounded-3xl overflow-hidden aspect-[4/3] sm:aspect-[16/10] shadow-2xl">
              {active.image
                ? (
                  <img
                    key={active.id}
                    src={active.image}
                    alt={active.title}
                    className="w-full h-full object-cover transition-opacity duration-500"
                  />
                )
                : <div className="w-full h-full bg-white/5 flex items-center justify-center text-white/20 text-sm">No image</div>
              }
              {/* Bottom overlay with info */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
              <div className="absolute bottom-5 left-6 right-6 flex items-end justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-white/50 mb-1">{active.category}</p>
                  <p className="text-white font-semibold text-lg leading-snug">{active.title}</p>
                  <p className="text-white/50 text-sm">{active.artist}</p>
                </div>
                {active.link ? (
                  <button
                    onClick={() => navigate(active.link!)}
                    className="flex-shrink-0 px-5 py-2.5 bg-white text-charcoal text-sm font-bold rounded-xl hover:opacity-90 transition ml-4"
                  >
                    {locale === 'de' ? 'Ansehen →' : 'View →'}
                  </button>
                ) : (
                  <a
                    href="https://wa.me/491608106880"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0 px-5 py-2.5 bg-white text-charcoal text-sm font-bold rounded-xl hover:opacity-90 transition ml-4"
                  >
                    {locale === 'de' ? 'Anfragen →' : 'Book →'}
                  </a>
                )}
              </div>
            </div>

            {/* Progress dots */}
            <div className="flex items-center gap-1.5 mt-4 px-1">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setIdx(i)}
                  className={`rounded-full transition-all duration-300 ${i === clampedIdx ? 'w-6 h-1.5 bg-white/70' : 'w-1.5 h-1.5 bg-white/15 hover:bg-white/30'}`}
                />
              ))}
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};

// --- Join Landing View ---
const JoinLanding: React.FC<{ locale: 'de' | 'en' }> = ({ locale }) => {
  const navigate = useNavigate();
  const [hasStoredToken, setHasStoredToken] = useState(false);

  useEffect(() => {
    setHasStoredToken(!!getStoredArtistToken());
  }, []);

  const benefits = locale === 'de'
    ? [
        'Persönlich geprüft von Valiantsina — nur geprüfte Qualität',
        'Gefunden von Eventagenturen & Privatkunden in Berlin',
        'Spare Zeit: Ich erstelle deine Beschreibung aus deiner Website — du musst nichts schreiben',
      ]
    : [
        'Personally reviewed by Valiantsina — only vetted quality',
        'Found by event agencies & private customers in Berlin',
        'Save time: I create your profile from your website — no writing needed',
      ];
  return (
    <div className="max-w-2xl mx-auto px-4 py-20 text-center">
      {hasStoredToken && (
        <div className="mb-8 p-5 rounded-2xl bg-surface-alt border border-warm-border text-center">
          <p className="text-sm font-semibold text-warm-muted mb-3">
            {locale === 'de' ? 'Willkommen zurück! Du hast bereits Shows auf Berlintina.' : 'Welcome back! You already have shows on Berlintina.'}
          </p>
          <Link to="/artist" className="inline-block px-6 py-2.5 bg-terracotta text-white rounded-xl font-semibold text-sm hover:bg-terracotta-dark transition">
            {locale === 'de' ? 'Meine Shows ansehen →' : 'View my shows →'}
          </Link>
        </div>
      )}
      <div className="bg-surface rounded-[2.5rem] border border-warm-border shadow-2xl p-6 sm:p-10 md:p-12">
        <div className="w-16 h-16 rounded-2xl bg-terracotta text-white flex items-center justify-center font-black text-2xl italic shadow-xl mx-auto mb-8">V</div>
        <h1 className="font-display text-3xl sm:text-4xl font-normal tracking-tight text-charcoal mb-3">
          {locale === 'de' ? 'Zeig deine Show auf Berlintina' : 'Add your show to Berlintina'}
        </h1>
        <p className="text-sm font-semibold text-warm-faint uppercase tracking-widest mb-10">
          {locale === 'de' ? 'PERSÖNLICH BETREUT · ECHTE BUCHUNGSANFRAGEN · BERLIN-NETZWERK' : 'PERSONALLY SUPPORTED · REAL BOOKING ENQUIRIES · BERLIN NETWORK'}
        </p>
        <ul className="text-left space-y-4 mb-12">
          {benefits.map((benefit) => (
            <li key={benefit} className="flex items-start gap-3 text-sm font-medium text-warm-muted">
              <span className="mt-0.5 w-5 h-5 rounded-full bg-terracotta text-white flex items-center justify-center text-xs font-black flex-shrink-0">✓</span>
              {benefit}
            </li>
          ))}
        </ul>
        <div className="bg-surface-alt rounded-2xl border border-warm-border p-5 mb-8 text-left">
          <p className="text-xs font-bold uppercase tracking-widest text-warm-faint mb-3">
            {locale === 'de' ? 'Wie es funktioniert' : 'How it works'}
          </p>
          <ul className="space-y-2.5">
            {(locale === 'de' ? [
              'Du bewirbst dich — Valiantsina prüft persönlich (keine Bots)',
              'Bei Aufnahme: kostenloses Profil + aktive Vermittlung',
              'Provision nur bei erfolgreicher Buchung: 15% — du zahlst nur, wenn du verdienst',
            ] : [
              'You apply — Valiantsina reviews personally (no bots)',
              'If accepted: free profile + active representation',
              'Commission only on successful bookings: 15% — you only pay when you earn',
            ]).map((item, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-warm-muted">
                <span className="mt-0.5 w-4 h-4 rounded-full bg-terracotta text-white flex items-center justify-center text-[9px] font-black flex-shrink-0">{i + 1}</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
        <button
          type="button"
          onClick={() => navigate('/join/start')}
          className="w-full py-4 bg-terracotta text-white rounded-2xl font-semibold text-sm hover:bg-terracotta-dark transition shadow-lg mb-4"
        >
          {locale === 'de' ? 'Jetzt bewerben →' : 'Apply now →'}
        </button>
        <p className="text-xs text-warm-faint font-medium">
          {locale === 'de' ? 'Bereits eingetragen? Dein Fortschritt wird gespeichert.' : 'Already listed? Your progress is saved.'}
        </p>
      </div>
    </div>
  );
};

// --- Typing indicator: 3 animated dots ---
const TypingIndicator: React.FC = () => (
  <div className="flex justify-start">
    <div className="bg-surface-alt rounded-[1.5rem] rounded-bl-none px-5 py-3.5 flex items-center gap-1.5 shadow-sm">
      {[0, 160, 320].map((delay) => (
        <span key={delay} className="typing-dot w-2 h-2 rounded-full bg-warm-muted inline-block" style={{ animationDelay: `${delay}ms` }} />
      ))}
    </div>
  </div>
);

// --- Progress pills for submission draft ---
const PROGRESS_KEYS = [
  { key: 'artistName', de: 'Name', en: 'Name' },
  { key: 'showTitle', de: 'Titel', en: 'Title' },
  { key: 'artistGenre', de: 'Genre', en: 'Genre' },
  { key: 'shortDescriptionFacts', de: 'Beschreibung', en: 'Description' },
  { key: 'submitterEmail', de: 'E-Mail', en: 'Email' },
] as const;

const EDIT_FIELDS = [
  { key: 'showTitle',             de: 'Show-Titel',        en: 'Show Title',        ph_de: 'z.B. Berlintina Cello Trio',           ph_en: 'e.g. Berlintina Cello Trio',         multiline: false },
  { key: 'artistName',            de: 'Künstler',           en: 'Artist',            ph_de: 'z.B. Trio Eclat',                      ph_en: 'e.g. Trio Eclat',                    multiline: false },
  { key: 'artistGenre',           de: 'Genre',              en: 'Genre',             ph_de: 'z.B. Klassik, Akrobatik',              ph_en: 'e.g. Classical, Acrobatics',         multiline: false },
  { key: 'durationMinutes',       de: 'Dauer (Minuten)',    en: 'Duration (min)',    ph_de: '60',                                   ph_en: '60',                                 multiline: false },
  { key: 'priceText',             de: 'Preis',              en: 'Price',             ph_de: 'ab 1.500 €',                           ph_en: 'from €1,500',                        multiline: false },
  { key: 'shortDescriptionFacts', de: 'Kurzbeschreibung',   en: 'Short description', ph_de: 'Was macht deine Show besonders?',      ph_en: 'What makes your show special?',      multiline: true  },
  { key: 'artistBio',             de: 'Über den Künstler',  en: 'About the artist',  ph_de: 'Hintergrund, Stil, Erfahrung…',        ph_en: 'Background, style, experience…',     multiline: true  },
  { key: 'socialLinks',           de: 'Website / Social',   en: 'Website / Social',  ph_de: 'https://deine-website.de',             ph_en: 'https://your-website.com',           multiline: false },
  { key: 'submitterEmail',        de: 'Kontakt E-Mail',     en: 'Contact Email',     ph_de: 'deine@email.de',                       ph_en: 'your@email.com',                     multiline: false },
];

// --- Live Show Preview (split-panel right side) ---
const PREVIEW_ACCENT: Record<string, string> = {
  CLASSICAL: '#7C3AED', KLASSIK: '#7C3AED',
  BAND: '#1D4ED8',
  ACROBATICS: '#EA580C', AKROBATIK: '#EA580C', AKROBATIK_VARIETÉ: '#EA580C',
  DANCE: '#BE185D', TANZ: '#BE185D',
};
function previewAccent(genre: string) {
  const key = genre.toUpperCase().replace(/[^A-ZÄÖÜ]/g, '_');
  return PREVIEW_ACCENT[key] ?? PREVIEW_ACCENT[genre.toUpperCase()] ?? '#1a1a1a';
}

const ShowPreview: React.FC<{ draft: Record<string, unknown>; photoFile: File | null; locale: 'de' | 'en'; fullWidth?: boolean; onFieldEdit?: (key: string, val: string) => void; onPhotoChange?: (file: File) => void }> = ({ draft, photoFile, locale, fullWidth, onFieldEdit, onPhotoChange }) => {
  const title = String(draft.showTitle || '');
  const artistName = String(draft.artistName || '');
  const genre = String(draft.artistGenre || '');
  const description = String(draft.shortDescriptionFacts || draft.salesPitchText || '');
  const price = String(draft.priceText || '');
  const duration = draft.durationMinutes ? `${draft.durationMinutes} min` : '';
  const bio = String(draft.artistBio || '');
  const socialLinks = String(draft.socialLinks || '');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editVal, setEditVal] = useState('');

  useEffect(() => {
    if (!photoFile) { setPhotoUrl(null); return; }
    const url = URL.createObjectURL(photoFile);
    setPhotoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photoFile]);

  const isEmpty = !title && !artistName && !genre && !description;
  const accent = previewAccent(genre);
  const accentBg = `${accent}18`;

  const startEdit = (key: string) => { setEditingField(key); setEditVal(String(draft[key] ?? '')); };
  const saveEdit = () => { if (editingField) { onFieldEdit?.(editingField, editVal); setEditingField(null); } };
  const cancelEdit = () => setEditingField(null);
  const pencilSvg = <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;

  // Wraps content with a pencil edit button; shows inline editor when active
  const ef = (key: string, multiline: boolean, node: React.ReactNode, placeholder?: string) => {
    if (editingField === key) {
      return (
        <div className="flex-1">
          {multiline
            ? <textarea value={editVal} onChange={e => setEditVal(e.target.value)} rows={4} autoFocus className="w-full text-sm px-3 py-2 rounded-xl border border-terracotta/60 bg-white text-charcoal focus:outline-none focus:ring-2 focus:ring-terracotta/20 resize-none" />
            : <input type="text" value={editVal} onChange={e => setEditVal(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }} className="w-full text-sm px-3 py-2 rounded-xl border border-terracotta/60 bg-white text-charcoal focus:outline-none focus:ring-2 focus:ring-terracotta/20" />
          }
          <div className="flex gap-2 mt-2">
            <button type="button" onClick={saveEdit} className="text-xs px-3 py-1.5 bg-terracotta text-white rounded-lg font-semibold">{locale === 'de' ? 'Speichern' : 'Save'}</button>
            <button type="button" onClick={cancelEdit} className="text-xs px-3 py-1.5 bg-white border border-warm-border text-warm-muted rounded-lg">✕</button>
          </div>
        </div>
      );
    }
    return (
      <div className="group flex items-start gap-1.5 flex-1">
        <div className="flex-1 min-w-0">{node || <span className="text-warm-faint italic text-xs">{placeholder}</span>}</div>
        {onFieldEdit && (
          <button type="button" onClick={() => startEdit(key)} className="flex-shrink-0 p-1 rounded text-warm-faint hover:text-terracotta transition opacity-40 hover:opacity-100 mt-0.5" title={locale === 'de' ? 'Bearbeiten' : 'Edit'}>
            {pencilSvg}
          </button>
        )}
      </div>
    );
  };

  const previewShimmer = CATEGORY_SHIMMER_SLIDER[genre?.toUpperCase()] ?? accent;

  if (fullWidth) {
    return (
      <div className="h-full overflow-y-auto bg-parchment">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[400px] px-8 text-center">
            <h2 className="text-2xl font-semibold text-charcoal mb-3 tracking-tight">
              {locale === 'de' ? 'Deine Show-Seite' : 'Your Show Page'}
            </h2>
            <p className="text-warm-muted text-sm mb-6">
              {locale === 'de' ? 'Erscheint hier, sobald du mit dem Chat beginnst…' : 'Appears here as you start chatting…'}
            </p>
            <div className="flex items-center gap-3 w-full max-w-sm">
              <div className="flex-1 h-px bg-warm-border" />
              <span className="text-warm-faint text-sm flex-shrink-0">✦</span>
              <div className="flex-1 h-px bg-warm-border" />
            </div>
          </div>
        ) : (
          <div className="w-full max-w-3xl mx-auto px-5 sm:px-8 py-8">

            {/* Hero image */}
            <label className="relative rounded-3xl overflow-hidden mb-8 aspect-[16/7] bg-surface-alt block cursor-pointer group/photo">
              {photoUrl
                ? <img src={photoUrl} alt={title} className="w-full h-full object-cover" />
                : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-warm-faint">
                    <svg width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 20M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                    <span className="text-xs font-medium">{locale === 'de' ? 'Foto hinzufügen' : 'Add photo'}</span>
                  </div>
                )
              }
              {/* Hover overlay — change photo */}
              {onPhotoChange && (
                <div className="absolute inset-0 bg-charcoal/0 group-hover/photo:bg-charcoal/40 transition-colors duration-300 flex items-center justify-center">
                  <span className="opacity-0 group-hover/photo:opacity-100 transition-opacity duration-300 flex items-center gap-2 px-4 py-2 rounded-full bg-white/90 text-charcoal text-xs font-semibold shadow-sm">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                    {locale === 'de' ? 'Foto ändern' : 'Change photo'}
                  </span>
                </div>
              )}
              {onPhotoChange && <input type="file" accept="image/*" className="sr-only" onChange={e => { const f = e.target.files?.[0]; if (f) onPhotoChange(f); }} />}
              {genre && (
                <div className="absolute bottom-4 left-4">
                  <span className="bg-glass text-charcoal text-[11px] font-semibold tracking-wider uppercase px-3 py-1.5 rounded-full">{genre}</span>
                </div>
              )}
            </label>

            {/* Title */}
            <div className="mb-2">
              {ef('showTitle', false,
                title
                  ? <h1 className="text-4xl sm:text-5xl font-semibold tracking-[-0.04em] leading-[1.05] shimmer-text" style={{ '--shimmer-accent': previewShimmer } as React.CSSProperties}>{title}</h1>
                  : <div className="h-12 w-3/4 bg-surface-alt rounded-xl animate-pulse" />,
                locale === 'de' ? 'Show-Titel…' : 'Show title…'
              )}
            </div>

            {/* Artist */}
            <div className="mb-6">
              {ef('artistName', false,
                artistName
                  ? <p className="text-base text-warm-muted">{locale === 'de' ? 'von' : 'by'} <span className="font-medium text-charcoal">{artistName}</span></p>
                  : <div className="h-4 w-1/3 bg-surface-alt rounded animate-pulse" />,
                locale === 'de' ? 'Künstlername…' : 'Artist name…'
              )}
            </div>

            {/* Stats pills */}
            <div className="flex flex-wrap gap-2 mb-8">
              <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-surface-alt border border-warm-border text-sm font-medium text-charcoal">★ 5.0</span>
              {ef('durationMinutes', false,
                duration ? <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-surface-alt border border-warm-border text-sm font-medium text-charcoal">⏱ {duration}</span> : null,
                locale === 'de' ? 'Dauer…' : 'Duration…'
              )}
              {ef('priceText', false,
                price ? <span className="inline-flex items-center px-4 py-2 rounded-full bg-terracotta-light border border-terracotta/20 text-sm font-semibold text-terracotta">{price}</span> : null,
                locale === 'de' ? 'Preis…' : 'Price…'
              )}
            </div>

            {/* About */}
            <section className="mb-8">
              <h2 className="text-lg font-semibold text-charcoal mb-3">{locale === 'de' ? 'Über die Show' : 'About This Show'}</h2>
              {ef('shortDescriptionFacts', true,
                description
                  ? <p className="text-base text-charcoal leading-relaxed">{description}</p>
                  : <div className="space-y-2"><div className="h-3 bg-surface-alt rounded animate-pulse" /><div className="h-3 bg-surface-alt rounded animate-pulse w-4/5" /><div className="h-3 bg-surface-alt rounded animate-pulse w-3/5" /></div>,
                locale === 'de' ? 'Kurzbeschreibung deiner Show…' : 'Short description of your show…'
              )}
            </section>

            {/* Artist bio */}
            <section className="mb-8">
              <h2 className="text-lg font-semibold text-charcoal mb-3">{locale === 'de' ? 'Über die Künstler' : 'About the Artist'}</h2>
              {ef('artistBio', true,
                bio
                  ? <p className="text-base text-charcoal leading-relaxed italic border-l-2 border-warm-border pl-4">{bio}</p>
                  : <div className="space-y-2 border-l-2 border-surface-alt pl-4"><div className="h-3 bg-surface-alt rounded animate-pulse" /><div className="h-3 bg-surface-alt rounded animate-pulse w-4/5" /></div>,
                locale === 'de' ? 'Hintergrund, Stil, Erfahrung…' : 'Background, style, experience…'
              )}
            </section>

            {/* Genre & Social */}
            <section className="mb-8 grid grid-cols-2 gap-3">
              <div className="px-4 py-3 bg-surface rounded-2xl border border-warm-border">
                <p className="text-[9px] font-bold uppercase tracking-widest text-warm-faint mb-1">Genre</p>
                {ef('artistGenre', false,
                  genre ? <p className="text-sm font-semibold text-charcoal">{genre}</p> : null,
                  locale === 'de' ? 'z.B. Klassik' : 'e.g. Classical'
                )}
              </div>
              <div className="px-4 py-3 bg-surface rounded-2xl border border-warm-border">
                <p className="text-[9px] font-bold uppercase tracking-widest text-warm-faint mb-1">Website</p>
                {ef('socialLinks', false,
                  socialLinks ? <p className="text-sm font-medium text-charcoal break-all">{socialLinks}</p> : null,
                  'https://…'
                )}
              </div>
            </section>

            {/* CTA preview */}
            <div className="mt-6 p-5 bg-surface rounded-2xl border border-warm-border text-center">
              <p className="text-xs text-warm-faint mb-3">{locale === 'de' ? 'Buchungs-Button (Vorschau)' : 'Booking button (preview)'}</p>
              <div className="inline-block px-8 py-3 bg-charcoal/20 text-charcoal/40 text-sm font-semibold rounded-2xl cursor-default select-none">
                {locale === 'de' ? 'Jetzt anfragen →' : 'Request availability →'}
              </div>
            </div>

          </div>
        )}
      </div>
    );
  }

  return (
    <div className="sticky top-6">
      {/* Label */}
      <div className="flex items-center gap-2 mb-3 px-1">
        <span className="text-[10px] font-semibold text-warm-faint uppercase tracking-widest">
          {locale === 'de' ? 'Vorschau · So sieht deine Show-Seite aus' : 'Preview · Your show page'}
        </span>
        <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
      </div>

      <div className="bg-surface rounded-[1.5rem] border border-warm-border shadow-xl overflow-hidden">

        {/* Hero image — matches real page aspect-[3/2] */}
        <div className="relative w-full aspect-[3/2] bg-[#f0f0ee] overflow-hidden">
          {photoUrl
            ? <img src={photoUrl} alt={title} className="w-full h-full object-cover" />
            : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-warm-border">
                <svg width="36" height="36" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 20M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                <span className="text-xs font-medium">{locale === 'de' ? 'Foto folgt' : 'Photo coming'}</span>
              </div>
            )
          }
          {/* Gradient overlay at bottom — same as real page */}
          {(genre || photoUrl) && (
            <div className="absolute inset-0 pointer-events-none" style={{ background: `linear-gradient(to top, ${accent}cc 0%, ${accent}30 35%, transparent 65%)` }} />
          )}
          {/* Category + duration badges at bottom-left — same as real page */}
          <div className="absolute bottom-3 left-3 flex gap-2 flex-wrap">
            {genre && (
              <span className="px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-full" style={{ backgroundColor: accent, color: '#fff' }}>
                {genre}
              </span>
            )}
            {duration && (
              <span className="px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-full bg-black/50 text-white backdrop-blur-sm">
                {duration}
              </span>
            )}
          </div>
        </div>

        {/* Info panel */}
        <div className="p-5">
          {isEmpty ? (
            <div className="text-center py-10">
              <p className="text-warm-faint text-sm font-medium">
                {locale === 'de' ? 'Deine Show-Seite erscheint hier, sobald du mit dem Chat beginnst…' : 'Your show page appears here as you chat…'}
              </p>
            </div>
          ) : (
            <>
              {/* Title */}
              {title
                ? <h2 className="text-2xl font-semibold tracking-tight leading-tight text-charcoal mb-2">{title}</h2>
                : <div className="h-7 w-3/4 bg-surface-alt rounded-lg mb-2 animate-pulse" />}

              {/* Price badge — matches real page accent color style */}
              {price && (
                <div className="mb-3">
                  <span className="px-3 py-1.5 text-sm font-bold rounded-full" style={{ backgroundColor: accentBg, color: accent }}>
                    {price}
                  </span>
                </div>
              )}

              {/* Description */}
              {description
                ? <p className="text-sm text-charcoal leading-relaxed mb-4 line-clamp-4">{description}</p>
                : (
                  <div className="space-y-2 mb-4">
                    <div className="h-3 bg-surface-alt rounded animate-pulse" />
                    <div className="h-3 bg-surface-alt rounded animate-pulse w-4/5" />
                    <div className="h-3 bg-surface-alt rounded animate-pulse w-3/5" />
                  </div>
                )}

              {/* Quick-scan grid — matches real page 2-column grid */}
              {(duration || genre || artistName) && (
                <div className="grid grid-cols-2 gap-3 mb-4 p-3 rounded-xl bg-surface-alt border border-warm-border">
                  {duration && (
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-warm-muted mb-0.5">{locale === 'de' ? 'Dauer' : 'Duration'}</p>
                      <p className="text-sm font-semibold text-charcoal">{duration}</p>
                    </div>
                  )}
                  {genre && (
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-warm-muted mb-0.5">Genre</p>
                      <p className="text-sm font-semibold text-charcoal">{genre}</p>
                    </div>
                  )}
                  {artistName && (
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-warm-muted mb-0.5">{locale === 'de' ? 'Künstler' : 'Artist'}</p>
                      <p className="text-sm font-semibold text-charcoal">{artistName}</p>
                    </div>
                  )}
                </div>
              )}

              {/* About artist */}
              {bio && (
                <div className="border-t border-warm-border pt-4 mb-4">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-warm-muted mb-1">{locale === 'de' ? 'Über die Künstler' : 'About the artist'}</p>
                  <p className="text-sm text-warm-muted leading-relaxed line-clamp-3">{bio}</p>
                </div>
              )}

              {/* Social */}
              {socialLinks && (
                <div className="border-t border-warm-border pt-4 mb-4">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-warm-muted mb-1">Website / Social</p>
                  <p className="text-xs text-warm-muted font-medium break-all">{socialLinks}</p>
                </div>
              )}

              {/* CTA — matches real page black button */}
              <div className="pt-4 border-t border-warm-border">
                <div className="w-full py-3.5 bg-terracotta text-white rounded-[14px] text-sm font-semibold text-center opacity-50 cursor-default select-none">
                  {locale === 'de' ? 'Jetzt anfragen →' : 'Request availability →'}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      <p className="text-[10px] text-warm-faint text-center mt-3 font-medium">
        {locale === 'de' ? 'Wird mit jedem Schritt aktualisiert' : 'Updates with every step'}
      </p>
    </div>
  );
};

// --- Join View (EPIC 3.2: conversation engine type=ARTIST + Returning Artist) ---
const Join: React.FC<{ locale: 'de' | 'en' }> = ({ locale }) => {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<{ role: 'ai' | 'user'; text: string }[]>([]);
  const [submissionDraft, setSubmissionDraft] = useState<Record<string, unknown>>({});
  const [quickReplies, setQuickReplies] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [pendingVideoUrl, setPendingVideoUrl] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [resolvingToken, setResolvingToken] = useState(true);
  const [returnArtist, setReturnArtist] = useState<ResolveArtistResponse | null>(null);
  const [welcomeBackChoice, setWelcomeBackChoice] = useState<'use' | 'fresh' | null>(null);
  const [showMediaInput, setShowMediaInput] = useState(false);
  const [lastNextSlot, setLastNextSlot] = useState<string | null>(null);

  // Scroll page to top on mount
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }); }, []);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(() => { scrollToBottom(); }, [messages, loading]);

  useEffect(() => {
    const token = getStoredArtistToken();
    if (!token) {
      setResolvingToken(false);
      return;
    }
    let cancelled = false;
    resolveArtistToken(token).then((data) => {
      if (!cancelled && data.isReturning) setReturnArtist(data);
    }).finally(() => {
      if (!cancelled) setResolvingToken(false);
    });
    return () => { cancelled = true; };
  }, []);

  const pendingWelcomeBack = returnArtist?.isReturning && welcomeBackChoice === null;

  useEffect(() => {
    if (conversationId || loading || resolvingToken || pendingWelcomeBack) return;
    let cancelled = false;
    setLoading(true);
    setApiError(null);
    conversationStart('ARTIST', locale, { returningArtist: welcomeBackChoice === 'use' }).then(({ conversationId: id, greeting, response }) => {
      if (!cancelled) {
        setConversationId(id);
        setMessages([{ role: 'ai', text: response.assistantMessage || greeting }]);
        setQuickReplies(response.nextQuestion?.quickReplies || response.quickReplies || []);
        setShowMediaInput(!!response.nextQuestion?.showMediaInput);
        setLastNextSlot(response.nextQuestion?.slot ?? null);
        const draft = (response.statePatch?.submissionDraft && typeof response.statePatch.submissionDraft === 'object')
          ? (response.statePatch.submissionDraft as Record<string, unknown>)
          : {};
        if (welcomeBackChoice === 'use' && returnArtist?.artistAccount) {
          const acc = returnArtist.artistAccount;
          const parts = [];
          if (acc.instagramHandle) parts.push(acc.instagramHandle.startsWith('@') ? acc.instagramHandle : `@${acc.instagramHandle}`);
          if (acc.websiteUrl) parts.push(acc.websiteUrl);
          if (parts.length) draft.socialLinks = parts.join(' ');
        }
        setSubmissionDraft(draft);
        setLoading(false);
      }
    }).catch((err) => {
      if (!cancelled) {
        setApiError(err instanceof Error ? err.message : 'Failed to start');
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [locale, welcomeBackChoice, resolvingToken, pendingWelcomeBack]);

  const sendMessage = async (textOverride?: string, options?: { action?: string; value?: string }) => {
    const userText = (textOverride ?? input).trim();
    if (!userText || loading || submitting || !conversationId) return;
    if (honeypot) return;
    setInput('');
    setQuickReplies([]);
    setMessages((m) => [...m, { role: 'user', text: userText }]);
    setLoading(true);
    setApiError(null);
    try {
      const res = await conversationMessage(conversationId, userText, { submissionDraft, locale }, options);
      const newDraft = res.statePatch?.submissionDraft && typeof res.statePatch.submissionDraft === 'object'
        ? { ...submissionDraft, ...res.statePatch.submissionDraft } as Record<string, unknown>
        : submissionDraft;
      if (res.statePatch?.submissionDraft && typeof res.statePatch.submissionDraft === 'object') {
        setSubmissionDraft(newDraft);
      }
      setMessages((m) => [...m, { role: 'ai', text: res.assistantMessage }]);
      setQuickReplies(res.nextQuestion?.quickReplies || res.quickReplies || []);
      setShowMediaInput(!!res.nextQuestion?.showMediaInput);
      setLastNextSlot(res.nextQuestion?.slot ?? null);
      if (res.action === 'SAVE_SUBMISSION') {
        setSubmissionDraft(newDraft);
        handleFinish(newDraft);
      }
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Request failed');
      setMessages((m) => m.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  if (submissionId) {
    // Fire confetti
    setTimeout(() => {
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 }, colors: ['#6366f1', '#a855f7', '#ec4899', '#f59e0b'] });
    }, 100);
    return (
      <div className="min-h-[calc(100vh-64px)] mt-16 flex items-center justify-center px-4">
        <div className="bg-surface rounded-[2.5rem] border border-warm-border shadow-2xl p-12 md:p-16 max-w-lg w-full text-center">
          <div className="text-5xl mb-6">🎉</div>
          <h2 className="text-3xl font-bold mb-4 tracking-tight text-charcoal">
            {locale === 'de' ? 'Gesendet!' : 'Sent!'}
          </h2>
          <p className="text-warm-muted mb-2 font-medium text-base leading-relaxed">
            {locale === 'de'
              ? 'Valiantsina wird deine Bewerbung persönlich prüfen — innerhalb von 24 Stunden hörst du von ihr. ❤️'
              : 'Valiantsina will review your application personally within 24 hours. ❤️'}
          </p>
          <p className="text-xs text-warm-faint font-mono mt-6">ID: {submissionId}</p>
          <Link to="/catalog" className="inline-block mt-10 px-10 py-4 bg-terracotta text-white rounded-2xl font-semibold text-sm hover:bg-terracotta-dark transition">
            {locale === 'de' ? 'Shows entdecken' : 'Discover shows'}
          </Link>
        </div>
      </div>
    );
  }

  if (!resolvingToken && returnArtist?.isReturning && welcomeBackChoice === null) {
    const acc = returnArtist.artistAccount;
    const label = [acc?.instagramHandle ? `@${acc.instagramHandle}` : null, acc?.websiteUrl].filter(Boolean).join(' • ') || (locale === 'de' ? 'Du' : 'You');
    return (
      <div className="max-w-2xl mx-auto px-4 py-24">
        <div className="bg-surface rounded-[2.5rem] border border-warm-border shadow-2xl p-12 md:p-16">
          <h2 className="font-display text-2xl font-normal mb-4 tracking-tight text-center text-charcoal">
            {locale === 'de' ? 'Willkommen zurück!' : 'Welcome back!'}
          </h2>
          <p className="text-warm-muted mb-8 text-center font-medium">
            {locale === 'de'
              ? 'Soll ich deine gespeicherten Artist-Daten verwenden?'
              : 'Should I use your saved artist details?'}
          </p>
          {label && <p className="text-sm text-warm-faint text-center mb-8">({label})</p>}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button type="button" onClick={() => setWelcomeBackChoice('use')} className="px-8 py-4 bg-terracotta text-white rounded-2xl font-semibold text-sm hover:bg-terracotta-dark transition">
              {locale === 'de' ? 'Ja, verwenden' : 'Yes, use them'}
            </button>
            <button type="button" onClick={() => { clearStoredArtistToken(); setWelcomeBackChoice('fresh'); }} className="px-8 py-4 bg-surface border-2 border-warm-border text-warm-muted rounded-2xl font-semibold text-sm hover:border-terracotta hover:text-terracotta transition">
              {locale === 'de' ? 'Nein, neu starten' : 'No, start fresh'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const filledCount = PROGRESS_KEYS.filter(p => submissionDraft[p.key] && String(submissionDraft[p.key]).trim()).length;

  const canFinish = !!(submissionDraft.showTitle && String(submissionDraft.showTitle).trim() && submissionDraft.artistName && String(submissionDraft.artistName).trim());

  const handleFinish = async (draftOverride?: Record<string, unknown>) => {
    const d = draftOverride ?? submissionDraft;
    const submitterEmail = String(d.submitterEmail || '').trim();
    const showTitle = String(d.showTitle || '').trim();
    if (!submitterEmail || !submitterEmail.includes('@')) {
      setSubmitError(locale === 'de' ? 'Bitte gib noch deine E-Mail-Adresse im Chat ein.' : 'Please provide your email address in the chat first.');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const photoBase64Array: string[] = [];
      for (const f of photoFiles) {
        photoBase64Array.push(await fileToBase64(f));
      }
      const result = await submitArtistOnboarding({
        artistName: d.artistName as string | undefined,
        artistGenre: d.artistGenre as string | undefined,
        showTitle,
        photoBase64Array: photoBase64Array.length ? photoBase64Array : undefined,
        videoUrls: pendingVideoUrl ? [pendingVideoUrl] : undefined,
        durationMinutes: typeof d.durationMinutes === 'number' ? d.durationMinutes : undefined,
        priceText: d.priceText as string | undefined,
        shortDescriptionFacts: d.shortDescriptionFacts as string | undefined,
        artistBio: d.artistBio as string | undefined,
        socialLinks: d.socialLinks as string | undefined,
        submitterEmail,
        honeypot: honeypot || undefined,
        artistToken: getStoredArtistToken() ?? undefined,
      });
      setSubmissionId(result.submissionId);
      if (result.artistToken) setStoredArtistToken(result.artistToken);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex bg-parchment min-h-[calc(100vh-64px)] mt-16">

      {/* ── LEFT: Chat Panel (30%) ── */}
      <div className="w-[32%] min-w-[300px] flex-shrink-0 flex flex-col bg-surface border-r border-warm-border h-[calc(100vh-64px)] sticky top-16">

        {/* Progress bar */}
        {filledCount > 0 && (
          <div className="px-5 pt-3 pb-0 flex-shrink-0">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-semibold text-warm-muted uppercase tracking-widest">
                Step {Math.min(filledCount, PROGRESS_KEYS.length)}/{PROGRESS_KEYS.length}
              </span>
              <span className="text-[10px] font-semibold text-terracotta">
                {Math.round((filledCount / PROGRESS_KEYS.length) * 100)}% complete
              </span>
            </div>
            <div className="h-1 rounded-full bg-surface-alt overflow-hidden">
              <div
                className="h-full rounded-full bg-terracotta transition-all duration-700"
                style={{ width: `${Math.round((filledCount / PROGRESS_KEYS.length) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Chat header — Tina avatar + headline */}
        <div className="px-5 pt-4 pb-3 border-b border-warm-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-terracotta to-purple-500 flex items-center justify-center flex-shrink-0 text-white font-bold text-sm shadow-soft">
              V
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-charcoal leading-tight">Valiantsina's AI Helper</p>
              <p className="text-[10px] text-green-500 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                Online
              </p>
            </div>
          </div>
          <p className="text-[11px] text-warm-muted font-medium mt-2 leading-relaxed">
            Let's build your perfect Berlintina profile together ✨
          </p>
        </div>

        {/* Messages */}
        <div className="flex-grow overflow-y-auto px-4 py-4 space-y-3 flex flex-col">
          {resolvingToken && messages.length === 0 && (
            <div className="flex-grow flex items-center justify-center">
              <div className="flex items-center gap-1.5">
                {[0, 160, 320].map(d => <span key={d} className="typing-dot w-2 h-2 rounded-full bg-warm-border inline-block" style={{ animationDelay: `${d}ms` }} />)}
              </div>
            </div>
          )}
          {apiError && <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium">{apiError}</div>}
          {submitError && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-medium">{submitError}</div>}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'ai' ? 'items-end gap-2' : 'justify-end'} animate-in fade-in slide-in-from-bottom-2 duration-200`}>
              {m.role === 'ai' && (
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-terracotta to-purple-500 flex items-center justify-center flex-shrink-0 text-white font-bold text-[9px] mb-0.5">V</div>
              )}
              <div className={`max-w-[78%] px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap ${
                m.role === 'ai'
                  ? 'bg-terracotta-light text-charcoal rounded-2xl rounded-bl-none border border-terracotta/15'
                  : 'bg-[#0084ff] text-white rounded-2xl rounded-br-none shadow-sm'
              }`}>
                {m.text}
              </div>
            </div>
          ))}
          {loading && messages.length > 0 && <TypingIndicator />}
          {!loading && quickReplies.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pl-8">
              {quickReplies.map((q, i) => (
                <button key={i} type="button" onClick={() => {
                  if (lastNextSlot === 'has_show') {
                    const value = (q === 'Ja, habe eine Show' || q === 'Yes, I have a show') ? 'HAS_SHOW' : (q === 'Nein, brainstormen' || q === 'No, brainstorm') ? 'NO_SHOW' : undefined;
                    sendMessage(q, value ? { action: 'BUTTON', value } : undefined);
                  } else { sendMessage(q); }
                }} disabled={loading} className="px-3 py-1.5 rounded-xl bg-surface border-2 border-warm-border text-xs font-semibold text-warm-muted hover:border-terracotta hover:text-terracotta transition disabled:opacity-50">
                  {q}
                </button>
              ))}
            </div>
          )}
          {showMediaInput && (
            <div className="pl-8 space-y-2">
              <label className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface border border-warm-border cursor-pointer text-xs font-semibold text-warm-muted hover:bg-surface-alt">
                <span>📸</span>
                <span>{photoFiles.length > 0 ? `✓ ${photoFiles.length} ${locale === 'de' ? 'Foto(s)' : 'photo(s)'}` : (locale === 'de' ? 'Fotos hochladen' : 'Upload photos')}</span>
                <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => {
                  const files = Array.from(e.target.files || []).filter(f => f.type.startsWith('image/'));
                  if (files.length) { setPhotoFiles(prev => [...prev, ...files]); sendMessage(locale === 'de' ? `📸 ${files.length} Foto(s) hinzugefügt` : `📸 ${files.length} photo(s) added`); }
                }} />
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder={locale === 'de' ? 'YouTube-Link (optional)' : 'YouTube link (optional)'}
                  value={pendingVideoUrl}
                  onChange={e => setPendingVideoUrl(e.target.value)}
                  className="flex-1 px-3 py-1.5 rounded-xl bg-surface border border-warm-border text-xs font-medium text-charcoal focus:outline-none focus:ring-2 focus:ring-terracotta/20 placeholder:text-warm-faint"
                />
                {pendingVideoUrl && (
                  <button type="button" onClick={() => sendMessage(locale === 'de' ? '▶ Video hinzugefügt' : '▶ Video added')}
                    className="px-3 py-1.5 rounded-xl bg-terracotta text-white text-xs font-semibold">
                    OK
                  </button>
                )}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Finish button */}
        {canFinish && (
          <div className="px-3 pt-2 flex-shrink-0">
            <button
              type="button"
              onClick={handleFinish}
              disabled={submitting}
              className="w-full py-3 bg-terracotta text-white rounded-xl font-semibold text-sm hover:bg-terracotta-dark transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {submitting
                ? <span className="flex gap-1">{[0, 100, 200].map(d => <span key={d} className="typing-dot w-1.5 h-1.5 rounded-full bg-white/70 inline-block" style={{ animationDelay: `${d}ms` }} />)}</span>
                : <>{locale === 'de' ? 'Show einreichen' : 'Submit show'} <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg></>
              }
            </button>
          </div>
        )}

        {/* Input */}
        <div className="border-t border-warm-border bg-surface flex-shrink-0">
          {/https?:\/\//.test(input) && (
            <div className="px-4 pt-2.5 pb-0 flex items-center gap-1.5 text-[10px] text-warm-muted font-medium">
              <span>🔍</span>
              <span>{locale === 'de' ? 'Website wird analysiert' : 'Website will be analyzed'}</span>
            </div>
          )}
          <div className="p-3 flex gap-2">
            <input type="text" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} className="hidden" aria-hidden="true" tabIndex={-1} />
            <input
              type="text"
              placeholder={locale === 'de' ? 'Antworten oder URL einfügen…' : 'Reply or paste URL…'}
              className="flex-grow px-4 py-2.5 rounded-xl bg-surface-alt text-sm font-medium focus:outline-none focus:ring-2 focus:ring-terracotta/20 transition text-charcoal disabled:opacity-50 placeholder:text-warm-faint"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              disabled={loading || submitting || !conversationId}
            />
            <button onClick={() => sendMessage()} disabled={(!input.trim()) || loading || submitting || !conversationId}
              className="w-10 h-10 bg-terracotta text-white rounded-xl hover:bg-terracotta-dark transition flex items-center justify-center shadow-md disabled:opacity-20 flex-shrink-0 self-end">
              {loading
                ? <span className="flex gap-0.5">{[0, 100, 200].map(d => <span key={d} className="typing-dot w-1 h-1 rounded-full bg-white/70 inline-block" style={{ animationDelay: `${d}ms` }} />)}</span>
                : <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M22 2L11 13" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              }
            </button>
          </div>
          <p className="text-center text-[9px] text-warm-faint pb-2">Powered by OpenAI</p>
        </div>
      </div>

      {/* ── RIGHT: Live Preview (65%) ── */}
      <div className="flex-1 overflow-hidden h-[calc(100vh-64px)] sticky top-16">
        <ShowPreview
          draft={submissionDraft}
          photoFile={photoFiles[0] ?? null}
          locale={locale}
          fullWidth
          onFieldEdit={(key, val) => setSubmissionDraft(d => ({ ...d, [key]: val }))}
          onPhotoChange={(f) => setPhotoFiles([f])}
        />
      </div>

    </div>
  );
};

const PAGE_SIZE = 12;

// --- Catalog View ---
const Catalog: React.FC<{ locale: 'de' | 'en' }> = ({ locale }) => {
  const [filter, setFilter] = useState<Category | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [shows, setShows] = useState<Show[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Reset shows when filter/search changes
  useEffect(() => {
    setShows([]);
    setPage(0);
  }, [filter, search]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const filters = {
      category: filter === 'ALL' ? undefined : filter,
      search: search.trim() || undefined,
    };
    fetchShowsPage(page * PAGE_SIZE, PAGE_SIZE, filters).then(({ shows: data, totalCount: total, error: err }) => {
      if (!cancelled) {
        setShows(prev => page === 0 ? data : [...prev, ...data]);
        setTotalCount(total);
        setError(err ?? null);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [filter, search, page]);

  const hasMore = (page + 1) * PAGE_SIZE < totalCount;

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          setPage(p => p + 1);
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loading]);

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 md:px-8 py-12 sm:py-20">
      <PageSEO
        title={locale === 'de' ? 'Alle Showacts & Künstler | Berlintina Berlin' : 'All Show Acts & Artists | Berlintina Berlin'}
        description={locale === 'de'
          ? 'Entdecke alle persönlich kuratierten Showacts aus Berlin: Akrobatik, Live-Musik, Tanz, Feuershow, Klassik & mehr. Jetzt anfragen.'
          : 'Discover all personally curated show acts from Berlin: acrobatics, live music, dance, fire shows, classical & more. Enquire now.'}
        structuredData={{
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: 'Berlintina Show Acts Berlin',
          url: 'https://berlintina.de/catalog',
          description: 'Persönlich kuratierte Showacts und Künstler aus Berlin',
        }}
      />
      {error && (
        <div className="mb-8 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm font-medium">
          {error}
        </div>
      )}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 sm:gap-12 mb-12 sm:mb-20">
        <div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold mb-2 tracking-tight">
            {locale === 'de' ? 'Berliner Showacts — persönlich kuratiert' : 'Berlin Show Acts — personally curated'}
          </h1>
          <p className="text-warm-muted text-base mb-6 sm:mb-8">
            {locale === 'de' ? 'Jeder Act wurde von Valiantsina persönlich ausgewählt.' : 'Every act was personally selected by Valiantsina.'}
          </p>
          <div className="flex flex-wrap gap-3">
            {(['ALL', ...Object.values(Category)] as const).map(cat => (
              <button key={cat} onClick={() => setFilter(cat)} className={`px-6 py-2.5 rounded-xl text-[11px] font-black tracking-widest uppercase transition-all shadow-sm ${filter === cat ? 'bg-terracotta text-white' : 'bg-surface-alt text-warm-muted hover:text-charcoal'}`}>{cat}</button>
            ))}
          </div>
        </div>
        <input
          type="text"
          placeholder={locale === 'de' ? 'Künstler oder Show suchen…' : 'Search artist or show…'}
          className="w-full md:w-96 px-6 py-4 rounded-xl bg-surface border border-warm-border focus:border-terracotta focus:outline-none transition text-sm font-semibold shadow-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Grid area — only this part changes on filter/search */}
      {loading && shows.length === 0 ? (
        /* ── Search / loading animation ── */
        <div className="py-24 flex flex-col items-center gap-6">
          <div className="relative w-16 h-16">
            {/* Spinning ring */}
            <svg className="absolute inset-0 w-full h-full animate-spin" style={{ animationDuration: '1.4s' }} viewBox="0 0 64 64" fill="none">
              <circle cx="32" cy="32" r="28" stroke="#e8eaef" strokeWidth="4" />
              <path d="M32 4 A28 28 0 0 1 60 32" stroke="#6366f1" strokeWidth="4" strokeLinecap="round" />
            </svg>
            {/* Search icon in center */}
            <div className="absolute inset-0 flex items-center justify-center">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
            </div>
          </div>
          <p className="text-sm font-medium text-warm-muted tracking-wide">
            {locale === 'de' ? 'Suche läuft…' : 'Searching…'}
          </p>
          {/* Skeleton cards */}
          <div className="w-full masonry-col-lg mt-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="masonry-col-item rounded-2xl overflow-hidden bg-surface border border-warm-border">
                <div className="aspect-[3/4] bg-surface-alt animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
                <div className="p-4 space-y-2">
                  <div className="h-3 bg-surface-alt rounded-full animate-pulse w-3/4" style={{ animationDelay: `${i * 80 + 60}ms` }} />
                  <div className="h-2.5 bg-surface-alt rounded-full animate-pulse w-1/2" style={{ animationDelay: `${i * 80 + 120}ms` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : !loading && !error && shows.length === 0 ? (
        <div className="py-24 text-center">
          <p className="text-warm-muted font-medium text-lg mb-4">{locale === 'de' ? 'Keine Shows gefunden.' : 'No shows found.'}</p>
          <p className="text-warm-faint text-sm">{locale === 'de' ? 'Versuche andere Filter oder suche nach etwas anderem.' : 'Try different filters or search for something else.'}</p>
        </div>
      ) : (
        <>
          <div className="masonry-grid">
            {shows.map(show => (
              <div key={show.id} className="masonry-item">
                <ShowCard show={show} locale={locale} onViewDetails={(s) => navigate(`/show/${s.slug}`)} />
              </div>
            ))}
          </div>
          {/* Infinite scroll sentinel */}
          <div ref={sentinelRef} className="h-16" />
          {loading && (
            <div className="py-8 text-center text-warm-faint text-sm font-medium">
              {locale === 'de' ? 'Lade…' : 'Loading…'}
            </div>
          )}
        </>
      )}

      {/* ── Weitere Acts auf Anfrage — Slider style ── */}
      <section className="mt-20 relative w-full overflow-hidden" style={{ background: '#0d0d1a' }}>
        <div className="max-w-7xl mx-auto px-6 sm:px-10 py-14 sm:py-20">
          <p className="text-white/30 text-xs font-semibold tracking-[0.2em] uppercase mb-6">
            berlintina<span className="text-terracotta">.</span>
          </p>
          <h2 className="text-4xl sm:text-5xl md:text-[3.5rem] font-semibold tracking-[-0.04em] leading-[1.05] mb-3 gradient-text-static">
            {locale === 'de' ? 'Weitere Acts auf Anfrage.' : 'More Acts on Request.'}
          </h2>
          <p className="text-white/40 text-base mb-8 max-w-xl">
            {locale === 'de'
              ? 'Valiantsina hat Zugang zu 50+ weiteren Berliner Künstlern — einfach beschreiben, was ihr sucht.'
              : "Valiantsina has access to 50+ more Berlin artists — just describe what you're looking for."}
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href={`mailto:info@berlintina.de?subject=${encodeURIComponent(locale === 'de' ? 'Buchungsanfrage' : 'Booking Inquiry')}`}
              className="inline-flex items-center gap-2 px-6 py-3 bg-white text-charcoal text-sm font-bold rounded-2xl hover:opacity-90 transition shadow-lg"
            >
              <span>berlintina<span className="text-terracotta">.</span></span>
              {locale === 'de' ? 'anfragen →' : 'enquire →'}
            </a>
            <Link
              to="/join/start"
              className="inline-flex items-center gap-2 px-6 py-3 border border-white/20 text-white text-sm font-semibold rounded-2xl hover:bg-white/10 transition"
            >
              {locale === 'de' ? 'Künstler werden ↗' : 'Join as artist ↗'}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

// --- Blog List View ---
const Blog: React.FC<{ locale: 'de' | 'en' }> = ({ locale }) => {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchBlogPosts().then((data) => { setPosts(data); setLoading(false); });
  }, []);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center text-warm-faint font-medium">
        {locale === 'de' ? 'Lade Blog…' : 'Loading blog…'}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
      <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight mb-4">Blog</h1>
      <p className="text-warm-muted font-medium mb-16">
        {locale === 'de' ? 'Gedanken, Geschichten & Einblicke von Valiantsina.' : 'Thoughts, stories & insights from Valiantsina.'}
      </p>
      {posts.length === 0 ? (
        <p className="text-warm-faint text-center py-16">
          {locale === 'de' ? 'Noch keine Artikel veröffentlicht.' : 'No articles published yet.'}
        </p>
      ) : (
        <div className="grid gap-8 sm:grid-cols-2">
          {posts.map((post) => {
            const title = locale === 'de' ? post.titleDe : post.titleEn;
            const excerpt = locale === 'de' ? post.excerptDe : post.excerptEn;
            const date = post.publishedAt ? new Date(post.publishedAt).toLocaleDateString(locale === 'de' ? 'de-DE' : 'en-GB', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
            return (
              <article
                key={post.id}
                onClick={() => navigate(`/blog/${post.slug}`)}
                className="group cursor-pointer bg-surface rounded-2xl border border-warm-border overflow-hidden shadow-sm hover:shadow-lg transition-shadow"
              >
                {post.coverImageUrl && (
                  <img src={post.coverImageUrl} alt={title} className="w-full aspect-[16/9] object-cover group-hover:scale-[1.02] transition-transform duration-300" />
                )}
                <div className="p-6">
                  {date && <p className="text-xs text-warm-faint font-medium mb-2">{date}</p>}
                  <h2 className="text-lg font-semibold tracking-tight text-charcoal mb-2 group-hover:text-terracotta transition-colors line-clamp-2">{title}</h2>
                  {excerpt && <p className="text-sm text-warm-muted leading-relaxed line-clamp-3">{excerpt}</p>}
                  <p className="mt-4 text-xs font-semibold text-terracotta group-hover:underline">
                    {locale === 'de' ? 'Weiterlesen →' : 'Read more →'}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};

// --- Single Blog Post View ---
const BlogPostPage: React.FC<{ locale: 'de' | 'en' }> = ({ locale }) => {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    fetchBlogPost(slug).then((data) => {
      if (data) setPost(data);
      else setNotFound(true);
      setLoading(false);
    });
  }, [slug]);

  if (loading) {
    return <div className="max-w-3xl mx-auto px-4 py-20 text-center text-warm-faint font-medium">{locale === 'de' ? 'Lade…' : 'Loading…'}</div>;
  }
  if (notFound || !post) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <p className="text-warm-faint font-medium mb-6">{locale === 'de' ? 'Artikel nicht gefunden.' : 'Article not found.'}</p>
        <Link to="/blog" className="text-sm font-semibold text-terracotta underline underline-offset-4">← {locale === 'de' ? 'Zurück zum Blog' : 'Back to Blog'}</Link>
      </div>
    );
  }

  const title = locale === 'de' ? post.titleDe : post.titleEn;
  const content = locale === 'de' ? post.contentDe : post.contentEn;
  const date = post.publishedAt ? new Date(post.publishedAt).toLocaleDateString(locale === 'de' ? 'de-DE' : 'en-GB', { year: 'numeric', month: 'long', day: 'numeric' }) : '';

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
      <Link to="/blog" className="text-xs font-semibold text-warm-faint hover:text-terracotta uppercase tracking-widest transition mb-10 inline-block">← Blog</Link>
      {post.coverImageUrl && (
        <img src={post.coverImageUrl} alt={title} className="w-full aspect-[16/9] object-cover rounded-2xl mb-10 shadow-sm" />
      )}
      {date && <p className="text-xs text-warm-faint font-medium mb-4">{date}</p>}
      <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-charcoal mb-10">{title}</h1>
      <div className="prose prose-gray max-w-none">
        <p className="text-warm-muted leading-relaxed text-base sm:text-lg whitespace-pre-line">{content}</p>
      </div>
      <div className="mt-16 pt-8 border-t border-warm-border">
        <Link to="/blog" className="text-sm font-semibold text-terracotta underline underline-offset-4 hover:opacity-70 transition">← {locale === 'de' ? 'Alle Artikel' : 'All Articles'}</Link>
      </div>
    </div>
  );
};

// --- Artist Portal View ---
const ArtistPortal: React.FC<{ locale: 'de' | 'en' }> = ({ locale }) => {
  const [data, setData] = useState<ArtistPortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const token = getStoredArtistToken();
    if (!token) { navigate('/join', { replace: true }); return; }
    fetchArtistShows(token).then((result) => {
      if (result) setData(result);
      else navigate('/join', { replace: true });
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div className="max-w-6xl mx-auto px-4 py-20 text-center text-warm-faint font-medium">{locale === 'de' ? 'Lade…' : 'Loading…'}</div>;
  }
  if (!data) return null;

  const artistLabel = data.artist.display_name || data.artist.instagram_handle || (locale === 'de' ? 'Dein Account' : 'Your Account');

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 md:px-8 py-12 sm:py-20">
      <div className="mb-12">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-warm-faint mb-3">{locale === 'de' ? 'Künstler-Portal' : 'Artist Portal'}</p>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight mb-4">{artistLabel}</h1>
        <p className="text-warm-faint font-medium">
          {locale === 'de'
            ? `${data.shows.length} Show${data.shows.length !== 1 ? 's' : ''} auf Berlintina`
            : `${data.shows.length} show${data.shows.length !== 1 ? 's' : ''} on Berlintina`}
        </p>
      </div>
      {data.shows.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-warm-faint font-medium mb-6">{locale === 'de' ? 'Noch keine veröffentlichten Shows.' : 'No published shows yet.'}</p>
        </div>
      ) : (
        <div className="masonry-grid mb-12">
          {data.shows.map((show) => {
            // Map ArtistShowSummary to Show shape for ShowCard
            const showForCard = {
              id: show.id,
              slug: show.slug,
              shortId: show.short_id,
              title: show.title,
              artistName: '',
              category: show.category as unknown as import('./types').Category,
              photoUrls: show.photo_urls ?? [],
              vibeTags: show.vibe_tags ?? [],
              durationMinutes: show.duration_minutes,
              priceType: show.price_type as 'FIXED' | 'RANGE' | 'ON_REQUEST',
              priceMin: show.price_min,
              priceMax: show.price_max,
            } as Show;
            return (
              <div key={show.id} className="masonry-item">
                <ShowCard show={showForCard} locale={locale} onViewDetails={(s) => navigate(`/show/${s.slug}`)} />
              </div>
            );
          })}
        </div>
      )}
      <div className="text-center">
        <button
          onClick={() => navigate('/join/start')}
          className="px-10 py-4 bg-terracotta text-white rounded-2xl font-semibold text-sm hover:bg-terracotta-dark transition shadow-lg"
        >
          {locale === 'de' ? 'Weitere Show eintragen →' : 'Add another show →'}
        </button>
      </div>
    </div>
  );
};

// --- Admin Layout ---
const AdminLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen bg-parchment">
    <header className="bg-surface border-b border-warm-border py-4 px-8 flex items-center justify-between">
      <Link to="/" className="text-lg font-bold">Berlintina Admin</Link>
      <nav className="flex gap-4">
        <Link to="/admin/submissions" className="text-sm font-semibold text-warm-muted hover:text-charcoal">Submissions</Link>
        <Link to="/admin/shows" className="text-sm font-semibold text-warm-muted hover:text-charcoal">Shows</Link>
        <Link to="/admin/blog" className="text-sm font-semibold text-warm-muted hover:text-charcoal">Blog</Link>
      </nav>
    </header>
    <main>{children}</main>
  </div>
);

// --- Main App ---
const App: React.FC = () => {
  const [locale, setLocale] = useState<'de' | 'en'>(navigator.language.startsWith('de') ? 'de' : 'en');
  const [adminLoggedIn, setAdminLoggedIn] = useState(adminIsLoggedIn());
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/admin/*" element={
          <AdminLayout>
            <Suspense fallback={<div className="min-h-[40vh] flex items-center justify-center text-warm-muted">Loading…</div>}>
              <Routes>
                <Route path="" element={adminLoggedIn ? <AdminDashboard /> : <AdminLogin onSuccess={() => setAdminLoggedIn(true)} />} />
                <Route path="submissions" element={adminLoggedIn ? <AdminDashboard /> : <Navigate to="/admin" replace />} />
                <Route path="submissions/:id" element={adminLoggedIn ? <AdminSubmissionDetail /> : <Navigate to="/admin" replace />} />
                <Route path="shows" element={adminLoggedIn ? <AdminDashboard /> : <Navigate to="/admin" replace />} />
                <Route path="shows/:id" element={adminLoggedIn ? <AdminShowEdit /> : <Navigate to="/admin" replace />} />
                <Route path="blog" element={adminLoggedIn ? <AdminBlogList /> : <Navigate to="/admin" replace />} />
                <Route path="blog/new" element={adminLoggedIn ? <AdminBlogEditor /> : <Navigate to="/admin" replace />} />
                <Route path="blog/:id" element={adminLoggedIn ? <AdminBlogEditor /> : <Navigate to="/admin" replace />} />
              </Routes>
            </Suspense>
          </AdminLayout>
        } />
        <Route element={<Layout locale={locale} setLocale={setLocale}><Outlet /></Layout>}>
          <Route index element={<Landing locale={locale} />} />
          <Route path="results/:briefId" element={<Results locale={locale} />} />
          <Route path="show/:slugShortId" element={<Suspense fallback={<div className="max-w-6xl mx-auto px-4 py-32 text-center text-warm-muted font-medium">Lade Show…</div>}><ShowDetail locale={locale} /></Suspense>} />
          <Route path="catalog" element={<Catalog locale={locale} />} />
          <Route path="blog" element={<Blog locale={locale} />} />
          <Route path="blog/:slug" element={<BlogPostPage locale={locale} />} />
          <Route path="artist" element={<ArtistPortal locale={locale} />} />
          <Route path="join" element={<Join locale={locale} />} />
          <Route path="join/start" element={<Join locale={locale} />} />
          <Route path="about" element={<About locale={locale} />} />
          <Route path="impressum" element={<Impressum locale={locale} />} />
          <Route path="datenschutz" element={<Datenschutz locale={locale} />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;
