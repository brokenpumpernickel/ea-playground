import { describe, expect, test } from 'vitest';
import { createRng } from '../run/rng';
import {
  bagValue,
  bagWeight,
  builtInKnapsack,
  greedyByRatio,
  itemName,
  knapsackLimits,
  optimalBag,
  validateKnapsackInstance,
  validateKnapsackInstanceFields,
  type KnapsackInstance,
} from './knapsack-instance';

const bagOf = (letters: string, n = 12) => Array.from({ length: n }, (_, i) => letters.includes(itemName(i)));
const brute = (instance: KnapsackInstance) => {
  const n = instance.items.length;
  let best = 0;
  let feasible = 0;
  for (let mask = 0; mask < 1 << n; mask++) {
    const bag = Array.from({ length: n }, (_, i) => (mask >> i & 1) === 1);
    if (bagWeight(instance, bag) <= instance.capacity) {
      feasible++;
      best = Math.max(best, bagValue(instance, bag));
    }
  }
  return { best, feasible };
};

describe('item names', () => {
  test('are the letters A, B, C, … by position', () => {
    expect([0, 1, 2, 11, 19].map(itemName)).toEqual(['A', 'B', 'C', 'L', 'T']);
  });
});

describe('the built-in instance, worked by hand', () => {
  // the numbers below were worked out on paper (and with an independent script), not read from the code
  test('is 12 items: weights 9 12 3 3 10 14 4 5 11 7 6 13, values 4 20 21 17 5 23 7 14 8 12 21 19, capacity 48', () => {
    expect(builtInKnapsack.items.map((i) => i.weight)).toEqual([9, 12, 3, 3, 10, 14, 4, 5, 11, 7, 6, 13]);
    expect(builtInKnapsack.items.map((i) => i.value)).toEqual([4, 20, 21, 17, 5, 23, 7, 14, 8, 12, 21, 19]);
    expect(builtInKnapsack.capacity).toBe(48);
    expect(validateKnapsackInstance(builtInKnapsack)).toEqual([]);
  });

  test('the empty bag weighs 0, is worth 0 and fits', () => {
    const bag = bagOf('');
    expect([bagWeight(builtInKnapsack, bag), bagValue(builtInKnapsack, bag)]).toEqual([0, 0]);
  });

  test('every item together weighs 97 and is worth 171, so it does not fit', () => {
    const bag = bagOf('ABCDEFGHIJKL');
    expect([bagWeight(builtInKnapsack, bag), bagValue(builtInKnapsack, bag)]).toEqual([97, 171]);
  });

  test('A, B, C, E, F weigh exactly 48 (the capacity) and are worth 73; A, B, E, F, G weigh 49, one over, and are worth 59', () => {
    expect([bagWeight(builtInKnapsack, bagOf('ABCEF')), bagValue(builtInKnapsack, bagOf('ABCEF'))]).toEqual([48, 73]);
    expect([bagWeight(builtInKnapsack, bagOf('ABEFG')), bagValue(builtInKnapsack, bagOf('ABEFG'))]).toEqual([49, 59]);
  });
});

describe('the optimum', () => {
  test('of the built-in instance is 123 with the bag B, C, D, F, G, H, K (weight 47), and nothing else is worth that much', () => {
    const best = optimalBag(builtInKnapsack);
    expect(best.value).toBe(123);
    expect(itemsOf(best.bag)).toBe('BCDFGHK');
    expect(bagWeight(builtInKnapsack, best.bag)).toBe(47);
  });

  test('equals brute force over all 4,096 bags of the built-in instance, and exactly half of those bags fit', () => {
    expect(brute(builtInKnapsack)).toEqual({ best: 123, feasible: 2048 });
  });

  test('equals brute force on 200 generated instances', () => {
    const rng = createRng(31);
    const int = (lo: number, hi: number) => lo + Math.floor(rng.next() * (hi - lo + 1));
    for (let k = 0; k < 200; k++) {
      const n = int(2, 10);
      const items = Array.from({ length: n }, () => ({ weight: int(1, 20), value: int(1, 50) }));
      const total = items.reduce((t, i) => t + i.weight, 0);
      const lightest = Math.min(...items.map((i) => i.weight));
      const instance = { items, capacity: int(lightest, total) };
      const best = optimalBag(instance);
      expect(best.value).toBe(brute(instance).best);
      expect(bagWeight(instance, best.bag)).toBeLessThanOrEqual(instance.capacity);
      expect(bagValue(instance, best.bag)).toBe(best.value);
    }
  });
});

describe('the greedy rule', () => {
  test('packing by best value per weight gets 112 on the built-in instance, which is not the optimum 123', () => {
    const greedy = greedyByRatio(builtInKnapsack);
    expect(greedy.value).toBe(112);
    expect(itemsOf(greedy.bag)).toBe('BCDGHJK');
    expect(greedy.value).toBeLessThan(optimalBag(builtInKnapsack).value);
  });

  test('takes the items in order of value per weight (ties: the earlier item) and skips one that does not fit but carries on', () => {
    const instance = { items: [{ weight: 5, value: 10 }, { weight: 6, value: 12 }, { weight: 4, value: 6 }], capacity: 10 };
    // ratios 2, 2, 1.5: A (5) then B (6) does not fit, then C (4) fits
    expect(itemsOf(greedyByRatio(instance).bag)).toBe('AC');
  });
});

