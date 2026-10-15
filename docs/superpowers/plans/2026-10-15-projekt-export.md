# Projekt sichern/öffnen und WAV-Export – Implementierungsplan (kompakt)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Testgetrieben: erst den Test schreiben, rot sehen, dann den Code. Die Muster aus 5a–5d gelten.

**Goal:** Projekte lassen sich als `.pocket808.json` sichern und öffnen, mit Zustand und Samples. Pattern oder Song lassen sich als WAV exportieren.

**Architecture:**
- **Reine Logik:**
  - `core/project.ts`: Kodieren und Dekodieren der Projektdatei, nutzt `serialize`, `loadState`, `encodePcm` und `applySampleStore`.
  - `core/wav.ts`: WAV-Kodierer.
  - `core/export.ts`: Dauer des Exports.
- **Store:**
  - `replaceState(next, revert)` mit Zurück für den ganzen Zustand.
  - `SampleBank.replaceAll`.
- **Audio:** `audio/export.ts` rendert mit einer eigenen Engine-Instanz offline, nach dem Verfahren der Referenztests.
- **Platform:** `pickTextFile` und `saveFile` (Teilen bzw. Download).
- **UI:** Datei-Knopf in der Kopfzeile mit Dialog (`ui/panels/project/`), Kürzel ⌘/Strg+S und ⌘/Strg+O.

**Spec:** `docs/superpowers/specs/2026-10-15-projekt-export-design.md`

## Global Constraints

- Branch `projekt-export`, Commits über `bash $D/commit.sh`.
- Deutsch. Schichtregel, `must()`, Abdeckung ≥ 90 % pro Datei.
- Design-Regeln aus CLAUDE.md, Touch-Ziele ≥ 44 px.
- Budget der gebauten Datei 113 360 B (bei Bedarf per Ruling anheben).
- Projektdatei:
  - `format: "pocket808"`, `version: 1`.
  - Dateiname `pocket808-<JJJJ-MM-TT>.pocket808.json`.
  - Pads 0–7 immer geschrieben (leer `""`), Drums nur vorhandene.
- WAV:
  - 44 100 Hz, Stereo, 16 Bit.
  - Ausklang 2 s, höchstens 300 s.
  - Pattern 1/2/4/8×, Song einmal durch.
  - Namen `pocket808-pattern-<Slot>-<n>x-<JJJJ-MM-TT>.wav` bzw. `pocket808-song-<JJJJ-MM-TT>.wav`.
- Meldungen:
  - „Projekt gesichert“
  - „Projekt geöffnet“
  - „Keine Pocket-808-Datei“
  - „Export fertig · m:ss“
  - „Export abgebrochen“
  - „Zu lang für den Export (max. 5 min)“
- Version 0.17.0, `APP_VERSION` in `core/constants.ts`. Ein Werkzeugtest prüft die Gleichheit mit `package.json`.

## Review Focus

1. **Öffnen ersetzt alles, auch Samples:**
   - Ein Pad, das in der Datei leer ist, wird leer und nicht zum Werks-Sample.
   - Drum-Samples, die in der Datei fehlen, werden entfernt.
   - „Zurück“ stellt Zustand und Samples wieder her.
2. **Kaputte oder fremde Datei:** Nichts ändert sich, auch nicht der Speicher, und es erscheint die Meldung.
3. **Export-Grenzen:**
   - Der letzte Step des letzten Takts ist im WAV, der erste Step des nächsten Durchlaufs nicht.
   - Ein leerer Song ist gesperrt.
   - Über 300 s ist gesperrt.
4. **Abbrechen während des Exports:** Es entsteht keine Datei und kein hängender Zustand. Ein erneuter Export geht.
5. **iOS-Teilen:**
   - `AbortError` beim Teilen ist kein Fehler.
   - Ohne `canShare` gibt es einen Download.
   - Nach dem Rendern braucht „WAV sichern“ einen eigenen Tipp.

## Aufgaben

### Task 1: Reine Logik (`core/project.ts`, `core/wav.ts`, `core/export.ts`)

**Produces:**

