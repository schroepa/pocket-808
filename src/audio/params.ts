/** Wert halten und alles Spätere verwerfen (Firefox kennt cancelAndHoldAtTime nicht). */
export function holdAt(p: AudioParam, t: number): void {
  const hold = (p as Partial<Pick<AudioParam, 'cancelAndHoldAtTime'>>).cancelAndHoldAtTime;
  if (hold) hold.call(p, t);
  else p.cancelScheduledValues(t);
}
