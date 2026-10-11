import { describe, expect, test } from 'vitest';
import { formatGenes } from './chromosome';
import { startRun, type RunState } from './generation';
import { metricsOf } from './metrics';
import { fitnessColumn, type Problem } from './problem';
import { createRng } from '../run/rng';

const over = (symbols: string, length: number): Problem => ({
  chromosomeLength: length,
  alphabet: [...symbols],
  columns: [fitnessColumn],
  evaluate: (c) => ({ decoded: formatGenes(c, [...symbols]), objective: 1, fitness: 1 }),
});
const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ ';
const stateOf = (problem: Problem, chromosomes: string[]): RunState => startRun(problem, { kind: 'explicit', chromosomes }, createRng(1)).state;

/** The definition: the mean, over all pairs of individuals, of the share of positions at which they differ. */
const bruteForce = (state: RunState) => {
  const genes = state.population.map((i) => i.chromosome);
  let sum = 0;
  let pairs = 0;
  for (let a = 0; a < genes.length; a++) {
    for (let b = a + 1; b < genes.length; b++) {
      pairs++;
      sum += genes[a]!.filter((g, k) => g !== genes[b]![k]).length / genes[a]!.length;
    }
  }
  return pairs === 0 ? 0 : sum / pairs;
};

describe('per-position symbol counts', () => {
  test('count, for each position, how many individuals have each symbol there', () => {
    const problem = over('abc', 4);
    const m = metricsOf(stateOf(problem, ['abca', 'abcb', 'cbca', 'bbba']), 3);
    expect(m.symbolCounts).toEqual([
      [2, 1, 1], // a, a, c, b
      [0, 4, 0], // b, b, b, b
      [0, 1, 3], // c, c, c, b
      [3, 1, 0], // a, b, a, a
    ]);
  });

  test('every position’s counts add up to the population size', () => {
    const problem = over(letters, 6);
    const state = startRun(problem, { kind: 'random', size: 37 }, createRng(8)).state;
    for (const counts of metricsOf(state, 27).symbolCounts) {
      expect(counts).toHaveLength(27);
      expect(counts.reduce((a, b) => a + b, 0)).toBe(37);
    }
  });

  test('for a binary population the share of ones is the count of symbol 1 over the size, as before', () => {
    const problem = over('01', 5);
    const m = metricsOf(stateOf(problem, ['01101', '11000', '01000', '10011']));
    expect(m.alleleFrequencies).toEqual([0.5, 0.75, 0.25, 0.25, 0.5]);
    expect(m.symbolCounts[1]).toEqual([1, 3]);
  });

  test('a gene outside the alphabet it is measured against is refused rather than miscounted', () => {
    const state = stateOf(over(letters, 3), ['ABC']);
    expect(() => metricsOf(state, 2)).toThrow('A gene (2) is outside the alphabet of 2 symbols');
  });
});

describe('diversity over any alphabet', () => {
  test.each([
    ['2 symbols', '01', 2],
    ['3 symbols', 'abc', 3],
    ['27 symbols', letters, 27],
  ])('%s: the count-based diversity equals comparing every pair, for random populations of many sizes and lengths', (_name, symbols, k) => {
    const rng = createRng(77);
    for (let trial = 0; trial < 50; trial++) {
      const length = 1 + Math.floor(rng.next() * 15);
      const size = 1 + Math.floor(rng.next() * 40);
      const state = startRun(over(symbols, length), { kind: 'random', size }, rng).state;
      expect(metricsOf(state, k).diversity).toBeCloseTo(bruteForce(state), 12);
    }
  });

  test('the extremes: identical individuals give 0, and individuals that differ everywhere give 1', () => {
    const problem = over('abc', 3);
    expect(metricsOf(stateOf(problem, ['abc', 'abc', 'abc']), 3).diversity).toBe(0);
    expect(metricsOf(stateOf(problem, ['abc', 'bca', 'cab']), 3).diversity).toBe(1);
  });

  test('a single individual has diversity 0, since there are no pairs', () => {
    expect(metricsOf(stateOf(over(letters, 4), ['HELP']), 27).diversity).toBe(0);
  });

  test('two letters apart in one position of eleven: one pair differing at one of eleven positions', () => {
    const problem = over(letters, 11);
    expect(metricsOf(stateOf(problem, ['HELLO WORLD', 'HELLO WORLX']), 27).diversity).toBeCloseTo(1 / 11, 12);
  });
});

describe('distinct chromosomes over a large alphabet', () => {
  test('chromosomes whose genes would run together as digits are still different (1,12 and 11,2)', () => {
    const problem = over(letters, 2);
    const state = startRun(problem, { kind: 'explicit', chromosomes: ['BM', 'LC'] }, createRng(1)).state; // genes [1,12] and [11,2]
    expect(metricsOf(state, 27).distinct).toBe(2);
  });
});

describe('the metrics are the same value however often they are asked for', () => {
  test('and asking with a different alphabet size is a different question, not a stale answer', () => {
    const state = stateOf(over('abc', 2), ['ab', 'ba']);
    expect(metricsOf(state, 3)).toBe(metricsOf(state, 3));
    expect(metricsOf(state, 3).symbolCounts[0]).toHaveLength(3);
    expect(metricsOf(state, 4).symbolCounts[0]).toHaveLength(4);
  });
});
