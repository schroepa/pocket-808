# Schritt 5a: UI-Grundgerüst – Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die neue App ist auf Mobile, Tablet (hoch und quer) und Desktop spielbar. Sie enthält Deck, Pattern-Slots, Step-Editor mit Sub-Steps und eigenem Drum-Sample, Spuren, Transport, Tastaturkürzel und die komplette Schicht `platform`. Gebaut wird sie als eigene Datei `dist-next/index.html`.

**Architecture:**
- **Eine Oberfläche:** Ein einziger Komponentenbaum aus kleinen DOM-Funktionen (`h`, `bind`, `listen`) mit feinen Bindungen an `store.select()`.
- **Layouts:** Das Layout-Signal setzt `data-layout` auf `<html>`. Die drei Anordnungen stehen ausschließlich in `layout.css` (Grid-Areas). Der Geräte-Halter wechselt zwischen Akkordeon, Tabs und „alle offen“.
- **Schnittstellen der UI:**
  - Die UI kennt die Engine nicht. Sie bekommt `UiAudio` und `UiFiles` übergeben.
  - Eigene Drum-Samples liegen in einer neuen `SampleBank` in `store`.
  - `platform` kapselt iOS, Wake Lock, Lebenszyklus, Artifact-Host und Dateiauswahl.
  - `main.ts` verdrahtet alles.
- **Übergangsphase:** Der Legacy-Build bleibt `npm run build`. Die neue App läuft mit `npm run dev` und wird mit `npm run build:next` gebaut.

**Tech Stack:** TypeScript 6, Vite 8 (vite-plugin-singlefile), Vitest 5 mit jsdom, Playwright mit axe-core, CSS mit Cascade Layers, Nesting und Container Queries.

**Spec:** `docs/superpowers/specs/2026-10-14-ui-layouts-design.md` (Abschnitte 1–5, Teilschritt 5a). Grundlage ist `docs/superpowers/specs/2026-10-13-fundament-design.md`.

## Global Constraints

- Deutsch für UI-Texte, Kommentare, Tests, Commits. Hardware-Begriffe bleiben englisch (Level, Tune, Decay).
- Commits enden mit `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Gearbeitet wird auf dem Branch `ui-5a`. Gepusht wird am Ende nach dem Review per Merge nach `main` (Vercel liefert `main` aus, die neue App unter `/next/`).
- Befehl-Präfix **`[n]`** = `source ~/.nvm/nvm.sh && nvm use >/dev/null && `.
- Commits nur nach `[n] npm run format && npm run lint && npm run typecheck` (der Git-Hook prüft zusätzlich Unit- und Referenztests).
- Schichten:
  - `ui` importiert nur `core` und `store`.
  - `platform` importiert nur `core`.
  - Nur `src/main.ts` kennt alle Schichten.
  - Keine dynamischen Importe.
- Produktionscode ohne `!`-Assertions, stattdessen `must()` aus `src/core/util.ts`.
- Design:
  - Keine Outlines und keine Schatten (Ausnahme: Fokusring).
  - Aktive Zustände bekommen einen Glow per `box-shadow` mit `z-index:1`.
  - Nur die Palette `--chassis #08080b`, `--panel #121217`, `--well #0c0c10`, `--cell #1b1b23`, `--ink #f0f0f6`, `--ink-dim #7d7d8c`, `--acc #d3925a`, `--cream #d4d4dc`. Keine neuen Farben.
  - Keine großen Blur-Radien, kein `filter` außer `brightness()` für Druck- und Lauflicht-Zustände.
- Touch-Ziele sind auf mobile/tablet mindestens 44 px groß. `touch-action:none` auf Drag-Elementen.
- Kein horizontaler Scroll ab 360 px Breite.
- Nur Google Fonts als externe Ressource (Barlow Condensed 500/600/700, Share Tech Mono).
- Abdeckung ≥ 90 % pro Datei für `src/ui/**` und `src/platform/**` (ausgenommen `*.test.ts`, `test-utils.ts`).
- Layout-Erkennung:

  | Layout | Bedingung |
  |---|---|
  | `mobile` | Breite < 768 px |
  | `tablet` | ≥ 768 px und (`pointer: coarse` oder < 1024 px) |
  | `desktop` | ≥ 1024 px und nicht `pointer: coarse` |

- Die README wird am Ende aktualisiert (lebendes Dokument, Regel in CLAUDE.md).

## Abweichung von der Spezifikation (Ruling beim Planen)

`engine.decode` und `toPcm` kommen schon in 5a statt in 5c, weil das eigene Drum-Sample (Teil von 5a) eine Datei dekodieren muss. Die UI-Schnittstelle heißt deshalb `UiContext` mit `audio`, `files` und `samples`, nicht nur `{ store, audio }`.

## Review Focus

1. **Layout-Erkennung auf echten Geräten:** Ein iPad meldet sich teils als Mac, WebKit-Emulation und `pointer: coarse` können auseinanderlaufen. Ein iPad quer muss `tablet` ergeben. Abgedeckt durch `layoutFor`-Tests (Task 6) und den E2E-Fall `next-tablet-quer` (Task 21).
2. **Vorhören beim Bearbeiten:** Nur beim Einschalten eines Steps und nur im Stand wird vorgehört. Nie beim Ausschalten, nie beim Löschen von Sub-Steps, nie während der Wiedergabe. Abgedeckt durch die Tests in Task 11, 12 und 14.
3. **Kürzel stören Eingaben:** Pfeiltasten auf einem Regler ändern den Regler, nicht die Spur. Leertaste in `<select>` öffnet das Select. Cmd+C mit markiertem Text kopiert Text. Abgedeckt in Task 18.
4. **Drum-Sample laden scheitert oder wird abgebrochen:** Abbrechen ändert nichts. Eine unlesbare Datei zeigt „NICHT LESBAR“, und Zustand und Speicher bleiben unverändert. Abgedeckt in Task 13.
5. **Speicherstand nach Neuladen:** Gewählte Spur, Pattern, Tempo und Steps kommen nach dem Neuladen genauso zurück, auch aus einem alten Legacy-Speicherstand und aus `window.claude.hot`. Abgedeckt in Task 2 und 21.

---

## Dateistruktur (Ergebnis)

```
index.html                       Einstieg der neuen App
vite.next.config.ts              Dev-Server und Build der neuen App (dist-next/)
src/main.ts                      Verdrahtung
src/core/samples.ts              + toPcm, trimLeadingSilence
src/core/boot.ts                 + Host-Zustand
src/store/signals.ts             + untracked
src/store/samples.ts             SampleBank (eigene Drum-Samples, gespeichert)
src/audio/engine.ts              + decode
src/ui/dom.ts                    h, bind, listen, Scope
src/ui/layout.ts                 Layout-Signal
src/ui/readout.ts                LCD-Zeile mit kurzen Meldungen
src/ui/context.ts                UiContext, UiAudio, UiFiles
src/ui/test-utils.ts             Test-Hilfen (Kontext, Zeiger-Ereignisse)
src/ui/styles/                   app.css, reset.css, tokens.css, base.css, layout.css
src/ui/controls/                 knob, chip, segment, step-button, marker (+ .css)
src/ui/panels/                   brand, deck, slots, step-editor, sub-editor, drum-sample, tracks, transport (+ .css)
src/ui/devices.ts (+ .css)       Geräte-Halter
src/ui/keys.ts                   Tastaturkürzel und Kürzel-Dialog
src/ui/playhead.ts               rAF-Takt für das Lauflicht
src/ui/shell.ts                  baut den Baum
src/platform/                    ios.ts, wake.ts, lifecycle.ts, host.ts, files.ts
tests/e2e-next/                  E2E der neuen App
docs/superpowers/specs/2026-10-14-ui-funktionsliste.md
```

---

### Task 1: Werkzeuge für die neue App

**Files:**
- Create: `index.html`, `vite.next.config.ts`, `src/main.ts` (vorläufig), `tests/e2e-next/boot.spec.ts`
- Modify: `package.json` (scripts), `.gitignore`, `eslint.config.js`, `vitest.config.ts`, `playwright.config.ts`, `CLAUDE.md` (Befehle)

**Interfaces:**
- Produces:
  - Skripte `dev` (neue App), `dev:legacy`, `build:next`, `preview:next` (Port 4174).
  - Vitest-Projekt `ui` (jsdom) für `src/ui/**/*.test.ts` und `src/platform/**/*.test.ts`.
  - Playwright-Projekte `next-mobile`, `next-tablet`, `next-tablet-quer`, `next-desktop` mit `testDir: 'tests/e2e-next'`.

- [ ] **Step 1: `index.html` anlegen**

```html
<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#08080b" />
    <title>Pocket 808</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Share+Tech+Mono&display=swap"
    />
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 2: `vite.next.config.ts`**

```ts
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
```

- [ ] **Step 3: Vorläufiges `src/main.ts`**

```ts
// Vorläufig: Task 20 ersetzt diese Datei durch die Verdrahtung.
const app = document.getElementById('app');
if (app) app.textContent = 'Pocket 808';
```

- [ ] **Step 4: Skripte in `package.json`**

`"dev": "vite"` wird ersetzt. Dazu kommen:

```json
"dev": "vite --config vite.next.config.ts",
"dev:legacy": "vite",
"build": "vite build && vite build --config vite.next.config.ts --outDir dist/next",
"build:next": "vite build --config vite.next.config.ts",
"preview:next": "vite preview --config vite.next.config.ts",
"test:unit": "vitest run --project unit --project ui --coverage",
```

Wunsch des Besitzers (live testen): `npm run build` baut zusätzlich die neue App nach `dist/next/index.html`. Vercel liefert sie unter **https://pocket-808.vercel.app/next/** aus, die Hauptadresse bleibt Legacy. Der bestehende Größentest prüft weiter nur `dist/index.html`.

- [ ] **Step 5: `.gitignore` und ESLint**

- In `.gitignore` nach `dist/` die Zeile `dist-next/` ergänzen.
- In `eslint.config.js` `'dist-next/'` zu `ignores` hinzufügen.
- Die ui-Regel ersetzen durch:

```js
  forbid(
    ['src/ui/**/*.ts'],
    ['audio', 'platform', 'main'],
    'ui kennt nur core und store. Audio und Plattform kommen über UiContext (main.ts).',
  ),
```

- [ ] **Step 6: Vitest-Projekt `ui` und Abdeckung**

In `vitest.config.ts`:
- `coverage.include` wird `['src/core/**/*.ts', 'src/store/**/*.ts', 'src/ui/**/*.ts', 'src/platform/**/*.ts']`.
- `coverage.exclude` wird `['**/*.test.ts', 'src/core/test-utils.ts', 'src/ui/test-utils.ts']`.
- Im Projekt `unit` wird `exclude: ['src/ui/**', 'src/platform/**']` ergänzt.
- Ein neues Projekt kommt hinzu:

```ts
      {
        test: {
          name: 'ui',
          environment: 'jsdom',
          include: ['src/ui/**/*.test.ts', 'src/platform/**/*.test.ts'],
        },
      },
```

- [ ] **Step 7: Playwright**

In `playwright.config.ts`:
- Die drei bestehenden Projekte bekommen `testDir: 'tests/e2e'`.
- `webServer` wird zu einem Array mit zwei Servern.
- Es kommen vier Projekte hinzu:

```ts
const NEXT = 'http://localhost:4174';
// …in projects:
    {
      name: 'next-mobile',
      testDir: 'tests/e2e-next',
      use: { ...devices['iPhone 14'], viewport: { width: 390, height: 844 }, baseURL: NEXT },
    },
    {
      name: 'next-tablet',
      testDir: 'tests/e2e-next',
      use: { ...devices['iPad Pro 11'], viewport: { width: 820, height: 1180 }, baseURL: NEXT },
    },
    {
      name: 'next-tablet-quer',
      testDir: 'tests/e2e-next',
      use: {
        ...devices['iPad Pro 11 landscape'],
        viewport: { width: 1180, height: 820 },
        baseURL: NEXT,
      },
    },
    {
      name: 'next-desktop',
      testDir: 'tests/e2e-next',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, baseURL: NEXT },
    },
// webServer:
  webServer: [
    { command: 'npm run build && npm run preview', port: 4173, reuseExistingServer: false },
    { command: 'npm run build:next && npm run preview:next', port: 4174, reuseExistingServer: false },
  ],
```

- [ ] **Step 8: Erster E2E-Test `tests/e2e-next/boot.spec.ts`**

```ts
import { expect, test } from '../e2e/fixtures.ts';

test('die neue App startet ohne Fehler', async ({ page, pageErrors }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Pocket 808');
  await expect(page.locator('#app')).not.toBeEmpty();
  expect(pageErrors).toEqual([]);
});
```

- [ ] **Step 9: Prüfen**

Run: `[n] npm run build:next && ls -la dist-next/index.html && npx playwright test --project next-mobile --project next-desktop`
Expected: Die Datei existiert, 2 Tests grün.

Run: `[n] npm run build && ls -la dist/index.html dist/next/index.html`
Expected: beide Dateien existieren, `dist/index.html` ist unverändert Legacy (Titel und Größe wie zuvor).

Run: `[n] npm run test:unit`
Expected: grün. Das Projekt `ui` meldet „No test files found“ ohne Fehler. Falls Vitest bei leerem Projekt abbricht, `passWithNoTests: true` im Projekt `ui` setzen.

- [ ] **Step 10: CLAUDE.md und Commit**

Im Befehlsblock von CLAUDE.md `npm run dev` kommentieren mit „neue App (Schritt 5)“ und `npm run dev:legacy` sowie `npm run build:next` ergänzen.

```bash
[n] npm run format && npm run lint && npm run typecheck
git add -A index.html vite.next.config.ts src/main.ts package.json .gitignore eslint.config.js vitest.config.ts playwright.config.ts tests/e2e-next CLAUDE.md
git commit -m "ui: Werkzeuge für die neue App (Dev-Server, build:next, Vitest-Projekt ui, E2E-Projekte)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: core – Dekodiertes Audio umrechnen, Host-Zustand beim Start

**Files:**
- Modify: `src/core/samples.ts`, `src/core/samples.test.ts`, `src/core/boot.ts`, `src/core/boot.test.ts`, `tests/reference/legacy/harness.ts` (HOOK), `tests/reference/legacy/types.ts`
- Create: `tests/reference/core-topcm.test.ts`

**Interfaces:**
- Produces:
  - `toPcm(channels: readonly Float32Array[], sampleRate: number): Float32Array`: mono, höchstens `SMP_MAX` Sekunden, `SMP_RATE`, Spitze 0,9 (Legacy `toPcm`).
  - `trimLeadingSilence(pcm: Float32Array): Float32Array`: Stille am Anfang abschneiden, 40 Samples Vorlauf.
  - `bootState(stored, sampleStore, factoryPcm, host?: unknown)`: `host` ist `data.state` aus `window.claude.hot`. Es wird nach dem gespeicherten Zustand übernommen (Legacy `init`: `merge(loadStored()); merge(data&&data.state)`).

- [ ] **Step 1: Failing Unit-Tests** in `src/core/samples.test.ts` ergänzen

```ts
import { SMP_MAX, SMP_RATE } from './constants.ts';
import { toPcm, trimLeadingSilence } from './samples.ts';

describe('toPcm', () => {
  it('mischt Kanäle zu mono, rechnet auf 22,05 kHz um und normalisiert auf 0,9', () => {
    const l = new Float32Array(44100).fill(0.5);
    const r = new Float32Array(44100).fill(-0.1);
    const out = toPcm([l, r], 44100);
    expect(out.length).toBe(SMP_RATE);
    expect(Math.max(...out.map(Math.abs))).toBeCloseTo(0.9, 5);
  });
  it('kürzt auf höchstens SMP_MAX Sekunden', () => {
    const out = toPcm([new Float32Array(48000 * 10).fill(0.2)], 48000);
    expect(out.length).toBe(Math.floor((48000 * SMP_MAX) / (48000 / SMP_RATE)));
  });
  it('lässt Stille unverstärkt', () => {
    const out = toPcm([new Float32Array(1000)], 22050);
    expect(out.every((x) => x === 0)).toBe(true);
  });
  it('liefert mindestens ein Sample', () => {
    expect(toPcm([new Float32Array(0)], 44100).length).toBe(1);
  });
});

describe('trimLeadingSilence', () => {
  it('schneidet Stille ab und lässt 40 Samples Vorlauf', () => {
    const pcm = new Float32Array(200);
    pcm[100] = 0.5;
    const out = trimLeadingSilence(pcm);
    expect(out.length).toBe(140);
    expect(out[40]).toBeCloseTo(0.5);
  });
  it('lässt einen Anfang innerhalb der ersten 40 Samples unverändert', () => {
    const pcm = new Float32Array(10).fill(0.3);
    expect(trimLeadingSilence(pcm).length).toBe(10);
  });
});
```

- [ ] **Step 2: Rot prüfen.** Run: `[n] npx vitest run --project unit src/core/samples.test.ts`. Expected: FAIL, `toPcm` ist kein Export.

- [ ] **Step 3: Implementieren** in `src/core/samples.ts` (Import `SMP_MAX, SMP_RATE` aus `./constants.ts` ergänzen)

```ts
/**
 * Dekodiertes Audio → Sample-Format (Legacy toPcm): mono gemischt, auf SMP_MAX Sekunden gekürzt,
 * per Mittelwert auf SMP_RATE umgerechnet und auf Spitze 0,9 normalisiert. Rechnet wie Legacy in Float32.
 */
export function toPcm(channels: readonly Float32Array[], sampleRate: number): Float32Array {
  const n = Math.min(channels[0]?.length ?? 0, Math.floor(sampleRate * SMP_MAX));
  const mono = new Float32Array(n);
  for (const d of channels) {
    for (let i = 0; i < n; i++) mono[i] = (mono[i] ?? 0) + (d[i] ?? 0) / channels.length;
  }
  const r = sampleRate / SMP_RATE;
  const m = Math.max(1, Math.floor(n / r));
  const out = new Float32Array(m);
  let peak = 0;
  for (let i = 0; i < m; i++) {
    const j = Math.floor(i * r);
    const e = Math.min(n, Math.max(j + 1, Math.floor((i + 1) * r)));
    let sum = 0;
    for (let k = j; k < e; k++) sum += mono[k] ?? 0;
    out[i] = sum / Math.max(1, e - j);
    peak = Math.max(peak, Math.abs(out[i] ?? 0));
  }
  const g = peak > 0.0001 ? 0.9 / peak : 1;
  for (let i = 0; i < m; i++) out[i] = (out[i] ?? 0) * g;
  return out;
}

/** Stille am Anfang abschneiden (Schwelle 0,02), 40 Samples Vorlauf bleiben (Legacy loadDrumSample). */
export function trimLeadingSilence(pcm: Float32Array): Float32Array {
  let a = 0;
  while (a < pcm.length && Math.abs(pcm[a] ?? 0) < 0.02) a++;
  return pcm.subarray(Math.max(0, a - 40));
}
```

- [ ] **Step 4: Grün prüfen.** Gleicher Befehl, Expected: PASS.

- [ ] **Step 5: Referenztest gegen Legacy**

- Im HOOK in `tests/reference/legacy/harness.ts` `toPcm,` nach `buildIR,` ergänzen.
- In `types.ts` das Feld `toPcm(ab: { numberOfChannels: number; length: number; sampleRate: number; getChannelData(c: number): Float32Array }): Float32Array;` ergänzen.
- Neue Datei `tests/reference/core-topcm.test.ts`:

```ts
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { toPcm } from '../../src/core/samples.ts';
import { loadLegacy } from './legacy/harness.ts';

describe('toPcm gleich Legacy', () => {
  it('bitgleich für zufällige Kanäle und Abtastraten', () => {
    const p = loadLegacy({ seed: 1 });
    try {
      fc.assert(
        fc.property(
          fc.constantFrom(8000, 22050, 44100, 48000, 96000),
          fc.integer({ min: 1, max: 2 }),
          fc.integer({ min: 0, max: 30000 }),
          fc.integer(),
          (rate, chs, len, seed) => {
            let a = seed >>> 0;
            const rnd = () => ((a = (a * 1664525 + 1013904223) >>> 0) / 2 ** 32) * 2 - 1;
            const data = Array.from({ length: chs }, () => Float32Array.from({ length: len }, rnd));
            const ab = {
              numberOfChannels: chs,
              length: len,
              sampleRate: rate,
              getChannelData: (c: number) => data[c] ?? new Float32Array(len),
            };
            expect(toPcm(data, rate)).toEqual(p.t.toPcm(ab));
          },
        ),
        { numRuns: 60 },
      );
    } finally {
      p.close();
    }
  });
});
```

Run: `[n] npx vitest run --project reference tests/reference/core-topcm.test.ts`. Expected: PASS.

Mutationsprobe: In `toPcm` `0.9 / peak` durch `0.89 / peak` ersetzen, der Test muss rot werden. Danach zurücksetzen.

- [ ] **Step 6: Failing Test für den Host-Zustand** in `src/core/boot.test.ts`

```ts
it('übernimmt den Host-Zustand nach dem gespeicherten (Legacy init: data.state zuletzt)', () => {
  const stored = JSON.stringify({ tempo: 100, swing: 0.3 });
  const { state } = bootState(stored, null, [], { tempo: 140 });
  expect(state.tempo).toBe(140);
  expect(state.swing).toBe(0.3);
});
it('ohne Host-Zustand bleibt alles wie gespeichert', () => {
  const { state } = bootState(JSON.stringify({ tempo: 100 }), null, []);
  expect(state.tempo).toBe(100);
});
```

Rot prüfen: `[n] npx vitest run --project unit src/core/boot.test.ts`.

- [ ] **Step 7: Implementieren** in `src/core/boot.ts`

```ts
/** Startzustand wie Legacy init(): Startzustand → gespeicherter Zustand → Host-Zustand → Sample-Speicher. */
export function bootState(
  stored: string | null,
  sampleStore: string | null,
  factoryPcm: readonly (Float32Array | null)[],
  host?: unknown,
): ReturnType<typeof applySampleStore> {
  const state = loadState(host, loadState(parseStored(stored), initialState()));
  return applySampleStore(state, parseSampleStore(sampleStore), factoryPcm);
}
```

Grün prüfen.

- [ ] **Step 8: Commit**

```bash
[n] npm run format && npm run lint && npm run typecheck
git add src/core tests/reference
git commit -m "core: toPcm und Stille-Schnitt (bitgleich zu Legacy), Host-Zustand beim Start

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: store – `untracked` und SampleBank

**Files:**
- Modify: `src/store/signals.ts`, `src/store/signals.test.ts`
- Create: `src/store/samples.ts`, `src/store/samples.test.ts`

**Interfaces:**
- Produces:
  - `untracked<T>(fn: () => T): T`: liest Signale, ohne Abhängigkeiten anzulegen.
  - `type DrumSamples = ReadonlyMap<VoiceId, DrumSample>`
  - `interface SampleBank { readonly drums: ReadonlySignal<DrumSamples>; setDrum(voice: VoiceId, sample: DrumSample | null): void }`
  - `createSampleBank(storage: StorageLike, initial: Partial<Record<VoiceId, DrumSample>>, key?: string): SampleBank`

- [ ] **Step 1: Failing Test** in `src/store/signals.test.ts`

```ts
it('untracked liest, ohne eine Abhängigkeit anzulegen', () => {
  const a = signal(1);
  const b = signal(10);
  const seen: number[] = [];
  const stop = effect(() => {
    seen.push(a.value + untracked(() => b.value));
  });
  b.value = 20;
  a.value = 2;
  expect(seen).toEqual([11, 22]);
  stop();
});
```

- [ ] **Step 2: Implementieren** in `src/store/signals.ts`

```ts
/** Führt fn aus, ohne gelesene Signale als Abhängigkeit des laufenden Effekts zu erfassen. */
export function untracked<T>(fn: () => T): T {
  const prev = tracking;
  tracking = null;
  try {
    return fn();
  } finally {
    tracking = prev;
  }
}
```

Run: `[n] npx vitest run --project unit src/store/signals.test.ts`. Expected: PASS. Mutationsprobe: `tracking = null;` entfernen, der Test muss rot werden.

- [ ] **Step 3: Failing Tests** `src/store/samples.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { SAMPLE_STORAGE_KEY } from '../core/constants.ts';
import { decodePcm } from '../core/samples.ts';
import { effect } from './signals.ts';
import { createSampleBank } from './samples.ts';

