import { describe, expect, test } from 'vitest';
import { gaAlgorithm, populationFromEvents, type GaParams, type GaSetup } from './algorithm';
import { binaryAlphabet, type Chromosome } from './chromosome';
import { goldberg } from './goldberg';
import type { Problem, Scores } from './problem';
import { createRun } from '../run/run';

/**
 * A small made-up problem whose evaluation repairs chromosomes: at most 3 ones are allowed, and the later ones are
 * cleared. Fitness is the number of ones that are left. (Not the knapsack: this is about the engine's contract.)
 */
const repairing: Problem = {
  chromosomeLength: 6,
  alphabet: binaryAlphabet,
  columns: [{ header: 'Ones', show: (s: Scores) => String(s.fitness) }],
  evaluate(chromosome): Scores {
    const ones = chromosome.reduce((n, g) => n + g, 0);
    if (ones <= 3) return { decoded: chromosome.join(''), objective: ones, fitness: ones };
    let seen = 0;
    const repaired = chromosome.map((g) => (g === 1 && ++seen > 3 ? 0 : g)) as Chromosome;
    return { decoded: repaired.join(''), objective: 3, fitness: 3, repaired };
  },
};

/** A problem that reports infeasible individuals without repairing them. */
const picky: Problem = {
  chromosomeLength: 6,
  alphabet: binaryAlphabet,
  columns: [{ header: 'Ones', show: (s: Scores) => String(s.fitness) }],
  evaluate(chromosome): Scores {
    const ones = chromosome.reduce((n, g) => n + g, 0);
    return { decoded: chromosome.join(''), objective: ones, fitness: ones, feasible: ones <= 3 };
  },
};

const params: GaParams = {
  selection: { method: 'tournament', size: 2 },
  crossover: { enabled: true, operator: 'one-point', probability: 0.9 },
  mutation: { enabled: true, mode: 'per-gene', probability: 0.15 },
  elites: 1,
  stop: { generationLimit: 50 },
};
const make = (problem: Problem, o: { init?: GaSetup['init']; seed?: number; eventCacheSize?: number; params?: Partial<GaParams> } = {}) =>
  createRun(gaAlgorithm, { setup: { problem, init: o.init ?? { kind: 'random', size: 8 } }, params: { ...params, ...o.params }, seed: o.seed ?? 3 }, { eventCacheSize: o.eventCacheSize });
const ones = (c: readonly number[]) => c.reduce((n, g) => n + g, 0);

describe('the initial population is repaired and the event says so', () => {
  const run = make(repairing, { init: { kind: 'explicit', chromosomes: ['111111', '101010', '110011', '000000'] } });
  const setup = run.events(0).flatMap((e) => (e.stage === 'setup' ? [e] : []));

  test('the individual carries the repaired chromosome, and the event keeps the one that was typed', () => {
    expect(setup.map((e) => e.individual.chromosome.join(''))).toEqual(['111000', '101010', '110010', '000000']);
    expect(setup.map((e) => e.repairedFrom?.join(''))).toEqual(['111111', undefined, '110011', undefined]);
    expect(run.snapshot(0).state.population.map((i) => i.chromosome.join(''))).toEqual(['111000', '101010', '110010', '000000']);
  });

  test('an individual that needed no repair has no repairedFrom key at all', () => {
    expect('repairedFrom' in setup[1]!).toBe(false);
    expect('repaired' in setup[0]!.individual).toBe(false); // the repaired chromosome is the chromosome, not a further field
  });
});

describe('offspring are repaired after mutation', () => {
  const run = make(repairing, { seed: 11 });
  for (let g = 0; g < 8; g++) run.forwardCycle();

  test('the evaluation event shows the chromosome as mutation left it next to the repaired individual', () => {
    let repairs = 0;
    for (let g = 1; g <= 8; g++) {
      const events = run.events(g);
      const mutated = new Map(events.flatMap((e) => (e.stage === 'mutation' ? [[e.offspring, e.after] as const] : [])));
      for (const e of events) {
        if (e.stage !== 'evaluation') continue;
        const left = mutated.get(e.offspring)!;
        if (ones(left) > 3) {
          repairs++;
          expect(e.repairedFrom).toEqual(left);
          expect(ones(e.individual.chromosome)).toBe(3);
          expect(e.individual.chromosome.every((gene, k) => gene <= left[k]!)).toBe(true); // only ones were cleared
        } else {
          expect(e.repairedFrom).toBeUndefined();
          expect(e.individual.chromosome).toEqual(left);
        }
      }
    }
    expect(repairs).toBeGreaterThan(0); // the run really exercised the repair
  });

  test('the next population holds the repaired chromosomes, so later parents are repaired ones', () => {
    for (let g = 1; g <= 8; g++) for (const i of run.snapshot(g).state.population) expect(ones(i.chromosome)).toBeLessThanOrEqual(3);
  });

  test('the events alone reproduce every population', () => {
    for (let g = 1; g <= 8; g++) {
      expect(populationFromEvents(run.snapshot(g - 1).state.population, run.events(g))).toEqual(run.snapshot(g).state.population);
    }
  });
});

describe('a run with repair is the same run however it is advanced', () => {
  const advance = (how: (r: ReturnType<typeof make>) => void, eventCacheSize: number) => {
    const run = make(repairing, { seed: 21, eventCacheSize });
    while (run.lastCycle < 6) how(run);
    return Array.from({ length: 7 }, (_, c) => ({ snapshot: run.snapshot(c), events: run.events(c) }));
  };
  test('micro-steps, stages, generations and run-until agree, and regenerated events equal live ones', () => {
    const byMicro = advance((r) => r.forwardMicro(), 0);
    expect(advance((r) => r.forwardStage(), 0)).toEqual(byMicro);
    expect(advance((r) => r.forwardCycle(), 100)).toEqual(byMicro);
    const until = make(repairing, { seed: 21, eventCacheSize: 0 });
    until.runUntil((s) => s.cycle === 6);
    expect(Array.from({ length: 7 }, (_, c) => ({ snapshot: until.snapshot(c), events: until.events(c) }))).toEqual(byMicro);
  });
});

describe('with no repair nothing changes', () => {
  test('Goldberg events have no repairedFrom and its individuals have no feasible flag', () => {
    const run = createRun(gaAlgorithm, { setup: { problem: goldberg, init: { kind: 'random', size: 6 } }, params: { ...params, mutation: { enabled: true, mode: 'per-gene', probability: 0.3 } }, seed: 5 });
    for (let g = 0; g < 4; g++) run.forwardCycle();
    for (let g = 0; g <= 4; g++) {
      for (const e of run.events(g)) {
        if (e.stage === 'setup' || e.stage === 'evaluation') {
          expect('repairedFrom' in e).toBe(false);
          expect('feasible' in e.individual).toBe(false);
        }
      }
    }
  });
});

describe('feasibility is carried by the individual', () => {
  test('a problem that reports it has it on every individual, in the population and in the events', () => {
    const run = make(picky, { seed: 4 });
    run.forwardCycle();
    run.forwardCycle();
    for (const c of [0, 1, 2]) {
      for (const i of run.snapshot(c).state.population) expect(i.feasible).toBe(ones(i.chromosome) <= 3);
    }
    const scored = run.events(1).flatMap((e) => (e.stage === 'evaluation' ? [e.individual] : []));
    expect(scored.length).toBeGreaterThan(0);
    expect(scored.every((i) => i.feasible === (ones(i.chromosome) <= 3))).toBe(true);
    expect(scored.some((i) => i.feasible === false)).toBe(true);
  });
});
