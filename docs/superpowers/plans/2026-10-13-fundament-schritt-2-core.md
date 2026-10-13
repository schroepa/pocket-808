# Fundament Schritt 2: `core` – Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die reine Logik der App (Konstanten, Zustandstypen, Defaults, Laden/Speichern mit Migrationen, Sample-Speicher, Musiktheorie, Mixer-Logik, Pattern-Bearbeitung, Undo, Song-Kette, Timing) als typisiertes, unveränderliches TypeScript in `src/core/` – nachweislich verhaltensgleich zu `legacy/index.html`.

**Architecture:** `src/core` hängt von nichts ab (kein DOM, kein Audio). Alle Funktionen sind rein: Sie verändern ihre Eingaben nie und geben neue Objekte zurück, unveränderte Teile behalten ihre Identität (strukturelles Teilen – wichtig für den Signals-Store in Schritt 3). Das Datenmodell ist bewusst identisch mit dem gespeicherten Format (`pocket808.v1`), damit es keine Abbildungsschicht und keinen Formatbruch gibt. Gleichwertigkeit mit Legacy wird dreifach geprüft: Unit-Tests (≥ 90 % Abdeckung), Vergleich mit den Referenzdateien aus Schritt 1 und Eigenschafts-/Modelltests mit fast-check, die dieselben Eingaben durch Legacy (jsdom-Harness) und `core` schicken.

**Tech Stack:** TypeScript 6.0, Vitest 5 + @vitest/coverage-v8, fast-check 4, bestehende Legacy-Harness (jsdom + node-web-audio-api).

**Spec:** `docs/superpowers/specs/2026-10-13-fundament-design.md` (Abschnitt 1 „core“, Abschnitt 2 „Teststrategie“, Abschnitt 4 Schritt 2)

## Global Constraints

- Sprache: Kommentare, Testnamen, Fehlermeldungen, Commits auf **Deutsch**. Hardware-Begriffe englisch.
- `src/core/**` importiert **nichts** außer anderen Dateien aus `src/core/` (ESLint-Schichtregel). Keine Browser-APIs außer `btoa`/`atob`/`structuredClone` (in Node 24 und Baseline 2024 vorhanden).
- Kein `any`, keine Laufzeit-Abhängigkeiten. fast-check und Coverage nur als `devDependencies`.
- **Reine Funktionen:** Eingaben werden nie verändert. Jeder Unit-Test einer Zustandsfunktion friert die Eingabe mit `deepFreeze` ein.
- Datenformat = Legacy-Format: Feldnamen und Struktur exakt wie `serial()` in `legacy/index.html` (Schlüssel `pocket808.v1`, `pocket808.smp.v1`).
- `legacy/index.html` bleibt inhaltlich unverändert. Die Harness darf nur im Speicher patchen.
- Abdeckung `src/core/**`: ≥ 90 % Zeilen, Zweige, Funktionen, Anweisungen (Vitest-Schwelle, läuft in `npm run test:unit`, damit auch im Git-Hook).
- Jeder Befehl mit Node: Präfix **`[n]`** = `source ~/.nvm/nvm.sh && nvm use >/dev/null && `.
- Commits nur nach `npm run lint && npm run typecheck` und nur, wenn der Hook durchläuft. Commit-Nachrichten enden mit `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Nicht pushen.
- Arbeit auf Branch `core` (von `main`).

## Review Focus

1. **Grenzfälle beim Laden fremder/alter Speicherstände** (Strings statt Arrays, falsche Längen, `null`, Zahlen als Strings, Schlüssel wie `"01"` oder `""` bei Sub-Steps): `loadState` muss exakt wie Legacy reagieren → Fuzz-Gleichwertigkeitstest in Task 4.
2. **Versehentliche Mutation** von Eingaben (würde in Schritt 3 Signals-Updates verschlucken) → `deepFreeze` in allen Unit-Tests von Zustandsfunktionen, Tasks 3–8.
3. **Abfolgen von Bearbeitungen** (Toggle → Undo → Preset → Einfügen …), bei denen Zwischenzustände (Undo-Puffer, Zwischenablage, `preset`-Feld) auseinanderlaufen → Modelltest in Task 7.
4. **Song-Kette über viele Takte** (Wiederholungen, Ende → Anfang, leerer Song, Pattern-Modus) → Sequenzvergleich gegen den Legacy-Scheduler in Task 8.
5. **Kaputte Sample-Speicher** (ungültiges Base64, Nicht-Ganzzahl-Schlüssel, fremde Drum-IDs, leere Daten) → Unit-Tests und Referenz in Task 5.

---

## Dateistruktur (Ergebnis)

```
src/core/
  types.ts        Typen des Zustands (= Speicherformat)
  constants.ts    Stimmen, Presets, Skalen, Synth-Presets, Kanäle, Schlüssel …
  defaults.ts     leere Patterns, Defaults, Grundzustand (baseState)
  presets.ts      applyPreset
  initial.ts      initialState (Startzustand der App inkl. Seeds)
  persist.ts      parseStored, loadState (= Legacy-merge), serialize
  samples.ts      encodePcm, decodePcm, parseSampleStore, applySampleStore
  boot.ts         bootState: Zustand + Sample-Speicher → Startzustand
  music.ts        degreeToMidi, degreeName, effectiveLength
  envelope.ts     attackTime, decayTime, releaseTime
  mix.ts          audibleChannels, channelGain, channelPan, masterGain
  pattern.ts      Step-/Sub-Step-/Noten-Bearbeitung, Kopieren/Einfügen, Leeren
  undo.ts         snapshot, restoreSnapshot
  song.ts         Song bearbeiten, nextBar (Song-Cursor)
  timing.ts       stepDuration, swingDelay, subStepOffset
  test-utils.ts   deepFreeze (nur für Tests, von Abdeckung ausgenommen)
  *.test.ts       Unit-Tests je Modul
tests/reference/
  core-constants.test.ts  Konstanten = Legacy
  core-persist.test.ts    Referenzdateien + Fuzz gegen Legacy-merge
  core-samples.test.ts    Sample-Speicher-Referenz
  core-music.test.ts      Eigenschaftstests gegen Legacy (degMidi, effLen, calcAud …)
  core-pattern.test.ts    Modelltest: Bearbeitungsfolgen gegen Legacy
  core-song.test.ts       Song-/Timing-Sequenz gegen Legacy-Scheduler
```

---

### Task 1: Branch, Werkzeug-Nachzug und erweiterte Legacy-Schnittstelle

**Files:**
- Modify: `package.json` (devDependencies, Hook)
- Modify: `eslint.config.js` (Schichtregel: `main.js`, dynamische Importe)
- Modify: `tests/tooling/boundaries.test.ts`
- Modify: `tests/reference/legacy/harness.ts` (exakter Anker-Ersatz, erweiterter HOOK), `tests/reference/legacy/harness.test.ts`
- Modify: `tests/reference/legacy/types.ts`

**Interfaces:**
- Produces: `LegacyHooks` zusätzlich mit allen Konstanten und Logik-Funktionen, die Tasks 2–8 als Orakel nutzen (siehe Step 6). `splitLegacy` wirft bei mehrdeutigem Anker.

- [ ] **Step 1: Branch und Pakete**

```bash
git switch core 2>/dev/null || git switch -c core
[n] npm install -D @vitest/coverage-v8@5.0.4 fast-check@^4.10.2
```
Expected: Installation ohne Fehler.

- [ ] **Step 2: Failing Tests für die Lücken der Schichtregel** – in `tests/tooling/boundaries.test.ts` am Ende der `CASES`-Liste ergänzen:

```ts
  ['src/core/pattern.ts', '../main.js', false],
  ['src/ui/knob.ts', '../main.js', false],
```

und am Dateiende einen zweiten Block:

```ts
describe('dynamische Importe', () => {
  it('sind in src/ verboten (Schichtgrenzen wären nicht prüfbar)', async () => {
    const [result] = await eslint.lintText("export const m = import('../audio/engine.ts');\n", {
      filePath: 'src/ui/knob.ts',
    });
    expect(result?.messages.some((m) => m.ruleId === 'no-restricted-syntax')).toBe(true);
  });
});
```

```bash
[n] npx vitest run tests/tooling/boundaries.test.ts
```
Expected: 3 FAIL (die zwei neuen Fälle und der dynamische Import).

- [ ] **Step 3: Schichtregel schließen** – in `eslint.config.js` im `forbid`-Helfer die `main`-Regel ersetzen:

```js
          ...(layers.includes('main') ? [{ regex: '(^|/)main(\\.[cm]?[jt]s)?$', message }] : []),
```

und vor den `forbid(...)`-Aufrufen einen Block ergänzen:

```js
  {
    files: ['src/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ImportExpression',
          message: 'Keine dynamischen Importe: Schichtgrenzen wären nicht prüfbar.',
        },
      ],
    },
  },
```

```bash
[n] npx vitest run tests/tooling/boundaries.test.ts
```
Expected: alle PASS.

- [ ] **Step 4: Failing Tests für exakten Anker-Ersatz** – in `tests/reference/legacy/harness.test.ts` im Block `describe('splitLegacy', …)` ergänzen:

```ts
  it('übernimmt Ersatztext wörtlich, auch mit $-Zeichen', () => {
    const { script } = splitLegacy(html, [{ find: 'const hot=window.claude', replace: "x='$&$1';" }]);
    expect(script).toContain("x='$&$1';");
  });

  it('scheitert laut, wenn ein Anker mehrfach vorkommt', () => {
    const doppelt = html.replace('const hot=window.claude;', 'const hot=window.claude;const hot=window.claude;');
    expect(() => splitLegacy(doppelt)).toThrow(/Anker mehrdeutig/);
  });
```

```bash
[n] npx vitest run tests/reference/legacy/harness.test.ts
```
Expected: 2 FAIL.

- [ ] **Step 5: Exakter Ersatz** – in `tests/reference/legacy/harness.ts` die Schleife in `splitLegacy` ersetzen:

```ts
  for (const p of patches) {
    const parts = script.split(p.find);
    if (parts.length < 2) throw new Error(`Anker nicht gefunden: ${p.find}`);
    if (parts.length > 2) throw new Error(`Anker mehrdeutig: ${p.find}`);
    script = parts.join(p.replace);
  }
```

```bash
[n] npx vitest run tests/reference/legacy/harness.test.ts
```
Expected: alle PASS.

- [ ] **Step 6: Legacy-Schnittstelle erweitern** – in `harness.ts` die Konstante `HOOK` ersetzen:

```ts
const HOOK =
  'window.__t={state,serial,ensureAudio,applyMixAll,stutterOn,stutterOff,synthNote,smpPlay,' +
  'renderVoice,prerenderAll,pump,voiceBuf,smpPcm,drumPcm,drumName,queue,VOICES,SYN_PRESETS,' +
  'DEFAULTS,PRESETS,SLOTS,SEED_B,SEED_NOTES,PARTS,PART_INFO,NAMES,SCALES,WAVES,ROWS,SYN_KEYS,' +
  'SMP_RATE,SMP_MAX,SMP_DEF,CHS,CH_FULL,KEY,SMP_KEY,FACTORY,' +
  'degMidi,degName,effLen,calcAud,aud,tA,tD,tR,mastGain,' +
  'toggle,placeNote,toggleSub,setSub,clearTrack,clearAll,loadPreset,viewPattern,copyPattern,' +
  'pastePattern,snap,undoLast,get ctx(){return ctx;},' +
  'begin(){playing=true;step=0;songFirst=true;barSong=false;queue.length=0;nextTime=.08;},' +
  'stop(){playing=false;}};\n';
```

In `tests/reference/legacy/types.ts` `LegacyState` um `song: { p: string; n: number }[]; part: Part; noteLen: number; key: number; scale: number; sel: number; preset: string | null; smp: { sel: number; pads: Record<string, unknown>[] };` ergänzen und `LegacyHooks` um:

```ts
  drumName: Record<string, string | undefined>;
  queue: { step: number; time: number; slot: string; song: boolean; si: number }[];
  DEFAULTS: Record<string, DrumParams>;
  PRESETS: readonly { name: string; tempo: number; swing: number; pat: Record<string, string> }[];
  SLOTS: readonly string[];
  SEED_B: Record<string, string>;
  SEED_NOTES: Record<string, Record<string, [number, number, number][]>>;
  PARTS: readonly Part[];
  PART_INFO: Record<Part, { name: string; base: number; color: string }>;
  NAMES: readonly string[];
  SCALES: readonly { name: string; s: number[] }[];
  WAVES: readonly [string, string][];
  ROWS: number;
  SYN_KEYS: readonly string[];
  SMP_RATE: number;
  SMP_MAX: number;
  SMP_DEF: Record<string, unknown>;
  CHS: readonly string[];
  CH_FULL: Record<string, string>;
  KEY: string;
  SMP_KEY: string;
  FACTORY: readonly { name: string }[];
  degMidi(part: Part, degree: number): number;
  degName(degree: number): string;
  effLen(row: unknown[], step: number): number;
  calcAud(): void;
  aud: Record<string, boolean>;
  tA(x: number): number;
  tD(x: number): number;
  tR(x: number): number;
  mastGain(v: number): number;
  toggle(voiceIndex: number, step: number): void;
  placeNote(degree: number, step: number): void;
  toggleSub(key: string, step: number, k: number): number;
  setSub(key: string, step: number, row: number[]): void;
  clearTrack(): void;
  clearAll(): void;
  loadPreset(preset: unknown): void;
  viewPattern(slot: string): void;
  copyPattern(): void;
  pastePattern(): void;
  snap(): void;
  undoLast(): void;
```

```bash
[n] npx vitest run tests/reference/legacy && npm run test:ref
```
Expected: alle PASS (der echte Legacy-Code enthält alle Namen; ein Tippfehler würde `ReferenceError` beim Laden werfen).

- [ ] **Step 7: Hook gegen versehentliches Neuschreiben** – in `package.json`:

```json
"simple-git-hooks": {
  "pre-commit": "unset REF_UPDATE AXE_UPDATE; npm run lint && npm run typecheck && npm run test:unit && npm run test:ref"
}
```

```bash
[n] npx simple-git-hooks && tail -1 .git/hooks/pre-commit
```
Expected: letzte Zeile beginnt mit `unset REF_UPDATE AXE_UPDATE;`.

- [ ] **Step 8: Commit**

```bash
[n] npm run format && npm run lint && npm run typecheck && git add -A && git commit -m "Werkzeug: Schichtregel dicht, exakte Harness-Anker, Legacy-Orakel für core

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Typen, Konstanten und Abdeckungsschwelle

**Files:**
- Create: `src/core/types.ts`, `src/core/constants.ts`, `src/core/test-utils.ts`, `src/core/constants.test.ts`
- Create: `tests/reference/core-constants.test.ts`
- Modify: `vitest.config.ts` (Coverage), `package.json` (`test:unit`)

**Interfaces:**
- Produces (Typen): `VoiceId`, `Part`, `ChannelId`, `Slot`, `Bit`, `StepRow`, `Note`, `NoteRow`, `SubKey`, `SubMap`, `Pattern`, `SongEntry`, `DrumParams`, `SynthKey`, `SynthPatch`, `Pad`, `MixChannel`, `Fx`, `State`, `Preset`.
- Produces (Konstanten): `VOICES`, `VOICE_IDS`, `DRUM_DEFAULTS`, `PRESETS`, `SLOTS`, `SEED_B`, `SEED_NOTES`, `PARTS`, `PART_NAMES`, `PART_BASE`, `NOTE_NAMES`, `SCALES`, `WAVES`, `ROWS`, `SYN_KEYS`, `SYN_PRESETS`, `SMP_RATE`, `SMP_MAX`, `PAD_DEFAULT`, `CHANNELS`, `CHANNEL_NAMES`, `DEFAULT_SENDS`, `STORAGE_KEY`, `SAMPLE_STORAGE_KEY`, `FACTORY_NAMES`, `PAD_COUNT`, `STEPS`.
- Produces (Test-Hilfe): `deepFreeze<T>(value: T): T`.

- [ ] **Step 1: Typen** – `src/core/types.ts`

