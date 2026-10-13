import { defineConfig, type Plugin } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Die Legacy-Datei deklariert keinen Zeichensatz. Im Artifact ergänzt die Plattform UTF-8,
// allein ausgeliefert raten Browser Windows-1252 und Umlaute zerfallen.
const declareUtf8: Plugin = {
  name: 'pocket808:utf8',
  transformIndexHtml: (html) =>
    /<meta charset=/i.test(html) ? html : `<meta charset="utf-8">\n${html}`,
};

// Übergangsphase: Gebaut wird die bestehende App aus legacy/.
// Mit Schritt 6 wechselt der Einstieg auf die neue index.html im Projektwurzelverzeichnis.
export default defineConfig({
  root: 'legacy',
  plugins: [declareUtf8, viteSingleFile()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    // Übergangsphase: CSS der Legacy-App unverändert ausliefern (lightningcss würde es umschreiben)
    cssMinify: false,
    target: ['safari17', 'chrome120', 'firefox121'],
  },
  preview: { port: 4173, strictPort: true },
});