describe('the design conditions of the built-in instance', () => {
  test('the capacity is about half the total weight, the optimum is known, greedy is worse, and half the bags are feasible', () => {
    const total = builtInKnapsack.items.reduce((t, i) => t + i.weight, 0);
    expect(total).toBe(97);
    expect(builtInKnapsack.capacity / total).toBeGreaterThan(0.45);
    expect(builtInKnapsack.capacity / total).toBeLessThan(0.55);
    expect(optimalBag(builtInKnapsack).value - greedyByRatio(builtInKnapsack).value).toBeGreaterThanOrEqual(10);
  });
});

describe('validation says what is wrong in words', () => {
  const item = (weight: number, value: number) => ({ weight, value });
  const ok: KnapsackInstance = { items: [item(5, 10), item(7, 3)], capacity: 8 };

  test('a good instance has no problems, at the limits too', () => {
    expect(validateKnapsackInstance(ok)).toEqual([]);
    const max = { items: Array.from({ length: knapsackLimits.maxItems }, () => item(99, 999)), capacity: 99 };
    expect(validateKnapsackInstance(max)).toEqual([]);
    expect(validateKnapsackInstance({ items: [item(1, 1), item(1, 1)], capacity: 1 })).toEqual([]);
  });

  test('too few or too many items', () => {
    expect(validateKnapsackInstance({ items: [item(1, 1)], capacity: 1 })).toContain('A knapsack needs at least 2 items (there is 1).');
    expect(validateKnapsackInstance({ items: [], capacity: 1 })).toContain('A knapsack needs at least 2 items (there are 0).');
    const many = { items: Array.from({ length: 21 }, () => item(1, 1)), capacity: 5 };
    expect(validateKnapsackInstance(many)).toContain('A knapsack can have at most 20 items (there are 21).');
  });

  test('a weight or value that is not a whole number in range names the item and what it is', () => {
    expect(validateKnapsackInstance({ ...ok, items: [item(5, 10), item(0, 3)] })).toContain('Item B: the weight must be a whole number from 1 to 99 (it is 0).');
    expect(validateKnapsackInstance({ ...ok, items: [item(100, 10), item(7, 3)] })).toContain('Item A: the weight must be a whole number from 1 to 99 (it is 100).');
    expect(validateKnapsackInstance({ ...ok, items: [item(5, 1000), item(7, 3)] })).toContain('Item A: the value must be a whole number from 1 to 999 (it is 1000).');
    expect(validateKnapsackInstance({ ...ok, items: [item(5, 10), item(7, 2.5)] })).toContain('Item B: the value must be a whole number from 1 to 999 (it is 2.5).');
    expect(validateKnapsackInstance({ ...ok, items: [item(5, 10), item(Number.NaN, 3)] })).toContain('Item B: the weight must be a whole number from 1 to 99 (it is not a number).');
  });

  test('a capacity that is not a whole number of at least 1, or is above the total weight, or fits no item', () => {
    expect(validateKnapsackInstance({ ...ok, capacity: 0 })).toContain('The capacity must be a whole number of at least 1 (it is 0).');
    expect(validateKnapsackInstance({ ...ok, capacity: 3.5 })).toContain('The capacity must be a whole number of at least 1 (it is 3.5).');
    expect(validateKnapsackInstance({ ...ok, capacity: 13 })).toContain('The capacity can be at most the total weight, 12 (it is 13): a bag that holds everything is no puzzle.');
    expect(validateKnapsackInstance({ items: [item(5, 10), item(7, 3)], capacity: 4 })).toContain('No item fits on its own: the lightest weighs 5 but the capacity is 4.');
  });

  test('the messages are grouped under the field they are about, and all of them are reported together', () => {
    const fields = validateKnapsackInstanceFields({ items: [item(0, 10), item(7, 3000)], capacity: 0 });
    expect(fields.items).toEqual([
      'Item A: the weight must be a whole number from 1 to 99 (it is 0).',
      'Item B: the value must be a whole number from 1 to 999 (it is 3000).',
    ]);
    expect(fields.capacity).toEqual(['The capacity must be a whole number of at least 1 (it is 0).']);
    expect(validateKnapsackInstance({ items: [item(0, 10), item(7, 3000)], capacity: 0 })).toHaveLength(3);
  });

  test('while a weight is wrong the totals are not used to blame the capacity', () => {
    expect(validateKnapsackInstanceFields({ items: [item(0, 10), item(7, 3)], capacity: 50 }).capacity).toEqual([]);
  });
});

function itemsOf(bag: readonly boolean[]): string {
  return bag.flatMap((b, i) => (b ? [itemName(i)] : [])).join('');
}
