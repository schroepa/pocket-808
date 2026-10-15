import { describe, expect, it, vi } from 'vitest';
import { createRecorder, type MediaRecorderLike } from './recorder.ts';

function setup(opts: { media?: boolean; recorder?: boolean; deny?: boolean } = {}) {
  const track = { stop: vi.fn() };
  const stream = { getTracks: () => [track] } as unknown as MediaStream;
  const made: (MediaRecorderLike & { started: boolean })[] = [];
  class FakeRecorder implements MediaRecorderLike {
    started = false;
    ondataavailable: ((e: { data: Blob }) => void) | null = null;
    onstop: (() => void) | null = null;
    constructor() {
      made.push(this);
    }
    start() {
      this.started = true;
    }
    stop() {
      this.onstop?.();
    }
  }
  let timeoutFn: (() => void) | null = null;
  const env = {
    mediaDevices:
      opts.media === false
        ? undefined
        : {
            getUserMedia: vi.fn(() =>
              opts.deny ? Promise.reject(new Error('NotAllowedError')) : Promise.resolve(stream),
            ),
          },
    MediaRecorder: opts.recorder === false ? undefined : FakeRecorder,
    setTimeout: vi.fn((fn: () => void) => {
      timeoutFn = fn;
      return 1;
    }),
    clearTimeout: vi.fn(),
  };
  return {
    recorder: createRecorder(env),
    env,
    track,
    rec: () => made[0],
    fireTimeout: () => {
      timeoutFn?.();
    },
  };
}

describe('createRecorder', () => {
  it('ohne Mikrofon-API oder MediaRecorder: nicht verfügbar', async () => {
    expect(await setup({ media: false }).recorder.start(3000)).toEqual({ error: 'unavailable' });
    expect(await setup({ recorder: false }).recorder.start(3000)).toEqual({ error: 'unavailable' });
  });
  it('gesperrtes Mikrofon', async () => {
    expect(await setup({ deny: true }).recorder.start(3000)).toEqual({ error: 'denied' });
  });
  it('nimmt auf, liefert die Daten beim Stopp und gibt das Mikrofon frei', async () => {
    const t = setup();
    const r = await t.recorder.start(3000);
    if ('error' in r) throw new Error('Fehler');
    expect(t.rec()?.started).toBe(true);
    t.rec()?.ondataavailable?.({ data: new Blob([new Uint8Array([1, 2])]) });
    t.rec()?.ondataavailable?.({ data: new Blob([]) });
    r.stop();
    const buf = await r.done;
    expect(buf?.byteLength).toBe(2);
    expect(t.track.stop).toHaveBeenCalled();
    expect(t.env.clearTimeout).toHaveBeenCalled();
  });
  it('stoppt nach der Höchstdauer; ohne Daten null', async () => {
    const t = setup();
    const r = await t.recorder.start(3000);
    if ('error' in r) throw new Error('Fehler');
    expect(t.env.setTimeout).toHaveBeenCalledWith(expect.any(Function), 3000);
    t.fireTimeout();
    expect(await r.done).toBeNull();
  });
});
