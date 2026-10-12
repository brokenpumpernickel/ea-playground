import { describe, expect, test } from 'vitest';
import { gaAlgorithm, populationFromEvents, type GaParams, type GaSetup } from './algorithm';
import { goldberg } from './goldberg';
import { stopReasons, startRun } from './generation';
import {
  landscapeDefaultEpsilon,
  landscapeFitnessRange,
  landscapeFunctionInfo,
  landscapeFunctions,
  landscapeProblem,
  landscapeTargetFitness,
  validateEpsilon,
  type LandscapeFunction,
  type LandscapeRepresentation,
} from './landscape';
import { metricsOf, metricsOfProblem } from './metrics';
import { createRng } from '../run/rng';
import { createFakeScheduler } from '../run/fake-scheduler';
import { createPlayback } from '../run/playback';
import { createRun } from '../run/run';

interface Setting {
  readonly representation: LandscapeRepresentation;
  readonly crossovers: readonly GaParams['crossover']['operator'][];
  readonly mutation: GaParams['mutation'];
}
const settings: readonly Setting[] = [
  { representation: 'real', crossovers: ['one-point', 'uniform', 'blx-alpha', 'arithmetic'], mutation: { enabled: true, mode: 'per-gene', probability: 0.4, sigma: 0.1 } },
  { representation: 'plain', crossovers: ['one-point', 'two-point', 'uniform'], mutation: { enabled: true, mode: 'per-gene', probability: 0.05 } },
  { representation: 'gray', crossovers: ['one-point', 'two-point', 'uniform'], mutation: { enabled: true, mode: 'per-gene', probability: 0.05 } },
];

const problemOf = (representation: LandscapeRepresentation, fn: LandscapeFunction = 'two-peaks', bitsPerVariable = 8) =>
  landscapeProblem({ function: fn, representation, bitsPerVariable });

const baseParams = (s: Setting): GaParams => ({
  selection: { method: 'tournament', size: 2 },
  crossover: { enabled: true, operator: s.crossovers[0]!, probability: 0.8 },
  mutation: s.mutation,
  elites: 0,
  stop: { generationLimit: 60 },
});

const make = (s: Setting, o: { fn?: LandscapeFunction; init?: GaSetup['init']; params?: Partial<GaParams>; seed?: number; eventCacheSize?: number } = {}) => {
  const setup: GaSetup = { problem: problemOf(s.representation, o.fn), init: o.init ?? { kind: 'random', size: 12 } };
  return createRun(gaAlgorithm, { setup, params: { ...baseParams(s), ...o.params }, seed: o.seed ?? 5 }, { eventCacheSize: o.eventCacheSize });
};

