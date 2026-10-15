import type { ChannelId, Fx, State } from './types.ts';

/** Mixer- und FX-Bedienung als reine Funktionen (Legacy buildMixFx); Mute: toggleMute in synth.ts. */

export const setChannelValue = (
  s: State,
  id: ChannelId,
  key: 'v' | 'p' | 'r',
  v: number,
): State => ({
  ...s,
  mix: { ...s.mix, [id]: { ...s.mix[id], [key]: v } },
});

export const toggleSolo = (s: State, id: ChannelId): State => ({
  ...s,
  mix: { ...s.mix, [id]: { ...s.mix[id], s: !s.mix[id].s } },
});

export const setFxValue = (s: State, key: keyof Fx, v: number): State => ({
  ...s,
  fx: { ...s.fx, [key]: v },
});