```ts
/** Zustand der App. Struktur und Feldnamen = Speicherformat 'pocket808.v1' (Legacy serial()). */

export type VoiceId = 'BD' | 'SD' | 'LT' | 'HT' | 'RS' | 'CP' | 'CB' | 'CH' | 'OH' | 'CY';
export type Part = 'BA' | 'LD';
export type ChannelId = VoiceId | Part | 'SM';
export type Slot = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H';
export type Bit = 0 | 1;
/** 16 Steps */
export type StepRow = Bit[];
/** Note als Skalenstufe d (0 = Grundton) mit Länge l in Steps */
export interface Note {
  d: number;
  l: number;
}
export type NoteRow = (Note | null)[];
/** Sub-Steps je Drum-Stimme oder Sampler-Pad ('P0'…'P7'): Step-Index → 16 Teil-Schläge */
export type SubKey = VoiceId | `P${0 | 1 | 2 | 3 | 4 | 5 | 6 | 7}`;
export type SubMap = Partial<Record<SubKey, Partial<Record<number, StepRow>>>>;
export type Pattern = Record<VoiceId, StepRow> & {
  notes: Record<Part, NoteRow>;
  /** 8 Sampler-Pads × 16 Steps */
  smp: StepRow[];
  sub: SubMap;
};
export interface SongEntry {
  p: Slot;
  n: number;
}
export interface DrumParams {
  level: number;
  tune: number;
  decay: number;
}
export type SynthKey =
  | 'cut' | 'res' | 'env' | 'fa' | 'fd' | 'fs' | 'fr'
  | 'aa' | 'ad' | 'as' | 'ar' | 'det' | 'sub' | 'dly' | 'lvl';
export type SynthValues = Record<SynthKey, number> & { wave: number };
export type SynthPatch = { oct: number; mute: boolean; preset: string | null } & SynthValues;
export interface Pad {
  name: string;
  start: number;
  end: number;
  tune: number;
  att: number;
  dec: number;
  lvl: number;
  rev: boolean;
}
export interface MixChannel {
  v: number;
  p: number;
  r: number;
  m: boolean;
  s: boolean;
}
export interface Fx {
  size: number;
  damp: number;
  ret: number;
  dj: number;
  djq: number;
}
export interface Preset {
  name: string;
  tempo: number;
  swing: number;
  pat: Partial<Record<VoiceId, string>>;
}
export interface State {
  tempo: number;
  swing: number;
  master: number;
  sel: number;
  patterns: Record<Slot, Pattern>;
  cur: Slot;
  song: SongEntry[];
  mode: 'pattern' | 'song';
  params: Record<VoiceId, DrumParams>;
  preset: string | null;
  key: number;
  scale: number;
  part: Part;
  noteLen: 1 | 2 | 4;
  synth: Record<Part, SynthPatch>;
  open: { synth: boolean; smp: boolean; mix: boolean; fx: boolean };
  smp: { sel: number; pads: Pad[] };
  mix: Record<ChannelId, MixChannel>;
  fx: Fx;
}
```

- [ ] **Step 2: Konstanten** – `src/core/constants.ts` (Werte 1:1 aus `legacy/index.html`)

```ts
import type {
  ChannelId, DrumParams, Pad, Part, Preset, Slot, SynthKey, SynthValues, VoiceId,
} from './types.ts';

export const STEPS = 16;
export const PAD_COUNT = 8;
export const ROWS = 12;
export const STORAGE_KEY = 'pocket808.v1';
export const SAMPLE_STORAGE_KEY = 'pocket808.smp.v1';

export const VOICES: readonly { id: VoiceId; name: string }[] = [
  { id: 'BD', name: 'Bass Drum' }, { id: 'SD', name: 'Snare Drum' }, { id: 'LT', name: 'Low Tom' },
  { id: 'HT', name: 'High Tom' }, { id: 'RS', name: 'Rim Shot' }, { id: 'CP', name: 'Hand Clap' },
  { id: 'CB', name: 'Cowbell' }, { id: 'CH', name: 'Closed Hi-Hat' }, { id: 'OH', name: 'Open Hi-Hat' },
  { id: 'CY', name: 'Cymbal' },
];
export const VOICE_IDS: readonly VoiceId[] = VOICES.map((v) => v.id);

export const DRUM_DEFAULTS: Readonly<Record<VoiceId, Readonly<DrumParams>>> = {
  BD: { level: 0.9, tune: 0.5, decay: 0.55 }, SD: { level: 0.8, tune: 0.5, decay: 0.45 },
  LT: { level: 0.8, tune: 0.5, decay: 0.5 }, HT: { level: 0.8, tune: 0.5, decay: 0.45 },
  RS: { level: 0.7, tune: 0.5, decay: 0.4 }, CP: { level: 0.8, tune: 0.5, decay: 0.5 },
  CB: { level: 0.7, tune: 0.5, decay: 0.4 }, CH: { level: 0.7, tune: 0.5, decay: 0.4 },
  OH: { level: 0.7, tune: 0.5, decay: 0.5 }, CY: { level: 0.6, tune: 0.5, decay: 0.5 },
};

export const PRESETS: readonly Preset[] = [
  { name: 'House', tempo: 124, swing: 0, pat: {
    BD: 'x...x...x...x...', CP: '....x.......x...', CH: 'x.x.x.x.x.x.x.x.', OH: '..x...x...x...x.' } },
  { name: 'Electro', tempo: 128, swing: 0, pat: {
    BD: 'x..x..x...x..x..', CP: '....x.......x...', HT: '...x.......x..x.', CH: 'x.x.x.x.x.x.x.x.',
    CB: '..x.....x.......' } },
  { name: 'Hip-Hop', tempo: 90, swing: 0.35, pat: {
    BD: 'x.....x.x.....x.', SD: '....x.......x...', RS: '.........x......', CH: 'x.x.x.x.x.x.x.x.',
    OH: '..............x.' } },
  { name: 'Trap', tempo: 140, swing: 0, pat: {
    BD: 'x.....x...x.....', SD: '........x.......', CP: '........x.......', CH: 'x.x.x.x.xxx.x.xx',
    OH: '..............x.' } },
];

export const SLOTS: readonly Slot[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
export const SEED_B: Partial<Record<VoiceId, string>> = {
  BD: 'x.....x.x..x..x.', SD: '....x.......x.xx', RS: '.........x......', CH: 'x.x.x.x.x.x.x.x.',
  OH: '..............x.', CY: 'x...............',
};
/** [Step, Stufe, Länge in Steps] */
export const SEED_NOTES: Readonly<Record<'A' | 'B', Record<Part, readonly [number, number, number][]>>> = {
  A: { BA: [[0, 0, 2], [6, 0, 1], [8, 3, 2], [14, 2, 1]], LD: [[4, 2, 1], [7, 4, 1], [10, 3, 2], [12, 0, 2]] },
  B: {
    BA: [[0, 0, 1], [3, 0, 1], [6, 0, 1], [8, 5, 2], [11, 4, 1], [14, 3, 2]],
    LD: [[0, 4, 2], [4, 2, 2], [8, 3, 1], [10, 2, 1], [12, 4, 4]],
  },
};

export const PARTS: readonly Part[] = ['BA', 'LD'];
export const PART_NAMES: Readonly<Record<Part, string>> = { BA: 'Bass', LD: 'Lead' };
/** Oktave des Grundtons je Part */
export const PART_BASE: Readonly<Record<Part, number>> = { BA: 2, LD: 4 };
export const NOTE_NAMES: readonly string[] = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const SCALES: readonly { name: string; s: readonly number[] }[] = [
  { name: 'Moll', s: [0, 2, 3, 5, 7, 8, 10] }, { name: 'Dur', s: [0, 2, 4, 5, 7, 9, 11] },
  { name: 'Dorisch', s: [0, 2, 3, 5, 7, 9, 10] }, { name: 'Phrygisch', s: [0, 1, 3, 5, 7, 8, 10] },
  { name: 'Moll-Pentatonik', s: [0, 3, 5, 7, 10] }, { name: 'Dur-Pentatonik', s: [0, 2, 4, 7, 9] },
];
export const WAVES: readonly (readonly [label: string, type: OscillatorType])[] = [
  ['Saw', 'sawtooth'], ['Square', 'square'], ['Tri', 'triangle'], ['Sine', 'sine'],
];
export const SYN_KEYS: readonly SynthKey[] = [
  'cut', 'res', 'env', 'fa', 'fd', 'fs', 'fr', 'aa', 'ad', 'as', 'ar', 'det', 'sub', 'dly', 'lvl',
];
export const SYN_PRESETS: Readonly<Record<Part, readonly { name: string; v: Readonly<SynthValues> }[]>> = {
  BA: [
    { name: 'Sub', v: { wave: 3, cut: 0.45, res: 0.05, env: 0.1, fa: 0, fd: 0.3, fs: 0.5, fr: 0.2, aa: 0, ad: 0.5, as: 0.9, ar: 0.2, det: 0, sub: 0.45, dly: 0, lvl: 0.85 } },
    { name: 'Acid', v: { wave: 0, cut: 0.26, res: 0.55, env: 0.7, fa: 0, fd: 0.28, fs: 0, fr: 0.15, aa: 0, ad: 0.6, as: 0.5, ar: 0.15, det: 0, sub: 0.3, dly: 0, lvl: 0.75 } },
    { name: 'Pluck', v: { wave: 1, cut: 0.38, res: 0.25, env: 0.55, fa: 0, fd: 0.22, fs: 0, fr: 0.1, aa: 0, ad: 0.3, as: 0.15, ar: 0.12, det: 0.1, sub: 0.35, dly: 0, lvl: 0.8 } },
  ],
  LD: [
    { name: 'Saw', v: { wave: 0, cut: 0.62, res: 0.2, env: 0.3, fa: 0.02, fd: 0.35, fs: 0.3, fr: 0.3, aa: 0.02, ad: 0.5, as: 0.65, ar: 0.3, det: 0.4, sub: 0, dly: 0.3, lvl: 0.6 } },
    { name: 'Pulse', v: { wave: 1, cut: 0.55, res: 0.3, env: 0.45, fa: 0, fd: 0.3, fs: 0.1, fr: 0.2, aa: 0, ad: 0.4, as: 0.35, ar: 0.25, det: 0.2, sub: 0, dly: 0.35, lvl: 0.55 } },
    { name: 'Soft', v: { wave: 2, cut: 0.7, res: 0.05, env: 0.1, fa: 0.1, fd: 0.4, fs: 0.6, fr: 0.4, aa: 0.15, ad: 0.5, as: 0.85, ar: 0.4, det: 0.2, sub: 0, dly: 0.45, lvl: 0.65 } },
  ],
};

/** Sampler: 22,05-kHz-Mono-PCM, höchstens 3 s */
export const SMP_RATE = 22050;
export const SMP_MAX = 3;
export const PAD_DEFAULT: Readonly<Pad> = {
  name: '', start: 0, end: 1, tune: 0.5, att: 0, dec: 1, lvl: 0.8, rev: false,
};
export const FACTORY_NAMES: readonly string[] = ['Stab', 'Zap', 'Riser', 'Bell'];

/** Mixer: ein Kanal pro Drum-Stimme plus Bass, Lead und Sampler */
export const CHANNELS: readonly ChannelId[] = [...VOICE_IDS, 'BA', 'LD', 'SM'];
export const CHANNEL_NAMES: Readonly<Record<ChannelId, string>> = {
  ...(Object.fromEntries(VOICES.map((v) => [v.id, v.name])) as Record<VoiceId, string>),
  BA: 'Bass', LD: 'Lead', SM: 'Sampler',
};
/** voreingestellte Reverb-Sends */
export const DEFAULT_SENDS: Readonly<Partial<Record<ChannelId, number>>> = {
  SD: 0.2, RS: 0.15, CP: 0.3, LD: 0.15, SM: 0.15,
};
```
(Prettier formatiert die langen Objektzeilen beim `npm run format` um; der Inhalt bleibt.)

- [ ] **Step 3: Test-Hilfe** – `src/core/test-utils.ts`

```ts
/** Friert ein Objekt rekursiv ein: Jede Mutation wirft im Strict Mode einen TypeError. */
export function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
}
```

- [ ] **Step 4: Unit-Test der Konstanten (Konsistenz)** – `src/core/constants.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import {
  CHANNEL_NAMES, CHANNELS, DRUM_DEFAULTS, PRESETS, SCALES, SYN_KEYS, SYN_PRESETS, VOICE_IDS,
} from './constants.ts';
import { deepFreeze } from './test-utils.ts';

describe('Konstanten', () => {
  it('haben für jede Stimme Defaults und jeder Kanal einen Namen', () => {
    expect(Object.keys(DRUM_DEFAULTS)).toEqual([...VOICE_IDS]);
    expect(CHANNELS).toHaveLength(13);
    for (const ch of CHANNELS) expect(CHANNEL_NAMES[ch]).toBeTruthy();
  });

  it('Presets nutzen nur bekannte Stimmen und 16-Step-Muster', () => {
    for (const p of PRESETS) {
      for (const [id, pat] of Object.entries(p.pat)) {
        expect(VOICE_IDS).toContain(id);
        expect(pat).toMatch(/^[x.]{16}$/);
      }
    }
  });

  it('Synth-Presets setzen genau die Synth-Regler plus Wellenform', () => {
    for (const list of Object.values(SYN_PRESETS)) {
      for (const p of list) expect(Object.keys(p.v).sort()).toEqual(['wave', ...SYN_KEYS].sort());
    }
  });

  it('Skalen beginnen beim Grundton und steigen', () => {
    for (const sc of SCALES) {
      expect(sc.s[0]).toBe(0);
      expect([...sc.s].sort((a, b) => a - b)).toEqual([...sc.s]);
    }
  });
});

describe('deepFreeze', () => {
  it('friert verschachtelte Objekte ein', () => {
    const o = deepFreeze({ a: [1, { b: 2 }] });
    expect(() => {
      (o.a[1] as { b: number }).b = 3;
    }).toThrow(TypeError);
  });
});
```

- [ ] **Step 5: Gleichheit mit Legacy** – `tests/reference/core-constants.test.ts`

```ts
import { afterAll, describe, expect, it } from 'vitest';
import * as C from '../../src/core/constants.ts';
import { loadLegacy } from './legacy/harness.ts';

const page = loadLegacy();
const L = page.t;
const plain = (v: unknown): unknown => JSON.parse(JSON.stringify(v));

describe('core-Konstanten = Legacy', () => {
  afterAll(() => {
    page.close();
  });
  it.each([
    ['VOICES', C.VOICES, L.VOICES],
    ['DRUM_DEFAULTS', C.DRUM_DEFAULTS, L.DEFAULTS],
    ['PRESETS', C.PRESETS, L.PRESETS],
    ['SLOTS', C.SLOTS, L.SLOTS],
    ['SEED_B', C.SEED_B, L.SEED_B],
    ['SEED_NOTES', C.SEED_NOTES, L.SEED_NOTES],
    ['PARTS', C.PARTS, L.PARTS],
    ['NOTE_NAMES', C.NOTE_NAMES, L.NAMES],
    ['SCALES', C.SCALES, L.SCALES],
    ['WAVES', C.WAVES, L.WAVES],
    ['ROWS', C.ROWS, L.ROWS],
    ['SYN_KEYS', C.SYN_KEYS, L.SYN_KEYS],
    ['SYN_PRESETS', C.SYN_PRESETS, L.SYN_PRESETS],
    ['SMP_RATE', C.SMP_RATE, L.SMP_RATE],
    ['SMP_MAX', C.SMP_MAX, L.SMP_MAX],
    ['PAD_DEFAULT', C.PAD_DEFAULT, L.SMP_DEF],
    ['CHANNELS', C.CHANNELS, L.CHS],
    ['CHANNEL_NAMES', C.CHANNEL_NAMES, L.CH_FULL],
    ['STORAGE_KEY', C.STORAGE_KEY, L.KEY],
    ['SAMPLE_STORAGE_KEY', C.SAMPLE_STORAGE_KEY, L.SMP_KEY],
    ['FACTORY_NAMES', C.FACTORY_NAMES, L.FACTORY.map((f) => f.name)],
  ])('%s', (_, core, legacy) => {
    expect(plain(core)).toEqual(plain(legacy));
  });

  it('PART_NAMES und PART_BASE', () => {
    for (const id of C.PARTS) {
      expect(C.PART_NAMES[id]).toBe(L.PART_INFO[id].name);
      expect(C.PART_BASE[id]).toBe(L.PART_INFO[id].base);
    }
  });
});
```

- [ ] **Step 6: Tests ausführen**

```bash
[n] npx vitest run src/core && npx vitest run --project reference tests/reference/core-constants.test.ts
```
Expected: Unit 5 PASS, Referenz 23 PASS. Abweichungen sind Abschreibfehler in `constants.ts` → korrigieren.

