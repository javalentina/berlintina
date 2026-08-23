#!/usr/bin/env node
/**
 * Prerender für berlintina.de — erzeugt pro öffentlicher Route einen HTML-Schnappschuss
 * mit fertigem Text, statt jedem Crawler nur `<div id="root">Loading…</div>` zu liefern.
 *
 * Warum das nötig ist: Google rendert JavaScript inzwischen meistens, aber verzögert und
 * ohne Garantie. KI-Suchen (ChatGPT, Perplexity, Claude) rendern **gar nicht** — sie lesen
 * das HTML, das der Server schickt. Ohne diesen Schritt ist die Seite für sie leer.
 *
 * Gemessen am 2026-08-23 an der Live-Seite: 78 Zeichen sichtbarer Text („Loading…") und
 * NULL JSON-LD-Blöcke im Auslieferungs-HTML — obwohl FAQPage-Schema und Testimonials im
 * Code stehen. Beides entsteht erst im Browser und erreicht keinen Crawler.
 *
 * Ablauf: Vite baut nach dist/ → dieses Skript startet einen lokalen Server auf dist/,
 * lädt jede Route mit einem echten Chrome, wartet auf den fertigen DOM und schreibt das
 * Ergebnis als dist/<route>/index.html. Der Express-Server liefert diese Dateien dann
 * direkt aus (siehe server/index.js, Block „Prerenderte Seiten zuerst").
 *
 * Läuft als `postbuild`, also automatisch bei jedem `npm run build`.
 */
import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync, accessSync, constants } from "node:fs";
import { join, extname, dirname, delimiter } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WURZEL = join(__dirname, "..");
const DIST = join(WURZEL, "dist");
const PORT = 45711;

/**
 * EINE Quelle für die Routenliste: die eigene sitemap.xml.
 *
 * Vorher stand dieselbe Wahrheit an drei Stellen (Sitemap, Prerender, Server) und lief
 * auseinander, sobald eine Seite dazukam. Jetzt gilt: was in der Sitemap steht, wird
 * prerendert — und was prerendert ist, steht in der Sitemap. Eine neue Seite wird an
 * genau einer Stelle eingetragen.
 *
 * Bewusst NICHT dabei (stehen deshalb auch nicht in der Sitemap):
 *   /admin/*          — nicht öffentlich, gehört nie in einen Index
 *   /results/:briefId — persönliche Ergebnisse fremder Anfragen
 *   /artist           — Portal-Fläche für eingeloggte Künstler, kein Suchziel
 *   /show/:slug, /blog/:slug — Inhalt kommt aus der Datenbank; sinnvoll nur mit einem
 *                       Abruf zur Bauzeit (Ausbaustufe 2, siehe PR-Beschreibung)
 */
async function routenAusSitemap() {
  const xml = await readFile(join(WURZEL, "public", "sitemap.xml"), "utf8");
  const routen = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)]
    .map((m) => m[1].replace(/^https?:\/\/[^/]+/, ""))
    .map((p) => (p === "" ? "/" : p.replace(/\/$/, "") || "/"));
  const eindeutig = [...new Set(routen)];
  if (eindeutig.length === 0) throw new Error("sitemap.xml enthält keine <loc>-Einträge.");
  return eindeutig;
}

/**
 * Chrome finden, ohne auf einen einzigen fest verdrahteten Pfad zu wetten.
 *
 * Der frühere Entwurf trug `/root/.nix-profile/bin/chromium` als feste Annahme — richtig
 * geraten oder nicht, das hätte man erst am roten Build gesehen. Hier wird der Reihe nach
 * gesucht: gesetzte Umgebungsvariable → PATH (dort legt nixpacks das Paket ab) → die
 * üblichen Systempfade. Erst wenn nichts davon existiert, bricht der Build ab.
 */
