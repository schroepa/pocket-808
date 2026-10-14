# Teilprojekt 1: Technisches Fundament – Design

Stand: 2026-10-13 · Branch: `fundament`

## Ziel

Pocket 808 bekommt ein modernes, zukunftssicheres und durchgehend getestetes Fundament. Das heutige Single-File-Script (eine Funktion mit rund 1.870 Zeilen in `index.html`) wird schrittweise in typisierte Module überführt.

**Teilprojekt 1 ändert nichts Sichtbares und nichts Hörbares.** Klang, Verhalten, Aussehen und Speicherstände bleiben identisch. So lässt sich jede Abweichung eindeutig dem Umbau zuordnen.

> **Änderung vom 2026-10-14 (Entscheidung des Besitzers):**
> - Schritt 5 (UI) und Teilprojekt 2 (drei Layouts) werden **zusammengelegt**: Die Oberfläche wird direkt in TypeScript mit den Layouts für Desktop, Tablet und Mobile gebaut, ohne vorherigen 1:1-Port. Der Pixel-Vergleich mit Legacy entfällt; Funktions-, Barrierefreiheits- und Screenshot-Tests je Breakpoint bleiben. Für Schritt 5 gibt es eine eigene Spezifikation (Layouts).
> - **Rauschen beheben:** Legacy startet den Rauschpuffer bei einem zufälligen Bruchteil-Versatz; durch Interpolation klingen Snare, Clap und Rim Shot pro Seitenaufruf zufällig heller oder dumpfer (bis ~3 dB). Die neue Engine startet sample-genau. Nur die Klang-Referenzen dieser drei Stimmen und davon abhängige Mix-Szenarien werden bewusst neu erzeugt; hier gilt „hörbar gleich“ nicht.
> - **Store friert den Zustand immer ein**, nicht nur im Entwicklungsmodus.

Einordnung in das Gesamtvorhaben:

1. **Technisches Fundament** (dieses Dokument)
2. Responsive Layouts für drei Breakpoints (Desktop, Tablet, Mobile), je mit eigenem, angepasstem Layout
3. Roadmap-Funktionen (Speichern/Laden, Export, Velocity …) auf dem neuen Fundament

Jedes Teilprojekt bekommt eine eigene Spezifikation.

## Entscheidungen

| Thema | Entscheidung |
|---|---|
| Sprache, Build | TypeScript + ES-Module, Vite. Ausgabe: **eine eigenständige `dist/index.html`** (vite-plugin-singlefile) |
| Oberfläche | Vanilla TypeScript ohne Framework, eigener kleiner Signals-Store |
| Migration | Schrittweise portieren, abgesichert durch Referenztests gegen den alten Code |
| Browser | Baseline 2024: Safari/iOS 17+, Chrome/Edge 120+, Firefox 121+ |
| Laufzeit-Abhängigkeiten | keine. Einzige externe Ressource: Google Fonts |

## 1. Struktur und Schichten

```
src/
  core/      reine Logik, kein DOM, kein Audio
  store/     Signals-Store + Persistenz
  audio/     Audio-Engine
  ui/        Komponenten, Panels, Layout-Steuerung, CSS
  platform/  Browser-Sonderfälle und Host-Schnittstellen
  main.ts    Verdrahtung
```

### core

Konstanten (Stimmen `VOICES`, Skalen, `PRESETS`, `SYN_PRESETS`, Seeds, Kanalliste), Zustandstypen, Defaults, `merge()` mit allen Migrationen alter Speicherstände (u. a. `sus` → Hüllkurven, Synth-Stumm-Schalter → Mixer), Pattern-Operationen (Toggle, Sub-Steps, Kopieren/Einfügen, Song-Kette), Musiktheorie (`degMidi`, Skalenstufen, Notennamen), Timing (Step-Zeiten, Swing, effektive Notenlänge).

### store

