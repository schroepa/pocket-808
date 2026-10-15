# Etappe 3: Step-Optionen – Implementierungsplan (kompakt)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Testgetrieben: erst den Test schreiben, rot sehen, dann den Code.

**Goal:** Velocity, Wahrscheinlichkeit und Bedingungen pro Step für Drums und Sampler-Pads, gespeichert im Pattern, hörbar in Wiedergabe und Export.

**Spec:** `docs/superpowers/specs/2026-10-15-etappe-3-step-optionen-design.md`

## Global Constraints

- Branch `etappe-3`. Deutsch, Schichtregel, `must()`, Abdeckung ≥ 90 % pro Datei.
- Design-Regeln aus CLAUDE.md, Touch-Ziele ≥ 44 px.
- **Bestehende Referenzen und Speicherstände unverändert:** Ein Pattern ohne Optionen hat kein `opt`-Feld.
- Werte:
  - Velocity-Faktor v².
  - Schnellwahl 0,35 / 0,7 / 1.
  - Bedingungen `all 1:2 2:2 1:3 2:3 3:3 1:4 2:4 3:4 4:4 first notFirst`, Labels „Immer … Erster, Nicht erster“.
- Version 0.18.0.

## Review Focus

1. **Alte Speicherstände** bleiben bytegleich, ohne `opt`. Kaputte `opt`-Daten fallen still weg.
2. **Step aus, dann wieder an:** Die Optionen sind weg (keine versteckten Reste).
3. **Bedingungen im Song:** Gezählt wird je Slot. Ein Wechsel zwischen Pattern und Song oder ein Neustart beginnt bei Durchlauf 1.
4. **Sub-Steps mit Optionen:** Es wird einmal gewürfelt, Velocity gilt für alle Teil-Schläge.
5. **Opt- und Sub-Modus schließen sich aus.** Ein Slot-Wechsel im Opt-Modus behält den gewählten Step.

## Aufgaben

### Task 1: core

- **`core/types.ts`:**
  - `StepCond`
  - `StepOpt { v?: number; p?: number; c?: StepCond }`
  - `OptMap = Partial<Record<SubKey, Partial<Record<number, StepOpt>>>>`
  - `Pattern.opt?: OptMap`
- **`core/stepopts.ts`:**
  - `STEP_CONDS: readonly { value: StepCond; label: string }[]`
  - `stepOptOf(p, key, step): Required<StepOpt>` (mit Standards)
  - `setStepOpt(state, key, step, patch: StepOpt): State` (normalisiert; `{}` setzt zurück)
  - `condPasses(c, n): boolean` (n = Durchlauf ab 1)
  - `velocityGain(v) = v * v`
  - `withoutOpt(p, key, step?)` (intern für die Pattern-Befehle)
- **`core/persist.ts`:** `readPattern` liest `opt` mit Prüfung. Ohne gültige Einträge kein Feld. Ein fehlendes `opt` übernimmt `prev.opt` wie bei `sub`.
- **`core/pattern.ts`:**
  - `toggleDrumStep` und `toggleSampleStep` entfernen beim Ausschalten die Optionen des Steps.
  - `clearTrack` entfernt die Optionen der Stimme.
- **`core/presets.ts`:** Drum-Optionen fallen weg, `P*` bleiben.
- **Tests:** `stepopts.test.ts` sowie Ergänzungen in `persist.test.ts`, `pattern.test.ts` und `presets.test.ts`. Der Referenz-Fuzz (`core-persist`) bleibt grün.

### Task 2: Engine und Referenz

- **`engine.ts`:**
  - Durchlauf-Zähler `loops: Partial<Record<Slot, number>>`. Er wird bei `start()` und bei jeder Erhöhung von `songEpoch` geleert und bei Step 0 für den gespielten Slot erhöht.
  - Zufallsstrom `random('prob')`.
  - Pro Drum-Stimme und Pad gilt: `o = stepOptOf(...)`. Wenn `!condPasses(o.c, n) || rnd() >= o.p`, wird nichts geplant. Sonst `scheduleDrum(id, t, o.v)` bzw. `schedulePad(i, t, o.v)`.
  - `schedule.drum(voice, time, velocity = 1)` bzw. `schedule.pad(pad, time, velocity = 1)`.
  - Drums: `params.level * velocityGain(v)`.
  - Pads: `{ ...pad, lvl: pad.lvl * v }`.
- **Referenz-Szenarien** (`tests/reference/next/scenarios.ts`) und Test `tests/reference/next-stepopts.test.ts`:
  - Velocity 0,5 auf BD ergibt eine Spitze von etwa 0,25 × voll (Toleranz ±0,05, isoliert, ohne Master-Sättigung: Spitze vor dem Bus über `instrument`, oder Verhältnis der RMS-Werte zweier Renderings).
  - Bedingung 1:2 über 4 Takte ergibt BD-Treffer nur in den Takten 1 und 3 (über `onScheduled` und einen Spion an `schedule.drum`).
  - Wahrscheinlichkeit 0 ergibt keinen Treffer.
- `npm run bench` muss gleich bleiben.

### Task 3: Store und Oberfläche

- **`store.setStepOpt(key, step, patch)`** (ohne Zurück) und **`store.resetStepOpt(key, step)`** (mit Zurück).
- **`ui/panels/step-opts.ts`:** `stepOptsPanel(c, { key, step, label, audition })` mit:
  - Titel
  - Knob Velocity (`def` 1)
  - Chips Leise/Mittel/Voll (`active`, wenn gleich)
  - Knob Chance
  - `select` Bedingung (44 px, 16 px Schrift)
  - Zurücksetzen
- **Step-Editor:** Chip „Opt“ und Signal `createEditorOpt()`. Opt und Sub schließen sich aus. Im Opt-Modus wählt ein Step-Tipp den Step; ein ausgeschalteter Step wird dabei eingeschaltet (Vorhören im Stand).
- **Sampler-Steps:** dasselbe (Schlüssel `P{sel}`).
- **Anzeige:**
  - `--vel` auf Step-Knöpfen, Spurzellen und Sampler-Steps.
  - Klasse `opt` bei p < 1 oder c ≠ all.
  - CSS: `color-mix` mit `--vel`, Marke als kleiner Punkt unten rechts.
- **Tests** für Panel, Editor, Sampler und Spuren.

### Task 4: E2E, Doku, Version

- **`tests/e2e/stepopts.spec.ts`** auf allen Ansichten:
  - Opt-Modus öffnen, Step 3 antippen (wird eingeschaltet), „Leise“, Bedingung 1:2.
  - Nach dem Neuladen noch gesetzt.
  - Touch-Ziele ≥ 44 px im Panel.
- **axe** mit offenem Opt-Panel.
- **Screenshots** nur, wenn sich die Startansicht ändert (Chip „Opt“ im Kopf des Editors).
- **Budget** prüfen.
- **Doku:** Funktionsliste, README (Funktionen, Technik, Testzahlen, Roadmap ✅), CLAUDE.md (Roadmap, Architekturzeile), Version 0.18.0.
