# Fundament Schritt 4: `audio` – Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die Audio-Engine der App als TypeScript in `src/audio/` – klanglich gleich zu Legacy (gegen dieselben Referenzdateien geprüft), mit behobenem Rausch-Versatz, ohne mehr Audio-Knoten als Legacy, gesteuert vom Store.

**Architecture:** Reine Klangberechnung (`dsp.ts`) ist ohne Audio testbar. `voices.ts` enthält die zehn Drum-Stimmen 1:1, `drums.ts` Vorrendern und Wiedergabe mit Voice-Stealing, `graph.ts` die Master-Kette mit Kanalzügen, Sends und Stutter, `synth.ts` und `sampler.ts` die übrigen Stimmen. `engine.ts` verdrahtet alles mit dem Store (Effekte für Live-Parameter) und enthält den Lookahead-Scheduler auf Basis der `core`-Funktionen. Audio-Kontext, Offline-Kontext, Zeitquelle, Zeitgeber und Zufall sind austauschbar. Gleichwertigkeit: Ein zweiter Szenario-Runner („next“) rendert dieselben Szenarien wie die Legacy-Referenztests mit der neuen Engine und vergleicht mit denselben Referenzdateien und Toleranzen.

**Tech Stack:** TypeScript 6.0, Web Audio API, node-web-audio-api (Tests), Vitest 5, fast-check 4.

**Spec:** `docs/superpowers/specs/2026-10-13-fundament-design.md` (Abschnitt 1 „audio“, Abschnitt 2, Abschnitt 4 Schritt 4, Änderung vom 2026-10-14)

## Global Constraints

- Deutsch für Kommentare, Tests, Meldungen, Commits. Commits enden mit `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Nicht pushen.
- `src/audio/**` importiert `src/core/**` und `src/store/**`, nicht `src/ui/**` (Schichtregel). Keine Laufzeit-Abhängigkeiten.
- Produktionscode ohne `!`-Assertions (`must()`).
- Klang wie Legacy: Referenzdateien unter `tests/reference/golden/` mit `TOLERANCE` aus `tests/reference/tolerance.ts`. Ausnahme (Spezifikation, Änderung 2026-10-14): Rauschen startet sample-genau; nur Referenzen von SD, CP, RS und davon abhängige Mix-Szenarien werden in Task 2 bewusst neu erzeugt.
- Performance: Audio-Knoten pro Sekunde ≤ Legacy-Referenz (`golden/bench/*.json`), Renderzeit ≤ 1,5 × Referenz.
- Master-Spitze im Demo-Szenario 0,72–0,82.
- Befehl-Präfix **`[n]`** = `source ~/.nvm/nvm.sh && nvm use >/dev/null && `.
- Commits nur nach `npm run format && npm run lint && npm run typecheck`. Arbeit auf Branch `audio` (existiert, enthält die Spezifikationsänderung).

## Review Focus

1. **Unterschiedlicher Zufallsverbrauch** (Reihenfolge, Anzahl der Aufrufe) zwischen Legacy und Engine verfälscht Rausch-Stimmen und Reverb unbemerkt → Referenzvergleich je Stimme und Mix-Szenario, Task 4–6.
2. **Live-Parameter wirken nicht oder doppelt** (Mixer, FX, Tempo, Tune/Decay während der Wiedergabe) → Engine-Tests mit Store-Änderungen, Task 6.
3. **Hängende oder fehlende Stimmen** (Voice-Stealing, CH würgt OH, monophoner Synth, Sub-Step-Rolls) → Mix- und Bench-Szenarien, Task 6.
4. **Start vor Ende des Vorrenderns** → Live-Synthese als Rückfall, Task 4/6.
5. **Song-Wiedergabe folgt nicht** (Cursor-Neustart bei Moduswechsel, Slot-Folgen) → Sequenzvergleich und `tick`-Test, Task 6.

---

## Dateistruktur (Ergebnis)

```
src/core/random.ts        mulberry32, tagHash, seededRandom (geteilt mit der Test-Harness)
src/audio/dsp.ts          Kennlinie, Rauschen, Impulsantwort, Fabrik-Samples, DJ-Filter, Delay-Zeit
src/audio/params.ts       holdAt, Hilfen für AudioParam
src/audio/voices.ts       die zehn Drum-Stimmen (Legacy VOICE_FN) und renderVoice
src/audio/drums.ts        Vorrender-Bank, Treffer mit Voice-Stealing, eigene Drum-Samples
src/audio/graph.ts        Master-Kette, Kanalzüge, Sends, Reverb-Tausch, Stutter
src/audio/synth.ts        SH-101-Stimme (ADSR, monophon)
src/audio/sampler.ts      Pads mit Vorwärts-/Rückwärts-Puffern
src/audio/engine.ts       createEngine: Store-Anbindung, Scheduler, Start/Stopp, Vorhören, Abspielposition
src/audio/*.test.ts       Unit-Tests (reine Teile)
tests/reference/next/     Szenarien und Runner für die neue Engine
tests/reference/next-*.test.ts   Vergleich mit den Referenzdateien
```

---

### Task 1: Store friert immer ein

**Files:**
- Modify: `src/store/store.ts`, `src/store/store.test.ts`

- [ ] **Step 1: Failing Test** – in `src/store/store.test.ts` den Test „friert im Testlauf (Entwicklungsmodus) standardmäßig ein“ ersetzen:

```ts
  it('friert standardmäßig immer ein (nicht nur im Entwicklungsmodus)', () => {
    vi.stubEnv('DEV', false);
    try {
      expect(Object.isFrozen(createStore(baseState()).state.value)).toBe(true);
    } finally {
      vi.unstubAllEnvs();
    }
  });
```

```bash
[n] npx vitest run src/store/store.test.ts
```
Expected: FAIL (bisher hängt der Standard an `import.meta.env.DEV`).

- [ ] **Step 2: Umsetzung** – in `createStore`: `const freeze = opts.freeze ?? true;`, Doc-Kommentar: „Jeder neue Zustand wird eingefroren (Entscheidung 2026-10-14: auch im Build), außer `freeze: false`.“

```bash
[n] npx vitest run src/store
```
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
[n] npm run format && npm run lint && npm run typecheck && git add -A && git commit -m "store: Zustand immer einfrieren, nicht nur im Entwicklungsmodus

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Zufall in `core`, Rausch-Fix in der Referenz

**Files:**
- Create: `src/core/random.ts`, `src/core/random.test.ts`
- Modify: `tests/reference/legacy/harness.ts` (Import aus `src/core/random.ts`, Patch für sample-genauen Rauschstart, HOOK um `mkCurve`, `buildIR`)
- Modify: `tests/reference/legacy/types.ts`, `tests/reference/legacy/harness.test.ts`
- Modify: `tests/reference/calibration.test.ts`
- Regenerate: `tests/reference/golden/drums/{SD,CP,RS}-*.json` und betroffene `golden/mix/*.json`

**Interfaces:**
- Produces: `type Rng = () => number`, `mulberry32(seed: number): Rng`, `tagHash(text: string): number`, `seededRandom(seed: number): (tag: string) => Rng` (Tag `'factory'` → `mulberry32(seed)`, sonst `mulberry32(tagHash(\`${seed}:${tag}\`))`).

- [ ] **Step 1: Failing Tests** – `src/core/random.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { mulberry32, seededRandom, tagHash } from './random.ts';

describe('Zufall', () => {
  it('mulberry32 ist reproduzierbar und liegt in [0, 1)', () => {
    const a = mulberry32(7);
    const b = mulberry32(7);
    const xs = Array.from({ length: 50 }, () => a());
    expect(xs).toEqual(Array.from({ length: 50 }, () => b()));
    for (const x of xs) expect(x >= 0 && x < 1).toBe(true);
  });
  it('tagHash ist FNV-1a', () => {
    expect(tagHash('')).toBe(0x811c9dc5);
    expect(tagHash('a')).toBe(0xe40c292c);
  });
  it('seededRandom: eigener Strom je Zweck, „factory“ = Grundstrom', () => {
    const r = seededRandom(1);
    expect(r('factory')()).toBe(mulberry32(1)());
    expect(r('ir')()).toBe(mulberry32(tagHash('1:ir'))());
    expect(r('voice:1')()).not.toBe(r('voice:2')());
  });
});
```

```bash
[n] npx vitest run src/core/random.test.ts
```
Expected: FAIL, Modul fehlt.

- [ ] **Step 2: `src/core/random.ts`**

```ts
export type Rng = () => number;

/** Kleiner, reproduzierbarer Zufallsgenerator. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a über einen Text. */
export function tagHash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

/**
 * Zufall je Zweck ('graph', 'ir', 'voice:<i>', 'factory'), reproduzierbar aus einem Seed.
 * Entspricht dem Neustart des Zufalls in der Legacy-Harness; 'factory' ist der Grundstrom.
 */
export function seededRandom(seed: number): (tag: string) => Rng {
  return (tag) => (tag === 'factory' ? mulberry32(seed) : mulberry32(tagHash(`${seed}:${tag}`)));
}
```
(`tagHash('a')` vorher einmal ausrechnen und den Erwartungswert im Test bestätigen; FNV-1a 32 Bit von „a“ ist `0xe40c292c`.)

```bash
[n] npx vitest run src/core/random.test.ts
```
Expected: PASS.

- [ ] **Step 3: Harness nutzt `core/random.ts`** – in `tests/reference/legacy/harness.ts` die eigenen Funktionen `mulberry32` und `hash` entfernen, stattdessen `import { mulberry32, tagHash } from '../../../src/core/random.ts';` und `export { mulberry32 };` (für bestehende Tests); in `__reseed` `tagHash` verwenden.

- [ ] **Step 4: Rausch-Fix als Patch** – in `PATCHES` ergänzen:

```ts
  {
    // Entscheidung 2026-10-14: Rauschen sample-genau starten (Bruchteil-Versatz färbte SD/CP/RS)
    find: 's.start(t,Math.random()*1.5);',
    replace: 's.start(t,Math.floor(Math.random()*1.5*ctx.sampleRate)/ctx.sampleRate);',
  },
```

HOOK um `mkCurve,buildIR` erweitern; in `types.ts`: `mkCurve(k: number, norm: boolean): Float32Array; buildIR(c: { sampleRate: number; createBuffer(ch: number, n: number, sr: number): { getChannelData(i: number): Float32Array } }, size: number, damp: number): { getChannelData(i: number): Float32Array };`

In `harness.test.ts` den Anker-Test um `expect(finds).toContain('s.start(t,Math.random()*1.5);');` ergänzen.

```bash
[n] npx vitest run tests/reference/legacy
```
Expected: PASS.

- [ ] **Step 5: Kalibrierung zeigt den Fix** – in `tests/reference/calibration.test.ts` bei `SD` `noise: false` setzen und den Kommentar anpassen („seit dem sample-genauen Rauschstart streut SD nicht mehr je Seed“).

```bash
[n] npx vitest run --project reference tests/reference/calibration.test.ts
```
Expected: PASS (vorher hätte die Seed-Toleranz bei SD versagt – das belegt den Fix). Falls FAIL: dem User berichten, nicht lockern.

- [ ] **Step 6: Referenzen bewusst neu erzeugen und Umfang prüfen**

```bash
[n] REF_UPDATE=1 npx vitest run --project reference tests/reference/drums.test.ts tests/reference/mix.test.ts tests/reference/synth.test.ts tests/reference/sampler.test.ts
git status --short tests/reference/golden | awk '{print $2}' | sed 's#tests/reference/golden/##' | tr '\n' ' '
[n] npm run test:ref
```
Expected: geändert nur `drums/SD-*`, `drums/CP-*`, `drums/RS-*` (15) und Mix-Szenarien, die SD/CP/RS enthalten (u. a. `demo`, `base`, `solo`, `reverbWet`, `reverbDry`, `master1`). Synth, Sampler und alle anderen Drums unverändert. Danach alles grün. Weicht der Umfang ab: Ursache klären, bevor committet wird.

- [ ] **Step 7: Commit**

```bash
[n] npm run format && npm run lint && npm run typecheck && git add -A && git commit -m "Referenz: Rauschen sample-genau (Entscheidung 2026-10-14), Zufall aus core

Referenzen von SD, CP, RS und betroffenen Mix-Szenarien bewusst neu erzeugt.
Kalibrierung: SD ist jetzt seed-unabhängig.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Reine Klangberechnung (`dsp.ts`)

**Files:**
- Create: `src/audio/dsp.ts`, `src/audio/dsp.test.ts`
- Create: `tests/reference/next-dsp.test.ts`

