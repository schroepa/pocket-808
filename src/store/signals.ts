/**
 * Kleiner, glitch-freier Signals-Kern.
 * - Quellen zählen eine Version hoch, wenn sich ihr Wert ändert.
 * - Verbraucher merken sich die gesehenen Versionen und rechnen nur neu, wenn sich eine geändert hat.
 * - Computeds abonnieren ihre Quellen nur, solange sie selbst beobachtet werden (keine Lecks);
 *   unbeobachtet prüfen sie beim Lesen die Versionen (Pull). Fehler werden wie Werte zwischengespeichert.
 * - Effekte laufen nach Abschluss des äußersten Batches. Ein Fehler in einem Effekt hält die übrigen
 *   nicht auf; er wird nach der Welle weitergeworfen.
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

/** Läufe eines einzelnen Effekts pro Welle, ab denen eine Endlosschleife angenommen wird */
const MAX_RUNS_PER_EFFECT = 1000;
let tracking: Consumer | null = null;
let batchDepth = 0;
let flushing = false;
const pending: EffectNode[] = [];

function track(p: Producer): void {
  if (tracking) tracking.sources.set(p, p.version);
}

function isWatched(c: Consumer): boolean {
  if (c instanceof EffectNode) return !c.disposed;
  return c instanceof ComputedNode && c.observers.size > 0;
}

function link(p: Producer, c: Consumer): void {
  if (p.observers.has(c)) return;
  p.observers.add(c);
  if (p instanceof ComputedNode && p.observers.size === 1) p.watch();
}

function unlink(p: Producer, c: Consumer): void {
  if (p.observers.delete(c) && p instanceof ComputedNode && p.observers.size === 0) p.unwatch();
}

/** Abos an neue Abhängigkeiten anpassen; ein beendeter Effekt verliert alle Abos. */
function resubscribe(c: Consumer, old: Map<Producer, number>): void {
  if (c instanceof EffectNode && c.disposed) {
    for (const p of old.keys()) unlink(p, c);
    for (const p of c.sources.keys()) unlink(p, c);
    c.sources.clear();
    return;
  }
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

/** Arbeitet eingeplante Effekte ab; Schreiben innerhalb eines Effekts startet keine zweite Schleife. */
function flush(): void {
  if (flushing) return;
  flushing = true;
  const runs = new Map<EffectNode, number>();
  let failed = false;
  let firstError: unknown;
  try {
    for (let e = pending.shift(); e; e = pending.shift()) {
      const n = (runs.get(e) ?? 0) + 1;
      runs.set(e, n);
      if (n > MAX_RUNS_PER_EFFECT) {
        e.dispose();
        for (const other of pending) other.queued = false;
        pending.length = 0;
        throw new Error(
          'Effekt-Schleife: Ein Effekt schreibt fortlaufend Signale, die er selbst liest. Er wurde beendet.',
        );
      }
      try {
        e.runIfStale();
      } catch (err) {
        if (!failed) {
          failed = true;
          firstError = err;
        }
      }
    }
  } finally {
    flushing = false;
  }
  if (failed) throw firstError;
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
  private hasError = false;
  private error: unknown;
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
  /** Ab jetzt beobachtet: Quellen abonnieren und prüfen – sie können sich seit dem Lesen geändert haben. */
  watch(): void {
    for (const p of this.sources.keys()) link(p, this);
    this.state = CHECK;
    this.refresh();
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
      if (!this.initialized || this.hasError || !this.equals(this.current as T, next)) {
        this.current = next;
        this.version++;
      }
      this.hasError = false;
    } catch (err) {
      this.hasError = true;
      this.error = err;
      this.version++;
    } finally {
      this.computing = false;
      this.initialized = true;
      this.state = CLEAN;
    }
  }
  private read(): T {
    if (this.hasError) throw this.error;
    return this.current as T;
  }
  get value(): T {
    this.refresh();
    track(this);
    return this.read();
  }
  peek(): T {
    this.refresh();
    return this.read();
  }
}

class EffectNode implements Consumer {
  sources = new Map<Producer, number>();
  queued = false;
  disposed = false;
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
    const previous = this.cleanup;
    this.cleanup = undefined;
    previous?.();
    const result = runTracked(this, this.fn);
    const cleanup = typeof result === 'function' ? (result as () => void) : undefined;
    if (this.disposed) {
      cleanup?.();
      return;
    }
    this.cleanup = cleanup;
    // während des Laufs geändert, was er gelesen hat (auch über Computeds): erneut einplanen
    if (stale(this)) this.mark();
  }
  runIfStale(): void {
    this.queued = false;
    if (!this.disposed && stale(this)) this.run();
  }
  dispose(): void {
    this.disposed = true;
    for (const p of this.sources.keys()) unlink(p, this);
    this.sources.clear();
    const previous = this.cleanup;
    this.cleanup = undefined;
    previous?.();
  }
}

export const signal = <T>(initial: T, equals: Equals<T> = Object.is): Signal<T> =>
  new SignalNode(initial, equals);

export const computed = <T>(fn: () => T, equals: Equals<T> = Object.is): ReadonlySignal<T> =>
  new ComputedNode(fn, equals);

export function effect(fn: EffectFn): () => void {
  const e = new EffectNode(fn);
  batch(() => {
    try {
      e.run();
    } catch (err) {
      e.dispose();
      throw err;
    }
  });
  return () => {
    e.dispose();
  };
}

/** Nur für Tests: Anzahl der aktiven Beobachter einer Quelle. */
export function observerCount(s: ReadonlySignal<unknown>): number {
  return s instanceof SignalNode || s instanceof ComputedNode ? s.observers.size : 0;
}
