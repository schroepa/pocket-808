import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PAD_DEFAULT } from '../../../core/constants.ts';
import { currentPattern } from '../../../core/pattern.ts';
import { padSummary } from '../../../core/sampler.ts';
import { must } from '../../../core/util.ts';
import { makeContext, pointer } from '../../test-utils.ts';
import { samplerDevice } from './device.ts';
import { samplerChop } from './chop.ts';
import { samplerKeyboard } from './keyboard.ts';
import { samplerKnobs } from './knobs.ts';
import { createMessage } from './message.ts';
import { samplerPads } from './pads.ts';
import { samplerSteps } from './steps.ts';
import { samplerTools } from './tools.ts';
import { drawWave, samplerWave } from './wave.ts';

// jsdom hat keinen Canvas-Kontext: ohne Stub meldet es „Not implemented“
beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});
afterEach(() => {
  vi.restoreAllMocks();
});

const flush = () => new Promise((r) => setTimeout(r, 0));
const pcm = Float32Array.from([0, 0.5, -0.5, 0.25]);
const sel = (c: ReturnType<typeof makeContext>['c']) => c.store.state.value.smp.sel;
const padOf = (c: ReturnType<typeof makeContext>['c'], i: number) =>
  must(c.store.state.value.smp.pads[i], 'Pad');

describe('samplerPads', () => {
  it('Pad antippen wählt; mit Sample hört es vor, ohne nicht', () => {
    const { c, audio } = makeContext();
    c.samples.setPad(1, pcm);
    const el = samplerPads(c);
    const pads = [...el.querySelectorAll<HTMLButtonElement>('.pad')];
    expect(pads).toHaveLength(8);
    pads[1]?.click();
    expect(sel(c)).toBe(1);
    expect(pads[1]?.classList.contains('sel')).toBe(true);
    expect(pads[1]?.getAttribute('aria-pressed')).toBe('true');
    expect(pads[0]?.getAttribute('aria-pressed')).toBe('false');
    expect(audio.auditionPad).toHaveBeenCalledWith(1);
    pads[2]?.click();
    expect(audio.auditionPad).toHaveBeenCalledTimes(1);
    expect(pads[2]?.classList.contains('empty')).toBe(true);
    expect(pads[2]?.querySelector('small')?.textContent).toBe('leer');
  });
  it('Name, Inhaltspunkt aus den Steps', () => {
    const { c, store } = makeContext();
    c.samples.setPad(0, pcm);
    store.update((s) => ({
      ...s,
      smp: { ...s.smp, pads: s.smp.pads.map((p, i) => (i === 0 ? { ...p, name: 'Stab' } : p)) },
    }));
    const el = samplerPads(c);
    const pad = el.querySelector('.pad');
    expect(pad?.querySelector('small')?.textContent).toBe('Stab');
    expect(pad?.classList.contains('has')).toBe(false);
    store.toggleSampleStep(0, 3);
    expect(pad?.classList.contains('has')).toBe(true);
    store.update((s) => ({
      ...s,
      smp: { ...s.smp, pads: s.smp.pads.map((p, i) => (i === 0 ? { ...p, name: '' } : p)) },
    }));
    expect(pad?.querySelector('small')?.textContent).toBe('Sample');
  });
});

describe('createMessage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });
  it('zeigt eine Meldung 4,5 s, dauerhafte bleiben, Aufräumen bricht ab', () => {
    const { c } = makeContext();
    const m = createMessage(c.scope);
    expect(m.el.getAttribute('role')).toBe('status');
    expect(m.el.hidden).toBe(true);
    m.show('Pad 1 geladen');
    expect(m.el.textContent).toBe('Pad 1 geladen');
    vi.advanceTimersByTime(4499);
    expect(m.el.hidden).toBe(false);
    vi.advanceTimersByTime(1);
    expect(m.el.hidden).toBe(true);
    m.show('läuft', true);
    vi.advanceTimersByTime(10000);
    expect(m.el.hidden).toBe(false);
    m.show('kurz');
    c.scope.dispose();
    vi.advanceTimersByTime(5000);
    expect(m.el.hidden).toBe(false);
  });
});