- [ ] **Step 7: Abdeckungsschwelle** – in `vitest.config.ts` innerhalb `test` (neben `projects`) ergänzen:

```ts
    coverage: {
      provider: 'v8',
      include: ['src/core/**/*.ts', 'src/store/**/*.ts'],
      exclude: ['**/*.test.ts', 'src/core/test-utils.ts'],
      thresholds: { lines: 90, branches: 90, functions: 90, statements: 90, perFile: true },
    },
```

In `package.json`: `"test:unit": "vitest run --project unit --coverage"`.

```bash
[n] npm run test:unit 2>&1 | tail -15
```
Expected: PASS, Tabelle zeigt `constants.ts` mit 100 %.

- [ ] **Step 8: Commit**

```bash
[n] npm run format && npm run lint && npm run typecheck && git add -A && git commit -m "core: Typen und Konstanten, Abdeckungsschwelle 90 %

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Defaults, Presets, Startzustand

**Files:**
- Create: `src/core/defaults.ts`, `src/core/presets.ts`, `src/core/initial.ts`
- Create: `src/core/defaults.test.ts`

**Interfaces:**
- Consumes: Konstanten und Typen (Task 2).
- Produces:
  - `parsePattern(s: string): StepRow`, `emptyRow(): StepRow`, `blankPattern(): Pattern`
  - `drumDefaults()`, `synthDefaults()`, `padDefaults(): Pad[]`, `mixDefaults()`, `fxDefaults(): Fx`
  - `baseState(): State` (Legacy-`state` vor `init`)
  - `applyPreset(state: State, preset: Preset): State`
  - `initialState(): State` (Legacy-Zustand nach `init`, ohne gespeicherte Daten)

- [ ] **Step 1: Failing Tests** – `src/core/defaults.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { PRESETS, VOICE_IDS } from './constants.ts';
import { baseState, blankPattern, mixDefaults, parsePattern } from './defaults.ts';
import { initialState } from './initial.ts';
import { applyPreset } from './presets.ts';
import { deepFreeze } from './test-utils.ts';

const hipHop = PRESETS.find((p) => p.name === 'Hip-Hop')!;

