# Schritt 5c: Sampler in der neuen Oberfläche – Implementierungsplan (kompakt)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Die Aufgaben sind testgetrieben umzusetzen (Test zuerst, rot sehen, dann Code). Der Plan ist bewusst kompakt: Schnittstellen und Verhalten sind festgelegt, der Code folgt den Mustern aus 5a/5b.

**Goal:** Der Sampler der alten App kommt als zweites Gerät in die neue Oberfläche, mit allen Zeilen aus dem Abschnitt „Sampler (5c)“ der Funktionsliste.

**Architecture:**
- **Reine Logik:** `core/sampler.ts` (Pad wählen, Werte, Bereich mit Griff-Logik, Rückwärts, Pad zurücksetzen/leeren, Wellenform-Spalten).
- **Pad-Samples:** liegen in der `SampleBank` (`store/samples.ts`, Speicher `pocket808.smp.v1`, Schlüssel `"0"`–`"7"`).
- **Aufnahme:** `platform/recorder.ts` kapselt MediaRecorder.
- **Oberfläche:** `ui/panels/sampler/` (Pads, Werkzeuge mit Meldungen, Wellenform, Regler, Steps mit Sub-Editor, Gerät).
- **Verdrahtung:** `main.ts` gibt Pad-Samples an die Engine (`setPadSample`) und stellt `auditionPad` und den Rekorder bereit.

**Spec:** `docs/superpowers/specs/2026-10-14-ui-layouts-design.md` (5c) und die Funktionsliste. Verhaltensreferenz ist `legacy/index.html`, die Funktionen `buildSmp`, `renderSmp`, `drawWave`, `selPad`, `setSample`, `decodeInto`, `clearSample`, `recToggle`, `recFallback`, `paintSmpSteps`, `smpNote` und `renderSum`.

## Global Constraints

Wie in 5a/5b:
- Deutsch, Branch `ui-5c`, Commits über `bash $D/commit.sh`.
- Schichtregel, `must()`, keine toten Zweige, Abdeckung ≥ 90 % pro Datei.
- Touch-Ziele ≥ 44 px (E2E-Wächter).
- Design-Regeln: keine neuen Farben; Wellenform in `--acc`, Marken in `--cream`, Abdunklung `rgba(8,8,11,.78)` wie Legacy.
- README und Funktionsliste pflegen.
- Am Ende Review, Merge nach `main`, Push.

Verhalten wie Legacy:
- **Pad antippen:** wählt das Pad und hört es vor (nur wenn es ein Sample hat).
- **Laden / Aufnahme:**
  - Ein Sample setzt Start/Ende auf 0/1 und den Namen, wird gespeichert und vorgehört.
  - Meldungen: „Pad n geladen“ bzw. „Datei nicht lesbar“.
  - Eine Aufnahme heißt „Aufnahme“, läuft höchstens `SMP_MAX` Sekunden und zeigt die Meldung „Aufnahme läuft · max. 3 s“ dauerhaft. Ohne Mikrofon oder bei Sperre gibt es eine Meldung und den Rückfall auf die Dateiauswahl mit `capture`.
- **Leeren:** Name leer, Start/Ende 0/1, Rückwärts aus, Speicher-Eintrag `{ d: "" }`.
- **Rev:** schaltet Rückwärts um und hört vor.
- **Wellenform:**
  - Ziehen bewegt den näheren Griff, mit 0,02 Mindestabstand. Ohne Sample passiert nichts.
  - Loslassen hört vor.
- **Regler:** Attack, Decay, Tune (±12 ST), Level. Standard aus `PAD_DEFAULT`, Tag „PAD n“, Loslassen hört vor.
- **Steps:** wie Drums (`toggleSampleStep`, Sub-Steps mit Schlüssel `P{sel}`). Vorhören nur beim Einschalten im Stand.
- **Zusammenfassung:** „Pad n · Name|leer · x.x s“.
- **Meldungen:** `role="status"`, nach 4,5 s weg (außer „Aufnahme läuft“).

## Review Focus

1. **Pad ohne Sample:** Antippen wählt nur, Wellenform-Ziehen und Vorhören tun nichts, „leer“ wird angezeigt.
2. **Bereichsgriffe:** Start und Ende kreuzen sich nie (0,02 Abstand). Der nähere Griff wird gegriffen, das Ende bleibt am Rand möglich.
3. **Aufnahme:** abgelehnt, nicht verfügbar, leer („Nichts aufgenommen“), Stopp nach 3 s. Ein zweiter Tipp stoppt.
4. **Speicher:** Laden, Leeren und Neuladen erhalten die Pad-Samples, Fabrik-Pads bleiben, und Pad-Einträge stören die eigenen Drum-Samples (`D:`) nicht.
5. **Layouts:** Mobile Akkordeon, Tablet zweiter Tab, Desktop Bereich `smp`. Kein horizontaler Scroll, Touch-Ziele ≥ 44 px.

