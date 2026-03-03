import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Show } from '../types';
import { fetchShowsFromSupabase } from '../services/showsService';

type ShowsContextValue = { shows: Show[]; loading: boolean; error: string | null };

const ShowsContext = createContext<ShowsContextValue>({ shows: [], loading: true, error: null });

export function ShowsProvider({ children }: { children: React.ReactNode }) {
  const [shows, setShows] = useState<Show[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchShowsFromSupabase().then(({ shows: data, error: err }) => {
      if (!cancelled) {
        setShows(data);
        setError(err);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  return (
    <ShowsContext.Provider value={{ shows, loading, error }}>
      {children}
    </ShowsContext.Provider>
  );
}

export function useShows(): ShowsContextValue {
  const ctx = useContext(ShowsContext);
  if (!ctx) throw new Error('useShows must be used within ShowsProvider');
  return ctx;
}
