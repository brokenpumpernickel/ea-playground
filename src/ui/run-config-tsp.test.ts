import { describe, expect, test } from 'vitest';
import { createRng, gaAlgorithm, metricsOfProblem, tspCatalogue, type GaParams, type Initialization, type TspOptions } from '../engine';
import { createRun } from '../run';
import { defaultsOf, entryOf } from './problems';
import { configOf, decodeConfig, encodeConfig, setupOf, type RunConfig } from './run-config';

const entry = entryOf('tsp')!;
const optionsOf = (o: Partial<TspOptions> = {}): TspOptions => ({ ...(entry.defaultOptions() as TspOptions), ...o });
const make = (options: TspOptions, change: (d: ReturnType<typeof defaultsOf>) => { init?: Initialization; params?: GaParams } = () => ({}), seed = 9): RunConfig => {
  const d = defaultsOf(entry, options);
  const c = change(d);
  return configOf({ problem: entry.create(options), init: c.init ?? d.init }, c.params ?? d.params, seed, 'tsp', options);
};
const b64 = (text: string) => btoa(String.fromCharCode(...new TextEncoder().encode(text))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const edited = (config: RunConfig, change: (c: Record<string, any>) => void) => {
  const copy = JSON.parse(JSON.stringify(config)) as Record<string, any>;
  change(copy);
  return `#v1.${b64(JSON.stringify(copy))}`;
};
const problemsOf = (hash: string): string[] => {
  const r = decodeConfig(hash);
  expect(r.ok).toBe(false);
  return r.ok ? [] : [...r.problems];
};
const trace = (config: RunConfig, generations = 5) => {
  const run = createRun(gaAlgorithm, { setup: setupOf(config), params: config.params, seed: config.seed });
  for (let g = 0; g < generations; g++) run.forwardCycle();
  const problem = setupOf(config).problem;
  return {
    populations: Array.from({ length: generations + 1 }, (_, g) => run.snapshot(g).state.population),
    events: run.events(generations),
    metrics: metricsOfProblem(run.snapshot(generations).state, problem),
  };
};

describe('a TSP configuration in a link', () => {
  test.each(tspCatalogue.map((c) => c.id))('%s: round trips and opens as the same run (populations, events, metrics)', (id) => {
    const config = make(optionsOf({ instance: id, n: 9, seed: 4 }));
    const decoded = decodeConfig(encodeConfig(config));
    expect(decoded).toEqual({ ok: true, config });
    if (decoded.ok) expect(trace(decoded.config)).toEqual(trace(config));
  });

  test.each([
    ['ox', 'swap'],
    ['pmx', 'insertion'],
    ['cx', 'inversion'],
  ] as const)('%s crossover with %s mutation round trips', (crossover, mutation) => {
    const config = make(optionsOf(), (d) => ({ params: { ...d.params, crossover: { enabled: true, operator: crossover, probability: 0.7 }, mutation: { enabled: true, mode: 'per-individual', probability: 0.3, operator: mutation } } }));
    const decoded = decodeConfig(encodeConfig(config));
    expect(decoded).toEqual({ ok: true, config });
    if (decoded.ok) expect(trace(decoded.config)).toEqual(trace(config));
  });

  test('switched-off crossover and mutation, elites, truncation and the stops round trip', () => {
    const config = make(optionsOf({ instance: 'att48' }), (d) => ({
      params: { ...d.params, crossover: { ...d.params.crossover, enabled: false }, mutation: { ...d.params.mutation, enabled: false }, elites: 2, truncation: { enabled: true, lambda: 20 }, stop: { generationLimit: 80, targetEpsilon: 3, stagnationWindow: 12 } },
    }));
    expect(decodeConfig(encodeConfig(config))).toEqual({ ok: true, config });
  });

  test('a hand-edited population of tours (with a rotation, a reversal and commas) is carried exactly', () => {
    const config = make(optionsOf({ instance: 'circle', n: 6 }), () => ({ init: { kind: 'explicit', chromosomes: ['1 2 3 4 5 6', '4,3,2,1,6,5', '2 1 4 3 6 5'] } }));
    const decoded = decodeConfig(encodeConfig(config));
    expect(decoded).toEqual({ ok: true, config });
    if (decoded.ok) expect(trace(decoded.config).populations[0]!.map((i) => i.chromosome)).toEqual([[0, 1, 2, 3, 4, 5], [3, 2, 1, 0, 5, 4], [1, 0, 3, 2, 5, 4]]);
  });

  test('every bad-option case is said in words and nothing is used', () => {
    const base = make(optionsOf());
    const cases: [string, (c: Record<string, any>) => void, string][] = [
      ['an unknown instance', (c) => (c.options.instance = 'att49'), 'Instance must be one of circle, clusters, random, burma14'],
      ['too few cities', (c) => ((c.options.instance = 'circle'), (c.options.n = 3)), 'The number of cities must be a whole number from 5 to 15 (it is 3).'],
      ['a negative seed', (c) => ((c.options.instance = 'random'), (c.options.seed = -1)), 'The seed must be a whole number of 0 or more (it is -1).'],
      ['a missing key', (c) => delete c.options.seed, '"options" is missing "seed".'],
      ['an unknown key', (c) => (c.options.colour = 'red'), '"options" has an unknown key "colour".'],
      ['a wrong type', (c) => (c.options.n = 'ten'), '"options.n" must be a number.'],
    ];
    for (const [label, change, words] of cases) {
      const found = problemsOf(edited(base, change));
      expect(found.some((p) => p.includes(words)), `${label}: ${found.join(' | ')}`).toBe(true);
    }
  });

  test('an operator that does not exist for a permutation is refused in words, as is a permutation operator on another problem', () => {
    const base = make(optionsOf());
    const symbol = problemsOf(edited(base, (c) => (c.params.crossover.operator = 'one-point')));
    expect(symbol).toContain('One-point crossover would repeat and lose cities; choose order, partial-mapped or cycle crossover for this problem.');
    const real = problemsOf(edited(base, (c) => ((c.params.crossover.operator = 'blx-alpha'), (c.params.crossover.alpha = 0.5))));
    expect(real).toContain('BLX-α crossover would repeat and lose cities; choose order, partial-mapped or cycle crossover for this problem.');
    expect(problemsOf(edited(base, (c) => (c.params.mutation.operator = 'flip')))).toContain('Flip mutation would repeat and lose cities; choose swap, inversion or insertion mutation for this problem.');
    expect(problemsOf(edited(base, (c) => (c.params.mutation.mode = 'per-gene')))).toContain('Per-gene mutation has no meaning for a permutation, whose genes are not independent; use per individual mutation (one draw for the tour, then one move).');
    expect(problemsOf(edited(base, (c) => delete c.params.mutation.operator))).toContain('A permutation needs a mutation operator: choose swap, inversion or insertion.');
    expect(problemsOf(edited(base, (c) => (c.params.mutation.operator = 'shuffle')))).toContain('"params.mutation.operator" must be "flip", "gaussian", "swap", "inversion" or "insertion".');
    expect(problemsOf(edited(base, (c) => (c.params.crossover.operator = 'edge')))).toContain('"params.crossover.operator" must be "one-point", "two-point", "uniform", "blx-alpha", "arithmetic", "ox", "pmx" or "cx".');
    // and the other way round
    const goldbergEntry = entryOf('goldberg')!;
    const d = defaultsOf(goldbergEntry, undefined);
    const goldberg = configOf({ problem: goldbergEntry.create(undefined), init: d.init }, d.params, 1);
    expect(problemsOf(edited(goldberg, (c) => (c.params.crossover.operator = 'cx')))).toContain('Cycle (CX) crossover is for permutation chromosomes; choose one-point, two-point or uniform crossover for this problem.');
    expect(problemsOf(edited(goldberg, (c) => (c.params.mutation.operator = 'inversion')))).toContain('Inversion mutation is for permutation chromosomes; use flip mutation for this problem.');
  });

  test('a hand-edited population that is not a set of tours is refused, naming the chromosome', () => {
    const base = make(optionsOf({ instance: 'circle', n: 6 }), () => ({ init: { kind: 'explicit', chromosomes: ['1 2 3 4 5 6'] } }));
    const found = problemsOf(edited(base, (c) => (c.setup.init.chromosomes = ['1 2 3 4 5 6', '1 2 2 4 5 6'])));
    expect(found.some((p) => p.includes('Chromosome 2: city 2 appears twice; city 3 is missing'))).toBe(true);
  });

  test('the other problems’ links are unchanged', () => {
    const goldbergEntry = entryOf('goldberg')!;
    const d = defaultsOf(goldbergEntry, undefined);
    const config = configOf({ problem: goldbergEntry.create(undefined), init: d.init }, d.params, 3);
    expect(decodeConfig(encodeConfig(config))).toEqual({ ok: true, config });
    void createRng;
  });
});
