# Fundament Schritt 3: `store` – Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein eigener, glitch-freier Signals-Kern und ein Store, der den `core`-Zustand als ein Wurzel-Signal hält, Bearbeitungen als Befehle anbietet (verhaltensgleich zu Legacy, inkl. Undo und Zwischenablage) und verzögert speichert – so, dass ein Step-Klick nur die betroffene Zelle benachrichtigt.

**Architecture:** `src/store/signals.ts` (signal/computed/effect/batch, versionsbasiert, lazy, Abos nur solange beobachtet). `src/store/store.ts` hält `State` in einem Signal; Änderungen laufen ausschließlich über `core`-Funktionen; feine Auswahl per `select()` (Gleichheit über `Object.is`). Strukturelles Teilen in `core` sorgt dafür, dass nur die geänderte Reihe neue Identität bekommt. `src/store/persist.ts` speichert entprellt über austauschbaren Speicher und Zeitgeber. Im Entwicklungsmodus wird jeder neue Zustand eingefroren.

**Tech Stack:** TypeScript 6.0, Vitest 5 (+ Fake Timers), fast-check 4, bestehende Legacy-Harness.

**Spec:** `docs/superpowers/specs/2026-10-13-fundament-design.md` (Abschnitt 1 „store“, Abschnitt 2, Abschnitt 4 Schritt 3, Risiko „Signals-Store verursacht mehr Arbeit …“)

## Global Constraints

- Deutsch für Kommentare, Tests, Meldungen, Commits. Commits enden mit `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Nicht pushen.
- `src/store/**` importiert nur `src/core/**` (ESLint-Schichtregel). Keine Laufzeit-Abhängigkeiten.
- Produktionscode ohne `!`-Assertions (`must()` aus `src/core/util.ts`).
- Abdeckung ≥ 90 % pro Datei für `src/core/**` und `src/store/**` (läuft in `npm run test:unit`).
- Speicherformat unverändert und bytegleich zu Legacy (`pocket808.v1`, 250 ms Entprellung).
- `core`-Funktionen bleiben rein; neu: Aktionen ohne Wirkung liefern **dasselbe Objekt** zurück.
- Befehl-Präfix **`[n]`** = `source ~/.nvm/nvm.sh && nvm use >/dev/null && `.
- Commits nur nach `npm run format && npm run lint && npm run typecheck`. Arbeit auf Branch `store` (von `main`).

## Review Focus

1. **Glitches und doppelte Effekte** bei Rautenabhängigkeiten (A → B, A → C, B+C → Effekt): Effekt läuft genau einmal und sieht nur konsistente Werte → Signals-Tests Task 2.
2. **Speicherlecks durch hängende Abos** (Zellen-Signale der UI werden erzeugt und verworfen): Nach `dispose` darf eine Quelle keine Beobachter mehr halten, unbeobachtete Computeds bleiben trotzdem korrekt → Task 2.
3. **Effekte, die selbst Signale schreiben** (Endlosschleife) → Schutz mit klarer Meldung, Task 2.
4. **Undo/Zwischenablage im Store weichen von Legacy ab** → Modelltest gegen Legacy läuft zusätzlich gegen die Store-Befehle, Task 4.
5. **Speichern zur falschen Zeit** (beim Start, mehrfach pro Klickfolge, nach `dispose`, bei vollem Speicher) → Persistenz-Tests mit Fake Timers, Task 5.

---

## Dateistruktur (Ergebnis)

```
src/core/freeze.ts        deepFreeze (aus test-utils hierher, jetzt Produktionscode)
src/core/pattern.ts       No-op-Identität, kein Tiefkopieren mehr bei copy/paste
src/core/undo.ts          Snapshot ohne Tiefkopie
src/core/persist.ts       serialize ohne Tiefkopie
src/store/signals.ts      signal, computed, effect, batch
src/store/store.ts        createStore: Wurzel-Signal, select, update, Befehle, Undo, Zwischenablage
src/store/persist.ts      persistState: entprelltes Speichern
src/store/*.test.ts       Unit-Tests
tests/reference/core-pattern.test.ts   Modelltest zusätzlich gegen Store-Befehle
```

---

### Task 1: Branch, `core`-Nachschliff (No-op-Identität, keine Tiefkopien), Playwright-Retry

**Files:**
- Create: `src/core/freeze.ts`, `src/core/freeze.test.ts`
- Modify: `src/core/test-utils.ts`, `src/core/pattern.ts`, `src/core/pattern.test.ts`, `src/core/undo.ts`, `src/core/persist.ts`, `src/core/persist.test.ts`
- Modify: `playwright.config.ts`, `tests/tooling/config.test.ts`

**Interfaces:**
- Produces: `deepFreeze<T>(value: T): T` aus `src/core/freeze.ts`. `copyPattern` gibt das aktuelle Pattern-Objekt selbst zurück; `pastePattern` setzt den Clip ohne Kopie ein; `snapshot`/`restoreSnapshot` teilen Objekte; `serialize` liefert eine Sicht in Legacy-Feldreihenfolge, die Unterobjekte teilt.

- [ ] **Step 1: Branch**

```bash
git switch -c store
```

- [ ] **Step 2: Failing Tests für No-op-Identität und Teilen** – in `src/core/pattern.test.ts` einen Block ergänzen:

```ts
describe('Aktionen ohne Wirkung liefern dasselbe Objekt', () => {
  it('leere Sub-Reihe auf leerem Step, leere Spur leeren, leere Noten leeren', () => {
    const s = fresh();
    expect(setSubSteps(s, 'BD', 3, SUB_PATTERNS.clear())).toBe(s);
    expect(clearTrack(s)).toBe(s);
    expect(clearNotes(s)).toBe(s);
  });
  it('gleiche Sub-Reihe erneut setzen ändert nichts', () => {
    const s = deepFreeze(setSubSteps(fresh(), 'BD', 3, roll()));
    expect(setSubSteps(s, 'BD', 3, roll())).toBe(s);
  });
  it('Sub-Steps löschen lässt eine schon leere Hauptreihe unangetastet', () => {
    const s = deepFreeze(setSubSteps(fresh(), 'BD', 3, roll()));
    expect(toggleDrumStep(s, 'BD', 3).patterns.A.BD).toBe(s.patterns.A.BD);
  });
  it('Kopieren und Einfügen teilen das unveränderliche Pattern', () => {
    const s = deepFreeze(toggleDrumStep(fresh(), 'CY', 9));
    const clip = copyPattern(s);
    expect(clip).toBe(s.patterns.A);
    expect(pastePattern(deepFreeze(selectSlot(s, 'D')), clip).patterns.D).toBe(clip);
  });
});
```

Den bisherigen Test „kopieren und einfügen ergibt eine unabhängige Kopie“ ersetzen durch:

```ts
  it('kopieren und einfügen übernimmt das Pattern', () => {
    const s = deepFreeze(toggleDrumStep(fresh(), 'CY', 9));
    const pasted = pastePattern(deepFreeze(selectSlot(s, 'D')), copyPattern(s));
    expect(pasted.patterns.D).toEqual(s.patterns.A);
    expect(pasted.preset).toBeNull();
  });
```

und im Undo-Test zusätzlich:

```ts
    expect(snapshot(s0).pat).toBe(s0.patterns.A);
    expect(restoreSnapshot(changed, snap).patterns.A).toBe(snap.pat);
```

In `src/core/persist.test.ts` den Test „serialize liefert eine unabhängige Kopie“ ersetzen durch:

```ts
  it('serialize liefert alle Felder in Legacy-Reihenfolge und teilt Unterobjekte', () => {
    const s = serialize(base);
    expect(s).toEqual(base);
    expect(Object.keys(s)).toEqual(Object.keys(base));
    expect(s.patterns).toBe(base.patterns);
  });
```

```bash
[n] npx vitest run src/core
```
Expected: FAIL in den neuen/geänderten Tests (Identität und Teilen).

- [ ] **Step 3: `src/core/freeze.ts` und Test**

`src/core/freeze.ts`:
```ts
/** Friert ein Objekt rekursiv ein: Jede Mutation wirft im Strict Mode einen TypeError. */
export function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
}
```

`src/core/test-utils.ts` ersetzen durch:
```ts
export { deepFreeze } from './freeze.ts';
```

`src/core/freeze.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { deepFreeze } from './freeze.ts';

