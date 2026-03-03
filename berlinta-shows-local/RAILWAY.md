# Deploy Backend to Railway

---

## Option A: Deploy ohne GitHub (mit Railway CLI)

**Wenn du kein GitHub-Repo hast**, kannst du direkt von deinem Rechner deployen:

### 1. Railway CLI installieren

```bash
npm install -g @railway/cli
```

Oder mit Homebrew (Mac): `brew install railway`

### 2. Anmelden & Projekt erstellen

```bash
railway login
```

Im Browser anmelden. Dann:

```bash
cd server
railway init
```

- **Create new project** wählen
- Projektnamen eingeben (z.B. „berlintina-api“)

### 3. Deployen

```bash
railway up
```

Railway lädt den `server/`-Ordner hoch und baut ihn. Beim ersten Mal kann es etwas dauern.

### 4. Domain & Variables

1. Im [Railway Dashboard](https://railway.app/dashboard) dein Projekt öffnen
2. **Settings** → **Networking** → **Generate Domain**
3. **Variables** → alle nötigen Keys eintragen (siehe unten)

### 5. Bei Änderungen neu deployen

```bash
cd server
railway up
```

---

## Option B: Deploy mit GitHub

1. Projekt auf GitHub pushen (neues Repo erstellen, `git push`)
2. Railway: **New Project** → **Deploy from GitHub repo**
3. Repo auswählen
4. **Settings** → **Root Directory** = `server`
5. Variables setzen, Domain generieren

---

## Umgebungsvariablen (Variables)

Im Service unter **Variables** diese Werte hinzufügen:

| Variable | Pflicht? | Beispiel |
|----------|----------|----------|
| `PORT` | Nein (Railway setzt ihn) | 3001 |
| `OPENAI_API_KEY` | Eine der beiden AI-Keys | sk-xxx |
| `GEMINI_API_KEY` | Eine der beiden AI-Keys | (wenn du Gemini nutzt) |
| `SUPABASE_URL` | Ja (für Submissions) | https://xxx.supabase.co |
| `SUPABASE_SERVICE_ROLE_KEY` | Ja | eyJ... |
| `ADMIN_PASSWORD` | Ja | dein-sicheres-admin-passwort |

**Optional:**
- `MOCK_MODE=true` – nutzt Mock-AI ohne API-Keys
- `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` – für Artist-E-Mails
- `EMAIL_FROM` – Absenderadresse für E-Mails

---

## Öffentliche URL

1. Im Service: **Settings** → **Networking** → **Generate Domain**.
2. Es entsteht eine URL wie:
   ```
   https://berlinta-shows-local-production-xxxx.up.railway.app
   ```
3. Diese URL als `VITE_API_URL` im Frontend-Build verwenden.

---

## Frontend verbinden

Erstelle im Projekt-Root (neben `package.json`) `.env.production`:

```
VITE_API_URL=https://dein-railway-service.up.railway.app
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=dein-anon-key
```

Ohne `https://` am Ende.

Dann:

```bash
npm run build
```

Danach den Inhalt von `dist/` auf All-Inkl hochladen.

---

## Logs prüfen

Im Railway-Dashboard → **Deployments** → neuester Deploy → **View Logs**.

- „Listening on port“ → Server läuft.
- Fehlermeldungen → z.B. fehlende Env-Variablen (Supabase, OpenAI/Gemini) prüfen.

---

## Kurz-Checkliste (ohne GitHub)

- [ ] Railway CLI installiert (`npm i -g @railway/cli`)
- [ ] `railway login` ausgeführt
- [ ] `cd server` → `railway init` → Projekt erstellt
- [ ] `railway up` ausgeführt
- [ ] Im Dashboard: Domain generiert, Variables gesetzt
- [ ] `.env.production` mit `VITE_API_URL` erstellt
- [ ] Frontend neu gebaut und auf All-Inkl hochgeladen