describe.each(settings)('$representation: a seeded landscape run is the same run however it is advanced', (s) => {
  const advance = (how: (r: ReturnType<typeof make>) => void, eventCacheSize: number, operator = s.crossovers[0]!) => {
    const run = make(s, { seed: 21, eventCacheSize, params: { crossover: { enabled: true, operator, probability: 0.9 } } });
    while (run.lastCycle < 6) how(run);
    return Array.from({ length: 7 }, (_, c) => ({ snapshot: run.snapshot(c), events: run.events(c) }));
  };

  test.each(s.crossovers)('%s: micro-steps, stages, generations and run-until agree, and regenerated events equal live ones', (operator) => {
    const byMicro = advance((r) => r.forwardMicro(), 0, operator);
    expect(advance((r) => r.forwardStage(), 0, operator)).toEqual(byMicro);
    expect(advance((r) => r.forwardCycle(), 100, operator)).toEqual(byMicro);
    const until = make(s, { seed: 21, eventCacheSize: 0, params: { crossover: { enabled: true, operator, probability: 0.9 } } });
    until.runUntil((state) => state.cycle === 6);
    expect(Array.from({ length: 7 }, (_, c) => ({ snapshot: until.snapshot(c), events: until.events(c) }))).toEqual(byMicro);
  });

  test.each(['slow', 'medium', 'fast', 'maximum'] as const)('playback at the %s tier makes the identical run', (tier) => {
    const reference = make(s, { seed: 21, eventCacheSize: 0 });
    while (reference.lastCycle < 6) reference.forwardCycle();
    const run = make(s, { seed: 21, eventCacheSize: 0 });
    const scheduler = createFakeScheduler();
    const playback = createPlayback(run, { scheduler });
    playback.setTier(tier);
    playback.play();
    for (let n = 0; n < 100_000 && run.lastCycle < 6 && scheduler.fire(); n++);
    playback.pause();
    expect(run.lastCycle).toBeGreaterThanOrEqual(6);
    for (let c = 0; c <= 6; c++) {
      expect(run.snapshot(c)).toEqual(reference.snapshot(c));
      expect(run.events(c)).toEqual(reference.events(c));
    }
  });

  test('the events alone reproduce every population, with elites and truncation too', () => {
    for (const params of [{}, { elites: 2 }, { elites: 1, truncation: { enabled: true, lambda: 14 } }]) {
      const run = make(s, { seed: 8, eventCacheSize: 0, params });
      run.runUntil((state) => state.cycle === 8);
      for (let c = 1; c <= 8; c++) {
        expect(populationFromEvents(run.snapshot(c - 1).state.population, run.events(c))).toEqual(run.snapshot(c).state.population);
      }
    }
  });

  test('every individual of every generation is inside the bounds, scored by the function, and knows its point', () => {
    for (const fn of landscapeFunctions) {
      const problem = problemOf(s.representation, fn);
      const { lo, hi } = landscapeFunctionInfo[fn].bounds;
      const run = make(s, { fn, seed: 13, params: { elites: 1 } });
      run.runUntil((state) => state.cycle === 6);
      for (let c = 0; c <= 6; c++) {
        for (const i of run.snapshot(c).state.population) {
          const { x, y } = problem.pointOf(i.chromosome);
          expect(i.values).toEqual([x, y]);
          for (const v of [x, y]) {
            expect(v).toBeGreaterThanOrEqual(lo);
            expect(v).toBeLessThanOrEqual(hi);
          }
          expect(i.fitness).toBe(problem.fitnessAt(x, y));
          expect(i.chromosome).toHaveLength(problem.chromosomeLength);
          if (s.representation === 'real') expect(i.chromosome).toEqual([x, y]);
          else expect(i.chromosome.every((g) => g === 0 || g === 1)).toBe(true);
        }
      }
    }
  });
});

