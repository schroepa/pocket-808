import { lfoCents, lfoHz } from '../core/arp.ts';
import type { LfoSettings } from '../core/types.ts';
import { rampFrom } from './params.ts';

/*
 * LFO je Part (Etappe 6b): ein Sinus mit Gain, erst angelegt, wenn Depth > 0. Pro Note entsteht
 * kein Knoten: Der Gain wird auf `detune` des Filters (Cutoff) bzw. der Oszillatoren (Pitch)
 * gelegt und wieder gelöst, wenn der Oszillator endet.
 */

export interface PartLfo {
  readonly target: LfoSettings['t'];
  /** Rate, Depth und Ziel live ändern (Depth mit Anker) */
  set(l: LfoSettings, t: number): void;
  /** an eine Note legen: Cutoff auf den Filter, Pitch auf jeden Oszillator */
  attach(filter: BiquadFilterNode, oscs: readonly OscillatorNode[]): void;
  stop(t: number): void;
}

export function createLfo(ctx: BaseAudioContext, l: LfoSettings, t: number): PartLfo {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(lfoHz(l.r), t);
  const gain = ctx.createGain();
  let cents = lfoCents(l);
  gain.gain.setValueAtTime(cents, t);
  osc.connect(gain);
  osc.start(t);
  let target = l.t;
  const link = (p: AudioParam, end: OscillatorNode): void => {
    gain.connect(p);
    end.addEventListener('ended', () => {
      try {
        gain.disconnect(p);
      } catch {
        /* schon gelöst */
      }
    });
  };
  return {
    get target() {
      return target;
    },
    set(next, at) {
      osc.frequency.setValueAtTime(lfoHz(next.r), at);
      const c = lfoCents(next);
      if (c !== cents) rampFrom(gain.gain, cents, c, at, 0.03);
      cents = c;
      target = next.t;
    },
    attach(filter, oscs) {
      if (target === 'cut') {
        const first = oscs[0];
        if (first) link(filter.detune, first);
      } else for (const o of oscs) link(o.detune, o);
    },
    stop(at) {
      try {
        osc.stop(at);
      } catch {
        /* schon gestoppt */
      }
    },
  };
}
