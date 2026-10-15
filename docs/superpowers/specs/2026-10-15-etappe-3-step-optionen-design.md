# Etappe 3: Velocity, Wahrscheinlichkeit und Bedingungen pro Step – Spezifikation

Stand: 2026-10-15. Roadmap-Punkt 3 aus `CLAUDE.md`. Der Besitzer hat beauftragt, die Roadmap ohne Rückfragen fertigzustellen. Deshalb sind die Entscheidungen hier getroffen und begründet.

## Ziel

Beats sollen lebendiger werden:
- leise und laute Schläge (Ghost Notes, Akzente)
- Schläge, die nur manchmal kommen
- Schläge, die nur in bestimmten Durchläufen kommen (Variationen über 2 oder 4 Takte, Fills)

Das alles soll mit wenigen Tipps auf dem iPhone gehen.

## Umfang

- **Drum-Spuren und Sampler-Pads.** Für den Synth folgen Accent und Slide in Etappe 4.
- Drei Optionen pro Step:
  - **Velocity** 0–100 % (Standard 100 %). Der Pegel wird mit v² multipliziert: 50 % klingt etwa 12 dB leiser, Ghost Notes klingen dadurch natürlich.
  - **Wahrscheinlichkeit** 0–100 % (Standard 100 %). Sie wird einmal pro Step gewürfelt und gilt für alle Sub-Steps dieses Steps.
  - **Bedingung:**
    - Immer
    - 1:2, 2:2
    - 1:3, 2:3, 3:3
    - 1:4, 2:4, 3:4, 4:4
    - Erster
    - Nicht erster
- „a:b“ heißt: Der Schlag spielt im a-ten von je b Durchläufen dieses Patterns. Gezählt wird ab Start, je Slot. Im Song zählt jeder Takt dieses Slots.
- **Akzent:** Es gibt keinen eigenen Akzent-Schalter. Ein Akzent ist ein Step mit 100 % zwischen leiseren Steps. Schnellwahl im Editor: „Leise“ 35 %, „Mittel“ 70 %, „Voll“ 100 %.

## Speicherformat

- `Pattern.opt` ist optional: `{ [SubKey]: { [step]: { v?: number; p?: number; c?: Cond } } }`.
- Es wird nur gespeichert, was vom Standard abweicht. Leere Einträge entfallen. Ein Pattern ohne Optionen hat **kein** `opt`-Feld.
  - Dadurch bleibt das Format für alte Stände bytegleich, und der Referenztest gegen die alte App bleibt gültig.
- `loadState` liest `opt` mit Prüfung:
  - nur bekannte Schlüssel (Stimmen, `P0`–`P7`)
  - Step 0–15
  - `v` und `p` begrenzt auf 0..1
  - nur bekannte Bedingungen
  - Standardwerte fallen weg
- Bestehende Pattern-Befehle:
  - Step ausschalten entfernt seine Optionen.
  - „Spur leeren“ entfernt die Optionen der Stimme.
  - „Pattern leeren“ entfernt alles.
  - Eine Vorlage entfernt die Drum-Optionen, die Pad-Optionen bleiben (wie die Pad-Steps).
  - Kopieren und Einfügen nehmen die Optionen mit, „Zurück“ ebenso (das Pattern ist im Schnappschuss).

## Klang

- Der Scheduler prüft pro Step zuerst die Bedingung (Durchlauf-Zähler), dann die Wahrscheinlichkeit (Zufallsstrom `prob` der Engine).
- Velocity wirkt über den Pegel des Treffers:
  - Drums: `level · v²`
  - Pads: `lvl · v`, weil der Sampler `lvl²` rechnet; das ergibt ebenfalls v²
- Es entsteht kein zusätzlicher Audio-Knoten.
- Der WAV-Export rendert dieselbe Logik. Wahrscheinlichkeiten werden dort neu gewürfelt.

## Bedienung

- **Step-Editor (Drums) und Sampler-Steps** bekommen den Chip **„Opt“** (`aria-label` „Step-Optionen bearbeiten“). Er schließt den Sub-Modus aus und umgekehrt.
- Im Opt-Modus:
  - Ein Tipp auf einen Step wählt ihn. Ein ausgeschalteter Step wird dabei eingeschaltet (mit Vorhören im Stand).
  - Darunter erscheint das Feld „<Stimme> · Step n“ mit:
    - Knob **Velocity** (Doppeltipp 100)
    - Chips **Leise / Mittel / Voll**
    - Knob **Chance** (Wahrscheinlichkeit, Doppeltipp 100)
    - Auswahl **Bedingung**
    - **Zurücksetzen**
- **Anzeige:**
  - Eingeschaltete Steps sind umso heller, je höher die Velocity. Das gilt im Editor, in der Spurübersicht und bei den Sampler-Steps.
  - Steps mit Wahrscheinlichkeit < 100 % oder einer Bedingung tragen eine kleine Marke (Klasse `opt`).
- Design-Regeln: nur Palettenfarben, Glow wie bisher, Touch-Ziele ≥ 44 px.

## Tests

- **core:**
  - Optionen setzen, normalisieren und entfernen.
  - Bedingungen (alle Varianten über 12 Durchläufe).
  - `loadState`-Rundreise mit `opt` und kaputten Einträgen.
  - Pattern-Befehle (aus, leeren, Vorlage, einfügen).
  - Eigenschaftstest: `serialize` und `loadState` sind für zufällige Optionen stabil.
- **Referenz:** Velocity 50 % ergibt einen Pegel von etwa 0,25 eines vollen Treffers. Bedingung 1:2 spielt nur jeden zweiten Takt. Wahrscheinlichkeit 0 spielt nie. Gemessen wird über geplante Treffer bzw. die Spitze im Offline-Rendering.
- **Bestehende Referenzen:** Ohne Optionen klingt alles unverändert.
- **UI:** Opt-Modus, Auswahl, Einschalten, Knobs, Schnellwahl, Bedingung, Zurücksetzen, Anzeige, Ausschluss von Sub und Opt.
- **E2E:** Opt-Modus auf allen Ansichten: Bedingung 1:2 setzen, Velocity per Schnellwahl, bleibt nach dem Neuladen, Touch-Ziele, axe.
