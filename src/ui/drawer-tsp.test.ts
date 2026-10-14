import { describe, expect, test } from 'vitest';
import { tspDefaultEpsilon, tspProblem, type GaParams, type GaSetup, type TspOptions } from '../engine';
import { changes, chromosomePieces, draftOf, optionsOf, parseChromosomes, problemOf, toParams, toSetup, validate, withInstance, type Draft } from './drawer-model';
import { defaultsOf, entryOf } from './problems';

const entry = entryOf('tsp')!;
const optionsFor = (o: Partial<TspOptions> = {}): TspOptions => ({ ...(entry.defaultOptions() as TspOptions), ...o });

interface Current {
  params: GaParams;
  setup: GaSetup;
  seed: number;
  options: TspOptions;
}
const currentOf = (o: Partial<TspOptions> = {}): Current => {
  const options = optionsFor(o);
  const d = defaultsOf(entry, options);
  return { params: d.params, setup: { problem: entry.create(options), init: d.init }, seed: d.seed, options };
};
const draftFor = (c: Current): Draft => draftOf(c.params, c.setup, c.seed, c.options);
const errorsOf = (draft: Draft, c: Current) => validate(draft, problemOf(draft, entry, c.setup.problem), [], entry).errors;

describe('the TSP draft', () => {
  test('is drafted with its options as typed text, a per-individual mutation with its type, and ε', () => {
    const draft = draftFor(currentOf({ instance: 'berlin52' }));
    expect(draft.tsp).toEqual({ instance: 'berlin52', n: '10', seed: '1' });
    expect(draft.crossover).toEqual({ enabled: true, operator: 'ox', probability: '0.9' });
    expect(draft.mutation).toEqual({ enabled: true, mode: 'per-individual', probability: '0.4', operator: 'inversion' });
    expect(draft.stop.epsilon).toEqual({ enabled: true, value: '0.5' });
    expect(draft.stop.target.enabled).toBe(false);
    expect(draftFor(currentOf({ instance: 'circle', n: 8 })).stop.epsilon).toEqual({ enabled: true, value: '0.000001' });
  });

  test('the options the draft describes are read from the typed text', () => {
    const draft = draftFor(currentOf({ instance: 'random', n: 9, seed: 4 }));
    draft.tsp!.n = '12';
    expect(optionsOf(draft)).toEqual({ instance: 'random', n: 12, seed: 4 });
    draft.tsp!.seed = 'x';
    expect(Number.isNaN((optionsOf(draft) as TspOptions).seed)).toBe(true);
  });

  test('the draft turns back into exactly the parameters it came from, and the setup too', () => {
    for (const o of [{ instance: 'berlin52' }, { instance: 'circle', n: 7 }, { instance: 'random', n: 11, seed: 3 }]) {
      const c = currentOf(o);
      const { truncation, ...params } = toParams(draftFor(c));
      expect(truncation).toEqual({ enabled: false, lambda: 20 });
      expect(params).toEqual(c.params);
      expect(toSetup(draftFor(c), c.setup.problem)).toEqual({ problem: c.setup.problem, init: c.setup.init });
    }
  });

  test('a valid draft has no errors, for every instance', () => {
    for (const id of ['circle', 'clusters', 'random', 'burma14', 'ulysses16', 'ulysses22', 'att48', 'eil51', 'berlin52']) {
      const c = currentOf({ instance: id });
      expect(errorsOf(draftFor(c), c), id).toEqual({});
    }
  });
});

