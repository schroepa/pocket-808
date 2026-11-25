# Neue Oberfläche „Ein Gerät“ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die Oberfläche bedient sich wie ein Hardware-Gerät ohne Seiten-Scrollen (Spur wählen, Seiten, feste Steps, Plattenkiste), auf iPhone, Tablet und Desktop.

**Architecture:** Ein neues UI-Zustandsobjekt `Nav` (Signale, nicht gespeichert) bestimmt Modus, Spur, Seite und offene Fläche. Die vorhandenen Panels werden in Seiten-Bausteine zerlegt und von einem festen Rahmen (Display, Modusleiste, Spurwahl, Arbeitsfläche, Step-Bereich, Transport) angezeigt; alle Bausteine werden einmal gebaut und nur ein- und ausgeblendet. Die alte Shell läuft weiter, bis Task 11 in einem Schritt umschaltet.

**Tech Stack:** TypeScript, eigener Signals-Kern und DOM-Helfer (`src/ui/dom.ts`), CSS Cascade Layers, Vitest (jsdom), Playwright (5 Projekte).

**Spec:** `docs/superpowers/specs/2026-11-25-ui-ein-geraet-design.md`

## Global Constraints

- Voraussetzung: Etappe 10a (Chorus/Drive, 0.28.0) ist in `main`. Vorher beginnt kein Task. Branch: `oberflaeche-ein-geraet` ab `main`; live (Merge, Push, Artifact) erst nach Task 14.
- `State` und Speicherformat bleiben unverändert. `State.open` bleibt im Format, wird nicht mehr gelesen. Modus und Seite werden nicht gespeichert; Start im Modus „Spur“.
- Referenztests (`npm run test:ref`) und `golden/` bleiben unverändert; `src/audio` und `src/platform` werden nicht angefasst.
- Schichten: `ui` importiert nur `core` und `store`. Keine `!`-Assertions (`must()`).
- Design: keine Outlines/Schatten (außer Fokusring), Glow für aktive Zustände mit `z-index:1`, nur Palette aus `tokens.css`, Raster-Spalten `minmax(0, …)`.
- Touch-Ziele ≥ 44 px (Desktop 32 px). Ausnahme nur dichte Raster: 16 Steps, Sub-Steps, Notenrolle, Alle Spuren.
- iPhone: ohne Scrollen ab 390 × 660 CSS-Pixel. Auf kleineren Bildschirmen darf nur der mittlere Bereich scrollen. Das Dokument scrollt nie.
- UI-Texte Deutsch, Hardware-Begriffe englisch.
- Unit-Abdeckung ≥ 90 % je Datei. Commit-Präfix wie im Repo (`ui:`, `core:`, `test:`, `docs:`), Trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Jeder Befehl mit `source ~/.nvm/nvm.sh && nvm use >/dev/null && ` davor.
- Vorhandene Barrierefrei-Namen bleiben, wo die Funktion bleibt (z. B. „Snare Drum wählen und anhören“, „Pattern C“, „Zurück“, „Tempo antippen“, „Live-Aufnahme scharf schalten“).

## Review Focus

1. Punch oder Stutter wird gehalten, während ein zweiter Finger Modus, Seite oder Layout wechselt → der Effekt wird gelöst (Tests: Task 3, Task 11).
2. „Sub“ oder „Opt“ ist an und man verlässt die Seite Trig → der nächste Step-Tipp schaltet normal (Test: Task 2).
3. Projekt öffnen oder Zurück ändert Spur, Pad oder Inhalte, während Seiten und „Alle Spuren“ sichtbar sind → alles folgt, nichts zeigt Altes (Test: Task 10).
4. iPhone drehen bzw. Fenster verkleinern, während eine Seite oder Fläche offen ist → gewählte Seite bleibt, die Rolle sitzt im richtigen Bereich, nichts wird unbedienbar (Test: Task 11).
5. Lange Namen (eigenes Drum-Sample, Pad-Name, Vorlagen) bei 390 px → kein horizontaler Überlauf, Text wird gekürzt (Test: Task 13).

## Festlegungen dieses Plans

- Mixer „Kanäle“: Fader für alle 13 Kanäle; M, S, Pan, Reverb gelten für den gewählten Kanal darunter. Stumm/Solo sind am Kanal sichtbar.
- „Sub“ und „Opt“ schalten sich ab, sobald ihre Seite nicht mehr sichtbar ist.
- iPhone: In Mixer und Song sind Spurwahl und Step-Bereich ausgeblendet.
- Der Schriftzug „Pocket 808“ ist nur am Desktop sichtbar, sonst nur für Screenreader. Der Farbstreifen entfällt.

## Dateien

Neu in `src/ui/`: `nav.ts`, `track.ts`, `controls/tabs.ts`, `controls/sheet.ts`, `panels/track-select.ts`, `panels/step-area.ts`, `panels/drum-pages.ts`, `panels/track-work.ts`, `panels/channel.ts`, `panels/library.ts`, `panels/display.ts`, `panels/mode-bar.ts`, `panels/pattern-sheet.ts`, `panels/tempo.ts`, `panels/all-tracks.ts`, `panels/sampler/pages.ts`, `controls/visible.ts`; je Komponente eine eigene CSS-Datei wie bisher.
Entfallen in Task 11: `devices.ts/.css`, `panels/{step-editor,tracks,deck,brand,patterns}.ts` samt Tests und CSS, `panels/*/device.ts`, `panels/synth/head.ts`, ungenutzte Zusammenfassungs-Funktionen.

