import { SYN_PRESETS } from '../../../core/constants.ts';
import { applySynthPreset } from '../../../core/synth.ts';
import type { UiContext } from '../../context.ts';
import { chip } from '../../controls/chip.ts';
import { bind, createScope, h } from '../../dom.ts';

/** Presets des gewählten Parts und „Stimme leeren“ (Legacy synPresets, synTools). */
export function synthPresets(c: UiContext): HTMLElement {
  const { store, scope, audio } = c;
  const list = h('div', {
    class: 'chips syn-presets',
    attrs: { role: 'group', 'aria-label': 'Presets' },
  });
  // Die Liste hängt vom Part ab: eigener Unter-Scope, der beim Neuaufbau aufgeräumt wird
  let inner = createScope();
  scope.add(() => {
    inner.dispose();
  });
  bind(
    scope,
    () => store.state.value.part,
    (part) => {
      inner.dispose();
      inner = createScope();
      list.replaceChildren(
        ...SYN_PRESETS[part].map((p) =>
          chip(inner, {
            label: p.name,
            active: store.select((s) => s.synth[part].preset === p.name),
            onClick: () => {
              store.update((s) => applySynthPreset(s, part, p));
              audio.auditionNote(part, 0, 2);
            },
          }),
        ),
      );
    },
  );
  return h('div', { class: 'syn-foot' }, [
    list,
    h('div', { class: 'chips syn-tools' }, [
      chip(scope, {
        label: 'Stimme leeren',
        onClick: () => {
          store.clearNotes();
        },
      }),
    ]),
  ]);
}