describe.each(settings)('$representation: the operators', (s) => {
  test.each(s.crossovers)('%s crossover with per-gene and per-individual mutation runs and keeps the population valid', (operator) => {
    for (const mode of ['per-gene', 'per-individual'] as const) {
      const run = make(s, { seed: 3, params: { crossover: { enabled: true, operator, probability: 0.9 }, mutation: { ...s.mutation, mode, probability: 0.5 } } });
      run.runUntil((state) => state.cycle === 5);
      for (let c = 1; c <= 5; c++) {
        const events = run.events(c);
        expect(events.some((e) => e.stage === 'crossover' && e.operator === operator && e.decision === 'recombined')).toBe(true);
        expect(run.snapshot(c).state.population).toHaveLength(12);
      }
    }
  });

  test('crossover off and mutation off are recorded bypasses of copies; selection still runs', () => {
    const run = make(s, { seed: 2, params: { crossover: { enabled: false, operator: s.crossovers[0]!, probability: 0.8 }, mutation: { ...s.mutation, enabled: false } } });
    run.forwardCycle();
    const events = run.events(1);
    const crossovers = events.flatMap((e) => (e.stage === 'crossover' ? [e] : []));
    expect(crossovers.length).toBeGreaterThan(0);
    expect(crossovers.every((e) => e.decision === 'bypassed' && e.reason === 'switched-off' && !('draw' in e))).toBe(true);
    const mutations = events.flatMap((e) => (e.stage === 'mutation' ? [e] : []));
    expect(mutations.every((e) => e.decision === 'bypassed' && e.after.join() === e.before.join())).toBe(true);
    expect(events.some((e) => e.stage === 'selection')).toBe(true);
    // with both off every offspring is a copy of a parent: nothing new in the population
    const parents = new Set(run.snapshot(0).state.population.map((i) => i.chromosome.join(',')));
    for (const i of run.snapshot(1).state.population) expect(parents.has(i.chromosome.join(','))).toBe(true);
  });

  test('size, elites, truncation and the odd mating pool behave as for the other problems', () => {
    const run = make(s, { seed: 4, params: { elites: 2 }, init: { kind: 'random', size: 9 } });
    run.runUntil((state) => state.cycle === 12);
    for (let c = 1; c <= 12; c++) {
      expect(run.snapshot(c).state.population).toHaveLength(9);
      const replacement = run.events(c).find((e) => e.stage === 'replacement')!;
      expect('elites' in replacement && replacement.elites).toHaveLength(2);
    }
    const truncated = make(s, { seed: 6, params: { elites: 1, truncation: { enabled: true, lambda: 10 } }, init: { kind: 'random', size: 8 } });
    truncated.forwardCycle();
    const replacement = truncated.events(1).find((e) => e.stage === 'replacement')!;
    if (replacement.stage !== 'replacement') throw new Error('unreachable');
    expect(replacement.population).toHaveLength(8);
    expect(replacement.ranking!.filter((r) => r.kept)).toHaveLength(7);
    const odd = make(s, { seed: 3, params: { elites: 1 }, init: { kind: 'random', size: 6 } });
    odd.forwardCycle();
    const pairs = odd.events(1).flatMap((e) => (e.stage === 'crossover' ? [e] : []));
    expect(pairs).toHaveLength(3);
    expect(pairs[2]!.children[1]!.discarded).toBe(true);
  });

  test('children never share a chromosome array with their parents', () => {
    const run = make(s, { seed: 12, params: { crossover: { enabled: true, operator: s.crossovers[s.crossovers.length - 1]!, probability: 1 } } });
    run.forwardCycle();
    const parents = run.snapshot(0).state.population.map((i) => i.chromosome);
    for (const e of run.events(1)) if (e.stage === 'crossover') for (const child of e.children) expect(parents.every((p) => p !== child.chromosome)).toBe(true);
  });
});

describe('real-valued runs at the bounds', () => {
  const real = settings[0]!;

  test('a mutation step beyond a bound is clamped, recorded, and the individual stays on the bound', () => {
    const run = make(real, {
      fn: 'single-peak',
      seed: 5,
      init: { kind: 'explicit', chromosomes: ['4.95 4.95', '-4.95 -4.95', '4.9 -4.9', '-4.9 4.9'] },
      params: { crossover: { enabled: false, operator: 'one-point', probability: 0 }, mutation: { enabled: true, mode: 'per-gene', probability: 1, sigma: 0.5 }, elites: 0 },
    });
    run.runUntil((state) => state.cycle === 4);
    let clamped = 0;
    for (let c = 1; c <= 4; c++) {
      for (const e of run.events(c)) {
        if (e.stage !== 'mutation' || !e.gaussian) continue;
        for (const step of e.gaussian) {
          expect(step.after).toBeGreaterThanOrEqual(-5);
          expect(step.after).toBeLessThanOrEqual(5);
          if (step.clamped) {
            clamped++;
            expect(Math.abs(step.after)).toBe(5);
          }
        }
      }
      for (const i of run.snapshot(c).state.population) expect(i.chromosome.every((x) => x >= -5 && x <= 5)).toBe(true);
    }
    expect(clamped).toBeGreaterThan(0);
  });

  test('BLX-α with a wide α near a bound is clamped, recorded, and every child is inside the bounds', () => {
    const run = make(real, {
      fn: 'single-peak',
      seed: 7,
      init: { kind: 'explicit', chromosomes: ['4.5 4.5', '5 5', '-5 -4.5', '-4.5 -5'] },
      params: { crossover: { enabled: true, operator: 'blx-alpha', probability: 1, alpha: 2 }, mutation: { ...real.mutation, enabled: false } },
    });
    run.runUntil((state) => state.cycle === 3);
    let clamped = 0;
    for (let c = 1; c <= 3; c++) {
      for (const e of run.events(c)) if (e.stage === 'crossover') for (const child of e.children) clamped += (child.clamped ?? []).filter(Boolean).length;
      for (const i of run.snapshot(c).state.population) expect(i.chromosome.every((x) => x >= -5 && x <= 5)).toBe(true);
    }
    expect(clamped).toBeGreaterThan(0);
  });
});

