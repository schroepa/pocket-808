import { CHANNELS } from './constants.ts';
import type { ChannelId, MixChannel } from './types.ts';

/** Hörbar = nicht stumm und (kein Solo aktiv oder selbst Solo). */
export function audibleChannels(
  mix: Readonly<Record<ChannelId, MixChannel>>,
): Record<ChannelId, boolean> {
  const anySolo = CHANNELS.some((id) => mix[id].s);
  return Object.fromEntries(
    CHANNELS.map((id) => [id, !mix[id].m && (!anySolo || mix[id].s)]),
  ) as Record<ChannelId, boolean>;
}

/** Fader 0..1 → Verstärkung (0,8 ≙ 1,0). */
export const channelGain = (ch: MixChannel, audible: boolean): number =>
  audible ? ch.v * ch.v * 1.5625 : 0;
export const channelPan = (ch: MixChannel): number => (ch.p - 0.5) * 2;
export const masterGain = (v: number): number => Math.pow(v, 1.5);
