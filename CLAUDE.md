# Pocket 808 – Anweisungen für Claude Code

Mobile Drum-Machine im Stil der TR-808 als **einzelne HTML-Datei** (`index.html`: Markup, CSS und Script, kein Build-Schritt, keine Laufzeit-Abhängigkeiten). Hauptgerät des Besitzers ist ein **iPhone**. Alles muss dort performant und knackfrei laufen.

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

- Persistenz: `localStorage` unter `pocket808.v1` (Zustand) und `pocket808.smp.v1` (Samples). Immer in try/catch. Beim Laden läuft alles durch `merge()`: neue Felder brauchen Defaults und eine **Migration alter Speicherstände** (Beispiel: der frühere Synth-Regler `sus` wird zu den Hüllkurven umgerechnet).
- Zustand: ein Objekt `state` (Tempo, Swing, Patterns, `synth`, `smp`, `mix`, `fx`). Änderungen rufen `save()`.
- Audio-Kette: Stimmen → Kanalzug (`chan[id]`: Gain → StereoPanner) → `bus` → DJ-Filter (LP/HP) → Kompressor → Soft-Clip → Master-Gain → Limiter → Sicherheits-Shaper → Ausgang. Sends: Reverb (Convolver mit erzeugter Impulsantwort) und tempo-synchrones Delay für die Synth-Stimmen. Der Master-Pegel ist auf Spitze ≈ 0,77 abgestimmt. Bei Änderungen nachmessen (`tests/synth-test.js`).
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
nvm use         # Node 24 laut .nvmrc
npm install
npm run test:legacy   # alte Tests gegen legacy/index.html
npm run bench:legacy  # alte Render-Last-Messung
```

- Übergangsphase (Branch `fundament`): Die App liegt unverändert in `legacy/index.html`, die alten Tests in `legacy/tests/`. Neue Werkzeuge und Referenztests kommen schrittweise dazu, siehe `docs/superpowers/plans/`.

- Tests laden `index.html` in jsdom mit `node-web-audio-api` und rendern Audio offline.
- Die Audio-Bibliothek ist bei mehreren Kontexten pro Prozess launisch. Audio-Szenarien deshalb **einzeln pro Prozess** laufen lassen (so macht es `tests/mix-test2.js`).
- Syntax schnell prüfen: Script aus `index.html` extrahieren und `node --check` darauf laufen lassen.
- Visuelle Prüfung: Chromium/Playwright, Viewport 390 × 844.
- Offline erscheint ein Konsolenfehler für die Google Fonts. Das ist harmlos.

## Veröffentlichung

`index.html` wird zusätzlich als Claude-Artifact veröffentlicht (`<title>` "Pocket 808"). Das Artifact hängt nicht automatisch am Repo und muss separat aktualisiert werden.

## Roadmap (in dieser Reihenfolge, je Etappe fertig, testen, bestätigen lassen)

1. ~~Mixer und FX~~
2. Projekt speichern/laden (JSON, `.pocket808.json`), Audio-Export (WAV/MP3)
3. Velocity/Accent, Wahrscheinlichkeit und Bedingungen pro Step
4. Synth: Akkorde, Arpeggiator, Slide/Accent, LFO
5. Sampler: Chop-Modus, melodische Tastatur, Pitch pro Step
6. Live-Aufnahme, Pattern-Länge 8–32, Tap-Tempo und Count-in, mehrstufiges Undo

Außerdem geplant: **wärmerer, analoger Klang**, umschaltbar ("Warm" an/aus), damit sich A/B vergleichen lässt:
24-dB-Filter (zwei Biquads), sanfte Sättigung vor dem Filter, leichtes Driften über einen gemeinsamen langsamen LFO, 808-Hats mit Bandpässen, kleine Zufallsschwankungen pro Treffer.
