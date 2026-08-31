/**
 * Hier standen bis 2026-08-31 zusätzlich `MOCK_SHOWS` — Beispiel-Shows für den Fall, dass
 * kein Supabase-Client konfiguriert ist. Diesen Fall gibt es nicht mehr: Shows kommen
 * ausschliesslich über die Express-API (siehe Kommentar in services/showsService.ts).
 * Mit den Mock-Daten sind auch die Typ-Importe entfallen, die nur sie brauchten.
 */
export const VIBE_OPTIONS = [
  'Elegant / Premium',
  'Energetisch / Party',
  'Spektakulär / Wow-Effekt',
  'Interaktiv',
  'Hintergrund / Ambient',
  'Humorvoll'
];
