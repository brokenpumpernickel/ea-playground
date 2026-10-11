import { describe, expect, test } from 'vitest';
import { gaAlgorithm, targetStringProblem } from '../engine';
import { createRun } from '../run';
import { changes, draftOf, followedTargetFitness, parseChromosomes, problemOf, resetParams, toParams, toSetup, validate, type Draft } from './drawer-model';
import { entryOf } from './problems';

const entry = entryOf('target-string')!;
const options = entry.defaultOptions()!;
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
const errorsOf = (d: Draft, entryForCheck = entry) => validate(d, problemOf(d, entryForCheck, problem), [], entryForCheck).errors;

describe('the target string draft', () => {
  test('carries the typed alphabet and target and is valid as it opens', () => {
    const d = fresh();
    expect(d.options).toEqual({ alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ ', target: 'HELLO' });
    expect(errorsOf(d)).toEqual({});
    expect(changes(d, current)).toEqual({ operator: [], reset: [] });
  });

  test('gives back the same parameters and setup, so a run made from it is the same run', () => {
    const d = fresh();
    expect(toParams(d)).toMatchObject(params);
    expect(toSetup(d, problem)).toEqual(setup);
    const make = (p: typeof params) => {
      const run = createRun(gaAlgorithm, { setup, params: p, seed });
      for (let g = 0; g < 3; g++) run.forwardCycle();
      return [0, 1, 2, 3].map((c) => run.snapshot(c).state.population.map((i) => i.chromosome.join(',')));
    };
    expect(make(toParams(d))).toEqual(make(params));
  });

  test('a problem without options has no option fields to check', () => {
    const goldbergEntry = entryOf('goldberg')!;
    const d = draftOf(params, setup, seed);
    expect(d.options).toBeUndefined();
    expect(validate(d, problem, [], goldbergEntry).errors).toEqual({});
  });
});

describe('alphabet and target errors', () => {
  test('a target letter outside the alphabet names the character and its position, under the target', () => {
    const errors = errorsOf(withDraft((d) => (d.options!.target = 'HELLO, WORLD')));
    expect(errors.target).toContain('The target contains "," (position 6), which is not in the alphabet.');
    expect(errors.alphabet).toBeUndefined();
  });

  test('a repeated symbol, a short alphabet and a control character are explained under the alphabet', () => {
    expect(errorsOf(withDraft((d) => (d.options!.alphabet = 'ABCA'))).alphabet).toBe('The alphabet contains "A" more than once.');
    expect(errorsOf(withDraft((d) => ((d.options!.alphabet = 'H'), (d.options!.target = 'H')))).alphabet).toContain('at least 2 symbols');
    expect(errorsOf(withDraft((d) => (d.options!.alphabet += '\t'))).alphabet).toContain('visible characters');
  });

  test('an empty or over-long target is explained under the target', () => {
    expect(errorsOf(withDraft((d) => (d.options!.target = ''))).target).toBe('The target must not be empty.');
    expect(errorsOf(withDraft((d) => (d.options!.target = 'A'.repeat(25)))).target).toContain('at most 24 characters (it has 25)');
  });

  test('a repeated space in the alphabet is called a space', () => {
    expect(errorsOf(withDraft((d) => (d.options!.alphabet = 'AB  '))).alphabet).toBe('The alphabet contains a space more than once.');
  });

  test('wrong options do not build a problem: the one the run has stays', () => {
    const bad = withDraft((d) => (d.options!.target = '???'));
    expect(problemOf(bad, entry, problem)).toBe(problem);
    const good = withDraft((d) => (d.options!.target = 'HI'));
    expect(problemOf(good, entry, problem).chromosomeLength).toBe(2);
  });
});

describe('hand-edited strings against the typed alphabet', () => {
  const hand = (text: string, edit: (d: Draft) => void = () => {}) =>
    withDraft((d) => {
      d.init = 'explicit';
      d.chromosomes = text;
      edit(d);
    });

  test('strings are checked against the length and the alphabet, naming the chromosome', () => {
    expect(errorsOf(hand('HELLO\nJELLY')).chromosomes).toBeUndefined();
    expect(errorsOf(hand('HELLO\nHELP')).chromosomes).toBe('Chromosome 2 has 4 genes, but this problem needs 5.');
    expect(errorsOf(hand('HELLO\nhello')).chromosomes).toContain('Chromosome 2 ("hello") may only contain the characters');
  });

  test('a space is a letter of the alphabet, so a string with a space is one line, not two', () => {
    const rows = parseChromosomes('HI YO\nZZ ZZ', problem);
    expect(rows.map((r) => r.text)).toEqual(['HI YO', 'ZZ ZZ']);
    expect(rows.every((r) => r.error === undefined)).toBe(true);
  });

  test('every row shows its matches and fitness as the problem scores them', () => {
    const rows = parseChromosomes('HELLO\nJELLY\nZZZZZ', problem);
    expect(rows.map((r) => r.fitness)).toEqual([5, 3, 0]);
    expect(rows.map((r) => r.cells)).toEqual([['5 of 5'], ['3 of 5'], ['0 of 5']]);
  });

  test('they are read against the new target and alphabet, not the old ones', () => {
    const newProblem = problemOf(hand('HI', (d) => (d.options!.target = 'HI')), entry, problem);
    expect(parseChromosomes('HI\nHELLO', newProblem).map((r) => r.error === undefined)).toEqual([true, false]);
    const d = hand('HI\nHO', (x) => (x.options!.target = 'HI'));
    expect(validate(d, newProblem, [], entry).errors).toEqual({});
    // while the options are wrong the strings are not blamed for it
    const wrong = hand('HI\nHO', (x) => (x.options!.target = 'H1'));
    expect(Object.keys(validate(wrong, problemOf(wrong, entry, problem), [], entry).errors)).toEqual(['target']);
  });

  test('an empty text asks for a string that fits this problem, not for bits', () => {
    expect(errorsOf(hand('')).chromosomes).toBe('Type at least one chromosome, for example ABCDE.');
  });
});

describe('what the draft changes', () => {
  test('the alphabet and the target need a reset, and are named', () => {
    expect(changes(withDraft((d) => (d.options!.alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ')), current).reset).toEqual(['Alphabet']);
    expect(changes(withDraft((d) => (d.options!.target = 'WORLD')), current)).toEqual({ operator: [], reset: ['Target'] });
    expect(changes(withDraft((d) => ((d.options!.target = 'WORLD'), (d.options!.alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'))), current).reset).toEqual(['Alphabet', 'Target']);
  });

  test('they are not operator parameters: nothing waits for a generation boundary', () => {
    expect(changes(withDraft((d) => (d.options!.target = 'WORLD')), current).operator).toEqual([]);
  });

  test('a longer target moves a stop at the old optimum to the new length, and says so', () => {
    const d = withDraft((x) => (x.options!.target = 'HELLO WORLD'));
    expect(followedTargetFitness(d, problem)).toBe(11);
    expect(resetParams(d, problem).stop.targetFitness).toBe(11);
    expect(changes(d, current).reset).toEqual(['Target', 'Target fitness']);
  });

  test('a stop target the user set to something else is left alone, and so is a switched-off one', () => {
    const custom = withDraft((x) => ((x.options!.target = 'HELLO WORLD'), (x.stop.target.value = '4')));
    expect(followedTargetFitness(custom, problem)).toBeUndefined();
    expect(resetParams(custom, problem).stop.targetFitness).toBe(4);
    const off = withDraft((x) => ((x.options!.target = 'HELLO WORLD'), (x.stop.target.enabled = false)));
    expect(resetParams(off, problem).stop.targetFitness).toBeUndefined();
    expect(changes(off, current).reset).toEqual(['Target']);
  });

  test('a target of the same length changes nothing about the stop', () => {
    const d = withDraft((x) => (x.options!.target = 'WORLD'));
    expect(followedTargetFitness(d, problem)).toBeUndefined();
    expect(resetParams(d, problem)).toMatchObject(params);
  });

  test('a restart from the draft is the run the options describe', () => {
    const d = withDraft((x) => ((x.options!.alphabet = 'ABCDE'), (x.options!.target = 'ABBA')));
    const next = problemOf(d, entry, problem);
    expect(next).toEqual(expect.objectContaining({ chromosomeLength: 4 }));
    const run = createRun(gaAlgorithm, { setup: toSetup(d, next), params: resetParams(d, problem), seed: 3 });
    run.forwardCycle();
    expect(run.snapshot(0).state.population.every((i) => i.chromosome.length === 4 && i.chromosome.every((g) => g < 5))).toBe(true);
    expect(targetStringProblem({ alphabet: 'ABCDE', target: 'ABBA' }).alphabet).toEqual(next.alphabet);
  });
});
