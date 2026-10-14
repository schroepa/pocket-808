import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Neue App (Schritt 5). Bis zur Umstellung in Schritt 6 baut `vite.config.ts` weiter legacy/.
export default defineConfig({
  root: '.',
  plugins: [viteSingleFile()],
  build: {
    outDir: 'dist-next',
    emptyOutDir: true,
    target: ['safari17', 'chrome120', 'firefox121'],
  },
  server: { port: 5173 },
  preview: { port: 4174, strictPort: true },
});
