# Etappe 4b: Punch-in-Effekte und Bounce – Spezifikation

Stand: 2026-10-15. Zweiter Teil der Etappe „Performance“ mit Ideen von Teenage Engineering. Der Besitzer hat beauftragt, die Roadmap ohne Rückfragen fertigzustellen. Deshalb sind die Entscheidungen hier begründet.

## Punch-in-Effekte (wie Pocket Operator und EP-133)

- **Neues Gerät „Punch“** im Geräte-Halter, als fünftes nach FX:
  - Darin liegen 8 Haltetasten in einem 2×4-Raster.
  - Ein Effekt wirkt, solange seine Taste gehalten wird.
  - Für die Tasten gilt die Haltelogik von Stutter und Fill: Sie hängen nie.
- **Effekte:**

| Taste | Wirkung | Art |
|---|---|---|
| Loop 1/8 | Stutter mit 1/8 Schlag (vorhandene Technik) | ersetzt |
| Loop 1/16 | Stutter mit 1/16 Schlag | ersetzt |
| Tape | Bandstopp: Tonhöhe und Pegel fallen in 1 s auf null (Verzögerungsleitung mit quadratisch wachsender Zeit), danach Stille | ersetzt |
| Crush | Bitcrush (Treppenkurve mit 12 Stufen) | ersetzt |
| Half | Half-Time: Der Scheduler spielt halb so schnell | Takt |
| Tief | Tiefpass fährt in 1,5 s auf 250 Hz | Filter |
| Hoch | Hochpass fährt in 1,5 s auf 2 kHz | Filter |
| Echo | Master geht in ein Echo (3/16, tempo-synchron, Rückkopplung 0,55); nach dem Loslassen klingt es aus | Zusatz |

- **Kombinationen:**
  - Die „ersetzenden“ Effekte schließen sich gegenseitig aus: Ein neuer löst den vorigen. Das gilt auch für den Stutter des FX-Geräts.
  - Alle anderen lassen sich frei mit allem kombinieren.
- **Knoten:**
  - Tape, Crush und Echo werden erst bei der ersten Benutzung angelegt, wie der Stutter.
  - Danach liegen sie stumm im Graphen (Eingangspegel 0).
  - Pro Treffer kommt kein Knoten dazu.
- **Loslassen:**
  - Tiefpass und Hochpass kehren zu den FX-Werten zurück.
  - Tape, Crush und Loop blenden in 8 ms zum trockenen Signal zurück.
  - Echo nimmt nichts Neues mehr auf und klingt aus.
  - Half-Time wechselt am nächsten Step zurück.
- **Export und Bounce** rendern ohne Punch-Effekte.

## Bounce (wie EP-133 und OP-1)

- **Werkzeug** im Sampler: „Bounce“ (`aria-label` „Pattern auf Pad n bouncen“).
  - Gerendert wird das aktuelle Pattern einmal, offline, mit eigener Engine wie der WAV-Export.
  - Daraus wird ein Sample im Pad-Format (mono, 22,05 kHz, höchstens 3 s).
- **Pad mit Sample:** Die Meldungszeile fragt „Pad n ersetzen?“ mit [Ersetzen] [Abbrechen].
- **Ergebnis:**
  - Der Name lautet „Bounce“, Start/Ende werden auf 0/1 gesetzt (wie beim Laden).
  - Das Sample wird gespeichert und vorgehört.
  - Meldungen:
    - „Pad n: Bounce“
    - bei mehr als 3 s: „Pad n: Bounce (auf 3 s gekürzt)“
    - bei einem Fehler: „Bounce fehlgeschlagen“
    - während des Renderns: „Bounce läuft …“
- **Hinweis:** Das Pad selbst spielt im Bounce mit, falls es Steps hat. Das Rendering geschieht vor dem Ersetzen.

## Tests

- **Referenz** (Offline-Rendering des Demo-Zustands, Effekt gehalten von 2 bis 4 s; Vergleich mit dem Rendering ohne Effekt, jeweils im Fenster 3–4 s und 4,5–5,5 s):
  - Tape: Pegel im Haltefenster mindestens 20 dB tiefer, danach wieder wie ohne Effekt (±3 dB).
  - Tiefpass: Schwerpunkt im Haltefenster < 0,6 × ohne. Hochpass: > 1,4 × ohne. Danach jeweils ±15 %.
  - Crush: Schwerpunkt oder Pegel ändern sich deutlich (> 15 % bzw. > 1 dB), danach ±15 %.
  - Echo (nur BD auf Step 0, Echo gehalten 0–0,3 s): Zwischen 1 und 2 s klingt es noch (mindestens 30 dB über der Stille ohne Echo).
  - Half: Der Abstand der geplanten Steps verdoppelt sich, solange gehalten.
- **Unit:**
  - Engine: Ausschluss der ersetzenden Effekte, Freigabe beim Loslassen, Dispose.
  - UI: 8 Haltetasten, Kombination, Zusammenfassung.
  - Bounce: Bestätigung, Kürzung, Fehler.
- **E2E:**
  - Punch-Gerät auf allen Ansichten, Touch-Ziele, kein horizontaler Scroll, Halten.
  - Bounce ins leere Pad 5: Name „Bounce“, bleibt nach dem Neuladen.
  - axe mit offenem Punch.