describe('Defaults', () => {
  it('parsePattern liest x als Schlag und füllt auf 16 Steps', () => {
    expect(parsePattern('x..x')).toEqual([1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(parsePattern('x'.repeat(20))).toHaveLength(16);
  });

  it('blankPattern ist leer und unabhängig', () => {
    const a = blankPattern();
    const b = blankPattern();
    for (const id of VOICE_IDS) expect(a[id].every((x) => x === 0)).toBe(true);
    expect(a.notes.BA).toEqual(new Array(16).fill(null));
    expect(a.smp).toHaveLength(8);
    expect(a.sub).toEqual({});
    a.BD[0] = 1;
    expect(b.BD[0]).toBe(0);
  });

  it('mixDefaults setzt Fader, Mitte und voreingestellte Sends', () => {
    const m = mixDefaults();
    expect(m.BD).toEqual({ v: 0.8, p: 0.5, r: 0, m: false, s: false });
    expect(m.CP.r).toBe(0.3);
    expect(m.SM.r).toBe(0.15);
  });

  it('baseState entspricht dem Legacy-Grundzustand', () => {
    const s = baseState();
    expect([s.tempo, s.swing, s.master, s.cur, s.mode, s.key, s.part, s.noteLen]).toEqual([
      90, 0.35, 0.8, 'A', 'pattern', 9, 'BA', 1,
    ]);
    expect(s.synth.BA.preset).toBe('Acid');
    expect(s.synth.LD.preset).toBe('Saw');
  });
});

describe('applyPreset', () => {
  it('ersetzt Drums, Tempo und Swing, behält Noten, Sampler-Steps und Pad-Sub-Steps', () => {
    const s0 = baseState();
    s0.patterns.A.notes.BA[3] = { d: 2, l: 1 };
    s0.patterns.A.smp[1]![4] = 1;
    s0.patterns.A.sub = { BD: { 0: new Array<0 | 1>(16).fill(1) }, P2: { 5: new Array<0 | 1>(16).fill(1) } };
    s0.patterns.A.SD[1] = 1;
    const s = applyPreset(deepFreeze(s0), hipHop);
    expect(s.tempo).toBe(90);
    expect(s.preset).toBe('Hip-Hop');
    expect(s.patterns.A.BD).toEqual(parsePattern('x.....x.x.....x.'));
    expect(s.patterns.A.SD).toEqual(parsePattern('....x.......x...'));
    expect(s.patterns.A.notes.BA[3]).toEqual({ d: 2, l: 1 });
    expect(s.patterns.A.smp[1]![4]).toBe(1);
    expect(Object.keys(s.patterns.A.sub)).toEqual(['P2']);
    expect(s.patterns.B).toBe(s0.patterns.B);
  });
});

describe('initialState', () => {
  it('enthält Hip-Hop in A, Seed in B, Noten, Song und Fabrik-Pads', () => {
    const s = initialState();
    expect(s.preset).toBe('Hip-Hop');
    expect(s.patterns.B.CY[0]).toBe(1);
    expect(s.patterns.A.notes.BA[0]).toEqual({ d: 0, l: 2 });
    expect(s.song).toEqual([{ p: 'A', n: 3 }, { p: 'B', n: 1 }]);
    expect(s.smp.pads.map((p) => p.name)).toEqual(['Stab', 'Zap', 'Riser', 'Bell', '', '', '', '']);
    expect(s.patterns.A.smp[1]![15]).toBe(1);
    expect(s.patterns.B.smp[2]![8]).toBe(1);
  });
});
```

```bash
[n] npx vitest run src/core/defaults.test.ts
```
Expected: FAIL, Module nicht gefunden.

- [ ] **Step 2: `src/core/defaults.ts`**

```ts
import {
  CHANNELS, DEFAULT_SENDS, DRUM_DEFAULTS, PAD_COUNT, PAD_DEFAULT, PARTS, SLOTS, STEPS,
  SYN_PRESETS, VOICE_IDS,
} from './constants.ts';
import type {
  Bit, ChannelId, DrumParams, Fx, MixChannel, NoteRow, Pad, Part, Pattern, State, StepRow,
  SynthPatch, VoiceId,
} from './types.ts';

export const emptyRow = (): StepRow => new Array<Bit>(STEPS).fill(0);
export const parsePattern = (s: string): StepRow =>
  Array.from({ length: STEPS }, (_, i) => (s.charAt(i) === 'x' ? 1 : 0));

export function blankPattern(): Pattern {
  const rows = Object.fromEntries(VOICE_IDS.map((id) => [id, emptyRow()])) as Record<VoiceId, StepRow>;
  const notes = Object.fromEntries(
    PARTS.map((id) => [id, new Array<null>(STEPS).fill(null) as NoteRow]),
  ) as Record<Part, NoteRow>;
  return { ...rows, notes, smp: Array.from({ length: PAD_COUNT }, emptyRow), sub: {} };
}

export const drumDefaults = (): Record<VoiceId, DrumParams> =>
  Object.fromEntries(VOICE_IDS.map((id) => [id, { ...DRUM_DEFAULTS[id] }])) as Record<VoiceId, DrumParams>;

export function synthDefaults(): Record<Part, SynthPatch> {
  const ba = SYN_PRESETS.BA[1]!;
  const ld = SYN_PRESETS.LD[0]!;
  return {
    BA: { oct: 0, mute: false, preset: ba.name, ...ba.v },
    LD: { oct: 0, mute: false, preset: ld.name, ...ld.v },
  };
}

export const padDefaults = (): Pad[] => Array.from({ length: PAD_COUNT }, () => ({ ...PAD_DEFAULT }));

export const mixDefaults = (): Record<ChannelId, MixChannel> =>
  Object.fromEntries(
    CHANNELS.map((id) => [id, { v: 0.8, p: 0.5, r: DEFAULT_SENDS[id] ?? 0, m: false, s: false }]),
  ) as Record<ChannelId, MixChannel>;

export const fxDefaults = (): Fx => ({ size: 0.4, damp: 0.5, ret: 0.5, dj: 0.5, djq: 0.2 });

/** Legacy-`state` vor init(): alle Patterns leer, Werkseinstellungen. */
export function baseState(): State {
  return {
    tempo: 90,
    swing: 0.35,
    master: 0.8,
    sel: 0,
    patterns: Object.fromEntries(SLOTS.map((k) => [k, blankPattern()])) as State['patterns'],
    cur: 'A',
    song: [],
    mode: 'pattern',
    params: drumDefaults(),
    preset: null,
    key: 9,
    scale: 0,
    part: 'BA',
    noteLen: 1,
    synth: synthDefaults(),
    open: { synth: false, smp: false, mix: false, fx: false },
    smp: { sel: 0, pads: padDefaults() },
    mix: mixDefaults(),
    fx: fxDefaults(),
  };
}
```

- [ ] **Step 3: `src/core/presets.ts`**

```ts
import { VOICE_IDS } from './constants.ts';
import { blankPattern, parsePattern } from './defaults.ts';
import type { Pattern, Preset, State, SubMap } from './types.ts';

/** Ersetzt im aktuellen Pattern alle Drum-Spuren; Noten, Sampler-Steps und Pad-Sub-Steps bleiben. */
export function applyPreset(state: State, preset: Preset): State {
  const old = state.patterns[state.cur];
  const keepPads = Object.fromEntries(
    Object.entries(old.sub).filter(([k]) => k.startsWith('P')),
  ) as SubMap;
  const next: Pattern = { ...blankPattern(), notes: old.notes, smp: old.smp, sub: keepPads };
  for (const id of VOICE_IDS) {
    const pat = preset.pat[id];
    if (pat !== undefined) next[id] = parsePattern(pat);
  }
  const patterns = { ...state.patterns };
  patterns[state.cur] = next;
  return { ...state, patterns, tempo: preset.tempo, swing: preset.swing, preset: preset.name };
}
```

- [ ] **Step 4: `src/core/initial.ts`**

```ts
import { FACTORY_NAMES, PARTS, PRESETS, SEED_B, SEED_NOTES, VOICE_IDS } from './constants.ts';
import { baseState, blankPattern, parsePattern } from './defaults.ts';
import { applyPreset } from './presets.ts';
import type { State } from './types.ts';

/** Startzustand der App ohne gespeicherte Daten (Legacy init() vor merge). */
export function initialState(): State {
  const hipHop = PRESETS.find((p) => p.name === 'Hip-Hop');
  if (!hipHop) throw new Error('Preset Hip-Hop fehlt');
  const s = structuredClone(applyPreset(baseState(), hipHop));
  const b = blankPattern();
  for (const id of VOICE_IDS) b[id] = parsePattern(SEED_B[id] ?? '');
  s.patterns.B = b;
  for (const slot of ['A', 'B'] as const) {
    for (const id of PARTS) {
      for (const [step, d, l] of SEED_NOTES[slot][id]) s.patterns[slot].notes[id][step] = { d, l };
    }
  }
  s.song = [{ p: 'A', n: 3 }, { p: 'B', n: 1 }];
  FACTORY_NAMES.forEach((name, i) => {
    s.smp.pads[i]!.name = name;
  });
  s.patterns.A.smp[1]![15] = 1;
  s.patterns.B.smp[2]![8] = 1;
  return s;
}
```

- [ ] **Step 5: Grün sehen**

```bash
[n] npx vitest run src/core/defaults.test.ts
```
Expected: 7 PASS.

- [ ] **Step 6: Commit**

```bash
[n] npm run format && npm run lint && npm run typecheck && git add -A && git commit -m "core: Defaults, Presets und Startzustand

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
(Die Gleichheit von `initialState` mit Legacy prüft Task 4 über die Referenz `merge/leer`.)

---

### Task 4: Laden und Speichern (`loadState` = Legacy-`merge`)

**Files:**
- Create: `src/core/persist.ts`, `src/core/persist.test.ts`
- Create: `tests/reference/core-persist.test.ts`

**Interfaces:**
- Consumes: `baseState`, `blankPattern`, `emptyRow`, `parsePattern`, `initialState`, Konstanten.
- Produces: `clamp(v, lo, hi): number`, `parseStored(raw: string | null): unknown`, `loadState(src: unknown, base: State): State`, `serialize(state: State): State`.

- [ ] **Step 1: Failing Unit-Tests** – `src/core/persist.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { baseState, parsePattern } from './defaults.ts';
import { clamp, loadState, parseStored, serialize } from './persist.ts';
import { deepFreeze } from './test-utils.ts';

const base = deepFreeze(baseState());
const load = (src: unknown) => loadState(src, base);
const ones = (): (0 | 1)[] => new Array<0 | 1>(16).fill(1);

describe('parseStored', () => {
  it('liefert null für fehlende oder kaputte Daten', () => {
    expect(parseStored(null)).toBeNull();
    expect(parseStored('')).toBeNull();
    expect(parseStored('{kaputt')).toBeNull();
    expect(parseStored('{"tempo":100}')).toEqual({ tempo: 100 });
  });
});

describe('loadState', () => {
  it('ignoriert Nicht-Objekte und verändert die Basis nicht', () => {
    for (const src of [null, undefined, 42, 'x', true]) expect(load(src)).toEqual(base);
    expect(load({})).not.toBe(base);
  });

  it('übernimmt und begrenzt Grundwerte', () => {
    const s = load({ tempo: 133.6, swing: 2, master: -1, sel: 3, key: 4, scale: 5, part: 'LD', noteLen: 4, mode: 'song', cur: 'C' });
    expect([s.tempo, s.swing, s.master, s.sel, s.key, s.scale, s.part, s.noteLen, s.mode, s.cur]).toEqual([
      134, 1, 0, 3, 4, 5, 'LD', 4, 'song', 'C',
    ]);
    expect(load({ tempo: 10 }).tempo).toBe(60);
    expect(load({ tempo: 900 }).tempo).toBe(200);
  });

  it('verwirft ungültige Grundwerte', () => {
    const s = load({ tempo: '120', sel: 10, key: 12, scale: 6, part: 'XX', noteLen: 3, mode: 'x', cur: 'Z' });
    expect(s).toEqual(base);
    expect(load({ sel: 1.5, key: -1 })).toEqual(base);
  });

  it('liest Drum-Spuren aus Strings und 16er-Arrays', () => {
    const s = load({ patterns: { A: { BD: 'x...x', SD: [1, 0, 'a', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], CH: [1, 1] } } });
    expect(s.patterns.A.BD).toEqual(parsePattern('x...x'));
    expect(s.patterns.A.SD[2]).toBe(1);
    expect(s.patterns.A.SD[15]).toBe(1);
    expect(s.patterns.A.CH.every((x) => x === 0)).toBe(true);
  });

  it('altes Format mit einzelnem pat landet in A', () => {
    expect(load({ pat: { BD: 'x' } }).patterns.A.BD[0]).toBe(1);
    expect(load({ pat: 'x' }).patterns.A).toEqual(base.patterns.A);
  });

  it('nimmt Noten, Sampler-Steps und Sub-Steps aus dem vorigen Pattern, wenn sie fehlen', () => {
    const b2 = structuredClone(base);
    b2.patterns.B.notes.LD[2] = { d: 1, l: 1 };
    b2.patterns.B.smp[0]![0] = 1;
    b2.patterns.B.sub = { BD: { 1: ones() } };
    const s = loadState({ patterns: { B: { BD: 'x' } } }, deepFreeze(b2));
    expect(s.patterns.B.notes.LD[2]).toEqual({ d: 1, l: 1 });
    expect(s.patterns.B.smp[0]![0]).toBe(1);
    expect(s.patterns.B.sub.BD?.[1]).toEqual(ones());
    expect(loadState({ patterns: { B: 'irgendwas' } }, b2).patterns.B.notes.LD[2]).toEqual({ d: 1, l: 1 });
  });

  it('prüft Noten einzeln', () => {
    const row = [{ d: 3, l: 3.6 }, { d: 12, l: 1 }, { d: -1, l: 1 }, { d: 1.5, l: 1 }, { d: 2, l: 'x' }, { d: 2, l: '3' }, { d: 2, l: 40 }, 5, null, ...new Array(7).fill(null)];
    const s = load({ patterns: { A: { notes: { BA: row, LD: [1, 2] } } } });
    expect(s.patterns.A.notes.BA.slice(0, 9)).toEqual([{ d: 3, l: 4 }, null, null, null, { d: 2, l: 1 }, { d: 2, l: 3 }, { d: 2, l: 16 }, null, null]);
    expect(s.patterns.A.notes.LD).toEqual(new Array(16).fill(null));
  });

  it('liest Sampler-Steps nur bei 8 Reihen, kaputte Reihen werden leer', () => {
    const s = load({ patterns: { A: { smp: [ones(), 'x', [1], ones(), ones(), ones(), ones(), ones()] } } });
    expect(s.patterns.A.smp[0]![5]).toBe(1);
    expect(s.patterns.A.smp[1]!.every((x) => x === 0)).toBe(true);
    expect(load({ patterns: { A: { smp: [ones()] } } }).patterns.A.smp).toEqual(base.patterns.A.smp);
  });

  it('liest Sub-Steps nur für gültige Schlüssel, Steps und nicht-leere Reihen', () => {
    const z = new Array(16).fill(0);
    const s = load({ patterns: { A: { sub: { BD: { 0: ones(), '01': ones(), 16: ones(), x: ones(), 3: z, 4: [1] }, P7: { 2: ones() }, P8: { 0: ones() }, XX: { 0: ones() }, SD: 'kaputt' } } } });
    expect(Object.keys(s.patterns.A.sub).sort()).toEqual(['BD', 'P7']);
    expect(Object.keys(s.patterns.A.sub.BD ?? {}).sort()).toEqual(['0', '1']);
  });

  it('filtert und begrenzt den Song', () => {
    const song = [{ p: 'A', n: 40 }, { p: 'Q', n: 1 }, null, { p: 'B' }, { p: 'C', n: 0.4 }, ...new Array(40).fill({ p: 'D', n: 2 })];
    const s = load({ song });
    expect(s.song.slice(0, 3)).toEqual([{ p: 'A', n: 16 }, { p: 'C', n: 1 }, { p: 'D', n: 2 }]);
    expect(s.song).toHaveLength(32);
  });

  it('übernimmt Drum-Parameter, Rack-Zustand, Mixer und FX begrenzt', () => {
    const s = load({
      params: { BD: { level: 2, tune: -1, decay: 'a' }, XX: { level: 1 }, SD: 3 },
      open: { synth: true, mix: 'ja' },
      mix: { BD: { v: 0.3, p: 2, r: 'x', m: true, s: 1 }, LD: 5 },
      fx: { size: 0.9, dj: 1.5, unbekannt: 1 },
    });
    expect(s.params.BD).toEqual({ level: 1, tune: 0, decay: 0.55 });
    expect(s.open).toEqual({ synth: true, smp: false, mix: false, fx: false });
    expect(s.mix.BD).toEqual({ v: 0.3, p: 1, r: 0, m: true, s: false });
    expect(s.fx).toEqual({ size: 0.9, damp: 0.5, ret: 0.5, dj: 1, djq: 0.2 });
  });

  it('übernimmt Sampler-Pads begrenzt und setzt zu kurze Ausschnitte zurück', () => {
    const s = load({ smp: { sel: 3, pads: [{ start: 0.5, end: 0.51, name: 'ein sehr langer Name' }, { tune: 2, rev: true }, 'x'] } });
    expect(s.smp.sel).toBe(3);
    expect(s.smp.pads[0]).toMatchObject({ start: 0, end: 1, name: 'ein sehr lan' });
    expect(s.smp.pads[1]).toMatchObject({ tune: 1, rev: true });
    expect(load({ smp: { sel: 8 } }).smp.sel).toBe(0);
  });

  it('rechnet den alten Synth-Regler sus in Hüllkurven um, außer fa ist schon da', () => {
    const s = load({ synth: { BA: { sus: 0.3, cut: 0.5, wave: 1, oct: 5 }, LD: { sus: 1, fa: 0.2, wave: 9, preset: 3 } } });
    expect(s.synth.BA.as).toBeCloseTo(0.384);
    expect(s.synth.BA.fd).toBeCloseTo(Math.sqrt(0.16 / 1.8));
    expect(s.synth.BA).toMatchObject({ cut: 0.5, wave: 1, oct: 2, fa: 0, ar: 0.22 });
    expect(s.synth.LD).toMatchObject({ fa: 0.2, as: base.synth.LD.as, wave: 0, preset: null });
    expect(load({ synth: { BA: { preset: 'Sub' } } }).synth.BA.preset).toBe('Sub');
    expect(load({ synth: { BA: 'x' } })).toEqual(base);
  });

  it('verschiebt den alten Synth-Stumm-Schalter in den Mixer', () => {
    const s = load({ synth: { BA: { mute: true } } });
    expect(s.synth.BA.mute).toBe(false);
    expect(s.mix.BA.m).toBe(true);
  });

  it('übernimmt das Preset-Feld nur, wenn es gesetzt ist', () => {
    expect(load({ preset: 'House' }).preset).toBe('House');
    expect(load({ preset: 3 }).preset).toBeNull();
    expect(loadState({}, { ...base, preset: 'Trap' }).preset).toBe('Trap');
  });
});

describe('serialize und clamp', () => {
  it('serialize liefert eine unabhängige Kopie mit allen Feldern', () => {
    const s = serialize(base);
    expect(s).toEqual(base);
    expect(s).not.toBe(base);
    expect(Object.keys(s)).toEqual(Object.keys(base));
  });
  it('clamp', () => {
    expect([clamp(-1, 0, 1), clamp(2, 0, 1), clamp(0.5, 0, 1)]).toEqual([0, 1, 0.5]);
  });
});
```

```bash
[n] npx vitest run src/core/persist.test.ts
```
Expected: FAIL, Modul nicht gefunden.

- [ ] **Step 2: `src/core/persist.ts`**

```ts
import { CHANNELS, PARTS, ROWS, SCALES, SLOTS, SYN_KEYS, VOICE_IDS, WAVES } from './constants.ts';
import { blankPattern, emptyRow, parsePattern } from './defaults.ts';
import type { Fx, NoteRow, Pattern, Slot, State, StepRow, SubKey } from './types.ts';

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null;
const isArr = (v: unknown): v is unknown[] => Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number';
const isInt = (v: unknown): v is number => Number.isInteger(v);
const isSlot = (v: unknown): v is Slot => typeof v === 'string' && (SLOTS as readonly string[]).includes(v);
const bits = (a: unknown[]): StepRow => a.map((x) => (x ? 1 : 0));
const PAD_SUB_KEY = /^P[0-7]$/;

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** Rohwert aus localStorage → Objekt oder null (wie Legacy loadStored). */
export function parseStored(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function readNotes(a: unknown): NoteRow | null {
  if (!isArr(a) || a.length !== 16) return null;
  return a.map((n) =>
    isObj(n) && isInt(n.d) && n.d >= 0 && n.d < ROWS
      ? { d: n.d, l: clamp(Math.round(Number(n.l)) || 1, 1, 16) }
      : null,
  );
}

function readPattern(o: unknown, prev: Pattern): Pattern {
  const p = blankPattern();
  const src = isObj(o) ? o : undefined;
  if (src) {
    for (const id of VOICE_IDS) {
      const a = src[id];
      if (typeof a === 'string') p[id] = parsePattern(a);
      else if (isArr(a) && a.length === 16) p[id] = bits(a);
    }
  }
  const notes = src?.notes;
  if (isObj(notes)) {
    for (const id of PARTS) {
      const row = readNotes(notes[id]);
      if (row) p.notes[id] = row;
    }
  } else p.notes = prev.notes;
  const smp = src?.smp;
  if (isArr(smp) && smp.length === 8) {
    p.smp = smp.map((r) => (isArr(r) && r.length === 16 ? bits(r) : emptyRow()));
  } else p.smp = prev.smp;
  const sub = src?.sub;
  if (isObj(sub)) {
    for (const key of Object.keys(sub)) {
      if (!((VOICE_IDS as readonly string[]).includes(key) || PAD_SUB_KEY.test(key))) continue;
      const m = sub[key];
      if (!isObj(m)) continue;
      for (const st of Object.keys(m)) {
        const n = Number(st);
        const a = m[st];
        if (isInt(n) && n >= 0 && n < 16 && isArr(a) && a.length === 16 && a.some(Boolean)) {
          (p.sub[key as SubKey] ??= {})[n] = bits(a);
        }
      }
    }
  } else p.sub = prev.sub;
  return p;
}

/**
 * Übernimmt einen (evtl. alten oder fremden) Speicherstand in `base` – verhaltensgleich zu
 * Legacy merge(): Unbekanntes wird ignoriert, Werte begrenzt, alte Formate migriert.
 */
export function loadState(src: unknown, base: State): State {
  const s = structuredClone(base);
  if (!isObj(src)) return s;
  if (isNum(src.tempo)) s.tempo = clamp(Math.round(src.tempo), 60, 200);
  if (isNum(src.swing)) s.swing = clamp(src.swing, 0, 1);
  if (isNum(src.master)) s.master = clamp(src.master, 0, 1);
  if (isInt(src.sel) && src.sel >= 0 && src.sel < VOICE_IDS.length) s.sel = src.sel;
  if (isObj(src.patterns)) {
    const pats = src.patterns;
    for (const k of SLOTS) if (pats[k]) s.patterns[k] = readPattern(pats[k], s.patterns[k]);
  } else if (isObj(src.pat)) {
    s.patterns.A = readPattern(src.pat, s.patterns.A);
  }
  if (isSlot(src.cur)) s.cur = src.cur;
  if (isArr(src.song)) {
    s.song = src.song
      .filter((e): e is Obj & { p: Slot; n: number } => isObj(e) && isSlot(e.p) && isNum(e.n))
      .slice(0, 32)
      .map((e) => ({ p: e.p, n: clamp(Math.round(e.n), 1, 16) }));
  }
  if (src.mode === 'song' || src.mode === 'pattern') s.mode = src.mode;
  if (isObj(src.params)) {
    for (const id of VOICE_IDS) {
      const p = src.params[id];
      if (!isObj(p)) continue;
      for (const k of ['level', 'tune', 'decay'] as const) {
        const v = p[k];
        if (isNum(v)) s.params[id][k] = clamp(v, 0, 1);
      }
    }
  }
  if (isObj(src.open)) {
    for (const k of ['synth', 'smp', 'mix', 'fx'] as const) {
      const v = src.open[k];
      if (typeof v === 'boolean') s.open[k] = v;
    }
  }
  if (isObj(src.smp)) {
    const q0 = src.smp;
    if (isInt(q0.sel) && q0.sel >= 0 && q0.sel < 8) s.smp.sel = q0.sel;
    if (isArr(q0.pads)) {
      q0.pads.slice(0, 8).forEach((q, i) => {
        const t = s.smp.pads[i]!;
        if (!isObj(q)) return;
        for (const k of ['start', 'end', 'tune', 'att', 'dec', 'lvl'] as const) {
          const v = q[k];
          if (isNum(v)) t[k] = clamp(v, 0, 1);
        }
        if (t.end < t.start + 0.02) {
          t.start = 0;
          t.end = 1;
        }
        if (typeof q.rev === 'boolean') t.rev = q.rev;
        if (typeof q.name === 'string') t.name = q.name.slice(0, 12);
      });
    }
  }
  if (isInt(src.key) && src.key >= 0 && src.key < 12) s.key = src.key;
  if (isInt(src.scale) && src.scale >= 0 && src.scale < SCALES.length) s.scale = src.scale;
  if (src.part === 'BA' || src.part === 'LD') s.part = src.part;
  if (src.noteLen === 1 || src.noteLen === 2 || src.noteLen === 4) s.noteLen = src.noteLen;
  if (isObj(src.synth)) {
    for (const id of PARTS) {
      const p = src.synth[id];
      const t = s.synth[id];
      if (!isObj(p)) continue;
      // alter Regler sus → Hüllkurven
      if (isNum(p.sus) && !isNum(p.fa)) {
        const su = clamp(p.sus, 0, 1);
        Object.assign(t, {
          fa: 0, fd: Math.sqrt(Math.max(0, (0.04 + su * 0.4) / 1.8)), fs: 0, fr: 0.22,
          aa: 0, ad: 0.6, as: 0.12 + 0.88 * su, ar: 0.22,
        });
      }
      for (const k of SYN_KEYS) {
        const v = p[k];
        if (isNum(v)) t[k] = clamp(v, 0, 1);
      }
      if (isInt(p.wave) && p.wave >= 0 && p.wave < WAVES.length) t.wave = p.wave;
      if (isInt(p.oct)) t.oct = clamp(p.oct, -2, 2);
      if (typeof p.mute === 'boolean') t.mute = p.mute;
      if ('preset' in p) t.preset = typeof p.preset === 'string' ? p.preset : null;
    }
  }
  // alter Synth-Stumm-Schalter wandert in den Mixer
  for (const id of PARTS) {
    if (s.synth[id].mute) {
      s.mix[id].m = true;
      s.synth[id].mute = false;
    }
  }
  if (isObj(src.mix)) {
    for (const id of CHANNELS) {
      const q = src.mix[id];
      if (!isObj(q)) continue;
      const t = s.mix[id];
      for (const k of ['v', 'p', 'r'] as const) {
        const v = q[k];
        if (isNum(v)) t[k] = clamp(v, 0, 1);
      }
      if (typeof q.m === 'boolean') t.m = q.m;
      if (typeof q.s === 'boolean') t.s = q.s;
    }
  }
  if (isObj(src.fx)) {
    for (const k of Object.keys(s.fx) as (keyof Fx)[]) {
      const v = src.fx[k];
      if (isNum(v)) s.fx[k] = clamp(v, 0, 1);
    }
  }
  if ('preset' in src) s.preset = typeof src.preset === 'string' ? src.preset : null;
  return s;
}

/** Speicherbare, unabhängige Kopie in der Feldreihenfolge von Legacy serial(). */
export function serialize(state: State): State {
  const c = structuredClone(state);
  return {
    tempo: c.tempo, swing: c.swing, master: c.master, sel: c.sel, patterns: c.patterns, cur: c.cur,
    song: c.song, mode: c.mode, params: c.params, preset: c.preset, key: c.key, scale: c.scale,
    part: c.part, noteLen: c.noteLen, synth: c.synth, open: c.open, smp: c.smp, mix: c.mix, fx: c.fx,
  };
}
```

- [ ] **Step 3: Unit-Tests grün**

```bash
[n] npx vitest run src/core/persist.test.ts
```
Expected: alle PASS. Schlägt ein Test fehl, Legacy-`merge` (`legacy/index.html` Zeilen ~684–785) als Maßstab nehmen, nicht den Test anpassen – es sei denn, der Test widerspricht nachweislich Legacy (dann Ruling).

- [ ] **Step 4: Commit**

```bash
[n] npm run format && npm run lint && npm run typecheck && git add -A && git commit -m "core: Laden und Speichern (loadState = Legacy-merge)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
(Die Gleichwertigkeit mit Legacy – Referenzdateien und Fuzz – prüft Task 5, weil sie den Sample-Speicher braucht.)

---

### Task 5: Sample-Speicher und Startablauf

**Files:**
- Create: `src/core/samples.ts`, `src/core/samples.test.ts`, `src/core/boot.ts`, `src/core/boot.test.ts`
- Create: `tests/reference/core-samples.test.ts`
- Modify: `tests/reference/merge.test.ts` (Drum-Sample-Namen in die Referenz), `tests/reference/golden/merge/sample-speicher.json` (bewusst neu erzeugt)

**Interfaces:**
- Produces:
  - `encodePcm(pcm: Float32Array): string`, `decodePcm(b64: string): Float32Array`
  - `parseSampleStore(raw: string | null): Record<string, unknown>`
  - `interface DrumSample { pcm: Float32Array; name: string }`
  - `applySampleStore(state: State, store: Record<string, unknown>, pcm: readonly (Float32Array | null)[]): { state: State; pads: (Float32Array | null)[]; drums: Partial<Record<VoiceId, DrumSample>> }`
  - `bootState(stored: string | null, sampleStore: string | null, factoryPcm: readonly (Float32Array | null)[]): ReturnType<typeof applySampleStore>`

- [ ] **Step 1: Referenz um Drum-Sample-Namen erweitern** – in `tests/reference/merge.test.ts` im Test „Sample-Speicher“ das `actual`-Objekt um eine Zeile ergänzen:

```ts
        drumNames: Object.fromEntries(Object.entries(p.t.drumName)),
```

```bash
[n] npx vitest run --project reference tests/reference/merge.test.ts -t Sample
[n] REF_UPDATE=1 npx vitest run --project reference tests/reference/merge.test.ts -t Sample
git diff --stat tests/reference/golden
```
Expected: erster Lauf FAIL (Referenz hat das Feld noch nicht), danach geändert genau `merge/sample-speicher.json` mit `"drumNames": {"BD": "Mein Kick"}`.

- [ ] **Step 2: Failing Unit-Tests** – `src/core/samples.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { baseState } from './defaults.ts';
import { applySampleStore, decodePcm, encodePcm, parseSampleStore } from './samples.ts';
import { deepFreeze } from './test-utils.ts';

const b64 = (xs: number[]) => Buffer.from(Int16Array.from(xs).buffer).toString('base64');

describe('PCM-Kodierung', () => {
  it('kodiert 16 Bit, begrenzt auf ±1 und dekodiert zurück', () => {
    const enc = encodePcm(Float32Array.from([0, 0.5, -0.5, 1, 2, -2]));
    expect(enc).toBe(b64([0, 16383, -16383, 32767, 32767, -32767]));
    expect(Array.from(decodePcm(b64([0, 16383, -16384, 32767]))).map((x) => Math.round(x * 1e4) / 1e4)).toEqual([0, 0.5, -0.5, 1]);
  });
  it('wirft bei ungültigem Base64', () => {
    expect(() => decodePcm('***')).toThrow();
  });
  it('kodiert lange Puffer in Blöcken', () => {
    const long = new Float32Array(20000).fill(0.25);
    expect(decodePcm(encodePcm(long))).toHaveLength(20000);
  });
});

describe('parseSampleStore', () => {
  it('liefert ein leeres Objekt bei fehlenden oder kaputten Daten', () => {
    expect(parseSampleStore(null)).toEqual({});
    expect(parseSampleStore('kaputt')).toEqual({});
    expect(parseSampleStore('null')).toEqual({});
    expect(parseSampleStore('{"0":{"d":""}}')).toEqual({ 0: { d: '' } });
  });
});

describe('applySampleStore', () => {
  const state = deepFreeze(
    (() => {
      const s = baseState();
      s.smp.pads.forEach((p, i) => {
        p.name = `Pad${i}`;
      });
      return s;
    })(),
  );
  const factory = [new Float32Array(3), new Float32Array(3), null, null, null, null, null, null];

  it('lädt Pads, leert Pads und löscht Namen von Pads ohne Sample', () => {
    const r = applySampleStore(state, { 0: { d: '' }, 5: { d: b64([1, 2]) }, 9: { d: b64([1]) }, 1.5: { d: b64([1]) }, 2: 'x', 3: { d: 7 }, 4: { d: '***' } }, factory);
    expect(r.pads.map((p) => p?.length ?? null)).toEqual([null, 3, null, null, null, 2, null, null]);
    expect(r.state.smp.pads.map((p) => p.name)).toEqual(['', 'Pad1', '', '', '', 'Pad5', '', '']);
    expect(factory[0]).not.toBeNull();
  });

  it('lädt eigene Drum-Samples mit Namen, Standardname „Sample“', () => {
    const r = applySampleStore(state, { 'D:BD': { d: b64([5]), n: 'Kick' }, 'D:SD': { d: b64([5]) }, 'D:XX': { d: b64([5]) }, 'D:CH': { d: '' }, 'D:OH': { d: '***' } }, factory);
    expect(Object.keys(r.drums).sort()).toEqual(['BD', 'SD']);
    expect(r.drums.BD?.name).toBe('Kick');
    expect(r.drums.SD?.name).toBe('Sample');
  });
});
```

`src/core/boot.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { bootState } from './boot.ts';

describe('bootState', () => {
  it('lädt Zustand und Sample-Speicher in der Legacy-Reihenfolge', () => {
    const factory = [new Float32Array(1), null, null, null, null, null, null, null];
    const r = bootState('{"tempo":111,"smp":{"pads":[{},{"name":"weg"}]}}', '{"0":{"d":""}}', factory);
    expect(r.state.tempo).toBe(111);
    expect(r.state.smp.pads[0]!.name).toBe('');
    expect(r.state.smp.pads[1]!.name).toBe('');
    expect(r.pads[0]).toBeNull();
  });
  it('startet ohne gespeicherte Daten mit dem Startzustand', () => {
    const r = bootState(null, null, [null, null, null, null, null, null, null, null]);
    expect(r.state.preset).toBe('Hip-Hop');
  });
});
```

```bash
[n] npx vitest run src/core/samples.test.ts src/core/boot.test.ts
```
Expected: FAIL, Module nicht gefunden.

- [ ] **Step 3: `src/core/samples.ts`**

```ts
import { PAD_COUNT, VOICE_IDS } from './constants.ts';
import type { State, VoiceId } from './types.ts';

export interface DrumSample {
  pcm: Float32Array;
  name: string;
}

/** Float-PCM → 16-Bit-Little-Endian → Base64 (Format von 'pocket808.smp.v1'). */
export function encodePcm(pcm: Float32Array): string {
  const ints = new Int16Array(pcm.length);
  for (let i = 0; i < pcm.length; i++) ints[i] = Math.max(-1, Math.min(1, pcm[i]!)) * 32767;
  const bytes = new Uint8Array(ints.buffer);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(bin);
}

/** Base64 → Float-PCM. Wirft bei ungültigem Base64. */
export function decodePcm(b64: string): Float32Array {
  const bin = atob(b64);
  const n = bin.length >> 1;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = (((bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8)) << 16) >> 16) / 32767;
  }
  return out;
}

