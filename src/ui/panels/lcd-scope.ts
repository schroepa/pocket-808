import { VOICE_IDS } from '../../core/constants.ts';
import { currentPattern } from '../../core/pattern.ts';
import { stepIsOn } from '../../core/stepopts.ts';
import type { UiContext } from '../context.ts';
import { bind, h } from '../dom.ts';

/** Animationstakt (requestAnimationFrame), in Tests ersetzbar */
export interface Raf {
  request(fn: () => void): number;
  cancel(id: number): void;
}

const SAMPLES = 256;
const HEIGHT = 28;

/**
 * Streifen im LCD wie beim OP-1: Oszilloskop des Master-Ausgangs und 16 Step-Punkte. Gezeichnet wird
 * nur während der Wiedergabe (Animationstakt); im Stand und bei „weniger Bewegung“ nur bei Änderungen.
 */
export function lcdScope(c: UiContext, raf: Raf, reducedMotion: boolean): HTMLCanvasElement {
  const { store, audio, scope } = c;
  const canvas = h('canvas', { class: 'lcd-scope', attrs: { 'aria-hidden': 'true' } });
  const buf = new Float32Array(SAMPLES);
  const content = store.select((s) => {
    const p = currentPattern(s);
    return Array.from({ length: 16 }, (_, st) =>
      VOICE_IDS.some((id) => stepIsOn(p, id, st)) ? '1' : '0',
    ).join('');
  });
  const color = (): string =>
    getComputedStyle(canvas).getPropertyValue('--acc').trim() || 'currentColor';

  const draw = (live: boolean): void => {
    const g = canvas.getContext('2d');
    if (live) audio.scope(buf);
    if (!g) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth || 240;
    if (canvas.width !== Math.round(w * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(HEIGHT * dpr);
    }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, HEIGHT);
    const acc = color();
    // Oszilloskop (im Stand eine ruhige Mittellinie)
    g.strokeStyle = acc;
    g.lineWidth = 1.5;
    g.globalAlpha = 0.9;
    g.beginPath();
    const mid = 10;
    for (let i = 0; i < SAMPLES; i++) {
      const x = (i / (SAMPLES - 1)) * w;
      const y = mid - (live ? Math.max(-1, Math.min(1, buf[i] ?? 0)) : 0) * 9;
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
    // Step-Punkte: Inhalt schwach, laufender Step hell
    const now = audio.playhead.peek().step;
    const marks = content.peek();
    g.fillStyle = acc;
    for (let st = 0; st < 16; st++) {
      g.globalAlpha = st === now ? 1 : marks[st] === '1' ? 0.45 : 0.15;
      g.beginPath();
      g.arc(((st + 0.5) / 16) * w, HEIGHT - 4, st === now ? 2.5 : 1.8, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
  };

  let id: number | null = null;
  const frame = (): void => {
    draw(true);
    id = raf.request(frame);
  };
  const stop = (): void => {
    if (id !== null) raf.cancel(id);
    id = null;
  };
  bind(
    scope,
    () => audio.playing.value,
    (on) => {
      stop();
      if (on && !reducedMotion) id = raf.request(frame);
      else draw(false);
    },
  );
  // Inhalt, Step (ohne Animationslauf) und Größe zeichnen neu; der erste Lauf ist oben schon gezeichnet
  let first = true;
  bind(
    scope,
    () => `${content.value}|${String(audio.playhead.value.step)}`,
    () => {
      if (!first && id === null) draw(false);
      first = false;
    },
  );
  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => {
      if (id === null) draw(false);
    });
    ro.observe(canvas);
    scope.add(() => {
      ro.disconnect();
    });
  }
  scope.add(stop);
  return canvas;
}
