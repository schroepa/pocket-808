import type { UiContext } from '../../context.ts';
import type { Device } from '../../devices.ts';
import { h } from '../../dom.ts';
import { synthSummary } from './format.ts';
import { synthHead } from './head.ts';
import { synthModules } from './modules.ts';
import { synthPresets } from './presets.ts';
import { pianoRoll } from './roll.ts';

/** Synth als Gerät (Legacy rackSynth); die Teile bekommen den Scope des Geräte-Halters. */
export function synthDevice(c: UiContext): Device {
  return {
    id: 'synth',
    name: 'Synth',
    summary: c.store.select(synthSummary),
    body: (scope) => {
      const cs: UiContext = { ...c, scope };
      return h('div', { class: 'synth-body' }, [
        synthHead(cs),
        pianoRoll(cs),
        h('div', { class: 'cap-label', text: 'Sound' }),
        synthModules(cs),
        synthPresets(cs),
      ]);
    },
  };
}
