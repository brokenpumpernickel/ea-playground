import { describe, expect, test } from 'vitest';
import { gaAlgorithm, handlings, type KnapsackOptions } from '../engine';
import { createRun } from '../run';
import { changes, draftOf, followedTargetFitness, optionsOf, optimumOf, problemOf, resetParams, toParams, toSetup, validate, type Draft } from './drawer-model';
import { entryOf } from './problems';

const entry = entryOf('knapsack')!;
const options = entry.defaultOptions() as KnapsackOptions;
const problem = entry.create(options);
const setup = { problem, init: entry.defaults.init };
const params = entry.defaults.params;
const seed = entry.defaults.seed;
const fresh = (): Draft => draftOf(params, setup, seed, options);
const withDraft = (edit: (d: Draft) => void): Draft => {
  const d = fresh();
  edit(d);
  return d;
};
const current = { params, setup, seed, options };
const errorsOf = (d: Draft) => validate(d, problemOf(d, entry, problem), [], entry).errors;

describe('the knapsack draft', () => {
  test('carries the options as typed text, and is valid as it opens', () => {
    const d = fresh();
    expect(d.knapsack).toMatchObject({ capacity: '48', handling: 'decoder', rho: '4' });
    expect(d.knapsack!.items).toHaveLength(12);
    expect(d.knapsack!.items[1]).toEqual({ weight: '12', value: '20' });
    expect(d.options).toBeUndefined();
    expect(errorsOf(d)).toEqual({});
    expect(changes(d, current)).toEqual({ operator: [], reset: [] });
  });

  test('gives back the options it was made from, with every number read', () => {
    expect(optionsOf(fresh())).toEqual(options);
    const typed = withDraft((d) => ((d.knapsack!.capacity = ' 40 '), (d.knapsack!.items[0]!.weight = '7')));
    const read = optionsOf(typed) as KnapsackOptions;
    expect([read.capacity, read.items[0]]).toEqual([40, { weight: 7, value: 4 }]);
    expect((optionsOf(withDraft((d) => (d.knapsack!.rho = 'x'))) as KnapsackOptions).rho).toBeNaN();
  });

  test('gives back the same parameters and setup, so a run made from it is the same run', () => {
    const d = fresh();
    expect(toParams(d)).toMatchObject(params);
    expect(toSetup(d, problem)).toEqual(setup);
    const make = (p: typeof params) => {
      const run = createRun(gaAlgorithm, { setup, params: p, seed });
      for (let g = 0; g < 3; g++) run.forwardCycle();
      return [0, 1, 2, 3].map((c) => run.snapshot(c).state.population.map((i) => i.chromosome.join('')));
    };
    expect(make(toParams(d))).toEqual(make(params));
  });
});

describe('errors under the field they concern', () => {
  test('an item with a weight or value that is not a whole number in range names the item, and the item field gets them all', () => {
    const e = errorsOf(withDraft((d) => ((d.knapsack!.items[5]!.weight = '0'), (d.knapsack!.items[1]!.value = '1000'))));
    expect(e.items).toBe('Item B: the value must be a whole number from 1 to 999 (it is 1000). Item F: the weight must be a whole number from 1 to 99 (it is 0).');
    expect(Object.keys(e)).toEqual(['items']);
  });

  test('text that is not a number is explained as such', () => {
    expect(errorsOf(withDraft((d) => (d.knapsack!.items[0]!.weight = 'abc'))).items).toBe('Item A: the weight must be a whole number from 1 to 99 (it is not a number).');
    expect(errorsOf(withDraft((d) => (d.knapsack!.capacity = ''))).capacity).toBe('The capacity must be a whole number of at least 1 (it is not a number).');
    expect(errorsOf(withDraft((d) => (d.knapsack!.rho = '-1'))).rho).toBe('The penalty ρ must be a number from 0 to 1000 (it is -1).');
  });

  test('too few or too many items, and a capacity beyond the total weight', () => {
    expect(errorsOf(withDraft((d) => (d.knapsack!.items = d.knapsack!.items.slice(0, 1)))).items).toContain('A knapsack needs at least 2 items (there is 1).');
    expect(errorsOf(withDraft((d) => d.knapsack!.items.push(...Array.from({ length: 9 }, () => ({ weight: '1', value: '1' }))))).items).toContain('A knapsack can have at most 20 items (there are 21).');
    expect(errorsOf(withDraft((d) => (d.knapsack!.capacity = '98'))).capacity).toContain('The capacity can be at most the total weight, 97 (it is 98)');
  });

  test('wrong options do not build a problem: the one the run has stays', () => {
    const bad = withDraft((d) => (d.knapsack!.capacity = '0'));
    expect(problemOf(bad, entry, problem)).toBe(problem);
    const good = withDraft((d) => ((d.knapsack!.items = d.knapsack!.items.slice(0, 3)), (d.knapsack!.capacity = '10')));
    expect(problemOf(good, entry, problem).chromosomeLength).toBe(3);
  });

  test('a hand-edited population is read against the new number of items, and not blamed while the options are wrong', () => {
    const hand = (text: string, edit: (d: Draft) => void = () => {}) =>
      withDraft((d) => {
        d.init = 'explicit';
        d.chromosomes = text;
        edit(d);
      });
    expect(errorsOf(hand('110000000000 000000000001')).chromosomes).toBeUndefined();
    expect(errorsOf(hand('1100')).chromosomes).toBe('Chromosome 1 has 4 genes, but this problem needs 12.');
    expect(errorsOf(hand('110', (d) => ((d.knapsack!.items = d.knapsack!.items.slice(0, 3)), (d.knapsack!.capacity = '10')))).chromosomes).toBeUndefined();
    expect(Object.keys(errorsOf(hand('1100', (d) => (d.knapsack!.capacity = '0'))))).toEqual(['capacity']);
  });

  test('the crossover type must fit the number of items: two items cannot be cut twice', () => {
    const two = (edit: (d: Draft) => void = () => {}) =>
      withDraft((d) => {
        d.knapsack!.items = d.knapsack!.items.slice(0, 2);
        d.knapsack!.capacity = '10';
        edit(d);
      });
    expect(errorsOf(two())['crossover.operator']).toBeUndefined(); // one cut is fine
    expect(errorsOf(two((d) => (d.crossover.operator = 'two-point')))['crossover.operator']).toContain('Two-point crossover needs chromosomes of at least 3 genes');
    expect(errorsOf(two((d) => ((d.crossover.operator = 'two-point'), (d.crossover.enabled = false))))['crossover.operator']).toBeUndefined();
  });
});

