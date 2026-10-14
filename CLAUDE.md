# Pocket 808 – Anweisungen für Claude Code

Mobile Drum-Machine im Stil der TR-808. Quelltext in `src/` (TypeScript, Vite), der Build erzeugt eine **einzelne `dist/index.html`** ohne Laufzeit-Abhängigkeiten. Bis zur Umstellung (Fundament Schritt 6) ist `legacy/index.html` die ausgelieferte App. Hauptgerät des Besitzers ist ein **iPhone**. Alles muss dort performant und knackfrei laufen.

## Zusammenarbeit

- Sprache: Antworten und UI-Texte auf **Deutsch**. Hardware-Begriffe bleiben englisch (Level, Tune, Decay, Reverb, Cutoff, Reso).
- Schrittweise arbeiten und an wichtigen Stellen bestätigen lassen. Befehle erklären, bevor sie Wirkung haben.
- Projektstand sauber halten: keine Backups, Debug-Skripte oder temporären Dateien ins Repo. Kleine, einzelne Commits mit verständlicher Nachricht. Nie pushen oder force-pushen ohne Aufforderung.

## Design-Regeln (verbindlich)

- Minimal und flach: **keine Outlines, keine Schatten** (Ausnahme: Fokusring für Tastatur).
- Aktive Zustände bekommen einen **Glow** ("wie im Club"), über `box-shadow` mit Akzentfarbe. Aktive Elemente brauchen `z-index:1`, sonst verdeckt der nächste Nachbar den Glow.
- Sehr zurückgenommenes Farbklima: Neutrale Flächen plus **ein** gedämpfter Kupfer-Akzent. Keine neuen Farben einführen. Palette in `:root` (`--chassis`, `--panel`, `--well`, `--cell`, `--ink`, `--ink-dim`, `--acc`, `--cream`). Der Block "Club-Look" und "Zurückgenommenes Farbklima" am Ende des `<style>` überschreibt ältere Regeln.
- Touch zuerst (Layout ab 390 px Breite, kein horizontaler Scroll), große Ziele, `touch-action:none` auf Drag-Elementen, Tastaturbedienung und ARIA-Rollen bei Reglern.
- Nur Google Fonts als externe Ressource.

## Architektur