## Aufgaben

### Task 1: `core/sampler.ts`

Funktionen (alle rein, unveränderlich):

```ts
selectPad(s: State, i: number): State
setPadValue(s: State, i: number, key: 'att' | 'dec' | 'tune' | 'lvl', v: number): State
grabHandle(pad: Pad, f: number): 'start' | 'end'          // näherer Griff, bei Gleichstand start
movePadHandle(s: State, i: number, h: 'start' | 'end', f: number): State // start ≤ end − 0,02, end ≥ start + 0,02
toggleReverse(s: State, i: number): State
loadedPad(s: State, i: number, name: string): State      // start 0, end 1, name
clearedPad(s: State, i: number): State                    // name '', start 0, end 1, rev false
waveColumns(pcm: Float32Array, width: number): { min: number; max: number }[] // Legacy drawWave
padSummary(s: State, pcm: Float32Array | null): string    // „Pad n · Name|leer · x.x s“ (UI-Hilfe, hier rein testbar)
```

Tests decken jede Funktion ab: Grenzen, Gleichstand, Breite größer als die Sample-Länge, leeres Sample, Format.

### Task 2: Pad-Samples, Audio-Port, Rekorder, Verdrahtung

- `store/samples.ts`:
  - `SampleBank.pads: ReadonlySignal<readonly (Float32Array | null)[]>`, `setPad(i, pcm | null)`.
  - Speichern unter `String(i)` als `{ d: base64 }` bzw. `{ d: "" }`. Andere Einträge (auch `D:`) bleiben erhalten.
  - `createSampleBank(storage, initialDrums, initialPads = [])`.
- `ui/context.ts`:
  - `UiAudio.auditionPad(i)`.
  - `UiFiles.pickAudio(opts?: { capture?: boolean })`.
  - Neu ist `UiRecorder` mit `start(maxMs): Promise<{ done: Promise<ArrayBuffer | null>; stop(): void } | { error: 'unavailable' | 'denied' }>`.
  - Der `UiContext` bekommt das Feld `recorder`.
- `platform/recorder.ts`:
  - `createRecorder(env: { mediaDevices?: { getUserMedia(c: MediaStreamConstraints): Promise<MediaStream> }; MediaRecorder?: typeof MediaRecorder; timer })`.
  - Verhalten wie Legacy `recToggle`: Daten-Chunks sammeln, Spuren stoppen, beim Stopp oder nach `maxMs` den Blob als ArrayBuffer liefern bzw. `null` ohne Daten.
- `main.ts`:
  - Effekt `samples.pads` → `engine.setPadSample` (nur Änderungen).
  - `auditionPad` im Adapter, `recorder` aus platform.
  - `files.pickAudio(opts)` gibt `capture` weiter.
- Test-Hilfen: `fakeAudio.auditionPad`, ein Fake-Rekorder in `makeContext`.

### Task 3: Sampler-Oberfläche und Gerät

`ui/panels/sampler/`:
- `pads.ts`: 8 Pads (`aria-label` „Pad n“, Unterzeile Name/„leer“, Klassen `sel`, `empty`, `has`).
- `tools.ts`: Laden, Rec (`aria-label` „Mit dem Mikrofon aufnehmen“, während der Aufnahme „Stopp“ und aktiv), Rev (`aria-label` „Rückwärts abspielen“, aktiv), Leeren, dazu die Meldungszeile `role="status"`.
- `wave.ts`: Canvas mit `role="img"` und `aria-label` „Wellenform mit Start- und Endmarke“, Hinweis „Leer. Lade eine Audiodatei oder nimm etwas auf.“, Zeichnen über `waveColumns`. Unter jsdom liefert `getContext` `null`, dann wird nicht gezeichnet. Ziehen nach Legacy, Loslassen hört vor.
- `knobs.ts`: Attack, Decay, Tune, Level.
- `steps.ts`: 16 Steps `.ss` (`aria-label` „Sampler Step n“), Sub-Chip, Sub-Editor (wiederverwendet), Lauflicht.
- `device.ts`: `samplerDevice(c)` mit der Zusammenfassung.
- In der Shell steht er als zweites Gerät hinter dem Synth.

Komponententests je Datei (wie Synth), inklusive aller Punkte aus dem Review Focus.

### Task 4: E2E, Doku

- `tests/e2e-next/sampler.spec.ts`:
  - Pad wählen, Step setzen.
  - Datei laden über `filechooser` mit einer erzeugten WAV-Datei, danach Neuladen: Name und Sample bleiben.
  - Rev, Leeren.
  - Touch-Ziele ≥ 44 px (außer `.ss` im dichten Raster, falls nötig mit Ruling).
  - Kein horizontaler Scroll.
- axe mit offenem Sampler, Screenshots, Budget (bei Bedarf anheben, mit Ruling).
- Funktionsliste (Sampler ✅), README, CLAUDE.md.