describe('deepFreeze', () => {
  it('friert verschachtelte Objekte ein und gibt sie zurück', () => {
    const o = { a: [1, { b: 2 }] };
    expect(deepFreeze(o)).toBe(o);
    expect(Object.isFrozen(o.a[1])).toBe(true);
  });
  it('lässt Primitive und schon eingefrorene Objekte durch', () => {
    expect(deepFreeze(3)).toBe(3);
    const f = Object.freeze({ x: { y: 1 } });
    deepFreeze(f);
    expect(Object.isFrozen(f.x)).toBe(false);
  });
});
```
(Der `deepFreeze`-Test aus `constants.test.ts` bleibt.)

- [ ] **Step 4: `core` anpassen**

In `src/core/pattern.ts`:

```ts
const setBit = (row: StepRow, i: number, b: Bit): StepRow =>
  row[i] === b ? row : row.map((x, k) => (k === i ? b : x));

const sameRow = (a: StepRow | undefined, b: StepRow): boolean =>
  !!a && a.length === b.length && a.every((x, i) => x === b[i]);
```

`withSub` beginnt mit einer No-op-Prüfung:
```ts
function withSub(p: Pattern, key: SubKey, step: number, row: StepRow | null): Pattern {
  const cur = p.sub[key]?.[step];
  if (row ? sameRow(cur, row) : cur === undefined) return p;
  // … (Rest unverändert)
}
```

`withRow` gibt bei gleicher Reihe `p` zurück:
```ts
function withRow(p: Pattern, voice: VoiceId, row: StepRow): Pattern {
  if (p[voice] === row) return p;
  const next = { ...p };
  next[voice] = row;
  return next;
}
```

`replacePattern` gibt bei gleichem Pattern `state` zurück:
```ts
export function replacePattern(state: State, slot: Slot, pattern: Pattern): State {
  if (state.patterns[slot] === pattern) return state;
  const patterns = { ...state.patterns };
  patterns[slot] = pattern;
  return { ...state, patterns };
}
```

`clearTrack`:
```ts
export function clearTrack(state: State): State {
  const voice = must(VOICE_IDS[state.sel], `Stimme ${state.sel}`);
  const next = updateCurrent(state, (q) => {
    const row = q[voice].some(Boolean) ? emptyRow() : q[voice];
    const sub =
      voice in q.sub
        ? (Object.fromEntries(Object.entries(q.sub).filter(([k]) => k !== voice)) as SubMap)
        : q.sub;
    return row === q[voice] && sub === q.sub ? q : { ...withRow(q, voice, row), sub };
  });
  return next.preset === null ? next : { ...next, preset: null };
}
```

`clearNotes`:
```ts
export function clearNotes(state: State): State {
  const part = state.part;
  return updateCurrent(state, (q) => {
    if (!q.notes[part].some(Boolean)) return q;
    const notes = { ...q.notes };
    notes[part] = new Array<null>(16).fill(null);
    return { ...q, notes };
  });
}
```

`clearPattern` liefert bei schon leerem Pattern ohne Preset `state` zurück:
```ts
export const clearPattern = (state: State): State =>
  !patternHasContent(currentPattern(state)) && state.preset === null
    ? state
    : { ...replacePattern(state, state.cur, blankPattern()), preset: null };
```

`selectSlot`, `copyPattern`, `pastePattern`:
```ts
export const selectSlot = (state: State, slot: Slot): State =>
  state.cur === slot && state.preset === null ? state : { ...state, cur: slot, preset: null };

/** Patterns sind unveränderlich: Die „Kopie“ ist das Pattern selbst. */
export const copyPattern = (state: State): Pattern => currentPattern(state);

export const pastePattern = (state: State, clip: Pattern): State => ({
  ...replacePattern(state, state.cur, clip),
  preset: null,
});
```

In `src/core/undo.ts` beide `structuredClone` entfernen:
```ts
export const snapshot = (s: State): Snapshot => ({
  pat: s.patterns[s.cur],
  cur: s.cur,
  tempo: s.tempo,
  swing: s.swing,
  preset: s.preset,
});

export const restoreSnapshot = (s: State, u: Snapshot): State => ({
  ...replacePattern(s, u.cur, u.pat),
  cur: u.cur,
  tempo: u.tempo,
  swing: u.swing,
  preset: u.preset,
});
```

In `src/core/persist.ts` `serialize` ohne `structuredClone` (Kommentar: „Sicht in Legacy-Feldreihenfolge; teilt Unterobjekte. JSON.stringify(serialize(s)) ist bytegleich zu Legacy.“), Felder direkt aus `state` übernehmen.

```bash
[n] npx vitest run src/core && npx vitest run --project reference tests/reference/core-pattern.test.ts tests/reference/core-persist.test.ts
```
Expected: alle PASS (Modelltest und Fuzz bestätigen weiterhin bytegleiche Ergebnisse).

- [ ] **Step 5: Playwright-Wiederholung bei Infrastruktur-Aussetzern** – in `tests/tooling/config.test.ts` ergänzen:

```ts
  it('Playwright wiederholt einen Test einmal (sporadische WebKit-Aussetzer)', () => {
    expect(playwright.retries).toBe(1);
  });
