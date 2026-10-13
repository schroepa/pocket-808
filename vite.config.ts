import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Übergangsphase: Gebaut wird die bestehende App aus legacy/.
// Mit Schritt 6 wechselt der Einstieg auf die neue index.html im Projektwurzelverzeichnis.
export default defineConfig({
  root: 'legacy',
  plugins: [viteSingleFile()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    // Übergangsphase: CSS der Legacy-App unverändert ausliefern (lightningcss würde es umschreiben)
    cssMinify: false,
    target: ['safari17', 'chrome120', 'firefox121'],
  },
  preview: { port: 4173, strictPort: true },
});
