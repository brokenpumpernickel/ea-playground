import { describe, expect, test } from 'vitest';
import { gaAlgorithm } from '../engine';
import { createRun } from '../run';
import { draftOf, validate } from './drawer-model';
import { entryOf, problemEntries, problemIds } from './problems';
import { configOf, decodeConfig, encodeConfig, setupOf } from './run-config';

describe('the problem registry', () => {
  test('lists Goldberg, the target string, the knapsack and the trap, in that order, with distinct ids and names', () => {
    expect(problemIds()).toEqual(['goldberg', 'target-string', 'knapsack', 'trap']);
    expect(new Set(problemEntries.map((p) => p.name)).size).toBe(4);
    expect(entryOf('trap')!.name).toBe('Trap');
    expect(entryOf('knapsack')!.name).toBe('Knapsack');
    expect(entryOf('goldberg')!.name).toBe('Goldberg x²');
    expect(entryOf('target-string')!.name).toBe('Target string');
    expect(entryOf('tsp')).toBeUndefined();
  });

  test.each(problemEntries.map((p) => [p.name, p] as const))('%s: its defaults make a valid configuration that runs', (_name, entry) => {
    const options = entry.defaultOptions();
    expect(entry.validateOptions(options)).toEqual([]);
    const problem = entry.create(options);
    const setup = { problem, init: entry.defaults.init };
    const run = createRun(gaAlgorithm, { setup, params: entry.defaults.params, seed: entry.defaults.seed });
    for (let g = 0; g < 3; g++) run.forwardCycle();
    expect(run.lastCycle).toBe(3);
    const sample = run.snapshot(0).state.population.map((i) => i.fitness);
    expect(validate(draftOf(entry.defaults.params, setup, entry.defaults.seed), problem, sample).errors).toEqual({});
  });

  test('the two problems open with their own population, parameters and subtitle', () => {
    const [g, t] = problemEntries;
    expect(g!.defaults.init).toEqual({ kind: 'random', size: 6 });
    expect(g!.defaults.params.selection).toEqual({ method: 'roulette', chain: [{ step: 'identity' }] });
    expect(g!.subtitle(undefined)).toBe('Maximise x² on 0…31');
    expect(t!.defaults.init).toEqual({ kind: 'random', size: 12 });
    expect(t!.defaults.params.selection).toEqual({ method: 'tournament', size: 3 });
    expect(t!.subtitle(t!.defaultOptions())).toBe('Match “HELLO” · 27 symbols');
  });

  test('default options are fresh copies, so a change to one cannot leak into the next run', () => {
    const t = entryOf('target-string')!;
    const a = t.defaultOptions()!;
    (a as { target: string }).target = 'CHANGED';
    expect((t.defaultOptions() as { target: string }).target).toBe('HELLO');
  });

  test('options are validated in words, whatever they are', () => {
    const t = entryOf('target-string')!;
    expect(t.validateOptions(undefined)[0]).toContain('must be an object');
    expect(t.validateOptions({ alphabet: 'AB' })).toEqual(['"options" is missing "target".']);
    expect(t.validateOptions({ alphabet: 'AB', target: 5 })).toEqual(['"options.target" must be text.']);
    expect(t.validateOptions({ alphabet: 'AB', target: 'A', speed: 1 })).toEqual(['"options" has an unknown key "speed".']);
    expect(t.validateOptions({ alphabet: 'AB', target: 'ABC' })[0]).toContain('The target contains "C"');
    expect(entryOf('goldberg')!.validateOptions({ alphabet: 'AB' })).toEqual(['This problem takes no options.']);
  });
});

describe('share links with a problem’s options', () => {
  const t = entryOf('target-string')!;
  const options = t.defaultOptions()!;
  const config = configOf({ problem: t.create(options), init: t.defaults.init }, t.defaults.params, 5, 'target-string', options);
  const goldberg = entryOf('goldberg')!;
  const goldbergConfig = configOf({ problem: goldberg.create(undefined), init: goldberg.defaults.init }, goldberg.defaults.params, 1);

  test('a target string configuration carries its options and round-trips', () => {
    expect(config).toMatchObject({ v: 1, problem: 'target-string', options: { alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ ', target: 'HELLO' } });
    const result = decodeConfig(encodeConfig(config));
    expect(result.ok && result.config).toEqual(config);
    expect(setupOf(config).problem.chromosomeLength).toBe(5);
    expect(setupOf(config).problem.alphabet).toHaveLength(27);
  });

  test('Goldberg configurations have no options key, so every link made before this change still opens', () => {
    expect('options' in goldbergConfig).toBe(false);
    expect(decodeConfig(encodeConfig(goldbergConfig)).ok).toBe(true);
  });

  const b64 = (v: unknown) => `#v1.${btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(v)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;
  const problemsOf = (base: object, change: (c: Record<string, any>) => void) => {
    const copy = JSON.parse(JSON.stringify(base)) as Record<string, any>;
    change(copy);
    const r = decodeConfig(b64(copy));
    return r.ok ? [] : [...r.problems];
  };
  const problems = (change: (c: Record<string, any>) => void) => problemsOf(config, change);

  test('bad options are refused with the same messages the setup uses', () => {
    expect(problems((c) => delete c.options)).toEqual(['"configuration" is missing "options", which Target string needs.']);
    expect(problems((c) => (c.options.target = 'HELLO, WORLD'))[0]).toContain('The target contains ","');
    expect(problems((c) => (c.options.alphabet = 'ABB'))[0]).toContain('The alphabet contains "B" more than once.');
    expect(problems((c) => (c.options.colour = 'red'))).toEqual(['"options" has an unknown key "colour".']);
    expect(problems((c) => (c.options = 'HELLO'))[0]).toContain('"options" must be an object');
  });

  test('a problem that takes no options refuses them', () => {
    expect(problemsOf(goldbergConfig, (c) => (c.options = { alphabet: 'AB', target: 'A' }))).toEqual(['"configuration" has an unknown key "options".']);
  });

  test('a population typed for the string problem is checked against its alphabet', () => {
    expect(problems((c) => (c.setup.init = { kind: 'explicit', chromosomes: ['HELLO', 'hello'] }))[0]).toContain('Chromosome 2 ("hello") may only contain the characters of the alphabet (27 symbols).');
    expect(problems((c) => (c.setup.init = { kind: 'explicit', chromosomes: ['HELLO', 'HI'] }))[0]).toContain('Chromosome 2 has 2 genes, but this problem needs 5');
  });

  test('elites are checked against the string problem’s own population', () => {
    expect(problems((c) => (c.params.elites = 13))[0]).toContain('from 0 to the population size (12)');
  });
});
