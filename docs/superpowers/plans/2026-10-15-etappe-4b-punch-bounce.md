# Etappe 4b: Punch-in-Effekte und Bounce – Implementierungsplan (kompakt)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Testgetrieben.

**Spec:** `docs/superpowers/specs/2026-10-15-etappe-4b-punch-bounce-design.md`

## Global Constraints

Branch `etappe-4b`, Version 0.20.0. Abdeckung ≥ 90 %, Touch-Ziele ≥ 44 px, Bench unverändert, keine dauerhaft laufenden Knoten vor der ersten Benutzung.

## Review Focus

1. **Nichts hängt:** Jeder Effekt geht beim Loslassen, beim Stopp und bei `dispose` aus. Ein ersetzender Effekt löst den vorigen sauber, ohne Knacken (Rampen).
2. **Tape:** Nach dem Loslassen ist die Verzögerung wieder 0, und es bleibt kein Versatz im trockenen Signal.
3. **Half-Time** wirkt auch auf Sub-Steps und Notenlängen. Loslassen mitten im Takt bricht das Raster nicht.
4. **Bounce:** Kein Ersetzen ohne Bestätigung bei vollem Pad. Länge höchstens 3 s.
5. **Neues Gerät** auf Tablet (Tabs) und Desktop (Spalten): kein Überlauf.

## Aufgaben

1. **Graph und Engine:**
   - `graph.punchOn(kind, t, opts)` und `punchOff(kind, t)` für `tape`, `crush`, `echo`, `lp`, `hp`.
   - Engine: `punchOn(kind)` und `punchOff(kind)` mit `PunchKind = 'loop8' | 'loop16' | 'half' | 'tape' | 'crush' | 'lp' | 'hp' | 'echo'`.
   - Ausschluss der ersetzenden Effekte, auch gegenüber `stutterOn`.
   - Half-Time im Scheduler.
   - Alles lösen bei `stop` und `dispose`.
   - Referenz-Szenarien `punchProbe` und `echoTail`, Test `next-punch.test.ts`.
   - Bench.
2. **Oberfläche Punch:**
   - `UiAudio.punchOn` und `punchOff`.
   - Gerät `ui/panels/punch/` mit `punchDevice` (id `punch`), 8 Haltetasten, Zusammenfassung „8 Effekte · halten“ bzw. die gehaltenen.
   - Registrierung in der Shell.
   - Tests.
3. **Bounce:**
   - `UiAudio.bounce(state): Promise<{ pcm: Float32Array; cut: boolean } | null>` (main: `renderOffline` → `toPcm`).
   - Sampler-Werkzeug mit Bestätigung.
   - Tests.
4. **E2E, Doku, Version 0.20.0.**