```ts
// core/constants.ts
export const APP_VERSION = '0.17.0';
// core/project.ts
export interface ProjectData { state: State; pads: (Float32Array | null)[]; drums: Partial<Record<VoiceId, DrumSample>> }
export function encodeProject(p: ProjectData, saved: Date): string;           // JSON-Text (eingerückt nicht nötig)
export function decodeProject(text: string): ProjectData | { error: 'invalid' };
export const projectFileName = (d: Date): string;                            // pocket808-2026-10-15.pocket808.json
// core/wav.ts
export function encodeWav(channels: readonly Float32Array[], sampleRate: number): Uint8Array<ArrayBuffer>;
// core/export.ts
export type ExportScope = 'pattern' | 'song';
export const EXPORT_TAIL = 2, EXPORT_MAX = 300;
export function exportPlan(s: State, scope: ExportScope, repeats: number): { playFor: number; seconds: number; bars: number } | null; // null: leerer Song
export const exportFileName = (s: State, scope: ExportScope, repeats: number, d: Date): string;
export const formatDuration = (sec: number): string;                          // 32.4 → "0:32", 75 → "1:15"
```

- **`decodeProject`:**
  - `JSON.parse` in try/catch.
  - Prüfen: `format === 'pocket808'`, `Number.isInteger(version) && version >= 1`, `state` ist ein Objekt.
  - Den Zustand mit `loadState(raw.state, initialState())` laden.
  - Die Samples ins Speicherformat umsetzen (`{ "0": { d }, "D:BD": { d, n } }`). Fehlende Pad-Einträge werden zu `{ d: "" }`.
  - Dann `applySampleStore(state, store, [])`. Das liefert `state`, `pads` und `drums`.
- **`encodeProject`:** `{ format, version: 1, app: APP_VERSION, saved: d.toISOString(), state: serialize(state), samples: { pads: {i: pcm ? encodePcm(pcm) : ''}, drums: {id: {d, n}} } }`.
- **`exportPlan`:**
  - Pattern: `bars = repeats`.
  - Song: `bars = Σ n`. Bei leerem Song `null`.
  - `playFor = bars * 16 * stepDuration(tempo)`, `seconds = playFor + EXPORT_TAIL`.
- **`encodeWav`:** RIFF-Kopf mit 44 Byte, verschränkt, `Math.round(clamp(x,-1,1) * 32767)`.

**Tests:**
- `project.test.ts`:
  - Rundreise mit fast-check über zufällige Zustände (Steps, Tempo, Song). Pads werden zufällig gesetzt oder `null` gelassen, Samples vergleicht der Test innerhalb von 1/32767.
  - Leere Pads bleiben `null`. Ein Pad-Name ohne Sample wird geleert.
  - Kaputtes JSON, falsches Format, `version` 0 oder `"1"`, fehlender `state`: jeweils `invalid`.
  - Kaputtes Base64 an einem Pad: nur dieses Pad ist `null`.
  - Ein alter Speicherstand mit `sus` als `state` wird migriert.
- `wav.test.ts`:
  - Kopffelder bytegenau für 2 Kanäle × 3 Samples.
  - Begrenzung von 1,5 auf 32767.
  - Verschränkung L/R.
- `export.test.ts`:
  - Pattern 4× bei 120 BPM: `playFor` 8 s, `seconds` 10.
  - Song mit Wiederholungen.
  - Leerer Song ergibt `null`.
  - Dateinamen.
  - `formatDuration`.
- `tests/tooling/config.test.ts`: `APP_VERSION === package.json version`.
- Commit „core: Projektdatei, WAV-Kodierer, Export-Dauer“.

### Task 2: Store – ganzen Zustand ersetzen mit Zurück, Samples gesammelt ersetzen

**Produces:**

```ts
// store/store.ts – Store
replaceState(next: State, revert?: () => void): void; // Zurück stellt den vorherigen Zustand komplett her und ruft revert
// store/samples.ts – SampleBank
replaceAll(pads: readonly (Float32Array | null)[], drums: Partial<Record<VoiceId, DrumSample>>): void; // ein Schreibvorgang
```

