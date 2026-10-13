/** Dauer eines 16tel-Steps in Sekunden. */
export const stepDuration = (tempo: number): number => 60 / tempo / 4;
/** Swing verzögert jeden zweiten Step um bis zu 40 % eines Steps. */
export const swingDelay = (step: number, swing: number, d: number): number =>
  step % 2 === 1 ? swing * 0.4 * d : 0;
/** Versatz des k-ten von 16 Sub-Steps. */
export const subStepOffset = (k: number, d: number): number => (k * d) / 16;
