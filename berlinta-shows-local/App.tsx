import React, { useState, useEffect, useMemo, useRef, lazy, Suspense } from 'react';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence, useScroll, useTransform, useMotionValue, useSpring } from 'framer-motion';
import { Search, Sparkles, ArrowRight, X, ArrowUpRight } from 'lucide-react';
import { BrowserRouter, Routes, Route, Outlet, useNavigate, useParams, Link, useLocation, Navigate } from 'react-router-dom';
import { Category, Show, CustomerBrief, ArtistStatus } from './types';
import { VIBE_OPTIONS } from './constants';
import { aiService } from './services/aiService';
import * as apiClient from './services/apiClient';
import { scoreShows } from './lib/matching';
import { conversationStart, conversationMessage } from './services/conversationService';
import { LanguageToggle } from './components/LanguageToggle';
import { CookieConsent } from './components/CookieConsent';
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
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try { return (localStorage.getItem('theme') as 'light' | 'dark') || 'light'; } catch { return 'light'; }
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try { localStorage.setItem('theme', theme); } catch {}
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'light' ? 'dark' : 'light');

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

    /**
     * Eigene Beschreibung für die Seiten, die keine über <PageSEO> setzen.
     *
     * Ohne das tragen /join und /blog denselben Satz wie die Startseite — Google entscheidet
     * dann selbst, welchen Ausschnitt es als Snippet zeigt. Alle übrigen Seiten haben eine
     * eigene über PageSEO; hier stehen nur die Lücken.
     */
    const descriptions: Record<string, string> = {
      '/join': locale === 'de'
        ? 'Als Künstlerin oder Künstler bei Berlintina anfragen: Show eintragen, Fotos und Videos hochladen, persönliche Rückmeldung aus Berlin.'
        : 'Join Berlintina as an artist: submit your show with photos and videos and get a personal reply from Berlin.',
      '/blog': locale === 'de'
        ? 'Notizen und Neuigkeiten von Berlintina — Showacts, Künstlerinnen und Künstler und Veranstaltungen in Berlin.'
        : 'Notes and news from Berlintina — show acts, artists and events in Berlin.',
    };
    const beschreibung = descriptions[path];
    if (beschreibung) {
      document.querySelector('meta[name="description"]')?.setAttribute('content', beschreibung);
    }
  }, [location.pathname, locale]);

  useEffect(() => { setMobileMenuOpen(false); }, [location.pathname]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* ── Navbar ── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-foreground/10">
        <div className="container flex items-center justify-between h-16 md:h-20">
          <Link to="/" className="font-display text-xl font-bold text-foreground no-underline">
            berlintina<span className="text-accent">.</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8">
            <Link to="/catalog" className={`font-mono-ui text-xs uppercase tracking-widest transition-all no-underline relative after:absolute after:bottom-[-2px] after:left-0 after:h-[1.5px] after:bg-current after:transition-all after:duration-300 ${location.pathname === '/catalog' ? 'text-accent after:w-full' : 'text-muted-foreground hover:text-foreground after:w-0 hover:after:w-full'}`}>
              Shows
            </Link>
            <Link to="/about" className={`font-mono-ui text-xs uppercase tracking-widest transition-all no-underline relative after:absolute after:bottom-[-2px] after:left-0 after:h-[1.5px] after:bg-current after:transition-all after:duration-300 ${location.pathname === '/about' ? 'text-accent after:w-full' : 'text-muted-foreground hover:text-foreground after:w-0 hover:after:w-full'}`}>
              {locale === 'de' ? 'Über uns' : 'About'}
            </Link>
            <div className="flex items-center gap-1.5 ml-1">
              <button
                onClick={() => setLocale(locale === 'de' ? 'en' : 'de')}
                className="font-mono-ui text-[10px] uppercase tracking-wider w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-all"
              >
                {locale === 'de' ? 'EN' : 'DE'}
              </button>
              <button
                onClick={toggleTheme}
                className="w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-all"
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
                )}
              </button>
            </div>
            <div className="flex items-center gap-3">
              <a
                href={`https://wa.me/491608106880?text=${encodeURIComponent(locale === 'de' ? 'Hallo, ich möchte eine Show buchen.' : 'Hi, I would like to book a show.')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-accent text-accent-foreground font-display font-bold text-sm px-6 py-2.5 rounded-full hover:scale-105 transition-transform duration-300 no-underline"
              >
                {locale === 'de' ? 'Jetzt anfragen' : 'Enquire now'}
              </a>
            </div>
          </div>

          {/* Mobile */}
          <div className="flex md:hidden items-center gap-2">
            <button
              onClick={() => setLocale(locale === 'de' ? 'en' : 'de')}
              className="font-mono-ui text-[10px] uppercase tracking-wider w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground"
            >
              {locale === 'de' ? 'EN' : 'DE'}
            </button>
            <button onClick={toggleTheme} className="w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground" aria-label="Toggle theme">
              {theme === 'dark' ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
              )}
            </button>
            <button onClick={() => setMobileMenuOpen(o => !o)} className="text-foreground p-2" aria-label="Menu">
              <div className="w-6 flex flex-col gap-1.5">
                <span className={`block h-[1.5px] bg-foreground transition-all duration-300 ${mobileMenuOpen ? 'rotate-45 translate-y-[7.5px]' : ''}`} />
                <span className={`block h-[1.5px] bg-foreground transition-all duration-300 ${mobileMenuOpen ? 'opacity-0' : ''}`} />
                <span className={`block h-[1.5px] bg-foreground transition-all duration-300 ${mobileMenuOpen ? '-rotate-45 -translate-y-[7.5px]' : ''}`} />
              </div>
            </button>
          </div>

          {/* Mobile menu */}
          <AnimatePresence>
            {mobileMenuOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="absolute top-full left-0 right-0 md:hidden overflow-hidden border-t border-foreground/10 bg-background"
              >
                <div className="container py-8 flex flex-col gap-6">
                  <Link to="/catalog" onClick={() => setMobileMenuOpen(false)} className="font-mono-ui text-sm uppercase tracking-widest text-muted-foreground no-underline">Shows</Link>
                  <Link to="/about" onClick={() => setMobileMenuOpen(false)} className="font-mono-ui text-sm uppercase tracking-widest text-muted-foreground no-underline">{locale === 'de' ? 'Über uns' : 'About'}</Link>
                  <a
                    href={`https://wa.me/491608106880?text=${encodeURIComponent(locale === 'de' ? 'Hallo, ich möchte eine Show buchen.' : 'Hi, I would like to book a show.')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setMobileMenuOpen(false)}
                    className="bg-accent text-accent-foreground font-display font-bold text-sm px-6 py-3 rounded-full text-center no-underline"
                  >
                    {locale === 'de' ? 'Jetzt anfragen' : 'Enquire now'}
                  </a>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      <main className="flex-grow">
        {children}
      </main>

      {/* ── Footer ── */}
      <footer className="py-12 border-t border-foreground/10 bg-background">
        <div className="container grid grid-cols-12 gap-8">
          <div className="col-span-12 md:col-span-4">
            <Link to="/" className="font-display text-xl font-bold text-foreground no-underline">
              berlintina<span className="text-accent">.</span>
            </Link>
            <p className="body-text text-sm mt-4">
              Boutique artist agency.<br />Berlin, Germany.
            </p>
          </div>
          <div className="col-span-6 md:col-span-2">
            <span className="label-style mb-4 block">Navigate</span>
            <div className="flex flex-col gap-3">
              <Link to="/catalog" className="text-sm text-muted-foreground hover:text-foreground transition-colors no-underline">Shows</Link>
              <Link to="/about" className="text-sm text-muted-foreground hover:text-foreground transition-colors no-underline">{locale === 'de' ? 'Über uns' : 'About'}</Link>
              <Link to="/join" className="text-sm text-muted-foreground hover:text-foreground transition-colors no-underline">{locale === 'de' ? 'Für Künstler' : 'For Artists'}</Link>
            </div>
          </div>
          <div className="col-span-6 md:col-span-3">
            <span className="label-style mb-4 block">Contact</span>
            <div className="flex flex-col gap-3">
              <a href="mailto:info@berlintina.de" className="text-sm text-muted-foreground hover:text-foreground transition-colors no-underline">info@berlintina.de</a>
              <a href="tel:+491608106880" className="text-sm text-muted-foreground hover:text-foreground transition-colors no-underline">+49 160 8106880</a>
              <a href="https://wa.me/491608106880" className="text-sm text-muted-foreground hover:text-foreground transition-colors no-underline">WhatsApp</a>
              <a href="https://www.instagram.com/berlin.tina" target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:text-foreground transition-colors no-underline">Instagram</a>
            </div>
          </div>
          <div className="col-span-12 md:col-span-3">
            <span className="label-style mb-4 block">Legal</span>
            <div className="flex flex-col gap-3">
              <Link to="/datenschutz" className="text-sm text-muted-foreground hover:text-foreground transition-colors no-underline">Datenschutz</Link>
              <Link to="/impressum" className="text-sm text-muted-foreground hover:text-foreground transition-colors no-underline">Impressum</Link>
              <Link to="/join/start" className="text-sm text-muted-foreground hover:text-foreground transition-colors no-underline">Künstler werden ↗</Link>
            </div>
          </div>
        </div>
        <div className="container mt-12 pt-8 border-t border-foreground/10">
          <p className="label-style">© {new Date().getFullYear()} Berlintina. Alle Rechte vorbehalten.</p>
        </div>
      </footer>

      {/* ── Floating WhatsApp ── */}
      <a
        href={`https://wa.me/491608106880?text=${encodeURIComponent(locale === 'de' ? 'Hallo, ich interessiere mich für eine Show-Buchung.' : 'Hi, I am interested in booking a show.')}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="WhatsApp"
        className="whatsapp-float"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="26" height="26">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
          <path d="M12 0C5.373 0 0 5.373 0 12c0 2.125.555 4.122 1.528 5.856L.057 23.882a.5.5 0 0 0 .61.61l6.026-1.471A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.805 9.805 0 0 1-5.013-1.374l-.36-.214-3.724.909.936-3.617-.235-.372A9.796 9.796 0 0 1 2.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z"/>
        </svg>
      </a>

      <CookieConsent locale={locale} />
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
          sameAs: ['https://www.instagram.com/berlin.tina'],
        }}
      />
      <div className="flex flex-col items-center text-center mb-24">
        <div className="w-40 h-40 rounded-3xl overflow-hidden shadow-2xl mb-12">
          <img src="/images/valiantsina.png" alt="Valiantsina — Berlintina" className="w-full h-full object-cover object-top" />
        </div>
        <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-normal mb-6 sm:mb-8 tracking-tight">
          {locale === 'de' ? 'Hallo, ich bin Valiantsina.' : "Hi, I'm Valiantsina."}
        </h1>
        <div className="max-w-3xl text-left space-y-6 text-muted-foreground text-lg leading-relaxed">
          <p className="text-foreground font-display font-bold text-xl">
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
          <div className="border-l-2 border-accent pl-6 mt-6">
            <p className="text-foreground font-display font-bold italic">
              {locale === 'de' ? 'Berlintina ist kein Algorithmus. Berlintina bin ich.' : "Berlintina isn't an algorithm. Berlintina is me."}
            </p>
          </div>
          <div className="pt-8 border-t border-foreground/10 mt-8">
            <p className="mt-4">
              <Link to="/blog" className="text-sm font-display font-bold text-accent underline underline-offset-4 hover:opacity-70 transition">
                {locale === 'de' ? 'Zum Blog →' : 'Read the Blog →'}
              </Link>
            </p>
          </div>
        </div>
      </div>
      <div className="flex flex-col md:flex-row gap-4 justify-center items-center mb-32">
        <Link to="/catalog" className="btn-accent">
          {locale === 'de' ? 'Shows entdecken' : 'Discover Shows'}
        </Link>
        <Link to="/join" className="btn-primary">
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

// --- AboutBanner ---
const AboutBanner: React.FC<{ locale: 'de' | 'en' }> = ({ locale }) => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start end', 'end start'] });
  const lineWidth = useTransform(scrollYProgress, [0.1, 0.5], ['0%', '100%']);
  const mainText = locale === 'de'
    ? 'Wir sind eine Community aus außergewöhnlichen Künstlern und kreativen Talenten. Wir glauben an die Kraft von Live-Performances und echten Emotionen.'
    : 'We are a community of extraordinary artists and creative talents. We believe in the power of live performances and real emotions.';
  const words = mainText.split(' ');
  return (
    <>
    <section id="about" ref={sectionRef} className="pt-24 md:pt-32 pb-0">
      <div className="container grid grid-cols-12 gap-8">
        <div className="col-span-12 md:col-span-4">
          <motion.span className="label-style" initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
            00 / About
          </motion.span>
        </div>
        <div className="col-span-12 md:col-span-8">
          <p className="font-display text-2xl md:text-3xl font-bold text-foreground leading-snug max-w-[50ch]">
            {words.map((word, i) => (
              <span key={i} className="inline-block overflow-hidden mr-[0.3em]">
                <motion.span className="inline-block" initial={{ y: '100%', opacity: 0 }} whileInView={{ y: 0, opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.5, ease: [0.19, 1, 0.22, 1], delay: 0.1 + i * 0.03 }}>
                  {word}
                </motion.span>
              </span>
            ))}
          </p>
          <motion.div className="h-[2px] bg-accent mt-8 origin-left" style={{ width: lineWidth }} />
          <motion.p className="body-text mt-8" initial={{ y: 30, opacity: 0 }} whileInView={{ y: 0, opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.7, ease: [0.19, 1, 0.22, 1], delay: 0.3 }}>
            {locale === 'de'
              ? 'Bei uns findest du fertige Shows und ausgewählte Künstler für dein Event. Auf Wunsch gestalten und realisieren wir auch individuelle Performances – mit allem, was dazugehört: Konzept, Kostüm und Maske.'
              : 'Here you find ready-made shows and selected artists for your event. On request we also design and realise individual performances – with everything included: concept, costume and make-up.'}
          </motion.p>


        </div>
      </div>
    </section>
    {/* ── Video — same width/height as CTA block ── */}
    <section id="video" className="py-24 md:py-32 overflow-hidden">
      <div className="container">
        <div className="relative w-full aspect-video overflow-hidden">
          <iframe
            src="https://www.youtube.com/embed/dplWBsaHklw?rel=0&modestbranding=1&iv_load_policy=3&showinfo=0"
            title="Berlintina – Live Show Acts Berlin"
            className="absolute inset-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    </section>
    </>
  );
};

// --- CTABanner ---
const CTABanner: React.FC<{ locale: 'de' | 'en' }> = ({ locale }) => (
  <section id="call-to-action" className="py-24 md:py-32 overflow-hidden">
    <div className="container">
      <motion.div
        className="relative overflow-hidden bg-accent px-8 md:px-16 py-16 md:py-24 text-center"
        initial={{ y: 40, opacity: 0 }}
        whileInView={{ y: 0, opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, ease: [0.19, 1, 0.22, 1] }}
      >
        <div className="absolute top-6 right-8 w-3 h-3 rounded-full bg-accent-foreground/20" />
        <motion.p className="label-style mb-6" style={{ color: 'rgba(255,255,255,0.75)' }} initial={{ y: 20, opacity: 0 }} whileInView={{ y: 0, opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.2, duration: 0.5 }}>
          {locale === 'de' ? 'Bereit für etwas Außergewöhnliches?' : 'Ready for something extraordinary?'}
        </motion.p>
        <motion.h2
          className="font-display text-4xl md:text-6xl lg:text-7xl font-black leading-[1.05] mb-8" style={{ color: '#ffffff' }}
          initial={{ y: 30, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3, duration: 0.7, ease: [0.19, 1, 0.22, 1] }}
        >
          {locale === 'de' ? <>Lass uns deine<br />Show planen.</> : <>Let us plan your<br />show.</>}
        </motion.h2>
        <motion.div className="flex flex-col sm:flex-row gap-4 justify-center" initial={{ y: 20, opacity: 0 }} whileInView={{ y: 0, opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.5, duration: 0.5 }}>
          <Link to="/catalog" className="inline-flex items-center justify-center gap-2 bg-accent-foreground text-accent font-display font-bold text-lg px-8 py-4 rounded-full hover:scale-105 transition-transform duration-300">
            {locale === 'de' ? 'Shows entdecken' : 'Explore shows'} <ArrowRight className="w-5 h-5" />
          </Link>
          <a href="https://wa.me/491608106880" target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 border-2 border-white/40 font-display font-bold text-lg px-8 py-4 rounded-full hover:border-white hover:scale-105 transition-all duration-300" style={{ color: '#ffffff' }}>
            WhatsApp
          </a>
        </motion.div>
      </motion.div>
    </div>
  </section>
);

// --- ArtistIdeaSection: open call for early-career artists & unformed ideas ---
const ArtistIdeaSection: React.FC<{ locale: 'de' | 'en' }> = ({ locale }) => {
  const examples = locale === 'de'
    ? ['30-Min-Sport-Pause fürs Büro', '20-Min-Klavier-Opening', 'Ein Format, das es so noch nicht gibt']
    : ['30-min sport break for offices', '20-min piano opening act', 'A format that doesn\'t exist yet'];
  return (
    <section className="py-24 md:py-32 border-y border-foreground/10 bg-surface-alt">
      <div className="container grid grid-cols-12 gap-8">
        <div className="col-span-12 md:col-span-4">
          <span className="label-style mb-6 block">
            06 / {locale === 'de' ? 'Für Künstler & Ideen' : 'For Artists & Ideas'}
          </span>
          <div className="flex flex-wrap gap-2">
            {examples.map((ex) => (
              <span key={ex} className="text-xs font-mono-ui px-3 py-1.5 rounded-full border border-foreground/15 text-muted-foreground">
                {ex}
              </span>
            ))}
          </div>
        </div>
        <div className="col-span-12 md:col-span-8">
          <h2 className="heading-lg mb-4">
            {locale === 'de' ? 'Du hast eine Idee?' : 'Got an idea?'}
          </h2>
          <p className="body-text mb-10 max-w-[56ch]">
            {locale === 'de'
              ? 'Hast du schon eine fertige Show? Oder deinen ersten Auftritt? Oder nur eine Idee, die noch nicht fertig ist? Alles ist ein guter Start. Schreib mir ein paar Sätze darüber. Ich lese jede Nachricht persönlich, und mein KI-Producer macht dir danach einen konkreten Vorschlag. Kein Formular, keine Erfahrung mit Computern nötig — schreib einfach, wie du es einer Freundin erzählen würdest.'
              : "Do you already have a finished show? Or your first performance? Or just an idea that isn't finished yet? All of that is a good start. Write me a few sentences about it. I read every message personally, and my AI producer sends back a concrete proposal. No form, no computer experience needed — just write it the way you'd tell a friend."}
          </p>
          <Link
            to="/join/start"
            className="inline-flex items-center gap-2 bg-accent text-accent-foreground px-7 py-3.5 rounded-full font-semibold text-sm tracking-wide hover:opacity-90 transition-opacity no-underline"
          >
            {locale === 'de' ? 'Idee erzählen' : 'Share your idea'} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
};

// --- FeaturedArtistSection ---
const FeaturedArtistSection: React.FC<{ locale: 'de' | 'en' }> = ({ locale }) => {
  const { shows } = useShows();
  const navigate = useNavigate();
  const [activeIndex, setActiveIndex] = useState(0);
  const featured = shows.slice(0, 3);
  const ease = [0.19, 1, 0.22, 1] as const;
  if (featured.length === 0) return null;
  const artist = featured[activeIndex];
  return (
    <section id="featured" className="py-24 md:py-36 overflow-hidden">
      <div className="container">
        <motion.span className="label-style mb-6 block" initial={{ y: 20, opacity: 0 }} whileInView={{ y: 0, opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.5, ease }}>
          01 / {locale === 'de' ? 'Berlintinas Top-Acts' : "Berlintina's Top Acts"}
        </motion.span>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-10 items-start">
          {/* LEFT */}
          <div className="md:col-span-5 flex flex-col justify-between min-h-[50vh]">
            <div className="mb-8">
              <span className="font-mono-ui text-sm text-muted-foreground tracking-widest">
                {String(activeIndex + 1).padStart(2, '0')} / {String(featured.length).padStart(2, '0')}
              </span>
            </div>
            <AnimatePresence mode="wait">
              <motion.div key={activeIndex} className="flex-1" initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }} transition={{ duration: 0.45, ease }}>
                <h2 className="font-display text-4xl md:text-6xl lg:text-7xl font-bold text-foreground leading-[0.95] mb-3">{artist.title}</h2>
                <span className="label-style text-accent block mb-5">{artist.category}</span>
                <p className="body-text max-w-[38ch] mb-8 text-muted-foreground">{artist.shortDescriptionFacts?.slice(0, 150) || ''}</p>
                <button onClick={() => navigate(`/show/${artist.slug}`)} className="inline-flex items-center gap-2 bg-accent text-accent-foreground px-7 py-3 rounded-full font-semibold text-sm tracking-wide hover:opacity-90 transition-opacity">
                  {locale === 'de' ? 'Show ansehen' : 'View show'} →
                </button>
              </motion.div>
            </AnimatePresence>
            <div className="flex gap-3 mt-10">
              {featured.map((s, i) => (
                <button key={i} onClick={() => setActiveIndex(i)} className={`relative w-20 h-20 md:w-24 md:h-24 overflow-hidden border-2 transition-all duration-300 ${i === activeIndex ? 'border-accent scale-105 shadow-lg' : 'border-transparent opacity-50 hover:opacity-80'}`} aria-label={`View ${s.title}`}>
                  <img src={s.photoUrls?.[0] || ''} alt={s.title} className="w-full h-full object-cover" loading="lazy" />
                </button>
              ))}
            </div>
          </div>
          {/* RIGHT */}
          <div className="md:col-span-7 order-first md:order-last">
            <AnimatePresence mode="wait">
              <motion.div key={activeIndex} className="relative overflow-hidden" initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} transition={{ duration: 0.5, ease }}>
                <img src={artist.photoUrls?.[0] || ''} alt={`${artist.title} — ${artist.category}`} className="w-full aspect-[3/4] md:aspect-[4/5] object-cover" loading="lazy" />
                <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-background/70 to-transparent">
                  <span className="label-style text-foreground/80">{artist.category}</span>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
};

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
  const rawX = useTransform(heroScroll, [0, 1], [0, -800]);
  const sliderXVal = useSpring(rawX, { stiffness: 100, damping: 30 });

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
  const faqs = locale === 'de' ? [
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
  ];
  const [activeCat, setActiveCat] = useState<string>('all');
  const [searchFocused, setSearchFocused] = useState(false);
  const filteredShows = useMemo(() => {
    if (activeCat === 'all') return defaultShows;
    return defaultShows.filter((s) => s.category === activeCat);
  }, [defaultShows, activeCat]);

  // slider scroll is handled by useSpring + useTransform above

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
        '@graph': [
          {
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
            sameAs: ['https://www.instagram.com/berlin.tina'],
            priceRange: '€€–€€€',
          },
          {
            '@type': 'FAQPage',
            mainEntity: faqs.map((f) => ({
              '@type': 'Question',
              name: f.q,
              acceptedAnswer: { '@type': 'Answer', text: f.a },
            })),
          },
        ],
      }}
    />
    {/* ── Hero ── */}
    <section ref={heroRef} className="relative bg-background">
      <div className="flex flex-col pt-20">
        {/* Text */}
        <div className="container grid grid-cols-12 gap-8 items-end pt-8 md:pt-16 pb-8">
          <motion.div className="col-span-12 md:col-span-7" initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 30, delay: 0.1 }}>
            <motion.span className="label-style mb-4 block" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.3 }}>
              Boutique Artist Agency — Berlin
            </motion.span>
            <h1 className="heading-xl text-foreground leading-[0.9]">
              <motion.span className="block overflow-hidden pb-[0.12em] -mb-[0.12em]" initial={{ y: 80 }} animate={{ y: 0 }} transition={{ duration: 0.8, ease: [0.19, 1, 0.22, 1], delay: 0.2 }}>
                {locale === 'de' ? 'Shows die' : 'Shows that'}
              </motion.span>
              <motion.span className="block overflow-hidden pb-[0.12em] -mb-[0.12em]" initial={{ y: 80 }} animate={{ y: 0 }} transition={{ duration: 0.8, ease: [0.19, 1, 0.22, 1], delay: 0.35 }}>
                {locale === 'de' ? 'Köpfe drehen' : 'turn heads'}
              </motion.span>
              <motion.span className="block overflow-hidden pb-[0.12em] -mb-[0.12em]" initial={{ y: 80 }} animate={{ y: 0 }} transition={{ duration: 0.8, ease: [0.19, 1, 0.22, 1], delay: 0.5 }}>
                {locale === 'de' ? 'und Herzen' : 'and conquer'}
              </motion.span>
              <motion.span className="block overflow-hidden pb-[0.12em] -mb-[0.12em]" initial={{ y: 80 }} animate={{ y: 0 }} transition={{ duration: 0.8, ease: [0.19, 1, 0.22, 1], delay: 0.65 }}>
                {locale === 'de' ? 'gewinnen' : 'hearts'}<span className="text-accent">.</span>
              </motion.span>
            </h1>
          </motion.div>

          <motion.div className="col-span-12 md:col-span-5 pb-4" initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 30, delay: 0.6 }}>
            <p className="body-text mb-6">
              {locale === 'de'
                ? 'Berlintina ist eine Boutique Artist Agentur — spezialisiert auf Live Show Acts für Events, Galas und private Anlässe.'
                : 'Berlintina is a boutique artist agency — specialised in live show acts for events, galas and private occasions.'}
            </p>
            <div className="flex flex-wrap gap-4">
              <Link to="/catalog" className="btn-primary">{locale === 'de' ? 'Shows entdecken' : 'Explore shows'}</Link>
              <Link to="/join" className="btn-primary" style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                {locale === 'de' ? 'Für Künstler ↗' : 'Join as artist ↗'}
              </Link>
            </div>
          </motion.div>
        </div>

        {/* Scroll slider */}
        <div className="overflow-hidden mt-[15vh] pb-0">
          <motion.div className="flex gap-6 pl-8 md:pl-16 w-full" style={{ x: sliderXVal }}>
            {(showsLoading ? [] : filteredShows).map((show, i) => (
              <motion.div
                key={show.id}
                className="group shrink-0 w-[70vw] md:w-[28vw] cursor-pointer"
                initial={{ y: 40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30, delay: 0.8 + i * 0.08 }}
                onClick={() => navigate(`/show/${show.slug}`)}
              >
                <div className="relative overflow-hidden border border-foreground/10">
                  <img
                    src={show.photoUrls?.[0] || ''}
                    alt={show.title}
                    className="w-full aspect-[3/4] object-cover transition-all duration-700 group-hover:scale-105"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <span className="absolute top-4 left-4 label-style bg-background/80 px-3 py-1 backdrop-blur-sm">
                    {show.category}
                  </span>
                  <div className="absolute bottom-0 left-0 right-0 p-6 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500">
                    <h3 className="font-display text-xl font-bold text-foreground">{show.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{show.artistName}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>

      </div>
    </section>

    {/* ── About section ── */}
    <AboutBanner locale={locale} />

    {/* ── AI Recommendations — full width ── */}
    {hasResults && (
      <div ref={resultsRef} className="w-full border-t border-foreground/10 scroll-mt-20">
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-foreground/10 py-3 px-4 sm:px-6">
          <form onSubmit={(e) => { e.preventDefault(); if (query.trim()) sendMessage(query.trim()); }} className="max-w-2xl mx-auto flex gap-2">
            <div className="relative flex-grow">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <input
                type="search"
                placeholder={locale === 'de' ? 'Neue Suche…' : 'New search…'}
                className="w-full pl-9 pr-4 py-2.5 border border-foreground/10 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-foreground/10 focus:border-foreground/30 placeholder:text-muted-foreground text-foreground"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary text-sm disabled:opacity-50 whitespace-nowrap">
              {loading ? '…' : (locale === 'de' ? 'Suchen' : 'Search')}
            </button>
          </form>
        </div>
        <div className="w-full py-12 px-4 sm:px-6 bg-background">
          <div className="masonry-col">
            {recommendations.map(({ show, why }) => (
              <div key={show.id} className="masonry-col-item">
                <ShowCard show={show} locale={locale} onViewDetails={(s) => navigate(`/show/${s.slug}`)} />
                {why.length > 0 && (
                  <ul className="mt-2 text-xs text-muted-foreground list-disc list-inside px-1">
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

      {/* ── Roster — masonry grid ── */}
      <section id="roster" className="py-16 md:py-24 bg-background">
        <div className="container">
          <div className="masonry-grid">
            {showsLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="flex items-center gap-1.5">
                  {[0, 160, 320].map((d) => (
                    <span key={d} className="typing-dot w-2 h-2 rounded-full bg-foreground/30 inline-block" style={{ animationDelay: `${d}ms` }} />
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
                className="btn-primary inline-flex items-center gap-2"
              >
                {locale === 'de' ? 'Alle Shows' : 'All shows'} <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ── Why section ── */}
      <section id="why" className="py-24 md:py-32">
        <div className="container grid grid-cols-12 gap-8">
          <div className="col-span-12 md:col-span-4">
            <motion.span
              className="label-style"
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              02 / {locale === 'de' ? 'Warum Berlintina' : 'Why Berlintina'}
            </motion.span>
          </div>
          <div className="col-span-12 md:col-span-8">
            <motion.h2
              className="heading-lg mb-4"
              initial={{ y: 30, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
              {locale === 'de' ? <>Kein Marktplatz.<br />Eine Boutique-Agentur.</> : <>Not a marketplace.<br />A boutique agency.</>}
            </motion.h2>
            <motion.p
              className="body-text mb-16"
              initial={{ y: 20, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ type: 'spring', stiffness: 300, damping: 30, delay: 0.1 }}
            >
              {locale === 'de' ? 'Ich liste keine hundert Acts. Ich vertrete die Außergewöhnlichen.' : "We don't list hundreds of acts. We represent the exceptional ones."}
            </motion.p>
            <motion.div
              className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-16"
              variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.12 } } }}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
            >
              {([
                { title: locale === 'de' ? 'Persönlich kuratiert' : 'Personally Curated', text: locale === 'de' ? 'Jeder Künstler wurde von mir handverlesen. Kein Algorithmus — echte Expertise.' : 'Every performer is handpicked by our team. No algorithms — real expertise.' },
                { title: locale === 'de' ? 'Schnell & einfach' : 'Fast & Simple', text: locale === 'de' ? 'Eine Anfrage, ein Kontakt. Ich kümmere mich um Casting, Logistik und Verträge.' : 'One inquiry, one contact. We handle casting, logistics, and contracts.' },
                { title: locale === 'de' ? 'Für jeden Anlass' : 'For Every Occasion', text: locale === 'de' ? 'Corporate Galas, Festivals, Hochzeiten — ich kenne die richtige Besetzung.' : "Corporate galas, festivals, weddings, product launches — we've seen it all." },
                { title: locale === 'de' ? 'Künstler-zuerst' : 'Artist-First', text: locale === 'de' ? 'Ich stehe hinter jedem meiner Künstler. Glückliche Künstler liefern unvergessliche Shows.' : 'We invest in our artists like family. Happy artists deliver unforgettable shows.' },
              ]).map((card, i) => (
                <motion.div
                  key={i}
                  variants={{ hidden: { y: 40, opacity: 0 }, visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 300, damping: 30 } } }}
                  className="group"
                >
                  <span className="label-style mb-4 block">0{i + 1}</span>
                  <h3 className="font-display text-2xl font-bold text-foreground mb-3 group-hover:text-accent transition-colors duration-300">{card.title}</h3>
                  <p className="body-text text-base">{card.text}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Featured Artist ── */}
      <FeaturedArtistSection locale={locale} />

      {/* ── Testimonials ── */}
      <section id="testimonials" className="py-24 md:py-32 overflow-hidden">
        <div className="container grid grid-cols-12 gap-8">
          <div className="col-span-12 md:col-span-4">
            <motion.span
              className="label-style"
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              03 / Testimonials
            </motion.span>
          </div>
          <div className="col-span-12 md:col-span-8">
            <motion.h2
              className="heading-lg mb-4"
              initial={{ y: 30, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
              {locale === 'de' ? 'Was Kunden sagen.' : 'What clients say.'}
            </motion.h2>
            <p className="body-text mb-16">
              {locale === 'de' ? 'Persönlich kuratiert. Professionell vermittelt.' : 'Personally curated. Professionally arranged.'}
            </p>
          </div>
        </div>
        <div className="container">
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="border-l-2 border-accent pl-6 max-w-2xl"
          >
            <p className="text-lg text-foreground leading-relaxed font-body">
              {locale === 'de'
                ? 'Berlintina ist eine junge Plattform — aber Valiantsina vermittelt seit Jahren persönlich Künstler in Berlin. Die ersten Kundenstimmen folgen nach unseren gemeinsamen Events. Bis dahin: schauen Sie hinter die Kulissen auf Instagram.'
                : "Berlintina is a young platform — but Valiantsina has personally connected artists in Berlin for years. The first client testimonials will follow after our shared events. Until then: take a look behind the scenes on Instagram."}
            </p>
            <a
              href="https://www.instagram.com/berlin.tina"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-5 text-sm font-semibold text-accent hover:opacity-80 transition-opacity no-underline"
            >
              @berlin.tina <ArrowUpRight className="w-3.5 h-3.5" />
            </a>
          </motion.div>
        </div>
      </section>

      {/* ── Pricing Transparency ── */}
      <section id="pricing" className="py-24 md:py-32">
        <div className="container grid grid-cols-12 gap-8">
          <div className="col-span-12 md:col-span-4">
            <span className="label-style">
              04 / {locale === 'de' ? 'Preise' : 'Pricing'}
            </span>
          </div>
          <div className="col-span-12 md:col-span-8">
            <h2 className="heading-lg mb-4">
              {locale === 'de' ? 'Was kostet eine Buchung?' : 'What does a booking cost?'}
            </h2>
            <p className="body-text mb-12">
              {locale === 'de' ? 'Keine versteckten Gebühren. Transparenz von Anfang an.' : 'No hidden fees. Transparent from the start.'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              {[
                {
                  label: locale === 'de' ? 'SELBST BUCHEN' : 'BOOK YOURSELF',
                  price: locale === 'de' ? 'Keine Agenturgebühr' : 'No agency fee',
                  desc: locale === 'de' ? 'Direkt-Kontakt zum Künstler. Anfrage über Berlintina ist kostenlos.' : 'Direct contact with the artist. Enquiry via Berlintina is free.',
                  accent: false,
                },
                {
                  label: locale === 'de' ? 'WIR ÜBERNEHMEN ALLES' : 'FULL SERVICE',
                  price: '15–20 %',
                  desc: locale === 'de' ? 'Persönliche Beratung, Casting, Vertragsabwicklung & Koordination.' : 'Personal consulting, casting, contract handling & coordination.',
                  accent: true,
                },
                {
                  label: locale === 'de' ? 'EXKLUSIV' : 'EXCLUSIVE',
                  price: locale === 'de' ? 'Auf Anfrage' : 'On request',
                  desc: locale === 'de' ? 'Maßgeschneiderte Produktionen & individuelle Performances.' : 'Bespoke productions & individual performances.',
                  accent: false,
                },
              ].map((p, i) => (
                <div key={i} className={`border p-6 text-left transition-all duration-300 hover:-translate-y-1 ${p.accent ? 'border-accent bg-accent/5' : 'border-foreground/10 bg-background'}`}>
                  <p className={`label-style mb-3 ${p.accent ? 'text-accent' : ''}`}>{p.label}</p>
                  <p className={`font-display text-2xl font-bold tracking-tight mb-2 ${p.accent ? 'text-accent' : 'text-foreground'}`}>{p.price}</p>
                  <p className="text-sm text-muted-foreground">{p.desc}</p>
                </div>
              ))}
            </div>
            <p className="label-style">
              {locale === 'de'
                ? 'ANFRAGE KOSTENLOS · DIREKT-KONTAKT ERLAUBT · GEBÜHR NUR BEI FULL-SERVICE · ANGEBOT INNERHALB VON 24 H'
                : 'ENQUIRY FREE · DIRECT CONTACT ALLOWED · FEE ONLY FOR FULL-SERVICE · QUOTE WITHIN 24 H'}
            </p>
          </div>
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <CTABanner locale={locale} />

      {/* ── FAQ ── */}
      <section id="faq" className="py-24 md:py-32">
        <div className="container grid grid-cols-12 gap-8">
          <div className="col-span-12 md:col-span-4">
            <span className="label-style">
              05 / FAQ
            </span>
          </div>
          <div className="col-span-12 md:col-span-8">
            <h2 className="heading-lg mb-4">
              {locale === 'de' ? 'Häufige Fragen.' : 'Frequently asked questions.'}
            </h2>
            <p className="body-text mb-12">
              {locale === 'de' ? 'Antworten auf die wichtigsten Fragen.' : 'Answers to the most common questions.'}
            </p>
          <div className="space-y-0">
            {faqs.map((item, i) => (
              <div key={i} className="border-b border-foreground/10">
                <button
                  type="button"
                  onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                  className="w-full text-left py-5 flex items-center justify-between gap-4 text-foreground font-display font-bold hover:text-accent transition text-base"
                >
                  <span>{item.q}</span>
                  <span className={`text-2xl font-light flex-shrink-0 transition-transform duration-200 ${faqOpen === i ? 'rotate-45' : ''}`}>+</span>
                </button>
                {faqOpen === i && (
                  <div className="pb-5 body-text text-base max-w-none">{item.a}</div>
                )}
              </div>
            ))}
          </div>
          </div>
        </div>
      </section>

      {/* ── Artists & Ideas ── */}
      <ArtistIdeaSection locale={locale} />

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

// --- Join Landing View ---
const JoinLanding: React.FC<{ locale: 'de' | 'en' }> = ({ locale }) => {
  const navigate = useNavigate();
  const [hasStoredToken, setHasStoredToken] = useState(false);

  useEffect(() => {
    setHasStoredToken(!!getStoredArtistToken());
  }, []);

  const benefits = locale === 'de'
    ? [
        'Egal ob fertige Show, erster Auftritt oder nur eine Idee — alles willkommen',
        'Persönlich gelesen von Valiantsina — keine Bots, keine Formulare',
        'Gefunden von Eventagenturen & Privatkunden in Berlin',
      ]
    : [
        'Finished show, first performance, or just an idea — all welcome',
        'Personally read by Valiantsina — no bots, no forms',
        'Found by event agencies & private customers in Berlin',
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
          {locale === 'de' ? 'Du hast eine Idee? Erzähl sie mir.' : 'Got an idea? Tell me about it.'}
        </h1>
        <p className="text-sm font-semibold text-warm-faint uppercase tracking-widest mb-10">
          {locale === 'de' ? 'PERSÖNLICH BETREUT · AUCH FÜR EINSTEIGER · BERLIN-NETZWERK' : 'PERSONALLY SUPPORTED · FOR BEGINNERS TOO · BERLIN NETWORK'}
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
              'Du erzählst deine Idee — in eigenen Worten, ein Text reicht',
              'Ich lese persönlich mit und mache dir einen konkreten Vorschlag',
              'Provision nur bei erfolgreicher Buchung: 15% — du zahlst nur, wenn du verdienst',
            ] : [
              'You tell me your idea — in your own words, one message is enough',
              'I personally read it and send back a concrete proposal',
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
          {locale === 'de' ? 'Idee erzählen →' : 'Share your idea →'}
        </button>
        <p className="text-xs text-warm-faint font-medium">
          {locale === 'de' ? 'Bereits eingetragen? Dein Fortschritt wird gespeichert.' : 'Already listed? Your progress is saved.'}
        </p>
      </div>
    </div>
  );
};

// --- Progress pills for submission draft ---
const PROGRESS_KEYS = [
  { key: 'artistName', de: 'Name', en: 'Name' },
  { key: 'showTitle', de: 'Titel', en: 'Title' },
  { key: 'artistGenre', de: 'Genre', en: 'Genre' },
  { key: 'shortDescriptionFacts', de: 'Beschreibung', en: 'Description' },
  { key: 'durationMinutes', de: 'Dauer', en: 'Duration' },
  { key: 'submitterEmail', de: 'E-Mail', en: 'Email' },
] as const;

const EDIT_FIELDS = [
  { key: 'showTitle',             de: 'Show-Titel',        en: 'Show Title',        ph_de: 'z.B. Berlintina Cello Trio',           ph_en: 'e.g. Berlintina Cello Trio',         multiline: false },
  { key: 'artistName',            de: 'Künstler',           en: 'Artist',            ph_de: 'z.B. Trio Eclat',                      ph_en: 'e.g. Trio Eclat',                    multiline: false },
  { key: 'artistGenre',           de: 'Genre',              en: 'Genre',             ph_de: 'z.B. Klassik, Akrobatik',              ph_en: 'e.g. Classical, Acrobatics',         multiline: false },
  { key: 'durationMinutes',       de: 'Dauer (Minuten)',    en: 'Duration (min)',    ph_de: '60',                                   ph_en: '60',                                 multiline: false },
  { key: 'priceText',             de: 'Preis',              en: 'Price',             ph_de: 'ab 1.500 €',                           ph_en: 'from €1,500',                        multiline: false },
  { key: 'salesPitchText',        de: 'Show-Einzeiler',      en: 'Show tagline',      ph_de: '1 Satz der Eventplaner begeistert',    ph_en: '1 sentence that excites planners',   multiline: false },
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

  const previewShimmer = PREVIEW_ACCENT[genre?.toUpperCase()] ?? accent;

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
              {ef('durationMinutes', false,
                duration ? <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-surface-alt border border-warm-border text-sm font-medium text-charcoal">{duration}</span> : null,
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
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const [resolvingToken, setResolvingToken] = useState(true);
  const [returnArtist, setReturnArtist] = useState<ResolveArtistResponse | null>(null);
  const [welcomeBackChoice, setWelcomeBackChoice] = useState<'use' | 'fresh' | null>(null);
  const [showMediaInput, setShowMediaInput] = useState(false);
  const [lastNextSlot, setLastNextSlot] = useState<string | null>(null);

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };
  useEffect(() => { scrollToBottom(); }, [messages, loading, submitError]);

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
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 }, colors: ['#FF8000', '#141313', '#F7F5F2'] });
    }, 100);
    return (
      <div className="min-h-[calc(100vh-64px)] mt-16 flex items-center justify-center px-4 bg-background">
        <div className="max-w-md w-full text-center">
          <span className="label-style block mb-6">{locale === 'de' ? 'Erledigt' : 'Done'}</span>
          <h2 className="font-display text-4xl font-bold mb-4 tracking-tight text-foreground">
            {locale === 'de' ? 'Gesendet.' : 'Sent.'}
          </h2>
          <p className="text-muted-foreground mb-2 text-base leading-relaxed">
            {locale === 'de'
              ? 'Valiantsina prüft deine Bewerbung persönlich. Du hörst innerhalb von 24 Stunden von ihr.'
              : 'Valiantsina reviews your application personally. You will hear from her within 24 hours.'}
          </p>
          <p className="text-xs text-muted-foreground/60 font-mono-ui mt-6">ID: {submissionId}</p>
          <Link to="/catalog" className="inline-flex items-center gap-2 mt-10 bg-accent text-accent-foreground px-7 py-3.5 rounded-full font-display font-bold text-sm hover:opacity-90 transition-opacity no-underline">
            {locale === 'de' ? 'Shows entdecken' : 'Discover shows'} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  if (!resolvingToken && returnArtist?.isReturning && welcomeBackChoice === null) {
    const acc = returnArtist.artistAccount;
    const label = [acc?.instagramHandle ? `@${acc.instagramHandle}` : null, acc?.websiteUrl].filter(Boolean).join(' • ') || (locale === 'de' ? 'Du' : 'You');
    return (
      <div className="min-h-[calc(100vh-64px)] mt-16 flex items-center justify-center px-4 bg-background">
        <div className="max-w-md w-full text-center">
          <span className="label-style block mb-6">{locale === 'de' ? 'Willkommen zurück' : 'Welcome back'}</span>
          <h2 className="font-display text-3xl font-bold mb-4 tracking-tight text-foreground">
            {locale === 'de' ? 'Schön, dich wiederzusehen.' : 'Good to see you again.'}
          </h2>
          <p className="text-muted-foreground mb-2">
            {locale === 'de'
              ? 'Soll ich deine gespeicherten Angaben verwenden?'
              : 'Should I use your saved details?'}
          </p>
          {label && <p className="text-sm text-muted-foreground/60 mb-8">({label})</p>}
          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
            <button type="button" onClick={() => setWelcomeBackChoice('use')} className="bg-accent text-accent-foreground px-7 py-3.5 rounded-full font-display font-bold text-sm hover:opacity-90 transition-opacity">
              {locale === 'de' ? 'Ja, verwenden' : 'Yes, use them'}
            </button>
            <button type="button" onClick={() => { clearStoredArtistToken(); setWelcomeBackChoice('fresh'); }} className="px-7 py-3.5 rounded-full border border-foreground/15 text-muted-foreground font-display font-bold text-sm hover:border-foreground/40 hover:text-foreground transition-colors">
              {locale === 'de' ? 'Nein, neu starten' : 'No, start fresh'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const filledCount = PROGRESS_KEYS.filter(p => submissionDraft[p.key] && String(submissionDraft[p.key]).trim()).length;

  const canFinish = !!(submissionDraft.showTitle && String(submissionDraft.showTitle).trim() && submissionDraft.artistName && String(submissionDraft.artistName).trim());

  const isFilled = (k: string) => !!(submissionDraft[k] && String(submissionDraft[k]).trim());
  const WIZARD_STEPS = [
    { label: locale === 'de' ? 'Idee' : 'Idea', keys: ['artistName'] },
    { label: locale === 'de' ? 'Show' : 'Show', keys: ['showTitle', 'shortDescriptionFacts'] },
    { label: locale === 'de' ? 'Details' : 'Details', keys: ['durationMinutes'] },
    { label: locale === 'de' ? 'Kontakt' : 'Contact', keys: ['submitterEmail'] },
  ];
  const currentStep = submissionId
    ? WIZARD_STEPS.length
    : WIZARD_STEPS.findIndex(s => !s.keys.every(isFilled));
  const activeStepIndex = currentStep === -1 ? WIZARD_STEPS.length - 1 : currentStep;

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

  const recentMessages = messages.slice(-6);
  const hiddenCount = messages.length - recentMessages.length;

  return (
    <div className="flex bg-background min-h-[calc(100vh-64px)] mt-16">

      {/* ── LEFT: Guided panel (38%) ── */}
      <div className="w-[38%] min-w-[360px] flex-shrink-0 flex flex-col bg-background border-r border-foreground/10 h-[calc(100vh-64px)] sticky top-16">

        {/* Step indicator */}
        <div className="px-6 pt-8 pb-6 border-b border-foreground/10 flex-shrink-0">
          <div className="flex items-center gap-2 mb-5">
            {WIZARD_STEPS.map((step, i) => (
              <React.Fragment key={step.label}>
                <div className="flex items-center gap-2">
                  <span className={`font-mono-ui text-xs w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 border transition-colors ${
                    i < activeStepIndex ? 'bg-accent border-accent text-accent-foreground'
                    : i === activeStepIndex ? 'border-accent text-accent font-bold'
                    : 'border-foreground/15 text-muted-foreground/50'
                  }`}>
                    {i < activeStepIndex ? '✓' : i + 1}
                  </span>
                  <span className={`text-xs font-semibold hidden sm:inline ${i === activeStepIndex ? 'text-foreground' : 'text-muted-foreground/50'}`}>
                    {step.label}
                  </span>
                </div>
                {i < WIZARD_STEPS.length - 1 && <span className="flex-1 h-px bg-foreground/10" />}
              </React.Fragment>
            ))}
          </div>
          <h1 className="font-display text-2xl font-bold text-foreground tracking-tight mb-1.5">
            {locale === 'de' ? 'Du hast eine Idee?' : 'Got an idea?'}
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {locale === 'de'
              ? 'Erzähl mir davon — ich lese mit und wir bauen deine Show-Seite gemeinsam auf.'
              : "Tell me about it — I'll read along as we build your show page together."}
          </p>
        </div>

        {/* Conversation */}
        <div ref={messagesContainerRef} className="flex-grow overflow-y-auto px-6 py-6 space-y-5 flex flex-col">
          {resolvingToken && messages.length === 0 && (
            <div className="flex-grow flex items-center justify-center">
              <div className="flex items-center gap-1.5">
                {[0, 160, 320].map(d => <span key={d} className="typing-dot w-2 h-2 rounded-full bg-foreground/20 inline-block" style={{ animationDelay: `${d}ms` }} />)}
              </div>
            </div>
          )}
          {apiError && <div className="p-4 border border-amber-300 bg-amber-50 text-amber-800 text-sm font-medium">{apiError}</div>}
          {submitError && <div className="p-4 border border-red-300 bg-red-50 text-red-800 text-sm font-medium">{submitError}</div>}

          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => messagesContainerRef.current?.scrollTo({ top: 0 })}
              className="label-style text-left hover:text-foreground transition-colors"
            >
              {locale === 'de' ? `${hiddenCount} frühere Antwort(en) ausgeblendet` : `${hiddenCount} earlier reply(ies) hidden`}
            </button>
          )}

          {recentMessages.map((m, i) => (
            <div key={i} className={`animate-in fade-in slide-in-from-bottom-1 duration-200 ${m.role === 'user' ? 'text-right' : ''}`}>
              {m.role === 'ai' ? (
                <p className="text-base text-foreground leading-relaxed whitespace-pre-wrap font-medium">{m.text}</p>
              ) : (
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap inline-block max-w-[85%]">{m.text}</p>
              )}
            </div>
          ))}
          {loading && messages.length > 0 && (
            <div className="flex gap-1.5">
              {[0, 160, 320].map(d => <span key={d} className="typing-dot w-1.5 h-1.5 rounded-full bg-foreground/30 inline-block" style={{ animationDelay: `${d}ms` }} />)}
            </div>
          )}
          {!loading && quickReplies.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {quickReplies.map((q, i) => (
                <button key={i} type="button" onClick={() => {
                  if (lastNextSlot === 'has_show') {
                    const value = (q === 'Ja, habe eine Show' || q === 'Yes, I have a show') ? 'HAS_SHOW' : (q === 'Nein, brainstormen' || q === 'No, brainstorm') ? 'NO_SHOW' : undefined;
                    sendMessage(q, value ? { action: 'BUTTON', value } : undefined);
                  } else { sendMessage(q); }
                }} disabled={loading} className="px-4 py-2 rounded-full border border-foreground/15 text-sm font-semibold text-foreground hover:border-accent hover:text-accent transition-colors disabled:opacity-50">
                  {q}
                </button>
              ))}
            </div>
          )}
          {showMediaInput && (
            <div className="space-y-2.5">
              <label className="flex items-center gap-2.5 px-4 py-2.5 rounded-full border border-foreground/15 cursor-pointer text-sm font-semibold text-muted-foreground hover:border-foreground/30 w-fit">
                <span>{photoFiles.length > 0 ? `${photoFiles.length} ${locale === 'de' ? 'Foto(s) hinzugefügt' : 'photo(s) added'}` : (locale === 'de' ? 'Fotos hochladen' : 'Upload photos')}</span>
                <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => {
                  const files = Array.from(e.target.files || []).filter(f => f.type.startsWith('image/'));
                  if (files.length) { setPhotoFiles(prev => [...prev, ...files]); sendMessage(locale === 'de' ? `${files.length} Foto(s) hinzugefügt` : `${files.length} photo(s) added`); }
                }} />
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder={locale === 'de' ? 'YouTube-Link (optional)' : 'YouTube link (optional)'}
                  value={pendingVideoUrl}
                  onChange={e => setPendingVideoUrl(e.target.value)}
                  className="flex-1 px-4 py-2.5 rounded-full border border-foreground/15 bg-background text-sm font-medium text-foreground focus:outline-none focus:border-accent placeholder:text-muted-foreground/50"
                />
                {pendingVideoUrl && (
                  <button type="button" onClick={() => sendMessage(locale === 'de' ? 'Video hinzugefügt' : 'Video added')}
                    className="px-4 py-2.5 rounded-full bg-accent text-accent-foreground text-sm font-semibold">
                    OK
                  </button>
                )}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Finish */}
        {canFinish && (
          <div className="px-6 pt-2 flex-shrink-0 space-y-2.5 border-t border-foreground/10 pt-5">
            {!(submissionDraft.submitterEmail && String(submissionDraft.submitterEmail).includes('@')) && (
              <input
                type="email"
                placeholder={locale === 'de' ? 'Deine E-Mail-Adresse (für die Bestätigung)' : 'Your email address (for confirmation)'}
                value={String(submissionDraft.submitterEmail || '')}
                onChange={(e) => setSubmissionDraft((d) => ({ ...d, submitterEmail: e.target.value }))}
                className="w-full px-4 py-3 rounded-full border border-foreground/15 bg-background text-sm font-medium text-foreground focus:outline-none focus:border-accent placeholder:text-muted-foreground/50"
              />
            )}
            {submitError && <div className="p-3 border border-red-300 bg-red-50 text-red-800 text-sm font-medium">{submitError}</div>}
            <button
              type="button"
              onClick={() => handleFinish()}
              disabled={submitting}
              className="w-full py-3.5 bg-accent text-accent-foreground rounded-full font-display font-bold text-base hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {submitting
                ? <span className="flex gap-1">{[0, 100, 200].map(d => <span key={d} className="typing-dot w-1.5 h-1.5 rounded-full bg-accent-foreground/70 inline-block" style={{ animationDelay: `${d}ms` }} />)}</span>
                : <>{locale === 'de' ? 'Show einreichen' : 'Submit show'} <ArrowRight className="w-4 h-4" /></>
              }
            </button>
          </div>
        )}

        {/* Input */}
        <div className="border-t border-foreground/10 bg-background flex-shrink-0">
          {/https?:\/\//.test(input) && (
            <div className="px-6 pt-3 pb-0">
              <span className="label-style">{locale === 'de' ? 'Website wird analysiert…' : 'Analyzing your website…'}</span>
            </div>
          )}
          <div className="p-6 flex gap-2.5">
            <input type="text" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} className="hidden" aria-hidden="true" tabIndex={-1} />
            <input
              type="text"
              placeholder={locale === 'de' ? 'Antworten oder URL einfügen…' : 'Reply or paste your URL…'}
              className="flex-grow px-4 py-3 rounded-full border border-foreground/15 bg-background text-sm font-medium focus:outline-none focus:border-accent transition-colors text-foreground disabled:opacity-50 placeholder:text-muted-foreground/50"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              disabled={loading || submitting || !conversationId}
            />
            <button onClick={() => sendMessage()} disabled={(!input.trim()) || loading || submitting || !conversationId}
              className="w-11 h-11 bg-accent text-accent-foreground rounded-full hover:opacity-90 transition-opacity flex items-center justify-center disabled:opacity-20 flex-shrink-0 self-end">
              {loading
                ? <span className="flex gap-0.5">{[0, 100, 200].map(d => <span key={d} className="typing-dot w-1.5 h-1.5 rounded-full bg-accent-foreground/70 inline-block" style={{ animationDelay: `${d}ms` }} />)}</span>
                : <ArrowRight className="w-4 h-4" />
              }
            </button>
          </div>
        </div>
      </div>

      {/* ── RIGHT: Live Preview (62%) ── */}
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
    <div className="pt-16 md:pt-20">
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

      <div className="flex flex-col md:flex-row min-h-screen">
        {/* ── Left sidebar ── */}
        <div className="md:w-[340px] md:flex-shrink-0 md:sticky md:top-[80px] md:h-[calc(100vh-80px)] md:overflow-y-auto border-b md:border-b-0 md:border-r border-border p-8 flex flex-col gap-8">
          <div>
            <span className="label-style mb-3 block">{locale === 'de' ? 'Alle Künstler' : 'All Artists'}</span>
            <h1 className="heading-lg text-foreground">Shows<span className="text-accent">.</span></h1>
            <p className="body-text text-sm mt-4">
              {locale === 'de' ? 'Jeder Act wurde von Valiantsina persönlich ausgewählt.' : 'Every act was personally selected by Valiantsina.'}
            </p>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder={locale === 'de' ? 'Suchen…' : 'Search…'}
              className="w-full pl-10 pr-4 py-3 border border-border bg-background text-foreground text-sm focus:outline-none focus:border-foreground transition placeholder:text-muted-foreground"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Filter pills */}
          <div className="flex flex-wrap gap-2">
            {(['ALL', ...Object.values(Category)] as const).map(cat => (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className={`px-4 py-2 text-xs font-mono-ui uppercase tracking-wider border transition-all ${
                  filter === cat
                    ? 'border-accent bg-accent text-accent-foreground'
                    : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Stats */}
          {!loading && (
            <div className="border-t border-border pt-6">
              <p className="label-style">{totalCount} {locale === 'de' ? 'Shows gefunden' : 'shows found'}</p>
            </div>
          )}

          {/* Custom CTA */}
          <div className="mt-auto border border-border p-6">
            <span className="label-style mb-3 block">{locale === 'de' ? 'Etwas Individuelles?' : 'Something Custom?'}</span>
            <p className="text-sm text-muted-foreground mb-4">
              {locale === 'de'
                ? 'Valiantsina hat Zugang zu 50+ weiteren Berliner Künstlern.'
                : 'Valiantsina has access to 50+ more Berlin artists.'}
            </p>
            <a
              href={`mailto:info@berlintina.de?subject=${encodeURIComponent(locale === 'de' ? 'Buchungsanfrage' : 'Booking Inquiry')}`}
              className="btn-primary text-sm w-full text-center block"
            >
              {locale === 'de' ? 'Anfragen →' : 'Enquire →'}
            </a>
          </div>
        </div>

        {/* ── Right grid ── */}
        <div className="flex-1 p-6 md:p-8">
          {error && (
            <div className="mb-8 p-4 bg-amber-50 border border-amber-200 text-amber-800 text-sm font-medium">
              {error}
            </div>
          )}

          {loading && shows.length === 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="border border-border overflow-hidden">
                  <div className="aspect-[4/5] bg-muted animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
                  <div className="p-4 space-y-2">
                    <div className="h-3 bg-muted rounded animate-pulse w-3/4" style={{ animationDelay: `${i * 80 + 60}ms` }} />
                    <div className="h-2.5 bg-muted rounded animate-pulse w-1/2" style={{ animationDelay: `${i * 80 + 120}ms` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : !loading && !error && shows.length === 0 ? (
            <div className="py-24 text-center">
              <p className="text-muted-foreground font-medium text-lg mb-4">{locale === 'de' ? 'Keine Shows gefunden.' : 'No shows found.'}</p>
              <p className="text-sm text-muted-foreground">{locale === 'de' ? 'Versuche andere Filter oder suche nach etwas anderem.' : 'Try different filters or search for something else.'}</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {shows.map((show) => (
                  <div
                    key={show.id}
                    className="group cursor-pointer border border-border overflow-hidden"
                    onClick={() => navigate(`/show/${show.slug}`)}
                  >
                    <div className="relative overflow-hidden aspect-[4/5]">
                      <img
                        src={show.photoUrls?.[0] || ''}
                        alt={show.title}
                        className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700 group-hover:scale-105"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                      <span className="absolute top-4 left-4 label-style bg-background/80 px-3 py-1 backdrop-blur-sm">
                        {show.category}
                      </span>
                      <div className="absolute top-4 right-4 w-8 h-8 bg-background flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <ArrowRight className="w-4 h-4 text-foreground" />
                      </div>
                    </div>
                    <div className="p-4 border-t border-border">
                      <h3 className="font-display font-bold text-foreground">{show.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{show.artistName}</p>
                    </div>
                  </div>
                ))}
              </div>
              {/* Infinite scroll sentinel */}
              <div ref={sentinelRef} className="h-16" />
              {loading && (
                <div className="py-8 text-center text-muted-foreground text-sm font-medium">
                  {locale === 'de' ? 'Lade…' : 'Loading…'}
                </div>
              )}
            </>
          )}
        </div>
      </div>
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
          <Route path="join" element={<JoinLanding locale={locale} />} />
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
