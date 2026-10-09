import { describe, expect, test } from 'vitest';
import { formatBits } from './chromosome';
import { goldberg } from './goldberg';
import { generationalReplacement, runGeneration, startRun, stopReasons, type GenerationConfig, type ReplacementStrategy, type RunState } from './generation';
import { createRng } from './rng';
import { scripted } from './test-support';

const textbook = ['01101', '11000', '01000', '10011'];

const baseConfig: GenerationConfig = {
  problem: goldberg,
  selection: { method: 'roulette', chain: [{ step: 'identity' }] },
  crossover: { enabled: true, operator: 'one-point', probability: 0.8 },
  mutation: { enabled: true, mode: 'per-gene', probability: 0.05 },
  elites: 0,
  stop: { generationLimit: 50 },
};

const start = (chromosomes = textbook) => startRun(goldberg, { kind: 'explicit', chromosomes }, scripted()).state;

// The mock’s worked example, as a script of every random draw the generation makes, in order:
//   selection spins (4)   0.58 0.07 0.91 0.31          → pool 2, 1, 4, 2
//   crossover             pair 1: u 0.41, cut draw 0.8 → recombine, cut after gene 4 · pair 2: u 0.93 → bypass
//   mutation (4 × 5)      only offspring 3, gene 2 draws below pm = 0.05
const mockDraws = [
  0.58, 0.07, 0.91, 0.31,
  0.41, 0.8, 0.93,
  0.62, 0.91, 0.27, 0.55, 0.88,
  0.44, 0.73, 0.96, 0.18, 0.35,
  0.81, 0.03, 0.67, 0.49, 0.22,
  0.59, 0.14, 0.77, 0.92, 0.66,
];

describe('starting a run', () => {
  test('the state holds the scored initial population and the bookkeeping later generations need', () => {
    const { state, events } = startRun(goldberg, { kind: 'explicit', chromosomes: textbook }, scripted());

    expect(state).toMatchObject({
      generation: 0,
      nextId: 5,
      evaluations: 4,
      bestFitnessSoFar: 576,
      lastImprovementGeneration: 0,
    });
    expect(state.population.map((i) => i.fitness)).toEqual([169, 576, 64, 361]);
    expect(events.map((e) => e.stage)).toEqual(['setup', 'setup', 'setup', 'setup']);
  });
});

describe('one generation without elites (the mock’s worked example)', () => {
  test('produces the hand-computed next population, with new ids, scores and provenance', () => {
    const rng = scripted(...mockDraws);
    const { state } = runGeneration(start(), baseConfig, rng);

    expect(state.generation).toBe(1);
    expect(state.population.map((i) => formatBits(i.chromosome))).toEqual(['11001', '01100', '11011', '11000']);
    expect(state.population.map((i) => i.id)).toEqual([5, 6, 7, 8]);
    expect(state.population.map((i) => i.decoded)).toEqual([25, 12, 27, 24]);
    expect(state.population.map((i) => i.fitness)).toEqual([625, 144, 729, 576]);
    expect(state).toMatchObject({ nextId: 9, evaluations: 8, bestFitnessSoFar: 729, lastImprovementGeneration: 1 });
    expect(rng.used).toBe(mockDraws.length);
  });

  test('each offspring records its parents, whether crossover recombined it, and which genes mutation flipped', () => {
    const { state } = runGeneration(start(), baseConfig, scripted(...mockDraws));

    expect(state.population.map((i) => i.origin)).toEqual([
      { kind: 'offspring', generation: 1, offspring: 1, parentAId: 2, parentBId: 1, recombined: true, flipped: [] },
      { kind: 'offspring', generation: 1, offspring: 2, parentAId: 2, parentBId: 1, recombined: true, flipped: [] },
      { kind: 'offspring', generation: 1, offspring: 3, parentAId: 4, parentBId: 2, recombined: false, flipped: [2] },
      { kind: 'offspring', generation: 1, offspring: 4, parentAId: 4, parentBId: 2, recombined: false, flipped: [] },
    ]);
  });

  test('the events follow the stage order, and the evaluation events carry the new individuals', () => {
    const { events, state } = runGeneration(start(), baseConfig, scripted(...mockDraws));

    const stages = events.map((e) => e.stage).filter((stage, k, all) => stage !== all[k - 1]);
    expect(stages).toEqual(['selection', 'pairing', 'crossover', 'mutation', 'evaluation', 'replacement']);

    const evaluations = events.filter((e) => e.stage === 'evaluation');
    expect(evaluations.map((e) => e.individual)).toEqual(state.population);
  });

  test('the state it was given is never modified', () => {
    const before = start();
    const snapshot = JSON.stringify(before);
    runGeneration(before, baseConfig, scripted(...mockDraws));
    expect(JSON.stringify(before)).toBe(snapshot);
  });
});