describe('samplerTools', () => {
  function setup() {
    const ctx = makeContext();
    const msg = createMessage(ctx.c.scope);
    const el = samplerTools(ctx.c, msg);
    const btn = (name: string) => {
      const b = [...el.querySelectorAll<HTMLButtonElement>('button')].find(
        (x) => x.getAttribute('aria-label') === name || x.textContent === name,
      );
      if (!b) throw new Error(name);
      return b;
    };
    return { ...ctx, msg, el, btn };
  }

  it('Laden: dekodiert, setzt Bereich und Namen, speichert, hört vor, meldet', async () => {
    const { c, btn, msg, audio, store } = setup();
    store.update((s) => ({ ...s, smp: { ...s.smp, sel: 2 } }));
    btn('Laden').click();
    await flush();
    expect(c.samples.pads.value[2]).toBeInstanceOf(Float32Array);
    expect(padOf(c, 2)).toMatchObject({ name: 'Kick', start: 0, end: 1 });
    expect(audio.auditionPad).toHaveBeenCalledWith(2);
    expect(msg.el.textContent).toBe('Pad 3 geladen');
  });

  it('Laden abgebrochen, Datei unlesbar, Lesefehler', async () => {
    const { c, btn, msg, audio, files } = setup();
    files.pickAudio.mockResolvedValueOnce(null);
    btn('Laden').click();
    await flush();
    expect(c.samples.pads.value[0]).toBeUndefined();
    audio.decode.mockImplementationOnce(() => Promise.reject(new Error('kaputt')));
    btn('Laden').click();
    await flush();
    expect(msg.el.textContent).toBe('Datei nicht lesbar');
    files.pickAudio.mockImplementationOnce(() => Promise.reject(new Error('weg')));
    msg.show('');
    btn('Laden').click();
    await flush();
    expect(msg.el.textContent).toBe('Datei nicht lesbar');
  });

  it('Rec: Aufnahme starten, Stopp beendet, Ergebnis landet im Pad', async () => {
    const { c, btn, msg, recorder, recording } = setup();
    const rec = btn('Mit dem Mikrofon aufnehmen');
    rec.click();
    await flush();
    expect(recorder.start).toHaveBeenCalledWith(3000);
    expect(rec.textContent).toBe('Stopp');
    expect(rec.getAttribute('aria-pressed')).toBe('true');
    expect(msg.el.textContent).toBe('Aufnahme läuft · max. 3 s');
    rec.click();
    expect(recording.stop).toHaveBeenCalled();
    recording.finish(new ArrayBuffer(4));
    await flush();
    await flush();
    expect(rec.textContent).toBe('Rec');
    expect(padOf(c, 0).name).toBe('Aufnahme');
  });

  it('Rec ohne Daten, ohne Mikrofon, gesperrt (Rückfall Dateiauswahl mit capture)', async () => {
    const { btn, msg, recorder, recording, files } = setup();
    const rec = btn('Mit dem Mikrofon aufnehmen');
    rec.click();
    await flush();
    recording.finish(null);
    await flush();
    expect(msg.el.textContent).toBe('Nichts aufgenommen');
    recorder.start.mockResolvedValueOnce({ error: 'unavailable' });
    files.pickAudio.mockResolvedValueOnce(null);
    rec.click();
    await flush();
    expect(msg.el.textContent).toBe('Mikro hier nicht verfügbar · öffne Aufnahme-App');
    expect(files.pickAudio).toHaveBeenLastCalledWith({ capture: true });
    recorder.start.mockResolvedValueOnce({ error: 'denied' });
    files.pickAudio.mockResolvedValueOnce(null);
    rec.click();
    await flush();
    expect(msg.el.textContent).toBe('Mikro gesperrt · öffne Aufnahme-App');
  });

  it('Rec: zweiter Tipp während der Mikrofon-Abfrage startet keine zweite Aufnahme', async () => {
    const { btn, recorder } = setup();
    let release: () => void = () => undefined;
    recorder.start.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () => {
            resolve({ error: 'unavailable' });
          };
        }),
    );
    const rec = btn('Mit dem Mikrofon aufnehmen');
    rec.click();
    rec.click();
    expect(recorder.start).toHaveBeenCalledTimes(1);
    release();
    await flush();
  });

  it('Rec: abgelehntes Ergebnis lässt den Knopf nicht auf „Stopp“ hängen', async () => {
    const { btn, recorder, msg } = setup();
    recorder.start.mockResolvedValueOnce({
      done: Promise.reject(new Error('weg')),
      stop: () => undefined,
    });
    const rec = btn('Mit dem Mikrofon aufnehmen');
    rec.click();
    await flush();
    await flush();
    expect(rec.textContent).toBe('Rec');
    expect(msg.el.textContent).toBe('Nichts aufgenommen');
  });

  it('Rev schaltet um und hört vor; Leeren setzt das Pad zurück', () => {
    const { c, btn, audio, store } = setup();
    c.samples.setPad(0, pcm);
    const rev = btn('Rückwärts abspielen');
    rev.click();
    expect(padOf(c, 0).rev).toBe(true);
    expect(rev.getAttribute('aria-pressed')).toBe('true');
    expect(audio.auditionPad).toHaveBeenCalledWith(0);
    store.update((s) => ({
      ...s,
      smp: {
        ...s.smp,
        pads: s.smp.pads.map((p, i) => (i === 0 ? { ...p, start: 0.3, name: 'X' } : p)),
      },
    }));
    btn('Leeren').click();
    expect(c.samples.pads.value[0]).toBeNull();
    expect(padOf(c, 0)).toMatchObject({ name: '', start: 0, end: 1, rev: false });
  });
});

