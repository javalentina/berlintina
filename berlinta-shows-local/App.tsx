import React, { useState, useEffect, useMemo, useRef, lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, useNavigate, useParams, Link, useLocation, Navigate } from 'react-router-dom';
import { Category, Show, CustomerBrief, ArtistStatus } from './types';
import { VIBE_OPTIONS } from './constants';
import { aiService } from './services/aiService';
import * as apiClient from './services/apiClient';
import { scoreShows } from './lib/matching';
import { conversationStart, conversationMessage } from './services/conversationService';
import { LanguageToggle } from './components/LanguageToggle';
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
  const isActive = (path: string) => location.pathname === path;

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
    };
    if (path.startsWith('/show/') || path.startsWith('/blog/')) return;
    document.title = titles[path] ?? 'Berlintina Shows';
  }, [location.pathname]);

  useEffect(() => { setMobileMenuOpen(false); }, [location.pathname]);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <header className="bg-white/95 backdrop-blur-md sticky top-0 z-50 border-b border-gray-100">
        <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 md:px-8 h-14 sm:h-16 flex items-center justify-between">
          <Link to="/" className="text-base sm:text-lg font-semibold tracking-tight text-black flex items-center gap-2 group">
            <div className="bg-black text-white w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg text-xs sm:text-sm font-bold italic transform group-hover:rotate-6 transition-transform">V</div>
            <span className="font-semibold text-gray-900 tracking-tight">Berlintina</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8 lg:gap-10">
            <Link to="/catalog" className={`text-sm font-semibold transition pb-1 border-b-2 ${isActive('/catalog') ? 'text-black border-black' : 'text-gray-500 border-transparent hover:text-black'}`}>Shows</Link>
            <Link to="/blog" className={`text-sm font-semibold transition pb-1 border-b-2 ${isActive('/blog') ? 'text-black border-black' : 'text-gray-500 border-transparent hover:text-black'}`}>Blog</Link>
            <Link to="/join" className={`text-sm font-semibold transition pb-1 border-b-2 ${isActive('/join') ? 'text-black border-black' : 'text-gray-500 border-transparent hover:text-black'}`}>{locale === 'de' ? 'Für Künstler' : 'For Artists'}</Link>
            <Link to="/about" className={`text-sm font-semibold transition pb-1 border-b-2 ${isActive('/about') ? 'text-black border-black' : 'text-gray-500 border-transparent hover:text-black'}`}>{locale === 'de' ? 'Über mich' : 'About me'}</Link>
          </nav>
          <div className="flex items-center gap-3 sm:gap-4">
            <LanguageToggle locale={locale} onChange={setLocale} />
            <button onClick={() => setMobileMenuOpen((o) => !o)} className="md:hidden p-2 -mr-2 rounded-lg hover:bg-gray-100" aria-label="Menu">
              <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={mobileMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} /></svg>
            </button>
          </div>
        </div>
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white px-4 py-4 space-y-1">
            <Link to="/catalog" className="block py-3 text-sm font-semibold text-gray-700 hover:text-black">Shows</Link>
            <Link to="/blog" className="block py-3 text-sm font-semibold text-gray-700 hover:text-black">Blog</Link>
            <Link to="/join" className="block py-3 text-sm font-semibold text-gray-700 hover:text-black">{locale === 'de' ? 'Für Künstler' : 'For Artists'}</Link>
            <Link to="/about" className="block py-3 text-sm font-semibold text-gray-700 hover:text-black">{locale === 'de' ? 'Über mich' : 'About me'}</Link>
          </div>
        )}
      </header>
      <main className="flex-grow">
        {children}
      </main>
      <footer className="bg-white border-t border-gray-100 py-8 sm:py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-xs text-gray-400 font-medium tracking-wide">© 2024 Berlintina • Created with care in Berlin</p>
        </div>
      </footer>
    </div>
  );
};

