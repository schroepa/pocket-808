import { SYNTH_SOUNDS } from '../../../core/templates/index.ts';
import type { Part } from '../../../core/types.ts';
import type { UiContext } from '../../context.ts';
import { chip } from '../../controls/chip.ts';
import { bind, createScope, h } from '../../dom.ts';

/** Preset-Chips des gewählten Parts (Legacy synPresets); onPick nach dem Laden und Vorhören */
export function synthSoundList(
  c: UiContext,
  onPick?: (part: Part, name: string) => void,
): HTMLElement {
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
        ...SYNTH_SOUNDS[part].map((p) =>
          chip(inner, {
            label: p.name,
            active: store.select((s) => s.synth[part].preset === p.name),
            onClick: () => {
              store.loadSynthPreset(part, p);
              audio.auditionNote(part, 0, 2);
              onPick?.(part, p.name);
            },
          }),
        ),
      );
    },
  );
  return list;
}

/** „Stimme leeren“: Noten des gewählten Parts löschen, mit Zurück (Legacy synTools) */
export function clearVoiceChip(c: UiContext): HTMLElement {
  return chip(c.scope, {
    label: 'Stimme leeren',
    onClick: () => {
      c.store.clearNotes();
    },
  });
}
