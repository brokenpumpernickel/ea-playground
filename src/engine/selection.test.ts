import { describe, expect, test } from 'vitest';
import { goldberg } from './goldberg';
import { initialize, type Individual } from './initialize';
import { createRng } from './rng';
import { rouletteSelect, type SelectionEvent } from './selection';
import { scripted } from './test-support';

const textbook = (): Individual[] =>
  initialize(goldberg, { kind: 'explicit', chromosomes: ['01101', '11000', '01000', '10011'] }, createRng(1)).population;

const identityWeights = (population: Individual[]) => population.map((i) => i.fitness);

const probabilitiesOf = (events: readonly SelectionEvent[]) => {
  const event = events.find((e) => e.kind === 'probabilities');
  if (!event || event.kind !== 'probabilities') throw new Error('no probabilities event');
  return event.entries;
};

describe('roulette wheel spins', () => {
  const spinsOf = (events: readonly SelectionEvent[]) => events.filter((e) => e.kind === 'spin');

  test('each spin picks the individual whose interval contains r (the mock’s worked example)', () => {
    const population = textbook();
    const { pool, events } = rouletteSelect(population, identityWeights(population), 4, scripted(0.58, 0.07, 0.91, 0.31));

    expect(pool).toEqual([2, 1, 4, 2]);
    expect(spinsOf(events)).toEqual([
      { stage: 'selection', kind: 'spin', spin: 1, r: 0.58, individualId: 2 },
      { stage: 'selection', kind: 'spin', spin: 2, r: 0.07, individualId: 1 },
      { stage: 'selection', kind: 'spin', spin: 3, r: 0.91, individualId: 4 },
      { stage: 'selection', kind: 'spin', spin: 4, r: 0.31, individualId: 2 },
    ]);
  });

  test('an interval includes its lower edge and excludes its upper edge', () => {
    const population = textbook();
    const weights = identityWeights(population);
    const entries = probabilitiesOf(rouletteSelect(population, weights, 1, scripted(0.5)).events);

    const onEdge = rouletteSelect(population, weights, 1, scripted(entries[2]!.lo));
    expect(onEdge.pool).toEqual([3]);
    const justBelow = rouletteSelect(population, weights, 1, scripted(entries[2]!.lo - 1e-12));
    expect(justBelow.pool).toEqual([2]);
  });

  test('an individual with weight zero is never picked', () => {
    const population = textbook();
    const weights = [0, 5, 0, 5];
    const draws = [0, 0.25, 0.4999, 0.5, 0.75, 0.9999];
    const { pool } = rouletteSelect(population, weights, draws.length, scripted(...draws));
    expect(pool).toEqual([2, 2, 2, 4, 4, 4]);
  });

  test('the largest possible draw still picks someone, whatever rounding does to the interval edges', () => {
    const largestBelowOne = 1 - 2 ** -53;
    const rng = createRng(77);
    for (let trial = 0; trial < 500; trial++) {
      const population = textbook();
      const weights = population.map(() => rng.next() + 0.001);
      const { pool } = rouletteSelect(population, weights, 1, scripted(largestBelowOne));
      expect(pool).toEqual([4]);
    }
  });
});

describe('roulette wheel weight validation', () => {
  const select = (weights: number[], count = 1) => () =>
    rouletteSelect(textbook(), weights, count, scripted(...Array.from({ length: count }, () => 0.5)));

  test('rejects a negative weight, naming the individual', () => {
    expect(select([169, 576, -2, 361])).toThrow('Selection weight of individual 3 is negative (-2)');
  });

  test.each([Number.NaN, Number.POSITIVE_INFINITY])('rejects a weight of %s', (bad) => {
    expect(select([169, bad, 64, 361])).toThrow('Selection weight of individual 2 is not a finite number');
  });

  test('rejects weights that are all zero, since nobody could be selected', () => {
    expect(select([0, 0, 0, 0])).toThrow('All selection weights are zero, so no individual can be selected');
  });

  test('rejects the wrong number of weights', () => {
    expect(select([1, 2, 3])).toThrow('Expected 4 selection weights but got 3');
  });

  test.each([-1, 1.5])('rejects a spin count of %s', (count) => {
    expect(() => rouletteSelect(textbook(), [1, 1, 1, 1], count, scripted())).toThrow(
      'The number of spins must be a whole number of at least 0',
    );
  });
});

describe('roulette wheel randomness', () => {
  test('makes exactly one draw per spin, in order, so later stages continue the same sequence', () => {
    const population = textbook();
    const reference = createRng(2024);
    const draws = Array.from({ length: 6 }, () => reference.next());

    const rng = createRng(2024);
    rouletteSelect(population, identityWeights(population), 5, rng);

    expect(rng.next()).toBe(draws[5]);
  });

  test('the same seed gives the same pool', () => {
    const population = textbook();
    const pool = (seed: number) => rouletteSelect(population, identityWeights(population), 30, createRng(seed)).pool;
    expect(pool(5)).toEqual(pool(5));
    expect(pool(5)).not.toEqual(pool(6));
  });

  test('over many spins each individual is picked about as often as its probability says', () => {
    const population = textbook();
    const spins = 20_000;
    const { pool } = rouletteSelect(population, identityWeights(population), spins, createRng(11));
    const expected = [169, 576, 64, 361].map((f) => f / 1170);

    population.forEach((individual, k) => {
      const share = pool.filter((id) => id === individual.id).length / spins;
      expect(Math.abs(share - expected[k]!)).toBeLessThan(0.02);
    });
  });
});

describe('roulette wheel probabilities', () => {
  test('the textbook population gets Goldberg’s selection probabilities and intervals', () => {
    const population = textbook();
    const { events } = rouletteSelect(population, identityWeights(population), 1, scripted(0.5));
    const entries = probabilitiesOf(events);

    expect(entries.map((e) => e.individualId)).toEqual([1, 2, 3, 4]);
    expect(entries.map((e) => e.weight)).toEqual([169, 576, 64, 361]);
    expect(entries.map((e) => e.probability)).toEqual([
      expect.closeTo(0.144, 3),
      expect.closeTo(0.492, 3),
      expect.closeTo(0.055, 3),
      expect.closeTo(0.309, 3),
    ]);
    expect(entries.map((e) => e.lo)).toEqual([0, expect.closeTo(0.144, 3), expect.closeTo(0.637, 3), expect.closeTo(0.691, 3)]);
    expect(entries.map((e) => e.hi)).toEqual([expect.closeTo(0.144, 3), expect.closeTo(0.637, 3), expect.closeTo(0.691, 3), 1]);
  });

  test('probabilities sum to 1 and each interval starts where the previous one ended', () => {
    const population = textbook();
    const entries = probabilitiesOf(rouletteSelect(population, identityWeights(population), 1, scripted(0.5)).events);

    expect(entries.reduce((sum, e) => sum + e.probability, 0)).toBeCloseTo(1, 12);
    entries.slice(1).forEach((e, k) => expect(e.lo).toBe(entries[k]!.hi));
  });
});
