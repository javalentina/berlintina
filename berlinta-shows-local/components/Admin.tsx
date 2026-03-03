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
  CHANGES_REQUESTED: 'Changes requested',
};

// --- Login ---
export const AdminLogin: React.FC<{ onSuccess: () => void }> = ({ onSuccess }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await adminLogin(password);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.');
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-white rounded-2xl border border-gray-100 shadow-xl p-8">
        <h2 className="text-xl font-bold mb-6 tracking-tight">Admin Login</h2>
        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
        <input type="password" placeholder="Password" className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-black" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
        <button type="submit" disabled={loading || !password} className="w-full py-3 bg-black text-white rounded-xl font-bold text-sm hover:opacity-90 transition disabled:opacity-50">Login</button>
      </form>
    </div>
  );
};

// --- Dashboard: Submissions + Shows in one view ---
export const AdminDashboard: React.FC = () => {
  const location = useLocation();
  const pathShows = location.pathname.includes('/shows') && !location.pathname.match(/\/shows\/[^/]+$/);
  const [tab, setTab] = useState<'submissions' | 'shows'>(pathShows ? 'shows' : 'submissions');
  useEffect(() => { setTab(pathShows ? 'shows' : 'submissions'); }, [pathShows]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [shows, setShows] = useState<AdminShowListItem[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    setError(null);
    if (tab === 'submissions') {
      adminGetSubmissions(filter || undefined).then(({ submissions: data }) => {
        setSubmissions(data);
        setLoading(false);
      }).catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed');
        setLoading(false);
      });
    } else {
      adminGetShows().then(({ shows: data }) => {
        setShows(data);
        setLoading(false);
      }).catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed');
        setLoading(false);
      });
    }
  };

  useEffect(() => load(), [tab, filter]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Admin</h1>
        <button onClick={() => { adminLogout(); window.location.href = '/#/admin'; }} className="text-sm font-bold text-gray-500 hover:text-black">Logout</button>
      </div>

      <div className="flex gap-2 mb-6">
        <Link to="/admin/submissions" className={`px-4 py-2 rounded-xl text-sm font-bold ${tab === 'submissions' ? 'bg-black text-white' : 'bg-gray-100 text-gray-600'}`}>Submissions</Link>
        <Link to="/admin/shows" className={`px-4 py-2 rounded-xl text-sm font-bold ${tab === 'shows' ? 'bg-black text-white' : 'bg-gray-100 text-gray-600'}`}>Published Shows</Link>
      </div>

      {tab === 'submissions' && (
        <div className="flex flex-wrap gap-2 mb-6">
          {['', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED'].map((s) => (
            <button key={s || 'all'} onClick={() => setFilter(s)} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${filter === s ? 'bg-black text-white' : 'bg-gray-100 text-gray-600'}`}>{s ? STATUS_LABELS[s] || s : 'All'}</button>
          ))}
        </div>
      )}

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {loading ? <p className="text-gray-500">Loading…</p> : tab === 'submissions' ? (
        submissions.length === 0 ? <p className="text-gray-500">No submissions.</p> : (
          <div className="space-y-3">
            {submissions.map((s) => (
              <div key={s.id} className="p-4 bg-white rounded-xl border border-gray-100 flex justify-between items-center hover:shadow-md transition">
                <div>
                  <h3 className="font-bold">{s.show_title}</h3>
                  <p className="text-sm text-gray-500">{s.submitter_email} • <span className={s.status === 'PENDING_REVIEW' ? 'text-amber-600 font-medium' : ''}>{STATUS_LABELS[s.status] || s.status}</span></p>
                </div>
                <button onClick={() => navigate(`/admin/submissions/${s.id}`)} className="px-4 py-2 bg-black text-white rounded-lg text-sm font-bold">View</button>
              </div>
            ))}
          </div>
        )
      ) : (
        shows.length === 0 ? <p className="text-gray-500">No published shows.</p> : (
          <div className="space-y-3">
            {shows.map((s) => (
              <div key={s.id} className="p-4 bg-white rounded-xl border border-gray-100 flex justify-between items-center hover:shadow-md transition">
                <div>
                  <h3 className="font-bold">{s.title}</h3>
                  <p className="text-sm text-gray-500">{s.artist_name}</p>
                </div>
                <button onClick={() => navigate(`/admin/shows/${s.id}`)} className="px-4 py-2 bg-black text-white rounded-lg text-sm font-bold">Edit</button>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
};

// --- Submission Detail: Simple view + 3 actions ---
export const AdminSubmissionDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [sub, setSub] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [notes, setNotes] = useState('');
  const [showEdit, setShowEdit] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editPitch, setEditPitch] = useState('');

  useEffect(() => {
    if (!id) return;
    adminGetSubmission(id).then((s) => {
      setSub(s);
      setEditTitle(s.show_title || '');
      setEditDesc(s.short_description_facts || '');
      setEditPitch(s.sales_pitch_text || '');
    }).catch((err) => setError(err instanceof Error ? err.message : 'Failed')).finally(() => setLoading(false));
  }, [id]);

  const doAction = async (fn: () => Promise<unknown>) => {
    setActionLoading(true);
    setError(null);
    try {
      await fn();
      navigate('/admin/submissions');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const approve = async () => {
    if (!sub) return;
    const overrides: AdminApproveOverrides = {
      title: editTitle.trim() || undefined,
      short_description_facts: editDesc.trim() || undefined,
      sales_pitch_text: editPitch.trim() || undefined,
    };
    await adminApprove(sub.id, overrides);
  };

  if (loading || !sub) return <div className="max-w-2xl mx-auto px-4 py-12"><p className="text-gray-500">{loading ? 'Loading…' : 'Not found.'}</p></div>;

  const isPending = sub.status === 'PENDING_REVIEW';
  const photos = Array.isArray(sub.photo_urls) ? sub.photo_urls : [];

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link to="/admin/submissions" className="text-sm font-bold text-gray-500 hover:text-black mb-6 inline-block">← Back</Link>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">{sub.show_title}</h2>
          <span className={`px-3 py-1 rounded-lg text-xs font-bold ${isPending ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'}`}>{STATUS_LABELS[sub.status] || sub.status}</span>
        </div>
        <p className="text-sm text-gray-600 mb-2">{sub.submitter_email}</p>
        {sub.artist_genre && <p className="text-sm text-gray-500 mb-2">{sub.artist_genre}</p>}
        <p className="text-gray-600 text-sm leading-relaxed">{sub.short_description_facts}</p>
        {photos[0] && <img src={photos[0]} alt="" className="mt-4 w-full max-h-48 object-cover rounded-xl" />}
      </div>

      {isPending && (
        <>
          <button onClick={() => setShowEdit(!showEdit)} className="text-sm font-bold text-gray-500 hover:text-black mb-4">
            {showEdit ? 'Hide edits' : 'Edit before approving'}
          </button>
          {showEdit && (
            <div className="bg-gray-50 rounded-xl p-4 mb-6 space-y-3">
              <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Title" className="w-full px-4 py-2 rounded-lg border border-gray-200 text-sm" />
              <textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="Description" rows={2} className="w-full px-4 py-2 rounded-lg border border-gray-200 text-sm" />
              <textarea value={editPitch} onChange={(e) => setEditPitch(e.target.value)} placeholder="Sales pitch" rows={1} className="w-full px-4 py-2 rounded-lg border border-gray-200 text-sm" />
            </div>
          )}

          <div className="flex flex-wrap gap-3 mb-4">
            <button onClick={() => doAction(approve)} disabled={actionLoading} className="px-6 py-3 bg-green-600 text-white rounded-xl font-bold text-sm">Approve & Publish</button>
            <button onClick={() => doAction(() => adminReject(sub.id, notes))} disabled={actionLoading} className="px-6 py-3 bg-red-600 text-white rounded-xl font-bold text-sm">Reject</button>
            <button onClick={() => doAction(() => adminRequestChanges(sub.id, notes))} disabled={actionLoading} className="px-6 py-3 bg-amber-500 text-white rounded-xl font-bold text-sm">Request Changes</button>
          </div>
          <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (for Reject / Request Changes)" className="w-full px-4 py-2 rounded-xl border border-gray-200 text-sm" />
        </>
      )}
    </div>
  );
};

// --- Show Edit: Compact form ---
export const AdminShowEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [show, setShow] = useState<AdminShowFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [artistName, setArtistName] = useState('');
  const [desc, setDesc] = useState('');
  const [pitch, setPitch] = useState('');
  const [duration, setDuration] = useState('');
  const [price, setPrice] = useState('');
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [videoUrls, setVideoUrls] = useState<string[]>([]);
  const [newPhoto, setNewPhoto] = useState('');
  const [newVideo, setNewVideo] = useState('');
  const [cast, setCast] = useState('');
  const [idealFor, setIdealFor] = useState('');
  const [placement, setPlacement] = useState('');
  const [audienceRange, setAudienceRange] = useState('');
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
      setPrice(s.price_min != null && s.price_max != null ? `${s.price_min}–${s.price_max}` : (s.price_min != null ? `ab ${s.price_min}` : ''));
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
    }).catch((err) => setError(err instanceof Error ? err.message : 'Failed')).finally(() => setLoading(false));
  }, [id]);

  const addPhoto = () => { if (newPhoto.trim()) { setPhotoUrls((u) => [...u, newPhoto.trim()]); setNewPhoto(''); } };
  const addVideo = () => { if (newVideo.trim()) { setVideoUrls((u) => [...u, newVideo.trim()]); setNewVideo(''); } };
  const removePhoto = (i: number) => setPhotoUrls((u) => u.filter((_, j) => j !== i));
  const removeVideo = (i: number) => setVideoUrls((u) => u.filter((_, j) => j !== i));
  const addTestimonial = () => setTestimonials((t) => [...t, { quote: '', name: '' }]);
  const removeTestimonial = (i: number) => setTestimonials((t) => t.filter((_, j) => j !== i));
  const updateTestimonial = (i: number, field: 'quote' | 'name', value: string) =>
    setTestimonials((t) => t.map((x, j) => j === i ? { ...x, [field]: value } : x));

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    setError(null);
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
        testimonials: testimonials.filter((t) => t.quote.trim() || t.name.trim()).length ? testimonials : undefined,
        faq_outdoor: faqOutdoor.trim() || undefined,
        faq_stage: faqStage.trim() || undefined,
        faq_language: faqLanguage.trim() || undefined,
        faq_custom: faqCustom.trim() || undefined,
        faq_travel: faqTravel.trim() || undefined,
        notify_artist: false,
      });
      navigate('/admin/shows');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id || !window.confirm('Delete this show?')) return;
    setSaving(true);
    try {
      await adminDeleteShow(id);
      navigate('/admin/shows');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !show) return <div className="max-w-2xl mx-auto px-4 py-12"><p className="text-gray-500">{loading ? 'Loading…' : 'Not found.'}</p></div>;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link to="/admin/shows" className="text-sm font-bold text-gray-500 hover:text-black mb-6 inline-block">← Back</Link>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-xl p-6 space-y-4">
        <div><label className="block text-xs font-bold text-gray-500 mb-1">Title</label><input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-4 py-2 rounded-lg border text-sm" /></div>
        <div><label className="block text-xs font-bold text-gray-500 mb-1">Artist</label><input type="text" value={artistName} onChange={(e) => setArtistName(e.target.value)} className="w-full px-4 py-2 rounded-lg border text-sm" /></div>
        <div><label className="block text-xs font-bold text-gray-500 mb-1">Description</label><textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} className="w-full px-4 py-2 rounded-lg border text-sm" /></div>
        <div><label className="block text-xs font-bold text-gray-500 mb-1">Pitch</label><textarea value={pitch} onChange={(e) => setPitch(e.target.value)} rows={1} className="w-full px-4 py-2 rounded-lg border text-sm" /></div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="block text-xs font-bold text-gray-500 mb-1">Duration (min)</label><input type="text" value={duration} onChange={(e) => setDuration(e.target.value)} className="w-full px-4 py-2 rounded-lg border text-sm" /></div>
          <div><label className="block text-xs font-bold text-gray-500 mb-1">Price</label><input type="text" value={price} onChange={(e) => setPrice(e.target.value)} className="w-full px-4 py-2 rounded-lg border text-sm" placeholder="800–1200 or ab 800" /></div>
        </div>
        <div className="border-t border-gray-100 pt-4 mt-4">
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Key facts</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="block text-xs font-bold text-gray-500 mb-1">Cast</label><input type="text" value={cast} onChange={(e) => setCast(e.target.value)} className="w-full px-4 py-2 rounded-lg border text-sm" placeholder="e.g. 2 performers" /></div>
            <div><label className="block text-xs font-bold text-gray-500 mb-1">Ideal for</label><input type="text" value={idealFor} onChange={(e) => setIdealFor(e.target.value)} className="w-full px-4 py-2 rounded-lg border text-sm" placeholder="corporate, galas, festivals" /></div>
            <div><label className="block text-xs font-bold text-gray-500 mb-1">Placement</label><input type="text" value={placement} onChange={(e) => setPlacement(e.target.value)} className="w-full px-4 py-2 rounded-lg border text-sm" placeholder="Opener / nach Pause / Finale" /></div>
            <div><label className="block text-xs font-bold text-gray-500 mb-1">Audience range</label><input type="text" value={audienceRange} onChange={(e) => setAudienceRange(e.target.value)} className="w-full px-4 py-2 rounded-lg border text-sm" placeholder="50–2,000+" /></div>
          </div>
        </div>
        <div className="border-t border-gray-100 pt-4">
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Tech & highlights</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="block text-xs font-bold text-gray-500 mb-1">Stage min</label><input type="text" value={stageMin} onChange={(e) => setStageMin(e.target.value)} className="w-full px-4 py-2 rounded-lg border text-sm" placeholder="6×4 m" /></div>
            <div><label className="block text-xs font-bold text-gray-500 mb-1">Stage ideal</label><input type="text" value={stageIdeal} onChange={(e) => setStageIdeal(e.target.value)} className="w-full px-4 py-2 rounded-lg border text-sm" placeholder="8×6 m" /></div>
            <div><label className="block text-xs font-bold text-gray-500 mb-1">Ceiling min</label><input type="text" value={ceilingMin} onChange={(e) => setCeilingMin(e.target.value)} className="w-full px-4 py-2 rounded-lg border text-sm" placeholder="3.5 m+" /></div>
            <div><label className="block text-xs font-bold text-gray-500 mb-1">Sound</label><input type="text" value={soundShort} onChange={(e) => setSoundShort(e.target.value)} className="w-full px-4 py-2 rounded-lg border text-sm" /></div>
            <div><label className="block text-xs font-bold text-gray-500 mb-1">Light</label><input type="text" value={lightShort} onChange={(e) => setLightShort(e.target.value)} className="w-full px-4 py-2 rounded-lg border text-sm" /></div>
            <div><label className="block text-xs font-bold text-gray-500 mb-1">Timings</label><input type="text" value={timingsShort} onChange={(e) => setTimingsShort(e.target.value)} className="w-full px-4 py-2 rounded-lg border text-sm" placeholder="Load-in 30–60 min, Strike 15–30 min" /></div>
            <div className="sm:col-span-2"><label className="block text-xs font-bold text-gray-500 mb-1">Rider PDF URL</label><input type="url" value={riderPdfUrl} onChange={(e) => setRiderPdfUrl(e.target.value)} className="w-full px-4 py-2 rounded-lg border text-sm" placeholder="https://…" /></div>
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1">Photos</label>
          {photoUrls.map((url, i) => <div key={i} className="flex items-center gap-2 mb-1"><img src={url} alt="" className="w-10 h-10 object-cover rounded" /><span className="flex-1 truncate text-xs">{url}</span><button type="button" onClick={() => removePhoto(i)} className="text-red-600 text-xs">×</button></div>)}
          <div className="flex gap-2 mt-2"><input type="url" value={newPhoto} onChange={(e) => setNewPhoto(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addPhoto())} className="flex-1 px-3 py-2 rounded-lg border text-sm" placeholder="https://…" /><button type="button" onClick={addPhoto} className="px-3 py-2 bg-gray-100 rounded-lg text-sm font-bold">Add</button></div>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1">Videos</label>
          {videoUrls.map((url, i) => <div key={i} className="flex items-center gap-2 mb-1"><span className="flex-1 truncate text-xs">{url}</span><button type="button" onClick={() => removeVideo(i)} className="text-red-600 text-xs">×</button></div>)}
          <div className="flex gap-2 mt-2"><input type="url" value={newVideo} onChange={(e) => setNewVideo(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addVideo())} className="flex-1 px-3 py-2 rounded-lg border text-sm" placeholder="https://…" /><button type="button" onClick={addVideo} className="px-3 py-2 bg-gray-100 rounded-lg text-sm font-bold">Add</button></div>
        </div>
        <div className="border-t border-gray-100 pt-4">
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">FAQ</h4>
          <div className="space-y-2">
            <div><label className="block text-xs font-bold text-gray-500 mb-1">Outdoor möglich?</label><input type="text" value={faqOutdoor} onChange={(e) => setFaqOutdoor(e.target.value)} className="w-full px-4 py-2 rounded-lg border text-sm" /></div>
            <div><label className="block text-xs font-bold text-gray-500 mb-1">Wie groß muss die Bühne sein?</label><input type="text" value={faqStage} onChange={(e) => setFaqStage(e.target.value)} className="w-full px-4 py-2 rounded-lg border text-sm" /></div>
            <div><label className="block text-xs font-bold text-gray-500 mb-1">Ist die Show sprachabhängig?</label><input type="text" value={faqLanguage} onChange={(e) => setFaqLanguage(e.target.value)} className="w-full px-4 py-2 rounded-lg border text-sm" /></div>
            <div><label className="block text-xs font-bold text-gray-500 mb-1">Kann man die Show anpassen?</label><input type="text" value={faqCustom} onChange={(e) => setFaqCustom(e.target.value)} className="w-full px-4 py-2 rounded-lg border text-sm" /></div>
            <div><label className="block text-xs font-bold text-gray-500 mb-1">Reist ihr an?</label><input type="text" value={faqTravel} onChange={(e) => setFaqTravel(e.target.value)} className="w-full px-4 py-2 rounded-lg border text-sm" /></div>
          </div>
        </div>
        <div className="border-t border-gray-100 pt-4">
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Testimonials</h4>
          {testimonials.map((t, i) => (
            <div key={i} className="mb-3 p-3 bg-gray-50 rounded-lg">
              <textarea value={t.quote} onChange={(e) => updateTestimonial(i, 'quote', e.target.value)} rows={2} className="w-full px-3 py-2 rounded border text-sm mb-2" placeholder="Quote" />
              <div className="flex gap-2"><input type="text" value={t.name} onChange={(e) => updateTestimonial(i, 'name', e.target.value)} className="flex-1 px-3 py-2 rounded border text-sm" placeholder="— Name" /><button type="button" onClick={() => removeTestimonial(i)} className="text-red-600 text-xs">×</button></div>
            </div>
          ))}
          <button type="button" onClick={addTestimonial} className="text-xs font-bold text-gray-500 hover:text-black">+ Add testimonial</button>
        </div>
        <div className="flex gap-3 pt-4">
          <button onClick={handleSave} disabled={saving} className="px-6 py-3 bg-black text-white rounded-xl font-bold text-sm">Save</button>
          <button onClick={handleDelete} disabled={saving} className="px-6 py-3 bg-red-600 text-white rounded-xl font-bold text-sm">Delete</button>
        </div>
      </div>
    </div>
  );
};