**Interfaces:**
- Produces:
  - `softClipCurve(k: number, norm: boolean): Float32Array` (Legacy `mkCurve`, 1024 Punkte)
  - `noiseData(length: number, rnd: Rng): Float32Array`
  - `impulseResponse(sampleRate: number, size: number, damp: number, rnd: Rng): Float32Array` (Legacy `buildIR`)
  - `factorySamples(rnd: Rng): Float32Array[]` (Stab, Zap, Riser, Bell; 22,05 kHz)
  - `djFilter(fx: Pick<Fx, 'dj' | 'djq'>): { lp: number; hp: number; q: number }`
  - `reverbReturn(fx: Pick<Fx, 'ret'>): number` (= ret · 1,6)
  - `delayTime(tempo: number): number` (= min(1,9; 3·60/tempo/4))
  - `stutterPeriod(tempo: number, fraction: number): number` (= min(1,9; 60/tempo · fraction))

- [ ] **Step 1: Failing Unit-Tests** – `src/audio/dsp.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../core/random.ts';
import {
  delayTime,
  djFilter,
  factorySamples,
  impulseResponse,
  noiseData,
  reverbReturn,
  softClipCurve,
  stutterPeriod,
} from './dsp.ts';

describe('dsp', () => {
  it('Kennlinie: 1024 Punkte, symmetrisch, normiert auf ±1', () => {
    const c = softClipCurve(1.4, true);
    expect(c).toHaveLength(1024);
    expect(c[0]).toBeCloseTo(-1, 6);
    expect(c[1023]).toBeCloseTo(1, 6);
    expect(c[511]! + c[512]!).toBeCloseTo(0, 6);
    expect(softClipCurve(1, false)[1023]).toBeCloseTo(Math.tanh(1), 6);
  });
  it('Rauschen liegt in [-1, 1) und ist reproduzierbar', () => {
    const a = noiseData(1000, mulberry32(3));
    expect(a).toEqual(noiseData(1000, mulberry32(3)));
    for (const x of a) expect(x >= -1 && x < 1).toBe(true);
  });
  it('Impulsantwort: Länge aus Size, Vorverzögerung still, klingt aus', () => {
    const ir = impulseResponse(44100, 0.4, 0.5, mulberry32(1));
    expect(ir).toHaveLength(Math.floor(44100 * (0.3 + 0.4 * 2.2)));
    expect(ir.slice(0, Math.floor(44100 * 0.012)).every((x) => x === 0)).toBe(true);
    expect(Math.abs(ir[ir.length - 1]!)).toBeLessThan(1e-4);
  });
  it('Fabrik-Samples: vier Klänge mit Legacy-Längen', () => {
    const f = factorySamples(mulberry32(1));
    expect(f.map((x) => x.length)).toEqual([19845, 8820, 28665, 26460]);
  });
  it('DJ-Filter: Mitte neutral, links Tiefpass, rechts Hochpass', () => {
    expect(djFilter({ dj: 0.5, djq: 0.2 })).toEqual({ lp: 20000, hp: 10, q: 0.7 });
    const lp = djFilter({ dj: 0, djq: 0 });
    expect(lp.lp).toBeCloseTo(200);
    expect(lp.hp).toBe(10);
    const hp = djFilter({ dj: 1, djq: 1 });
    expect(hp.hp).toBeCloseTo(4000);
    expect(hp.q).toBeCloseTo(9.7);
  });
  it('Return, Delay- und Stutter-Zeiten', () => {
    expect(reverbReturn({ ret: 0.5 })).toBeCloseTo(0.8);
    expect(delayTime(120)).toBeCloseTo(0.375);
    expect(delayTime(20)).toBe(1.9);
    expect(stutterPeriod(120, 0.25)).toBeCloseTo(0.125);
    expect(stutterPeriod(30, 8)).toBe(1.9);
  });
});
```

```bash
[n] npx vitest run src/audio/dsp.test.ts
```
Expected: FAIL, Modul fehlt.

- [ ] **Step 2: `src/audio/dsp.ts`** (Ausdrücke 1:1 aus Legacy, gleiche Rechenreihenfolge)

```ts
import { SMP_RATE } from '../core/constants.ts';
import type { Rng } from '../core/random.ts';
import type { Fx } from '../core/types.ts';

/** Weiche Sättigungskennlinie (Legacy mkCurve). */
export function softClipCurve(k: number, norm: boolean): Float32Array {
  const n = 1024;
  const c = new Float32Array(n);
  const d = norm ? Math.tanh(k) : 1;
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / (n - 1) - 1;
    c[i] = Math.tanh(k * x) / d;
  }
  return c;
}

export function noiseData(length: number, rnd: Rng): Float32Array {
  const d = new Float32Array(length);
  for (let i = 0; i < length; i++) d[i] = rnd() * 2 - 1;
  return d;
}

/** Impulsantwort: Rauschen mit exponentiellem Abfall, Höhen dämpfen sich mit der Zeit (Legacy buildIR). */
export function impulseResponse(sampleRate: number, size: number, damp: number, rnd: Rng): Float32Array {
  const len = 0.3 + size * 2.2;
  const n = Math.floor(sampleRate * len);
  const pre = Math.floor(sampleRate * 0.012);
  const d = new Float32Array(n);
  const a0 = 0.06 + 0.9 * Math.pow(1 - damp, 2);
  let y = 0;
  for (let i = pre; i < n; i++) {
    const x = (i - pre) / (n - pre);
    const a = Math.max(0.03, a0 * (1 - 0.7 * x));
    y += (rnd() * 2 - 1 - y) * a;
    d[i] = y * Math.pow(1 - x, 2.6);
  }
  return d;
}

const lowpass = (a: Float32Array, c: number): Float32Array => {
  let y = 0;
  for (let i = 0; i < a.length; i++) {
    y += (a[i]! - y) * c;
    a[i] = y;
  }
  return a;
};

/** Fabrik-Samples (Legacy FACTORY): Stab, Zap, Riser, Bell. Nur Riser verbraucht Zufall. */
export function factorySamples(rnd: Rng): Float32Array[] {
  const stab = (): Float32Array => {
    const n = Math.trunc(SMP_RATE * 0.9);
    const a = new Float32Array(n);
    const fr = [220, 261.63, 329.63, 392];
    for (let i = 0; i < n; i++) {
      const t = i / SMP_RATE;
      let v = 0;
      fr.forEach((f, k) => {
        const q = f * (1 + 0.003 * (k - 1.5));
        v += 2 * ((q * t) % 1) - 1;
      });
      a[i] = Math.tanh(v * 0.4) * Math.exp(-t * 4.5) * (1 - Math.exp(-t * 500));
    }
    return lowpass(a, 0.3);
  };
  const zap = (): Float32Array => {
    const n = Math.trunc(SMP_RATE * 0.4);
    const a = new Float32Array(n);
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SMP_RATE;
      ph += (2 * Math.PI * (90 + 1700 * Math.exp(-t * 14))) / SMP_RATE;
      a[i] = Math.sin(ph) * Math.exp(-t * 7);
    }
    return a;
  };
  const riser = (): Float32Array => {
    const n = Math.trunc(SMP_RATE * 1.3);
    const a = new Float32Array(n);
    let y = 0;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      y += (rnd() * 2 - 1 - y) * (0.02 + 0.85 * t * t);
      a[i] = y * Math.pow(t, 1.4) * 2.2;
    }
    return a;
  };
  const bell = (): Float32Array => {
    const n = Math.trunc(SMP_RATE * 1.2);
    const a = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / SMP_RATE;
      const e = Math.exp(-t * 5);
      a[i] = Math.sin(2 * Math.PI * 440 * t + 3 * e * Math.sin(2 * Math.PI * 616 * t)) * e;
    }
    return a;
  };
  return [stab(), zap(), riser(), bell()];
}

/** DJ-Filter: Mitte = beide offen, links Tiefpass, rechts Hochpass (Legacy applyFx). */
export function djFilter(fx: Pick<Fx, 'dj' | 'djq'>): { lp: number; hp: number; q: number } {
  const d = fx.dj - 0.5;
  const x = Math.abs(d) * 2;
  const q = Math.abs(d) > 0.001 ? 0.7 + fx.djq * 9 : 0.7;
  const lp = d < 0 ? 18000 * Math.pow(200 / 18000, x) : 20000;
  const hp = d > 0 ? 20 * Math.pow(4000 / 20, x) : 10;
  return { lp, hp, q };
}

export const reverbReturn = (fx: Pick<Fx, 'ret'>): number => fx.ret * 1.6;
/** punktierte Achtel, tempo-synchron */
export const delayTime = (tempo: number): number => Math.min(1.9, (3 * 60) / tempo / 4);
export const stutterPeriod = (tempo: number, fraction: number): number =>
  Math.min(1.9, (60 / tempo) * fraction);
```

Hinweise: In `src/audio/**` gilt das `!`-Verbot (nur Testdateien ausgenommen) – `a[i]!` in `lowpass` durch `(a[i] ?? 0)` ersetzen, wenn Lint meldet. Die Rechenreihenfolge muss Legacy entsprechen (z. B. `(3 * 60) / tempo / 4` = Legacy `3*60/state.tempo/4`; `(rnd()*2-1 - y)` = Legacy `((Math.random()*2-1)-y)`), sonst weichen Gleitkommawerte minimal ab – der Gleichheitstest in Step 4 prüft bitgenau.

```bash
[n] npx vitest run src/audio/dsp.test.ts
```
Expected: PASS.

- [ ] **Step 3: Gleichheit mit Legacy (bitgenau)** – `tests/reference/next-dsp.test.ts`

```ts
import { afterAll, describe, expect, it } from 'vitest';
import { mulberry32 } from '../../src/core/random.ts';
import { factorySamples, impulseResponse, softClipCurve } from '../../src/audio/dsp.ts';
import { loadLegacy } from './legacy/harness.ts';

const page = loadLegacy();
const w = page.window as unknown as { Math: Math };

describe('dsp = Legacy (bitgenau)', () => {
  afterAll(() => {
    page.close();
  });
  it('Kennlinie', () => {
    for (const [k, norm] of [[1.4, true], [1.6, true], [1, false]] as const) {
      expect(Array.from(softClipCurve(k, norm))).toEqual(Array.from(page.t.mkCurve(k, norm)));
    }
  });
  it('Impulsantwort', () => {
    for (const [size, damp] of [[0.4, 0.5], [0.8, 0.1], [0, 1]] as const) {
      w.Math.random = mulberry32(7);
      let legacy: Float32Array = new Float32Array(0);
      page.t.buildIR(
        {
          sampleRate: 44100,
          createBuffer: (_c, n) => {
            legacy = new Float32Array(n);
            return { getChannelData: () => legacy };
          },
        },
        size,
        damp,
      );
      expect(Array.from(impulseResponse(44100, size, damp, mulberry32(7)))).toEqual(Array.from(legacy));
    }
  });
  it('Fabrik-Samples', () => {
    w.Math.random = mulberry32(5);
    const legacy = page.t.FACTORY.map((f) => (f as unknown as { gen(): Float32Array }).gen());
    const next = factorySamples(mulberry32(5));
    for (let i = 0; i < 4; i++) expect(Array.from(next[i]!)).toEqual(Array.from(legacy[i]!));
  });
});
```

```bash
[n] npx vitest run --project reference tests/reference/next-dsp.test.ts
```
Expected: 3 PASS. Bei Abweichung: Rechenreihenfolge gegen Legacy prüfen.

- [ ] **Step 4: Commit**

```bash
[n] npm run format && npm run lint && npm run typecheck && git add -A && git commit -m "audio: reine Klangberechnung (Kennlinie, Rauschen, Impulsantwort, Fabrik-Samples), bitgleich zu Legacy

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Drum-Stimmen, Vorrendern und Runner für die neue Engine

**Files:**
- Create: `src/audio/params.ts`, `src/audio/voices.ts`
- Create: `tests/reference/next/scenarios.ts`, `tests/reference/next/runner.ts`
- Modify: `tests/reference/run.ts` (`runNext`)
- Create: `tests/reference/next-drums.test.ts`

**Interfaces:**
- Produces:
  - `holdAt(p: AudioParam, t: number): void` (cancelAndHold, Firefox-Rückfall)
  - `interface VoiceKit { ctx: BaseAudioContext; out: AudioNode; noise: AudioBuffer; kick: Float32Array; rnd: Rng; choke: { gain: GainNode | null } }`
  - `VOICE_FN: Record<VoiceId, (kit: VoiceKit, t: number, p: DrumParams) => void>`
  - `VOICE_DURATION: Record<VoiceId, number>` (Legacy `VDUR`)
  - `RENDER_ORDER: readonly VoiceId[]` (BD, SD, CH, OH, CP, LT, HT, RS, CB, CY)
  - `type OfflineFactory = (channels: number, length: number, sampleRate: number) => OfflineAudioContext`
  - `renderVoice(opts: { createOffline: OfflineFactory; sampleRate: number; voice: VoiceId; params: DrumParams; noise: AudioBuffer; kick: Float32Array; rnd: Rng }): Promise<AudioBuffer>`
  - Szenario-Runner `runNext<T>(name, args)` analog `runLegacy`.

- [ ] **Step 1: `src/audio/params.ts`**

```ts
/** Wert halten und alles Spätere verwerfen (Firefox kennt cancelAndHoldAtTime nicht). */
export function holdAt(p: AudioParam, t: number): void {
  const hold = (p as Partial<Pick<AudioParam, 'cancelAndHoldAtTime'>>).cancelAndHoldAtTime;
  if (hold) hold.call(p, t);
  else p.cancelScheduledValues(t);
}
```

- [ ] **Step 2: `src/audio/voices.ts`** (Legacy `VOICE_FN`, Hilfen `gn/flt/env/osc/noise/metal/chokeOH`, mit Rausch-Fix)

```ts
import type { Rng } from '../core/random.ts';
import type { DrumParams, VoiceId } from '../core/types.ts';