- Eigene Signals-Implementierung (`signal`, `computed`, `effect`, `batch`), Ziel ~100 Zeilen, vollständig getestet.
- Zustand als Baum von Signals oder als ein Signal mit gezielten Selektoren. Die Details klärt der Implementierungsplan, Maßstab ist: Eine Änderung an einem Step aktualisiert nur die betroffene Zelle.
- Persistenz über einen austauschbaren Speicher-Adapter (`localStorage` im Browser, In-Memory im Test). Gespeichert wird entprellt, alle Zugriffe laufen in try/catch.
- **Schlüssel und Format bleiben unverändert:** `pocket808.v1` (Zustand), `pocket808.smp.v1` (Samples, 22,05-kHz-Mono-PCM als Base64).

### audio

Kontext-Lebenszyklus (anlegen beim Laden im Zustand suspended, `resume()` beim Start-Tipp), Master-Kette (Bus → DJ-Filter LP/HP → Kompressor → Soft-Clip → Master-Gain → Limiter → Sicherheits-Shaper), Kanalzüge (Gain → StereoPanner), Sends (Reverb mit erzeugter Impulsantwort, tempo-synchrones Delay), Drum-Synthese mit Offline-Vorrendern (nacheinander, Reihenfolge wie heute) und Neuberechnung bei Tune/Decay, Synth-Stimme (monophon, `killVoice`, ADSR), Sampler, Stutter, Lookahead-Scheduler (25 ms Intervall, 0,2 s Vorlauf).

Die Engine bekommt eine **injizierbare Zeitquelle und einen injizierbaren Kontext-Erzeuger**, damit Tests ohne Überschreiben von `currentTime` auskommen.

Nach außen bietet die Engine eine schmale, typisierte Schnittstelle, z. B. `start()`, `stop()`, `audition(voice)`, `auditionNote(part, deg, len)`, `stutterOn(frac)`, `stutterOff()`, plus Ereignisse für die Anzeige (aktueller Step). Mischpult- und FX-Werte liest sie aus dem Store.

### ui

Komponenten (Knob, Slider, Step-Raster, Piano-Roll, Kanalzug, Pattern-Slots, Song-Kette, Sub-Step-Editor, Wellenform, Hüllkurvenanzeige …), Panels (Drums, Synth, Sampler, Mixer/FX), Rack-Steuerung (ein-/ausklappen). Jede Komponente bekommt ihre CSS-Datei direkt neben dem TS-Code. Bedienbarkeit wie heute: Touch zuerst, `touch-action:none` auf Drag-Elementen, Tastatur und ARIA-Rollen bei Reglern.

### platform

iOS-Entsperren (stilles Audio-Element, `audioSession.type='playback'`), Resume nach Unterbrechung (`interrupted`), Wake Lock, Datei-Ein-/Ausgabe (Sample-Import, Mikrofon-Aufnahme), Artifact-Host-Schnittstelle (`window.claude.hot`: `snapshot`, `ready`, `data`).

### Abhängigkeitsregel

Per ESLint erzwungen:

- `core` importiert nichts aus anderen Schichten.
- `store` importiert nur `core`.
- `audio` und `ui` importieren `core` und `store`, **aber nicht einander**.
- `platform` darf von `audio` und `ui` genutzt werden, importiert selbst nur `core`.
- Nur `main.ts` kennt alle Schichten.

## 2. Teststrategie

| Ebene | Werkzeug | Gegenstand |
|---|---|---|
| 1. Referenz | Vitest + node-web-audio-api | heutiges Verhalten als Fingerabdruck gegen `legacy/index.html` |
| 2. Unit | Vitest | `core`, `store` |
| 3. Engine | Vitest + node-web-audio-api | Offline-Rendering der Engine |
| 4. Komponenten | Vitest Browser Mode (Playwright: Chromium, WebKit) | UI-Komponenten mit Pointer-, Touch- und Tastatureingaben |
| 5. End-to-End | Playwright | gebaute `dist/index.html` auf drei Viewports |

### Referenztests

