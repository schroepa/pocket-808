import { CHANNEL_NAMES, CHANNELS } from '../../../core/constants.ts';
import { mixDefaults } from '../../../core/defaults.ts';
import { setChannelValue } from '../../../core/mixer.ts';
import { SCENE_COUNT } from '../../../core/scenes.ts';
import type { ChannelId } from '../../../core/types.ts';
import { must } from '../../../core/util.ts';
import { computed, signal, type ReadonlySignal } from '../../../store/signals.ts';
import type { UiContext } from '../../context.ts';
import { chip } from '../../controls/chip.ts';
import { slider } from '../../controls/slider.ts';
import { viewTabs } from '../../controls/view-tabs.ts';
import { show } from '../../controls/visible.ts';
import { bind, h, listen } from '../../dom.ts';
import type { Layout } from '../../layout.ts';
import { channelPage } from '../channel.ts';
import { fxPanel } from './fx.ts';
import './mixer.css';

const SHORT: Readonly<Partial<Record<ChannelId, string>>> = { BA: 'Bass', LD: 'Lead', SM: 'Smp' };
const DEFAULTS = mixDefaults();
const level = (v: number): string => String(Math.round(v * 100));

/** Taste mit dem Kurznamen: wählt den Kanal */
function nameButton(id: ChannelId, className: string, select: () => void): HTMLButtonElement {
  return h('button', {
    class: className,
    text: SHORT[id] ?? id,
    attrs: { type: 'button', 'aria-label': `Kanal ${CHANNEL_NAMES[id]} wählen` },
    on: { click: select },
  });
}

/** Seite Kanäle: 13 Züge mit senkrechtem Fader; darunter M, S, Pan und Reverb des gewählten */
export function channelStrips(c: UiContext): HTMLElement {
  const { store, scope, readout } = c;
  const selected = signal<ChannelId>('BD');
  const strips = CHANNELS.map((id) => {
    const select = (): void => {
      selected.value = id;
    };
    const name = nameButton(id, 'ch-name', select);
    const fader = slider(scope, {
      label: '',
      aria: `Lautstärke ${CHANNEL_NAMES[id]}`,
      value: store.select((s) => s.mix[id].v),
      write: (v) => {
        select();
        store.update((s) => setChannelValue(s, id, 'v', v));
      },
      def: () => DEFAULTS[id].v,
      format: level,
      readout,
    });
    const strip = h('div', { class: 'ch-strip' }, [name, fader]);
    listen(scope, strip, 'pointerdown', select);
    bind(
      scope,
      () => selected.value === id,
      (on) => {
        strip.classList.toggle('sel', on);
        name.setAttribute('aria-pressed', String(on));
      },
    );
    for (const [key, cls] of [
      ['m', 'muted'],
      ['s', 'solo'],
    ] as const) {
      bind(
        scope,
        () => store.state.value.mix[id][key],
        (on) => {
          strip.classList.toggle(cls, on);
        },
      );
    }
    return strip;
  });
  return h('div', { class: 'channels' }, [
    h('div', { class: 'ch-strips' }, strips),
    channelPage(c, selected, { level: false }),
  ]);
}

type MixPage = 'kanaele' | 'szenen' | 'fx';
const PAGE_NAMES: Readonly<Record<MixPage, string>> = {
  kanaele: 'Kanäle',
  szenen: 'Szenen',
  fx: 'FX',
};
/** welche Seiten nebeneinander stehen */
const VIEWS: Readonly<Record<Layout, readonly (readonly MixPage[])[]>> = {
  mobile: [['kanaele'], ['szenen'], ['fx']],
  tablet: [['kanaele', 'szenen'], ['fx']],
  desktop: [['kanaele', 'szenen', 'fx']],
};

/** Modus Mixer: Seiten Kanäle, Szenen und FX */
export function mixerWork(c: UiContext, layout: ReadonlySignal<Layout>): HTMLElement {
  const { scope } = c;
  const page = signal<MixPage>('kanaele');
  const views = computed(() => VIEWS[layout.value]);
  const view = computed(() =>
    must(
      views.value.find((v) => v.includes(page.value)),
      'Ansicht',
    ),
  );
  const bodies: readonly (readonly [MixPage, HTMLElement])[] = [
    ['kanaele', channelStrips(c)],
    ['szenen', sceneRow(c)],
    ['fx', fxPanel(c)],
  ];
  const sections = bodies.map(([id, body]) => {
    const el = h('section', { attrs: { 'data-page': id, 'aria-label': PAGE_NAMES[id] } }, [body]);
    bind(
      scope,
      () => view.value.includes(id),
      (on) => {
        show(el, on);
      },
    );
    return el;
  });
  const bar = viewTabs(scope, {
    label: 'Mixer',
    names: PAGE_NAMES,
    views,
    view,
    write: (p) => {
      page.value = p;
    },
  });
  return h('div', { class: 'mixer-work' }, [bar, ...sections]);
}

/** Szenen wie beim OP-XY: Tipp auf leer sichert, auf belegt ruft ab; „Sichern“ überschreibt einmal */
export function sceneRow(c: UiContext): HTMLElement {
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
