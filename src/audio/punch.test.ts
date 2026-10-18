import { describe, expect, it } from 'vitest';
import { baseState } from '../core/defaults.ts';
import { must } from '../core/util.ts';
import { createStore } from '../store/store.ts';
import { createEngine } from './engine.ts';
import { fakeContext, type SimParam } from './test-utils.ts';

interface Node {
  targets: unknown[];
  gain: SimParam;
  delayTime: SimParam;
}

function setup() {
  const ctx = fakeContext();
  let now = 1;
  const engine = createEngine({
    store: createStore(baseState()),
    createContext: () => ctx as never,
    clock: () => now,
    prerender: false,
  });
  engine.prepare();
  const gains = () => ctx.createGain.mock.results.map((r) => r.value as Node);
  const bus = must(gains()[0], 'Bus');
  const dry = must(bus.targets[0] as Node | undefined, 'Dry-Gate').gain;
  /** größter Wert eines Parameters im Zeitfenster (1-ms-Raster) */
  const max = (p: SimParam, from: number, to: number) => {
    let m = -Infinity;
    for (let t = from; t <= to; t += 0.001) m = Math.max(m, p.at(t));
    return m;
  };
  return {
    ctx,
    engine,
    gains,
    dry,
    max,
    at: (t: number) => {
      now = t;
    },
  };
}

describe('Punch: Übergänge ohne Knacken', () => {
  it('Crush → Tape: das trockene Signal bleibt aus (kein Aufblitzen)', () => {
    const { engine, dry, max, at } = setup();
    engine.punchOn('crush');
    at(2);
    engine.punchOn('tape');
    expect(max(dry, 2, 2.05)).toBeLessThan(0.01);
  });

  it('Crush → Loop: trockenes Signal kommt sofort für die Aufnahme zurück, dann aus', () => {
    const { engine, dry, at } = setup();
    engine.punchOn('crush');
    at(2);
    engine.punchOn('loop8');
    // Tempo 90: 1/8 Schlag ≈ 0,333 s Aufnahme
    expect(dry.at(2.1)).toBeCloseTo(1, 2);
    expect(dry.at(2.5)).toBeCloseTo(0, 2);
  });

  it('Loop → Crush noch während der Aufnahme: trockenes Signal geht aus und bleibt aus', () => {
    const { engine, dry, max, at } = setup();
    engine.punchOn('loop8');
    at(1.1);
    engine.punchOn('crush');
    expect(dry.at(1.13)).toBeCloseTo(0, 2);
    expect(max(dry, 1.13, 2)).toBeLessThan(0.01);
  });

  it('Tape kurz tippen: Ausgang blendet vom aktuellen Pegel aus (kein Sprung)', () => {
    const { engine, gains, at } = setup();
    const before = gains().length;
    engine.punchOn('tape');
    const out = must(gains()[before + 1], 'Tape-Ausgang').gain;
    at(1.31);
    const level = out.at(1.315);
    expect(level).toBeGreaterThan(0.5);
    engine.punchOff('tape');
    // keine Lücke: direkt nach dem Loslassen liegt der Pegel noch nahe am vorigen
    expect(out.at(1.3151)).toBeGreaterThan(level - 0.05);
    expect(out.at(1.35)).toBeCloseTo(0, 2);
  });

  it('Tape schnell erneut drücken wirft nicht; das trockene Signal hängt nie', () => {
    const { engine, dry, at } = setup();
    engine.punchOn('tape');
    at(1.3);
    engine.punchOff('tape');
    at(1.305);
    expect(() => {
      engine.punchOn('tape');
    }).not.toThrow();
    at(1.6);
    engine.punchOff('tape');
    expect(dry.at(1.7)).toBeCloseTo(1, 2);
  });
});
