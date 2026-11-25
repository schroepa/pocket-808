import { describe, expect, it, vi } from 'vitest';
import { SYN_PRESETS } from '../../../core/constants.ts';
import { SYNTH_SOUNDS } from '../../../core/templates/index.ts';
import { applySynthPreset } from '../../../core/synth.ts';
import { synthDefaults } from '../../../core/defaults.ts';
import { must } from '../../../core/util.ts';
import { signal } from '../../../store/signals.ts';
import { show } from '../../controls/visible.ts';
import type { RollTool } from '../../nav.ts';
import { makeContext, pointer } from '../../test-utils.ts';
import { h } from '../../dom.ts';
import type { UiContext } from '../../context.ts';
import { fmtTime } from './format.ts';
import { synthAmpPage, synthFilterPage, synthMotionPage, synthSoundPage } from './modules.ts';
import { clearVoiceChip, synthSoundList } from './presets.ts';
import { rollControls, rollGrid, synthNotesPage } from './roll.ts';

/** Bedienung und Raster der Rolle mit gemeinsamem Zustand, wie im Gerät */
function pianoRoll(c: UiContext): HTMLElement {
  const roll = { page: signal(0), tool: signal<RollTool>('note') };
  return h('div', {}, [rollControls(c, roll), rollGrid(c, roll)]);
}
/** alle Klang-Seiten zusammen: jedes Modul genau einmal */
const synthModules = (c: UiContext): HTMLElement =>
  h('div', {}, [synthSoundPage(c), synthFilterPage(c), synthAmpPage(c), synthMotionPage(c)]);

describe('format', () => {
  it('fmtTime wie Legacy', () => {
    expect(fmtTime(0.25)).toBe('250 ms');
    expect(fmtTime(1.2)).toBe('1.20 s');
  });
});

