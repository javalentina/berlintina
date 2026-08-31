import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Hier stand bis 2026-08-31 ein `define`-Block, der `GEMINI_API_KEY`, `OPENAI_API_KEY` und
 * `API_KEY` aus der Bauumgebung als Literale in den Client-Code ersetzt hat.
 *
 * Vite ersetzt solche Ausdrücke überall dort, wo der Code sie erwähnt — und das Ergebnis
 * landet im Bundle, das jeder Besucher herunterlädt. Es gab genau zwei Stellen, die sie
 * erwähnten (`services/openaiService.ts`, `services/geminiService.ts`, beide mit
 * `dangerouslyAllowBrowser: true`), und beide wurden von niemandem importiert. Deshalb warf
 * das Tree-Shaking sie weg und im ausgelieferten Bundle stand nie ein Schlüssel — am
 * 31.08.2026 gegen das Live-Artefakt geprüft: null Treffer für `sk-`, `AIza`, `eyJ`.
 *
 * Der Aufbau war also nicht undicht, sondern eine geladene Waffe mit Sicherung: ein
 * einziger Import dieser Dateien hätte den Schlüssel öffentlich gemacht, ohne Fehlermeldung
 * und ohne dass es jemandem im Diff auffallen müsste. Beide Dateien sind jetzt gelöscht und
 * der `define`-Block ist weg, damit dieser Weg gar nicht erst existiert.
 *
 * Die KI-Aufrufe laufen ohnehin serverseitig: `services/aiService.ts` geht über
 * `services/apiClient.ts` an die Express-API, und nur `server/index.js` sieht die
 * Schlüssel. Die Pakete `openai` und `@google/genai` bleiben deshalb in den dependencies —
 * der Server importiert sie.
 *
 * Wer hier künftig wieder etwas hineinreicht: alles unter `define` ist öffentlich. Für
 * Werte, die das sein dürfen, gibt es `VITE_`-Variablen (siehe `.env.example`); für alles
 * andere gehört ein Endpunkt in den Server.
 */
export default defineConfig(({ mode }) => {
    const isDebug = mode === 'debug';
    return {
      plugins: [react(), tailwindcss()],
      build: isDebug ? { minify: false, sourcemap: true } : undefined,
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          '/api': { target: 'http://localhost:3001', changeOrigin: true },
        },
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
