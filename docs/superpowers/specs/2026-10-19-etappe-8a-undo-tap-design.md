# Etappe 8a: Mehrstufiges Undo und Tap-Tempo – Spezifikation

Stand: 2026-10-19. Etappe 8 ist zu groß für einen Schritt und wird geteilt: **8a** mehrstufiges Undo und Tap-Tempo, **8b** Live-Aufnahme mit Count-in (der Vorzähler ergibt erst mit der Aufnahme Sinn), **8c** Pattern-Länge 8–32. Der Auftrag lautet „ohne Rückfragen“, deshalb sind die Entscheidungen hier begründet.

## Mehrstufiges Undo

- Der Store führt statt eines einzelnen Zurück-Schritts einen **Stapel** von höchstens 20 Schritten (`UNDO_DEPTH`). Jeder bisherige Befehl mit Zurück legt einen Schritt obenauf, *Zurück* nimmt den obersten.
- Die Schritte bleiben, was sie waren: Schnappschuss von Pattern, Slot, Tempo, Swing und Preset; Szenen-Abruf stellt nur den Mixer her; Projekt öffnen stellt den ganzen Zustand samt Samples (`after`) her. Weil die Zustände unveränderlich sind und Teile teilen, kostet jeder Schritt kaum Speicher.
- **Nach dem Review:** Ein älterer Schritt stellt Tempo, Swing und Preset nur zurück, wenn du sie seit der Aktion nicht selbst verändert hast (Regler, Tap). Schritte mit Sample-Sätzen (Projekt öffnen) bleiben höchstens drei im Stapel (`UNDO_SAMPLE_STEPS`), ältere fallen mit allem Darunterliegenden heraus, damit der Speicher auf dem iPhone nicht wächst.
- Ist der Stapel voll, fällt der älteste Schritt heraus.
- *Zurück* ist aktiv, solange der Stapel nicht leer ist. Der Knopf ist unverändert, auch Cmd/Strg+Z.
- **Kein Wiederholen (Redo):** nicht verlangt, und es braucht eine zweite Hälfte der Logik. Kommt bei Bedarf.
- Der Stapel gehört nicht zum Speicherformat und überlebt kein Neuladen (wie bisher).

## Tap-Tempo

- Neue reine Logik `core/tap.ts`: `tapTempo(taps, now)` liefert die Tipp-Zeiten (höchstens 6) und das Tempo.
  - Ein Tipp nach mehr als 2 s Pause beginnt neu (kein Tempo).
  - Ab dem zweiten Tipp gilt der Mittelwert der Abstände: `60 / Mittel` BPM, gerundet und auf 60–200 begrenzt (der Bereich des Tempo-Reglers).
- Knopf **„Tap“** neben den Reglern im Deck (Touch-Ziel ≥ 44 px, `aria-label` „Tempo antippen“). Jeder Tipp setzt das Tempo, das LCD zeigt es. Auf dem Desktop reicht die Taste **T**.
- Tap-Tempo ist keine Zurück-Aktion (wie das Drehen am Tempo-Regler).

## Tests

- **core:** Tap-Rechnung (Reset, Mittelwert, Grenzen, höchstens 6 Tipps).
- **Store:** Stapel (mehrere Schritte nacheinander zurück, Tiefe 20, `canUndo`), Szenen-Abruf und Projekt öffnen im Stapel.
- **UI:** Tap-Knopf, Taste T.
- **E2E:** zweimal ändern, zweimal zurück; Tap setzt Tempo; Touch-Ziel.
