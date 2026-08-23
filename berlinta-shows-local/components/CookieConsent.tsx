import React, { useEffect, useState } from 'react';

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

export const CookieConsent: React.FC<{ locale: 'de' | 'en' }> = ({ locale }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem('cookie_consent')) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  const choose = (granted: boolean) => {
    try { localStorage.setItem('cookie_consent', granted ? 'granted' : 'denied'); } catch {}
    if (granted) window.gtag?.('consent', 'update', { analytics_storage: 'granted' });
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[60] border-t border-foreground/10 bg-background/95 backdrop-blur-md">
      <div className="container py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground max-w-2xl">
          {locale === 'de'
            ? 'Wir nutzen Cookies, um zu verstehen, wie Besucher unsere Seite nutzen (Google Analytics). Keine Daten ohne deine Zustimmung.'
            : 'We use cookies to understand how visitors use our site (Google Analytics). No data without your consent.'}
          {' '}
          <a href="/datenschutz" className="underline hover:text-foreground">
            {locale === 'de' ? 'Mehr erfahren' : 'Learn more'}
          </a>
        </p>
        <div className="flex items-center gap-3 flex-shrink-0">
          <button
            onClick={() => choose(false)}
            className="text-sm font-semibold px-4 py-2 rounded-full text-muted-foreground hover:text-foreground transition-colors"
          >
            {locale === 'de' ? 'Ablehnen' : 'Decline'}
          </button>
          <button
            onClick={() => choose(true)}
            className="bg-accent text-accent-foreground text-sm font-semibold px-5 py-2 rounded-full hover:opacity-90 transition-opacity"
          >
            {locale === 'de' ? 'Akzeptieren' : 'Accept'}
          </button>
        </div>
      </div>
    </div>
  );
};