function memory(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v);
    },
  };
}
const pcm = Float32Array.from([0, 0.5, -0.5]);

describe('createSampleBank', () => {
  it('startet mit den geladenen Drum-Samples', () => {
    const bank = createSampleBank(memory(), { SD: { pcm, name: 'Snap' } });
    expect(bank.drums.value.get('SD')?.name).toBe('Snap');
  });

  it('setDrum meldet die Änderung und speichert sofort unter D:<Stimme>, Pads bleiben erhalten', () => {
    const storage = memory({ [SAMPLE_STORAGE_KEY]: JSON.stringify({ '0': { d: '' } }) });
    const bank = createSampleBank(storage, {});
    let runs = 0;
    const stop = effect(() => {
      bank.drums.value;
      runs++;
    });
    bank.setDrum('BD', { pcm, name: 'Kick' });
    expect(runs).toBe(2);
    const saved = JSON.parse(storage.data.get(SAMPLE_STORAGE_KEY) ?? '{}') as Record<
      string,
      { d: string; n?: string }
    >;
    expect(saved['0']).toEqual({ d: '' });
    expect(saved['D:BD']?.n).toBe('Kick');
    expect(decodePcm(saved['D:BD']?.d ?? '')[1]).toBeCloseTo(0.5, 3);
    stop();
  });

  it('setDrum(null) entfernt Sample und Speicher-Eintrag', () => {
    const storage = memory();
    const bank = createSampleBank(storage, { CP: { pcm, name: 'X' } });
    bank.setDrum('CP', null);
    expect(bank.drums.value.has('CP')).toBe(false);
    expect(JSON.parse(storage.data.get(SAMPLE_STORAGE_KEY) ?? '{}')).toEqual({});
  });

  it('ein voller oder gesperrter Speicher hält die Änderung nicht auf', () => {
    const bank = createSampleBank(
      {
        getItem: () => {
          throw new Error('gesperrt');
        },
        setItem: () => {
          throw new Error('voll');
        },
      },
      {},
    );
    bank.setDrum('BD', { pcm, name: 'K' });
    expect(bank.drums.value.has('BD')).toBe(true);
  });
});
```

Rot prüfen: `[n] npx vitest run --project unit src/store/samples.test.ts`.

- [ ] **Step 4: Implementieren** `src/store/samples.ts`

```ts
import { SAMPLE_STORAGE_KEY } from '../core/constants.ts';
import { encodePcm, parseSampleStore, type DrumSample } from '../core/samples.ts';
import type { VoiceId } from '../core/types.ts';
import type { StorageLike } from './persist.ts';
import { signal, type ReadonlySignal } from './signals.ts';

export type DrumSamples = ReadonlyMap<VoiceId, DrumSample>;

export interface SampleBank {
  readonly drums: ReadonlySignal<DrumSamples>;
  setDrum(voice: VoiceId, sample: DrumSample | null): void;
}

/**
 * Eigene Drum-Samples (Speicher 'pocket808.smp.v1', Schlüssel 'D:<Stimme>'). Wie Legacy wird sofort
 * gespeichert; andere Einträge (Pads) bleiben unberührt. Speicherfehler werden still übergangen.
 */
export function createSampleBank(
  storage: StorageLike,
  initial: Partial<Record<VoiceId, DrumSample>>,
  key = SAMPLE_STORAGE_KEY,
): SampleBank {
  const drums = signal<DrumSamples>(new Map(Object.entries(initial) as [VoiceId, DrumSample][]));
  const persist = (voice: VoiceId, sample: DrumSample | null): void => {
    try {
      const k = `D:${voice}`;
      const rest = Object.fromEntries(
        Object.entries(parseSampleStore(storage.getItem(key))).filter(([x]) => x !== k),
      );
      const next = sample ? { ...rest, [k]: { d: encodePcm(sample.pcm), n: sample.name } } : rest;
      storage.setItem(key, JSON.stringify(next));
    } catch {
      /* Speicher voll oder gesperrt: wie Legacy still weitermachen */
    }
  };
  return {
    drums,
    setDrum(voice, sample) {
      const m = new Map(drums.peek());
      if (sample) m.set(voice, sample);
      else m.delete(voice);
      drums.value = m;
      persist(voice, sample);
    },
  };
}
```

Grün prüfen, dann `[n] npm run test:unit` (Abdeckung ≥ 90 % für `samples.ts`).

- [ ] **Step 5: Commit**

```bash
[n] npm run format && npm run lint && npm run typecheck
git add src/store
git commit -m "store: untracked und SampleBank für eigene Drum-Samples

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: audio – `engine.decode`

**Files:**
- Modify: `src/audio/engine.ts`, `src/audio/engine.test.ts`

**Interfaces:**
- Consumes: `toPcm` (Task 2).
- Produces: `Engine.decode(data: ArrayBuffer): Promise<Float32Array>`. Legt den Kontext bei Bedarf an (`prepare`). Ohne Audio lehnt es mit `Error('Kein Audio')` ab.

- [ ] **Step 1: Failing Tests** in `src/audio/engine.test.ts`

Im Schein-Kontext `fakeContext()` ergänzen:

```ts
    decodeAudioData: vi.fn((_d: ArrayBuffer) =>
      Promise.resolve({
        numberOfChannels: 1,
        sampleRate: 44100,
        length: 4,
        getChannelData: () => Float32Array.from([0, 0.25, 0.5, 0.25]),
      }),
    ),
```

Tests:

```ts
  it('decode dekodiert über den Kontext und rechnet ins Sample-Format um', async () => {
    const store = createStore(baseState());
    const ctx = fakeContext();
    const engine = createEngine({ store, createContext: () => ctx as never, prerender: false });
    const pcm = await engine.decode(new ArrayBuffer(8));
    expect(ctx.decodeAudioData).toHaveBeenCalledTimes(1);
    expect(pcm.length).toBe(2);
    expect(Math.max(...pcm)).toBeCloseTo(0.9, 5);
    engine.dispose();
  });

  it('decode ohne Audio lehnt ab', async () => {
    const store = createStore(baseState());
    const engine = createEngine({
      store,
      createContext: () => {
        throw new Error('kein AudioContext');
      },
      prerender: false,
    });
    await expect(engine.decode(new ArrayBuffer(8))).rejects.toThrow('Kein Audio');
    engine.dispose();
  });
```

Rot prüfen: `[n] npx vitest run --project unit src/audio/engine.test.ts -t decode`.

- [ ] **Step 2: Implementieren**

- In `Engine` ergänzen: `/** Datei dekodieren und ins Sample-Format (22,05 kHz mono) umrechnen */ decode(data: ArrayBuffer): Promise<Float32Array>;`
- Import `toPcm` aus `../core/samples.ts`.
- Im Rückgabeobjekt:

```ts
    async decode(data) {
      if (!prepare()) throw new Error('Kein Audio');
      const c = must(ctx, 'Kontext');
      const buf = await c.decodeAudioData(data);
      return toPcm(
        Array.from({ length: buf.numberOfChannels }, (_, i) => buf.getChannelData(i)),
        buf.sampleRate,
      );
    },
```

Grün prüfen, dann `[n] npx vitest run --project unit src/audio`.

- [ ] **Step 3: Commit**

```bash
[n] npm run format && npm run lint && npm run typecheck
git add src/audio
git commit -m "audio: decode für eigene Samples

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: ui – DOM-Bausteine

**Files:**
- Create: `src/ui/dom.ts`, `src/ui/dom.test.ts`

**Interfaces:**
- Produces:
  - `interface Scope { add(fn: () => void): void; dispose(): void }`, `createScope(): Scope`
  - `h(tag, props?, children?)` mit `Props { class?; text?; attrs?: Readonly<Record<string,string>>; on?: { [K in keyof HTMLElementEventMap]?: (e: HTMLElementEventMap[K]) => void } }`
  - `bind<T>(scope, read: () => T, apply: (v: T) => void): void`: `apply` läuft beim ersten Mal und danach nur bei geändertem Wert (`Object.is`), ohne Abhängigkeiten aufzuzeichnen.
  - `listen<E extends Event>(scope, target: EventTarget, type: string, fn: (e: E) => void, opts?: AddEventListenerOptions): void`

- [ ] **Step 1: Failing Tests** `src/ui/dom.test.ts`

```ts
import { describe, expect, it, vi } from 'vitest';
import { signal } from '../store/signals.ts';
import { bind, createScope, h, listen } from './dom.ts';

describe('h', () => {
  it('erzeugt Element mit Klasse, Text, Attributen, Ereignissen und Kindern', () => {
    const click = vi.fn();
    const el = h('button', { class: 'chip', text: 'Los', attrs: { type: 'button' }, on: { click } }, [
      h('span', { text: '!' }),
      null,
      false,
    ]);
    el.click();
    expect(el.outerHTML).toBe('<button class="chip" type="button">Los<span>!</span></button>');
    expect(click).toHaveBeenCalledTimes(1);
  });
});

describe('bind', () => {
  it('schreibt beim ersten Mal und nur bei Änderung', () => {
    const scope = createScope();
    const s = signal(1);
    const apply = vi.fn();
    bind(scope, () => s.value % 2, apply);
    s.value = 3;
    s.value = 4;
    expect(apply.mock.calls).toEqual([[1], [0]]);
    scope.dispose();
    s.value = 5;
    expect(apply).toHaveBeenCalledTimes(2);
  });
  it('was apply liest, wird nicht zur Abhängigkeit', () => {
    const scope = createScope();
    const a = signal(1);
    const other = signal(0);
    const apply = vi.fn(() => other.value);
    bind(scope, () => a.value, apply);
    other.value = 1;
    expect(apply).toHaveBeenCalledTimes(1);
    scope.dispose();
  });
});

describe('listen und Scope', () => {
  it('entfernt Listener beim Aufräumen, in umgekehrter Reihenfolge', () => {
    const scope = createScope();
    const order: number[] = [];
    scope.add(() => order.push(1));
    const fn = vi.fn();
    const el = h('div');
    listen(scope, el, 'click', fn);
    scope.add(() => order.push(2));
    el.click();
    scope.dispose();
    el.click();
    expect(fn).toHaveBeenCalledTimes(1);
    expect(order).toEqual([2, 1]);
    scope.dispose();
    expect(order).toEqual([2, 1]);
  });
});
```

Rot prüfen: `[n] npx vitest run --project ui src/ui/dom.test.ts`.

- [ ] **Step 2: Implementieren** `src/ui/dom.ts`

```ts
import { effect, untracked } from '../store/signals.ts';

/*
 * Kleinste DOM-Schicht: Elemente erzeugen, Werte aus Signalen binden, Listener mit Aufräumen.
 * Alles, was an einem Scope hängt, endet mit scope.dispose().
 */

export interface Scope {
  add(fn: () => void): void;
  dispose(): void;
}

export function createScope(): Scope {
  let fns: (() => void)[] = [];
  return {
    add(fn) {
      fns.push(fn);
    },
    dispose() {
      const list = fns;
      fns = [];
      for (const fn of list.reverse()) fn();
    },
  };
}

type Child = Node | string | null | false;

export interface Props {
  class?: string;
  text?: string;
  attrs?: Readonly<Record<string, string>>;
  on?: { [K in keyof HTMLElementEventMap]?: (e: HTMLElementEventMap[K]) => void };
}

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props = {},
  children: readonly Child[] = [],
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props.class) el.className = props.class;
  if (props.text !== undefined) el.textContent = props.text;
  for (const [k, v] of Object.entries(props.attrs ?? {})) el.setAttribute(k, v);
  for (const [type, fn] of Object.entries(props.on ?? {})) {
    el.addEventListener(type, fn as EventListener);
  }
  for (const c of children) if (c !== null && c !== false) el.append(c);
  return el;
}

const UNSET: unique symbol = Symbol('unset');

/** read() bestimmt die Abhängigkeiten; apply() schreibt ins DOM, nur wenn sich der Wert ändert. */
export function bind<T>(scope: Scope, read: () => T, apply: (v: T) => void): void {
  let last: T | typeof UNSET = UNSET;
  scope.add(
    effect(() => {
      const v = read();
      if (last !== UNSET && Object.is(v, last)) return;
      last = v;
      untracked(() => {
        apply(v);
      });
    }),
  );
}

export function listen<E extends Event>(
  scope: Scope,
  target: EventTarget,
  type: string,
  fn: (e: E) => void,
  opts?: AddEventListenerOptions,
): void {
  const handler = fn as EventListener;
  target.addEventListener(type, handler, opts);
  scope.add(() => {
    target.removeEventListener(type, handler, opts);
  });
}
```

Grün prüfen. Mutationsprobe: `untracked(() => { apply(v); })` durch `apply(v)` ersetzen, der zweite bind-Test muss rot werden.

- [ ] **Step 3: Commit**

```bash
[n] npm run format && npm run lint && npm run typecheck
git add src/ui
git commit -m "ui: DOM-Bausteine h, bind, listen mit Scope

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: ui – Layout-Signal

**Files:**
- Create: `src/ui/layout.ts`, `src/ui/layout.test.ts`

**Interfaces:**
- Produces:
  - `type Layout = 'mobile' | 'tablet' | 'desktop'`
  - `QUERIES = { tablet: '(min-width: 768px)', desktop: '(min-width: 1024px)', coarse: '(pointer: coarse)' }`
  - `layoutFor(m: { tablet: boolean; desktop: boolean; coarse: boolean }): Layout`
  - `watchLayout(scope: Scope, win: Pick<Window, 'matchMedia'>, root: HTMLElement): ReadonlySignal<Layout>`: setzt `root.dataset.layout`.

- [ ] **Step 1: Failing Tests** `src/ui/layout.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { createScope } from './dom.ts';
import { layoutFor, QUERIES, watchLayout } from './layout.ts';

describe('layoutFor', () => {
  it.each([
    [{ tablet: false, desktop: false, coarse: true }, 'mobile'], // iPhone
    [{ tablet: false, desktop: false, coarse: false }, 'mobile'], // schmales Fenster
    [{ tablet: true, desktop: false, coarse: true }, 'tablet'], // iPad hochkant
    [{ tablet: true, desktop: true, coarse: true }, 'tablet'], // iPad quer: bleibt Tablet
    [{ tablet: true, desktop: false, coarse: false }, 'tablet'], // Desktop-Fenster 768–1023
    [{ tablet: true, desktop: true, coarse: false }, 'desktop'],
  ] as const)('%o → %s', (m, expected) => {
    expect(layoutFor(m)).toBe(expected);
  });
});

function fakeMedia(initial: Record<string, boolean>) {
  const lists = new Map<string, { matches: boolean; fns: Set<() => void> }>();
  return {
    matchMedia(q: string) {
      const entry = lists.get(q) ?? { matches: initial[q] ?? false, fns: new Set<() => void>() };
      lists.set(q, entry);
      return {
        get matches() {
          return entry.matches;
        },
        addEventListener: (_: string, fn: () => void) => entry.fns.add(fn),
        removeEventListener: (_: string, fn: () => void) => entry.fns.delete(fn),
      } as unknown as MediaQueryList;
    },
    set(q: string, v: boolean) {
      const e = lists.get(q);
      if (!e) throw new Error(q);
      e.matches = v;
      for (const fn of e.fns) fn();
    },
    listeners: () => [...lists.values()].reduce((n, e) => n + e.fns.size, 0),
  };
}

describe('watchLayout', () => {
  it('folgt den Media Queries und setzt data-layout', () => {
    const scope = createScope();
    const win = fakeMedia({ [QUERIES.tablet]: true, [QUERIES.coarse]: true });
    const root = document.createElement('html');
    const layout = watchLayout(scope, win, root);
    expect(layout.value).toBe('tablet');
    expect(root.dataset.layout).toBe('tablet');
    win.set(QUERIES.tablet, false);
    expect(root.dataset.layout).toBe('mobile');
    scope.dispose();
    expect(win.listeners()).toBe(0);
  });
});
```

Rot prüfen: `[n] npx vitest run --project ui src/ui/layout.test.ts`.

- [ ] **Step 2: Implementieren** `src/ui/layout.ts`

```ts
import { signal, type ReadonlySignal } from '../store/signals.ts';
import { bind, listen, type Scope } from './dom.ts';

export type Layout = 'mobile' | 'tablet' | 'desktop';

export const QUERIES = {
  tablet: '(min-width: 768px)',
  desktop: '(min-width: 1024px)',
  coarse: '(pointer: coarse)',
} as const;

/** Touch-Geräte ab 768 px sind immer Tablet (auch quer); Desktop braucht Breite und feinen Zeiger. */
export function layoutFor(m: { tablet: boolean; desktop: boolean; coarse: boolean }): Layout {
  if (!m.tablet) return 'mobile';
  return m.desktop && !m.coarse ? 'desktop' : 'tablet';
}

export function watchLayout(
  scope: Scope,
  win: Pick<Window, 'matchMedia'>,
  root: HTMLElement,
): ReadonlySignal<Layout> {
  const mq = {
    tablet: win.matchMedia(QUERIES.tablet),
    desktop: win.matchMedia(QUERIES.desktop),
    coarse: win.matchMedia(QUERIES.coarse),
  };
  const read = (): Layout =>
    layoutFor({ tablet: mq.tablet.matches, desktop: mq.desktop.matches, coarse: mq.coarse.matches });
  const layout = signal(read());
  for (const m of Object.values(mq)) {
    listen(scope, m, 'change', () => {
      layout.value = read();
    });
  }
  bind(
    scope,
    () => layout.value,
    (l) => {
      root.dataset.layout = l;
    },
  );
  return layout;
}
```

Hinweis: `listen` nutzt `addEventListener` am MediaQueryList (Baseline 2024). Der Fake im Test bietet genau das.

Grün prüfen.

- [ ] **Step 3: Commit**

```bash
[n] npm run format && npm run lint && npm run typecheck
git add src/ui
git commit -m "ui: Layout-Signal (mobile, tablet, desktop) mit data-layout

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: ui – Styles, LCD-Zeile, UiContext und Test-Hilfen

**Files:**
- Create: `src/ui/styles/app.css`, `reset.css`, `tokens.css`, `base.css`, `layout.css` (vorerst leer mit Layer-Kopf), `src/ui/readout.ts`, `src/ui/readout.test.ts`, `src/ui/context.ts`, `src/ui/test-utils.ts`

**Interfaces:**
- Produces:
  - `interface Readout { readonly text: ReadonlySignal<string>; flash(text: string): void }`
  - `createReadout(scope: Scope, base: ReadonlySignal<string>, timer: Timer, ms?: number): Readout` (Standard 1400 ms)
  - `voiceLine(store: Store, available: boolean): ReadonlySignal<string>`: „BD · Bass Drum“ bzw. „Kein Audio in diesem Browser“
  - `context.ts`:

```ts
export interface UiAudio {
  readonly available: boolean;
  readonly playing: ReadonlySignal<boolean>;
  readonly playhead: ReadonlySignal<{ step: number; songIndex: number }>;
  start(): void;
  stop(): void;
  tick(): void;
  audition(voice: VoiceId): void;
  decode(data: ArrayBuffer): Promise<Float32Array>;
}
export interface UiFiles {
  pickAudio(): Promise<{ data: ArrayBuffer; name: string } | null>;
}
export interface UiContext {
  store: Store;
  samples: SampleBank;
  audio: UiAudio;
  files: UiFiles;
  readout: Readout;
  scope: Scope;
}
```

  - `test-utils.ts`: `makeContext(opts?)` liefert `{ c: UiContext; audio: FakeAudio; files; timer: ManualTimer }`. Dazu `pointer(type, init)` und `press(el)`.

- [ ] **Step 1: Styles anlegen**

`src/ui/styles/app.css`:

```css
@layer reset, tokens, base, components, layout;
@import './reset.css' layer(reset);
@import './tokens.css' layer(tokens);
@import './base.css' layer(base);
@import './layout.css' layer(layout);
```

`reset.css`:

```css
*,
*::before,
*::after {
  box-sizing: border-box;
}
body,
h1,
h2,
h3,
h4,
p {
  margin: 0;
}
button,
select,
input {
  font: inherit;
  color: inherit;
}
[hidden] {
  display: none !important;
}
```

`tokens.css` mit der Palette aus CLAUDE.md und den Größen:

```css
:root {
  --chassis: #08080b;
  --panel: #121217;
  --well: #0c0c10;
  --cell: #1b1b23;
  --ink: #f0f0f6;
  --ink-dim: #7d7d8c;
  --acc: #d3925a;
  --cream: #d4d4dc;
  --font-display: 'Barlow Condensed', 'Arial Narrow', system-ui, sans-serif;
  --font-lcd: 'Share Tech Mono', ui-monospace, Menlo, Consolas, monospace;
  --gap: 12px;
  --pad: 14px;
  --radius: 10px;
  --radius-panel: 16px;
  --touch: 44px;
  --glow-acc: 0 0 22px color-mix(in srgb, var(--acc) 48%, transparent);
  --glow-cream: 0 0 12px rgba(212, 212, 220, 0.22);
  color-scheme: dark;
}
[data-layout='desktop'] {
  --touch: 32px;
}
```

`base.css`:

```css
html {
  background: var(--chassis);
}
body {
  background: var(--chassis);
  color: var(--ink);
  font: 500 15px/1.3 var(--font-display);
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
}
button {
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
  cursor: pointer;
}
button:disabled {
  cursor: default;
  opacity: 0.45;
}
/* einzige erlaubte Kontur: Fokusring für die Tastatur */
:focus-visible {
  outline: 2px solid var(--cream);
  outline-offset: 2px;
}
.cap-label {
  font: 600 12px var(--font-display);
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: var(--ink-dim);
}
.panel {
  padding: 16px var(--pad) var(--pad);
  border-radius: var(--radius-panel);
  background: var(--panel);
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
```

`layout.css` vorerst nur mit dem Kommentar `/* Layouts je data-layout: Task 17 */`.

- [ ] **Step 2: Failing Tests** `src/ui/readout.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { baseState } from '../core/defaults.ts';
import { createStore } from '../store/store.ts';
import { signal } from '../store/signals.ts';
import { createScope } from './dom.ts';
import { createReadout, voiceLine } from './readout.ts';
import { manualTimer } from './test-utils.ts';

describe('createReadout', () => {
  it('zeigt eine Meldung 1,4 s und kehrt dann zur Grundzeile zurück', () => {
    const scope = createScope();
    const timer = manualTimer();
    const r = createReadout(scope, signal('BD · Bass Drum'), timer);
    r.flash('Tempo 120 BPM');
    expect(r.text.value).toBe('Tempo 120 BPM');
    timer.advance(1399);
    r.flash('Tempo 121 BPM');
    timer.advance(1399);
    expect(r.text.value).toBe('Tempo 121 BPM');
    timer.advance(1);
    expect(r.text.value).toBe('BD · Bass Drum');
    scope.dispose();
  });
});

describe('voiceLine', () => {
  it('nennt die gewählte Stimme', () => {
    const store = createStore(baseState());
    const line = voiceLine(store, true);
    expect(line.value).toBe('BD · Bass Drum');
    store.update((s) => ({ ...s, sel: 1 }));
    expect(line.value).toBe('SD · Snare Drum');
  });
  it('meldet fehlendes Audio', () => {
    expect(voiceLine(createStore(baseState()), false).value).toBe('Kein Audio in diesem Browser');
  });
});
```

Hinweis: Die Stimmennamen kommen aus `VOICES` in `src/core/constants.ts`. Die erwarteten Texte im Test bitte dagegen prüfen und anpassen, falls die Namen abweichen.

- [ ] **Step 3: `src/ui/test-utils.ts`**

```ts
import { vi } from 'vitest';
import { baseState } from '../core/defaults.ts';
import type { State } from '../core/types.ts';
import type { Timer } from '../store/persist.ts';
import { createSampleBank } from '../store/samples.ts';
import { signal } from '../store/signals.ts';
import { createStore } from '../store/store.ts';
import type { UiAudio, UiContext } from './context.ts';
import { createScope } from './dom.ts';
import { createReadout, voiceLine } from './readout.ts';

export interface ManualTimer extends Timer {
  advance(ms: number): void;
}

export function manualTimer(): ManualTimer {
  let now = 0;
  let next = 1;
  const jobs = new Map<number, { at: number; fn: () => void }>();
  return {
    set(fn, ms) {
      const id = next++;
      jobs.set(id, { at: now + ms, fn });
      return id;
    },
    clear(h) {
      jobs.delete(h as number);
    },
    advance(ms) {
      now += ms;
      for (const [id, j] of [...jobs].sort((a, b) => a[1].at - b[1].at)) {
        if (j.at <= now) {
          jobs.delete(id);
          j.fn();
        }
      }
    },
  };
}

export function fakeAudio(available = true) {
  const playing = signal(false);
  const playhead = signal({ step: -1, songIndex: -1 });
  const audio = {
    available,
    playing,
    playhead,
    start: vi.fn(() => {
      playing.value = true;
    }),
    stop: vi.fn(() => {
      playing.value = false;
    }),
    tick: vi.fn(),
    audition: vi.fn(),
    decode: vi.fn((_d: ArrayBuffer) => Promise.resolve(Float32Array.from([0, 0, 0.5, 0.2]))),
  } satisfies UiAudio;
  return audio;
}

export function makeContext(opts: { state?: State; available?: boolean } = {}) {
  const store = createStore(opts.state ?? baseState());
  const scope = createScope();
  const timer = manualTimer();
  const audio = fakeAudio(opts.available ?? true);
  const storage = new Map<string, string>();
  const samples = createSampleBank(
    { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) },
    {},
  );
  const files = {
    pickAudio: vi.fn(() =>
      Promise.resolve<{ data: ArrayBuffer; name: string } | null>({
        data: new ArrayBuffer(8),
        name: 'Kick',
      }),
    ),
  };
  const readout = createReadout(scope, voiceLine(store, audio.available), timer);
  const c: UiContext = { store, samples, audio, files, readout, scope };
  return { c, store, audio, files, timer, scope, storage };
}

