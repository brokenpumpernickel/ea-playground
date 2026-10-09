import { describe, expect, test } from 'vitest';
import { gaAlgorithm, goldberg } from '../engine';
import { createRun } from '../run';
import { defaultParams, defaultSeed, defaultSetup } from './config';
import { changes, defaultStep, draftOf, numberOf, parseChromosomes, toParams, toSetup, validate, type Draft } from './drawer-model';

const sample = [81, 81, 361, 9, 121, 625];
const fresh = (): Draft => draftOf(defaultParams, defaultSetup, defaultSeed);
const withDraft = (edit: (d: Draft) => void): Draft => {
  const d = fresh();
  edit(d);
  return d;
};
const errorsOf = (d: Draft, fitness: readonly number[] = sample) => validate(d, goldberg, fitness).errors;
const current = { params: defaultParams, setup: defaultSetup, seed: defaultSeed };

describe('the default draft', () => {
  test('is valid and gives back the default parameters: a run made from it is the same run', () => {
    const d = fresh();
    expect(errorsOf(d)).toEqual({});
    const make = (params: typeof defaultParams) => {
      const run = createRun(gaAlgorithm, { setup: defaultSetup, params, seed: defaultSeed });
      for (let g = 0; g < 4; g++) run.forwardCycle();
      return [0, 1, 2, 3, 4].map((c) => run.snapshot(c).state.population.map((i) => i.chromosome.join('')));
    };
    expect(make(toParams(d))).toEqual(make(defaultParams));
    expect(toSetup(d, goldberg)).toEqual(defaultSetup);
    expect(changes(d, current)).toEqual({ operator: [], reset: [] });
  });

  test('shows the numbers as text, the optional stop criteria as enabled, and the elite count', () => {
    const d = fresh();
    expect(d).toMatchObject({
      init: 'random',
      size: '6',
      seed: '42',
      method: 'roulette',
      crossover: { enabled: true, operator: 'one-point', probability: '0.8' },
      mutation: { enabled: true, mode: 'per-gene', probability: '0.05' },
      elites: '0',
      truncation: { enabled: false },
      stop: { generationLimit: '50', target: { enabled: true, value: '961' }, stagnation: { enabled: true, window: '10' } },
    });
    expect(d.chain).toEqual([{ step: 'identity', params: {} }]);
  });
});

describe('numbers typed by the user', () => {
  test.each([
    ['0.8', 0.8],
    [' 3 ', 3],
    ['1e-2', 0.01],
  ])('%s reads as %d', (text, value) => expect(numberOf(text)).toBe(value));
  test.each(['', ' ', 'abc', '1,5', 'Infinity'])('%j is not a number', (text) => expect(numberOf(text)).toBeUndefined());
});