export function parseSampleStore(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw) as unknown;
    return typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

const dataOf = (e: unknown): unknown =>
  typeof e === 'object' && e !== null ? (e as Record<string, unknown>).d : undefined;

/**
 * Wendet den Sample-Speicher an (Legacy applySmpStore): eigene Pad-Samples, geleerte Pads,
 * eigene Drum-Samples. Pads ohne Sample verlieren ihren Namen.
 */
export function applySampleStore(
  state: State,
  store: Record<string, unknown>,
  pcm: readonly (Float32Array | null)[],
): { state: State; pads: (Float32Array | null)[]; drums: Partial<Record<VoiceId, DrumSample>> } {
  const pads = Array.from({ length: PAD_COUNT }, (_, i) => pcm[i] ?? null);
  const names = state.smp.pads.map((p) => p.name);
  const drums: Partial<Record<VoiceId, DrumSample>> = {};
  for (const [k, e] of Object.entries(store)) {
    const d = dataOf(e);
    if (k.startsWith('D:')) {
      const id = k.slice(2) as VoiceId;
      if (!VOICE_IDS.includes(id) || typeof d !== 'string' || !d) continue;
      try {
        const n = (e as Record<string, unknown>).n;
        drums[id] = { pcm: decodePcm(d), name: typeof n === 'string' ? n : 'Sample' };
      } catch {
        /* ungültige Daten ignorieren (wie Legacy) */
      }
      continue;
    }
    const i = Number(k);
    if (!Number.isInteger(i) || i < 0 || i >= PAD_COUNT || typeof d !== 'string') continue;
    if (d === '') {
      pads[i] = null;
      names[i] = '';
      continue;
    }
    try {
      pads[i] = decodePcm(d);
    } catch {
      /* ungültige Daten ignorieren (wie Legacy) */
    }
  }
  const next = names.map((name, i) => (pads[i] ? name : ''));
  const changed = next.some((n, i) => n !== state.smp.pads[i]!.name);
  const out = changed
    ? { ...state, smp: { ...state.smp, pads: state.smp.pads.map((p, i) => ({ ...p, name: next[i]! })) } }
    : state;
  return { state: out, pads, drums };
}
```

- [ ] **Step 4: `src/core/boot.ts`**

```ts
import { initialState } from './initial.ts';
import { loadState, parseStored } from './persist.ts';
import { applySampleStore, parseSampleStore } from './samples.ts';

/** Startzustand wie Legacy init(): Startzustand → gespeicherter Zustand → Sample-Speicher. */
export function bootState(
  stored: string | null,
  sampleStore: string | null,
  factoryPcm: readonly (Float32Array | null)[],
): ReturnType<typeof applySampleStore> {
  const state = loadState(parseStored(stored), initialState());
  return applySampleStore(state, parseSampleStore(sampleStore), factoryPcm);
}
```

- [ ] **Step 5: Unit-Tests grün**

```bash
[n] npx vitest run src/core/samples.test.ts src/core/boot.test.ts
```
Expected: alle PASS.

- [ ] **Step 6: Referenz-Gleichheit** – `tests/reference/core-samples.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { bootState } from '../../src/core/boot.ts';
import { SAMPLE_STORE } from './fixtures/saves.ts';
import { readGolden } from './golden.ts';

const round = (xs: Iterable<number>) => Array.from(xs).map((x) => Math.round(x * 1e4) / 1e4);
// Längen der Legacy-Fabrik-Samples: Stab 0,9 s, Zap 0,4 s, Riser 1,3 s, Bell 1,2 s bei 22,05 kHz
const FACTORY_PCM = [19845, 8820, 28665, 26460].map((n) => new Float32Array(n)).concat([null, null, null, null] as never[]);

describe('core Sample-Speicher = Legacy', () => {
  it('Referenz sample-speicher', () => {
    const r = bootState(null, SAMPLE_STORE, FACTORY_PCM);
    const actual = {
      padNames: r.state.smp.pads.map((p) => p.name),
      padLengths: r.pads.map((p) => p?.length ?? null),
      pad5: round(r.pads[5] ?? []),
      drumBD: round(r.drums.BD?.pcm ?? []),
      drumKeys: Object.keys(r.drums).sort(),
      drumNames: Object.fromEntries(Object.entries(r.drums).map(([k, v]) => [k, v.name])),
    };
    expect(actual).toEqual(readGolden<typeof actual>('merge/sample-speicher', actual));
  });
});
```

```bash
[n] npx vitest run --project reference tests/reference/core-samples.test.ts
```
Expected: PASS.

- [ ] **Step 7: Gleichwertigkeit von `loadState` mit Legacy (Referenzen + Fuzz)** – `tests/reference/core-persist.test.ts`

```ts
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { initialState } from '../../src/core/initial.ts';
import { loadState, parseStored, serialize } from '../../src/core/persist.ts';
import { applySampleStore } from '../../src/core/samples.ts';
import { SAVES } from './fixtures/saves.ts';
import { readGolden } from './golden.ts';
import { loadLegacy } from './legacy/harness.ts';

const plain = (v: unknown): unknown => JSON.parse(JSON.stringify(v));
/** Legacy: Fabrik-Samples liegen auf Pads 0–3. */
const FACTORY_PCM = [0, 1, 2, 3].map(() => new Float32Array(1)).concat([null, null, null, null] as never[]);
const viaCore = (raw: string | null) =>
  plain(serialize(applySampleStore(loadState(parseStored(raw), initialState()), {}, FACTORY_PCM).state));

describe('core loadState = Legacy merge', () => {
  for (const [name, raw] of Object.entries(SAVES)) {
    it(`Referenz ${name}`, () => {
      const golden = readGolden<unknown>(`merge/${name}`, null);
      expect(viaCore(raw)).toEqual(golden);
    });
  }

  it('Fuzz: zufällige, teils kaputte Speicherstände ergeben denselben Zustand', () => {
    fc.assert(
      fc.property(saveArb(), (save) => {
        const raw = JSON.stringify(save);
        const page = loadLegacy({ storage: { 'pocket808.v1': raw } });
        try {
          expect(viaCore(raw)).toEqual(plain(page.t.serial()));
        } finally {
          page.close();
        }
      }),
      { numRuns: 60, seed: 808 },
    );
  });
});

function saveArb() {
  const junk = fc.oneof(
    fc.constant(null), fc.boolean(), fc.integer({ min: -5, max: 300 }),
    fc.double({ min: -2, max: 2, noNaN: true, noDefaultInfinity: true }),
    fc.string({ maxLength: 6 }), fc.constant([]), fc.constant({}),
  );
  const val = <T>(a: fc.Arbitrary<T>) =>
    fc.oneof({ weight: 3, arbitrary: a as fc.Arbitrary<unknown> }, { weight: 1, arbitrary: junk });
  const unit = fc.double({ min: -0.5, max: 1.5, noNaN: true, noDefaultInfinity: true });
  const bits = fc.array(fc.oneof(fc.constant(0), fc.constant(1), junk), { minLength: 15, maxLength: 17 });
  const noteArb = fc.option(fc.record({ d: val(fc.integer({ min: -2, max: 14 })), l: val(fc.double({ min: 0, max: 20, noNaN: true, noDefaultInfinity: true })) }, { requiredKeys: [] }));
  const notesRow = fc.array(val(noteArb), { minLength: 15, maxLength: 17 });
  const sub = fc.dictionary(
    fc.constantFrom('BD', 'SD', 'P0', 'P7', 'P8', 'XX', ''),
    val(fc.dictionary(fc.constantFrom('0', '5', '15', '16', '-1', '01', '', 'x'), val(bits))),
  );
  const pattern = fc.record(
    {
      BD: val(fc.oneof(fc.stringMatching(/^[x.]{0,20}$/), bits)),
      CH: val(fc.oneof(fc.stringMatching(/^[x.]{0,20}$/), bits)),
      notes: val(fc.record({ BA: val(notesRow), LD: val(notesRow) }, { requiredKeys: [] })),
      smp: val(fc.array(val(bits), { minLength: 7, maxLength: 9 })),
      sub: val(sub),
    },
    { requiredKeys: [] },
  );
  const synth = fc.record(
    {
      sus: val(unit), fa: val(unit), cut: val(unit), res: val(unit), lvl: val(unit),
      wave: val(fc.integer({ min: -1, max: 5 })), oct: val(fc.integer({ min: -4, max: 4 })),
      mute: val(fc.boolean()), preset: val(fc.option(fc.string({ maxLength: 6 }))),
    },
    { requiredKeys: [] },
  );
  return fc.record(
    {
      tempo: val(fc.double({ min: 0, max: 400, noNaN: true, noDefaultInfinity: true })),
      swing: val(unit), master: val(unit), sel: val(fc.integer({ min: -1, max: 11 })),
      patterns: val(fc.dictionary(fc.constantFrom('A', 'B', 'H', 'Z'), val(pattern))),
      pat: val(pattern),
      cur: val(fc.constantFrom('A', 'H', 'Z')),
      song: val(fc.array(val(fc.record({ p: val(fc.constantFrom('A', 'B', 'Q')), n: val(fc.double({ min: -3, max: 40, noNaN: true, noDefaultInfinity: true })) }, { requiredKeys: [] })), { maxLength: 40 })),
      mode: val(fc.constantFrom('song', 'pattern', 'x')),
      params: val(fc.dictionary(fc.constantFrom('BD', 'CY', 'XX'), val(fc.record({ level: val(unit), tune: val(unit), decay: val(unit) }, { requiredKeys: [] })))),
      open: val(fc.record({ synth: val(fc.boolean()), fx: val(fc.boolean()) }, { requiredKeys: [] })),
      smp: val(fc.record({ sel: val(fc.integer({ min: -1, max: 9 })), pads: val(fc.array(val(fc.record({ start: val(unit), end: val(unit), tune: val(unit), rev: val(fc.boolean()), name: val(fc.string({ maxLength: 20 })) }, { requiredKeys: [] })), { maxLength: 10 })) }, { requiredKeys: [] })),
      key: val(fc.integer({ min: -1, max: 13 })), scale: val(fc.integer({ min: -1, max: 7 })),
      part: val(fc.constantFrom('BA', 'LD', 'XX')), noteLen: val(fc.constantFrom(1, 2, 3, 4)),
      synth: val(fc.record({ BA: val(synth), LD: val(synth) }, { requiredKeys: [] })),
      mix: val(fc.dictionary(fc.constantFrom('BD', 'SM', 'LD', 'XX'), val(fc.record({ v: val(unit), p: val(unit), r: val(unit), m: val(fc.boolean()), s: val(fc.boolean()) }, { requiredKeys: [] })))),
      fx: val(fc.record({ size: val(unit), dj: val(unit), djq: val(unit), foo: val(unit) }, { requiredKeys: [] })),
      preset: val(fc.option(fc.string({ maxLength: 8 }))),
    },
    { requiredKeys: [] },
  );
}
```

```bash
[n] npx vitest run --project reference tests/reference/core-persist.test.ts tests/reference/core-samples.test.ts
```
Expected: 14 PASS (12 Referenzen + Fuzz + Sample-Speicher). Bei Fuzz-Fehlern meldet fast-check das kleinste Gegenbeispiel: Abweichung in `persist.ts` gegen Legacy-`merge` (`legacy/index.html` ~684–785) beheben und als Unit-Test in `persist.test.ts` festhalten.

- [ ] **Step 8: Commit**

```bash
[n] npm run format && npm run lint && npm run typecheck && git add -A && git commit -m "core: Sample-Speicher und Startablauf; Laden gleichwertig zu Legacy (Referenzen + Fuzz)

