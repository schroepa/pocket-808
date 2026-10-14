export type Rng = () => number;

/** Kleiner, reproduzierbarer Zufallsgenerator. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a über einen Text. */
export function tagHash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

/**
 * Zufall je Zweck ('graph', 'ir', 'voice:<i>', 'factory'), reproduzierbar aus einem Seed.
 * Entspricht dem Neustart des Zufalls in der Legacy-Harness; 'factory' ist der Grundstrom.
 */
export function seededRandom(seed: number): (tag: string) => Rng {
  return (tag) => (tag === 'factory' ? mulberry32(seed) : mulberry32(tagHash(`${seed}:${tag}`)));
}