describe('drawWave', () => {
  it('Mittellinie, Ausschläge, Abdunklung außerhalb des Bereichs und zwei Marken', () => {
    const calls: string[] = [];
    const g = {
      fillStyle: '',
      clearRect: vi.fn(),
      fillRect: vi.fn((x: number, y: number, w: number, h: number) => {
        calls.push(`${g.fillStyle}:${[x, y, w, h].map((v) => Math.round(v)).join(',')}`);
      }),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      fill: vi.fn(),
    };
    drawWave(g, 4, 10, Float32Array.from([1, -1, 0.5, 0]), 0.25, 0.75);
    expect(calls[0]).toBe('rgba(211, 146, 90, 0.2):0,5,4,1');
    expect(calls).toContain('#d3925a:0,0,1,1');
    expect(calls).toContain('rgba(8, 8, 11, 0.78):0,0,1,10');
    expect(calls).toContain('#d4d4dc:0,0,2,10');
    expect(g.fill).toHaveBeenCalledTimes(2);
    calls.length = 0;
    drawWave(g, 4, 10, null, 0, 1);
    expect(calls).toEqual(['rgba(211, 146, 90, 0.2):0,5,4,1']);
    // Chop: Linien an den Slice-Grenzen, zwischen den Griffen
    calls.length = 0;
    drawWave(g, 400, 10, Float32Array.from([1, -1]), 0, 1, 4);
    const lines = calls.filter((x) => x.startsWith('rgba(212, 212, 220, 0.5)'));
    expect(lines).toEqual([100, 200, 300].map((x) => `rgba(212, 212, 220, 0.5):${x},0,1,10`));
  });
});

