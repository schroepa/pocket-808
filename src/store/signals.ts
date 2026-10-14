/**
 * Kleiner, glitch-freier Signals-Kern.
 * - Quellen zählen eine Version hoch, wenn sich ihr Wert ändert.
 * - Verbraucher merken sich die gesehenen Versionen und rechnen nur neu, wenn sich eine geändert hat.
 * - Computeds abonnieren ihre Quellen nur, solange sie selbst beobachtet werden (keine Lecks);
 *   unbeobachtet prüfen sie beim Lesen die Versionen (Pull).
 * - Effekte laufen nach Abschluss des äußersten Batches, jeder höchstens einmal pro Welle.
 */

export type Equals<T> = (a: T, b: T) => boolean;
/** Effekt-Funktion; gibt sie eine Funktion zurück, wird diese vor dem nächsten Lauf aufgerufen. */
export type EffectFn = () => unknown;

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

let flushing = false;

/** Arbeitet eingeplante Effekte ab; Schreiben innerhalb eines Effekts startet keine zweite Schleife. */
function flush(): void {
  if (flushing) return;
  flushing = true;
  try {
    let runs = 0;
    while (pending.length) {
      if (++runs > MAX_EFFECT_RUNS) {
        pending.length = 0;
        throw new Error(
          'Effekt-Schleife: Ein Effekt schreibt fortlaufend Signale, die er selbst liest.',
        );
      }
      pending.shift()?.runIfStale();
    }
  } finally {
    flushing = false;
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
  /** Wird beobachtet, direkt nachdem es gelesen wurde – ist also aktuell. */
  watch(): void {
    this.state = this.initialized ? CLEAN : CHECK;
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
  private readonly fn: EffectFn;
  constructor(fn: EffectFn) {
    this.fn = fn;
  }

  mark(): void {
    if (this.queued || this.disposed) return;
    this.queued = true;
    pending.push(this);
  }
  run(): void {
    this.cleanup?.();
    const result = runTracked(this, this.fn);
    this.cleanup = typeof result === 'function' ? (result as () => void) : undefined;
    // während des Laufs geschrieben, was er gelesen hat: erneut einplanen (Schleifensperre in flush)
    for (const [p, seen] of this.sources) {
      if (p.version !== seen) {
        this.mark();
        break;
      }
    }
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

export function effect(fn: EffectFn): () => void {
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