export interface VoiceKit {
  ctx: BaseAudioContext;
  out: AudioNode;
  noise: AudioBuffer;
  kick: Float32Array;
  rnd: Rng;
  /** Legacy ohChoke: die zuletzt gestartete Open Hat, die CH/OH abwürgen */
  choke: { gain: GainNode | null };
}

type Voice = (k: VoiceKit, t: number, p: DrumParams) => void;

const gn = (k: VoiceKit, v: number): GainNode => {
  const g = k.ctx.createGain();
  g.gain.value = v;
  return g;
};
const flt = (k: VoiceKit, type: BiquadFilterType, f: number, q = 0.7): BiquadFilterNode => {
  const b = k.ctx.createBiquadFilter();
  b.type = type;
  b.frequency.value = f;
  b.Q.value = q;
  return b;
};
const env = (g: GainNode, t: number, peak: number, dec: number, atk = 0.001): void => {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + atk);
  g.gain.exponentialRampToValueAtTime(0.0001, t + atk + dec);
};
const osc = (k: VoiceKit, type: OscillatorType, f: number, t: number, dur: number): OscillatorNode => {
  const o = k.ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  o.start(t);
  o.stop(t + dur);
  return o;
};
/** Rauschen ab einem zufälligen, sample-genauen Versatz (Entscheidung 2026-10-14). */
const noise = (k: VoiceKit, t: number, dur: number): AudioBufferSourceNode => {
  const s = k.ctx.createBufferSource();
  s.buffer = k.noise;
  s.loop = true;
  const sr = k.ctx.sampleRate;
  s.start(t, Math.floor(k.rnd() * 1.5 * sr) / sr);
  s.stop(t + dur);
  return s;
};

const tom =
  (base: number): Voice =>
  (k, t, p) => {
    const f = base * (0.72 + p.tune * 0.56);
    const dec = 0.16 + p.decay * 0.5;
    const o = osc(k, 'sine', f * 1.6, t, dec + 0.08);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.05);
    const g = k.ctx.createGain();
    env(g, t, 1, dec, 0.002);
    const out = gn(k, p.level * 0.85);
    o.connect(g);
    g.connect(out);
    out.connect(k.out);
  };

const METAL = [263, 400, 421, 474, 587, 845];
const metal = (k: VoiceKit, t: number, dec: number, hp: number, level: number, kk: number): GainNode => {
  const g = k.ctx.createGain();
  env(g, t, 1, dec, 0.0008);
  const h = flt(k, 'highpass', hp, 0.8);
  const out = gn(k, level);
  for (const f of METAL) osc(k, 'square', f * kk, t, dec + 0.06).connect(h);
  h.connect(g);
  g.connect(out);
  return out;
};
const chokeOH = (k: VoiceKit, t: number): void => {
  const c = k.choke.gain;
  if (!c) return;
  c.gain.setValueAtTime(1, t);
  c.gain.exponentialRampToValueAtTime(0.0001, t + 0.025);
  k.choke.gain = null;
};

export const VOICE_FN: Record<VoiceId, Voice> = {
  BD(k, t, p) {
    const f = 38 + p.tune * 44;
    const dec = 0.22 + p.decay * 1.1;
    const o = osc(k, 'sine', f * 3.4, t, dec + 0.08);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.06);
    const g = k.ctx.createGain();
    env(g, t, 1, dec, 0.002);
    const sh = k.ctx.createWaveShaper();
    sh.curve = k.kick as Float32Array<ArrayBuffer>;
    const out = gn(k, p.level * 0.9);
    o.connect(g);
    g.connect(sh);
    sh.connect(out);
    out.connect(k.out);
  },
  SD(k, t, p) {
    const f = 150 + p.tune * 80;
    const out = gn(k, p.level * 0.85);
    for (const [m, a] of [
      [1, 0.7],
      [1.85, 0.35],
    ] as const) {
      const o = osc(k, 'triangle', f * m * 1.25, t, 0.4);
      o.frequency.exponentialRampToValueAtTime(f * m, t + 0.04);
      const g = k.ctx.createGain();
      env(g, t, a, 0.09 + p.decay * 0.08);
      o.connect(g);
      g.connect(out);
    }
    const n = noise(k, t, 0.5);
    const hp = flt(k, 'highpass', 1400);
    const g = k.ctx.createGain();
    env(g, t, 0.7, 0.1 + p.decay * 0.25);
    n.connect(hp);
    hp.connect(g);
    g.connect(out);
    out.connect(k.out);
  },
  LT: tom(98),
  HT: tom(180),
  RS(k, t, p) {
    const kk = 0.85 + p.tune * 0.3;
    const dec = 0.025 + p.decay * 0.05;
    const out = gn(k, p.level * 0.6);
    const bp = flt(k, 'bandpass', 1800 * kk, 1.5);
    const g = k.ctx.createGain();
    env(g, t, 1, dec, 0.0005);
    for (const [ty, f] of [
      ['square', 1670 * kk],
      ['triangle', 480 * kk],
    ] as const) {
      osc(k, ty, f, t, dec + 0.05).connect(bp);
    }
    bp.connect(g);
    g.connect(out);
    const n = noise(k, t, 0.02);
    const hp = flt(k, 'highpass', 3000);
    const g2 = k.ctx.createGain();
    env(g2, t, 0.3, 0.008, 0.0005);
    n.connect(hp);
    hp.connect(g2);
    g2.connect(out);
    out.connect(k.out);
  },
  CP(k, t, p) {
    const tail = 0.12 + p.decay * 0.35;
    const out = gn(k, p.level * 2.6);
    const bp = flt(k, 'bandpass', 900 + p.tune * 700, 1.1);
    const g = k.ctx.createGain();
    g.gain.value = 0.0001;
    const n = noise(k, t, 0.04 + tail + 0.05);
    n.connect(bp);
    bp.connect(g);
    g.connect(out);
    out.connect(k.out);
    for (let i = 0; i < 3; i++) {
      const s = t + i * 0.0105;
      g.gain.setValueAtTime(1, s);
      g.gain.exponentialRampToValueAtTime(0.15, s + 0.009);
    }
    const s3 = t + 0.0315;
    g.gain.setValueAtTime(0.9, s3);
    g.gain.exponentialRampToValueAtTime(0.0001, s3 + tail);
  },
  CB(k, t, p) {
    const kk = 0.88 + p.tune * 0.24;
    const dec = 0.1 + p.decay * 0.5;
    const out = gn(k, p.level * 1.5);
    const bp = flt(k, 'bandpass', 1700 * kk, 0.9);
    const g = k.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(1, t + 0.001);
    g.gain.exponentialRampToValueAtTime(0.28, t + 0.025);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dec + 0.025);
    for (const f of [540, 800]) osc(k, 'square', f * kk, t, dec + 0.08).connect(bp);
    bp.connect(g);
    g.connect(out);
    out.connect(k.out);
  },
  CH(k, t, p) {
    chokeOH(k, t);
    metal(k, t, 0.03 + p.decay * 0.07, 6000 + p.tune * 3000, p.level * 1.3, 1).connect(k.out);
  },
  OH(k, t, p) {
    chokeOH(k, t);
    const out = metal(k, t, 0.18 + p.decay * 0.55, 6000 + p.tune * 3000, p.level * 1.3, 1);
    const c = gn(k, 1);
    out.connect(c);
    c.connect(k.out);
    k.choke.gain = c;
  },
  CY(k, t, p) {
    metal(k, t, 0.7 + p.decay * 1.6, 4500 + p.tune * 2500, p.level * 1.1, 0.8).connect(k.out);
  },
};

/** Länge der vorgerenderten Klänge in Sekunden (Legacy VDUR) */
export const VOICE_DURATION: Record<VoiceId, number> = {
  BD: 1.7, SD: 0.7, LT: 0.9, HT: 0.9, RS: 0.25, CP: 0.7, CB: 0.9, CH: 0.3, OH: 1.1, CY: 2.8,
};
/** Reihenfolge des Vorrenderns: häufige Stimmen zuerst (Legacy RENDER_ORDER) */
export const RENDER_ORDER: readonly VoiceId[] = ['BD', 'SD', 'CH', 'OH', 'CP', 'LT', 'HT', 'RS', 'CB', 'CY'];

export type OfflineFactory = (channels: number, length: number, sampleRate: number) => OfflineAudioContext;

/** Eine Drum-Stimme offline vorrendern (Level 1; der Pegel wirkt beim Abspielen). */
export function renderVoice(opts: {
  createOffline: OfflineFactory;
  sampleRate: number;
  voice: VoiceId;
  params: DrumParams;
  noise: AudioBuffer;
  kick: Float32Array;
  rnd: Rng;
}): Promise<AudioBuffer> {
  const { createOffline, sampleRate, voice } = opts;
  const oc = createOffline(1, Math.ceil(sampleRate * VOICE_DURATION[voice]), sampleRate);
  const bus = oc.createGain();
  bus.connect(oc.destination);
  VOICE_FN[voice](
    { ctx: oc, out: bus, noise: opts.noise, kick: opts.kick, rnd: opts.rnd, choke: { gain: null } },
    0,
    { ...opts.params, level: 1 },
  );
  return oc.startRendering();
}
```
Hinweis: Legacy-Reihenfolge `RENDER_ORDER=[0,1,7,8,5,2,3,4,6,9]` (Indizes in VOICES) = BD, SD, CH, OH, CP, LT, HT, RS, CB, CY. Legacy rendert jede Stimme mit dem Zufallsstrom `voice:<Index in VOICES>` (Harness) – die Engine verwendet denselben Tag.

- [ ] **Step 3: Runner für die neue Engine** – `tests/reference/next/scenarios.ts` (zunächst `drumVariants`)

```ts
import { createRequire } from 'node:module';
import { DRUM_DEFAULTS, VOICE_IDS } from '../../../src/core/constants.ts';
import { seededRandom } from '../../../src/core/random.ts';
import type { DrumParams, VoiceId } from '../../../src/core/types.ts';
import { must } from '../../../src/core/util.ts';
import { noiseData, softClipCurve } from '../../../src/audio/dsp.ts';
import { renderVoice, type OfflineFactory } from '../../../src/audio/voices.ts';
import { fingerprint, type Fingerprint } from '../../support/fingerprint.ts';

const require = createRequire(import.meta.url);
const wa = require('node-web-audio-api') as { OfflineAudioContext: typeof OfflineAudioContext };
export const SR = 44100;
export const createOffline: OfflineFactory = (ch, len, sr) => new wa.OfflineAudioContext(ch, len, sr);

/** Wie Legacy: Rauschpuffer (2 s, Strom 'graph') gehört dem Haupt-Kontext. */
export function sharedNoise(seed: number): AudioBuffer {
  const oc = createOffline(1, SR, SR);
  const b = oc.createBuffer(1, SR * 2, SR);
  b.getChannelData(0).set(noiseData(SR * 2, seededRandom(seed)('graph')));
  return b;
}

export async function drumVariants(args: {
  voice: VoiceId;
  seed?: number;
  variants: Record<string, Partial<DrumParams>>;
}): Promise<Record<string, Fingerprint>> {
  const seed = args.seed ?? 1;
  const random = seededRandom(seed);
  const noise = sharedNoise(seed);
  const kick = softClipCurve(1.6, true);
  const index = VOICE_IDS.indexOf(args.voice);
  const out: Record<string, Fingerprint> = {};
  for (const [name, change] of Object.entries(args.variants)) {
    const buf = await renderVoice({
      createOffline,
      sampleRate: SR,
      voice: args.voice,
      params: { ...must(DRUM_DEFAULTS[args.voice], args.voice), ...change },
      noise,
      kick,
      rnd: random(`voice:${index}`),
    });
    out[name] = fingerprint(buf.getChannelData(0), buf.sampleRate);
  }
  return out;
}

