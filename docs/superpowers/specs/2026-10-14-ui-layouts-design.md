# Schritt 5: Oberfläche mit drei Layouts – Design

Stand: 2026-10-14 · Grundlage: `2026-10-13-fundament-design.md` (Änderung vom 2026-10-14: Schritt 5 und Teilprojekt 2 zusammengelegt)

## Ziel

Die Oberfläche von Pocket 808 wird neu in TypeScript gebaut. Jedes Gerät bekommt ein eigenes, angepasstes Layout: Mobile, Tablet und Desktop. Dazu kommt die Schicht `platform`, die Browser-Sonderfälle und die Artifact-Schnittstelle kapselt. Danach kann Schritt 6 die neue App ausliefern.

**Was gleich bleibt:**
- Funktionsumfang wie Legacy. Neue Funktionen kommen erst mit der Roadmap.
- Klang: Die Engine aus Schritt 4 ist gegen Legacy geprüft.
- Speicherstände: `pocket808.v1` und `pocket808.smp.v1` laden unverändert.
- Design-Regeln aus CLAUDE.md: flach, keine Outlines und Schatten außer dem Fokusring, Glow für aktive Zustände mit `z-index:1`, ein Kupfer-Akzent, keine neuen Farben, nur Google Fonts extern.

**Was sich ändert:**
- Die Anordnung je Gerät.
- Die Startleiste wandert auf Tablet quer und Desktop in die Kopfleiste.
- Neu sind Tastaturkürzel auf dem Desktop.
- Der Pixel-Vergleich mit Legacy entfällt.

## Entscheidungen des Besitzers (2026-10-14)

| Thema | Entscheidung |
|---|---|
| Nutzung | „Alles auf einen Blick“: Mobile bleibt in der Bedienlogik wie heute, Tablet zweispaltig bzw. mit Geräte-Tabs, Desktop als Studio-Pult ohne Scrollen |
| Tablet | Immer eigenes Tablet-Layout, auch im Querformat (große Touch-Ziele), erkannt über Touch und Breite |
| Tastaturkürzel | Kleiner Grundsatz jetzt (siehe unten) |
| Layout-Richtung | Entwürfe A (Tablet hochkant), B (Tablet quer) und C (Desktop) wie unten beschrieben |
| Architektur | Ein Komponentenbaum, Layout per CSS; nur der Geräte-Halter verhält sich je Layout anders |
| Umfang | Aufteilung in die Teilschritte 5a–5d, je mit eigenem Plan, Review und Merge |

## 1. Layouts

### Erkennung

`layout.ts` berechnet aus zwei Media Queries das Signal `layout` und setzt `data-layout` auf `<html>`:

| Layout | Bedingung |
|---|---|
| `mobile` | Breite < 768 px, **oder** `pointer: coarse` und Höhe < 600 px (Telefon quer, Entscheidung 2026-10-14) |
| `tablet` | Breite ≥ 768 px **und** (`pointer: coarse` **oder** Breite < 1024 px) |
| `desktop` | Breite ≥ 1024 px **und** `pointer: fine` |

Ein iPad bekommt damit hoch- und querkant das Tablet-Layout. Ein schmales Desktop-Fenster (768–1023 px) bekommt ebenfalls das Tablet-Layout. Es ändert sich nur `data-layout`, der DOM-Baum wird nie neu aufgebaut.

Im Tablet-Layout unterscheidet `@media (orientation: …)` zwischen den Anordnungen A und B.

### Mobile (390 × 844, ab 360 px ohne horizontalen Scroll)

Bedienlogik wie heute. Alles steht in einer Spalte untereinander:
1. Kopf
2. Deck: LCD, Tempo, Swing, Master
3. Slots A–H
4. Step-Editor mit 2 × 8 Steps
5. Spurenübersicht
6. Geräte als Akkordeon: Synth, Sampler, Mixer, FX
7. Song
8. Vorlagen
9. Pattern-Werkzeuge

Unten bleibt die feste Leiste mit Pattern/Song und Start (mit `safe-area-inset`).

### Tablet hochkant – Entwurf A (820 × 1180)

Die Seite scrollt vertikal.

