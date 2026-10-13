import { describe, expect, test } from 'vitest';
import { tspCatalogue, tspDefaultEpsilon, tspDefaultOptions, tspProblem, validateTsp, type TspOptions, type TspProblem } from '../engine';
import { defaultsOf, entryOf, problemEntries, problemIds } from './problems';

const entry = entryOf('tsp')!;
const opts = (instance: string, n = 10, seed = 1): TspOptions => ({ instance, n, seed });

describe('the TSP in the problem registry', () => {
  test('is the sixth problem, with its logo, its own options and the edge-agreement panel', () => {
    expect(problemIds()).toEqual(['goldberg', 'target-string', 'knapsack', 'trap', 'landscape', 'tsp']);
    expect(problemEntries[5]).toBe(entry);
    expect(entry).toMatchObject({ id: 'tsp', name: 'TSP', logo: 'Ts', genePanel: 'agreement', hasOptions: true });
    expect(entry.diversityNote).toBe('share of edges not in common, 0–1');
  });

  test('opens with the default instance, which is valid', () => {
    expect(entry.defaultOptions()).toEqual(tspDefaultOptions);
    expect(entry.validateOptions(entry.defaultOptions())).toEqual([]);
    expect(entry.create(entry.defaultOptions()).chromosomeLength).toBe(16);
  });

  test('the line under the name says how many cities and the optimum; an unusable option gives the plain line', () => {
    expect(entry.subtitle(opts('berlin52'))).toBe('52 cities · optimum 7,542');
    expect(entry.subtitle(opts('ulysses16'))).toBe('16 cities · optimum 6,859');
    expect(entry.subtitle(opts('circle', 8))).toMatch(/^8 cities · optimum \d+\.\d$/);
    expect(entry.subtitle(opts('att49'))).toBe('Evolve a tour through cities');
    expect(entry.subtitle(undefined)).toBe('Evolve a tour through cities');
    expect(entry.subtitle(opts('random', 3))).toBe('Evolve a tour through cities');
  });

  test('the chip beside the name is the instance; the random one adds its seed', () => {
    expect(entry.chip!(opts('berlin52'))).toBe('berlin52');
    expect(entry.chip!(opts('clusters'))).toBe('Two clusters');
    expect(entry.chip!(opts('circle', 9))).toBe('Circle');
    expect(entry.chip!(opts('random', 9, 4))).toBe('Random · seed 4');
    expect(entry.chip!(opts('att49'))).toBeUndefined();
  });

  test('options from a link are checked in words: the shape first, then the instance, the number of cities and the seed', () => {
    expect(entry.validateOptions('x')).toEqual(['"options" must be an object with "instance", "n" and "seed".']);
    expect(entry.validateOptions({ instance: 'berlin52' })).toEqual(['"options" is missing "n".', '"options" is missing "seed".']);
    expect(entry.validateOptions({ instance: 'berlin52', n: 10, seed: 1, extra: 1 })).toEqual(['"options" has an unknown key "extra".']);
    expect(entry.validateOptions({ instance: 3, n: '10', seed: null })).toEqual(['"options.instance" must be text.', '"options.n" must be a number.', '"options.seed" must be a number.']);
    expect(entry.validateOptions(opts('att49'))).toEqual([`Instance must be one of circle, clusters, random, ${tspCatalogue.filter((c) => c.kind === 'tsplib').map((c) => c.id).join(', ')}.`]);
    expect(entry.validateOptions(opts('circle', 20))).toEqual(['The number of cities must be a whole number from 5 to 15 (it is 20).']);
    expect(entry.validateOptions(opts('random', 8, -2))).toEqual(['The seed must be a whole number of 0 or more (it is -2).']);
    expect(entry.validateOptions(opts('berlin52', 999, -5))).toEqual([]); // the number of cities and the seed matter for two instances only
  });

  test('the field-by-field check names the drawer fields: instance, cities and the instance seed', () => {
    expect(entry.validateOptionFields(opts('att49'))).toEqual({ instance: [expect.stringMatching(/^Instance must be one of/)], cities: [], citySeed: [] });
    expect(entry.validateOptionFields(opts('circle', 3))).toMatchObject({ cities: ['The number of cities must be a whole number from 5 to 15 (it is 3).'] });
    expect(entry.validateOptionFields(opts('random', 9, 2.5))).toMatchObject({ citySeed: ['The seed must be a whole number of 0 or more (it is 2.5).'] });
  });

  test('builds the engine problem for its options', () => {
    const p = entry.create(opts('berlin52')) as TspProblem;
    expect(p.options).toEqual(opts('berlin52'));
    expect(p.chromosomeLength).toBe(52);
    expect(p.knownOptimumFitness).toBe(-7542);
  });
});

describe('how a TSP run starts', () => {
  test('a random population, order crossover, a per-individual mutation, elites and the stops with ε for the instance, for every instance', () => {
    for (const c of tspCatalogue) {
      const o = opts(c.id);
      expect(validateTsp(o)).toEqual([]);
      const d = defaultsOf(entry, o);
      expect(d.init).toEqual({ kind: 'random', size: 12 });
      expect(d.params.crossover).toMatchObject({ enabled: true, operator: 'ox' });
      expect(d.params.mutation).toMatchObject({ enabled: true, mode: 'per-individual', operator: 'inversion' });
      expect(d.params.stop.targetEpsilon).toBe(tspDefaultEpsilon(tspProblem(o)));
      expect(d.params.stop.targetFitness).toBeUndefined();
      expect(d.seed).toBeGreaterThanOrEqual(0);
    }
    expect(entry.defaults.init).toEqual({ kind: 'random', size: 12 });
  });

  test('ε is half a unit for the whole-number instances and 0.000001 for the own ones', () => {
    expect(defaultsOf(entry, opts('berlin52')).params.stop.targetEpsilon).toBe(0.5);
    expect(defaultsOf(entry, opts('circle', 8)).params.stop.targetEpsilon).toBe(1e-6);
  });
});

describe('the other problems are unchanged', () => {
  test('their entries have no per-options defaults except the landscape and the TSP', () => {
    expect(entryOf('goldberg')!.defaultsFor).toBeUndefined();
    expect(entryOf('trap')!.defaultsFor).toBeUndefined();
    expect(entryOf('landscape')!.defaultsFor).toBeDefined();
    expect(entry.defaultsFor).toBeDefined();
  });
});