---

### Task 1: Entwurf ins Repo, Funktionsliste auf den heutigen Stand

**Files:**
- Create: `docs/superpowers/specs/2026-11-25-ui-ein-geraet-design.md`, `docs/superpowers/plans/2026-11-25-ui-ein-geraet.md` (aus `.superpowers/brainstorm/` verschoben)
- Modify: `docs/superpowers/specs/2026-10-14-ui-funktionsliste.md`

- [ ] **Step 1:** Prüfen: `git log --oneline -8 main` zeigt Etappe 10a in `main`; `git status --short` ist leer; keine andere Sitzung arbeitet im Checkout. Sonst anhalten und fragen. Dann `git switch -c oberflaeche-ein-geraet main`.
- [ ] **Step 2:** Entwurf und Plan verschieben; im Entwurf die Statuszeile auf „Freigegeben 2026-11-25.“ setzen und im Plan den Spec-Pfad prüfen.
- [ ] **Step 3:** Funktionsliste ergänzen (nur was heute existiert): Vorlagen-Browser (Stil wählen; 21 Vorlagen in fünf Stilen; Laden Alles/Drums/Sound; Hinweiszeile; Markierung; Meldung), Kits (Laden, Markierung, Meldung), Warm, Tape. Je Zeile den vorhandenen Test nennen (`grep` in `src/ui/**/*.test.ts`, `src/core/**/*.test.ts`). Außerdem alle Zeilen gegen `src/ui/panels/` abgleichen und fehlende nachtragen.
- [ ] **Step 4:** `npx prettier --check docs` → „All matched files use Prettier code style“.
- [ ] **Step 5:** Commit `docs: Entwurf und Plan „Ein Gerät“, Funktionsliste nachgeführt`.

### Task 2: Navigation (`nav.ts`)

**Files:** Create `src/ui/nav.ts`, Test `src/ui/nav.test.ts`

**Interfaces – Produces:**

```ts
export type Mode = 'spur' | 'sound' | 'mixer' | 'song' | 'punch';
export type TrackId = ChannelId;
export type TrackKind = 'drum' | 'synth' | 'smp';
export type PageId = 'trig' | 'klang' | 'mix' | 'noten' | 'filter' | 'amp' | 'bewegung' | 'chop' | 'tasten';
export type Lower = 'steps' | 'all' | 'notes';
export type SheetId = 'tracks' | 'pattern' | 'tempo';
export type RollTool = 'note' | 'a' | 's' | 'ch';
export interface EditorSub { on: boolean; step: number }
export const MODE_NAMES: Readonly<Record<Mode, string>>;   // Spur, Sound, Mixer, Song, Punch
export const PAGE_NAMES: Readonly<Record<PageId, string>>; // Trig, Klang, Mix, Noten, Filter, Amp, Bewegung, Chop, Tasten
export const PAGES: Readonly<Record<TrackKind, readonly PageId[]>>;
export function kindOf(id: TrackId): TrackKind;
export function viewsFor(kind: TrackKind, layout: Layout): readonly (readonly PageId[])[];
export function stepAreaVisible(mode: Mode, view: readonly PageId[], layout: Layout): boolean;
export function trackSelectVisible(mode: Mode, layout: Layout): boolean;
export function lowerFor(layout: Layout, kind: TrackKind, chosen: Lower): Lower;
export interface Nav {
  readonly mode: ReadonlySignal<Mode>;
  readonly track: ReadonlySignal<TrackId>;
  /** immer eine Seite der aktuellen Spur */
  readonly page: ReadonlySignal<PageId>;
  readonly view: ReadonlySignal<readonly PageId[]>;
  readonly lower: ReadonlySignal<Lower>;
  readonly sheet: Signal<SheetId | null>;
  readonly drumSub: Signal<EditorSub>;
  readonly drumOpt: Signal<EditorOpt>;
  readonly padSub: Signal<EditorSub>;
  readonly padOpt: Signal<EditorOpt>;
  readonly roll: { page: Signal<number>; tool: Signal<RollTool> };
  setMode(m: Mode): void;
  selectTrack(id: TrackId): void;
  selectPage(p: PageId): void;
  setLower(l: Lower): void;
  /** Rolle an dieser Stelle zeigen: Modus Spur, Seite Noten, Takthälfte; Desktop unten „Noten“ */
  openNotes(step: number): void;
}
export function createNav(scope: Scope, store: Store, layout: ReadonlySignal<Layout>): Nav;
```

Werte:

| | mobile | tablet | desktop |
|---|---|---|---|
| drum | trig · klang · mix | [trig, klang, mix] | [trig, klang, mix] |
| synth | noten · klang · filter · amp · bewegung · mix | [noten] [klang, filter] [amp, bewegung, mix] | [noten, klang, filter, amp] [bewegung, mix] |
| smp | trig · klang · chop · tasten · mix | [trig, klang] [chop, tasten, mix] | [trig, klang, chop] [tasten, mix] |

