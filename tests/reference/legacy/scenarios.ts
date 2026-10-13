import { fingerprint, type Fingerprint } from '../../support/fingerprint.ts';
import { loadLegacy, type LegacyPage } from './harness.ts';
import type { DrumParams } from './types.ts';

export interface StereoPrint {
  L: Fingerprint;
  R: Fingerprint;
}

export async function renderStereo(p: LegacyPage): Promise<StereoPrint> {
  const buf = await p.ctx().startRendering();
  const right = buf.numberOfChannels > 1 ? 1 : 0;
  return {
    L: fingerprint(buf.getChannelData(0), buf.sampleRate),
    R: fingerprint(buf.getChannelData(right), buf.sampleRate),
  };
}

/** Prüft die Kette Kindprozess → jsdom → Audio: ein kurzer Synth-Ton. */
export async function smoke(): Promise<{ errors: string[]; peak: number }> {
  const p = loadLegacy({ audio: { seconds: 0.5 } });
  try {
    if (!p.t.ensureAudio()) throw new Error('Audio-Kontext fehlt');
    p.setNow(0.001);
    p.t.applyMixAll();
    p.setNow(0);
    p.t.synthNote('BA', 45, 0.05, 0.2);
    const print = await renderStereo(p);
    return { errors: p.errors, peak: print.L.peak };
  } finally {
    p.close();
  }
}

/** Rendert eine Drum-Stimme über den Legacy-Vorrender-Pfad (renderVoice) in mehreren Parameter-Varianten. */
export async function drumVariants(args: {
  voice: string;
  seed?: number;
  variants: Record<string, Partial<DrumParams>>;
}): Promise<Record<string, Fingerprint>> {
  const p = loadLegacy({ seed: args.seed ?? 1, audio: { seconds: 1 } });
  try {
    if (!p.t.ensureAudio()) throw new Error('Audio-Kontext fehlt');
    const index = p.t.VOICES.findIndex((v) => v.id === args.voice);
    const params = p.t.state.params[args.voice];
    if (index < 0 || !params) throw new Error(`Unbekannte Stimme ${args.voice}`);
    const base = { ...params };
    const out: Record<string, Fingerprint> = {};
    for (const [name, change] of Object.entries(args.variants)) {
      Object.assign(params, base, change);
      // renderVoice verschluckt Fehler: alten Buffer entfernen, damit nichts Veraltetes durchrutscht
      p.t.voiceBuf[args.voice] = undefined;
      await p.t.renderVoice(index);
      const buf = p.t.voiceBuf[args.voice];
      if (!buf) throw new Error(`Kein Buffer für ${args.voice}/${name}`);
      out[name] = fingerprint(buf.getChannelData(0), buf.sampleRate);
    }
    return out;
  } finally {
    p.close();
  }
}

export const SCENARIOS: Record<string, (args: never) => Promise<unknown>> = { smoke, drumVariants };