function chromeFinden() {
  const ausEnv = process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_PATH;
  if (ausEnv) {
    if (existsSync(ausEnv)) return ausEnv;
    throw new Error(`PUPPETEER_EXECUTABLE_PATH zeigt auf "${ausEnv}" — dort liegt nichts.`);
  }

  const namen = ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable"];
  for (const verzeichnis of (process.env.PATH ?? "").split(delimiter).filter(Boolean)) {
    for (const name of namen) {
      const pfad = join(verzeichnis, name);
      try {
        accessSync(pfad, constants.X_OK);
        return pfad;
      } catch {
        /* nächster Kandidat */
      }
    }
  }

  const systempfade = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/chromium",
    "/usr/bin/google-chrome",
  ];
  for (const pfad of systempfade) if (existsSync(pfad)) return pfad;

  throw new Error(
    "Kein Chrome/Chromium gefunden. Auf Railway liefert nixpacks.toml das Paket `chromium`; " +
      "lokal genügt ein installiertes Google Chrome. Notfalls PUPPETEER_EXECUTABLE_PATH setzen.",
  );
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
};

const API_ORIGIN = process.env.PRERENDER_API_ORIGIN || "https://berlintina.de";

/**
 * Die Showseiten dazuholen — der eigentliche Inhalt dieser Agentur.
 *
 * Gemessen am 2026-08-23, vor dieser Änderung: `/show/supertalent-showact` lieferte
 * byte-identisch dieselbe Seite wie `/`. Für Besucher unsichtbar (deren Browser lädt die
 * Show nach), für Google und jede KI-Suche existierte **keine einzige Show**. Bei einer
 * Künstleragentur ist genau das der Umsatzpfad: Wer „Akrobatik Show Berlin buchen" sucht,
 * soll die Show finden, nicht die Startseite.
 *
 * Die Liste kommt aus derselben öffentlichen API, die auch der Katalog benutzt — es
 * braucht keinen Datenbankzugang aus dem Build heraus.
 */
async function showRouten() {
  try {
    const antwort = await fetch(`${API_ORIGIN}/api/shows`, { headers: { accept: "application/json" } });
    if (!antwort.ok) throw new Error(`HTTP ${antwort.status}`);
    const daten = await antwort.json();
    const liste = Array.isArray(daten) ? daten : (daten.shows ?? daten.data ?? []);

    const routen = [];
    for (const show of liste) {
      const slug = show?.slug;
      // Nur unauffällige Slugs. Ein Wert mit Schrägstrich oder Punkt käme als
      // Verzeichnispfad heraus und könnte aus dist/ herauszeigen; ein leerer Wert
      // überschriebe dist/index.html. Beides wäre still und schwer zu finden.
      if (typeof slug !== "string" || !/^[a-z0-9][a-z0-9-]*$/i.test(slug)) {
        console.warn(`  ! Show ohne brauchbaren Slug übersprungen: ${JSON.stringify(show?.slug)}`);
        continue;
      }
      routen.push({
        route: `/show/${slug}`,
        titel: typeof show?.title === "string" ? show.title : null,
        // Eigenes Datum statt des Datums der statischen Sitemap: sonst behauptet eine
        // heute angelegte Show den Stand der zuletzt bearbeiteten Seite.
        stand: typeof show?.created_at === "string" ? show.created_at.slice(0, 10) : null,
      });
    }
    return routen;
  } catch (e) {
    // Nicht fatal: ohne Showseiten ist der Build ärmer, aber nicht kaputt. Der Guard
    // weiter unten meldet die Zahl, damit ein stiller Ausfall auffällt.
    console.warn(`  ! Showseiten konnten nicht aufgezählt werden (${e.message}) — Build läuft ohne sie weiter.`);
    return [];
  }
}

const STATISCHE_ROUTEN = await routenAusSitemap();
const SHOWS = await showRouten();
const SHOW_ROUTEN = SHOWS.map((s) => s.route);
const ROUTES = [...STATISCHE_ROUTEN, ...SHOW_ROUTEN];
const CHROME = chromeFinden();

/**
 * Woher der Prerender die Daten holt.
 *
 * Der Katalog lädt seine Shows zur Laufzeit von `/api/shows`. Ein Prerender-Server, der nur
 * dist/ ausliefert, beantwortet das nicht — dann speichert der Schnappschuss „Keine Shows
 * gefunden.", und ein Crawler liest auf der Katalogseite einer Künstleragentur, dass es
 * keine Künstler gibt. Das wäre schlechter als gar kein Prerender. Gemessen: genau so
 * passiert, bevor dieser Block da war.
 *
 * Deshalb reicht der Server unten `/api/*` an die laufende Seite weiter. Es sind dieselben
 * öffentlichen GET-Endpunkte, die auch jeder Besucher abruft — keine Zugangsdaten nötig,
 * kein Datenbankzugriff aus dem Build heraus.
 */