| Bereich | Inhalt |
|---|---|
| Deck (volle Breite) | LCD, Tempo, Swing, Master, Slots A–H |
| Step-Editor (volle Breite) | 16 Steps in einer Reihe, Level/Tune/Decay daneben |
| Spuren (volle Breite) | |
| Geräte (volle Breite) | Tabs Synth · Sampler · Mixer · FX; das aktive Gerät ordnet sich innen zweispaltig an |
| zweispaltig darunter | Song links, Vorlagen und Pattern-Werkzeuge rechts |
| unten | feste Leiste mit Pattern/Song und Start |

### Tablet quer – Entwurf B (1180 × 820)

| Bereich | Inhalt |
|---|---|
| Kopfleiste (volle Breite) | LCD, Tempo, Swing, Master, Slots A–H, Pattern/Song, Start |
| linke Spalte (~52 %) | Step-Editor, Spuren, Song, Vorlagen, Werkzeuge |
| rechte Spalte (~48 %) | Geräte-Tabs, aktives Gerät in voller Höhe |

Beide Spalten scrollen unabhängig, die Kopfleiste bleibt stehen. Es gibt keine Leiste unten.

### Desktop – Entwurf C (1440 × 900, ohne Scrollen)

| Bereich | Inhalt |
|---|---|
| Kopfleiste | LCD, Tempo, Swing, Master, Slots A–H, Vorlagen, Pattern-Werkzeuge, Pattern/Song, Start |
| Spalte 1 | Step-Editor (mit Sub-Steps, Level/Tune/Decay), Spuren, Song |
| Spalte 2 | Synth (Roll und vier Module) oben, Sampler darunter |
| Spalte 3 | Mixer (13 schmale Kanalzüge) oben, FX darunter |

- Alle Geräte sind gleichzeitig offen, die Seite scrollt bei 1440 × 900 nicht.
- Kleinere Desktop-Fenster (Höhe < 900 oder Breite < 1440) dürfen vertikal scrollen.
- Breitere Fenster verteilen den zusätzlichen Platz über `fr`-Spalten bis zu einer Höchstbreite von 1920 px. Darüber wird das Pult zentriert.

## 2. Struktur

```
index.html            Einstieg der neuen App (Projektwurzel)
src/main.ts           Verdrahtung: Host-Daten → Store → Engine → UI → platform
src/ui/
  dom.ts              h() erzeugt Elemente; bind() koppelt Text/Attribut/Klasse/Stil an einen Selektor; Scope räumt Bindungen auf
  layout.ts           Layout-Signal (siehe 1.), data-layout
  styles/             reset.css, tokens.css, base.css, layout.css
  controls/           knob, fader, chip, segment, select, step-cell (je .ts + .css)
  panels/             deck, slots, step-editor, tracks, synth, sampler, mixer, fx, song, presets, tools, transport
  devices.ts          Geräte-Halter
  shell.ts            baut den einen Baum, vergibt grid-area-Namen
  keys.ts             Tastaturkürzel
  audio-port.ts       Typ UiAudio: was die UI von der Audioseite braucht
src/platform/
  ios.ts, wake.ts, lifecycle.ts, host.ts, files.ts
```

### Bausteine

- **`dom.ts`:**
  - `h(tag, attrs, children)` erzeugt Elemente.
  - `bind(scope, read, apply)` legt einen Effekt an, der nur bei Änderung des gelesenen Werts schreibt.
  - `scope.dispose()` löst alle Bindungen und Event-Listener.
  - Weitere DOM-Abstraktionen gibt es nicht.
- **Steuerelemente** sind Funktionen `(opts) => HTMLElement`:
  - **Knob/Fader:** Wert als Selektor, Bereich, Schritt, Beschriftung und Anzeigeformat, `write(v)` als Store-Befehl.
    - Bedienung per Pointer-Drag (vertikal, mit `setPointerCapture` und `touch-action:none`), Doppeltipp für den Standardwert, Pfeiltasten (fein), Bild auf/ab (grob), Pos1/Ende.
    - ARIA: `role="slider"`, `aria-valuemin`/`-max`/`-now`/`-valuetext`.
  - **Chip** und **Segment** (`role="radio"` in `radiogroup`, Pfeiltasten wechseln) sowie **Select** (natives `<select>`).
  - **StepCell:** `button` mit `aria-pressed`.
