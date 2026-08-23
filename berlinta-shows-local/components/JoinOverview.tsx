import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import * as apiClient from '../services/apiClient';
import { submitArtistOnboarding } from '../services/submissionsService';
import { getStoredArtistToken, setStoredArtistToken } from '../services/artistService';

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export interface JoinOverviewProps {
  initialDraft: Record<string, unknown>;
  honeypot: string;
  locale: 'de' | 'en';
  onBack: () => void;
  /** Photo from chat step (single file) */
  initialPhotoFile?: File | null;
}

export const JoinOverview: React.FC<JoinOverviewProps> = ({
  initialDraft,
  honeypot,
  locale,
  onBack,
  initialPhotoFile,
}) => {
  const [draft, setDraft] = useState<Record<string, unknown>>({ ...initialDraft });
  const [photoFiles, setPhotoFiles] = useState<File[]>(initialPhotoFile ? [initialPhotoFile] : []);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [polishingField, setPolishingField] = useState<string | null>(null);

  const update = (key: string, value: unknown) => setDraft((d) => ({ ...d, [key]: value }));

  const existingPhotoUrls = (Array.isArray(draft.photoUrls) ? draft.photoUrls : []) as string[];
  const initialVideoUrls = (Array.isArray(draft.videoUrls) ? draft.videoUrls : []) as string[];
  const [videoInputs, setVideoInputs] = useState<string[]>(initialVideoUrls.length ? initialVideoUrls : ['']);

  const addVideoUrl = () => setVideoInputs((v) => [...v, '']);
  const removeVideoUrl = (i: number) => setVideoInputs((v) => v.filter((_, j) => j !== i));
  const setVideoUrl = (i: number, val: string) =>
    setVideoInputs((v) => {
      const next = [...v];
      next[i] = val;
      return next;
    });
  const finalVideoUrls = videoInputs.map((s) => s.trim()).filter(Boolean);

  const handlePolish = async (field: 'shortDescriptionFacts' | 'salesPitchText' | 'artistBio') => {
    const raw = String(draft[field] || '').trim();
    if (!raw) return;
    setPolishingField(field);
    try {
      const polished = await apiClient.polishText(raw, field, locale);
      update(field, polished);
    } catch (e) {
      // ignore
    } finally {
      setPolishingField(null);
    }
  };

  const addPhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length) setPhotoFiles((p) => [...p, ...files.filter((f) => f.type.startsWith('image/'))]);
    e.target.value = '';
  };
  const removePhoto = (i: number) => setPhotoFiles((p) => p.filter((_, j) => j !== i));

  const handleSubmit = async () => {
    const submitterEmail = String(draft.submitterEmail || '').trim();
    const showTitle = String(draft.showTitle || '').trim();
    if (!submitterEmail || !submitterEmail.includes('@')) {
      setSubmitError(locale === 'de' ? 'E-Mail ist erforderlich.' : 'Email is required.');
      return;
    }
    if (!showTitle) {
      setSubmitError(locale === 'de' ? 'Show-Titel ist erforderlich.' : 'Show title is required.');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const photoBase64Array: string[] = [];
      for (const f of photoFiles) {
        photoBase64Array.push(await fileToBase64(f));
      }
      const payload = {
        artistName: draft.artistName as string | undefined,
        artistGenre: draft.artistGenre as string | undefined,
        showTitle,
        websiteUrl: draft.websiteUrl as string | undefined,
        photoUrls: existingPhotoUrls,
        photoBase64Array: photoBase64Array.length ? photoBase64Array : undefined,
        mediaLinks: typeof draft.mediaLinks === 'string' ? draft.mediaLinks : undefined,
        videoUrls: finalVideoUrls.length ? finalVideoUrls : undefined,
        durationMinutes: typeof draft.durationMinutes === 'number' ? draft.durationMinutes : undefined,
        languageOptions: Array.isArray(draft.languageOptions) ? draft.languageOptions as string[] : undefined,
        priceText: draft.priceText as string | undefined,
        shortDescriptionFacts: draft.shortDescriptionFacts as string | undefined,
        salesPitchText: draft.salesPitchText as string | undefined,
        socialLinks: draft.socialLinks as string | undefined,
        artistBio: draft.artistBio as string | undefined,
        faqOutdoor: draft.faqOutdoor as string | undefined,
        faqStage: draft.faqStage as string | undefined,
        faqLanguage: draft.faqLanguage as string | undefined,
        faqCustom: draft.faqCustom as string | undefined,
        faqTravel: draft.faqTravel as string | undefined,
        submitterEmail,
        honeypot: honeypot || undefined,
        artistToken: getStoredArtistToken() ?? undefined,
      };
      const result = await submitArtistOnboarding(payload);
      setSubmissionId(result.submissionId);
      if (result.artistToken) setStoredArtistToken(result.artistToken);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submissionId) {
    return (
      <div className="w-full max-w-3xl mx-auto px-4 py-24 text-center">
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

  const polishBtn = (field: 'shortDescriptionFacts' | 'salesPitchText' | 'artistBio', label: string) => (
    <button
      type="button"
      onClick={() => handlePolish(field)}
      disabled={!String(draft[field] || '').trim() || polishingField !== null}
      className="text-xs font-bold text-gray-500 hover:text-black transition disabled:opacity-40"
    >
      {polishingField === field ? (locale === 'de' ? '…' : '…') : label}
    </button>
  );

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-12">
      <div className="mb-10 flex items-center justify-between">
        <h1 className="font-display text-3xl md:text-4xl font-normal tracking-tight text-charcoal">
          {locale === 'de' ? 'Deine Show im Überblick' : 'Your Show Overview'}
        </h1>
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 text-sm font-bold text-gray-500 hover:text-black transition"
        >
          ← {locale === 'de' ? 'Zurück' : 'Back'}
        </button>
      </div>

      <p className="text-gray-500 mb-12 font-medium">
        {locale === 'de'
          ? 'Prüfe alle Angaben, bearbeite falls nötig und lade Fotos oder Videos hinzu. Dann absenden.'
          : 'Review all details, edit if needed, and add photos or videos. Then submit.'}
      </p>

      {submitError && (
        <div className="mb-8 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm font-medium">
          {submitError}
        </div>
      )}

      <div className="space-y-12">
        {/* Artist name */}
        <div>
          <label className="block text-sm font-semibold text-warm-muted mb-2">{locale === 'de' ? 'Künstlername' : 'Artist name'}</label>
          <input
            type="text"
            value={String(draft.artistName || '')}
            onChange={(e) => update('artistName', e.target.value)}
            className="w-full px-5 py-4 rounded-2xl border border-warm-border text-lg font-medium focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta bg-surface"
            placeholder={locale === 'de' ? 'z.B. Anna Müller / Trio Berlin' : 'e.g. Anna Müller / Berlin Trio'}
          />
        </div>

        {/* Show title */}
        <div>
          <label className="block text-sm font-semibold text-warm-muted mb-2">{locale === 'de' ? 'Show-Titel' : 'Show title'}</label>
          <input
            type="text"
            value={String(draft.showTitle || '')}
            onChange={(e) => update('showTitle', e.target.value)}
            className="w-full px-5 py-4 rounded-2xl border border-warm-border text-lg font-medium focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta bg-surface"
            placeholder={locale === 'de' ? 'z.B. Klassik am Abend' : 'e.g. Classical Evening'}
          />
        </div>

        {/* Genre */}
        <div>
          <label className="block text-sm font-semibold text-warm-muted mb-2">{locale === 'de' ? 'Genre / Kategorie' : 'Genre / Category'}</label>
          <input
            type="text"
            value={String(draft.artistGenre || '')}
            onChange={(e) => update('artistGenre', e.target.value)}
            className="w-full px-5 py-4 rounded-2xl border border-warm-border text-lg font-medium focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta bg-surface"
            placeholder="CLASSICAL, BAND, ACROBATICS, DANCE"
          />
        </div>

        {/* Description + polish */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-bold text-gray-700">{locale === 'de' ? 'Beschreibung' : 'Description'}</label>
            {polishBtn('shortDescriptionFacts', locale === 'de' ? 'Mit KI verfeinern' : 'Beautify with AI')}
          </div>
          <textarea
            value={String(draft.shortDescriptionFacts || '')}
            onChange={(e) => update('shortDescriptionFacts', e.target.value)}
            rows={4}
            className="w-full px-5 py-4 rounded-2xl border border-warm-border text-base leading-relaxed focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta resize-y bg-surface"
            placeholder={locale === 'de' ? 'Kurze Beschreibung deiner Show…' : 'Short description of your show…'}
          />
        </div>

        {/* Sales pitch + polish */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-bold text-gray-700">{locale === 'de' ? 'Verkaufspitch' : 'Sales pitch'}</label>
            {polishBtn('salesPitchText', locale === 'de' ? 'Mit KI verfeinern' : 'Beautify with AI')}
          </div>
          <textarea
            value={String(draft.salesPitchText || '')}
            onChange={(e) => update('salesPitchText', e.target.value)}
            rows={2}
            className="w-full px-5 py-4 rounded-2xl border border-warm-border text-base leading-relaxed focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta resize-y bg-surface"
            placeholder={locale === 'de' ? '1–2 Sätze, die Eventplaner begeistern' : '1–2 sentences that excite event planners'}
          />
        </div>

        {/* Artist bio + polish */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-bold text-gray-700">{locale === 'de' ? 'Künstler-Steckbrief' : 'Artist bio'}</label>
            {polishBtn('artistBio', locale === 'de' ? 'Mit KI verfeinern' : 'Beautify with AI')}
          </div>
          <textarea
            value={String(draft.artistBio || '')}
            onChange={(e) => update('artistBio', e.target.value)}
            rows={3}
            className="w-full px-5 py-4 rounded-2xl border border-warm-border text-base leading-relaxed focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta resize-y bg-surface"
            placeholder={locale === 'de' ? 'Kurze Vorstellung…' : 'Short intro…'}
          />
        </div>

        {/* Price & duration */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-semibold text-warm-muted mb-2">{locale === 'de' ? 'Preis' : 'Price'}</label>
            <input
              type="text"
              value={String(draft.priceText || '')}
              onChange={(e) => update('priceText', e.target.value)}
              className="w-full px-5 py-4 rounded-2xl border border-warm-border text-base focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta bg-surface"
              placeholder="z.B. ab 800€ / Individuell"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-warm-muted mb-2">{locale === 'de' ? 'Dauer (Min.)' : 'Duration (min)'}</label>
            <input
              type="number"
              value={draft.durationMinutes ?? ''}
              onChange={(e) => {
                const v = e.target.value;
                update('durationMinutes', v === '' ? undefined : parseInt(v, 10));
              }}
              className="w-full px-5 py-4 rounded-2xl border border-warm-border text-base focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta bg-surface"
              placeholder="60"
            />
          </div>
        </div>

        {/* Social links */}
        <div>
          <label className="block text-sm font-semibold text-warm-muted mb-2">{locale === 'de' ? 'Instagram / Website' : 'Instagram / Website'}</label>
          <input
            type="text"
            value={String(draft.socialLinks || '')}
            onChange={(e) => update('socialLinks', e.target.value)}
            className="w-full px-5 py-4 rounded-2xl border border-warm-border text-base focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta bg-surface"
            placeholder="@handle https://website.com"
          />
        </div>

        {/* Website URL */}
        <div>
          <label className="block text-sm font-semibold text-warm-muted mb-2">{locale === 'de' ? 'Website' : 'Website'}</label>
          <input
            type="url"
            value={String(draft.websiteUrl || '')}
            onChange={(e) => update('websiteUrl', e.target.value)}
            className="w-full px-5 py-4 rounded-2xl border border-warm-border text-base focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta bg-surface"
            placeholder="https://…"
          />
        </div>

        {/* FAQ Section */}
        <div>
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4">{locale === 'de' ? 'FAQ — Häufige Buchungsfragen' : 'FAQ — Common booking questions'}</h3>
          <div className="space-y-6">
            {[
              { key: 'faqOutdoor', label: locale === 'de' ? 'Outdoor möglich?' : 'Outdoor possible?', placeholder: locale === 'de' ? 'z.B. Ja, bei trockenem Wetter' : 'e.g. Yes, in dry weather' },
              { key: 'faqStage', label: locale === 'de' ? 'Mindest-Bühnengröße?' : 'Minimum stage size?', placeholder: locale === 'de' ? 'z.B. 4×3m' : 'e.g. 4×3m' },
              { key: 'faqLanguage', label: locale === 'de' ? 'Sprachabhängig / Sprachen?' : 'Language-dependent / languages?', placeholder: locale === 'de' ? 'z.B. Nicht sprachabhängig / DE + EN' : 'e.g. Not language-dependent / DE + EN' },
              { key: 'faqCustom', label: locale === 'de' ? 'Anpassbar (Branding/Theme)?' : 'Customizable (branding/theme)?', placeholder: locale === 'de' ? 'z.B. Ja, Logo-Integration möglich' : 'e.g. Yes, logo integration possible' },
              { key: 'faqTravel', label: locale === 'de' ? 'Reise / Standort?' : 'Travel / location?', placeholder: locale === 'de' ? 'z.B. Berlin-basiert, bundesweit reisend' : 'e.g. Berlin-based, travel nationwide' },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="block text-sm font-semibold text-warm-muted mb-2">{label}</label>
                <input
                  type="text"
                  value={String((draft as Record<string, unknown>)[key] || '')}
                  onChange={(e) => update(key, e.target.value)}
                  className="w-full px-5 py-3 rounded-2xl border border-warm-border text-base focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta bg-surface"
                  placeholder={placeholder}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Photos */}
        <div>
          <label className="block text-sm font-semibold text-warm-muted mb-2">{locale === 'de' ? 'Fotos' : 'Photos'}</label>
          <div className="flex flex-wrap gap-4">
            {existingPhotoUrls.map((url, i) => (
              <div key={`url-${i}`} className="relative w-24 h-24 rounded-xl overflow-hidden border border-gray-200 bg-gray-100">
                <img src={url} alt="" className="w-full h-full object-cover" />
              </div>
            ))}
            {photoFiles.map((file, i) => (
              <div key={`file-${i}`} className="relative group">
                <img src={URL.createObjectURL(file)} alt="" className="w-24 h-24 rounded-xl object-cover border border-gray-200" />
                <button type="button" onClick={() => removePhoto(i)} className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center hover:bg-red-600">
                  ×
                </button>
              </div>
            ))}
            <label className="w-24 h-24 rounded-xl border-2 border-dashed border-warm-border flex items-center justify-center cursor-pointer hover:border-terracotta hover:bg-terracotta-light transition text-warm-faint hover:text-terracotta">
              <span className="text-2xl">+</span>
              <input type="file" accept="image/*" multiple className="sr-only" onChange={addPhotos} />
            </label>
          </div>
        </div>

        {/* Videos */}
        <div>
          <label className="block text-sm font-semibold text-warm-muted mb-2">{locale === 'de' ? 'Video-URLs' : 'Video URLs'}</label>
          <div className="space-y-3">
            {videoInputs.map((url, i) => (
              <div key={i} className="flex gap-2">
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setVideoUrl(i, e.target.value)}
                  placeholder="https://…"
                  className="flex-1 px-5 py-3 rounded-xl border border-warm-border focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta bg-surface"
                />
                <button type="button" onClick={() => removeVideoUrl(i)} className="px-4 py-2 text-gray-500 hover:text-red-600 font-medium">
                  ×
                </button>
              </div>
            ))}
            <button type="button" onClick={addVideoUrl} className="text-sm font-bold text-gray-500 hover:text-black">
              + {locale === 'de' ? 'Video hinzufügen' : 'Add video'}
            </button>
          </div>
        </div>

        {/* Email (read-only display) */}
        <div>
          <label className="block text-sm font-semibold text-warm-muted mb-2">{locale === 'de' ? 'E-Mail' : 'Email'}</label>
          <input
            type="email"
            value={String(draft.submitterEmail || '')}
            onChange={(e) => update('submitterEmail', e.target.value)}
            className="w-full px-5 py-4 rounded-2xl border border-warm-border text-base focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta bg-surface"
            placeholder="deine@email.de"
          />
        </div>
      </div>

      <div className="mt-16 pt-12 border-t border-warm-border">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full py-6 bg-terracotta text-white rounded-2xl font-semibold text-lg hover:bg-terracotta-dark transition disabled:opacity-50"
        >
          {submitting ? (locale === 'de' ? 'Wird gesendet…' : 'Sending…') : (locale === 'de' ? 'Zur Prüfung senden' : 'Send to review')}
        </button>
      </div>
    </div>
  );
};
