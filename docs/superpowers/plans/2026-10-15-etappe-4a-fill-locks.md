# Etappe 4a: Fill und Parameter-Locks – Implementierungsplan (kompakt)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Testgetrieben.

**Goal:** Fill-Taste mit den Bedingungen „Fill“/„Nicht Fill“ sowie Tune-, Decay- und Start-Locks pro Step.

**Spec:** `docs/superpowers/specs/2026-10-15-etappe-4a-fill-locks-design.md`

## Global Constraints

Wie in Etappe 3: Branch `etappe-4a`, Version 0.19.0, Abdeckung ≥ 90 %, Touch-Ziele ≥ 44 px. Ein Pattern ohne Optionen hat weiterhin kein `opt`-Feld.

## Review Focus

1. **Fill hängt nie:** Loslassen, Abbruch, Zeigerverlust, Fokusverlust, ein Wechsel in den Hintergrund und Taste F (keyup) schalten Fill immer aus.
2. **Varianten-Cache:**
   - nie parallele Renderings
   - LRU bei 64 Einträgen
   - eine noch nicht fertige Variante spielt den Normal-Buffer
   - `prerenderAll` wartet auch auf Varianten (Export)
3. **Locks und Spurwerte:** Ohne Lock folgt der Step der Spur, also auch späteren Änderungen von Tune/Decay. Mit Lock bleibt er fest.
4. **Pad-Start-Lock:** Start bleibt mindestens 0,02 vor dem Ende. Mit Rückwärts gilt der Start wie beim normalen Pad.

## Aufgaben

1. **core:**
   - `StepCond` um `fill` und `notFill` erweitern.
   - `condPasses(c, n, fill = false)`.
   - `StepOpt` um `t`, `d`, `s` erweitern; normalisieren (Lock-Felder bleiben, auch bei Gleichheit).
   - `readOpt` (s nur bei `P*`).
   - Helfer `hasLock(o)`.
   - Tests.
2. **Engine:**
   - `setFill(on)`.
   - `trig` mit Fill.
   - Drums: `hit(voice, t, p, lock?)` mit Varianten-Cache in `drums.ts` und `ensureVariants(list)`; ein Engine-Effekt sammelt die Locks aller Patterns.
   - Pads: Params überschreiben.
   - `prerenderAll` wartet auf die Warteschlange.
   - Referenz-Szenarien `lockHits` und `fillHits`, Test `next-locks.test.ts`.
   - Bench.
3. **UI:**
   - `UiAudio.setFill`.
   - Fill-Haltetaste in `transport.ts` (Muster wie Stutter), Taste F in `keys.ts` (keydown ohne repeat, keyup).
   - Lock-Zeile im Opt-Feld (Knobs, Klasse `locked`, „Locks lösen“ mit Zurück über `store.resetStepLocks`).
   - Marke auch bei Locks.
   - Tests.
4. **E2E, Doku, Version 0.19.0.**
