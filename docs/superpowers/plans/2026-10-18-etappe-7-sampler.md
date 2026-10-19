# Etappe 7: Sampler – Implementierungsplan (kompakt)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Testgetrieben.

**Spec:** `docs/superpowers/specs/2026-10-18-etappe-7-sampler-design.md`

## Global Constraints

- Branch `etappe-7`, Version 0.24.0.
- Abdeckung ≥ 90 %, Touch ≥ 44 px, Design-Regeln aus CLAUDE.md.
- Alte Stände bytegleich (`sl`, `n`, `k` nur, wenn gesetzt).
- Kein zusätzlicher Audio-Knoten; `npm run bench` gleich.

## Review Focus

1. **Slice-Zahl verkleinern**, wenn Steps höhere Slices tragen: Gespielt wird das letzte Slice, die Daten bleiben erhalten.
2. **Rückwärts mit Chop**: Die Slices liegen auf den richtigen Bereichen.
3. **Pad leeren bzw. neues Sample laden**: Ob Chop bleibt, ist entschieden: Chop gehört zum Pad und bleibt, wie Start und Ende.
4. **Tastatur während der Wiedergabe**: spielt mit, schneidet wie jeder Pad-Treffer die vorige Stimme des Pads ab (`steal`).
5. **Pitch zusammen mit einem Tune-Lock**: Beides addiert sich.

## Aufgaben

1. **core:**
   - Typen `Pad.sl?`, `StepOpt.n?` und `StepOpt.k?`.
   - `core/chop.ts`: `CHOP_SIZES`, `setChop`, `sliceRange(pad, k)`, `distributeSlices(s, pad)`, `padPitch(o)`.
   - Normalisieren in `stepopts.ts` (`n` und `k`, nur Pads) und Lesen in `persist.ts` (Pads und Optionen).
   - `optLook` markiert `n` und `k`.
   - Tests.
2. **audio:** `schedulePad` wendet Slice und Pitch an. `auditionPad(pad, semis?)` für die Tastatur. Referenz-Szenario und Test. Bench.
3. **UI:**
   - Chop-Segment und „Verteilen“ in `sampler/tools.ts`.
   - Slice-Linien in `wave.ts`.
   - Pitch und Slice im Opt-Feld.
   - Tastatur `sampler/keyboard.ts`.
   - `UiAudio.auditionPad(pad, semis?)`.
   - Store-Befehl `distributeSlices` mit Zurück.
   - Tests.
4. **E2E, Doku, Version 0.24.0.**
