import { describe, expect, it, vi } from 'vitest';
import { createIosUnlock, silentWav, type IosEnv } from './ios.ts';

function env(nav: Partial<IosEnv['navigator']>) {
  const audio = { loop: false, volume: 1, play: vi.fn(() => Promise.resolve()) };
  const e = {
    navigator: { userAgent: '', platform: '', maxTouchPoints: 0, ...nav },
    createAudio: vi.fn(() => audio),
    createObjectURL: vi.fn(() => 'blob:x'),
  };
  return { e, audio };
}

describe('silentWav', () => {
  it('ist ein gültiger WAV-Kopf mit 800 Samples Stille', () => {
    const b = silentWav();
    expect(String.fromCharCode(...b.subarray(0, 4))).toBe('RIFF');
    expect(String.fromCharCode(...b.subarray(8, 16))).toBe('WAVEfmt ');
    expect(String.fromCharCode(...b.subarray(36, 40))).toBe('data');
    expect(b.length).toBe(844);
    expect(b[44]).toBe(128);
    expect(b[843]).toBe(128);
  });
});

describe('createIosUnlock', () => {
  it('setzt audioSession auf playback und braucht dann kein Audio-Element', () => {
    const session = { type: 'auto' };
    const { e } = env({ audioSession: session, userAgent: 'iPhone' });
    createIosUnlock(e)();
    expect(session.type).toBe('playback');
    expect(e.createAudio).not.toHaveBeenCalled();
  });
  it('eine audioSession, die beim Setzen wirft, hält nichts auf', () => {
    const session = {
      get type() {
        return 'auto';
      },
      set type(_: string) {
        throw new Error('nur lesbar');
      },
    };
    const { e } = env({ audioSession: session });
    expect(() => {
      createIosUnlock(e)();
    }).not.toThrow();
  });
  it('iOS ohne audioSession: stilles Element, leise, endlos, nur einmal', () => {
    const { e, audio } = env({ userAgent: 'Mozilla iPhone' });
    const unlock = createIosUnlock(e);
    unlock();
    unlock();
    expect(e.createAudio).toHaveBeenCalledTimes(1);
    expect(audio.loop).toBe(true);
    expect(audio.volume).toBeCloseTo(0.01);
  });
  it('iPad mit Mac-Kennung wird erkannt, ein Desktop nicht', () => {
    const ipad = env({ platform: 'MacIntel', maxTouchPoints: 5 });
    createIosUnlock(ipad.e)();
    expect(ipad.e.createAudio).toHaveBeenCalled();
    const mac = env({ platform: 'MacIntel', maxTouchPoints: 0 });
    createIosUnlock(mac.e)();
    expect(mac.e.createAudio).not.toHaveBeenCalled();
  });
  it('abgelehntes play() erlaubt einen neuen Versuch', async () => {
    const { e, audio } = env({ userAgent: 'iPhone' });
    audio.play.mockReturnValueOnce(Promise.reject(new Error('nein')));
    const unlock = createIosUnlock(e);
    unlock();
    await new Promise((r) => setTimeout(r, 0));
    unlock();
    expect(e.createAudio).toHaveBeenCalledTimes(2);
  });
  it('Fehler beim Anlegen erlaubt einen neuen Versuch', () => {
    const { e } = env({ userAgent: 'iPhone' });
    e.createAudio.mockImplementationOnce(() => {
      throw new Error('kein Audio');
    });
    const unlock = createIosUnlock(e);
    unlock();
    unlock();
    expect(e.createAudio).toHaveBeenCalledTimes(2);
  });
});
