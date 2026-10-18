import { lfoCents, lfoHz } from '../core/arp.ts';
import type { LfoSettings } from '../core/types.ts';
import { rampFrom } from './params.ts';

/*
 * LFO je Part (Etappe 6b): ein Sinus, erst angelegt, wenn Depth > 0. Pro Note entsteht kein
 * Knoten: Ein Gain je Ziel wird auf `detune` des Filters (Cutoff) bzw. der Oszillatoren (Pitch)
 * gelegt und wieder gelöst, wenn der Oszillator endet. Je Ziel ein eigener Gain, damit ein
 * Zielwechsel den Hub schon klingender Noten nicht ändert (das neue Ziel gilt ab der nächsten Note).
 */

type Target = LfoSettings['t'];

export interface PartLfo {
  readonly target: Target;
  /** Rate, Depth und Ziel live ändern (Hub mit Anker) */
  set(l: LfoSettings, t: number): void;
  /** an eine Note legen: Cutoff auf den Filter, Pitch auf jeden Oszillator */
  attach(filter: BiquadFilterNode, oscs: readonly OscillatorNode[]): void;
  /** Hub auf 0 fahren, dann stoppen (kein Sprung im Cutoff bzw. in der Tonhöhe) */
  stop(t: number): void;
}

const FADE = 0.03;

export function createLfo(ctx: BaseAudioContext, l: LfoSettings, t: number): PartLfo {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(lfoHz(l.r), t);
  const make = (cents: number): { node: GainNode; cents: number } => {
    const node = ctx.createGain();
    node.gain.setValueAtTime(cents, t);
    osc.connect(node);
    return { node, cents };
  };
  const gains: Record<Target, { node: GainNode; cents: number }> = {
    cut: make(l.t === 'cut' ? lfoCents(l) : 0),
    pit: make(l.t === 'pit' ? lfoCents(l) : 0),
  };
  osc.start(t);
  let target = l.t;
  const fade = (g: { node: GainNode; cents: number }, to: number, at: number): void => {
    if (to === g.cents) return;
    rampFrom(g.node.gain, g.cents, to, at, FADE);
    g.cents = to;
  };
  const link = (p: AudioParam, end: OscillatorNode): void => {
    const g = gains[target].node;
    g.connect(p);
    end.addEventListener('ended', () => {
      try {
        g.disconnect(p);
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
      target = next.t;
      fade(gains[target], lfoCents(next), at);
    },
    attach(filter, oscs) {
      if (target === 'cut') {
        const first = oscs[0];
        if (first) link(filter.detune, first);
      } else for (const o of oscs) link(o.detune, o);
    },
    stop(at) {
      fade(gains.cut, 0, at);
      fade(gains.pit, 0, at);
      try {
        osc.stop(at + FADE + 0.02);
      } catch {
        /* schon gestoppt */
      }
    },
  };
}
