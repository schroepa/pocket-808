import type { UiContext } from '../../context.ts';
import type { Device } from '../../devices.ts';
import { fxSummary, mixSummary } from './format.ts';
import { fxPanel } from './fx.ts';
import { mixerPanel } from './mixer.ts';

/** Mixer als Gerät (Legacy rackMix) */
export function mixerDevice(c: UiContext): Device {
  return {
    id: 'mix',
    name: 'Mixer',
    summary: c.store.select((s) => mixSummary(s.mix)),
    body: (scope) => mixerPanel({ ...c, scope }),
  };
}

/** FX als Gerät (Legacy rackFx) */
export function fxDevice(c: UiContext): Device {
  return {
    id: 'fx',
    name: 'FX',
    summary: c.store.select((s) => fxSummary(s.fx)),
    body: (scope) => fxPanel({ ...c, scope }),
  };
}
