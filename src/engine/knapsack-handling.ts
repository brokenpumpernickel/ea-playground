import type { Chromosome } from './chromosome';
import { bagValue, bagWeight, itemName, type KnapsackInstance } from './knapsack-instance';
import type { Scores } from './problem';

/**
 * The four ways of dealing with a bag that may be too heavy (see the spec): the first-fit decoder, a penalty on
 * fitness, and repair that either writes the repaired genes back (Lamarckian) or only scores the repaired bag
 * (Baldwinian).
 */
export type Handling = 'decoder' | 'penalty' | 'repair-lamarckian' | 'repair-baldwinian';

export const handlings: readonly Handling[] = ['decoder', 'penalty', 'repair-lamarckian', 'repair-baldwinian'];

/** Everything the views need to explain how a chromosome was scored. */
export interface BagOutcome {
  /** The genes after handling: unchanged, except under Lamarckian repair, where dropped items become 0. */
  readonly genes: Chromosome;
  /** Which items are in the bag. */
  readonly packed: readonly boolean[];
  readonly weight: number;
  readonly value: number;
  /** How far the packed set is over the capacity (0 when it fits). Only the penalty method allows more than 0. */
  readonly excess: number;
  readonly penalty: number;
  readonly feasible: boolean;
  readonly fitness: number;
  readonly objective: number;
  /** Decoder: the items whose genes were on but that did not fit, in order, with how much room was left when they were reached. */
  readonly skipped: readonly { readonly item: number; readonly weight: number; readonly room: number }[];
  /** Repair: the items taken out, in order, with their value per weight. */
  readonly dropped: readonly { readonly item: number; readonly ratio: number }[];
  /** Lamarckian repair only, and only when something was dropped: the chromosome after repair. */
  readonly repaired?: Chromosome;
  /** The scores in the form the engine takes. */
  readonly scores: Scores;
}

/** Scores a chromosome of 0s and 1s (one gene per item) under a handling method. `rho` is the penalty per unit of excess weight. */
export function handleBag(instance: KnapsackInstance, handling: Handling, rho: number, chromosome: readonly number[]): BagOutcome {
  const n = instance.items.length;
  if (chromosome.length !== n) throw new Error(`A chromosome needs one gene per item (${n}), but this one has ${chromosome.length}`);
  if (handling === 'penalty' && !(Number.isFinite(rho) && rho >= 0)) throw new Error('The penalty ρ must be a number of at least 0');
  const on = chromosome.map((g) => g === 1);
  const skipped: { item: number; weight: number; room: number }[] = [];
  const dropped: { item: number; ratio: number }[] = [];
  let packed = on;

  if (handling === 'decoder') {
    // walk the items in order: pack one whose gene is on if it still fits, otherwise skip it and carry on
    let weight = 0;
    packed = on.map((isOn, i) => {
      if (!isOn) return false;
      const item = instance.items[i]!;
      const room = instance.capacity - weight;
      if (item.weight <= room) {
        weight += item.weight;
        return true;
      }
      skipped.push({ item: i, weight: item.weight, room });
      return false;
    });
  } else if (handling === 'repair-lamarckian' || handling === 'repair-baldwinian') {
    packed = on.slice();
    let weight = bagWeight(instance, packed);
    while (weight > instance.capacity) {
      const out = lowestRatio(instance, packed);
      packed[out] = false;
      weight -= instance.items[out]!.weight;
      dropped.push({ item: out, ratio: instance.items[out]!.value / instance.items[out]!.weight });
    }
  }

  const weight = bagWeight(instance, packed);
  const value = bagValue(instance, packed);
  const excess = Math.max(0, weight - instance.capacity);
  const penalty = handling === 'penalty' ? rho * excess : 0;
  const fitness = value - penalty;
  const rewritten = handling === 'repair-lamarckian' && dropped.length > 0;
  const genes = rewritten ? packed.map((p) => (p ? 1 : 0)) : [...chromosome];
  const feasible = excess === 0;
  const scores: Scores = {
    decoded: packed.flatMap((p, i) => (p ? [itemName(i)] : [])).join(''),
    objective: value,
    fitness,
    feasible,
    ...(rewritten ? { repaired: genes } : {}),
  };
  return {
    genes,
    packed,
    weight,
    value,
    excess,
    penalty,
    feasible,
    fitness,
    objective: value,
    skipped,
    dropped,
    ...(rewritten ? { repaired: genes } : {}),
    scores,
  };
}

/** The packed item with the lowest value per weight; among equal ratios the later item. Compared by cross-multiplying, so it is exact. */
function lowestRatio(instance: KnapsackInstance, packed: readonly boolean[]): number {
  let worst = -1;
  packed.forEach((isPacked, i) => {
    if (!isPacked) return;
    if (worst < 0) {
      worst = i;
      return;
    }
    const a = instance.items[i]!;
    const b = instance.items[worst]!;
    if (a.value * b.weight <= b.value * a.weight) worst = i; // `<=`: a tie goes to the later item
  });
  return worst;
}