describe('the options of the instance', () => {
  test('an unknown instance, a number of cities out of range (circle and random only) and a bad seed (random only) are said under their fields', () => {
    const c = currentOf({ instance: 'circle', n: 8 });
    const d = draftFor(c);
    d.tsp!.instance = 'att49';
    expect(errorsOf(d, c).instance).toMatch(/^Instance must be one of circle, clusters, random, burma14/);
    const circle = draftFor(c);
    circle.tsp!.n = '20';
    expect(errorsOf(circle, c).cities).toBe('The number of cities must be a whole number from 5 to 15 (it is 20).');
    circle.tsp!.n = 'x';
    expect(errorsOf(circle, c).cities).toBe('The number of cities must be a whole number from 5 to 15 (it is not a number).');
    const random = draftFor(currentOf({ instance: 'random', n: 8, seed: 2 }));
    random.tsp!.seed = '-3';
    expect(errorsOf(random, currentOf({ instance: 'random', n: 8, seed: 2 })).citySeed).toBe('The seed must be a whole number of 0 or more (it is -3).');
    const berlin = draftFor(currentOf({ instance: 'berlin52' }));
    berlin.tsp!.n = 'x';
    berlin.tsp!.seed = 'x';
    expect(errorsOf(berlin, currentOf({ instance: 'berlin52' }))).toEqual({});
  });

  test('what an instance change resets: the instance, and for the circle and the random one its size and its seed; the run seed is its own', () => {
    const c = currentOf({ instance: 'ulysses16' });
    const d = draftFor(c);
    d.tsp!.instance = 'berlin52';
    expect(changes(d, c).reset).toEqual(['Instance']);
    const circle = currentOf({ instance: 'circle', n: 8 });
    const dc = draftFor(circle);
    dc.tsp!.n = '9';
    expect(changes(dc, circle).reset).toEqual(['Number of cities']);
    const random = currentOf({ instance: 'random', n: 8, seed: 2 });
    const dr = draftFor(random);
    dr.tsp!.seed = '5';
    dr.seed = '77';
    expect(changes(dr, random).reset).toEqual(['Instance seed', 'Seed']);
    // for the other instances the typed size and seed are not part of the run
    const berlin = currentOf({ instance: 'berlin52' });
    const db = draftFor(berlin);
    db.tsp!.n = '12';
    db.tsp!.seed = '9';
    expect(changes(db, berlin).reset).toEqual([]);
  });

  test('changing to an instance with another kind of distance resets ε to that instance’s default, and the notice says so; a typed ε is kept', () => {
    const c = currentOf({ instance: 'ulysses16' });
    const moved = withInstance(draftFor(c), { instance: 'circle' });
    expect(moved.tsp!.instance).toBe('circle');
    expect(moved.stop.epsilon).toEqual({ enabled: true, value: '0.000001' });
    expect(changes(moved, c).notes).toEqual(['ε reset to the new instance’s default (0.5 → 0.000001).']);
    // between two whole-number instances the default is the same, so nothing is said
    const same = withInstance(draftFor(c), { instance: 'berlin52' });
    expect(same.stop.epsilon).toEqual({ enabled: true, value: '0.5' });
    expect(changes(same, c).notes).toBeUndefined();
    // a value the user typed stays
    const typed = draftFor(c);
    typed.stop.epsilon!.value = '3';
    expect(withInstance(typed, { instance: 'circle' }).stop.epsilon!.value).toBe('3');
    // so does a switched-off ε
    const off = draftFor(c);
    off.stop.epsilon!.enabled = false;
    expect(withInstance(off, { instance: 'circle' }).stop.epsilon).toEqual({ enabled: false, value: '0.5' });
  });
});

