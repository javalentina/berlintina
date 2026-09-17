// What people actually do on the site, reported to Google Analytics.
//
// Without this the account counts page views and nothing else: we would see that
// three hundred people arrived and never learn how many of them wrote. Paid ads
// also need it — with no conversion event Google optimises towards clicks, which
// buys the people most likely to click and not the ones most likely to book.
//
// Nothing here may ever break the page: analytics is the least important thing
// happening at the moment a visitor decides to get in touch. Every call is guarded
// and silent on failure, and the consent banner still governs whether gtag exists
// at all — if the visitor declined, these calls simply do nothing.

type Params = Record<string, string | number | undefined>;

export function track(name: string, params: Params = {}): void {
  try {
    const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
    if (typeof gtag !== 'function') return;
    const clean: Params = {};
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') clean[k] = v;
    gtag('event', name, clean);
  } catch {
    /* analytics must never take the page down */
  }
}

/** The one that counts: an enquiry actually reached us. */
export const ANFRAGE_GESENDET = 'anfrage_gesendet';
/** Second real way in — she says people write or call. */
export const WHATSAPP_GEKLICKT = 'whatsapp_geklickt';
/** Funnel step: the form was opened but not necessarily sent. */
export const ANFRAGE_GEOEFFNET = 'anfrage_geoeffnet';
/** Which name on the poster pulls — the producer's own billing question. */
export const AUSHANG_NAME_GEKLICKT = 'aushang_name_geklickt';
/** An artist page was opened, and from where. */
export const KUENSTLERSEITE_GEOEFFNET = 'kuenstlerseite_geoeffnet';
