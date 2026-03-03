import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
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
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.OPENAI_API_KEY': JSON.stringify(env.OPENAI_API_KEY),
        'process.env.MOCK_MODE': JSON.stringify(env.MOCK_MODE ?? '')
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
