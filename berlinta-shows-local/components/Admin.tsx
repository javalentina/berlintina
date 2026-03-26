import React, { useState, useEffect, createContext, useContext } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  adminLogin, adminLogout,
  adminGetSubmissions, adminGetSubmission,
  adminApprove, adminReject, adminDeleteSubmission,
  adminGetShows, adminGetShow, adminUpdateShow, adminDeleteShow,
  adminListBlogPosts, adminCreateBlogPost, adminUpdateBlogPost, adminDeleteBlogPost,
  type Submission, type AdminApproveOverrides,
  type AdminShowListItem, type AdminShowFull,
  type AdminBlogPostSummary, type AdminBlogPostFull, type AdminBlogPostPayload,
} from '../services/adminService';

// ─────────────────────────────────────────────────────────────────────────────
// Theme context
// ─────────────────────────────────────────────────────────────────────────────
interface ThemeCtxType { dark: boolean; toggleDark: () => void }
const ThemeCtx = createContext<ThemeCtxType>({ dark: false, toggleDark: () => {} });
const useTheme = () => useContext(ThemeCtx);

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const STATUS_LABELS: Record<string, string> = {
  PENDING_REVIEW: 'Pending', APPROVED: 'Approved', REJECTED: 'Rejected',
};

function statusBadge(status: string, dark: boolean) {
  if (status === 'PENDING_REVIEW') return dark ? 'bg-amber-900/40 text-amber-300' : 'bg-amber-100 text-amber-800';
  if (status === 'APPROVED')       return dark ? 'bg-green-900/40 text-green-300' : 'bg-green-100 text-green-800';
  if (status === 'REJECTED')       return dark ? 'bg-red-900/40 text-red-300'     : 'bg-red-100 text-red-700';
  return dark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600';
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Layout — provides ThemeCtx to all children
// ─────────────────────────────────────────────────────────────────────────────
const AdminLayout: React.FC<{ children: React.ReactNode; active?: string }> = ({ children, active }) => {
  const [dark, setDark] = useState(() => localStorage.getItem('b_admin_dark') === '1');
  const toggleDark = () => setDark(d => { const n = !d; localStorage.setItem('b_admin_dark', n ? '1' : '0'); return n; });
  const navigate = useNavigate();

  const nav = [
    { key: 'submissions', label: 'Submissions', icon: '📥', to: '/admin/submissions' },
    { key: 'shows',       label: 'Shows',       icon: '🎭', to: '/admin/shows' },
    { key: 'blog',        label: 'Blog',        icon: '✍️', to: '/admin/blog' },
  ];

  return (
    <ThemeCtx.Provider value={{ dark, toggleDark }}>
      <div className={`flex min-h-screen ${dark ? 'bg-gray-950' : 'bg-gray-50'}`}>
        {/* Sidebar */}
        <aside className="w-56 flex-shrink-0 bg-gray-900 text-white flex flex-col sticky top-0 h-screen">
          <div className="px-5 py-5 border-b border-white/10">
            <span className="font-bold text-sm tracking-tight">berlintina<span className="text-orange-400">.</span> admin</span>
          </div>
          <nav className="flex-1 px-3 py-4 space-y-1">
            {nav.map(n => (
              <button key={n.key} onClick={() => navigate(n.to)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                  active === n.key ? 'bg-white/15 text-white' : 'text-white/60 hover:bg-white/8 hover:text-white'
                }`}
              >
                <span>{n.icon}</span><span>{n.label}</span>
              </button>
            ))}
          </nav>
          <div className="px-3 py-4 border-t border-white/10 space-y-1">
            <a href="/" target="_blank" rel="noopener" className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-white/40 hover:text-white/70 transition-colors">
              ↗ View site
            </a>
            <button onClick={toggleDark} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-white/40 hover:text-white/70 transition-colors text-left">
              {dark ? '☀ Light mode' : '◐ Dark mode'}
            </button>
            <button
              onClick={() => { adminLogout(); window.location.href = '/admin'; }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-white/40 hover:text-red-400 transition-colors text-left"
            >
              ⎋ Logout
            </button>
          </div>
        </aside>
        <main className="flex-1 min-w-0 overflow-auto">{children}</main>
      </div>
    </ThemeCtx.Provider>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Shared UI primitives (all use useTheme — must render inside AdminLayout)
// ─────────────────────────────────────────────────────────────────────────────
const Section: React.FC<{ title: string; children: React.ReactNode; defaultOpen?: boolean }> = ({ title, children, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);
  const { dark } = useTheme();
  return (
    <div className={`border rounded-xl overflow-hidden mb-4 ${dark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
      <button type="button" onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between px-5 py-3.5 transition-colors text-left ${dark ? 'bg-gray-700/50 hover:bg-gray-700' : 'bg-gray-50 hover:bg-gray-100'}`}
      >
        <span className={`text-xs font-bold uppercase tracking-widest ${dark ? 'text-gray-400' : 'text-gray-500'}`}>{title}</span>
        <span className={`text-sm ${dark ? 'text-gray-500' : 'text-gray-400'}`}>{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="px-5 py-4 space-y-3">{children}</div>}
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => {
  const { dark } = useTheme();
  return (
    <div>
      <label className={`block text-xs font-semibold mb-1 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>{label}</label>
      {children}
    </div>
  );
};

// Static input class for editors that don't need dynamic dark (Show/Blog editors pass `inp` locally)
const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white';

function dynInput(dark: boolean) {
  return dark
    ? 'w-full px-3 py-2 border border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 bg-gray-700 text-white placeholder-gray-500'
    : inputCls;
}

// ─────────────────────────────────────────────────────────────────────────────
// Stat bar
// ─────────────────────────────────────────────────────────────────────────────
const StatBar: React.FC<{ pending: number | null; shows: number | null; posts: number | null }> = ({ pending, shows, posts }) => {
  const { dark } = useTheme();
  const card  = `flex-1 border rounded-xl px-4 py-3 ${dark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`;
  const label = `text-[10px] font-bold uppercase tracking-widest mb-0.5 ${dark ? 'text-gray-500' : 'text-gray-400'}`;
  return (
    <div className="flex gap-3 mb-6">
      <div className={card}>
        <p className={label}>Pending</p>
        <p className={`text-2xl font-bold ${pending ? 'text-amber-500' : dark ? 'text-gray-600' : 'text-gray-300'}`}>{pending ?? '…'}</p>
      </div>
      <div className={card}>
        <p className={label}>Published Shows</p>
        <p className={`text-2xl font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>{shows ?? '…'}</p>
      </div>
      <div className={card}>
        <p className={label}>Blog Posts</p>
        <p className={`text-2xl font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>{posts ?? '…'}</p>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Login
// ─────────────────────────────────────────────────────────────────────────────
export const AdminLogin: React.FC<{ onSuccess: () => void }> = ({ onSuccess }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null); setLoading(true);
    try { await adminLogin(password); onSuccess(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Login failed.'); }
    finally { setLoading(false); }
  };
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-8">
        <div className="mb-6">
          <span className="font-bold text-lg">berlintina<span className="text-orange-500">.</span></span>
          <p className="text-gray-500 text-sm mt-1">Admin access</p>
        </div>
        {error && <p className="mb-4 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        <input type="password" placeholder="Password" className={inputCls + ' mb-4'} value={password} onChange={e => setPassword(e.target.value)} autoFocus />
        <button type="submit" disabled={loading || !password} className="w-full py-3 bg-gray-900 text-white rounded-xl font-bold text-sm hover:bg-gray-800 transition disabled:opacity-50">
          {loading ? 'Logging in…' : 'Login'}
        </button>
      </form>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard — shell + inner (inner can use useTheme)
// ─────────────────────────────────────────────────────────────────────────────
export const AdminDashboard: React.FC = () => {
  const location = useLocation();
  const pathShows = location.pathname.includes('/shows') && !location.pathname.match(/\/shows\/[^/]+$/);
  const pathBlog  = location.pathname.includes('/blog');
  const defaultTab = (pathShows ? 'shows' : pathBlog ? 'blog' : 'submissions') as 'submissions' | 'shows' | 'blog';
  return (
    <AdminLayout active={defaultTab}>
      <DashboardInner defaultTab={defaultTab} />
    </AdminLayout>
  );
};

const DashboardInner: React.FC<{ defaultTab: 'submissions' | 'shows' | 'blog' }> = ({ defaultTab }) => {
  const { dark } = useTheme();
  const navigate = useNavigate();
  const [tab, setTab] = useState(defaultTab);
  useEffect(() => { setTab(defaultTab); }, [defaultTab]);

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [shows, setShows] = useState<AdminShowListItem[]>([]);
  const [posts, setPosts] = useState<AdminBlogPostSummary[]>([]);
  const [filter, setFilter] = useState('PENDING_REVIEW');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [stats, setStats] = useState<{ pending: number | null; shows: number | null; posts: number | null }>({ pending: null, shows: null, posts: null });

  // Load stats once
  useEffect(() => {
    Promise.all([adminGetSubmissions('PENDING_REVIEW'), adminGetShows(), adminListBlogPosts()])
      .then(([{ submissions: s }, { shows: sh }, { posts: p }]) =>
        setStats({ pending: s.length, shows: sh.length, posts: (p || []).length }))
      .catch(() => {});
  }, []);

  const load = () => {
    setLoading(true); setError(null);
    if (tab === 'submissions') {
      adminGetSubmissions(filter || undefined)
        .then(({ submissions: d }) => setSubmissions(d))
        .catch(e => setError(e.message))
        .finally(() => setLoading(false));
    } else if (tab === 'shows') {
      adminGetShows()
        .then(({ shows: d }) => setShows(d))
        .catch(e => setError(e.message))
        .finally(() => setLoading(false));
    } else {
      adminListBlogPosts()
        .then(({ posts: p }) => setPosts(p || []))
        .catch(e => setError(e.message))
        .finally(() => setLoading(false));
    }
  };
  useEffect(() => { load(); }, [tab, filter]);

  const filteredSubs = search.trim()
    ? submissions.filter(s =>
        [s.show_title, s.submitter_email, (s as Record<string, unknown>).artist_name as string]
          .some(v => v?.toLowerCase().includes(search.toLowerCase()))
      )
    : submissions;

  const quickApprove = async (e: React.MouseEvent, s: Submission) => {
    e.stopPropagation();
    if (!window.confirm(`Approve & publish "${s.show_title}"?`)) return;
    setActingId(s.id);
    try {
      await adminApprove(s.id, {} as AdminApproveOverrides);
      setSubmissions(prev => prev.filter(x => x.id !== s.id));
      setStats(st => ({ ...st, pending: Math.max(0, (st.pending ?? 1) - 1), shows: (st.shows ?? 0) + 1 }));
    } catch (err) { setError((err as Error).message || 'Approve failed'); }
    finally { setActingId(null); }
  };

  const quickReject = async (e: React.MouseEvent, s: Submission) => {
    e.stopPropagation();
    if (!window.confirm(`Reject "${s.show_title}"?`)) return;
    setActingId(s.id);
    try {
      await adminReject(s.id, '');
      setSubmissions(prev => prev.filter(x => x.id !== s.id));
      setStats(st => ({ ...st, pending: Math.max(0, (st.pending ?? 1) - 1) }));
    } catch (err) { setError((err as Error).message || 'Reject failed'); }
    finally { setActingId(null); }
  };

  const txt   = dark ? 'text-white'   : 'text-gray-900';
  const muted = dark ? 'text-gray-500' : 'text-gray-400';
  const bdr   = dark ? 'border-gray-700' : 'border-gray-200';

  return (
    <div className="px-8 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className={`text-xl font-bold ${txt}`}>Dashboard</h1>
        <div className="flex gap-2">
          {tab === 'blog' && (
            <button onClick={() => navigate('/admin/blog/new')} className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-bold hover:bg-gray-800 transition">
              + New Post
            </button>
          )}
          <button onClick={load} className={`px-3 py-1.5 border rounded-lg text-xs font-bold transition ${dark ? 'border-gray-700 text-gray-400 hover:bg-gray-800' : 'border-gray-200 text-gray-500 hover:bg-gray-100'}`}>
            ↻ Refresh
          </button>
        </div>
      </div>

      <StatBar pending={stats.pending} shows={stats.shows} posts={stats.posts} />

      {/* Tabs */}
      <div className={`flex gap-1 mb-5 border-b ${bdr}`}>
        {(['submissions','shows','blog'] as const).map((key) => {
          const icons: Record<string,string> = { submissions:'📥', shows:'🎭', blog:'✍️' };
          const labels: Record<string,string> = { submissions:'Submissions', shows:'Shows', blog:'Blog' };
          return (
            <button key={key} onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-lg border-b-2 transition-colors ${
                tab === key ? `border-gray-900 ${txt}` : `border-transparent ${muted} hover:text-gray-600`
              }`}
            >
              <span>{icons[key]}</span> {labels[key]}
            </button>
          );
        })}
      </div>

      {/* Submission filters + search */}
      {tab === 'submissions' && (
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <div className="flex flex-wrap gap-2">
            {[{ key:'PENDING_REVIEW', label:'Pending' }, { key:'', label:'All' }, { key:'APPROVED', label:'Approved' }, { key:'REJECTED', label:'Rejected' }].map(({ key, label }) => (
              <button key={key || 'all'} onClick={() => setFilter(key)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition ${
                  filter === key ? 'bg-gray-900 text-white' : `border ${dark ? 'border-gray-700 text-gray-400 hover:border-gray-500' : 'border-gray-200 text-gray-500 hover:border-gray-400'}`
                }`}
              >{label}</button>
            ))}
          </div>
          <input
            type="search" placeholder="Search by name or email…" value={search}
            onChange={e => setSearch(e.target.value)}
            className={`flex-1 min-w-[200px] max-w-xs px-3 py-1.5 text-sm border rounded-full focus:outline-none focus:ring-2 focus:ring-gray-900 ${
              dark ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' : 'bg-white border-gray-200 placeholder-gray-400'
            }`}
          />
        </div>
      )}

      {error && <p className="mb-4 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

      {loading ? (
        <div className={`py-20 text-center text-sm ${muted}`}>Loading…</div>

      ) : tab === 'submissions' ? (
        filteredSubs.length === 0
          ? <div className={`py-20 text-center text-sm ${muted}`}>{search ? 'No results.' : 'No submissions for this filter.'}</div>
          : <div className="space-y-2">
              {filteredSubs.map(s => {
                const photos = Array.isArray((s as Record<string,unknown>).photo_urls) ? (s as Record<string,unknown>).photo_urls as string[] : [];
                const isPending = s.status === 'PENDING_REVIEW';
                const isActing = actingId === s.id;
                return (
                  <div key={s.id} onClick={() => navigate(`/admin/submissions/${s.id}`)}
                    className={`flex items-center gap-4 p-3 border rounded-xl cursor-pointer transition hover:shadow-sm ${dark ? 'bg-gray-800 border-gray-700 hover:border-gray-500' : 'bg-white border-gray-200 hover:border-gray-400'}`}
                  >
                    {photos[0]
                      ? <img src={photos[0]} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                      : <div className={`w-14 h-14 rounded-lg flex-shrink-0 flex items-center justify-center text-2xl ${dark ? 'bg-gray-700' : 'bg-gray-100'}`}>🎭</div>
                    }
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`font-semibold text-sm truncate ${txt}`}>{s.show_title || '—'}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide flex-shrink-0 ${statusBadge(s.status, dark)}`}>
                          {STATUS_LABELS[s.status] || s.status}
                        </span>
                      </div>
                      <p className={`text-xs truncate ${muted}`}>{s.submitter_email}{s.artist_genre ? ` · ${s.artist_genre}` : ''}</p>
                    </div>
                    <span className={`text-xs flex-shrink-0 ${muted}`}>{fmtDate((s as Record<string,unknown>).created_at as string)}</span>
                    <div className="flex gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                      {isPending && <>
                        <button onClick={e => quickApprove(e, s)} disabled={isActing} title="Approve & publish"
                          className="w-8 h-8 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 text-sm font-bold transition disabled:opacity-40 flex items-center justify-center">✓</button>
                        <button onClick={e => quickReject(e, s)} disabled={isActing} title="Reject"
                          className="w-8 h-8 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 text-sm font-bold transition disabled:opacity-40 flex items-center justify-center">✕</button>
                      </>}
                      {!isPending && (
                        <button
                          onClick={async e => {
                            e.stopPropagation();
                            if (!window.confirm(`Delete submission "${s.show_title}"? This cannot be undone.`)) return;
                            setActingId(s.id);
                            try {
                              await adminDeleteSubmission(s.id);
                              setSubmissions(prev => prev.filter(x => x.id !== s.id));
                            } catch (err) { setError((err as Error).message || 'Delete failed'); }
                            finally { setActingId(null); }
                          }}
                          disabled={isActing}
                          title="Delete submission"
                          className="w-8 h-8 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 text-sm font-bold transition disabled:opacity-40 flex items-center justify-center"
                        >🗑</button>
                      )}
                    </div>
                    <span className={`text-sm flex-shrink-0 ${muted}`}>›</span>
                  </div>
                );
              })}
            </div>

      ) : tab === 'shows' ? (
        shows.length === 0
          ? <div className={`py-20 text-center text-sm ${muted}`}>No published shows.</div>
          : <div className="space-y-2">
              {shows.map(s => {
                const photos = Array.isArray((s as Record<string,unknown>).photo_urls) ? (s as Record<string,unknown>).photo_urls as string[] : [];
                const slug = (s as Record<string,unknown>).slug as string | undefined;
                return (
                  <div key={s.id} className={`flex items-center gap-4 p-3 border rounded-xl transition ${dark ? 'bg-gray-800 border-gray-700 hover:border-gray-500' : 'bg-white border-gray-200 hover:border-gray-300'}`}>
                    {photos[0]
                      ? <img src={photos[0]} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                      : <div className={`w-14 h-14 rounded-lg flex-shrink-0 flex items-center justify-center text-2xl ${dark ? 'bg-gray-700' : 'bg-gray-100'}`}>🎭</div>
                    }
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/admin/shows/${s.id}`)}>
                      <p className={`font-semibold text-sm truncate ${txt}`}>{s.title}</p>
                      <p className={`text-xs ${muted}`}>{(s as Record<string,unknown>).artist_name as string || ''}</p>
                    </div>
                    {slug && (
                      <a href={`/show/${slug}`} target="_blank" rel="noopener" onClick={e => e.stopPropagation()}
                        className={`flex-shrink-0 px-3 py-1.5 text-xs font-bold border rounded-lg transition ${dark ? 'border-gray-600 text-gray-400 hover:text-white hover:border-gray-400' : 'border-gray-200 text-gray-400 hover:text-gray-700 hover:border-gray-400'}`}>
                        ↗ View
                      </a>
                    )}
                    <button
                      onClick={async e => {
                        e.stopPropagation();
                        if (!window.confirm(`Delete "${s.title}"? Cannot be undone.`)) return;
                        try { await adminDeleteShow(s.id); setShows(prev => prev.filter(x => x.id !== s.id)); setStats(st => ({ ...st, shows: Math.max(0, (st.shows ?? 1) - 1) })); }
                        catch (err) { setError((err as Error).message || 'Delete failed'); }
                      }}
                      className="flex-shrink-0 px-3 py-1.5 text-xs font-bold text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition"
                    >Delete</button>
                  </div>
                );
              })}
            </div>

      ) : (
        posts.length === 0
          ? <div className={`py-20 text-center text-sm ${muted}`}>No blog posts yet.</div>
          : <div className="space-y-2">
              {posts.map(p => (
                <div key={p.id} onClick={() => navigate(`/admin/blog/${p.id}`)}
                  className={`flex items-center gap-4 p-4 border rounded-xl cursor-pointer transition hover:shadow-sm ${dark ? 'bg-gray-800 border-gray-700 hover:border-gray-500' : 'bg-white border-gray-200 hover:border-gray-400'}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`font-semibold text-sm truncate ${txt}`}>{p.title_de || '—'}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide flex-shrink-0 ${p.published_at ? (dark ? 'bg-green-900/40 text-green-300' : 'bg-green-100 text-green-700') : (dark ? 'bg-yellow-900/40 text-yellow-300' : 'bg-yellow-100 text-yellow-700')}`}>
                        {p.published_at ? 'Published' : 'Draft'}
                      </span>
                    </div>
                    <p className={`text-xs ${muted}`}>{p.published_at ? new Date(p.published_at).toLocaleDateString('de-DE') : 'Not published'}</p>
                  </div>
                  <span className={`text-sm ${muted}`}>›</span>
                </div>
              ))}
            </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Submission Detail
// ─────────────────────────────────────────────────────────────────────────────
export const AdminSubmissionDetail: React.FC = () => (
  <AdminLayout active="submissions"><SubmissionDetailInner /></AdminLayout>
);

const SubmissionDetailInner: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { dark } = useTheme();

  const [sub, setSub] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [notes, setNotes] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editPitch, setEditPitch] = useState('');

  useEffect(() => {
    if (!id) return;
    adminGetSubmission(id)
      .then(s => { setSub(s); setEditTitle(s.show_title || ''); setEditDesc(s.short_description_facts || ''); setEditPitch(s.sales_pitch_text || ''); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const doAction = async (fn: () => Promise<unknown>) => {
    setActionLoading(true); setError(null);
    try { await fn(); navigate('/admin/submissions'); }
    catch (e) { setError((e as Error).message || 'Action failed'); }
    finally { setActionLoading(false); }
  };

  const approve = () => {
    if (!sub) return Promise.resolve();
    const overrides: AdminApproveOverrides = {
      title: editTitle.trim() || undefined,
      short_description_facts: editDesc.trim() || undefined,
      sales_pitch_text: editPitch.trim() || undefined,
    };
    return adminApprove(sub.id, overrides);
  };

  const inp  = dynInput(dark);
  const ta   = `${inp} resize-y`;
  const txt  = dark ? 'text-white' : 'text-gray-900';
  const sub_ = dark ? 'text-gray-300' : 'text-gray-600';
  const muted = dark ? 'text-gray-500' : 'text-gray-400';
  const card  = `border rounded-xl p-5 ${dark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`;

  if (loading || !sub) return (
    <div className="px-8 py-6"><p className={`text-sm ${muted}`}>{loading ? 'Loading…' : 'Not found.'}</p></div>
  );

  const isPending = sub.status === 'PENDING_REVIEW';
  const photos: string[] = Array.isArray(sub.photo_urls) ? sub.photo_urls as string[] : [];
  const email = sub.submitter_email;

  return (
    <div className="px-8 py-6 max-w-5xl">
      <button onClick={() => navigate('/admin/submissions')}
        className={`text-sm font-semibold mb-5 inline-flex items-center gap-1 transition ${dark ? 'text-gray-500 hover:text-white' : 'text-gray-400 hover:text-gray-900'}`}
      >← Back to submissions</button>

      {error && <p className="mb-4 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

      <div className={`grid gap-6 ${isPending ? 'lg:grid-cols-[1fr_1.1fr]' : ''}`}>

        {/* Left — artist info */}
        <div className="space-y-4">
          <div className={card}>
            <div className="flex items-start justify-between gap-3 mb-4">
              <h2 className={`text-xl font-bold leading-tight ${txt}`}>{sub.show_title}</h2>
              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide flex-shrink-0 ${statusBadge(sub.status, dark)}`}>
                {STATUS_LABELS[sub.status] || sub.status}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {[
                ['Email',     email],
                ['Genre',     sub.artist_genre],
                ['Artist',    (sub as Record<string,unknown>).artist_name as string],
                ['Submitted', fmtDate((sub as Record<string,unknown>).created_at as string)],
              ].map(([label, val]) => (
                <div key={label}>
                  <p className={`text-[10px] font-bold uppercase tracking-widest mb-0.5 ${muted}`}>{label}</p>
                  <p className={`text-sm ${sub_}`}>{val || '—'}</p>
                </div>
              ))}
            </div>
            {email && (
              <a
                href={`mailto:${email}?subject=Re: Ihre Berlintina Einreichung – ${encodeURIComponent(sub.show_title || '')}`}
                className={`inline-flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-semibold transition ${dark ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
              >✉ Email artist</a>
            )}
          </div>

          <div className={card}>
            <p className={`text-xs font-bold uppercase tracking-widest mb-2 ${muted}`}>Description</p>
            <p className={`text-sm leading-relaxed ${sub_}`}>{sub.short_description_facts || '—'}</p>
            {sub.sales_pitch_text && (
              <>
                <p className={`text-xs font-bold uppercase tracking-widest mt-4 mb-2 ${muted}`}>Sales Pitch</p>
                <p className={`text-sm leading-relaxed ${sub_}`}>{sub.sales_pitch_text}</p>
              </>
            )}
          </div>

          {photos.length > 0 && (
            <div className={card}>
              <p className={`text-xs font-bold uppercase tracking-widest mb-3 ${muted}`}>Photos</p>
              <div className="grid grid-cols-3 gap-2">
                {photos.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener">
                    <img src={url} alt="" className="w-full aspect-square object-cover rounded-lg hover:opacity-90 transition" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right — edit + actions (pending only) */}
        {isPending && (
          <div className="space-y-4">
            <div className={card}>
              <p className={`text-xs font-bold uppercase tracking-widest mb-4 ${muted}`}>Edit before approving</p>
              <div className="space-y-3">
                <div>
                  <label className={`block text-xs font-semibold mb-1 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Title</label>
                  <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)} className={inp} />
                </div>
                <div>
                  <label className={`block text-xs font-semibold mb-1 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Description</label>
                  <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={4} className={ta} />
                </div>
                <div>
                  <label className={`block text-xs font-semibold mb-1 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Sales pitch</label>
                  <textarea value={editPitch} onChange={e => setEditPitch(e.target.value)} rows={2} className={ta} />
                </div>
                <div>
                  <label className={`block text-xs font-semibold mb-1 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Notes (optional)</label>
                  <input type="text" value={notes} onChange={e => setNotes(e.target.value)} className={inp} placeholder="For reject or request changes…" />
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <button onClick={() => doAction(approve)} disabled={actionLoading}
                className="w-full py-3 bg-green-600 text-white rounded-xl font-bold text-sm hover:bg-green-700 disabled:opacity-50 transition">
                ✓ Approve & Publish
              </button>
              <button onClick={() => doAction(() => adminReject(sub.id, notes))} disabled={actionLoading}
                className="w-full py-3 bg-red-600 text-white rounded-xl font-bold text-sm hover:bg-red-700 disabled:opacity-50 transition">
                ✕ Reject
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Show Edit
// ─────────────────────────────────────────────────────────────────────────────
export const AdminShowEdit: React.FC = () => (
  <AdminLayout active="shows"><ShowEditInner /></AdminLayout>
);

const ShowEditInner: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { dark } = useTheme();

  const [show, setShow] = useState<AdminShowFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [title, setTitle] = useState('');
  const [artistName, setArtistName] = useState('');
  const [desc, setDesc] = useState('');
  const [pitch, setPitch] = useState('');
  const [duration, setDuration] = useState('');
  const [price, setPrice] = useState('');
  const [cast, setCast] = useState('');
  const [idealFor, setIdealFor] = useState('');
  const [placement, setPlacement] = useState('');
  const [audienceRange, setAudienceRange] = useState('');
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [videoUrls, setVideoUrls] = useState<string[]>([]);
  const [newPhoto, setNewPhoto] = useState('');
  const [newVideo, setNewVideo] = useState('');
  const [stageMin, setStageMin] = useState('');
  const [stageIdeal, setStageIdeal] = useState('');
  const [ceilingMin, setCeilingMin] = useState('');
  const [soundShort, setSoundShort] = useState('');
  const [lightShort, setLightShort] = useState('');
  const [timingsShort, setTimingsShort] = useState('');
  const [riderPdfUrl, setRiderPdfUrl] = useState('');
  const [faqOutdoor, setFaqOutdoor] = useState('');
  const [faqStage, setFaqStage] = useState('');
  const [faqLanguage, setFaqLanguage] = useState('');
  const [faqCustom, setFaqCustom] = useState('');
  const [faqTravel, setFaqTravel] = useState('');
  const [testimonials, setTestimonials] = useState<{ quote: string; name: string }[]>([]);

  useEffect(() => {
    if (!id) return;
    adminGetShow(id).then(s => {
      setShow(s); setTitle(s.title || ''); setArtistName(s.artist_name || '');
      setDesc(s.short_description_facts || ''); setPitch(s.sales_pitch_text || '');
      setDuration(s.duration_minutes != null ? String(s.duration_minutes) : '');
      setPrice(s.price_min != null && s.price_max != null ? `${s.price_min}–${s.price_max}` : s.price_min != null ? `ab ${s.price_min}` : '');
      setPhotoUrls(Array.isArray(s.photo_urls) ? [...s.photo_urls] : []);
      setVideoUrls(Array.isArray(s.video_urls) ? [...s.video_urls] : []);
      setCast(s.cast || ''); setIdealFor(s.ideal_for || ''); setPlacement(s.placement || '');
      setAudienceRange(s.audience_range || ''); setStageMin(s.stage_min || '');
      setStageIdeal(s.stage_ideal || ''); setCeilingMin(s.ceiling_min || '');
      setSoundShort(s.sound_short || ''); setLightShort(s.light_short || '');
      setTimingsShort(s.timings_short || ''); setRiderPdfUrl(s.rider_pdf_url || '');
      setFaqOutdoor(s.faq_outdoor || ''); setFaqStage(s.faq_stage || '');
      setFaqLanguage(s.faq_language || ''); setFaqCustom(s.faq_custom || '');
      setFaqTravel(s.faq_travel || '');
      setTestimonials(Array.isArray(s.testimonials) && s.testimonials.length ? [...s.testimonials] : []);
    }).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [id]);

  const addPhoto = () => { if (newPhoto.trim()) { setPhotoUrls(u => [...u, newPhoto.trim()]); setNewPhoto(''); } };
  const addVideo = () => { if (newVideo.trim()) { setVideoUrls(u => [...u, newVideo.trim()]); setNewVideo(''); } };
  const removePhoto = (i: number) => setPhotoUrls(u => u.filter((_, j) => j !== i));
  const removeVideo = (i: number) => setVideoUrls(u => u.filter((_, j) => j !== i));
  const movePhoto = (i: number, dir: -1 | 1) => {
    setPhotoUrls(u => { const a = [...u]; const j = i + dir; if (j < 0 || j >= a.length) return a; [a[i], a[j]] = [a[j], a[i]]; return a; });
  };
  const addTestimonial = () => setTestimonials(t => [...t, { quote: '', name: '' }]);
  const removeTestimonial = (i: number) => setTestimonials(t => t.filter((_, j) => j !== i));
  const updateTestimonial = (i: number, field: 'quote' | 'name', value: string) =>
    setTestimonials(t => t.map((x, j) => j === i ? { ...x, [field]: value } : x));

  const inp   = dynInput(dark);
  const ta    = `${inp} resize-y`;
  const txt   = dark ? 'text-white'   : 'text-gray-900';
  const muted = dark ? 'text-gray-500' : 'text-gray-400';

  const handleSave = async () => {
    if (!id) return;
    setSaving(true); setError(null);
    try {
      await adminUpdateShow(id, {
        title: title.trim() || undefined, artist_name: artistName.trim() || undefined,
        short_description_facts: desc || undefined, sales_pitch_text: pitch || undefined,
        duration_minutes: duration.trim() ? parseInt(duration, 10) : undefined,
        price_text: price.trim() || undefined,
        photo_urls: photoUrls.length ? photoUrls : undefined,
        video_urls: videoUrls.length ? videoUrls : undefined,
        cast: cast.trim() || undefined, ideal_for: idealFor.trim() || undefined,
        placement: placement.trim() || undefined, audience_range: audienceRange.trim() || undefined,
        stage_min: stageMin.trim() || undefined, stage_ideal: stageIdeal.trim() || undefined,
        ceiling_min: ceilingMin.trim() || undefined, sound_short: soundShort.trim() || undefined,
        light_short: lightShort.trim() || undefined, timings_short: timingsShort.trim() || undefined,
        rider_pdf_url: riderPdfUrl.trim() || undefined,
        testimonials: testimonials.filter(t => t.quote.trim() || t.name.trim()).length ? testimonials : undefined,
        faq_outdoor: faqOutdoor.trim() || undefined, faq_stage: faqStage.trim() || undefined,
        faq_language: faqLanguage.trim() || undefined, faq_custom: faqCustom.trim() || undefined,
        faq_travel: faqTravel.trim() || undefined,
        notify_artist: false,
      });
      setSaved(true); setTimeout(() => setSaved(false), 3000);
    } catch (e) { setError((e as Error).message || 'Save failed'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!id || !window.confirm('Delete this show? Cannot be undone.')) return;
    setSaving(true);
    try { await adminDeleteShow(id); navigate('/admin/shows'); }
    catch (e) { setError((e as Error).message || 'Delete failed'); setSaving(false); }
  };

  if (loading || !show) return (
    <div className="px-8 py-6"><p className={`text-sm ${muted}`}>{loading ? 'Loading…' : 'Not found.'}</p></div>
  );

  return (
    <div className="px-8 py-6 max-w-3xl">
      <div className="flex items-center justify-between mb-5">
        <div>
          <button onClick={() => navigate('/admin/shows')} className={`text-sm font-semibold inline-flex items-center gap-1 transition mb-1 ${dark ? 'text-gray-500 hover:text-white' : 'text-gray-400 hover:text-gray-900'}`}>← Shows</button>
          <h1 className={`text-xl font-bold ${txt}`}>{show.title}</h1>
        </div>
        <div className="flex gap-2">
          {show.slug && (
            <a href={`/show/${show.slug}`} target="_blank" rel="noopener" className={`px-3 py-2 border rounded-lg text-xs font-bold transition ${dark ? 'border-gray-700 text-gray-400 hover:text-white' : 'border-gray-200 text-gray-500 hover:bg-gray-100'}`}>
              ↗ View
            </a>
          )}
          <button onClick={handleSave} disabled={saving} className={`px-5 py-2 rounded-lg text-sm font-bold transition disabled:opacity-50 ${saved ? 'bg-green-600 text-white' : 'bg-gray-900 text-white hover:bg-gray-800'}`}>
            {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save'}
          </button>
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

      <Section title="Basic Info">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Title"><input type="text" value={title} onChange={e => setTitle(e.target.value)} className={inp} /></Field>
          <Field label="Artist name"><input type="text" value={artistName} onChange={e => setArtistName(e.target.value)} className={inp} /></Field>
          <Field label="Duration (min)"><input type="text" value={duration} onChange={e => setDuration(e.target.value)} className={inp} placeholder="45" /></Field>
          <Field label="Price"><input type="text" value={price} onChange={e => setPrice(e.target.value)} className={inp} placeholder="800–1200 or ab 800" /></Field>
          <Field label="Cast"><input type="text" value={cast} onChange={e => setCast(e.target.value)} className={inp} placeholder="2 performers" /></Field>
          <Field label="Audience range"><input type="text" value={audienceRange} onChange={e => setAudienceRange(e.target.value)} className={inp} placeholder="50–2,000+" /></Field>
          <Field label="Ideal for"><input type="text" value={idealFor} onChange={e => setIdealFor(e.target.value)} className={inp} placeholder="corporate, galas…" /></Field>
          <Field label="Placement"><input type="text" value={placement} onChange={e => setPlacement(e.target.value)} className={inp} placeholder="Opener / Finale" /></Field>
        </div>
        <Field label="Description / facts"><textarea value={desc} onChange={e => setDesc(e.target.value)} rows={3} className={ta} /></Field>
        <Field label="Sales pitch"><textarea value={pitch} onChange={e => setPitch(e.target.value)} rows={2} className={ta} /></Field>
      </Section>

      <Section title="Photos & Videos">
        <div>
          <p className={`text-xs font-semibold mb-2 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Photos <span className={`font-normal ${muted}`}>(first = cover)</span></p>
          {photoUrls.map((url, i) => (
            <div key={i} className={`flex items-center gap-2 mb-2 rounded-lg p-2 ${dark ? 'bg-gray-700' : 'bg-gray-50'}`}>
              <img src={url} alt="" className="w-12 h-12 object-cover rounded-lg flex-shrink-0" />
              <span className={`flex-1 truncate text-xs ${muted}`}>{url}</span>
              <button type="button" onClick={() => movePhoto(i, -1)} disabled={i === 0} className={`text-sm px-1 disabled:opacity-20 ${dark ? 'text-gray-400 hover:text-white' : 'text-gray-400 hover:text-gray-700'}`}>↑</button>
              <button type="button" onClick={() => movePhoto(i, 1)} disabled={i === photoUrls.length - 1} className={`text-sm px-1 disabled:opacity-20 ${dark ? 'text-gray-400 hover:text-white' : 'text-gray-400 hover:text-gray-700'}`}>↓</button>
              <button type="button" onClick={() => removePhoto(i)} className="text-red-400 hover:text-red-600 text-sm px-1">✕</button>
            </div>
          ))}
          <div className="flex gap-2 mt-1">
            <input type="url" value={newPhoto} onChange={e => setNewPhoto(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addPhoto())} className={inp} placeholder="https://…" />
            <button type="button" onClick={addPhoto} className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-bold whitespace-nowrap">Add</button>
          </div>
        </div>
        <div>
          <p className={`text-xs font-semibold mb-2 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Videos</p>
          {videoUrls.map((url, i) => (
            <div key={i} className={`flex items-center gap-2 mb-2 rounded-lg p-2 ${dark ? 'bg-gray-700' : 'bg-gray-50'}`}>
              <span className={`flex-1 truncate text-xs ${muted}`}>{url}</span>
              <button type="button" onClick={() => removeVideo(i)} className="text-red-400 hover:text-red-600 text-sm px-1">✕</button>
            </div>
          ))}
          <div className="flex gap-2 mt-1">
            <input type="url" value={newVideo} onChange={e => setNewVideo(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addVideo())} className={inp} placeholder="https://youtube.com/…" />
            <button type="button" onClick={addVideo} className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-bold whitespace-nowrap">Add</button>
          </div>
        </div>
      </Section>

      <Section title="FAQ">
        <Field label="Outdoor möglich?"><input type="text" value={faqOutdoor} onChange={e => setFaqOutdoor(e.target.value)} className={inp} /></Field>
        <Field label="Bühnengröße?"><input type="text" value={faqStage} onChange={e => setFaqStage(e.target.value)} className={inp} /></Field>
        <Field label="Sprachabhängig?"><input type="text" value={faqLanguage} onChange={e => setFaqLanguage(e.target.value)} className={inp} /></Field>
        <Field label="Anpassbar / Branding?"><input type="text" value={faqCustom} onChange={e => setFaqCustom(e.target.value)} className={inp} /></Field>
        <Field label="Anreise?"><input type="text" value={faqTravel} onChange={e => setFaqTravel(e.target.value)} className={inp} /></Field>
      </Section>

      <Section title="Technical Rider" defaultOpen={false}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Stage min"><input type="text" value={stageMin} onChange={e => setStageMin(e.target.value)} className={inp} placeholder="6×4 m" /></Field>
          <Field label="Stage ideal"><input type="text" value={stageIdeal} onChange={e => setStageIdeal(e.target.value)} className={inp} placeholder="8×6 m" /></Field>
          <Field label="Ceiling min"><input type="text" value={ceilingMin} onChange={e => setCeilingMin(e.target.value)} className={inp} placeholder="3.5 m+" /></Field>
          <Field label="Timings"><input type="text" value={timingsShort} onChange={e => setTimingsShort(e.target.value)} className={inp} placeholder="Load-in 30 min…" /></Field>
          <Field label="Sound"><input type="text" value={soundShort} onChange={e => setSoundShort(e.target.value)} className={inp} /></Field>
          <Field label="Light"><input type="text" value={lightShort} onChange={e => setLightShort(e.target.value)} className={inp} /></Field>
        </div>
        <Field label="Rider PDF URL"><input type="url" value={riderPdfUrl} onChange={e => setRiderPdfUrl(e.target.value)} className={inp} placeholder="https://…" /></Field>
      </Section>

      <Section title="Testimonials" defaultOpen={false}>
        {testimonials.map((t, i) => (
          <div key={i} className={`rounded-lg p-3 mb-2 space-y-2 ${dark ? 'bg-gray-700' : 'bg-gray-50'}`}>
            <textarea value={t.quote} onChange={e => updateTestimonial(i, 'quote', e.target.value)} rows={2} className={ta} placeholder="Quote…" />
            <div className="flex gap-2">
              <input type="text" value={t.name} onChange={e => updateTestimonial(i, 'name', e.target.value)} className={`${inp} flex-1`} placeholder="— Name, Title" />
              <button type="button" onClick={() => removeTestimonial(i)} className="text-red-400 hover:text-red-600 text-sm px-2">✕</button>
            </div>
          </div>
        ))}
        <button type="button" onClick={addTestimonial} className={`text-xs font-bold transition ${dark ? 'text-gray-500 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}>+ Add testimonial</button>
      </Section>

      <div className="flex gap-3 pt-2">
        <button onClick={handleSave} disabled={saving} className={`px-6 py-3 rounded-xl text-sm font-bold transition disabled:opacity-50 ${saved ? 'bg-green-600 text-white' : 'bg-gray-900 text-white hover:bg-gray-800'}`}>
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save changes'}
        </button>
        <button onClick={handleDelete} disabled={saving} className="px-6 py-3 border border-red-200 text-red-600 rounded-xl text-sm font-bold hover:bg-red-50 transition disabled:opacity-50 ml-auto">
          Delete show
        </button>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Blog List
// ─────────────────────────────────────────────────────────────────────────────
export const AdminBlogList: React.FC = () => (
  <AdminLayout active="blog"><BlogListInner /></AdminLayout>
);

const BlogListInner: React.FC = () => {
  const navigate = useNavigate();
  const { dark } = useTheme();
  const [posts, setPosts] = useState<AdminBlogPostSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminListBlogPosts().then(({ posts: p }) => setPosts(p || [])).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);

  const txt   = dark ? 'text-white' : 'text-gray-900';
  const muted = dark ? 'text-gray-500' : 'text-gray-400';

  return (
    <div className="px-8 py-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className={`text-xl font-bold ${txt}`}>Blog Posts</h1>
        <button onClick={() => navigate('/admin/blog/new')} className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-bold hover:bg-gray-800 transition">
          + New Post
        </button>
      </div>
      {error && <p className="mb-4 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
      {loading ? (
        <div className={`py-20 text-center text-sm ${muted}`}>Loading…</div>
      ) : posts.length === 0 ? (
        <div className={`py-20 text-center text-sm ${muted}`}>No posts yet.</div>
      ) : (
        <div className="space-y-2">
          {posts.map(p => (
            <div key={p.id} onClick={() => navigate(`/admin/blog/${p.id}`)}
              className={`flex items-center gap-4 p-4 border rounded-xl cursor-pointer transition hover:shadow-sm ${dark ? 'bg-gray-800 border-gray-700 hover:border-gray-500' : 'bg-white border-gray-200 hover:border-gray-400'}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`font-semibold text-sm truncate ${txt}`}>{p.title_de || '—'}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide flex-shrink-0 ${p.published_at ? (dark ? 'bg-green-900/40 text-green-300' : 'bg-green-100 text-green-700') : (dark ? 'bg-yellow-900/40 text-yellow-300' : 'bg-yellow-100 text-yellow-700')}`}>
                    {p.published_at ? 'Published' : 'Draft'}
                  </span>
                </div>
                <p className={`text-xs ${muted}`}>{p.published_at ? new Date(p.published_at).toLocaleDateString('de-DE') : 'Not published'}</p>
              </div>
              <span className={`text-sm ${muted}`}>›</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Blog Editor
// ─────────────────────────────────────────────────────────────────────────────
export const AdminBlogEditor: React.FC = () => (
  <AdminLayout active="blog"><BlogEditorInner /></AdminLayout>
);

const BlogEditorInner: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { dark } = useTheme();
  const isNew = !id || id === 'new';

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState<AdminBlogPostPayload>({
    slug: '', title_de: '', title_en: '', excerpt_de: '', excerpt_en: '',
    content_de: '', content_en: '', cover_image_url: '', published_at: null,
  });

  useEffect(() => {
    if (isNew) return;
    adminListBlogPosts().then(({ posts }) => {
      const post = posts.find(p => p.id === id);
      if (post) setForm({
        slug: post.slug || '', title_de: post.title_de || '', title_en: post.title_en || '',
        excerpt_de: (post as AdminBlogPostFull).excerpt_de || '',
        excerpt_en: (post as AdminBlogPostFull).excerpt_en || '',
        content_de: (post as AdminBlogPostFull).content_de || '',
        content_en: (post as AdminBlogPostFull).content_en || '',
        cover_image_url: (post as AdminBlogPostFull).cover_image_url || '',
        published_at: post.published_at || null,
      });
    }).catch(() => setError('Failed to load post.'));
  }, [id, isNew]);

  const autoSlug = (t: string) =>
    t.toLowerCase().replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');

  const set = (key: keyof AdminBlogPostPayload, value: string | null) => setForm(f => ({ ...f, [key]: value }));

  const handleSave = async (publishNow = false) => {
    setSaving(true); setError(null); setSuccess(null);
    try {
      const payload: AdminBlogPostPayload = { ...form, published_at: publishNow ? new Date().toISOString() : (form.published_at || null) };
      if (!payload.slug) payload.slug = autoSlug(payload.title_de || '');
      if (isNew) {
        const result = await adminCreateBlogPost(payload);
        navigate(`/admin/blog/${result.post.id}`, { replace: true });
      } else { await adminUpdateBlogPost(id!, payload); }
      setSuccess(publishNow ? 'Published!' : 'Saved!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (e) { setError((e as Error).message || 'Save failed.'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!id || isNew || !confirm('Delete this post permanently?')) return;
    setDeleting(true);
    try { await adminDeleteBlogPost(id); navigate('/admin/blog'); }
    catch (e) { setError((e as Error).message || 'Delete failed.'); setDeleting(false); }
  };

  const inp   = dynInput(dark);
  const ta    = `${inp} resize-y`;
  const txt   = dark ? 'text-white' : 'text-gray-900';
  const muted = dark ? 'text-gray-500' : 'text-gray-400';

  return (
    <div className="px-8 py-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <button onClick={() => navigate('/admin/blog')} className={`text-sm font-semibold inline-flex items-center gap-1 transition mb-1 ${dark ? 'text-gray-500 hover:text-white' : 'text-gray-400 hover:text-gray-900'}`}>← Blog</button>
          <h1 className={`text-xl font-bold ${txt}`}>{isNew ? 'New Post' : 'Edit Post'}</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={() => handleSave(false)} disabled={saving} className={`px-4 py-2 border rounded-lg text-sm font-bold disabled:opacity-50 transition ${dark ? 'border-gray-700 text-gray-300 hover:bg-gray-800' : 'border-gray-200 text-gray-700 hover:bg-gray-100'}`}>
            {saving ? 'Saving…' : 'Save Draft'}
          </button>
          <button onClick={() => handleSave(true)} disabled={saving} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 disabled:opacity-50 transition">
            Publish
          </button>
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
      {success && <p className="mb-4 text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg">{success}</p>}

      <Section title="URL & Metadata">
        <div className="flex gap-2">
          <div className="flex-1">
            <Field label="URL Slug"><input className={inp} value={form.slug || ''} onChange={e => set('slug', e.target.value)} placeholder="mein-artikel-titel" /></Field>
          </div>
          <div className="flex items-end pb-0.5">
            <button type="button" onClick={() => set('slug', autoSlug(form.title_de || ''))} className={`px-3 py-2 border rounded-lg text-xs font-bold transition whitespace-nowrap ${dark ? 'border-gray-700 text-gray-400 hover:bg-gray-700' : 'border-gray-200 text-gray-500 hover:bg-gray-100'}`}>Auto</button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Cover Image URL"><input className={inp} value={form.cover_image_url || ''} onChange={e => set('cover_image_url', e.target.value)} placeholder="https://…" /></Field>
          <Field label="Publish Date (empty = draft)">
            <input type="datetime-local" className={inp} value={form.published_at ? form.published_at.slice(0, 16) : ''} onChange={e => set('published_at', e.target.value ? new Date(e.target.value).toISOString() : null)} />
          </Field>
        </div>
      </Section>

      <Section title="Titles & Excerpts">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Title (DE)"><input className={inp} value={form.title_de || ''} onChange={e => set('title_de', e.target.value)} placeholder="Mein Blogartikel" /></Field>
          <Field label="Title (EN)"><input className={inp} value={form.title_en || ''} onChange={e => set('title_en', e.target.value)} placeholder="My Blog Article" /></Field>
          <Field label="Excerpt (DE)"><textarea className={ta} rows={2} value={form.excerpt_de || ''} onChange={e => set('excerpt_de', e.target.value)} placeholder="Kurze Zusammenfassung…" /></Field>
          <Field label="Excerpt (EN)"><textarea className={ta} rows={2} value={form.excerpt_en || ''} onChange={e => set('excerpt_en', e.target.value)} placeholder="Short summary…" /></Field>
        </div>
      </Section>

      <Section title="Content">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Content (DE)"><textarea className={ta} rows={20} value={form.content_de || ''} onChange={e => set('content_de', e.target.value)} placeholder="Artikel auf Deutsch…" /></Field>
          <Field label="Content (EN)"><textarea className={ta} rows={20} value={form.content_en || ''} onChange={e => set('content_en', e.target.value)} placeholder="Article in English…" /></Field>
        </div>
      </Section>

      {!isNew && (
        <div className="pt-2 flex justify-end">
          <button onClick={handleDelete} disabled={deleting} className="px-6 py-3 border border-red-200 text-red-600 rounded-xl text-sm font-bold hover:bg-red-50 disabled:opacity-50 transition">
            {deleting ? 'Deleting…' : 'Delete Post'}
          </button>
        </div>
      )}
    </div>
  );
};
