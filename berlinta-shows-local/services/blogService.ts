import { BlogPost } from '../types';

const base = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
const API_BASE = base ? `${base}/api` : '/api';

function mapPost(raw: Record<string, unknown>): BlogPost {
  return {
    id: raw.id as string,
    slug: raw.slug as string,
    titleDe: (raw.title_de as string) || '',
    titleEn: (raw.title_en as string) || '',
    excerptDe: (raw.excerpt_de as string) || '',
    excerptEn: (raw.excerpt_en as string) || '',
    contentDe: (raw.content_de as string) || '',
    contentEn: (raw.content_en as string) || '',
    coverImageUrl: (raw.cover_image_url as string) || undefined,
    publishedAt: (raw.published_at as string) || null,
    createdAt: (raw.created_at as string) || undefined,
  };
}

export async function fetchBlogPosts(): Promise<BlogPost[]> {
  try {
    const res = await fetch(`${API_BASE}/blog`);
    if (!res.ok) return [];
    const { posts } = await res.json();
    return (posts || []).map(mapPost);
  } catch {
    return [];
  }
}

export async function fetchBlogPost(slug: string): Promise<BlogPost | null> {
  try {
    const res = await fetch(`${API_BASE}/blog/${encodeURIComponent(slug)}`);
    if (!res.ok) return null;
    const { post } = await res.json();
    return post ? mapPost(post) : null;
  } catch {
    return null;
  }
}
