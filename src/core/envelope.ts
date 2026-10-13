/** Regler 0..1 → Zeit in Sekunden (quadratisch für feine kurze Werte). */
export const attackTime = (x: number): number => 0.002 + x * x * 1.5;
export const decayTime = (x: number): number => 0.02 + x * x * 1.8;
export const releaseTime = (x: number): number => 0.02 + x * x * 1.2;
