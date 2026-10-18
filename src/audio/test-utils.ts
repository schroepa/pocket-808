import { vi } from 'vitest';

/*
 * Test-Hilfen der Audio-Schicht: ein AudioParam, der seine Automation wirklich ausrechnet
 * (setValueAtTime, linearRamp, cancelAndHold, cancelScheduledValues; Kurven werfen bei Überlappung
 * wie in Browsern), und ein Schein-Kontext, dessen Knoten ihre Verbindungen mitschreiben.
 */

type Ev =
  | { kind: 'set'; t: number; v: number }
  | { kind: 'lin'; t: number; v: number }
  | { kind: 'other'; t: number; end: number };

export interface SimParam {
  value: number;
  /** ausgerechneter Wert zum Zeitpunkt t (nur set/linear; andere Ereignisse halten den Wert) */
  at(t: number): number;
  setValueAtTime: ReturnType<typeof vi.fn>;
  linearRampToValueAtTime: ReturnType<typeof vi.fn>;
  exponentialRampToValueAtTime: ReturnType<typeof vi.fn>;
  setTargetAtTime: ReturnType<typeof vi.fn>;
  cancelScheduledValues: ReturnType<typeof vi.fn>;
  cancelAndHoldAtTime: ReturnType<typeof vi.fn>;
  setValueCurveAtTime: ReturnType<typeof vi.fn>;
}

export function simParam(): SimParam {
  let events: Ev[] = [];
  const valueAt = (t: number, list: Ev[], base: number): number => {
    let lastT = 0;
    let lastV = base;
    for (const e of list) {
      if (e.kind === 'other') continue;
      if (e.t > t) {
        if (e.kind === 'lin' && e.t > lastT)
          return lastV + ((e.v - lastV) * (t - lastT)) / (e.t - lastT);
        return lastV;
      }
      lastT = e.t;
      lastV = e.v;
    }
    return lastV;
  };
  const insert = (e: Ev): void => {
    events = [...events, e].sort((a, b) => a.t - b.t);
  };
  const p: SimParam = {
    value: 0,
    at: (t) => valueAt(t, events, p.value),
    setValueAtTime: vi.fn((v: number, t: number) => {
      insert({ kind: 'set', t, v });
    }),
    linearRampToValueAtTime: vi.fn((v: number, t: number) => {
      insert({ kind: 'lin', t, v });
    }),
    exponentialRampToValueAtTime: vi.fn((v: number, t: number) => {
      insert({ kind: 'lin', t, v });
    }),
    setTargetAtTime: vi.fn((_v: number, t: number) => {
      insert({ kind: 'other', t, end: t });
    }),
    cancelScheduledValues: vi.fn((t: number) => {
      events = events.filter((e) => e.t < t);
    }),
    cancelAndHoldAtTime: vi.fn((t: number) => {
      const v = valueAt(t, events, p.value);
      events = events.filter((e) => e.t <= t && !(e.kind === 'other' && e.end > t));
      insert({ kind: 'set', t, v });
    }),
    setValueCurveAtTime: vi.fn((values: Float32Array, t: number, dur: number) => {
      const end = t + dur;
      if (
        events.some((e) => (e.t >= t && e.t <= end) || (e.kind === 'other' && e.t < t && e.end > t))
      ) {
        throw new Error('NotSupportedError: Kurve überlappt andere Automation');
      }
      events = [...events, { kind: 'other' as const, t, end }].sort((a, b) => a.t - b.t);
      insert({ kind: 'set', t: end, v: values[values.length - 1] ?? 0 });
    }),
  };
  return p;
}

/** Minimaler Schein-Kontext: zeichnet nur auf, was geplant wird. */
export function fakeContext() {
  const param = simParam;
  const node = () => ({
    targets: [] as unknown[],
    connect: vi.fn(function (this: { targets: unknown[] }, n: unknown) {
      this.targets.push(n);
      return n;
    }),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    gain: param(),
    pan: param(),
    frequency: param(),
    Q: param(),
    detune: param(),
    playbackRate: param(),
    delayTime: param(),
    threshold: param(),
    knee: param(),
    ratio: param(),
    attack: param(),
    release: param(),
    buffer: null,
    curve: null,
    type: '',
    loop: false,
  });
  const buffer = (len: number) => ({
    duration: len / 44100,
    getChannelData: () => new Float32Array(len),
  });
  return {
    sampleRate: 44100,
    currentTime: 0,
    state: 'suspended' as AudioContextState,
    destination: node(),
    resume: vi.fn(() => Promise.resolve()),
    close: vi.fn(() => Promise.resolve()),
    createGain: vi.fn(node),
    createStereoPanner: vi.fn(node),
    createBiquadFilter: vi.fn(node),
    createDynamicsCompressor: vi.fn(node),
    createWaveShaper: vi.fn(node),
    createDelay: vi.fn(node),
    createConvolver: vi.fn(node),
    createOscillator: vi.fn(node),
    createBufferSource: vi.fn(node),
    createAnalyser: vi.fn(() => ({
      ...node(),
      fftSize: 2048,
      getFloatTimeDomainData: vi.fn((a: Float32Array) => a.fill(0)),
    })),
    createBuffer: vi.fn((_c: number, n: number) => buffer(n)),
    decodeAudioData: vi.fn(() =>
      Promise.resolve({
        numberOfChannels: 1,
        sampleRate: 44100,
        length: 4,
        getChannelData: () => Float32Array.from([0, 0.25, 0.5, 0.25]),
      }),
    ),
  };
}
