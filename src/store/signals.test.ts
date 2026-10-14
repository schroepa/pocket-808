import { describe, expect, it, vi } from 'vitest';
import {
  batch,
  computed,
  effect,
  observerCount,
  signal,
  type ReadonlySignal,
  untracked,
} from './signals.ts';

/** liest einen Wert nur, um eine Abhängigkeit anzulegen */
const read = (value: unknown): unknown => value;

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
    expect(c.peek()).toBe(2);
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
      read(c.value);
    });
    on.value = false;
    const calls = fn.mock.calls.length;
    x.value = 2;
    expect(fn.mock.calls.length).toBe(calls);
    y.value = 200;
    expect(c.value).toBe(200);
  });
  it('erkennt Zyklen', () => {
    const box: { r?: ReadonlySignal<number> } = {};
    box.r = computed((): number => (box.r ? box.r.value : 0) + 1);
    expect(() => box.r?.value).toThrow(/Zyklus/);
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
      read(a.value);
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
      read(c.value);
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

describe('Regressionen aus dem Review', () => {
  it('Effekt liest unbeobachtetes Computed und schreibt dessen Quelle: Computed bleibt aktuell', () => {
    const s = signal(0);
    const c = computed(() => s.value);
    const seen: number[] = [];
    let done = false;
    effect(() => {
      seen.push(c.value);
      if (!done) {
        done = true;
        s.value = 1;
      }
    });
    expect(c.value).toBe(1);
    expect(seen).toEqual([0, 1]);
  });

  it('Effekt liest schon beobachtetes Computed und schreibt dessen Quelle: läuft erneut', () => {
    const s = signal(10);
    const c = computed(() => s.value * 2);
    effect(() => {
      read(c.value);
    });
    const seen: number[] = [];
    let done = false;
    effect(() => {
      seen.push(c.value);
      if (!done) {
        done = true;
        s.value = 1;
      }
    });
    expect(seen).toEqual([20, 2]);
  });

  it('beobachtetes Computed, das einmal wirft, erholt sich und weckt seine Effekte wieder', () => {
    const s = signal(0);
    const c = computed(() => {
      if (s.value === 1) throw new Error('x');
      return s.value;
    });
    const r: number[] = [];
    effect(() => {
      try {
        r.push(c.value);
      } catch {
        r.push(-1);
      }
    });
    s.value = 1;
    s.value = 2;
    expect(r).toEqual([0, -1, 2]);
  });

  it('nach dem Schleifenschutz reagieren unbeteiligte Effekte weiter, der Verursacher ist beendet', () => {
    const u = signal(0);
    const a = signal(0);
    const seen: number[] = [];
    effect(() => {
      seen.push(u.value);
    });
    expect(() => {
      batch(() => {
        effect(() => {
          a.value = a.value + 1;
          u.value = a.peek();
        });
      });
    }).toThrow(/Effekt-Schleife/);
    expect(observerCount(a)).toBe(0);
    u.value = -5;
    expect(seen.at(-1)).toBe(-5);
  });

  it('viele legitime Effekte an einer Quelle lösen keinen Fehlalarm aus', () => {
    const s = signal(0);
    let runs = 0;
    for (let i = 0; i < 10_001; i++) {
      effect(() => {
        read(s.value);
        runs++;
      });
    }
    runs = 0;
    expect(() => {
      s.value = 1;
    }).not.toThrow();
    expect(runs).toBe(10_001);
  });

  it('ein Fehler in einem Effekt hält die anderen nicht auf und wird gemeldet', () => {
    const s = signal(0);
    const seenB: number[] = [];
    effect(() => {
      if (s.value === 1) throw new Error('A kaputt');
    });
    effect(() => {
      seenB.push(s.value);
    });
    expect(() => {
      s.value = 1;
    }).toThrow('A kaputt');
    expect(seenB).toEqual([0, 1]);
  });

  it('jede Aufräumfunktion läuft genau einmal, auch wenn der Effekt wirft', () => {
    const s = signal(0);
    const cleanups: ReturnType<typeof vi.fn>[] = [];
    const dispose = effect(() => {
      if (s.value === 1) throw new Error('x');
      const c = vi.fn();
      cleanups.push(c);
      return c;
    });
    expect(() => {
      s.value = 1;
    }).toThrow('x');
    dispose();
    expect(cleanups.map((c) => c.mock.calls.length)).toEqual([1]);
  });

  it('Effekt, der sich im Lauf selbst beendet, hinterlässt kein Abo', () => {
    const a = signal(0);
    const b = signal(0);
    const cleanups: ReturnType<typeof vi.fn>[] = [];
    let stop = (): void => undefined;
    stop = effect(() => {
      if (a.value === 1) {
        stop();
        read(b.value);
      }
      const c = vi.fn();
      cleanups.push(c);
      return c;
    });
    a.value = 1;
    expect(observerCount(a)).toBe(0);
    expect(observerCount(b)).toBe(0);
    expect(cleanups.map((c) => c.mock.calls.length)).toEqual([1, 1]);
  });

  it('Effekt, der schon beim ersten Lauf wirft, bleibt nicht abonniert', () => {
    const s = signal(0);
    expect(() =>
      effect(() => {
        read(s.value);
        throw new Error('sofort');
      }),
    ).toThrow('sofort');
    expect(observerCount(s)).toBe(0);
    expect(() => {
      s.value = 1;
    }).not.toThrow();
  });
});

describe('untracked', () => {
  it('liest, ohne eine Abhängigkeit anzulegen', () => {
    const a = signal(1);
    const b = signal(10);
    const seen: number[] = [];
    const stop = effect(() => {
      seen.push(a.value + untracked(() => b.value));
    });
    b.value = 20;
    a.value = 2;
    expect(seen).toEqual([11, 22]);
    stop();
  });
});
