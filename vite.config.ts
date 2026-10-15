import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Die App wird zu einer einzigen dist/index.html gebündelt (CSS und Script inline).
export default defineConfig({
  root: '.',
  plugins: [viteSingleFile()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: ['safari17', 'chrome120', 'firefox121'],
  },
  server: { port: 5173 },
  preview: { port: 4173, strictPort: true },
});