- Die Undo-Ablage wird verallgemeinert: `signal<{ restore(s: State): State; after?: () => void } | null>`.
  - `withUndo` legt `{ restore: s => restoreSnapshot(s, snap) }` ab.
  - `replaceState` legt `{ restore: () => prev, after: revert }` ab.
  - `undo` ruft `restore` und danach `after`.
- `replaceAll` schreibt den Sample-Speicher einmal neu:
  - Alle Pads mit `{ d }` bzw. `{ d: "" }`, alle Drums mit `{ d, n }`.
  - Fremde Schlüssel bleiben erhalten, alte `D:`-Einträge entfallen.
  - Beide Signale werden in einem `batch` gesetzt.

**Tests:**
- `store.test.ts`:
  - `replaceState`, dann `undo`: alter Zustand ist identisch, `revert` wurde einmal aufgerufen, `canUndo` danach false.
  - Ein späteres `withUndo` überschreibt die Ablage, `revert` wird dann nicht mehr gerufen.
- `samples.test.ts`:
  - `replaceAll` schreibt einmal (Speicher-Spion zählt `setItem`).
  - Alte `D:`-Einträge sind weg, fremde Schlüssel bleiben.
- Commit.

### Task 3: Offline-Export (`audio/export.ts`) und Referenztest

**Produces:**

```ts
export interface RenderOptions {
  state: State; pads: readonly (Float32Array | null)[]; drums: Partial<Record<VoiceId, DrumSample>>;
  playFor: number; seconds: number; sampleRate?: number;            // Standard 44100
  createContext: (channels: number, length: number, sampleRate: number) => OfflineAudioContext;
  createOffline?: OfflineFactory; random?: (tag: string) => Rng;
  onProgress?: (fraction: number) => void; signal?: AbortSignal;
  /** Zeit für die Oberfläche: alle n Takte des Scheduler-Takts einmal warten (Standard: setTimeout 0) */
  yieldEvery?: number; pause?: () => Promise<void>;
}
export async function renderOffline(o: RenderOptions): Promise<AudioBuffer | null>; // null bei Abbruch
```

- Ablauf:
  - Store-Kopie per `createStore(state, { freeze: false })`.
  - `createEngine` mit `createContext: () => ctx`, manueller Uhr `now` und einem Timer, dessen `setInterval` die Pumpe nur merkt (wie `play()` in `tests/reference/next/scenarios.ts`), dazu `prerender: false`.
  - Dann `prepare()`, `await prerenderAll()` und `start()`.
  - Danach `for (now = 0; now < playFor - 0.2; now += 0.025) pump()`, anschließend genau einmal `now = playFor - 0.2 - 1e-6; pump()`. So werden alle Steps vor `playFor` geplant, keiner danach.
  - Alle `yieldEvery` (Standard 40) Takte `await pause()`. Dabei `signal.aborted` prüfen, im Fall `engine.dispose()` und `null` zurückgeben.
  - Danach `const buf = await ctx.startRendering()`, `engine.dispose()` und `return signal?.aborted ? null : buf`.
  - Den Fortschritt `now / playFor` melden.
- **Modus der Kopie:** Die Oberfläche setzt `mode` vorher (Song bzw. Pattern) in der übergebenen `state`. `renderOffline` ändert nichts selbst.
- **Referenz:**
  - Szenario `exportDemo` in `tests/reference/next/scenarios.ts`: `renderOffline` mit `initialState()`, `playFor: 4`, `seconds: 4`, `random: seededRandom(1)`, `pads: factorySamples(random('factory'))`, Node-Fabriken.
  - Ergebnis `renderStereo`-Abdruck.
  - Test in `tests/reference/next-mix.test.ts`: `expectStereo(expect, 'mix/demo', print)`, gleicher Fingerabdruck wie das Demo-Szenario.
- **Unit (`audio/export.test.ts`) mit Schein-Kontext aus den Engine-Tests:**
  - Abbruch vor dem Rendern liefert `null`, `startRendering` wurde nicht gerufen.
  - Grenze: Pattern mit BD auf Step 0 und Step 15, 1 Takt: Der Spion an `schedule.drum` bzw. `onScheduled` sieht Step 15, aber keinen zweiten Step 0.
  - Der Fortschritt steigt monoton bis höchstens 1.
