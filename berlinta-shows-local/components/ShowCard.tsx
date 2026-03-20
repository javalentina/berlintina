import React from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import { Show } from '../types';

interface Props {
  show: Show;
  locale: 'de' | 'en';
  onViewDetails: (show: Show) => void;
  index?: number;
}

const PLACEHOLDER = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="533" fill="%23EAEAEA"%3E%3Crect width="400" height="533"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="%23999" font-size="13" font-family="sans-serif"%3ENo image%3C/text%3E%3C/svg%3E';

export const ShowCard: React.FC<Props> = ({ show, locale, onViewDetails, index = 0 }) => {
  const imageUrl = show.photoUrls?.[0] || PLACEHOLDER;

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
        className="relative overflow-hidden cursor-pointer border border-foreground/10 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
      >
        {/* Image — grayscale, color on hover */}
        <div className="relative overflow-hidden">
          <img
            src={imageUrl}
            alt={show.title}
            loading="lazy"
            className="w-full object-cover transition-all duration-700 group-hover:scale-105"
          />

          {/* Hover overlay with title/category */}
          <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/40 transition-colors duration-500 flex flex-col items-center justify-center">
            <div className="translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-400 text-center px-5">
              <p className="font-display text-xl font-bold text-background leading-tight mb-1">{show.title}</p>
              <span className="label-style text-background/80">{show.category}</span>
            </div>
          </div>

          {/* Category badge — top left */}
          <span className="absolute top-3 left-3 label-style bg-background/90 px-2.5 py-1">
            {show.category}
          </span>

          {/* Arrow — bottom right */}
          <div className="absolute bottom-3 right-3 w-9 h-9 bg-background flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
            <ArrowUpRight className="w-4 h-4 text-foreground" />
          </div>
        </div>

        {/* Info below image */}
        <div className="pt-3 pb-4 px-0">
          <h3 className="font-display text-base font-bold text-foreground leading-snug tracking-tight line-clamp-1">
            {show.title}
          </h3>
          <p className="label-style mt-1">
            {locale === 'de' ? 'von' : 'by'} {show.artistName}
          </p>
        </div>
      </div>
    </motion.div>
  );
};
