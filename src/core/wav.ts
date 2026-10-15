import { must } from './util.ts';

/** PCM-Kanäle → WAV (RIFF, 16 Bit, verschränkt). Werte werden auf ±1 begrenzt. */
export function encodeWav(
  channels: readonly Float32Array[],
  sampleRate: number,
): Uint8Array<ArrayBuffer> {
  const ch = channels.length;
  const frames = must(channels[0], 'mindestens ein Kanal').length;
  const bytes = frames * ch * 2;
  const out = new Uint8Array(44 + bytes);
  const v = new DataView(out.buffer);
  const text = (at: number, s: string): void => {
    for (let i = 0; i < s.length; i++) out[at + i] = s.charCodeAt(i);
  };
  text(0, 'RIFF');
  v.setUint32(4, 36 + bytes, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, ch, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * ch * 2, true);
  v.setUint16(32, ch * 2, true);
  v.setUint16(34, 16, true);
  text(36, 'data');
  v.setUint32(40, bytes, true);
  let at = 44;
  for (let f = 0; f < frames; f++) {
    for (const c of channels) {
      // alle Kanäle sind gleich lang: c[f] ist immer eine Zahl
      const x = Math.max(-1, Math.min(1, Number(c[f])));
      v.setInt16(at, Math.round(x * 32767), true);
      at += 2;
    }
  }
  return out;
}