export const SCENARIOS: Record<string, (args: never) => Promise<unknown>> = { drumVariants };
```

`tests/reference/next/runner.ts`: Kopie von `tests/reference/legacy/runner.ts`, importiert `SCENARIOS` aus `./scenarios.ts`.

In `tests/reference/run.ts` die Funktion verallgemeinern und `runNext` ergänzen:

```ts
const RUNNERS = {
  legacy: fileURLToPath(new URL('./legacy/runner.ts', import.meta.url)),
  next: fileURLToPath(new URL('./next/runner.ts', import.meta.url)),
} as const;

async function runIn<T>(runner: string, name: string, args: object, attempts: number): Promise<T> {
  // (bisheriger Rumpf von runLegacy, mit `runner` statt RUNNER)
}

export const runLegacy = <T>(name: string, args: object, attempts = 3): Promise<T> =>
  runIn<T>(RUNNERS.legacy, name, args, attempts);
export const runNext = <T>(name: string, args: object, attempts = 3): Promise<T> =>
  runIn<T>(RUNNERS.next, name, args, attempts);
```

- [ ] **Step 4: Vergleich mit den Referenzdateien** – `tests/reference/next-drums.test.ts` (Kopie von `drums.test.ts` mit `runNext` und Titel „Neue Engine: Drum-Stimmen = Referenz“)

```bash
[n] npx vitest run --project reference tests/reference/next-drums.test.ts
```
Expected: 10 PASS (50 Varianten). Vor der Umsetzung von `voices.ts` (Step 2) wäre das rot; ist Step 2 schon da, zur Gegenprobe vorübergehend in `voices.ts` bei `SD` `0.09 + p.decay * 0.08` → `0.1 + p.decay * 0.08` ändern: SD muss FAIL, danach zurücksetzen.

- [ ] **Step 5: Commit**

```bash
[n] npm run format && npm run lint && npm run typecheck && git add -A && git commit -m "audio: zehn Drum-Stimmen und Vorrendern, gleich zur Referenz; Runner für die neue Engine

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Master-Kette, Synth, Sampler

**Files:**
- Create: `src/audio/graph.ts`, `src/audio/synth.ts`, `src/audio/sampler.ts`
- Modify: `tests/reference/next/scenarios.ts` (`synthPreset`, `samplerPad`)
- Create: `tests/reference/next-synth.test.ts`, `tests/reference/next-sampler.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // graph.ts
  export interface ChannelNodes { in: GainNode; pan: StereoPannerNode; snd: GainNode }
  export interface Graph {
    readonly ctx: BaseAudioContext;
    readonly bus: GainNode;
    readonly noise: AudioBuffer;
    readonly kick: Float32Array;
    readonly chan: Record<ChannelId, ChannelNodes>;
    readonly parts: Record<Part, { inp: GainNode; snd: GainNode }>;
    /** t = null: Anfangswert direkt setzen (Legacy init), sonst weich mit setTargetAtTime */
    setMaster(v: number, t: number | null): void;
    applyChannel(id: ChannelId, ch: MixChannel, audible: boolean, t: number | null): void;
    applyFx(fx: Fx, t: number | null): void;
    syncSynth(s: Pick<State, 'tempo' | 'synth'>, audible: Record<ChannelId, boolean>, t: number): void;
    muteReverb(t: number): void;
    replaceReverb(ir: Float32Array, fx: Fx, t: number): void;
    stutterOn(t: number, period: number): void;
    stutterOff(t: number): void;
  }
  export function createGraph(
    ctx: BaseAudioContext,
    s: State,
    audible: Record<ChannelId, boolean>,
    random: (tag: string) => Rng,
  ): Graph;

  // synth.ts
  export interface SynthVoice { amp: GainNode; oscs: OscillatorNode[]; t0: number; until: number }
  export function synthNote(o: {
    ctx: BaseAudioContext; dest: AudioNode; patch: SynthPatch; midi: number; time: number;
    duration: number; previous: SynthVoice | undefined;
  }): SynthVoice;

  // sampler.ts
  export interface Sampler {
    setPcm(pad: number, pcm: Float32Array | null): void;
    has(pad: number): boolean;
    play(pad: number, time: number, params: Pad, dest: AudioNode): void;
  }
  export function createSampler(ctx: BaseAudioContext, pcm: readonly (Float32Array | null)[]): Sampler;
  ```

- [ ] **Step 1: `src/audio/graph.ts`** (Legacy `setupGraph`, `applyChan`, `applyFx`, `syncFx`, `queueIR`-Tausch, `mkStutter`/`stutterOn`/`stutterOff`)

```ts
import { CHANNELS, PARTS } from '../core/constants.ts';
import { channelGain, channelPan, masterGain } from '../core/mix.ts';
import type { Rng } from '../core/random.ts';
import type { ChannelId, Fx, MixChannel, Part, State } from '../core/types.ts';
import { delayTime, djFilter, impulseResponse, noiseData, reverbReturn, softClipCurve } from './dsp.ts';
import { holdAt } from './params.ts';

// (Interfaces wie oben)

export function createGraph(
  ctx: BaseAudioContext,
  s: State,
  audible: Record<ChannelId, boolean>,
  random: (tag: string) => Rng,
): Graph {
  const c = ctx;
  const bus = c.createGain();
  bus.gain.value = 1.8;
  const comp = c.createDynamicsCompressor();
  comp.threshold.value = -12;
  comp.knee.value = 10;
  comp.ratio.value = 4;
  comp.attack.value = 0.003;
  comp.release.value = 0.15;
  const clip = c.createWaveShaper();
  clip.curve = softClipCurve(1.4, true) as Float32Array<ArrayBuffer>;
  const master = c.createGain();
  master.gain.value = masterGain(s.master);
  const dryG = c.createGain();
  const djIn = c.createGain();
  const djLP = c.createBiquadFilter();
  djLP.type = 'lowpass';
  djLP.frequency.value = 20000;
  const djHP = c.createBiquadFilter();
  djHP.type = 'highpass';
  djHP.frequency.value = 10;
  djLP.connect(djHP);
  djHP.connect(comp);
  bus.connect(dryG);
  dryG.connect(djIn);
  djIn.connect(djLP);
  comp.connect(clip);
  clip.connect(master);
  const lim = c.createDynamicsCompressor();
  lim.threshold.value = -1.5;
  lim.knee.value = 0;
  lim.ratio.value = 20;
  lim.attack.value = 0.001;
  lim.release.value = 0.08;
  const safe = c.createWaveShaper();
  safe.curve = new Float32Array([-0.98, 0.98]);
  master.connect(lim);
  lim.connect(safe);
  safe.connect(c.destination);

  const noise = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
  noise.getChannelData(0).set(noiseData(c.sampleRate * 2, random('graph')));
  const kick = softClipCurve(1.6, true);

  const dly = c.createDelay(2);
  dly.delayTime.value = (3 * 60) / s.tempo / 4;
  const dlp = c.createBiquadFilter();
  dlp.type = 'lowpass';
  dlp.frequency.value = 2400;
  const fb = c.createGain();
  fb.gain.value = 0.4;
  const dOut = c.createGain();
  dOut.gain.value = 0.75;
  dly.connect(dlp);
  dlp.connect(fb);
  fb.connect(dly);
  dlp.connect(dOut);
  dOut.connect(bus);

  const rvIn = c.createGain();
  let rvConv = c.createConvolver();
  const rvOut = c.createGain();
  rvOut.gain.value = 0;
  const irBuffer = (data: Float32Array): AudioBuffer => {
    const b = c.createBuffer(1, data.length, c.sampleRate);
    b.getChannelData(0).set(data);
    return b;
  };
  rvConv.buffer = irBuffer(impulseResponse(c.sampleRate, s.fx.size, s.fx.damp, random('ir')));
  rvIn.connect(rvConv);
  rvConv.connect(rvOut);
  rvOut.connect(bus);

  const chan = {} as Record<ChannelId, ChannelNodes>;
  for (const id of CHANNELS) {
    const inn = c.createGain();
    const pan = c.createStereoPanner();
    const snd = c.createGain();
    inn.connect(pan);
    pan.connect(bus);
    inn.connect(snd);
    snd.connect(rvIn);
    chan[id] = { in: inn, pan, snd };
  }
  const parts = {} as Record<Part, { inp: GainNode; snd: GainNode }>;
  for (const id of PARTS) {
    const inp = c.createGain();
    const snd = c.createGain();
    inp.connect(chan[id].in);
    inp.connect(snd);
    snd.connect(dly);
    parts[id] = { inp, snd };
  }

  let stutter: { inp: GainNode; dly: DelayNode; fb: GainNode; out: GainNode; on: boolean } | null =
    null;

  const graph: Graph = {
    ctx,
    bus,
    noise,
    kick,
    chan,
    parts,
    setMaster(v, t) {
      if (t === null) master.gain.value = masterGain(v);
      else master.gain.setTargetAtTime(masterGain(v), t, 0.02);
    },
    applyChannel(id, ch, aud, t) {
      const n = chan[id];
      const g = channelGain(ch, aud);
      const pn = channelPan(ch);
      if (t === null) {
        n.in.gain.value = g;
        n.pan.pan.value = pn;
        n.snd.gain.value = ch.r;
        return;
      }
      n.in.gain.setTargetAtTime(g, t, 0.015);
      n.pan.pan.setTargetAtTime(pn, t, 0.02);
      n.snd.gain.setTargetAtTime(ch.r, t, 0.02);
    },
    applyFx(fx, t) {
      const { lp, hp, q } = djFilter(fx);
      if (t === null) {
        rvOut.gain.value = reverbReturn(fx);
        djLP.frequency.value = lp;
        djHP.frequency.value = hp;
        djLP.Q.value = q;
        djHP.Q.value = q;
        return;
      }
      rvOut.gain.setTargetAtTime(reverbReturn(fx), t, 0.03);
      djLP.frequency.setTargetAtTime(lp, t, 0.02);
      djHP.frequency.setTargetAtTime(hp, t, 0.02);
      djLP.Q.setTargetAtTime(q, t, 0.02);
      djHP.Q.setTargetAtTime(q, t, 0.02);
    },
    syncSynth(st, aud, t) {
      dly.delayTime.setTargetAtTime(delayTime(st.tempo), t, 0.05);
      for (const id of PARTS) {
        const p = st.synth[id];
        parts[id].inp.gain.setTargetAtTime(aud[id] ? p.lvl * p.lvl : 0, t, 0.02);
        parts[id].snd.gain.setTargetAtTime(p.dly * 0.7, t, 0.02);
      }
    },
    muteReverb(t) {
      rvOut.gain.setTargetAtTime(0, t, 0.01);
    },
    replaceReverb(ir, fx, t) {
      // neuer Convolver statt neuem Buffer am alten Knoten (portabel); alter Hall ist schon stumm
      const nc = c.createConvolver();
      const old = rvConv;
      nc.buffer = irBuffer(ir);
      rvIn.connect(nc);
      nc.connect(rvOut);
      try {
        rvIn.disconnect(old);
        old.disconnect();
      } catch {
        /* schon getrennt */
      }
      rvConv = nc;
      graph.applyFx(fx, t);
    },
    stutterOn(t, P) {
      if (!stutter) {
        stutter = { inp: c.createGain(), dly: c.createDelay(2), fb: c.createGain(), out: c.createGain(), on: false };
        stutter.inp.gain.value = 0;
        stutter.fb.gain.value = 0;
        stutter.out.gain.value = 0;
        bus.connect(stutter.inp);
        stutter.inp.connect(stutter.dly);
        stutter.dly.connect(stutter.fb);
        stutter.fb.connect(stutter.dly);
        stutter.dly.connect(stutter.out);
        stutter.out.connect(djIn);
      }
      const st = stutter;
      for (const p of [st.inp.gain, st.fb.gain, st.out.gain, dryG.gain]) holdAt(p, t);
      st.dly.delayTime.cancelScheduledValues(t);
      st.dly.delayTime.setValueAtTime(P, t);
      st.inp.gain.setValueAtTime(1, t);
      st.inp.gain.setValueAtTime(1, t + P);
      st.inp.gain.linearRampToValueAtTime(0, t + P + 0.003);
      st.fb.gain.setValueAtTime(0.999, t);
      st.out.gain.setValueAtTime(0, t + P - 0.001);
      st.out.gain.linearRampToValueAtTime(1, t + P + 0.003);
      dryG.gain.setValueAtTime(1, t + P - 0.001);
      dryG.gain.linearRampToValueAtTime(0, t + P + 0.003);
      st.on = true;
    },
    stutterOff(t) {
      const st = stutter;
      if (!st?.on) return;
      st.on = false;
      for (const p of [st.inp.gain, st.fb.gain, st.out.gain, dryG.gain]) holdAt(p, t);
      dryG.gain.linearRampToValueAtTime(1, t + 0.008);
      st.out.gain.linearRampToValueAtTime(0, t + 0.008);
      st.inp.gain.setValueAtTime(0, t);
      st.fb.gain.linearRampToValueAtTime(0, t + 0.02);
    },
  };

  // Anfangszustand wie Legacy setupGraph: Kanäle und FX direkt, Synth-Sends weich ab currentTime
  for (const id of CHANNELS) graph.applyChannel(id, s.mix[id], audible[id], null);
  graph.applyFx(s.fx, null);
  graph.syncSynth(s, audible, c.currentTime);
  return graph;
}
```
Hinweise: Bei Lint-Meldungen zu `as Record<…>` für `chan`/`parts`: zulässig, weil die Schleife alle Schlüssel füllt (Kommentar). Die Zeitpunkte von `stutterOn`/`stutterOff` berechnet die Engine (Legacy: `ctx.currentTime + .01` bzw. `+ .005`).

