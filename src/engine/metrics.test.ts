import { describe, expect, test } from 'vitest';
import { binaryAlphabet, formatBits } from './chromosome';
import { fitnessColumn } from './problem';
import { gaAlgorithm, type GaParams } from './algorithm';
import { goldberg } from './goldberg';
import { runGeneration, startRun, type GenerationConfig, type RunState } from './generation';
import { metricsOf } from './metrics';
import { createRng } from '../run/rng';
import { createRun } from '../run/run';
import { scripted } from './test-support';

const textbook = ['01101', '11000', '01000', '10011'];
const gaParams: GaParams = {
  selection: { method: 'roulette', chain: [{ step: 'identity' }] },
  crossover: { enabled: true, operator: 'one-point', probability: 0.8 },
  mutation: { enabled: true, mode: 'per-gene', probability: 0.05 },
  elites: 0,
  stop: { generationLimit: 50 },
};
const stateOf = (chromosomes: string[]): RunState =>
  startRun(goldberg, { kind: 'explicit', chromosomes }, scripted()).state;

describe('the textbook population (the mock’s numbers)', () => {
  const metrics = metricsOf(stateOf(textbook));

  test('best, worst and average fitness of the generation', () => {
    expect(metrics).toMatchObject({ generation: 0, best: 576, worst: 64, average: 292.5 });
  });

  test('best so far and the evaluation count come from the run state', () => {
    expect(metrics).toMatchObject({ bestSoFar: 576, evaluations: 4 });
  });
});

// An independent oracle: compare every pair of chromosomes directly, as the definition says.
const bruteForceDiversity = (chromosomes: string[]) => {
  let differing = 0;
  let pairs = 0;
  for (let i = 0; i < chromosomes.length; i++) {
    for (let j = i + 1; j < chromosomes.length; j++) {
      differing += [...chromosomes[i]!].filter((gene, k) => gene !== chromosomes[j]![k]).length;
      pairs++;
    }
  }
  return pairs === 0 ? 0 : differing / pairs / chromosomes[0]!.length;
};
const textsOf = (state: RunState) => state.population.map((i) => formatBits(i.chromosome));

describe('diversity (mean pairwise Hamming distance, normalised to 0–1)', () => {
  test('the textbook population: 17 differing genes over 6 pairs, out of 5 genes', () => {
    // pair distances 3, 2, 4, 1, 3, 4 (counted by hand)
    expect(metricsOf(stateOf(textbook)).diversity).toBeCloseTo(17 / 6 / 5, 12);
  });

  test('identical chromosomes have diversity 0 and one distinct chromosome', () => {
    const metrics = metricsOf(stateOf(['01101', '01101', '01101']));
    expect(metrics.diversity).toBe(0);
    expect(metrics.distinct).toBe(1);
  });

  test('a complementary pair is as diverse as two chromosomes can be', () => {
    expect(metricsOf(stateOf(['01101', '10010'])).diversity).toBe(1);
  });

  test('two of one and two of its complement: four of the six pairs differ completely', () => {
    expect(metricsOf(stateOf(['00000', '00000', '11111', '11111'])).diversity).toBeCloseTo(4 / 6, 12);
  });

  test('a single individual has diversity 0, since there are no pairs to compare', () => {
    expect(metricsOf(stateOf(['01101'])).diversity).toBe(0);
  });

  test('the linear-time calculation equals comparing every pair, for random populations of many sizes and lengths', () => {
    const longer = { chromosomeLength: 13, alphabet: binaryAlphabet, columns: [fitnessColumn], evaluate: (c: readonly number[]) => ({ decoded: 0, objective: 0, fitness: c.length }) };
    for (let trial = 0; trial < 60; trial++) {
      const rng = createRng(1000 + trial);
      const size = 1 + Math.floor(rng.next() * 40);
      const problem = trial % 2 === 0 ? goldberg : longer;
      const state = startRun(problem, { kind: 'random', size }, rng).state;
      expect(metricsOf(state).diversity).toBeCloseTo(bruteForceDiversity(textsOf(state)), 12);
    }
  });

  test('stays between 0 and 1 for a large population', () => {
    const state = startRun(goldberg, { kind: 'random', size: 500 }, createRng(3)).state;
    const { diversity } = metricsOf(state);
    expect(diversity).toBeGreaterThan(0);
    expect(diversity).toBeLessThanOrEqual(1);
  });
});

describe('distinct chromosomes', () => {
  test('counts different chromosomes, however often each appears', () => {
    expect(metricsOf(stateOf(textbook)).distinct).toBe(4);
    expect(metricsOf(stateOf(['01101', '11000', '01101', '11000', '01101'])).distinct).toBe(2);
  });

  test('chromosomes with the same fitness are still different chromosomes', () => {
    // a flat problem gives every chromosome the same fitness, so the count must come from the genes alone
    const flat = { chromosomeLength: 3, alphabet: binaryAlphabet, columns: [fitnessColumn], evaluate: () => ({ decoded: 0, objective: 0, fitness: 1 }) };
    const state = startRun(flat, { kind: 'explicit', chromosomes: ['000', '001', '010'] }, scripted()).state;
    expect(metricsOf(state).distinct).toBe(3);
  });
});

