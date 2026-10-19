import { VOICES } from '../../core/constants.ts';
import { computed } from '../../store/signals.ts';
import type { UiContext } from '../context.ts';
import { markColumn } from '../controls/marker.ts';
import { stepButton } from '../controls/step-button.ts';
import { bind, h } from '../dom.ts';
import { must } from '../../core/util.ts';
import { recordTap } from '../record.ts';
import { optLook } from './step-opts.ts';
import { drumOn, toggleWithAudition } from './voice.ts';
import './tracks.css';

/** Alle zehn Spuren als Übersicht (Legacy buildTracks): Label wählt und hört vor, Zelle schaltet. */
export function tracks(c: UiContext): HTMLElement {
  const { store, scope, audio } = c;
  const select = (i: number): void => {
    if (store.state.peek().sel !== i) store.update((s) => ({ ...s, sel: i }));
  };
  const grid = VOICES.map((v, i) =>
    Array.from({ length: 16 }, (_, s) =>
      stepButton(scope, {
        label: `${v.name} Step ${s + 1}`,
        class: 'cell',
        on: drumOn(store, () => v.id, s),
        onPress: () => {
          select(i);
          toggleWithAudition(c, v.id, s);
        },
      }),
    ),
  );
  grid.forEach((cells, i) => {
    const id = must(VOICES[i], 'Stimme').id;
    cells.forEach((cell, s) => {
      optLook(scope, store, () => id, s, cell);
    });
  });
  const rows = VOICES.map((v, i) => {
    const lab = h('button', {
      class: 'lab',
      text: v.id,
      attrs: { type: 'button', 'aria-label': `${v.name} wählen und anhören` },
      on: {
        click: () => {
          select(i);
          audio.audition(v.id);
        },
      },
    });
    recordTap(c, lab, () => ({
      make: (pos) => ({ kind: 'drum', voice: v.id, ...pos }),
      label: v.id,
    }));
    bind(
      scope,
      () => c.samples.drums.value.has(v.id),
      (on) => {
        lab.classList.toggle('cust', on);
      },
    );
    const row = h('div', { class: 'row' }, [lab, h('div', { class: 'cells' }, grid[i])]);
    bind(
      scope,
      () => store.state.value.sel === i,
      (on) => {
        row.classList.toggle('sel', on);
      },
    );
    return row;
  });
  markColumn(
    scope,
    computed(() => audio.playhead.value.step),
    (s) => grid.flatMap((cells) => cells.slice(s, s + 1)),
  );
  return h(
    'section',
    { class: 'tracks-panel', attrs: { 'aria-label': 'Alle Spuren', 'data-area': 'tracks' } },
    [h('div', { class: 'cap-label', text: 'Spuren' }), h('div', { class: 'tracks' }, rows)],
  );
}
