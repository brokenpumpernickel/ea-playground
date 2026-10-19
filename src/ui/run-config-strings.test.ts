import { describe, expect, test } from 'vitest';
import { createRng, gaAlgorithm, metricsOfProblem, minimumGenes, type GaParams, type Initialization, type StepSpec } from '../engine';
import { createRun } from '../run';
import { presets } from './presets';
import { entryOf, type ProblemOptions } from './problems';
import { configOf, decodeConfig, encodeConfig, setupOf, type RunConfig } from './run-config';

const entry = entryOf('target-string')!;
const defaults = entry.defaults;
const options = entry.defaultOptions()!;
const base = configOf({ problem: entry.create(options), init: defaults.init }, defaults.params, defaults.seed, 'target-string', options);

const b64 = (text: string) => btoa(String.fromCharCode(...new TextEncoder().encode(text))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const link = (value: unknown) => `#v1.${b64(JSON.stringify(value))}`;
const edited = (change: (c: Record<string, any>) => void) => {
  const copy = JSON.parse(JSON.stringify(base)) as Record<string, any>;
  change(copy);
  return link(copy);
};
const problemsOf = (hash: string): string[] => {
  const result = decodeConfig(hash);
  expect(result.ok).toBe(false);
  return result.ok ? [] : [...result.problems];
};
const configFor = (opts: ProblemOptions, init: Initialization = defaults.init, params: GaParams = defaults.params, seed = 1): RunConfig =>
  configOf({ problem: entry.create(opts), init }, params, seed, 'target-string', opts);
const roundTrip = (config: RunConfig) => {
  const result = decodeConfig(encodeConfig(config));
  expect(result.ok ? [] : result.problems).toEqual([]);
  if (result.ok) expect(result.config).toEqual(config);
  return result.ok ? result.config : config;
};
const trace = (config: RunConfig, generations = 6) => {
  const run = createRun(gaAlgorithm, { setup: setupOf(config), params: config.params, seed: config.seed });
  for (let g = 0; g < generations; g++) run.forwardCycle();
  return {
    populations: Array.from({ length: generations + 1 }, (_, g) => run.snapshot(g).state.population.map((i) => `${i.id}:${i.chromosome.join(',')}`)),
    events: run.events(generations),
    metrics: metricsOfProblem(run.snapshot(generations).state, setupOf(config).problem),
  };
};

describe('the target string configuration in a link', () => {
  test('carries the problem and its options, and reads back as the same run', () => {
    expect(base).toMatchObject({ v: 1, problem: 'target-string', options: { alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ ', target: 'HELLO' } });
    expect(decodeConfig(encodeConfig(base))).toEqual({ ok: true, config: base });
    const setup = setupOf(base);
    expect(setup.problem.chromosomeLength).toBe(5);
    expect(setup.problem.alphabet).toHaveLength(27);
  });

  test('the link is plain text: the target and alphabet can be read in it, a space and all', () => {
    const payload = encodeConfig(base).slice(4).replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(payload + '='.repeat((4 - (payload.length % 4)) % 4));
    expect(json).toContain('"target":"HELLO"');
    expect(json).toContain('"alphabet":"ABCDEFGHIJKLMNOPQRSTUVWXYZ "');
  });
});

describe('round trip and run equality', () => {
  test('the default configuration of every problem and every preset, each with its own problem and options', () => {
    expect(presets.filter((p) => p.problem === 'goldberg')).toHaveLength(4);
    expect(presets.filter((p) => p.problem === 'target-string')).toHaveLength(3);
    expect(presets.filter((p) => p.problem === 'knapsack')).toHaveLength(5);
    expect(presets.filter((p) => p.problem === 'landscape')).toHaveLength(12);
    for (const preset of presets) {
      const config = configOf(preset.setup, preset.params, preset.seed, preset.problem, preset.options);
      expect(config.problem).toBe(preset.problem);
      expect('options' in config).toBe(preset.problem !== 'goldberg');
      const decoded = roundTrip(config);
      expect(trace(decoded)).toEqual(trace(config));
    }
    for (const id of ['goldberg', 'target-string', 'knapsack']) {
      const e = entryOf(id)!;
      const options = e.defaultOptions();
      const decoded = roundTrip(configOf({ problem: e.create(options), init: e.defaults.init }, e.defaults.params, e.defaults.seed, id, options));
      expect(trace(decoded, 3)).toEqual(trace(configOf({ problem: e.create(options), init: e.defaults.init }, e.defaults.params, e.defaults.seed, id, options), 3));
    }
  });

  test('the extremes: a space-only alphabet pair, 40 symbols, a 24-letter target, a one-letter target, symbols beyond ASCII', () => {
    const forty = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmn';
    expect([...forty]).toHaveLength(40);
    for (const opts of [
      { alphabet: ' x', target: ' x'.repeat(12) },
      { alphabet: forty, target: forty.slice(0, 24) },
      { alphabet: 'ab', target: 'a' },
      { alphabet: 'éßñü øå', target: 'üßé ø' },
      { alphabet: 'ab😀😁', target: '😀a😁b' }, // two UTF-16 units per symbol: they count as one symbol each
      { alphabet: '01', target: '01101' },
    ]) {
      // uniform crossover works on any length; the cutting operators need at least 2 or 3 genes
      const config = configFor(opts, defaults.init, { ...defaults.params, crossover: { enabled: true, operator: 'uniform', probability: 0.8 } });
      const decoded = roundTrip(config);
      expect(setupOf(decoded).problem.chromosomeLength).toBe([...opts.target].length);
      expect(trace(decoded, 4)).toEqual(trace(config, 4));
    }
  });

  test('hand-edited string populations survive the link, spaces and all, and start the same run', () => {
    const opts = { alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ ', target: 'HI YOU' };
    const chromosomes = ['HI YOU', 'HI  OU', ' I YOU', 'ZZZZZZ', 'A B C '];
    const config = configFor(opts, { kind: 'explicit', chromosomes });
    const decoded = roundTrip(config);
    expect(setupOf(decoded).init).toEqual({ kind: 'explicit', chromosomes });
    const run = createRun(gaAlgorithm, { setup: setupOf(decoded), params: decoded.params, seed: decoded.seed });
    expect(run.snapshot(0).state.population.map((i) => i.decoded)).toEqual(chromosomes);
    expect(trace(decoded)).toEqual(trace(config));
  });

  test('200 generated string configurations: alphabets of 2 to 40 symbols, targets of 1 to 24 letters, every selection method, operator, mode and stop setting, random and hand-edited populations', () => {
    const rng = createRng(77);
    const pool = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,!?éßñü'];
    const int = (lo: number, hi: number) => lo + Math.floor(rng.next() * (hi - lo + 1));
    const pick = <T,>(items: readonly T[]): T => items[int(0, items.length - 1)]!;
    const chains: StepSpec[][] = [[{ step: 'identity' }], [{ step: 'shift', epsilon: 0.5 }], [{ step: 'rank' }], [{ step: 'rank' }, { step: 'linear-ranking', pressure: 1.5 }]];
    for (let k = 0; k < 200; k++) {
      const shuffled = [...pool].sort(() => rng.next() - 0.5);
      const alphabet = shuffled.slice(0, int(2, 40));
      const target = Array.from({ length: int(1, 24) }, () => pick(alphabet)).join('');
      const size = int(1, 14);
      const init: Initialization =
        rng.next() < 0.5
          ? { kind: 'random', size }
          : { kind: 'explicit', chromosomes: Array.from({ length: size }, () => Array.from({ length: [...target].length }, () => pick(alphabet)).join('')) };
      const elites = int(0, size);
      const params: GaParams = {
        selection: rng.next() < 0.5 ? { method: 'tournament', size: int(1, 5) } : { method: 'roulette', chain: [{ step: 'shift', epsilon: 0.5 }, ...pick(chains).filter((s) => s.step !== 'identity')] },
        crossover: { enabled: rng.next() < 0.8, operator: pick((['one-point', 'two-point', 'uniform'] as const).filter((o) => minimumGenes[o] <= [...target].length)), probability: int(0, 100) / 100 },
        mutation: { enabled: rng.next() < 0.8, mode: pick(['per-gene', 'per-individual'] as const), probability: int(0, 100) / 100 },
        elites,
        ...(rng.next() < 0.4 ? { truncation: { enabled: true, lambda: Math.max(1, size - elites + int(0, 4)) } } : {}),
        stop: {
          generationLimit: int(1, 200),
          ...(rng.next() < 0.5 ? { targetFitness: int(0, [...target].length) } : {}),
          ...(rng.next() < 0.5 ? { stagnationWindow: int(1, 30) } : {}),
        },
      };
      const config = configFor({ alphabet: alphabet.join(''), target }, init, params, int(0, 4294967295));
      const decoded = roundTrip(config);
      if (k % 10 === 0) expect(trace(decoded, 3)).toEqual(trace(config, 3));
    }
  });
});

describe('the crossover operator must fit the target', () => {
  test('a one-letter target cannot be cut once and a two-letter one cannot be cut twice, so a link asking for it is refused in words', () => {
    const one = { alphabet: 'ab', target: 'a' };
    const withOperator = (operator: string, target: string, enabled = true) =>
      edited((c) => ((c.options = { alphabet: 'ab', target }), (c.params.crossover = { enabled, operator, probability: 0.8 })));
    expect(problemsOf(withOperator('one-point', 'a'))).toEqual([
      "One-point crossover needs chromosomes of at least 2 genes, but this problem's have 1. Choose another crossover type, switch crossover off or make the target longer.",
    ]);
    expect(problemsOf(withOperator('two-point', 'ab'))[0]).toContain('Two-point crossover needs chromosomes of at least 3 genes');
    for (const ok of [withOperator('uniform', 'a'), withOperator('one-point', 'ab'), withOperator('two-point', 'aba'), withOperator('one-point', 'a', false)]) {
      expect(decodeConfig(ok)).toMatchObject({ ok: true });
    }
    expect(one.target).toBe('a');
  });
});

describe('bad string links: each is refused with the drawer’s own words, and nothing is used', () => {
  test('a target letter that is not in the alphabet, with its position', () => {
    expect(problemsOf(edited((c) => (c.options.target = 'HELLO, WORLD')))).toEqual([
      'The target contains "," (position 6), which is not in the alphabet. Add it to the alphabet or remove it from the target.',
    ]);
    // a target without spaces is fine in an alphabet without one
    expect(decodeConfig(edited((c) => (c.options.alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ')))).toMatchObject({ ok: true });
  });

  test('a repeated symbol, naming it (a space is called a space)', () => {
    expect(problemsOf(edited((c) => (c.options.alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ A')))).toEqual(['The alphabet contains "A" more than once.']);
    expect(problemsOf(edited((c) => (c.options.alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ  ')))).toEqual(['The alphabet contains a space more than once.']);
  });

  test('a target that is too long, an alphabet that is too long or too short, an empty target', () => {
    expect(problemsOf(edited((c) => (c.options.target = 'A'.repeat(25))))).toEqual(['The target can have at most 24 characters (it has 25).']);
    expect(problemsOf(edited((c) => ((c.options.alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopq'), (c.options.target = 'HELLO'))))).toEqual(['The alphabet can have at most 40 symbols (it has 43).']);
    expect(problemsOf(edited((c) => ((c.options.alphabet = 'H'), (c.options.target = 'H'))))).toEqual(['The alphabet needs at least 2 symbols, so that a gene has something to change into.']);
    expect(problemsOf(edited((c) => (c.options.target = '')))).toEqual(['The target must not be empty.']);
  });

  test('options that are missing, of the wrong shape or for a problem that takes none', () => {
    expect(problemsOf(edited((c) => delete c.options))).toEqual(['"configuration" is missing "options", which Target string needs.']);
    expect(problemsOf(edited((c) => (c.options = 'HELLO')))).toEqual(['"options" must be an object with an "alphabet" and a "target".']);
    expect(problemsOf(edited((c) => (c.options = { alphabet: 'AB' })))).toEqual(['"options" is missing "target".']);
    expect(problemsOf(edited((c) => (c.options.target = 5)))).toEqual(['"options.target" must be text.']);
    expect(problemsOf(edited((c) => (c.options.speed = 3)))).toEqual(['"options" has an unknown key "speed".']);
    expect(problemsOf(edited((c) => (c.problem = 'goldberg')))).toEqual(['"configuration" has an unknown key "options".']);
  });

  test('a hand-edited string that does not fit the alphabet or the length is named, as the drawer names it', () => {
    expect(problemsOf(edited((c) => (c.setup.init = { kind: 'explicit', chromosomes: ['HELLO', 'hello'] })))[0]).toBe('Chromosome 2 ("hello") may only contain the characters of the alphabet (27 symbols).');
    expect(problemsOf(edited((c) => (c.setup.init = { kind: 'explicit', chromosomes: ['HELLO', 'HELL'] })))).toEqual(['Chromosome 2 has 4 genes, but this problem needs 5.']);
  });

  test('several problems at once are all reported, and a good part does not survive a bad one', () => {
    const problems = problemsOf(
      edited((c) => {
        c.options.target = 'HELLO, WORLD';
        c.options.alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ  ';
        c.params.crossover.probability = 1.5;
      }),
    );
    // the options are checked with the structure, so both of their problems come together; what the drawer would
    // refuse in the parameters is checked once the structure is sound
    expect(problems).toContain('The alphabet contains a space more than once.');
    expect(problems.some((p) => p.startsWith('The target contains ","'))).toBe(true);
    expect(problems.length).toBe(2);
    expect(problemsOf(edited((c) => (c.params.crossover.probability = 1.5)))).toEqual(['The crossover probability must be a number from 0 to 1.']);
  });
});
