import { describe, expect, test } from 'vitest';
import { createRng } from '../run/rng';
import { handleBag, type Handling } from './knapsack-handling';
import { bagValue, bagWeight, builtInKnapsack, itemName, optimalBag, type KnapsackInstance } from './knapsack-instance';

const genes = (letters: string, n = 12) => Array.from({ length: n }, (_, i) => (letters.includes(itemName(i)) ? 1 : 0));
const letters = (bag: readonly boolean[]) => bag.flatMap((b, i) => (b ? [itemName(i)] : [])).join('');
const all = genes('ABCDEFGHIJKL');
const rho = 4;
const run = (handling: Handling, chromosome: readonly number[], instance = builtInKnapsack) => handleBag(instance, handling, rho, chromosome);

describe('penalty', () => {
  test('a bag exactly at capacity has no penalty: A, B, C, E, F weigh 48 and are worth 73', () => {
    const r = run('penalty', genes('ABCEF'));
    expect([r.weight, r.value, r.excess, r.penalty, r.fitness, r.objective, r.feasible]).toEqual([48, 73, 0, 0, 73, 73, true]);
  });

  test('one unit over costs rho: A, B, E, F, G weigh 49, are worth 59, so fitness is 59 minus 4', () => {
    const r = run('penalty', genes('ABEFG'));
    expect([r.weight, r.value, r.excess, r.penalty, r.fitness, r.objective, r.feasible]).toEqual([49, 59, 1, 4, 55, 59, false]);
  });

  test('the packed set is exactly the genes, and fitness can be negative: everything weighs 97, 49 over, 171 - 4 x 49 = -25', () => {
    const r = run('penalty', all);
    expect(letters(r.packed)).toBe('ABCDEFGHIJKL');
    expect([r.excess, r.penalty, r.fitness]).toEqual([49, 196, -25]);
    expect(r.repaired).toBeUndefined();
    expect(r.skipped).toEqual([]);
    expect(r.dropped).toEqual([]);
  });

  test('rho need not be a whole number', () => {
    expect(handleBag(builtInKnapsack, 'penalty', 2.5, genes('ABEFG')).fitness).toBe(59 - 2.5);
  });
});

describe('first-fit decoder', () => {
  const r = run('decoder', all);

  test('walks A, B, C, ... packing what fits: with every gene on it packs A, B, C, D, E, G, H (weight 46, value 88)', () => {
    expect(letters(r.packed)).toBe('ABCDEGH');
    expect([r.weight, r.value, r.fitness, r.objective, r.excess, r.penalty, r.feasible]).toEqual([46, 88, 88, 88, 0, 0, true]);
  });

  test('skips an item that does not fit and still packs a later one that does: F (14) does not fit in the 11 left, G (4) does', () => {
    expect(r.skipped).toEqual([
      { item: 5, weight: 14, room: 11 },
      { item: 8, weight: 11, room: 2 },
      { item: 9, weight: 7, room: 2 },
      { item: 10, weight: 6, room: 2 },
      { item: 11, weight: 13, room: 2 },
    ]);
    expect(r.packed[6]).toBe(true);
  });

  test('never changes the chromosome, and the genes of the skipped items stay 1', () => {
    expect(r.repaired).toBeUndefined();
    expect(r.genes).toEqual(all);
  });

  test('items whose genes are 0 are left out even if they would fit', () => {
    expect(letters(run('decoder', genes('BC')).packed)).toBe('BC');
  });
});

describe('repair', () => {
  test('drops the packed item with the lowest value per weight until the bag fits: with everything on, A, E, I, L, F in that order, leaving 40', () => {
    const r = run('repair-baldwinian', all);
    expect(r.dropped.map((d) => itemName(d.item))).toEqual(['A', 'E', 'I', 'L', 'F']);
    expect(letters(r.packed)).toBe('BCDGHJK');
    expect([r.weight, r.value, r.fitness, r.objective, r.excess, r.penalty, r.feasible]).toEqual([40, 112, 112, 112, 0, 0, true]);
  });

  test('stops as soon as the bag fits, even with more items that could go: over by 1, only the worst item leaves', () => {
    // A, B, E, F, G weigh 49: the lowest ratio is A (4/9), which takes it to 40
    const r = run('repair-baldwinian', genes('ABEFG'));
    expect(r.dropped.map((d) => itemName(d.item))).toEqual(['A']);
    expect(letters(r.packed)).toBe('BEFG');
  });

  test('ties go to the later item: two items with the same ratio, the later one is dropped first', () => {
    const tie: KnapsackInstance = { items: [{ weight: 2, value: 4 }, { weight: 3, value: 6 }, { weight: 10, value: 50 }], capacity: 12 };
    const r = handleBag(tie, 'repair-baldwinian', 1, [1, 1, 1]);
    expect(r.dropped.map((d) => itemName(d.item))).toEqual(['B']);
    expect(letters(r.packed)).toBe('AC');
  });

  test('a chromosome that already fits is not touched, by either repair', () => {
    for (const handling of ['repair-lamarckian', 'repair-baldwinian'] as const) {
      const r = run(handling, genes('BCDFGHK'));
      expect(r.dropped).toEqual([]);
      expect(r.repaired).toBeUndefined();
      expect(r.value).toBe(123);
    }
  });

  test('Lamarckian writes the repaired chromosome back: the genes of the dropped items become 0', () => {
    const r = run('repair-lamarckian', all);
    expect(r.repaired).toEqual(genes('BCDGHJK'));
    expect(r.genes).toEqual(genes('BCDGHJK'));
    expect(r.dropped.map((d) => itemName(d.item))).toEqual(['A', 'E', 'I', 'L', 'F']);
    expect(r.fitness).toBe(112);
  });

  test('Baldwinian leaves the chromosome as it was and scores the repaired bag', () => {
    const r = run('repair-baldwinian', all);
    expect(r.repaired).toBeUndefined();
    expect(r.genes).toEqual(all);
    expect(r.fitness).toBe(112);
  });

  test('each dropped item says its value per weight, so the narration can quote it', () => {
    expect(run('repair-lamarckian', all).dropped.map((d) => Math.round(d.ratio * 100) / 100)).toEqual([0.44, 0.5, 0.73, 1.46, 1.64]);
  });
});

