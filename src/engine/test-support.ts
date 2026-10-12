import type { Bounds, Problem } from './problem';
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

/**
 * A small real-valued problem for tests of the representation: maximise −Σ x² (the best point is the origin), with the
 * given bounds, one gene per bound.
 */
export function realSphere(bounds: readonly Bounds[]): Problem {
  return {
    chromosomeLength: bounds.length,
    alphabet: [],
    bounds,
    columns: [],
    evaluate(chromosome) {
      const objective = chromosome.reduce((total, x) => total + x * x, 0);
      return { decoded: chromosome.join(' '), objective, fitness: 0 - objective }; // 0 − 0 is 0, where −0 would be negative zero
    },
  };
}
