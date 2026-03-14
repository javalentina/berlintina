import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Heart, ArrowUpRight, Star } from 'lucide-react';
import { Show } from '../types';

interface Props {
  show: Show;
  locale: 'de' | 'en';
  onViewDetails: (show: Show) => void;
  index?: number;
}

const PLACEHOLDER = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="533" fill="%23ECEEF3"%3E%3Crect width="400" height="533"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="%239BA3B5" font-size="13" font-family="sans-serif"%3ENo image%3C/text%3E%3C/svg%3E';

const priceRangeFromShow = (show: Show): string => {
  if (show.priceType === 'POA') return '€€€';
  if (show.priceMin != null) {
    if (show.priceMin < 800) return '€€';
    if (show.priceMin < 2000) return '€€€';
    return '€€€€';
  }
  return '€€€';
};

export const ShowCard: React.FC<Props> = ({ show, locale, onViewDetails, index = 0 }) => {
  const [liked, setLiked] = useState(false);
  const imageUrl = show.photoUrls?.[0] || PLACEHOLDER;
  const priceRange = priceRangeFromShow(show);
  const tags = show.vibeTags?.slice(0, 2) ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      className="masonry-col-item group"
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => onViewDetails(show)}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onViewDetails(show)}
        className="relative bg-surface rounded-2xl overflow-hidden shadow-soft hover-lift hover:shadow-card-hover cursor-pointer border border-transparent hover:border-warm-border focus:outline-none focus:ring-2 focus:ring-terracotta focus:ring-offset-2"
      >
        {/* Image */}
        <div className="relative overflow-hidden">
          <img
            src={imageUrl}
            alt={show.title}
            loading="lazy"
            className="w-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
          {/* Hover overlay */}
          <div className="absolute inset-0 bg-charcoal/0 group-hover:bg-charcoal/10 transition-colors duration-500" />

          {/* Top badges */}
          <div className="absolute top-3 left-3 right-3 flex justify-between items-start">
            <span className="bg-glass text-charcoal text-[10px] font-medium tracking-wider uppercase px-3 py-1.5 rounded-full">
              {show.category}
            </span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setLiked(l => !l); }}
              onKeyDown={(e) => e.stopPropagation()}
              className="w-8 h-8 rounded-full bg-glass flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 hover:scale-110 active:scale-95"
            >
              <Heart className={`w-4 h-4 ${liked ? 'fill-terracotta text-terracotta' : 'text-charcoal'}`} />
            </button>
          </div>

          {/* Arrow on hover */}
          <div className="absolute bottom-3 right-3 w-10 h-10 rounded-full bg-surface flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 shadow-soft">
            <ArrowUpRight className="w-4 h-4 text-charcoal" />
          </div>
        </div>

        {/* Info */}
        <div className="p-4">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Star className="w-3 h-3 text-charcoal fill-charcoal" />
            <span className="text-xs font-medium text-charcoal">5.0</span>
            <span className="text-xs text-warm-muted">· {priceRange}</span>
          </div>
          <h3 className="font-semibold text-sm text-charcoal mb-0.5 tracking-tight leading-snug line-clamp-2">
            {show.title}
          </h3>
          <p className="text-xs text-warm-muted mb-3">
            {locale === 'de' ? 'von' : 'by'} {show.artistName}
          </p>
          <div className="flex gap-1.5 flex-wrap">
            {tags.map((tag) => (
              <span key={tag} className="text-[10px] text-warm-muted bg-surface-alt px-2.5 py-1 rounded-full">
                {tag}
              </span>
            ))}
            <span className="text-[10px] text-warm-muted bg-surface-alt px-2.5 py-1 rounded-full">
              {show.durationMinutes} min
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
