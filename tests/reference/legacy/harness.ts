import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { JSDOM, VirtualConsole, type DOMWindow } from 'jsdom';
import type { LegacyHooks } from './types.ts';

const require = createRequire(import.meta.url);
const wa = require('node-web-audio-api') as { OfflineAudioContext: typeof OfflineAudioContext };

export const LEGACY_HTML = fileURLToPath(new URL('../../../legacy/index.html', import.meta.url));

/** Reicht interne Funktionen und Werte des Legacy-Scripts an die Tests heraus. */
const HOOK =
  'window.__t={state,serial,ensureAudio,applyMixAll,stutterOn,stutterOff,synthNote,smpPlay,' +
  'renderVoice,prerenderAll,pump,voiceBuf,smpPcm,drumPcm,VOICES,SYN_PRESETS,get ctx(){return ctx;},' +
  'begin(){playing=true;step=0;songFirst=true;barSong=false;queue.length=0;nextTime=.08;},' +
  'stop(){playing=false;}};\n';

export interface Patch {
  find: string;
  replace: string;
}

export const PATCHES: readonly Patch[] = [
  { find: 'const hot=window.claude', replace: HOOK + 'const hot=window.claude' },
  {
    // Vorrendern steuert der Test selbst, sonst überschreibt es gezielt gerenderte Varianten
    find: 'setupGraph(ctx);\n  prerenderAll();',
    replace: 'setupGraph(ctx);\n  if(!window.__noPrerender) prerenderAll();',
  },
  // Zufall je Zweck neu starten: Referenzen hängen dann nur vom Klang selbst ab,
  // nicht davon, wie oft Math.random vorher schon aufgerufen wurde
  { find: 'function setupGraph(c){', replace: 'function setupGraph(c){window.__reseed("graph");' },
  {
    find: 'function buildIR(c,size,damp){',
    replace: 'function buildIR(c,size,damp){window.__reseed("ir");',
  },
  {
    find: 'function renderVoice(i){',
    replace: 'function renderVoice(i){window.__reseed("voice:"+i);',
  },
];

/** FNV-1a, um aus Seed und Zweck einen Start-Seed zu bilden. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

export function splitLegacy(
  html: string,
  patches: readonly Patch[] = PATCHES,
): { body: string; script: string } {
  const m = /<script>\n\(function\(\)\{[\s\S]*?<\/script>/.exec(html);
  if (!m) throw new Error('Legacy-Script nicht gefunden');
  let script = m[0].replace(/^<script>/, '').replace(/<\/script>$/, '');
  for (const p of patches) {
    if (!script.includes(p.find)) throw new Error(`Anker nicht gefunden: ${p.find}`);
    script = script.replace(p.find, p.replace);
  }
  return { body: html.replace(m[0], ''), script };
}

/** Kleiner, reproduzierbarer Zufallsgenerator (ersetzt Math.random im Legacy-Fenster). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface AudioSetup {
  seconds: number;
  channels?: 1 | 2;
  sampleRate?: number;
}

export interface LegacyOptions {
  seed?: number;
  /** ohne audio gibt es keinen AudioContext: Die App startet stumm (gut für Speicherstand-Tests). */
  audio?: AudioSetup;
  storage?: Readonly<Record<string, string>>;
  /** true = Legacy rendert die Drums selbst beim Anlegen des Kontexts vor */
  prerender?: boolean;
  instrument?: (ctx: OfflineAudioContext) => void;
}

export interface LegacyPage {
  window: DOMWindow;
  t: LegacyHooks;
  errors: string[];
  ctx(): OfflineAudioContext;
  setNow(seconds: number): void;
  close(): void;
}

export function loadLegacy(opts: LegacyOptions = {}): LegacyPage {
  const { body, script } = splitLegacy(readFileSync(LEGACY_HTML, 'utf8'));
  const errors: string[] = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e: Error) => errors.push(String(e.stack ?? e)));
  const dom = new JSDOM(body, {
    url: 'https://example.test/',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    virtualConsole: vc,
  });
  const w = dom.window as DOMWindow & Record<string, unknown>;
  const seed = opts.seed ?? 1;
  w.Math.random = mulberry32(seed);
  w.__reseed = (tag: string) => {
    w.Math.random = mulberry32(hash(`${seed}:${tag}`));
  };
  // node-web-audio-api erwartet Float32Arrays aus dem Node-Realm
  w.Float32Array = Float32Array;
  w.HTMLCanvasElement.prototype.getContext = () => null;
  for (const [k, v] of Object.entries(opts.storage ?? {})) w.localStorage.setItem(k, v);

  let now = 0;
  let ctx: OfflineAudioContext | null = null;
  if (opts.audio) {
    const { seconds, channels = 2, sampleRate = 44100 } = opts.audio;
    w.AudioContext = function () {
      const c = new wa.OfflineAudioContext(channels, Math.ceil(seconds * sampleRate), sampleRate);
      Object.defineProperty(c, 'currentTime', { get: () => now });
      opts.instrument?.(c);
      ctx = c;
      return c;
    };
    w.OfflineAudioContext = wa.OfflineAudioContext;
    w.__noPrerender = opts.prerender !== true;
  }

  w.eval(script);
  const t = w.__t as LegacyHooks | undefined;
  if (!t) throw new Error('Hook wurde nicht gesetzt');
  return {
    window: w,
    t,
    errors,
    ctx() {
      if (!ctx) throw new Error('Kein AudioContext: ensureAudio() aufrufen und audio-Option setzen');
      return ctx;
    },
    setNow(seconds) {
      now = seconds;
    },
    close() {
      w.close();
    },
  };
}
