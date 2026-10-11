import { describe, expect, test } from 'vitest';
import { createRng, gaAlgorithm, metricsOf, type GaParams, type GaSetup, type Initialization, type StepSpec } from '../engine';
import { createRun } from '../run';
import { defaultParams, defaultSeed, defaultSetup } from './config';
import { presets } from './presets';
import { configOf, decodeConfig, encodeConfig, setupOf, type RunConfig } from './run-config';

const base = configOf(defaultSetup, defaultParams, defaultSeed);
const b64 = (text: string) => btoa(String.fromCharCode(...new TextEncoder().encode(text))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const link = (value: unknown) => `#v1.${b64(JSON.stringify(value))}`;
const problemsOf = (hash: string) => {
  const result = decodeConfig(hash);
  expect(result.ok).toBe(false);
  return result.ok ? [] : [...result.problems];
};
const edited = (change: (c: Record<string, any>) => void) => {
  const copy = JSON.parse(JSON.stringify(base)) as Record<string, any>;
  change(copy);
  return link(copy);
};

describe('the link format', () => {
  test('is "#v1." and base64url of compact JSON, with no padding and no characters that need escaping in a URL', () => {
    const hash = encodeConfig(base);
    expect(hash.startsWith('#v1.')).toBe(true);
    expect(hash.slice(4)).toMatch(/^[A-Za-z0-9_-]+$/);
    const payload = hash.slice(4).replace(/-/g, '+').replace(/_/g, '/');
    expect(atob(payload + '='.repeat((4 - (payload.length % 4)) % 4)).startsWith('{"v":1,"problem":"goldberg"')).toBe(true);
  });

  test('the configuration of a run can be read back from it', () => {
    expect(base).toEqual({ v: 1, problem: 'goldberg', setup: { init: { kind: 'random', size: 6 } }, params: defaultParams, seed: 42 });
    expect(setupOf(base).init).toEqual({ kind: 'random', size: 6 });
    expect(setupOf(base).problem.chromosomeLength).toBe(5);
  });
});

describe('round trip', () => {
  const roundTrip = (c: RunConfig) => {
    const result = decodeConfig(encodeConfig(c));
    expect(result.ok ? [] : result.problems).toEqual([]);
    if (result.ok) expect(result.config).toEqual(c);
  };

  test('the default configuration and every preset', () => {
    roundTrip(base);
    expect(presets.length).toBeGreaterThan(0);
    for (const preset of presets) roundTrip(configOf(preset.setup, preset.params, preset.seed));
  });

  test('also with the whole link given without its "#", as typed or pasted', () => {
    const result = decodeConfig(encodeConfig(base).slice(1));
    expect(result.ok && result.config).toEqual(base);
  });

  test('the extreme seeds', () => {
    roundTrip({ ...base, seed: 0 });
    roundTrip({ ...base, seed: 4294967295 });
  });

  test('240 generated configurations: random and hand-edited populations, every selection method, chain, operator, mode, truncation and stop setting', () => {
    const rng = createRng(2024);
    const pick = <T,>(items: readonly T[]): T => items[Math.floor(rng.next() * items.length)]!;
    const chains: StepSpec[][] = [
      [{ step: 'identity' }],
      [{ step: 'shift', epsilon: 0.5 }],
      [{ step: 'rank' }],
      [{ step: 'rank' }, { step: 'linear-ranking', pressure: 1.25 }],
      [{ step: 'shift' }, { step: 'power', exponent: 2.5 }],
    ];
    for (let k = 0; k < 240; k++) {
      const size = 1 + Math.floor(rng.next() * 12);
      const init: Initialization =
        rng.next() < 0.5
          ? { kind: 'random', size }
          : { kind: 'explicit', chromosomes: Array.from({ length: size }, () => Array.from({ length: 5 }, () => (rng.next() < 0.5 ? '1' : '0')).join('')) };
      const elites = Math.floor(rng.next() * (size + 1));
      const needed = size - elites;
      const params: GaParams = {
        selection: rng.next() < 0.3 ? { method: 'tournament', size: 1 + Math.floor(rng.next() * 4) } : { method: 'roulette', chain: pick(chains) },
        crossover: { enabled: rng.next() < 0.8, operator: pick(['one-point', 'two-point', 'uniform'] as const), probability: Math.round(rng.next() * 100) / 100 },
        mutation: { enabled: rng.next() < 0.8, mode: pick(['per-gene', 'per-individual'] as const), probability: Math.round(rng.next() * 100) / 100 },
        elites,
        ...(rng.next() < 0.4 ? { truncation: { enabled: rng.next() < 0.7, lambda: Math.max(1, needed + Math.floor(rng.next() * 5)) } } : {}),
        stop: {
          generationLimit: 1 + Math.floor(rng.next() * 200),
          ...(rng.next() < 0.5 ? { targetFitness: Math.floor(rng.next() * 961) } : {}),
          ...(rng.next() < 0.5 ? { stagnationWindow: 1 + Math.floor(rng.next() * 30) } : {}),
        },
      };
      const config = configOf({ ...defaultSetup, init }, params, Math.floor(rng.next() * 4294967295));
      roundTrip(config);
    }
  });

  test('a run made from a decoded link equals the original run: populations, events and metrics', () => {
    const config = configOf(
      { ...defaultSetup, init: { kind: 'explicit', chromosomes: ['01101', '11000', '01000', '10011'] } },
      { ...defaultParams, elites: 1, mutation: { enabled: true, mode: 'per-individual', probability: 0.4 }, truncation: { enabled: true, lambda: 6 } },
      9,
    );
    const decoded = decodeConfig(encodeConfig(config));
    if (!decoded.ok) throw new Error(decoded.problems.join(' '));
    const make = (c: RunConfig) => {
      const run = createRun(gaAlgorithm, { setup: setupOf(c), params: c.params, seed: c.seed });
      for (let g = 0; g < 8; g++) run.forwardCycle();
      return { populations: [0, 1, 2, 3, 8].map((g) => run.snapshot(g).state.population.map((i) => `${i.id}:${i.chromosome.join('')}`)), events: run.events(3), metrics: metricsOf(run.snapshot(8).state) };
    };
    expect(make(decoded.config)).toEqual(make(config));
  });
});

describe('bad links: each is refused with a reason, and nothing is used', () => {
  test.each([
    ['nothing', '', 'not a share link'],
    ['just a hash', '#', 'not a share link'],
    ['some other hash', '#section-2', 'not a share link'],
    ['no payload', '#v1.', 'empty'],
    ['an unknown version', '#v2.abcd', 'different version of the app (v2)'],
    ['characters that cannot be in a link', '#v1.@@@@', 'cannot be part of a share link'],
    ['text that is not JSON', `#v1.${b64('this is not json')}`, 'cut short or damaged'],
    ['invalid UTF-8', '#v1._w', 'cut short or damaged'],
    ['a truncated link', encodeConfig(base).slice(0, 40), 'cut short or damaged'],
    ['an empty JSON array', link([]), 'must be an object'],
    ['a number', link(7), 'must be an object'],
  ])('%s', (_name, hash, words) => {
    const problems = problemsOf(hash);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(words);
  });

  test('an unknown problem names the problems that exist', () => {
    expect(problemsOf(edited((c) => (c.problem = 'knapsack')))).toEqual(['Unknown problem "knapsack"; this app knows "goldberg", "target-string".']);
  });

  test('a version inside the configuration that disagrees with the link', () => {
    expect(problemsOf(edited((c) => (c.v = 2)))[0]).toContain('says it is version 2, but the link says v1');
  });

  test('unknown keys are rejected at every level, by name', () => {
    expect(problemsOf(edited((c) => (c.extra = 1)))).toEqual(['"configuration" has an unknown key "extra".']);
    expect(problemsOf(edited((c) => (c.params.crossover.speed = 1)))).toEqual(['"params.crossover" has an unknown key "speed".']);
    expect(problemsOf(edited((c) => (c.setup.init.colour = 'red')))).toEqual(['"setup.init" has an unknown key "colour".']);
    expect(problemsOf(edited((c) => (c.params.selection.chain[0].epsilon = 1)))).toEqual(['"params.selection.chain[0]" has an unknown key "epsilon".']);
  });

  test('missing keys are named', () => {
    expect(problemsOf(edited((c) => delete c.seed))).toEqual(['"configuration" is missing "seed".']);
    expect(problemsOf(edited((c) => delete c.params.stop.generationLimit))).toEqual(['"params.stop" is missing "generationLimit".']);
  });

  test('values of the wrong type are named', () => {
    expect(problemsOf(edited((c) => (c.params.crossover.probability = '0.8')))).toEqual(['"params.crossover.probability" must be a number.']);
    expect(problemsOf(edited((c) => (c.params.mutation.enabled = 'yes')))).toEqual(['"params.mutation.enabled" must be true or false.']);
    expect(problemsOf(edited((c) => (c.setup.init.size = null)))).toEqual(['"setup.init.size" must be a number.']);
    expect(problemsOf(edited((c) => (c.params.selection = { method: 'sorting' })))[0]).toContain('"params.selection.method" must be "roulette" or "tournament"');
    expect(problemsOf(edited((c) => (c.params.selection.chain = [{ step: 'magic' }])))[0]).toContain('"params.selection.chain[0].step" must be one of');
  });

  test('a seed that is not a whole number in range', () => {
    for (const seed of [-1, 1.5, 4294967296, '42']) expect(problemsOf(edited((c) => (c.seed = seed)))[0]).toContain('seed must be a whole number from 0 to 4294967295');
  });

  test('values the parameter drawer would refuse get the drawer’s own message', () => {
    expect(problemsOf(edited((c) => (c.params.crossover.probability = 1.5)))).toEqual(['The crossover probability must be a number from 0 to 1.']);
    expect(problemsOf(edited((c) => (c.params.elites = 7)))[0]).toContain('from 0 to the population size (6)');
    expect(problemsOf(edited((c) => (c.setup.init.size = 0)))[0]).toContain('whole number of at least 1');
    expect(problemsOf(edited((c) => (c.setup.init = { kind: 'explicit', chromosomes: ['01101', '0110'] })))[0]).toContain('Chromosome 2 has 4 genes, but this problem needs 5');
    expect(problemsOf(edited((c) => (c.params.truncation = { enabled: true, lambda: 2 })))[0]).toContain('at least N − e = 6');
  });

  test('an invalid weight chain is checked against the fitness the run starts with', () => {
    const problems = problemsOf(edited((c) => (c.params.selection.chain = [{ step: 'linear-ranking' }])));
    expect(problems).toEqual(['Step 1 (Linear ranking) needs ranks as its input; put a Rank step before it.']);
  });

  test('several problems in one link are all reported together', () => {
    const problems = problemsOf(
      edited((c) => {
        c.params.crossover.probability = '0.8';
        c.params.mutation.mode = 'sometimes';
        c.params.stop.speed = 3;
        delete c.seed;
      }),
    );
    expect(problems).toHaveLength(4);
    expect(problems).toContain('"configuration" is missing "seed".');
    expect(problems).toContain('"params.crossover.probability" must be a number.');
    expect(problems).toContain('"params.mutation.mode" must be "per-gene" or "per-individual".');
    expect(problems).toContain('"params.stop" has an unknown key "speed".');
  });

  test('a link is never partly applied: a good part does not survive a bad one', () => {
    const result = decodeConfig(edited((c) => ((c.seed = 7), (c.params.elites = 99))));
    expect(result.ok).toBe(false);
    expect('config' in result).toBe(false);
  });
});

describe('unicode and padding', () => {
  test('every length of payload decodes, whatever the padding it would have had', () => {
    for (let n = 0; n < 8; n++) {
      const params: GaParams = { ...defaultParams, stop: { ...defaultParams.stop, generationLimit: 10 ** n } };
      const result = decodeConfig(encodeConfig(configOf(defaultSetup, params, n)));
      expect(result.ok).toBe(true);
    }
  });
});
