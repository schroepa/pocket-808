import { STEPS } from '../../core/constants.ts';
import type { UiContext } from '../context.ts';
import { bind, h } from '../dom.ts';

const PEAK_MS = 50;
const reduceMotion = (): boolean =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** OP-1-artiges LCD: Tempo, Peak, Step-Punkte, Mode-Glyphs, Statuszeile. */
export function lcdPanel(c: UiContext): HTMLElement {
  const { store, scope, readout, audio } = c;
  const digits = h('span', { class: 'lcd-digits' });
  bind(
    scope,
    () => store.state.value.tempo,
    (t) => {
      digits.textContent = String(t).padStart(3, '0');
    },
  );

  const peakFill = h('div', { class: 'lcd-peak-fill', attrs: { style: 'width:0%' } });
  const peak = h(
    'div',
    {
      class: 'lcd-peak',
      attrs: { role: 'meter', 'aria-label': 'Pegel', 'aria-valuemin': '0', 'aria-valuemax': '100' },
    },
    [peakFill],
  );

  const dots = Array.from({ length: STEPS }, (_, i) =>
    h('i', { class: 'lcd-step', attrs: { 'data-step': String(i) } }),
  );
  const stepsEl = h('div', { class: 'lcd-steps', attrs: { 'aria-hidden': 'true' } }, dots);

  const gMode = h('span', { class: 'lcd-glyph on', text: 'PTN' });
  const gFill = h('span', { class: 'lcd-glyph', text: 'FILL' });
  const gStu = h('span', { class: 'lcd-glyph', text: 'STU' });
  const glyphs = h('div', { class: 'lcd-glyphs', attrs: { 'aria-hidden': 'true' } }, [
    gMode,
    gFill,
    gStu,
  ]);

  const sub = h('div', { class: 'lcd-sub' });
  bind(
    scope,
    () => {
      const line = readout.text.value;
      const ph = audio.playhead.value;
      if (store.state.value.mode === 'song' && audio.playing.value && ph.songIndex >= 0) {
        return `${line} · ${ph.songIndex + 1}`;
      }
      return line;
    },
    (t) => {
      sub.textContent = t;
    },
  );

  bind(
    scope,
    () => store.state.value.mode,
    (m) => {
      gMode.textContent = m === 'song' ? 'SNG' : 'PTN';
    },
  );
  bind(
    scope,
    () => audio.fillHeld.value,
    (on) => {
      gFill.classList.toggle('on', on);
    },
  );
  bind(
    scope,
    () => audio.stutterHeld.value,
    (on) => {
      gStu.classList.toggle('on', on);
    },
  );

  const motionOk = !reduceMotion();
  bind(
    scope,
    () => {
      const step = audio.playhead.value.step;
      const playing = audio.playing.value;
      return playing ? step : -1;
    },
    (step) => {
      dots.forEach((d, i) => {
        const on = step === i;
        d.classList.toggle('on', on);
        d.classList.toggle('pulse', on && motionOk);
      });
    },
  );

  let peakTimer: ReturnType<typeof setInterval> | null = null;
  const setPeak = (v: number): void => {
    const pct = Math.round(Math.min(1, Math.sqrt(Math.max(0, v))) * 100);
    peakFill.style.width = `${pct}%`;
    peak.setAttribute('aria-valuenow', String(pct));
  };
  const stopPeak = (): void => {
    if (peakTimer !== null) {
      clearInterval(peakTimer);
      peakTimer = null;
    }
    setPeak(0);
  };
  bind(
    scope,
    () => audio.playing.value,
    (on) => {
      stopPeak();
      if (!on) return;
      peakTimer = setInterval(() => {
        setPeak(audio.peak());
      }, PEAK_MS);
    },
  );
  scope.add(stopPeak);

  return h('div', { class: 'lcd', attrs: { role: 'group', 'aria-label': 'Anzeige' } }, [
    h('div', { class: 'lcd-main' }, [digits, h('span', { class: 'lcd-unit', text: 'BPM' })]),
    peak,
    stepsEl,
    glyphs,
    sub,
  ]);
}
