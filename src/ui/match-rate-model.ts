import type { GenerationMetrics } from '../engine';

/** For each position of the target, the share of the population that has the target's letter there. */
export interface MatchRate {
  /** 1-based position. */
  readonly position: number;
  /** The target's letter at this position, as it is written (a space is a space). */
  readonly letter: string;
  readonly share: number;
}

/**
 * Read from the metrics' per-position symbol counts, so it is exactly the population the rest of the screen shows.
 * `alphabet` is the problem's, to find where each target letter sits in it.
 */
export function matchRates(metrics: GenerationMetrics, target: string, alphabet: readonly string[]): MatchRate[] {
  const size = metrics.symbolCounts[0]?.reduce((a, b) => a + b, 0) ?? 0;
  return [...target].map((letter, k) => ({
    position: k + 1,
    letter,
    share: size === 0 ? 0 : (metrics.symbolCounts[k]?.[alphabet.indexOf(letter)] ?? 0) / size,
  }));
}

/** "H 42%": what a bar says, for the accessible description. */
export const describeMatchRates = (rates: readonly MatchRate[]): string =>
  `Share of individuals with the target's letter at each position: ${rates.map((r) => `position ${r.position}, ${r.letter === ' ' ? 'space' : r.letter}, ${Math.round(r.share * 100)} percent`).join('; ')}.`;
