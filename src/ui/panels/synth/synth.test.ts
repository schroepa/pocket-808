import { describe, expect, it } from 'vitest';
import { NOTE_NAMES, SCALES } from '../../../core/constants.ts';
import { baseState, synthDefaults } from '../../../core/defaults.ts';
import type { State } from '../../../core/types.ts';
import { must } from '../../../core/util.ts';
import { makeContext, pointer } from '../../test-utils.ts';
import { fmtTime, partName, synthSummary } from './format.ts';
import { synthHead } from './head.ts';
import { synthModules } from './modules.ts';
import { pianoRoll } from './roll.ts';

describe('format', () => {
  it('fmtTime wie Legacy', () => {
    expect(fmtTime(0.25)).toBe('250 ms');
    expect(fmtTime(1.2)).toBe('1.20 s');
  });
  it('synthSummary: Part, Tonart, Skala, Notenzahl, stumm', () => {
    const s = baseState();
    const n = s.patterns[s.cur].notes[s.part].filter(Boolean).length;
    const tonart = `${must(NOTE_NAMES[s.key], 'Tonart')} ${must(SCALES[s.scale], 'Skala').name}`;
    expect(synthSummary(s)).toBe(
      `${partName(s.part)} · ${tonart} · ${n} ${n === 1 ? 'Note' : 'Noten'}`,
    );
    const ld: State = {
      ...s,
      part: 'LD',
      key: 9,
      scale: 1,
      patterns: {
        ...s.patterns,
        [s.cur]: {
          ...s.patterns[s.cur],
          notes: {
            ...s.patterns[s.cur].notes,
            LD: Array.from({ length: 16 }, (_, i) => (i === 0 ? { d: 0, l: 1 } : null)),
          },
        },
      },
      mix: { ...s.mix, LD: { ...s.mix.LD, m: true } },
    };
    expect(synthSummary(ld)).toBe('Lead · A Dur · 1 Note · stumm');
  });
});

describe('synthHead', () => {
  it('Bass/Lead, Stumm, Tonart und Skala schreiben in den Store', () => {
    const { c, store } = makeContext();
    const el = synthHead(c);
    el.querySelectorAll<HTMLButtonElement>('[role=radio]')[1]?.click();
    expect(store.state.value.part).toBe('LD');
    const mute = el.querySelector<HTMLButtonElement>('[aria-label="Stimme stumm"]');
    mute?.click();
    expect(store.state.value.mix.LD.m).toBe(true);
    expect(mute?.getAttribute('aria-pressed')).toBe('true');
    const [key, scale] = [...el.querySelectorAll('select')];
    if (!key || !scale) throw new Error('Auswahl fehlt');
    key.value = '9';
    key.dispatchEvent(new Event('change'));
    scale.value = '4';
    scale.dispatchEvent(new Event('change'));
    expect(store.state.value.key).toBe(9);
    expect(store.state.value.scale).toBe(4);
  });
});