- Schichten: `src/core` (reine Logik, unveränderliche Funktionen, Datenmodell = Speicherformat) → `src/store` → `src/audio` / `src/ui` → `src/main.ts`. Die Schichtregel erzwingt ESLint. `core` ist gegen Legacy geprüft (`tests/reference/core-*.test.ts`: Referenzdateien, Fuzz, Modelltest, Scheduler-Sequenz).
- Produktionscode ohne `!`-Assertions: `must(wert, beschreibung)` aus `src/core/util.ts` wirft bei fehlenden Werten.
- Store (`src/store`): eigener Signals-Kern (`signals.ts`), Zustand als **ein** Wurzel-Signal (`store.ts`), Änderungen nur über `core`-Funktionen bzw. Store-Befehle, feine Auswahl mit `store.select()`. Weil `core` unveränderte Teile teilt, benachrichtigt ein Step-Klick nur die betroffene Zelle (Test in `store.test.ts`). Der Zustand ist immer eingefroren (auch im Build). Speichern entprellt über `persistState` (`persist.ts`).
- Audio (`src/audio`): `createEngine({ store, createContext, … })` baut Kontext und Graph erst bei `prepare()`/`start()`, reagiert per Effekt auf Mixer, FX, Tempo, Synth-Pegel und Tune/Decay (Neu-Rendern entprellt) und plant mit dem Lookahead-Scheduler über die `core`-Funktionen. Lebenszyklus: Jede Bedien-Geste (Start, Vorhören, Stutter) ruft `onGesture` (iOS-Entsperren) und weckt den Kontext; `resume()` ist für jeden Pointerdown gedacht; `dispose()` stoppt, bricht Zeitgeber ab und schließt den Kontext. Offline-Renderings laufen über eine Warteschlange, nie parallel. Klang und Knotenzahl sind gegen die Legacy-Referenzen geprüft (`tests/reference/next-*.test.ts`). Rauschen startet sample-genau (Entscheidung 2026-10-14). Kontext, Offline-Kontext, Zeitquelle, Zeitgeber und Zufall sind für Tests austauschbar.
- UI (`src/ui`): ein Komponentenbaum aus kleinen DOM-Funktionen (`dom.ts`: `h`, `bind`, `listen`, Scope), feine Bindungen an `store.select()`. Layout-Signal (`layout.ts`) setzt `data-layout` (mobile < 768 px; tablet ≥ 768 px mit Touch oder < 1024 px; desktop ≥ 1024 px mit Maus); Anordnung nur in `styles/layout.css`. Die Reihenfolge der Cascade Layers steht in `index.html` (Komponenten-CSS lädt vor `app.css`). Geräte-Halter (`devices.ts`): Akkordeon, Tabs oder alle offen. Die UI bekommt Audio und Dateien über `UiContext` (`context.ts`), nie direkt. Tastaturkürzel nur auf dem Desktop (`keys.ts`). Eigene Drum-Samples liegen in `store/samples.ts` (SampleBank).
- Plattform (`src/platform`): iOS-Entsperren, Wake Lock, Lebenszyklus, Artifact-Host, Dateiauswahl; nur `core`-Importe, Abhängigkeiten werden übergeben.
- Übergang: `npm run dev` und `npm run build:next` (→ `dist-next/`) für die neue App; `npm run build` liefert bis Schritt 6 `legacy/` nach `dist/` und die neue App nach `dist/next/` (live unter `/next/`). E2E der neuen App in `tests/e2e-next/` (Projekte `next-*`). Funktionsliste: `docs/superpowers/specs/2026-10-14-ui-funktionsliste.md`.
- Persistenz: `localStorage` unter `pocket808.v1` (Zustand) und `pocket808.smp.v1` (Samples). Immer in try/catch. Beim Laden läuft alles durch `merge()`: neue Felder brauchen Defaults und eine **Migration alter Speicherstände** (Beispiel: der frühere Synth-Regler `sus` wird zu den Hüllkurven umgerechnet).
- Zustand: `State` aus `src/core/types.ts` (= Speicherformat), im Store als Signal; gespeichert wird automatisch entprellt.
- Audio-Kette: Stimmen → Kanalzug (`chan[id]`: Gain → StereoPanner) → `bus` → DJ-Filter (LP/HP) → Kompressor → Soft-Clip → Master-Gain → Limiter → Sicherheits-Shaper → Ausgang. Sends: Reverb (Convolver mit erzeugter Impulsantwort) und tempo-synchrones Delay für die Synth-Stimmen. Der Master-Pegel ist auf Spitze ≈ 0,77 abgestimmt. Bei Änderungen nachmessen (`tests/reference/mix.test.ts`, Szenario `demo`).
- Scheduler: Lookahead (`setInterval` 25 ms, Vorlauf 0,2 s), Noten werden auf `ctx.currentTime` geplant.
- Drums: Die zehn Stimmen werden **offline vorgerendert** (`renderVoice`/`prerenderAll`, nacheinander, nicht parallel) und beim Spielen nur als Buffer abgespielt. Level wirkt live, Tune/Decay rechnen kurz neu (`queueRerender`).
- Start: `mkAudio()`/`warmAudio()` bauen Kontext, Graph und Vorrechnen schon beim Laden (suspendiert). Der Start-Tipp ruft nur noch `resume()`. Keine schwere Arbeit im Tipp-Handler.
- Synth (Bass `BA`, Lead `LD`): SH-101-Module Oszillator, Filter, Filter-Env und Amp-Env (ADSR, Parameter `fa fd fs fr` / `aa ad as ar`, alle 0..1, Zeiten über `tA/tD/tR`). Pro Part **monophon**: Eine neue Note schneidet die vorherige per `killVoice` kurz ab. Presets in `SYN_PRESETS`.
- iOS: `unlockIOS()` (stilles Audio-Element, damit Web Audio dem Stumm-Schalter nicht folgt), `audioSession.type='playback'`, Resume bei jedem Pointerdown, falls der Kontext nicht läuft.

## Performance (immer beachten)

- Pro Treffer/Note so wenige Knoten wie möglich. Keine schweren Graphen pro Hit, Dinge lieber einmal vorrechnen.
- Keine dauerhaft laufenden Knoten ohne Grund. Nichts Schweres im Eingabe-Handler oder im Scheduler.
- Nach Engine-Änderungen `npm run bench` ausführen (Demo und Worst-Case dürfen nicht spürbar teurer werden).
- Teure CSS-Effekte (große Blur-Radien, `filter`) sparsam einsetzen.