describe('elitism', () => {
  const withElites = (elites: number): GenerationConfig => ({ ...baseConfig, elites });

  // N = 4, e = 1: three offspring, so four parents are drawn and the last pair's second child is dropped.
  //   spins 0.58 0.07 0.91 0.31 → pool 2, 1, 4, 2 · crossover as in the mock · mutation draws for offspring 1–3 only
  const oddDraws = [0.58, 0.07, 0.91, 0.31, 0.41, 0.8, 0.93, ...mockDraws.slice(7, 22)];

  test('the elite is carried over unchanged and first, followed by the offspring in order', () => {
    const before = start();
    const rng = scripted(...oddDraws);
    const { state, events } = runGeneration(before, withElites(1), rng);

    expect(state.population.map((i) => i.id)).toEqual([2, 5, 6, 7]);
    expect(state.population.map((i) => formatBits(i.chromosome))).toEqual(['11000', '11001', '01100', '11011']);
    expect(state.population.map((i) => i.fitness)).toEqual([576, 625, 144, 729]);
    expect(state.population[0]).toEqual(before.population[1]); // the same individual, with its original origin
    expect(state).toMatchObject({ nextId: 8, evaluations: 7, bestFitnessSoFar: 729 });
    expect(events.at(-1)).toEqual({ stage: 'replacement', kind: 'summary', elites: [2], population: [2, 5, 6, 7] });
    expect(rng.used).toBe(oddDraws.length);
  });

  test('the dropped child is recorded by crossover but never evaluated', () => {
    const { events } = runGeneration(start(), withElites(1), scripted(...oddDraws));
    const crossover = events.filter((e) => e.stage === 'crossover');
    expect(crossover[1]).toMatchObject({ children: [{ offspring: 3, discarded: false }, { offspring: 4, discarded: true }] });
    expect(events.filter((e) => e.stage === 'evaluation').map((e) => e.offspring)).toEqual([1, 2, 3]);
  });

  test('elites are still eligible as parents', () => {
    const { events } = runGeneration(start(), withElites(1), scripted(...oddDraws));
    const spins = events.filter((e) => e.stage === 'selection' && e.kind === 'spin');
    expect(spins.map((e) => e.individualId)).toContain(2); // individual 2 is the elite and was picked twice
  });

  test('elites are untouched by mutation, even when every gene of every offspring flips', () => {
    const config: GenerationConfig = { ...withElites(1), mutation: { enabled: true, mode: 'per-gene', probability: 1 } };
    const { state } = runGeneration(start(), config, createRng(3));
    expect(formatBits(state.population[0]!.chromosome)).toBe('11000');
  });

  test('the best individuals are chosen, best first, and ties go to the lower population index', () => {
    // fitness 64, 576, 64 and 1
    const tied = startRun(goldberg, { kind: 'explicit', chromosomes: ['01000', '11000', '01000', '00001'] }, scripted()).state;
    const two = runGeneration(tied, withElites(2), createRng(1));
    expect(two.state.population.slice(0, 2).map((i) => i.id)).toEqual([2, 1]);

    const one = runGeneration(tied, withElites(3), createRng(1));
    expect(one.state.population.slice(0, 3).map((i) => i.id)).toEqual([2, 1, 3]);
  });

  test('with no elites the replacement event lists none', () => {
    const { events } = runGeneration(start(), baseConfig, scripted(...mockDraws));
    expect(events.at(-1)).toMatchObject({ stage: 'replacement', elites: [] });
  });
});