describe('pianoRoll', () => {
  const cell = (el: HTMLElement, d: number, col: number) =>
    el.querySelectorAll('.rr:not(.hd)')[11 - d]?.querySelectorAll<HTMLButtonElement>('.pc')[col];

  it('12 Zeilen, Grundton-Zeilen, Notennamen, Viertelschläge', () => {
    const { c, store } = makeContext();
    store.update((s) => ({ ...s, key: 0, scale: 0 }));
    const el = pianoRoll(c);
    const rows = [...el.querySelectorAll('.rr:not(.hd)')];
    expect(rows).toHaveLength(12);
    expect(rows[11]?.classList.contains('root')).toBe(true); // Stufe 0
    expect(rows[4]?.classList.contains('root')).toBe(true); // Stufe 7 (Moll: 7 Stufen)
    expect(rows[10]?.classList.contains('root')).toBe(false);
    expect(rows[11]?.querySelector('.rl')?.textContent).toBe('C');
    expect(rows[11]?.querySelector('.rl')?.getAttribute('aria-label')).toBe('Ton C anhören');
    expect(cell(el, 0, 0)?.classList.contains('q')).toBe(true);
    expect(cell(el, 0, 1)?.classList.contains('q')).toBe(false);
    store.update((s) => ({ ...s, scale: 4 })); // Moll-Pentatonik: 5 Stufen
    expect(rows[6]?.classList.contains('root')).toBe(true); // Stufe 5
    expect(cell(el, 1, 2)?.getAttribute('aria-label')).toBe('D# Step 3');
  });

  it('Note setzen hört im Stand vor; Ausklang tippt die Note weg; während der Wiedergabe still', () => {
    const { c, store, audio } = makeContext();
    store.update((s) => ({ ...s, part: 'BA', noteLen: 4 }));
    store.clearNotes();
    const el = pianoRoll(c);
    cell(el, 3, 0)?.click();
    expect(audio.auditionNote).toHaveBeenCalledWith('BA', 3, 4);
    expect(cell(el, 3, 0)?.classList.contains('on')).toBe(true);
    expect(cell(el, 3, 0)?.getAttribute('aria-pressed')).toBe('true');
    expect(cell(el, 3, 2)?.classList.contains('tail')).toBe(true);
    expect(cell(el, 3, 2)?.getAttribute('aria-pressed')).toBe('false');
    cell(el, 3, 2)?.click();
    const st = store.state.value;
    expect(st.patterns[st.cur].notes.BA[0]).toBeNull();
    expect(audio.auditionNote).toHaveBeenCalledTimes(1);
    audio.playing.value = true;
    cell(el, 5, 1)?.click();
    expect(cell(el, 5, 1)?.classList.contains('on')).toBe(true);
    expect(audio.auditionNote).toHaveBeenCalledTimes(1);
  });

  it('Label hört die Stufe vor, auch während der Wiedergabe', () => {
    const { c, audio, store } = makeContext();
    audio.playing.value = true;
    const el = pianoRoll(c);
    el.querySelectorAll<HTMLButtonElement>('.rl')[11]?.click();
    expect(audio.auditionNote).toHaveBeenCalledWith(store.state.value.part, 0, 1);
  });

  it('Takthälfte 9–16, Lauflicht nur auf der sichtbaren Hälfte', () => {
    const { c, audio } = makeContext();
    const el = pianoRoll(c);
    const pages = [...el.querySelectorAll<HTMLButtonElement>('[aria-label^="Steps"]')];
    expect(pages[0]?.getAttribute('aria-pressed')).toBe('true');
    audio.playhead.value = { step: 9, songIndex: -1 };
    expect(el.querySelectorAll('.pc.now')).toHaveLength(0);
    expect(pages[1]?.classList.contains('now')).toBe(true);
    expect(pages[0]?.classList.contains('now')).toBe(false);
    pages[1]?.click();
    expect(pages[1]?.getAttribute('aria-pressed')).toBe('true');
    expect(el.querySelector('.rr.hd')?.textContent).toBe('910111213141516');
    expect(el.querySelectorAll('.pc.now')).toHaveLength(12);
    expect(cell(el, 0, 1)?.classList.contains('now')).toBe(true);
    expect(cell(el, 0, 0)?.classList.contains('q')).toBe(true);
    audio.playhead.value = { step: -1, songIndex: -1 };
    expect(el.querySelectorAll('.pc.now')).toHaveLength(0);
    expect(pages[1]?.classList.contains('now')).toBe(false);
  });

  it('Notenlänge wählen', () => {
    const { c, store } = makeContext();
    const el = pianoRoll(c);
    const eighth = el.querySelector<HTMLButtonElement>('[aria-label="Notenlänge 1/8"]');
    eighth?.click();
    expect(store.state.value.noteLen).toBe(2);
    expect(eighth?.getAttribute('aria-pressed')).toBe('true');
  });
});

