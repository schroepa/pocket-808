import { CHANNELS, PARTS } from '../core/constants.ts';
import { channelGain, channelPan, masterGain } from '../core/mix.ts';
import type { Rng } from '../core/random.ts';
import { sameTone, toneOf, type Tone } from '../core/tone.ts';
import type { ChannelId, Fx, MixChannel, Part, PartFx, State } from '../core/types.ts';
import {
  delayTime,
  djFilter,
  impulseResponse,
  noiseData,
  reverbReturn,
  softClipCurve,
  TAPE_RANGE,
  tapeCurve,
  tapeSettings,
  vinylNoise,
} from './dsp.ts';
import { holdAt, rampFrom } from './params.ts';
import { createPartFx, type PartFxChain } from './partfx.ts';

/*
 * Master-Kette wie Legacy setupGraph:
 * Kanäle → Bus → Dry-Gate → DJ-Filter (LP → HP) → Kompressor → Soft-Clip → Master → Limiter →
 * Sicherheits-Shaper → Ausgang. Sends: Reverb (Convolver) hinter dem Fader, tempo-synchrones Delay
 * für die Synth-Stimmen. Stutter greift hinter dem Bus ab und speist vor dem DJ-Filter wieder ein.
 */

export interface ChannelNodes {
  in: GainNode;
  pan: StereoPannerNode;
  snd: GainNode;
}

export interface Graph {
  readonly ctx: BaseAudioContext;
  readonly bus: GainNode;
  readonly noise: AudioBuffer;
  readonly kick: Float32Array;
  readonly chan: Record<ChannelId, ChannelNodes>;
  /** Stimmen speisen inp (immer 1); dahinter liegen die Effekte, dann der Pegel lvl */
  readonly parts: Record<Part, { inp: GainNode; lvl: GainNode; snd: GainNode }>;
  /** Drive und Chorus eines Parts; true: die Kette ist leer und kann nach der Blende weg */
  setPartFx(part: Part, fx: PartFx, t: number | null): boolean;
  /** eine leere Effektkette abbauen (eine wieder benutzte bleibt) */
  releasePartFx(part: Part): void;
  /** t = null: Anfangswert direkt setzen (Legacy init), sonst weich mit setTargetAtTime */
  setMaster(v: number, t: number | null): void;
  applyChannel(id: ChannelId, ch: MixChannel, audible: boolean, t: number | null): void;
  applyFx(fx: Fx, t: number | null): void;
  syncSynth(
    s: Pick<State, 'tempo' | 'synth'>,
    audible: Record<ChannelId, boolean>,
    t: number,
  ): void;
  muteReverb(t: number): void;
  replaceReverb(ir: Float32Array, fx: Fx, t: number): void;
  stutterOn(t: number, period: number): void;
  stutterOff(t: number): void;
  /** Punch-Effekt ein (erst bei der ersten Benutzung angelegt); fx: Ausgangswerte der Filter */
  punchOn(kind: GraphPunch, t: number, tempo: number, fx: Fx): void;
  /** Punch-Effekt aus; Filter kehren zu den FX-Werten zurück */
  punchOff(kind: GraphPunch, t: number, fx: Fx): void;
  /** Abgriff hinter dem Master für das LCD (erst bei der ersten Anforderung angelegt, ohne Ausgang) */
  analyser(): AnalyserNode;
  /**
   * Klangcharakter des Masters (Warm, Tape). Die Kette liegt nur im Signalweg, solange eines von
   * beiden an ist; sonst wird sie abgebaut und der Weg ist der alte.
   */
  setTone(tone: Tone, t: number): void;
  /** Bandrauschen nur während der Wiedergabe */
  setPlaying(on: boolean, t: number): void;
}

