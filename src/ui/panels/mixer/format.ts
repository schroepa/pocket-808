/** Texte von Mixer und FX wie Legacy (renderMixFx, buildMixFx) */

const centered = (v: number): boolean => Math.abs(v - 0.5) < 0.005;
const amount = (v: number): number => Math.round(Math.abs(v - 0.5) * 200);

export const panText = (v: number): string =>
  centered(v) ? 'Mitte' : `${v < 0.5 ? 'L' : 'R'} ${amount(v)}`;

export const djText = (v: number): string =>
  centered(v) ? 'aus' : `${v < 0.5 ? 'Tiefpass' : 'Hochpass'} ${amount(v)}%`;

export const sizeText = (v: number): string => `${(0.3 + v * 2.2).toFixed(1)} s`;