- **Panels:**
  - Sie bekommen `{ store, audio, scope }` und lesen ausschließlich über `store.select()`.
  - Sie schreiben über die Store-Befehle.
  - Ein Step-Klick aktualisiert genau eine Zelle.
- **Lauflicht:**
  - Ein `requestAnimationFrame`-Takt ruft `audio.tick()` und läuft nur, solange `audio.playing` wahr ist.
  - Die Zellen binden an `audio.playhead`. Ein Step-Wechsel ändert zwei Zellen, die alte und die neue.
- **Geräte-Halter:**
  - Er enthält die Geräte als Kinder, jedes mit Kopf (Name, Zusammenfassung, LED) und Körper.
  - Je nach Layout verhält er sich unterschiedlich:

    | Layout | Darstellung | Bedienung | ARIA |
    |---|---|---|---|
    | mobile | Akkordeon | Köpfe sind Knöpfe | `aria-expanded`/`aria-controls` |
    | tablet | Tabs | Köpfe werden Tabs, ein Gerät sichtbar | `role="tablist"`/`tab`/`tabpanel` |
    | desktop | alle offen | Köpfe sind reine Überschriften | – |

  - Der Akkordeon-Zustand liegt wie heute im gespeicherten Zustand unter `open`. Der aktive Tab ist ein flüchtiges UI-Signal in `devices.ts`, nicht im Store und nicht gespeichert; Standard ist Synth.
  - Ein Layoutwechsel behält den Fokus, falls er in einem Gerät lag.
- **CSS:**
  - Reihenfolge der Layer: `@layer reset, tokens, base, components, layout`.
  - `tokens.css` enthält die Palette aus CLAUDE.md sowie Abstände, Größen (Touch-Ziel ≥ 44 px auf mobile/tablet) und Glow.
  - Komponenten-CSS kennt keine Breakpoints, nur Container Queries. Beispiel: Der Step-Editor zeigt ab 640 px Containerbreite 16 Steps in einer Reihe.
  - Die Layouts stehen ausschließlich in `layout.css` über `[data-layout]` und `grid-template-areas`.
  - Teure Effekte wie Blur und `filter` werden nicht verwendet.
- **Schichten:**
  - `ui` importiert `core` und `store`, aber weder `audio` noch `platform`.
  - Die UI bekommt `UiAudio` übergeben: `start`, `stop`, `playing`, `playhead`, `tick`, `audition`, `auditionNote`, `auditionPad`, `stutterOn`/`Off`, `setPadSample`, `setDrumSample`, `decode`, `ready`.
  - `platform` importiert nur `core`. Nur `main.ts` kennt alle Schichten.
  - Die ESLint-Schichtregel wird entsprechend ergänzt.

### Tastaturkürzel (nur Layout desktop)

| Taste | Wirkung |
|---|---|
| Leertaste | Start/Stop (nicht in Text-Eingabe und `<select>`; Knöpfe bleiben per Enter bedienbar) |
| 1–8 | Pattern A–H wählen |
| ↑ / ↓ | vorherige/nächste Drum-Spur (nicht, wenn ein Regler oder eine Radiogruppe den Fokus hat) |
| Cmd/Strg+Z | Zurück |
| Cmd/Strg+C / Cmd/Strg+V | Pattern kopieren / einfügen (nicht, wenn Text markiert ist) |

Die Kürzel werden in einem `<dialog>` aufgelistet, der sich über ein Fragezeichen-Chip in der Kopfleiste öffnet.

## 3. platform, Start und Verdrahtung

Alle Module bekommen ihre Abhängigkeiten (`navigator`, `document`, `window`) übergeben und sind ohne Browser testbar.

- **`ios.ts`:**
  - `unlockIOS()` legt ein stilles Audio-Element nur dann an, wenn `navigator.audioSession` fehlt.
  - Gibt es `audioSession`, setzt es `audioSession.type = 'playback'`.
  - Die Engine ruft es über `onGesture` bei jeder Bedien-Geste auf.
