import { SYNTH_SOUNDS } from '../../../core/templates/index.ts';
import { applySynthPreset } from '../../../core/synth.ts';
import type { UiContext } from '../../context.ts';
import { chip } from '../../controls/chip.ts';
import { bind, createScope, h } from '../../dom.ts';

/** Preset-Chips des gewählten Parts (Legacy synPresets) */
export function synthSoundList(c: UiContext): HTMLElement {
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
              store.update((s) => applySynthPreset(s, part, p));
              audio.auditionNote(part, 0, 2);
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

/** Presets des gewählten Parts und „Stimme leeren“ */
export function synthPresets(c: UiContext): HTMLElement {
  return h('div', { class: 'syn-foot' }, [
    synthSoundList(c),
    h('div', { class: 'chips syn-tools' }, [clearVoiceChip(c)]),
  ]);
}
