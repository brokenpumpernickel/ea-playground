/**
 * Seeded random number generator: mulberry32 (Tommy Ettinger, public domain).
 *
 * One 32-bit integer of state, so a run's generator state fits in a snapshot and any generation can be
 * regenerated exactly (ADR 0001). It is fast and well distributed for teaching use, but it is not
 * cryptographic, and with a 32-bit state it repeats after at most 2^32 draws.
 *
 * Every random decision in the engine must come from here, never from the platform's unseeded generator.
 */
export interface Rng {
  /** Next value, uniformly distributed in [0, 1). */
  next(): number;
}

export function createRng(seed: number): Rng {
  let state = seed | 0;
  return {
    next() {
      state = (state + 0x6d2b79f5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}