```
Rot sehen, dann in `playwright.config.ts` nach `fullyParallel` ergänzen:
```ts
  // WebKit bricht unter Last gelegentlich mit „browserContext.close: Test ended“ ab
  retries: 1,
```

```bash
[n] npx vitest run tests/tooling/config.test.ts
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
[n] npm run format && npm run lint && npm run typecheck && git add -A && git commit -m "core: Aktionen ohne Wirkung liefern dasselbe Objekt, keine Tiefkopien mehr; Playwright-Retry

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Signals-Kern

**Files:**
- Create: `src/store/signals.ts`, `src/store/signals.test.ts`

**Interfaces:**
- Produces:
  - `type Equals<T> = (a: T, b: T) => boolean`
  - `interface ReadonlySignal<T> { readonly value: T; peek(): T }`
  - `interface Signal<T> extends ReadonlySignal<T> { value: T }`
  - `signal<T>(initial: T, equals?: Equals<T>): Signal<T>`
  - `computed<T>(fn: () => T, equals?: Equals<T>): ReadonlySignal<T>`
  - `effect(fn: () => void | (() => void)): () => void` (Rückgabe: dispose)
  - `batch<T>(fn: () => T): T`
  - nur für Tests: `observerCount(s: ReadonlySignal<unknown>): number`

- [ ] **Step 1: Failing Tests** – `src/store/signals.test.ts`

```ts
import { describe, expect, it, vi } from 'vitest';
import { batch, computed, effect, observerCount, signal } from './signals.ts';

describe('signal', () => {
  it('liest, schreibt und ignoriert gleiche Werte', () => {
    const s = signal(1);
    const seen: number[] = [];
    effect(() => {
      seen.push(s.value);
    });
    s.value = 2;
    s.value = 2;
    expect(seen).toEqual([1, 2]);
    expect(s.peek()).toBe(2);
  });
  it('eigene Gleichheit', () => {
    const s = signal({ n: 1 }, (a, b) => a.n === b.n);
    const fn = vi.fn();
    effect(() => {
      fn(s.value);
    });
    s.value = { n: 1 };
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('computed', () => {
  it('rechnet erst bei Bedarf und nur bei Änderung', () => {
    const a = signal(1);
    const fn = vi.fn(() => a.value * 2);
    const c = computed(fn);
    expect(fn).not.toHaveBeenCalled();
    expect(c.value).toBe(2);
    expect(c.value).toBe(2);
    expect(fn).toHaveBeenCalledTimes(1);
    a.value = 3;
    expect(c.value).toBe(6);
    expect(fn).toHaveBeenCalledTimes(2);
  });
  it('bleibt ohne Beobachter korrekt (Pull über Versionen)', () => {
    const a = signal(1);
    const b = computed(() => a.value + 1);
    const c = computed(() => b.value * 10);
    expect(c.value).toBe(20);
    a.value = 5;
    expect(c.value).toBe(60);
  });
  it('gleicher Wert stoppt die Weitergabe', () => {
    const a = signal(1);
    const parity = computed(() => a.value % 2);
    const fn = vi.fn();
    effect(() => {
      fn(parity.value);
    });
    a.value = 3;
    expect(fn).toHaveBeenCalledTimes(1);
    a.value = 4;
    expect(fn).toHaveBeenCalledTimes(2);
  });
  it('dynamische Abhängigkeiten', () => {
    const on = signal(true);
    const x = signal(1);
    const y = signal(100);
    const fn = vi.fn(() => (on.value ? x.value : y.value));
    const c = computed(fn);
    effect(() => {
      void c.value;
    });
    on.value = false;
    const calls = fn.mock.calls.length;
    x.value = 2;
    expect(fn.mock.calls.length).toBe(calls);
    y.value = 200;
    expect(c.value).toBe(200);
  });
  it('erkennt Zyklen', () => {
    const c: { r?: ReturnType<typeof computed<number>> } = {};
    c.r = computed((): number => (c.r ? c.r.value : 0) + 1);
    expect(() => c.r?.value).toThrow(/Zyklus/);
  });
  it('Fehler im Computed werden weitergereicht und blockieren nichts', () => {
    const a = signal(0);
    const c = computed(() => {
      if (a.value === 0) throw new Error('kaputt');
      return a.value;
    });
    expect(() => c.value).toThrow('kaputt');
    a.value = 1;
    expect(c.value).toBe(1);
  });
});

describe('effect', () => {
  it('Raute: Effekt läuft einmal und sieht konsistente Werte', () => {
    const a = signal(1);
    const b = computed(() => a.value + 1);
    const c = computed(() => a.value * 2);
    const seen: string[] = [];
    effect(() => {
      seen.push(`${b.value}/${c.value}`);
    });
    a.value = 2;
    expect(seen).toEqual(['2/2', '3/4']);
  });
  it('Aufräumfunktion und dispose', () => {
    const a = signal(1);
    const cleanup = vi.fn();
    const dispose = effect(() => {
      void a.value;
      return cleanup;
    });
    a.value = 2;
    expect(cleanup).toHaveBeenCalledTimes(1);
    dispose();
    expect(cleanup).toHaveBeenCalledTimes(2);
    a.value = 3;
    expect(cleanup).toHaveBeenCalledTimes(2);
  });
  it('dispose gibt alle Abos frei, auch über Computeds', () => {
    const a = signal(1);
    const c = computed(() => a.value + 1);
    const dispose = effect(() => {
      void c.value;
    });
    expect(observerCount(a)).toBe(1);
    expect(observerCount(c)).toBe(1);
    dispose();
    expect(observerCount(a)).toBe(0);
    expect(observerCount(c)).toBe(0);
    a.value = 5;
    expect(c.value).toBe(6);
  });
  it('Effekt darf andere Signale schreiben', () => {
    const a = signal(1);
    const b = signal(0);
    effect(() => {
      b.value = a.value * 10;
    });
    a.value = 2;
    expect(b.value).toBe(20);
  });
  it('Endlosschleife wird mit klarer Meldung abgebrochen', () => {
    const a = signal(0);
    expect(() =>
      effect(() => {
        a.value = a.value + 1;
      }),
    ).toThrow(/Effekt-Schleife/);
  });
});

describe('batch', () => {
  it('fasst Änderungen zu einem Effekt-Lauf zusammen und gibt das Ergebnis zurück', () => {
    const a = signal(1);
    const b = signal(1);
    const fn = vi.fn();
    effect(() => {
      fn(a.value + b.value);
    });
    const r = batch(() => {
      a.value = 2;
      b.value = 3;
      return 'ok';
    });
    expect(r).toBe('ok');
    expect(fn.mock.calls).toEqual([[2], [5]]);
  });
  it('verschachtelt: erst der äußere Batch löst aus', () => {
    const a = signal(1);
    const fn = vi.fn();
    effect(() => {
      fn(a.value);
    });
    batch(() => {
      batch(() => {
        a.value = 2;
      });
      expect(fn).toHaveBeenCalledTimes(1);
      a.value = 3;
    });
    expect(fn.mock.calls).toEqual([[1], [3]]);
  });
});
```