- Commit, `npm run bench` (die Engine ist unverändert, nur zur Kontrolle).

### Task 4: Platform – Text-Datei wählen, Datei sichern

**Produces:**

```ts
// platform/files.ts
export function pickTextFile(doc, accept: string): Promise<{ text: string; name: string } | null>;
// platform/share.ts
export interface ShareEnv { navigator: { canShare?(d: ShareData): boolean; share?(d: ShareData): Promise<void> }; document: Pick<Document,'createElement'|'body'>; URL: { createObjectURL(b: Blob): string; revokeObjectURL(u: string): void }; File: typeof File }
export async function saveFile(env: ShareEnv, blob: Blob, name: string): Promise<'shared' | 'downloaded' | 'cancelled'>;
```

- `pickAudioFile` und `pickTextFile` teilen sich eine interne Hilfe `pick(doc, accept, capture, read)`.
- **`saveFile`:**
  - Wenn `canShare({ files: [file] })` zutrifft: `share`. Bei `AbortError` gilt `'cancelled'`, andere Fehler fallen auf den Download zurück.
  - Download: `<a download=name href=url hidden>` anhängen, klicken, entfernen, `revokeObjectURL` per `setTimeout(…, 0)`.
- **Tests:** Teilen, Abbruch, Fehler mit Rückfall, kein `canShare`, `pickTextFile` mit Abbrechen und mit Text.
- Commit.

### Task 5: Oberfläche – Datei-Knopf, Dialog, Kürzel, Verdrahtung

**Interfaces:**

```ts
// ui/context.ts
UiFiles.pickProject(): Promise<{ text: string; name: string } | null>;
UiFiles.save(blob: Blob, name: string): Promise<'shared' | 'downloaded' | 'cancelled'>;
UiAudio.exportWav(state: State, playFor: number, seconds: number, onProgress: (f: number) => void, signal: AbortSignal): Promise<Blob | null>;
// ui/panels/project/dialog.ts
export function projectButton(c: UiContext): { button: HTMLElement; dialog: HTMLDialogElement; save(): void; open(): void };
```

- **`ui/panels/project/`:**
  - **`dialog.ts`:** Knopf „Datei“ (`aria-haspopup="dialog"`). `<dialog aria-label="Projekt und Export">` mit drei Abschnitten, Meldungszeile `role="status"` und „Schließen“.
  - **`project.ts` (Abschnitt Projekt):**
    - „Projekt sichern“ ruft `encodeProject` mit `store.state.peek()`, `samples.pads.peek()` und `Object.fromEntries(samples.drums.peek())`. Danach `files.save(new Blob([text], { type: 'application/json' }), projectFileName(new Date()))`. Bei `'shared'` oder `'downloaded'` erscheint „Projekt gesichert“.
    - „Projekt öffnen“ ruft `files.pickProject()` und dann `decodeProject`.
      - Bei Fehler: „Keine Pocket-808-Datei“.
      - Sonst erscheint im Dialog die Frage „Aktuelles Projekt ersetzen?“ mit [Ersetzen] [Abbrechen].
      - „Ersetzen“: alte Samples merken, `samples.replaceAll(neu)`, dann `store.replaceState(neu.state, () => samples.replaceAll(alt))`. Meldung „Projekt geöffnet“.
  - **`export.ts` (Abschnitt Audio):**
    - Segment „Pattern | Song“ (Song gesperrt bei leerem Song).
    - Segment „1× 2× 4× 8×“ (nur bei Pattern sichtbar).
    - Länge per `formatDuration(plan.seconds)`.
    - „WAV erzeugen“ ist gesperrt, wenn `plan === null` oder `plan.seconds > EXPORT_MAX`. Bei Überlänge steht der Hinweis „Zu lang für den Export (max. 5 min)“ daneben.
    - Klick: Status „Rendere … n %“ plus „Abbrechen“ (AbortController). Gerendert wird `{ ...state, mode: scope === 'song' ? 'song' : 'pattern' }`.
    - Ergebnis `null` ergibt „Export abgebrochen“. Sonst „Export fertig · m:ss“ und der Knopf „WAV sichern“, der `files.save(blob, exportFileName(...))` ruft.
    - Wenn sich Umfang oder Wiederholungen ändern, verfällt das Ergebnis.
