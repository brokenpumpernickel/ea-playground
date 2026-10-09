import { describe, expect, test } from 'vitest';
import { formatBits } from './chromosome';
import { goldberg } from './goldberg';
import { initialize } from './initialize';
import { createRng } from './rng';

const textbook = ['01101', '11000', '01000', '10011'];

describe('explicit initialization', () => {
  test('the textbook population is scored as in Goldberg’s table', () => {
    const { population } = initialize(goldberg, { kind: 'explicit', chromosomes: textbook }, createRng(1));

    expect(population.map((i) => formatBits(i.chromosome))).toEqual(textbook);
    expect(population.map((i) => i.decoded)).toEqual([13, 24, 8, 19]);
    expect(population.map((i) => i.fitness)).toEqual([169, 576, 64, 361]);
    expect(population.reduce((sum, i) => sum + i.fitness, 0)).toBe(1170);
  });

  test('individuals get stable ids 1..N in population order', () => {
    const { population } = initialize(goldberg, { kind: 'explicit', chromosomes: textbook }, createRng(1));
    expect(population.map((i) => i.id)).toEqual([1, 2, 3, 4]);
  });
});

describe('random initialization', () => {
  const random = (size: number, seed: number) => initialize(goldberg, { kind: 'random', size }, createRng(seed));
  const text = (size: number, seed: number) => random(size, seed).population.map((i) => formatBits(i.chromosome));

  test('a gene is 1 when its draw is below 0.5, drawing gene by gene, individual by individual', () => {
    // Expected values from an independent computation of the seed-42 mulberry32 sequence (first 15 draws).
    expect(text(3, 42)).toEqual(['01001', '01001', '10011']);
  });

  test('gives the requested number of individuals, each scored, with ids 1..N', () => {
    const { population } = random(8, 5);
    expect(population).toHaveLength(8);
    expect(population.map((i) => i.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    for (const i of population) {
      expect(i.chromosome).toHaveLength(5);
      expect(i.fitness).toBe(i.decoded ** 2);
    }
  });

  test('the same seed reproduces the population; a different seed does not', () => {
    expect(text(20, 9)).toEqual(text(20, 9));
    expect(text(20, 9)).not.toEqual(text(20, 10));
  });

  test('about half of all genes are 1', () => {
    const ones = text(500, 3).join('').split('').filter((g) => g === '1').length;
    expect(ones / (500 * 5)).toBeGreaterThan(0.47);
    expect(ones / (500 * 5)).toBeLessThan(0.53);
  });

  test.each([0, -3, 2.5])('rejects a population size of %s', (size) => {
    expect(() => random(size, 1)).toThrow('Population size must be a whole number of at least 1');
  });

  test('emits one setup event per individual, as for explicit initialization', () => {
    const { population, events } = random(6, 2);
    expect(events.map((e) => e.individual)).toEqual(population);
  });
});

describe('explicit initialization validation', () => {
  const explicit = (chromosomes: string[]) => () =>
    initialize(goldberg, { kind: 'explicit', chromosomes }, createRng(1));

  test('rejects a chromosome that is too short, naming it and the required length', () => {
    expect(explicit(['01101', '1100'])).toThrow('Chromosome 2 has 4 genes, but this problem needs 5');
  });

  test('rejects a chromosome that is too long', () => {
    expect(explicit(['011010'])).toThrow('Chromosome 1 has 6 genes, but this problem needs 5');
  });

  test('rejects characters other than 0 and 1, quoting the offending text', () => {
    expect(explicit(['01101', '11x00'])).toThrow('Chromosome 2 ("11x00") may only contain the characters 0 and 1');
  });

  test('rejects an empty population', () => {
    expect(explicit([])).toThrow('The initial population needs at least one chromosome');
  });
});

describe('setup events', () => {
  test('one evaluation event per individual, in population order, matching the population exactly', () => {
    const { population, events } = initialize(goldberg, { kind: 'explicit', chromosomes: textbook }, createRng(1));

    expect(events).toHaveLength(population.length);
    events.forEach((event, k) => {
      expect(event.stage).toBe('setup');
      expect(event.kind).toBe('evaluated');
      expect(event.individual).toEqual(population[k]);
    });
  });
});