/** Zeiger-Ereignis für jsdom (kennt PointerEvent nicht überall) */
export function pointer(type: string, init: { clientY?: number; pointerId?: number } = {}): Event {
  const e = new MouseEvent(type, { bubbles: true, cancelable: true, clientY: init.clientY ?? 0 });
  Object.defineProperty(e, 'pointerId', { value: init.pointerId ?? 1 });
  return e;
}

/** Anzahl der DOM-Änderungen während fn (für „ändert genau eine Zelle“) */
export async function countMutations(root: Node, fn: () => void): Promise<number> {
  const seen: MutationRecord[] = [];
  const mo = new MutationObserver((r) => seen.push(...r));
  mo.observe(root, { subtree: true, attributes: true, childList: true, characterData: true });
  fn();
  await Promise.resolve();
  seen.push(...mo.takeRecords());
  mo.disconnect();
  return new Set(seen.map((r) => r.target)).size;
}
```

- [ ] **Step 4: `src/ui/context.ts`** (Interfaces wie oben, mit Imports aus `../core/types.ts`, `../store/samples.ts`, `../store/signals.ts`, `../store/store.ts`, `./dom.ts`, `./readout.ts`)

- [ ] **Step 5: `src/ui/readout.ts` implementieren**

```ts
import { VOICES } from '../core/constants.ts';
import { must } from '../core/util.ts';
import type { Timer } from '../store/persist.ts';
import { computed, signal, type ReadonlySignal } from '../store/signals.ts';
import type { Store } from '../store/store.ts';
import type { Scope } from './dom.ts';

/** LCD-Unterzeile: Grundzeile (gewählte Stimme) oder kurz eine Meldung (Legacy readout). */
export interface Readout {
  readonly text: ReadonlySignal<string>;
  flash(text: string): void;
}

export function createReadout(
  scope: Scope,
  base: ReadonlySignal<string>,
  timer: Timer,
  ms = 1400,
): Readout {
  const message = signal<string | null>(null);
  let handle: unknown = null;
  scope.add(() => {
    if (handle !== null) timer.clear(handle);
  });
  return {
    text: computed(() => message.value ?? base.value),
    flash(text) {
      if (handle !== null) timer.clear(handle);
      message.value = text;
      handle = timer.set(() => {
        handle = null;
        message.value = null;
      }, ms);
    },
  };
}

export function voiceLine(store: Store, available: boolean): ReadonlySignal<string> {
  if (!available) return signal('Kein Audio in diesem Browser');
  return store.select((s) => {
    const v = must(VOICES[s.sel], 'Stimme');
    return `${v.id} · ${v.name}`;
  });
}
```

Grün prüfen: `[n] npx vitest run --project ui src/ui/readout.test.ts`.

- [ ] **Step 6: Commit**

```bash
[n] npm run format && npm run lint && npm run typecheck
git add src/ui
git commit -m "ui: Styles (Layer, Tokens), LCD-Zeile, UiContext und Test-Hilfen

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Steuerelement Knob

**Files:**
- Create: `src/ui/controls/knob.ts`, `knob.css`, `knob.test.ts`

**Interfaces:**
- Produces:

```ts
export interface KnobOptions {
  label: string;
  value: ReadonlySignal<number>; // 0..1
  write(v: number): void;
  def(): number;
  format(v: number): string;
  readout: Readout;
  tag?: () => string;
  onEnd?: () => void;
  now?: () => number;
}
export function knob(scope: Scope, o: KnobOptions): HTMLElement; // .knob-wrap mit .knob[role=slider]
```

Das Verhalten entspricht Legacy `addKnob`:
- Ziehen: Ab 3 px Bewegung ändert sich der Wert um dy/170.
- Doppeltipp innerhalb von 320 ms setzt den Standardwert.
- Pfeiltasten ändern um ±0,02, mit Shift um ±0,1. Pos1 setzt 0, Ende setzt 1.
- Jede Änderung zeigt eine Meldung in der LCD-Zeile, ebenso das Antippen.
- `onEnd` läuft nach dem Ziehen und nach dem Doppeltipp.

- [ ] **Step 1: Failing Tests** `src/ui/controls/knob.test.ts`

```ts
import { describe, expect, it, vi } from 'vitest';
import { signal } from '../../store/signals.ts';
import { makeContext, pointer } from '../test-utils.ts';
import { knob } from './knob.ts';

function setup(initial = 0.5) {
  const { c, timer } = makeContext();
  const v = signal(initial);
  let t = 0;
  const onEnd = vi.fn();
  const write = vi.fn((x: number) => {
    v.value = x;
  });
  const wrap = knob(c.scope, {
    label: 'Tune',
    value: v,
    write,
    def: () => 0.25,
    format: (x) => `${Math.round(x * 100)}`,
    readout: c.readout,
    tag: () => 'BD',
    onEnd,
    now: () => t,
  });
  document.body.append(wrap);
  const el = wrap.querySelector<HTMLElement>('[role=slider]');
  if (!el) throw new Error('kein Regler');
  return { c, v, el, write, onEnd, timer, setTime: (x: number) => (t = x) };
}

describe('knob', () => {
  it('ARIA spiegelt den Wert', () => {
    const { el, v } = setup(0.5);
    expect(el.getAttribute('aria-label')).toBe('Tune');
    expect(el.getAttribute('aria-valuenow')).toBe('50');
    v.value = 0.123;
    expect(el.getAttribute('aria-valuenow')).toBe('12');
    expect(el.getAttribute('aria-valuetext')).toBe('12');
  });

  it('Ziehen nach oben erhöht um dy/170, kleine Wackler zählen nicht', () => {
    const { el, write, onEnd, c } = setup(0.5);
    el.dispatchEvent(pointer('pointerdown', { clientY: 100 }));
    el.dispatchEvent(pointer('pointermove', { clientY: 98 }));
    expect(write).not.toHaveBeenCalled();
    el.dispatchEvent(pointer('pointermove', { clientY: 83 }));
    expect(write).toHaveBeenLastCalledWith(0.6);
    expect(c.readout.text.value).toBe('BD Tune 60');
    el.dispatchEvent(pointer('pointerup'));
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('begrenzt auf 0..1', () => {
    const { el, write } = setup(0.9);
    el.dispatchEvent(pointer('pointerdown', { clientY: 500 }));
    el.dispatchEvent(pointer('pointermove', { clientY: 0 }));
    expect(write).toHaveBeenLastCalledWith(1);
  });

  it('Doppeltipp setzt den Standardwert', () => {
    const { el, write, onEnd, setTime } = setup(0.8);
    el.dispatchEvent(pointer('pointerdown'));
    el.dispatchEvent(pointer('pointerup'));
    setTime(300);
    el.dispatchEvent(pointer('pointerdown'));
    el.dispatchEvent(pointer('pointerup'));
    expect(write).toHaveBeenCalledWith(0.25);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('langsamer zweiter Tipp ist kein Doppeltipp', () => {
    const { el, write, setTime } = setup(0.8);
    el.dispatchEvent(pointer('pointerdown'));
    el.dispatchEvent(pointer('pointerup'));
    setTime(400);
    el.dispatchEvent(pointer('pointerdown'));
    el.dispatchEvent(pointer('pointerup'));
    expect(write).not.toHaveBeenCalled();
  });

  it.each([
    ['ArrowUp', false, 0.52],
    ['ArrowRight', true, 0.6],
    ['ArrowDown', false, 0.48],
    ['ArrowLeft', true, 0.4],
    ['Home', false, 0],
    ['End', false, 1],
  ])('Taste %s (Shift %s) → %f', (key, shiftKey, expected) => {
    const { el, write } = setup(0.5);
    const e = new KeyboardEvent('keydown', { key, shiftKey, cancelable: true });
    el.dispatchEvent(e);
    expect(write.mock.calls[0]?.[0]).toBeCloseTo(expected, 10);
    expect(e.defaultPrevented).toBe(true);
  });

  it('andere Tasten bleiben unberührt', () => {
    const { el, write } = setup(0.5);
    const e = new KeyboardEvent('keydown', { key: 'a', cancelable: true });
    el.dispatchEvent(e);
    expect(write).not.toHaveBeenCalled();
    expect(e.defaultPrevented).toBe(false);
  });

  it('pointercancel beendet das Ziehen', () => {
    const { el, write } = setup(0.5);
    el.dispatchEvent(pointer('pointerdown', { clientY: 100 }));
    el.dispatchEvent(pointer('pointercancel'));
    el.dispatchEvent(pointer('pointermove', { clientY: 0 }));
    expect(write).not.toHaveBeenCalled();
  });
});
```

Rot prüfen: `[n] npx vitest run --project ui src/ui/controls/knob.test.ts`.

- [ ] **Step 2: Implementieren** `src/ui/controls/knob.ts`

```ts
import { clamp } from '../../core/persist.ts';
import type { ReadonlySignal } from '../../store/signals.ts';
import { bind, h, listen, type Scope } from '../dom.ts';
import type { Readout } from '../readout.ts';
import './knob.css';

export interface KnobOptions {
  label: string;
  value: ReadonlySignal<number>;
  write(v: number): void;
  def(): number;
  format(v: number): string;
  readout: Readout;
  tag?: () => string;
  onEnd?: () => void;
  now?: () => number;
}

const KEYS: Readonly<Record<string, (v: number, step: number) => number>> = {
  ArrowUp: (v, d) => v + d,
  ArrowRight: (v, d) => v + d,
  ArrowDown: (v, d) => v - d,
  ArrowLeft: (v, d) => v - d,
  Home: () => 0,
  End: () => 1,
};

/** Drehregler (Legacy addKnob): ziehen, Doppeltipp = Standardwert, Tastatur, role=slider. */
export function knob(scope: Scope, o: KnobOptions): HTMLElement {
  const now = o.now ?? (() => performance.now());
  const el = h(
    'div',
    {
      class: 'knob',
      attrs: {
        role: 'slider',
        tabindex: '0',
        'aria-label': o.label,
        'aria-valuemin': '0',
        'aria-valuemax': '100',
      },
    },
    [h('div', { class: 'ring' }), h('div', { class: 'dial' })],
  );
  const wrap = h('div', { class: 'knob-wrap' }, [
    el,
    h('div', { class: 'knob-label', text: o.label, attrs: { 'aria-hidden': 'true' } }),
  ]);
  bind(
    scope,
    () => o.value.value,
    (v) => {
      el.style.setProperty('--v', String(v));
      el.style.setProperty('--rot', `${-135 + v * 270}deg`);
      el.setAttribute('aria-valuenow', String(Math.round(v * 100)));
      el.setAttribute('aria-valuetext', o.format(v));
    },
  );
  const say = (v: number): void => {
    o.readout.flash(`${o.tag ? `${o.tag()} ` : ''}${o.label} ${o.format(v)}`);
  };
  const apply = (v: number): void => {
    const x = clamp(v, 0, 1);
    o.write(x);
    say(x);
  };
  let drag: { y: number; v: number; moved: boolean } | null = null;
  let lastTap = -Infinity;
  listen<PointerEvent>(scope, el, 'pointerdown', (e) => {
    e.preventDefault();
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      /* jsdom und ältere Browser */
    }
    drag = { y: e.clientY, v: o.value.peek(), moved: false };
    say(drag.v);
  });
  listen<PointerEvent>(scope, el, 'pointermove', (e) => {
    if (!drag) return;
    const dy = drag.y - e.clientY;
    if (Math.abs(dy) > 3) drag.moved = true;
    if (drag.moved) apply(drag.v + dy / 170);
  });
  listen(scope, el, 'pointerup', () => {
    if (!drag) return;
    const moved = drag.moved;
    drag = null;
    if (moved) {
      o.onEnd?.();
      return;
    }
    const t = now();
    if (t - lastTap < 320) {
      apply(o.def());
      lastTap = -Infinity;
      o.onEnd?.();
    } else lastTap = t;
  });
  listen(scope, el, 'pointercancel', () => {
    drag = null;
  });
  listen<KeyboardEvent>(scope, el, 'keydown', (e) => {
    const fn = KEYS[e.key];
    if (!fn) return;
    e.preventDefault();
    apply(fn(o.value.peek(), e.shiftKey ? 0.1 : 0.02));
  });
  return wrap;
}
```

Hinweis zu jsdom: `setPointerCapture` fehlt dort, der `try` fängt das ab. Wenn `clamp` nicht aus `persist.ts` exportiert ist: Es ist exportiert (`export const clamp`).

- [ ] **Step 3: `knob.css`** (Club-Look aus Legacy übertragen, in `@layer components`)

```css
@layer components {
  .knob-wrap {
    display: grid;
    justify-items: center;
    gap: 6px;
    width: 60px;
  }
  .knob {
    position: relative;
    width: 48px;
    height: 48px;
    margin: 6px;
    border-radius: 50%;
    background: var(--cell);
    touch-action: none;
    cursor: ns-resize;
  }
  .knob .ring {
    position: absolute;
    inset: -6px;
    border-radius: 50%;
    pointer-events: none;
    background: conic-gradient(
      from 225deg,
      var(--acc) calc(var(--v, 0) * 270deg),
      #2a2a34 calc(var(--v, 0) * 270deg) 270deg,
      transparent 270deg
    );
    mask: radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 3px));
  }
  .knob .dial {
    position: absolute;
    inset: 0;
    pointer-events: none;
    transform: rotate(var(--rot, -135deg));
  }
  .knob .dial::before {
    content: '';
    position: absolute;
    left: 50%;
    top: 5px;
    width: 3px;
    height: 14px;
    margin-left: -1.5px;
    border-radius: 2px;
    background: var(--ink);
  }
  .knob-label {
    font: 600 12px var(--font-display);
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--ink-dim);
  }
}
```

Grün prüfen, Abdeckung prüfen mit `[n] npm run test:unit`.

- [ ] **Step 4: Commit**

```bash
[n] npm run format && npm run lint && npm run typecheck
git add src/ui
git commit -m "ui: Drehregler (ziehen, Doppeltipp, Tastatur, ARIA)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Steuerelemente Chip, Segment, Step-Knopf, Lauflicht-Markierung

**Files:**
- Create: `src/ui/controls/chip.ts`, `chip.css`, `segment.ts`, `segment.css`, `step-button.ts`, `step-button.css`, `marker.ts`, `controls.test.ts`

**Interfaces:**
- Produces:

```ts
export interface ChipOptions {
  label: string | ReadonlySignal<string>;
  ariaLabel?: string;
  onClick(): void;
  active?: ReadonlySignal<boolean>; // Klasse active + aria-pressed
  disabled?: ReadonlySignal<boolean>;
}
export function chip(scope: Scope, o: ChipOptions): HTMLButtonElement;

export interface SegmentOptions<T extends string> {
  label: string;
  options: readonly { value: T; label: string }[];
  value: ReadonlySignal<T>;
  write(v: T): void;
}
export function segment<T extends string>(scope: Scope, o: SegmentOptions<T>): HTMLElement; // role=radiogroup

export interface StepButtonOptions {
  label: string; // aria-label
  text?: string; // sichtbare Nummer
  class: string; // 'step' | 'cell' | 'sb'
  on: ReadonlySignal<boolean>;
  sub?: ReadonlySignal<boolean>; // Klasse sub (hat Sub-Steps)
  disabled?: ReadonlySignal<boolean>;
  onPress(): void;
}
export function stepButton(scope: Scope, o: StepButtonOptions): HTMLButtonElement;

/** Markiert die Elemente des aktuellen Steps mit einer Klasse; ändert nur alte und neue Spalte. */
export function markColumn(
  scope: Scope,
  step: ReadonlySignal<number>,
  at: (s: number) => readonly Element[],
  cls?: string,
): void;
```

- [ ] **Step 1: Failing Tests** `src/ui/controls/controls.test.ts`

```ts
import { describe, expect, it, vi } from 'vitest';
import { signal } from '../../store/signals.ts';
import { createScope, h } from '../dom.ts';
import { chip } from './chip.ts';
import { markColumn } from './marker.ts';
import { segment } from './segment.ts';
import { stepButton } from './step-button.ts';

describe('chip', () => {
  it('Klick, aktiv, gesperrt, Text aus Signal', () => {
    const scope = createScope();
    const onClick = vi.fn();
    const active = signal(false);
    const disabled = signal(false);
    const label = signal('Eigenes Sample');
    const b = chip(scope, { label, ariaLabel: 'Laden', onClick, active, disabled });
    b.click();
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(b.getAttribute('aria-label')).toBe('Laden');
    expect(b.getAttribute('aria-pressed')).toBe('false');
    active.value = true;
    expect(b.classList.contains('active')).toBe(true);
    expect(b.getAttribute('aria-pressed')).toBe('true');
    disabled.value = true;
    expect(b.disabled).toBe(true);
    label.value = 'Sample ersetzen';
    expect(b.textContent).toBe('Sample ersetzen');
  });
  it('ohne active kein aria-pressed', () => {
    const b = chip(createScope(), { label: 'Leeren', onClick: () => undefined });
    expect(b.hasAttribute('aria-pressed')).toBe(false);
    expect(b.type).toBe('button');
  });
});

describe('segment', () => {
  it('radiogroup mit Pfeiltasten und rovingem tabindex', () => {
    const scope = createScope();
    const value = signal<'pattern' | 'song'>('pattern');
    const write = vi.fn((v: 'pattern' | 'song') => {
      value.value = v;
    });
    const g = segment(scope, {
      label: 'Wiedergabe',
      options: [
        { value: 'pattern', label: 'Pattern' },
        { value: 'song', label: 'Song' },
      ],
      value,
      write,
    });
    document.body.append(g);
    const [a, b] = [...g.querySelectorAll<HTMLButtonElement>('[role=radio]')];
    if (!a || !b) throw new Error('Knöpfe fehlen');
    expect(g.getAttribute('role')).toBe('radiogroup');
    expect(a.getAttribute('aria-checked')).toBe('true');
    expect([a.tabIndex, b.tabIndex]).toEqual([0, -1]);
    a.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(write).toHaveBeenCalledWith('song');
    expect(document.activeElement).toBe(b);
    expect([a.tabIndex, b.tabIndex]).toEqual([-1, 0]);
    b.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(write).toHaveBeenLastCalledWith('pattern');
    a.click();
    expect(write).toHaveBeenLastCalledWith('pattern');
  });
});

describe('stepButton', () => {
  it('on, sub und gesperrt als Klassen und ARIA', () => {
    const scope = createScope();
    const on = signal(false);
    const sub = signal(false);
    const disabled = signal(false);
    const onPress = vi.fn();
    const b = stepButton(scope, { label: 'Step 1', text: '1', class: 'step', on, sub, disabled, onPress });
    b.click();
    expect(onPress).toHaveBeenCalledTimes(1);
    on.value = true;
    sub.value = true;
    expect(b.className).toBe('step on sub');
    expect(b.getAttribute('aria-pressed')).toBe('true');
    disabled.value = true;
    expect(b.disabled).toBe(true);
  });
});

describe('markColumn', () => {
  it('setzt die Klasse nur an alter und neuer Spalte', () => {
    const scope = createScope();
    const cols = Array.from({ length: 4 }, () => [h('div'), h('div')]);
    const step = signal(-1);
    markColumn(scope, step, (s) => cols[s] ?? []);
    step.value = 1;
    expect(cols[1]?.every((e) => e.classList.contains('now'))).toBe(true);
    step.value = 2;
    expect(cols[1]?.some((e) => e.classList.contains('now'))).toBe(false);
    expect(cols[2]?.every((e) => e.classList.contains('now'))).toBe(true);
    step.value = -1;
    expect(cols.flat().some((e) => e.classList.contains('now'))).toBe(false);
  });
});
```

Rot prüfen: `[n] npx vitest run --project ui src/ui/controls/controls.test.ts`.

- [ ] **Step 2: Implementieren**

`chip.ts`:

```ts
import type { ReadonlySignal } from '../../store/signals.ts';
import { bind, h, type Scope } from '../dom.ts';
import './chip.css';

export interface ChipOptions {
  label: string | ReadonlySignal<string>;
  ariaLabel?: string;
  onClick(): void;
  active?: ReadonlySignal<boolean>;
  disabled?: ReadonlySignal<boolean>;
}

export function chip(scope: Scope, o: ChipOptions): HTMLButtonElement {
  const b = h('button', { class: 'chip', attrs: { type: 'button' }, on: { click: () => o.onClick() } });
  if (o.ariaLabel) b.setAttribute('aria-label', o.ariaLabel);
  const label = o.label;
  if (typeof label === 'string') b.textContent = label;
  else bind(scope, () => label.value, (t) => (b.textContent = t));
  const active = o.active;
  if (active) {
    bind(scope, () => active.value, (v) => {
      b.classList.toggle('active', v);
      b.setAttribute('aria-pressed', String(v));
    });
  }
  const disabled = o.disabled;
  if (disabled) bind(scope, () => disabled.value, (v) => (b.disabled = v));
  return b;
}
```

`segment.ts`:

```ts
import type { ReadonlySignal } from '../../store/signals.ts';
import { bind, h, listen, type Scope } from '../dom.ts';
import './segment.css';

export interface SegmentOptions<T extends string> {
  label: string;
  options: readonly { value: T; label: string }[];
  value: ReadonlySignal<T>;
  write(v: T): void;
}

/** Umschalter als radiogroup: ein Tab-Stopp, Pfeiltasten wählen und fokussieren (WAI-ARIA). */
export function segment<T extends string>(scope: Scope, o: SegmentOptions<T>): HTMLElement {
  const g = h('div', { class: 'seg', attrs: { role: 'radiogroup', 'aria-label': o.label } });
  const buttons = o.options.map((opt) =>
    h('button', {
      text: opt.label,
      attrs: { type: 'button', role: 'radio' },
      on: { click: () => o.write(opt.value) },
    }),
  );
  g.append(...buttons);
  bind(scope, () => o.value.value, (v) => {
    o.options.forEach((opt, i) => {
      const b = buttons[i];
      if (!b) return;
      b.setAttribute('aria-checked', String(opt.value === v));
      b.tabIndex = opt.value === v ? 0 : -1;
    });
  });
  listen<KeyboardEvent>(scope, g, 'keydown', (e) => {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const i = o.options.findIndex((opt) => opt.value === o.value.peek());
    const n = (i + d + o.options.length) % o.options.length;
    const next = o.options[n];
    if (!next) return;
    o.write(next.value);
    buttons[n]?.focus();
  });
  return g;
}
```

`step-button.ts`:

```ts
import type { ReadonlySignal } from '../../store/signals.ts';
import { bind, h, type Scope } from '../dom.ts';
import './step-button.css';

