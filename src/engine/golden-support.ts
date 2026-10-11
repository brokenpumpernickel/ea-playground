import { createRun } from '../run';
import { gaAlgorithm, type GaParams, type GaSetup } from './algorithm';
import { goldberg } from './goldberg';
import { metricsOf } from './metrics';
import { formatBits } from './chromosome';

/**
 * Golden runs: the exact output of the engine for fixed configurations and seeds, recorded as fixtures
 * (`golden/runs.json`) so that any change to the engine that alters a single draw, field or value of a binary
 * run is caught. They exist to make the generalisation from bits to alphabets provably harmless (milestone 2).
 *
 * The configurations below mirror the milestone 1 presets (plain data in `src/ui/presets/`); they are copied here
 * because the engine must not depend on the UI, and are deliberately never edited to match a changed preset.
 */
export interface GoldenCase {
  readonly name: string;
  readonly setup: GaSetup;
  readonly params: GaParams;
}

const base: GaParams = {
  selection: { method: 'roulette', chain: [{ step: 'identity' }] },
  crossover: { enabled: true, operator: 'one-point', probability: 0.8 },
  mutation: { enabled: true, mode: 'per-gene', probability: 0.05 },
  elites: 0,
  stop: { generationLimit: 50, targetFitness: 961, stagnationWindow: 10 },
};
const random = (size: number): GaSetup => ({ problem: goldberg, init: { kind: 'random', size } });
const explicit = (...chromosomes: string[]): GaSetup => ({ problem: goldberg, init: { kind: 'explicit', chromosomes } });
const textbook = explicit('01101', '11000', '01000', '10011');

export const goldenCases: readonly GoldenCase[] = [
  { name: 'default', setup: random(6), params: base },
  { name: 'preset textbook', setup: textbook, params: { ...base, crossover: { ...base.crossover, probability: 1 }, mutation: { ...base.mutation, probability: 0.001 } } },
  { name: 'preset no crossover', setup: random(6), params: { ...base, crossover: { ...base.crossover, enabled: false } } },
  { name: 'preset no mutation', setup: random(6), params: { ...base, mutation: { ...base.mutation, enabled: false } } },
  { name: 'preset high mutation', setup: random(6), params: { ...base, mutation: { ...base.mutation, probability: 0.3 } } },
  { name: 'per-individual mutation', setup: random(6), params: { ...base, mutation: { enabled: true, mode: 'per-individual', probability: 0.5 } } },
  { name: 'per-individual mutation certain', setup: random(6), params: { ...base, mutation: { enabled: true, mode: 'per-individual', probability: 1 } } },
  { name: 'per-gene mutation certain', setup: random(4), params: { ...base, mutation: { enabled: true, mode: 'per-gene', probability: 1 } } },
  { name: 'elites 2', setup: random(6), params: { ...base, elites: 2 } },
  { name: 'every individual an elite', setup: random(4), params: { ...base, elites: 4 } },
  { name: 'truncation', setup: random(6), params: { ...base, elites: 1, truncation: { enabled: true, lambda: 10 } } },
  { name: 'truncation with an odd lambda', setup: random(6), params: { ...base, truncation: { enabled: true, lambda: 7 } } },
  { name: 'tournament size 3', setup: random(6), params: { ...base, selection: { method: 'tournament', size: 3 } } },
  { name: 'rank and linear ranking', setup: random(6), params: { ...base, selection: { method: 'roulette', chain: [{ step: 'rank' }, { step: 'linear-ranking', pressure: 1.8 }] } } },
  { name: 'shift and power', setup: random(6), params: { ...base, selection: { method: 'roulette', chain: [{ step: 'shift', epsilon: 2 }, { step: 'power', exponent: 3 }] } } },
  { name: 'two-point crossover', setup: random(6), params: { ...base, crossover: { enabled: true, operator: 'two-point', probability: 1 } } },
  { name: 'uniform crossover', setup: random(6), params: { ...base, crossover: { enabled: true, operator: 'uniform', probability: 0.9 } } },
  { name: 'no crossover draws', setup: random(6), params: { ...base, crossover: { ...base.crossover, probability: 0 } } },
  { name: 'odd mating pool', setup: random(5), params: base },
  { name: 'odd mating pool from elites', setup: random(6), params: { ...base, elites: 1 } },
  { name: 'all-zero fitness switches to shift', setup: explicit('00000', '00000', '00000', '00000'), params: base },
  { name: 'two individuals', setup: random(2), params: base },
];

export const goldenSeeds = [7, 42] as const;
export const goldenGenerations = 12;
/** Generations whose full event lists are recorded (the rest are covered by their populations and metrics). */
export const goldenEventGenerations = [1, 2, goldenGenerations] as const;

export interface GoldenRun {
  readonly name: string;
  readonly seed: number;
  /** Per generation 0..n: each individual as `id:chromosome:fitness`. */
  readonly populations: readonly (readonly string[])[];
  readonly events: Readonly<Record<string, unknown>>;
  readonly metrics: readonly unknown[];
}

/** Runs one case and records everything, as plain JSON-compatible data. */
export function recordGolden(c: GoldenCase, seed: number): GoldenRun {
  const run = createRun(gaAlgorithm, { setup: c.setup, params: c.params, seed });
  for (let g = 0; g < goldenGenerations; g++) run.forwardCycle();
  const states = Array.from({ length: goldenGenerations + 1 }, (_, g) => run.snapshot(g).state);
  return JSON.parse(
    JSON.stringify({
      name: c.name,
      seed,
      populations: states.map((s) => s.population.map((i) => `${i.id}:${formatBits(i.chromosome)}:${i.fitness}`)),
      events: Object.fromEntries(goldenEventGenerations.map((g) => [String(g), run.events(g)])),
      // the metrics as they were when the fixtures were recorded (later additions are tested on their own)
      metrics: states.map((s) => {
        const { generation, best, worst, average, bestSoFar, evaluations, diversity, distinct, alleleFrequencies } = metricsOf(s);
        return { generation, best, worst, average, bestSoFar, evaluations, diversity, distinct, alleleFrequencies };
      }),
    }),
  ) as GoldenRun;
}

export const recordAllGolden = (): GoldenRun[] => goldenCases.flatMap((c) => goldenSeeds.map((seed) => recordGolden(c, seed)));
