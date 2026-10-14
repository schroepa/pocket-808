import { describe, expect, it } from 'vitest';
import { bootState } from './boot.ts';

describe('bootState', () => {
  it('lädt Zustand und Sample-Speicher in der Legacy-Reihenfolge', () => {
    const factory = [new Float32Array(1), null, null, null, null, null, null, null];
    const r = bootState(
      '{"tempo":111,"smp":{"pads":[{},{"name":"weg"}]}}',
      '{"0":{"d":""}}',
      factory,
    );
    expect(r.state.tempo).toBe(111);
    expect(r.state.smp.pads[0]!.name).toBe('');
    expect(r.state.smp.pads[1]!.name).toBe('');
    expect(r.pads[0]).toBeNull();
  });
  it('startet ohne gespeicherte Daten mit dem Startzustand', () => {
    const r = bootState(null, null, [null, null, null, null, null, null, null, null]);
    expect(r.state.preset).toBe('Hip-Hop');
  });
  it('übernimmt den Host-Zustand nach dem gespeicherten (Legacy init: data.state zuletzt)', () => {
    const stored = JSON.stringify({ tempo: 100, swing: 0.3 });
    const { state } = bootState(stored, null, [], { tempo: 140 });
    expect(state.tempo).toBe(140);
    expect(state.swing).toBe(0.3);
  });
  it('ohne Host-Zustand bleibt alles wie gespeichert', () => {
    const { state } = bootState(JSON.stringify({ tempo: 100 }), null, []);
    expect(state.tempo).toBe(100);
  });
});
