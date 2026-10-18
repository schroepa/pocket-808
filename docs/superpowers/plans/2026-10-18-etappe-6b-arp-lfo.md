# Etappe 6b: Arpeggiator und LFO – Implementierungsplan (kompakt)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Testgetrieben.

**Spec:** `docs/superpowers/specs/2026-10-18-etappe-6b-arp-lfo-design.md`

## Global Constraints

- Branch `etappe-6b`, Version 0.23.0.
- Abdeckung ≥ 90 %, Touch ≥ 44 px, Design-Regeln aus CLAUDE.md.
- Alte Stände bytegleich (keine Felder `arp`/`lfo`, solange nicht gesetzt).
- Automation immer mit Anker (`rampFrom`).
- Ohne Arp und LFO keine zusätzlichen Audio-Knoten; `npm run bench` gleich.

## Review Focus

1. **LFO-Verbindungen** werden gelöst, wenn die Note endet. Auch abgeschnittene Noten (monophon) dürfen nichts liegen lassen.
2. **Depth auf 0** stoppt und verwirft den LFO. Ein erneutes Aufdrehen legt ihn wieder an.
3. **Arp und Lookahead:** Arp-Töne einer langen Note werden im Voraus geplant. Stopp und Neustart dürfen keine hängenden Töne hinterlassen (gleiches Verhalten wie lange Noten heute).
4. **Arp mit Slide und Akzent:** Slide nur am ersten Ton, Akzent auf allen.
5. **Preset laden** lässt Arp und LFO stehen.

## Aufgaben

1. **core:** Typen `ArpMode`, `ArpSettings`, `LfoSettings`, `SynthPatch.arp?`, `SynthPatch.lfo?`. Neue Datei `core/arp.ts` mit:
   - `ARP_MODES`, `ARP_LABELS`
   - `arpPool(midis, o)` und `arpSequence(midis, a, count, rnd)`
   - `lfoHz(r)`, `lfoCents(l)`
   - `setArp(s, part, a | undefined)` und `setLfo(s, part, patch)`
   - `persist.ts` liest `arp`/`lfo`
   - Tests
2. **audio:**
   - `audio/lfo.ts`: `createLfo(ctx, dest?)` mit `set(l, t)`, `attach(target, filter, oscs)` und `stop()`.
   - `synthNote` bekommt die Option `lfo` (Ziel und Gain) und verbindet sie.
   - Engine: LFO je Part über einen Effekt; Arp-Planung im Scheduler mit dem Zufallsstrom `arp`.
   - Referenz-Szenario `synthArpLfo` mit Test.
   - Bench.
3. **UI:** Module Arp und LFO in `modules.ts`, Zusammenfassung „· Arp“, Store über `store.update` mit den core-Funktionen. Tests.
4. **E2E, Doku, Version 0.23.0.**
