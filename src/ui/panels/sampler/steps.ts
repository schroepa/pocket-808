import { signal } from '../../../store/signals.ts';
import type { UiContext } from '../../context.ts';
import { h } from '../../dom.ts';
import { padTrigParts } from '../drum-pages.ts';
import { padSteps } from '../step-area.ts';
import { createEditorOpt } from '../step-opts.ts';

/** 16 Sampler-Steps des gewählten Pads mit Sub- und Opt-Modus (Legacy smpSteps, paintSmpSteps) */
export function samplerSteps(c: UiContext): HTMLElement {
  const nav = { padSub: signal({ on: false, step: -1 }), padOpt: createEditorOpt() };
  const grid = padSteps(c, nav);
  const { chips, panels } = padTrigParts(c, nav);
  return h('div', { class: 'smp-step-box' }, [
    h('div', { class: 'row-split' }, [h('div', { class: 'cap-label', text: 'Steps' }), ...chips]),
    grid,
    ...panels,
  ]);
}