/**
 * Inhaltliche Gegenprobe pro Route: ein Muster, das im fertigen Schnappschuss stehen MUSS.
 *
 * Die reine Zeichenzahl reicht als Nachweis nicht — eine Katalogseite mit Kopf, Filtern und
 * Fußzeile kommt locker über die Mindestlänge und ist trotzdem leer.
 *
 * Bewusst ein positives Muster und keine Liste verbotener Wörter: der erste Entwurf verbot
 * „Keine Shows gefunden" und war wirkungslos — bei toter API steht dort nämlich
 * „0 Shows gefunden". Gemessen, nicht vermutet: der Build lief mit abgeklemmter API grün
 * durch. Ein Guard, der die Abwesenheit eines bekannten Fehlers prüft, übersieht jeden
 * unbekannten; einer, der Anwesenheit von echtem Inhalt verlangt, nicht.
 */
/**
 * HTML-Entities zurueckuebersetzen, bevor irgendetwas darin gesucht wird.
 *
 * Chrome serialisiert `&` als `&amp;`. Ein Muster, das aus Rohdaten gebaut wurde (etwa aus
 * einem Showtitel, wie ihn die API liefert), findet sich im gespeicherten HTML deshalb
 * nicht wieder. Beim ersten Anlauf dieser Datei war das schon einmal der Grund, warum eine
 * Aufraeumregel wirkungslos blieb — und beim Show-Guard waere derselbe Fehler teurer
 * geworden: Eine Show namens „Jim & John Akrobatik" haette JEDEN kuenftigen Deploy rot
 * gemacht, auch solche, die mit dieser Show nichts zu tun haben, mit einer Fehlermeldung,
 * die auf die falsche Ursache zeigt. Gemessen: das Muster trifft ohne diese Funktion nicht.
 */
function entityFrei(text) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

const MUSS_ENTHALTEN = {
  "/catalog": /[1-9]\d* (?:Shows gefunden|shows found)/,
};

/**
 * Jede Showseite muss ihren EIGENEN Titel tragen.
 *
 * Ohne diese Prüfung wäre der Erfolg nicht von der Krankheit zu unterscheiden, die hier
 * behandelt wird: Bisher lieferte /show/<slug> die Startseite — mit reichlich Text, über
 * jeder Mindestlänge, mit gültigem JSON-LD. Ein Guard, der nur Zeichen zählt, hätte das
 * für eine gelungene Showseite gehalten.
 */