- [ ] **Step 2: `src/audio/synth.ts`** (Legacy `schedAmp`, `schedFlt`, `killVoice`, `synthNote`)

```ts
import { WAVES } from '../core/constants.ts';
import { attackTime, decayTime, releaseTime } from '../core/envelope.ts';
import type { SynthPatch } from '../core/types.ts';
import { must } from '../core/util.ts';
import { holdAt } from './params.ts';

export interface SynthVoice {
  amp: GainNode;
  oscs: OscillatorNode[];
  t0: number;
  until: number;
}

/** Amp-ADSR: linearer Attack, exponentieller Decay/Release */
function schedAmp(P: AudioParam, t: number, A: number, D: number, S0: number, R: number, end: number): void {
  const S = Math.max(S0, 0.0001);
  const ta = t + A;
  const td = ta + D;
  let lv: number;
  P.setValueAtTime(0.0001, t);
  if (end <= ta) {
    lv = Math.max(0.0001, (end - t) / A);
    P.linearRampToValueAtTime(lv, end);
  } else {
    P.linearRampToValueAtTime(1, ta);
    if (end <= td) {
      lv = Math.max(0.0001, Math.pow(S, (end - ta) / D));
      P.exponentialRampToValueAtTime(lv, end);
    } else {
      lv = S;
      P.exponentialRampToValueAtTime(S, td);
    }
  }
  P.setValueAtTime(lv, end);
  P.exponentialRampToValueAtTime(0.0001, end + R);
}

/** Filter-ADSR: Cutoff wandert von base zu peak (Env-Menge), exponentiell in Hz */
function schedFlt(
  P: AudioParam, t: number, A: number, D: number, S: number, R: number, end: number, base: number, peak: number,
): void {
  const r = peak / base;
  const fe = (e: number): number => base * Math.pow(r, e);
  const ta = t + A;
  const td = ta + D;
  let e: number;
  P.setValueAtTime(base, t);
  if (end <= ta) {
    e = (end - t) / A;
    P.exponentialRampToValueAtTime(fe(e), end);
  } else {
    P.exponentialRampToValueAtTime(peak, ta);
    if (end <= td) {
      e = 1 - (1 - S) * ((end - ta) / D);
      P.exponentialRampToValueAtTime(fe(e), end);
    } else {
      e = S;
      P.exponentialRampToValueAtTime(fe(S), td);
    }
  }
  P.setValueAtTime(fe(e), end);
  P.exponentialRampToValueAtTime(base, end + R);
}

/** Monophon: vorige Note kurz abschneiden. */
function killVoice(v: SynthVoice, t: number): void {
  try {
    const tt = Math.max(t, v.t0 + 0.001);
    holdAt(v.amp.gain, tt);
    v.amp.gain.linearRampToValueAtTime(0, tt + 0.006);
    for (const o of v.oscs) {
      try {
        o.stop(tt + 0.01);
      } catch {
        /* schon gestoppt */
      }
    }
  } catch {
    /* Knoten schon abgebaut */
  }
}

export function synthNote(o: {
  ctx: BaseAudioContext;
  dest: AudioNode;
  patch: SynthPatch;
  midi: number;
  time: number;
  duration: number;
  previous: SynthVoice | undefined;
}): SynthVoice {
  const { ctx, patch: p, time: t } = o;
  const f = 440 * Math.pow(2, (o.midi - 69) / 12);
  const end = t + Math.max(0.04, o.duration);
  const fR = releaseTime(p.fr);
  const aR = releaseTime(p.ar);
  const base = 70 * Math.pow(2, p.cut * 7.2);
  const peak = Math.min(base * Math.pow(2, p.env * 4.5), 16000);
  if (o.previous && o.previous.until > t) killVoice(o.previous, t);
  const gn = (v: number): GainNode => {
    const g = ctx.createGain();
    g.gain.value = v;
    return g;
  };
  const osc = (type: OscillatorType, fr: number, dur: number): OscillatorNode => {
    const n = ctx.createOscillator();
    n.type = type;
    n.frequency.setValueAtTime(fr, t);
    n.start(t);
    n.stop(t + dur);
    return n;
  };
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = base;
  lp.Q.value = 0.5 + p.res * 14;
  schedFlt(lp.frequency, t, attackTime(p.fa), decayTime(p.fd), p.fs, fR, end, base, peak);
  const amp = ctx.createGain();
  schedAmp(amp.gain, t, attackTime(p.aa), decayTime(p.ad), p.as, aR, end);
  const life = end - t + Math.max(fR, aR) + 0.05;
  const cents = p.det * 28;
  const mix = gn(0.4);
  const oscs: OscillatorNode[] = [];
  const wave = must(WAVES[p.wave], `Wellenform ${p.wave}`)[1];
  for (const sg of [1, -1]) {
    const n = osc(wave, f, life);
    n.detune.value = sg * cents;
    n.connect(mix);
    oscs.push(n);
  }
  mix.connect(lp);
  lp.connect(amp);
  if (p.sub > 0.01) {
    const n = osc('sine', f / 2, life);
    const sg = gn(p.sub * 0.8);
    n.connect(sg);
    sg.connect(amp);
    oscs.push(n);
  }
  const out = gn(0.6);
  amp.connect(out);
  out.connect(o.dest);
  return { amp, oscs, t0: t, until: t + life };
}
```

- [ ] **Step 3: `src/audio/sampler.ts`** (Legacy `smpBufFor`, `smpPlay`, `steal` für Pads)

```ts
import { PAD_COUNT, SMP_RATE } from '../core/constants.ts';
import type { Pad } from '../core/types.ts';

export interface Sampler {
  setPcm(pad: number, pcm: Float32Array | null): void;
  has(pad: number): boolean;
  play(pad: number, time: number, params: Pad, dest: AudioNode): void;
}

interface Playing {
  src: AudioBufferSourceNode;
  g: GainNode;
  v: number;
}

export function createSampler(ctx: BaseAudioContext, initial: readonly (Float32Array | null)[]): Sampler {
  const pcm = Array.from({ length: PAD_COUNT }, (_, i) => initial[i] ?? null);
  const fwd: (AudioBuffer | null)[] = new Array<null>(PAD_COUNT).fill(null);
  const rev: (AudioBuffer | null)[] = new Array<null>(PAD_COUNT).fill(null);
  const last: (Playing | null)[] = new Array<null>(PAD_COUNT).fill(null);

  const bufferFor = (i: number, data: Float32Array, reversed: boolean): AudioBuffer => {
    const cache = reversed ? rev : fwd;
    const cached = cache[i];
    if (cached) return cached;
    const b = ctx.createBuffer(1, data.length, SMP_RATE);
    const d = b.getChannelData(0);
    if (reversed) for (let k = 0; k < data.length; k++) d[k] = data[data.length - 1 - k] ?? 0;
    else d.set(data);
    cache[i] = b;
    return b;
  };
  const steal = (i: number, t: number): void => {
    const l = last[i];
    if (!l) return;
    try {
      l.g.gain.setValueAtTime(l.v, t);
      l.g.gain.linearRampToValueAtTime(0, t + 0.006);
      l.src.stop(t + 0.008);
    } catch {
      /* schon gestoppt */
    }
    last[i] = null;
  };

  return {
    setPcm(i, data) {
      pcm[i] = data;
      fwd[i] = null;
      rev[i] = null;
    },
    has: (i) => !!pcm[i],
    play(i, t, p, dest) {
      const data = pcm[i];
      if (!data) return;
      const buf = bufferFor(i, data, p.rev);
      const len = buf.duration;
      const s0 = (p.rev ? 1 - p.end : p.start) * len;
      const s1 = Math.max(s0 + 0.02, (p.rev ? 1 - p.start : p.end) * len);
      const rate = Math.pow(2, (p.tune - 0.5) * 2);
      const play = Math.max(0.04, ((s1 - s0) / rate) * (0.08 + 0.92 * p.dec * p.dec));
      const atk = Math.min(0.002 + p.att * 0.3, play * 0.5);
      const fade = Math.min(play - atk, p.dec < 1 ? play * 0.8 : 0.012);
      steal(i, t);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = rate;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(1, t + atk);
      g.gain.setValueAtTime(1, t + play - fade);
      g.gain.exponentialRampToValueAtTime(0.0001, t + play);
      const v = p.lvl * p.lvl * 1.2;
      const out = ctx.createGain();
      out.gain.value = v;
      src.connect(g);
      g.connect(out);
      out.connect(dest);
      src.start(t, s0);
      src.stop(t + play + 0.02);
      last[i] = { src, g: out, v };
    },
  };
}
```
Hinweis zur Rechenreihenfolge: Legacy `(s1-s0)/rate*(.08+.92*p.dec*p.dec)` = `((s1 - s0) / rate) * (…)` ✓.

- [ ] **Step 4: Szenarien `synthPreset` und `samplerPad`** – in `tests/reference/next/scenarios.ts`:

```ts
import { CHANNELS, SYN_PRESETS } from '../../../src/core/constants.ts';
import { initialState } from '../../../src/core/initial.ts';
import { audibleChannels } from '../../../src/core/mix.ts';
import { factorySamples } from '../../../src/audio/dsp.ts';
import { createGraph } from '../../../src/audio/graph.ts';
import { synthNote } from '../../../src/audio/synth.ts';
import { createSampler } from '../../../src/audio/sampler.ts';
import type { Part, State } from '../../../src/core/types.ts';

export interface StereoPrint { L: Fingerprint; R: Fingerprint }

export async function renderStereo(ctx: OfflineAudioContext): Promise<StereoPrint> {
  const buf = await ctx.startRendering();
  const right = buf.numberOfChannels > 1 ? 1 : 0;
  return {
    L: fingerprint(buf.getChannelData(0), buf.sampleRate),
    R: fingerprint(buf.getChannelData(right), buf.sampleRate),
  };
}

/** Wie Legacy-Szenario: Zustand nach init, angepasst, Graph bei currentTime 0 aufgebaut. */
function graphFor(s: State, seconds: number, seed: number) {
  const ctx = createOffline(2, Math.ceil(seconds * SR), SR);
  const graph = createGraph(ctx, s, audibleChannels(s.mix), seededRandom(seed));
  return { ctx, graph };
}

export async function synthPreset(args: { part: Part; preset: string; midi: number; seed?: number }): Promise<StereoPrint> {
  const s = structuredClone(initialState());
  const preset = must(SYN_PRESETS[args.part].find((x) => x.name === args.preset), args.preset);
  s.tempo = 120;
  Object.assign(s.synth[args.part], preset.v);
  for (const id of CHANNELS) s.mix[id].r = 0;
  const { ctx, graph } = graphFor(s, 2, args.seed ?? 1);
  synthNote({ ctx, dest: graph.parts[args.part].inp, patch: s.synth[args.part], midi: args.midi, time: 0.1, duration: 0.5, previous: undefined });
  return renderStereo(ctx);
}

export async function samplerPad(args: { pad: number; seed?: number }): Promise<StereoPrint> {
  const seed = args.seed ?? 1;
  const s = structuredClone(initialState());
  s.mix.SM.r = 0;
  const { ctx, graph } = graphFor(s, 2, seed);
  const pads = factorySamples(seededRandom(seed)('factory'));
  const sampler = createSampler(ctx, pads);
  sampler.play(args.pad, 0.1, must(s.smp.pads[args.pad], `Pad ${args.pad}`), graph.chan.SM.in);
  return renderStereo(ctx);
}
```
`SCENARIOS` um `synthPreset`, `samplerPad` erweitern.