(„·“ = je eine eigene Ansicht.) `stepAreaVisible`: mobile `mixer|song` → false; mobile Modus spur mit `noten|tasten` → false; tablet Modus spur mit `noten` → false; sonst true. `trackSelectVisible`: false nur mobile in `mixer|song`. `lowerFor`: mobile → `steps`; tablet → `all` falls gewählt, sonst `steps`; desktop → `notes` nur bei synth und gewählt, sonst `all`.

`track`: Art merkt sich Nav (Start `drum`); die Spur folgt `state.sel` bzw. `state.part` bzw. `SM`. `selectTrack` schreibt Art und `sel`/`part` (nur bei Änderung). `selectPage` merkt die gewünschte Seite; passt sie nicht zur Art, gilt die erste der Art, der Wunsch bleibt.

- [ ] **Step 1: Failing tests** (`nav.test.ts`, mit `makeContext()` und `signal<Layout>('mobile')`):

```ts
it('startet in Spur auf der gewählten Drum', () => { /* mode 'spur', track = VOICE_IDS[state.sel], page 'trig' */ });
it('Spur und Zustand hängen zusammen', () => { /* selectTrack('LD') → state.part 'LD'; store.update part 'BA' → track 'BA'; selectTrack('SD') → state.sel 1 */ });
it('Seite bleibt beim Spurwechsel, sonst erste der Art', () => { /* selectPage('klang'): BA → 'klang', SM → 'klang'; selectPage('filter'): BD → 'trig', zurück auf BA → 'filter' */ });
it('viewsFor deckt je Art und Layout jede Seite genau einmal ab', () => { /* flat() sortiert == PAGES[kind] sortiert */ });
it('Sichtbarkeit von Step-Bereich und Spurwahl', () => { /* je eine Zeile der Regeln oben als Erwartung */ });
it('Sub und Opt gehen aus, wenn Trig nicht mehr sichtbar ist', () => {
  // drumOpt an → selectPage('klang') (mobile) → drumOpt.on false; ebenso setMode('sound'), selectTrack('BA');
  // desktop: selectPage('klang') lässt es an (Trig bleibt sichtbar)
});
it('openNotes zeigt die richtige Takthälfte', () => { /* openNotes(9) bei BA: mode 'spur', page 'noten', roll.page 1; desktop: lower 'notes' */ });
it('setMode schließt offene Flächen', () => { /* sheet 'pattern' → setMode('song') → null */ });
```

- [ ] **Step 2:** `npx vitest run --project ui nav.test` → FAIL (Modul fehlt).
- [ ] **Step 3:** `nav.ts` implementieren (reine Funktionen exportiert, Signale in `createNav`; das Abschalten von Sub/Opt als `effect` im Scope).
- [ ] **Step 4:** Test erneut → PASS.
- [ ] **Step 5:** Commit `ui: Navigation für Modus, Spur und Seiten`.

### Task 3: Bausteine Reiter, Fläche, Halten lösen

**Files:** Create `src/ui/controls/tabs.ts/.css`, `src/ui/controls/sheet.ts/.css`, `src/ui/controls/visible.ts`; Modify `src/ui/controls/hold.ts`; Tests `src/ui/controls/frame-controls.test.ts`

**Interfaces – Produces:**

```ts
// tabs.ts – role=tablist, ein Tab-Stopp, Pfeile links/rechts wählen und fokussieren
export function tabs<T extends string>(scope: Scope, o: {
  label: string; items: ReadonlySignal<readonly { value: T; label: string }[]>;
  value: ReadonlySignal<T>; write(v: T): void }): HTMLElement;
// sheet.ts – nicht modale Fläche über der Arbeitsfläche; role=dialog, Knopf „Schließen“, Escape
export function sheet(scope: Scope, o: {
  label: string; open: ReadonlySignal<boolean>; close(): void; content: HTMLElement }): HTMLElement;
// hold.ts
export function releaseHolds(root: Element): void; // löst alle gehaltenen Tasten unter root
/** blendet el aus bzw. ein und löst vorher gehaltene Tasten */
export function show(el: HTMLElement, visible: boolean): void; // in controls/visible.ts
```

- [ ] **Step 1: Failing tests:** „tabs: Klick und Pfeiltasten schreiben, aria-selected folgt, neue Liste ersetzt Reiter“; „sheet: offen fokussiert den ersten Knopf, Escape und Schließen rufen close, beim Schließen kehrt der Fokus zurück, zu = hidden“; „releaseHolds ruft off genau einmal je gehaltener Taste und ist ohne Halten folgenlos“; „show(el,false) löst ein gehaltenes Punch-Pad“ (`pointer('pointerdown')`, dann `show`, Erwartung `off` einmal, `aria-pressed="false"`).
- [ ] **Step 2:** `npx vitest run --project ui frame-controls` → FAIL.
- [ ] **Step 3:** Implementieren. `holdButton` setzt `data-hold` und hört auf ein eigenes Ereignis `holdrelease`.
- [ ] **Step 4:** Test und `npx vitest run --project ui controls` → PASS.
- [ ] **Step 5:** Commit `ui: Reiter, Fläche und Lösen gehaltener Tasten`.

### Task 4: Spurwahl und Antippen