for (const { route, titel } of SHOWS) {
  if (titel && titel.trim().length >= 3) {
    MUSS_ENTHALTEN[route] = new RegExp(titel.trim().slice(0, 24).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  }
}

/**
 * Die unberührte Vite-Ausgabe EINMAL in den Speicher lesen, bevor irgendetwas geschrieben
 * wird. Der Prerender überschreibt dist/index.html selbst — würde der Server die Datei bei
 * jeder Anfrage frisch von der Platte lesen, bekäme die zweite Route bereits einen
 * prerenderten Schnappschuss als Startzustand. Das liefe meistens gut und gelegentlich
 * nicht; aus dem Speicher ist es immer dieselbe Hülle.
 */
const HUELLE = await readFile(join(DIST, "index.html"));

/**
 * Zählt mit, wie viele Shows die API im laufenden Durchgang geliefert hat (siehe Proxy).
 * `null` = noch nicht abgefragt oder Antwort unbrauchbar.
 */
let apiShowAnzahl = null;

/** Die kanonische Adresse dieser Seite. Muss zur sitemap.xml passen (dort ohne Schrägstrich). */
const SEITEN_URL = "https://berlintina.de";

/**
 * Den Kopf des Schnappschusses in Ordnung bringen.
 *
 * Hintergrund: index.html trägt einen Satz Vorgabe-Tags („Default SEO — overridden
 * per-page by React PageSEO component"), und die App setzt zur Laufzeit ihre eigenen
 * dazu. Im Browser fällt das nicht auf. Im eingefrorenen HTML stehen dann BEIDE — gemessen
 * am ersten Durchlauf: /about, /catalog, /impressum und /datenschutz hatten je zwei
 * <title>, zwei description und zwei canonical.
 *
 * Zwei Sonderfälle, die dieselbe Ursache haben:
 *   - /join und /blog setzen gar keine eigenen Tags → ihre canonical zeigte auf die
 *     Startseite. Genau so bittet man Google, die Seite nicht eigenständig zu führen.
 *   - Auf / steht die Vorgabe hinter dem App-Titel, ist aber die ausführlichere.
 *
 * Regeln hier, jede bewusst:
 *   1. Bei doppeltem <title>/description gewinnt der App-Wert — das ist die im Kommentar
 *      der index.html erklärte Absicht („overridden per-page"). Entfernt wird gezielt der
 *      bekannte Vorgabe-Wert, nicht „der zweite" — eine Reihenfolge-Annahme hielte nur bis
 *      zum nächsten React-Update.
 *   2. canonical und og:url werden nicht repariert, sondern gesetzt: jede Seite verweist
 *      auf sich selbst. Das ist keine Geschmacksfrage, sondern die einzige richtige
 *      Antwort, und sie wirkt auch für die Routen ohne eigene Tags.
 */
function kopfNormalisieren(html, route) {
  let ergebnis = html;

  // Erst die VORGABE aus index.html gezielt entfernen, dann erst nach Position aussortieren.
  //
  // Die frühere Fassung ging nur nach Position („der erste gewinnt") und war beim <title>
  // richtig, bei der description auf fünf von zehn Seiten falsch. Gemessen am Rohzustand
  // (Normalisierung testweise abgeschaltet):
  //
  //   /about, /catalog, /impressum, /datenschutz, /   description[0] = die VORGABE
  //                                                   description[1] = der eigene Text
  //   /show/<slug>                                    description[0] = der eigene Text
  //                                                   description[1] = eine zweite eigene
  //   /join, /blog                                    nur die Vorgabe (kein eigener Text)
  //
  // Die Reihenfolge, die React 19 beim Hoisting erzeugt, ist also NICHT verlässlich
  // „spezifisch zuerst". Ergebnis der alten Regel: /about, /catalog, /impressum und
  // /datenschutz trugen live denselben generischen Satz wie die Startseite — obwohl die App
  // für jede dieser Seiten längst einen eigenen setzt. Vier Seiten mit Duplicate
  // Description, und die Ursache stand nicht in den Texten, sondern hier.
  //
  // Der Vorgabewert ist kein Sonderwissen und keine Annahme: er wird aus der unberührten
  // Hülle gelesen, die ohnehin im Speicher liegt. Entfernt wird er nur, wenn ein anderer
  // Wert übrig bleibt — sonst behalten /join und /blog gar keine Beschreibung mehr.
  /**
   * ⚠️ Verglichen wird der WERT, entity-frei — nie das rohe Tag.
   *
   * Zwei Unterschiede, die Chrome beim Serialisieren einführt, und die beide gemessen sind:
   *   1. Markup: Vite-Hülle `… 24 h." />`, Schnappschuss `… 24 h.">`.
   *   2. Entities: Hülle `Live-Musik & mehr`, Schnappschuss `Live-Musik &amp; mehr`.
   *
   * Jeder der beiden allein macht einen String-Vergleich wertlos. Die ersten zwei Anläufe
   * dieses Fixes liefen deshalb wirkungslos durch und sahen grün aus, weil der Fallback
   * („der erste gewinnt") einfach das alte Verhalten fortsetzte.
   *
   * Für (2) gibt es `entityFrei()` bereits weiter oben in dieser Datei — dieselbe Falle hat
   * schon den Show-Guard erwischt. Beim dritten Mal ist es keine Falle mehr, sondern eine
   * Regel: **an jeder Grenze zwischen Quelle und gerendertem HTML wird entity-frei
   * verglichen.**
   */
  const wertVon = (tag) =>
    entityFrei(
      tag.startsWith("<title") ? tag.replace(/<\/?title>/g, "") : (tag.match(/content="(.*?)"/s)?.[1] ?? ""),
    );
  const vorgabeWert = (regex) => {
    const t = HUELLE.toString("utf8").match(regex);
    return t ? wertVon(t[0]) : null;
  };
  const aufraeumen = (regex) => {
    const vorgabe = vorgabeWert(regex);
    let treffer = [...ergebnis.matchAll(regex)].map((t) => t[0]);
    if (vorgabe !== null && treffer.some((t) => wertVon(t) !== vorgabe)) {
      for (const t of treffer.filter((t) => wertVon(t) === vorgabe)) ergebnis = ergebnis.replace(t, "");
      treffer = [...ergebnis.matchAll(regex)].map((t) => t[0]);
    }
    // Was jetzt noch mehrfach dasteht, sind zwei eigene Werte (Showseiten) — dort steht der
    // spezifischere zuerst, also gewinnt der erste.
    for (const t of treffer.slice(1)) ergebnis = ergebnis.replace(t, "");
  };
  aufraeumen(/<title>.*?<\/title>/gs);
  aufraeumen(/<meta\s+name="description"\s+content=".*?"\s*\/?>/gs);

  // Positiver Nachweis, dass die Aufräumarbeit auch wirklich stattgefunden hat. Ohne diese
  // Prüfung meldet ein wirkungsloses replace() einen grünen Build mit doppeltem Kopf.
  const uebrig = {
    title: [...ergebnis.matchAll(/<title>/g)].length,
    description: [...ergebnis.matchAll(/<meta\s+name="description"/g)].length,
  };
  for (const [was, anzahl] of Object.entries(uebrig)) {
    if (anzahl > 1) throw new Error(`${anzahl}× <${was}> im Kopf — Dublette nicht entfernt`);
  }

  /**
   * Zweiter, schärferer Nachweis: hatte die Seite einen EIGENEN Wert, muss der eigene
   * übrig sein — nicht die Vorgabe.
   *
   * „Genau ein Tag im Kopf" allein sagt darüber nichts: die alte Fassung hat auf vier
   * Seiten sauber entdoppelt und dabei jedes Mal den falschen behalten. Ein Guard, der nur
   * zählt, hätte diesen Zustand als grün gemeldet — und hat es monatelang getan.
   */
  for (const [was, regex] of [
    ["title", /<title>.*?<\/title>/gs],
    ["description", /<meta\s+name="description"\s+content=".*?"\s*\/?>/gs],
  ]) {
    const vorgabe = vorgabeWert(regex);
    if (vorgabe === null) continue;
    const rohHatteEigenen = [...html.matchAll(regex)].some((t) => wertVon(t[0]) !== vorgabe);
    const uebrigTag = ergebnis.match(regex)?.[0];
    if (rohHatteEigenen && uebrigTag && wertVon(uebrigTag) === vorgabe) {
      throw new Error(
        `${route}: eigener <${was}> war vorhanden, übrig blieb die Vorgabe aus index.html — ` +
          `die Seite bekäme denselben Text wie alle anderen`,
      );
    }
  }

  // 2. canonical + og:url: alle vorhandenen raus, genau einen richtigen rein.
  ergebnis = ergebnis
    .replace(/\s*<link\s+rel="canonical"[^>]*>/gs, "")
    .replace(/\s*<meta\s+property="og:url"[^>]*>/gs, "");

  const eigeneUrl = route === "/" ? `${SEITEN_URL}/` : `${SEITEN_URL}${route}`;
  const einfuegen =
    `<link rel="canonical" href="${eigeneUrl}">` + `<meta property="og:url" content="${eigeneUrl}">`;
  ergebnis = ergebnis.replace(/<\/head>/i, `${einfuegen}</head>`);

  return ergebnis;
}

const server = createServer(async (req, res) => {
  const roh = req.url ?? "/";
  const pfad = decodeURIComponent(roh.split("?")[0]);

  // API-Anfragen an die laufende Seite weiterreichen (siehe API_ORIGIN oben).
  if (pfad.startsWith("/api/")) {
    // NUR Lesezugriffe. Beim Prerender von /join feuert die Seite unter anderem
    // POST /api/conversation/start — würde die Weiterleitung die Methode still auf GET
    // umschreiben, liefe jeder Railway-Build gegen echte Schreib-Endpunkte der
    // Produktion (Datenbankzeile, womöglich ein bezahlter KI-Aufruf). Dass genau dieser
    // Endpunkt `app.post` ist und ein GET dort ins Leere liefe, wäre Glück, kein Schutz.
    // Deshalb hier ausdrücklich: alles außer GET/HEAD wird lokal mit 405 beantwortet und
    // erreicht die Produktion nie.
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { "Content-Type": "application/json" });
      return res.end('{"error":"prerender proxy is read-only"}');
    }
    try {
      const antwort = await fetch(API_ORIGIN + roh, { headers: { accept: "application/json" } });
      const koerper = Buffer.from(await antwort.arrayBuffer());

      // Mitzählen, was die API wirklich geliefert hat — daran hängt der Inhalts-Guard
      // weiter unten. „Keine Shows in der Datenbank" ist ein zulässiger Zustand und darf
      // den Deploy nicht blockieren; „Shows da, aber nicht im HTML gelandet" muss es.
      if (pfad === "/api/shows") {
        try {
          const daten = JSON.parse(koerper.toString("utf8"));
          const liste = Array.isArray(daten) ? daten : (daten.shows ?? daten.data ?? []);
          if (Array.isArray(liste)) apiShowAnzahl = liste.length;
        } catch {
          /* keine verwertbare Antwort → apiShowAnzahl bleibt null */
        }
      }

      res.writeHead(antwort.status, {
        "Content-Type": antwort.headers.get("content-type") ?? "application/json",
      });
      return res.end(koerper);
    } catch (e) {
      console.error(`  ! API-Weiterleitung fehlgeschlagen für ${roh}: ${e.message}`);
      res.writeHead(502, { "Content-Type": "application/json" });
      return res.end('{"error":"prerender proxy failed"}');
    }
  }

  const kandidat = join(DIST, pfad);
  try {
    if (extname(kandidat) && existsSync(kandidat)) {
      const inhalt = await readFile(kandidat);
      res.writeHead(200, { "Content-Type": MIME[extname(kandidat)] ?? "application/octet-stream" });
      return res.end(inhalt);
    }
    // Alles ohne Dateiendung ist eine Router-Route → immer die unberührte Hülle.
    res.writeHead(200, { "Content-Type": MIME[".html"] });
    res.end(HUELLE);
  } catch {
    res.writeHead(404).end("not found");
  }
});
await new Promise((ok) => server.listen(PORT, ok));

