import type { ReadonlySignal } from '../../store/signals.ts';
import { bind, type Scope } from '../dom.ts';

const SVG = 'http://www.w3.org/2000/svg';
const HOLD = 0.6;

/** Linienpfad der ADSR-Hüllkurve in einem 100 × 36-Feld (Legacy envPath; Zeiten in Sekunden). */
export function envelopePoints(a: number, d: number, s: number, r: number): string {
  const tot = a + d + HOLD + r;
  const x = (v: number): string => ((v / tot) * 100).toFixed(2);
  const y = (v: number): string => (34 - v * 32).toFixed(2);
  return `M0 34L${x(a)} 2L${x(a + d)} ${y(s)}L${x(a + d + HOLD)} ${y(s)}L100 34`;
}

/** SVG mit Fläche und Linie; folgt [A, D, S, R] (A, D, R in Sekunden, S 0..1). */
export function envelopeView(
  scope: Scope,
  value: ReadonlySignal<readonly [number, number, number, number]>,
): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('class', 'env-svg');
  svg.setAttribute('viewBox', '0 0 100 36');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-hidden', 'true');
  const fill = document.createElementNS(SVG, 'path');
  fill.setAttribute('class', 'ef');
  const line = document.createElementNS(SVG, 'path');
  line.setAttribute('class', 'el');
  svg.append(fill, line);
  bind(
    scope,
    () => {
      const [a, d, s, r] = value.value;
      return envelopePoints(a, d, s, r);
    },
    (p) => {
      fill.setAttribute('d', `${p}Z`);
      line.setAttribute('d', p);
    },
  );
  return svg;
}