**Files:** Create `src/ui/track.ts`, `src/ui/panels/track-select.ts/.css`; Modify `src/ui/panels/sampler/pads.ts`; Test `src/ui/panels/track-select.test.ts`

**Interfaces:**
- Consumes: `Nav`, `sheet`, `recordTap`.
- Produces:

```ts
export function trackTitle(s: State, id: TrackId): string; // „SD · Snare Drum“, „BA · Bass“, „SM · Pad 3“
export function trackTap(c: UiContext, nav: Nav, el: HTMLElement, id: TrackId): void; // wählen, anspielen, aufnehmen
export function shiftTrack(nav: Nav, d: -1 | 1): void; // Reihenfolge CHANNELS, an den Enden Halt
export function trackBar(c: UiContext, nav: Nav): HTMLElement;    // ‹ „Vorige Spur“, Titelknopf „Spur wählen“, › „Nächste Spur“
export function trackKeys(c: UiContext, nav: Nav): HTMLElement;   // 13 Tasten, aria „<Name> wählen und anhören“
export function trackPadsContent(c: UiContext, nav: Nav): HTMLElement; // 12 Spur-Pads und 8 Sampler-Pads
export function samplerPads(c: UiContext, onPick?: (pad: number) => void): HTMLElement;
```

Anspielen: Drum `audition(id)`; Bass/Lead `auditionNote(part, 0, 2)`; Sampler das gewählte Pad, falls belegt. Aufnahme-Schlag: Drum `{kind:'drum'}`, Bass/Lead `{kind:'note', degree: 0, length: noteLen}`, Sampler `{kind:'pad', semis: 0}` nur mit Sample. ‹ › wählen nur (kein Ton, keine Aufnahme). Pad-Feld: nach einem Tipp `nav.sheet = null`, außer `audio.recording` ist an.

- [ ] **Step 1: Failing tests:** je Spurart „Tipp wählt und spielt an“; „bei Rec und Wiedergabe nimmt pointerdown den Schlag auf“ (drum, note, pad; leeres Pad nichts); „Pad-Feld schließt ohne Rec, bleibt bei scharfem Rec offen“; „Sampler-Pad im Feld wählt Pad und Spur SM“; „shiftTrack hält an BD und SM“; „eigenes Sample markiert die Taste (Klasse cust)“; „Titel folgt Spur und Pad“.
- [ ] **Step 2:** `npx vitest run --project ui track-select` → FAIL.
- [ ] **Step 3:** Implementieren; `drum`-Anteile aus `panels/tracks.ts` übernehmen (Datei bleibt bis Task 11).
- [ ] **Step 4:** Test und `sampler`-Tests → PASS.
- [ ] **Step 5:** Commit `ui: Spurwahl mit Pad-Feld`.

### Task 5: Drum-Seiten und Step-Bereich

**Files:** Create `src/ui/panels/drum-pages.ts/.css`, `src/ui/panels/step-area.ts/.css`; Modify `src/ui/panels/sampler/steps.ts`; Test `src/ui/panels/step-area.test.ts`

**Interfaces:**
- Consumes: `Nav.drumSub/drumOpt/padSub/padOpt/openNotes`.
- Produces:

```ts
export function pressDrumStep(c: UiContext, nav: Nav, voice: VoiceId, step: number): void; // Sub/Opt/Schalten wie heute
export function pressPadStep(c: UiContext, nav: Nav, pad: number, step: number): void;
export function drumSteps(c: UiContext, nav: Nav): HTMLElement;  // 16 Knöpfe „Step n“, Klasse step, Gruppen zu 4
export function padSteps(c: UiContext, nav: Nav): HTMLElement;   // 16 Knöpfe „Sampler Step n“
export function noteSteps(c: UiContext, nav: Nav): HTMLElement;  // 16 Knöpfe „Noten Step n“; on = Notenanfang, Klasse tail
export function stepArea(c: UiContext, nav: Nav): HTMLElement;   // alle drei, sichtbar nach kindOf(nav.track)
export function drumTrigPage(c: UiContext, nav: Nav): HTMLElement;  // Sub, Opt, „Spur leeren“, Sub-Editor, Opt-Panel
export function drumSoundPage(c: UiContext, nav: Nav): HTMLElement; // Level, Tune, Decay, Eigenes Sample, Original
export function padTrigPage(c: UiContext, nav: Nav): HTMLElement;   // Sub, Opt, „Spur leeren“, Sub-Editor, Opt-Panel
```

„Spur leeren“ beim Pad: neu `store.clearPadTrack(pad: number): void` mit `clearPadTrack(s, pad)` in `core/pattern.ts` (Steps, Sub-Steps und Step-Optionen des Pads im aktuellen Pattern, mit Zurück, andere Spuren unverändert).

