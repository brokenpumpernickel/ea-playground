import type { BagOutcome, KnapsackItem } from '../engine';

/**
 * Where a view finds the knapsack it is drawing chromosomes for: the items (for the item row above the cells), the
 * capacity, and how any chromosome is packed and scored (for the skipped-gene marks and the chromosome's description).
 * The app sets it once for the whole screen (a getter, so it follows the running problem); with no knapsack running
 * (the other problems, or a view drawn on its own in a test) it gives nothing and nothing changes.
 */
export const bagContextKey = Symbol('knapsack');

export interface BagInfo {
  readonly items: readonly KnapsackItem[];
  readonly capacity: number;
  outcomeOf(chromosome: readonly number[]): BagOutcome;
}

export type BagGetter = () => BagInfo | undefined;
