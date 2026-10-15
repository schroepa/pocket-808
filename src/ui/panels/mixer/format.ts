import { CHANNELS } from '../../../core/constants.ts';
import type { ChannelId, Fx, MixChannel } from '../../../core/types.ts';

/** Texte von Mixer und FX wie Legacy (renderMixFx, buildMixFx) */

const centered = (v: number): boolean => Math.abs(v - 0.5) < 0.005;
const amount = (v: number): number => Math.round(Math.abs(v - 0.5) * 200);

export const panText = (v: number): string =>
  centered(v) ? 'Mitte' : `${v < 0.5 ? 'L' : 'R'} ${amount(v)}`;

export const djText = (v: number): string =>
  centered(v) ? 'aus' : `${v < 0.5 ? 'Tiefpass' : 'Hochpass'} ${amount(v)}%`;

export const sizeText = (v: number): string => `${(0.3 + v * 2.2).toFixed(1)} s`;

export function mixSummary(mix: Readonly<Record<ChannelId, MixChannel>>): string {
  const muted = CHANNELS.filter((id) => mix[id].m);
  const solo = CHANNELS.filter((id) => mix[id].s);
  if (!muted.length && !solo.length) return '13 Kanäle';
  const parts = [
    muted.length ? `${muted.length} stumm` : '',
    solo.length ? `Solo ${solo.length === 1 ? String(solo[0]) : solo.length}` : '',
  ];
  return parts.filter(Boolean).join(' · ');
}

export function fxSummary(fx: Fx): string {
  const filter = centered(fx.dj) ? 'aus' : `${fx.dj < 0.5 ? 'LP' : 'HP'} ${amount(fx.dj)}%`;
  return `Reverb ${Math.round(fx.ret * 100)}% · Filter ${filter}`;
}