export interface StepButtonOptions {
  label: string;
  text?: string;
  class: string;
  on: ReadonlySignal<boolean>;
  sub?: ReadonlySignal<boolean>;
  disabled?: ReadonlySignal<boolean>;
  onPress(): void;
}

export function stepButton(scope: Scope, o: StepButtonOptions): HTMLButtonElement {
  const b = h(
    'button',
    { class: o.class, attrs: { type: 'button', 'aria-label': o.label }, on: { click: () => o.onPress() } },
    o.text ? [h('span', { text: o.text, attrs: { 'aria-hidden': 'true' } })] : [],
  );
  bind(scope, () => o.on.value, (v) => {
    b.classList.toggle('on', v);
    b.setAttribute('aria-pressed', String(v));
  });
  const sub = o.sub;
  if (sub) bind(scope, () => sub.value, (v) => b.classList.toggle('sub', v));
  const disabled = o.disabled;
  if (disabled) bind(scope, () => disabled.value, (v) => (b.disabled = v));
  return b;
}
```

`marker.ts`:

```ts
import type { ReadonlySignal } from '../../store/signals.ts';
import { bind, type Scope } from '../dom.ts';

export function markColumn(
  scope: Scope,
  step: ReadonlySignal<number>,
  at: (s: number) => readonly Element[],
  cls = 'now',
): void {
  let prev = -1;
  bind(scope, () => step.value, (s) => {
    if (prev >= 0) for (const el of at(prev)) el.classList.remove(cls);
    if (s >= 0) for (const el of at(s)) el.classList.add(cls);
    prev = s;
  });
}
```

- [ ] **Step 3: CSS** (in `@layer components`, Werte aus dem Club-Look-Block von Legacy)

`chip.css`:

```css
@layer components {
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .chip {
    position: relative;
    min-height: var(--touch);
    padding: 0 14px;
    border: 0;
    border-radius: var(--radius);
    background: var(--cell);
    font: 600 13px var(--font-display);
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  .chip:active:not(:disabled) {
    filter: brightness(1.3);
  }
  .chip.active {
    z-index: 1;
    background: var(--cream);
    color: var(--chassis);
    box-shadow: var(--glow-cream);
  }
}
```

`segment.css`:

```css
@layer components {
  .seg {
    display: inline-flex;
    padding: 3px;
    border-radius: var(--radius);
    background: var(--cell);
  }
  .seg button {
    position: relative;
    min-height: var(--touch);
    padding: 0 14px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    font: 600 13px var(--font-display);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--ink-dim);
  }
  .seg button[aria-checked='true'] {
    z-index: 1;
    background: var(--cream);
    color: var(--chassis);
    box-shadow: var(--glow-cream);
  }
}
```

`step-button.css`:

```css
@layer components {
  .step {
    position: relative;
    height: 58px;
    padding: 0;
    border: 0;
    border-radius: 8px;
    background: color-mix(in srgb, var(--acc) 9%, var(--cell));
  }
  .step span {
    position: absolute;
    inset: auto 0 5px;
    font: 12px var(--font-lcd);
    color: color-mix(in srgb, var(--acc) 40%, var(--cell));
  }
  .step::before {
    content: '';
    position: absolute;
    top: 8px;
    left: 50%;
    width: 6px;
    height: 6px;
    margin-left: -3px;
    border-radius: 50%;
  }
  .step.on {
    z-index: 1;
    background: var(--acc);
    box-shadow: var(--glow-acc);
  }
  .step.on span {
    color: rgba(0, 0, 0, 0.55);
  }
  .step.on::before {
    background: #fff;
  }
  .step.sub::before {
    width: 16px;
    height: 4px;
    margin-left: -8px;
    border-radius: 2px;
    background: repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.35) 0 2px, transparent 2px 4px);
  }
  .step.now {
    filter: brightness(1.7);
  }
  .step.on.now {
    box-shadow: 0 0 30px color-mix(in srgb, var(--acc) 70%, transparent);
  }
  .step.subsel {
    filter: brightness(1.3);
    outline: 2px solid var(--cream);
    outline-offset: 2px;
  }
  .sb {
    position: relative;
    min-height: 36px;
    border: 0;
    border-radius: 6px;
    background: var(--cell);
    font: 12px var(--font-lcd);
    color: var(--ink-dim);
  }
  .sb.q {
    background: #23232d;
  }
  .sb.on {
    z-index: 1;
    background: var(--acc);
    color: var(--chassis);
    box-shadow: 0 0 14px rgba(211, 146, 90, 0.42);
  }
}
```

Hinweis: `.step.subsel` nutzt einen Rahmen als Auswahlmarke. Das ist eine bewusste Ausnahme wie der Fokusring, denn Legacy markierte die Auswahl mit `drop-shadow`. Die Farbe ist `--cream`, eine neue Farbe kommt nicht hinzu.

Grün prüfen.

- [ ] **Step 4: Commit**

```bash
[n] npm run format && npm run lint && npm run typecheck
git add src/ui
git commit -m "ui: Chip, Segment, Step-Knopf und Lauflicht-Markierung

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Panels Kopf, Deck, Slots

**Files:**
- Create: `src/ui/panels/brand.ts`, `deck.ts`, `slots.ts`, `deck.css`, `panels-head.test.ts`

**Interfaces:**
- Consumes: `UiContext`, `knob`.
- Produces:
  - `brand(): HTMLElement` (`data-area="brand"`, Titel „Pocket 808“, Untertitel „Drum Machine · Synth“, Farbstreifen).
  - `deck(c: UiContext): HTMLElement` (`data-area="deck"`).
  - `slots(c: UiContext): HTMLElement` (`data-area="slots"`).

- [ ] **Step 1: Failing Tests** `src/ui/panels/panels-head.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { makeContext, pointer } from '../test-utils.ts';
import { deck } from './deck.ts';
import { slots } from './slots.ts';

describe('deck', () => {
  it('zeigt das Tempo dreistellig und die LCD-Zeile', () => {
    const { c, store } = makeContext();
    const el = deck(c);
    expect(el.querySelector('.lcd-digits')?.textContent).toBe(String(store.state.value.tempo).padStart(3, '0'));
    store.update((s) => ({ ...s, tempo: 95 }));
    expect(el.querySelector('.lcd-digits')?.textContent).toBe('095');
    expect(el.querySelector('.lcd-sub')?.textContent).toBe('BD · Bass Drum');
  });

  it('Tempo-, Swing- und Master-Regler schreiben in den Store', () => {
    const { c, store } = makeContext();
    const el = deck(c);
    document.body.append(el);
    const [tempo, swing, master] = [...el.querySelectorAll<HTMLElement>('[role=slider]')];
    tempo?.dispatchEvent(new KeyboardEvent('keydown', { key: 'End' }));
    expect(store.state.value.tempo).toBe(200);
    swing?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home' }));
    expect(store.state.value.swing).toBe(0);
    master?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home' }));
    expect(store.state.value.master).toBe(0);
    expect(c.readout.text.value).toBe('Master 0');
  });

  it('Doppeltipp auf Tempo setzt 90 BPM', () => {
    const { c, store } = makeContext();
    const el = deck(c);
    const tempo = el.querySelector<HTMLElement>('[role=slider]');
    for (let i = 0; i < 2; i++) {
      tempo?.dispatchEvent(pointer('pointerdown'));
      tempo?.dispatchEvent(pointer('pointerup'));
    }
    expect(store.state.value.tempo).toBe(90);
  });
});

describe('slots', () => {
  it('wählt Pattern, markiert Auswahl und Inhalt', () => {
    const { c, store } = makeContext();
    const el = slots(c);
    const b = el.querySelector<HTMLButtonElement>('[aria-label="Pattern B"]');
    b?.click();
    expect(store.state.value.cur).toBe('B');
    expect(b?.getAttribute('aria-pressed')).toBe('true');
    expect(b?.classList.contains('sel')).toBe(true);
    expect(b?.classList.contains('has')).toBe(false);
    store.toggleStep('BD', 0);
    expect(b?.classList.contains('has')).toBe(true);
  });
});
```

Hinweis: `baseState()` muss leere Patterns haben, damit `has` anfangs falsch ist. Falls nicht, den Test auf ein Pattern umstellen, das in `baseState()` leer ist.

Rot prüfen: `[n] npx vitest run --project ui src/ui/panels/panels-head.test.ts`.

- [ ] **Step 2: Implementieren**

`brand.ts`:

```ts
import { h } from '../dom.ts';

export function brand(): HTMLElement {
  return h('header', { class: 'brand', attrs: { 'data-area': 'brand' } }, [
    h('div', {}, [
      h('h1', { text: 'Pocket 808' }),
      h('div', { class: 'brand-sub', text: 'Drum Machine · Synth' }),
    ]),
    h('div', { class: 'stripe', attrs: { 'aria-hidden': 'true' } }, [h('i'), h('i'), h('i'), h('i')]),
  ]);
}
```

`deck.ts`:

```ts
import { bind, h } from '../dom.ts';
import type { UiContext } from '../context.ts';
import { knob } from '../controls/knob.ts';
import './deck.css';

const toTempo = (v: number): number => Math.round(60 + v * 140);

export function deck(c: UiContext): HTMLElement {
  const { store, scope, readout } = c;
  const digits = h('span', { class: 'lcd-digits' });
  bind(scope, () => store.state.value.tempo, (t) => (digits.textContent = String(t).padStart(3, '0')));
  const sub = h('div', { class: 'lcd-sub' });
  bind(scope, () => readout.text.value, (t) => (sub.textContent = t));
  const lcd = h('div', { class: 'lcd', attrs: { role: 'group', 'aria-label': 'Anzeige' } }, [
    h('div', { class: 'lcd-main' }, [digits, h('span', { class: 'lcd-unit', text: 'BPM' })]),
    sub,
  ]);
  const knobs = h('div', { class: 'knob-row' }, [
    knob(scope, {
      label: 'Tempo',
      value: store.select((s) => (s.tempo - 60) / 140),
      write: (v) => store.update((s) => ({ ...s, tempo: toTempo(v) })),
      def: () => (90 - 60) / 140,
      format: (v) => `${toTempo(v)} BPM`,
      readout,
    }),
    knob(scope, {
      label: 'Swing',
      value: store.select((s) => s.swing),
      write: (v) => store.update((s) => ({ ...s, swing: v })),
      def: () => 0,
      format: (v) => `${Math.round(v * 100)} %`,
      readout,
    }),
    knob(scope, {
      label: 'Master',
      value: store.select((s) => s.master),
      write: (v) => store.update((s) => ({ ...s, master: v })),
      def: () => 0.8,
      format: (v) => String(Math.round(v * 100)),
      readout,
    }),
  ]);
  return h('section', { class: 'deck', attrs: { 'aria-label': 'Tempo und Master', 'data-area': 'deck' } }, [
    lcd,
    knobs,
  ]);
}
```

Hinweis: Die Pfeilfunktionen in `bind` geben einen Wert zurück (`(t) => (x = t)`). Falls ESLint (`no-return-assign` oder `@typescript-eslint/no-confusing-void-expression`) das meldet, als Block schreiben: `(t) => { x = t; }`. Das gilt für alle folgenden Tasks.

`slots.ts`:

```ts
import { SLOTS } from '../../core/constants.ts';
import { patternHasContent } from '../../core/pattern.ts';
import { bind, h } from '../dom.ts';
import type { UiContext } from '../context.ts';

export function slots(c: UiContext): HTMLElement {
  const group = h('div', {
    class: 'slots',
    attrs: { role: 'group', 'aria-label': 'Pattern wählen', 'data-area': 'slots' },
  });
  for (const k of SLOTS) {
    const sel = c.store.select((s) => s.cur === k);
    const has = c.store.select((s) => patternHasContent(s.patterns[k]));
    const b = h('button', {
      class: 'slot',
      text: k,
      attrs: { type: 'button', 'aria-label': `Pattern ${k}` },
      on: { click: () => c.store.selectSlot(k) },
    });
    bind(c.scope, () => sel.value, (v) => {
      b.classList.toggle('sel', v);
      b.setAttribute('aria-pressed', String(v));
    });
    bind(c.scope, () => has.value, (v) => b.classList.toggle('has', v));
    group.append(b);
  }
  return group;
}
```

- [ ] **Step 3: `deck.css`** (Kopf, LCD, Regler-Reihe und Slots, Werte aus Legacy)

```css
@layer components {
  .brand {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 12px;
  }
  .brand h1 {
    font: 700 32px/1 var(--font-display);
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }
  .brand-sub {
    margin-top: 4px;
    font: 500 12px var(--font-display);
    letter-spacing: 0.3em;
    text-transform: uppercase;
    color: var(--ink-dim);
  }
  .stripe {
    display: flex;
    gap: 3px;
    padding-bottom: 4px;
    opacity: 0.9;
  }
  .stripe i {
    width: 16px;
    height: 10px;
    border-radius: 1px;
  }
  .stripe i:nth-child(1) {
    background: #2e2e37;
  }
  .stripe i:nth-child(2) {
    background: #45454f;
  }
  .stripe i:nth-child(3) {
    background: #6a6a76;
  }
  .stripe i:nth-child(4) {
    background: var(--acc);
  }
  .deck {
    display: flex;
    flex-wrap: wrap;
    gap: 14px;
    align-items: center;
    justify-content: center;
  }
  .lcd {
    flex: 1 1 150px;
    min-width: 0;
    display: grid;
    gap: 6px;
    padding: 10px 12px;
    border-radius: 14px;
    background: var(--well);
  }
  .lcd-main {
    display: flex;
    align-items: baseline;
    gap: 6px;
    font-family: var(--font-lcd);
  }
  .lcd-digits {
    font-size: 48px;
    line-height: 1;
    color: var(--acc);
    text-shadow: 0 0 10px rgba(211, 146, 90, 0.35);
  }
  .lcd-unit {
    font-size: 13px;
    letter-spacing: 0.1em;
    color: var(--acc);
    opacity: 0.8;
  }
  .lcd-sub {
    min-height: 1.2em;
    overflow: hidden;
    font: 14px var(--font-lcd);
    text-transform: uppercase;
    white-space: nowrap;
    text-overflow: ellipsis;
    color: var(--acc);
    opacity: 0.85;
  }
  .knob-row {
    display: flex;
    gap: 10px;
    justify-content: center;
  }
  .slots {
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    gap: 5px;
  }
  .slot {
    position: relative;
    min-height: max(40px, var(--touch));
    padding: 0;
    border: 0;
    border-radius: 8px;
    background: var(--cell);
    color: var(--ink-dim);
    font: 700 18px var(--font-display);
  }
  .slot.has::after {
    content: '';
    position: absolute;
    top: 5px;
    right: 5px;
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--ink-dim);
  }
  .slot.sel {
    z-index: 1;
    background: var(--cream);
    color: var(--chassis);
    box-shadow: var(--glow-cream);
  }
  .slot.sel.has::after {
    background: var(--chassis);
  }
}
```

Grün prüfen.

- [ ] **Step 4: Commit**

```bash
[n] npm run format && npm run lint && npm run typecheck
git add src/ui
git commit -m "ui: Kopf, Deck (LCD, Tempo, Swing, Master) und Pattern-Slots

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Step-Editor (Steps, Titel, Leeren, Level/Tune/Decay)

**Files:**
- Create: `src/ui/panels/step-editor.ts`, `step-editor.css`, `step-editor.test.ts`, `src/ui/panels/voice.ts`

**Interfaces:**
- Consumes: `stepButton`, `chip`, `knob`, `markColumn`, `UiContext`.
- Produces:
  - `voice.ts`: `selectedVoice(store): ReadonlySignal<VoiceId>`, `drumOn(store, voice: () => VoiceId, step: number): ReadonlySignal<boolean>` (Step oder Sub-Steps), `drumSub(store, voice, step): ReadonlySignal<boolean>`, `toggleWithAudition(c, voice: VoiceId, step: number): void`.
  - `stepEditor(c: UiContext): HTMLElement` (`data-area="editor"`). Enthält `.ed-head` (Titel, Chips), `.steps` mit 4 Gruppen à 4 `.step`, einen Platz `.sub-slot` (Task 12), `.inst` mit Reglern und einen Platz `.smp-slot` (Task 13).
  - Lokaler Zustand `editorSub: Signal<{ on: boolean; step: number }>` wird exportiert als `createEditorSub()`, damit Task 12 ihn nutzen kann.

- [ ] **Step 1: Failing Tests** `src/ui/panels/step-editor.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { countMutations, makeContext } from '../test-utils.ts';
import { stepEditor } from './step-editor.ts';

const steps = (el: HTMLElement) => [...el.querySelectorAll<HTMLButtonElement>('.steps .step')];

describe('stepEditor', () => {
  it('Titel nennt Stimme und Namen; folgt der Auswahl', () => {
    const { c, store } = makeContext();
    const el = stepEditor(c);
    expect(el.querySelector('h2')?.textContent).toBe('BDBass Drum');
    store.update((s) => ({ ...s, sel: 1 }));
    expect(el.querySelector('h2')?.textContent).toBe('SDSnare Drum');
  });

  it('16 Steps; Tipp schaltet und hört nur beim Einschalten im Stand vor', () => {
    const { c, store, audio } = makeContext();
    const el = stepEditor(c);
    const b = steps(el);
    expect(b).toHaveLength(16);
    b[2]?.click();
    expect(store.state.value.patterns.A.BD[2]).toBe(1);
    expect(b[2]?.getAttribute('aria-pressed')).toBe('true');
    expect(audio.audition).toHaveBeenCalledWith('BD');
    b[2]?.click();
    expect(audio.audition).toHaveBeenCalledTimes(1);
    audio.playing.value = true;
    b[3]?.click();
    expect(audio.audition).toHaveBeenCalledTimes(1);
  });

  it('ein Step-Tipp ändert genau eine Zelle im DOM', async () => {
    const { c } = makeContext();
    const el = stepEditor(c);
    document.body.append(el);
    const n = await countMutations(el, () => steps(el)[5]?.click());
    expect(n).toBe(1);
  });

  it('Lauflicht markiert genau den laufenden Step', () => {
    const { c, audio } = makeContext();
    const el = stepEditor(c);
    audio.playhead.value = { step: 4, songIndex: -1 };
    expect(steps(el).map((b) => b.classList.contains('now'))).toEqual(
      Array.from({ length: 16 }, (_, i) => i === 4),
    );
  });

  it('Leeren löscht die Spur (mit Zurück)', () => {
    const { c, store } = makeContext();
    store.toggleStep('BD', 0);
    const el = stepEditor(c);
    el.querySelector<HTMLButtonElement>('[aria-label="Spur leeren"]')?.click();
    expect(store.state.value.patterns.A.BD[0]).toBe(0);
    expect(store.canUndo.value).toBe(true);
  });

  it('Level, Tune, Decay der gewählten Stimme; Tune zeigt ±', () => {
    const { c, store } = makeContext();
    store.update((s) => ({ ...s, sel: 1 }));
    const el = stepEditor(c);
    const [, tune] = [...el.querySelectorAll<HTMLElement>('.inst [role=slider]')];
    tune?.dispatchEvent(new KeyboardEvent('keydown', { key: 'End' }));
    expect(store.state.value.params.SD.tune).toBe(1);
    expect(c.readout.text.value).toBe('SD Tune +50');
  });
});
```

Rot prüfen: `[n] npx vitest run --project ui src/ui/panels/step-editor.test.ts`.

- [ ] **Step 2: `voice.ts` implementieren**

```ts
import { VOICE_IDS } from '../../core/constants.ts';
import { currentPattern, subStepsOf } from '../../core/pattern.ts';
import type { VoiceId } from '../../core/types.ts';
import { must } from '../../core/util.ts';
import type { ReadonlySignal } from '../../store/signals.ts';
import type { Store } from '../../store/store.ts';
import type { UiContext } from '../context.ts';

export const selectedVoice = (store: Store): ReadonlySignal<VoiceId> =>
  store.select((s) => must(VOICE_IDS[s.sel], 'Stimme'));

/** Step klingt: gesetzt oder mit Sub-Steps belegt (Legacy paintStep/paintCell) */
export const drumOn = (store: Store, voice: () => VoiceId, step: number): ReadonlySignal<boolean> =>
  store.select((s) => {
    const p = currentPattern(s);
    const id = voice();
    return p[id][step] === 1 || subStepsOf(p, id, step) !== null;
  });

export const drumSub = (store: Store, voice: () => VoiceId, step: number): ReadonlySignal<boolean> =>
  store.select((s) => subStepsOf(currentPattern(s), voice(), step) !== null);

/** Legacy toggle(): umschalten; nur wenn der Step dadurch an ist und nichts läuft, vorhören */
export function toggleWithAudition(c: UiContext, voice: VoiceId, step: number): void {
  c.store.toggleStep(voice, step);
  const p = currentPattern(c.store.state.peek());
  if (p[voice][step] === 1 && !c.audio.playing.peek()) c.audio.audition(voice);
}
```

Hinweis: `voice()` wird innerhalb von `store.select` gelesen. Liest es selbst ein Signal (`selectedVoice`), wird die Auswahl automatisch Abhängigkeit des Computeds.

- [ ] **Step 3: `step-editor.ts` implementieren**

```ts
import { DRUM_DEFAULTS, VOICES } from '../../core/constants.ts';
import type { DrumParams, VoiceId } from '../../core/types.ts';
import { must } from '../../core/util.ts';
import { computed, signal, type Signal } from '../../store/signals.ts';
import { bind, h } from '../dom.ts';
import type { UiContext } from '../context.ts';
import { chip } from '../controls/chip.ts';
import { knob } from '../controls/knob.ts';
import { markColumn } from '../controls/marker.ts';
import { stepButton } from '../controls/step-button.ts';
import { drumOn, drumSub, selectedVoice, toggleWithAudition } from './voice.ts';
import './step-editor.css';

export interface EditorSub {
  on: boolean;
  step: number;
}
export const createEditorSub = (): Signal<EditorSub> => signal({ on: false, step: -1 });

const fmtTune = (v: number): string => {
  const n = Math.round((v - 0.5) * 100);
  return `${n > 0 ? '+' : ''}${n}`;
};