// --- Admin Blog: List ---
export const AdminBlogList: React.FC = () => {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<AdminBlogPostSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminListBlogPosts()
      .then(({ posts: p }) => setPosts(p || []))
      .catch((e) => setError(e.message || 'Failed'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-gray-500">Loading blog posts…</div>;
  if (error) return <div className="p-8 text-red-600">{error}</div>;

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Blog Posts</h1>
        <button
          onClick={() => navigate('/admin/blog/new')}
          className="px-5 py-2.5 bg-black text-white rounded-xl text-sm font-bold hover:opacity-90 transition"
        >
          + New Post
        </button>
      </div>
      {posts.length === 0 ? (
        <p className="text-gray-500 text-sm">No posts yet. Create your first one!</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs text-gray-400 font-bold uppercase tracking-widest">
              <th className="pb-3 pr-4">Title (DE)</th>
              <th className="pb-3 pr-4">Status</th>
              <th className="pb-3 pr-4">Published</th>
              <th className="pb-3" />
            </tr>
          </thead>
          <tbody>
            {posts.map((p) => (
              <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                <td className="py-3 pr-4 font-medium text-gray-900">{p.title_de || '—'}</td>
                <td className="py-3 pr-4">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${p.published_at ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {p.published_at ? 'Published' : 'Draft'}
                  </span>
                </td>
                <td className="py-3 pr-4 text-gray-400 text-xs">
                  {p.published_at ? new Date(p.published_at).toLocaleDateString('de-DE') : '—'}
                </td>
                <td className="py-3 text-right">
                  <button
                    onClick={() => navigate(`/admin/blog/${p.id}`)}
                    className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-bold text-gray-600 hover:bg-gray-100 transition"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

// --- Admin Blog: Editor ---
export const AdminBlogEditor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id || id === 'new';

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState<AdminBlogPostPayload>({
    slug: '',
    title_de: '',
    title_en: '',
    excerpt_de: '',
    excerpt_en: '',
    content_de: '',
    content_en: '',
    cover_image_url: '',
    published_at: null,
  });

  useEffect(() => {
    if (isNew) return;
    // For existing posts, we load via adminListBlogPosts and find by id
    // (no separate adminGetBlogPost needed — list has full data for now)
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

  const autoSlug = (title: string) =>
    title.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const set = (key: keyof AdminBlogPostPayload, value: string | null) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSave = async (publishNow = false) => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload: AdminBlogPostPayload = {
        ...form,
        published_at: publishNow ? new Date().toISOString() : (form.published_at || null),
      };
      if (!payload.slug) payload.slug = autoSlug(payload.title_de || '');
      let result;
      if (isNew) {
        result = await adminCreateBlogPost(payload);
        navigate(`/admin/blog/${result.post.id}`, { replace: true });
      } else {
        await adminUpdateBlogPost(id!, payload);
      }
      setSuccess(publishNow ? 'Published!' : 'Saved!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: unknown) {
      setError((e as Error).message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id || isNew || !confirm('Delete this post permanently?')) return;
    setDeleting(true);
    try {
      await adminDeleteBlogPost(id);
      navigate('/admin/blog');
    } catch (e: unknown) {
      setError((e as Error).message || 'Delete failed.');
      setDeleting(false);
    }
  };

  const inputCls = 'w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent bg-white font-medium';
  const textareaCls = `${inputCls} resize-y`;

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate('/admin/blog')} className="text-sm text-gray-400 hover:text-black transition">← Blog</button>
        <h1 className="text-2xl font-bold tracking-tight">{isNew ? 'New Post' : 'Edit Post'}</h1>
      </div>

      {error && <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">{error}</div>}
      {success && <div className="mb-4 p-4 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm font-medium">{success}</div>}

      <div className="space-y-6">
        {/* Slug */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-1.5">URL Slug</label>
          <div className="flex gap-2">
            <input className={inputCls} value={form.slug || ''} onChange={(e) => set('slug', e.target.value)} placeholder="mein-artikel-titel" />
            <button type="button" onClick={() => set('slug', autoSlug(form.title_de || ''))} className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-500 hover:bg-gray-50 whitespace-nowrap">
              Auto from DE title
            </button>
          </div>
        </div>

        {/* Titles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-1.5">Title (DE) *</label>
            <input className={inputCls} value={form.title_de || ''} onChange={(e) => set('title_de', e.target.value)} placeholder="Mein Blogartikel" />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-1.5">Title (EN) *</label>
            <input className={inputCls} value={form.title_en || ''} onChange={(e) => set('title_en', e.target.value)} placeholder="My Blog Article" />
          </div>
        </div>

        {/* Excerpts */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-1.5">Excerpt (DE)</label>
            <textarea className={textareaCls} rows={2} value={form.excerpt_de || ''} onChange={(e) => set('excerpt_de', e.target.value)} placeholder="Kurze Zusammenfassung auf Deutsch…" />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-1.5">Excerpt (EN)</label>
            <textarea className={textareaCls} rows={2} value={form.excerpt_en || ''} onChange={(e) => set('excerpt_en', e.target.value)} placeholder="Short summary in English…" />
          </div>
        </div>

        {/* Content */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-1.5">Content (DE) *</label>
            <textarea className={textareaCls} rows={16} value={form.content_de || ''} onChange={(e) => set('content_de', e.target.value)} placeholder="Artikel auf Deutsch…" />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-1.5">Content (EN) *</label>
            <textarea className={textareaCls} rows={16} value={form.content_en || ''} onChange={(e) => set('content_en', e.target.value)} placeholder="Article in English…" />
          </div>
        </div>

        {/* Cover image + publish date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-1.5">Cover Image URL</label>
            <input className={inputCls} value={form.cover_image_url || ''} onChange={(e) => set('cover_image_url', e.target.value)} placeholder="https://…" />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-1.5">Publish Date (empty = draft)</label>
            <input
              type="datetime-local"
              className={inputCls}
              value={form.published_at ? form.published_at.slice(0, 16) : ''}
              onChange={(e) => set('published_at', e.target.value ? new Date(e.target.value).toISOString() : null)}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3 pt-2">
          <button onClick={() => handleSave(false)} disabled={saving} className="px-8 py-3 bg-black text-white rounded-xl text-sm font-bold hover:opacity-90 transition disabled:opacity-50">
            {saving ? 'Saving…' : 'Save Draft'}
          </button>
          <button onClick={() => handleSave(true)} disabled={saving} className="px-8 py-3 bg-green-600 text-white rounded-xl text-sm font-bold hover:opacity-90 transition disabled:opacity-50">
            {saving ? '…' : 'Publish Now'}
          </button>
          {!isNew && (
            <button onClick={handleDelete} disabled={deleting} className="px-8 py-3 border border-red-200 text-red-600 rounded-xl text-sm font-bold hover:bg-red-50 transition disabled:opacity-50 ml-auto">
              {deleting ? 'Deleting…' : 'Delete Post'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