/** Master-Klang: Bandsättigung → Eiern (Delay) → Tiefpass → Kuhschwänze; dazu Bandrauschen */
interface ToneChain {
  inp: GainNode;
  sat: WaveShaperNode;
  wow: DelayNode;
  wowDepth: GainNode;
  flutterDepth: GainNode;
  lp: BiquadFilterNode;
  lo: BiquadFilterNode;
  hi: BiquadFilterNode;
  hiss: GainNode;
  sources: AudioScheduledSourceNode[];
  /** Stufe der Sättigungs-Kennlinie (−1: noch keine gesetzt) */
  level: number;
}
/** Grundverzögerung des Eierns (s) und Stufen der Sättigung */
const WOW_BASE = 0.006;
const TAPE_STEPS = 16;
/** Kuhschwänze für Warm (dB) */
const WARM_LOW_DB = 2;
const WARM_HIGH_DB = -3;

/** Punch-Effekte, die im Graphen leben (Loops nutzen den Stutter, Half-Time den Scheduler) */
export type GraphPunch = 'tape' | 'crush' | 'echo' | 'lp' | 'hp';

/** Bandstopp: Dauer bis zum Stillstand (s) */
const TAPE_S = 1;
/** Filterfahrten: Dauer (s) und Ziel (Hz) */
const SWEEP_S = 1.5;
const LP_TARGET = 250;
const CRUSH_LEVEL = 0.8;
const HP_TARGET = 2000;

interface Insert {
  inp: GainNode;
  out: GainNode;
}

interface Stutter {
  inp: GainNode;
  dly: DelayNode;
  fb: GainNode;
  out: GainNode;
  on: boolean;
}

