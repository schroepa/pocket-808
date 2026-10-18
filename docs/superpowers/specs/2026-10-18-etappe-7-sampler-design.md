# Etappe 7: Sampler mit Chop, Tastatur und Pitch pro Step – Spezifikation

Stand: 2026-10-18. Roadmap-Etappe 7. Der Auftrag lautet „ohne Rückfragen“, deshalb sind die Entscheidungen hier begründet.

## Ziel

Der Sampler soll wie ein EP-133 spielbar werden:
- Ein Sample in Stücke schneiden und die Stücke im Pattern verteilen (**Chop**).
- Ein Pad melodisch spielen (**Tastatur**).
- Einzelne Steps höher oder tiefer stimmen (**Pitch pro Step**).

## Entscheidungen

- **Chop teilt das Pad, statt es zu kopieren.** Ein Pad bekommt 2, 4 oder 8 gleich große Slices innerhalb seiner Start/Ende-Griffe. Welches Slice ein Step spielt, steht in den Step-Optionen.
  - Begründung: Das Sample auf acht Pads zu kopieren, würde den Speicher (`localStorage`, etwa 5 MB) schnell füllen und die anderen Pads überschreiben.
- **Pitch pro Step** in Halbtönen (−12 … +12). Er wirkt zusätzlich zu Tune und zu einem Tune-Lock.
- **Tastatur:** eine Oktave (12 Tasten wie am Klavier) plus Oktav-Umschaltung −1/0/+1. Die Taste C spielt das Pad in seiner eigenen Stimmung. Gespielt wird nur live; Aufnehmen kommt in Etappe 8 (Live-Aufnahme).

## Speicherformat

Alle Felder sind optional. Fehlen sie, bleibt der Stand bytegleich.

- `Pad.sl?: 2 | 4 | 8`: Anzahl der Slices. „Aus“ heißt: kein Feld.
- `StepOpt.n?: number`: Halbtöne, ganzzahlig −12 … 12, nur Pads. 0 entfällt.
- `StepOpt.k?: number`: Slice-Index, ganzzahlig 0 … 7, nur Pads. Ohne `k` spielt der Step das ganze Pad.
- `loadState` prüft und begrenzt. Ein `k` über der aktuellen Slice-Zahl bleibt gespeichert und wird beim Spielen auf das letzte Slice begrenzt, damit ein Umschalten der Slice-Zahl nichts zerstört.

## Klang

- Slice `k` von `sl`: Bereich `start + (end − start) · k/sl` bis `start + (end − start) · (k+1)/sl`. Bei Rückwärts gelten dieselben Bereiche auf der umgedrehten Wiedergabe, wie heute Start und Ende.
- Ein Start-Lock (`s`) gilt nur ohne Slice. Mit Slice bestimmt das Slice den Bereich.
- Pitch: `tune + n/24`. Tune 0..1 überstreicht ±1 Oktave, also 1/24 je Halbton. Werte außerhalb von 0..1 sind erlaubt.
- Kein zusätzlicher Audio-Knoten.

## Bedienung

- **Sampler-Werkzeuge:**
  - Segment **„Chop“** Aus | 2 | 4 | 8 für das gewählte Pad.
  - Chip **„Verteilen“**: legt die Slices der Reihe nach auf die gesetzten Steps des Pads im aktuellen Pattern (Slice 1, 2, 3 … und wieder von vorn), mit Zurück. Ohne Chop oder ohne Steps meldet das LCD, was fehlt.
- **Wellenform:** Bei Chop zeigen feine Linien die Slice-Grenzen.
- **Opt-Feld (Pads):**
  - Zeile **„Pitch“** mit − / Wert / + (Doppeltipp auf den Wert: 0).
  - Bei Chop die Auswahl **„Slice“**: Ganz | 1 … sl.
- **Tastatur:** Unter den Sampler-Steps sieben weiße und fünf schwarze Tasten mit Notennamen sowie Oktave − / + (Anzeige „Okt 0“). Ein Tipp spielt das gewählte Pad. Touch-Ziele ≥ 44 px.
- Bei Pitch ≠ 0 oder einem Slice tragen die Sampler-Steps dieselbe Marke wie bei anderen Optionen.

## Tests

- **core:** Slice-Bereiche, Verteilen, Pitch- und Slice-Optionen normalisieren, speichern und lesen (auch kaputt), alte Stände bytegleich.
- **Referenz:** Pitch +12 verdoppelt die Abspielrate. Ein Slice setzt Startpunkt und Länge.
- **UI:** Chop-Segment, Verteilen (mit Meldungen), Pitch-Zeile, Slice-Auswahl, Tastatur (Ton, Oktave), Linien in der Wellenform.
- **E2E:** Chop und Verteilen, Pitch setzen, bleibt nach dem Neuladen; Tastatur mit Touch-Zielen; axe.