describe('samplerWave', () => {
  function setup() {
    const ctx = makeContext();
    const el = samplerWave(ctx.c);
    const cv = el.querySelector('canvas');
    if (!cv) throw new Error('kein Canvas');
    cv.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 100,
      height: 88,
      right: 100,
      bottom: 88,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    return { ...ctx, el, cv };
  }
  it('ohne Sample: Hinweis sichtbar, Ziehen wirkungslos', () => {
    const { el, cv, c, audio } = setup();
    expect(el.querySelector<HTMLElement>('.wave-empty')?.hidden).toBe(false);
    cv.dispatchEvent(pointer('pointerdown', { clientX: 50 }));
    cv.dispatchEvent(pointer('pointerup'));
    expect(padOf(c, 0).start).toBe(0);
    expect(audio.auditionPad).not.toHaveBeenCalled();
  });
  it('mit Sample: näherer Griff folgt dem Zeiger, Loslassen hört vor', () => {
    const { el, cv, c, audio } = setup();
    c.samples.setPad(0, pcm);
    expect(el.querySelector<HTMLElement>('.wave-empty')?.hidden).toBe(true);
    cv.dispatchEvent(pointer('pointerdown', { clientX: 80 }));
    expect(padOf(c, 0).end).toBe(0.8);
    cv.dispatchEvent(pointer('pointermove', { clientX: 60 }));
    expect(padOf(c, 0).end).toBe(0.6);
    cv.dispatchEvent(pointer('pointerup'));
    expect(audio.auditionPad).toHaveBeenCalledWith(0);
    cv.dispatchEvent(pointer('pointermove', { clientX: 10 }));
    expect(padOf(c, 0).end).toBe(0.6);
    cv.dispatchEvent(pointer('pointerdown', { clientX: -20 }));
    expect(padOf(c, 0).start).toBe(0);
    cv.dispatchEvent(pointer('pointercancel'));
    cv.dispatchEvent(pointer('pointerup'));
    expect(audio.auditionPad).toHaveBeenCalledTimes(1);
  });
});

describe('samplerWave zeichnen', () => {
  it('zeichnet mit Kontext und Größe; ResizeObserver zeichnet neu und wird aufgeräumt', () => {
    const observed: { cb: () => void; disconnect: ReturnType<typeof vi.fn> }[] = [];
    class FakeRO {
      disconnect = vi.fn();
      constructor(cb: () => void) {
        observed.push({ cb, disconnect: this.disconnect });
      }
      observe() {
        return undefined;
      }
    }
    vi.stubGlobal('ResizeObserver', FakeRO);
    const g = {
      fillStyle: '',
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      fill: vi.fn(),
      setTransform: vi.fn(),
    };
    const spy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockImplementation(() => g as unknown as CanvasRenderingContext2D);
    try {
      const { c } = makeContext();
      const el = samplerWave(c);
      const cv = el.querySelector('canvas');
      if (!cv) throw new Error('kein Canvas');
      cv.getBoundingClientRect = () => ({
        left: 0,
        top: 0,
        width: 50,
        height: 88,
        right: 50,
        bottom: 88,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      });
      c.samples.setPad(0, pcm);
      expect(g.setTransform).toHaveBeenCalled();
      expect(cv.width).toBe(Math.round(50 * Math.min(2, window.devicePixelRatio || 1)));
      g.clearRect.mockClear();
      observed[0]?.cb();
      expect(g.clearRect).toHaveBeenCalledTimes(1);
      c.scope.dispose();
      expect(observed[0]?.disconnect).toHaveBeenCalled();
    } finally {
      spy.mockRestore();
      vi.unstubAllGlobals();
    }
  });
});

describe('samplerKnobs', () => {
  it('Werte des gewählten Pads, Tune in Halbtönen, Tag „PAD n“, Doppeltipp Standard', () => {
    const { c, store, audio } = makeContext();
    store.update((s) => ({ ...s, smp: { ...s.smp, sel: 4 } }));
    c.samples.setPad(4, pcm);
    const el = samplerKnobs(c);
    const knob = (l: string) => el.querySelector(`[role=slider][aria-label="${l}"]`);
    knob('Tune')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'End' }));
    expect(padOf(c, 4).tune).toBe(1);
    expect(c.readout.text.value).toBe('PAD 5 Tune +12 ST');
    knob('Tune')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home' }));
    expect(c.readout.text.value).toBe('PAD 5 Tune -12 ST');
    for (const [l, k] of [
      ['Attack', 'att'],
      ['Decay', 'dec'],
      ['Level', 'lvl'],
    ] as const) {
      knob(l)?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home' }));
      expect(padOf(c, 4)[k]).toBe(0);
    }
    expect(c.readout.text.value).toBe('PAD 5 Level 0');
    const lvl = knob('Level');
    for (let i = 0; i < 2; i++) {
      lvl?.dispatchEvent(pointer('pointerdown'));
      lvl?.dispatchEvent(pointer('pointerup'));
    }
    expect(padOf(c, 4).lvl).toBe(PAD_DEFAULT.lvl);
    expect(audio.auditionPad).toHaveBeenCalledWith(4);
  });
});