export function createGraph(
  ctx: BaseAudioContext,
  s: State,
  audible: Record<ChannelId, boolean>,
  random: (tag: string) => Rng,
): Graph {
  const c = ctx;
  const bus = c.createGain();
  bus.gain.value = 1.8;
  const comp = c.createDynamicsCompressor();
  comp.threshold.value = -12;
  comp.knee.value = 10;
  comp.ratio.value = 4;
  comp.attack.value = 0.003;
  comp.release.value = 0.15;
  const clip = c.createWaveShaper();
  clip.curve = softClipCurve(1.4, true) as Float32Array<ArrayBuffer>;
  const master = c.createGain();
  master.gain.value = masterGain(s.master);
  const dryG = c.createGain();
  const djIn = c.createGain();
  const djLP = c.createBiquadFilter();
  djLP.type = 'lowpass';
  djLP.frequency.value = 20000;
  const djHP = c.createBiquadFilter();
  djHP.type = 'highpass';
  djHP.frequency.value = 10;
  djLP.connect(djHP);
  djHP.connect(comp);
  bus.connect(dryG);
  dryG.connect(djIn);
  djIn.connect(djLP);
  comp.connect(clip);
  clip.connect(master);
  // Limiter am Ausgang: erlaubt hohe Lautheit, ohne dass Spitzen übersteuern
  const lim = c.createDynamicsCompressor();
  lim.threshold.value = -1.5;
  lim.knee.value = 0;
  lim.ratio.value = 20;
  lim.attack.value = 0.001;
  lim.release.value = 0.08;
  const safe = c.createWaveShaper();
  safe.curve = new Float32Array([-0.98, 0.98]);
  master.connect(lim);
  lim.connect(safe);
  safe.connect(c.destination);

  const noise = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
  noise.getChannelData(0).set(noiseData(c.sampleRate * 2, random('graph')));
  const kick = softClipCurve(1.6, true);

  // Delay (punktierte Achtel, tempo-synchron) für die Synth-Stimmen
  const dly = c.createDelay(2);
  dly.delayTime.value = (3 * 60) / s.tempo / 4;
  const dlp = c.createBiquadFilter();
  dlp.type = 'lowpass';
  dlp.frequency.value = 2400;
  const fb = c.createGain();
  fb.gain.value = 0.4;
  const dOut = c.createGain();
  dOut.gain.value = 0.75;
  dly.connect(dlp);
  dlp.connect(fb);
  fb.connect(dly);
  dlp.connect(dOut);
  dOut.connect(bus);

  // Reverb: Faltung mit erzeugter Impulsantwort
  const rvIn = c.createGain();
  let rvConv = c.createConvolver();
  const rvOut = c.createGain();
  rvOut.gain.value = 0;
  const irBuffer = (data: Float32Array): AudioBuffer => {
    const b = c.createBuffer(1, data.length, c.sampleRate);
    b.getChannelData(0).set(data);
    return b;
  };
  rvConv.buffer = irBuffer(impulseResponse(c.sampleRate, s.fx.size, s.fx.damp, random('ir')));
  rvIn.connect(rvConv);
  rvConv.connect(rvOut);
  rvOut.connect(bus);

  // Kanalzüge: Fader → Panner → Bus, Reverb-Send hinter dem Fader (die Schleife füllt alle Kanäle)
  const chan = {} as Record<ChannelId, ChannelNodes>;
  for (const id of CHANNELS) {
    const inn = c.createGain();
    const pan = c.createStereoPanner();
    const snd = c.createGain();
    inn.connect(pan);
    pan.connect(bus);
    inn.connect(snd);
    snd.connect(rvIn);
    chan[id] = { in: inn, pan, snd };
  }
  // ein Eingang pro Synth-Stimme mit Delay-Send
  const parts = {} as Record<Part, { inp: GainNode; lvl: GainNode; snd: GainNode }>;
  for (const id of PARTS) {
    const inp = c.createGain();
    const lvl = c.createGain();
    const snd = c.createGain();
    inp.connect(lvl);
    lvl.connect(chan[id].in);
    lvl.connect(snd);
    snd.connect(dly);
    parts[id] = { inp, lvl, snd };
  }
  const partFx: Record<Part, PartFxChain | undefined> = { BA: undefined, LD: undefined };

  let stutter: Stutter | null = null;
  const makeStutter = (): Stutter => {
    const st: Stutter = {
      inp: c.createGain(),
      dly: c.createDelay(2),
      fb: c.createGain(),
      out: c.createGain(),
      on: false,
    };
    st.inp.gain.value = 0;
    st.fb.gain.value = 0;
    st.out.gain.value = 0;
    bus.connect(st.inp);
    st.inp.connect(st.dly);
    st.dly.connect(st.fb);
    st.fb.connect(st.dly);
    st.dly.connect(st.out);
    st.out.connect(djIn);
    return st;
  };

  // Punch-Einsätze: Abgriff hinter dem Bus, Einspeisung vor dem DJ-Filter (wie der Stutter)
  const insert = (middle: AudioNode[]): Insert => {
    const inp = c.createGain();
    const out = c.createGain();
    inp.gain.value = 0;
    out.gain.value = 0;
    bus.connect(inp);
    let prev: AudioNode = inp;
    for (const n of middle) {
      prev.connect(n);
      prev = n;
    }
    prev.connect(out);
    out.connect(djIn);
    return { inp, out };
  };
  let tape: (Insert & { dly: DelayNode }) | null = null;
  const makeTape = () => {
    const dly = c.createDelay(1);
    dly.delayTime.value = 0;
    return { ...insert([dly]), dly };
  };
  let crush: Insert | null = null;
  const makeCrush = (): Insert => {
    const sh = c.createWaveShaper();
    // Treppe mit 12 Stufen: grob quantisiert wie ein alter Sampler
    sh.curve = Float32Array.from(
      { length: 4096 },
      (_, i) => Math.round((i / 4095) * 2 * 6 - 6) / 6,
    );
    return insert([sh]);
  };
  let echo: (Insert & { dly: DelayNode }) | null = null;
  const makeEcho = () => {
    const dly = c.createDelay(2);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3000;
    const fbk = c.createGain();
    fbk.gain.value = 0.55;
    const e = insert([dly, lp]);
    lp.connect(fbk);
    fbk.connect(dly);
    e.out.gain.value = 0.7;
    return { ...e, dly };
  };
  /**
   * Weich von einem bekannten Wert zu einem neuen (Muster des Stutters): halten, Anker setzen, Rampe.
   * Ohne Anker beginnt eine Rampe beim letzten Ereignis (oft 0 s) statt jetzt.
   */
  /**
   * Geplanter Verlauf eines Blend-Parameters (letztes Segment): daraus ergibt sich der echte
   * Startwert der nächsten Blende, auch mitten in einer laufenden (z. B. Tape kurz getippt).
   */
  interface Track {
    start: number;
    from: number;
    to: number;
    dur: number;
  }
  const track = (v: number): Track => ({ start: 0, from: v, to: v, dur: 0 });
  const valueOf = (k: Track, t: number): number =>
    t <= k.start
      ? k.from
      : t >= k.start + k.dur
        ? k.to
        : k.from + ((k.to - k.from) * (t - k.start)) / k.dur;
  /** weich vom aktuellen geplanten Wert auf to: halten, Anker, Rampe (Muster des Stutters) */
  const fadeTo = (p: AudioParam, k: Track, to: number, t: number, dur = 0.008): void => {
    const from = valueOf(k, t);
    rampFrom(p, from, to, t, dur);
    Object.assign(k, { start: t, from, to, dur });
  };
  const dryTrack = track(1);
  /** trockenes Signal weich aus- bzw. einblenden (ersetzende Effekte) */
  const dry = (on: boolean, t: number): void => {
    fadeTo(dryG.gain, dryTrack, on ? 1 : 0, t);
  };
  const tapeTrack = track(0);
  const crushTrack = track(0);
  const echoTrack = track(0);
  /** laufende Filterfahrt: Start (Zeit, Frequenz) für die Rückkehr beim Loslassen */
  const sweeps = new Map<'lp' | 'hp', { t0: number; from: number; to: number }>();
  const sweepAt = (k: 'lp' | 'hp', t: number): number | null => {
    const sw = sweeps.get(k);
    if (!sw) return null;
    const x = Math.min(1, Math.max(0, (t - sw.t0) / SWEEP_S));
    return sw.from * Math.pow(sw.to / sw.from, x);
  };

  let scopeNode: AnalyserNode | null = null;

  let tone: Tone = { warm: false, tape: 0 };
  let chain: ToneChain | null = null;
  let playing = false;
  const curves = new Map<number, Float32Array>();
  const buildChain = (t: number): ToneChain => {
    const inp = c.createGain();
    inp.gain.value = 1 / TAPE_RANGE;
    const sat = c.createWaveShaper();
    const wow = c.createDelay(0.05);
    wow.delayTime.value = WOW_BASE;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 18000;
    lp.Q.value = 0.5;
    const lo = c.createBiquadFilter();
    lo.type = 'lowshelf';
    lo.frequency.value = 120;
    lo.gain.value = 0;
    const hi = c.createBiquadFilter();
    hi.type = 'highshelf';
    hi.frequency.value = 7500;
    hi.gain.value = 0;
    inp.connect(sat);
    sat.connect(wow);
    wow.connect(lp);
    lp.connect(lo);
    lo.connect(hi);
    // Eiern: zwei langsame Sinusse modulieren die Verzögerung (Wow tief, Flutter schnell)
    const lfo = (hz: number): { osc: OscillatorNode; depth: GainNode } => {
      const osc = c.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = hz;
      const depth = c.createGain();
      depth.gain.value = 0;
      osc.connect(depth);
      depth.connect(wow.delayTime);
      osc.start(t);
      return { osc, depth };
    };
    const w = lfo(0.55);
    const f = lfo(6.3);
    const hiss = c.createGain();
    hiss.gain.value = 0;
    const src = c.createBufferSource();
    const buf = c.createBuffer(1, c.sampleRate * 3, c.sampleRate);
    buf.getChannelData(0).set(vinylNoise(c.sampleRate, 3, random('tape')));
    src.buffer = buf;
    src.loop = true;
    src.connect(hiss);
    hiss.connect(lo);
    src.start(t);
    return {
      inp,
      sat,
      wow,
      wowDepth: w.depth,
      flutterDepth: f.depth,
      lp,
      lo,
      hi,
      hiss,
      sources: [w.osc, f.osc, src],
      level: -1,
    };
  };
  const applyTone = (ch: ToneChain, t: number, direct: boolean): void => {
    const level = Math.round(tone.tape * TAPE_STEPS);
    if (level !== ch.level) {
      let curve = curves.get(level);
      if (!curve) {
        curve = tapeCurve(level / TAPE_STEPS);
        curves.set(level, curve);
      }
      ch.sat.curve = curve as Float32Array<ArrayBuffer>;
      ch.level = level;
    }
    const ts = tapeSettings(tone.tape);
    const set = (p: AudioParam, v: number): void => {
      if (direct) p.value = v;
      else p.setTargetAtTime(v, t, 0.03);
    };
    set(ch.lp.frequency, ts.lp);
    set(ch.wowDepth.gain, ts.wow);
    set(ch.flutterDepth.gain, ts.flutter);
    set(ch.lo.gain, tone.warm ? WARM_LOW_DB : 0);
    set(ch.hi.gain, tone.warm ? WARM_HIGH_DB : 0);
    set(ch.hiss.gain, playing ? ts.noise : 0);
  };
  const dropChain = (ch: ToneChain, t: number): void => {
    try {
      djHP.disconnect(ch.inp);
      ch.hi.disconnect();
    } catch {
      /* schon getrennt */
    }
    djHP.connect(comp);
    for (const s of ch.sources) {
      try {
        s.stop(t);
      } catch {
        /* schon gestoppt */
      }
    }
  };
  const routeTone = (t: number, direct: boolean): void => {
    const active = tone.warm || tone.tape > 0;
    if (active && !chain) {
      chain = buildChain(t);
      try {
        djHP.disconnect(comp);
      } catch {
        /* nicht verbunden */
      }
      djHP.connect(chain.inp);
      chain.hi.connect(comp);
      applyTone(chain, t, true);
    } else if (active && chain) applyTone(chain, t, direct);
    else if (chain) {
      dropChain(chain, t);
      chain = null;
    }
  };

  const graph: Graph = {
    ctx,
    bus,
    noise,
    kick,
    chan,
    parts,
    setMaster(v, t) {
      if (t === null) master.gain.value = masterGain(v);
      else master.gain.setTargetAtTime(masterGain(v), t, 0.02);
    },
    applyChannel(id, ch, aud, t) {
      const n = chan[id];
      const g = channelGain(ch, aud);
      const pn = channelPan(ch);
      if (t === null) {
        n.in.gain.value = g;
        n.pan.pan.value = pn;
        n.snd.gain.value = ch.r;
        return;
      }
      n.in.gain.setTargetAtTime(g, t, 0.015);
      n.pan.pan.setTargetAtTime(pn, t, 0.02);
      n.snd.gain.setTargetAtTime(ch.r, t, 0.02);
    },
    applyFx(fx, t) {
      const { lp, hp, q } = djFilter(fx);
      if (t === null) {
        rvOut.gain.value = reverbReturn(fx);
        djLP.frequency.value = lp;
        djHP.frequency.value = hp;
        djLP.Q.value = q;
        djHP.Q.value = q;
        return;
      }
      rvOut.gain.setTargetAtTime(reverbReturn(fx), t, 0.03);
      djLP.frequency.setTargetAtTime(lp, t, 0.02);
      djHP.frequency.setTargetAtTime(hp, t, 0.02);
      djLP.Q.setTargetAtTime(q, t, 0.02);
      djHP.Q.setTargetAtTime(q, t, 0.02);
    },
    syncSynth(st, aud, t) {
      dly.delayTime.setTargetAtTime(delayTime(st.tempo), t, 0.05);
      for (const id of PARTS) {
        const p = st.synth[id];
        parts[id].lvl.gain.setTargetAtTime(aud[id] ? p.lvl * p.lvl : 0, t, 0.02);
        parts[id].snd.gain.setTargetAtTime(p.dly * 0.7, t, 0.02);
      }
    },
    setPartFx(part, fx, t) {
      let chain = partFx[part];
      if (!chain) {
        if (!fx.drive && !fx.chorus) return false;
        chain = createPartFx(c, parts[part].inp, parts[part].lvl);
        partFx[part] = chain;
      }
      chain.set(fx, t);
      return chain.idle;
    },
    releasePartFx(part) {
      const chain = partFx[part];
      if (!chain?.idle) return;
      chain.dispose();
      partFx[part] = undefined;
    },
    muteReverb(t) {
      rvOut.gain.setTargetAtTime(0, t, 0.01);
    },
    replaceReverb(ir, fx, t) {
      // neuer Convolver statt neuem Buffer am alten Knoten (portabel); alter Hall ist schon stumm
      const nc = c.createConvolver();
      const old = rvConv;
      nc.buffer = irBuffer(ir);
      rvIn.connect(nc);
      nc.connect(rvOut);
      try {
        rvIn.disconnect(old);
        old.disconnect();
      } catch {
        /* schon getrennt */
      }
      rvConv = nc;
      graph.applyFx(fx, t);
    },
    stutterOn(t, P) {
      stutter ??= makeStutter();
      const st = stutter;
      for (const p of [st.inp.gain, st.fb.gain, st.out.gain]) holdAt(p, t);
      // trockenes Signal während der Aufnahme (P) hörbar, auch wenn ein Effekt es vorher stumm hatte
      dry(true, t);
      st.dly.delayTime.cancelScheduledValues(t);
      st.dly.delayTime.setValueAtTime(P, t);
      st.inp.gain.setValueAtTime(1, t);
      st.inp.gain.setValueAtTime(1, t + P);
      st.inp.gain.linearRampToValueAtTime(0, t + P + 0.003);
      st.fb.gain.setValueAtTime(0.999, t);
      st.out.gain.setValueAtTime(0, t + P - 0.001);
      st.out.gain.linearRampToValueAtTime(1, t + P + 0.003);
      dryG.gain.setValueAtTime(1, t + P - 0.001);
      dryG.gain.linearRampToValueAtTime(0, t + P + 0.003);
      Object.assign(dryTrack, { start: t + P - 0.001, from: 1, to: 0, dur: 0.004 });
      st.on = true;
    },
    punchOn(kind, t, tempo, fx) {
      if (kind === 'lp' || kind === 'hp') {
        const f = kind === 'lp' ? djLP.frequency : djHP.frequency;
        const from = kind === 'lp' ? djFilter(fx).lp : djFilter(fx).hp;
        const to = kind === 'lp' ? LP_TARGET : HP_TARGET;
        sweeps.set(kind, { t0: t, from, to });
        holdAt(f, t);
        f.setValueAtTime(from, t);
        f.exponentialRampToValueAtTime(to, t + SWEEP_S);
        return;
      }
      if (kind === 'echo') {
        echo ??= makeEcho();
        echo.dly.delayTime.setValueAtTime(Math.min(1.9, (3 * 60) / tempo / 4), t);
        fadeTo(echo.inp.gain, echoTrack, 1, t);
        return;
      }
      if (kind === 'tape') {
        tape ??= makeTape();
        const tp = tape;
        // Verzögerung wächst quadratisch (Tonhöhe fällt linear von 1 auf 0 in TAPE_S), als verankerte
        // Rampen-Segmente: anders als setValueCurveAtTime überlappen sie nie mit anderer Automation
        const dt = tp.dly.delayTime;
        holdAt(dt, t);
        dt.setValueAtTime(0, t);
        for (let i = 1; i <= 8; i++)
          dt.linearRampToValueAtTime((i / 8) ** 2 * (TAPE_S / 2), t + (i / 8) * TAPE_S);
        holdAt(tp.inp.gain, t);
        tp.inp.gain.setValueAtTime(1, t);
        fadeTo(tp.out.gain, tapeTrack, 1, t);
        tp.out.gain.linearRampToValueAtTime(0, t + TAPE_S);
        Object.assign(tapeTrack, { start: t + 0.008, from: 1, to: 0, dur: TAPE_S - 0.008 });
        dry(false, t);
        return;
      }
      crush ??= makeCrush();
      holdAt(crush.inp.gain, t);
      crush.inp.gain.setValueAtTime(1, t);
      fadeTo(crush.out.gain, crushTrack, CRUSH_LEVEL, t);
      dry(false, t);
    },
    punchOff(kind, t, fx) {
      if (kind === 'lp' || kind === 'hp') {
        const cur = sweepAt(kind, t);
        if (cur === null) return;
        sweeps.delete(kind);
        const f = kind === 'lp' ? djLP.frequency : djHP.frequency;
        holdAt(f, t);
        f.setValueAtTime(cur, t);
        f.exponentialRampToValueAtTime(kind === 'lp' ? djFilter(fx).lp : djFilter(fx).hp, t + 0.05);
        return;
      }
      if (kind === 'echo') {
        if (!echo) return;
        fadeTo(echo.inp.gain, echoTrack, 0, t);
        return;
      }
      const ins = kind === 'tape' ? tape : crush;
      if (!ins) return;
      fadeTo(ins.out.gain, kind === 'tape' ? tapeTrack : crushTrack, 0, t);
      holdAt(ins.inp.gain, t + 0.02);
      ins.inp.gain.setValueAtTime(0, t + 0.02);
      if (kind === 'tape' && tape) {
        holdAt(tape.dly.delayTime, t + 0.02);
        tape.dly.delayTime.setValueAtTime(0, t + 0.02);
      }
      dry(true, t);
    },
    analyser() {
      if (!scopeNode) {
        scopeNode = c.createAnalyser();
        scopeNode.fftSize = 512;
        master.connect(scopeNode);
      }
      return scopeNode;
    },
    setTone(next, t) {
      if (sameTone(next, tone)) return;
      tone = next;
      routeTone(t, false);
    },
    setPlaying(on, t) {
      playing = on;
      // der Offline-Export startet knapp vor 0: Zeiten nie negativ
      if (chain)
        chain.hiss.gain.setTargetAtTime(
          on ? tapeSettings(tone.tape).noise : 0,
          Math.max(0, t),
          0.05,
        );
    },
    stutterOff(t) {
      const st = stutter;
      if (!st?.on) return;
      st.on = false;
      for (const p of [st.inp.gain, st.fb.gain, st.out.gain]) holdAt(p, t);
      dry(true, t);
      st.out.gain.linearRampToValueAtTime(0, t + 0.008);
      st.inp.gain.setValueAtTime(0, t);
      st.fb.gain.linearRampToValueAtTime(0, t + 0.02);
    },
  };

  // Anfangszustand wie Legacy setupGraph: Kanäle und FX direkt, Synth-Sends weich ab currentTime
  for (const id of CHANNELS) graph.applyChannel(id, s.mix[id], audible[id], null);
  graph.applyFx(s.fx, null);
  graph.syncSynth(s, audible, c.currentTime);
  for (const id of PARTS) graph.setPartFx(id, s.synth[id], null);
  tone = toneOf(s);
  routeTone(c.currentTime, true);
  return graph;
}