```bash
[n] npx vitest run src/store/signals.test.ts
```
Expected: FAIL, Modul nicht gefunden.

- [ ] **Step 2: Implementierung** – `src/store/signals.ts`

```ts
/**
 * Kleiner, glitch-freier Signals-Kern.
 * - Quellen zählen eine Version hoch, wenn sich ihr Wert ändert.
 * - Verbraucher merken sich die gesehenen Versionen und rechnen nur neu, wenn sich eine geändert hat.
 * - Computeds abonnieren ihre Quellen nur, solange sie selbst beobachtet werden (keine Lecks);
 *   unbeobachtet prüfen sie beim Lesen die Versionen (Pull).
 * - Effekte laufen nach Abschluss des äußersten Batches, jeder höchstens einmal pro Welle.
 */

export type Equals<T> = (a: T, b: T) => boolean;

export interface ReadonlySignal<T> {
  readonly value: T;
  peek(): T;
}
export interface Signal<T> extends ReadonlySignal<T> {
  value: T;
}

interface Producer {
  version: number;
  observers: Set<Consumer>;
  refresh(): void;
}
interface Consumer {
  sources: Map<Producer, number>;
  mark(): void;
}

const MAX_EFFECT_RUNS = 10_000;
let tracking: Consumer | null = null;
let batchDepth = 0;
const pending: EffectNode[] = [];

function track(p: Producer): void {
  if (tracking) tracking.sources.set(p, p.version);
}

function isWatched(c: Consumer): boolean {
  return c instanceof EffectNode || (c instanceof ComputedNode && c.observers.size > 0);
}

function link(p: Producer, c: Consumer): void {
  p.observers.add(c);
  if (p instanceof ComputedNode && p.observers.size === 1) p.watch();
}

function unlink(p: Producer, c: Consumer): void {
  p.observers.delete(c);
  if (p instanceof ComputedNode && p.observers.size === 0) p.unwatch();
}

/** Abos an neue Abhängigkeiten anpassen (nur für beobachtete Verbraucher). */
function resubscribe(c: Consumer, old: Map<Producer, number>): void {
  if (!isWatched(c)) return;
  for (const p of old.keys()) if (!c.sources.has(p)) unlink(p, c);
  for (const p of c.sources.keys()) if (!old.has(p)) link(p, c);
}

/** Hat sich seit dem letzten Lauf eine Quelle geändert? Bringt Computed-Quellen dabei auf Stand. */
function stale(c: Consumer): boolean {
  for (const [p, seen] of c.sources) {
    p.refresh();
    if (p.version !== seen) return true;
  }
  return false;
}

function runTracked<T>(c: Consumer, fn: () => T): T {
  const prev = tracking;
  const old = c.sources;
  c.sources = new Map();
  tracking = c;
  try {
    return fn();
  } finally {
    tracking = prev;
    resubscribe(c, old);
  }
}

function flush(): void {
  let runs = 0;
  while (pending.length) {
    if (++runs > MAX_EFFECT_RUNS) {
      pending.length = 0;
      throw new Error('Effekt-Schleife: Ein Effekt schreibt fortlaufend Signale, die er selbst liest.');
    }
    pending.shift()?.runIfStale();
  }
}

export function batch<T>(fn: () => T): T {
  batchDepth++;
  try {
    return fn();
  } finally {
    if (--batchDepth === 0) flush();
  }
}

class SignalNode<T> implements Producer, Signal<T> {
  version = 0;
  observers = new Set<Consumer>();
  private current: T;
  private readonly equals: Equals<T>;
  constructor(current: T, equals: Equals<T>) {
    this.current = current;
    this.equals = equals;
  }
  refresh(): void {
    /* Signale sind immer aktuell */
  }
  get value(): T {
    track(this);
    return this.current;
  }
  set value(v: T) {
    if (this.equals(this.current, v)) return;
    this.current = v;
    this.version++;
    batch(() => {
      for (const o of [...this.observers]) o.mark();
    });
  }
  peek(): T {
    return this.current;
  }
}

const CLEAN = 0;
const CHECK = 1;

class ComputedNode<T> implements Producer, Consumer, ReadonlySignal<T> {
  version = 0;
  observers = new Set<Consumer>();
  sources = new Map<Producer, number>();
  private state = CHECK;
  private computing = false;
  private initialized = false;
  private current: T | undefined;
  private readonly fn: () => T;
  private readonly equals: Equals<T>;
  constructor(fn: () => T, equals: Equals<T>) {
    this.fn = fn;
    this.equals = equals;
  }

  mark(): void {
    if (this.state === CHECK) return;
    this.state = CHECK;
    for (const o of this.observers) o.mark();
  }
  watch(): void {
    this.state = CHECK;
    for (const p of this.sources.keys()) link(p, this);
  }
  unwatch(): void {
    for (const p of this.sources.keys()) unlink(p, this);
  }
  refresh(): void {
    if (this.computing) throw new Error('Zyklus: Ein Computed hängt von sich selbst ab.');
    if (this.initialized && this.observers.size > 0 && this.state === CLEAN) return;
    if (this.initialized && !stale(this)) {
      this.state = CLEAN;
      return;
    }
    this.computing = true;
    try {
      const next = runTracked(this, this.fn);
      if (!this.initialized || !this.equals(this.current as T, next)) {
        this.current = next;
        this.version++;
      }
      this.initialized = true;
      this.state = CLEAN;
    } finally {
      this.computing = false;
    }
  }
  get value(): T {
    this.refresh();
    track(this);
    return this.current as T;
  }
  peek(): T {
    this.refresh();
    return this.current as T;
  }
}

class EffectNode implements Consumer {
  sources = new Map<Producer, number>();
  private queued = false;
  private disposed = false;
  private cleanup: (() => void) | undefined;
  private readonly fn: () => void | (() => void);
  constructor(fn: () => void | (() => void)) {
    this.fn = fn;
  }

  mark(): void {
    if (this.queued || this.disposed) return;
    this.queued = true;
    pending.push(this);
  }
  run(): void {
    this.cleanup?.();
    this.cleanup = runTracked(this, this.fn) ?? undefined;
  }
  runIfStale(): void {
    this.queued = false;
    if (!this.disposed && stale(this)) this.run();
  }
  dispose(): void {
    this.disposed = true;
    for (const p of this.sources.keys()) unlink(p, this);
    this.sources.clear();
    this.cleanup?.();
    this.cleanup = undefined;
  }
}

export const signal = <T>(initial: T, equals: Equals<T> = Object.is): Signal<T> =>
  new SignalNode(initial, equals);

export const computed = <T>(fn: () => T, equals: Equals<T> = Object.is): ReadonlySignal<T> =>
  new ComputedNode(fn, equals);

export function effect(fn: () => void | (() => void)): () => void {
  const e = new EffectNode(fn);
  batch(() => {
    e.run();
  });
  return () => {
    e.dispose();
  };
}

/** Nur für Tests: Anzahl der aktiven Beobachter einer Quelle. */
export function observerCount(s: ReadonlySignal<unknown>): number {
  return s instanceof SignalNode || s instanceof ComputedNode ? s.observers.size : 0;
}
```

