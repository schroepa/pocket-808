import type { UiContext } from '../../context.ts';
import { h } from '../../dom.ts';
import type { Nav } from '../../nav.ts';
import { padTrigPage } from '../drum-pages.ts';
import { samplerChop } from './chop.ts';
import { samplerKeyboard } from './keyboard.ts';
import { samplerKnobs } from './knobs.ts';
import { createMessage } from './message.ts';
import { samplerPads } from './pads.ts';
import { samplerTools } from './tools.ts';
import { samplerWave } from './wave.ts';
import './sampler.css';

export interface SamplerPages {
  /** Pad-Reihe und Meldungszeile: gehört über die Reiter, damit beides auf jeder Seite sichtbar ist */
  readonly head: HTMLElement;
  readonly trig: HTMLElement;
  readonly klang: HTMLElement;
  readonly chop: HTMLElement;
  readonly tasten: HTMLElement;
}

/** Die Seiten des Samplers; Werkzeuge und Chop teilen sich die Meldungszeile. */
export function samplerPages(c: UiContext, nav: Nav): SamplerPages {
  const msg = createMessage(c.scope);
  return {
    head: h('div', { class: 'smp-head' }, [samplerPads(c), msg.el]),
    trig: padTrigPage(c, nav),
    klang: h('div', { class: 'smp-sound' }, [
      samplerWave(c),
      samplerTools(c, msg),
      samplerKnobs(c, ['tune', 'att', 'dec', 'lvl']),
    ]),
    chop: samplerChop(c, msg),
    tasten: samplerKeyboard(c),
  };
}
