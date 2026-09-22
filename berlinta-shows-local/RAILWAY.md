# Deploy Backend to Railway

Der Server (Express + Postgres) läuft komplett auf Railway — inklusive Datenbank
und Datei-Uploads. Es gibt kein separates Supabase-Projekt mehr (siehe
`db/schema.sql` für die Historie dieser Umstellung).

## Aufbau auf Railway

Ein Projektverbund mit zwei Services:

1. **Postgres** — Railway-eigenes Datenbank-Plugin, liefert `DATABASE_URL` automatisch
   als Referenz-Variable.
2. **berlintina-api** (dieser Server) — braucht ein **Volume**, gemountet z.B. unter
   `/data`, für Artist-/Show-Fotos. Ohne Volume gehen hochgeladene Bilder bei jedem
   Redeploy verloren.

Beide Services reden über Railways privates Netz miteinander — dafür muss nichts
zusätzlich konfiguriert werden, `DATABASE_URL` reicht.

## Neu aufsetzen

### 1. Postgres-Service anlegen

Im Railway-Dashboard: **New** → **Database** → **PostgreSQL**.

### 2. Schema laden

```bash
psql "$DATABASE_URL" -f db/schema.sql
```

`db/schema.sql` ist die einzige Quelle für das Datenbank-Schema — es gibt keine
Migrationen mehr, die nacheinander laufen müssten.

### 3. API-Service anlegen (mit GitHub)

1. **New Project** → **Deploy from GitHub repo** → dieses Repo wählen
2. **Settings** → **Root Directory** = `server`
3. **Settings** → **Volumes** → Volume anlegen, Mount-Pfad z.B. `/data`
4. Variables setzen (siehe unten)
5. **Settings** → **Networking** → **Generate Domain**

### Ohne GitHub (Railway CLI)

```bash
npm install -g @railway/cli
railway login
cd server
railway init
railway up
```

Bei Änderungen erneut `railway up` aus `server/`.

## Umgebungsvariablen (Variables)

| Variable | Pflicht? | Beispiel |
|----------|----------|----------|
| `DATABASE_URL` | Ja | von Railway automatisch als Referenz-Variable des Postgres-Service |
| `UPLOAD_DIR` | Ja | `/data` — muss auf den gemounteten Volume-Pfad zeigen |
| `PORT` | Nein (Railway setzt ihn) | 3001 |
| `OPENAI_API_KEY` | Eine der beiden AI-Keys | sk-xxx |
| `GEMINI_API_KEY` | Eine der beiden AI-Keys | (wenn du Gemini nutzt) |
| `ADMIN_PASSWORD` | Ja | dein-sicheres-admin-passwort |

**Optional:**
- `MOCK_MODE=true` – nutzt Mock-AI ohne API-Keys
- `ARTIST_TOKEN_PEPPER` – Pfeffer fürs Hashing der Rückkehr-Tokens, in Produktion setzen
- `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` – für Artist-E-Mails
- `EMAIL_FROM`, `NOTIFY_EMAIL` – Absender- bzw. Benachrichtigungsadresse

⚠️ **`UPLOAD_DIR` ohne passendes Volume heißt: jeder Redeploy löscht alle
Artist-/Show-Fotos.** Der Pfad muss exakt der Mount-Pfad aus **Settings → Volumes**
sein, nicht nur ein beliebiges Verzeichnis im Container.

---

## Öffentliche URL

1. Im Service: **Settings** → **Networking** → **Generate Domain**.
2. Es entsteht eine URL wie:
   ```
   https://berlinta-shows-local-production-xxxx.up.railway.app
   ```
3. Berlintina.de zeigt per Cloudflare/DNS direkt auf diesen Service — Frontend und
   API laufen unter derselben Domain, `VITE_API_URL` bleibt deshalb leer
   (relative Requests reichen).

## Frontend verbinden

`.env.production` im Projekt-Root:

```
VITE_API_URL=
VITE_WHATSAPP=491608106880
```

Nur setzen, wenn Frontend und API unter **verschiedenen** Domains laufen:

```
VITE_API_URL=https://dein-railway-service.up.railway.app
```

Dann:

```bash
npm run build
```

Danach den Inhalt von `dist/` auf All-Inkl hochladen (statisches Frontend läuft
separat vom API-Server).

---

## Logs prüfen

Im Railway-Dashboard → **Deployments** → neuester Deploy → **View Logs**.

- „Listening on port" → Server läuft.
- Fehlermeldungen → meist fehlende Env-Variablen (`DATABASE_URL`, `UPLOAD_DIR`,
  OpenAI/Gemini) oder ein fehlendes Volume.

---

## Kurz-Checkliste (Neuaufsetzen)

- [ ] Postgres-Plugin angelegt, `db/schema.sql` eingespielt
- [ ] API-Service aus GitHub deployed, Root Directory = `server`
- [ ] Volume angelegt und gemountet, `UPLOAD_DIR` zeigt exakt dorthin
- [ ] `ADMIN_PASSWORD`, `DATABASE_URL`, KI-Key gesetzt
- [ ] Domain generiert
- [ ] `.env.production` im Frontend geprüft, Frontend gebaut und hochgeladen
