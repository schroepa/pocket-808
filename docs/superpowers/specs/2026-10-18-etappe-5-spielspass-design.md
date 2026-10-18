# Etappe 5: Spielspaß – animiertes LCD, Würfel, Szenen – Spezifikation

Stand: 2026-10-18. Teenage-Engineering-Ideen, die der Besitzer gewählt hat. Der Auftrag lautet „ohne Rückfragen“, deshalb sind die Entscheidungen hier begründet.

## 1. Animiertes LCD (wie OP-1)

- **Darstellung:** Im LCD unter der Meldungszeile liegt ein schmaler Streifen (Canvas, 28 px hoch) mit zwei Ebenen:
  - **Oszilloskop** des Master-Ausgangs: eine Linie in `--acc`, 512 Werte (≈ 12 ms), 2,5-fach verstärkt, Zeitbereich.
  - **16 Step-Punkte**: Der laufende Step leuchtet, Steps mit Inhalt im aktuellen Pattern sind schwach sichtbar.
- **Wann gezeichnet wird:**
  - Nur während der Wiedergabe und nur, wenn die Seite sichtbar ist, per `requestAnimationFrame`.
  - Im Stand zeigt der Streifen eine ruhige Mittellinie mit den Step-Punkten.
  - Bei `prefers-reduced-motion` wird nur bei Step-Wechseln neu gezeichnet; die Linie bleibt dann ruhig.
- **Technik:**
  - Ein `AnalyserNode` (fftSize 512) greift hinter dem Master-Gain ab.
  - Er wird erst angelegt, wenn das LCD ihn zum ersten Mal anfordert, und hat keinen Ausgang.
  - `UiAudio.scope(into: Float32Array): boolean` füllt den Puffer, gibt `false` ohne Audio.
  - Gezeichnet wird mit Canvas 2D in Gerätepixeln (höchstens 2×).
- **Barrierefreiheit:** Der Streifen ist dekorativ (`aria-hidden`).

## 2. Würfel (wie die Tombola des OP-1)

- **Taste:** „Würfeln“ im Bereich Vorlagen und Pattern-Werkzeuge (`aria-label` „Variation würfeln“). Sie erzeugt eine Variation des aktuellen Patterns, mit „Zurück“.
- **Regeln** (reine Funktion `vary(state, rng)` in `core/vary.ts`, je Wurf zufällig ausgewählt):
  - **Ghost-Hats:** CH erhält auf freien Steps mit Wahrscheinlichkeit 0,25 einen Schlag mit Velocity 0,35.
  - **Kick-Variation:** Mit Wahrscheinlichkeit 0,6 kommt ein zusätzlicher BD auf einen freien ungeraden Step der zweiten Takthälfte.
  - **Snare-Ghost:** Mit Wahrscheinlichkeit 0,5 kommt vor einem gesetzten SD-Step ein SD mit Velocity 0,3 auf den freien Step davor.
  - **Open Hat:** Mit Wahrscheinlichkeit 0,3 wird OH auf Step 15 oder 16 gesetzt, sofern dort frei.
  - **Ausdünnen:** Mit Wahrscheinlichkeit 0,25 wird ein gesetzter CH auf einem ungeraden Step entfernt.
  - Ist das Pattern ganz leer, entsteht ein Grundbeat (BD 1/5/9/13, SD 5/13, CH auf allen geraden Steps), danach gelten die Regeln oben.
- **Unverändert bleiben:** Noten, Sampler, Sub-Steps und vorhandene Step-Optionen. Neue Ghost-Steps bekommen Velocity-Optionen.
- **Meldung:** „Variation gewürfelt“ (LCD).

## 3. Szenen (wie beim OP-XY)

- **Szene:** Ein Schnappschuss des Mixers: je Kanal Pegel, Mute und Solo. Pan und Sends bleiben unberührt.
- **Bedienung:**
  - Im Mixer-Gerät gibt es eine Zeile „Szenen“ mit 8 Tasten (1–8) und dem Chip „Sichern“.
  - Ein Tipp auf eine belegte Szene ruft sie ab.
  - Ein Tipp auf eine leere Szene sichert den aktuellen Mixer.
  - Mit „Sichern“ aktiv sichert jeder Tipp (Überschreiben) und schaltet „Sichern“ wieder aus.
  - Abrufen gibt es mit „Zurück“.
  - Die zuletzt abgerufene oder gesicherte Szene ist markiert.
  - Meldungen: „Szene n gesichert“, „Szene n“.
- **Speicher:**
  - `State.scenes?: (SceneMix | null)[]` mit 8 Einträgen, optional. Das Feld fehlt, solange keine Szene gesichert ist; alte Stände bleiben dadurch bytegleich.
  - `loadState` prüft Länge und Werte.
  - Projektdateien tragen Szenen automatisch mit.
- **Abrufen im Klang:** Die Kanalzüge folgen dem Mixer-Zustand ohnehin weich (`setTargetAtTime`). Es entsteht kein neuer Klangpfad.

## Tests

- **core:**
  - `vary`: Eigenschaftstest über zufällige Seeds. Nur BD, SD, CH und OH ändern sich; Noten, Sampler und Sub-Steps bleiben gleich; mindestens eine Änderung bei einem nicht leeren Pattern über 10 Seeds; deterministisch je Seed.
  - Szenen sichern, abrufen, laden (kaputte Daten), Rundreise.
- **Store/UI:**
  - Würfeln mit Zurück und Meldung.
  - Szenen-Zeile: leer sichern, belegt abrufen, Sichern-Modus, Markierung, Zurück.
  - LCD-Streifen: Zeichnen mit Schein-Canvas, kein Zeichnen ohne Wiedergabe, `aria-hidden`.
- **Engine:** Der Analyser entsteht erst bei der ersten Anforderung, `scope()` liefert ohne Kontext `false`.
- **E2E:**
  - Würfeln und Zurück.
  - Szene sichern und abrufen, bleibt nach dem Neuladen.
  - LCD-Streifen im Fenster.
  - axe, Touch-Ziele.
