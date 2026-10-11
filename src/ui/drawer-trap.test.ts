import { describe, expect, test } from 'vitest';
import { gaAlgorithm, type TrapOptions } from '../engine';
import { createRun } from '../run';
import { changes, draftOf, followedTargetFitness, optionsOf, optimumOf, problemOf, resetParams, toParams, toSetup, validate, type Draft } from './drawer-model';
import { entryOf } from './problems';

const entry = entryOf('trap')!;
const options = entry.defaultOptions() as TrapOptions;
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

describe('the trap draft', () => {
  test('carries the options as typed text, and is valid as it opens', () => {
    const d = fresh();
    expect(d.trap).toEqual({ blockSize: '4', blocks: '5', linkage: 'tight' });
    expect(d.options).toBeUndefined();
    expect(d.knapsack).toBeUndefined();
    expect(errorsOf(d)).toEqual({});
    expect(changes(d, current)).toEqual({ operator: [], reset: [] });
  });

  test('gives back the options it was made from, with every number read', () => {
    expect(optionsOf(fresh())).toEqual(options);
    const typed = withDraft((d) => ((d.trap!.blockSize = ' 3 '), (d.trap!.blocks = '6'), (d.trap!.linkage = 'loose')));
    expect(optionsOf(typed)).toEqual({ blockSize: 3, blocks: 6, linkage: 'loose' });
    expect((optionsOf(withDraft((d) => (d.trap!.blocks = 'x'))) as TrapOptions).blocks).toBeNaN();
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
  test('a block size or number of blocks out of range or not a whole number is named under its own field', () => {
    expect(errorsOf(withDraft((d) => (d.trap!.blockSize = '9')))).toEqual({ blockSize: 'Block size must be a whole number from 2 to 8 (it is 9).' });
    expect(errorsOf(withDraft((d) => (d.trap!.blockSize = '1'))).blockSize).toBe('Block size must be a whole number from 2 to 8 (it is 1).');
    expect(errorsOf(withDraft((d) => (d.trap!.blocks = '0')))).toEqual({ blocks: 'The number of blocks must be a whole number from 1 to 10 (it is 0).' });
    expect(errorsOf(withDraft((d) => (d.trap!.blocks = '2.5'))).blocks).toBe('The number of blocks must be a whole number from 1 to 10 (it is 2.5).');
  });

  test('text that is not a number is explained as such', () => {
    expect(errorsOf(withDraft((d) => (d.trap!.blockSize = 'abc'))).blockSize).toBe('Block size must be a whole number from 2 to 8 (it is not a number).');
    expect(errorsOf(withDraft((d) => (d.trap!.blocks = ''))).blocks).toBe('The number of blocks must be a whole number from 1 to 10 (it is not a number).');
  });

  test('too many genes in all is its own message, and only when both sizes are fine', () => {
    expect(errorsOf(withDraft((d) => ((d.trap!.blockSize = '8'), (d.trap!.blocks = '6'))))).toEqual({ genes: 'Block size × blocks: at most 30 genes in all (8 × 6 = 48).' });
    expect(errorsOf(withDraft((d) => ((d.trap!.blockSize = '9'), (d.trap!.blocks = '6'))))).toEqual({ blockSize: 'Block size must be a whole number from 2 to 8 (it is 9).' });
  });

  test('an unknown linkage is refused (the selector cannot produce it, a hand-made draft can)', () => {
    expect(errorsOf(withDraft((d) => (d.trap!.linkage = 'random' as never))).linkage).toBe('Linkage must be one of tight, loose.');
  });

  test('wrong options do not build a problem: the one the run has stays', () => {
    const bad = withDraft((d) => (d.trap!.blocks = '0'));
    expect(problemOf(bad, entry, problem)).toBe(problem);
    const good = withDraft((d) => ((d.trap!.blockSize = '3'), (d.trap!.blocks = '4'), (d.trap!.linkage = 'loose')));
    const built = problemOf(good, entry, problem);
    expect(built.chromosomeLength).toBe(12);
    expect(built.knownOptimumFitness).toBe(12);
  });

  test('a hand-edited population is read against the new number of genes, and not blamed while the options are wrong', () => {
    const hand = (text: string, edit: (d: Draft) => void = () => {}) =>
      withDraft((d) => {
        d.init = 'explicit';
        d.chromosomes = text;
        edit(d);
      });
    expect(errorsOf(hand('11110000111100001111 00000000000000000001')).chromosomes).toBeUndefined();
    expect(errorsOf(hand('1100')).chromosomes).toBe('Chromosome 1 has 4 genes, but this problem needs 20.');
    expect(errorsOf(hand('110011', (d) => ((d.trap!.blockSize = '3'), (d.trap!.blocks = '2')))).chromosomes).toBeUndefined();
    expect(Object.keys(errorsOf(hand('1100', (d) => (d.trap!.blocks = '0'))))).toEqual(['blocks']);
  });

  test('the crossover type must fit the number of genes: two genes cannot be cut twice', () => {
    const two = (edit: (d: Draft) => void = () => {}) =>
      withDraft((d) => {
        d.trap!.blockSize = '2';
        d.trap!.blocks = '1';
        edit(d);
      });
    expect(errorsOf(two())['crossover.operator']).toBeUndefined();
    expect(errorsOf(two((d) => (d.crossover.operator = 'two-point')))['crossover.operator']).toContain('Two-point crossover needs chromosomes of at least 3 genes');
    expect(errorsOf(two((d) => ((d.crossover.operator = 'two-point'), (d.crossover.enabled = false))))['crossover.operator']).toBeUndefined();
  });
});

describe('what the draft changes', () => {
  test('every option needs a reset, named', () => {
    expect(changes(withDraft((d) => (d.trap!.blockSize = '4 ')), current).reset).toEqual([]); // the same number, typed with a space
    expect(changes(withDraft((d) => (d.trap!.linkage = 'loose')), current)).toEqual({ operator: [], reset: ['Linkage'] });
    expect(changes(withDraft((d) => (d.trap!.blockSize = '3')), current).reset).toEqual(['Block size', 'Target fitness']); // 3 × 5 = 15 is the new optimum, and the stop at the optimum follows it
    expect(changes(withDraft((d) => ((d.trap!.blocks = '4'), (d.trap!.linkage = 'loose'))), current).reset).toEqual(['Number of blocks', 'Linkage', 'Target fitness']);
  });

  test('they are not operator parameters: nothing waits for a generation boundary', () => {
    expect(changes(withDraft((d) => (d.trap!.linkage = 'loose')), current).operator).toEqual([]);
  });

  test('another size moves “target fitness reached” to its optimum, k × m, and says so; a value the instructor chose is left alone', () => {
    const smaller = withDraft((d) => (d.trap!.blocks = '3'));
    expect(optimumOf(smaller)).toBe(12);
    expect(followedTargetFitness(smaller, problem)).toBe(12);
    expect(resetParams(smaller, problem).stop.targetFitness).toBe(12);
    const custom = withDraft((d) => ((d.trap!.blocks = '3'), (d.stop.target.value = '9')));
    expect(followedTargetFitness(custom, problem)).toBeUndefined();
    expect(resetParams(custom, problem).stop.targetFitness).toBe(9);
    expect(optimumOf(withDraft((d) => (d.trap!.blocks = '0')))).toBeUndefined();
    expect(followedTargetFitness(withDraft((d) => (d.trap!.linkage = 'loose')), problem)).toBeUndefined(); // linkage does not change the optimum
  });
});