describe('samplerSteps', () => {
  it('Steps schalten, Vorhören nur beim Einschalten im Stand, Lauflicht', () => {
    const { c, store, audio } = makeContext();
    c.samples.setPad(0, pcm);
    const el = samplerSteps(c);
    const steps = [...el.querySelectorAll<HTMLButtonElement>('.ss')];
    expect(steps).toHaveLength(16);
    expect(steps[4]?.classList.contains('q')).toBe(true);
    steps[2]?.click();
    expect(store.state.value.patterns.A.smp[0]?.[2]).toBe(1);
    expect(steps[2]?.getAttribute('aria-pressed')).toBe('true');
    expect(audio.auditionPad).toHaveBeenCalledTimes(1);
    steps[2]?.click();
    audio.playing.value = true;
    steps[3]?.click();
    expect(audio.auditionPad).toHaveBeenCalledTimes(1);
    audio.playhead.value = { step: 3, songIndex: -1 };
    expect(steps[3]?.classList.contains('now')).toBe(true);
  });
  it('Sub-Modus mit Sub-Editor für das gewählte Pad', () => {
    const { c, store } = makeContext();
    store.update((s) => ({ ...s, smp: { ...s.smp, sel: 2 } }));
    const el = samplerSteps(c);
    const sub = el.querySelector<HTMLButtonElement>('[aria-label="Sub-Steps bearbeiten"]');
    const ed = el.querySelector<HTMLElement>('.sub-ed');
    expect(ed?.hidden).toBe(true);
    sub?.click();
    expect(ed?.hidden).toBe(false);
    el.querySelectorAll<HTMLButtonElement>('.ss')[5]?.click();
    expect(el.querySelectorAll('.ss')[5]?.classList.contains('subsel')).toBe(true);
    expect(store.state.value.patterns.A.smp[2]?.[5]).toBe(0);
    expect(ed?.querySelector('.cap-label')?.textContent).toBe('Pad 3 · Step 6 · 16 Sub-Steps');
    ed?.querySelectorAll<HTMLButtonElement>('.sb')[0]?.click();
    expect(store.state.value.patterns.A.sub.P2?.[5]?.[0]).toBe(1);
    expect(el.querySelectorAll('.ss')[5]?.classList.contains('sub')).toBe(true);
    sub?.click();
    expect(ed?.hidden).toBe(true);
  });
});

