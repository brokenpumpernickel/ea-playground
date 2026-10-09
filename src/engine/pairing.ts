/** Two neighbouring slots of the mating pool. Slots and pairs are numbered from 1. */
export interface Pair {
  readonly pair: number;
  readonly slotA: number;
  readonly slotB: number;
  readonly parentAId: number;
  readonly parentBId: number;
  /** True for the last pair when an odd number of offspring was requested: only its first child is kept. */
  readonly secondChildDropped: boolean;
}

export type PairingEvent = { readonly stage: 'pairing'; readonly kind: 'pair' } & Pair;

/**
 * How many parents selection must draw for a number of offspring. Each pair makes two children, so an odd
 * count needs one extra parent, and the last pair's second child is dropped.
 */
export function matingPoolSize(offspringCount: number): number {
  return offspringCount + (offspringCount % 2);
}

/** Pairs neighbours in the mating pool (1+2, 3+4, …). The pool is already random, so pairing makes no random draws. */
export function pair(
  pool: readonly number[],
  offspringCount: number,
): { pairs: Pair[]; events: PairingEvent[] } {
  const needed = matingPoolSize(offspringCount);
  if (pool.length !== needed) {
    throw new Error(`Pairing ${offspringCount} offspring needs a mating pool of ${needed} parents, but the pool has ${pool.length}`);
  }
  const pairs = Array.from({ length: needed / 2 }, (_, k): Pair => ({
    pair: k + 1,
    slotA: 2 * k + 1,
    slotB: 2 * k + 2,
    parentAId: pool[2 * k]!,
    parentBId: pool[2 * k + 1]!,
    secondChildDropped: offspringCount % 2 === 1 && k === needed / 2 - 1,
  }));
  return { pairs, events: pairs.map((p): PairingEvent => ({ stage: 'pairing', kind: 'pair', ...p })) };
}