- **Klang:** Offline gerendert werden jede der zehn Drum-Stimmen (Standardwerte sowie Tune/Decay an den Extremen), jedes Synth-Preset, jedes Fabrik-Sample und die heutigen Mix-Szenarien (`tests/mix-scn.js`). Fingerabdruck: Spitzenwert, RMS-Verlauf in 10-ms-Fenstern, spektraler Schwerpunkt. Vergleich mit Toleranz, nicht bit-genau. Die Toleranzen legt der Plan fest, Maßstab: hörbare Änderungen fallen auf, Fließkomma-Rauschen nicht.
- **Master-Pegel:** Spitze ≈ 0,77 im Demo-Szenario bleibt erhalten.
- **Speicherstände:** Testdaten mit alten Formaten (u. a. Feld `sus`, alter Synth-Stumm-Schalter, fehlende Felder) laufen durch `merge()`. Das Ergebnis wird als Snapshot festgehalten. Der neue `merge()` muss identische Ergebnisse liefern.
- **Bench:** Ausgangswerte für Demo und Worst-Case werden festgehalten.
- **Layout:** Screenshots des heutigen Layouts bei 390 × 844 dienen als Vergleich für Schritt 5.

### Abdeckung und Budgets

- Mindestens **90 % Abdeckung** (Zeilen und Zweige) in `core` und `store`, in der Vitest-Konfiguration als Schwelle erzwungen.
- **Performance-Budgets** als Tests: Render-Last Demo und Worst-Case nicht über den Ausgangswerten (plus kleine Messtoleranz). Größe der gebauten `dist/index.html` mit fester Obergrenze, Wert aus dem Ausgangsstand plus Puffer.
- **Barrierefreiheit:** axe-core-Prüfung in den End-to-End-Tests ohne Verstöße der Stufen „serious“ und „critical“.
- Jede Testdatei mit Audio läuft in einem eigenen Prozess (Vitest `pool: 'forks'`, Isolation pro Datei).

### End-to-End-Viewports

| Name | Größe | Engine |
|---|---|---|
| Mobile | 390 × 844 | WebKit (iPhone-Emulation) |
| Tablet | 820 × 1180 | WebKit |
| Desktop | 1440 × 900 | Chromium |

In Teilprojekt 1 wird das bestehende Layout auf allen drei Viewports geprüft (funktioniert, kein horizontaler Scroll). Die eigens angepassten Layouts kommen in Teilprojekt 2.

### Arbeitsweise

- Neue Funktionen testgetrieben (erst Test, dann Code). Portierter Code wird durch Referenz- und Unit-Tests abgesichert.
- Git-Hook vor jedem Commit: Lint, Typprüfung, Unit-Tests (Ebenen 1–2).
- `npm test` führt alle Ebenen aus. Dazu getrennte Skripte pro Ebene.

## 3. Werkzeuge, Standards und Build

