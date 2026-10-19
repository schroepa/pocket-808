# Etappe 8b: Live-Aufnahme – Implementierungsplan (kompakt)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Testgetrieben.

**Spec:** `docs/superpowers/specs/2026-10-19-etappe-8b-live-aufnahme-design.md`

## Global Constraints

- Branch `etappe-8b`, Version 0.26.0. Abdeckung ≥ 90 %, Touch ≥ 44 px, Design-Regeln aus CLAUDE.md.
- Ohne Aufnahme keine Änderung am Klang oder an den Knoten (`npm run bench` gleich).
- Kein neues Feld im Speicherformat.

## Review Focus

1. **Quantize:** ein Schlag kurz vor Step 1 (nach Step 16) landet auf Step 1 des nächsten Durchlaufs bzw. Patterns, nicht auf Step 16.
2. **Song-Modus:** Aufnahme landet im laufenden Slot, nicht im gewählten.
3. **Take:** Stopp und erneuter Start beginnt einen neuen Take (neuer Zurück-Schritt).
4. **Count-in:** Stopp während des Vorzählers hinterlässt keine Klicks und keinen halben Zustand.
5. **Rec ohne Wiedergabe:** Tippen nimmt nichts auf und ändert nichts.

## Aufgaben

1. **core + store:** `core/record.ts` (`recordHit`, Typ `RecHit`), Store `beginTake`, `recordHit`. Tests.
2. **audio:** Engine `setRecording`, `recording`, `takeId`, `nearestStep`, Vorzähler. `UiAudio`-Erweiterung. Tests, Bench.
3. **UI:** Rec-Knopf, `ui/record.ts`, Anschluss in Spuren, Pads, Tastatur, Piano-Roll. Tests.
4. **E2E, Doku, Version 0.26.0.**
