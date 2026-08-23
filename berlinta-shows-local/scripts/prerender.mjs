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

const ROUTES = await routenAusSitemap();
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
const API_ORIGIN = process.env.PRERENDER_API_ORIGIN || "https://berlintina.de";

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
const MUSS_ENTHALTEN = {
  "/catalog": /[1-9]\d* (?:Shows gefunden|shows found)/,
};

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
  const vorgabe = (muster) => {
    const t = HUELLE.toString("utf8").match(muster);
    return t ? t[1] : null;
  };
  const vorgabeTitel = vorgabe(/<title>(.*?)<\/title>/s);
  const vorgabeBeschreibung = vorgabe(/<meta\s+name="description"\s+content="(.*?)"/s);

  let ergebnis = html;

  // Vergleich muss entity-normalisiert laufen: in der Quelle steht `&`, Chrome schreibt
  // beim Serialisieren `&amp;`. Ein roher Textvergleich trifft deshalb nie — gemessen,
  // nicht vermutet: der erste Anlauf ließ alle Dubletten stehen und meldete trotzdem
  // Erfolg, weil ein nicht gefundenes replace() klaglos das Original zurückgibt.
  const gleich = (a, b) => {
    const n = (s) =>
      s
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#0?39;|&apos;/g, "'")
        .replace(/\s+/g, " ")
        .trim();
    return n(a) === n(b);
  };

  // 1. Dubletten: den bekannten Vorgabe-Wert entfernen, sofern ein zweiter Tag da ist.
  const titel = [...ergebnis.matchAll(/<title>(.*?)<\/title>/gs)];
  if (titel.length > 1 && vorgabeTitel) {
    const treffer = titel.find((m) => gleich(m[1], vorgabeTitel));
    if (treffer) ergebnis = ergebnis.replace(treffer[0], "");
  }
  const beschreibungen = [...ergebnis.matchAll(/<meta\s+name="description"\s+content="(.*?)"\s*\/?>/gs)];
  if (beschreibungen.length > 1 && vorgabeBeschreibung) {
    const treffer = beschreibungen.find((m) => gleich(m[1], vorgabeBeschreibung));
    if (treffer) ergebnis = ergebnis.replace(treffer[0], "");
  }

  // Positiver Nachweis, dass die Aufräumarbeit auch wirklich stattgefunden hat. Ohne diese
  // Prüfung meldet ein wirkungsloses replace() einen grünen Build mit doppeltem Kopf.
  const uebrig = {
    title: [...ergebnis.matchAll(/<title>/g)].length,
    description: [...ergebnis.matchAll(/<meta\s+name="description"/g)].length,
  };
  for (const [was, anzahl] of Object.entries(uebrig)) {
    if (anzahl > 1) throw new Error(`${anzahl}× <${was}> im Kopf — Dublette nicht entfernt`);
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

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
let geschrieben = 0;
const fehler = [];

try {
  for (const route of ROUTES) {
    const page = await browser.newPage();

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

      // Inhalts-Guard, aber nur wo er etwas aussagt: Wenn die API selbst 0 Shows meldet,
      // ist ein leerer Katalog die Wahrheit und kein Fehler — dann darf er den Deploy
      // nicht blockieren (sonst hängt an einer zurückgezogenen Show auch jede unbeteiligte
      // Änderung). Blockiert wird nur der gefährliche Fall: Daten sind da, kommen aber
      // nicht im HTML an.
      const muster = MUSS_ENTHALTEN[route];
      if (muster && apiShowAnzahl !== 0 && !muster.test(html)) {
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

console.log(`Prerender: ${geschrieben}/${ROUTES.length} Routen geschrieben.`);

// Fail-closed: lieber ein roter Build als eine still ausgelieferte leere Hülle. Ein
// abgebrochener Railway-Build nimmt die Seite nicht offline — die letzte gute Fassung
// läuft weiter. Ein durchgewinkter Build mit leeren Seiten dagegen sieht grün aus.
if (fehler.length) {
  console.error(`❌ ABBRUCH — nicht prerendert: ${fehler.join(", ")}`);
  process.exit(1);
}
