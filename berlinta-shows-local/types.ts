export enum Category {
  CLASSICAL = 'CLASSICAL',
  BAND = 'BAND',
  ACROBATICS = 'ACROBATICS',
  DANCE = 'DANCE'
}

export enum PriceType {
  RANGE = 'RANGE',
  POA = 'POA'
}

export enum ArtistStatus {
  PUBLISHED = 'PUBLISHED',
  NEEDS_REVIEW = 'NEEDS_REVIEW'
}

export enum ContactMode {
  WEBSITE_ONLY = 'WEBSITE_ONLY',
  PLATFORM_ONLY = 'PLATFORM_ONLY'
}

export interface ShowTestimonial {
  quote: string;
  name: string;
}

export interface Show {
  id: string;
  shortId: string;
  slug: string;
  artistId: string;
  artistName: string;
  title: string;
  category: Category;
  instrumentationText?: string;
  extractedTags: string[];
  vibeTags: string[];
  shortDescriptionFacts: string;
  salesPitchText: string;
  durationMinutes: number;
  languageOptions: string[];
  priceType: PriceType;
  priceMin?: number;
  priceMax?: number;
  photoUrls: string[];
  videoUrls: string[];
  requirements?: any;
  status: ArtistStatus;
  // Show detail fields (marketing funnel)
  cast?: string;
  idealFor?: string;
  placement?: string;
  audienceRange?: string;
  stageMin?: string;
  stageIdeal?: string;
  ceilingMin?: string;
  soundShort?: string;
  lightShort?: string;
  timingsShort?: string;
  riderPdfUrl?: string;
  testimonials?: ShowTestimonial[];
  faqOutdoor?: string;
  faqStage?: string;
  faqLanguage?: string;
  faqCustom?: string;
  faqTravel?: string;
}

export interface CustomerBrief {
  eventType?: string | null;
  eventDate?: string | null;
  locationCity?: string | null;
  audienceCount?: number | null;
  desiredCategories?: string[];
  desiredVibes?: string[];
  durationMinutes?: number | null;
  budgetMax?: number | null;
  languagePreference?: string | null;
  extraNotes?: string;
}

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

export interface BlogPost {
  id: string;
  slug: string;
  titleDe: string;
  titleEn: string;
  excerptDe: string;
  excerptEn: string;
  contentDe: string;
  contentEn: string;
  coverImageUrl?: string;
  publishedAt: string | null;
  createdAt?: string;
}