Hinweise für die Umsetzung:
- Falls ESLint `class-methods-use-this` o. ä. anmerkt: nicht in `strictTypeChecked`; nur die tatsächlich gemeldeten Regeln behandeln.
- Keine Konstruktor-Parameter-Properties (`erasableSyntaxOnly`), Felder ausschreiben.
- Der Zyklus-Test liest `c.r.value` innerhalb seiner eigenen Berechnung → `refresh` mit `computing === true` wirft.
- Die Endlosschleife: Der Effekt liest `a` und schreibt `a`; jeder Lauf markiert ihn neu → nach 10 000 Läufen Abbruch.

```bash
[n] npx vitest run src/store/signals.test.ts
```
Expected: alle PASS. Schlägt ein Test fehl: Ursache im Algorithmus suchen (systematic-debugging), Tests nicht aufweichen.

- [ ] **Step 3: Abdeckung prüfen**

```bash
[n] npm run test:unit 2>&1 | tail -15
```
Expected: PASS, `signals.ts` ≥ 90 % in allen Kennzahlen. Fehlende Zweige mit gezielten Tests abdecken.

- [ ] **Step 4: Commit**

```bash
[n] npm run format && npm run lint && npm run typecheck && git add -A && git commit -m "store: glitch-freier Signals-Kern (signal, computed, effect, batch)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Store mit Befehlen, Undo und Zwischenablage

**Files:**
- Create: `src/store/store.ts`, `src/store/store.test.ts`
- Modify: `tsconfig.json` (`vite/client`-Typen für `import.meta.env`)

**Interfaces:**
- Consumes: `core`-Funktionen (`pattern.ts`, `presets.ts`, `undo.ts`, `song.ts`, `freeze.ts`), `signals.ts`.
- Produces:
  ```ts
  export type SubPatternKind = keyof typeof SUB_PATTERNS;
  export interface Store {
    readonly state: ReadonlySignal<State>;
    readonly canUndo: ReadonlySignal<boolean>;
    readonly canPaste: ReadonlySignal<boolean>;
    /** steigt bei jedem Moduswechsel; die Engine startet den Song-Cursor dann neu (Legacy setMode) */
    readonly songEpoch: ReadonlySignal<number>;
    select<T>(fn: (s: State) => T, equals?: Equals<T>): ReadonlySignal<T>;
    update(fn: (s: State) => State): void;
    toggleStep(voice: VoiceId, step: number): void;
    toggleSampleStep(pad: number, step: number): void;
    toggleSubStep(key: SubKey, step: number, k: number): void;
    applySubPattern(key: SubKey, step: number, kind: SubPatternKind): void;
    placeNote(degree: number, step: number): void;
    clearNotes(): void;
    clearTrack(): void;
    clearPattern(): void;
    loadPreset(preset: Preset): void;
    selectSlot(slot: Slot): void;
    copy(): void;
    paste(): void;
    undo(): void;
    appendToSong(): void;
    bumpRepeat(index: number, delta: number): void;
    moveEntry(index: number, delta: number): void;
    removeEntry(index: number): void;
    clearSong(): void;
    setMode(mode: State['mode']): void;
  }
  export function createStore(initial: State, opts?: { freeze?: boolean }): Store;
  ```
  Undo-Schnappschuss (wie Legacy `snap()`) vor: `applySubPattern`, `clearNotes`, `clearTrack`, `clearPattern`, `loadPreset`, `paste`.

- [ ] **Step 1: Typen für `import.meta.env`** – in `tsconfig.json`: `"types": ["node", "vite/client"]`.

- [ ] **Step 2: Failing Tests** – `src/store/store.test.ts`

```ts
import { describe, expect, it, vi } from 'vitest';
import { PRESETS } from '../core/constants.ts';
import { baseState } from '../core/defaults.ts';
import { initialState } from '../core/initial.ts';
import { computed, effect } from './signals.ts';
import { createStore } from './store.ts';