- **`wake.ts`:** Den Wake Lock halten, solange `playing` wahr ist; nach Rückkehr in den Vordergrund neu anfordern; Fehler ignorieren.
- **`lifecycle.ts`:**
  - `visibilitychange` (hidden) stoppt die Wiedergabe.
  - Ein passiver `pointerdown`-Listener auf `document` ruft `engine.resume()`, für iOS `interrupted` nach Anrufen oder Alarmen.
- **`host.ts`:**
  - Stellt `window.claude.hot` bereit, falls vorhanden: `snapshot(() => ({ state: serialize(state) }))`.
  - `ready(init)` bzw. `data` liefern den Startzustand. Er hat Vorrang vor `localStorage` und läuft durch `bootState`/`merge()`, wie Legacy `init(data)`.
- **`files.ts`:** Datei wählen (`<input type=file accept=audio/*>`) bzw. aufnehmen (`capture`), Ergebnis als `ArrayBuffer`.

**Start (`main.ts`):**
1. Host-Daten oder `localStorage` werden über `bootState` und `merge()` zum Startzustand.
2. `createStore` und `persistState` starten.
3. `createEngine({ onGesture: unlockIOS, … })` und `engine.prepare()` laufen beim Laden. Der Kontext bleibt schlafend, die Drums werden im Hintergrund vorgerendert.
4. `mountShell(root, { store, audio })` baut die UI.
5. platform wird verdrahtet.

Der Start-Tipp ruft nur `start()` und damit `resume`. Im Tipp-Handler passiert nichts Schweres.

**Fehlerfälle:**
- Liefert `prepare()` false (kein Web Audio), zeigt die LCD-Unterzeile „Kein Audio in diesem Browser“. Bearbeiten bleibt möglich.
- `localStorage`, Wake Lock und `audioSession` laufen immer in try/catch.
- Decode- oder Aufnahmefehler erscheinen als Meldung im Sampler (`role="status"`).

**Engine-Ergänzung (5c):** `decode(ArrayBuffer): Promise<Float32Array>` dekodiert und rechnet auf 22,05 kHz mono um, wie Legacy `toPcm`. Abgesichert wird das per Referenztest gegen Legacy.

**Build in der Übergangsphase:**
- `npm run dev` zeigt die neue App.
- `npm run build` liefert weiter `legacy/` nach `dist/` aus.
- Neu ist `npm run build:next` mit Ausgabe nach `dist-next/index.html`, ebenfalls eine einzelne Datei. Sie steht in `.gitignore`.
- Schritt 6 tauscht die beiden Builds.

## 4. Teilschritte

| Teil | Inhalt | Fertig, wenn |
|---|---|---|
| **5a Grundgerüst** | `dom.ts`, `layout.ts`, Styles und Tokens, Steuerelemente; Shell mit allen drei Layouts; Geräte-Halter (anfangs ohne Geräte); platform komplett; Kopf und Deck; Slots A–H; Step-Editor (Steps, Sub-Steps samt Mustern, Level/Tune/Decay, eigenes Drum-Sample laden und zurücksetzen); Spurenübersicht; Transport; Tastaturkürzel; `build:next`; Funktionsliste | Die App ist auf allen Layouts spielbar, die Kürzel funktionieren, Speicherstände laden |
| **5b Synth** | Bass/Lead, Stumm, Tonart/Skala, Piano-Roll (Takthälften, Notenlängen), Module Oszillator/Filter/Filter-Env/Amp-Env/Out mit Hüllkurvenanzeige, Presets, Werkzeuge | Abschnitt Synth der Funktionsliste vollständig |
| **5c Sampler** | 8 Pads, Wellenform mit Start- und Endmarke, Laden und Aufnehmen, Regler, Steps und Sub-Steps, Meldungen, `engine.decode` | Abschnitt Sampler vollständig |
| **5d Mixer, FX, Song, Vorlagen, Werkzeuge** | 13 Kanäle (Mute/Solo, Pegel, Pan, Send, Auswahl), Reverb, DJ-Filter, Stutter halten, Song-Kette, Vorlagen, Kopieren/Einfügen/Leeren/Zurück | Funktionsliste vollständig; Desktop 1440 × 900 ohne Scrollen |

