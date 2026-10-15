import { clamp } from '../../../core/persist.ts';
import { grabHandle, movePadHandle, waveColumns } from '../../../core/sampler.ts';
import type { UiContext } from '../../context.ts';
import { bind, h, listen } from '../../dom.ts';
import { hearPad, padState } from './common.ts';

/** Was drawWave vom 2D-Kontext braucht (testbar ohne Canvas) */
export interface WaveCanvas {
  fillStyle: string | CanvasGradient | CanvasPattern;
  clearRect(x: number, y: number, w: number, h: number): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  fill(): void;
}

/** Wellenform mit Bereich und Griffen (Legacy drawWave; Farben aus der Palette) */
export function drawWave(
  g: WaveCanvas,
  w: number,
  hgt: number,
  pcm: Float32Array | null,
  start: number,
  end: number,
): void {
  g.clearRect(0, 0, w, hgt);
  g.fillStyle = 'rgba(211, 146, 90, 0.2)';
  g.fillRect(0, hgt / 2, w, 1);
  if (!pcm) return;
  g.fillStyle = '#d3925a';
  waveColumns(pcm, Math.floor(w)).forEach(({ min, max }, x) => {
    const y1 = ((1 - max) * hgt) / 2;
    const y2 = ((1 - min) * hgt) / 2;
    g.fillRect(x, y1, 1, Math.max(1, y2 - y1));
  });
  const sx = start * w;
  const ex = end * w;
  g.fillStyle = 'rgba(8, 8, 11, 0.78)';
  g.fillRect(0, 0, sx, hgt);
  g.fillRect(ex, 0, w - ex, hgt);
  g.fillStyle = '#d4d4dc';
  g.fillRect(sx - 1, 0, 2, hgt);
  g.fillRect(ex - 1, 0, 2, hgt);
  g.beginPath();
  g.moveTo(sx, 0);
  g.lineTo(sx + 8, 0);
  g.lineTo(sx, 8);
  g.fill();
  g.beginPath();
  g.moveTo(ex, hgt);
  g.lineTo(ex - 8, hgt);
  g.lineTo(ex, hgt - 8);
  g.fill();
}

/** Wellenform-Anzeige mit Start-/Endmarke zum Ziehen (Legacy #wave) */
export function samplerWave(c: UiContext): HTMLElement {
  const { store, scope } = c;
  const { sel, pad, pcm } = padState(c);
  const cv = h('canvas', {
    attrs: { role: 'img', 'aria-label': 'Wellenform mit Start- und Endmarke' },
  });
  const empty = h('div', {
    class: 'wave-empty',
    text: 'Leer. Lade eine Audiodatei oder nimm etwas auf.',
  });
  const redraw = (): void => {
    const r = cv.getBoundingClientRect();
    const g = r.width ? cv.getContext('2d') : null;
    if (!g) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(r.width * dpr);
    cv.height = Math.round(r.height * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawWave(g, r.width, r.height, pcm.peek(), pad.peek().start, pad.peek().end);
  };
  bind(
    scope,
    () => [pcm.value, pad.value.start, pad.value.end] as const,
    () => {
      empty.hidden = pcm.peek() !== null;
      redraw();
    },
  );
  // Größe ändert sich beim Aufklappen, Tab-Wechsel und Drehen
  if (typeof ResizeObserver === 'function') {
    const ro = new ResizeObserver(redraw);
    ro.observe(cv);
    scope.add(() => {
      ro.disconnect();
    });
  }
  const frac = (x: number): number => {
    const r = cv.getBoundingClientRect();
    return clamp((x - r.left) / r.width, 0, 1);
  };
  let handle: 'start' | 'end' | null = null;
  const move = (hd: 'start' | 'end', f: number): void => {
    const i = sel.peek();
    store.update((s) => movePadHandle(s, i, hd, f));
  };
  listen(scope, cv, 'pointerdown', (e) => {
    if (!pcm.peek()) return;
    const f = frac(e.clientX);
    const hd = grabHandle(pad.peek(), f);
    handle = hd;
    try {
      cv.setPointerCapture(e.pointerId);
    } catch {
      /* jsdom und ältere Browser */
    }
    move(hd, f);
  });
  listen(scope, cv, 'pointermove', (e) => {
    if (handle) move(handle, frac(e.clientX));
  });
  listen(scope, cv, 'pointerup', () => {
    if (!handle) return;
    handle = null;
    hearPad(c, sel.peek());
  });
  listen(scope, cv, 'pointercancel', () => {
    handle = null;
  });
  return h('div', { class: 'screen' }, [cv, empty]);
}
