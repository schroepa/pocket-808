import { describe, expect, it } from 'vitest';
import { signal } from '../store/signals.ts';
import { createScope } from './dom.ts';
import { createReadout } from './readout.ts';
import { manualTimer } from './test-utils.ts';

describe('createReadout', () => {
  it('zeigt eine Meldung 1,4 s und kehrt dann zur Grundzeile zurück', () => {
    const scope = createScope();
    const timer = manualTimer();
    const r = createReadout(scope, signal('BD · Bass Drum'), timer);
    r.flash('Tempo 120 BPM');
    expect(r.text.value).toBe('Tempo 120 BPM');
    timer.advance(1399);
    r.flash('Tempo 121 BPM');
    timer.advance(1399);
    expect(r.text.value).toBe('Tempo 121 BPM');
    timer.advance(1);
    expect(r.text.value).toBe('BD · Bass Drum');
    scope.dispose();
  });
  it('Aufräumen bricht eine laufende Meldung ab', () => {
    const scope = createScope();
    const timer = manualTimer();
    const r = createReadout(scope, signal('x'), timer);
    r.flash('y');
    scope.dispose();
    expect(timer.pending()).toBe(0);
  });
});
