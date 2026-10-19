# Pocket 808 – Anweisungen für Claude Code

Mobile Drum-Machine im Stil der TR-808. Quelltext in `src/` (TypeScript, Vite), der Build erzeugt eine **einzelne `dist/index.html`** ohne Laufzeit-Abhängigkeiten. Seit Fundament Schritt 6 ist das die ausgelieferte App; die alte App liegt nur noch eingefroren als Test-Orakel in `tests/reference/legacy/oracle.html` (nie ändern, nie ausliefern). Hauptgerät des Besitzers ist ein **iPhone**. Alles muss dort performant und knackfrei laufen.

## Zusammenarbeit

- Sprache: Antworten und UI-Texte auf **Deutsch**. Hardware-Begriffe bleiben englisch (Level, Tune, Decay, Reverb, Cutoff, Reso).
- Schrittweise arbeiten und an wichtigen Stellen bestätigen lassen. Befehle erklären, bevor sie Wirkung haben.
- Projektstand sauber halten: keine Backups, Debug-Skripte oder temporären Dateien ins Repo. Kleine, einzelne Commits mit verständlicher Nachricht. Nie pushen oder force-pushen ohne Aufforderung.

## Design-Regeln (verbindlich)

- Minimal und flach: **keine Outlines, keine Schatten** (Ausnahme: Fokusring für Tastatur).
- Aktive Zustände bekommen einen **Glow** ("wie im Club"), über `box-shadow` mit Akzentfarbe. Aktive Elemente brauchen `z-index:1`, sonst verdeckt der nächste Nachbar den Glow.
- Sehr zurückgenommenes Farbklima: Neutrale Flächen plus **ein** gedämpfter Kupfer-Akzent. Keine neuen Farben einführen. Palette in `src/ui/styles/tokens.css` (`--chassis`, `--panel`, `--well`, `--cell`, `--ink`, `--ink-dim`, `--acc`, `--cream`); Abstufungen per `color-mix` aus diesen Farben.
- Touch zuerst (Layout ab 390 px Breite, kein horizontaler Scroll), große Ziele, `touch-action:none` auf Drag-Elementen, Tastaturbedienung und ARIA-Rollen bei Reglern.
- Nur Google Fonts als externe Ressource.

## Architektur

