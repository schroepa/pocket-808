import { padSummary } from '../../../core/sampler.ts';
import { computed } from '../../../store/signals.ts';
import type { UiContext } from '../../context.ts';
import type { Device } from '../../devices.ts';
import { h } from '../../dom.ts';
import { padState } from './common.ts';
import { samplerChop } from './chop.ts';
import { samplerKeyboard } from './keyboard.ts';
import { samplerKnobs } from './knobs.ts';
import { createMessage } from './message.ts';
import { samplerPads } from './pads.ts';
import { samplerSteps } from './steps.ts';
import { samplerTools } from './tools.ts';
import { samplerWave } from './wave.ts';
import './sampler.css';

/** Sampler als Gerät (Legacy rackSmp) */
export function samplerDevice(c: UiContext): Device {
  const { pcm } = padState(c);
  return {
    id: 'smp',
    name: 'Sampler',
    summary: computed(() => padSummary(c.store.state.value, pcm.value)),
    body: (scope) => {
      const cs: UiContext = { ...c, scope };
      const msg = createMessage(scope);
      const wave = samplerWave(cs);
      wave.append(msg.el);
      return h('div', { class: 'sampler-body' }, [
        samplerPads(cs),
        wave,
        samplerTools(cs, msg),
        samplerChop(cs, msg),
        samplerKnobs(cs),
        samplerSteps(cs),
        samplerKeyboard(cs),
      ]);
    },
  };
}