describe('the decoded diversity and the spread, in both representations', () => {
  /** An independent computation: the mean pairwise distance of the points scaled to the bounds, over the diagonal; the standard deviations over each range. */
  const direct = (points: readonly (readonly [number, number])[], lo: number, hi: number) => {
    const range = hi - lo;
    let total = 0;
    let pairs = 0;
    for (let a = 0; a < points.length; a++) {
      for (let b = a + 1; b < points.length; b++) {
        total += Math.hypot((points[a]![0] - points[b]![0]) / range, (points[a]![1] - points[b]![1]) / range);
        pairs++;
      }
    }
    const sd = (k: 0 | 1) => {
      const mean = points.reduce((sum, p) => sum + p[k], 0) / points.length;
      return Math.sqrt(points.reduce((sum, p) => sum + (p[k] - mean) ** 2, 0) / points.length) / range;
    };
    return { diversity: pairs === 0 ? 0 : total / pairs / Math.SQRT2, spread: [sd(0), sd(1)] };
  };

  test.each(['real', 'plain', 'gray'] as const)('%s: the metrics equal a direct computation in every generation of a run', (representation) => {
    const s = settings.find((x) => x.representation === representation)!;
    const problem = problemOf(representation, 'rastrigin');
    const run = make(s, { fn: 'rastrigin', seed: 17, init: { kind: 'random', size: 15 } });
    run.runUntil((state) => state.cycle === 8);
    for (let c = 0; c <= 8; c++) {
      const state = run.snapshot(c).state;
      const m = metricsOfProblem(state, problem);
      const want = direct(state.population.map((i) => [i.values![0]!, i.values![1]!] as const), -5.12, 5.12);
      expect(m.decoded!.diversity).toBeCloseTo(want.diversity, 12);
      expect(m.decoded!.spread[0]).toBeCloseTo(want.spread[0]!, 12);
      expect(m.decoded!.spread[1]).toBeCloseTo(want.spread[1]!, 12);
    }
  });

  test('worked cases: opposite corners, one point, identical points', () => {
    const corners = startRun(problemOf('real', 'single-peak'), { kind: 'explicit', chromosomes: ['-5 -5', '5 5'] }, createRng(1)).state;
    const m = metricsOfProblem(corners, problemOf('real', 'single-peak'));
    expect(m.decoded!.diversity).toBeCloseTo(1, 12);
    expect(m.decoded!.spread).toEqual([0.5, 0.5]); // a standard deviation of 5 over a range of 10
    const one = startRun(problemOf('real', 'single-peak'), { kind: 'explicit', chromosomes: ['1 2'] }, createRng(1)).state;
    expect(metricsOfProblem(one, problemOf('real', 'single-peak')).decoded).toEqual({ diversity: 0, spread: [0, 0] });
    const same = startRun(problemOf('real', 'single-peak'), { kind: 'explicit', chromosomes: ['1 2', '1 2', '1 2'] }, createRng(1)).state;
    expect(metricsOfProblem(same, problemOf('real', 'single-peak')).decoded).toEqual({ diversity: 0, spread: [0, 0] });
  });

  test('binary-coded: decoded diversity differs from Hamming diversity, which is kept as the metrics’ diversity (the plain-binary cliff)', () => {
    // x = 0111 and 1000 are adjacent values (7 and 8 of 15), but every bit of x differs; y is 0000 in both
    const plain = problemOf('plain', 'single-peak', 4);
    const state = startRun(plain, { kind: 'explicit', chromosomes: ['01110000', '10000000'] }, createRng(1)).state;
    const m = metricsOfProblem(state, plain);
    expect(m.diversity).toBe(4 / 8); // Hamming: 4 bits of 8
    expect(m.decoded!.diversity).toBeCloseTo((10 / 15 / 10) / Math.SQRT2, 12); // a step of one value
    // the same two values in Gray code are one bit apart
    const gray = problemOf('gray', 'single-peak', 4);
    const gs = startRun(gray, { kind: 'explicit', chromosomes: ['01000000', '11000000'] }, createRng(1)).state;
    const g = metricsOfProblem(gs, gray);
    expect(g.diversity).toBe(1 / 8);
    expect(g.decoded!.diversity).toBeCloseTo(m.decoded!.diversity, 12);
  });

  test('for a real problem the metrics’ diversity is the decoded diversity, and symbol counts are absent', () => {
    const problem = problemOf('real', 'himmelblau');
    const state = startRun(problem, { kind: 'random', size: 10 }, createRng(2)).state;
    const m = metricsOfProblem(state, problem);
    expect(m.diversity).toBe(m.decoded!.diversity);
    expect(m.symbolCounts).toEqual([]);
  });

  test('asking again returns the same object, and the other problems carry no decoded metrics', () => {
    const problem = problemOf('gray', 'two-peaks');
    const state = startRun(problem, { kind: 'random', size: 6 }, createRng(2)).state;
    expect(metricsOfProblem(state, problem)).toBe(metricsOfProblem(state, problem));
    const g = startRun(goldberg, { kind: 'random', size: 6 }, createRng(2)).state;
    expect(metricsOfProblem(g, goldberg).decoded).toBeUndefined();
    expect(metricsOfProblem(g, goldberg)).toEqual(metricsOf(g, 2));
  });
});

