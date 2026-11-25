# Etappe 10a: Chorus und Drive pro Part – Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Testgetrieben.

**Goal:** Bass und Lead bekommen Drive und Chorus, und die Synth-Presets nutzen beides.

**Architecture:** Zwei optionale Werte im `SynthPatch`. Im Graphen läuft jeder Part künftig `inp (Pegel 1) → [Effekte] → lvl → Kanal und Delay`; die Effektkette entsteht erst bei Bedarf. So hängt Drive nicht vom Level ab, und pro Note kommt kein Knoten dazu.

**Tech Stack:** TypeScript, Web Audio, Vitest, node-web-audio-api, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-25-etappe-10a-chorus-drive-design.md`

## Global Constraints

- Branch `etappe-10a-chorus-drive`, Version 0.28.0 (`package.json` und `APP_VERSION`).
- `drive?`, `chorus?` 0..1; bei 0 fehlt das Feld. Alte Stände bytegleich.
- `SYN_PRESETS`, `PRESETS` und die Referenz-Fingerabdrücke bleiben unverändert (`golden/` nicht neu erzeugen).
- Beide Effekte 0: kein Effektknoten. Kein zusätzlicher Knoten pro Note; `npm run bench` unverändert grün.
- Automation nur verankert (`rampFrom`). Abdeckung ≥ 90 % je Datei, Touch-Ziele ≥ 44 px, Design-Regeln aus CLAUDE.md.
- Chorus-Anteil unter 250 Hz bleibt mittig; Lautheit bei Maximum höchstens 3 dB vom trockenen Klang, Spitze im Mix ≤ 0,8.

## Review Focus

1. **Schnelles Aus-Ein:** Auf 0 drehen und sofort wieder auf: Das verzögerte Abbauen darf die neu benutzte Kette nicht entfernen (Test in Task 2).
2. **Preset ohne Effekt nach Preset mit Effekt:** Die alten Werte verschwinden, auch als Felder (Test in Task 1).
3. **Stumm, Solo und Level** wirken auch mit Effekten wie bisher, kein Nachklingen des Chorus (Test in Task 2: Gain liegt auf `lvl`, hinter den Effekten).
4. **Export und Bounce** eines Projekts mit Effekten klingen wie die Wiedergabe, Effekte ab dem ersten Sample (Test in Task 2: Aufbau mit `t === null`).
5. **Projekt öffnen oder Zurück** schaltet die Effekte auf die geladenen Werte um, auch auf „aus“ (Test in Task 2).

---

### Task 1: core – Werte, Speichern, Presets

**Files:** `src/core/types.ts`, `src/core/synth.ts`, `src/core/persist.ts`, `src/core/templates/sounds.ts`, `src/core/templates/apply.ts`; Tests `src/core/synth.test.ts`, `src/core/persist.test.ts`, `src/core/templates/templates.test.ts`

**Interfaces (Produces):**
- `type PartFxKey = 'drive' | 'chorus'`, `type PartFx = Partial<Record<PartFxKey, number>>`; `SynthPatch` erweitert `PartFx`.
- `setPartFx(s: State, part: Part, key: PartFxKey, v: number): State` – begrenzt auf 0..1, bei 0 Feld löschen, `preset: null`.
- `interface SynthSound { name: string; v: Readonly<SynthValues>; fx?: Readonly<PartFx> }`; `SYNTH_SOUNDS: Readonly<Record<Part, readonly SynthSound[]>>`.
- `applySynthPreset(s, part, sound: SynthSound): State` – setzt `drive`/`chorus` aus `sound.fx`, fehlende Werte werden gelöscht.
- `soundPatch` übernimmt `preset.fx`.

**Preset-Werte (drive / chorus):**

| Bass | | Lead | |
|---|---|---|---|
| Sub | .15 / – | Saw | .15 / .45 |
| Acid | .5 / – | Pulse | .2 / .3 |
| Pluck | .25 / .15 | Soft | – / .5 |
| 808 | .35 / – | Keys | .1 / .4 |
| Reese | .3 / .45 | Pad | – / .8 |
| Deep | .2 / .1 | Stab | .25 / .4 |
| Rubber | .3 / – | Bell | – / .35 |
| Mellow | .1 / .25 | Squelch | .4 / – |
| | | Flute | – / .25 |

- [ ] **Step 1: Tests**
  - `setPartFx`: 0,4 setzt Feld und `preset: null`; 0 löscht das Feld (`'drive' in patch === false`); 2 → 1.
  - `applySynthPreset`: nach „Reese“ gilt drive .3, chorus .45; danach „Sub“: drive .15, `'chorus' in patch === false`; `arp`/`lfo` bleiben.
  - `loadState`: übernimmt 0,5; verwirft `'x'`, `0`, `-1`; begrenzt 7 → 1; `saveState` eines alten Stands bytegleich.
  - Vorlagen: Die ersten drei Sounds je Part haben `v` gleich `SYN_PRESETS`; `fx` je Preset wie in der Tabelle; `soundPatch` trägt sie.
- [ ] **Step 2:** `npx vitest run src/core` → rot (fehlende Namen).
- [ ] **Step 3:** Umsetzen. Die `fx`-Werte hängen als eigene Zuordnung in `sounds.ts`, `SYN_PRESETS` bleibt unberührt.
- [ ] **Step 4:** `npx vitest run src/core && npm run typecheck` → grün.
- [ ] **Step 5:** Commit `core: Drive und Chorus je Part, Presets nutzen sie`.

### Task 2: audio – Effektkette

**Files:** neu `src/audio/partfx.ts` (+ Test), `src/audio/graph.ts`, `src/audio/engine.ts`, Tests `graph.test.ts`/`engine.test.ts`; `tests/reference/next/scenarios.ts`, neu `tests/reference/next-partfx.test.ts`

**Interfaces:**
- Consumes: `PartFx` aus Task 1.
- Produces: `createPartFx(ctx: BaseAudioContext, input: AudioNode, output: AudioNode): PartFxChain` mit `set(fx: PartFx, t: number | null): void`, `readonly idle: boolean`, `dispose(): void` (stellt `input → output` wieder her).
- Graph: `parts[id] = { inp, lvl, snd }`; `setPartFx(part: Part, fx: PartFx, t: number | null): boolean` (true = Kette ist stumm und kann weg), `releasePartFx(part: Part): void` (baut nur ab, wenn noch `idle`).
- Engine: Effekt je Part auf `drive`/`chorus`; beim Aufbau mit `t === null`; Abbau 100 ms nach „idle“ über den Engine-Zeitgeber.
- Aufbau: Drive = Vorverstärkung → feste tanh-Kennlinie (Oversampling 2x) → Pegelausgleich, überblendet mit dem trockenen Weg. Chorus = Hochpass 250 Hz → zwei modulierte Verzögerungen, links und rechts → Anteil; der trockene Weg bleibt voll. Die LFOs laufen nur, solange die Kette existiert und Chorus > 0 ist.

- [ ] **Step 1: Unit-Tests** (Test-Kontext wie in `graph.test.ts`)
  - Ohne Effekte erzeugt `createGraph` keinen WaveShaper und keinen zusätzlichen Delay-Knoten je Part.
  - `syncSynth` setzt den Pegel auf `parts.BA.lvl.gain`; `parts.BA.inp.gain` bleibt 1.
  - `setPartFx(…, {}, t)` nach Effekten liefert true; erneutes Einschalten vor `releasePartFx` → Kette bleibt.
  - `dispose` stoppt die Chorus-LFOs.
  - Engine: Preset mit Effekt laden und Zurück → `setPartFx` mit den jeweiligen Werten; Start mit gespeicherten Effekten nutzt `t === null`.
- [ ] **Step 2: Referenz-Szenario `partFx`** (Parameter `part`, `drive`, `chorus`; eine lange Note; Messwerte `peak`, `rmsDb`, `sideRatio` = RMS(L−R)/RMS(L+R), `lowSideRatio` dasselbe unter 150 Hz, `brightness` = spektraler Schwerpunkt) und Tests:
  - beide 0: `sideRatio < 0.001`
  - Drive 1: `brightness` > trocken × 1,2; `|rmsDb − trocken| ≤ 3`; `peak ≤ 0.8`
  - Chorus 1: `sideRatio > 0.15`; `lowSideRatio < 0.1`; Mono-RMS höchstens 3 dB unter trocken
  - beide 1, Demo-Mix: `peak ≤ 0.8`
- [ ] **Step 3:** `npx vitest run src/audio tests/reference/next-partfx.test.ts` → rot.
- [ ] **Step 4:** Umsetzen.
- [ ] **Step 5:** `npm run test:unit && npm run test:ref && npm run bench` → grün, ohne neue Golden-Dateien.
- [ ] **Step 6:** Commit `audio: Drive und Chorus je Part`.

### Task 3: UI, E2E, Doku

**Files:** `src/ui/panels/synth/modules.ts`, `modules.css`, `synth.test.ts`, `tests/e2e/synth.spec.ts`, `tests/e2e/build.spec.ts` (nur falls das Budget reißt), `package.json`, `src/core/constants.ts`, `README.md`, `CLAUDE.md`, `docs/superpowers/specs/2026-10-14-ui-funktionsliste.md`

**Interfaces:** Consumes `setPartFx`.

- [ ] **Step 1: Tests**
  - Modul „Effekt“ hat die Slider-Rollen „Drive“ und „Chorus“; Tastatur setzt den Wert des gewählten Parts; Doppeltipp → Feld fehlt; LCD zeigt `%`; Partwechsel zeigt die Werte des anderen Parts; Preset-Tipp bewegt die Knobs.
  - E2E: Drive am Bass setzen, neu laden, Wert bleibt; Preset „Reese“ setzt Chorus; Touch-Ziele, kein horizontaler Scroll, axe.
- [ ] **Step 2:** rot sehen, umsetzen, grün.
- [ ] **Step 3:** Sichtprüfung 390 × 844 und Desktop; Screenshots nur bei gewollter Abweichung neu.
- [ ] **Step 4:** Version 0.28.0, Doku. Volle Suite: `npm run lint && npm run typecheck && npm run test:unit && npm run test:ref && npm run bench && npm run build && npx playwright test` → grün.
- [ ] **Step 5:** Commit `ui: Effekt-Modul; Doku und Version 0.28.0`.
