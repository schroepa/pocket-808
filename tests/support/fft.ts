/** Betragsspektrum einer reellen Folge (iterative Radix-2-FFT). Länge des Ergebnisses: n/2 + 1. */
export function magnitudeSpectrum(input: Float64Array): Float64Array {
  const n = input.length;
  if (n === 0 || (n & (n - 1)) !== 0) {
    throw new RangeError(`FFT-Länge muss eine Zweierpotenz sein, war ${n}`);
  }
  const re = Float64Array.from(input);
  const im = new Float64Array(n);
  // Bit-Umkehr-Permutation
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const t = re[i]!;
      re[i] = re[j]!;
      re[j] = t;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    const half = len >> 1;
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < half; k++) {
        const a = i + k;
        const b = a + half;
        const xr = re[b]! * cr - im[b]! * ci;
        const xi = re[b]! * ci + im[b]! * cr;
        re[b] = re[a]! - xr;
        im[b] = im[a]! - xi;
        re[a] = re[a]! + xr;
        im[a] = im[a]! + xi;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
  const out = new Float64Array((n >> 1) + 1);
  for (let k = 0; k < out.length; k++) out[k] = Math.hypot(re[k]!, im[k]!);
  return out;
}