Hinweis: Legacy baut den Graph bei `currentTime = 0` und ruft danach `applyMixAll` bei 0,001 auf; das setzt dieselben Zielwerte erneut (`setTargetAtTime` ist gedächtnislos) und verändert den Klang nicht. Die neue Engine braucht diesen Aufruf deshalb nicht.

- [ ] **Step 5: Vergleichstests** – `tests/reference/next-synth.test.ts` und `tests/reference/next-sampler.test.ts` als Kopien von `synth.test.ts`/`sampler.test.ts` mit `runNext`.

```bash
[n] npx vitest run --project reference tests/reference/next-synth.test.ts tests/reference/next-sampler.test.ts
```
Expected: 10 PASS. Gegenprobe: in `synth.ts` `p.res * 14` → `p.res * 12` → Synth-Fälle FAIL; zurücksetzen.

- [ ] **Step 6: Commit**

```bash
[n] npm run format && npm run lint && npm run typecheck && git add -A && git commit -m "audio: Master-Kette, Synth und Sampler, gleich zur Referenz

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Engine mit Scheduler, Live-Parametern und Abspielposition

**Files:**
- Create: `src/audio/drums.ts`, `src/audio/engine.ts`, `src/audio/engine.test.ts`
- Modify: `tests/reference/next/scenarios.ts` (`mixScenario`, `bench`, `songSequence`)
- Create: `tests/reference/next-mix.test.ts`, `tests/reference/next-song.test.ts`
- Modify: `tests/reference/bench.test.ts` (zusätzlich die neue Engine)

**Interfaces:**
- Consumes: alles aus Task 3–5, `Store` (Schritt 3), `core` (`nextBar`, `stepSlot`, `songStart`, `stepDuration`, `swingDelay`, `subStepOffset`, `subStepsOf`, `degreeToMidi`, `effectiveLength`, `audibleChannels`).
- Produces:
  ```ts
  // drums.ts
  export interface DrumBank {
    prerenderAll(): Promise<void>;
    rerender(voice: VoiceId): void;       // entprellt 90 ms
    ready(voice: VoiceId): boolean;
    setSample(voice: VoiceId, sample: DrumSample | null): void;
    hit(voice: VoiceId, time: number, params: DrumParams): void;
  }
  export function createDrumBank(o: {
    graph: Graph; createOffline: OfflineFactory; random: (tag: string) => Rng; timer: EngineTimer;
    params: () => Record<VoiceId, DrumParams>; samples?: Partial<Record<VoiceId, DrumSample>>;
  }): DrumBank;

  // engine.ts
  export interface EngineTimer {
    setTimeout(fn: () => void, ms: number): unknown;
    clearTimeout(handle: unknown): void;
    setInterval(fn: () => void, ms: number): unknown;
    clearInterval(handle: unknown): void;
  }
  export interface ScheduledStep { step: number; time: number; slot: Slot; song: boolean; si: number }
  export interface EngineOptions {
    store: Store;
    createContext: () => BaseAudioContext;
    createOffline?: OfflineFactory;
    random?: (tag: string) => Rng;
    timer?: EngineTimer;
    clock?: () => number;
    pads?: readonly (Float32Array | null)[];
    drums?: Partial<Record<VoiceId, DrumSample>>;
    prerender?: boolean;
    beforeStart?: () => void;
    onScheduled?: (s: ScheduledStep) => void;
  }
  export interface Engine {
    prepare(): boolean;
    prerenderAll(): Promise<void>;
    drumsReady(): boolean;
    readonly playing: ReadonlySignal<boolean>;
    readonly playhead: ReadonlySignal<{ step: number; songIndex: number }>;
    start(): void;
    stop(): void;
    tick(now?: number): void;
    audition(voice: VoiceId): void;
    auditionNote(part: Part, degree: number, length?: number): void;
    auditionPad(pad: number): void;
    stutterOn(fraction: number): void;
    stutterOff(): void;
    setPadSample(pad: number, pcm: Float32Array | null): void;
    setDrumSample(voice: VoiceId, sample: DrumSample | null): void;
    readonly schedule: {
      drum(voice: VoiceId, time: number): void;
      note(part: Part, midi: number, time: number, duration: number): void;
      pad(pad: number, time: number): void;
    };
    dispose(): void;
  }
  export function createEngine(o: EngineOptions): Engine;
  ```

- [ ] **Step 1: `src/audio/drums.ts`** (Legacy `renderVoice`/`prerenderAll`/`queueRerender`/`drumHit`/`hitBuf`/`steal`/`drumSamplePlay`)

```ts
import { SMP_RATE, VOICE_IDS } from '../core/constants.ts';
import type { Rng } from '../core/random.ts';
import type { DrumSample } from '../core/samples.ts';
import type { DrumParams, VoiceId } from '../core/types.ts';
import type { EngineTimer } from './engine.ts';
import type { Graph } from './graph.ts';
import { RENDER_ORDER, renderVoice, VOICE_FN, type OfflineFactory } from './voices.ts';

interface Playing {
  src: AudioBufferSourceNode;
  g: GainNode;
  v: number;
}

export interface DrumBank {
  prerenderAll(): Promise<void>;
  rerender(voice: VoiceId): void;
  ready(voice: VoiceId): boolean;
  setSample(voice: VoiceId, sample: DrumSample | null): void;
  hit(voice: VoiceId, time: number, params: DrumParams): void;
}

export function createDrumBank(o: {
  graph: Graph;
  createOffline: OfflineFactory;
  random: (tag: string) => Rng;
  timer: EngineTimer;
  params: () => Record<VoiceId, DrumParams>;
  samples?: Partial<Record<VoiceId, DrumSample>>;
}): DrumBank {
  const { graph, timer } = o;
  const ctx = graph.ctx;
  const buffers: Partial<Record<VoiceId, AudioBuffer>> = {};
  const tokens: Partial<Record<VoiceId, number>> = {};
  const rerenderTimers: Partial<Record<VoiceId, unknown>> = {};
  const samples: Partial<Record<VoiceId, DrumSample>> = { ...o.samples };
  const sampleBuffers: Partial<Record<VoiceId, AudioBuffer>> = {};
  const last: Partial<Record<VoiceId, Playing | null>> = {};
  const choke = { gain: null as GainNode | null };

  const render = async (voice: VoiceId): Promise<void> => {
    const tok = (tokens[voice] ?? 0) + 1;
    tokens[voice] = tok;
    try {
      const buf = await renderVoice({
        createOffline: o.createOffline,
        sampleRate: ctx.sampleRate,
        voice,
        params: o.params()[voice],
        noise: graph.noise,
        kick: graph.kick,
        rnd: o.random(`voice:${VOICE_IDS.indexOf(voice)}`),
      });
      if (tokens[voice] === tok) buffers[voice] = buf;
    } catch {
      /* Rückfall: Live-Synthese (wie Legacy) */
    }
  };
  const pause = (ms: number): Promise<void> => new Promise((r) => timer.setTimeout(r, ms));
  const steal = (voice: VoiceId, t: number): void => {
    const l = last[voice];
    if (!l) return;
    try {
      l.g.gain.setValueAtTime(l.v, t);
      l.g.gain.linearRampToValueAtTime(0, t + 0.006);
      l.src.stop(t + 0.008);
    } catch {
      /* schon gestoppt */
    }
    last[voice] = null;
  };
  const sampleBuffer = (voice: VoiceId, s: DrumSample): AudioBuffer => {
    const cached = sampleBuffers[voice];
    if (cached) return cached;
    const b = ctx.createBuffer(1, s.pcm.length, SMP_RATE);
    b.getChannelData(0).set(s.pcm);
    sampleBuffers[voice] = b;
    return b;
  };

  return {
    async prerenderAll() {
      // nacheinander statt alle gleichzeitig; dazwischen kurz Luft für Audio-Thread und UI
      for (const voice of RENDER_ORDER) {
        await render(voice);
        await pause(25);
      }
    },
    rerender(voice) {
      timer.clearTimeout(rerenderTimers[voice]);
      rerenderTimers[voice] = timer.setTimeout(() => void render(voice), 90);
    },
    ready: (voice) => !!buffers[voice],
    setSample(voice, s) {
      if (s) samples[voice] = s;
      else delete samples[voice];
      delete sampleBuffers[voice];
    },
    hit(voice, t, p) {
      const dest = graph.chan[voice].in;
      const custom = samples[voice];
      if (custom) {
        const buf = sampleBuffer(voice, custom);
        const rate = Math.pow(2, (p.tune - 0.5) * 2);
        const frac = Math.min(1, 0.2 + p.decay * 1.6);
        const play = Math.max(0.04, (buf.duration / rate) * frac);
        const fade = Math.min(play * 0.5, 0.04);
        steal(voice, t);
        if (voice === 'CH') steal('OH', t);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.playbackRate.value = rate;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(1, t + 0.002);
        g.gain.setValueAtTime(1, t + play - fade);
        g.gain.exponentialRampToValueAtTime(0.0001, t + play);
        const v = p.level * 1.15;
        const out = ctx.createGain();
        out.gain.value = v;
        src.connect(g);
        g.connect(out);
        out.connect(dest);
        src.start(t);
        src.stop(t + play + 0.02);
        last[voice] = { src, g: out, v };
        return;
      }
      const buf = buffers[voice];
      if (!buf) {
        // noch nicht vorgerendert: live synthetisieren (Legacy-Rückfall)
        VOICE_FN[voice]({ ctx, out: dest, noise: graph.noise, kick: graph.kick, rnd: Math.random, choke }, t, p);
        return;
      }
      steal(voice, t);
      if (voice === 'CH') steal('OH', t);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.value = p.level;
      src.connect(g);
      g.connect(dest);
      src.start(t, 0);
      last[voice] = { src, g, v: p.level };
    },
  };
}
```
Hinweise: `DrumSample` aus `src/core/samples.ts` exportieren (existiert). `delete` auf Record mit dynamischem Schlüssel meldet Lint (`no-dynamic-delete`) → stattdessen `samples[voice] = undefined` / `sampleBuffers[voice] = undefined`. Der Rückfall nutzt `Math.random` (zufälliger Rausch-Versatz ist dort egal; er greift nur, bevor das Vorrendern fertig ist).

- [ ] **Step 2: Failing Engine-Unit-Tests** – `src/audio/engine.test.ts` (laufen mit einer kleinen Schein-Engine-Umgebung ohne echtes Audio)

```ts
import { describe, expect, it, vi } from 'vitest';
import { baseState } from '../core/defaults.ts';
import { createStore } from '../store/store.ts';
import { createEngine, type EngineTimer } from './engine.ts';

/** Minimaler Schein-Kontext: zeichnet nur auf, was geplant wird. */
function fakeContext() {
  const param = () => ({
    value: 0,
    setValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
    cancelAndHoldAtTime: vi.fn(),
  });
  const node = (): Record<string, unknown> => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    gain: param(), pan: param(), frequency: param(), Q: param(), detune: param(),
    playbackRate: param(), delayTime: param(), threshold: param(), knee: param(),
    ratio: param(), attack: param(), release: param(),
    buffer: null, curve: null, type: '', loop: false,
  });
  const buffer = (len = 1) => ({ duration: len / 44100, getChannelData: () => new Float32Array(len) });
  return {
    sampleRate: 44100,
    currentTime: 0,
    state: 'suspended',
    destination: node(),
    resume: vi.fn(() => Promise.resolve()),
    createGain: vi.fn(node), createStereoPanner: vi.fn(node), createBiquadFilter: vi.fn(node),
    createDynamicsCompressor: vi.fn(node), createWaveShaper: vi.fn(node), createDelay: vi.fn(node),
    createConvolver: vi.fn(node), createOscillator: vi.fn(node), createBufferSource: vi.fn(node),
    createBuffer: vi.fn((_c: number, n: number) => buffer(n)),
  };
}

const manualTimer = (): EngineTimer & { fire(): void } => {
  let interval: (() => void) | null = null;
  return {
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (h) => {
      clearTimeout(h as ReturnType<typeof setTimeout>);
    },
    setInterval: (fn) => {
      interval = fn;
      return 1;
    },
    clearInterval: () => {
      interval = null;
    },
    fire: () => interval?.(),
  };
};