Referenz sample-speicher um die Namen eigener Drum-Samples erweitert.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Musiktheorie, Hüllkurven-Zeiten, Mixer-Logik

**Files:**
- Create: `src/core/music.ts`, `src/core/envelope.ts`, `src/core/mix.ts`, `src/core/music.test.ts`
- Create: `tests/reference/core-music.test.ts`

**Interfaces:**
- Produces:
  - `interface Tonality { key: number; scale: number }`
  - `degreeToMidi(part: Part, degree: number, tonality: Tonality, octave: number): number`
  - `degreeName(degree: number, tonality: Tonality): string`
  - `effectiveLength(row: NoteRow, step: number): number`
  - `attackTime(x)`, `decayTime(x)`, `releaseTime(x)` (Sekunden)
  - `audibleChannels(mix: Record<ChannelId, MixChannel>): Record<ChannelId, boolean>`
  - `channelGain(ch: MixChannel, audible: boolean): number`, `channelPan(ch: MixChannel): number`, `masterGain(v: number): number`

- [ ] **Step 1: Failing Unit-Tests** – `src/core/music.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { mixDefaults } from './defaults.ts';
import { attackTime, decayTime, releaseTime } from './envelope.ts';
import { audibleChannels, channelGain, channelPan, masterGain } from './mix.ts';
import { degreeName, degreeToMidi, effectiveLength } from './music.ts';
import { deepFreeze } from './test-utils.ts';
import type { NoteRow } from './types.ts';

const aMinor = { key: 9, scale: 0 };

describe('degreeToMidi', () => {
  it('Grundton: Bass A2 = 45, Lead A4 = 69', () => {
    expect(degreeToMidi('BA', 0, aMinor, 0)).toBe(45);
    expect(degreeToMidi('LD', 0, aMinor, 0)).toBe(69);
  });
  it('Stufen über die Oktave und darunter, Oktav-Regler', () => {
    expect(degreeToMidi('BA', 7, aMinor, 0)).toBe(57);
    expect(degreeToMidi('BA', -1, aMinor, 0)).toBe(43);
    expect(degreeToMidi('BA', 2, aMinor, -1)).toBe(36);
    expect(degreeToMidi('BA', 5, { key: 0, scale: 4 }, 0)).toBe(48);
  });
});

describe('degreeName', () => {
  it('benennt Stufen in Tonart und Skala', () => {
    expect(degreeName(0, aMinor)).toBe('A');
    expect(degreeName(2, aMinor)).toBe('C');
    expect(degreeName(-1, aMinor)).toBe('G');
  });
});

describe('effectiveLength', () => {
  const row: NoteRow = new Array(16).fill(null);
  row[0] = { d: 0, l: 4 };
  row[2] = { d: 1, l: 1 };
  row[14] = { d: 0, l: 4 };
  deepFreeze(row);
  it('endet an der nächsten Note, am Taktende oder nach l Steps', () => {
    expect(effectiveLength(row, 0)).toBe(2);
    expect(effectiveLength(row, 2)).toBe(1);
    expect(effectiveLength(row, 14)).toBe(2);
    expect(effectiveLength(row, 5)).toBe(0);
  });
});

describe('Hüllkurven-Zeiten', () => {
  it('quadratisch von kurz bis lang', () => {
    expect([attackTime(0), decayTime(0), releaseTime(0)]).toEqual([0.002, 0.02, 0.02]);
    expect(attackTime(1)).toBeCloseTo(1.502);
    expect(decayTime(1)).toBeCloseTo(1.82);
    expect(releaseTime(1)).toBeCloseTo(1.22);
  });
});

describe('Mixer-Logik', () => {
  it('Mute und Solo bestimmen die Hörbarkeit', () => {
    const m = structuredClone(mixDefaults());
    expect(Object.values(audibleChannels(m)).every(Boolean)).toBe(true);
    m.SD.m = true;
    expect(audibleChannels(m).SD).toBe(false);
    m.LT.s = true;
    m.SD.s = true;
    const a = audibleChannels(deepFreeze(m));
    expect([a.LT, a.SD, a.BD]).toEqual([true, false, false]);
  });
  it('Fader-Kurve, Pan, Master-Kurve', () => {
    const ch = { v: 0.8, p: 0.75, r: 0, m: false, s: false };
    expect(channelGain(ch, true)).toBeCloseTo(1);
    expect(channelGain(ch, false)).toBe(0);
    expect(channelPan(ch)).toBe(0.5);
    expect(masterGain(0.25)).toBeCloseTo(0.125);
  });
});
```

```bash
[n] npx vitest run src/core/music.test.ts
```
Expected: FAIL, Module nicht gefunden.

- [ ] **Step 2: Implementierung**

`src/core/music.ts`:
```ts
import { NOTE_NAMES, PART_BASE, SCALES } from './constants.ts';
import type { NoteRow, Part } from './types.ts';

export interface Tonality {
  key: number;
  scale: number;
}

function scaleStep(degree: number, scale: number): { octave: number; semis: number } {
  const sc = SCALES[scale]!.s;
  const n = sc.length;
  return { octave: Math.floor(degree / n), semis: sc[((degree % n) + n) % n]! };
}

/** Skalenstufe → MIDI-Note (Grundton je Part, Tonart, Oktav-Regler). */
export function degreeToMidi(part: Part, degree: number, t: Tonality, octave: number): number {
  const { octave: o, semis } = scaleStep(degree, t.scale);
  return 12 * (PART_BASE[part] + octave + 1) + t.key + semis + 12 * o;
}

export function degreeName(degree: number, t: Tonality): string {
  return NOTE_NAMES[(t.key + scaleStep(degree, t.scale).semis) % 12]!;
}

/** Klingende Länge einer Note in Steps: bis zur nächsten Note, höchstens l und bis Taktende. */
export function effectiveLength(row: NoteRow, step: number): number {
  const n = row[step];
  if (!n) return 0;
  for (let k = 1; k < n.l && step + k < 16; k++) if (row[step + k]) return k;
  return Math.min(n.l, 16 - step);
}
```

`src/core/envelope.ts`:
```ts
/** Regler 0..1 → Zeit in Sekunden (quadratisch für feine kurze Werte). */
export const attackTime = (x: number): number => 0.002 + x * x * 1.5;
export const decayTime = (x: number): number => 0.02 + x * x * 1.8;
export const releaseTime = (x: number): number => 0.02 + x * x * 1.2;
```

`src/core/mix.ts`:
```ts
import { CHANNELS } from './constants.ts';
import type { ChannelId, MixChannel } from './types.ts';

/** Hörbar = nicht stumm und (kein Solo aktiv oder selbst Solo). */
export function audibleChannels(mix: Readonly<Record<ChannelId, MixChannel>>): Record<ChannelId, boolean> {
  const anySolo = CHANNELS.some((id) => mix[id].s);
  return Object.fromEntries(
    CHANNELS.map((id) => [id, !mix[id].m && (!anySolo || mix[id].s)]),
  ) as Record<ChannelId, boolean>;
}

/** Fader 0..1 → Verstärkung (0,8 ≙ 1,0). */
export const channelGain = (ch: MixChannel, audible: boolean): number =>
  audible ? ch.v * ch.v * 1.5625 : 0;
export const channelPan = (ch: MixChannel): number => (ch.p - 0.5) * 2;
export const masterGain = (v: number): number => Math.pow(v, 1.5);
```

```bash
[n] npx vitest run src/core/music.test.ts
```
Expected: alle PASS.

- [ ] **Step 3: Eigenschaftstests gegen Legacy** – `tests/reference/core-music.test.ts`

```ts
import fc from 'fast-check';
import { afterAll, describe, expect, it } from 'vitest';
import { CHANNELS } from '../../src/core/constants.ts';
import { attackTime, decayTime, releaseTime } from '../../src/core/envelope.ts';
import { audibleChannels, masterGain } from '../../src/core/mix.ts';
import { degreeName, degreeToMidi, effectiveLength } from '../../src/core/music.ts';
import type { ChannelId, MixChannel, NoteRow } from '../../src/core/types.ts';
import { loadLegacy } from './legacy/harness.ts';

const page = loadLegacy();
const L = page.t;
const OPTS = { numRuns: 300, seed: 808 };

describe('core Musik- und Mixer-Logik = Legacy', () => {
  afterAll(() => {
    page.close();
  });

  it('degreeToMidi und degreeName', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('BA', 'LD' as const), fc.integer({ min: -30, max: 30 }),
        fc.integer({ min: 0, max: 11 }), fc.integer({ min: 0, max: 5 }), fc.integer({ min: -2, max: 2 }),
        (part, d, key, scale, oct) => {
          L.state.key = key;
          L.state.scale = scale;
          L.state.synth[part].oct = oct;
          expect(degreeToMidi(part, d, { key, scale }, oct)).toBe(L.degMidi(part, d));
          expect(degreeName(d, { key, scale })).toBe(L.degName(d));
        },
      ),
      OPTS,
    );
  });

  it('effectiveLength', () => {
    const note = fc.option(fc.record({ d: fc.integer({ min: 0, max: 11 }), l: fc.integer({ min: 1, max: 16 }) }), { freq: 2 });
    fc.assert(
      fc.property(fc.array(note, { minLength: 16, maxLength: 16 }), fc.integer({ min: 0, max: 15 }), (row, s) => {
        expect(effectiveLength(row as NoteRow, s)).toBe(L.effLen(row, s));
      }),
      OPTS,
    );
  });

  it('Hüllkurven-Zeiten und Master-Kurve', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1, noNaN: true }), (x) => {
        expect([attackTime(x), decayTime(x), releaseTime(x), masterGain(x)]).toEqual([L.tA(x), L.tD(x), L.tR(x), L.mastGain(x)]);
      }),
      OPTS,
    );
  });

  it('Hörbarkeit aus Mute/Solo', () => {
    const ch = fc.record({ m: fc.boolean(), s: fc.boolean() });
    fc.assert(
      fc.property(fc.array(ch, { minLength: 13, maxLength: 13 }), (flags) => {
        const mix = {} as Record<ChannelId, MixChannel>;
        CHANNELS.forEach((id, i) => {
          mix[id] = { v: 0.8, p: 0.5, r: 0, ...flags[i]! };
          Object.assign(L.state.mix[id]!, flags[i]);
        });
        L.calcAud();
        expect(audibleChannels(mix)).toEqual({ ...L.aud });
      }),
      OPTS,
    );
  });
});
```

```bash
[n] npx vitest run --project reference tests/reference/core-music.test.ts
```
Expected: 4 PASS.

- [ ] **Step 4: Commit**

```bash
[n] npm run format && npm run lint && npm run typecheck && git add -A && git commit -m "core: Musiktheorie, Hüllkurven-Zeiten und Mixer-Logik

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Pattern-Bearbeitung und Undo

**Files:**
- Create: `src/core/pattern.ts`, `src/core/undo.ts`, `src/core/pattern.test.ts`
- Create: `tests/reference/core-pattern.test.ts`

**Interfaces:**
- Consumes: `blankPattern`, `emptyRow`, `effectiveLength`, `applyPreset`, Typen.
- Produces:
  - `currentPattern(state: State): Pattern`
  - `replacePattern(state: State, slot: Slot, pattern: Pattern): State`
  - `subStepsOf(pattern: Pattern, key: SubKey, step: number): StepRow | null`
  - `toggleDrumStep(state: State, voice: VoiceId, step: number): State`
  - `toggleSampleStep(state: State, pad: number, step: number): State`
  - `setSubSteps(state: State, key: SubKey, step: number, row: StepRow): State`
  - `toggleSubStep(state: State, key: SubKey, step: number, k: number): State`
  - `SUB_PATTERNS: Record<'roll' | 'half' | 'quarter' | 'clear', () => StepRow>`
  - `placeNote(state: State, degree: number, step: number): State`
  - `clearPattern(state: State): State`, `clearTrack(state: State): State`
  - `selectSlot(state: State, slot: Slot): State`
  - `copyPattern(state: State): Pattern`, `pastePattern(state: State, clip: Pattern): State`
  - `patternHasContent(p: Pattern): boolean`
  - `interface Snapshot { pat: Pattern; cur: Slot; tempo: number; swing: number; preset: string | null }`, `snapshot(state): Snapshot`, `restoreSnapshot(state, snap): State`

- [ ] **Step 1: Failing Unit-Tests** – `src/core/pattern.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { baseState } from './defaults.ts';
import {
  clearPattern, clearTrack, copyPattern, pastePattern, patternHasContent, placeNote,
  selectSlot, setSubSteps, SUB_PATTERNS, subStepsOf, toggleDrumStep, toggleSampleStep, toggleSubStep,
} from './pattern.ts';
import { deepFreeze } from './test-utils.ts';
import type { State } from './types.ts';
import { restoreSnapshot, snapshot } from './undo.ts';

const fresh = (): State => deepFreeze(baseState());
const roll = () => SUB_PATTERNS.roll();

describe('Drum-Steps', () => {
  it('schaltet einen Step um, setzt das Preset zurück und teilt Unverändertes', () => {
    const s0 = deepFreeze({ ...baseState(), preset: 'House' });
    const s = toggleDrumStep(s0, 'SD', 4);
    expect(s.patterns.A.SD[4]).toBe(1);
    expect(s.preset).toBeNull();
    expect(s.patterns.A.BD).toBe(s0.patterns.A.BD);
    expect(s.patterns.B).toBe(s0.patterns.B);
    expect(toggleDrumStep(s, 'SD', 4).patterns.A.SD[4]).toBe(0);
  });
  it('löscht vorhandene Sub-Steps statt umzuschalten und lässt das Preset stehen', () => {
    const s0 = deepFreeze({ ...setSubSteps(fresh(), 'BD', 2, roll()), preset: 'Trap' });
    const s = toggleDrumStep(s0, 'BD', 2);
    expect(subStepsOf(s.patterns.A, 'BD', 2)).toBeNull();
    expect(s.patterns.A.sub).toEqual({});
    expect(s.patterns.A.BD[2]).toBe(0);
    expect(s.preset).toBe('Trap');
  });
});

describe('Sampler-Steps', () => {
  it('schaltet um und löscht Pad-Sub-Steps', () => {
    const s = toggleSampleStep(fresh(), 3, 7);
    expect(s.patterns.A.smp[3]![7]).toBe(1);
    const withSub = deepFreeze(setSubSteps(s, 'P3', 7, roll()));
    const c = toggleSampleStep(withSub, 3, 7);
    expect(c.patterns.A.smp[3]![7]).toBe(0);
    expect(c.patterns.A.sub).toEqual({});
  });
});

describe('Sub-Steps', () => {
  it('setzen, umschalten, Leerzeile entfernt den Eintrag', () => {
    let s = toggleSubStep(fresh(), 'CH', 0, 3);
    expect(subStepsOf(s.patterns.A, 'CH', 0)?.[3]).toBe(1);
    s = toggleSubStep(deepFreeze(s), 'CH', 0, 3);
    expect(s.patterns.A.sub).toEqual({});
    s = setSubSteps(deepFreeze(setSubSteps(fresh(), 'CH', 1, roll())), 'CH', 5, roll());
    expect(Object.keys(s.patterns.A.sub.CH ?? {})).toEqual(['1', '5']);
    s = setSubSteps(deepFreeze(s), 'CH', 1, SUB_PATTERNS.clear());
    expect(Object.keys(s.patterns.A.sub.CH ?? {})).toEqual(['5']);
    expect(setSubSteps(fresh(), 'CH', 1, SUB_PATTERNS.clear()).patterns.A.sub).toEqual({});
  });
  it('Vorlagen Roll, ÷2, ÷4, Leeren', () => {
    expect(SUB_PATTERNS.roll().every((x) => x === 1)).toBe(true);
    expect(SUB_PATTERNS.half().filter(Boolean)).toHaveLength(8);
    expect(SUB_PATTERNS.quarter().filter(Boolean)).toHaveLength(4);
    expect(SUB_PATTERNS.clear().some(Boolean)).toBe(false);
  });
});