describe('population size and bookkeeping over many generations', () => {
  const cases = Array.from({ length: 8 }, (_, k) => k + 1).flatMap((n) => Array.from({ length: n + 1 }, (_, e) => [n, e] as const));

  test.each(cases)('N = %i, e = %i: size stays N, ids stay unique, the counters add up', (n, e) => {
    const rng = createRng(100 + n * 10 + e);
    let { state } = startRun(goldberg, { kind: 'random', size: n }, rng);
    const config: GenerationConfig = { ...baseConfig, elites: e, crossover: { ...baseConfig.crossover, probability: 0.7 }, mutation: { ...baseConfig.mutation, probability: 0.1 } };

    for (let generation = 1; generation <= 6; generation++) {
      state = runGeneration(state, config, rng).state;
      expect(state.population).toHaveLength(n);
      expect(new Set(state.population.map((i) => i.id)).size).toBe(n);
      expect(state.generation).toBe(generation);
      expect(state.evaluations).toBe(n + generation * (n - e));
      expect(state.nextId).toBe(n + 1 + generation * (n - e));
    }
  });
});

describe('best so far', () => {
  test('never decreases, and only moves the improvement marker when it strictly improves', () => {
    const rng = createRng(77);
    let { state } = startRun(goldberg, { kind: 'random', size: 6 }, rng);
    for (let generation = 1; generation <= 15; generation++) {
      const next = runGeneration(state, { ...baseConfig, elites: 0 }, rng).state;
      expect(next.bestFitnessSoFar).toBeGreaterThanOrEqual(state.bestFitnessSoFar);
      expect(next.lastImprovementGeneration).toBe(next.bestFitnessSoFar > state.bestFitnessSoFar ? generation : state.lastImprovementGeneration);
      state = next;
    }
  });

  test('without elites, best of generation can fall below best so far', () => {
    // every offspring is a copy of a poor parent (crossover and mutation off, spins land on individual 3 = fitness 64)
    const config: GenerationConfig = { ...baseConfig, crossover: { ...baseConfig.crossover, enabled: false }, mutation: { ...baseConfig.mutation, enabled: false } };
    const { state } = runGeneration(start(), config, scripted(0.65, 0.65, 0.65, 0.65));
    expect(state.population.map((i) => i.fitness)).toEqual([64, 64, 64, 64]);
    expect(state.bestFitnessSoFar).toBe(576);
    expect(state.lastImprovementGeneration).toBe(0);
  });
});

describe('determinism and draw order', () => {
  const runMany = (seed: number, generations: number, config: GenerationConfig = baseConfig) => {
    const rng = createRng(seed);
    let { state } = startRun(goldberg, { kind: 'random', size: 6 }, rng);
    const all = [];
    for (let g = 0; g < generations; g++) {
      const result = runGeneration(state, config, rng);
      all.push(result);
      state = result.state;
    }
    return all;
  };

  test('the same configuration and seed give the identical run, events included', () => {
    expect(runMany(21, 10)).toEqual(runMany(21, 10));
    expect(runMany(21, 10)).not.toEqual(runMany(22, 10));
  });

  test('a generation makes exactly the draws its stages need: spins, then per pair, then per offspring gene', () => {
    const rng = createRng(5);
    const counting = { next: () => { used++; return rng.next(); } };
    let used = 0;
    const { state } = startRun(goldberg, { kind: 'explicit', chromosomes: textbook }, counting);
    used = 0;
    const { events } = runGeneration(state, { ...baseConfig, elites: 1 }, counting);

    const recombined = events.filter((e) => e.stage === 'crossover' && e.decision === 'recombined').length;
    const pairs = events.filter((e) => e.stage === 'pairing').length;
    const spins = 4; // three offspring need four parents
    expect(used).toBe(spins + pairs + recombined + 3 * 5);
  });

  test('later random decisions continue the same sequence after a generation', () => {
    const reference = createRng(9);
    const sequence = Array.from({ length: 60 }, () => reference.next());
    const rng = createRng(9);
    const { state } = startRun(goldberg, { kind: 'explicit', chromosomes: textbook }, rng);
    const { events } = runGeneration(state, baseConfig, rng);

    const recombined = events.filter((e) => e.stage === 'crossover' && e.decision === 'recombined').length;
    expect(rng.next()).toBe(sequence[4 + 2 + recombined + 20]);
  });
});

