# Etappe 6a: Akzent, Slide und Akkorde pro Note – Spezifikation

Stand: 2026-10-18. Roadmap-Punkt „Synth“, erster Teil. Der Auftrag lautet „ohne Rückfragen“, deshalb sind die Entscheidungen hier begründet.

## Ziel

Basslines und Leads sollen nach Acid und nach Harmonie klingen, wie beim TB-303 bzw. paraphon wie beim SH-101 mit Akkord-Speicher:
- **Akzent:** Die Note klingt lauter und heller.
- **Slide:** Die Tonhöhe gleitet von der vorigen Note, ohne neuen Anschlag.
- **Akkorde:** Die Note spielt einen Dreiklang, Vierklang, eine Quinte oder eine Oktave, immer in der Tonart.

## Daten

- `Note` erhält optional:
  - `a?: true` (Akzent)
  - `s?: true` (Slide)
  - `ch?: 'tri' | 'sev' | 'pow' | 'oct'` (Akkord)
- Ohne Attribute bleibt die Note `{ d, l }`, alte Stände bleiben dadurch bytegleich.
- **Akkord-Stufen** (in Skalenstufen):

| Akkord | Stufen |
|---|---|
| `tri` (Dreiklang) | +0, +2, +4 |
| `sev` (Vierklang) | +0, +2, +4, +6 |
| `pow` (Quinte) | +0, +4 |
| `oct` (Oktave) | +0, +Skalenlänge |

- Die Akkordqualität ergibt sich aus der Skala: In Moll entsteht ein Moll-, in Dur ein Dur-Dreiklang.
- **Laden:** `loadState` liest nur gültige Werte (`a`/`s` genau `true`, bekannte Akkorde).

## Klang

- **Akzent:** Pegel × 1,35. Die Filter-Hüllkurve öffnet um 0,25 Env-Einheiten weiter (höchstens 16 kHz).
- **Slide:**
  - Klingt die vorige Note des Parts noch, beginnt die neue mit deren Tonhöhe und gleitet in 60 ms exponentiell auf die eigene.
  - Die Amp-Hüllkurve beginnt ohne Attack auf dem Sustain-Pegel, die Filter-Hüllkurve auf dem Sustain-Wert.
  - Die vorige Note wird wie bisher in 6 ms ausgeblendet.
  - Ohne klingende Vorgängerin spielt eine Slide-Note normal.
- **Akkord:**
  - Ein gemeinsamer Filter und eine gemeinsame Amp-Hüllkurve (paraphon).
  - Je Ton zwei verstimmte Oszillatoren, der Sub nur für den Grundton.
  - Der Mischpegel fällt mit 1/√n, damit der Akkord nicht lauter wird.
  - Mehr Knoten nur für Akkord-Noten (bis 4 Töne = 9 Oszillatoren statt 3).
- **Vorhören** einer Note mit Attributen nutzt dieselbe Logik.

## Bedienung

- Über der Piano-Roll liegt das Segment **„Werkzeug“**: Note | Akzent | Slide | Akkord.
  - **Note:** setzen und löschen wie bisher.
  - **Akzent / Slide:** Ein Tipp auf eine Note (Anfang oder Verlauf) schaltet das Attribut um. Ein Tipp auf leere Zellen tut nichts.
  - **Akkord:** Ein Tipp schaltet weiter: kein → Dreiklang → Vierklang → Quinte → Oktave → kein. Das LCD meldet den Akkord.
- **Anzeige** an der Anfangszelle einer Note:
  - Akzent: hellere Füllung.
  - Slide: Marke links (Verbindung zur vorigen).
  - Akkord: Kürzel 3, 4, 5 oder 8 in der Zelle.
  - Alles aus Palettenfarben.
- Werkzeug und Länge bleiben nur in der Oberfläche; die Länge wie bisher im Zustand.

## Tests

- **core:** Attribute umschalten, Akkord weiterschalten, Akkord-Stufen je Skala, Laden mit kaputten Werten, Rundreise, alte Stände bytegleich.
- **Referenz:**
  - Akzent: Spitze ≥ 1,2 × ohne Akzent.
  - Slide: Die Frequenz des neuen Oszillators startet bei der alten.
  - Akkord: Anzahl der Oszillatoren und Grundfrequenzen der Töne.
- **UI:** Werkzeug-Segment, Umschalten, Anzeige, Meldung.
- **E2E:** Akkord und Akzent setzen, bleibt nach dem Neuladen, Touch-Ziele.
