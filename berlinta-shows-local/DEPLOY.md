# Deployment – berlintina.de (All-Inkl)

## Übersicht

Die App hat zwei Teile:
- **Frontend** (React/Vite) → statische Dateien → All-Inkl Webspace
- **Backend** (Express/Node) → braucht Node.js → separate Hosting-Lösung

All-Inkl Standard-Webhosting (Kasseler) unterstützt **kein** Node.js. Du brauchst daher den Backend-Server extern.

---

## 1. Frontend auf All-Inkl hochladen

### Build erstellen
```bash
cd berlinta-shows-local
npm install
npm run build
```

### Upload per FTP/SFTP
- **Host:** z.B. `ftp.berlintina.de` (oder aus dem All-Inkl KAS)
- **Zielordner:** Website-Root (z.B. `/` oder `/www`)
- **Inhalt von `dist/`** hochladen:
  ```
  index.html      → /
  assets/         → /assets/
  robots.txt      → /
  sitemap.xml     → /
  ```

### Upload per All-Inkl KAS (Kasseler)
1. KAS öffnen → Dateimanager
2. In den Webroot wechseln
3. `dist/`-Inhalt (index.html, assets/, robots.txt, sitemap.xml) hochladen

---

## 2. Backend hosten (Node.js)

Das Backend läuft nicht auf All-Inkl Standard-Webhosting. Optionen:

### Option A: Railway (empfohlen)
1. [railway.app](https://railway.app) → New Project
2. "Deploy from GitHub" oder "Empty Project"
3. `server/` hochladen (nur den Ordner, nicht das ganze Repo)
4. Env-Variablen setzen: `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PASSWORD`, etc.
5. Deploy → URL z.B. `https://berlintina-api.up.railway.app`

### Option B: Render
1. [render.com](https://render.com) → New Web Service
2. GitHub verbinden oder Repo hochladen
3. Root Directory: `server`
4. Build: `npm install`
5. Start: `node index.js`
6. Env-Variablen setzen

### Option C: Fly.io
1. `fly launch` im `server/`-Ordner
2. Env-Variablen: `fly secrets set KEY=value`

---

## 3. Frontend mit externem Backend verbinden

Beim **Produktions-Build** muss das Frontend wissen, wo das Backend läuft.

### .env für Produktion
Erstelle `.env.production` im Projekt-Root:
```
VITE_API_URL=https://deine-backend-url.railway.app
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=dein-anon-key
```

### Neu bauen und hochladen
```bash
npm run build
```
Dann den Inhalt von `dist/` erneut per FTP auf All-Inkl hochladen.

---

## 4. CORS

Das Backend muss Anfragen von `https://berlintina.de` erlauben. In `server/index.js` ist CORS bereits aktiv (`app.use(cors())`). Bei Bedarf kannst du es einschränken:

```javascript
app.use(cors({ origin: ['https://berlintina.de', 'http://localhost:3000'] }));
```

---

## Kurz-Checkliste

- [ ] Supabase-Projekt angelegt, alle Migrations ausgeführt
- [ ] Backend auf Railway/Render/Fly deployed
- [ ] Env-Variablen im Backend gesetzt
- [ ] `.env.production` mit `VITE_API_URL` und Supabase-Keys angelegt
- [ ] `npm run build` ausgeführt
- [ ] Inhalt von `dist/` per FTP auf All-Inkl hochgeladen
- [ ] https://berlintina.de prüfen