describe('validation says what is wrong in words', () => {
  test.each([
    ['crossover probability above 1', (d: Draft) => (d.crossover.probability = '1.5'), 'crossover.probability', 'from 0 to 1'],
    ['crossover probability not a number', (d: Draft) => (d.crossover.probability = 'abc'), 'crossover.probability', 'from 0 to 1'],
    ['mutation probability below 0', (d: Draft) => (d.mutation.probability = '-0.1'), 'mutation.probability', 'from 0 to 1'],
    ['population size zero', (d: Draft) => (d.size = '0'), 'size', 'whole number of at least 1'],
    ['population size fractional', (d: Draft) => (d.size = '2.5'), 'size', 'whole number of at least 1'],
    ['seed negative', (d: Draft) => (d.seed = '-1'), 'seed', 'whole number'],
    ['tournament size zero', (d: Draft) => ((d.method = 'tournament'), (d.tournamentSize = '0')), 'tournamentSize', 'at least 1'],
    ['elites above the population', (d: Draft) => (d.elites = '7'), 'elites', 'from 0 to the population size (6)'],
    ['elites negative', (d: Draft) => (d.elites = '-1'), 'elites', 'whole number'],
    ['λ below N − e', (d: Draft) => ((d.truncation = { enabled: true, lambda: '4' }), (d.elites = '1')), 'truncation.lambda', 'at least N − e = 5'],
    ['generation limit zero', (d: Draft) => (d.stop.generationLimit = '0'), 'stop.generationLimit', 'at least 1'],
    ['target not a number', (d: Draft) => (d.stop.target.value = 'x'), 'stop.target', 'must be a number'],
    ['stagnation window zero', (d: Draft) => (d.stop.stagnation.window = '0'), 'stop.stagnation', 'at least 1'],
  ])('%s', (_name, edit, field, words) => {
    const errors = errorsOf(withDraft(edit));
    expect(errors[field as keyof typeof errors]).toContain(words);
  });

  test('the edges are allowed: every individual an elite, λ exactly N − e, probabilities 0 and 1', () => {
    const d = withDraft((x) => {
      x.elites = '6';
      x.truncation = { enabled: true, lambda: '0' };
      x.crossover.probability = '1';
      x.mutation.probability = '0';
    });
    expect(errorsOf(d)).toEqual({ 'truncation.lambda': 'λ must be a whole number.' });
    d.elites = '2';
    d.truncation.lambda = '4';
    expect(errorsOf(d)).toEqual({});
    d.truncation.lambda = '3';
    expect(errorsOf(d)['truncation.lambda']).toContain('at least N − e = 4');
  });

  test('a disabled stop criterion or truncation is not validated', () => {
    const d = withDraft((x) => {
      x.stop.target = { enabled: false, value: 'x' };
      x.stop.stagnation = { enabled: false, window: '0' };
      x.truncation = { enabled: false, lambda: '1' };
    });
    expect(errorsOf(d)).toEqual({});
  });

  test('tournament ignores the chain, so a broken chain is not an error then', () => {
    const d = withDraft((x) => {
      x.chain = [defaultStep('linear-ranking')];
      x.method = 'tournament';
    });
    expect(errorsOf(d)).toEqual({});
  });

  test('the elite count is checked against the hand-edited population size', () => {
    const d = withDraft((x) => {
      x.init = 'explicit';
      x.chromosomes = '01101 11000 01000 10011';
      x.elites = '5';
    });
    expect(errorsOf(d).elites).toContain('population size (4)');
  });
});

describe('the weight chain is validated by the engine, with the step to blame', () => {
  test('linear ranking without a rank step before it', () => {
    const d = withDraft((x) => (x.chain = [defaultStep('linear-ranking')]));
    const v = validate(d, goldberg, sample);
    expect(v.errors.chain).toBe('Step 1 (Linear ranking) needs ranks as its input; put a Rank step before it.');
    expect(v.chainStep).toBe(0);
  });

  test('a parameter outside its range', () => {
    const d = withDraft((x) => {
      x.chain = [defaultStep('identity'), defaultStep('power')];
      x.chain[1]!.params.exponent = '-2';
    });
    const v = validate(d, goldberg, sample);
    expect(v.errors.chain).toContain('Step 2 (Power): exponent must be 0 or more.');
    expect(v.chainStep).toBe(1);
  });

  test('a parameter that is not a number is named', () => {
    const d = withDraft((x) => {
      x.chain = [defaultStep('shift')];
      x.chain[0]!.params.epsilon = 'abc';
    });
    expect(validate(d, goldberg, sample).errors.chain).toBe('Step 1 (Shift): epsilon must be a number.');
  });

  test('an empty chain', () => {
    const d = withDraft((x) => (x.chain = []));
    expect(validate(d, goldberg, sample).errors.chain).toContain('no steps');
  });

  test('a valid chain with ranks is accepted and becomes engine steps with numeric parameters', () => {
    const d = withDraft((x) => {
      x.chain = [defaultStep('rank'), defaultStep('linear-ranking')];
      x.chain[1]!.params.pressure = '1.8';
    });
    expect(errorsOf(d)).toEqual({});
    expect(toParams(d).selection).toEqual({ method: 'roulette', chain: [{ step: 'rank' }, { step: 'linear-ranking', pressure: 1.8 }] });
  });
});

