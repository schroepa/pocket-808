# Etappe 5: Spielspaß à la OP–1 — Plan

Stand: 2026-10-16 (Entscheidungen fix).  
**Spec:** [2026-10-16-etappe-5-spielspass-design.md](../specs/2026-10-16-etappe-5-spielspass-design.md)  
Bezug: [OP–1 field](https://teenage.engineering/products/op-1)

**Goal:** Lebendigeres LCD, kontrollierte Tombola, 8 Mute-Szenen. Kein OP–1-Hardware-Klon.

**Reihenfolge vs. 4b:** **5a startet jetzt** auf `main` (nicht auf Punch/Bounce warten).

---

## Beschlüsse

1. 5a parallel zu offenem 4b starten  
2. Peak im LCD: **ja** (Analyser, ~20 Hz)  
3. Tombola: **Chance · Ghost · Streuen** (keine Locks, kein Synth, max. 4 Flips beim Streuen)  
4. Szenen: **8**

## Teil-Etappen

### 5a — LCD + Peak (als Nächstes)

- Modul `ui/panels/lcd.ts` (+ CSS) im Deck; Readout-Flash bleibt.
- Tempo, Status, Step-Punkt, Mode-Glyphs (Fill/Stutter/Pattern·Song).
- Peak: ein `AnalyserNode` nach Master-Gain; Offline ohne Einfluss.
- Reduced Motion; Layout 390 px stabil.
- Tests: Unit, E2E Mobile + axe, Bench-Smoke.

### 5b — Tombola

- Chip Würfel + drei Modi laut Spec.
- `core`-Funktionen + RNG; ein Undo pro Wurf.
- LCD-Flash.

### 5c — 8 Mute-Szenen

- State `scenes[8]`; Tippen laden, lang/sichern speichern.
- Migration in `loadState`; UI Mixer/Transport; Touch ≥ 44 px.

## Umsetzungsschritte (5a)

1. Spec im Repo spiegeln unter `docs/superpowers/specs/` wenn Branch startet.
2. Branch `etappe-5a` (oder Cloud-Äquivalent).
3. Analyser-Hook in Graph/Engine (Peak-API für UI).
4. LCD-UI + CSS Tokens only.
5. Unit + E2E + README/Funktionsliste; Version bump nach Merge-Konvention.

## Global Constraints

Deutsch UI; Tokens unverändert; `must()`; Schichtregel; iPhone-Budget; Coverage ≥ 90 % neuer Dateien.

## Review-Fokus

Peak dispose/Drossel · Tombola Undo/Locks · 8 Szenen Migration · LCD Motion/Höhe.
