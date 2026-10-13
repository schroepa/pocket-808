import { fingerprint, type Fingerprint } from '../../support/fingerprint.ts';
import { loadLegacy, type LegacyPage } from './harness.ts';

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

export const SCENARIOS: Record<string, (args: never) => Promise<unknown>> = { smoke };
