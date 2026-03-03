import React from 'react';
import { Show } from '../types';

interface Props {
  show: Show;
  locale: 'de' | 'en';
  onViewDetails: (show: Show) => void;
}

const PLACEHOLDER = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="533" fill="%23f1f1ef"%3E%3Crect width="400" height="533"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="%23bbb" font-size="13" font-family="sans-serif"%3ENo image%3C/text%3E%3C/svg%3E';

export const ShowCard: React.FC<Props> = ({ show, locale, onViewDetails }) => {
  const imageUrl = show.photoUrls?.[0] || PLACEHOLDER;

  const priceLabel = show.priceType === 'POA'
    ? (locale === 'de' ? 'Auf Anfrage' : 'On request')
    : show.priceMin != null
      ? (locale === 'de' ? `ab ${show.priceMin}€` : `from ${show.priceMin}€`)
      : show.priceMax != null
        ? `≤ ${show.priceMax}€`
        : (locale === 'de' ? 'Auf Anfrage' : 'On request');

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onViewDetails(show)}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onViewDetails(show)}
      className="group cursor-pointer bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-lg transition-shadow duration-300 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2"
    >
      {/* Image */}
      <div className="aspect-[3/4] relative overflow-hidden bg-[#f1f1ef]">
        <img
          src={imageUrl}
          alt={show.title}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500 ease-out"
        />
        {/* Category chip — top left */}
        <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-white/90 backdrop-blur-sm text-gray-700">
          {show.category}
        </span>
        {/* Price chip — top right */}
        <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-bold bg-black/70 backdrop-blur-sm text-white">
          {priceLabel}
        </span>
      </div>

      {/* Info strip */}
      <div className="px-4 py-3">
        <h3 className="text-sm font-bold leading-snug line-clamp-2 text-gray-900 mb-1">
          {show.title}
        </h3>
        <p className="text-[11px] text-gray-400 font-medium mb-2 truncate">{show.artistName}</p>
        {(show.vibeTags?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-1">
            {show.vibeTags.slice(0, 2).map(tag => (
              <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-[#f1f1ef] text-gray-500 font-medium">
                {tag}
              </span>
            ))}
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#f1f1ef] text-gray-500 font-medium">
              {show.durationMinutes} min
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