export function stepEditor(c: UiContext, sub: Signal<EditorSub> = createEditorSub()): HTMLElement {
  const { store, scope, audio } = c;
  const voice = selectedVoice(store);
  const name = h('small');
  const title = h('h2', {}, [h('span'), name]);
  const idEl = must(title.firstElementChild, 'Titel');
  bind(scope, () => voice.value, (id) => {
    idEl.textContent = id;
  });
  bind(
    scope,
    () => {
      const v = must(VOICES.find((x) => x.id === voice.value), 'Stimme');
      const custom = c.samples.drums.value.get(v.id);
      return custom ? `${v.name} · ${custom.name.slice(0, 10)}` : v.name;
    },
    (t) => {
      name.textContent = t;
    },
  );
  const subOn = computed(() => sub.value.on);
  const head = h('div', { class: 'ed-head' }, [
    title,
    h('div', { class: 'chips' }, [
      chip(scope, {
        label: 'Sub',
        ariaLabel: 'Sub-Steps bearbeiten',
        active: subOn,
        onClick: () => {
          const s = sub.peek();
          sub.value = { on: !s.on, step: !s.on && s.step < 0 ? 0 : s.step };
        },
      }),
      chip(scope, { label: 'Leeren', ariaLabel: 'Spur leeren', onClick: () => store.clearTrack() }),
    ]),
  ]);
  const buttons: HTMLButtonElement[] = [];
  const groups = Array.from({ length: 4 }, (_, g) =>
    h(
      'div',
      { class: 'group' },
      Array.from({ length: 4 }, (_, k) => {
        const s = g * 4 + k;
        const b = stepButton(scope, {
          label: `Step ${s + 1}`,
          text: String(s + 1),
          class: 'step',
          on: drumOn(store, () => voice.value, s),
          sub: drumSub(store, () => voice.value, s),
          onPress: () => {
            if (sub.peek().on) sub.value = { on: true, step: s };
            else toggleWithAudition(c, voice.peek(), s);
          },
        });
        buttons.push(b);
        return b;
      }),
    ),
  );
  bind(scope, () => (sub.value.on ? sub.value.step : -1), (sel) => {
    buttons.forEach((b, i) => b.classList.toggle('subsel', i === sel));
  });
  markColumn(scope, computed(() => audio.playhead.value.step), (s) => {
    const b = buttons[s];
    return b ? [b] : [];
  });
  const param = (key: keyof DrumParams, label: string, format: (v: number) => string) =>
    knob(scope, {
      label,
      value: store.select((s) => s.params[must(VOICES[s.sel], 'Stimme').id][key]),
      write: (v) => {
        const id: VoiceId = voice.peek();
        store.update((s) => ({ ...s, params: { ...s.params, [id]: { ...s.params[id], [key]: v } } }));
      },
      def: () => DRUM_DEFAULTS[voice.peek()][key],
      format,
      readout: c.readout,
      tag: () => voice.peek(),
      onEnd: () => {
        if (!audio.playing.peek()) audio.audition(voice.peek());
      },
    });
  const pct = (v: number): string => String(Math.round(v * 100));
  return h('section', { class: 'panel editor', attrs: { 'aria-label': 'Step-Editor', 'data-area': 'editor' } }, [
    head,
    h('div', { class: 'steps' }, groups),
    h('div', { class: 'sub-slot' }),
    h('div', { class: 'knob-row inst' }, [
      param('level', 'Level', pct),
      param('tune', 'Tune', fmtTune),
      param('decay', 'Decay', pct),
    ]),
    h('div', { class: 'smp-slot' }),
  ]);
}
```

Hinweis: Den „Titel“-Test (`'BDBass Drum'`) gegen die echten `VOICES`-Namen prüfen.

- [ ] **Step 4: `step-editor.css`**

```css
@layer components {
  .ed-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 12px;
  }
  .ed-head h2 {
    font: 700 22px/1 var(--font-display);
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  .ed-head h2 small {
    margin-left: 8px;
    font: 500 13px var(--font-display);
    letter-spacing: 0.16em;
    color: var(--ink-dim);
  }
  .editor {
    container: editor / inline-size;
  }
  .steps {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px 12px;
  }
  .group {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 5px;
  }
  /* breit genug: alle 16 Steps in einer Reihe */
  @container editor (min-width: 640px) {
    .steps {
      grid-template-columns: repeat(4, 1fr);
    }
  }
  .inst {
    margin-top: 16px;
  }
}
```

Grün prüfen. Mutationsprobe: In `toggleWithAudition` die Bedingung `!c.audio.playing.peek()` entfernen, der Test „hört nur … im Stand vor“ muss rot werden.

- [ ] **Step 5: Commit**

```bash
[n] npm run format && npm run lint && npm run typecheck
git add src/ui
git commit -m "ui: Step-Editor mit Lauflicht, Leeren und Level/Tune/Decay

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Sub-Step-Editor

**Files:**
- Create: `src/ui/panels/sub-editor.ts`, `sub-editor.css`, `sub-editor.test.ts`
- Modify: `src/ui/panels/step-editor.ts` (Sub-Editor in `.sub-slot` einsetzen)

**Interfaces:**
- Produces: `subEditor(c: UiContext, o: { key: ReadonlySignal<SubKey>; step: ReadonlySignal<number>; label: ReadonlySignal<string>; audition(): void }): HTMLElement`. Er ist wiederverwendbar für den Sampler (5c).

- [ ] **Step 1: Failing Tests** `src/ui/panels/sub-editor.test.ts`

```ts
import { describe, expect, it, vi } from 'vitest';
import { signal } from '../../store/signals.ts';
import type { SubKey } from '../../core/types.ts';
import { makeContext } from '../test-utils.ts';
import { stepEditor } from './step-editor.ts';
import { subEditor } from './sub-editor.ts';

function setup() {
  const ctx = makeContext();
  const key = signal<SubKey>('CH');
  const step = signal(-1);
  const audition = vi.fn();
  const el = subEditor(ctx.c, { key, step, label: signal('CH'), audition });
  const subs = () => [...el.querySelectorAll<HTMLButtonElement>('.sb')];
  return { ...ctx, key, step, audition, el, subs };
}

describe('subEditor', () => {
  it('ohne Step: Hinweis, Knöpfe gesperrt', () => {
    const { el, subs } = setup();
    expect(el.querySelector('.cap-label')?.textContent).toBe('Tippe oben einen Step an');
    expect(subs().every((b) => b.disabled)).toBe(true);
  });

  it('Sub-Step umschalten, Vorhören nur beim Einschalten im Stand', () => {
    const { el, subs, step, store, audition } = setup();
    step.value = 3;
    expect(el.querySelector('.cap-label')?.textContent).toBe('CH · Step 4 · 16 Sub-Steps');
    subs()[5]?.click();
    expect(store.state.value.patterns.A.sub.CH?.[3]?.[5]).toBe(1);
    expect(subs()[5]?.getAttribute('aria-pressed')).toBe('true');
    expect(audition).toHaveBeenCalledTimes(1);
    subs()[5]?.click();
    expect(audition).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['Roll', 16],
    ['÷2', 8],
    ['÷4', 4],
  ])('Vorlage %s setzt %i Sub-Steps', (label, n) => {
    const { el, step, store } = setup();
    step.value = 0;
    [...el.querySelectorAll<HTMLButtonElement>('.chip')].find((b) => b.textContent === label)?.click();
    expect(store.state.value.patterns.A.sub.CH?.[0]?.filter(Boolean).length).toBe(n);
  });

  it('Leeren entfernt die Sub-Steps', () => {
    const { el, step, store } = setup();
    step.value = 0;
    store.applySubPattern('CH', 0, 'roll');
    [...el.querySelectorAll<HTMLButtonElement>('.chip')].find((b) => b.textContent === 'Leeren')?.click();
    expect(store.state.value.patterns.A.sub.CH?.[0]).toBeUndefined();
  });
});

describe('Sub-Modus im Step-Editor', () => {
  it('Sub an: Step-Tipp wählt den Step statt umzuschalten; Editor sichtbar', () => {
    const { c, store } = makeContext();
    const el = stepEditor(c);
    const sub = el.querySelector<HTMLButtonElement>('[aria-label="Sub-Steps bearbeiten"]');
    const ed = el.querySelector<HTMLElement>('.sub-ed');
    expect(ed?.hidden).toBe(true);
    sub?.click();
    expect(ed?.hidden).toBe(false);
    expect(el.querySelectorAll('.step')[0]?.classList.contains('subsel')).toBe(true);
    el.querySelectorAll<HTMLButtonElement>('.step')[6]?.click();
    expect(store.state.value.patterns.A.BD[6]).toBe(0);
    expect(el.querySelectorAll('.step')[6]?.classList.contains('subsel')).toBe(true);
  });
});
```

Rot prüfen.

- [ ] **Step 2: `sub-editor.ts` implementieren**

```ts
import { currentPattern, subStepsOf } from '../../core/pattern.ts';
import type { SubKey } from '../../core/types.ts';
import { computed, type ReadonlySignal } from '../../store/signals.ts';
import type { SubPatternKind } from '../../store/store.ts';
import { bind, h } from '../dom.ts';
import type { UiContext } from '../context.ts';
import { chip } from '../controls/chip.ts';
import { stepButton } from '../controls/step-button.ts';
import './sub-editor.css';

const TOOLS: readonly (readonly [string, SubPatternKind])[] = [
  ['Roll', 'roll'],
  ['÷2', 'half'],
  ['÷4', 'quarter'],
  ['Leeren', 'clear'],
];

export function subEditor(
  c: UiContext,
  o: { key: ReadonlySignal<SubKey>; step: ReadonlySignal<number>; label: ReadonlySignal<string>; audition(): void },
): HTMLElement {
  const { store, scope } = c;
  const row = computed(() => {
    const n = o.step.value;
    return n >= 0 ? subStepsOf(currentPattern(store.state.value), o.key.value, n) : null;
  });
  const none = computed(() => o.step.value < 0);
  const title = h('div', { class: 'cap-label' });
  bind(
    scope,
    () => (o.step.value >= 0 ? `${o.label.value} · Step ${o.step.value + 1} · 16 Sub-Steps` : 'Tippe oben einen Step an'),
    (t) => {
      title.textContent = t;
    },
  );
  const grid = h(
    'div',
    { class: 'sub-grid' },
    Array.from({ length: 16 }, (_, k) =>
      stepButton(scope, {
        label: `Sub-Step ${k + 1}`,
        text: String(k + 1),
        class: k % 4 === 0 ? 'sb q' : 'sb',
        on: computed(() => row.value?.[k] === 1),
        disabled: none,
        onPress: () => {
          const n = o.step.peek();
          if (n < 0) return;
          store.toggleSubStep(o.key.peek(), n, k);
          const now = subStepsOf(currentPattern(store.state.peek()), o.key.peek(), n);
          if (now?.[k] === 1 && !c.audio.playing.peek()) o.audition();
        },
      }),
    ),
  );
  const tools = h(
    'div',
    { class: 'chips' },
    TOOLS.map(([label, kind]) =>
      chip(scope, {
        label,
        disabled: none,
        onClick: () => {
          const n = o.step.peek();
          if (n >= 0) store.applySubPattern(o.key.peek(), n, kind);
        },
      }),
    ),
  );
  return h('div', { class: 'sub-ed' }, [title, grid, tools]);
}
```

Hinweis: `stepButton` setzt `className` beim Umschalten per `classList`, die Klasse `q` bleibt dabei erhalten. Der Test in Task 9 prüft `className` nur ohne `q`.

- [ ] **Step 3: Einbauen** in `step-editor.ts`: Die Zeile `h('div', { class: 'sub-slot' })` ersetzen durch:

```ts
    (() => {
      const ed = subEditor(c, {
        key: voice,
        step: computed(() => sub.value.step),
        label: voice,
        audition: () => audio.audition(voice.peek()),
      });
      bind(scope, () => sub.value.on, (on) => {
        ed.hidden = !on;
      });
      return ed;
    })(),
```

Dazu den Import von `subEditor` ergänzen.

- [ ] **Step 4: `sub-editor.css`**

```css
@layer components {
  .sub-ed {
    margin-top: 14px;
    padding: 12px;
    border-radius: var(--radius);
    background: var(--well);
  }
  .sub-grid {
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    gap: 4px;
    margin: 8px 0 10px;
  }
  @container editor (min-width: 640px) {
    .sub-grid {
      grid-template-columns: repeat(16, 1fr);
    }
  }
}
```

Grün prüfen: `[n] npx vitest run --project ui src/ui/panels`.

- [ ] **Step 5: Commit**

```bash
[n] npm run format && npm run lint && npm run typecheck
git add src/ui
git commit -m "ui: Sub-Step-Editor mit Roll, ÷2, ÷4 und Leeren

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Eigenes Drum-Sample

**Files:**
- Create: `src/ui/panels/drum-sample.ts`, `drum-sample.test.ts`
- Modify: `src/ui/panels/step-editor.ts` (in `.smp-slot` einsetzen)

**Interfaces:**
- Produces: `drumSampleRow(c: UiContext, voice: ReadonlySignal<VoiceId>): HTMLElement`

- [ ] **Step 1: Failing Tests** `src/ui/panels/drum-sample.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { makeContext } from '../test-utils.ts';
import { selectedVoice } from './voice.ts';
import { drumSampleRow } from './drum-sample.ts';

const flush = () => new Promise((r) => setTimeout(r, 0));

function setup() {
  const ctx = makeContext();
  const el = drumSampleRow(ctx.c, selectedVoice(ctx.store));
  const [load, orig] = [...el.querySelectorAll<HTMLButtonElement>('button')];
  if (!load || !orig) throw new Error('Knöpfe fehlen');
  return { ...ctx, el, load, orig };
}

describe('drumSampleRow', () => {
  it('lädt, schneidet Stille ab, speichert, hört vor und meldet', async () => {
    const { load, orig, c, audio } = setup();
    expect(load.textContent).toBe('Eigenes Sample');
    expect(orig.disabled).toBe(true);
    load.click();
    await flush();
    const s = c.samples.drums.value.get('BD');
    expect(s?.name).toBe('Kick');
    expect(s?.pcm.length).toBe(4); // Stille kürzer als 40 Samples bleibt
    expect(audio.audition).toHaveBeenCalledWith('BD');
    expect(c.readout.text.value).toBe('BD · SAMPLE GELADEN');
    expect(load.textContent).toBe('Sample ersetzen');
    expect(orig.disabled).toBe(false);
  });

  it('Original stellt den synthetischen Klang wieder her', async () => {
    const { load, orig, c } = setup();
    load.click();
    await flush();
    orig.click();
    expect(c.samples.drums.value.has('BD')).toBe(false);
    expect(c.readout.text.value).toBe('BD · ORIGINAL');
  });

  it('Abbrechen ändert nichts', async () => {
    const { load, c, files, audio } = setup();
    files.pickAudio.mockResolvedValueOnce(null);
    load.click();
    await flush();
    expect(c.samples.drums.value.size).toBe(0);
    expect(audio.audition).not.toHaveBeenCalled();
  });

  it('unlesbare Datei: Meldung, nichts gespeichert', async () => {
    const { load, c, audio } = setup();
    audio.decode.mockRejectedValueOnce(new Error('kaputt'));
    load.click();
    await flush();
    expect(c.samples.drums.value.size).toBe(0);
    expect(c.readout.text.value).toBe('NICHT LESBAR');
  });
});
```

Rot prüfen.

- [ ] **Step 2: Implementieren** `src/ui/panels/drum-sample.ts`

```ts
import { trimLeadingSilence } from '../../core/samples.ts';
import type { VoiceId } from '../../core/types.ts';
import { computed, type ReadonlySignal } from '../../store/signals.ts';
import { h } from '../dom.ts';
import type { UiContext } from '../context.ts';
import { chip } from '../controls/chip.ts';

/** Eigenes Sample für die gewählte Drum-Spur laden oder zum Original zurück (Legacy buildDrumSmp). */
export function drumSampleRow(c: UiContext, voice: ReadonlySignal<VoiceId>): HTMLElement {
  const { scope, samples, audio, readout, files } = c;
  const has = computed(() => samples.drums.value.has(voice.value));
  const load = async (): Promise<void> => {
    const file = await files.pickAudio();
    if (!file) return;
    const id = voice.peek();
    try {
      const pcm = trimLeadingSilence(await audio.decode(file.data));
      samples.setDrum(id, { pcm, name: file.name });
      audio.audition(id);
      readout.flash(`${id} · SAMPLE GELADEN`);
    } catch {
      readout.flash('NICHT LESBAR');
    }
  };
  return h('div', { class: 'chips smp-row' }, [
    chip(scope, {
      label: computed(() => (has.value ? 'Sample ersetzen' : 'Eigenes Sample')),
      ariaLabel: 'Eigenes Sample für diese Spur laden',
      onClick: () => void load(),
    }),
    chip(scope, {
      label: 'Original',
      ariaLabel: 'Zurück zum synthetischen Original-Klang',
      disabled: computed(() => !has.value),
      onClick: () => {
        const id = voice.peek();
        samples.setDrum(id, null);
        audio.audition(id);
        readout.flash(`${id} · ORIGINAL`);
      },
    }),
  ]);
}
```

Hinweis: Der Test „schneidet Stille ab“ nutzt das Schein-Dekodieren `[0, 0, 0.5, 0.2]`, die erste laute Stelle liegt bei Index 2. Wegen des Vorlaufs von 40 Samples bleibt die Länge 4. Einen zweiten Test mit 100 Samples Stille ergänzen (`audio.decode.mockResolvedValueOnce(...)`): Die Länge muss dann 100 − 60 = Gesamtlänge − 60 sein.

- [ ] **Step 3: Einbauen** in `step-editor.ts`: `h('div', { class: 'smp-slot' })` durch `drumSampleRow(c, voice)` ersetzen.

- [ ] **Step 4: Grün prüfen, Commit**

```bash
[n] npm run format && npm run lint && npm run typecheck
git add src/ui
git commit -m "ui: eigenes Drum-Sample laden und Original wiederherstellen

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Spurenübersicht

**Files:**
- Create: `src/ui/panels/tracks.ts`, `tracks.css`, `tracks.test.ts`

**Interfaces:**
- Produces: `tracks(c: UiContext): HTMLElement` (`data-area="tracks"`)

- [ ] **Step 1: Failing Tests** `src/ui/panels/tracks.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { countMutations, makeContext } from '../test-utils.ts';
import { tracks } from './tracks.ts';

describe('tracks', () => {
  it('Label wählt die Spur und hört vor', () => {
    const { c, store, audio } = makeContext();
    const el = tracks(c);
    el.querySelector<HTMLButtonElement>('[aria-label="Snare Drum wählen und anhören"]')?.click();
    expect(store.state.value.sel).toBe(1);
    expect(audio.audition).toHaveBeenCalledWith('SD');
    expect(el.querySelectorAll('.row')[1]?.classList.contains('sel')).toBe(true);
  });

  it('Zelle wählt die Spur und schaltet den Step', () => {
    const { c, store, audio } = makeContext();
    const el = tracks(c);
    el.querySelector<HTMLButtonElement>('[aria-label="Closed Hat Step 3"]')?.click();
    expect(store.state.value.sel).toBe(7);
    expect(store.state.value.patterns.A.CH[2]).toBe(1);
    expect(audio.audition).toHaveBeenCalledWith('CH');
  });

  it('Lauflicht markiert die Spalte in allen zehn Spuren', async () => {
    const { c, audio } = makeContext();
    const el = tracks(c);
    document.body.append(el);
    audio.playhead.value = { step: 0, songIndex: -1 };
    const n = await countMutations(el, () => {
      audio.playhead.value = { step: 1, songIndex: -1 };
    });
    expect(n).toBe(20);
    expect(el.querySelectorAll('.cell.now')).toHaveLength(10);
  });

  it('eigene Samples markieren das Label', () => {
    const { c } = makeContext();
    const el = tracks(c);
    c.samples.setDrum('BD', { pcm: new Float32Array(1), name: 'X' });
    expect(el.querySelector('.lab')?.classList.contains('cust')).toBe(true);
  });
});
```

Hinweis: Die Namen im Test („Snare Drum“, „Closed Hat“) gegen `VOICES` prüfen. Der Index von CH ist laut `VOICE_IDS` 7 (BD SD LT HT RS CP CB CH OH CY).

Rot prüfen.

- [ ] **Step 2: Implementieren** `src/ui/panels/tracks.ts`

```ts
import { VOICES } from '../../core/constants.ts';
import { computed } from '../../store/signals.ts';
import { bind, h } from '../dom.ts';
import type { UiContext } from '../context.ts';
import { markColumn } from '../controls/marker.ts';
import { stepButton } from '../controls/step-button.ts';
import { drumOn, toggleWithAudition } from './voice.ts';
import './tracks.css';

export function tracks(c: UiContext): HTMLElement {
  const { store, scope, audio } = c;
  const columns: HTMLButtonElement[][] = Array.from({ length: 16 }, () => []);
  const select = (i: number): void => {
    if (store.state.peek().sel !== i) store.update((s) => ({ ...s, sel: i }));
  };
  const rows = VOICES.map((v, i) => {
    const lab = h('button', {
      class: 'lab',
      text: v.id,
      attrs: { type: 'button', 'aria-label': `${v.name} wählen und anhören` },
      on: {
        click: () => {
          select(i);
          audio.audition(v.id);
        },
      },
    });
    bind(scope, () => c.samples.drums.value.has(v.id), (on) => lab.classList.toggle('cust', on));
    const cells = Array.from({ length: 16 }, (_, s) => {
      const b = stepButton(scope, {
        label: `${v.name} Step ${s + 1}`,
        class: 'cell',
        on: drumOn(store, () => v.id, s),
        onPress: () => {
          select(i);
          toggleWithAudition(c, v.id, s);
        },
      });
      columns[s]?.push(b);
      return b;
    });
    const row = h('div', { class: 'row' }, [lab, h('div', { class: 'cells' }, cells)]);
    bind(scope, () => store.state.value.sel === i, (on) => row.classList.toggle('sel', on));
    return row;
  });
  markColumn(scope, computed(() => audio.playhead.value.step), (s) => columns[s] ?? []);
  return h('section', { class: 'tracks-panel', attrs: { 'aria-label': 'Alle Spuren', 'data-area': 'tracks' } }, [
    h('div', { class: 'cap-label', text: 'Spuren' }),
    h('div', { class: 'tracks' }, rows),
  ]);
}
```

- [ ] **Step 3: `tracks.css`**

```css
@layer components {
  .tracks {
    display: grid;
    gap: 4px;
  }
  .row {
    display: grid;
    grid-template-columns: 40px 1fr;
    gap: 8px;
    align-items: center;
  }
  .lab {
    position: relative;
    height: 24px;
    padding: 0;
    border: 0;
    border-radius: 6px;
    background: var(--cell);
    font: 700 14px var(--font-display);
    letter-spacing: 0.06em;
  }
  .lab.cust {
    box-shadow: inset 0 -2px 0 var(--acc);
  }
  .row.sel .lab {
    z-index: 1;
    background: var(--cream);
    color: var(--chassis);
    box-shadow: var(--glow-cream);
  }
  .cells {
    display: grid;
    grid-template-columns: repeat(16, 1fr);
    gap: 3px;
  }
  .cell {
    position: relative;
    height: 24px;
    padding: 0;
    border: 0;
    border-radius: 4px;
    background: transparent;
  }
  .cell::after {
    content: '';
    position: absolute;
    inset: 7px 1px;
    border-radius: 3px;
    background: color-mix(in srgb, var(--acc) 11%, var(--cell));
  }
  .cell:nth-child(4n + 1) {
    margin-left: 4px;
  }
  .cell.on {
    z-index: 1;
  }
  .cell.on::after {
    background: var(--acc);
    box-shadow: 0 0 8px color-mix(in srgb, var(--acc) 28%, transparent);
  }
  .cell.now {
    background: rgba(255, 255, 255, 0.07);
  }
  [data-layout='mobile'] .lab,
  [data-layout='mobile'] .cell,
  [data-layout='tablet'] .lab,
  [data-layout='tablet'] .cell {
    height: 32px;
  }
}
```

Hinweis: Touch-Ziele der Spurenzellen sind auf dem iPhone kleiner als 44 px. Das ist wie in Legacy ein dichtes Übersichtsraster, die großen Ziele liegen im Step-Editor. Als Ruling im Ledger festhalten. axe prüft die Zielgröße nur auf Stufe AAA bzw. „minor“.

Grün prüfen, Commit:

```bash
[n] npm run format && npm run lint && npm run typecheck
git add src/ui
git commit -m "ui: Spurenübersicht mit Auswahl, Schalten und Lauflicht

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: Transport und Lauflicht-Takt

**Files:**
- Create: `src/ui/panels/transport.ts`, `transport.css`, `transport.test.ts`, `src/ui/playhead.ts`, `src/ui/playhead.test.ts`

**Interfaces:**
- Produces:
  - `transport(c: UiContext): HTMLElement` (`data-area="transport"`) mit Segment Pattern/Song und dem Knopf `.play`.
  - `drivePlayhead(scope: Scope, audio: Pick<UiAudio, 'playing' | 'tick'>, raf: { request(fn: () => void): number; cancel(id: number): void }): void`

- [ ] **Step 1: Failing Tests**

`transport.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { makeContext } from '../test-utils.ts';
import { transport } from './transport.ts';

