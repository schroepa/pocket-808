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
});
