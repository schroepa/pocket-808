import { CHANNELS, PARTS } from '../core/constants.ts';
import { channelGain, channelPan, masterGain } from '../core/mix.ts';
import type { Rng } from '../core/random.ts';
import type { ChannelId, Fx, MixChannel, Part, State } from '../core/types.ts';
import {
  delayTime,
  djFilter,
  impulseResponse,
  noiseData,
  reverbReturn,
  softClipCurve,
} from './dsp.ts';
import { holdAt } from './params.ts';

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
  readonly parts: Record<Part, { inp: GainNode; snd: GainNode }>;
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
  /** Momentaner Absolut-Peak am Master (0..1+), fürs LCD; Offline ungenutzt */
  peak(): number;
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
  // Peak-Meter: ein Analyser nach dem Master, vor dem Limiter (kein Einfluss auf den Klang)
  const meter = c.createAnalyser();
  meter.fftSize = 256;
  meter.smoothingTimeConstant = 0.25;
  const peakBuf = new Float32Array(meter.fftSize);
  // Limiter am Ausgang: erlaubt hohe Lautheit, ohne dass Spitzen übersteuern
  const lim = c.createDynamicsCompressor();
  lim.threshold.value = -1.5;
  lim.knee.value = 0;
  lim.ratio.value = 20;
  lim.attack.value = 0.001;
  lim.release.value = 0.08;
  const safe = c.createWaveShaper();
  safe.curve = new Float32Array([-0.98, 0.98]);
  master.connect(meter);
  meter.connect(lim);
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
  const parts = {} as Record<Part, { inp: GainNode; snd: GainNode }>;
  for (const id of PARTS) {
    const inp = c.createGain();
    const snd = c.createGain();
    inp.connect(chan[id].in);
    inp.connect(snd);
    snd.connect(dly);
    parts[id] = { inp, snd };
  }

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
        parts[id].inp.gain.setTargetAtTime(aud[id] ? p.lvl * p.lvl : 0, t, 0.02);
        parts[id].snd.gain.setTargetAtTime(p.dly * 0.7, t, 0.02);
      }
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
      for (const p of [st.inp.gain, st.fb.gain, st.out.gain, dryG.gain]) holdAt(p, t);
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
      st.on = true;
    },
    stutterOff(t) {
      const st = stutter;
      if (!st?.on) return;
      st.on = false;
      for (const p of [st.inp.gain, st.fb.gain, st.out.gain, dryG.gain]) holdAt(p, t);
      dryG.gain.linearRampToValueAtTime(1, t + 0.008);
      st.out.gain.linearRampToValueAtTime(0, t + 0.008);
      st.inp.gain.setValueAtTime(0, t);
      st.fb.gain.linearRampToValueAtTime(0, t + 0.02);
    },
    peak() {
      try {
        meter.getFloatTimeDomainData(peakBuf);
      } catch {
        return 0;
      }
      let p = 0;
      for (const sample of peakBuf) {
        const a = Math.abs(sample);
        if (a > p) p = a;
      }
      return p;
    },
  };

  // Anfangszustand wie Legacy setupGraph: Kanäle und FX direkt, Synth-Sends weich ab currentTime
  for (const id of CHANNELS) graph.applyChannel(id, s.mix[id], audible[id], null);
  graph.applyFx(s.fx, null);
  graph.syncSynth(s, audible, c.currentTime);
  return graph;
}