describe('transport', () => {
  it('Start/Stopp mit Beschriftung und aria-pressed', () => {
    const { c, audio } = makeContext();
    const el = transport(c);
    const play = el.querySelector<HTMLButtonElement>('.play');
    expect(play?.textContent).toBe('Start');
    play?.click();
    expect(audio.start).toHaveBeenCalledTimes(1);
    expect(play?.getAttribute('aria-pressed')).toBe('true');
    expect(play?.textContent).toBe('Stopp');
    play?.click();
    expect(audio.stop).toHaveBeenCalledTimes(1);
  });
  it('Pattern/Song schaltet den Modus', () => {
    const { c, store } = makeContext();
    const el = transport(c);
    el.querySelectorAll<HTMLButtonElement>('[role=radio]')[1]?.click();
    expect(store.state.value.mode).toBe('song');
  });
});
```

`playhead.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { signal } from '../store/signals.ts';
import { createScope } from './dom.ts';
import { drivePlayhead } from './playhead.ts';

describe('drivePlayhead', () => {
  it('tickt pro Bild nur während der Wiedergabe', () => {
    const scope = createScope();
    const playing = signal(false);
    const tick = vi.fn();
    let pending: (() => void) | null = null;
    const raf = {
      request: vi.fn((fn: () => void) => {
        pending = fn;
        return 1;
      }),
      cancel: vi.fn(() => {
        pending = null;
      }),
    };
    drivePlayhead(scope, { playing, tick }, raf);
    expect(raf.request).not.toHaveBeenCalled();
    playing.value = true;
    (pending as (() => void) | null)?.();
    (pending as (() => void) | null)?.();
    expect(tick).toHaveBeenCalledTimes(2);
    playing.value = false;
    expect(raf.cancel).toHaveBeenCalled();
    scope.dispose();
  });
});
```

Rot prüfen.

- [ ] **Step 2: Implementieren**

`playhead.ts`:

```ts
import type { UiAudio } from './context.ts';
import { bind, type Scope } from './dom.ts';

/** requestAnimationFrame-Takt: holt die Abspielposition (engine.tick), solange gespielt wird. */
export function drivePlayhead(
  scope: Scope,
  audio: Pick<UiAudio, 'playing' | 'tick'>,
  raf: { request(fn: () => void): number; cancel(id: number): void },
): void {
  let id: number | null = null;
  const frame = (): void => {
    audio.tick();
    id = raf.request(frame);
  };
  const stop = (): void => {
    if (id !== null) raf.cancel(id);
    id = null;
  };
  bind(scope, () => audio.playing.value, (on) => {
    if (on) id ??= raf.request(frame);
    else stop();
  });
  scope.add(stop);
}
```

`transport.ts`:

```ts
import { computed } from '../../store/signals.ts';
import { bind, h } from '../dom.ts';
import type { UiContext } from '../context.ts';
import { segment } from '../controls/segment.ts';
import './transport.css';

const ICON_PLAY = 'M4 2.5v13l11-6.5z';
const ICON_STOP = 'M3 4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z';

export function transport(c: UiContext): HTMLElement {
  const { store, scope, audio } = c;
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('fill', 'currentColor');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 18 18');
  svg.setAttribute('width', '18');
  svg.setAttribute('height', '18');
  svg.setAttribute('aria-hidden', 'true');
  svg.append(path);
  const label = h('span');
  const play = h('button', { class: 'play', attrs: { type: 'button' }, on: {
    click: () => {
      if (audio.playing.peek()) audio.stop();
      else audio.start();
    },
  } }, [svg, label]);
  bind(scope, () => audio.playing.value, (on) => {
    play.classList.toggle('on', on);
    play.setAttribute('aria-pressed', String(on));
    path.setAttribute('d', on ? ICON_STOP : ICON_PLAY);
    label.textContent = on ? 'Stopp' : 'Start';
  });
  return h('div', { class: 'transport', attrs: { 'data-area': 'transport' } }, [
    segment(scope, {
      label: 'Wiedergabe',
      options: [
        { value: 'pattern', label: 'Pattern' },
        { value: 'song', label: 'Song' },
      ],
      value: computed(() => store.state.value.mode),
      write: (m) => store.setMode(m),
    }),
    play,
  ]);
}
```

`transport.css`:

```css
@layer components {
  .transport {
    display: flex;
    gap: 10px;
    align-items: center;
  }
  .play {
    position: relative;
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    min-height: 52px;
    border: 0;
    border-radius: 14px;
    background: var(--cream);
    color: var(--chassis);
    font: 700 20px var(--font-display);
    letter-spacing: 0.2em;
    text-transform: uppercase;
    box-shadow: var(--glow-cream);
  }
  .play.on {
    z-index: 1;
    background: var(--acc);
    box-shadow: 0 0 18px rgba(211, 146, 90, 0.35);
  }
}
```

Grün prüfen, Commit:

```bash
[n] npm run format && npm run lint && npm run typecheck
git add src/ui
git commit -m "ui: Transport (Pattern/Song, Start/Stopp) und Lauflicht-Takt

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 16: Geräte-Halter

**Files:**
- Create: `src/ui/devices.ts`, `devices.css`, `devices.test.ts`

**Interfaces:**
- Produces:

```ts
export type DeviceId = keyof State['open']; // 'synth' | 'smp' | 'mix' | 'fx'
export interface Device {
  id: DeviceId;
  name: string;
  summary: ReadonlySignal<string>;
  body(scope: Scope): HTMLElement;
}
export function devices(c: UiContext, layout: ReadonlySignal<Layout>, list: readonly Device[]): HTMLElement;
```

Aufbau und Verhalten je Layout:
- Struktur: `section.devices[data-area=devices]` mit zwei Kindern: `.dev-heads` mit je einem `button.dev-head#dev-head-<id>` und `.dev-bodies` mit je einem `section.dev-body#dev-<id>[data-area=<id>]`.
- Jeder Körper beginnt mit `h2.dev-name`.

| Layout | Köpfe | Körper | Zustand |
|---|---|---|---|
| mobile | `aria-expanded` und `aria-controls` | `hidden = !open[id]`, kein `role` | Klick schaltet `open[id]` per `store.update` |
| tablet | `.dev-heads` hat `role=tablist` (`aria-label="Geräte"`), Köpfe `role=tab`, `aria-selected`, rovingem `tabindex`, Pfeiltasten | `role=tabpanel`, `aria-labelledby`, nur der aktive sichtbar | lokales Signal, Standard `synth` (der erste in `list`) |
| desktop | `.dev-heads` `hidden` | alle sichtbar, ohne `role` | – |

- Fokus: Liegt der Fokus beim Layoutwechsel in einem Gerät, wird es auf dem Tablet der aktive Tab und auf Mobile aufgeklappt.
- Leere Liste: Der Abschnitt ist `hidden`.

- [ ] **Step 1: Failing Tests** `src/ui/devices.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { signal } from '../store/signals.ts';
import { h } from './dom.ts';
import { devices, type Device } from './devices.ts';
import type { Layout } from './layout.ts';
import { makeContext } from './test-utils.ts';

const dev = (id: Device['id'], name: string): Device => ({
  id,
  name,
  summary: signal(`${name} ok`),
  body: () => h('button', { text: `${name} innen` }),
});

function setup(initial: Layout) {
  const ctx = makeContext();
  const layout = signal<Layout>(initial);
  const el = devices(ctx.c, layout, [dev('synth', 'Synth'), dev('mix', 'Mixer')]);
  document.body.replaceChildren(el);
  const heads = [...el.querySelectorAll<HTMLButtonElement>('.dev-head')];
  const bodies = [...el.querySelectorAll<HTMLElement>('.dev-body')];
  return { ...ctx, layout, el, heads, bodies };
}

describe('devices', () => {
  it('leere Liste: Abschnitt verborgen', () => {
    const { c } = makeContext();
    expect(devices(c, signal<Layout>('mobile'), []).hidden).toBe(true);
  });

  it('mobile: Akkordeon über store.open', () => {
    const { heads, bodies, store } = setup('mobile');
    expect(heads[0]?.getAttribute('aria-expanded')).toBe(String(store.state.value.open.synth));
    expect(heads[0]?.getAttribute('aria-controls')).toBe('dev-synth');
    const before = store.state.value.open.synth;
    heads[0]?.click();
    expect(store.state.value.open.synth).toBe(!before);
    expect(bodies[0]?.hidden).toBe(before);
    expect(heads[0]?.textContent).toContain('Synth ok');
  });

  it('tablet: Tabs mit genau einem sichtbaren Gerät, Pfeiltasten', () => {
    const { el, heads, bodies } = setup('tablet');
    expect(el.querySelector('.dev-heads')?.getAttribute('role')).toBe('tablist');
    expect(heads.map((x) => x.getAttribute('aria-selected'))).toEqual(['true', 'false']);
    expect(bodies.map((b) => b.hidden)).toEqual([false, true]);
    expect(bodies[0]?.getAttribute('role')).toBe('tabpanel');
    heads[0]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(bodies.map((b) => b.hidden)).toEqual([true, false]);
    expect(document.activeElement).toBe(heads[1]);
    heads[0]?.click();
    expect(bodies.map((b) => b.hidden)).toEqual([false, true]);
  });

  it('desktop: alle offen, Köpfe verborgen, keine Rollen', () => {
    const { el, bodies } = setup('desktop');
    expect(el.querySelector<HTMLElement>('.dev-heads')?.hidden).toBe(true);
    expect(bodies.every((b) => !b.hidden && !b.hasAttribute('role'))).toBe(true);
  });

  it('Layoutwechsel behält das Gerät mit dem Fokus sichtbar', () => {
    const { layout, bodies, store } = setup('desktop');
    store.update((s) => ({ ...s, open: { ...s.open, mix: false } }));
    bodies[1]?.querySelector('button')?.focus();
    layout.value = 'tablet';
    expect(bodies[1]?.hidden).toBe(false);
    layout.value = 'desktop';
    bodies[1]?.querySelector('button')?.focus();
    layout.value = 'mobile';
    expect(store.state.value.open.mix).toBe(true);
    expect(document.activeElement?.textContent).toBe('Mixer innen');
  });
});
```

Rot prüfen.

- [ ] **Step 2: Implementieren** `src/ui/devices.ts`

```ts
import type { State } from '../core/types.ts';
import { signal, type ReadonlySignal } from '../store/signals.ts';
import type { UiContext } from './context.ts';
import { bind, h, listen, type Scope } from './dom.ts';
import type { Layout } from './layout.ts';
import './devices.css';

export type DeviceId = keyof State['open'];

export interface Device {
  id: DeviceId;
  name: string;
  summary: ReadonlySignal<string>;
  body(scope: Scope): HTMLElement;
}

const ROLE_ATTRS = ['role', 'aria-selected', 'aria-expanded', 'aria-controls', 'aria-labelledby', 'tabindex'];

/** Geräte (Synth, Sampler, Mixer, FX): Akkordeon (mobile), Tabs (tablet) oder alle offen (desktop). */
export function devices(c: UiContext, layout: ReadonlySignal<Layout>, list: readonly Device[]): HTMLElement {
  const { store, scope } = c;
  const tab = signal<DeviceId | null>(list[0]?.id ?? null);
  const heads = list.map((d) => {
    const sum = h('span', { class: 'dev-sum' });
    bind(scope, () => d.summary.value, (t) => {
      sum.textContent = t;
    });
    return h('button', { class: 'dev-head', attrs: { type: 'button', id: `dev-head-${d.id}` } }, [
      h('span', { class: 'led', attrs: { 'aria-hidden': 'true' } }),
      h('span', { class: 'plate', text: d.name }),
      sum,
    ]);
  });
  const bodies = list.map((d) =>
    h('section', { class: 'dev-body', attrs: { id: `dev-${d.id}`, 'data-area': d.id, 'aria-label': d.name } }, [
      h('h2', { class: 'dev-name', text: d.name }),
      d.body(scope),
    ]),
  );
  const headBox = h('div', { class: 'dev-heads' }, heads);
  const root = h('section', { class: 'devices', attrs: { 'data-area': 'devices' } }, [
    headBox,
    h('div', { class: 'dev-bodies' }, bodies),
  ]);
  root.hidden = list.length === 0;

  const focused = (): DeviceId | null => {
    const i = bodies.findIndex((b) => b.contains(document.activeElement));
    return list[i]?.id ?? null;
  };
  listen<MouseEvent>(scope, headBox, 'click', (e) => {
    const i = heads.findIndex((x) => x.contains(e.target as Node));
    const d = list[i];
    if (!d) return;
    if (layout.peek() === 'mobile') {
      store.update((s) => ({ ...s, open: { ...s.open, [d.id]: !s.open[d.id] } }));
    } else tab.value = d.id;
  });
  listen<KeyboardEvent>(scope, headBox, 'keydown', (e) => {
    if (layout.peek() !== 'tablet') return;
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const i = list.findIndex((x) => x.id === tab.peek());
    const n = (i + d + list.length) % list.length;
    tab.value = list[n]?.id ?? null;
    heads[n]?.focus();
  });

  bind(scope, () => layout.value, (l) => {
    const f = focused();
    if (f && l === 'tablet') tab.value = f;
    if (f && l === 'mobile' && !store.state.peek().open[f]) {
      store.update((s) => ({ ...s, open: { ...s.open, [f]: true } }));
    }
  });
  bind(
    scope,
    () => ({ l: layout.value, open: store.state.value.open, t: tab.value }),
    ({ l, open, t }) => {
      headBox.hidden = l === 'desktop';
      if (l === 'tablet') {
        headBox.setAttribute('role', 'tablist');
        headBox.setAttribute('aria-label', 'Geräte');
      } else {
        headBox.removeAttribute('role');
        headBox.removeAttribute('aria-label');
      }
      list.forEach((d, i) => {
        const head = heads[i];
        const body = bodies[i];
        if (!head || !body) return;
        for (const a of ROLE_ATTRS) {
          head.removeAttribute(a);
          body.removeAttribute(a);
        }
        if (l === 'mobile') {
          head.setAttribute('aria-expanded', String(open[d.id]));
          head.setAttribute('aria-controls', body.id);
          body.hidden = !open[d.id];
        } else if (l === 'tablet') {
          head.setAttribute('role', 'tab');
          head.setAttribute('aria-selected', String(t === d.id));
          head.setAttribute('aria-controls', body.id);
          head.tabIndex = t === d.id ? 0 : -1;
          body.setAttribute('role', 'tabpanel');
          body.setAttribute('aria-labelledby', head.id);
          body.hidden = t !== d.id;
        } else body.hidden = false;
      });
    },
  );
  return root;
}
```

Hinweis: `bind` vergleicht mit `Object.is`. Das Objekt `{ l, open, t }` ist jedes Mal neu, deshalb läuft `apply` bei jeder Zustandsänderung. Das kostet bei vier Geräten wenig. Wer es sparsamer will, liest `open` per `store.select((s) => s.open)` und kombiniert die drei Signale in einem `computed` mit eigener Gleichheit. Das ist hier bewusst einfach gehalten.

Hinweis zum Fokus-Test: Auf Mobile wird ein zugeklapptes Gerät aufgeklappt. Fokus und `activeElement` bleiben erhalten, weil der Körper nur wieder sichtbar wird.

- [ ] **Step 3: `devices.css`**

```css
@layer components {
  .devices {
    display: grid;
    gap: 10px;
  }
  .dev-head {
    position: relative;
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    min-height: 56px;
    padding: 0 16px;
    border: 0;
    border-radius: var(--radius-panel);
    background: var(--panel);
    text-align: left;
  }
  .led {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #2a1218;
  }
  .dev-head[aria-expanded='true'] .led,
  .dev-head[aria-selected='true'] .led {
    background: var(--acc);
    box-shadow: 0 0 10px var(--acc);
  }
  .plate {
    font: 700 20px var(--font-display);
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: #a9a9b6;
  }
  .dev-sum {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    padding: 4px 8px;
    border-radius: 8px;
    background: var(--well);
    font: 12px var(--font-lcd);
    text-overflow: ellipsis;
    white-space: nowrap;
    text-transform: uppercase;
    color: var(--acc);
  }
  .dev-body {
    padding: 16px var(--pad) var(--pad);
    border-radius: var(--radius-panel);
    background: var(--panel);
  }
  .dev-name {
    display: none;
  }
}
```

Die Anordnung je Layout (Akkordeon verschränkt, Tab-Leiste, Desktop über `display: contents`) steht in `layout.css`, Task 17.

Grün prüfen, Commit:

```bash
[n] npm run format && npm run lint && npm run typecheck
git add src/ui
git commit -m "ui: Geräte-Halter (Akkordeon, Tabs, alle offen) mit Fokus-Erhalt

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 17: Shell und Layouts

**Files:**
- Create: `src/ui/shell.ts`, `src/ui/shell.test.ts`
- Modify: `src/ui/styles/layout.css`

**Interfaces:**
- Consumes: alle Panels, `devices`, `watchLayout`, `createReadout`, `voiceLine`, `drivePlayhead`, `installKeys` (Task 18; bis dahin wird es nicht aufgerufen).
- Produces:

```ts
export interface ShellDeps {
  store: Store;
  samples: SampleBank;
  audio: UiAudio;
  files: UiFiles;
  timer: Timer;
  win: Pick<Window, 'matchMedia' | 'requestAnimationFrame' | 'cancelAnimationFrame'>;
}
export function mountShell(root: HTMLElement, deps: ShellDeps): { layout: ReadonlySignal<Layout>; dispose(): void };
```

Die DOM-Reihenfolge ist auch die Lesereihenfolge für Screenreader und Mobile:
1. `brand`
2. `deck`
3. `slots`
4. `editor`
5. `tracks`
6. `devices`
7. `transport`

Wurzel ist `main.shell`, Inhalt laut Spezifikation 1.

- [ ] **Step 1: Failing Tests** `src/ui/shell.test.ts`

```ts
import { describe, expect, it, vi } from 'vitest';
import { baseState } from '../core/defaults.ts';
import { createSampleBank } from '../store/samples.ts';
import { createStore } from '../store/store.ts';
import { mountShell } from './shell.ts';
import { fakeAudio, manualTimer } from './test-utils.ts';

const media = (matches: Record<string, boolean>) => (q: string) =>
  ({ matches: matches[q] ?? false, addEventListener: vi.fn(), removeEventListener: vi.fn() }) as unknown as MediaQueryList;

function mount(matches: Record<string, boolean> = {}) {
  const root = document.createElement('div');
  document.body.replaceChildren(root);
  const shell = mountShell(root, {
    store: createStore(baseState()),
    samples: createSampleBank({ getItem: () => null, setItem: () => undefined }, {}),
    audio: fakeAudio(),
    files: { pickAudio: () => Promise.resolve(null) },
    timer: manualTimer(),
    win: { matchMedia: media(matches), requestAnimationFrame: () => 1, cancelAnimationFrame: () => undefined },
  });
  return { root, shell };
}

describe('mountShell', () => {
  it('baut die Bereiche in Lesereihenfolge', () => {
    const { root } = mount();
    const areas = [...root.querySelectorAll('[data-area]')].map((e) => e.getAttribute('data-area'));
    expect(areas).toEqual(['brand', 'deck', 'slots', 'editor', 'tracks', 'devices', 'transport']);
  });
  it('setzt data-layout am Dokument', () => {
    mount({ '(min-width: 768px)': true, '(min-width: 1024px)': true });
    expect(document.documentElement.dataset.layout).toBe('desktop');
  });
  it('dispose räumt Bindungen ab und leert die Wurzel', () => {
    const { root, shell } = mount();
    shell.dispose();
    expect(root.childElementCount).toBe(0);
  });
});
```

Rot prüfen.

- [ ] **Step 2: Implementieren** `src/ui/shell.ts`

```ts
import type { Timer } from '../store/persist.ts';
import type { SampleBank } from '../store/samples.ts';
import type { ReadonlySignal } from '../store/signals.ts';
import type { Store } from '../store/store.ts';
import type { UiAudio, UiContext, UiFiles } from './context.ts';
import { devices } from './devices.ts';
import { createScope, h } from './dom.ts';
import { watchLayout, type Layout } from './layout.ts';
import { brand } from './panels/brand.ts';
import { deck } from './panels/deck.ts';
import { slots } from './panels/slots.ts';
import { stepEditor } from './panels/step-editor.ts';
import { tracks } from './panels/tracks.ts';
import { transport } from './panels/transport.ts';
import { drivePlayhead } from './playhead.ts';
import { createReadout, voiceLine } from './readout.ts';
import './styles/app.css';

export interface ShellDeps {
  store: Store;
  samples: SampleBank;
  audio: UiAudio;
  files: UiFiles;
  timer: Timer;
  win: Pick<Window, 'matchMedia' | 'requestAnimationFrame' | 'cancelAnimationFrame'>;
}

export function mountShell(
  root: HTMLElement,
  deps: ShellDeps,
): { layout: ReadonlySignal<Layout>; dispose(): void } {
  const scope = createScope();
  const layout = watchLayout(scope, deps.win, document.documentElement);
  const readout = createReadout(scope, voiceLine(deps.store, deps.audio.available), deps.timer);
  const c: UiContext = { ...deps, readout, scope };
  const shell = h('main', { class: 'shell' }, [
    brand(),
    deck(c),
    slots(c),
    stepEditor(c),
    tracks(c),
    devices(c, layout, []),
    transport(c),
  ]);
  root.replaceChildren(shell);
  drivePlayhead(scope, deps.audio, {
    request: (fn) => deps.win.requestAnimationFrame(fn),
    cancel: (id) => {
      deps.win.cancelAnimationFrame(id);
    },
  });
  return {
    layout,
    dispose() {
      scope.dispose();
      root.replaceChildren();
    },
  };
}
```

Hinweis: `ShellDeps` hat kein `scope` und kein `readout`. `{ ...deps, readout, scope }` übernimmt `timer` und `win` mit in `c`. Das stört nicht, weil `UiContext` strukturell geprüft wird. Falls TS über überzählige Eigenschaften klagt, explizit zuweisen.

- [ ] **Step 3: `layout.css`** (Layer `layout`, siehe `app.css`)

```css
/* Drei Layouts über data-layout (layout.ts). Komponenten kennen keine Breakpoints. */
.shell {
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 520px;
  margin-inline: auto;
  padding: 12px 16px calc(112px + env(safe-area-inset-bottom));
}
/* Mobile und Tablet hochkant: Startleiste fest unten */
[data-area='transport'] {
  position: fixed;
  inset: auto 0 0;
  z-index: 10;
  padding: 16px 16px calc(14px + env(safe-area-inset-bottom));
  background: linear-gradient(to top, var(--chassis) 72%, transparent);
}

/* Geräte als Akkordeon: Köpfe und Körper verschränkt (mobile) */
[data-layout='mobile'] .dev-heads,
[data-layout='mobile'] .dev-bodies {
  display: contents;
}
[data-layout='mobile'] .dev-head:nth-child(1) { order: 0; }
[data-layout='mobile'] .dev-body:nth-child(1) { order: 1; }
[data-layout='mobile'] .dev-head:nth-child(2) { order: 2; }
[data-layout='mobile'] .dev-body:nth-child(2) { order: 3; }
[data-layout='mobile'] .dev-head:nth-child(3) { order: 4; }
[data-layout='mobile'] .dev-body:nth-child(3) { order: 5; }
[data-layout='mobile'] .dev-head:nth-child(4) { order: 6; }
[data-layout='mobile'] .dev-body:nth-child(4) { order: 7; }

/* Tablet: Tabs nebeneinander */
[data-layout='tablet'] .dev-heads {
  display: grid;
  grid-auto-flow: column;
  gap: 6px;
}
[data-layout='tablet'] .dev-head[aria-selected='true'] {
  background: var(--cell);
}

/* Tablet hochkant: Entwurf A */
@media (orientation: portrait) {
  [data-layout='tablet'] .shell {
    max-width: 900px;
    padding-inline: 24px;
  }
}

/* Tablet quer: Entwurf B – Kopfleiste, links Sequencer, rechts Gerät (eigener Scroll) */
@media (orientation: landscape) {
  [data-layout='tablet'] .shell {
    display: grid;
    grid-template-columns: 52fr 48fr;
    grid-template-areas:
      'brand deck'
      'slots transport'
      'editor devices'
      'tracks devices';
    align-items: start;
    gap: 16px 20px;
    max-width: 1400px;
    padding: 12px 24px 24px;
  }
  [data-layout='tablet'] [data-area='transport'] {
    position: static;
    padding: 0;
    background: none;
  }
  [data-layout='tablet'] [data-area='devices'] {
    position: sticky;
    top: 12px;
    max-height: calc(100dvh - 24px);
    overflow: auto;
  }
}