describe('synthModules', () => {
  const key = (el: Element | null | undefined, k: string) => {
    el?.dispatchEvent(new KeyboardEvent('keydown', { key: k }));
  };

  it('Regler schreiben den Patch des gewählten Parts und heben die Preset-Markierung auf', () => {
    const { c, store, audio } = makeContext();
    store.update((s) => ({ ...s, part: 'LD' }));
    const el = synthModules(c);
    key(el.querySelector('[role=slider][aria-label="Cutoff"]'), 'End');
    expect(store.state.value.synth.LD.cut).toBe(1);
    expect(store.state.value.synth.LD.preset).toBeNull();
    expect(c.readout.text.value).toBe('LEAD Cutoff 100');
    expect(store.state.value.synth.BA.cut).not.toBe(1);
    expect(audio.auditionNote).not.toHaveBeenCalled();
  });

  it('jeder Knob schreibt seinen Schlüssel', () => {
    const { c, store } = makeContext();
    const el = synthModules(c);
    const part = store.state.value.part;
    const map = {
      Detune: 'det',
      Sub: 'sub',
      Cutoff: 'cut',
      Reso: 'res',
      Env: 'env',
      Delay: 'dly',
      Level: 'lvl',
    } as const;
    for (const [label, k] of Object.entries(map)) {
      key(el.querySelector(`[role=slider][aria-label="${label}"]`), 'Home');
      expect(store.state.value.synth[part][k]).toBe(0);
    }
  });

  it('Schieberegler mit Zeitformat; Hüllkurve folgt; alle acht ADSR-Regler', () => {
    const { c, store } = makeContext();
    const el = synthModules(c);
    const part = store.state.value.part;
    const line = () => el.querySelectorAll('.env-svg')[1]?.querySelector('.el')?.getAttribute('d');
    const before = line();
    key(el.querySelector('[aria-label="Amp Release"]'), 'End');
    expect(store.state.value.synth[part].ar).toBe(1);
    expect(c.readout.text.value).toMatch(/Amp Release 1\.22 s$/);
    expect(line()).not.toBe(before);
    key(el.querySelector('[aria-label="Filter Sustain"]'), 'Home');
    expect(c.readout.text.value).toMatch(/Filter Sustain 0 %$/);
    key(el.querySelector('[aria-label="Filter Attack"]'), 'Home');
    expect(c.readout.text.value).toMatch(/Filter Attack 2 ms$/);
    key(el.querySelector('[aria-label="Amp Decay"]'), 'Home');
    expect(c.readout.text.value).toMatch(/Amp Decay 20 ms$/);
    for (const k of ['fa', 'fd', 'fs', 'fr', 'aa', 'ad', 'as', 'ar'] as const) {
      expect(typeof store.state.value.synth[part][k]).toBe('number');
    }
    expect(el.querySelectorAll('.sl-t')).toHaveLength(8);
  });

  it('Wellenform und Oktave hören vor; Oktave begrenzt, Preset bleibt bei Oktave', () => {
    const { c, store, audio } = makeContext();
    const el = synthModules(c);
    const part = store.state.value.part;
    const preset = store.state.value.synth[part].preset;
    const plus = el.querySelector<HTMLButtonElement>('[aria-label="Oktave höher"]');
    for (let i = 0; i < 4; i++) plus?.click();
    expect(store.state.value.synth[part].oct).toBe(2);
    expect(el.querySelector('.oct')?.textContent).toBe('Okt +2');
    expect(store.state.value.synth[part].preset).toBe(preset);
    expect(audio.auditionNote).toHaveBeenLastCalledWith(part, 0, 2);
    const minus = el.querySelector<HTMLButtonElement>('[aria-label="Oktave tiefer"]');
    for (let i = 0; i < 3; i++) minus?.click();
    expect(el.querySelector('.oct')?.textContent).toBe('Okt -1');
    const waves = [
      ...el.querySelectorAll<HTMLButtonElement>('[aria-label="Wellenform"] [role=radio]'),
    ];
    expect(waves.map((w) => w.textContent)).toEqual(['Saw', 'Square', 'Tri', 'Sine']);
    waves[3]?.click();
    expect(store.state.value.synth[part].wave).toBe(3);
    expect(store.state.value.synth[part].preset).toBeNull();
  });

  it('Part-Wechsel zeigt die Werte des anderen Parts', () => {
    const { c, store } = makeContext();
    store.update((s) => ({ ...s, part: 'BA' }));
    const el = synthModules(c);
    const cut = el.querySelector('[role=slider][aria-label="Cutoff"]');
    store.update((s) => ({ ...s, part: 'LD' }));
    expect(cut?.getAttribute('aria-valuenow')).toBe(
      String(Math.round(store.state.value.synth.LD.cut * 100)),
    );
  });

  it('Loslassen hört vor; Doppeltipp: Werkseinstellung des Parts (Knob und Schieberegler)', () => {
    const { c, store, audio } = makeContext();
    const el = synthModules(c);
    const part = store.state.value.part;
    const det = el.querySelector('[role=slider][aria-label="Detune"]');
    key(det, 'End');
    for (let i = 0; i < 2; i++) {
      det?.dispatchEvent(pointer('pointerdown'));
      det?.dispatchEvent(pointer('pointerup'));
    }
    expect(store.state.value.synth[part].det).toBe(synthDefaults()[part].det);
    expect(audio.auditionNote).toHaveBeenCalledWith(part, 0, 2);
    const fa = el.querySelector('[aria-label="Filter Attack"]');
    key(fa, 'End');
    for (let i = 0; i < 2; i++) {
      fa?.dispatchEvent(pointer('pointerdown'));
      fa?.dispatchEvent(pointer('pointerup'));
    }
    expect(store.state.value.synth[part].fa).toBe(synthDefaults()[part].fa);
  });
});
