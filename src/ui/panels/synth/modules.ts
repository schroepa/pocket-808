import { ARP_LABELS, ARP_MODES, lfoHz, setArp, setLfo } from '../../../core/arp.ts';
import { WAVES } from '../../../core/constants.ts';
import { synthDefaults } from '../../../core/defaults.ts';
import { attackTime, decayTime, releaseTime } from '../../../core/envelope.ts';
import { setPartFx, setSynthValue, setWave, shiftOctave } from '../../../core/synth.ts';
import type { ArpMode, PartFxKey, SynthKey } from '../../../core/types.ts';
import { computed, signal } from '../../../store/signals.ts';
import type { UiContext } from '../../context.ts';
import { chip } from '../../controls/chip.ts';
import { envelopeView } from '../../controls/envelope.ts';
import { knob } from '../../controls/knob.ts';
import { segment } from '../../controls/segment.ts';
import { slider } from '../../controls/slider.ts';
import { bind, h } from '../../dom.ts';
import { fmtTime, partName } from './format.ts';
import '../../controls/octave.css';
import './modules.css';

const DEFAULTS = synthDefaults();
const pct = (v: number): string => `${Math.round(v * 100)} %`;
/** ADSR-Stufen: Schlüssel-Endung, Kurzname, Langname, Anzeige */
const ADSR = [
  ['a', 'A', 'Attack', (v: number) => fmtTime(attackTime(v))],
  ['d', 'D', 'Decay', (v: number) => fmtTime(decayTime(v))],
  ['s', 'S', 'Sustain', pct],
  ['r', 'R', 'Release', (v: number) => fmtTime(releaseTime(v))],
] as const;

/** Was alle Module brauchen: Patch des gewählten Parts, Vorhören und die Regler darauf */
function patchKit(c: UiContext) {
  const { store, scope, audio, readout } = c;
  const part = store.select((s) => s.part);
  const patch = store.select((s) => s.synth[s.part]);
  const tag = (): string => partName(part.peek()).toUpperCase();
  const hear = (): void => {
    audio.auditionNote(part.peek(), 0, 2);
  };
  const value = (k: SynthKey) => computed(() => patch.value[k]);
  const write = (k: SynthKey) => (v: number) => {
    store.update((s) => setSynthValue(s, s.part, k, v));
  };
  const def = (k: SynthKey) => () => DEFAULTS[part.peek()][k];
  const kn = (k: SynthKey, label: string) =>
    knob(scope, {
      label,
      value: value(k),
      write: write(k),
      def: def(k),
      format: (v) => String(Math.round(v * 100)),
      readout,
      tag,
      onEnd: hear,
    });
  return { patch, tag, hear, value, write, def, kn };
}
type PatchKit = ReturnType<typeof patchKit>;

/** ein Modul über die volle Breite: Überschrift und Inhalt */
const module = (title: string, children: readonly HTMLElement[]): HTMLElement =>
  h('div', { class: 'shm w2' }, [h('h4', { text: title }), ...children]);
const knobRow = (knobs: readonly HTMLElement[]): HTMLElement => h('div', { class: 'shk' }, knobs);

function oscModule(c: UiContext, k: PatchKit): HTMLElement {
  const { store, scope } = c;
  const { patch, hear, kn } = k;
  const oct = h('span', { class: 'oct' });
  bind(
    scope,
    () => patch.value.oct,
    (o) => {
      oct.textContent = `Okt ${o > 0 ? '+' : ''}${o}`;
    },
  );
  const shift = (d: number) => () => {
    store.update((s) => shiftOctave(s, s.part, d));
    hear();
  };
  return module('Oszillator', [
    h('div', { class: 'syn-row mid' }, [
      segment(scope, {
        label: 'Wellenform',
        options: WAVES.map(([name], i) => ({ value: String(i), label: name })),
        value: computed(() => String(patch.value.wave)),
        write: (w) => {
          store.update((s) => setWave(s, s.part, Number(w)));
          hear();
        },
      }),
      h('div', { class: 'oct-grp' }, [
        chip(scope, { label: '−', ariaLabel: 'Oktave tiefer', onClick: shift(-1) }),
        oct,
        chip(scope, { label: '+', ariaLabel: 'Oktave höher', onClick: shift(1) }),
      ]),
    ]),
    knobRow([kn('det', 'Detune'), kn('sub', 'Sub')]),
  ]);
}

const filterModule = (k: PatchKit): HTMLElement =>
  module('Filter', [knobRow([k.kn('cut', 'Cutoff'), k.kn('res', 'Reso'), k.kn('env', 'Env')])]);

const outModule = (k: PatchKit): HTMLElement =>
  module('Out', [knobRow([k.kn('dly', 'Delay'), k.kn('lvl', 'Level')])]);

/** Hüllkurve mit Anzeige und vier Schiebereglern */
function envModule(c: UiContext, k: PatchKit, pre: 'f' | 'a', name: string): HTMLElement {
  const { scope, readout } = c;
  const { patch, tag, hear, value, write, def } = k;
  const view = envelopeView(
    scope,
    computed(() => {
      const p = patch.value;
      return pre === 'f'
        ? ([attackTime(p.fa), decayTime(p.fd), p.fs, releaseTime(p.fr)] as const)
        : ([attackTime(p.aa), decayTime(p.ad), p.as, releaseTime(p.ar)] as const);
    }),
  );
  const sliders = ADSR.map(([end, label, full, format]) => {
    const key = `${pre}${end}` as SynthKey;
    return slider(scope, {
      label,
      aria: `${name} ${full}`,
      value: value(key),
      write: write(key),
      def: def(key),
      format,
      readout,
      tag,
      onEnd: hear,
    });
  });
  return h('div', { class: 'shm env' }, [
    h('h4', { text: `${name}-Env` }),
    view,
    h('div', { class: 'shs' }, sliders),
  ]);
}