describe('hand-edited population', () => {
  test('lists each chromosome with what it decodes to and its fitness', () => {
    const rows = parseChromosomes('01101\n11000, 01000 10011', goldberg);
    expect(rows.map((r) => [r.text, r.decoded, r.fitness])).toEqual([
      ['01101', 13, 169],
      ['11000', 24, 576],
      ['01000', 8, 64],
      ['10011', 19, 361],
    ]);
    expect(rows.every((r) => r.error === undefined)).toBe(true);
  });

  test('says which chromosome is the wrong length or has the wrong characters', () => {
    const rows = parseChromosomes('01101 0110 0121x 11111', goldberg);
    expect(rows[1]!.error).toBe('Chromosome 2 has 4 genes, but this problem needs 5.');
    expect(rows[2]!.error).toBe('Chromosome 3 ("0121x") may only contain the characters 0 and 1.');
    expect(rows[0]!.error).toBeUndefined();
    expect(rows[3]!.error).toBeUndefined();
    expect(errorsOf(withDraft((d) => ((d.init = 'explicit'), (d.chromosomes = '01101 0110'))))?.chromosomes).toContain('Chromosome 2 has 4 genes');
  });

  test('an empty text is an error, and a good one becomes an explicit setup', () => {
    expect(errorsOf(withDraft((d) => ((d.init = 'explicit'), (d.chromosomes = '  ')))).chromosomes).toContain('at least one chromosome');
    const d = withDraft((x) => ((x.init = 'explicit'), (x.chromosomes = '01101\n11000')));
    expect(toSetup(d, goldberg).init).toEqual({ kind: 'explicit', chromosomes: ['01101', '11000'] });
  });
});

describe('what a draft would change', () => {
  test('operator parameters are named, and wait for the next generation boundary', () => {
    const d = withDraft((x) => {
      x.crossover.probability = '0.5';
      x.mutation.mode = 'per-individual';
      x.elites = '1';
      x.stop.generationLimit = '30';
    });
    expect(changes(d, current)).toEqual({ operator: ['Crossover probability', 'Mutation mode', 'Elites', 'Stop criteria'], reset: [] });
  });

  test('switching crossover or mutation off, selection or truncation on, are changes too', () => {
    const d = withDraft((x) => {
      x.crossover.enabled = false;
      x.mutation.enabled = false;
      x.method = 'tournament';
      x.truncation = { enabled: true, lambda: '8' };
    });
    expect(changes(d, current).operator).toEqual(['Selection', 'Crossover on/off', 'Mutation on/off', 'Offspring truncation on/off']);
  });

  test('λ is remembered while truncation is off and only counts as a change while it is on', () => {
    const off = withDraft((x) => (x.truncation = { enabled: false, lambda: '12' }));
    expect(changes(off, current).operator).toEqual([]);
    const on = { ...current, params: { ...defaultParams, truncation: { enabled: true, lambda: 8 } } };
    const edited = withDraft((x) => (x.truncation = { enabled: true, lambda: '10' }));
    expect(changes(edited, on).operator).toEqual(['Offspring λ']);
  });

  test('population size, initialization and seed need a reset', () => {
    expect(changes(withDraft((x) => (x.size = '8')), current)).toEqual({ operator: [], reset: ['Population size'] });
    expect(changes(withDraft((x) => (x.seed = '7')), current).reset).toEqual(['Seed']);
    const hand = withDraft((x) => ((x.init = 'explicit'), (x.chromosomes = '01101 11000')));
    expect(changes(hand, current).reset).toEqual(['Initialization']);
  });

  test('editing the characters of a hand-edited population needs a reset', () => {
    const setup = { problem: goldberg, init: { kind: 'explicit' as const, chromosomes: ['01101', '11000'] } };
    const base = { params: defaultParams, setup, seed: 42 };
    const d = draftOf(defaultParams, setup, 42);
    expect(changes(d, base).reset).toEqual([]);
    d.chromosomes = '01101\n11001';
    expect(changes(d, base).reset).toEqual(['Hand-edited population']);
  });
});