describe('Noten', () => {
  it('setzt eine Note mit aktueller Länge, Tippen auf klingende Note löscht sie', () => {
    const s0 = deepFreeze({ ...baseState(), part: 'LD' as const, noteLen: 4 as const });
    const s = placeNote(s0, 3, 2);
    expect(s.patterns.A.notes.LD[2]).toEqual({ d: 3, l: 4 });
    expect(placeNote(deepFreeze(s), 3, 4).patterns.A.notes.LD[2]).toBeNull();
    expect(placeNote(deepFreeze(s), 5, 4).patterns.A.notes.LD[4]).toEqual({ d: 5, l: 4 });
    expect(placeNote(deepFreeze(s), 3, 6).patterns.A.notes.LD[6]).toEqual({ d: 3, l: 4 });
  });
});

describe('Pattern als Ganzes', () => {
  it('leeren, Spur leeren, Slot wählen', () => {
    let s = toggleDrumStep(fresh(), 'BD', 0);
    s = setSubSteps(deepFreeze(s), 'BD', 4, roll());
    s = toggleDrumStep(deepFreeze(s), 'SD', 1);
    const t = clearTrack(deepFreeze({ ...s, sel: 0, preset: 'House' }));
    expect(t.patterns.A.BD.some(Boolean)).toBe(false);
    expect(t.patterns.A.SD[1]).toBe(1);
    expect(t.patterns.A.sub).toEqual({});
    expect(t.preset).toBeNull();
    expect(patternHasContent(clearPattern(deepFreeze(s)).patterns.A)).toBe(false);
    expect(selectSlot(deepFreeze({ ...s, preset: 'House' }), 'C')).toMatchObject({ cur: 'C', preset: null });
  });
  it('kopieren und einfügen ergibt eine unabhängige Kopie', () => {
    const s = deepFreeze(toggleDrumStep(fresh(), 'CY', 9));
    const clip = copyPattern(s);
    const pasted = pastePattern(deepFreeze(selectSlot(s, 'D')), clip);
    expect(pasted.patterns.D).toEqual(s.patterns.A);
    expect(pasted.patterns.D).not.toBe(clip);
  });
  it('erkennt Inhalt in Drums, Noten, Sampler und Sub-Steps', () => {
    const b = fresh();
    expect(patternHasContent(b.patterns.A)).toBe(false);
    expect(patternHasContent(toggleSampleStep(b, 0, 0).patterns.A)).toBe(true);
    expect(patternHasContent(placeNote(b, 0, 0).patterns.A)).toBe(true);
    expect(patternHasContent(setSubSteps(b, 'P0', 0, roll()).patterns.A)).toBe(true);
  });
});

describe('Undo', () => {
  it('stellt Pattern, Slot, Tempo, Swing und Preset wieder her', () => {
    const s0 = deepFreeze({ ...toggleDrumStep(fresh(), 'BD', 0), tempo: 100, preset: 'House' });
    const snap = snapshot(s0);
    const changed = deepFreeze({ ...clearPattern(s0), tempo: 140, swing: 0.9, cur: 'B' as const });
    const back = restoreSnapshot(changed, snap);
    expect(back.cur).toBe('A');
    expect(back.patterns.A).toEqual(s0.patterns.A);
    expect([back.tempo, back.swing, back.preset]).toEqual([100, s0.swing, 'House']);
  });
});
```

```bash
[n] npx vitest run src/core/pattern.test.ts
```
Expected: FAIL, Module nicht gefunden.

- [ ] **Step 2: `src/core/pattern.ts`**

```ts
import { PARTS, VOICE_IDS } from './constants.ts';
import { blankPattern, emptyRow } from './defaults.ts';
import { effectiveLength } from './music.ts';
import type { Bit, NoteRow, Pattern, Slot, State, StepRow, SubKey, SubMap, VoiceId } from './types.ts';

export const currentPattern = (state: State): Pattern => state.patterns[state.cur];

export function replacePattern(state: State, slot: Slot, pattern: Pattern): State {
  const patterns = { ...state.patterns };
  patterns[slot] = pattern;
  return { ...state, patterns };
}

const updateCurrent = (state: State, fn: (p: Pattern) => Pattern): State =>
  replacePattern(state, state.cur, fn(currentPattern(state)));

const setBit = (row: StepRow, i: number, b: Bit): StepRow => row.map((x, k) => (k === i ? b : x));

function withRow(p: Pattern, voice: VoiceId, row: StepRow): Pattern {
  const next = { ...p };
  next[voice] = row;
  return next;
}

function withSampleRow(p: Pattern, pad: number, row: StepRow): Pattern {
  return { ...p, smp: p.smp.map((r, i) => (i === pad ? row : r)) };
}

export const subStepsOf = (p: Pattern, key: SubKey, step: number): StepRow | null =>
  p.sub[key]?.[step] ?? null;

function withSub(p: Pattern, key: SubKey, step: number, row: StepRow | null): Pattern {
  const steps = Object.fromEntries(
    Object.entries(p.sub[key] ?? {}).filter(([k]) => Number(k) !== step),
  ) as Partial<Record<number, StepRow>>;
  if (row) steps[step] = row;
  const sub = Object.fromEntries(Object.entries(p.sub).filter(([k]) => k !== key)) as SubMap;
  if (Object.keys(steps).length) sub[key] = steps;
  return { ...p, sub };
}

/** Drum-Step umschalten. Vorhandene Sub-Steps werden stattdessen gelöscht (Step aus). */
export function toggleDrumStep(state: State, voice: VoiceId, step: number): State {
  const p = currentPattern(state);
  if (subStepsOf(p, voice, step)) {
    return updateCurrent(state, (q) => withRow(withSub(q, voice, step, null), voice, setBit(q[voice], step, 0)));
  }
  const next = updateCurrent(state, (q) => withRow(q, voice, setBit(q[voice], step, q[voice][step] ? 0 : 1)));
  return state.preset ? { ...next, preset: null } : next;
}

/** Sampler-Step umschalten (Preset bleibt, wie in Legacy). */
export function toggleSampleStep(state: State, pad: number, step: number): State {
  const key = `P${pad}` as SubKey;
  return updateCurrent(state, (q) => {
    const row = q.smp[pad]!;
    if (subStepsOf(q, key, step)) return withSampleRow(withSub(q, key, step, null), pad, setBit(row, step, 0));
    return withSampleRow(q, pad, setBit(row, step, row[step] ? 0 : 1));
  });
}

/** Sub-Steps eines Steps setzen; eine leere Reihe entfernt den Eintrag. */
export function setSubSteps(state: State, key: SubKey, step: number, row: StepRow): State {
  return updateCurrent(state, (q) => withSub(q, key, step, row.some(Boolean) ? [...row] : null));
}

export function toggleSubStep(state: State, key: SubKey, step: number, k: number): State {
  const cur = subStepsOf(currentPattern(state), key, step) ?? emptyRow();
  return setSubSteps(state, key, step, setBit(cur, k, cur[k] ? 0 : 1));
}

const rowOf = (fn: (k: number) => boolean): StepRow => Array.from({ length: 16 }, (_, k) => (fn(k) ? 1 : 0));
export const SUB_PATTERNS = {
  roll: () => rowOf(() => true),
  half: () => rowOf((k) => k % 2 === 0),
  quarter: () => rowOf((k) => k % 4 === 0),
  clear: () => rowOf(() => false),
} as const satisfies Record<string, () => StepRow>;

/** Note setzen; Tippen in eine klingende Note derselben Stufe löscht sie. */
export function placeNote(state: State, degree: number, step: number): State {
  const part = state.part;
  const row = currentPattern(state).notes[part];
  let hit = -1;
  for (let a = 0; a <= step; a++) {
    const n = row[a];
    if (n && n.d === degree && a + effectiveLength(row, a) > step) hit = a;
  }
  const next: NoteRow = row.slice();
  if (hit >= 0) next[hit] = null;
  else next[step] = { d: degree, l: state.noteLen };
  return updateCurrent(state, (q) => {
    const notes = { ...q.notes };
    notes[part] = next;
    return { ...q, notes };
  });
}

export const clearPattern = (state: State): State => ({
  ...replacePattern(state, state.cur, blankPattern()),
  preset: null,
});

/** Spur der gewählten Drum-Stimme (state.sel) samt Sub-Steps leeren. */
export function clearTrack(state: State): State {
  const voice = VOICE_IDS[state.sel]!;
  const next = updateCurrent(state, (q) => {
    const sub = Object.fromEntries(Object.entries(q.sub).filter(([k]) => k !== voice)) as SubMap;
    return { ...withRow(q, voice, emptyRow()), sub };
  });
  return { ...next, preset: null };
}

export const selectSlot = (state: State, slot: Slot): State => ({ ...state, cur: slot, preset: null });

export const copyPattern = (state: State): Pattern => structuredClone(currentPattern(state));

export const pastePattern = (state: State, clip: Pattern): State => ({
  ...replacePattern(state, state.cur, structuredClone(clip)),
  preset: null,
});

export function patternHasContent(p: Pattern): boolean {
  return (
    VOICE_IDS.some((id) => p[id].some(Boolean)) ||
    PARTS.some((id) => p.notes[id].some(Boolean)) ||
    p.smp.some((r) => r.some(Boolean)) ||
    Object.keys(p.sub).length > 0
  );
}
```

`src/core/undo.ts`:
```ts
import { replacePattern } from './pattern.ts';
import type { Pattern, Slot, State } from './types.ts';

/** Ein Schritt Undo (wie Legacy): aktuelles Pattern, Slot, Tempo, Swing, Preset. */
export interface Snapshot {
  pat: Pattern;
  cur: Slot;
  tempo: number;
  swing: number;
  preset: string | null;
}

export const snapshot = (s: State): Snapshot =>
  structuredClone({ pat: s.patterns[s.cur], cur: s.cur, tempo: s.tempo, swing: s.swing, preset: s.preset });

export const restoreSnapshot = (s: State, u: Snapshot): State => ({
  ...replacePattern(s, u.cur, structuredClone(u.pat)),
  cur: u.cur,
  tempo: u.tempo,
  swing: u.swing,
  preset: u.preset,
});
```

```bash
[n] npx vitest run src/core/pattern.test.ts
```
Expected: alle PASS.

- [ ] **Step 3: Modelltest gegen Legacy** – `tests/reference/core-pattern.test.ts`

```ts
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { PRESETS, VOICE_IDS } from '../../src/core/constants.ts';
import { initialState } from '../../src/core/initial.ts';
import {
  clearPattern, clearTrack, copyPattern, pastePattern, placeNote, selectSlot, setSubSteps,
  SUB_PATTERNS, toggleDrumStep, toggleSampleStep, toggleSubStep,
} from '../../src/core/pattern.ts';
import { serialize } from '../../src/core/persist.ts';
import { applyPreset } from '../../src/core/presets.ts';
import type { Part, Pattern, Slot, State, SubKey } from '../../src/core/types.ts';
import { restoreSnapshot, snapshot, type Snapshot } from '../../src/core/undo.ts';
import { loadLegacy, type LegacyPage } from './legacy/harness.ts';

type Op =
  | { k: 'toggle'; v: number; s: number }
  | { k: 'smp'; pad: number; s: number }
  | { k: 'note'; part: Part; len: 1 | 2 | 4; d: number; s: number }
  | { k: 'sub'; key: SubKey; s: number; i: number }
  | { k: 'subPreset'; key: SubKey; s: number; kind: keyof typeof SUB_PATTERNS }
  | { k: 'clearTrack'; v: number }
  | { k: 'clearAll' }
  | { k: 'preset'; i: number }
  | { k: 'slot'; slot: Slot }
  | { k: 'copy' }
  | { k: 'paste' }
  | { k: 'undo' };

const step = fc.integer({ min: 0, max: 15 });
const subKey = fc.constantFrom<SubKey>('BD', 'CH', 'P0', 'P3');
const opArb: fc.Arbitrary<Op> = fc.oneof(
  { weight: 4, arbitrary: fc.record({ k: fc.constant('toggle' as const), v: fc.integer({ min: 0, max: 9 }), s: step }) },
  { weight: 2, arbitrary: fc.record({ k: fc.constant('smp' as const), pad: fc.integer({ min: 0, max: 7 }), s: step }) },
  { weight: 3, arbitrary: fc.record({ k: fc.constant('note' as const), part: fc.constantFrom<Part>('BA', 'LD'), len: fc.constantFrom<1 | 2 | 4>(1, 2, 4), d: fc.integer({ min: 0, max: 11 }), s: step }) },
  { weight: 2, arbitrary: fc.record({ k: fc.constant('sub' as const), key: subKey, s: step, i: step }) },
  { weight: 1, arbitrary: fc.record({ k: fc.constant('subPreset' as const), key: subKey, s: step, kind: fc.constantFrom('roll', 'half', 'quarter', 'clear' as const) }) },
  { weight: 1, arbitrary: fc.record({ k: fc.constant('clearTrack' as const), v: fc.integer({ min: 0, max: 9 }) }) },
  { weight: 1, arbitrary: fc.constant({ k: 'clearAll' as const }) },
  { weight: 1, arbitrary: fc.record({ k: fc.constant('preset' as const), i: fc.integer({ min: 0, max: 3 }) }) },
  { weight: 1, arbitrary: fc.record({ k: fc.constant('slot' as const), slot: fc.constantFrom<Slot>('A', 'B', 'C') }) },
  { weight: 1, arbitrary: fc.constant({ k: 'copy' as const }) },
  { weight: 1, arbitrary: fc.constant({ k: 'paste' as const }) },
  { weight: 1, arbitrary: fc.constant({ k: 'undo' as const }) },
);

interface Model {
  state: State;
  undo: Snapshot | null;
  clip: Pattern | null;
}

function applyCore(m: Model, op: Op): Model {
  const s = m.state;
  switch (op.k) {
    case 'toggle': return { ...m, state: toggleDrumStep(s, VOICE_IDS[op.v]!, op.s) };
    case 'smp': return { ...m, state: toggleSampleStep({ ...s, smp: { ...s.smp, sel: op.pad } }, op.pad, op.s) };
    case 'note': return { ...m, state: placeNote({ ...s, part: op.part, noteLen: op.len }, op.d, op.s) };
    case 'sub': return { ...m, state: toggleSubStep(s, op.key, op.s, op.i) };
    case 'subPreset': return { ...m, undo: snapshot(s), state: setSubSteps(s, op.key, op.s, SUB_PATTERNS[op.kind]()) };
    case 'clearTrack': { const t = { ...s, sel: op.v }; return { ...m, undo: snapshot(t), state: clearTrack(t) }; }
    case 'clearAll': return { ...m, undo: snapshot(s), state: clearPattern(s) };
    case 'preset': return { ...m, undo: snapshot(s), state: applyPreset(s, PRESETS[op.i]!) };
    case 'slot': return { ...m, state: selectSlot(s, op.slot) };
    case 'copy': return { ...m, clip: copyPattern(s) };
    case 'paste': return m.clip ? { ...m, undo: snapshot(s), state: pastePattern(s, m.clip) } : m;
    case 'undo': return m.undo ? { ...m, undo: null, state: restoreSnapshot(s, m.undo) } : m;
  }
}

function applyLegacy(p: LegacyPage, op: Op): void {
  const t = p.t;
  switch (op.k) {
    case 'toggle': t.toggle(op.v, op.s); break;
    case 'smp': {
      t.state.smp.sel = op.pad;
      const btn = p.window.document.querySelectorAll<HTMLButtonElement>('#smpSteps .ss')[op.s];
      if (!btn) throw new Error('Sampler-Step-Button fehlt');
      btn.click();
      break;
    }
    case 'note': t.state.part = op.part; t.state.noteLen = op.len; t.placeNote(op.d, op.s); break;
    case 'sub': t.toggleSub(op.key, op.s, op.i); break;
    case 'subPreset': t.snap(); t.setSub(op.key, op.s, SUB_PATTERNS[op.kind]()); break;
    case 'clearTrack': t.state.sel = op.v; t.clearTrack(); break;
    case 'clearAll': t.clearAll(); break;
    case 'preset': t.snap(); t.loadPreset(t.PRESETS[op.i]); break;
    case 'slot': t.viewPattern(op.slot); break;
    case 'copy': t.copyPattern(); break;
    case 'paste': t.pastePattern(); break;
    case 'undo': t.undoLast(); break;
  }
}

const plain = (v: unknown): unknown => JSON.parse(JSON.stringify(v));

