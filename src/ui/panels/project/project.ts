import {
  decodeProject,
  encodeProject,
  projectFileName,
  type ProjectData,
} from '../../../core/project.ts';
import { must } from '../../../core/util.ts';
import { signal } from '../../../store/signals.ts';
import type { UiContext } from '../../context.ts';
import { chip } from '../../controls/chip.ts';
import { bind, h } from '../../dom.ts';

export interface ProjectSection {
  el: HTMLElement;
  save: () => Promise<void>;
  open: () => Promise<void>;
}

const drumsOf = (c: UiContext): ProjectData['drums'] => Object.fromEntries(c.samples.drums.peek());

/** Projekt sichern und öffnen; öffnen fragt im Dialog, bevor es ersetzt (Zurück stellt alles wieder her). */
export function projectSection(
  c: UiContext,
  ui: { say(text: string): void; show(): void },
): ProjectSection {
  const pending = signal<ProjectData | undefined>(undefined);

  const save = async (): Promise<void> => {
    const now = new Date();
    const text = encodeProject(
      { state: c.store.state.peek(), pads: [...c.samples.pads.peek()], drums: drumsOf(c) },
      now,
    );
    const r = await c.files.save(
      new Blob([text], { type: 'application/json' }),
      projectFileName(now),
    );
    if (r === 'failed') ui.say('Sichern nicht möglich');
    else if (r !== 'cancelled') ui.say('Projekt gesichert');
  };

  const open = async (): Promise<void> => {
    const f = await c.files.pickProject().catch(() => ({ text: '', name: '' }));
    if (!f) return;
    const d = decodeProject(f.text);
    if ('error' in d) {
      ui.say('Keine Pocket-808-Datei');
      return;
    }
    pending.value = d;
    ui.show();
  };

  const replace = (): void => {
    const d = must(pending.peek(), 'gewähltes Projekt');
    pending.value = undefined;
    const oldPads = [...c.samples.pads.peek()];
    const oldDrums = drumsOf(c);
    c.samples.replaceAll(d.pads, d.drums);
    c.store.replaceState(d.state, () => {
      c.samples.replaceAll(oldPads, oldDrums);
    });
    ui.say('Projekt geöffnet');
  };

  const ask = h('div', { class: 'replace-ask' }, [
    h('p', { text: 'Aktuelles Projekt ersetzen?' }),
    h('div', { class: 'chips' }, [
      chip(c.scope, { label: 'Ersetzen', onClick: replace }),
      chip(c.scope, {
        label: 'Abbrechen',
        onClick: () => {
          pending.value = undefined;
        },
      }),
    ]),
  ]);
  bind(
    c.scope,
    () => pending.value === undefined,
    (none) => {
      ask.hidden = none;
    },
  );

  const el = h('section', { class: 'file-sec', attrs: { 'aria-label': 'Projekt' } }, [
    h('h3', { class: 'cap-label', text: 'Projekt' }),
    h('div', { class: 'chips' }, [
      chip(c.scope, { label: 'Projekt sichern', onClick: () => void save() }),
      chip(c.scope, { label: 'Projekt öffnen', onClick: () => void open() }),
    ]),
    ask,
  ]);
  return { el, save, open };
}
