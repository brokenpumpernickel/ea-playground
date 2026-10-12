import { describe, expect, test } from 'vitest';
import { createRng, gaAlgorithm, landscapeFunctions, landscapeRepresentations, metricsOfProblem, type GaParams, type Initialization, type LandscapeOptions } from '../engine';
import { createRun } from '../run';
import { defaultsOf, entryOf } from './problems';
import { configOf, decodeConfig, encodeConfig, setupOf, type RunConfig } from './run-config';

const entry = entryOf('landscape')!;
const optionsOf = (o: Partial<LandscapeOptions> = {}): LandscapeOptions => ({ ...(entry.defaultOptions() as LandscapeOptions), ...o });
const make = (options: LandscapeOptions, change: (d: ReturnType<typeof defaultsOf>) => { init?: Initialization; params?: GaParams } = () => ({}), seed = 9): RunConfig => {
  const d = defaultsOf(entry, options);
  const c = change(d);
  return configOf({ problem: entry.create(options), init: c.init ?? d.init }, c.params ?? d.params, seed, 'landscape', options);
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

describe('a landscape configuration in a link', () => {
  test.each(landscapeFunctions.flatMap((fn) => landscapeRepresentations.map((rep) => [fn, rep] as const)))('%s, %s: round trips and opens as the same run (populations, events, metrics)', (fn, rep) => {
    const config = make(optionsOf({ function: fn, representation: rep, bitsPerVariable: 7 }));
    const decoded = decodeConfig(encodeConfig(config));
    expect(decoded).toEqual({ ok: true, config });
    if (decoded.ok) expect(trace(decoded.config)).toEqual(trace(config));
  });

  test.each([
    ['blx-alpha with α = 2', { enabled: true, operator: 'blx-alpha', probability: 0.7, alpha: 2 }],
    ['blx-alpha with α = 0', { enabled: true, operator: 'blx-alpha', probability: 1, alpha: 0 }],
    ['arithmetic', { enabled: true, operator: 'arithmetic', probability: 0.5 }],
    ['uniform', { enabled: true, operator: 'uniform', probability: 0.5 }],
    ['one-point', { enabled: true, operator: 'one-point', probability: 0.5 }],
    ['switched off', { enabled: false, operator: 'blx-alpha', probability: 0.5, alpha: 0.5 }],
  ] as const)('real-valued with %s: round trips and opens as the same run', (_name, crossover) => {
    const options = optionsOf({ function: 'rastrigin' });
    const config = make(options, (d) => ({ params: { ...d.params, crossover: { ...crossover }, mutation: { enabled: true, mode: 'per-individual', probability: 0.6, sigma: 0.3 } } }));
    const decoded = decodeConfig(encodeConfig(config));
    expect(decoded).toEqual({ ok: true, config });
    if (decoded.ok) expect(trace(decoded.config)).toEqual(trace(config));
  });

  test('a hand-edited population of number pairs survives the link, in full precision', () => {
    const options = optionsOf({ function: 'himmelblau' });
    const chromosomes = ['3 2', '-2.805118086952745 3.131312518250573', '0.1, -4.9', '5 -5'];
    const config = make(options, (d) => ({ init: { kind: 'explicit', chromosomes }, params: { ...d.params, elites: 1 } }));
    const decoded = decodeConfig(encodeConfig(config));
    expect(decoded).toEqual({ ok: true, config });
    if (decoded.ok) {
      expect(setupOf(decoded.config).init).toEqual({ kind: 'explicit', chromosomes });
      expect(trace(decoded.config, 3)).toEqual(trace(config, 3));
      expect(trace(decoded.config, 0).populations[0]!.map((i) => i.values)).toEqual([[3, 2], [-2.805118086952745, 3.131312518250573], [0.1, -4.9], [5, -5]]);
    }
  });

  test('a hand-edited population of bit strings of 2·n bits survives the link for the binary-coded representations', () => {
    for (const representation of ['plain', 'gray'] as const) {
      const options = optionsOf({ representation, bitsPerVariable: 4 });
      const config = make(options, (d) => ({ init: { kind: 'explicit', chromosomes: ['00001111', '10000111', '01111000'] }, params: { ...d.params, elites: 0 } }));
      const decoded = decodeConfig(encodeConfig(config));
      expect(decoded).toEqual({ ok: true, config });
      if (decoded.ok) expect(trace(decoded.config, 3)).toEqual(trace(config, 3));
    }
  });

  test('the stop within ε is carried as a parameter and keeps working after the link', () => {
    const options = optionsOf();
    const config = make(options, (d) => ({ params: { ...d.params, stop: { generationLimit: 30, targetEpsilon: 0.05 } } }));
    const decoded = decodeConfig(encodeConfig(config));
    expect(decoded).toEqual({ ok: true, config });
    if (decoded.ok) {
      expect(decoded.config.params.stop.targetEpsilon).toBe(0.05);
      const run = createRun(gaAlgorithm, { setup: setupOf(decoded.config), params: decoded.config.params, seed: decoded.config.seed });
      const r = run.runUntil((s) => s.stops.length > 0);
      expect(r.reason).toBe('condition');
    }
  });

  test('the link carries the problem, the options and the operator parameters as readable text', () => {
    const readable = (config: RunConfig) => {
      const payload = encodeConfig(config).slice(4).replace(/-/g, '+').replace(/_/g, '/');
      return new TextDecoder().decode(Uint8Array.from(atob(payload + '='.repeat((4 - (payload.length % 4)) % 4)), (c) => c.charCodeAt(0)));
    };
    const json = readable(make(optionsOf({ function: 'two-peaks', representation: 'gray', bitsPerVariable: 8 })));
    expect(json).toContain('"problem":"landscape"');
    expect(json).toContain('"function":"two-peaks"');
    expect(json).toContain('"representation":"gray"');
    expect(json).toContain('"bitsPerVariable":8');
    const real = readable(make(optionsOf()));
    expect(real).toContain('"operator":"blx-alpha"');
    expect(real).toContain('"alpha":0.5');
    expect(real).toContain('"sigma":0.05');
    expect(real).toContain('"targetEpsilon"');
  });

  test('links made for the other problems still open exactly as before', () => {
    for (const id of ['goldberg', 'target-string', 'knapsack', 'trap']) {
      const e = entryOf(id)!;
      const options = e.defaultOptions();
      const config = configOf({ problem: e.create(options), init: e.defaults.init }, e.defaults.params, 5, id, options);
      expect(decodeConfig(encodeConfig(config))).toEqual({ ok: true, config });
    }
  });
});

describe('bad landscape links: each is refused in the drawer’s own words, and nothing is used', () => {
  const base = () => make(optionsOf({ function: 'two-peaks' }));
  const binary = () => make(optionsOf({ representation: 'plain', bitsPerVariable: 6 }));

  test('options: an unknown function or representation, bits out of range, unknown or missing keys, wrong types', () => {
    expect(problemsOf(edited(base(), (c) => (c.options.function = 'sphere')))).toEqual(['Function must be one of single-peak, two-peaks, rastrigin, himmelblau (it is "sphere").']);
    expect(problemsOf(edited(base(), (c) => (c.options.representation = 'ternary')))).toEqual(['Representation must be one of real, plain, gray (it is "ternary").']);
    expect(problemsOf(edited(binary(), (c) => (c.options.bitsPerVariable = 13)))).toEqual(['Bits per variable must be a whole number from 4 to 12 (it is 13).']);
    expect(problemsOf(edited(binary(), (c) => (c.options.bitsPerVariable = 3.5)))).toEqual(['Bits per variable must be a whole number from 4 to 12 (it is 3.5).']);
    expect(problemsOf(edited(base(), (c) => delete c.options.function))).toEqual(['"options" is missing "function".']);
    expect(problemsOf(edited(base(), (c) => (c.options.extra = 1)))).toEqual(['"options" has an unknown key "extra".']);
    expect(problemsOf(edited(base(), (c) => (c.options.bitsPerVariable = '8')))).toEqual(['"options.bitsPerVariable" must be a number.']);
    expect(problemsOf(edited(base(), (c) => delete c.options))).toEqual(['"configuration" is missing "options", which Landscape needs.']);
  });

  test('a crossover operator that does not exist for the representation: real-only ones for bits, in words', () => {
    expect(problemsOf(edited(binary(), (c) => (c.params.crossover.operator = 'blx-alpha')))).toEqual([
      'BLX-α crossover is for real-valued chromosomes; choose one-point, two-point or uniform crossover for this problem.',
    ]);
    expect(problemsOf(edited(binary(), (c) => (c.params.crossover.operator = 'arithmetic')))).toEqual([
      'Arithmetic crossover is for real-valued chromosomes; choose one-point, two-point or uniform crossover for this problem.',
    ]);
    expect(problemsOf(edited(base(), (c) => (c.params.crossover.operator = 'three-point')))).toEqual([
      '"params.crossover.operator" must be "one-point", "two-point", "uniform", "blx-alpha" or "arithmetic".',
    ]);
  });

  test('a real-only operator is also refused for the other problems, with the same words', () => {
    const goldberg = configOf({ problem: entryOf('goldberg')!.create(undefined), init: entryOf('goldberg')!.defaults.init }, entryOf('goldberg')!.defaults.params, 1);
    expect(problemsOf(edited(goldberg, (c) => (c.params.crossover.operator = 'arithmetic')))).toEqual([
      'Arithmetic crossover is for real-valued chromosomes; choose one-point, two-point or uniform crossover for this problem.',
    ]);
  });

  test('two-point crossover needs three genes, so a real-valued landscape refuses it', () => {
    expect(problemsOf(edited(base(), (c) => { c.params.crossover.operator = 'two-point'; delete c.params.crossover.alpha; }))).toEqual([
      "Two-point crossover needs chromosomes of at least 3 genes, but this problem's have 2. Choose another crossover type or switch crossover off.",
    ]);
  });

  test('α: a number of 0 or more, and only with BLX-α', () => {
    expect(problemsOf(edited(base(), (c) => (c.params.crossover.alpha = -0.1)))).toEqual(['α must be a number of 0 or more.']);
    expect(problemsOf(edited(base(), (c) => (c.params.crossover.alpha = '0.5')))).toEqual(['"params.crossover.alpha" must be a number.']);
    expect(problemsOf(edited(base(), (c) => (c.params.crossover.operator = 'uniform')))).toEqual(['α belongs to BLX-α crossover; leave it out or choose BLX-α.']);
    expect(problemsOf(edited(binary(), (c) => (c.params.crossover.alpha = 0.5)))).toEqual(['α belongs to BLX-α crossover; leave it out or choose BLX-α.']);
  });

  test('σ: a number greater than 0, and only for real-valued chromosomes', () => {
    expect(problemsOf(edited(base(), (c) => (c.params.mutation.sigma = 0)))).toEqual(['σ must be a number greater than 0.']);
    expect(problemsOf(edited(base(), (c) => (c.params.mutation.sigma = -1)))).toEqual(['σ must be a number greater than 0.']);
    expect(problemsOf(edited(base(), (c) => (c.params.mutation.sigma = 'big')))).toEqual(['"params.mutation.sigma" must be a number.']);
    expect(problemsOf(edited(binary(), (c) => (c.params.mutation.sigma = 0.05)))).toEqual(['σ belongs to Gaussian mutation of real-valued chromosomes; leave it out for this problem.']);
  });

  test('the mutation operator, when a link names one, must be the representation’s', () => {
    expect(problemsOf(edited(base(), (c) => (c.params.mutation.operator = 'flip')))).toEqual(['Flip mutation is for symbol chromosomes; use Gaussian mutation for a real-valued problem.']);
    expect(problemsOf(edited(binary(), (c) => (c.params.mutation.operator = 'gaussian')))).toEqual(['Gaussian mutation is for real-valued chromosomes; use flip mutation for this problem.']);
    expect(problemsOf(edited(base(), (c) => (c.params.mutation.operator = 'swap')))).toEqual(['"params.mutation.operator" must be "flip" or "gaussian".']);
    const ok = edited(base(), (c) => (c.params.mutation.operator = 'gaussian'));
    expect(decodeConfig(ok).ok).toBe(true);
  });

  test('ε: a number greater than 0; a target fitness is not how the landscape stops', () => {
    expect(problemsOf(edited(base(), (c) => (c.params.stop.targetEpsilon = 0)))).toEqual(['ε must be a number greater than 0.']);
    expect(problemsOf(edited(base(), (c) => (c.params.stop.targetEpsilon = 'small')))).toEqual(['"params.stop.targetEpsilon" must be a number.']);
    expect(problemsOf(edited(base(), (c) => (c.params.stop.targetFitness = 1)))).toEqual(['The landscape stops within ε of its optimum; use ε instead of a target fitness.']);
  });

  test('a hand-edited population: wrong text, wrong count, outside the bounds, a bit string of the wrong length', () => {
    const real = (chromosomes: string[]) => edited(base(), (c) => (c.setup.init = { kind: 'explicit', chromosomes }));
    expect(problemsOf(real(['1 x']))).toEqual(['Chromosome 1 ("1 x") may only contain numbers separated by spaces or commas.']);
    expect(problemsOf(real(['1']))).toEqual(['Chromosome 1 has 1 number, but this problem needs 2.']);
    expect(problemsOf(real(['1 2 3']))).toEqual(['Chromosome 1 has 3 numbers, but this problem needs 2.']);
    expect(problemsOf(real(['0 0', '5.5 0']))).toEqual(['Chromosome 2: gene 1 (5.5) is outside its bounds from −5 to 5.']);
    const bits = (chromosomes: string[]) => edited(binary(), (c) => (c.setup.init = { kind: 'explicit', chromosomes }));
    expect(problemsOf(bits(['0000']))).toEqual(['Chromosome 1 has 4 genes, but this problem needs 12.']);
    expect(problemsOf(bits(['00000000000x']))).toEqual(['Chromosome 1 ("00000000000x") may only contain the characters 0 and 1.']);
  });

  test('every refusal leaves the address to be cleared and uses nothing: the decoder returns no configuration', () => {
    const r = decodeConfig(edited(base(), (c) => (c.options.function = 'sphere')));
    expect(r.ok).toBe(false);
    expect('config' in r).toBe(false);
  });

  test('the seed and the rest of the setup are checked as for any problem', () => {
    expect(problemsOf(edited(base(), (c) => (c.seed = -1)))).toEqual(['The seed must be a whole number from 0 to 4294967295.']);
    expect(problemsOf(edited(base(), (c) => { c.setup.init = { kind: 'random', size: 0 }; c.params.elites = 0; }))).toEqual(['The population size must be a whole number of at least 1.']);
  });
});

describe('random generation is by seed, whatever the link', () => {
  test('two decodes of the same link make the same run', () => {
    const link = encodeConfig(make(optionsOf({ function: 'himmelblau' })));
    const a = decodeConfig(link);
    const b = decodeConfig(link);
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) expect(trace(a.config)).toEqual(trace(b.config));
    expect(createRng(1).next()).toBe(createRng(1).next());
  });
});
