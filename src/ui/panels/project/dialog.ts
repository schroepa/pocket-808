import { signal } from '../../../store/signals.ts';
import type { UiContext } from '../../context.ts';
import { chip } from '../../controls/chip.ts';
import { bind, h } from '../../dom.ts';
import { exportSection } from './export.ts';
import { projectSection } from './project.ts';
import './project.css';

export interface ProjectDialog {
  el: HTMLElement;
  save: () => Promise<void>;
  open: () => Promise<void>;
}

/** Datei-Knopf (Kopfzeile) mit Dialog: Projekt sichern/öffnen und Audio exportieren. */
export function projectDialog(c: UiContext): ProjectDialog {
  const status = signal('');
  const say = (text: string, flash = true): void => {
    status.value = text;
    if (flash) c.readout.flash(text);
  };
  const dialog = h('dialog', {
    class: 'file-dialog',
    attrs: { 'aria-label': 'Projekt und Export' },
  });
  const show = (): void => {
    if (dialog.open) return;
    // jsdom (Tests) kennt showModal nicht
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  };
  const project = projectSection(c, { say, show });
  const msg = h('p', { class: 'file-msg', attrs: { role: 'status' } });
  bind(
    c.scope,
    () => status.value,
    (t) => {
      msg.textContent = t;
    },
  );
  dialog.append(
    h('h2', { text: 'Datei' }),
    project.el,
    exportSection(c, say),
    msg,
    h('form', { attrs: { method: 'dialog' } }, [h('button', { class: 'chip', text: 'Schließen' })]),
  );
  const trigger = chip(c.scope, { label: 'Datei', onClick: show });
  trigger.classList.add('file-btn');
  trigger.setAttribute('aria-haspopup', 'dialog');
  return {
    el: h('div', { class: 'file-menu' }, [trigger, dialog]),
    save: project.save,
    open: project.open,
  };
}
