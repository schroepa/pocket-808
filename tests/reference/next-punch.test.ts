import { describe, it } from 'vitest';
import { runNext } from './run.ts';

interface Segment {
  rmsDb: number;
  centroidHz: number;
}
interface Probe {
  during: Segment;
  after: Segment;
  steps: number[];
}
const probe = (kind: string) => runNext<Probe>('punchProbe', { kind });

describe.concurrent('Punch-in-Effekte', () => {
  it('Tape: im Haltefenster still, danach wie ohne Effekt', async ({ expect }) => {
    const [base, fx] = await Promise.all([probe('none'), probe('tape')]);
    expect(fx.during.rmsDb).toBeLessThan(base.during.rmsDb - 20);
    expect(Math.abs(fx.after.rmsDb - base.after.rmsDb)).toBeLessThan(3);
  });

  it('Tiefpass und Hochpass verschieben den Schwerpunkt, danach zurück', async ({ expect }) => {
    const [base, lp, hp] = await Promise.all([probe('none'), probe('lp'), probe('hp')]);
    expect(lp.during.centroidHz).toBeLessThan(base.during.centroidHz * 0.6);
    expect(hp.during.centroidHz).toBeGreaterThan(base.during.centroidHz * 1.4);
    for (const fx of [lp, hp]) {
      expect(Math.abs(fx.after.centroidHz / base.after.centroidHz - 1)).toBeLessThan(0.15);
    }
  });

  it('Crush verändert den Klang deutlich, danach zurück', async ({ expect }) => {
    const [base, fx] = await Promise.all([probe('none'), probe('crush')]);
    const centroid = Math.abs(fx.during.centroidHz / base.during.centroidHz - 1);
    const level = Math.abs(fx.during.rmsDb - base.during.rmsDb);
    expect(centroid > 0.15 || level > 1).toBe(true);
    expect(Math.abs(fx.after.centroidHz / base.after.centroidHz - 1)).toBeLessThan(0.15);
  });

  it('Loop 1/16 wiederholt (Pegelverlauf anders), danach zurück', async ({ expect }) => {
    const [base, fx] = await Promise.all([probe('none'), probe('loop16')]);
    expect(
      Math.abs(fx.during.rmsDb - base.during.rmsDb) > 0.5 ||
        Math.abs(fx.during.centroidHz / base.during.centroidHz - 1) > 0.05,
    ).toBe(true);
    expect(Math.abs(fx.after.rmsDb - base.after.rmsDb)).toBeLessThan(3);
  });

  it('Half-Time verdoppelt den Step-Abstand nur solange gehalten', async ({ expect }) => {
    const [base, fx] = await Promise.all([probe('none'), probe('half')]);
    const gap = (s: number[], from: number, to: number) => {
      const w = s.filter((t) => t >= from && t < to);
      return (w.at(-1)! - w[0]!) / (w.length - 1);
    };
    // ohne Swing-Einfluss: Mittel über ganze Paare
    // Swing verschiebt jeden zweiten Step: 10 % Spielraum für die Fenstergrenzen
    const during = gap(fx.steps, 2.5, 3.9) / gap(base.steps, 2.5, 3.9);
    const after = gap(fx.steps, 4.6, 5.9) / gap(base.steps, 4.6, 5.9);
    expect(during).toBeGreaterThan(1.8);
    expect(during).toBeLessThan(2.2);
    expect(after).toBeGreaterThan(0.9);
    expect(after).toBeLessThan(1.1);
  });

  it('Echo klingt nach dem Loslassen aus', async ({ expect }) => {
    const [dry, wet] = await Promise.all([
      runNext<number>('echoTail', { echo: false }),
      runNext<number>('echoTail', { echo: true }),
    ]);
    // ohne Echo ist zwischen 1 und 2 s Stille, mit Echo klingen Wiederholungen nach
    expect(dry).toBeLessThan(-100);
    expect(wet).toBeGreaterThan(dry + 30);
  });
});