describe('the stop criterion within ε of the optimum', () => {
  test('each function’s fitness range runs from its worst fitness to the known optimum, as a fine brute-force grid confirms', () => {
    for (const fn of landscapeFunctions) {
      const p = problemOf('real', fn);
      const { lo, hi } = landscapeFunctionInfo[fn].bounds;
      let worst = Infinity;
      let best = -Infinity;
      const n = 1200;
      for (let i = 0; i <= n; i++) {
        for (let j = 0; j <= n; j++) {
          const f = p.fitnessAt(lo + ((hi - lo) * i) / n, lo + ((hi - lo) * j) / n);
          if (f < worst) worst = f;
          if (f > best) best = f;
        }
      }
      const range = landscapeFitnessRange(p);
      expect(range.max).toBe(p.knownOptimumFitness);
      expect(range.max).toBeGreaterThanOrEqual(best - 1e-12);
      expect(range.min).toBeLessThanOrEqual(worst + 1e-12);
      expect(range.min).toBeGreaterThan(worst - 1e-4 * (best - worst)); // the refined worst is a hair below the grid's, no more
    }
  });

  test('the worst fitness is found to high accuracy: at a corner for three functions, between grid points for Rastrigin', () => {
    expect(landscapeFitnessRange(problemOf('real', 'single-peak')).min).toBeCloseTo(Math.exp(-85 / 8), 14); // the corner (−5, 5)
    expect(landscapeFitnessRange(problemOf('real', 'himmelblau')).min).toBe(-890); // the corner (5, 5): 19² + 23²
    // Rastrigin is separable, so its worst point is twice the worst of one variable: a dense one-dimensional scan finds it
    let gMax = -Infinity;
    for (let i = 0; i <= 4_000_000; i++) {
      const x = -5.12 + (10.24 * i) / 4_000_000;
      gMax = Math.max(gMax, x * x - 10 * Math.cos(2 * Math.PI * x));
    }
    expect(landscapeFitnessRange(problemOf('real', 'rastrigin')).min).toBeCloseTo(-(20 + 2 * gMax), 9);
    expect(landscapeFitnessRange(problemOf('real', 'two-peaks')).min).toBeGreaterThan(0);
    expect(landscapeFitnessRange(problemOf('real', 'two-peaks')).min).toBeLessThan(1e-5);
  });

  test('the default ε is 1e-3 of the fitness range, the same for every representation', () => {
    for (const fn of landscapeFunctions) {
      const r = landscapeFitnessRange(problemOf('real', fn));
      expect(landscapeDefaultEpsilon(problemOf('real', fn))).toBe(1e-3 * (r.max - r.min));
      expect(landscapeDefaultEpsilon(problemOf('gray', fn))).toBe(landscapeDefaultEpsilon(problemOf('real', fn)));
    }
    expect(landscapeDefaultEpsilon(problemOf('real', 'himmelblau'))).toBeGreaterThan(0.5); // a range of about 890
    expect(landscapeDefaultEpsilon(problemOf('real', 'single-peak'))).toBeCloseTo(1e-3, 4);
  });

  test('the target fitness is the optimum minus ε, and ε must be a number greater than 0', () => {
    const p = problemOf('real', 'single-peak');
    expect(landscapeTargetFitness(p, 0.01)).toBe(1 - 0.01);
    expect(landscapeTargetFitness(problemOf('real', 'himmelblau'), 0.5)).toBe(-0.5);
    for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) expect(validateEpsilon(bad)).toEqual(['ε must be a number greater than 0.']);
    expect(validateEpsilon(1e-3)).toEqual([]);
    expect(() => landscapeTargetFitness(p, 0)).toThrow('ε must be a number greater than 0.');
  });

  test('the stop fires exactly when the best fitness is within ε of the optimum, never otherwise', () => {
    const p = problemOf('real', 'single-peak');
    const at = (x: number, y: number) => startRun(p, { kind: 'explicit', chromosomes: [`${x} ${y}`, '-5 5'] }, createRng(1)).state;
    const state = at(2.1, -1); // fitness exp(−0.01 / 8)
    const gap = 1 - state.population[0]!.fitness;
    const stop = (epsilon: number) => stopReasons(state, { generationLimit: 50, targetFitness: landscapeTargetFitness(p, epsilon) });
    expect(stop(gap * 1.001)).toContain('target-reached');
    expect(stop(gap * 0.999)).not.toContain('target-reached');
    expect(stop(gap * 10)).toContain('target-reached');
    expect(stop(gap / 10)).not.toContain('target-reached');
    // the optimum itself is always within any ε
    expect(stopReasons(at(2, -1), { generationLimit: 50, targetFitness: landscapeTargetFitness(p, 1e-9) })).toContain('target-reached');
  });

  test('it holds in a run for every representation: the criterion appears in the generation whose best-so-far first comes within ε', () => {
    for (const s of settings) {
      const p = problemOf(s.representation, 'single-peak', 10);
      const epsilon = 0.02;
      const run = make(s, { fn: 'single-peak', seed: 3, params: { stop: { generationLimit: 60, targetFitness: landscapeTargetFitness(p, epsilon) }, elites: 1 } });
      const result = run.runUntil((state) => state.stops.length > 0);
      expect(result.reason).toBe('condition');
      for (let c = 0; c <= run.lastCycle; c++) {
        const best = metricsOfProblem(run.snapshot(c).state, p).bestSoFar;
        const within = 1 - best <= epsilon;
        expect(run.snapshot(c).stops.includes('target-reached')).toBe(within);
      }
    }
  });

  test('the other problems’ stops are unchanged: the target is still reached by being at least the target', () => {
    const state = startRun(goldberg, { kind: 'explicit', chromosomes: ['11111', '00000'] }, createRng(1)).state;
    expect(stopReasons(state, { generationLimit: 5, targetFitness: 961 })).toContain('target-reached');
    expect(stopReasons(state, { generationLimit: 5, targetFitness: 962 })).not.toContain('target-reached');
  });
});
