import { WAVES } from '../../../core/constants.ts';
import { synthDefaults } from '../../../core/defaults.ts';
import { attackTime, decayTime, releaseTime } from '../../../core/envelope.ts';
import { setSynthValue, setWave, shiftOctave } from '../../../core/synth.ts';
import type { SynthKey } from '../../../core/types.ts';
import { computed } from '../../../store/signals.ts';
import type { UiContext } from '../../context.ts';
import { chip } from '../../controls/chip.ts';
import { envelopeView } from '../../controls/envelope.ts';
import { knob } from '../../controls/knob.ts';
import { segment } from '../../controls/segment.ts';
import { slider } from '../../controls/slider.ts';
import { bind, h } from '../../dom.ts';
import { fmtTime, partName } from './format.ts';
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

/** Die fünf SH-101-Module des gewählten Parts (Legacy buildSynth, Abschnitt „Sound“). */
export function synthModules(c: UiContext): HTMLElement {
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
  const env = (pre: 'f' | 'a', name: string) => {
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
      const k = `${pre}${end}` as SynthKey;
      return slider(scope, {
        label,
        aria: `${name} ${full}`,
        value: value(k),
        write: write(k),
        def: def(k),
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
  };
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
  return h('div', { class: 'sh' }, [
    h('div', { class: 'shm w2' }, [
      h('h4', { text: 'Oszillator' }),
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
      h('div', { class: 'shk' }, [kn('det', 'Detune'), kn('sub', 'Sub')]),
    ]),
    h('div', { class: 'shm w2' }, [
      h('h4', { text: 'Filter' }),
      h('div', { class: 'shk' }, [kn('cut', 'Cutoff'), kn('res', 'Reso'), kn('env', 'Env')]),
    ]),
    env('f', 'Filter'),
    env('a', 'Amp'),
    h('div', { class: 'shm w2' }, [
      h('h4', { text: 'Out' }),
      h('div', { class: 'shk' }, [kn('dly', 'Delay'), kn('lvl', 'Level')]),
    ]),
  ]);
}