- [ ] **Step 1: Failing tests:** `core/pattern.test.ts` „clearPadTrack leert nur dieses Pad“ und Store „mit Zurück“; `step-area.test.ts`: die Fälle aus `step-editor.test.ts` (schalten + Vorhören, Sub-Step-Löschen, Sub wählt, Opt wählt und schaltet ein, Lauflicht) auf die neuen Funktionen übertragen; „Noten Step zeigt Anfang und Ausklang; Tipp ruft openNotes“; „stepArea zeigt genau das Raster der Spurart“; „Step-Klick ändert nur diese Zelle“ (`countMutations`).
- [ ] **Step 2:** `npx vitest run --project ui step-area && npx vitest run --project unit pattern` → FAIL.
- [ ] **Step 3:** Implementieren; `samplerSteps` setzt sich vorerst aus `padSteps`-Logik und `padTrigPage` zusammen, damit die alte Shell läuft.
- [ ] **Step 4:** `npm run test:unit` → PASS.
- [ ] **Step 5:** Commit `ui: Step-Bereich und Drum-Seiten`.

### Task 6: Synth- und Sampler-Seiten

**Files:** Modify `panels/synth/{modules,roll,presets,head}.ts`, `panels/sampler/{wave,tools,chop,keyboard}.ts`; Create `panels/sampler/pages.ts`; Tests in `synth.test.ts`, `sampler.test.ts`

**Interfaces – Produces:**

```ts
export function synthSoundPage(c): HTMLElement;  // Wellenform, Oktave, Detune, Sub, Drive, Chorus, Delay, Level
export function synthFilterPage(c): HTMLElement; // Cutoff, Reso, Env, Filter-ADSR mit Anzeige
export function synthAmpPage(c): HTMLElement;    // Amp-ADSR mit Anzeige
export function synthMotionPage(c): HTMLElement; // LFO, Arp
export function rollControls(c, roll: Nav['roll']): HTMLElement; // Takthälfte, Länge, Werkzeug
export function rollGrid(c, roll: Nav['roll']): HTMLElement;     // Raster mit Tonnamen und Lauflicht
export function synthNotesPage(c, roll: Nav['roll']): HTMLElement; // Tonart, Skala, rollControls, „Stimme leeren“, leerer Platz [data-slot=roll]
export function synthSoundList(c): HTMLElement;  // Preset-Chips des Parts, ohne „Stimme leeren“
export function samplerPages(c, nav: Nav): { head: HTMLElement; trig; klang; chop; tasten: HTMLElement };
```

`head` = Pad-Reihe (`samplerPads`) und Meldungszeile (`createMessage`); die Meldung steht dort, damit sie auch auf „Chop“ sichtbar ist. `klang` = Wellenform, Werkzeuge (Laden, Rec, Leeren, Rev, Bounce), Tune, Attack, Decay, Level. Die alten Zusammensetzungen (`synthModules`, `pianoRoll`, `synthPresets`, `samplerDevice`) bleiben bis Task 11 und nutzen die neuen Teile.

- [ ] **Step 1: Failing tests:** „jede Synth-Seite hat genau ihre Regler“ (`getAll [role=slider]` aria-labels je Seite gleich der Liste oben); „rollControls und rollGrid teilen Takthälfte und Werkzeug“; „Arp-Rate bleibt vorgewählt, nachdem die Seite ausgeblendet war“; „Chop-Meldung steht in head, nicht in der ausgeblendeten Wellenform-Seite“.
- [ ] **Step 2:** `npx vitest run --project ui synth sampler` → FAIL.
- [ ] **Step 3:** Aufteilen ohne Verhaltensänderung.
- [ ] **Step 4:** `npm run test:unit` → PASS (alte Tests unverändert grün).
- [ ] **Step 5:** Commit `ui: Synth und Sampler in Seiten zerlegt`.

### Task 7: Kanalseite, Mixer-Modus, Spur-Arbeitsfläche

**Files:** Create `panels/channel.ts/.css`, `panels/track-work.ts/.css`; Modify `panels/mixer/{mixer,fx}.ts`, `panels/punch/punch.ts`; Tests `panels/track-work.test.ts`, `mixer.test.ts`

**Interfaces:**
- Consumes: Seiten aus Task 5/6, `tabs`, `show`.
- Produces:

```ts
export function channelPage(c, id: ReadonlySignal<ChannelId>, o?: { level?: boolean }): HTMLElement;
// Level (def 0.8), Pan (Raste 0.5), Reverb; „<Name> stumm“, „<Name> solo“
export function trackWork(c, nav: Nav, layout): HTMLElement;
// Reiter „Seite“ (nur bei > 1 Ansicht, Label = Seitennamen mit „ · “), je Seite <section data-page="…" data-kind="…" aria-label>
export function mixerWork(c, layout): HTMLElement;
// Reiter „Mixer“: mobile Kanäle | Szenen | FX; tablet [Kanäle · Szenen] [FX]; desktop alles
export function punchGrid(c): HTMLElement;
export function sceneRow(c): HTMLElement; // exportiert
```

„Kanäle“: 13 Spalten-Züge in zwei Reihen: Namensknopf „Kanal <Name> wählen“, senkrechter `slider` „Lautstärke <Name>“ (def 0.8); Klassen `muted`/`solo` am Zug; darunter `channelPage(c, selected, { level: false })`.

