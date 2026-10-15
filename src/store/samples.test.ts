import { describe, expect, it } from 'vitest';
import { SAMPLE_STORAGE_KEY } from '../core/constants.ts';
import { decodePcm } from '../core/samples.ts';
import { createSampleBank } from './samples.ts';
import { effect } from './signals.ts';

function memory(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v);
    },
  };
}
const pcm = Float32Array.from([0, 0.5, -0.5]);

describe('createSampleBank', () => {
  it('startet mit den geladenen Drum-Samples', () => {
    const bank = createSampleBank(memory(), { SD: { pcm, name: 'Snap' } });
    expect(bank.drums.value.get('SD')?.name).toBe('Snap');
  });

  it('setDrum meldet die Änderung und speichert sofort unter D:<Stimme>, Pads bleiben erhalten', () => {
    const storage = memory({ [SAMPLE_STORAGE_KEY]: JSON.stringify({ '0': { d: '' } }) });
    const bank = createSampleBank(storage, {});
    let runs = 0;
    const stop = effect(() => {
      if (bank.drums.value.size >= 0) runs++;
    });
    bank.setDrum('BD', { pcm, name: 'Kick' });
    expect(runs).toBe(2);
    const saved = JSON.parse(storage.data.get(SAMPLE_STORAGE_KEY) ?? '{}') as Record<
      string,
      { d: string; n?: string }
    >;
    expect(saved['0']).toEqual({ d: '' });
    expect(saved['D:BD']?.n).toBe('Kick');
    expect(decodePcm(saved['D:BD']?.d ?? '')[1]).toBeCloseTo(0.5, 3);
    stop();
  });

  it('setDrum(null) entfernt Sample und Speicher-Eintrag', () => {
    const storage = memory();
    const bank = createSampleBank(storage, { CP: { pcm, name: 'X' } });
    bank.setDrum('CP', null);
    expect(bank.drums.value.has('CP')).toBe(false);
    expect(JSON.parse(storage.data.get(SAMPLE_STORAGE_KEY) ?? '{}')).toEqual({});
  });

  it('ein voller oder gesperrter Speicher hält die Änderung nicht auf', () => {
    const bank = createSampleBank(
      {
        getItem: () => {
          throw new Error('gesperrt');
        },
        setItem: () => {
          throw new Error('voll');
        },
      },
      {},
    );
    bank.setDrum('BD', { pcm, name: 'K' });
    expect(bank.drums.value.has('BD')).toBe(true);
  });

  it('Pad-Samples: Start, setzen und leeren; Drum-Einträge bleiben', () => {
    const storage = memory();
    const factory = Float32Array.from([0.1]);
    const bank = createSampleBank(storage, {}, [factory, null]);
    expect(bank.pads.value[0]).toBe(factory);
    expect(bank.pads.value[1]).toBeNull();
    bank.setDrum('BD', { pcm, name: 'K' });
    bank.setPad(1, pcm);
    expect(bank.pads.value[1]).toBe(pcm);
    let saved = JSON.parse(storage.data.get(SAMPLE_STORAGE_KEY) ?? '{}') as Record<
      string,
      { d: string }
    >;
    expect(decodePcm(saved['1']?.d ?? '')[1]).toBeCloseTo(0.5, 3);
    bank.setPad(0, null);
    saved = JSON.parse(storage.data.get(SAMPLE_STORAGE_KEY) ?? '{}') as Record<
      string,
      { d: string }
    >;
    expect(saved['0']).toEqual({ d: '' });
    expect(saved['D:BD']).toBeDefined();
    expect(bank.pads.value[0]).toBeNull();
  });
});
