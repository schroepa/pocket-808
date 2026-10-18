# Etappe 6b: Arpeggiator und LFO – Spezifikation

Stand: 2026-10-18. Zweiter Teil der Roadmap-Etappe 6 („Synth“). Der Auftrag lautet „ohne Rückfragen“, deshalb sind die Entscheidungen hier begründet.

## Ziel

- **Arpeggiator:** Eine gehaltene Note oder ein Akkord (Etappe 6a) wird als Folge einzelner Töne gespielt, wie beim SH-101 und beim OP-1.
- **LFO:** Ein langsamer Oszillator bewegt den Cutoff (Wobble) oder die Tonhöhe (Vibrato), je Part.

## Speicherformat

Beides gehört zum Klang eines Parts und liegt deshalb im `SynthPatch`, als optionale Felder. Fehlen sie, bleibt der Stand bytegleich.

- `arp?: { m: ArpMode; r: 1 | 2; o: 1 | 2 }`
  - `m`: `'up' | 'down' | 'ud' | 'rnd'` (Auf, Ab, Auf-Ab, Zufall). „Aus“ heißt: kein Feld.
  - `r`: Rate, 1 = Sechzehntel, 2 = Zweiunddreißigstel.
  - `o`: Oktaven, 1 oder 2.
- `lfo?: { r: number; d: number; t: 'cut' | 'pit' }`
  - `r` Rate 0..1, das sind 0,1 Hz bis etwa 19 Hz (`0,1 · 2^(r · 7,6)`).
  - `d` Depth 0..1. Bei `d = 0` legt die Engine nichts an.
  - `t` Ziel: Cutoff oder Pitch.
- Lesen: `loadState` übernimmt nur gültige Werte (bekannte Modi und Ziele, Zahlen begrenzt). Kaputte Felder fallen ganz weg.
- **Presets** ändern Arp und LFO nicht. Beides sind Spielweisen, kein Klangfarben-Preset (Ruling). Beim Laden eines Presets bleibt der Rest des Patches wie bisher.

## Klang

- **Arpeggiator** (nur Wiedergabe, Export und Bounce; das Vorhören spielt den Akkord wie bisher):
  - Tonvorrat: die Töne der Note (`noteMidis`), aufsteigend sortiert. Bei 2 Oktaven kommen dieselben Töne +12 dazu.
  - Folge: Auf; Ab; Auf-Ab (ohne die Endtöne zu wiederholen, ab 3 Tönen); Zufall (eigener Zufallsstrom `arp`, auch im Export reproduzierbar je Seed).
  - Die Note mit Länge `l` spielt `l · r` Töne im Abstand von einem Step bzw. einem halben Step. Jeder Ton ist eine eigene monophone Synth-Note mit der Länge `Abstand · 0,92`. Die Folge beginnt bei jeder Note von vorn.
  - Akzent gilt für alle Töne der Note. Slide gilt nur für den ersten Ton (gleitet von der Vorgängerin).
  - Eine einzelne Note ohne Akkord mit 1 Oktave klingt also wie eine Folge wiederholter Töne (Ratchet). Das ist gewollt.
- **LFO:**
  - Je Part höchstens ein Sinus-Oszillator mit Gain. Beides wird erst angelegt, wenn `d > 0` ist, und bei `d = 0` gestoppt und verworfen.
  - Ziel Cutoff: Der Gain (`d · 2400` Cent, also bis ±2 Oktaven) geht auf `detune` des Tiefpasses jeder neuen Note.
  - Ziel Pitch: Der Gain (`d · 100` Cent, also bis ±1 Halbton) geht auf `detune` jedes Oszillators der Note.
  - Pro Note entsteht **kein** zusätzlicher Knoten, nur Verbindungen. Sie werden gelöst, sobald der jeweilige Oszillator endet (`onended`), damit nichts liegen bleibt.
  - Rate, Depth und Ziel wirken live: Rate und Depth über den Parameter mit Anker. Ein neues Ziel gilt ab der nächsten Note.

## Bedienung

- Zwei neue Module unter den bisherigen fünf:
  - **Arp:** Segment Aus | Auf | Ab | Auf-Ab | Zufall, darunter Rate 1/16 | 1/32 und Oktaven 1 | 2.
  - **LFO:** Knobs Rate und Depth, Segment Cutoff | Pitch. Das LCD zeigt die Rate in Hz.
- Ein Doppeltipp setzt den Knob zurück: Depth auf 0 (aus), Rate auf 0,5.
- Touch-Ziele ≥ 44 px, Design-Regeln wie bisher.
- Die Zusammenfassung des Synth-Geräts ergänzt „· Arp“, wenn der Arp des gewählten Parts an ist.

## Tests

- **core:** Arp-Folgen (alle Modi, Oktaven, Länge, Zufall mit festem Strom), Rate in Hz, Setzen und Löschen, Speichern und Lesen (auch kaputt), alte Stände bytegleich.
- **Referenz:** Arp mit Dreiklang und 1/16 erzeugt `l` Synth-Noten mit den erwarteten Grundfrequenzen. Ein LFO auf Cutoff verbindet sich mit dem Filter, und das Spektrum bewegt sich (Schwerpunkt schwankt). Ohne LFO entsteht kein zusätzlicher Knoten. Bench gleich.
- **UI:** Module, Segment, Knobs, Reset, Zusammenfassung.
- **E2E:** Arp und LFO setzen, bleibt nach dem Neuladen; Touch-Ziele; axe.