- [ ] **Step 1: Failing tests:** „trackWork zeigt genau die Seiten der Ansicht, Reiter wechseln“; „Spurwechsel behält die Seite“; „channelPage schreibt den Kanal der Spur, beim Sampler SM“; „Kanäle: Fader schreibt, Zug zeigt Stumm und Solo, M/S/Pan/Reverb wirken auf den gewählten Kanal“; „Seitenwechsel weg von FX löst Stutter“.
- [ ] **Step 2:** `npx vitest run --project ui track-work mixer` → FAIL.
- [ ] **Step 3:** Implementieren; `mixerPanel` (alt) bleibt bis Task 11 unverändert nutzbar.
- [ ] **Step 4:** `npm run test:unit` → PASS.
- [ ] **Step 5:** Commit `ui: Kanalseite, Mixer-Seiten und Spur-Arbeitsfläche`.

### Task 8: Plattenkiste

**Files:** Create `panels/library.ts/.css`; Test `panels/library.test.ts`

**Interfaces:** `export function library(c, layout: ReadonlySignal<Layout>): HTMLElement;`

Abschnitte `Synth-Sound`, `Vorlagen`, `Basis-Muster`, `Kits`; mobile als Reiter „Plattenkiste“, sonst nebeneinander. Start-Reiter: `Vorlagen`. Synth-Sound: Umschalter „Stimme“ (Bass/Lead, schreibt `state.part`), `synthSoundList`; Tipp lädt, hört vor, meldet `BASS · <NAME>` bzw. `LEAD · <NAME>`. Vorlagen: Stil (nur Genres; Start: Stil der geladenen Vorlage, sonst der erste), Liste, Laden Alles/Drums/Sound, Hinweiszeile wie heute. Meldungen: Alles `<NAME> · <Tempo> BPM`, Drums `<NAME> · DRUMS GELADEN`, Sound `NUR SOUND GELADEN`. Nach Drums: liegt das offene Pattern nicht in `t.pat`, `store.selectSlot('A')`. Markiert ist die zuletzt angetippte Vorlage (Start: `state.preset`). Neue Stile erscheinen allein durch Daten in `core/templates`.

- [ ] **Step 1: Failing tests:** die Vorlagen-, Basis- und Kit-Fälle aus `song-patterns.test.ts` übertragen, dazu:

```ts
it('Drums auf Pattern F geladen: Auswahl springt auf A, Zurück stellt F und den alten Stand her', () => {
  // selectSlot('F') → Laden „Drums“ → Vorlage tippen: state.cur 'A'; undo(): state toEqual(vorher)
});
it('Drums auf Pattern B geladen: B bleibt offen', () => { /* Vorlage mit B in t.pat: state.cur 'B' */ });
it('Sound geladen', () => {
  // Meldung 'NUR SOUND GELADEN', Chip aria-pressed 'true', state.patterns toBe(vorher.patterns)
});
it('Synth-Sound auf Lead', () => {
  // Stimme „Lead“ → erstes Preset: state.synth.LD.preset = Name, auditionNote('LD', 0, 2), state.synth.BA unverändert
});
```

- [ ] **Step 2:** `npx vitest run --project ui library` → FAIL.
- [ ] **Step 3:** Implementieren (Logik aus `patterns.ts`, Datei bleibt bis Task 11).
- [ ] **Step 4:** Test → PASS.
- [ ] **Step 5:** Commit `ui: Plattenkiste`.

### Task 9: Display, Modusleiste, Pattern- und Tempo-Fläche

**Files:** Create `panels/{display,mode-bar,pattern-sheet,tempo}.ts` mit CSS; Test `panels/frame-head.test.ts`

**Interfaces – Produces:**

```ts
export function display(c, nav: Nav, tools: readonly HTMLElement[], strip: HTMLElement): HTMLElement;
export function displayLine(c: Pick<UiContext,'store'|'audio'>, nav): ReadonlySignal<string>;
export function modeBar(c, nav: Nav): HTMLElement;       // Reiter „Bereich“ + Pattern-Taste
export function patternSheetContent(c, nav: Nav): HTMLElement;
export function tempoControls(c): HTMLElement;           // Tempo, Swing, Master, Tap
```

Display: `h1` „Pocket 808“; Knopf mit `.lcd-digits` (dreistellig), aria „Tempo <n> BPM, Tempo, Swing und Master öffnen“, öffnet `tempo`; „PATTERN <cur>“; `.lcd-sub` (Readout); Oszilloskop; „Zurück“ (gesperrt ohne `canUndo`); `tools` (Datei, „?“). `displayLine`: ohne Audio „Kein Audio in diesem Browser“; Modus sound `SOUND FÜR <BASS|LEAD>`; sonst `trackTitle`. Pattern-Taste: Text „<cur> ▾“, aria „Pattern wählen, aktuell <cur>“. Pattern-Fläche: `slots(c)`, Kopieren, Einfügen, „Variation würfeln“, „Pattern leeren“ (Meldungen wie heute); ein Slot-Tipp schließt, die Werkzeuge lassen sie offen.

- [ ] **Step 1: Failing tests:** Tempo-, Swing-, Master-, Tap-Fälle aus `panels-head.test.ts` auf `tempoControls`; Slot- und Werkzeug-Fälle; „Display nennt Ziel in Sound“; „BPM-Knopf öffnet Tempo“; „Slot-Tipp schließt, Kopieren nicht“; „Zurück gesperrt/aktiv“.
- [ ] **Step 2:** `npx vitest run --project ui frame-head` → FAIL.
- [ ] **Step 3:** Implementieren.
- [ ] **Step 4:** Test → PASS.
- [ ] **Step 5:** Commit `ui: Display, Modusleiste, Pattern- und Tempo-Fläche`.