describe('what the draft changes', () => {
  test('every part of the instance and the handling needs a reset, named', () => {
    // the optimum stays 123 when item A gets lighter (A is not in the best bag) and when the capacity drops to 47 (the best bag weighs 47)
    expect(changes(withDraft((d) => (d.knapsack!.items[0]!.weight = '8')), current)).toEqual({ operator: [], reset: ['Items'] });
    expect(changes(withDraft((d) => (d.knapsack!.capacity = '47')), current).reset).toEqual(['Capacity']);
    expect(changes(withDraft((d) => (d.knapsack!.handling = 'penalty')), current).reset).toEqual(['Constraint handling']);
    // a thirteenth item worth 9 for weight 3 raises the optimum to 125, so the stop at the optimum follows it
    expect(changes(withDraft((d) => d.knapsack!.items.push({ weight: '3', value: '9' })), current).reset).toEqual(['Items', 'Target fitness']);
  });

  test('ρ counts only while the penalty is the method, before and after', () => {
    expect(changes(withDraft((d) => (d.knapsack!.rho = '9')), current).reset).toEqual([]);
    const penalty = { ...current, options: { ...options, handling: 'penalty' as const }, setup: { problem: entry.create({ ...options, handling: 'penalty' }), init: setup.init } };
    const same = draftOf(params, penalty.setup, seed, penalty.options);
    expect(changes(same, penalty)).toEqual({ operator: [], reset: [] });
    same.knapsack!.rho = '9';
    expect(changes(same, penalty).reset).toEqual(['Penalty ρ']);
  });

  test('they are not operator parameters: nothing waits for a generation boundary', () => {
    expect(changes(withDraft((d) => (d.knapsack!.capacity = '47')), current).operator).toEqual([]);
  });

  test('another instance moves “target fitness reached” to its optimum, and says so; a value the instructor chose is left alone', () => {
    const lighter = withDraft((d) => (d.knapsack!.capacity = '40'));
    const newBest = optimumOf(lighter)!;
    expect(newBest).toBe(112); // worked out independently: a capacity of 40 holds at most 112
    expect(followedTargetFitness(lighter, problem)).toBe(newBest);
    expect(resetParams(lighter, problem).stop.targetFitness).toBe(newBest);
    expect(changes(lighter, current).reset).toEqual(['Capacity', 'Target fitness']);
    const custom = withDraft((d) => ((d.knapsack!.capacity = '40'), (d.stop.target.value = '100')));
    expect(followedTargetFitness(custom, problem)).toBeUndefined();
    expect(resetParams(custom, problem).stop.targetFitness).toBe(100);
    expect(optimumOf(withDraft((d) => (d.knapsack!.capacity = '0')))).toBeUndefined(); // invalid options have no optimum
  });

  test('a restart from the draft is the run the options describe, for every method', () => {
    for (const handling of handlings) {
      const d = withDraft((x) => ((x.knapsack!.handling = handling), (x.knapsack!.items = x.knapsack!.items.slice(0, 8)), (x.knapsack!.capacity = '30')));
      const next = problemOf(d, entry, problem);
      expect(next.chromosomeLength).toBe(8);
      const run = createRun(gaAlgorithm, { setup: toSetup(d, next), params: resetParams(d, problem), seed: 3 });
      run.forwardCycle();
      expect(run.snapshot(0).state.population.every((i) => i.chromosome.length === 8)).toBe(true);
    }
  });
});