- **TypeScript** `strict` plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`.
- **ESLint** Flat Config mit `typescript-eslint` (strict, type-checked) und der Schichtregel. **Prettier** für die Formatierung.
- **Node** aktuelle LTS, festgehalten in `.nvmrc` und `package.json` (`engines`). Git-Hook über `simple-git-hooks`.
- **CSS** ohne Präprozessor:
  - Cascade Layers: `@layer reset, tokens, base, components, layout`. Ersetzt den heutigen Überschreib-Block am Ende des Stylesheets.
  - Design-Tokens in `src/ui/tokens.css`: bestehende Palette (`--chassis`, `--panel`, `--well`, `--cell`, `--ink`, `--ink-dim`, `--acc`, `--cream`) sowie Abstände, Größen und Glow.
  - CSS Nesting, `dvh`, Container Queries.
  - Design-Regeln unverändert: flach, keine Outlines und Schatten außer Fokusring, Glow für aktive Zustände (mit `z-index:1`), keine neuen Farben.
- **Vite**: Dev-Server mit Hot Reload. `build.target` = `['safari17', 'chrome120', 'firefox121']`. `npm run build` → `dist/index.html` mit eingebettetem CSS und JS. `dist/` steht in `.gitignore`.

### Bewusst nicht in Teilprojekt 1

- **AudioWorklet:** Wird erst geprüft, wenn eine Funktion es braucht (Warm-Klang, Live-Aufnahme).
- **PWA/Offline-Installation:** Wäre eine eigene Entscheidung, da sie Zusatzdateien erfordert.
- **Neues Layout oder neue Funktionen:** Teilprojekte 2 und 3.

## 4. Ablauf

Alle Arbeit auf dem Branch `fundament`. Bis Schritt 6 bleibt die alte `index.html` die lauffähige App. Nach jedem Schritt: kleine, einzelne Commits, Bestätigung durch den User vor dem nächsten Schritt.

| Schritt | Inhalt | Abgesichert durch |
|---|---|---|
| 0. Gerüst | Vite, TS, ESLint, Prettier, Vitest, Playwright, Git-Hook. `index.html` → `legacy/index.html`. Alte Tests auf den neuen Pfad umstellen. | Build, Lint, alte Tests laufen |
| 1. Referenztests | Klang-Fingerabdrücke, `merge()`-Snapshots, Bench-Ausgangswerte, Layout-Screenshots gegen `legacy/` | – |
| 2. core | Konstanten, Typen, Defaults, `merge()` + Migrationen, Pattern-Operationen, Musiktheorie, Timing | Unit-Tests, `merge()` identisch zu legacy |
| 3. store | Signals-Store, Persistenz mit unveränderten Schlüsseln und Format | Unit-Tests, Kompatibilität mit alten Speicherständen |
| 4. audio | Master-Kette, Kanalzüge, Drum-Rendering, Synth, Sampler, FX, Scheduler | Engine-Tests, Klang-Fingerabdrücke gleich legacy, Bench nicht schlechter |
| 5. ui + platform | Oberfläche direkt mit drei Layouts (siehe Änderung vom 2026-10-14, eigene Spezifikation) | Komponententests, E2E und Screenshots je Breakpoint, axe |
| 6. Umstellung | `dist/index.html` wird die App. `legacy/` und alte Tests entfernen. CLAUDE.md und README aktualisieren, Artifact neu veröffentlichen. | gesamte Suite, Bench, Test auf dem iPhone |

## Abnahmekriterien

- Alle Testebenen grün, Abdeckung ≥ 90 % in `core` und `store`.
- Klang-Fingerabdrücke innerhalb der Toleranz zu legacy, Master-Spitze ≈ 0,77.
- Bench Demo und Worst-Case nicht schlechter als die Ausgangswerte.
- Bestehende Speicherstände (Zustand und Samples) laden unverändert.
- Layout bei 390 × 844 entspricht den legacy-Screenshots. Auf Tablet und Desktop funktioniert die App ohne horizontalen Scroll.
- `npm run build` erzeugt eine eigenständige `dist/index.html`, die als Artifact funktioniert (inklusive `window.claude.hot`).
- Auf dem iPhone des Users: gleicher Klang, kein Knacksen, Start per Tipp, Stumm-Schalter wird ignoriert.

## Risiken

| Risiko | Gegenmaßnahme |
|---|---|
| node-web-audio-api verhält sich bei mehreren Kontexten pro Prozess unzuverlässig | Ein Prozess pro Audio-Testdatei |
| Fingerabdruck-Toleranzen zu eng (falscher Alarm) oder zu weit (Fehler rutschen durch) | Toleranzen in Schritt 1 an absichtlich veränderten Parametern kalibrieren (z. B. Tune um einen Halbton, Decay um 10 %) |
| Unterschiede zwischen WebKit-Emulation und echtem iOS-Safari | Abschluss-Test auf dem echten iPhone ist Teil der Abnahme |
| Bundle mit Vite größer oder langsamer als das handgeschriebene Script | Größenbudget und Bench als Tests ab Schritt 0/1 |
| Signals-Store verursacht mehr Arbeit pro Änderung als heutiges direktes DOM-Update | Komponententests mit Zählung der DOM-Updates für Step-Raster und Lauflicht |