describe('the scores the engine sees', () => {
  test('decoded is the packed letters, feasible is reported by every method, and only Lamarckian repair returns a repaired chromosome', () => {
    for (const handling of ['decoder', 'penalty', 'repair-lamarckian', 'repair-baldwinian'] as const) {
      const outcome = run(handling, all);
      expect(typeof outcome.scores.feasible).toBe('boolean');
      expect(outcome.scores.decoded).toBe(letters(outcome.packed));
      expect('repaired' in outcome.scores).toBe(handling === 'repair-lamarckian');
    }
    expect(run('penalty', all).scores.feasible).toBe(false);
    expect(run('decoder', all).scores.feasible).toBe(true);
  });
});

describe('properties over generated instances and chromosomes', () => {
  const rng = createRng(99);
  const int = (lo: number, hi: number) => lo + Math.floor(rng.next() * (hi - lo + 1));
  const cases = Array.from({ length: 300 }, () => {
    const n = int(2, 14);
    const items = Array.from({ length: n }, () => ({ weight: int(1, 20), value: int(1, 40) }));
    const total = items.reduce((t, i) => t + i.weight, 0);
    const instance = { items, capacity: int(Math.min(...items.map((i) => i.weight)), total) };
    const chromosome = Array.from({ length: n }, () => (rng.next() < 0.6 ? 1 : 0));
    return { instance, chromosome };
  });

  test('the decoder and both repairs always give a feasible packed set that uses only items whose genes were on', () => {
    for (const { instance, chromosome } of cases) {
      for (const handling of ['decoder', 'repair-lamarckian', 'repair-baldwinian'] as const) {
        const r = handleBag(instance, handling, 1, chromosome);
        expect(bagWeight(instance, r.packed)).toBeLessThanOrEqual(instance.capacity);
        expect(r.feasible).toBe(true);
        r.packed.forEach((p, i) => p && expect(chromosome[i]).toBe(1));
        expect(r.value).toBe(bagValue(instance, r.packed));
      }
    }
  });

  test('repair never drops more than needed: putting the last dropped item back would be overweight', () => {
    for (const { instance, chromosome } of cases) {
      const r = handleBag(instance, 'repair-baldwinian', 1, chromosome);
      if (r.dropped.length === 0) continue;
      const last = r.dropped[r.dropped.length - 1]!.item;
      expect(r.weight + instance.items[last]!.weight).toBeGreaterThan(instance.capacity);
    }
  });

  test('a chromosome that fits is packed as it is by all four methods, with no penalty, no skip and no repair', () => {
    let fitting = 0;
    for (const { instance, chromosome } of cases) {
      if (bagWeight(instance, chromosome.map((g) => g === 1)) > instance.capacity) continue;
      fitting++;
      for (const handling of ['decoder', 'penalty', 'repair-lamarckian', 'repair-baldwinian'] as const) {
        const r = handleBag(instance, handling, 3, chromosome);
        expect(r.packed).toEqual(chromosome.map((g) => g === 1));
        expect([r.penalty, r.excess, r.skipped.length, r.dropped.length, r.repaired]).toEqual([0, 0, 0, 0, undefined]);
      }
    }
    expect(fitting).toBeGreaterThan(20);
  });

  test('Lamarckian repair gives the same packed set and score as Baldwinian, and its chromosome is exactly that set', () => {
    for (const { instance, chromosome } of cases) {
      const l = handleBag(instance, 'repair-lamarckian', 1, chromosome);
      const b = handleBag(instance, 'repair-baldwinian', 1, chromosome);
      expect(l.packed).toEqual(b.packed);
      expect(l.fitness).toBe(b.fitness);
      expect(l.genes).toEqual(l.packed.map((p) => (p ? 1 : 0)));
    }
  });

  test('no handling that is feasible by construction can beat the optimum', () => {
    for (const { instance, chromosome } of cases) {
      const best = optimalBag(instance).value;
      for (const handling of ['decoder', 'repair-lamarckian', 'repair-baldwinian'] as const) expect(handleBag(instance, handling, 1, chromosome).fitness).toBeLessThanOrEqual(best);
    }
  });
});

describe('refusals', () => {
  test('a negative or non-finite rho is refused, and so is a chromosome of the wrong length', () => {
    expect(() => handleBag(builtInKnapsack, 'penalty', -1, all)).toThrow('The penalty ρ must be a number of at least 0');
    expect(() => handleBag(builtInKnapsack, 'penalty', Number.NaN, all)).toThrow('The penalty ρ must be a number of at least 0');
    expect(() => handleBag(builtInKnapsack, 'decoder', 1, [1, 0])).toThrow('A chromosome needs one gene per item (12), but this one has 2');
  });
});