describe('allele frequencies (the share of ones at each gene)', () => {
  test('the textbook population gives the mock’s strip: 0.5, 0.75, 0.25, 0.25, 0.5', () => {
    expect(metricsOf(stateOf(textbook)).alleleFrequencies).toEqual([0.5, 0.75, 0.25, 0.25, 0.5]);
  });

  test('all ones gives 1 everywhere and all zeros gives 0', () => {
    expect(metricsOf(stateOf(['11111', '11111'])).alleleFrequencies).toEqual([1, 1, 1, 1, 1]);
    expect(metricsOf(stateOf(['00000', '00000'])).alleleFrequencies).toEqual([0, 0, 0, 0, 0]);
  });

  test('one value per gene, each between 0 and 1', () => {
    const state = startRun(goldberg, { kind: 'random', size: 50 }, createRng(9)).state;
    const { alleleFrequencies } = metricsOf(state);
    expect(alleleFrequencies).toHaveLength(5);
    for (const f of alleleFrequencies) {
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThanOrEqual(1);
    }
  });

  test('a gene that is fixed in the population has diversity contribution zero: frequency 0 or 1', () => {
    const { alleleFrequencies } = metricsOf(stateOf(['10100', '10110', '10101']));
    expect(alleleFrequencies[0]).toBe(1);
    expect(alleleFrequencies[1]).toBe(0);
  });
});

describe('best so far versus best of this generation', () => {
  const noVariation: GenerationConfig = {
    problem: goldberg,
    selection: { method: 'roulette', chain: [{ step: 'identity' }] },
    crossover: { enabled: false, operator: 'one-point', probability: 0.8 },
    mutation: { enabled: false, mode: 'per-gene', probability: 0.05 },
    elites: 0,
    stop: { generationLimit: 50 },
  };

  test('after a generation of poor offspring, best of generation falls below best so far', () => {
    // every spin lands on individual 3 (fitness 64): the next population is four copies of it
    const { state } = runGeneration(stateOf(textbook), noVariation, scripted(0.65, 0.65, 0.65, 0.65));
    const metrics = metricsOf(state);
    expect(metrics).toMatchObject({ generation: 1, best: 64, worst: 64, average: 64, bestSoFar: 576, evaluations: 8 });
    expect(metrics.diversity).toBe(0);
    expect(metrics.distinct).toBe(1);
  });

  test('over a real run best so far never decreases and is never below the generation’s best', () => {
    const rng = createRng(31);
    let state = startRun(goldberg, { kind: 'random', size: 6 }, rng).state;
    let previous = metricsOf(state).bestSoFar;
    for (let g = 1; g <= 40; g++) {
      state = runGeneration(state, { ...noVariation, crossover: { enabled: true, operator: 'one-point', probability: 0.8 }, mutation: { enabled: true, mode: 'per-gene', probability: 0.1 } }, rng).state;
      const metrics = metricsOf(state);
      expect(metrics.bestSoFar).toBeGreaterThanOrEqual(previous);
      expect(metrics.bestSoFar).toBeGreaterThanOrEqual(metrics.best);
      expect(metrics.worst).toBeLessThanOrEqual(metrics.average);
      expect(metrics.average).toBeLessThanOrEqual(metrics.best);
      expect(metrics.evaluations).toBe(state.evaluations);
      previous = metrics.bestSoFar;
    }
  });
});

describe('metrics are derived, so they can always be recomputed', () => {
  test('computing them leaves the state untouched', () => {
    const state = stateOf(textbook);
    const before = JSON.stringify(state);
    metricsOf(state);
    expect(JSON.stringify(state)).toBe(before);
  });

  test('the same seed gives the same series, which is also what scrubbing back to a snapshot shows', () => {
    const series = () => {
      const run = createRun(gaAlgorithm, { setup: { problem: goldberg, init: { kind: 'random', size: 6 } }, params: gaParams, seed: 5 }, { eventCacheSize: 0 });
      run.runUntil((s) => s.cycle === 8);
      return Array.from({ length: 9 }, (_, c) => metricsOf(run.snapshot(c).state));
    };
    expect(series()).toEqual(series());
    expect(series().map((m) => m.generation)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });

  test('asking again for the same state is cheap: it returns the same object', () => {
    const state = stateOf(textbook);
    expect(metricsOf(state)).toBe(metricsOf(state));
  });
});

describe('refusals', () => {
  test('an empty population is refused with a message, rather than producing NaN', () => {
    const empty: RunState = { ...stateOf(textbook), population: [] };
    expect(() => metricsOf(empty)).toThrow('Cannot compute metrics for an empty population');
  });
});
