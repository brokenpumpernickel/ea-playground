import { describe, expect, test } from 'vitest';
import { goldberg } from './goldberg';
import { initialize } from './initialize';
import { matingPoolSize, pair } from './pairing';
import { createRng } from './rng';
import { rouletteSelect } from './selection';

describe('mating pool size', () => {
  test.each([
    [0, 0],
    [1, 2],
    [4, 4],
    [5, 6],
    [7, 8],
  ])('%i offspring need a pool of %i parents (one extra parent when the count is odd)', (offspring, poolSize) => {
    expect(matingPoolSize(offspring)).toBe(poolSize);
  });
});

describe('pairing', () => {
  test('neighbours in the mating pool become pairs (the mock’s worked example)', () => {
    const { pairs, events } = pair([2, 1, 4, 2], 4);

    expect(pairs).toEqual([
      { pair: 1, slotA: 1, slotB: 2, parentAId: 2, parentBId: 1, secondChildDropped: false },
      { pair: 2, slotA: 3, slotB: 4, parentAId: 4, parentBId: 2, secondChildDropped: false },
    ]);
    expect(events).toEqual(pairs.map((p) => ({ stage: 'pairing', kind: 'pair', ...p })));
  });

  test('the same individual can be paired with itself when selection picked it twice in a row', () => {
    expect(pair([3, 3], 2).pairs).toEqual([{ pair: 1, slotA: 1, slotB: 2, parentAId: 3, parentBId: 3, secondChildDropped: false }]);
  });

  test('an odd offspring count uses one extra parent and marks the last pair’s second child as dropped', () => {
    const { pairs } = pair([2, 1, 4, 2, 3, 3], 5);

    expect(pairs.map((p) => p.secondChildDropped)).toEqual([false, false, true]);
    expect(pairs[2]).toEqual({ pair: 3, slotA: 5, slotB: 6, parentAId: 3, parentBId: 3, secondChildDropped: true });
  });

  test('no offspring means no pairs', () => {
    expect(pair([], 0)).toEqual({ pairs: [], events: [] });
  });

  test('refuses a pool of the wrong size, saying what size was needed', () => {
    expect(() => pair([1, 2, 3, 4, 5], 5)).toThrow('Pairing 5 offspring needs a mating pool of 6 parents, but the pool has 5');
    expect(() => pair([1, 2], 4)).toThrow('Pairing 4 offspring needs a mating pool of 4 parents, but the pool has 2');
  });

  test('selection followed by pairing works for an odd offspring count', () => {
    const population = initialize(goldberg, { kind: 'explicit', chromosomes: ['01101', '11000', '01000', '10011'] }, createRng(1)).population;
    const offspring = 3;
    const { pool } = rouletteSelect(population, population.map((i) => i.fitness), matingPoolSize(offspring), createRng(8));
    const { pairs } = pair(pool, offspring);

    expect(pool).toHaveLength(4);
    expect(pairs).toHaveLength(2);
    expect(pairs.flatMap((p) => [p.parentAId, p.parentBId])).toEqual(pool);
    expect(pairs.at(-1)?.secondChildDropped).toBe(true);
  });
});
