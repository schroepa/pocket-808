# Etappe 5: Spielspaß – Implementierungsplan (kompakt)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Testgetrieben.

**Spec:** `docs/superpowers/specs/2026-10-18-etappe-5-spielspass-design.md`

## Global Constraints

- Branch `etappe-5`, Version 0.21.0.
- Abdeckung ≥ 90 %, Touch-Ziele ≥ 44 px.
- Alte Stände bytegleich: `scenes` und neue `opt` erscheinen erst bei Benutzung.
- Kein dauerhaftes Zeichnen ohne Wiedergabe. Größenbudget prüfen und bei Bedarf per Ruling anheben.

## Review Focus

1. **LCD:** Kein `requestAnimationFrame`-Lauf im Stand oder im Hintergrund. Beim Abbau wird die Schleife beendet. Canvas-Größe folgt dem Layout (ResizeObserver).
2. **Würfeln** ändert nie Noten, Sampler oder Sub-Steps. Zurück stellt exakt wieder her.
3. **Szenen:** Abruf verändert nur Pegel, Mute und Solo. Ein Solo in einer Szene wirkt sofort richtig.
4. **Projektdatei** trägt Szenen. Ein alter Speicherstand ohne Szenen bleibt bytegleich.

## Aufgaben

1. **core:**
   - `core/vary.ts` (`vary`).
   - `core/scenes.ts` (`saveScene`, `recallScene`, `SceneMix`).
   - Typen.
   - `loadState` für `scenes`.
   - Tests.
2. **Store, UI:**
   - `store.vary(rng)` und `store.recallScene(i)` mit Zurück.
   - Taste „Würfeln“ in `patterns.ts`.
   - Szenen-Zeile in `mixer.ts`.
   - Tests.
3. **Audio, LCD:**
   - `graph.analyser()` (lazy).
   - `engine.scope(into)`.
   - `UiAudio.scope`.
   - LCD-Streifen in `deck.ts` (`ui/panels/lcd-scope.ts`).
   - Tests.
4. **E2E, Doku, Version 0.21.0.**