describe('the operators of a permutation', () => {
  test('order, partial-mapped and cycle crossover are fine; the symbol and real operators are refused in words', () => {
    const c = currentOf();
    for (const operator of ['ox', 'pmx', 'cx'] as const) {
      const d = draftFor(c);
      d.crossover.operator = operator;
      expect(errorsOf(d, c)['crossover.operator'], operator).toBeUndefined();
    }
    for (const [operator, name] of [['one-point', 'One-point'], ['two-point', 'Two-point'], ['uniform', 'Uniform'], ['blx-alpha', 'BLX-α'], ['arithmetic', 'Arithmetic']] as const) {
      const d = draftFor(c);
      d.crossover.operator = operator;
      if (operator === 'blx-alpha') d.crossover.alpha = '0.5';
      expect(errorsOf(d, c)['crossover.operator'], operator).toBe(`${name} crossover would repeat and lose cities; choose order, partial-mapped or cycle crossover for this problem.`);
    }
  });

  test('swap, inversion and insertion are fine; flip and Gaussian, a missing type and the per-gene mode are refused in words', () => {
    const c = currentOf();
    for (const operator of ['swap', 'inversion', 'insertion'] as const) {
      const d = draftFor(c);
      d.mutation.operator = operator;
      expect(errorsOf(d, c), operator).toEqual({});
    }
    for (const [operator, name] of [['flip', 'Flip'], ['gaussian', 'Gaussian']] as const) {
      const d = draftFor(c);
      d.mutation.operator = operator;
      expect(errorsOf(d, c)['mutation.operator'], operator).toBe(`${name} mutation would repeat and lose cities; choose swap, inversion or insertion mutation for this problem.`);
    }
    const missing = draftFor(c);
    delete missing.mutation.operator;
    expect(errorsOf(missing, c)['mutation.operator']).toBe('A permutation needs a mutation operator: choose swap, inversion or insertion.');
    const perGene = draftFor(c);
    perGene.mutation.mode = 'per-gene';
    expect(errorsOf(perGene, c)['mutation.mode']).toBe('Per-gene mutation has no meaning for a permutation, whose genes are not independent; use per individual mutation (one draw for the tour, then one move).');
  });

  test('σ and α do not belong to a permutation', () => {
    const c = currentOf();
    const d = draftFor(c);
    d.mutation.sigma = '0.05';
    expect(errorsOf(d, c)['mutation.sigma']).toBe('σ belongs to Gaussian mutation of real-valued chromosomes; leave it out for this problem.');
    const a = draftFor(c);
    a.crossover.alpha = '0.5';
    expect(errorsOf(a, c)['crossover.alpha']).toBe('α belongs to BLX-α crossover; leave it out or choose BLX-α.');
  });

  test('the permutation operators are refused for the other problems, in words (symbols and real numbers)', () => {
    const goldberg = entryOf('goldberg')!;
    const d = defaultsOf(goldberg, undefined);
    const setup: GaSetup = { problem: goldberg.create(undefined), init: d.init };
    const draft = draftOf(d.params, setup, d.seed);
    draft.crossover.operator = 'pmx';
    draft.mutation.operator = 'swap';
    const errors = validate(draft, setup.problem, [], goldberg).errors;
    expect(errors['crossover.operator']).toBe('Partial-mapped (PMX) crossover is for permutation chromosomes; choose one-point, two-point or uniform crossover for this problem.');
    expect(errors['mutation.operator']).toBe('Swap mutation is for permutation chromosomes; use flip mutation for this problem.');
    const landscape = entryOf('landscape')!;
    const ld = defaultsOf(landscape, undefined);
    const lsetup: GaSetup = { problem: landscape.create(undefined), init: ld.init };
    const ldraft = draftOf(ld.params, lsetup, ld.seed, landscape.defaultOptions());
    ldraft.crossover.operator = 'ox';
    ldraft.mutation.operator = 'inversion';
    const lerrors = validate(ldraft, lsetup.problem, [], landscape).errors;
    expect(lerrors['crossover.operator']).toBe('Order (OX) crossover is for permutation chromosomes; choose BLX-α, arithmetic, one-point, two-point or uniform crossover for this problem.');
    expect(lerrors['mutation.operator']).toBe('Inversion mutation is for permutation chromosomes; use Gaussian mutation for this problem.');
  });

  test('which operator edits wait for the next generation and which need a reset: the types and the probability wait, the instance restarts', () => {
    const c = currentOf();
    const d = draftFor(c);
    d.crossover.operator = 'pmx';
    d.mutation.operator = 'swap';
    d.mutation.probability = '0.2';
    expect(changes(d, c)).toEqual({ operator: ['Crossover type', 'Mutation type', 'Mutation probability'], reset: [] });
  });

  test('the same labels are found from a draft read back without the problem options, as the session does for the changes waiting', () => {
    const c = currentOf();
    const d = draftFor(c);
    d.mutation.operator = 'swap';
    const waiting = toParams(d);
    const asSession = draftOf(waiting, c.setup, c.seed);
    expect(asSession.tsp).toBeUndefined();
    expect(changes(asSession, { params: c.params, setup: c.setup, seed: c.seed }).operator).toEqual(['Mutation type']);
  });
});

