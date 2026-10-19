import type { Individual } from './initialize';
import type { Rng } from '../run/rng';
import type { CrowdingDrawEvent, CrowdingSetupEvent } from './crowding';
import type { TournamentEvent, TournamentSetupEvent } from './tournament';

/** One row of the roulette wheel: the individual's weight, and the slice of [0, 1) a spin must land in to pick it. */
export interface SelectionEntry {
  readonly individualId: number;
  readonly weight: number;
  readonly probability: number;
  /** The individual is picked when lo ≤ r < hi. */
  readonly lo: number;
  readonly hi: number;
}

/**
 * Fitness sharing (see niching.ts): the weights the selection was going to use, how crowded each individual\'s neighbourhood is,
 * and the weights it uses instead (the first divided by the second). Said once, before the wheel or the tournaments.
 */
export interface SharingEvent {
  readonly stage: 'selection';
  readonly kind: 'sharing';
  /** Which selection uses the shared weights: the wheel spins on them, the tournaments compare them. */
  readonly method: 'roulette' | 'tournament';
  readonly sigma: number;
  readonly alpha: number;
  /** The individuals, in population order; the arrays below are in the same order. */
  readonly individualIds: readonly number[];
  readonly before: readonly number[];
  readonly counts: readonly number[];
  readonly shared: readonly number[];
  /** Tournament only: the fitness could be zero or negative, so it was shifted to positive (fitness − lowest + 1) before the division. */
  readonly shifted: boolean;
}

export type SelectionEvent =
  | SharingEvent
  | CrowdingSetupEvent
  | CrowdingDrawEvent
  | { readonly stage: 'selection'; readonly kind: 'probabilities'; readonly entries: readonly SelectionEntry[] }
  /** One spin: the random number r and the individual whose interval contained it. Spins are numbered from 1. */
  | { readonly stage: 'selection'; readonly kind: 'spin'; readonly spin: number; readonly r: number; readonly individualId: number }
  | TournamentSetupEvent
  | TournamentEvent;

export interface SelectionResult {
  /** Ids of the selected parents, in spin order. An individual can appear more than once. */
  readonly pool: readonly number[];
  readonly events: readonly SelectionEvent[];
}

export function rouletteSelect(
  population: readonly Individual[],
  weights: readonly number[],
  count: number,
  rng: Rng,
): SelectionResult {
  if (!Number.isInteger(count) || count < 0) throw new Error('The number of spins must be a whole number of at least 0');
  const total = validatedTotal(population, weights);
  let lo = 0;
  const entries = population.map((individual, k): SelectionEntry => {
    const weight = weights[k]!;
    const hi = lo + weight / total;
    const entry = { individualId: individual.id, weight, probability: weight / total, lo, hi };
    lo = hi;
    return entry;
  });
  const events: SelectionEvent[] = [{ stage: 'selection', kind: 'probabilities', entries }];
  const pool: number[] = [];
  for (let spin = 1; spin <= count; spin++) {
    const r = rng.next();
    const individualId = spinWheel(entries, r);
    pool.push(individualId);
    events.push({ stage: 'selection', kind: 'spin', spin, r, individualId });
  }
  return { pool, events };
}

/** Roulette needs non-negative, finite weights with a positive sum; anything else is refused rather than quietly repaired. */
function validatedTotal(population: readonly Individual[], weights: readonly number[]): number {
  if (weights.length !== population.length) {
    throw new Error(`Expected ${population.length} selection weights but got ${weights.length}`);
  }
  weights.forEach((weight, k) => {
    const id = population[k]!.id;
    if (!Number.isFinite(weight)) throw new Error(`Selection weight of individual ${id} is not a finite number`);
    if (weight < 0) throw new Error(`Selection weight of individual ${id} is negative (${weight})`);
  });
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (total <= 0) throw new Error('All selection weights are zero, so no individual can be selected');
  return total;
}

/**
 * The individual whose interval contains r. Zero-weight individuals have empty intervals and are never picked.
 * Rounding can leave the last upper edge a hair below 1, so a draw past every edge falls to the last individual with weight.
 */
function spinWheel(entries: readonly SelectionEntry[], r: number): number {
  const hit = entries.find((e) => e.weight > 0 && r < e.hi);
  if (hit) return hit.individualId;
  return [...entries].reverse().find((e) => e.weight > 0)!.individualId;
}
