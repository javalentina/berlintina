import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const BASE_URL = 'https://berlintina.de';
const DEFAULT_OG_IMAGE = `${BASE_URL}/og-image.jpg`;

interface PageSEOProps {
  title: string;
  description: string;
  ogImage?: string;
  ogType?: 'website' | 'article';
  structuredData?: object;
  noindex?: boolean;
}

/** Injects a JSON-LD <script> into <head>, cleaned up on unmount. */
const JsonLd: React.FC<{ data: object }> = ({ data }) => {
  useEffect(() => {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(data);
    document.head.appendChild(script);
    return () => { document.head.removeChild(script); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
};

/**
 * Drop-in SEO component. Uses React 19's built-in metadata hoisting so
 * <title> / <meta> / <link> elements placed anywhere in the tree are
 * automatically moved to <head>.
 */
export const PageSEO: React.FC<PageSEOProps> = ({
  title,
  description,
  ogImage = DEFAULT_OG_IMAGE,
  ogType = 'website',
  structuredData,
  noindex = false,
}) => {
  const { pathname } = useLocation();
  const canonical = `${BASE_URL}${pathname}`;

  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description} />
      {noindex && <meta name="robots" content="noindex,nofollow" />}

      <link rel="canonical" href={canonical} />

      {/* Open Graph */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:type" content={ogType} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:site_name" content="Berlintina" />
      <meta property="og:locale" content="de_DE" />

      {/* Twitter / X card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {structuredData && <JsonLd data={structuredData} />}
    </>
  );
};