describe('samplerChop', () => {
  const radio = (el: HTMLElement, label: string) =>
    [...el.querySelectorAll<HTMLButtonElement>('[role=radio]')].find(
      (b) => b.textContent === label,
    );

  it('Segment setzt und löscht Chop des gewählten Pads', () => {
    const { c, store } = makeContext();
    store.update((s) => ({ ...s, smp: { ...s.smp, sel: 2 } }));
    const el = samplerChop(c, createMessage(c.scope));
    expect(radio(el, 'Aus')?.getAttribute('aria-checked')).toBe('true');
    radio(el, '4')?.click();
    expect(padOf(c, 2).sl).toBe(4);
    expect(radio(el, '4')?.getAttribute('aria-checked')).toBe('true');
    radio(el, 'Aus')?.click();
    expect('sl' in padOf(c, 2)).toBe(false);
  });

  it('Verteilen: Meldungen ohne Chop bzw. ohne Steps, sonst Slices auf die Steps (mit Zurück)', () => {
    const { c, store } = makeContext();
    const msg = createMessage(c.scope);
    const el = samplerChop(c, msg);
    const verteilen = [...el.querySelectorAll('button')].find((b) => b.textContent === 'Verteilen');
    verteilen?.click();
    expect(msg.el.textContent).toBe('Erst Chop wählen');
    [...el.querySelectorAll<HTMLButtonElement>('[role=radio]')]
      .find((b) => b.textContent === '2')
      ?.click();
    store.update((s) => {
      const p = s.patterns[s.cur];
      const smp = p.smp.map((r, i) => (i === 0 ? r.map(() => 0 as const) : r));
      return { ...s, patterns: { ...s.patterns, [s.cur]: { ...p, smp } } };
    });
    verteilen?.click();
    expect(msg.el.textContent).toBe('Erst Steps setzen');
    store.toggleSampleStep(0, 1);
    store.toggleSampleStep(0, 5);
    store.toggleSampleStep(0, 9);
    verteilen?.click();
    expect(msg.el.textContent).toBe('Pad 1: Slices verteilt');
    const opt = () => currentPattern(store.state.value).opt?.P0;
    expect([1, 5, 9].map((s) => opt()?.[s]?.k)).toEqual([0, 1, 0]);
    store.undo();
    expect(currentPattern(store.state.value).opt).toBeUndefined();
  });
});

describe('samplerKeyboard', () => {
  const key = (el: HTMLElement, name: string) =>
    el.querySelector<HTMLButtonElement>(`[aria-label="Pad spielen, Ton ${name}"]`);

  it('zwölf Tasten, Tipp spielt das Pad verstimmt, Oktave ±1, leeres Pad bleibt still', () => {
    const { c, audio, store } = makeContext();
    const el = samplerKeyboard(c);
    expect(el.querySelectorAll('.key')).toHaveLength(12);
    expect(el.querySelectorAll('.key.black')).toHaveLength(5);
    key(el, 'C')?.click();
    expect(audio.auditionPad).not.toHaveBeenCalled();
    c.samples.setPad(0, pcm);
    key(el, 'C')?.click();
    expect(audio.auditionPad).toHaveBeenLastCalledWith(0, 0);
    key(el, 'G')?.click();
    expect(audio.auditionPad).toHaveBeenLastCalledWith(0, 7);
    const up = el.querySelector<HTMLButtonElement>('[aria-label="Tastatur Oktave höher"]');
    up?.click();
    up?.click(); // begrenzt auf +1
    expect(el.querySelector('.oct')?.textContent).toBe('Okt +1');
    key(el, 'E')?.click();
    expect(audio.auditionPad).toHaveBeenLastCalledWith(0, 16);
    el.querySelector<HTMLButtonElement>('[aria-label="Tastatur Oktave tiefer"]')?.click();
    el.querySelector<HTMLButtonElement>('[aria-label="Tastatur Oktave tiefer"]')?.click();
    expect(el.querySelector('.oct')?.textContent).toBe('Okt -1');
    store.update((s) => ({ ...s, smp: { ...s.smp, sel: 1 } }));
    c.samples.setPad(1, pcm);
    key(el, 'A')?.click();
    expect(audio.auditionPad).toHaveBeenLastCalledWith(1, -3);
  });
});

describe('samplerDevice', () => {
  it('Zusammenfassung und Teile', () => {
    const { c, store } = makeContext();
    const d = samplerDevice(c);
    expect(d.id).toBe('smp');
    expect(d.summary.value).toBe(padSummary(store.state.value, null));
    c.samples.setPad(0, pcm);
    expect(d.summary.value).toBe(padSummary(store.state.value, pcm));
    const body = d.body(c.scope);
    for (const s of [
      '.pads',
      'canvas',
      '.smp-tools',
      '.smp-chop',
      '.smp-keys',
      '[role=status]',
      '.ss',
    ]) {
      expect(body.querySelector(s)).not.toBeNull();
    }
  });
});