// --- About View ---
const About: React.FC<{ locale: 'de' | 'en' }> = ({ locale }) => {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
      <div className="flex flex-col items-center text-center mb-24">
        <div className="w-32 h-32 rounded-3xl bg-black text-white flex items-center justify-center font-black text-5xl italic shadow-2xl mb-12 transform rotate-6 select-none">V</div>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold mb-6 sm:mb-8 tracking-tight">
          {locale === 'de' ? 'Hallo, ich bin Valiantsina.' : "Hi, I'm Valiantsina."}
        </h1>
        <div className="max-w-3xl text-left space-y-6 text-gray-600 text-lg leading-relaxed font-medium">
          <p>
            {locale === 'de' 
              ? 'Ich bin Webentwicklerin, KI-Interessierte (mit Uni-Hintergrund) und Show-Gestalterin — und vor allem jemand, der an echte Verbindung glaubt: an Momente, die berühren und Menschen zusammenbringen.' 
              : 'I am a web developer, AI enthusiast (with a university background), and show creator — and above all, someone who believes in real connection: in moments that touch people and bring them together.'}
          </p>
          <p>
            {locale === 'de'
              ? 'Berlintina Shows ist mein Herzensprojekt: eine Brücke zwischen Kunst und Technologie. Ich möchte, dass Veranstalter:innen schnell die passende Show finden — und dass Künstler sichtbar werden, ohne sich in Marketing und Chaos zu verlieren.'
              : 'Berlintina Shows is my heart project: a bridge between art and technology. I want event planners to find the right show quickly — and artists to become visible without getting lost in marketing and chaos.'}
          </p>
          <p>
            {locale === 'de'
              ? 'Wichtig für dich: Jede Show auf dieser Plattform habe ich persönlich gesehen — oder werde sie sehen, bevor sie dauerhaft gelistet bleibt. Qualität, Respekt und Menschlichkeit stehen für mich an erster Stelle.'
              : 'Important for you: I have personally seen every show on this platform — or will see it before it remains permanently listed. Quality, respect, and humanity are my top priorities.'}
          </p>
          <div className="bg-[#f1f1ef] p-8 rounded-3xl border border-gray-100 mt-6">
             <h3 className="font-bold text-black mb-3 text-xl tracking-tight">{locale === 'de' ? 'Warum kostenlos?' : 'Why for free?'}</h3>
             <p className="text-gray-700">
               {locale === 'de'
              ? 'Weil ich glaube, dass Talente nicht "lauter" werden müssen, nur um gefunden zu werden. Viele Künstler sind schüchtern, trainieren hart und haben kaum Zeit für Vermarktung — und oft müssen sie Kompromisse machen, die sie gar nicht wollen. Diese Plattform soll genau das ändern.'
              : "Because I believe that talents shouldn't have to get \"louder\" just to be found. Many artists are shy, train hard, and have little time for marketing. This platform is meant to change exactly that."}
             </p>
          </div>
          <div className="pt-8 border-t border-gray-100 mt-8">
             <p className="text-sm font-medium text-gray-400 italic">
                {locale === 'de'
                ? 'Transparenz: Meine persönlichen Texte im Blog schreibe ich ohne KI. Und bei jeder Show findest du meine private, ehrliche Einschätzung.'
                : 'Transparency: I write my personal blog posts without AI. And with every show you will find my private, honest assessment.'}
            </p>
            <p className="mt-4">
              <Link to="/blog" className="text-sm font-bold text-black underline underline-offset-4 hover:opacity-70 transition">
                {locale === 'de' ? 'Zum Blog →' : 'Read the Blog →'}
              </Link>
            </p>
            <p className="text-sm font-medium text-gray-400 mt-2">
                {locale === 'de'
                ? 'Pilotprojekt & Lernen: Das ist ein Pilotprojekt. Ich baue hier eine Kommunikation zwischen den kreativsten Menschen — und automatisierten KI-Agenten, die Prozesse abnehmen: Anfrage, Struktur, Texte, Übersicht.'
                : 'Pilot Project & Learning: This is a pilot project. I am building communication between the most creative people — and automated AI agents that handle processes: inquiries, structure, texts, overview.'}
            </p>
          </div>
        </div>
      </div>
      <div className="flex flex-col md:flex-row gap-4 justify-center items-center mb-32">
        <Link to="/catalog" className="px-10 py-5 bg-black text-white rounded-2xl font-bold text-sm shadow-xl hover:opacity-90 transition">
          {locale === 'de' ? 'Shows entdecken' : 'Discover Shows'}
        </Link>
        <Link to="/join" className="px-10 py-5 border-2 border-gray-100 rounded-2xl font-bold text-sm text-gray-500 hover:text-black hover:border-black transition">
          {locale === 'de' ? 'Künstler werden' : 'Become an Artist'}
        </Link>
      </div>
    </div>
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
        { label: '🏢 Corporate & Gala', query: 'elegante Live-Musik für Gala oder Corporate Event' },
        { label: '🎂 Private Feier', query: 'Show für private Feier oder Geburtstag' },
        { label: '💒 Hochzeit & Party', query: 'Unterhaltung für Hochzeit oder Party' },
      ]
    : [
        { label: '🏢 Corporate & Gala', query: 'elegant live music for gala or corporate event' },
        { label: '🎂 Private Celebration', query: 'show for private celebration or birthday' },
        { label: '💒 Wedding & Party', query: 'entertainment for wedding or party' },
      ];

  const handleChip = (chipQuery: string) => {
    setQuery(chipQuery);
    sendMessage(chipQuery);
  };

  const defaultShows = useMemo(() => shows.slice(0, 6), [shows]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6">
      {/* ── Section 1: Hero ── */}
      <section className="py-16 sm:py-24 text-center animate-in fade-in duration-500 print:hidden">
        <p className="inline-block mb-6 px-4 py-1.5 rounded-full bg-[#f1f1ef] text-xs font-black uppercase tracking-[0.15em] text-gray-500">
          {locale === 'de' ? 'Für Eventagenturen & private Feiern' : 'For event agencies & private celebrations'}
        </p>

        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-semibold leading-[1.1] tracking-tight text-[#1d1d1f] mb-4">
          {locale === 'de'
            ? <>Den richtigen Künstler zu finden<br className="hidden sm:block" /> dauert ewig.</>
            : <>Finding the right artist<br className="hidden sm:block" /> for your event takes forever.</>}
        </h1>
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-gray-400 mb-6 tracking-tight">
          {locale === 'de' ? 'Nicht mit Berlintina.' : 'Not with Berlintina.'}
        </h2>
        <p className="text-lg text-gray-500 mb-10 max-w-xl mx-auto leading-relaxed font-medium">
          {locale === 'de'
            ? 'Beschreibe dein Event — KI findet die perfekte Show. Kuratiert, schnell, kostenlos.'
            : 'Describe your event — AI finds the perfect show. Curated, fast, free.'}
        </p>

        {/* Audience chips */}
        <div className="flex flex-wrap justify-center gap-3 mb-8">
          {audienceChips.map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={() => handleChip(chip.query)}
              disabled={loading}
              className="px-5 py-2.5 rounded-2xl bg-white border-2 border-gray-200 text-sm font-bold text-gray-700 hover:border-black hover:text-black transition disabled:opacity-50 touch-manipulation"
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Search form */}
        {showsError && (
          <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm font-medium text-left max-w-2xl mx-auto">
            {showsError}
          </div>
        )}
        {apiError && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm font-medium text-left flex items-center justify-between gap-4 max-w-2xl mx-auto">
            <span>{apiError}</span>
            {retryFn && <button onClick={retryFn} className="px-4 py-2 bg-red-100 rounded-lg font-bold text-xs hover:bg-red-200">{locale === 'de' ? 'Erneut versuchen' : 'Retry'}</button>}
          </div>
        )}
        <form onSubmit={(e) => { e.preventDefault(); if (query.trim()) sendMessage(query.trim()); }} className="max-w-2xl mx-auto flex flex-col sm:flex-row gap-2">
          <input
            type="search"
            placeholder={locale === 'de' ? 'z. B. elegante Live-Musik, Gala, Berlin' : 'e.g. elegant live music, gala, Berlin'}
            className="flex-grow px-4 sm:px-6 py-3 sm:py-4 rounded-2xl border border-gray-200 text-base focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent placeholder:text-gray-400 font-medium min-h-[48px]"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={locale === 'de' ? 'Suche' : 'Search'}
          />
          <button type="submit" disabled={loading} className="px-8 py-4 min-h-[48px] rounded-2xl bg-black text-white font-semibold text-sm hover:opacity-90 transition disabled:opacity-50 whitespace-nowrap touch-manipulation">
            {loading ? '…' : (locale === 'de' ? 'Suchen' : 'Search')}
          </button>
        </form>
        {loading && <p className="mt-4 text-sm text-gray-500">…</p>}
      </section>

      {/* ── AI Recommendations (replaces default grid after search) ── */}
      {hasResults && (
        <section ref={resultsRef} className="pb-16 text-left scroll-mt-20">
          <h3 className="text-lg font-bold mb-6">{locale === 'de' ? 'Shows – beste Treffer' : 'Shows – best matches'}</h3>
          <div className="masonry-grid">
            {recommendations.map(({ show, why }) => (
              <div key={show.id} className="masonry-item">
                <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                  <ShowCard show={show} locale={locale} onViewDetails={(s) => navigate(`/show/${s.slug}`)} />
                  {why.length > 0 && (
                    <ul className="mt-2 text-xs text-gray-500 list-disc list-inside">
                      {why.map((w, i) => <li key={i}>{w}</li>)}
                    </ul>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Section 2: How it works (shown only before search) ── */}
      {!hasResults && (
        <section className="py-16 border-t border-gray-100">
          <h3 className="text-center text-xs font-black uppercase tracking-[0.15em] text-gray-400 mb-12">
            {locale === 'de' ? 'So funktioniert\'s' : 'How it works'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-12 text-center">
            {[
              {
                step: '1',
                title: locale === 'de' ? 'Beschreibe dein Event' : 'Tell us about your event',
                body: locale === 'de' ? 'Gib ein, was du brauchst — Anlass, Stimmung, Stadt.' : 'Type what you need — occasion, vibe, city.',
              },
              {
                step: '2',
                title: locale === 'de' ? 'KI findet den Match' : 'AI finds the match',
                body: locale === 'de' ? 'Aus persönlich geprüften, kuratierten Shows.' : 'From personally reviewed, curated shows.',
              },
              {
                step: '3',
                title: locale === 'de' ? 'Direkt Kontakt aufnehmen' : 'Contact directly',
                body: locale === 'de' ? 'Kein Mittelsmann, keine wochenlangen Wartezeiten.' : 'No middleman, no weeks of back-and-forth.',
              },
            ].map(({ step, title, body }) => (
              <div key={step} className="flex flex-col items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center font-black text-sm">{step}</div>
                <h4 className="font-bold text-base tracking-tight text-gray-900">{title}</h4>
                <p className="text-sm text-gray-500 leading-relaxed max-w-[220px]">{body}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Section 3: Default shows grid (shown only before search) ── */}
      {!hasResults && (
        <section className="py-16 border-t border-gray-100">
          <h3 className="text-lg font-bold mb-8">
            {locale === 'de' ? 'Shows auf Berlintina' : 'Shows on Berlintina'}
          </h3>
          {showsLoading ? (
            <p className="text-gray-400 text-sm font-medium">{locale === 'de' ? 'Lade Shows…' : 'Loading shows…'}</p>
          ) : (
            <div className="masonry-grid">
              {defaultShows.map((show) => (
                <div key={show.id} className="masonry-item">
                  <ShowCard show={show} locale={locale} onViewDetails={(s) => navigate(`/show/${s.slug}`)} />
                </div>
              ))}
            </div>
          )}
          {!showsLoading && defaultShows.length > 0 && (
            <div className="mt-10 text-center">
              <Link to="/catalog" className="inline-block px-8 py-3.5 rounded-2xl bg-[#f1f1ef] text-sm font-bold text-gray-700 hover:bg-gray-200 transition">
                {locale === 'de' ? 'Alle Shows entdecken →' : 'Discover all shows →'}
              </Link>
            </div>
          )}
        </section>
      )}

      {/* ── Section 4: Trust strip ── */}
      {!hasResults && (
        <section className="py-10 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-400 font-medium tracking-wide">
            {locale === 'de'
              ? '★ Jede Show persönlich geprüft · Berlin · Immer kostenlos'
              : '★ Every show personally reviewed · Berlin · Always free'}
          </p>
        </section>
      )}

    </div>
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

  if (!brief) return <div className="p-20 text-center font-medium text-gray-400">{locale === 'de' ? 'Lade Empfehlungen…' : 'Loading recommendations…'}</div>;

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
        <p className="text-gray-500 font-medium">
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
        'Für immer kostenlos — keine Provision, keine Gebühren',
        'Gefunden von Eventagenturen & Privatkunden',
        'KI schreibt deine Beschreibung aus deiner Website',
      ]
    : [
        'Free forever — no commission, no fees',
        'Found by event agencies & private customers',
        'AI writes your description from your website',
      ];
  return (
    <div className="max-w-2xl mx-auto px-4 py-20 text-center">
      {hasStoredToken && (
        <div className="mb-8 p-5 rounded-2xl bg-[#f1f1ef] border border-gray-200 text-center">
          <p className="text-sm font-bold text-gray-700 mb-3">
            {locale === 'de' ? 'Willkommen zurück! Du hast bereits Shows auf Berlintina.' : 'Welcome back! You already have shows on Berlintina.'}
          </p>
          <Link to="/artist" className="inline-block px-6 py-2.5 bg-black text-white rounded-xl font-bold text-sm hover:opacity-90 transition">
            {locale === 'de' ? 'Meine Shows ansehen →' : 'View my shows →'}
          </Link>
        </div>
      )}
      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-2xl p-10 md:p-12">
        <div className="w-16 h-16 rounded-2xl bg-black text-white flex items-center justify-center font-black text-2xl italic shadow-xl mx-auto mb-8">V</div>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-[#1d1d1f] mb-3">
          {locale === 'de' ? 'Zeig deine Show auf Berlintina' : 'Add your show to Berlintina'}
        </h1>
        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-10">
          {locale === 'de' ? 'Kostenlos · KI-unterstützt · 5 Minuten' : 'Free · AI-assisted · 5 minutes'}
        </p>
        <ul className="text-left space-y-4 mb-12">
          {benefits.map((benefit) => (
            <li key={benefit} className="flex items-start gap-3 text-sm font-medium text-gray-700">
              <span className="mt-0.5 w-5 h-5 rounded-full bg-black text-white flex items-center justify-center text-xs font-black flex-shrink-0">✓</span>
              {benefit}
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => navigate('/join/start')}
          className="w-full py-4 bg-black text-white rounded-2xl font-bold text-sm hover:opacity-90 transition shadow-xl mb-4"
        >
          {locale === 'de' ? 'Jetzt eintragen →' : 'Tell me about my show →'}
        </button>
        <p className="text-xs text-gray-400 font-medium">
          {locale === 'de' ? 'Bereits eingetragen? Dein Fortschritt wird gespeichert.' : 'Already listed? Your progress is saved.'}
        </p>
      </div>
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
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [honeypot, setHoneypot] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [resolvingToken, setResolvingToken] = useState(true);
  const [returnArtist, setReturnArtist] = useState<ResolveArtistResponse | null>(null);
  const [welcomeBackChoice, setWelcomeBackChoice] = useState<'use' | 'fresh' | null>(null);
  const [showMediaInput, setShowMediaInput] = useState(false);
  const [lastNextSlot, setLastNextSlot] = useState<string | null>(null);
  const [showOverview, setShowOverview] = useState(false);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(() => { scrollToBottom(); }, [messages]);

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
        setShowOverview(true);
      }
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Request failed');
      setMessages((m) => m.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  if (submissionId) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-2xl p-12 md:p-16">
          <div className="w-20 h-20 rounded-2xl bg-green-100 text-green-600 flex items-center justify-center text-4xl mx-auto mb-8">✓</div>
          <h2 className="text-3xl font-bold mb-4 tracking-tight">
            {locale === 'de' ? 'Vielen Dank!' : 'Thank you!'}
          </h2>
          <p className="text-gray-600 mb-2 font-medium">
            {locale === 'de'
              ? 'Wir haben deine Angaben erhalten und prüfen sie. Du hörst in Kürze von uns!'
              : 'We have received your submission and will review it. You will hear from us soon!'}
          </p>
          <p className="text-xs text-gray-400 font-mono mt-6">ID: {submissionId}</p>
          <Link to="/catalog" className="inline-block mt-10 px-10 py-4 bg-black text-white rounded-2xl font-bold text-sm hover:opacity-90 transition">
            {locale === 'de' ? 'Shows entdecken' : 'Discover shows'}
          </Link>
        </div>
      </div>
    );
  }

  if (showOverview) {
    return (
      <JoinOverview
        initialDraft={submissionDraft}
        honeypot={honeypot}
        locale={locale}
        onBack={() => setShowOverview(false)}
        initialPhotoFile={photoFile}
      />
    );
  }

  if (!resolvingToken && returnArtist?.isReturning && welcomeBackChoice === null) {
    const acc = returnArtist.artistAccount;
    const label = [acc?.instagramHandle ? `@${acc.instagramHandle}` : null, acc?.websiteUrl].filter(Boolean).join(' • ') || (locale === 'de' ? 'Du' : 'You');
    return (
      <div className="max-w-2xl mx-auto px-4 py-24">
        <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-2xl p-12 md:p-16">
          <h2 className="text-2xl font-bold mb-4 tracking-tight text-center">
            {locale === 'de' ? 'Willkommen zurück!' : 'Welcome back!'}
          </h2>
          <p className="text-gray-600 mb-8 text-center font-medium">
            {locale === 'de'
              ? 'Soll ich deine gespeicherten Artist-Daten verwenden?'
              : 'Should I use your saved artist details?'}
          </p>
          {label && <p className="text-sm text-gray-400 text-center mb-8">({label})</p>}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button type="button" onClick={() => setWelcomeBackChoice('use')} className="px-8 py-4 bg-black text-white rounded-2xl font-bold text-sm hover:opacity-90 transition">
              {locale === 'de' ? 'Ja, verwenden' : 'Yes, use them'}
            </button>
            <button type="button" onClick={() => { clearStoredArtistToken(); setWelcomeBackChoice('fresh'); }} className="px-8 py-4 bg-white border-2 border-gray-200 text-gray-700 rounded-2xl font-bold text-sm hover:border-black hover:text-black transition">
              {locale === 'de' ? 'Nein, neu starten' : 'No, start fresh'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-20 relative">
      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-2xl overflow-hidden flex flex-col h-[750px]">
        <div className="bg-[#f1f1ef] p-8 text-black border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-black text-white flex items-center justify-center font-black text-xl italic shadow-xl">V</div>
            <div>
              <h2 className="font-bold text-lg tracking-tight text-gray-800 leading-tight">{locale === 'de' ? 'Für Künstler' : 'For Artists'}</h2>
              <p className="text-[10px] text-gray-400 font-black uppercase tracking-[0.2em]">Valiantsina • Berlintina</p>
            </div>
          </div>
        </div>
        <div className="flex-grow overflow-y-auto p-8 space-y-8 bg-[#fdfdfb] flex flex-col">
          {(loading || resolvingToken) && messages.length === 0 && (
            <div className="flex-grow flex items-center justify-center text-gray-500 text-sm">
              {locale === 'de' ? 'Lade…' : 'Loading…'}
            </div>
          )}
          {apiError && (
            <div className="mb-4 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm font-medium">
              {apiError}
            </div>
          )}
          {submitError && (
            <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm font-medium">
              {submitError}
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'ai' ? 'justify-start' : 'justify-end'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
              <div className={`max-w-[85%] px-6 py-4 rounded-[1.5rem] text-[15px] font-medium leading-relaxed whitespace-pre-wrap ${m.role === 'ai' ? 'bg-[#f1f1ef] text-[#37352f] rounded-bl-none shadow-sm' : 'bg-black text-white rounded-br-none shadow-xl'}`}>
                {m.text}
              </div>
            </div>
          ))}
          {quickReplies.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {quickReplies.map((q, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    if (lastNextSlot === 'has_show') {
                      const value = (q === 'Ja, habe eine Show' || q === 'Yes, I have a show') ? 'HAS_SHOW' : (q === 'Nein, brainstormen' || q === 'No, brainstorm') ? 'NO_SHOW' : undefined;
                      sendMessage(q, value ? { action: 'BUTTON', value } : undefined);
                    } else {
                      sendMessage(q);
                    }
                  }}
                  disabled={loading}
                  className="px-4 py-2.5 rounded-xl bg-white border-2 border-gray-200 text-sm font-bold text-gray-700 hover:border-black hover:text-black transition disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
          )}
          {showMediaInput && (
            <div className="mt-4 flex justify-start">
              <label className="flex items-center gap-3 px-4 py-2 rounded-xl bg-white border border-gray-200 cursor-pointer text-xs font-bold text-gray-600 hover:bg-gray-50">
                <span>📸</span>
                <span>{photoFile ? (locale === 'de' ? '✓ Foto ausgewählt' : '✓ Photo selected') : (locale === 'de' ? 'Foto hochladen (optional)' : 'Upload photo (optional)')}</span>
                <input type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) setPhotoFile(f); }} />
              </label>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        <div className="p-8 border-t border-gray-100 flex gap-4 bg-white relative">
          <input type="text" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} className="hidden" aria-hidden="true" tabIndex={-1} />
          <input type="text" placeholder={locale === 'de' ? 'Nachricht schreiben...' : 'Type a message...'} className="flex-grow px-7 py-5 rounded-2xl bg-[#f1f1ef] text-base font-semibold focus:outline-none focus:ring-4 focus:ring-black/5 transition text-gray-800 disabled:opacity-50" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendMessage()} disabled={loading || submitting || !conversationId} />
          <button onClick={() => sendMessage()} disabled={(!input.trim()) || loading || submitting || !conversationId} className="w-16 h-16 bg-black text-white rounded-2xl hover:opacity-90 transition flex items-center justify-center shadow-2xl disabled:opacity-20">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M22 2L11 13" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/><path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>
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

  if (loading && shows.length === 0) {
    return (
      <div className="max-w-[1600px] mx-auto px-4 sm:px-8 py-16 sm:py-20 text-center text-gray-500 font-medium">
        {locale === 'de' ? 'Lade Shows…' : 'Loading shows…'}
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 md:px-8 py-12 sm:py-20">
      {error && (
        <div className="mb-8 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm font-medium">
          {error}
        </div>
      )}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 sm:gap-12 mb-12 sm:mb-20">
        <div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold mb-6 sm:mb-8 tracking-tight">
            {locale === 'de' ? 'Alle Shows' : 'All Shows'}
          </h1>
          <div className="flex flex-wrap gap-3">
            {(['ALL', ...Object.values(Category)] as const).map(cat => (
              <button key={cat} onClick={() => setFilter(cat)} className={`px-6 py-2.5 rounded-xl text-[11px] font-black tracking-widest uppercase transition-all shadow-sm ${filter === cat ? 'bg-black text-white' : 'bg-[#f1f1ef] text-gray-500 hover:text-black'}`}>{cat}</button>
            ))}
          </div>
        </div>
        <input
          type="text"
          placeholder={locale === 'de' ? 'Künstler oder Show suchen…' : 'Search artist or show…'}
          className="w-full md:w-96 px-6 py-4 rounded-xl bg-white border border-gray-200 focus:border-black focus:outline-none transition text-sm font-bold shadow-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {!loading && !error && shows.length === 0 ? (
        <div className="py-24 text-center">
          <p className="text-gray-500 font-medium text-lg mb-4">{locale === 'de' ? 'Keine Shows gefunden.' : 'No shows found.'}</p>
          <p className="text-gray-400 text-sm">{locale === 'de' ? 'Versuche andere Filter oder suche nach etwas anderem.' : 'Try different filters or search for something else.'}</p>
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
            <div className="py-8 text-center text-gray-400 text-sm font-medium">
              {locale === 'de' ? 'Lade…' : 'Loading…'}
            </div>
          )}
        </>
      )}
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
      <div className="max-w-4xl mx-auto px-4 py-20 text-center text-gray-400 font-medium">
        {locale === 'de' ? 'Lade Blog…' : 'Loading blog…'}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
      <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight mb-4">Blog</h1>
      <p className="text-gray-400 font-medium mb-16">
        {locale === 'de' ? 'Gedanken, Geschichten & Einblicke von Valiantsina.' : 'Thoughts, stories & insights from Valiantsina.'}
      </p>
      {posts.length === 0 ? (
        <p className="text-gray-400 text-center py-16">
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
                className="group cursor-pointer bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-lg transition-shadow"
              >
                {post.coverImageUrl && (
                  <img src={post.coverImageUrl} alt={title} className="w-full aspect-[16/9] object-cover group-hover:scale-[1.02] transition-transform duration-300" />
                )}
                <div className="p-6">
                  {date && <p className="text-xs text-gray-400 font-medium mb-2">{date}</p>}
                  <h2 className="text-lg font-bold tracking-tight text-gray-900 mb-2 group-hover:text-black transition-colors line-clamp-2">{title}</h2>
                  {excerpt && <p className="text-sm text-gray-500 leading-relaxed line-clamp-3">{excerpt}</p>}
                  <p className="mt-4 text-xs font-bold text-black group-hover:underline">
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
    return <div className="max-w-3xl mx-auto px-4 py-20 text-center text-gray-400 font-medium">{locale === 'de' ? 'Lade…' : 'Loading…'}</div>;
  }
  if (notFound || !post) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <p className="text-gray-400 font-medium mb-6">{locale === 'de' ? 'Artikel nicht gefunden.' : 'Article not found.'}</p>
        <Link to="/blog" className="text-sm font-bold text-black underline underline-offset-4">← {locale === 'de' ? 'Zurück zum Blog' : 'Back to Blog'}</Link>
      </div>
    );
  }

  const title = locale === 'de' ? post.titleDe : post.titleEn;
  const content = locale === 'de' ? post.contentDe : post.contentEn;
  const date = post.publishedAt ? new Date(post.publishedAt).toLocaleDateString(locale === 'de' ? 'de-DE' : 'en-GB', { year: 'numeric', month: 'long', day: 'numeric' }) : '';

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
      <Link to="/blog" className="text-xs font-bold text-gray-400 hover:text-black uppercase tracking-widest transition mb-10 inline-block">← Blog</Link>
      {post.coverImageUrl && (
        <img src={post.coverImageUrl} alt={title} className="w-full aspect-[16/9] object-cover rounded-2xl mb-10 shadow-sm" />
      )}
      {date && <p className="text-xs text-gray-400 font-medium mb-4">{date}</p>}
      <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-gray-900 mb-10">{title}</h1>
      <div className="prose prose-gray max-w-none">
        <p className="text-gray-700 leading-relaxed text-base sm:text-lg whitespace-pre-line">{content}</p>
      </div>
      <div className="mt-16 pt-8 border-t border-gray-100">
        <Link to="/blog" className="text-sm font-bold text-black underline underline-offset-4 hover:opacity-70 transition">← {locale === 'de' ? 'Alle Artikel' : 'All Articles'}</Link>
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
    return <div className="max-w-6xl mx-auto px-4 py-20 text-center text-gray-400 font-medium">{locale === 'de' ? 'Lade…' : 'Loading…'}</div>;
  }
  if (!data) return null;

  const artistLabel = data.artist.display_name || data.artist.instagram_handle || (locale === 'de' ? 'Dein Account' : 'Your Account');

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 md:px-8 py-12 sm:py-20">
      <div className="mb-12">
        <p className="text-xs font-black uppercase tracking-[0.15em] text-gray-400 mb-3">{locale === 'de' ? 'Künstler-Portal' : 'Artist Portal'}</p>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight mb-4">{artistLabel}</h1>
        <p className="text-gray-400 font-medium">
          {locale === 'de'
            ? `${data.shows.length} Show${data.shows.length !== 1 ? 's' : ''} auf Berlintina`
            : `${data.shows.length} show${data.shows.length !== 1 ? 's' : ''} on Berlintina`}
        </p>
      </div>
      {data.shows.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-gray-400 font-medium mb-6">{locale === 'de' ? 'Noch keine veröffentlichten Shows.' : 'No published shows yet.'}</p>
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
          className="px-10 py-4 bg-black text-white rounded-2xl font-bold text-sm hover:opacity-90 transition shadow-xl"
        >
          {locale === 'de' ? 'Weitere Show eintragen →' : 'Add another show →'}
        </button>
      </div>
    </div>
  );
};

// --- Admin Layout ---
const AdminLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen bg-[#fdfdfb]">
    <header className="bg-white border-b border-gray-100 py-4 px-8 flex items-center justify-between">
      <Link to="/" className="text-lg font-bold">Berlintina Admin</Link>
      <nav className="flex gap-4">
        <Link to="/admin/submissions" className="text-sm font-bold text-gray-500 hover:text-black">Submissions</Link>
        <Link to="/admin/shows" className="text-sm font-bold text-gray-500 hover:text-black">Shows</Link>
        <Link to="/admin/blog" className="text-sm font-bold text-gray-500 hover:text-black">Blog</Link>
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
    <HashRouter>
      <Routes>
        <Route path="/admin/*" element={
          <AdminLayout>
            <Suspense fallback={<div className="min-h-[40vh] flex items-center justify-center text-gray-500">Loading…</div>}>
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
        <Route path="*" element={
          <Layout locale={locale} setLocale={setLocale}>
            <Routes>
              <Route index element={<Landing locale={locale} />} />
              <Route path="/" element={<Landing locale={locale} />} />
              <Route path="/results/:briefId" element={<Results locale={locale} />} />
              <Route path="/show/:slugShortId" element={<Suspense fallback={<div className="max-w-6xl mx-auto px-4 py-32 text-center text-gray-500 font-medium">Lade Show…</div>}><ShowDetail locale={locale} /></Suspense>} />
              <Route path="/catalog" element={<Catalog locale={locale} />} />
              <Route path="/blog" element={<Blog locale={locale} />} />
              <Route path="/blog/:slug" element={<BlogPostPage locale={locale} />} />
              <Route path="/artist" element={<ArtistPortal locale={locale} />} />
              <Route path="/join" element={<JoinLanding locale={locale} />} />
              <Route path="/join/start" element={<Join locale={locale} />} />
              <Route path="/about" element={<About locale={locale} />} />
            </Routes>
          </Layout>
        } />
      </Routes>
    </HashRouter>
  );
};

export default App;