- **`brand.ts`:** Der Datei-Knopf steht neben „?“ (Desktop) bzw. allein (Touch-Layouts zeigen „?“ nicht; der Datei-Knopf ist immer da).
- **`keys.ts`:** ⌘/Strg+S ruft `save()`, ⌘/Strg+O ruft `open()`, beide mit `preventDefault`. Der Hilfe-Dialog wird um zwei Zeilen ergänzt.
- **CSS:**
  - `project.css`: Dialog auf Mobile `inset:0; width:100%; height:100%; max-width:none`, sonst `max-width:480px`.
  - Hintergrund `--panel`, `::backdrop` mit `color-mix(--chassis 70%, transparent)`.
- **`main.ts`:**
  - `files.pickProject = () => pickTextFile(document, '.json,application/json')`.
  - `files.save = (b, n) => saveFile({ navigator, document, URL, File }, b, n)`.
  - `audio.exportWav`: `renderOffline({ state, pads: samples.pads.peek(), drums: Object.fromEntries(samples.drums.peek()), playFor, seconds, createContext: (ch, len, sr) => new OfflineAudioContext(ch, len, sr), onProgress, signal })`, dann `new Blob([encodeWav([buf.getChannelData(0), buf.getChannelData(1)], buf.sampleRate)], { type: 'audio/wav' })`.
  - Test-Hilfen: `fakeAudio.exportWav`, `makeContext` mit `files.pickProject` und `files.save`.
- **Tests (jsdom):**
  - Sichern ruft `save` mit gültigem JSON und dem Namen.
  - Öffnen mit fremdem Text ergibt die Meldung, Zustand unverändert.
  - Öffnen mit gültiger Datei, dann Abbrechen: unverändert.
  - Öffnen mit gültiger Datei, dann Ersetzen: Zustand und Samples sind neu, und `undo` stellt beides wieder her.
  - Export: Song gesperrt bei leerem Song, Länge angezeigt, Überlänge gesperrt mit Hinweis.
  - Fortschritt.
  - Abbrechen ergibt „Export abgebrochen“.
  - Ein fertiger Export zeigt „WAV sichern“. Nach einer Änderung des Umfangs ist das Ergebnis verfallen.
  - Kürzel S und O, nicht bei offenem Dialog.
- Commit.

### Task 6: E2E, Doku, Version

- **`tests/e2e/project.spec.ts`:**
  - Datei-Knopf öffnen, „Projekt sichern“, `page.waitForEvent('download')` (Chromium/WebKit ohne `canShare` für Dateien → Download). Die Datei lesen: `format` ist pocket808.
  - Tempo ändern, „Projekt öffnen“ mit `filechooser` und der gesicherten Datei, „Ersetzen“: Das Tempo ist zurück, auch nach dem Neuladen.
  - Fremde Datei: Meldung.
  - Pattern 1× als WAV: „WAV erzeugen“, warten auf „Export fertig“, „WAV sichern“. Der Download beginnt mit `RIFF`, die Größe liegt nahe `44 + (playFor + 2) * 44100 * 4` (±1 %).
  - Touch-Ziele ≥ 44 px im Dialog, kein horizontaler Scroll.
- **`a11y.spec.ts`:** mit offenem Datei-Dialog.
- Budget prüfen, Screenshots aktualisieren, falls der Kopf sich ändert.
- **Funktionsliste:** neuer Abschnitt „Projekt und Export“ mit ✅ und Tests.
- **README:** Funktionen, Bedienung, Projektstand bzw. Roadmap Etappe 2 ✅, Testzahlen, Stand, Version 0.17.0.
- **CLAUDE.md:** Roadmap-Punkt 2 durchgestrichen, Architekturzeile zu `core/project.ts`, `audio/export.ts` und `platform/share.ts`.
- Commit.
