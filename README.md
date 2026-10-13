# Pocket 808

Mobile Drum-Machine im Stil der TR-808. Gebaut für das iPhone, läuft in jedem modernen Browser. Der Build erzeugt eine einzelne, eigenständige HTML-Datei.

## Starten

Bauen und lokal ausliefern (ergibt eine eigenständige `dist/index.html`):

```sh
npm run build && npm run preview
```

Für Audio muss der erste Tipp auf *Start* eine Nutzergeste sein (Browser-Vorgabe).

## Funktionen

- **Drums:** zehn 808-Stimmen, einmal offline vorgerechnet und beim Spielen nur abgespielt (Tune, Decay, Level, Sub-Steps).
- **Synth:** zwei Stimmen (Bass, Lead) nach Vorbild des Roland SH-101 mit Oszillator, Filter, Filter- und Amp-Hüllkurve (ADSR), Piano-Roll, Tonart und Skala.
- **Sampler:** Pads mit eigenen Samples, Trim und Fabrik-Sounds.
- **Mixer und FX:** Fader, Pan, Mute/Solo, Reverb- und Delay-Sends, DJ-Filter, Stutter, Master-Kette mit Kompressor und Limiter.
- **Pattern und Song:** Pattern A/B, Swing, Tempo, Song-Reihenfolge, Speicherung im Browser (`localStorage`).

## Entwicklung

Übergangsphase: Die App liegt in `legacy/index.html` und wird schrittweise nach TypeScript portiert (siehe `docs/superpowers/specs/`).

Tests laufen headless gegen die Seite (jsdom mit `node-web-audio-api`):

```sh
nvm use               # Node 24 laut .nvmrc
npm install
npm test              # alles: Unit, Referenz, E2E, alte Tests
npm run test:unit     # schnell: Unit- und Werkzeugtests
npm run test:ref      # Referenz: Klang-Fingerabdrücke und Speicherstände gegen legacy/
npm run test:e2e      # Playwright auf Mobile, Tablet, Desktop
npm run bench         # Performance-Budget (Knoten/s, Renderzeit)
npm run lint && npm run typecheck
npm run dev           # Vite-Dev-Server
npm run build         # dist/index.html (eine Datei)
```

Hinweis: Die Audio-Bibliothek ist bei mehreren Kontexten pro Prozess launisch, deshalb startet der Mixer-Test jedes Audio-Szenario in einem eigenen Prozess.

## Roadmap

1. ~~Mixer und FX~~
2. Projekt speichern/laden (JSON), Audio-Export (WAV/MP3)
3. Velocity/Accent, Wahrscheinlichkeit und Bedingungen pro Step
4. Synth: Akkorde, Arpeggiator, Slide/Accent, LFO
5. Sampler: Chop-Modus, melodische Tastatur, Pitch pro Step
6. Live-Aufnahme, Pattern-Länge 8–32, Tap-Tempo und Count-in, mehrstufiges Undo

Außerdem geplant: wärmerer, analoger Klangcharakter (24-dB-Filter, Sättigung, leichtes Driften).
