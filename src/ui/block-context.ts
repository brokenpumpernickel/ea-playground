import type { Linkage, TrapOutcome } from '../engine';

/**
 * Where a view finds the trap it is drawing chromosomes for: which genes make each block, and how any chromosome scores
 * block by block (for the block row, the contributions and the marks in the operator views). The app sets it once for
 * the whole screen (a getter, so it follows the running problem); with no trap running (the other problems, or a view
 * drawn on its own in a test) it gives nothing and nothing changes.
 */
export const blockContextKey = Symbol('trap');

export interface BlockInfo {
  readonly blockSize: number;
  readonly blocks: number;
  readonly linkage: Linkage;
  /** The 0-based positions of each block's genes. */
  readonly blockGenes: readonly (readonly number[])[];
  /** The best fitness, k × m, and what all zeros scores, m × (k − 1). */
  readonly optimum: number;
  readonly attractor: number;
  outcomeOf(chromosome: readonly number[]): TrapOutcome;
}

export type BlockGetter = () => BlockInfo | undefined;