Jeder Teilschritt bekommt einen eigenen Implementierungsplan und Branch. Er endet mit Review und Merge nach `main`.

Die **Funktionsliste** (`docs/superpowers/specs/2026-10-14-ui-funktionsliste.md`) entsteht in 5a aus Legacy. Sie führt jede Bedienhandlung mit ihrer Wirkung auf und wird je Teilschritt abgehakt.

## 5. Tests und Abnahme

- **Komponententests:**
  - Vitest-Projekt `ui` mit jsdom für `src/ui/**` und `src/platform/**`.
  - Geprüft werden:
    - Steuerelemente (Pointer, Tasten, ARIA, Schreiben in den Store).
    - Panels mit Zählung der DOM-Änderungen: Step-Klick = eine Zelle, Lauflicht = zwei.
    - Layout-Signal, Geräte-Halter (drei Modi, Fokus bleibt), Kürzel und platform mit Schein-Objekten.
  - Abdeckung ≥ 90 % pro Datei, nun auch für `ui` und `platform`.
  - Mutationsproben wie bisher.
- **E2E** (Playwright gegen `dist-next`):
  - Projekte:

    | Projekt | Viewport | Engine |
    |---|---|---|
    | mobile | 390 × 844 | WebKit |
    | tablet | 820 × 1180 | WebKit |
    | tablet-quer | 1180 × 820 | WebKit, Touch |
    | desktop | 1440 × 900 | Chromium |

  - Geprüft werden:
    - Funktionsabläufe: Step setzen, Start/Stop mit laufendem Lauflicht, Pattern wechseln, Gerät öffnen bzw. Tab wechseln, Kürzel auf dem Desktop.
    - Kein horizontaler Scroll; auf dem Desktop ab 5d auch kein vertikaler.
    - Screenshot-Referenzen je Projekt, bewusst erzeugt (`--update-snapshots`, Diff prüfen).
    - axe ohne Verstöße der Stufen serious/critical.
    - Alter Speicherstand `pocket808.v1` lädt und erscheint richtig.
  - Die bisherigen Legacy-E2E-Tests bleiben bis Schritt 6 bestehen.
- **Budgets:**
  - Größenobergrenze für `dist-next/index.html`. Der Ausgangswert wird in 5a festgelegt, mit Puffer.
  - Laufzeit-Test in Chromium: Während 5 s Wiedergabe gibt es keine Long Task über 50 ms.
  - `npm run bench` bleibt unverändert.
- **Abnahme je Teilschritt:**
  - Alle Tests grün.
  - Abschnitt der Funktionsliste abgehakt.
  - Review bestanden.
  - Der Besitzer sieht sich die Layouts im Dev-Server an.
- **Abnahme Schritt 5 insgesamt:**
  - Alle Teilschritte erledigt.
  - Die Funktionsliste ist vollständig.
  - `dist-next/index.html` funktioniert als einzelne Datei, auch mit `window.claude.hot`.

## Risiken

| Risiko | Gegenmaßnahme |
|---|---|
| Desktop passt bei 1440 × 900 nicht ohne Scrollen | Kompakte Kanalzüge im Mixer, Synth-Module zweizeilig; früh in 5a mit Platzhaltern in voller Größe prüfen |
| Funktionen gehen beim Neubau verloren | Funktionsliste aus Legacy, je Teilschritt abgehakt, E2E je Ablauf |
| WebKit-Emulation ≠ echtes iPad/iPhone | Sichtprüfung im Dev-Server auf dem Gerät des Besitzers je Teilschritt; Abschluss-Test in Schritt 6 |
| Feine Bindungen machen viel Verwaltungsarbeit | Zählung der DOM-Änderungen in Tests, Long-Task-Budget |
| Leertaste kollidiert mit Knöpfen (Tastatur-Barrierefreiheit) | Kürzel nur auf dem Desktop, Knöpfe per Enter bedienbar, im Kürzel-Dialog dokumentiert |