describe('configuration errors', () => {
  test.each([-1, 1.5, 5, Number.NaN])('an elite count of %s is refused', (elites) => {
    expect(() => runGeneration(start(), { ...baseConfig, elites }, scripted())).toThrow(
      'Elites must be a whole number from 0 to the population size (4)',
    );
  });

  test('a weight chain that cannot work throws the chain’s own reason', () => {
    const config: GenerationConfig = { ...baseConfig, selection: { method: 'roulette', chain: [{ step: 'linear-ranking' }] } };
    expect(() => runGeneration(start(), config, scripted())).toThrow('Step 1 (Linear ranking) needs ranks as its input; put a Rank step before it.');
  });

  test('negative fitness runs through the automatic switch to Shift, which the events record', () => {
    const negative = { chromosomeLength: 5, evaluate: (c: readonly number[]) => ({ decoded: c.length, objective: 0, fitness: c.reduce((n, b) => n + b, 0) - 3 }) };
    const rng = createRng(4);
    const { state } = startRun(negative, { kind: 'random', size: 6 }, rng);
    expect(Math.min(...state.population.map((i) => i.fitness))).toBeLessThan(0);

    const { events } = runGeneration(state, { ...baseConfig, problem: negative }, rng);
    const chain = events.find((e) => e.stage === 'selection' && e.kind === 'weight-chain');
    expect(chain && 'autoSwitch' in chain && chain.autoSwitch?.to).toEqual([{ step: 'shift' }]);
  });
});

