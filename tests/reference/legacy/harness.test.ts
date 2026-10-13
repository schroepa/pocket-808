import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LEGACY_HTML, loadLegacy, mulberry32, PATCHES, splitLegacy } from './harness.ts';

describe('splitLegacy', () => {
  const html =
    '<html><body><p>x</p><script>\n(function(){\nfunction setupGraph(c){}\nfunction buildIR(c,size,damp){}\n' +
    'function renderVoice(i){}\nconst hot=window.claude;\nsetupGraph(ctx);\n  prerenderAll();\n})();\n</script></body></html>';

  it('trennt Script und Markup und wendet alle Patches an', () => {
    const { body, script } = splitLegacy(html);
    expect(body).toBe('<html><body><p>x</p></body></html>');
    expect(script).toContain('window.__t=');
    expect(script).toContain('if(!window.__noPrerender) prerenderAll();');
  });

  it('kennt die Anker für das Neustarten des Zufalls', () => {
    const finds = PATCHES.map((p) => p.find);
    expect(finds).toContain('function renderVoice(i){');
    expect(finds).toContain('function buildIR(c,size,damp){');
    expect(finds).toContain('function setupGraph(c){');
  });

  it('scheitert laut, wenn ein Anker fehlt', () => {
    expect(() => splitLegacy(html.replace('const hot=window.claude', 'const x=1'))).toThrow(
      /Anker nicht gefunden/,
    );
  });

  it('scheitert laut, wenn das Script fehlt', () => {
    expect(() => splitLegacy('<html></html>')).toThrow(/Legacy-Script nicht gefunden/);
  });

  it('findet alle Anker im echten Legacy-Code', () => {
    expect(PATCHES.length).toBeGreaterThanOrEqual(2);
    expect(() => splitLegacy(readFileSync(LEGACY_HTML, 'utf8'))).not.toThrow();
  });
});

describe('mulberry32', () => {
  it('ist reproduzierbar und liegt in [0, 1)', () => {
    const a = mulberry32(7);
    const b = mulberry32(7);
    const xs = Array.from({ length: 100 }, () => a());
    expect(xs).toEqual(Array.from({ length: 100 }, () => b()));
    for (const x of xs) expect(x >= 0 && x < 1).toBe(true);
    expect(mulberry32(8)()).not.toBe(xs[0]);
  });
});

describe('loadLegacy', () => {
  it('startet die Legacy-App ohne Fehler und reicht den Zustand heraus', () => {
    const p = loadLegacy();
    try {
      expect(p.errors).toEqual([]);
      expect(p.t.state.tempo).toBe(90);
      expect(p.t.VOICES.map((v) => v.id)).toEqual([
        'BD',
        'SD',
        'LT',
        'HT',
        'RS',
        'CP',
        'CB',
        'CH',
        'OH',
        'CY',
      ]);
      expect(p.t.ctx).toBeNull();
    } finally {
      p.close();
    }
  });

  it('übernimmt Speicherstände aus storage', () => {
    const p = loadLegacy({ storage: { 'pocket808.v1': JSON.stringify({ tempo: 133 }) } });
    try {
      expect(p.t.state.tempo).toBe(133);
    } finally {
      p.close();
    }
  });
});
