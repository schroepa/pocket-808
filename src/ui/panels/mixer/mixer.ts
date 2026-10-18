import { CHANNEL_NAMES, CHANNELS } from '../../../core/constants.ts';
import { mixDefaults } from '../../../core/defaults.ts';
import { setChannelValue, toggleSolo } from '../../../core/mixer.ts';
import { SCENE_COUNT } from '../../../core/scenes.ts';
import { toggleMute } from '../../../core/synth.ts';
import type { ChannelId } from '../../../core/types.ts';
import { computed, signal } from '../../../store/signals.ts';
import type { UiContext } from '../../context.ts';
import { chip } from '../../controls/chip.ts';
import { knob } from '../../controls/knob.ts';
import { bind, h, listen } from '../../dom.ts';
import { panText } from './format.ts';
import './mixer.css';

const SHORT: Readonly<Partial<Record<ChannelId, string>>> = { BA: 'Bass', LD: 'Lead', SM: 'Smp' };
const DEFAULTS = mixDefaults();

/** 13 Kanalzüge mit M, S, Fader; Pan und Reverb des gewählten Kanals (Legacy buildMixFx) */
export function mixerPanel(c: UiContext): HTMLElement {
  const { store, scope, readout } = c;
  const selected = signal<ChannelId>('BD');
  const select = (id: ChannelId): void => {
    selected.value = id;
  };
  const toggle = (id: ChannelId, label: string, cls: string, fn: () => void, on: () => boolean) => {
    const b = h('button', {
      class: `mb ${cls}`,
      text: cls === 'm' ? 'M' : 'S',
      attrs: { type: 'button', 'aria-label': label },
      on: { click: fn },
    });
    bind(scope, on, (v) => {
      b.classList.toggle('on', v);
      b.setAttribute('aria-pressed', String(v));
    });
    return b;
  };
  const rows = CHANNELS.map((id) => {
    const full = CHANNEL_NAMES[id];
    const name = h('button', {
      class: 'nm',
      text: SHORT[id] ?? id,
      attrs: { type: 'button', 'aria-label': `Kanal ${full} wählen` },
      on: {
        click: () => {
          select(id);
        },
      },
    });
    const fader = h('input', {
      class: 'fd',
      attrs: { type: 'range', min: '0', max: '100', step: '1', 'aria-label': `Lautstärke ${full}` },
    });
    bind(
      scope,
      () => String(Math.round(store.state.value.mix[id].v * 100)),
      (v) => {
        fader.value = v;
      },
    );
    listen(scope, fader, 'pointerdown', () => {
      select(id);
    });
    listen(scope, fader, 'input', () => {
      store.update((s) => setChannelValue(s, id, 'v', Number(fader.value) / 100));
      readout.flash(`${full} Fader ${fader.value}`);
    });
    listen(scope, fader, 'dblclick', () => {
      store.update((s) => setChannelValue(s, id, 'v', 0.8));
    });
    const row = h('div', { class: 'mx' }, [
      name,
      toggle(
        id,
        `${full} stumm`,
        'm',
        () => {
          store.update((s) => toggleMute(s, id));
        },
        () => store.state.value.mix[id].m,
      ),
      toggle(
        id,
        `${full} solo`,
        's',
        () => {
          store.update((s) => toggleSolo(s, id));
        },
        () => store.state.value.mix[id].s,
      ),
      fader,
    ]);
    bind(
      scope,
      () => selected.value === id,
      (on) => {
        row.classList.toggle('sel', on);
      },
    );
    return row;
  });
  const label = h('div', { class: 'cap-label mix-sel' });
  bind(
    scope,
    () => `Kanal: ${CHANNEL_NAMES[selected.value]}`,
    (t) => {
      label.textContent = t;
    },
  );
  const tag = (): string => CHANNEL_NAMES[selected.peek()].toUpperCase();
  const channel = computed(() => store.state.value.mix[selected.value]);
  return h('div', { class: 'mixer-body' }, [
    h('div', { class: 'mix' }, rows),
    label,
    h('div', { class: 'knob-grid k2' }, [
      knob(scope, {
        label: 'Pan',
        value: computed(() => channel.value.p),
        write: (v) => {
          const id = selected.peek();
          store.update((s) => setChannelValue(s, id, 'p', v));
        },
        def: () => 0.5,
        snap: 0.5,
        format: panText,
        readout,
        tag,
      }),
      knob(scope, {
        label: 'Reverb',
        value: computed(() => channel.value.r),
        write: (v) => {
          const id = selected.peek();
          store.update((s) => setChannelValue(s, id, 'r', v));
        },
        def: () => DEFAULTS[selected.peek()].r,
        format: (v) => `${Math.round(v * 100)}%`,
        readout,
        tag,
      }),
    ]),
    sceneRow(c),
  ]);
}

/** Szenen wie beim OP-XY: Tipp auf leer sichert, auf belegt ruft ab; „Sichern“ überschreibt einmal */
function sceneRow(c: UiContext): HTMLElement {
  const { store, scope, readout } = c;
  const saving = signal(false);
  const last = signal(-1);
  const buttons = Array.from({ length: SCENE_COUNT }, (_, i) =>
    chip(scope, {
      label: String(i + 1),
      ariaLabel: `Szene ${String(i + 1)}`,
      active: computed(() => last.value === i),
      onClick: () => {
        const filled = Boolean(store.state.peek().scenes?.[i]);
        if (saving.peek() || !filled) {
          store.saveScene(i);
          saving.value = false;
          readout.flash(`Szene ${String(i + 1)} gesichert`);
        } else {
          store.recallScene(i);
          readout.flash(`Szene ${String(i + 1)}`);
        }
        last.value = i;
      },
    }),
  );
  buttons.forEach((b, i) => {
    b.classList.add('scene');
    bind(
      scope,
      () => Boolean(store.state.value.scenes?.[i]),
      (has) => {
        b.classList.toggle('has', has);
      },
    );
  });
  return h('div', { class: 'scenes' }, [
    h('div', { class: 'row-split' }, [
      h('div', { class: 'cap-label', text: 'Szenen' }),
      chip(scope, {
        label: 'Sichern',
        ariaLabel: 'Szene sichern (überschreiben)',
        active: saving,
        onClick: () => {
          saving.value = !saving.peek();
        },
      }),
    ]),
    h('div', { class: 'scene-row' }, buttons),
  ]);
}