describe('core Pattern-Bearbeitung = Legacy (Modelltest)', () => {
  it('beliebige Bearbeitungsfolgen führen zum selben Zustand', () => {
    fc.assert(
      fc.property(fc.array(opArb, { minLength: 1, maxLength: 30 }), (ops) => {
        const page = loadLegacy();
        try {
          let m: Model = { state: initialState(), undo: null, clip: null };
          for (const [i, op] of ops.entries()) {
            m = applyCore(m, op);
            applyLegacy(page, op);
            expect(plain(serialize(m.state)), `nach Schritt ${i}: ${JSON.stringify(op)}`).toEqual(plain(page.t.serial()));
          }
          expect(page.errors).toEqual([]);
        } finally {
          page.close();
        }
      }),
      { numRuns: 50, seed: 808 },
    );
  });
});
```

```bash
[n] npx vitest run --project reference tests/reference/core-pattern.test.ts
```
Expected: PASS. Bei einem Gegenbeispiel: kleinste Folge lesen, Abweichung in `pattern.ts`/`undo.ts` gegen Legacy beheben, als Unit-Test in `pattern.test.ts` festhalten.

- [ ] **Step 4: Commit**

```bash
[n] npm run format && npm run lint && npm run typecheck && git add -A && git commit -m "core: Pattern-Bearbeitung und Undo, Modelltest gegen Legacy

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Song-Kette und Timing

**Files:**
- Create: `src/core/song.ts`, `src/core/timing.ts`, `src/core/song.test.ts`
- Modify: `tests/reference/legacy/scenarios.ts` (Szenario `songSequence`)
- Create: `tests/reference/core-song.test.ts`

**Interfaces:**
- Produces:
  - `SONG_MAX = 32`, `appendToSong(state)`, `bumpRepeat(state, index, delta)`, `moveEntry(state, index, delta)`, `removeEntry(state, index)`, `clearSong(state)` – alle `State → State`
  - `interface SongCursor { first: boolean; index: number; repeat: number }`, `songStart(): SongCursor`
  - `nextBar(cursor: SongCursor, s: Pick<State, 'mode' | 'song' | 'cur'>): { cursor: SongCursor; slot: Slot; fromSong: boolean }`
  - `stepDuration(tempo: number): number`, `swingDelay(step: number, swing: number, d: number): number`, `subStepOffset(k: number, d: number): number`
  - Szenario `songSequence(args)` → Liste `{ step, time, slot, song, si }`

- [ ] **Step 1: Failing Unit-Tests** – `src/core/song.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { baseState } from './defaults.ts';
import {
  appendToSong, bumpRepeat, clearSong, moveEntry, nextBar, removeEntry, SONG_MAX, songStart,
  type SongCursor,
} from './song.ts';
import { deepFreeze } from './test-utils.ts';
import { stepDuration, subStepOffset, swingDelay } from './timing.ts';
import type { SongEntry, State } from './types.ts';

const withSong = (song: SongEntry[], extra: Partial<State> = {}): State =>
  deepFreeze({ ...baseState(), song, ...extra });

describe('Song bearbeiten', () => {
  it('hängt das aktuelle Pattern an, höchstens 32 Einträge', () => {
    expect(appendToSong(withSong([], { cur: 'C' })).song).toEqual([{ p: 'C', n: 1 }]);
    const full = withSong(new Array(SONG_MAX).fill({ p: 'A', n: 1 }));
    expect(appendToSong(full)).toBe(full);
  });
  it('Wiederholungen 1…16, verschieben, entfernen, leeren', () => {
    const s = withSong([{ p: 'A', n: 1 }, { p: 'B', n: 16 }]);
    expect(bumpRepeat(s, 0, -1).song[0]!.n).toBe(1);
    expect(bumpRepeat(s, 1, 1).song[1]!.n).toBe(16);
    expect(bumpRepeat(s, 0, 3).song[0]!.n).toBe(4);
    expect(bumpRepeat(s, 5, 1)).toBe(s);
    expect(moveEntry(s, 0, 1).song.map((e) => e.p)).toEqual(['B', 'A']);
    expect(moveEntry(s, 0, -1)).toBe(s);
    expect(moveEntry(s, 1, 1)).toBe(s);
    expect(removeEntry(s, 0).song).toEqual([{ p: 'B', n: 16 }]);
    expect(removeEntry(s, -1)).toBe(s);
    expect(clearSong(s).song).toEqual([]);
  });
});

describe('nextBar', () => {
  const run = (s: Pick<State, 'mode' | 'song' | 'cur'>, bars: number) => {
    let c: SongCursor = songStart();
    const out: string[] = [];
    for (let i = 0; i < bars; i++) {
      const r = nextBar(c, s);
      c = r.cursor;
      out.push(r.fromSong ? r.slot : `(${r.slot})`);
    }
    return out.join('');
  };
  it('spielt Einträge mit Wiederholungen und beginnt am Ende von vorn', () => {
    expect(run({ mode: 'song', cur: 'A', song: [{ p: 'A', n: 2 }, { p: 'C', n: 1 }] }, 7)).toBe('AACAACA');
  });
  it('Pattern-Modus oder leerer Song spielen das aktuelle Pattern', () => {
    expect(run({ mode: 'pattern', cur: 'B', song: [{ p: 'A', n: 1 }] }, 2)).toBe('(B)(B)');
    expect(run({ mode: 'song', cur: 'D', song: [] }, 2)).toBe('(D)(D)');
  });
  it('fängt einen hinter das Ende gerutschten Index ab', () => {
    const r = nextBar({ first: false, index: 5, repeat: 0 }, { mode: 'song', cur: 'A', song: [{ p: 'B', n: 1 }] });
    expect(r).toEqual({ cursor: { first: false, index: 0, repeat: 0 }, slot: 'B', fromSong: true });
  });
});

describe('Timing', () => {
  it('Step-Dauer, Swing auf ungeraden Steps, Sub-Step-Versatz', () => {
    expect(stepDuration(120)).toBe(0.125);
    expect(swingDelay(0, 0.5, 0.125)).toBe(0);
    expect(swingDelay(1, 0.5, 0.125)).toBeCloseTo(0.025);
    expect(subStepOffset(8, 0.125)).toBe(0.0625);
  });
});
```

```bash
[n] npx vitest run src/core/song.test.ts
```
Expected: FAIL, Module nicht gefunden.

- [ ] **Step 2: Implementierung**

`src/core/song.ts`:
```ts
import { clamp } from './persist.ts';
import type { Slot, State } from './types.ts';

export const SONG_MAX = 32;

export const appendToSong = (s: State): State =>
  s.song.length >= SONG_MAX ? s : { ...s, song: [...s.song, { p: s.cur, n: 1 }] };

export function bumpRepeat(s: State, index: number, delta: number): State {
  const e = s.song[index];
  if (!e) return s;
  return { ...s, song: s.song.map((x, i) => (i === index ? { ...x, n: clamp(x.n + delta, 1, 16) } : x)) };
}

/** Eintrag um delta verschieben; neue Auswahl ist index + delta. */
export function moveEntry(s: State, index: number, delta: number): State {
  const j = index + delta;
  if (index < 0 || index >= s.song.length || j < 0 || j >= s.song.length) return s;
  const song = s.song.slice();
  [song[index], song[j]] = [song[j]!, song[index]!];
  return { ...s, song };
}

/** Eintrag entfernen; neue Auswahl ist min(index, Länge − 1). */
export const removeEntry = (s: State, index: number): State =>
  index < 0 || index >= s.song.length ? s : { ...s, song: s.song.filter((_, i) => i !== index) };

export const clearSong = (s: State): State => ({ ...s, song: [] });

/** Position des Song-Modus beim Abspielen (Legacy songIdx/songRep/songFirst). */
export interface SongCursor {
  first: boolean;
  index: number;
  repeat: number;
}

export const songStart = (): SongCursor => ({ first: true, index: 0, repeat: 0 });

/** Zu Beginn jedes Takts: Welches Pattern spielt, und wie steht der Song-Cursor danach? */
export function nextBar(
  c: SongCursor,
  s: Pick<State, 'mode' | 'song' | 'cur'>,
): { cursor: SongCursor; slot: Slot; fromSong: boolean } {
  if (s.mode !== 'song' || !s.song.length) return { cursor: { ...c, first: true }, slot: s.cur, fromSong: false };
  let { index, repeat } = c;
  if (c.first) {
    index = 0;
    repeat = 0;
  } else {
    repeat++;
    if (index >= s.song.length || repeat >= s.song[index]!.n) {
      index = (index + 1) % s.song.length;
      repeat = 0;
    }
  }
  if (index >= s.song.length) index = 0;
  return { cursor: { first: false, index, repeat }, slot: s.song[index]!.p, fromSong: true };
}
```

`src/core/timing.ts`:
```ts
/** Dauer eines 16tel-Steps in Sekunden. */
export const stepDuration = (tempo: number): number => 60 / tempo / 4;
/** Swing verzögert jeden zweiten Step um bis zu 40 % eines Steps. */
export const swingDelay = (step: number, swing: number, d: number): number =>
  step % 2 === 1 ? swing * 0.4 * d : 0;
/** Versatz des k-ten von 16 Sub-Steps. */
export const subStepOffset = (k: number, d: number): number => (k * d) / 16;
```

```bash
[n] npx vitest run src/core/song.test.ts
```
Expected: alle PASS.

- [ ] **Step 3: Szenario für den Legacy-Scheduler** – in `tests/reference/legacy/scenarios.ts` vor `SCENARIOS` ergänzen und `songSequence` in `SCENARIOS` aufnehmen:

```ts
export interface SequenceArgs {
  song: { p: string; n: number }[];
  mode: 'song' | 'pattern';
  cur: string;
  tempo: number;
  swing: number;
  steps: number;
}

/** Zeichnet auf, was der Legacy-Scheduler je Step einplant (Slot, Zeit, Song-Position). */
export async function songSequence(
  args: SequenceArgs,
): Promise<{ step: number; time: number; slot: string; song: boolean; si: number }[]> {
  const p = loadLegacy({ audio: { seconds: 1 } });
  try {
    const { t } = p;
    isolate(t);
    t.state.song = args.song;
    t.state.mode = args.mode;
    t.state.cur = args.cur;
    t.state.pat = t.state.patterns[args.cur]!;
    t.state.tempo = args.tempo;
    t.state.swing = args.swing;
    if (!t.ensureAudio()) throw new Error('Audio-Kontext fehlt');
    t.begin();
    for (let now = 0; t.queue.length < args.steps; now += 0.025) {
      p.setNow(now);
      t.pump();
    }
    assertClean(p);
    return t.queue.slice(0, args.steps).map((q) => ({ ...q }));
  } finally {
    p.close();
  }
}
```

- [ ] **Step 4: Sequenzvergleich** – `tests/reference/core-song.test.ts`

```ts
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { nextBar, songStart } from '../../src/core/song.ts';
import { stepDuration, swingDelay } from '../../src/core/timing.ts';
import type { Slot, SongEntry } from '../../src/core/types.ts';
import type { SequenceArgs } from './legacy/scenarios.ts';
import { runLegacy } from './run.ts';

type Entry = { step: number; time: number; slot: string; song: boolean; si: number };

function coreSequence(a: SequenceArgs): Entry[] {
  const d = stepDuration(a.tempo);
  const s = { mode: a.mode, song: a.song as SongEntry[], cur: a.cur as Slot };
  let cursor = songStart();
  let slot: Slot = s.cur;
  let fromSong = false;
  let next = 0.08;
  const out: Entry[] = [];
  for (let i = 0; i < a.steps; i++) {
    const step = i % 16;
    if (step === 0) {
      const r = nextBar(cursor, s);
      ({ cursor, slot, fromSong } = r);
    }
    out.push({ step, time: next + swingDelay(step, a.swing, d), slot, song: fromSong, si: cursor.index });
    next += d;
  }
  return out;
}

const argsArb: fc.Arbitrary<SequenceArgs> = fc.record({
  song: fc.array(fc.record({ p: fc.constantFrom('A', 'B', 'C', 'H'), n: fc.integer({ min: 1, max: 4 }) }), { maxLength: 5 }),
  mode: fc.constantFrom('song', 'pattern'),
  cur: fc.constantFrom('A', 'D'),
  tempo: fc.integer({ min: 60, max: 200 }),
  swing: fc.double({ min: 0, max: 1, noNaN: true }),
  steps: fc.constant(16 * 12),
});

describe('core Song-Kette und Timing = Legacy-Scheduler', () => {
  const cases = [
    { song: [{ p: 'A', n: 3 }, { p: 'B', n: 1 }], mode: 'song', cur: 'A', tempo: 90, swing: 0.35, steps: 16 * 12 },
    { song: [], mode: 'song', cur: 'C', tempo: 120, swing: 0, steps: 16 * 3 },
    ...fc.sample(argsArb, { numRuns: 8, seed: 808 }),
  ] as SequenceArgs[];

  it.concurrent.for(cases)('Fall %#', async (args, { expect }) => {
    const legacy = await runLegacy<Entry[]>('songSequence', args);
    expect(coreSequence(args)).toEqual(legacy);
  });
});
```

```bash
[n] npx vitest run --project reference tests/reference/core-song.test.ts
```
Expected: 10 PASS (Zeiten bit-gleich, weil dieselben Gleitkomma-Operationen in derselben Reihenfolge laufen).

- [ ] **Step 5: Commit**

```bash
[n] npm run format && npm run lint && npm run typecheck && git add -A && git commit -m "core: Song-Kette und Timing, Sequenzvergleich gegen den Legacy-Scheduler

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Abdeckung, Doku, Abschluss

**Files:**
- Modify: `CLAUDE.md`, `README.md`

- [ ] **Step 1: Abdeckung prüfen**

```bash
[n] npm run test:unit 2>&1 | tail -25
```
Expected: PASS, jede Datei in `src/core` ≥ 90 % in allen vier Kennzahlen. Liegt eine Datei darunter: fehlende Zweige in der Coverage-Tabelle („Uncovered Line #s“) mit gezielten Unit-Tests abdecken – nicht die Schwelle senken.

- [ ] **Step 2: Gesamtlauf**

```bash
[n] npm run lint && npm run typecheck && npm test
```
Expected: alles grün.

- [ ] **Step 3: Doku aktualisieren** (veraltete Stellen aus dem Review von Schritt 1)

In `CLAUDE.md`:
- Kopfabsatz ersetzen durch: „Mobile Drum-Machine im Stil der TR-808. Quelltext in `src/` (TypeScript, Vite), der Build erzeugt eine **einzelne `dist/index.html`** ohne Laufzeit-Abhängigkeiten. Bis zur Umstellung (Fundament Schritt 6) ist `legacy/index.html` die ausgelieferte App. Hauptgerät des Besitzers ist ein **iPhone**. Alles muss dort performant und knackfrei laufen.“
- Unter „Architektur“ als ersten Punkt ergänzen: „Schichten: `src/core` (reine Logik, unveränderliche Funktionen, Datenmodell = Speicherformat) → `src/store` → `src/audio` / `src/ui` → `src/main.ts`. Die Schichtregel erzwingt ESLint. `core` ist gegen Legacy geprüft (`tests/reference/core-*.test.ts`).“
- In „Entwickeln und testen“ die Zeilen „Tests laden `index.html` in jsdom …“, „Die Audio-Bibliothek … (so macht es `tests/mix-test2.js`)“ und „Syntax schnell prüfen: Script aus `index.html` extrahieren …“ ersetzen durch: „Referenztests laden `legacy/index.html` in jsdom (`tests/reference/legacy/harness.ts`) und rendern Audio mit `node-web-audio-api` offline, je Szenario in einem eigenen Prozess.“ und „Neue Logik testgetrieben in `src/core/*.test.ts`; Abdeckung ≥ 90 % wird von `npm run test:unit` erzwungen.“
- Unter „Veröffentlichung“: „`dist/index.html` (nach `npm run build`) wird als Claude-Artifact veröffentlicht …“

In `README.md` den ersten Satz ersetzen durch: „Mobile Drum-Machine im Stil der TR-808. Gebaut für das iPhone, läuft in jedem modernen Browser. Der Build erzeugt eine einzelne, eigenständige HTML-Datei.“

- [ ] **Step 4: Commit**

```bash
[n] npm run lint && git add -A && git commit -m "Doku: Schichten, core und aktuelle Testwege

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 5: Abschlussbericht** (Checkpoint): Commits, Testzahlen, Abdeckung je Datei, Befunde (Abweichungen Legacy ↔ Spezifikation), Entscheidungen; nächster Schritt: Plan für Schritt 3 (`store`).