describe('createEngine', () => {
  it('legt den Kontext erst bei prepare an und nur einmal', () => {
    const store = createStore(baseState());
    const make = vi.fn(fakeContext);
    const engine = createEngine({ store, createContext: make as never, prerender: false });
    expect(make).not.toHaveBeenCalled();
    expect(engine.prepare()).toBe(true);
    expect(engine.prepare()).toBe(true);
    expect(make).toHaveBeenCalledTimes(1);
  });

  it('start plant Steps, stop leert; Abspielposition folgt tick', () => {
    const store = createStore(baseState());
    const ctx = fakeContext();
    const timer = manualTimer();
    let now = 0;
    const steps: number[] = [];
    const engine = createEngine({
      store, createContext: () => ctx as never, timer, clock: () => now, prerender: false,
      onScheduled: (s) => steps.push(s.step),
    });
    const before = vi.fn();
    engine.start();
    expect(engine.playing.value).toBe(true);
    expect(steps.length).toBeGreaterThan(0);
    now = 0.3;
    timer.fire();
    engine.tick(0.3);
    expect(engine.playhead.value.step).toBeGreaterThanOrEqual(0);
    engine.stop();
    expect(engine.playing.value).toBe(false);
    expect(engine.playhead.value.step).toBe(-1);
    expect(before).not.toHaveBeenCalled();
  });

  it('beforeStart läuft vor dem Start (iOS-Entsperren aus platform)', () => {
    const store = createStore(baseState());
    const beforeStart = vi.fn();
    const engine = createEngine({ store, createContext: () => fakeContext() as never, timer: manualTimer(), prerender: false, beforeStart });
    engine.start();
    expect(beforeStart).toHaveBeenCalledTimes(1);
  });

  it('Song-Modus: tick wählt den gespielten Slot im Store, Moduswechsel startet den Song neu', () => {
    const s = baseState();
    s.song = [{ p: 'B', n: 1 }];
    s.mode = 'song';
    const store = createStore(s);
    let now = 0;
    const timer = manualTimer();
    const engine = createEngine({ store, createContext: () => fakeContext() as never, timer, clock: () => now, prerender: false });
    engine.start();
    engine.tick(1);
    expect(store.state.value.cur).toBe('B');
    expect(engine.playhead.value.songIndex).toBe(0);
    engine.stop();
  });

  it('Live-Parameter: Master-Änderung plant den neuen Wert', () => {
    const store = createStore(baseState());
    const ctx = fakeContext();
    const engine = createEngine({ store, createContext: () => ctx as never, prerender: false });
    engine.prepare();
    const calls = (ctx.createGain.mock.results as { value: { gain: { setTargetAtTime: ReturnType<typeof vi.fn> } } }[])
      .map((r) => r.value.gain.setTargetAtTime.mock.calls.length);
    store.update((st) => ({ ...st, master: 0.5 }));
    const after = (ctx.createGain.mock.results as { value: { gain: { setTargetAtTime: ReturnType<typeof vi.fn> } } }[])
      .map((r) => r.value.gain.setTargetAtTime.mock.calls.length);
    expect(after.some((n, i) => n > (calls[i] ?? 0))).toBe(true);
    engine.dispose();
  });
});
```

```bash
[n] npx vitest run src/audio/engine.test.ts
```
Expected: FAIL, Modul fehlt.

- [ ] **Step 3: `src/audio/engine.ts`**

```ts
import { CHANNELS, PARTS, VOICE_IDS } from '../core/constants.ts';
import { audibleChannels } from '../core/mix.ts';
import { degreeToMidi, effectiveLength } from '../core/music.ts';
import { subStepsOf } from '../core/pattern.ts';
import type { Rng } from '../core/random.ts';
import type { DrumSample } from '../core/samples.ts';
import { nextBar, songStart, stepSlot, type SongCursor } from '../core/song.ts';
import { stepDuration, subStepOffset, swingDelay } from '../core/timing.ts';
import type { ChannelId, Part, Slot, State, SubKey, VoiceId } from '../core/types.ts';
import { must } from '../core/util.ts';
import { batch, effect, signal, type ReadonlySignal } from '../store/signals.ts';
import type { Store } from '../store/store.ts';
import { createDrumBank, type DrumBank } from './drums.ts';
import { impulseResponse, stutterPeriod } from './dsp.ts';
import { createGraph, type Graph } from './graph.ts';
import { createSampler, type Sampler } from './sampler.ts';
import { synthNote, type SynthVoice } from './synth.ts';
import type { OfflineFactory } from './voices.ts';

// (Interfaces EngineTimer, ScheduledStep, EngineOptions, Engine wie oben)

const browserTimer: EngineTimer = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (h) => {
    clearTimeout(h as ReturnType<typeof setTimeout>);
  },
  setInterval: (fn, ms) => setInterval(fn, ms),
  clearInterval: (h) => {
    clearInterval(h as ReturnType<typeof setInterval>);
  },
};

const LOOKAHEAD_MS = 25;
const HORIZON_S = 0.2;
const sameAudible = (a: Record<ChannelId, boolean>, b: Record<ChannelId, boolean>): boolean =>
  CHANNELS.every((id) => a[id] === b[id]);

export function createEngine(o: EngineOptions): Engine {
  const { store } = o;
  const timer = o.timer ?? browserTimer;
  const random = o.random ?? ((): Rng => Math.random);
  const createOffline: OfflineFactory =
    o.createOffline ?? ((ch, len, sr) => new OfflineAudioContext(ch, len, sr));
  const audible = store.select((s) => audibleChannels(s.mix), sameAudible);

  let ctx: BaseAudioContext | null = null;
  let graph: Graph | null = null;
  let drums: DrumBank | null = null;
  let sampler: Sampler | null = null;
  const disposers: (() => void)[] = [];
  const synthLast: Partial<Record<Part, SynthVoice>> = {};
  const playing = signal(false);
  const playhead = signal({ step: -1, songIndex: -1 });
  let interval: unknown = null;
  let step = 0;
  let nextTime = 0;
  let cursor: SongCursor = songStart();
  let bar: { slot: Slot; fromSong: boolean } = { slot: 'A', fromSong: false };
  const queue: ScheduledStep[] = [];
  let irTimer: unknown = null;

  const now = (): number => (o.clock ? o.clock() : (ctx?.currentTime ?? 0));
  const state = (): State => store.state.peek();

  const watchLive = (g: Graph): void => {
    // Effekte: erster Lauf nur merken (Anfangswerte setzt createGraph), danach weich nachführen
    const live = <T>(sel: ReadonlySignal<T>, apply: (v: T) => void): void => {
      let first = true;
      disposers.push(
        effect(() => {
          const v = sel.value;
          if (first) {
            first = false;
            return;
          }
          apply(v);
        }),
      );
    };
    live(store.select((s) => s.master), (v) => {
      g.setMaster(v, now());
    });
    for (const id of CHANNELS) {
      const ch = store.select((s) => s.mix[id]);
      const aud = store.select((s) => audible.value[id] && s.mix[id] === s.mix[id]);
      live(store.select((s) => [ch.value, aud.value] as const, (a, b) => a[0] === b[0] && a[1] === b[1]), ([c, a]) => {
        g.applyChannel(id, c, a, now());
      });
    }
    live(store.select((s) => s.fx, (a, b) => a.ret === b.ret && a.dj === b.dj && a.djq === b.djq), (fx) => {
      g.applyFx(fx, now());
    });
    live(store.select((s) => s.fx, (a, b) => a.size === b.size && a.damp === b.damp), () => {
      queueReverb();
    });
    live(
      store.select(
        (s) => ({ tempo: s.tempo, synth: s.synth, aud: audible.value }),
        (a, b) => a.tempo === b.tempo && a.synth === b.synth && sameAudible(a.aud, b.aud),
      ),
      (v) => {
        g.syncSynth(v, v.aud, now());
      },
    );
    for (const id of VOICE_IDS) {
      live(
        store.select((s) => s.params[id], (a, b) => a.tune === b.tune && a.decay === b.decay),
        () => {
          drums?.rerender(id);
        },
      );
    }
    disposers.push(
      effect(() => {
        void store.songEpoch.value;
        cursor = songStart();
      }),
    );
  };

  /** Legacy queueIR: 150 ms entprellt, Return ausblenden, nach 50 ms neuen Convolver einsetzen. */
  const queueReverb = (): void => {
    timer.clearTimeout(irTimer);
    irTimer = timer.setTimeout(() => {
      const g = graph;
      if (!g) return;
      g.muteReverb(now());
      timer.setTimeout(() => {
        const s = state();
        g.replaceReverb(impulseResponse(g.ctx.sampleRate, s.fx.size, s.fx.damp, random('ir')), s.fx, now());
      }, 50);
    }, 150);
  };

  const prepare = (): boolean => {
    if (graph) return true;
    const c = o.createContext();
    ctx = c;
    const s = state();
    const g = createGraph(c, s, audible.peek(), random);
    graph = g;
    drums = createDrumBank({ graph: g, createOffline, random, timer, params: () => state().params, samples: o.drums ?? {} });
    sampler = createSampler(c, o.pads ?? []);
    watchLive(g);
    if (o.prerender !== false) void drums.prerenderAll();
    return true;
  };

  const resume = (): void => {
    const c = ctx as (BaseAudioContext & { resume?: () => Promise<void>; state?: string }) | null;
    if (c?.resume && c.state !== 'running') c.resume().catch(() => undefined);
  };

  const scheduleDrum = (voice: VoiceId, t: number): void => {
    drums?.hit(voice, t, state().params[voice]);
  };
  const scheduleNote = (part: Part, midi: number, t: number, dur: number): void => {
    const g = graph;
    if (!g || !ctx) return;
    synthLast[part] = synthNote({ ctx, dest: g.parts[part].inp, patch: state().synth[part], midi, time: t, duration: dur, previous: synthLast[part] });
  };
  const schedulePad = (pad: number, t: number): void => {
    const g = graph;
    if (!g || !sampler) return;
    sampler.play(pad, t, must(state().smp.pads[pad], `Pad ${pad}`), g.chan.SM.in);
  };

  /** Lookahead-Scheduler (Legacy pump): plant alle Steps bis 0,2 s voraus. */
  const pump = (): void => {
    const t0 = now();
    if (nextTime < t0 - 0.1) nextTime = t0 + 0.05;
    const horizon = t0 + HORIZON_S;
    while (nextTime < horizon) {
      const s = state();
      if (step === 0) {
        const r = nextBar(cursor, s);
        cursor = r.cursor;
        bar = r;
      }
      const slot = stepSlot(bar, s);
      const pat = s.patterns[slot];
      const d = stepDuration(s.tempo);
      const t = nextTime + swingDelay(step, s.swing, d);
      const aud = audible.peek();
      for (const id of VOICE_IDS) {
        if (!aud[id]) continue;
        const sb = subStepsOf(pat, id, step);
        if (sb) {
          for (let k = 0; k < 16; k++) if (sb[k]) scheduleDrum(id, t + subStepOffset(k, d));
        } else if (pat[id][step]) scheduleDrum(id, t);
      }
      for (const id of PARTS) {
        const row = pat.notes[id];
        const n = row[step];
        if (n && aud[id]) {
          scheduleNote(id, degreeToMidi(id, n.d, s, s.synth[id].oct), t, effectiveLength(row, step) * d * 0.92);
        }
      }
      if (aud.SM) {
        for (let i = 0; i < 8; i++) {
          const sb = subStepsOf(pat, `P${i}` as SubKey, step);
          if (sb) {
            for (let k = 0; k < 16; k++) if (sb[k]) schedulePad(i, t + subStepOffset(k, d));
          } else if (pat.smp[i]?.[step]) schedulePad(i, t);
        }
      }
      const entry: ScheduledStep = { step, time: t, slot, song: bar.fromSong, si: cursor.index };
      queue.push(entry);
      o.onScheduled?.(entry);
      nextTime += d;
      step = (step + 1) % 16;
    }
  };

  return {
    prepare,
    prerenderAll: () => (prepare(), drums ? drums.prerenderAll() : Promise.resolve()),
    drumsReady: () => VOICE_IDS.every((id) => drums?.ready(id) ?? false),
    playing,
    playhead,
    start() {
      if (playing.peek()) return;
      o.beforeStart?.();
      if (!prepare()) return;
      resume();
      batch(() => {
        playing.value = true;
      });
      step = 0;
      cursor = songStart();
      queue.length = 0;
      nextTime = now() + 0.08;
      interval = timer.setInterval(pump, LOOKAHEAD_MS);
      pump();
    },
    stop() {
      if (!playing.peek()) return;
      timer.clearInterval(interval);
      interval = null;
      queue.length = 0;
      batch(() => {
        playing.value = false;
        playhead.value = { step: -1, songIndex: -1 };
      });
    },
    /** Pro Bildschirm-Frame (UI): Abspielposition aus der Warteschlange; im Song-Modus folgt die Ansicht. */
    tick(at) {
      if (!playing.peek()) return;
      const c = ctx as (BaseAudioContext & { outputLatency?: number }) | null;
      const t = at ?? now() - (c?.outputLatency ?? 0);
      let hit: ScheduledStep | undefined;
      while (queue[0] && queue[0].time <= t) hit = queue.shift();
      if (!hit) return;
      const h = hit;
      batch(() => {
        playhead.value = { step: h.step, songIndex: h.song ? h.si : -1 };
        if (h.song && h.slot !== state().cur) store.selectSlot(h.slot);
      });
    },
    audition(voice) {
      if (prepare()) scheduleDrum(voice, now() + 0.005);
    },
    auditionNote(part, degree, length = 1) {
      if (!prepare()) return;
      const s = state();
      scheduleNote(part, degreeToMidi(part, degree, s, s.synth[part].oct), now() + 0.005, ((length * 60) / s.tempo / 4) * 0.92 + 0.12);
    },
    auditionPad(pad) {
      if (prepare() && sampler?.has(pad)) schedulePad(pad, now() + 0.005);
    },
    stutterOn(fraction) {
      if (!prepare() || !graph) return;
      graph.stutterOn(now() + 0.01, stutterPeriod(state().tempo, fraction));
    },
    stutterOff() {
      graph?.stutterOff(now() + 0.005);
    },
    setPadSample(pad, pcm) {
      sampler?.setPcm(pad, pcm);
    },
    setDrumSample(voice, sample) {
      drums?.setSample(voice, sample);
    },
    schedule: { drum: scheduleDrum, note: scheduleNote, pad: schedulePad },
    dispose() {
      if (playing.peek()) timer.clearInterval(interval);
      for (const d of disposers.splice(0)) d();
    },
  };
}
```
Hinweise für die Umsetzung:
- Der Kanal-Selektor oben ist umständlich formuliert; vereinfachen zu einem `store.select((s) => [s.mix[id], audibleChannels(s.mix)[id]] as const, gleichheit)` – Hauptsache: Effekt feuert genau dann, wenn sich Fader/Pan/Send des Kanals oder seine Hörbarkeit ändern. `void x` vermeiden (Lint) – benannten Helfer `dependOn()` wie in `src/store/persist.ts` verwenden.
- `setPadSample`/`setDrumSample` vor `prepare()`: Werte merken und bei `prepare` übernehmen (Optionen `pads`/`drums` aktualisieren).
- `prerenderAll`-Rückgabe ohne Kommaoperator (Lint) schreiben.
- `stutterPeriod` = Legacy `Math.min(1.9, 60/state.tempo*frac)` – gleiche Rechenreihenfolge `(60 / tempo) * fraction`.

```bash
[n] npx vitest run src/audio/engine.test.ts
```
Expected: alle PASS.

- [ ] **Step 4: Szenarien `mixScenario`, `bench`, `songSequence` für die neue Engine** – in `tests/reference/next/scenarios.ts`. Die Mix-Fälle spiegeln `tests/reference/legacy/scenarios.ts` (`MIX`), aber auf `State`:

```ts
import { DRUM_DEFAULTS } from '../../../src/core/constants.ts';
import { createStore } from '../../../src/store/store.ts';
import { createEngine, type EngineTimer, type ScheduledStep } from '../../../src/audio/engine.ts';
import type { Slot, VoiceId } from '../../../src/core/types.ts';

