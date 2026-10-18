# Etappe 6a: Synth-Noten – Implementierungsplan (kompakt)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Testgetrieben.

**Spec:** `docs/superpowers/specs/2026-10-18-etappe-6a-synth-noten-design.md`

## Global Constraints

- Branch `etappe-6a`, Version 0.22.0.
- Abdeckung ≥ 90 %, Touch ≥ 44 px.
- Alte Stände bytegleich.
- Größenbudget bewusst anheben (Ruling, eigener Commit).

## Review Focus

1. **Slide:** nur bei klingender Vorgängerin; kein Knacken beim Übergang; der Akkord gleitet tonweise.
2. **Akkorde:** Die Oktave hängt an der Skalenlänge (Pentatonik). Die Grenzen der Roll-Zeilen sind egal, Akkordtöne dürfen höher liegen.
3. **Note löschen bzw. neu setzen** entfernt die Attribute. Eine Längenänderung über Neusetzen verliert sie, bewusst.
4. **Engine-Kosten:** Ohne Attribute keine zusätzlichen Knoten.

## Aufgaben

1. **core:** Typen, `toggleNoteFlag`, `cycleChord`, `chordDegrees`, `noteMidis`, `readNotes`. Tests.
2. **audio:** `synthNote` mit `midis[]`, `accent`, `slide`. Engine-Planung und Vorhören. Referenz-Szenario `synthAttrs`, Test `next-synth-attrs.test.ts`. Bench.
3. **UI:** Werkzeug-Segment in `roll.ts`, Store-Befehle `toggleNoteFlag` und `cycleChord`, Anzeige, Tests.
4. **E2E, Doku, Budget-Ruling, Version 0.22.0.**
