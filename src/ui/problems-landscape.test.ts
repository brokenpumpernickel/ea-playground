import { describe, expect, test } from 'vitest';
import { landscapeDefaultEpsilon, landscapeDefaultOptions, landscapeDefaults, landscapeProblem, type LandscapeOptions } from '../engine';
import { entryOf, problemIds } from './problems';

describe('the landscape entry', () => {
  const entry = entryOf('landscape')!;
  const good = (): Record<string, unknown> => ({ function: 'two-peaks', representation: 'gray', bitsPerVariable: 8 });

  test('is the fifth problem, named Landscape with the logo Ls, and the others are where they were', () => {
    expect(problemIds()).toEqual(['goldberg', 'target-string', 'knapsack', 'trap', 'landscape', 'tsp']);
    expect(entry.name).toBe('Landscape');
    expect(entry.logo).toBe('Ls');
    expect(entry.hasOptions).toBe(true);
    expect(entry.genePanel).toBe('spread');
    expect(entry.diversityNote).toBe('mean pairwise distance, 0–1');
  });

  test('its default options are the single peak, real-valued, 10 bits, and a copy each time', () => {
    const a = entry.defaultOptions() as unknown as LandscapeOptions & { bitsPerVariable: number };
    expect(a).toEqual({ function: 'single-peak', representation: 'real', bitsPerVariable: 10 });
    (a as { bitsPerVariable: number }).bitsPerVariable = 4;
    expect((entry.defaultOptions() as unknown as LandscapeOptions).bitsPerVariable).toBe(10);
  });

  test('says what it is in the brand area: the function, what is to be done to f and the optimum', () => {
    const sub = (o: LandscapeOptions) => entry.subtitle(o);
    expect(sub({ function: 'single-peak', representation: 'real', bitsPerVariable: 10 })).toBe('Single peak · maximise f · optimum 1');
    expect(sub({ function: 'two-peaks', representation: 'plain', bitsPerVariable: 8 })).toBe('Two peaks · maximise f · optimum 1.0003');
    expect(sub({ function: 'rastrigin', representation: 'gray', bitsPerVariable: 12 })).toBe('Rastrigin · minimise f · optimum f = 0');
    expect(sub({ function: 'himmelblau', representation: 'real', bitsPerVariable: 10 })).toBe('Himmelblau · minimise f · optimum f = 0 (4 places)');
    expect(entry.subtitle(undefined)).toBe('Evolve a point on a fitness landscape');
  });

  test('and the representation is a chip beside the problem name; the other problems have none', () => {
    expect(entry.chip!({ function: 'single-peak', representation: 'real', bitsPerVariable: 10 })).toBe('real-valued');
    expect(entry.chip!({ function: 'single-peak', representation: 'plain', bitsPerVariable: 8 })).toBe('binary-coded · 8 bits');
    expect(entry.chip!({ function: 'single-peak', representation: 'gray', bitsPerVariable: 12 })).toBe('Gray-coded · 12 bits');
    expect(entry.chip!(undefined)).toBeUndefined();
    for (const id of ['goldberg', 'target-string', 'knapsack', 'trap']) expect(entryOf(id)!.chip).toBeUndefined();
  });

  test('options are validated in words, whatever they are', () => {
    expect(entry.validateOptions(good())).toEqual([]);
    expect(entry.validateOptions('x')).toEqual(['"options" must be an object with "function", "representation" and "bitsPerVariable".']);
    expect(entry.validateOptions({})).toEqual(['"options" is missing "function".', '"options" is missing "representation".', '"options" is missing "bitsPerVariable".']);
    expect(entry.validateOptions({ ...good(), extra: 1 })).toEqual(['"options" has an unknown key "extra".']);
    expect(entry.validateOptions({ function: 1, representation: null, bitsPerVariable: '8' })).toEqual(['"options.function" must be text.', '"options.representation" must be text.', '"options.bitsPerVariable" must be a number.']);
    expect(entry.validateOptions({ ...good(), function: 'sphere' })).toEqual(['Function must be one of single-peak, two-peaks, rastrigin, himmelblau (it is "sphere").']);
    expect(entry.validateOptions({ ...good(), representation: 'ternary' })).toEqual(['Representation must be one of real, plain, gray (it is "ternary").']);
    expect(entry.validateOptions({ ...good(), bitsPerVariable: 13 })).toEqual(['Bits per variable must be a whole number from 4 to 12 (it is 13).']);
    expect(entry.validateOptions({ ...good(), representation: 'real', bitsPerVariable: 13 })).toEqual([]); // bits are not used by the real-valued representation
  });

  test('the option messages are grouped by field for the drawer', () => {
    const fields = entry.validateOptionFields({ function: 'x', representation: 'y', bitsPerVariable: 99 } as never);
    expect(Object.keys(fields).sort()).toEqual(['bitsPerVariable', 'function', 'representation']);
    expect(fields.function).toHaveLength(1);
    expect(fields.representation).toHaveLength(1);
    expect(fields.bitsPerVariable).toHaveLength(0); // the representation is not known to be binary-coded
  });

  test('the problem it builds is the landscape for those options, and with none it is the default one', () => {
    expect(entry.create(entry.defaultOptions()).chromosomeLength).toBe(2);
    expect(entry.create(undefined).chromosomeLength).toBe(2);
    expect(entry.create({ function: 'rastrigin', representation: 'plain', bitsPerVariable: 7 }).chromosomeLength).toBe(14);
  });

  test('a fresh run starts with a random population, the default seed and parameters that suit the representation', () => {
    expect(entry.defaults.init.kind).toBe('random');
    const real = entry.defaultsFor!({ function: 'single-peak', representation: 'real', bitsPerVariable: 10 });
    expect(real.params.crossover.operator).toBe('blx-alpha');
    expect(real.params.crossover.alpha).toBe(0.5);
    expect(real.params.mutation.sigma).toBe(0.05);
    expect(real.params.stop.targetEpsilon).toBe(landscapeDefaultEpsilon(landscapeProblem({ function: 'single-peak', representation: 'real', bitsPerVariable: 10 })));
    expect(real.params.stop.targetFitness).toBeUndefined();
    const binary = entry.defaultsFor!({ function: 'himmelblau', representation: 'gray', bitsPerVariable: 8 });
    expect(binary.params.crossover.operator).toBe('one-point');
    expect(binary.params.crossover).not.toHaveProperty('alpha');
    expect(binary.params.mutation).not.toHaveProperty('sigma');
    expect(binary.params.stop.targetEpsilon).toBe(landscapeDefaultEpsilon(landscapeProblem({ function: 'himmelblau', representation: 'gray', bitsPerVariable: 8 })));
  });

  test('the other entries have no per-options defaults and are unchanged', () => {
    expect(entryOf('trap')!.defaultsFor).toBeUndefined();
    expect(entryOf('knapsack')!.defaults.params.stop.targetFitness).toBe(123);
  });

  test('the defaults are the measured, approved ones (ticket 14): the same population, selection, elites and limit for every function, the operators by representation', () => {
    for (const fn of ['single-peak', 'two-peaks', 'rastrigin', 'himmelblau'] as const) {
      const real = landscapeDefaults({ function: fn, representation: 'real', bitsPerVariable: 10 });
      const epsilon = landscapeDefaultEpsilon(landscapeProblem({ function: fn, representation: 'real', bitsPerVariable: 10 }));
      expect(real.populationSize).toBe(12);
      expect(real.params).toEqual({
        selection: { method: 'tournament', size: 2 },
        crossover: { enabled: true, operator: 'blx-alpha', probability: 0.9, alpha: 0.5 },
        mutation: { enabled: true, mode: 'per-gene', probability: 0.1, sigma: 0.05 },
        elites: 1,
        stop: { generationLimit: 100, targetEpsilon: epsilon, stagnationWindow: 50 },
      });
      for (const representation of ['plain', 'gray'] as const) {
        const bits = landscapeDefaults({ function: fn, representation, bitsPerVariable: 10 });
        expect(bits.populationSize).toBe(12);
        expect(bits.params).toEqual({
          selection: { method: 'tournament', size: 2 },
          crossover: { enabled: true, operator: 'one-point', probability: 0.9 },
          mutation: { enabled: true, mode: 'per-gene', probability: 0.05 },
          elites: 1,
          stop: { generationLimit: 100, targetEpsilon: epsilon, stagnationWindow: 50 },
        });
      }
    }
    expect(entry.defaults.init).toEqual({ kind: 'random', size: 12 });
    expect(landscapeDefaultOptions).toEqual({ function: 'single-peak', representation: 'real', bitsPerVariable: 10 });
  });

  test('the engine’s defaults are valid for every function and representation, and are what the entry offers', () => {
    for (const fn of ['single-peak', 'two-peaks', 'rastrigin', 'himmelblau'] as const) {
      for (const representation of ['real', 'plain', 'gray'] as const) {
        const options: LandscapeOptions = { function: fn, representation, bitsPerVariable: 9 };
        const defaults = landscapeDefaults(options);
        expect(entry.defaultsFor!(options).params).toEqual(defaults.params);
        expect(defaults.options).toEqual(options);
        expect(defaults.populationSize).toBeGreaterThan(1);
      }
    }
  });
});