console.log(`Prerender: ${ROUTES.length} Routen aus sitemap.xml · Chrome: ${CHROME}`);
console.log(`           API-Daten von: ${API_ORIGIN}`);

/**
 * Sprache des Schnappschusses: DEUTSCH, erzwungen.
 *
 * Die App wählt ihre Sprache über `navigator.language` (App.tsx:2507) — im Browser eines
 * echten Besuchers richtig, im Prerender-Chrome fatal: der Build-Container hat keine
 * deutsche Locale, `navigator.language` ist dort `en-US`. Gemessen an der Live-Seite nach
 * dem ersten Deploy: JEDE eingefrorene Seite trug englischen Text unter
 * `<html lang="de">` — „Price from 800€", „Request a Quote" — auf einer Berliner
 * Vermittlungsseite. Für Google und die KI-Suche ist das die einzige Fassung, die es gibt;
 * ein deutscher Suchender bekommt ein englisches Snippet, und Sprachauszeichnung und
 * Inhalt widersprechen sich.
 *
 * Lokal fiel es NICHT auf: der Chrome des Entwicklers ist deutsch. Ein Unterschied, den
 * nur die ausgelieferte Fläche zeigt.
 *
 * Der echte Besucher ist unberührt — React übernimmt beim Laden und schaltet nach seiner
 * Browsersprache um. Erzwungen wird auf drei Ebenen, weil `--lang` allein je nach
 * Chrome-Version `navigator.language` nicht sicher setzt.
 */
