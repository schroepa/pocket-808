/** Wert halten und alles Spätere verwerfen (Firefox kennt cancelAndHoldAtTime nicht). */
export function holdAt(p: AudioParam, t: number): void {
  const hold = (p as Partial<Pick<AudioParam, 'cancelAndHoldAtTime'>>).cancelAndHoldAtTime;
  if (hold) hold.call(p, t);
  else p.cancelScheduledValues(t);
}

/**
 * Weich von from nach to: halten, Anker from, Rampe. Der Anker ist nötig: Ohne beginnt eine Rampe
 * beim letzten Ereignis (Firefox ohne cancelAndHold, Parameter ohne Automation), und
 * node-web-audio-api verrechnet Halten plus Rampe falsch.
 */
export function rampFrom(p: AudioParam, from: number, to: number, t: number, dur: number): void {
  holdAt(p, t);
  p.setValueAtTime(from, t);
  p.linearRampToValueAtTime(to, t + dur);
}