describe('stop criteria are reported, not enforced', () => {
  const noVariation: GenerationConfig = {
    ...baseConfig,
    crossover: { ...baseConfig.crossover, enabled: false },
    mutation: { ...baseConfig.mutation, enabled: false },
  };
  const stateAt = (overrides: Partial<RunState>): RunState => ({ ...start(), ...overrides });

  test('the generation limit is reported once that many generations have been made, and keeps being reported', () => {
    const config = { ...baseConfig, stop: { generationLimit: 3 } };
    const rng = createRng(1);
    let { state } = startRun(goldberg, { kind: 'explicit', chromosomes: textbook }, rng);
    const reported: string[][] = [];
    for (let g = 1; g <= 5; g++) {
      const result = runGeneration(state, config, rng);
      reported.push([...result.stops]);
      state = result.state;
      expect(state.population).toHaveLength(4); // stepping past the limit still works
    }
    expect(reported).toEqual([[], [], ['generation-limit'], ['generation-limit'], ['generation-limit']]);
  });

  test('the target counts as reached when best so far is at least the target, even if this generation is worse', () => {
    expect(stopReasons(stateAt({ bestFitnessSoFar: 729 }), { generationLimit: 50, targetFitness: 729 })).toEqual(['target-reached']);
    expect(stopReasons(stateAt({ bestFitnessSoFar: 728 }), { generationLimit: 50, targetFitness: 729 })).toEqual([]);

    const { stops } = runGeneration(start(), { ...baseConfig, stop: { generationLimit: 50, targetFitness: 729 } }, scripted(...mockDraws));
    expect(stops).toEqual(['target-reached']); // the mock's generation produces fitness 729
  });

  test('stagnation is reported when best so far has not strictly improved for the window', () => {
    const stop = { generationLimit: 50, stagnationWindow: 3 };
    expect(stopReasons(stateAt({ generation: 4, lastImprovementGeneration: 2 }), stop)).toEqual([]);
    expect(stopReasons(stateAt({ generation: 5, lastImprovementGeneration: 2 }), stop)).toEqual(['stagnation']);
    expect(stopReasons(stateAt({ generation: 9, lastImprovementGeneration: 2 }), stop)).toEqual(['stagnation']);
  });

  test('with no variation nothing new can appear, so a real run stagnates exactly at the window', () => {
    const config = { ...noVariation, stop: { generationLimit: 50, stagnationWindow: 3 } };
    const rng = createRng(6);
    let { state } = startRun(goldberg, { kind: 'random', size: 6 }, rng);
    const reported: string[][] = [];
    for (let g = 1; g <= 4; g++) {
      const result = runGeneration(state, config, rng);
      reported.push([...result.stops]);
      state = result.state;
    }
    expect(reported).toEqual([[], [], ['stagnation'], ['stagnation']]);
  });

  test('several criteria can hold at once, listed in a fixed order', () => {
    const stop = { generationLimit: 5, targetFitness: 100, stagnationWindow: 2 };
    expect(stopReasons(stateAt({ generation: 6, bestFitnessSoFar: 200, lastImprovementGeneration: 1 }), stop)).toEqual([
      'generation-limit',
      'target-reached',
      'stagnation',
    ]);
  });

  test('criteria that are not configured never fire', () => {
    expect(stopReasons(stateAt({ generation: 99, bestFitnessSoFar: 1e9, lastImprovementGeneration: 0 }), { generationLimit: 100 })).toEqual([]);
  });

  test.each([
    [{ generationLimit: 0 }, 'The generation limit must be a whole number of at least 1'],
    [{ generationLimit: 2.5 }, 'The generation limit must be a whole number of at least 1'],
    [{ generationLimit: 10, stagnationWindow: 0 }, 'The stagnation window must be a whole number of at least 1'],
    [{ generationLimit: 10, targetFitness: Number.NaN }, 'The target fitness must be a finite number'],
  ])('refuses a nonsense configuration: %j', (stop, message) => {
    expect(() => stopReasons(start(), stop)).toThrow(message);
  });
});

describe('the replacement seam', () => {
  // A (μ+λ)-style policy, to prove the stage can be swapped: make N offspring, keep the best N of parents and offspring together.
  const plusStrategy: ReplacementStrategy = {
    offspringCount: (populationSize) => populationSize,
    replace: (population, offspring) => {
      const best = [...population, ...offspring].sort((a, b) => b.fitness - a.fitness).slice(0, population.length);
      return { population: best, elites: best.filter((i) => population.some((p) => p.id === i.id)).map((i) => i.id) };
    },
  };

  test('a custom strategy decides how many offspring are made and who survives', () => {
    const { state, events } = runGeneration(start(), { ...baseConfig, replacement: plusStrategy }, scripted(...mockDraws));

    // parents 169, 576, 64, 361 and offspring 625, 144, 729, 576: the best four are 729, 625, 576 (parent), 576 (offspring)
    expect(state.population.map((i) => i.fitness)).toEqual([729, 625, 576, 576]);
    expect(events.at(-1)).toMatchObject({ stage: 'replacement', elites: [2], population: [7, 5, 2, 8] });
    expect(state.evaluations).toBe(8);
  });

  test('by default the generational strategy with the configured elites is used', () => {
    const viaConfig = runGeneration(start(), { ...baseConfig, elites: 1 }, createRng(2));
    const viaStrategy = runGeneration(start(), { ...baseConfig, elites: 0, replacement: generationalReplacement(1) }, createRng(2));
    expect(viaStrategy).toEqual(viaConfig);
  });
});
