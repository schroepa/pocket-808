import { computed, type ReadonlySignal } from '../../store/signals.ts';
import type { UiContext } from '../context.ts';
import { chip } from '../controls/chip.ts';
import { sheetOpener } from '../controls/sheet.ts';
import { bind, h } from '../dom.ts';
import type { Nav } from '../nav.ts';
import { trackTitle } from '../track.ts';
import { partName } from './synth/format.ts';
import './display.css';

/*
 * Kopf des Geräts: BPM (öffnet Tempo, Swing, Master), Pattern, Meldungszeile, Oszilloskop, Zurück
 * und die Werkzeuge (Datei, Kürzel).
 */

/** Grundzeile der Meldungszeile: gewählte Spur, in „Sound“ das Ziel eines Synth-Sounds */
export function displayLine(
  c: Pick<UiContext, 'store' | 'audio'>,
  nav: Pick<Nav, 'mode' | 'track'>,
): ReadonlySignal<string> {
  return computed(() => {
    if (!c.audio.available) return 'Kein Audio in diesem Browser';
    const s = c.store.state.value;
    if (nav.mode.value === 'sound') return `SOUND FÜR ${partName(s.part).toUpperCase()}`;
    return trackTitle(s, nav.track.value);
  });
}

export function display(
  c: UiContext,
  nav: Pick<Nav, 'sheet'>,
  tools: readonly HTMLElement[],
  strip: HTMLElement,
): HTMLElement {
  const { store, scope, readout } = c;
  const digits = h('span', { class: 'lcd-digits' });
  const tempo = h('button', { class: 'lcd-tempo', attrs: { type: 'button' } }, [
    digits,
    h('span', { class: 'lcd-unit', text: 'BPM' }),
  ]);
  sheetOpener(scope, nav, tempo, 'tempo');
  bind(
    scope,
    () => store.state.value.tempo,
    (t) => {
      digits.textContent = String(t).padStart(3, '0');
      tempo.setAttribute('aria-label', `Tempo ${String(t)} BPM, Tempo, Swing und Master öffnen`);
    },
  );
  const pattern = h('div', { class: 'lcd-pattern' });
  bind(
    scope,
    () => store.state.value.cur,
    (cur) => {
      pattern.textContent = `PATTERN ${cur}`;
    },
  );
  const sub = h('div', { class: 'lcd-sub' });
  bind(
    scope,
    () => readout.text.value,
    (t) => {
      sub.textContent = t;
    },
  );
  return h('header', { class: 'display' }, [
    h('h1', { class: 'display-name', text: 'Pocket 808' }),
    h('div', { class: 'lcd', attrs: { role: 'group', 'aria-label': 'Anzeige' } }, [
      tempo,
      pattern,
      sub,
      strip,
    ]),
    h('div', { class: 'display-tools' }, [
      chip(scope, {
        label: 'Zurück',
        disabled: computed(() => !store.canUndo.value),
        onClick: () => {
          store.undo();
        },
      }),
      ...tools,
    ]),
  ]);
}