- Schichten: `src/core` (reine Logik, unveränderliche Funktionen, Datenmodell = Speicherformat) → `src/store` → `src/audio` / `src/ui` → `src/main.ts`. Die Schichtregel erzwingt ESLint. `core` ist gegen Legacy geprüft (`tests/reference/core-*.test.ts`: Referenzdateien, Fuzz, Modelltest, Scheduler-Sequenz).
- Produktionscode ohne `!`-Assertions: `must(wert, beschreibung)` aus `src/core/util.ts` wirft bei fehlenden Werten.
- Store (`src/store`): eigener Signals-Kern (`signals.ts`), Zustand als **ein** Wurzel-Signal (`store.ts`; Zurück als Stapel von höchstens 20 Schritten, `UNDO_DEPTH`, Option `undoDepth` für den Vergleich mit der alten App; Tap-Tempo `core/tap.ts` und `ui/tap.ts`), Änderungen nur über `core`-Funktionen bzw. Store-Befehle, feine Auswahl mit `store.select()`. Weil `core` unveränderte Teile teilt, benachrichtigt ein Step-Klick nur die betroffene Zelle (Test in `store.test.ts`). Der Zustand ist immer eingefroren (auch im Build). Speichern entprellt über `persistState` (`persist.ts`).
- Audio (`src/audio`): `createEngine({ store, createContext, … })` baut Kontext und Graph erst bei `prepare()`/`start()`, reagiert per Effekt auf Mixer, FX, Tempo, Synth-Pegel und Tune/Decay (Neu-Rendern entprellt) und plant mit dem Lookahead-Scheduler über die `core`-Funktionen. Lebenszyklus: Jede Bedien-Geste (Start, Vorhören, Stutter) ruft `onGesture` (iOS-Entsperren) und weckt den Kontext; `resume()` ist für jeden Pointerdown gedacht; `dispose()` stoppt, bricht Zeitgeber ab und schließt den Kontext. Offline-Renderings laufen über eine Warteschlange, nie parallel. Klang und Knotenzahl sind gegen die Legacy-Referenzen geprüft (`tests/reference/next-*.test.ts`). Rauschen startet sample-genau (Entscheidung 2026-10-14). Kontext, Offline-Kontext, Zeitquelle, Zeitgeber und Zufall sind für Tests austauschbar.
- UI (`src/ui`): ein Komponentenbaum aus kleinen DOM-Funktionen (`dom.ts`: `h`, `bind`, `listen`, Scope), feine Bindungen an `store.select()`. Layout-Signal (`layout.ts`) setzt `data-layout` (mobile < 768 px oder Telefon quer = Touch und Höhe < 600 px; tablet ≥ 768 px mit Touch oder < 1024 px; desktop ≥ 1024 px mit Maus); Anordnung nur in `styles/layout.css`. Die Reihenfolge der Cascade Layers steht in `index.html` (Komponenten-CSS lädt vor `app.css`). Geräte-Halter (`devices.ts`): Akkordeon, Tabs oder alle offen. Die UI bekommt Audio und Dateien über `UiContext` (`context.ts`), nie direkt. Tastaturkürzel nur auf dem Desktop (`keys.ts`). Synth-Gerät in `ui/panels/synth/` (Kopf, Roll mit Werkzeug Note/Akzent/Slide/Akkord, Module, Presets), Bedienlogik in `core/synth.ts`; Noten-Attribute `a`, `s`, `ch` (optional, Logik `core/notes.ts`), Akkorde paraphon in `audio/synth.ts` (`midis[]`), Slide gebunden und nur bei offenem Gate der Vorgängerin. Arp und LFO je Part als optionale Patch-Felder `arp`/`lfo` (`core/arp.ts`); Arp plant der Scheduler als Einzelnoten, LFO in `audio/lfo.ts` (ein Oszillator je Part, nur bei Depth > 0, auf `detune` gelegt und am Notenende gelöst). Sampler-Gerät in `ui/panels/sampler/` (Chop-Segment `chop.ts`, Tastatur `keyboard.ts`), Bedienlogik in `core/sampler.ts`; Chop in `core/chop.ts` (optional `Pad.sl`, Slice `k` und Pitch `n` in den Step-Optionen nur für Pads, Slices statt Kopien, Engine rechnet sie ohne neue Knoten in `schedulePad`), Pad-Samples in der SampleBank, Aufnahme über `platform/recorder.ts`. Mixer und FX in `ui/panels/mixer/` (Logik `core/mixer.ts`), Song (`ui/panels/song.ts`) und Vorlagen/Werkzeuge (`ui/panels/patterns.ts`) als eigene Bereiche. Desktop: Spalte 1 aus den Wrappern `.col-main` (Editor, Spuren) und `.col-extra` (Song, Vorlagen), sonst `display: contents`; Geräte in zwei CSS-Spalten; Kopfleiste sticky. Die DOM-Reihenfolge ist die Mobile-Reihenfolge. Datei-Knopf mit Dialog in `ui/panels/project/` (Projekt sichern/öffnen, WAV-Export); Logik in `core/project.ts` (Datei), `core/wav.ts`, `core/export.ts`; Offline-Rendern über eine eigene Engine-Instanz in `audio/export.ts`; Teilen bzw. Download in `platform/share.ts`. Projekt öffnen ersetzt Zustand und Samples (`store.replaceState` mit Zurück, `SampleBank.replaceAll`). `APP_VERSION` in `core/constants.ts` muss zu `package.json` passen (Werkzeugtest). Step-Optionen (Velocity, Chance, Bedingung) in `core/stepopts.ts`, im Pattern als optionales `opt` (fehlt, solange leer: alte Stände bleiben bytegleich); Engine zählt Durchläufe je Slot ab Start; Opt-Panel `ui/panels/step-opts.ts` für Drums und Sampler. Parameter-Locks (`t`, `d`, `s` in den Step-Optionen): Drums spielen vorgerenderte Varianten aus einem LRU-Cache (64, `drums.ts`), Pads rechnen live; Fill über `engine.setFill`, Haltetasten über `ui/controls/hold.ts` (nie hängend). Punch-Gerät `ui/panels/punch/` (Effekte im Graphen `punchOn/punchOff`, erst bei Benutzung angelegt; ersetzende Effekte schließen sich in der Engine aus). Automation immer mit Anker (`rampFrom` in `audio/params.ts`: halten, setValueAtTime, Rampe; der Graph führt den geplanten Verlauf jeder Blende, damit der Startwert stimmt): Rampen ohne Anker beginnen beim letzten Ereignis; node-web-audio-api verrechnet Halten plus Rampe sowie setTargetAtTime nach cancelAndHold falsch. Deshalb hat `stutterRelease` für die neue Engine einen eigenen Fingerabdruck (`golden/mix-next/`). Test-Parameter mit echter Automation: `audio/test-utils.ts` (`simParam`). Bounce: `UiAudio.bounce` über `renderOffline` und `toPcm`. LCD-Streifen `ui/panels/lcd-scope.ts` (Analyser im Graphen erst bei Bedarf, `engine.scope`, Zeichnen nur beim Spielen); Würfel `core/vary.ts`; Szenen `core/scenes.ts` (optional `State.scenes`, nur Pegel/Mute/Solo, Abruf mit Zurück). Raster-Spalten immer mit `minmax(0, …)`. Geräte-Bereichsnamen (`grid-area: synth` usw.) nur im Desktop-Raster setzen. Eigene Drum-Samples liegen in `store/samples.ts` (SampleBank).
- Plattform (`src/platform`): iOS-Entsperren, Wake Lock, Lebenszyklus, Artifact-Host, Dateiauswahl; nur `core`-Importe, Abhängigkeiten werden übergeben.
- Build: `npm run dev` (Dev-Server), `npm run build` (→ `dist/index.html`). `/next/` leitet per `vercel.json` auf `/` um. E2E in `tests/e2e/` (Projekte `mobile`, `mobile-quer`, `tablet`, `tablet-quer`, `desktop`). Funktionsliste: `docs/superpowers/specs/2026-10-14-ui-funktionsliste.md`.
- Persistenz: `localStorage` unter `pocket808.v1` (Zustand) und `pocket808.smp.v1` (Samples). Immer in try/catch. Beim Laden läuft alles durch `merge()`: neue Felder brauchen Defaults und eine **Migration alter Speicherstände** (Beispiel: der frühere Synth-Regler `sus` wird zu den Hüllkurven umgerechnet).
- Zustand: `State` aus `src/core/types.ts` (= Speicherformat), im Store als Signal; gespeichert wird automatisch entprellt.
- Audio-Kette: Stimmen → Kanalzug (`chan[id]`: Gain → StereoPanner) → `bus` → DJ-Filter (LP/HP) → Kompressor → Soft-Clip → Master-Gain → Limiter → Sicherheits-Shaper → Ausgang. Sends: Reverb (Convolver mit erzeugter Impulsantwort) und tempo-synchrones Delay für die Synth-Stimmen. Der Master-Pegel ist auf Spitze ≈ 0,77 abgestimmt. Bei Änderungen nachmessen (`tests/reference/mix.test.ts`, Szenario `demo`).
- Scheduler: Lookahead (`setInterval` 25 ms, Vorlauf 0,2 s), Noten werden auf `ctx.currentTime` geplant.
- Drums: Die zehn Stimmen werden **offline vorgerendert** (`renderVoice`/`prerenderAll`, nacheinander, nicht parallel) und beim Spielen nur als Buffer abgespielt. Level wirkt live, Tune/Decay rechnen kurz neu (`queueRerender`).
- Start: `engine.prepare()` (in `main.ts`) baut Kontext, Graph und Vorrechnen schon beim Laden (suspendiert). Der Start-Tipp ruft nur noch `resume()`. Keine schwere Arbeit im Tipp-Handler.
- Synth (Bass `BA`, Lead `LD`): SH-101-Module Oszillator, Filter, Filter-Env und Amp-Env (ADSR, Parameter `fa fd fs fr` / `aa ad as ar`, alle 0..1, Zeiten über `tA/tD/tR`). Pro Part **monophon**: Eine neue Note schneidet die vorherige per `killVoice` kurz ab. Presets in `SYN_PRESETS`.
- iOS: `createIosUnlock()` in `platform/ios.ts` (stilles Audio-Element, damit Web Audio dem Stumm-Schalter nicht folgt), `audioSession.type='playback'`, Resume bei jedem Pointerdown, falls der Kontext nicht läuft.