/* Desktop: Entwurf C – Studio-Pult. Vier Spaltengruppen, Geräte in eigenen Bereichen. */
[data-layout='desktop'] .shell {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  grid-template-areas:
    'brand brand deck deck deck deck slots slots slots slots transport transport'
    'editor editor editor editor synth synth synth synth mix mix mix mix'
    'tracks tracks tracks tracks smp smp smp smp fx fx fx fx';
  grid-template-rows: auto auto 1fr;
  align-items: start;
  gap: 16px;
  max-width: 1920px;
  min-height: 100dvh;
  padding: 16px 24px;
}
[data-layout='desktop'] [data-area='transport'] {
  position: static;
  padding: 0;
  background: none;
}
[data-layout='desktop'] .devices,
[data-layout='desktop'] .dev-bodies {
  display: contents;
}
[data-layout='desktop'] .dev-name {
  display: block;
}
[data-area='brand'] { grid-area: brand; }
[data-area='deck'] { grid-area: deck; }
[data-area='slots'] { grid-area: slots; }
[data-area='editor'] { grid-area: editor; }
[data-area='tracks'] { grid-area: tracks; }
[data-area='devices'] { grid-area: devices; }
[data-area='transport'] { grid-area: transport; }
[data-area='synth'] { grid-area: synth; }
[data-area='smp'] { grid-area: smp; }
[data-area='mix'] { grid-area: mix; }
[data-area='fx'] { grid-area: fx; }
```

Hinweis: `grid-area` wirkt nur in Grid-Layouts. Auf Mobile (Flex) ist es wirkungslos, damit gilt die DOM-Reihenfolge.

Hinweis: Das Bereichsraster für den Desktop ist ein Startpunkt. Es wird in Task 21 per Screenshot geprüft und vom Besitzer abgenommen.

- [ ] **Step 4: Sichtprüfung im Dev-Server**

Run: `[n] npm run dev` (ab Task 20 mit Verdrahtung). Hier genügt der Unit-Test, die Sichtprüfung folgt in Task 21.

Grün prüfen, Commit:

```bash
[n] npm run format && npm run lint && npm run typecheck
git add src/ui
git commit -m "ui: Shell mit Lesereihenfolge und Layouts (mobile, tablet hoch/quer, desktop)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 18: Tastaturkürzel und Kürzel-Dialog

**Files:**
- Create: `src/ui/keys.ts`, `src/ui/keys.test.ts`
- Modify: `src/ui/shell.ts` (`installKeys` aufrufen, Hilfe-Chip in `brand` einsetzen), `src/ui/panels/deck.css` (`.help` nur auf dem Desktop zeigen)

**Interfaces:**
- Produces:
  - `installKeys(c: UiContext, layout: ReadonlySignal<Layout>, doc: Document): void`
  - `shortcutHelp(c: UiContext): HTMLElement` liefert ein Fragment mit Chip „?“ (`aria-label="Tastaturkürzel"`) und `<dialog class="keys-help">`.

| Taste | Wirkung | Nicht wenn |
|---|---|---|
| Leertaste | Start/Stopp | Fokus in `input`, `textarea`, `select`, `[contenteditable]` |
| `1`–`8` ohne Modifikator | Slot A–H | Text-Eingabe |
| ↑/↓ | `sel` ∓1, begrenzt auf 0..9 | Text-Eingabe oder Fokus in `[role=slider]`, `[role=radio]`, `[role=tab]` |
| Cmd/Strg+Z | `store.undo()` | Text-Eingabe |
| Cmd/Strg+C | `store.copy()`, Meldung „PATTERN X KOPIERT“ | Text-Eingabe oder markierter Text |
| Cmd/Strg+V | nur wenn `canPaste`: `store.paste()`, Meldung „EINGEFÜGT IN X“ | Text-Eingabe |

Alle Kürzel wirken nur im Layout `desktop`. Bereits verarbeitete Ereignisse (`defaultPrevented`) werden ignoriert.

- [ ] **Step 1: Failing Tests** `src/ui/keys.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { signal } from '../store/signals.ts';
import { h } from './dom.ts';
import { installKeys, shortcutHelp } from './keys.ts';
import type { Layout } from './layout.ts';
import { makeContext } from './test-utils.ts';

function setup(l: Layout = 'desktop') {
  const ctx = makeContext();
  const layout = signal<Layout>(l);
  installKeys(ctx.c, layout, document);
  const press = (key: string, init: KeyboardEventInit = {}, target: Element = document.body) => {
    const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(e);
    return e;
  };
  return { ...ctx, layout, press };
}

describe('installKeys', () => {
  it('Leertaste startet und stoppt', () => {
    const { press, audio } = setup();
    expect(press(' ').defaultPrevented).toBe(true);
    expect(audio.start).toHaveBeenCalled();
    press(' ');
    expect(audio.stop).toHaveBeenCalled();
  });

  it('wirkt nur auf dem Desktop', () => {
    const { press, audio, layout } = setup('tablet');
    press(' ');
    expect(audio.start).not.toHaveBeenCalled();
    layout.value = 'desktop';
    press(' ');
    expect(audio.start).toHaveBeenCalled();
  });

  it('Leertaste in einem Select bleibt beim Select', () => {
    const { press, audio } = setup();
    const sel = h('select');
    document.body.append(sel);
    expect(press(' ', {}, sel).defaultPrevented).toBe(false);
    expect(audio.start).not.toHaveBeenCalled();
  });

  it('1–8 wählt das Pattern, mit Modifikator nicht', () => {
    const { press, store } = setup();
    press('2');
    expect(store.state.value.cur).toBe('B');
    press('3', { metaKey: true });
    expect(store.state.value.cur).toBe('B');
  });

  it('Pfeile wählen die Spur, begrenzt; auf einem Regler nicht', () => {
    const { press, store } = setup();
    press('ArrowUp');
    expect(store.state.value.sel).toBe(0);
    press('ArrowDown');
    expect(store.state.value.sel).toBe(1);
    const slider = h('div', { attrs: { role: 'slider', tabindex: '0' } });
    document.body.append(slider);
    press('ArrowDown', {}, slider);
    expect(store.state.value.sel).toBe(1);
  });

  it('Cmd+Z macht rückgängig, Strg+C/V kopiert und fügt ein', () => {
    const { press, store, c } = setup();
    store.toggleStep('BD', 0);
    store.clearPattern();
    press('z', { metaKey: true });
    expect(store.state.value.patterns.A.BD[0]).toBe(1);
    press('c', { ctrlKey: true });
    expect(c.readout.text.value).toBe('PATTERN A KOPIERT');
    store.selectSlot('C');
    press('v', { ctrlKey: true });
    expect(store.state.value.patterns.C.BD[0]).toBe(1);
    expect(c.readout.text.value).toBe('EINGEFÜGT IN C');
  });

  it('Einfügen ohne Zwischenablage tut nichts', () => {
    const { press, store } = setup();
    const before = store.state.value;
    press('v', { metaKey: true });
    expect(store.state.value).toBe(before);
  });
});

describe('shortcutHelp', () => {
  it('öffnet den Dialog mit der Liste', () => {
    const { c } = makeContext();
    const el = shortcutHelp(c);
    document.body.append(el);
    el.querySelector<HTMLButtonElement>('[aria-label="Tastaturkürzel"]')?.click();
    const d = el.querySelector('dialog');
    expect(d?.open).toBe(true);
    expect(d?.textContent).toContain('Leertaste');
  });
});
```

Rot prüfen.

- [ ] **Step 2: Implementieren** `src/ui/keys.ts`

```ts
import { SLOTS } from '../core/constants.ts';
import type { ReadonlySignal } from '../store/signals.ts';
import type { UiContext } from './context.ts';
import { chip } from './controls/chip.ts';
import { h, listen } from './dom.ts';
import type { Layout } from './layout.ts';

const TEXT = 'input, textarea, select, [contenteditable]';
const OWN_ARROWS = '[role=slider], [role=radio], [role=tab]';

export const SHORTCUTS: readonly (readonly [string, string])[] = [
  ['Leertaste', 'Start / Stopp'],
  ['1 – 8', 'Pattern A – H'],
  ['↑ / ↓', 'Spur wählen'],
  ['⌘/Strg + Z', 'Zurück'],
  ['⌘/Strg + C', 'Pattern kopieren'],
  ['⌘/Strg + V', 'Pattern einfügen'],
];

export function installKeys(c: UiContext, layout: ReadonlySignal<Layout>, doc: Document): void {
  const { store, audio, readout } = c;
  listen<KeyboardEvent>(c.scope, doc, 'keydown', (e) => {
    if (layout.peek() !== 'desktop' || e.defaultPrevented) return;
    const t = e.target instanceof Element ? e.target : doc.body;
    if (t.closest(TEXT)) return;
    const mod = e.metaKey || e.ctrlKey;
    const k = e.key.toLowerCase();
    if (e.key === ' ' && !mod) {
      e.preventDefault();
      if (audio.playing.peek()) audio.stop();
      else audio.start();
    } else if (!mod && !e.altKey && /^[1-8]$/.test(e.key)) {
      const slot = SLOTS[Number(e.key) - 1];
      if (slot) store.selectSlot(slot);
    } else if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && !mod) {
      if (t.closest(OWN_ARROWS)) return;
      e.preventDefault();
      const d = e.key === 'ArrowUp' ? -1 : 1;
      store.update((s) => ({ ...s, sel: Math.min(9, Math.max(0, s.sel + d)) }));
    } else if (mod && k === 'z' && !e.shiftKey) {
      e.preventDefault();
      store.undo();
    } else if (mod && k === 'c') {
      if (doc.getSelection()?.toString()) return;
      e.preventDefault();
      store.copy();
      readout.flash(`PATTERN ${store.state.peek().cur} KOPIERT`);
    } else if (mod && k === 'v') {
      if (!store.canPaste.peek()) return;
      e.preventDefault();
      store.paste();
      readout.flash(`EINGEFÜGT IN ${store.state.peek().cur}`);
    }
  });
}

export function shortcutHelp(c: UiContext): HTMLElement {
  const dialog = h('dialog', { class: 'keys-help', attrs: { 'aria-label': 'Tastaturkürzel' } }, [
    h('h2', { text: 'Tastaturkürzel' }),
    h(
      'dl',
      {},
      SHORTCUTS.flatMap(([k, v]) => [h('dt', { text: k }), h('dd', { text: v })]),
    ),
    h('form', { attrs: { method: 'dialog' } }, [h('button', { class: 'chip', text: 'Schließen' })]),
  ]);
  const open = chip(c.scope, {
    label: '?',
    ariaLabel: 'Tastaturkürzel',
    onClick: () => {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    },
  });
  return h('div', { class: 'help' }, [open, dialog]);
}
```

Hinweis: jsdom implementiert `showModal` je nach Version nicht. Der Rückfall setzt dann `open`, und `dialog.open` liefert `true`.

Hinweis zu `store.undo()`: Der Store hat ein einstufiges Zurück (wie Legacy). Mehrstufiges Undo gehört zur Roadmap-Etappe 6.

- [ ] **Step 3: Einbauen**

- In `shell.ts` nach dem Aufbau `installKeys(c, layout, document)` aufrufen.
- `brand()` bekommt ein optionales Kind: Signatur `brand(extra?: HTMLElement)`. Die Shell ruft `brand(shortcutHelp(c))` auf.
- In `deck.css` ergänzen: `.help { display: none; } [data-layout='desktop'] .help { display: block; }` sowie Stile für `.keys-help` (Hintergrund `var(--panel)`, Rundung `var(--radius-panel)`, Text `var(--ink)`, `::backdrop` mit `rgba(0, 0, 0, 0.6)`).
- Den Shell-Test um die Prüfung ergänzen, dass Tastaturkürzel auf dem Desktop wirken: Leertaste → `audio.start`.

Grün prüfen, Commit:

```bash
[n] npm run format && npm run lint && npm run typecheck
git add src/ui
git commit -m "ui: Tastaturkürzel auf dem Desktop mit Kürzel-Dialog

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 19: platform

**Files:**
- Create: `src/platform/ios.ts`, `wake.ts`, `lifecycle.ts`, `host.ts`, `files.ts` sowie je eine `*.test.ts`

**Interfaces:**
- Produces:

```ts
// ios.ts
export function silentWav(): Uint8Array; // 8-kHz-8-Bit-Mono, 800 Samples Stille (Legacy)
export interface IosEnv {
  navigator: { userAgent: string; platform: string; maxTouchPoints: number; audioSession?: { type: string } };
  createAudio(src: string): { loop: boolean; volume: number; play(): Promise<void> | undefined };
  createObjectURL(blob: Blob): string;
}
export function createIosUnlock(env: IosEnv): () => void;
// wake.ts
export interface WakeEnv {
  navigator: { wakeLock?: { request(type: 'screen'): Promise<{ release(): Promise<void> }> } };
  document: Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'>;
}
export function createWakeLock(env: WakeEnv): { hold(): void; release(): void; dispose(): void };
// lifecycle.ts
export function watchLifecycle(
  doc: Pick<Document, 'hidden' | 'addEventListener' | 'removeEventListener'>,
  on: { hidden(): void; pointer(): void },
): () => void;
// host.ts
export interface HostHot {
  snapshot?: (fn: () => unknown) => void;
  ready?: (fn: (data: unknown) => void) => void;
  data?: unknown;
}
export function connectHost(win: { claude?: { hot?: HostHot } }, snapshot: () => unknown, init: (data: unknown) => void): void;
export function hostState(data: unknown): unknown;
// files.ts
export function fileBaseName(name: string): string; // Endung weg, höchstens 12 Zeichen
export function pickAudioFile(doc: Pick<Document, 'createElement'>, opts?: { capture?: boolean }): Promise<{ data: ArrayBuffer; name: string } | null>;
```

- [ ] **Step 1: Failing Tests** (je Datei)

`ios.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { createIosUnlock, silentWav } from './ios.ts';

const env = (nav: Partial<{ userAgent: string; platform: string; maxTouchPoints: number; audioSession: { type: string } }>) => {
  const audio = { loop: false, volume: 1, play: vi.fn(() => Promise.resolve()) };
  return {
    audio,
    env: {
      navigator: { userAgent: '', platform: '', maxTouchPoints: 0, ...nav },
      createAudio: vi.fn(() => audio),
      createObjectURL: vi.fn(() => 'blob:x'),
    },
  };
};

describe('silentWav', () => {
  it('ist ein gültiger WAV-Kopf mit 800 Samples Stille', () => {
    const b = silentWav();
    expect(String.fromCharCode(...b.subarray(0, 4))).toBe('RIFF');
    expect(String.fromCharCode(...b.subarray(8, 16))).toBe('WAVEfmt ');
    expect(b.length).toBe(844);
    expect(b[44]).toBe(128);
  });
});

describe('createIosUnlock', () => {
  it('setzt audioSession auf playback und braucht dann kein Audio-Element', () => {
    const session = { type: 'auto' };
    const { env: e } = env({ audioSession: session, userAgent: 'iPhone' });
    createIosUnlock(e)();
    expect(session.type).toBe('playback');
    expect(e.createAudio).not.toHaveBeenCalled();
  });
  it('iOS ohne audioSession: stilles Element, leise, endlos, nur einmal', () => {
    const { env: e, audio } = env({ userAgent: 'Mozilla iPhone' });
    const unlock = createIosUnlock(e);
    unlock();
    unlock();
    expect(e.createAudio).toHaveBeenCalledTimes(1);
    expect(audio.loop).toBe(true);
    expect(audio.volume).toBeCloseTo(0.01);
  });
  it('iPad mit Mac-Kennung wird erkannt, ein Desktop nicht', () => {
    const ipad = env({ platform: 'MacIntel', maxTouchPoints: 5 });
    createIosUnlock(ipad.env)();
    expect(ipad.env.createAudio).toHaveBeenCalled();
    const mac = env({ platform: 'MacIntel', maxTouchPoints: 0 });
    createIosUnlock(mac.env)();
    expect(mac.env.createAudio).not.toHaveBeenCalled();
  });
  it('abgelehntes play() erlaubt einen neuen Versuch', async () => {
    const { env: e, audio } = env({ userAgent: 'iPhone' });
    audio.play.mockReturnValueOnce(Promise.reject(new Error('nein')));
    const unlock = createIosUnlock(e);
    unlock();
    await Promise.resolve();
    await Promise.resolve();
    unlock();
    expect(e.createAudio).toHaveBeenCalledTimes(2);
  });
});
```

`wake.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { createWakeLock } from './wake.ts';

function setup(supported = true) {
  const sentinel = { release: vi.fn(() => Promise.resolve()) };
  const request = vi.fn(() => Promise.resolve(sentinel));
  const listeners = new Set<() => void>();
  const doc = {
    visibilityState: 'visible' as DocumentVisibilityState,
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  };
  const lock = createWakeLock({
    navigator: supported ? { wakeLock: { request } } : {},
    document: doc as never,
  });
  return { lock, request, sentinel, doc, fire: () => listeners.forEach((f) => f()), listeners };
}
const tick = () => new Promise((r) => setTimeout(r, 0));

describe('createWakeLock', () => {
  it('hält und gibt frei', async () => {
    const { lock, request, sentinel } = setup();
    lock.hold();
    await tick();
    expect(request).toHaveBeenCalledWith('screen');
    lock.release();
    expect(sentinel.release).toHaveBeenCalled();
  });
  it('fordert nach Rückkehr in den Vordergrund neu an, nur solange gehalten wird', async () => {
    const { lock, request, fire, doc } = setup();
    lock.hold();
    await tick();
    doc.visibilityState = 'visible';
    fire();
    await tick();
    expect(request).toHaveBeenCalledTimes(2);
    lock.release();
    fire();
    await tick();
    expect(request).toHaveBeenCalledTimes(2);
  });
  it('ohne Unterstützung und bei Fehlern still', async () => {
    const { lock } = setup(false);
    lock.hold();
    await tick();
    lock.release();
    const s = setup();
    s.request.mockRejectedValueOnce(new Error('verweigert'));
    s.lock.hold();
    await tick();
    s.lock.release();
  });
  it('dispose entfernt den Listener', () => {
    const { lock, listeners } = setup();
    lock.dispose();
    expect(listeners.size).toBe(0);
  });
});
```

`lifecycle.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { watchLifecycle } from './lifecycle.ts';

describe('watchLifecycle', () => {
  it('stoppt beim Verbergen und weckt beim Tippen', () => {
    const doc = document;
    const hidden = vi.fn();
    const pointer = vi.fn();
    const stop = watchLifecycle(doc, { hidden, pointer });
    Object.defineProperty(doc, 'hidden', { value: true, configurable: true });
    doc.dispatchEvent(new Event('visibilitychange'));
    expect(hidden).toHaveBeenCalledTimes(1);
    Object.defineProperty(doc, 'hidden', { value: false, configurable: true });
    doc.dispatchEvent(new Event('visibilitychange'));
    expect(hidden).toHaveBeenCalledTimes(1);
    doc.dispatchEvent(new Event('pointerdown'));
    expect(pointer).toHaveBeenCalledTimes(1);
    stop();
    doc.dispatchEvent(new Event('pointerdown'));
    expect(pointer).toHaveBeenCalledTimes(1);
  });
});
```

`host.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { connectHost, hostState } from './host.ts';

describe('connectHost', () => {
  it('ohne Host: init sofort ohne Daten', () => {
    const init = vi.fn();
    connectHost({}, () => ({}), init);
    expect(init).toHaveBeenCalledWith(undefined);
  });
  it('mit ready: init über den Host, snapshot registriert', () => {
    const init = vi.fn();
    let snap: (() => unknown) | null = null;
    const hot = {
      snapshot: (fn: () => unknown) => {
        snap = fn;
      },
      ready: (fn: (d: unknown) => void) => fn({ state: { tempo: 140 } }),
    };
    connectHost({ claude: { hot } }, () => ({ state: 1 }), init);
    expect(init).toHaveBeenCalledWith({ state: { tempo: 140 } });
    expect((snap as (() => unknown) | null)?.()).toEqual({ state: 1 });
  });
  it('ohne ready: init mit hot.data', () => {
    const init = vi.fn();
    connectHost({ claude: { hot: { data: { state: { tempo: 99 } } } } }, () => ({}), init);
    expect(init).toHaveBeenCalledWith({ state: { tempo: 99 } });
  });
});

describe('hostState', () => {
  it.each([
    [{ state: { tempo: 1 } }, { tempo: 1 }],
    [null, undefined],
    ['x', undefined],
    [{}, undefined],
  ])('%o → %o', (data, expected) => {
    expect(hostState(data)).toEqual(expected);
  });
});
```

`files.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { fileBaseName, pickAudioFile } from './files.ts';

describe('fileBaseName', () => {
  it.each([
    ['kick.wav', 'kick'],
    ['Mein langer Name.final.mp3', 'Mein langer '],
    ['ohne', 'ohne'],
  ])('%s → %s', (n, e) => {
    expect(fileBaseName(n)).toBe(e);
  });
});

describe('pickAudioFile', () => {
  function capture() {
    let input: HTMLInputElement | null = null;
    const doc = {
      createElement: (tag: string) => {
        const el = document.createElement(tag);
        if (el instanceof HTMLInputElement) {
          input = el;
          el.click = () => undefined;
        }
        return el;
      },
    };
    return { doc, input: () => input };
  }
  it('liefert Daten und Namen der gewählten Datei', async () => {
    const { doc, input } = capture();
    const p = pickAudioFile(doc as never, { capture: true });
    const el = input();
    if (!el) throw new Error('kein input');
    expect(el.accept).toBe('audio/*');
    expect(el.hasAttribute('capture')).toBe(true);
    const file = new File([new Uint8Array([1, 2, 3])], 'snare.wav');
    Object.defineProperty(el, 'files', { value: [file] });
    el.dispatchEvent(new Event('change'));
    const r = await p;
    expect(r?.name).toBe('snare');
    expect(r?.data.byteLength).toBe(3);
  });
  it('Abbrechen liefert null', async () => {
    const { doc, input } = capture();
    const p = pickAudioFile(doc as never);
    input()?.dispatchEvent(new Event('cancel'));
    expect(await p).toBeNull();
  });
});
```

Rot prüfen: `[n] npx vitest run --project ui src/platform`.

- [ ] **Step 2: Implementieren**

`ios.ts`:

```ts
/*
 * iOS vor 17 kennt audioSession nicht: Web Audio folgt dort dem Stumm-Schalter. Ein lautloses,
 * endlos laufendes Audio-Element schaltet die Sitzung auf Medienwiedergabe (Legacy unlockIOS).
 */

