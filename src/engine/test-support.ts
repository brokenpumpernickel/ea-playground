import type { Rng } from '../run/rng';

/** A generator that returns the given draws in order, so a test controls exactly where each random decision lands. */
export function scripted(...draws: number[]): Rng & { readonly used: number } {
  let k = 0;
  return {
    get used() {
      return k;
    },
    next() {
      const value = draws[k++];
      if (value === undefined) throw new Error(`scripted generator ran out of draws after ${draws.length}`);
      return value;
    },
  };
}