describe('createStore', () => {
  it('hält den Zustand in einem Signal und friert ihn im Entwicklungsmodus ein', () => {
    const store = createStore(baseState(), { freeze: true });
    expect(Object.isFrozen(store.state.value.patterns.A.BD)).toBe(true);
    store.toggleStep('BD', 0);
    expect(Object.isFrozen(store.state.value.patterns.A.BD)).toBe(true);
    expect(() => {
      (store.state.value.patterns.A.BD as number[])[0] = 0;
    }).toThrow(TypeError);
  });

  it('friert ohne Option nicht ein', () => {
    const store = createStore(baseState(), { freeze: false });
    expect(Object.isFrozen(store.state.value)).toBe(false);
  });

  it('update mit unverändertem Zustand löst nichts aus', () => {
    const store = createStore(baseState());
    const fn = vi.fn();
    effect(() => {
      fn(store.state.value);
    });
    store.update((s) => s);
    store.clearTrack();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('select meldet nur bei geändertem Ausschnitt', () => {
    const store = createStore(baseState());
    const tempo = store.select((s) => s.tempo);
    const fn = vi.fn();
    effect(() => {
      fn(tempo.value);
    });
    store.toggleStep('SD', 3);
    expect(fn).toHaveBeenCalledTimes(1);
    store.update((s) => ({ ...s, tempo: 120 }));
    expect(fn.mock.calls).toEqual([[90], [120]]);
  });
});

describe('Undo und Zwischenablage', () => {
  it('Schnappschuss vor Leeren, Undo stellt wieder her und ist dann verbraucht', () => {
    const store = createStore(initialState());
    expect(store.canUndo.value).toBe(false);
    const before = store.state.value;
    store.clearPattern();
    expect(store.canUndo.value).toBe(true);
    store.undo();
    expect(store.state.value.patterns.A).toBe(before.patterns.A);
    expect(store.canUndo.value).toBe(false);
    store.undo();
    expect(store.state.value.patterns.A).toBe(before.patterns.A);
  });

  it('Preset legt Schnappschuss an, einfache Steps nicht', () => {
    const store = createStore(baseState());
    store.toggleStep('BD', 0);
    expect(store.canUndo.value).toBe(false);
    store.loadPreset(PRESETS[0]!);
    expect(store.state.value.preset).toBe('House');
    store.undo();
    expect(store.state.value.preset).toBeNull();
    expect(store.state.value.patterns.A.BD[0]).toBe(1);
  });

  it('Kopieren, Slot wechseln, Einfügen', () => {
    const store = createStore(baseState());
    store.toggleStep('CY', 9);
    expect(store.canPaste.value).toBe(false);
    store.paste();
    expect(store.canUndo.value).toBe(false);
    store.copy();
    expect(store.canPaste.value).toBe(true);
    store.selectSlot('D');
    store.paste();
    expect(store.state.value.patterns.D.CY[9]).toBe(1);
  });

  it('weitere Befehle mit Schnappschuss: Sub-Vorlage, Noten leeren, Spur leeren', () => {
    const store = createStore(baseState());
    store.applySubPattern('BD', 0, 'roll');
    expect(store.canUndo.value).toBe(true);
    store.placeNote(2, 0);
    store.clearNotes();
    store.undo();
    expect(store.state.value.patterns.A.notes.BA[0]).toEqual({ d: 2, l: 1 });
    store.clearTrack();
    store.undo();
    expect(store.state.value.patterns.A.sub.BD?.[0]).toBeDefined();
  });
});

describe('Song und Modus', () => {
  it('Song bearbeiten und Moduswechsel zählt die Song-Epoche hoch', () => {
    const store = createStore(baseState());
    store.appendToSong();
    store.selectSlot('B');
    store.appendToSong();
    store.bumpRepeat(0, 2);
    store.moveEntry(0, 1);
    expect(store.state.value.song).toEqual([
      { p: 'B', n: 1 },
      { p: 'A', n: 3 },
    ]);
    store.removeEntry(0);
    expect(store.state.value.song).toHaveLength(1);
    store.clearSong();
    expect(store.state.value.song).toEqual([]);
    expect(store.songEpoch.value).toBe(0);
    store.setMode('song');
    store.setMode('song');
    expect(store.state.value.mode).toBe('song');
    expect(store.songEpoch.value).toBe(2);
  });
  it('Sampler-, Sub- und Noten-Befehle', () => {
    const store = createStore(baseState());
    store.toggleSampleStep(2, 5);
    store.toggleSubStep('CH', 1, 4);
    store.placeNote(3, 7);
    const p = store.state.value.patterns.A;
    expect(p.smp[2]![5]).toBe(1);
    expect(p.sub.CH?.[1]?.[4]).toBe(1);
    expect(p.notes.BA[7]).toEqual({ d: 3, l: 1 });
  });
});

describe('feine Benachrichtigung (Spezifikation: nur die betroffene Zelle)', () => {
  it('ein Step-Klick rechnet nur eine Reihe nach und benachrichtigt genau eine Zelle', () => {
    const store = createStore(initialState());
    const VOICES = ['BD', 'SD', 'LT', 'HT', 'RS', 'CP', 'CB', 'CH', 'OH', 'CY'] as const;
    let cellRuns = 0;
    let effectRuns = 0;
    for (const v of VOICES) {
      const row = store.select((s) => s.patterns[s.cur][v]);
      for (let step = 0; step < 16; step++) {
        const cell = computed(() => {
          cellRuns++;
          return row.value[step];
        });
        effect(() => {
          effectRuns++;
          void cell.value;
        });
      }
    }
    cellRuns = 0;
    effectRuns = 0;
    store.toggleStep('SD', 4);
    expect(cellRuns).toBe(16);
    expect(effectRuns).toBe(1);
  });
});
```

```bash
[n] npx vitest run src/store/store.test.ts
```
Expected: FAIL, Modul nicht gefunden.

- [ ] **Step 3: Implementierung** – `src/store/store.ts`

```ts
import { deepFreeze } from '../core/freeze.ts';
import {
  clearNotes,
  clearPattern,
  clearTrack,
  copyPattern,
  pastePattern,
  placeNote,
  selectSlot,
  setSubSteps,
  SUB_PATTERNS,
  toggleDrumStep,
  toggleSampleStep,
  toggleSubStep,
} from '../core/pattern.ts';
import { applyPreset } from '../core/presets.ts';
import {
  appendToSong,
  bumpRepeat,
  changeMode,
  clearSong,
  moveEntry,
  removeEntry,
} from '../core/song.ts';
import type { Pattern, Preset, Slot, State, SubKey, VoiceId } from '../core/types.ts';
import { restoreSnapshot, snapshot, type Snapshot } from '../core/undo.ts';
import { batch, computed, signal, type Equals, type ReadonlySignal } from './signals.ts';

export type SubPatternKind = keyof typeof SUB_PATTERNS;

export interface Store {
  readonly state: ReadonlySignal<State>;
  readonly canUndo: ReadonlySignal<boolean>;
  readonly canPaste: ReadonlySignal<boolean>;
  /** steigt bei jedem Moduswechsel; die Engine startet den Song-Cursor dann neu (Legacy setMode) */
  readonly songEpoch: ReadonlySignal<number>;
  select<T>(fn: (s: State) => T, equals?: Equals<T>): ReadonlySignal<T>;
  update(fn: (s: State) => State): void;
  toggleStep(voice: VoiceId, step: number): void;
  toggleSampleStep(pad: number, step: number): void;
  toggleSubStep(key: SubKey, step: number, k: number): void;
  applySubPattern(key: SubKey, step: number, kind: SubPatternKind): void;
  placeNote(degree: number, step: number): void;
  clearNotes(): void;
  clearTrack(): void;
  clearPattern(): void;
  loadPreset(preset: Preset): void;
  selectSlot(slot: Slot): void;
  copy(): void;
  paste(): void;
  undo(): void;
  appendToSong(): void;
  bumpRepeat(index: number, delta: number): void;
  moveEntry(index: number, delta: number): void;
  removeEntry(index: number): void;
  clearSong(): void;
  setMode(mode: State['mode']): void;
}

export function createStore(
  initial: State,
  opts: { freeze?: boolean } = {},
): Store {
  const freeze = opts.freeze ?? import.meta.env.DEV;
  const prepare = (s: State): State => (freeze ? deepFreeze(s) : s);
  const state = signal(prepare(initial));
  const undoSnap = signal<Snapshot | null>(null);
  const clip = signal<Pattern | null>(null);
  const songEpoch = signal(0);

  const update = (fn: (s: State) => State): void => {
    state.value = prepare(fn(state.peek()));
  };
  /** Legacy snap(): Schnappschuss, dann Änderung – als eine Welle. */
  const withUndo = (fn: (s: State) => State): void => {
    batch(() => {
      undoSnap.value = snapshot(state.peek());
      update(fn);
    });
  };

  return {
    state,
    canUndo: computed(() => undoSnap.value !== null),
    canPaste: computed(() => clip.value !== null),
    songEpoch,
    select: (fn, equals) => computed(() => fn(state.value), equals),
    update,
    toggleStep: (voice, step) => {
      update((s) => toggleDrumStep(s, voice, step));
    },
    toggleSampleStep: (pad, step) => {
      update((s) => toggleSampleStep(s, pad, step));
    },
    toggleSubStep: (key, step, k) => {
      update((s) => toggleSubStep(s, key, step, k));
    },
    applySubPattern: (key, step, kind) => {
      withUndo((s) => setSubSteps(s, key, step, SUB_PATTERNS[kind]()));
    },
    placeNote: (degree, step) => {
      update((s) => placeNote(s, degree, step));
    },
    clearNotes: () => {
      withUndo(clearNotes);
    },
    clearTrack: () => {
      withUndo(clearTrack);
    },
    clearPattern: () => {
      withUndo(clearPattern);
    },
    loadPreset: (preset) => {
      withUndo((s) => applyPreset(s, preset));
    },
    selectSlot: (slot) => {
      update((s) => selectSlot(s, slot));
    },
    copy: () => {
      clip.value = copyPattern(state.peek());
    },
    paste: () => {
      const c = clip.peek();
      if (c) withUndo((s) => pastePattern(s, c));
    },
    undo: () => {
      const u = undoSnap.peek();
      if (!u) return;
      batch(() => {
        undoSnap.value = null;
        update((s) => restoreSnapshot(s, u));
      });
    },
    appendToSong: () => {
      update(appendToSong);
    },
    bumpRepeat: (index, delta) => {
      update((s) => bumpRepeat(s, index, delta));
    },
    moveEntry: (index, delta) => {
      update((s) => moveEntry(s, index, delta));
    },
    removeEntry: (index) => {
      update((s) => removeEntry(s, index));
    },
    clearSong: () => {
      update(clearSong);
    },
    setMode: (mode) => {
      batch(() => {
        update((s) => changeMode(s, mode).state);
        songEpoch.value = songEpoch.peek() + 1;
      });
    },
  };
}
```

Hinweis: `clearTrack` legt in Legacy auch dann einen Schnappschuss an, wenn die Spur leer ist; `withUndo` tut das ebenso (Schnappschuss unabhängig davon, ob sich der Zustand ändert). Der Test „update mit unverändertem Zustand löst nichts aus“ prüft nur `state`, nicht `canUndo`.

```bash
[n] npx vitest run src/store/store.test.ts
```
Expected: alle PASS. Der Test „nur die betroffene Zelle“ zählt 16 Zellen-Neuberechnungen (nur die SD-Reihe hat neue Identität) und 1 Effekt-Lauf.

- [ ] **Step 4: Commit**

```bash
[n] npm run format && npm run lint && npm run typecheck && npm run test:unit && git add -A && git commit -m "store: Wurzel-Signal, Auswahl, Befehle, Undo und Zwischenablage

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Modelltest gegen Legacy zusätzlich für die Store-Befehle

**Files:**
- Modify: `tests/reference/core-pattern.test.ts`

**Interfaces:**
- Consumes: `createStore` (Task 3), bestehende `Op`, `applyCore`, `applyLegacy`.

- [ ] **Step 1: Store-Variante ergänzen** – in `tests/reference/core-pattern.test.ts`:

```ts
import { createStore, type Store } from '../../src/store/store.ts';

function applyStore(store: Store, op: Op): void {
  switch (op.k) {
    case 'toggle':
      store.toggleStep(VOICE_IDS[op.v]!, op.s);
      break;
    case 'smp':
      store.update((s) => ({ ...s, smp: { ...s.smp, sel: op.pad } }));
      store.toggleSampleStep(op.pad, op.s);
      break;
    case 'note':
      store.update((s) => ({ ...s, part: op.part, noteLen: op.len }));
      store.placeNote(op.d, op.s);
      break;
    case 'sub':
      store.toggleSubStep(op.key, op.s, op.i);
      break;
    case 'subPreset':
      store.applySubPattern(op.key, op.s, op.kind);
      break;
    case 'clearTrack':
      store.update((s) => ({ ...s, sel: op.v }));
      store.clearTrack();
      break;
    case 'clearAll':
      store.clearPattern();
      break;
    case 'clearNotes':
      store.update((s) => ({ ...s, part: op.part }));
      store.clearNotes();
      break;
    case 'preset':
      store.loadPreset(PRESETS[op.i]!);
      break;
    case 'slot':
      store.selectSlot(op.slot);
      break;
    case 'copy':
      store.copy();
      break;
    case 'paste':
      store.paste();
      break;
    case 'undo':
      store.undo();
      break;
  }
}
```

und einen zweiten Test im `describe`-Block (gleiche Folgen, gleicher Seed):

```ts
  it('Store-Befehle führen zum selben Zustand wie Legacy', () => {
    fc.assert(
      fc.property(fc.array(opArb, { minLength: 10, maxLength: 40, size: 'max' }), (ops) => {
        const page = loadLegacy();
        try {
          const store = createStore(initialState(), { freeze: true });
          for (const [i, op] of ops.entries()) {
            applyStore(store, op);
            applyLegacy(page, op);
            expect(
              JSON.stringify(serialize(store.state.value)),
              `nach Schritt ${i}: ${JSON.stringify(op)}`,
            ).toBe(JSON.stringify(page.t.serial()));
          }
        } finally {
          page.close();
        }
      }),
      { numRuns: 100, seed: 808 },
    );
  });
```

Hinweis: Die Datei liegt unter `tests/` und darf `src/store` importieren (Schichtregel gilt nur für `src/`).

- [ ] **Step 2: Ausführen und Mutationsprüfung**

```bash
[n] npx vitest run --project reference tests/reference/core-pattern.test.ts
```
Expected: 2 PASS. Danach gegenprüfen: in `src/store/store.ts` bei `clearTrack` vorübergehend `withUndo` durch `update` ersetzen → Store-Test muss FAIL; zurücksetzen (`git checkout -- src/store/store.ts`) und `git status` prüfen.

- [ ] **Step 3: Commit**

```bash
[n] npm run format && npm run lint && npm run typecheck && git add -A && git commit -m "store: Modelltest gegen Legacy auch für die Store-Befehle

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Entprelltes Speichern

**Files:**
- Create: `src/store/persist.ts`, `src/store/persist.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void }
  export interface Timer { set(fn: () => void, ms: number): unknown; clear(handle: unknown): void }
  export const browserTimer: Timer;
  export function persistState(
    state: ReadonlySignal<State>,
    storage: StorageLike,
    opts?: { key?: string; delay?: number; timer?: Timer },
  ): { flush(): void; dispose(): void };
  ```

- [ ] **Step 1: Failing Tests** – `src/store/persist.test.ts`

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEY } from '../core/constants.ts';
import { baseState } from '../core/defaults.ts';
import { serialize } from '../core/persist.ts';
import { persistState, type StorageLike } from './persist.ts';
import { createStore } from './store.ts';

function memory(): StorageLike & { writes: string[] } {
  const data = new Map<string, string>();
  const writes: string[] = [];
  return {
    writes,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => {
      writes.push(k);
      data.set(k, v);
    },
  };
}

describe('persistState', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('speichert nicht beim Start, sondern 250 ms nach der letzten Änderung, einmal pro Folge', () => {
    const store = createStore(baseState());
    const mem = memory();
    persistState(store.state, mem);
    vi.advanceTimersByTime(1000);
    expect(mem.writes).toEqual([]);
    store.toggleStep('BD', 0);
    vi.advanceTimersByTime(200);
    store.toggleStep('BD', 1);
    vi.advanceTimersByTime(249);
    expect(mem.writes).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(mem.writes).toEqual([STORAGE_KEY]);
    expect(mem.getItem(STORAGE_KEY)).toBe(JSON.stringify(serialize(store.state.value)));
  });

  it('flush schreibt sofort, dispose verwirft Ausstehendes und beendet das Speichern', () => {
    const store = createStore(baseState());
    const mem = memory();
    const p = persistState(store.state, mem, { key: 'k', delay: 50 });
    store.toggleStep('SD', 2);
    p.flush();
    expect(mem.writes).toEqual(['k']);
    p.flush();
    expect(mem.writes).toEqual(['k']);
    store.toggleStep('SD', 3);
    p.dispose();
    vi.advanceTimersByTime(100);
    store.toggleStep('SD', 4);
    vi.advanceTimersByTime(100);
    expect(mem.writes).toEqual(['k']);
  });

  it('übersteht einen vollen Speicher', () => {
    const store = createStore(baseState());
    const full: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    persistState(store.state, full, { delay: 10 });
    store.toggleStep('BD', 0);
    expect(() => vi.advanceTimersByTime(20)).not.toThrow();
  });
});
```

```bash
[n] npx vitest run src/store/persist.test.ts
```
Expected: FAIL, Modul nicht gefunden.

- [ ] **Step 2: Implementierung** – `src/store/persist.ts`

```ts
import { STORAGE_KEY } from '../core/constants.ts';
import { serialize } from '../core/persist.ts';
import type { State } from '../core/types.ts';
import { effect, type ReadonlySignal } from './signals.ts';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface Timer {
  set(fn: () => void, ms: number): unknown;
  clear(handle: unknown): void;
}

export const browserTimer: Timer = {
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (handle) => {
    clearTimeout(handle as ReturnType<typeof setTimeout>);
  },
};

/** Speichert den Zustand entprellt (Legacy save(): 250 ms), nicht beim Start. */
export function persistState(
  state: ReadonlySignal<State>,
  storage: StorageLike,
  opts: { key?: string; delay?: number; timer?: Timer } = {},
): { flush(): void; dispose(): void } {
  const { key = STORAGE_KEY, delay = 250, timer = browserTimer } = opts;
  let handle: unknown = null;
  let first = true;
  const write = (): void => {
    handle = null;
    try {
      storage.setItem(key, JSON.stringify(serialize(state.peek())));
    } catch {
      /* Speicher voll oder gesperrt: wie Legacy still weitermachen */
    }
  };
  const stop = effect(() => {
    void state.value;
    if (first) {
      first = false;
      return;
    }
    if (handle !== null) timer.clear(handle);
    handle = timer.set(write, delay);
  });
  return {
    flush: () => {
      if (handle === null) return;
      timer.clear(handle);
      write();
    },
    dispose: () => {
      stop();
      if (handle !== null) timer.clear(handle);
      handle = null;
    },
  };
}
```

```bash
[n] npx vitest run src/store/persist.test.ts
```
Expected: 3 PASS.

- [ ] **Step 3: Commit**

```bash
[n] npm run format && npm run lint && npm run typecheck && npm run test:unit && git add -A && git commit -m "store: entprelltes Speichern mit austauschbarem Speicher und Zeitgeber

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Abschluss

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Gesamtlauf und Abdeckung**

```bash
[n] npm run lint && npm run typecheck && npm test
```
Expected: alles grün; `src/store/*` ≥ 90 % pro Datei.

- [ ] **Step 2: Doku** – in `CLAUDE.md` unter „Architektur“ nach der Schichten-Zeile ergänzen:

„- Store (`src/store`): eigener Signals-Kern (`signals.ts`), Zustand als **ein** Wurzel-Signal (`store.ts`), Änderungen nur über `core`-Funktionen bzw. Store-Befehle, feine Auswahl mit `store.select()`. Weil `core` unveränderte Teile teilt, benachrichtigt ein Step-Klick nur die betroffene Zelle (Test in `store.test.ts`). Im Entwicklungsmodus ist der Zustand eingefroren. Speichern entprellt über `persistState` (`persist.ts`).“

Außerdem den Satz unter „Persistenz“ belassen; der Punkt „Zustand: ein Objekt `state` … Änderungen rufen `save()`“ wird ersetzt durch: „Zustand: `State` aus `src/core/types.ts` (= Speicherformat), im Store als Signal; gespeichert wird automatisch entprellt.“

- [ ] **Step 3: Commit**

```bash
[n] npm run lint && git add -A && git commit -m "Doku: Store und Signals

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 4: Abschlussbericht** (Checkpoint): Commits, Testzahlen, Abdeckung, Entscheidungen; nächster Schritt: Rausch-Entscheidung abfragen, dann Plan für Schritt 4 (`audio`).