const SPRACHE = process.env.PRERENDER_LANG || "de-DE";
const SPRACHE_KURZ = SPRACHE.split("-")[0];

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage", `--lang=${SPRACHE}`],
});
let geschrieben = 0;
const fehler = [];

try {
  for (const route of ROUTES) {
    const page = await browser.newPage();

    // Ebene 2 + 3 der Spracherzwingung (siehe SPRACHE oben): der Header für alles, was
    // über HTTP geht, und `navigator.language`/`languages` für die Abfrage in App.tsx.
    await page.setExtraHTTPHeaders({ "Accept-Language": `${SPRACHE},${SPRACHE_KURZ};q=0.9` });
    await page.evaluateOnNewDocument((lang, kurz) => {
      Object.defineProperty(navigator, "language", { get: () => lang });
      Object.defineProperty(navigator, "languages", { get: () => [lang, kurz] });
    }, SPRACHE, SPRACHE_KURZ);

    // Fremde Zähl-/Werbedienste während des Prerenders blocken: kein Bot-Traffic in der
    // GA4-Statistik und keine von außen injizierten Skripte im gespeicherten Schnappschuss.
    // Das INLINE-Snippet aus index.html bleibt unangetastet — es wird mitgespeichert und
    // läuft beim echten Besucher ganz normal. (Tracking ist hier eiserne Regel.)
    await page.setRequestInterception(true);
    page.on("request", (r) => {
      const fremd = /googletagmanager|google-analytics|facebook|doubleclick|hotjar|clarity\.ms/.test(r.url());
      fremd ? r.abort() : r.continue();
    });

    try {
      await page.goto(`http://localhost:${PORT}${route}`, { waitUntil: "networkidle0", timeout: 45000 });

      // Auf echten Inhalt warten statt auf eine feste Zeit — ein fester Timeout speichert
      // bei langsamer Maschine die leere Hülle, und niemand merkt es.
      await page.waitForFunction(() => (document.getElementById("root")?.innerText ?? "").trim().length > 300, {
        timeout: 20000,
      });

      const html = await page.content();
      const zeichen = await page.evaluate(() => (document.getElementById("root")?.innerText ?? "").trim().length);

      // Positiver Nachweis statt „hat nicht geworfen": zu wenig Text = Fehler, sonst liegt
      // am Ende ein grüner Build mit leeren Seiten vor.
      if (zeichen < 300) throw new Error(`nur ${zeichen} Zeichen Text — Schnappschuss wäre leer`);

      /**
       * Sprach-Guard: hat die App die erzwungene Sprache auch BENUTZT?
       *
       * Zwei Stufen, weil die eine ohne die andere nichts beweist. `navigator.language`
       * belegt nur, dass die Injektion ankam — nicht, dass der ausgegebene Text deutsch
       * ist. Deshalb zusätzlich ein Text-Nachweis: ANWESENHEIT eines deutschen Markers,
       * nicht Abwesenheit eines englischen. (Ein Verbots-Guard fängt nur Fehler, die man
       * schon kennt — dieselbe Lehre wie beim „0 Shows gefunden".) Mehrere Marker, einer
       * genügt: ein einzelner würde bei jeder Textänderung falsch-rot.
       */
      const gemesseneSprache = await page.evaluate(() => navigator.language);
      if (!gemesseneSprache.startsWith(SPRACHE_KURZ)) {
        throw new Error(`navigator.language ist „${gemesseneSprache}", erwartet „${SPRACHE}" — Spracherzwingung greift nicht`);
      }
      if (SPRACHE_KURZ === "de") {
        /**
         * Die Marker sind GEMESSEN, nicht geraten: einmal mit `PRERENDER_LANG=en-US`
         * gebaut und jeder Kandidat gegen beide Schnappschuss-Sätze gehalten. Tauglich
         * ist nur, was auf ALLEN 10 deutschen Seiten steht und auf KEINER englischen.
         *
         * Zwei naheliegende Kandidaten fielen dabei durch — „Künstler" und „Shows" stehen
         * auf allen zehn ENGLISCHEN Seiten (Marken- und Eigennamen, „For Artists" hin oder
         * her). Mit ihnen in der Liste hätte der Guard jede englische Fassung durchgewunken
         * und dabei grün ausgesehen. Wer hier etwas ergänzt: erst gegen einen EN-Build
         * halten, sonst ist der Schutz dekorativ.
         */
        const MARKER = ["Über uns", "Jetzt anfragen", "anfragen"];
        const text = await page.evaluate(() => document.getElementById("root")?.innerText ?? "");
        if (!MARKER.some((m) => text.includes(m))) {
          throw new Error(
            `kein deutscher Text im Schnappschuss (keiner von: ${MARKER.join(", ")}) — ` +
              `die Seite waere unter <html lang="de"> auf Englisch eingefroren`,
          );
        }
      }

      // Inhalts-Guard, aber nur wo er etwas aussagt: Wenn die API selbst 0 Shows meldet,
      // ist ein leerer Katalog die Wahrheit und kein Fehler — dann darf er den Deploy
      // nicht blockieren (sonst hängt an einer zurückgezogenen Show auch jede unbeteiligte
      // Änderung). Blockiert wird nur der gefährliche Fall: Daten sind da, kommen aber
      // nicht im HTML an.
      // Gegen die entity-freie Fassung pruefen, nie gegen das rohe HTML (siehe entityFrei).
      const htmlLesbar = entityFrei(html);
      const muster = MUSS_ENTHALTEN[route];
      if (muster && apiShowAnzahl !== 0 && !muster.test(htmlLesbar)) {
        const woher = apiShowAnzahl === null ? "API-Antwort unlesbar" : `${apiShowAnzahl} Shows von der API`;
        throw new Error(`${woher}, aber nichts davon im HTML (Muster ${muster}) — API_ORIGIN = ${API_ORIGIN}`);
      }
      if (muster && apiShowAnzahl === 0) {
        console.log(`    (API meldet 0 Shows — leerer Katalog ist hier die Wahrheit, kein Fehler)`);
      }

      const fertig = kopfNormalisieren(html, route);

      const ziel = route === "/" ? join(DIST, "index.html") : join(DIST, route.slice(1), "index.html");
      await mkdir(dirname(ziel), { recursive: true });
      await writeFile(ziel, fertig, "utf8");
      console.log(`  ✓ ${route.padEnd(14)} → ${ziel.replace(DIST + "/", "dist/")} (${zeichen} Zeichen Text)`);
      geschrieben++;
    } catch (e) {
      console.error(`  ✗ ${route.padEnd(14)} ${e.message}`);
      fehler.push(route);
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}

console.log(`Prerender: ${geschrieben}/${ROUTES.length} Routen geschrieben (${STATISCHE_ROUTEN.length} feste + ${SHOW_ROUTEN.length} Shows).`);

/**
 * sitemap.xml um die Showseiten ergänzen.
 *
 * Ohne diesen Schritt wären die Seiten zwar da, aber nirgends angemeldet — Google fände
 * sie nur über interne Links, und die KI-Suchen, um die es hier geht, meist gar nicht.
 *
 * Geschrieben wird nach dist/, NICHT nach public/: Vite kopiert public/ beim Build-START,
 * ein späterer Schreibvorgang dorthin käme nie in der Auslieferung an. Die gepflegte
 * public/sitemap.xml bleibt die Quelle der festen Seiten und wird nicht angefasst.
 */
if (SHOW_ROUTEN.length > 0 && !fehler.length) {
  const sitemapDatei = join(DIST, "sitemap.xml");
  try {
    const vorher = await readFile(sitemapDatei, "utf8");
    const heute = vorher.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1] ?? "";
    const eintraege = SHOWS.map((s) => {
      const stand = s.stand ?? heute;
      return (
        `  <url>\n    <loc>${SEITEN_URL}${s.route}</loc>\n` +
        (stand ? `    <lastmod>${stand}</lastmod>\n` : "") +
        `    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`
      );
    }).join("\n");
    const nachher = vorher.replace(/<\/urlset>/, `${eintraege}\n</urlset>`);
    if (nachher === vorher) throw new Error("</urlset> nicht gefunden — Sitemap unverändert");
    await writeFile(sitemapDatei, nachher, "utf8");

    // Positiver Nachweis: die Zahl der <loc> muss um genau die Showseiten gewachsen sein.
    const vorherAnzahl = (vorher.match(/<loc>/g) ?? []).length;
    const nachherAnzahl = (nachher.match(/<loc>/g) ?? []).length;
    if (nachherAnzahl !== vorherAnzahl + SHOW_ROUTEN.length) {
      throw new Error(`Sitemap: ${vorherAnzahl} → ${nachherAnzahl}, erwartet ${vorherAnzahl + SHOW_ROUTEN.length}`);
    }
    console.log(`Sitemap: ${vorherAnzahl} → ${nachherAnzahl} URLs (${SHOW_ROUTEN.length} Showseiten ergänzt).`);
  } catch (e) {
    console.error(`❌ Sitemap konnte nicht ergänzt werden: ${e.message}`);
    process.exit(1);
  }
}

// Fail-closed: lieber ein roter Build als eine still ausgelieferte leere Hülle. Ein
// abgebrochener Railway-Build nimmt die Seite nicht offline — die letzte gute Fassung
// läuft weiter. Ein durchgewinkter Build mit leeren Seiten dagegen sieht grün aus.
if (fehler.length) {
  console.error(`❌ ABBRUCH — nicht prerendert: ${fehler.join(", ")}`);
  process.exit(1);
}