describe('Tonart und Skala', () => {
  it('schreiben in den Store (Seite Noten)', () => {
    const { c, store } = makeContext();
    const el = synthNotesPage(c, { page: signal(0), tool: signal<RollTool>('note') });
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

  it('andere Stufe im Ausklang setzt eine neue Note und kürzt die alte', () => {
    const { c, store } = makeContext();
    store.update((s) => ({ ...s, part: 'BA', noteLen: 4 }));
    store.clearNotes();
    const el = pianoRoll(c);
    cell(el, 3, 0)?.click();
    cell(el, 5, 2)?.click();
    expect(cell(el, 3, 1)?.classList.contains('tail')).toBe(true);
    expect(cell(el, 3, 2)?.classList.contains('tail')).toBe(false);
    expect(cell(el, 5, 2)?.classList.contains('on')).toBe(true);
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

  it('Werkzeug Akzent und Slide schalten die Note unter dem Tipp um, leere Zellen bleiben leer', () => {
    const { c, store, audio } = makeContext();
    store.update((s) => ({ ...s, part: 'BA', noteLen: 2 }));
    store.clearNotes();
    const el = pianoRoll(c);
    const tool = (n: string) => el.querySelector<HTMLButtonElement>(`[aria-label="Werkzeug ${n}"]`);
    expect(tool('Note')?.getAttribute('aria-pressed')).toBe('true');
    cell(el, 3, 0)?.click();
    tool('Akzent')?.click();
    expect(tool('Akzent')?.getAttribute('aria-pressed')).toBe('true');
    cell(el, 3, 1)?.click(); // Ausklang zählt zur Note
    const note = () => store.state.value.patterns[store.state.value.cur].notes.BA[0];
    expect(note()).toEqual({ d: 3, l: 2, a: true });
    expect(cell(el, 3, 0)?.classList.contains('acc')).toBe(true);
    cell(el, 5, 4)?.click(); // leer: nichts
    expect(store.state.value.patterns[store.state.value.cur].notes.BA[4]).toBeNull();
    tool('Slide')?.click();
    cell(el, 3, 0)?.click();
    expect(note()).toEqual({ d: 3, l: 2, a: true, s: true });
    expect(cell(el, 3, 0)?.classList.contains('sl')).toBe(true);
    cell(el, 3, 0)?.click();
    expect(note()).toEqual({ d: 3, l: 2, a: true });
    expect(cell(el, 3, 0)?.classList.contains('sl')).toBe(false);
    // Akzent hört im Stand mit Attributen vor, Slide nicht (braucht eine Vorgängerin)
    expect(audio.auditionNote).toHaveBeenCalledTimes(2);
    expect(audio.auditionNote).toHaveBeenLastCalledWith('BA', 3, 2, { d: 3, l: 2, a: true });
  });

  it('Werkzeug Akkord schaltet weiter, zeigt das Kürzel und meldet im LCD', () => {
    const { c, store, audio } = makeContext();
    store.update((s) => ({ ...s, part: 'BA', noteLen: 1 }));
    store.clearNotes();
    const el = pianoRoll(c);
    cell(el, 2, 1)?.click();
    el.querySelector<HTMLButtonElement>('[aria-label="Werkzeug Akkord"]')?.click();
    const marks: string[] = [];
    const flashes: string[] = [];
    for (let i = 0; i < 5; i++) {
      cell(el, 2, 1)?.click();
      marks.push(cell(el, 2, 1)?.textContent ?? '');
      flashes.push(c.readout.text.value);
    }
    expect(marks).toEqual(['3', '4', '5', '8', '']);
    expect(flashes).toEqual(['Dreiklang', 'Vierklang', 'Quinte', 'Oktave', 'Kein Akkord']);
    expect(audio.auditionNote).toHaveBeenCalledWith('BA', 2, 1, { d: 2, l: 1, ch: 'tri' });
    expect(cell(el, 2, 1)?.getAttribute('aria-label')).toMatch(/Step 2$/);
    audio.playing.value = true;
    const calls = vi.mocked(audio.auditionNote).mock.calls.length;
    cell(el, 2, 1)?.click();
    expect(audio.auditionNote).toHaveBeenCalledTimes(calls); // während der Wiedergabe still
    expect(cell(el, 2, 1)?.getAttribute('aria-label')).toMatch(/Step 2 · Dreiklang$/);
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

describe('Arp und LFO', () => {
  const radio = (el: HTMLElement, group: string, label: string) =>
    [...el.querySelectorAll<HTMLButtonElement>(`[aria-label="${group}"] [role=radio]`)].find(
      (b) => b.textContent === label,
    );
  const key = (el: Element | null | undefined, k: string) => {
    el?.dispatchEvent(new KeyboardEvent('keydown', { key: k }));
  };

  it('Arp: Modus schaltet ein und aus, Rate und Oktaven gelten (auch vorgewählt im Aus)', () => {
    const { c, store } = makeContext();
    store.update((s) => ({ ...s, part: 'BA' }));
    const el = synthModules(c);
    expect(radio(el, 'Arp', 'Aus')?.getAttribute('aria-checked')).toBe('true');
    radio(el, 'Arp-Rate', '1/32')?.click(); // im Aus vorgewählt, noch kein Feld
    expect('arp' in store.state.value.synth.BA).toBe(false);
    radio(el, 'Arp', 'Auf-Ab')?.click();
    expect(store.state.value.synth.BA.arp).toEqual({ m: 'ud', r: 2, o: 1 });
    radio(el, 'Arp-Oktaven', '2 Okt')?.click();
    expect(store.state.value.synth.BA.arp).toEqual({ m: 'ud', r: 2, o: 2 });
    expect(radio(el, 'Arp-Oktaven', '2 Okt')?.getAttribute('aria-checked')).toBe('true');
    radio(el, 'Arp-Rate', '1/16')?.click();
    radio(el, 'Arp-Oktaven', '1 Okt')?.click();
    expect(store.state.value.synth.BA.arp).toEqual({ m: 'ud', r: 1, o: 1 });
    radio(el, 'Arp-Rate', '1/32')?.click();
    radio(el, 'Arp', 'Aus')?.click();
    expect('arp' in store.state.value.synth.BA).toBe(false);
    expect(radio(el, 'Arp-Rate', '1/32')?.getAttribute('aria-checked')).toBe('true');
  });

  it('LFO: Depth und Rate als Knobs mit LCD in Hz, Ziel als Segment, Part-Wechsel zeigt den anderen', () => {
    const { c, store } = makeContext();
    store.update((s) => ({ ...s, part: 'LD' }));
    const el = synthModules(c);
    const depth = el.querySelector('[role=slider][aria-label="Depth"]');
    const rate = el.querySelector('[role=slider][aria-label="Rate"]');
    expect(depth?.getAttribute('aria-valuenow')).toBe('0');
    key(depth, 'End');
    expect(store.state.value.synth.LD.lfo).toEqual({ r: 0.5, d: 1, t: 'cut' });
    key(rate, 'Home');
    expect(store.state.value.synth.LD.lfo?.r).toBe(0);
    expect(c.readout.text.value).toBe('LEAD Rate 0.10 Hz');
    radio(el, 'LFO-Ziel', 'Pitch')?.click();
    expect(store.state.value.synth.LD.lfo?.t).toBe('pit');
    store.update((s) => ({ ...s, part: 'BA' }));
    expect(depth?.getAttribute('aria-valuenow')).toBe('0');
    expect(radio(el, 'LFO-Ziel', 'Cutoff')?.getAttribute('aria-checked')).toBe('true');
  });

  it('Doppeltipp: Depth auf 0 (aus), Rate auf 0,5', () => {
    const { c, store } = makeContext();
    const el = synthModules(c);
    const part = store.state.value.part;
    for (const [label, end, def] of [
      ['Depth', 'End', 0],
      ['Rate', 'Home', 0.5],
    ] as const) {
      const k = el.querySelector(`[role=slider][aria-label="${label}"]`);
      key(k, end);
      for (let i = 0; i < 2; i++) {
        k?.dispatchEvent(pointer('pointerdown'));
        k?.dispatchEvent(pointer('pointerup'));
      }
      expect(store.state.value.synth[part].lfo?.[label === 'Depth' ? 'd' : 'r']).toBe(def);
    }
  });
});

describe('Effekt: Drive und Chorus', () => {
  const slider = (el: Element, label: string) =>
    must(el.querySelector(`[role=slider][aria-label="${label}"]`) ?? undefined, label);
  const key = (el: Element, k: string) => {
    el.dispatchEvent(new KeyboardEvent('keydown', { key: k }));
  };

  it('schreiben den gewählten Part, zeigen Prozent, heben das Preset auf und hören vor', () => {
    const { c, store, audio } = makeContext();
    store.update((s) => ({ ...s, part: 'LD' }));
    const el = synthModules(c);
    key(slider(el, 'Chorus'), 'End');
    expect(store.state.value.synth.LD.chorus).toBe(1);
    expect(store.state.value.synth.LD.preset).toBeNull();
    expect(c.readout.text.value).toBe('LEAD Chorus 100 %');
    key(slider(el, 'Drive'), 'End');
    expect(store.state.value.synth.LD.drive).toBe(1);
    expect('drive' in store.state.value.synth.BA).toBe(false);
    expect(audio.auditionNote).not.toHaveBeenCalled();
    for (let i = 0; i < 2; i++)
      for (const type of ['pointerdown', 'pointerup'])
        slider(el, 'Drive').dispatchEvent(pointer(type));
    expect(audio.auditionNote).toHaveBeenCalledWith('LD', 0, 2);
  });

  it('Doppeltipp schaltet aus; Preset und Part-Wechsel bewegen die Knobs', () => {
    const { c, store } = makeContext();
    store.update((s) => ({ ...s, part: 'BA' }));
    const el = synthModules(c);
    const drive = slider(el, 'Drive');
    key(drive, 'End');
    for (let i = 0; i < 2; i++) {
      drive.dispatchEvent(pointer('pointerdown'));
      drive.dispatchEvent(pointer('pointerup'));
    }
    expect('drive' in store.state.value.synth.BA).toBe(false);
    const reese = must(
      SYNTH_SOUNDS.BA.find((p) => p.name === 'Reese'),
      'Reese',
    );
    store.update((s) => applySynthPreset(s, 'BA', reese));
    expect(drive.getAttribute('aria-valuenow')).toBe('30');
    expect(slider(el, 'Chorus').getAttribute('aria-valuenow')).toBe('45');
    store.update((s) => ({ ...s, part: 'LD' }));
    expect(drive.getAttribute('aria-valuenow')).toBe('0');
  });
});

describe('Synth-Sounds und Stimme leeren', () => {
  it('zeigt die Presets des Parts, lädt und markiert; Wechsel des Parts baut neu', () => {
    const { c, store, audio } = makeContext();
    store.update((s) => ({ ...s, part: 'BA' }));
    const el = synthSoundList(c);
    const chips = () => [...el.querySelectorAll<HTMLButtonElement>('.chip')];
    expect(chips().map((b) => b.textContent)).toEqual(SYNTH_SOUNDS.BA.map((p) => p.name));
    expect(chips().length).toBeGreaterThan(SYN_PRESETS.BA.length);
    chips()[0]?.click();
    expect(store.state.value.synth.BA.preset).toBe(SYN_PRESETS.BA[0]?.name);
    expect(chips()[0]?.getAttribute('aria-pressed')).toBe('true');
    expect(audio.auditionNote).toHaveBeenCalledWith('BA', 0, 2);
    store.update((s) => ({ ...s, part: 'LD' }));
    expect(chips().map((b) => b.textContent)).toEqual(SYNTH_SOUNDS.LD.map((p) => p.name));
    c.scope.dispose();
  });

  it('„Stimme leeren“ leert die Noten des Parts mit Zurück', () => {
    const { c, store } = makeContext();
    store.placeNote(0, 0);
    const el = clearVoiceChip(c);
    // kurz sichtbar wie „Leeren“ auf Trig, der Name nennt, was geleert wird
    expect(el.textContent).toBe('Leeren');
    expect(el.getAttribute('aria-label')).toBe('Stimme leeren');
    (el as HTMLButtonElement).click();
    const s = store.state.value;
    expect(s.patterns[s.cur].notes[s.part].every((n) => n === null)).toBe(true);
    expect(store.canUndo.value).toBe(true);
  });
});

const rollState = () => ({ page: signal(0), tool: signal<RollTool>('note') });
const labels = (el: Element, selector: string) =>
  [...el.querySelectorAll(selector)].map((e) => e.getAttribute('aria-label'));
const ADSR = ['Attack', 'Decay', 'Sustain', 'Release'];

describe('Synth-Seiten', () => {
  it('jede Synth-Seite hat genau ihre Regler', () => {
    const { c } = makeContext();
    const pages = [
      {
        el: synthSoundPage(c),
        sliders: ['Detune', 'Sub', 'Drive', 'Chorus', 'Delay', 'Level'],
        groups: ['Wellenform'],
        buttons: ['Oktave tiefer', 'Oktave höher'],
      },
      {
        el: synthFilterPage(c),
        sliders: ['Cutoff', 'Reso', 'Env', ...ADSR.map((n) => `Filter ${n}`)],
        groups: [],
        buttons: [],
      },
      { el: synthAmpPage(c), sliders: ADSR.map((n) => `Amp ${n}`), groups: [], buttons: [] },
      {
        el: synthMotionPage(c),
        sliders: ['Rate', 'Depth'],
        groups: ['LFO-Ziel', 'Arp', 'Arp-Rate', 'Arp-Oktaven'],
        buttons: [],
      },
    ];
    for (const page of pages) {
      expect(labels(page.el, '[role=slider]')).toEqual(page.sliders);
      expect(labels(page.el, '[role=radiogroup]')).toEqual(page.groups);
      expect(labels(page.el, 'button[aria-label]')).toEqual(page.buttons);
    }
    expect(pages.map((p) => p.el.querySelectorAll('.env-svg').length)).toEqual([0, 1, 1, 0]);
  });

  it('Regler einer Seite schreiben den gewählten Part', () => {
    const { c, store } = makeContext();
    store.update((s) => ({ ...s, part: 'LD' }));
    const el = synthAmpPage(c);
    el.querySelector('[aria-label="Amp Release"]')?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'End' }),
    );
    expect(store.state.value.synth.LD.ar).toBe(1);
  });

  it('Arp-Rate bleibt vorgewählt, nachdem die Seite ausgeblendet war', () => {
    const { c, store } = makeContext();
    const el = synthMotionPage(c);
    const radio = (group: string, label: string) =>
      [...el.querySelectorAll<HTMLButtonElement>(`[aria-label="${group}"] [role=radio]`)].find(
        (b) => b.textContent === label,
      );
    radio('Arp-Rate', '1/32')?.click();
    show(el, false);
    store.update((s) => ({ ...s, part: s.part === 'BA' ? 'LD' : 'BA' }));
    show(el, true);
    expect(radio('Arp-Rate', '1/32')?.getAttribute('aria-checked')).toBe('true');
    radio('Arp', 'Auf')?.click();
    const s = store.state.value;
    expect(s.synth[s.part].arp?.r).toBe(2);
  });

  it('rollControls und rollGrid teilen Takthälfte und Werkzeug', () => {
    const { c, store } = makeContext();
    store.update((s) => ({ ...s, part: 'BA', noteLen: 1 }));
    store.clearNotes();
    const roll = rollState();
    const controls = rollControls(c, roll);
    const grid = rollGrid(c, roll);
    const button = (label: string) =>
      must(
        controls.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`) ?? undefined,
        label,
      );
    const cell = () =>
      must(grid.querySelector<HTMLButtonElement>('.rr:not(.hd) .pc') ?? undefined, 'Zelle');
    expect(controls.querySelector('.pc')).toBeNull();
    expect(grid.querySelector('.chip')).toBeNull();
    button('Steps 9–16').click();
    expect(roll.page.value).toBe(1);
    expect(grid.querySelector('.rr.hd')?.textContent).toBe('910111213141516');
    cell().click();
    const note = () => store.state.value.patterns[store.state.value.cur].notes.BA[8];
    expect(note()).toEqual({ d: 11, l: 1 });
    button('Werkzeug Akzent').click();
    expect(roll.tool.value).toBe('a');
    cell().click();
    expect(note()).toEqual({ d: 11, l: 1, a: true });
    // von außen gesetzt (Nav.openNotes): beide folgen
    roll.page.value = 0;
    roll.tool.value = 'note';
    expect(button('Steps 1–8').getAttribute('aria-pressed')).toBe('true');
    expect(button('Werkzeug Note').getAttribute('aria-pressed')).toBe('true');
    expect(grid.querySelector('.rr.hd')?.textContent).toBe('12345678');
  });

  it('synthNotesPage: Tonart, Skala, Bedienung, „Stimme leeren“ und leerer Platz für die Rolle', () => {
    const { c, store } = makeContext();
    store.placeNote(0, 0);
    const roll = rollState();
    const el = synthNotesPage(c, roll);
    expect([...el.querySelectorAll('.fld span')].map((e) => e.textContent)).toEqual([
      'Tonart',
      'Skala',
    ]);
    expect(labels(el, '[role=group]')).toEqual(['Takthälfte', 'Notenlänge', 'Werkzeug']);
    expect(el.querySelector('[role=radiogroup]')).toBeNull();
    el.querySelector<HTMLButtonElement>('[aria-label="Steps 9–16"]')?.click();
    expect(roll.page.value).toBe(1);
    const slot = must(el.querySelector('[data-slot=roll]') ?? undefined, 'Platz');
    expect(slot.childNodes).toHaveLength(0);
    expect(el.querySelector('.pc')).toBeNull();
    [...el.querySelectorAll<HTMLButtonElement>('.chip')]
      .find((b) => b.getAttribute('aria-label') === 'Stimme leeren')
      ?.click();
    const s = store.state.value;
    expect(s.patterns[s.cur].notes[s.part].every((n) => n === null)).toBe(true);
  });

  it('synthSoundList: nur die Presets des Parts, ohne „Stimme leeren“', () => {
    const { c, store } = makeContext();
    store.update((s) => ({ ...s, part: 'LD' }));
    const el = synthSoundList(c);
    expect(el.getAttribute('aria-label')).toBe('Presets');
    expect([...el.querySelectorAll('button')].map((b) => b.textContent)).toEqual(
      SYNTH_SOUNDS.LD.map((p) => p.name),
    );
    c.scope.dispose();
  });
});
