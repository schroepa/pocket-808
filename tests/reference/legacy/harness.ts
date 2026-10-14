import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { JSDOM, VirtualConsole, type DOMWindow } from 'jsdom';
import { mulberry32, tagHash } from '../../../src/core/random.ts';
import type { LegacyHooks } from './types.ts';

export { mulberry32 };

const require = createRequire(import.meta.url);
const wa = require('node-web-audio-api') as { OfflineAudioContext: typeof OfflineAudioContext };

export const LEGACY_HTML = fileURLToPath(new URL('../../../legacy/index.html', import.meta.url));

/** Reicht interne Funktionen und Werte des Legacy-Scripts an die Tests heraus. */
const HOOK =
  'window.__t={state,serial,ensureAudio,applyMixAll,stutterOn,stutterOff,synthNote,smpPlay,' +
  'renderVoice,prerenderAll,pump,voiceBuf,smpPcm,drumPcm,drumName,queue,VOICES,SYN_PRESETS,' +
  'DEFAULTS,PRESETS,SLOTS,SEED_B,SEED_NOTES,PARTS,PART_INFO,NAMES,SCALES,WAVES,ROWS,SYN_KEYS,' +
  'SMP_RATE,SMP_MAX,SMP_DEF,CHS,CH_FULL,KEY,SMP_KEY,FACTORY,mkCurve,buildIR,' +
  'degMidi,degName,effLen,calcAud,aud,tA,tD,tR,mastGain,' +
  'toggle,placeNote,toggleSub,setSub,clearTrack,clearAll,loadPreset,viewPattern,copyPattern,' +
  'pastePattern,snap,undoLast,get ctx(){return ctx;},' +
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
    // Entscheidung 2026-10-14: Rauschen sample-genau starten (Bruchteil-Versatz färbte SD/CP/RS)
    find: 's.start(t,Math.random()*1.5);',
    replace: 's.start(t,Math.floor(Math.random()*1.5*ctx.sampleRate)/ctx.sampleRate);',
  },
  {
    find: 'function renderVoice(i){',
    replace: 'function renderVoice(i){window.__reseed("voice:"+i);',
  },
];


export function splitLegacy(
  html: string,
  patches: readonly Patch[] = PATCHES,
): { body: string; script: string } {
  const m = /<script>\n\(function\(\)\{[\s\S]*?<\/script>/.exec(html);
  if (!m) throw new Error('Legacy-Script nicht gefunden');
  let script = m[0].replace(/^<script>/, '').replace(/<\/script>$/, '');
  for (const p of patches) {
    const parts = script.split(p.find);
    if (parts.length < 2) throw new Error(`Anker nicht gefunden: ${p.find}`);
    if (parts.length > 2) throw new Error(`Anker mehrdeutig: ${p.find}`);
    script = parts.join(p.replace);
  }
  return { body: html.replace(m[0], ''), script };
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
    w.Math.random = mulberry32(tagHash(`${seed}:${tag}`));
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