function fxModule(c: UiContext, k: PatchKit): HTMLElement {
  const { store, scope, readout } = c;
  const { patch, tag, hear } = k;
  const fxKnob = (k: PartFxKey, label: string) =>
    knob(scope, {
      label,
      value: computed(() => patch.value[k] ?? 0),
      write: (v) => {
        store.update((s) => setPartFx(s, s.part, k, v));
      },
      def: () => 0,
      format: pct,
      readout,
      tag,
      onEnd: hear,
    });
  return module('Effekt', [knobRow([fxKnob('drive', 'Drive'), fxKnob('chorus', 'Chorus')])]);
}

function arpModule(c: UiContext, k: PatchKit): HTMLElement {
  const { store, scope } = c;
  const { patch } = k;
  // Arp: Rate und Oktaven lassen sich auch im Aus vorwählen (gelten beim Einschalten)
  const arpPick = signal<{ r: 1 | 2; o: 1 | 2 }>({ r: 1, o: 1 });
  const arpNow = computed(() => patch.value.arp ?? { m: 'off' as const, ...arpPick.value });
  const writeArp = (next: { m: ArpMode | 'off'; r: 1 | 2; o: 1 | 2 }): void => {
    arpPick.value = { r: next.r, o: next.o };
    const { m, r, o } = next;
    store.update((s) => setArp(s, s.part, m === 'off' ? undefined : { m, r, o }));
  };
  const arpSeg = <T extends string>(
    label: string,
    options: readonly { value: T; label: string }[],
    read: (a: { m: string; r: number; o: number }) => T,
    apply: (v: T) => { m: ArpMode | 'off'; r: 1 | 2; o: 1 | 2 },
  ) =>
    segment(scope, {
      label,
      options,
      value: computed(() => read(arpNow.value)),
      write: (v) => {
        writeArp(apply(v));
      },
    });
  return module('Arp', [
    arpSeg(
      'Arp',
      [
        { value: 'off', label: 'Aus' },
        ...ARP_MODES.map((m) => ({ value: m, label: ARP_LABELS[m] })),
      ],
      (a) => a.m as ArpMode | 'off',
      (m) => ({ ...arpNow.peek(), m }),
    ),
    h('div', { class: 'syn-row' }, [
      arpSeg(
        'Arp-Rate',
        [
          { value: '1', label: '1/16' },
          { value: '2', label: '1/32' },
        ],
        (a) => String(a.r) as '1' | '2',
        (r) => ({ ...arpNow.peek(), r: r === '2' ? 2 : 1 }),
      ),
      arpSeg(
        'Arp-Oktaven',
        [
          { value: '1', label: '1 Okt' },
          { value: '2', label: '2 Okt' },
        ],
        (a) => String(a.o) as '1' | '2',
        (o) => ({ ...arpNow.peek(), o: o === '2' ? 2 : 1 }),
      ),
    ]),
  ]);
}

function lfoModule(c: UiContext, k: PatchKit): HTMLElement {
  const { store, scope, readout } = c;
  const { patch, tag } = k;
  const lfo = computed(() => patch.value.lfo ?? { r: 0.5, d: 0, t: 'cut' as const });
  const lfoKnob = (k: 'r' | 'd', label: string, format: (v: number) => string, d: number) =>
    knob(scope, {
      label,
      value: computed(() => lfo.value[k]),
      write: (v) => {
        store.update((s) => setLfo(s, s.part, { [k]: v }));
      },
      def: () => d,
      format,
      readout,
      tag,
    });
  return module('LFO', [
    knobRow([
      lfoKnob('r', 'Rate', (v) => `${lfoHz(v).toFixed(2)} Hz`, 0.5),
      lfoKnob('d', 'Depth', (v) => String(Math.round(v * 100)), 0),
    ]),
    segment(scope, {
      label: 'LFO-Ziel',
      options: [
        { value: 'cut', label: 'Cutoff' },
        { value: 'pit', label: 'Pitch' },
      ],
      value: computed(() => lfo.value.t),
      write: (t) => {
        store.update((s) => setLfo(s, s.part, { t }));
      },
    }),
  ]);
}

/** Die SH-101-Module des gewählten Parts, dazu Effekt, Arp und LFO (Legacy buildSynth, Abschnitt „Sound“). */
export function synthModules(c: UiContext): HTMLElement {
  const k = patchKit(c);
  return h('div', { class: 'sh' }, [
    oscModule(c, k),
    filterModule(k),
    envModule(c, k, 'f', 'Filter'),
    envModule(c, k, 'a', 'Amp'),
    outModule(k),
    fxModule(c, k),
    arpModule(c, k),
    lfoModule(c, k),
  ]);
}

/* Die Seiten des Geräts: dieselben Module, auf Reiter verteilt */
const page = (modules: readonly HTMLElement[]): HTMLElement =>
  h('div', { class: 'synth-page' }, [h('div', { class: 'sh' }, modules)]);

export function synthSoundPage(c: UiContext): HTMLElement {
  const k = patchKit(c);
  return page([oscModule(c, k), fxModule(c, k), outModule(k)]);
}

export function synthFilterPage(c: UiContext): HTMLElement {
  const k = patchKit(c);
  return page([filterModule(k), envModule(c, k, 'f', 'Filter')]);
}

export function synthAmpPage(c: UiContext): HTMLElement {
  return page([envModule(c, patchKit(c), 'a', 'Amp')]);
}

export function synthMotionPage(c: UiContext): HTMLElement {
  const k = patchKit(c);
  return page([lfoModule(c, k), arpModule(c, k)]);
}