## Performance (immer beachten)

- Pro Treffer/Note so wenige Knoten wie möglich. Keine schweren Graphen pro Hit, Dinge lieber einmal vorrechnen.
- Keine dauerhaft laufenden Knoten ohne Grund. Nichts Schweres im Eingabe-Handler oder im Scheduler.
- Nach Engine-Änderungen `npm run bench` ausführen (Demo und Worst-Case dürfen nicht spürbar teurer werden).
- Teure CSS-Effekte (große Blur-Radien, `filter`) sparsam einsetzen.

## Entwickeln und testen

```sh
nvm use               # Node 24 laut .nvmrc
npm install
npm test              # alles: Unit, Referenz, Bench, E2E
npm run test:unit     # schnell: Unit- und Werkzeugtests
npm run test:ref      # Referenz: Klang-Fingerabdrücke und Speicherstände gegen die alte App (Orakel)
npm run test:e2e      # Playwright auf Mobile, Tablet, Desktop
npm run bench         # Performance-Budget (Knoten/s, Renderzeit)
npm run lint && npm run typecheck
npm run dev           # Vite-Dev-Server
npm run build         # dist/index.html (eine Datei)
```

- Referenzen neu erzeugen nur bewusst: `npm run ref:update`, `npm run bench:update`, `npx playwright test screens --update-snapshots`. Danach den Diff prüfen.
- Klang-Toleranzen stehen in `tests/reference/tolerance.ts` und sind kalibriert (`tests/reference/calibration.test.ts`).
- Audio-Tests laufen je Szenario in einem eigenen Kindprozess (`tests/reference/run.ts`).
- Der Git-Hook (vor jedem Commit) prüft Lint, Typen, Unit- und Referenztests.