## Entwickeln und testen

```sh
nvm use               # Node 24 laut .nvmrc
npm install
npm test              # alles: Unit, Referenz, E2E, alte Tests
npm run test:unit     # schnell: Unit- und Werkzeugtests
npm run test:ref      # Referenz: Klang-Fingerabdrücke und Speicherstände gegen legacy/
npm run test:e2e      # Playwright auf Mobile, Tablet, Desktop
npm run bench         # Performance-Budget (Knoten/s, Renderzeit)
npm run lint && npm run typecheck
npm run dev           # Vite-Dev-Server der neuen App (Schritt 5)
npm run dev:legacy    # Dev-Server der alten App
npm run build         # dist/index.html (Legacy) + dist/next/index.html (neue App)
npm run build:next    # nur die neue App nach dist-next/ (E2E-Projekte next-*)
```

- Referenzen neu erzeugen nur bewusst: `npm run ref:update`, `npm run bench:update`, `AXE_UPDATE=1 npx playwright test a11y`, `npx playwright test layout --update-snapshots`. Danach den Diff prüfen.
- Klang-Toleranzen stehen in `tests/reference/tolerance.ts` und sind kalibriert (`tests/reference/calibration.test.ts`).
- Audio-Tests laufen je Szenario in einem eigenen Kindprozess (`tests/reference/run.ts`).
- Der Git-Hook (vor jedem Commit) prüft Lint, Typen, Unit- und Referenztests.

- Übergangsphase: Die App liegt unverändert in `legacy/index.html`, die alten Tests in `legacy/tests/`. Neue Werkzeuge und Referenztests kommen schrittweise dazu, siehe `docs/superpowers/plans/`.

- Referenztests laden `legacy/index.html` in jsdom (`tests/reference/legacy/harness.ts`) und rendern Audio mit `node-web-audio-api` offline, je Szenario in einem eigenen Prozess (die Bibliothek ist bei mehreren Kontexten pro Prozess launisch).
- Neue Logik testgetrieben in `src/**/*.test.ts`; Abdeckung ≥ 90 % pro Datei wird von `npm run test:unit` erzwungen. Eigenschafts- und Modelltests mit fast-check per Mutationsprüfung kontrollieren (absichtlich Fehler einbauen, Test muss rot werden).
- Visuelle Prüfung: Chromium/Playwright, Viewport 390 × 844.
- Offline erscheint ein Konsolenfehler für die Google Fonts. Das ist harmlos.

## README (lebendes Dokument)

`README.md` erklärt die Technik ausführlich und soll Lust auf das Produkt machen. Sie wird **mit jeder Änderung mitgepflegt**: Funktionen, Architektur, Testzahlen, Projektstand-Tabelle, Befehle, Roadmap und das Datum „Stand“ oben. Ein Schritt ist erst fertig, wenn die README stimmt.

## Veröffentlichung

Live: Jeder Push nach `main` wird von Vercel ausgeliefert (https://pocket-808.vercel.app, Build `npm run build`). `dist/index.html` (nach `npm run build`) wird zusätzlich als Claude-Artifact veröffentlicht (`<title>` "Pocket 808"). Das Artifact hängt nicht automatisch am Repo und muss separat aktualisiert werden.

## Roadmap (in dieser Reihenfolge, je Etappe fertig, testen, bestätigen lassen)

1. ~~Mixer und FX~~
2. Projekt speichern/laden (JSON, `.pocket808.json`), Audio-Export (WAV/MP3)
3. Velocity/Accent, Wahrscheinlichkeit und Bedingungen pro Step
4. Synth: Akkorde, Arpeggiator, Slide/Accent, LFO
5. Sampler: Chop-Modus, melodische Tastatur, Pitch pro Step
6. Live-Aufnahme, Pattern-Länge 8–32, Tap-Tempo und Count-in, mehrstufiges Undo

Außerdem geplant: **wärmerer, analoger Klang**, umschaltbar ("Warm" an/aus), damit sich A/B vergleichen lässt:
24-dB-Filter (zwei Biquads), sanfte Sättigung vor dem Filter, leichtes Driften über einen gemeinsamen langsamen LFO, 808-Hats mit Bandpässen, kleine Zufallsschwankungen pro Treffer.