### Task 10: Alle Spuren

**Files:** Create `panels/all-tracks.ts/.css`; Test `panels/all-tracks.test.ts`

**Interfaces:** Consumes `trackTap`, `pressDrumStep`, `pressPadStep`, `Nav.openNotes`. Produces `export function allTracks(c, nav: Nav): HTMLElement;` (aria „Alle Spuren“).

Zeilen: 10 Drums, Bass, Lead, dann Pads mit Inhalt (Sample oder Steps im offenen Pattern) und immer das gewählte Pad. Zellen-Namen „<Name> Step <n>“, Pads „Pad <p> Step <n>“. Tipp: Spur wählen; Drum/Pad wie `press…`; Bass/Lead `openNotes(n)`.

- [ ] **Step 1: Failing tests:** „Zellen schalten und wählen“; „Bass-Zelle öffnet Noten“; „Sub aktiv: Tipp in der gewählten Zeile wählt den Step“; „replaceState (anderes Projekt) und Zurück: Zeilen, Zellen und Auswahl folgen“; „leeres, nicht gewähltes Pad hat keine Zeile“; „Lauflicht“; „Step-Klick ändert nur eine Zelle“.
- [ ] **Step 2:** `npx vitest run --project ui all-tracks` → FAIL.
- [ ] **Step 3:** Implementieren; Zeilenliste als Signal aus einem Text-Schlüssel, Neuaufbau in eigenem Unter-Scope nur bei geänderter Liste.
- [ ] **Step 4:** Test → PASS.
- [ ] **Step 5:** Commit `ui: Raster „Alle Spuren“`.

### Task 11: Umschalten auf den neuen Rahmen

**Files:** Rewrite `src/ui/shell.ts`, `shell.test.ts`, `styles/layout.css`; Modify `keys.ts`, `keys.test.ts`, `readout.ts`; Delete die unter „Dateien“ genannten alten Teile.

**Interfaces:** `mountShell` und `ShellDeps` unverändert (main.ts bleibt). `installKeys(c, layout, doc, nav, files?)`; ↑/↓ = `shiftTrack`; Kürzeltext „Spur wählen“.

DOM-Reihenfolge (`data-area`): `display`, `modes`, `tracks` (trackBar nur mobile, trackKeys sonst), `work` (spur, sound, mixer, song, punch), `steps` (tablet: Umschalter „Steps | Alle Spuren“; desktop: „Alle Spuren | Noten“, Noten nur bei Bass/Lead), `transport`; dazu die drei Flächen. `rollGrid` wird einmal gebaut und per `layout` verschoben: desktop in `steps`, sonst in `[data-slot=roll]`. Sichtbarkeit ausschließlich über `show()`.

Layout-CSS: `.shell` Höhe `100dvh`, Raster mit mittlerer Zeile `minmax(0,1fr)`, `overflow:hidden`; `work` und `steps` scrollen nur, wenn der Platz nicht reicht. Mobile hochkant eine Spalte, 16 Steps als 2 × 8; mobile quer: Arbeitsfläche und Step-Bereich nebeneinander, Display und Modusleiste in einer Zeile; tablet eine Spalte, Seiten als Spalten (`repeat(auto-fit, minmax(240px, 1fr))`); desktop Display und Transport in der ersten Zeile, Step-Bereich unten. Die Flächen (Pad-Feld, Pattern, Tempo) liegen über Arbeitsfläche und Step-Bereich; Display und Transport bleiben sichtbar und bedienbar. Safe-Area-Abstände wie heute.

- [ ] **Step 1: Failing tests:** `shell.test.ts` neu: Reihenfolge der Bereiche; Start in Spur; Moduswechsel zeigt genau eine Arbeitsfläche; „Punch gehalten, Moduswechsel → punchOff“; „Layoutwechsel mobile→desktop→mobile: Seite bleibt, Rolle liegt in steps bzw. in der Noten-Seite, genau eine Rolle im Dokument“; „Mixer mobile: Spurwahl und Steps hidden“; Lauflicht- und dispose-Fälle bleiben. `keys.test.ts`: ↑/↓ über BD…SM mit Halt an den Enden; Leertaste, 1–8, F, T, ⌘-Kürzel wie bisher.
- [ ] **Step 2:** `npx vitest run --project ui shell keys` → FAIL.
- [ ] **Step 3:** Shell, CSS, Keys umbauen; alte Dateien, ihre Tests und die Übergangs-Zusammensetzungen löschen. Vor dem Löschen je alten Testfall prüfen, dass er in einem neuen Test weiterlebt.
- [ ] **Step 4:** `npm run lint && npm run typecheck && npm run test:unit` → PASS, Abdeckung ≥ 90 %.
- [ ] **Step 5:** Sichtprüfung im Browser-Panel (`npm run dev`) bei 390 × 660, 844 × 390, 820 × 1180, 1440 × 900; keine Konsolenfehler; kein Ton zurücklassen, Tab schließen.
- [ ] **Step 6:** Commit `ui: Rahmen „Ein Gerät“ ersetzt die lange Seite`.

