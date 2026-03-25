import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  adminLogin,
  adminLogout,
  adminIsLoggedIn,
  adminGetSubmissions,
  adminGetSubmission,
  adminApprove,
  adminReject,
  adminRequestChanges,
  adminUpdateSubmission,
  adminGetShows,
  adminGetShow,
  adminUpdateShow,
  adminDeleteShow,
  adminListBlogPosts,
  adminCreateBlogPost,
  adminUpdateBlogPost,
  adminDeleteBlogPost,
  type Submission,
  type AdminApproveOverrides,
  type AdminShowListItem,
  type AdminShowFull,
  type AdminBlogPostSummary,
  type AdminBlogPostFull,
  type AdminBlogPostPayload,
} from '../services/adminService';

const STATUS_LABELS: Record<string, string> = {
  PENDING_REVIEW: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CHANGES_REQUESTED: 'Changes',
};
const STATUS_COLORS: Record<string, string> = {
  PENDING_REVIEW: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-700',
  CHANGES_REQUESTED: 'bg-blue-100 text-blue-800',
};

// ── Sidebar layout ────────────────────────────────────────────────────────────
const AdminLayout: React.FC<{ children: React.ReactNode; active?: string }> = ({ children, active }) => {
  const navigate = useNavigate();
  const nav = [
    { key: 'submissions', label: 'Submissions', icon: '📥', to: '/admin/submissions' },
    { key: 'shows',       label: 'Shows',       icon: '🎭', to: '/admin/shows' },
    { key: 'blog',        label: 'Blog',        icon: '✍️', to: '/admin/blog' },
  ];
  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-gray-900 text-white flex flex-col sticky top-0 h-screen">
        <div className="px-5 py-5 border-b border-white/10">
          <span className="font-bold text-sm tracking-tight">berlintina<span className="text-orange-400">.</span> admin</span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {nav.map((n) => (
            <button
              key={n.key}
              onClick={() => navigate(n.to)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                active === n.key ? 'bg-white/15 text-white' : 'text-white/60 hover:bg-white/8 hover:text-white'
              }`}
            >
              <span>{n.icon}</span>
              <span>{n.label}</span>
            </button>
          ))}
        </nav>
        <div className="px-3 py-4 border-t border-white/10 space-y-1">
          <a href="/" target="_blank" rel="noopener" className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-white/40 hover:text-white/70 transition-colors">
            ↗ View site
          </a>
          <button
            onClick={() => { adminLogout(); window.location.href = '/admin'; }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-white/40 hover:text-red-400 transition-colors text-left"
          >
            ⎋ Logout
          </button>
        </div>
      </aside>
      {/* Main */}
      <main className="flex-1 min-w-0 overflow-auto">
        {children}
      </main>
    </div>
  );
};

// ── Section wrapper ───────────────────────────────────────────────────────────
const Section: React.FC<{ title: string; children: React.ReactNode; defaultOpen?: boolean }> = ({ title, children, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white mb-4">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <span className="text-xs font-bold uppercase tracking-widest text-gray-500">{title}</span>
        <span className="text-gray-400 text-sm">{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="px-5 py-4 space-y-3">{children}</div>}
    </div>
  );
};

// ── Field helpers ─────────────────────────────────────────────────────────────
const Field: React.FC<{ label: string; children: React.ReactNode; half?: boolean }> = ({ label, children, half }) => (
  <div className={half ? '' : ''}>
    <label className="block text-xs font-semibold text-gray-500 mb-1">{label}</label>
    {children}
  </div>
);
const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white';
const textareaCls = `${inputCls} resize-y`;

// ── Login ─────────────────────────────────────────────────────────────────────
export const AdminLogin: React.FC<{ onSuccess: () => void }> = ({ onSuccess }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
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
        <input type="password" placeholder="Password" className={inputCls + ' mb-4'} value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
        <button type="submit" disabled={loading || !password} className="w-full py-3 bg-gray-900 text-white rounded-xl font-bold text-sm hover:bg-gray-800 transition disabled:opacity-50">
          {loading ? 'Logging in…' : 'Login'}
        </button>
      </form>
    </div>
  );
};

// ── Dashboard ─────────────────────────────────────────────────────────────────
export const AdminDashboard: React.FC = () => {
  const location = useLocation();
  const pathShows = location.pathname.includes('/shows') && !location.pathname.match(/\/shows\/[^/]+$/);
  const pathBlog  = location.pathname.includes('/blog');
  const defaultTab = pathShows ? 'shows' : pathBlog ? 'blog' : 'submissions';
  const [tab, setTab] = useState<'submissions' | 'shows' | 'blog'>(defaultTab as 'submissions' | 'shows' | 'blog');
  useEffect(() => { setTab(defaultTab as 'submissions' | 'shows' | 'blog'); }, [defaultTab]);

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [shows, setShows] = useState<AdminShowListItem[]>([]);
  const [posts, setPosts] = useState<AdminBlogPostSummary[]>([]);
  const [filter, setFilter] = useState('PENDING_REVIEW');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    setError(null);
    if (tab === 'submissions') {
      adminGetSubmissions(filter || undefined)
        .then(({ submissions: d }) => setSubmissions(d))
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    } else if (tab === 'shows') {
      adminGetShows()
        .then(({ shows: d }) => setShows(d))
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    } else {
      adminListBlogPosts()
        .then(({ posts: p }) => setPosts(p || []))
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    }
  };
  useEffect(() => { load(); }, [tab, filter]);

  const tabs = [
    { key: 'submissions', label: 'Submissions', icon: '📥' },
    { key: 'shows',       label: 'Shows',       icon: '🎭' },
    { key: 'blog',        label: 'Blog',        icon: '✍️' },
  ];

  return (
    <AdminLayout active={tab}>
      <div className="px-8 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
          {tab === 'blog' && (
            <button onClick={() => navigate('/admin/blog/new')} className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-bold hover:bg-gray-800 transition">
              + New Post
            </button>
          )}
          <button onClick={load} className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-bold text-gray-500 hover:bg-gray-100 transition">↻ Refresh</button>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 mb-6 border-b border-gray-200 pb-0">
          {tabs.map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setTab(key as 'submissions' | 'shows' | 'blog')}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-lg border-b-2 transition-colors ${
                tab === key
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-400 hover:text-gray-700'
              }`}
            >
              <span>{icon}</span> {label}
            </button>
          ))}
        </div>

        {/* Status filter — submissions */}
        {tab === 'submissions' && (
          <div className="flex flex-wrap gap-2 mb-5">
            {[
              { key: 'PENDING_REVIEW', label: 'Pending', color: 'amber' },
              { key: '', label: 'All', color: 'gray' },
              { key: 'APPROVED', label: 'Approved', color: 'green' },
              { key: 'REJECTED', label: 'Rejected', color: 'red' },
              { key: 'CHANGES_REQUESTED', label: 'Changes requested', color: 'blue' },
            ].map(({ key, label }) => (
              <button
                key={key || 'all'}
                onClick={() => setFilter(key)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition ${
                  filter === key ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:border-gray-400'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {error && <p className="mb-4 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        {loading ? (
          <div className="py-20 text-center text-gray-400 text-sm">Loading…</div>
        ) : tab === 'submissions' ? (
          submissions.length === 0
            ? <div className="py-20 text-center text-gray-400 text-sm">No submissions for this filter.</div>
            : <div className="space-y-3">
                {submissions.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => navigate(`/admin/submissions/${s.id}`)}
                    className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4 cursor-pointer hover:border-gray-400 hover:shadow-sm transition"
                  >
                    {(s as { photo_urls?: string[] }).photo_urls?.[0] && (
                      <img src={(s as { photo_urls?: string[] }).photo_urls![0]} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-semibold text-sm text-gray-900 truncate">{s.show_title || '—'}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide flex-shrink-0 ${STATUS_COLORS[s.status] || 'bg-gray-100 text-gray-600'}`}>
                          {STATUS_LABELS[s.status] || s.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400">{s.submitter_email} {s.artist_genre ? `· ${s.artist_genre}` : ''}</p>
                    </div>
                    <span className="text-gray-300 text-sm flex-shrink-0">›</span>
                  </div>
                ))}
              </div>
        ) : tab === 'shows' ? (
          shows.length === 0
            ? <div className="py-20 text-center text-gray-400 text-sm">No published shows.</div>
            : <div className="space-y-3">
                {shows.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => navigate(`/admin/shows/${s.id}`)}
                    className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4 cursor-pointer hover:border-gray-400 hover:shadow-sm transition"
                  >
                    {(s as { photo_urls?: string[] }).photo_urls?.[0] ? (
                      <img src={(s as { photo_urls?: string[] }).photo_urls![0]} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 text-xl">🎭</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-gray-900 truncate">{s.title}</p>
                      <p className="text-xs text-gray-400">{s.artist_name}</p>
                    </div>
                    <span className="text-gray-300 text-sm flex-shrink-0">›</span>
                  </div>
                ))}
              </div>
        ) : (
          /* Blog tab */
          posts.length === 0
            ? <div className="py-20 text-center text-gray-400 text-sm">No blog posts yet.</div>
            : <div className="space-y-3">
                {posts.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => navigate(`/admin/blog/${p.id}`)}
                    className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4 cursor-pointer hover:border-gray-400 hover:shadow-sm transition"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-semibold text-sm text-gray-900 truncate">{p.title_de || '—'}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide flex-shrink-0 ${p.published_at ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {p.published_at ? 'Published' : 'Draft'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400">{p.published_at ? new Date(p.published_at).toLocaleDateString('de-DE') : 'Not published'}</p>
                    </div>
                    <span className="text-gray-300 text-sm flex-shrink-0">›</span>
                  </div>
                ))}
              </div>
        )}
      </div>
    </AdminLayout>
  );
};

// ── Submission Detail ─────────────────────────────────────────────────────────
export const AdminSubmissionDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
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
      .then((s) => { setSub(s); setEditTitle(s.show_title || ''); setEditDesc(s.short_description_facts || ''); setEditPitch(s.sales_pitch_text || ''); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const doAction = async (fn: () => Promise<unknown>) => {
    setActionLoading(true);
    setError(null);
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

  if (loading || !sub) return (
    <AdminLayout active="submissions">
      <div className="px-8 py-6 text-gray-400 text-sm">{loading ? 'Loading…' : 'Not found.'}</div>
    </AdminLayout>
  );

  const isPending = sub.status === 'PENDING_REVIEW';
  const photos: string[] = Array.isArray(sub.photo_urls) ? (sub.photo_urls as string[]) : [];

  return (
    <AdminLayout active="submissions">
      <div className="px-8 py-6 max-w-3xl">
        <button onClick={() => navigate('/admin/submissions')} className="text-sm font-semibold text-gray-400 hover:text-gray-900 mb-5 inline-flex items-center gap-1 transition">
          ← Back to submissions
        </button>

        {error && <p className="mb-4 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

        {/* Header card */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
          <div className="flex items-start justify-between gap-4 mb-3">
            <h2 className="text-xl font-bold text-gray-900">{sub.show_title}</h2>
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide flex-shrink-0 ${STATUS_COLORS[sub.status] || 'bg-gray-100 text-gray-600'}`}>
              {STATUS_LABELS[sub.status] || sub.status}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm text-gray-500 mb-4">
            <div><span className="text-xs font-bold text-gray-400 block mb-0.5">EMAIL</span>{sub.submitter_email || '—'}</div>
            <div><span className="text-xs font-bold text-gray-400 block mb-0.5">GENRE</span>{sub.artist_genre || '—'}</div>
            <div><span className="text-xs font-bold text-gray-400 block mb-0.5">ARTIST</span>{(sub as Record<string, unknown>).artist_name as string || '—'}</div>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed">{sub.short_description_facts}</p>
          {photos.length > 0 && (
            <div className="flex gap-2 mt-4 flex-wrap">
              {photos.map((url, i) => <img key={i} src={url} alt="" className="w-24 h-24 object-cover rounded-lg border border-gray-100" />)}
            </div>
          )}
        </div>

        {/* Edit before approving */}
        {isPending && (
          <>
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4 space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Edit before approving</p>
              <Field label="Title">
                <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Description">
                <textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={3} className={textareaCls} />
              </Field>
              <Field label="Sales pitch">
                <textarea value={editPitch} onChange={(e) => setEditPitch(e.target.value)} rows={2} className={textareaCls} />
              </Field>
              <Field label="Notes (for reject / request changes)">
                <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} placeholder="Optional…" />
              </Field>
            </div>

            <div className="flex flex-wrap gap-3">
              <button onClick={() => doAction(approve)} disabled={actionLoading} className="px-6 py-3 bg-green-600 text-white rounded-xl font-bold text-sm hover:bg-green-700 disabled:opacity-50 transition">
                ✓ Approve & Publish
              </button>
              <button onClick={() => doAction(() => adminRequestChanges(sub.id, notes))} disabled={actionLoading} className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 disabled:opacity-50 transition">
                ↩ Request Changes
              </button>
              <button onClick={() => doAction(() => adminReject(sub.id, notes))} disabled={actionLoading} className="px-6 py-3 bg-red-600 text-white rounded-xl font-bold text-sm hover:bg-red-700 disabled:opacity-50 transition">
                ✕ Reject
              </button>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
};

// ── Show Edit ─────────────────────────────────────────────────────────────────
export const AdminShowEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [show, setShow] = useState<AdminShowFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // fields
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
    adminGetShow(id).then((s) => {
      setShow(s);
      setTitle(s.title || '');
      setArtistName(s.artist_name || '');
      setDesc(s.short_description_facts || '');
      setPitch(s.sales_pitch_text || '');
      setDuration(s.duration_minutes != null ? String(s.duration_minutes) : '');
      setPrice(s.price_min != null && s.price_max != null ? `${s.price_min}–${s.price_max}` : s.price_min != null ? `ab ${s.price_min}` : '');
      setPhotoUrls(Array.isArray(s.photo_urls) ? [...s.photo_urls] : []);
      setVideoUrls(Array.isArray(s.video_urls) ? [...s.video_urls] : []);
      setCast(s.cast || '');
      setIdealFor(s.ideal_for || '');
      setPlacement(s.placement || '');
      setAudienceRange(s.audience_range || '');
      setStageMin(s.stage_min || '');
      setStageIdeal(s.stage_ideal || '');
      setCeilingMin(s.ceiling_min || '');
      setSoundShort(s.sound_short || '');
      setLightShort(s.light_short || '');
      setTimingsShort(s.timings_short || '');
      setRiderPdfUrl(s.rider_pdf_url || '');
      setFaqOutdoor(s.faq_outdoor || '');
      setFaqStage(s.faq_stage || '');
      setFaqLanguage(s.faq_language || '');
      setFaqCustom(s.faq_custom || '');
      setFaqTravel(s.faq_travel || '');
      setTestimonials(Array.isArray(s.testimonials) && s.testimonials.length ? [...s.testimonials] : []);
    }).catch((e) => setError(e.message)).finally(() => setLoading(false));
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

  const handleSave = async () => {
    if (!id) return;
    setSaving(true); setError(null);
    try {
      await adminUpdateShow(id, {
        title: title.trim() || undefined,
        artist_name: artistName.trim() || undefined,
        short_description_facts: desc || undefined,
        sales_pitch_text: pitch || undefined,
        duration_minutes: duration.trim() ? parseInt(duration, 10) : undefined,
        price_text: price.trim() || undefined,
        photo_urls: photoUrls.length ? photoUrls : undefined,
        video_urls: videoUrls.length ? videoUrls : undefined,
        cast: cast.trim() || undefined,
        ideal_for: idealFor.trim() || undefined,
        placement: placement.trim() || undefined,
        audience_range: audienceRange.trim() || undefined,
        stage_min: stageMin.trim() || undefined,
        stage_ideal: stageIdeal.trim() || undefined,
        ceiling_min: ceilingMin.trim() || undefined,
        sound_short: soundShort.trim() || undefined,
        light_short: lightShort.trim() || undefined,
        timings_short: timingsShort.trim() || undefined,
        rider_pdf_url: riderPdfUrl.trim() || undefined,
        testimonials: testimonials.filter(t => t.quote.trim() || t.name.trim()).length ? testimonials : undefined,
        faq_outdoor: faqOutdoor.trim() || undefined,
        faq_stage: faqStage.trim() || undefined,
        faq_language: faqLanguage.trim() || undefined,
        faq_custom: faqCustom.trim() || undefined,
        faq_travel: faqTravel.trim() || undefined,
        notify_artist: false,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) { setError((e as Error).message || 'Save failed'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!id || !window.confirm('Delete this show? This cannot be undone.')) return;
    setSaving(true);
    try { await adminDeleteShow(id); navigate('/admin/shows'); }
    catch (e) { setError((e as Error).message || 'Delete failed'); setSaving(false); }
  };

  if (loading || !show) return (
    <AdminLayout active="shows">
      <div className="px-8 py-6 text-gray-400 text-sm">{loading ? 'Loading…' : 'Not found.'}</div>
    </AdminLayout>
  );

  return (
    <AdminLayout active="shows">
      <div className="px-8 py-6 max-w-3xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <button onClick={() => navigate('/admin/shows')} className="text-sm font-semibold text-gray-400 hover:text-gray-900 inline-flex items-center gap-1 transition mb-1">
              ← Shows
            </button>
            <h1 className="text-xl font-bold text-gray-900">{show.title}</h1>
          </div>
          <div className="flex gap-2">
            {show.slug && (
              <a href={`/show/${show.slug}`} target="_blank" rel="noopener" className="px-3 py-2 border border-gray-200 rounded-lg text-xs font-bold text-gray-500 hover:bg-gray-100 transition">
                ↗ View
              </a>
            )}
            <button onClick={handleSave} disabled={saving} className={`px-5 py-2 rounded-lg text-sm font-bold transition disabled:opacity-50 ${saved ? 'bg-green-600 text-white' : 'bg-gray-900 text-white hover:bg-gray-800'}`}>
              {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save'}
            </button>
          </div>
        </div>

        {error && <p className="mb-4 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

        {/* ── Basic info ── */}
        <Section title="Basic Info">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Title">
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Artist name">
              <input type="text" value={artistName} onChange={(e) => setArtistName(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Duration (minutes)">
              <input type="text" value={duration} onChange={(e) => setDuration(e.target.value)} className={inputCls} placeholder="e.g. 45" />
            </Field>
            <Field label="Price">
              <input type="text" value={price} onChange={(e) => setPrice(e.target.value)} className={inputCls} placeholder="800–1200 or ab 800" />
            </Field>
          </div>
          <Field label="Short description / facts">
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} className={textareaCls} />
          </Field>
          <Field label="Sales pitch">
            <textarea value={pitch} onChange={(e) => setPitch(e.target.value)} rows={2} className={textareaCls} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Cast">
              <input type="text" value={cast} onChange={(e) => setCast(e.target.value)} className={inputCls} placeholder="e.g. 2 performers" />
            </Field>
            <Field label="Audience range">
              <input type="text" value={audienceRange} onChange={(e) => setAudienceRange(e.target.value)} className={inputCls} placeholder="50–2,000+" />
            </Field>
            <Field label="Ideal for">
              <input type="text" value={idealFor} onChange={(e) => setIdealFor(e.target.value)} className={inputCls} placeholder="corporate, galas, festivals" />
            </Field>
            <Field label="Placement">
              <input type="text" value={placement} onChange={(e) => setPlacement(e.target.value)} className={inputCls} placeholder="Opener / Finale" />
            </Field>
          </div>
        </Section>

        {/* ── Media ── */}
        <Section title="Photos & Videos">
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2">Photos <span className="text-gray-300 font-normal">(first = cover)</span></p>
            {photoUrls.map((url, i) => (
              <div key={i} className="flex items-center gap-2 mb-2 bg-gray-50 rounded-lg p-2">
                <img src={url} alt="" className="w-12 h-12 object-cover rounded-lg flex-shrink-0" />
                <span className="flex-1 truncate text-xs text-gray-500">{url}</span>
                <button type="button" onClick={() => movePhoto(i, -1)} disabled={i === 0} className="text-gray-400 hover:text-gray-700 disabled:opacity-20 text-sm px-1">↑</button>
                <button type="button" onClick={() => movePhoto(i, 1)} disabled={i === photoUrls.length - 1} className="text-gray-400 hover:text-gray-700 disabled:opacity-20 text-sm px-1">↓</button>
                <button type="button" onClick={() => removePhoto(i)} className="text-red-400 hover:text-red-600 text-sm px-1">✕</button>
              </div>
            ))}
            <div className="flex gap-2 mt-1">
              <input type="url" value={newPhoto} onChange={(e) => setNewPhoto(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addPhoto())} className={inputCls} placeholder="https://…" />
              <button type="button" onClick={addPhoto} className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-bold whitespace-nowrap">Add</button>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2">Videos</p>
            {videoUrls.map((url, i) => (
              <div key={i} className="flex items-center gap-2 mb-2 bg-gray-50 rounded-lg p-2">
                <span className="flex-1 truncate text-xs text-gray-500">{url}</span>
                <button type="button" onClick={() => removeVideo(i)} className="text-red-400 hover:text-red-600 text-sm px-1">✕</button>
              </div>
            ))}
            <div className="flex gap-2 mt-1">
              <input type="url" value={newVideo} onChange={(e) => setNewVideo(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addVideo())} className={inputCls} placeholder="https://youtube.com/…" />
              <button type="button" onClick={addVideo} className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-bold whitespace-nowrap">Add</button>
            </div>
          </div>
        </Section>

        {/* ── FAQ ── */}
        <Section title="FAQ">
          <Field label="Outdoor möglich?"><input type="text" value={faqOutdoor} onChange={(e) => setFaqOutdoor(e.target.value)} className={inputCls} /></Field>
          <Field label="Bühnengröße?"><input type="text" value={faqStage} onChange={(e) => setFaqStage(e.target.value)} className={inputCls} /></Field>
          <Field label="Sprachabhängig?"><input type="text" value={faqLanguage} onChange={(e) => setFaqLanguage(e.target.value)} className={inputCls} /></Field>
          <Field label="Anpassbar / Branding?"><input type="text" value={faqCustom} onChange={(e) => setFaqCustom(e.target.value)} className={inputCls} /></Field>
          <Field label="Anreise?"><input type="text" value={faqTravel} onChange={(e) => setFaqTravel(e.target.value)} className={inputCls} /></Field>
        </Section>

        {/* ── Technical ── */}
        <Section title="Technical Rider" defaultOpen={false}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Stage min"><input type="text" value={stageMin} onChange={(e) => setStageMin(e.target.value)} className={inputCls} placeholder="6×4 m" /></Field>
            <Field label="Stage ideal"><input type="text" value={stageIdeal} onChange={(e) => setStageIdeal(e.target.value)} className={inputCls} placeholder="8×6 m" /></Field>
            <Field label="Ceiling min"><input type="text" value={ceilingMin} onChange={(e) => setCeilingMin(e.target.value)} className={inputCls} placeholder="3.5 m+" /></Field>
            <Field label="Timings"><input type="text" value={timingsShort} onChange={(e) => setTimingsShort(e.target.value)} className={inputCls} placeholder="Load-in 30 min, Strike 15 min" /></Field>
            <Field label="Sound"><input type="text" value={soundShort} onChange={(e) => setSoundShort(e.target.value)} className={inputCls} /></Field>
            <Field label="Light"><input type="text" value={lightShort} onChange={(e) => setLightShort(e.target.value)} className={inputCls} /></Field>
          </div>
          <Field label="Rider PDF URL"><input type="url" value={riderPdfUrl} onChange={(e) => setRiderPdfUrl(e.target.value)} className={inputCls} placeholder="https://…" /></Field>
        </Section>

        {/* ── Testimonials ── */}
        <Section title="Testimonials" defaultOpen={false}>
          {testimonials.map((t, i) => (
            <div key={i} className="bg-gray-50 rounded-lg p-3 mb-2 space-y-2">
              <textarea value={t.quote} onChange={(e) => updateTestimonial(i, 'quote', e.target.value)} rows={2} className={textareaCls} placeholder="Quote…" />
              <div className="flex gap-2">
                <input type="text" value={t.name} onChange={(e) => updateTestimonial(i, 'name', e.target.value)} className={inputCls + ' flex-1'} placeholder="— Name, Title" />
                <button type="button" onClick={() => removeTestimonial(i)} className="text-red-400 hover:text-red-600 text-sm px-2">✕</button>
              </div>
            </div>
          ))}
          <button type="button" onClick={addTestimonial} className="text-xs font-bold text-gray-500 hover:text-gray-900 transition">+ Add testimonial</button>
        </Section>

        {/* Bottom actions */}
        <div className="flex gap-3 pt-2">
          <button onClick={handleSave} disabled={saving} className={`px-6 py-3 rounded-xl text-sm font-bold transition disabled:opacity-50 ${saved ? 'bg-green-600 text-white' : 'bg-gray-900 text-white hover:bg-gray-800'}`}>
            {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save changes'}
          </button>
          <button onClick={handleDelete} disabled={saving} className="px-6 py-3 border border-red-200 text-red-600 rounded-xl text-sm font-bold hover:bg-red-50 transition disabled:opacity-50 ml-auto">
            Delete show
          </button>
        </div>
      </div>
    </AdminLayout>
  );
};

// ── Blog List ─────────────────────────────────────────────────────────────────
export const AdminBlogList: React.FC = () => {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<AdminBlogPostSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminListBlogPosts()
      .then(({ posts: p }) => setPosts(p || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AdminLayout active="blog">
      <div className="px-8 py-6 max-w-3xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-gray-900">Blog Posts</h1>
          <button onClick={() => navigate('/admin/blog/new')} className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-bold hover:bg-gray-800 transition">
            + New Post
          </button>
        </div>
        {error && <p className="mb-4 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        {loading ? <div className="py-20 text-center text-gray-400 text-sm">Loading…</div> : posts.length === 0 ? (
          <div className="py-20 text-center text-gray-400 text-sm">No posts yet.</div>
        ) : (
          <div className="space-y-3">
            {posts.map((p) => (
              <div key={p.id} onClick={() => navigate(`/admin/blog/${p.id}`)} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4 cursor-pointer hover:border-gray-400 hover:shadow-sm transition">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-semibold text-sm text-gray-900 truncate">{p.title_de || '—'}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide flex-shrink-0 ${p.published_at ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {p.published_at ? 'Published' : 'Draft'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">{p.published_at ? new Date(p.published_at).toLocaleDateString('de-DE') : 'Not published'}</p>
                </div>
                <span className="text-gray-300 text-sm">›</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

// ── Blog Editor ───────────────────────────────────────────────────────────────
export const AdminBlogEditor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
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
      const post = posts.find((p) => p.id === id);
      if (post) {
        setForm({
          slug: post.slug || '',
          title_de: post.title_de || '',
          title_en: post.title_en || '',
          excerpt_de: (post as AdminBlogPostFull).excerpt_de || '',
          excerpt_en: (post as AdminBlogPostFull).excerpt_en || '',
          content_de: (post as AdminBlogPostFull).content_de || '',
          content_en: (post as AdminBlogPostFull).content_en || '',
          cover_image_url: (post as AdminBlogPostFull).cover_image_url || '',
          published_at: post.published_at || null,
        });
      }
    }).catch(() => setError('Failed to load post.'));
  }, [id, isNew]);

  const autoSlug = (t: string) =>
    t.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const set = (key: keyof AdminBlogPostPayload, value: string | null) => setForm(f => ({ ...f, [key]: value }));

  const handleSave = async (publishNow = false) => {
    setSaving(true); setError(null); setSuccess(null);
    try {
      const payload: AdminBlogPostPayload = { ...form, published_at: publishNow ? new Date().toISOString() : (form.published_at || null) };
      if (!payload.slug) payload.slug = autoSlug(payload.title_de || '');
      if (isNew) {
        const result = await adminCreateBlogPost(payload);
        navigate(`/admin/blog/${result.post.id}`, { replace: true });
      } else {
        await adminUpdateBlogPost(id!, payload);
      }
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

  return (
    <AdminLayout active="blog">
      <div className="px-8 py-6 max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <button onClick={() => navigate('/admin/blog')} className="text-sm font-semibold text-gray-400 hover:text-gray-900 inline-flex items-center gap-1 transition mb-1">
              ← Blog
            </button>
            <h1 className="text-xl font-bold text-gray-900">{isNew ? 'New Post' : 'Edit Post'}</h1>
          </div>
          <div className="flex gap-2">
            <button onClick={() => handleSave(false)} disabled={saving} className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-bold text-gray-700 hover:bg-gray-100 disabled:opacity-50 transition">
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
              <Field label="URL Slug">
                <input className={inputCls} value={form.slug || ''} onChange={(e) => set('slug', e.target.value)} placeholder="mein-artikel-titel" />
              </Field>
            </div>
            <div className="flex items-end pb-0.5">
              <button type="button" onClick={() => set('slug', autoSlug(form.title_de || ''))} className="px-3 py-2 border border-gray-200 rounded-lg text-xs font-bold text-gray-500 hover:bg-gray-100 whitespace-nowrap transition">
                Auto
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Cover Image URL">
              <input className={inputCls} value={form.cover_image_url || ''} onChange={(e) => set('cover_image_url', e.target.value)} placeholder="https://…" />
            </Field>
            <Field label="Publish Date (empty = draft)">
              <input type="datetime-local" className={inputCls} value={form.published_at ? form.published_at.slice(0, 16) : ''} onChange={(e) => set('published_at', e.target.value ? new Date(e.target.value).toISOString() : null)} />
            </Field>
          </div>
        </Section>

        <Section title="Titles & Excerpts">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Title (DE)">
              <input className={inputCls} value={form.title_de || ''} onChange={(e) => set('title_de', e.target.value)} placeholder="Mein Blogartikel" />
            </Field>
            <Field label="Title (EN)">
              <input className={inputCls} value={form.title_en || ''} onChange={(e) => set('title_en', e.target.value)} placeholder="My Blog Article" />
            </Field>
            <Field label="Excerpt (DE)">
              <textarea className={textareaCls} rows={2} value={form.excerpt_de || ''} onChange={(e) => set('excerpt_de', e.target.value)} placeholder="Kurze Zusammenfassung…" />
            </Field>
            <Field label="Excerpt (EN)">
              <textarea className={textareaCls} rows={2} value={form.excerpt_en || ''} onChange={(e) => set('excerpt_en', e.target.value)} placeholder="Short summary…" />
            </Field>
          </div>
        </Section>

        <Section title="Content">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Content (DE)">
              <textarea className={textareaCls} rows={20} value={form.content_de || ''} onChange={(e) => set('content_de', e.target.value)} placeholder="Artikel auf Deutsch…" />
            </Field>
            <Field label="Content (EN)">
              <textarea className={textareaCls} rows={20} value={form.content_en || ''} onChange={(e) => set('content_en', e.target.value)} placeholder="Article in English…" />
            </Field>
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
    </AdminLayout>
  );
};