- Referenztests laden die eingefrorene alte App (`tests/reference/legacy/oracle.html`) in jsdom (`tests/reference/legacy/harness.ts`) und rendern Audio mit `node-web-audio-api` offline, je Szenario in einem eigenen Prozess (die Bibliothek ist bei mehreren Kontexten pro Prozess launisch).
- Neue Logik testgetrieben in `src/**/*.test.ts`; Abdeckung ≥ 90 % pro Datei wird von `npm run test:unit` erzwungen. Eigenschafts- und Modelltests mit fast-check per Mutationsprüfung kontrollieren (absichtlich Fehler einbauen, Test muss rot werden).
- Visuelle Prüfung: Chromium/Playwright, Viewport 390 × 844.
- Offline erscheint ein Konsolenfehler für die Google Fonts. Das ist harmlos.

## README (lebendes Dokument)

`README.md` erklärt die Technik ausführlich und soll Lust auf das Produkt machen. Sie wird **mit jeder Änderung mitgepflegt**: Funktionen, Architektur, Testzahlen, Projektstand-Tabelle, Befehle, Roadmap und das Datum „Stand“ oben. Ein Schritt ist erst fertig, wenn die README stimmt.

## Veröffentlichung

Live: Jeder Push nach `main` wird von Vercel ausgeliefert (https://pocket-808.vercel.app, Build `npm run build`). `dist/index.html` (nach `npm run build`) wird zusätzlich als Claude-Artifact veröffentlicht (`<title>` "Pocket 808", https://claude.ai/artifact/XvHhCwsXvL9NmUdvxv2vxe, Capability `downloads: true`). Sichern läuft dort über `claude.use("downloads")` (`platform/share.ts`); nicht erlaubte Endungen wie `.wav` werden als ZIP verpackt (`platform/zip.ts`). Das Artifact hängt nicht automatisch am Repo und muss separat aktualisiert werden.

## Roadmap (in dieser Reihenfolge, je Etappe fertig, testen, bestätigen lassen)

1. ~~Mixer und FX~~
2. ~~Projekt speichern/laden (JSON, `.pocket808.json`), Audio-Export (WAV)~~ (MP3 bei Bedarf später)
3. ~~Velocity/Accent, Wahrscheinlichkeit und Bedingungen pro Step~~
4. ~~Performance (Teenage-Engineering-Ideen): 4a Fill-Taste und Parameter-Locks; 4b Punch-in-FX zum Halten, Bounce aufs Pad~~
5. ~~Spielspaß: animiertes LCD (OP-1), Würfel/Variationen (Tombola), Mixer-/Mute-Szenen (OP-XY)~~
6. ~~Synth: Akkorde, Arpeggiator, Slide/Accent, LFO~~
7. ~~Sampler: Chop-Modus, melodische Tastatur, Pitch pro Step~~
8. Live-Aufnahme mit Count-in (8b), Pattern-Länge 8–32 (8c); ~~Tap-Tempo, mehrstufiges Undo~~ (8a)

Außerdem geplant: **wärmerer, analoger Klang**, umschaltbar ("Warm" an/aus), damit sich A/B vergleichen lässt:
24-dB-Filter (zwei Biquads), sanfte Sättigung vor dem Filter, leichtes Driften über einen gemeinsamen langsamen LFO, 808-Hats mit Bandpässen, kleine Zufallsschwankungen pro Treffer.