### Task 12: E2E auf die neuen Orte

**Files:** Modify `tests/e2e/*.spec.ts`; Create `tests/e2e/nav.ts`

**Interfaces – Produces:** `openMode(page, name: 'Spur'|'Sound'|'Mixer'|'Song'|'Punch')`, `pickTrack(page, name: string)` (nutzt Spurtasten bzw. Pad-Feld je Projekt), `openPage(page, name: string)` (Reiter, falls nötig), `openPattern(page)`, `openTempo(page)`.

- [ ] **Step 1:** Helfer schreiben, dann Spec für Spec umstellen (app, keys, synth, sampler, mix-song, punch, stepopts, spielspass, project, host, compat, a11y). Jeder bisherige Testfall bleibt als Fall erhalten; nur die Wege ändern sich. `a11y`: axe je Modus und je offene Fläche.
- [ ] **Step 2:** `npx playwright test <spec>` je Datei → PASS auf allen fünf Projekten. Fehler in der App mit superpowers:systematic-debugging beheben, nie den Test abschwächen.
- [ ] **Step 3:** Commit `test: E2E für den neuen Rahmen`.

### Task 13: Passt-ohne-Scrollen, Touch-Ziele, Last

**Files:** Create `tests/e2e/fit.spec.ts`; Modify CSS nach Befund, `tests/e2e/screens.spec.ts` samt `__screenshots__`

- [ ] **Step 1: Failing tests** (`fit.spec.ts`, Projekt `mobile` mit `setViewportSize({width:390,height:660})`, übrige Projekte in ihrer Größe):
  - „Dokument scrollt nie“: für jeden Modus, je Spur BD, BA, SM jeder Reiter, jede offene Fläche: `scrollHeight <= innerHeight` und `scrollWidth <= innerWidth`.
  - „Mitte passt ohne Scrollen“ (alle Projekte außer `mobile-quer`): in `[data-area=work]` und `[data-area=steps]` gilt `scrollHeight <= clientHeight + 1`; ausgenommen die Vorlagen-Liste der Plattenkiste und die Song-Kette. Zusätzlich mit offenem Opt- und Sub-Editor auf Trig.
  - „Alles Sichtbare liegt im Bild“: jeder sichtbare Knopf und Regler hat seine Box vollständig im Viewport oder in einem ausgenommenen Scrollbereich.
  - „Touch-Ziele“: außer Desktop ist `min(Breite, Höhe) >= 44` für alle sichtbaren Knöpfe und Regler außerhalb `.step, .ss, .cell, .sb, .pc, .rl`; Desktop ≥ 32. Zeilen der Notenrolle mindestens 18 px hoch.
  - „Lange Namen“: eigenes Drum-Sample mit 60 Zeichen laden, Pad-Name 60 Zeichen → kein horizontaler Überlauf in Display, Spurwahl, Pads.
- [ ] **Step 2:** `npx playwright test fit` → FAIL mit Fundstellen.
- [ ] **Step 3:** CSS anpassen (Rolle füllt die Höhe, Regler-Raster, Opt-Panel kompakt). Passt eine Seite nicht, darf sie in Unterseiten geteilt werden (`viewsFor` bzw. Seiten-interne Reiter); als Ruling vermerken. Die Maße und die Ausnahmen im Test bleiben.
- [ ] **Step 4:** `npx playwright test` (alle) → PASS; `npm run bench` → Budget unverändert; `perf.spec` ohne Long Tasks.
- [ ] **Step 5:** `npx playwright test screens --update-snapshots`, Bilder ansehen. Größe in `build.spec.ts`: liegt `dist/index.html` über 200 000 B, Budget auf gemessene Größe plus 10 % setzen und im Kommentar begründen.
- [ ] **Step 6:** Commit `ui: passt ohne Scrollen; Tests für Maße und Touch-Ziele`.

### Task 14: Funktionsliste, README, Version

**Files:** Modify Funktionsliste, `README.md`, `CLAUDE.md` (Abschnitt UI), `package.json`, `package-lock.json`, `src/core/constants.ts`

- [ ] **Step 1:** Funktionsliste: je Zeile neue Spalte „Ort“ (Modus › Seite bzw. Fläche) und den neuen Testnamen; jede Zeile gegen die laufende App prüfen. Zeilen ohne Ort oder Test sind ein Fehler → beheben.
- [ ] **Step 2:** README (Bedienung je Layout, Architektur, Testzahlen aus den letzten Läufen, Projektstand, Roadmap, Stand-Datum) und CLAUDE.md-UI-Absatz (Nav, Rahmen, Plattenkiste statt Geräte-Halter) nachführen. Version 0.29.0 in `package.json`, Lockfile, `APP_VERSION`.
- [ ] **Step 3:** Voller Lauf: `npm run lint && npm run typecheck && npm run test:unit && npm run test:ref && npm run bench && npm run build && npx playwright test` → alles PASS.
- [ ] **Step 4:** Commit `docs: Oberfläche „Ein Gerät“, Version 0.29.0`.
- [ ] **Step 5:** Abschluss-Review des ganzen Branches, dann superpowers:finishing-a-development-branch. Nach dem Merge das Artifact aktualisieren und den Besitzer auf dem iPhone prüfen lassen.
