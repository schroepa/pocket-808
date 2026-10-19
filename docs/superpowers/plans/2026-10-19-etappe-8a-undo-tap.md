# Etappe 8a: Undo-Stapel und Tap-Tempo – Implementierungsplan (kompakt)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Testgetrieben.

**Spec:** `docs/superpowers/specs/2026-10-19-etappe-8a-undo-tap-design.md`

## Global Constraints

- Branch `etappe-8a`, Version 0.25.0. Abdeckung ≥ 90 %, Touch ≥ 44 px, Design-Regeln aus CLAUDE.md.
- Bestehendes Verhalten von `undo()` bei einem Schritt bleibt gleich.

## Review Focus

1. **Stapel und Zustandswechsel:** Zurück nach Projekt öffnen, Szenen-Abruf und Pattern-Änderungen in gemischter Reihenfolge stellt jeweils genau den vorigen Zustand her.
2. **Tiefe 20:** der älteste Schritt fällt heraus, nichts bricht.
3. **Tap:** sehr schnelle oder sehr langsame Tipps bleiben im Bereich 60–200.

## Aufgaben

1. **core + store:** `core/tap.ts` (`tapTempo`, `TAP_MAX`), Undo-Stapel im Store (`UNDO_DEPTH` 20). Tests.
2. **UI, E2E, Doku:** Knopf „Tap“ im Deck, Taste T, E2E, README, Funktionsliste, CLAUDE.md, Version 0.25.0.