describe('the stops of a TSP run', () => {
  test('ε is a parameter to set; a target fitness is allowed too, and a bad ε is refused', () => {
    const c = currentOf();
    const d = draftFor(c);
    d.stop.target = { enabled: true, value: '-7000' };
    expect(errorsOf(d, c)['stop.target']).toBeUndefined();
    d.stop.epsilon!.value = '0';
    expect(errorsOf(d, c)['stop.epsilon']).toBe('ε must be a number greater than 0.');
    expect(toParams({ ...d, stop: { ...d.stop, epsilon: { enabled: true, value: '2' } } }).stop).toMatchObject({ targetFitness: -7000, targetEpsilon: 2 });
  });

  test('the default ε of the instance is what the draft starts with', () => {
    for (const id of ['ulysses16', 'circle']) {
      const c = currentOf({ instance: id });
      expect(Number(draftFor(c).stop.epsilon!.value)).toBe(tspDefaultEpsilon(tspProblem(c.options)));
    }
  });
});

describe('a hand-edited population of tours', () => {
  const c = currentOf({ instance: 'circle', n: 6 });
  const problem = c.setup.problem;

  test('a tour is city numbers separated by spaces or commas, one per line (a semicolon also ends one)', () => {
    expect(chromosomePieces('1 2 3 4 5 6\n6,5,4,3,2,1; 2 1 4 3 6 5', problem)).toEqual(['1 2 3 4 5 6', '6,5,4,3,2,1', '2 1 4 3 6 5']);
  });

  test('each line is read, scored and shown by its columns', () => {
    const [row] = parseChromosomes('1 2 3 4 5 6', problem);
    expect(row!.error).toBeUndefined();
    expect(row!.decoded).toBe('1 2 3 4 5 6');
    expect(row!.fitness).toBe(problem.knownOptimumFitness);
    expect(row!.cells).toHaveLength(3);
    expect(row!.cells![1]).toBe('0.0%');
  });

  test('what is wrong with a line is said in words, naming it', () => {
    const rows = parseChromosomes('1 2 3 4 5 6\n1 two 3 4 5 6\n1 2 3\n1 2 2 4 5 6\n1 2 3 4 5 9', problem);
    expect(rows.map((r) => r.error)).toEqual([
      undefined,
      'Chromosome 2 ("1 two 3 4 5 6") may only contain city numbers separated by spaces or commas.',
      'Chromosome 3 has 3 cities, but this problem needs 6.',
      'Chromosome 4: city 2 appears twice; city 3 is missing.',
      'Chromosome 5: city 9 is not one of the 6 cities (1 to 6); city 6 is missing.',
    ]);
  });

  test('an empty hand-edited population is asked for with an example tour', () => {
    const d = draftFor(c);
    d.init = 'explicit';
    d.chromosomes = '';
    expect(errorsOf(d, c).chromosomes).toBe('Type at least one chromosome, for example 1 2 3 4 5 6.');
    const big = currentOf({ instance: 'berlin52' });
    const dbig = draftFor(big);
    dbig.init = 'explicit';
    dbig.chromosomes = '';
    expect(errorsOf(dbig, big).chromosomes).toBe('Type at least one chromosome, for example 1 2 3 4 5 6 7 8 … (all 52 cities, each once).');
  });
});