export function silentWav(): Uint8Array {
  const n = 800;
  const b = new Uint8Array(44 + n);
  const v = new DataView(b.buffer);
  const w = (o: number, t: string): void => {
    for (let i = 0; i < t.length; i++) b[o + i] = t.charCodeAt(i);
  };
  w(0, 'RIFF');
  v.setUint32(4, 36 + n, true);
  w(8, 'WAVEfmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true);
  v.setUint32(28, 8000, true);
  v.setUint16(32, 1, true);
  v.setUint16(34, 8, true);
  w(36, 'data');
  v.setUint32(40, n, true);
  b.fill(128, 44);
  return b;
}

export interface IosEnv {
  navigator: { userAgent: string; platform: string; maxTouchPoints: number; audioSession?: { type: string } };
  createAudio(src: string): { loop: boolean; volume: number; play(): Promise<void> | undefined };
  createObjectURL(blob: Blob): string;
}

export function createIosUnlock(env: IosEnv): () => void {
  let el: ReturnType<IosEnv['createAudio']> | null = null;
  return () => {
    const nav = env.navigator;
    try {
      if (nav.audioSession) nav.audioSession.type = 'playback';
    } catch {
      /* ältere Safari-Versionen */
    }
    if (el || nav.audioSession) return;
    const ios = /iP(hone|ad|od)/.test(nav.userAgent) || (/Mac/.test(nav.platform) && nav.maxTouchPoints > 1);
    if (!ios) return;
    try {
      const audio = env.createAudio(env.createObjectURL(new Blob([silentWav()], { type: 'audio/wav' })));
      audio.loop = true;
      audio.volume = 0.01;
      el = audio;
      audio.play()?.catch(() => {
        el = null;
      });
    } catch {
      el = null;
    }
  };
}
```

`wake.ts`:

```ts
export interface WakeEnv {
  navigator: { wakeLock?: { request(type: 'screen'): Promise<{ release(): Promise<void> }> } };
  document: Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'>;
}

/** Bildschirm wach halten, solange gespielt wird; nach Rückkehr in den Vordergrund neu anfordern. */
export function createWakeLock(env: WakeEnv): { hold(): void; release(): void; dispose(): void } {
  let wanted = false;
  let sentinel: { release(): Promise<void> } | null = null;
  const request = async (): Promise<void> => {
    try {
      const s = await env.navigator.wakeLock?.request('screen');
      if (!s) return;
      if (wanted) sentinel = s;
      else void s.release().catch(() => undefined);
    } catch {
      /* verweigert oder nicht unterstützt */
    }
  };
  const onVisible = (): void => {
    if (wanted && env.document.visibilityState === 'visible') void request();
  };
  env.document.addEventListener('visibilitychange', onVisible);
  return {
    hold() {
      wanted = true;
      void request();
    },
    release() {
      wanted = false;
      void sentinel?.release().catch(() => undefined);
      sentinel = null;
    },
    dispose() {
      env.document.removeEventListener('visibilitychange', onVisible);
    },
  };
}
```

`lifecycle.ts`:

```ts
/** Im Hintergrund stoppen (Legacy); jedes Tippen weckt einen unterbrochenen Kontext (iOS). */
export function watchLifecycle(
  doc: Pick<Document, 'hidden' | 'addEventListener' | 'removeEventListener'>,
  on: { hidden(): void; pointer(): void },
): () => void {
  const vis = (): void => {
    if (doc.hidden) on.hidden();
  };
  const ptr = (): void => {
    on.pointer();
  };
  doc.addEventListener('visibilitychange', vis);
  doc.addEventListener('pointerdown', ptr, { passive: true });
  return () => {
    doc.removeEventListener('visibilitychange', vis);
    doc.removeEventListener('pointerdown', ptr);
  };
}
```

`host.ts`:

```ts
/** Artifact-Host (window.claude.hot): Zustand beim Neuladen übergeben und zurückbekommen. */
export interface HostHot {
  snapshot?: (fn: () => unknown) => void;
  ready?: (fn: (data: unknown) => void) => void;
  data?: unknown;
}

export function connectHost(
  win: { claude?: { hot?: HostHot } },
  snapshot: () => unknown,
  init: (data: unknown) => void,
): void {
  const hot = win.claude?.hot;
  if (typeof hot?.snapshot === 'function') hot.snapshot(snapshot);
  if (typeof hot?.ready === 'function') hot.ready(init);
  else init(hot?.data);
}

export const hostState = (data: unknown): unknown =>
  typeof data === 'object' && data !== null ? (data as { state?: unknown }).state : undefined;
```

`files.ts`:

```ts
export const fileBaseName = (name: string): string => name.replace(/\.[^.]*$/, '').slice(0, 12);

/** Audiodatei wählen oder aufnehmen (capture). Abbrechen liefert null. */
export function pickAudioFile(
  doc: Pick<Document, 'createElement'>,
  opts: { capture?: boolean } = {},
): Promise<{ data: ArrayBuffer; name: string } | null> {
  const input = doc.createElement('input');
  input.type = 'file';
  input.accept = 'audio/*';
  if (opts.capture) input.setAttribute('capture', '');
  return new Promise((resolve, reject) => {
    input.addEventListener('cancel', () => {
      resolve(null);
    });
    input.addEventListener('change', () => {
      const f = input.files?.[0];
      if (!f) {
        resolve(null);
        return;
      }
      f.arrayBuffer().then((data) => {
        resolve({ data, name: fileBaseName(f.name) });
      }, reject);
    });
    input.click();
  });
}
```

Grün prüfen, Abdeckung ≥ 90 % prüfen: `[n] npm run test:unit`.

- [ ] **Step 3: Commit**

```bash
[n] npm run format && npm run lint && npm run typecheck
git add src/platform
git commit -m "platform: iOS-Entsperren, Wake Lock, Lebenszyklus, Artifact-Host, Dateiauswahl

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 20: Verdrahtung in `main.ts`

**Files:**
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: alles Vorherige.

- [ ] **Step 1: Implementieren** `src/main.ts`

```ts
import { createEngine } from './audio/engine.ts';
import { factorySamples } from './audio/dsp.ts';
import { browserTimer as engineTimer } from './audio/timer.ts';
import { bootState } from './core/boot.ts';
import { SAMPLE_STORAGE_KEY, STORAGE_KEY, VOICE_IDS } from './core/constants.ts';
import { serialize } from './core/persist.ts';
import type { DrumSample } from './core/samples.ts';
import type { VoiceId } from './core/types.ts';
import { must } from './core/util.ts';
import { pickAudioFile } from './platform/files.ts';
import { connectHost, hostState } from './platform/host.ts';
import { createIosUnlock } from './platform/ios.ts';
import { watchLifecycle } from './platform/lifecycle.ts';
import { createWakeLock } from './platform/wake.ts';
import { browserTimer, persistState, type StorageLike } from './store/persist.ts';
import { createSampleBank } from './store/samples.ts';
import { effect } from './store/signals.ts';
import { createStore, type Store } from './store/store.ts';
import type { UiAudio } from './ui/context.ts';
import { mountShell } from './ui/shell.ts';

/** localStorage, falls erreichbar (privates Fenster, gesperrte Website-Daten: In-Memory-Ersatz) */
function storage(): StorageLike {
  try {
    const s = window.localStorage;
    s.getItem(STORAGE_KEY);
    return s;
  } catch {
    const m = new Map<string, string>();
    return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) };
  }
}

function boot(hostData: unknown): Store {
  const store0 = storage();
  const read = (k: string): string | null => {
    try {
      return store0.getItem(k);
    } catch {
      return null;
    }
  };
  const booted = bootState(read(STORAGE_KEY), read(SAMPLE_STORAGE_KEY), factorySamples(Math.random), hostState(hostData));
  const store = createStore(booted.state);
  persistState(store.state, store0);
  const samples = createSampleBank(store0, booted.drums);
  const unlock = createIosUnlock({
    navigator,
    createAudio: (src) => new Audio(src),
    createObjectURL: (b) => URL.createObjectURL(b),
  });
  const engine = createEngine({
    store,
    createContext: () => new AudioContext({ latencyHint: 'balanced' }),
    pads: booted.pads,
    drums: booted.drums,
    onGesture: unlock,
    timer: engineTimer,
  });
  const available = engine.prepare();

  // Eigene Drum-Samples aus der SampleBank an die Engine geben (nur Änderungen)
  let prev = new Map<VoiceId, DrumSample>(samples.drums.peek());
  effect(() => {
    const next = samples.drums.value;
    for (const id of VOICE_IDS) {
      if (next.get(id) !== prev.get(id)) engine.setDrumSample(id, next.get(id) ?? null);
    }
    prev = new Map(next);
  });

  const audio: UiAudio = {
    available,
    playing: engine.playing,
    playhead: engine.playhead,
    start: () => {
      engine.start();
    },
    stop: () => {
      engine.stop();
    },
    tick: () => {
      engine.tick();
    },
    audition: (v) => {
      engine.audition(v);
    },
    decode: (d) => engine.decode(d),
  };
  mountShell(must(document.getElementById('app') ?? undefined, '#app'), {
    store,
    samples,
    audio,
    files: { pickAudio: () => pickAudioFile(document) },
    timer: browserTimer,
    win: window,
  });

  const wake = createWakeLock({ navigator, document });
  effect(() => {
    if (engine.playing.value) wake.hold();
    else wake.release();
  });
  watchLifecycle(document, {
    hidden: () => {
      engine.stop();
    },
    pointer: () => {
      engine.resume();
    },
  });
  return store;
}

let app: Store | null = null;
connectHost(
  window as unknown as Parameters<typeof connectHost>[0],
  () => (app ? { state: serialize(app.state.peek()) } : {}),
  (data) => {
    app = boot(data);
  },
);
```

Hinweise:
- `factorySamples` erwartet ein `Rng`, `Math.random` erfüllt das.
- `navigator` erfüllt `IosEnv['navigator']` bzw. `WakeEnv['navigator']` strukturell. `audioSession` und `wakeLock` sind dort optional. Falls die DOM-Typen nicht passen, mit `navigator as unknown as IosEnv['navigator']` übergeben und das als Ruling festhalten.
- Prüfen, ob `audio/timer.ts` `browserTimer` als `EngineTimer` exportiert. Die Engine nutzt ohnehin `browserTimer` als Standard. Der `timer`-Eintrag kann entfallen.

- [ ] **Step 2: Prüfen im Dev-Server**

Run: `[n] npm run dev` und im eingebauten Browser `http://localhost:5173` öffnen.
- Start-Tipp: Musik läuft und das Lauflicht wandert.
- Ein Step-Tipp hört vor.
- Ein Pattern-Wechsel funktioniert.
- Kürzel testen bei 1440 × 900.

Danach den Dev-Server stoppen.

Run: `[n] npm run build:next && npx playwright test --project next-mobile`
Expected: `boot.spec.ts` grün.

- [ ] **Step 3: Commit**

```bash
[n] npm run format && npm run lint && npm run typecheck
git add src/main.ts
git commit -m "main: Verdrahtung von Store, Engine, Samples, UI und platform

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 21: E2E, Screenshots, Barrierefreiheit, Budgets

**Files:**
- Create: `tests/e2e-next/app.spec.ts`, `keys.spec.ts`, `a11y.spec.ts`, `screens.spec.ts`, `compat.spec.ts`, `host.spec.ts`, `perf.spec.ts`, `build.spec.ts`
- Modify: `tests/e2e-next/boot.spec.ts` (bleibt)

**Interfaces:**
- Consumes: Die gebaute `dist-next/index.html` (Port 4174), die Playwright-Projekte aus Task 1 und `tests/e2e/fixtures.ts`.

- [ ] **Step 1: `app.spec.ts`**

```ts
import { expect, test } from '../e2e/fixtures.ts';

const EXPECTED: Record<string, string> = {
  'next-mobile': 'mobile',
  'next-tablet': 'tablet',
  'next-tablet-quer': 'tablet',
  'next-desktop': 'desktop',
};

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
  });
  await page.reload();
});

test('richtiges Layout und kein horizontaler Scroll', async ({ page }, info) => {
  await expect(page.locator('html')).toHaveAttribute('data-layout', EXPECTED[info.project.name] ?? '');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('Step setzen bleibt nach Neuladen erhalten', async ({ page }) => {
  const step = page.locator('[data-area=editor] .step').nth(1);
  await step.click();
  await expect(step).toHaveAttribute('aria-pressed', 'true');
  await page.waitForTimeout(400);
  await page.reload();
  await expect(page.locator('[data-area=editor] .step').nth(1)).toHaveAttribute('aria-pressed', 'true');
});

test('Start lässt das Lauflicht laufen, Stopp beendet es', async ({ page, pageErrors }) => {
  const play = page.locator('.play');
  await play.click();
  await expect(play).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-area=editor] .step.now')).toHaveCount(1, { timeout: 3000 });
  await play.click();
  await expect(play).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.step.now')).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

test('Pattern wählen und Spur wählen', async ({ page }) => {
  await page.getByRole('button', { name: 'Pattern C' }).click();
  await expect(page.getByRole('button', { name: 'Pattern C' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Snare Drum wählen und anhören' }).click();
  await expect(page.locator('[data-area=editor] h2')).toContainText('SD');
});
```

- [ ] **Step 2: `keys.spec.ts`**

```ts
import { expect, test } from '../e2e/fixtures.ts';

test.skip(({}, info) => info.project.name !== 'next-desktop', 'Kürzel nur auf dem Desktop');

test('Leertaste, Ziffern, Pfeile, Zurück', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Space');
  await expect(page.locator('.play')).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Space');
  await page.keyboard.press('2');
  await expect(page.getByRole('button', { name: 'Pattern B' })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('[data-area=editor] h2')).toContainText('SD');
  await page.getByRole('button', { name: 'Spur leeren' }).click();
  await page.keyboard.press('ControlOrMeta+z');
  await page.getByRole('button', { name: 'Tastaturkürzel' }).click();
  await expect(page.locator('dialog.keys-help')).toBeVisible();
});
```

- [ ] **Step 3: `a11y.spec.ts`**

```ts
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '../e2e/fixtures.ts';

test('keine schweren Verstöße (axe)', async ({ page }) => {
  await page.goto('/');
  const r = await new AxeBuilder({ page }).analyze();
  const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(bad.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
});
```

- [ ] **Step 4: `screens.spec.ts`**

```ts
import { expect, test } from '../e2e/fixtures.ts';

test('Startansicht', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page).toHaveScreenshot('start.png', { fullPage: true, animations: 'disabled' });
});
```

Referenzen bewusst erzeugen: `[n] npx playwright test screens --project next-mobile --project next-tablet --project next-tablet-quer --project next-desktop --update-snapshots`. Die vier PNGs unter `tests/e2e-next/__screenshots__/` ansehen (Read-Tool), sie gehören zur Abnahme durch den Besitzer.

- [ ] **Step 5: `compat.spec.ts` und `host.spec.ts`**

```ts
// compat.spec.ts
import { expect, test } from '../e2e/fixtures.ts';

test('alter Speicherstand lädt (Tempo, Auswahl, Steps)', async ({ page }) => {
  await page.addInitScript(() => {
    const row = (s: string) => s.split('').map(Number);
    localStorage.setItem(
      'pocket808.v1',
      JSON.stringify({ tempo: 123, sel: 1, cur: 'A', patterns: { A: { SD: row('0000100000001000') } } }),
    );
  });
  await page.goto('/');
  await expect(page.locator('.lcd-digits')).toHaveText('123');
  await expect(page.locator('[data-area=editor] h2')).toContainText('SD');
  await expect(page.locator('[data-area=editor] .step').nth(4)).toHaveAttribute('aria-pressed', 'true');
});
```

```ts
// host.spec.ts
import { expect, test } from '../e2e/fixtures.ts';

test('window.claude.hot: Startzustand vom Host, Schnappschuss zurück', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    w.claude = {
      hot: {
        snapshot: (fn: () => unknown) => {
          w.__snap = fn;
        },
        ready: (fn: (d: unknown) => void) => {
          setTimeout(() => fn({ state: { tempo: 141 } }), 0);
        },
      },
    };
  });
  await page.goto('/');
  await expect(page.locator('.lcd-digits')).toHaveText('141');
  const tempo = await page.evaluate(
    () => ((window as unknown as { __snap: () => { state: { tempo: number } } }).__snap()).state.tempo,
  );
  expect(tempo).toBe(141);
});
```

Hinweis: Das Format der gespeicherten Pattern-Reihen (Array aus 0/1) gegen `loadState`/`readPattern` prüfen. Falls Legacy Strings speichert, den Test anpassen.

- [ ] **Step 6: `perf.spec.ts` und `build.spec.ts`**

```ts
// perf.spec.ts
import { expect, test } from '../e2e/fixtures.ts';

test.skip(({ browserName }) => browserName !== 'chromium', 'Long Tasks misst nur Chromium');

test('keine Long Task über 50 ms während 5 s Wiedergabe', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(1500); // Vorrendern abwarten
  await page.evaluate(() => {
    const w = window as unknown as { __long: number[] };
    w.__long = [];
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) w.__long.push(e.duration);
    }).observe({ type: 'longtask' });
  });
  await page.locator('.play').click();
  await page.waitForTimeout(5000);
  const long = await page.evaluate(() => (window as unknown as { __long: number[] }).__long);
  expect(long.filter((d) => d > 50)).toEqual([]);
});
```

```ts
// build.spec.ts
import { readFileSync, statSync } from 'node:fs';
import { expect, test } from '@playwright/test';

// Ausgangsgröße von dist-next/index.html nach 5a plus 20 % Puffer (Wert in Step 7 eintragen)
const BUDGET_BYTES = 0;
const DIST = new URL('../../dist-next/index.html', import.meta.url);

test.describe('gebaute dist-next/index.html', () => {
  test.skip(({}, info) => info.project.name !== 'next-desktop', 'nur einmal prüfen');

  test('bleibt im Größenbudget', () => {
    expect(statSync(DIST).size).toBeLessThanOrEqual(BUDGET_BYTES);
  });
  test('deklariert UTF-8', () => {
    expect(readFileSync(DIST, 'utf8').slice(0, 300)).toMatch(/<meta charset="utf-8"/i);
  });
  test('ist eigenständig: nur Google Fonts extern', () => {
    const html = readFileSync(DIST, 'utf8');
    expect(html).not.toMatch(/<script[^>]+src=/);
    const links = [...html.matchAll(/<link[^>]+href="([^"]+)"/g)].map((m) => m[1] ?? '');
    for (const href of links) expect(href).toMatch(/^https:\/\/fonts\.(googleapis|gstatic)\.com/);
  });
});
```

- [ ] **Step 7: Budget festlegen und alles laufen lassen**

Run: `[n] npm run build:next && stat -f%z dist-next/index.html`
Den Wert × 1,2 aufrunden und als `BUDGET_BYTES` mit Kommentar „Ausgangsgröße X B × 1,2“ eintragen.

Run: `[n] npx playwright test --project next-mobile --project next-tablet --project next-tablet-quer --project next-desktop`
Expected: alles grün.

Häufige Ursachen, falls nicht:
- `data-layout` bei `next-tablet-quer` ist nicht `tablet`. Dann meldet WebKit-Emulation `pointer: coarse` nicht. Abhilfe in `layout.ts`: zusätzlich `'(hover: none)'` als Touch-Merkmal auswerten (`coarse || hoverNone`). Dazu einen `layoutFor`-Test ergänzen und das Ganze als Ruling festhalten.
- axe meldet Kontrast bei `--ink-dim` auf `--cell`. Dann nicht die Farbe ändern (keine neuen Farben), sondern die Schrift größer und fetter machen, den Treffer im Ledger dokumentieren und den Besitzer fragen.

- [ ] **Step 8: Commit**

```bash
[n] npm run format && npm run lint && npm run typecheck
git add tests/e2e-next
git commit -m "E2E: neue App auf vier Geräte-Ansichten (Funktion, Kürzel, axe, Screenshots, Speicherstände, Host, Budgets)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 22: Funktionsliste, README, CLAUDE.md

**Files:**
- Create: `docs/superpowers/specs/2026-10-14-ui-funktionsliste.md`
- Modify: `README.md`, `CLAUDE.md`

- [ ] **Step 1: Funktionsliste schreiben**

Die Liste aus den `build*`-Funktionen in `legacy/index.html` ableiten: `buildKnobs`, `buildEditor`, `buildTracks`, `buildPresets`, `buildSlots`, `buildSong`, `buildSynth`, `buildSmp`, `buildRacks`, `buildSubEditors`, `buildDrumSmp`, `buildMixFx` sowie die Listener in `init`. Jede Bedienhandlung wird eine Zeile, mit Spalten Bereich | Handlung | Wirkung | Teilschritt | Stand. Für 5a ist „Stand“ = ✅ mit Test-Verweis, alles Übrige ist offen mit dem Teilschritt 5b/5c/5d.

Mindestens enthalten:
- **Deck:** Tempo, Swing und Master (ziehen, Doppeltipp, Tasten), LCD-Meldungen.
- **Slots:** A–H wählen, Inhaltspunkt.
- **Step-Editor:** Step schalten mit Vorhören, Sub-Modus, Sub-Steps, Roll/÷2/÷4/Leeren, Spur leeren, Level/Tune/Decay mit Vorhören nach dem Loslassen, eigenes Sample laden/ersetzen, Original.
- **Spuren:** Label wählen und vorhören, Zelle schalten.
- **Transport:** Pattern/Song, Start/Stopp.
- **Synth (5b):** Bass/Lead, Stumm, Tonart, Skala, Takthälfte, Notenlänge, Piano-Roll setzen/löschen, Wellenform, Oktave ±, Regler je Modul, Hüllkurvenanzeige, Presets, Werkzeuge (Leeren usw.).
- **Sampler (5c):** Pad wählen und vorhören, Wellenform mit Start- und Endmarke ziehen, Laden, Aufnehmen, Leeren, Rückwärts, Regler, Steps, Sub-Steps, Meldungen.
- **Mixer (5d):** Kanal wählen, Pegel, Pan, Send, Mute, Solo.
- **FX (5d):** Size, Damp, Return, DJ-Filter, Q, Stutter 1/4–1/32 halten.
- **Song (5d):** anhängen, Wiederholungen ±, verschieben, entfernen, leeren, Wiedergabe-Markierung.
- **Vorlagen und Werkzeuge (5d):** House/Electro/Hip-Hop/Trap, Kopieren, Einfügen, Pattern leeren, Zurück.
- **Plattform:** Stumm-Schalter, Resume nach Anruf, Wake Lock, Stopp im Hintergrund, Artifact-Host.

- [ ] **Step 2: README aktualisieren** (lebendes Dokument)

- „Stand“-Datum aktualisieren.
- In der Projektstand-Tabelle 5a auf ✅ setzen, 5b auf „als Nächstes“.
- Abschnitt „Oberfläche“: Was in der neuen App schon geht, `npm run dev` zeigt sie, Layout-Erkennung (Tabelle aus der Spezifikation), Kürzel.
- Die Qualitätstabelle mit den neuen Testzahlen aktualisieren (`npm test`-Ausgabe), das Vitest-Projekt `ui` und die E2E-Projekte `next-*` ergänzen.
- Projektstruktur ergänzen: `src/ui/`, `src/platform/`, `tests/e2e-next/`, `index.html`, `vite.next.config.ts`.
- Befehle ergänzen: `npm run dev` (neue App), `npm run dev:legacy`, `npm run build:next`.

- [ ] **Step 3: CLAUDE.md ergänzen** (Abschnitt Architektur)

```markdown
- UI (`src/ui`): ein Komponentenbaum aus kleinen DOM-Funktionen (`dom.ts`: `h`, `bind`, `listen`, Scope), feine Bindungen an `store.select()`. Layout-Signal (`layout.ts`) setzt `data-layout` (mobile < 768 px; tablet ≥ 768 px mit Touch oder < 1024 px; desktop ≥ 1024 px mit Maus); Anordnung nur in `styles/layout.css`. Geräte-Halter (`devices.ts`): Akkordeon, Tabs oder alle offen. Die UI bekommt Audio und Dateien über `UiContext` (`context.ts`), nie direkt. Tastaturkürzel nur auf dem Desktop (`keys.ts`).
- Plattform (`src/platform`): iOS-Entsperren, Wake Lock, Lebenszyklus, Artifact-Host, Dateiauswahl; nur `core`-Importe, Abhängigkeiten werden übergeben.
- Übergang: `npm run dev` und `npm run build:next` (→ `dist-next/`) für die neue App, `npm run build` liefert bis Schritt 6 weiter `legacy/` aus. E2E der neuen App in `tests/e2e-next/` (Projekte `next-*`).
```

- [ ] **Step 4: Gesamtlauf und Commit**

Run: `[n] npm test`
Expected: alles grün, auch `next-*`.

```bash
[n] npm run format && npm run lint && npm run typecheck
git add docs README.md CLAUDE.md
git commit -m "Doku: Funktionsliste, README und CLAUDE.md für die neue Oberfläche (5a)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Abschluss

1. Abschluss-Review (frischer Reviewer, Range `main..ui-5a`), Korrekturen mit Tests, die vorher rot sind.
2. Der Besitzer sieht sich die vier Screenshots und den Dev-Server an (Mobile, Tablet hoch und quer, Desktop).
3. Nach Freigabe: Merge nach `main` und Push. Vercel liefert unter der Hauptadresse weiter Legacy aus und die neue App unter `/next/`. Prüfen, dass https://pocket-808.vercel.app/next/ lädt.