function isolate(s: State): void {
  for (const k of Object.keys(s.patterns) as Slot[]) {
    const p = s.patterns[k];
    for (const v of VOICE_IDS) p[v] = new Array<0 | 1>(16).fill(0);
    p.notes.BA = new Array<null>(16).fill(null);
    p.notes.LD = new Array<null>(16).fill(null);
    p.smp = p.smp.map(() => new Array<0 | 1>(16).fill(0));
    p.sub = {};
  }
  s.mode = 'pattern';
  s.cur = 'A';
  s.tempo = 120;
}
const hits = (s: State, steps: Partial<Record<VoiceId, number[]>>): void => {
  for (const [id, list] of Object.entries(steps) as [VoiceId, number[]][]) for (const i of list) s.patterns.A[id][i] = 1;
};

type EngineLike = { stutterOn(f: number): void; stutterOff(): void };
const MIX: Record<string, { seconds: number; setup: (s: State) => void; events?: { at: number; run: (e: EngineLike) => void }[] }> = {
  demo: { seconds: 4, setup: () => undefined },
  base: { seconds: 1.9, setup: (s) => { isolate(s); hits(s, { BD: [0], SD: [4] }); } },
  mute: { seconds: 1.9, setup: (s) => { isolate(s); hits(s, { BD: [0], SD: [4] }); s.mix.BD.m = true; s.mix.SD.m = true; } },
  solo: { seconds: 1.9, setup: (s) => { isolate(s); hits(s, { BD: [0], SD: [4] }); s.mix.SD.s = true; } },
  faderHalf: { seconds: 1, setup: (s) => { isolate(s); hits(s, { BD: [0] }); s.mix.BD.v = 0.4; s.mix.BD.r = 0; } },
  master1: { seconds: 2, setup: (s) => { isolate(s); s.master = 1; (['BD', 'SD', 'CH', 'CP', 'OH', 'CY'] as const).forEach((id, k) => { for (let i = k % 2; i < 16; i += 2) s.patterns.A[id][i] = 1; }); } },
  reverbDry: { seconds: 2.4, setup: (s) => { isolate(s); hits(s, { SD: [0] }); s.mix.SD.r = 0; } },
  reverbWet: { seconds: 2.4, setup: (s) => { isolate(s); hits(s, { SD: [0] }); s.mix.SD.r = 1; s.fx.ret = 1; s.fx.size = 0.8; } },
  djLowpass: { seconds: 1.4, setup: (s) => { isolate(s); hits(s, { CH: [0, 2, 4], CY: [0] }); s.fx.dj = 0.05; } },
  djHighpass: { seconds: 1.4, setup: (s) => { isolate(s); hits(s, { BD: [0] }); s.fx.dj = 0.95; } },
  panRight: { seconds: 1, setup: (s) => { isolate(s); hits(s, { BD: [0] }); s.mix.BD.p = 1; s.mix.BD.r = 0; } },
  stutter: { seconds: 1.7, setup: (s) => { isolate(s); hits(s, { BD: [0] }); s.mix.BD.r = 0; }, events: [{ at: 0.1, run: (e) => { e.stutterOn(0.125); } }] },
  stutterRelease: { seconds: 2.4, setup: (s) => { isolate(s); hits(s, { BD: [0], SD: [12] }); s.mix.BD.r = 0; }, events: [{ at: 0.1, run: (e) => { e.stutterOn(0.125); } }, { at: 0.8, run: (e) => { e.stutterOff(); } }] },
};

/** Wie das Legacy-Szenario: init-Zustand → Setup → Engine bei t = 0 → Vorrendern → Scheduler im 25-ms-Takt. */
async function playScenario(o: { seconds: number; setup: (s: State) => void; events?: { at: number; run: (e: EngineLike) => void }[]; seed: number; instrument?: (c: OfflineAudioContext) => void; afterPrerender?: () => void; until?: (now: number) => boolean }) {
  const s = structuredClone(initialState());
  o.setup(s);
  const store = createStore(s);
  const random = seededRandom(o.seed);
  const ctx = createOffline(2, Math.ceil(o.seconds * SR), SR);
  o.instrument?.(ctx);
  let now = 0;
  let tickFn: (() => void) | null = null;
  const timer: EngineTimer = {
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (h) => { clearTimeout(h as ReturnType<typeof setTimeout>); },
    setInterval: (fn) => { tickFn = fn; return 1; },
    clearInterval: () => { tickFn = null; },
  };
  const engine = createEngine({
    store, createContext: () => ctx, createOffline, random, timer, clock: () => now, prerender: false,
    pads: factorySamples(random('factory')),
  });
  engine.prepare();
  await engine.prerenderAll();
  if (!engine.drumsReady()) throw new Error('Nicht alle Stimmen vorgerendert');
  o.afterPrerender?.();
  engine.start();
  const pending = [...(o.events ?? [])];
  for (now = 0; o.until ? !o.until(now) : now < o.seconds; now += 0.025) {
    while (pending[0] && pending[0].at <= now) pending.shift()?.run(engine);
    tickFn?.();
  }
  return { ctx, engine, store };
}

export const MIX_NAMES = Object.keys(MIX);

export async function mixScenario(args: { name: string; seed?: number }): Promise<StereoPrint> {
  const sc = must(MIX[args.name], args.name);
  const { ctx } = await playScenario({ ...sc, seed: args.seed ?? 1 });
  return renderStereo(ctx);
}
```

`bench` und `songSequence` analog den Legacy-Szenarien:
- `bench({ load })`: Zählung wie in `tests/reference/legacy/scenarios.ts` (`COUNTED`, Instrumentierung des Haupt-Kontexts), `worst`-Last identisch aufbauen, Zähler nach dem Vorrendern (`afterPrerender`) zurücksetzen, 7 s spielen, `startRendering` timen; Rückgabe `{ renderMs, nodesPerSecond, counts }`.
- `songSequence(args: SequenceArgs)`: `onScheduled` sammelt Einträge; Slot-Wechsel per `store.update((s) => ({ ...s, cur }))`, sobald so viele Einträge vorliegen wie `switchAt`; Rückgabe `{ entries, switchedAt }` wie Legacy.

`SCENARIOS` um `mixScenario`, `bench`, `songSequence` erweitern.

- [ ] **Step 5: Vergleichstests**

`tests/reference/next-mix.test.ts`: wie `mix.test.ts` (inkl. Demo-Spitze, Mute still, Solo, Master 1, Pan rechts), aber `runNext` und `MIX_NAMES` aus `./next/scenarios.ts`; zusätzlich `expect(MIX_NAMES.sort()).toEqual(LEGACY_MIX_NAMES.sort())` (Import aus `./legacy/scenarios.ts` als `MIX_NAMES as LEGACY_MIX_NAMES`).

`tests/reference/next-song.test.ts`: dieselben Fälle wie `core-song.test.ts`; vergleicht `runNext('songSequence', args)` mit `runLegacy('songSequence', args)` (Einträge identisch, `switchedAt` identisch).

In `tests/reference/bench.test.ts` eine zweite Schleife „neue Engine“: `runNext('bench', { load })`, Vergleich mit derselben Referenz (`readGolden('bench/<load>')`): `nodesPerSecond` ≤ Referenz, `renderMs` ≤ 1,5 × Referenz.

```bash
[n] npx vitest run --project reference tests/reference/next-mix.test.ts tests/reference/next-song.test.ts
[n] npm run bench
```
Expected: alle PASS. Gegenproben (jeweils zurücksetzen): (a) in `graph.ts` `bus.gain.value = 1.8` → `1.6`: Mix-Fälle FAIL; (b) in `engine.ts` den CH→OH-Choke entfernen: Bench/Mix (master1) FAIL oder Knotenzahl abweichend; (c) im `pump` `swingDelay` weglassen: Song-Sequenz FAIL.

- [ ] **Step 6: Commit**

```bash
[n] npm run format && npm run lint && npm run typecheck && npm run test:unit && git add -A && git commit -m "audio: Engine mit Scheduler, Live-Parametern und Abspielposition, gleich zur Referenz

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Abschluss

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Gesamtlauf**

```bash
[n] npm run lint && npm run typecheck && npm test
```
Expected: alles grün.

- [ ] **Step 2: Doku** – in `CLAUDE.md` unter „Architektur“ nach der Store-Zeile ergänzen:

„- Audio (`src/audio`): `createEngine({ store, createContext, … })` baut Kontext und Graph erst bei `prepare()`/`start()`, reagiert per Effekt auf Mixer, FX, Tempo, Synth-Pegel und Tune/Decay (Neu-Rendern entprellt) und plant mit dem Lookahead-Scheduler über die `core`-Funktionen. Klang und Knotenzahl sind gegen die Legacy-Referenzen geprüft (`tests/reference/next-*.test.ts`). Rauschen startet sample-genau (Entscheidung 2026-10-14). Kontext, Offline-Kontext, Zeitquelle, Zeitgeber und Zufall sind für Tests austauschbar.“

- [ ] **Step 3: Commit**

```bash
[n] npm run lint && git add -A && git commit -m "Doku: Audio-Engine

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 4: Abschlussbericht** (Checkpoint): Commits, Testzahlen, Klangvergleich, Knotenzahlen/Renderzeiten alt vs. neu, Entscheidungen; nächster Schritt: Spezifikation für Schritt 5 (UI mit drei Layouts).
