import { signal } from '../../store/signals.ts';
import type { UiContext } from '../context.ts';
import { sheetOpener } from '../controls/sheet.ts';
import { tabs } from '../controls/tabs.ts';
import { bind, h } from '../dom.ts';
import { MODE_NAMES, type Mode, type Nav } from '../nav.ts';
import './mode-bar.css';

const MODES: readonly Mode[] = ['spur', 'sound', 'mixer', 'song', 'punch'];

/** Modusleiste: Reiter „Bereich“ und die Pattern-Taste, die die Pattern-Fläche öffnet */
export function modeBar(c: UiContext, nav: Nav): HTMLElement {
  const modes = tabs<Mode>(c.scope, {
    label: 'Bereich',
    items: signal(MODES.map((value) => ({ value, label: MODE_NAMES[value] }))),
    value: nav.mode,
    write: (m) => {
      nav.setMode(m);
    },
  });
  const pattern = h('button', { class: 'mode-pattern', attrs: { type: 'button' } });
  sheetOpener(c.scope, nav, pattern, 'pattern');
  bind(
    c.scope,
    () => c.store.state.value.cur,
    (cur) => {
      pattern.textContent = `${cur} ▾`;
      pattern.setAttribute('aria-label', `Pattern wählen, aktuell ${cur}`);
    },
  );
  return h('div', { class: 'mode-bar' }, [modes, pattern]);
}
