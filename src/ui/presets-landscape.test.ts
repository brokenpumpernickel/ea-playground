import { describe, expect, test } from 'vitest';
import { gaAlgorithm, landscapeDefaultEpsilon, landscapeDefaults, landscapeFunctionInfo, landscapeProblem, metricsOfProblem, type GaEvent, type GaParams, type GaSetup, type LandscapeOptions, type RunState } from '../engine';
import { createRun, type Run } from '../run';
import { presets, type Preset } from './presets';

type GaRun = Run<GaSetup, GaParams, RunState, GaEvent>;
const landscape = (suffix: string): Preset => presets.find((p) => p.problem === 'landscape' && p.id.endsWith(suffix))!;
const optionsOf = (p: Preset) => p.options as LandscapeOptions;
const play = (preset: Preset, override: { params?: Partial<GaParams>; mutation?: Partial<GaParams['mutation']>; crossover?: Partial<GaParams['crossover']>; seed?: number; options?: Partial<LandscapeOptions> } = {}, generations = 100): { run: GaRun; problem: ReturnType<typeof landscapeProblem> } => {
  const options = { ...optionsOf(preset), ...override.options };
  const problem = landscapeProblem(options);
  const params = { ...preset.params, ...override.params, mutation: { ...preset.params.mutation, ...override.mutation }, crossover: { ...preset.params.crossover, ...override.crossover } } as GaParams;
  const init = { kind: 'random' as const, size: preset.setup.init.kind === 'random' ? preset.setup.init.size : 12 };
  const run = createRun(gaAlgorithm, { setup: { problem, init }, params, seed: override.seed ?? preset.seed }, { eventCacheSize: 0 });
  for (let g = 0; g < generations; g++) run.forwardCycle();
  return { run, problem };
};
const epsilonOf = (problem: ReturnType<typeof landscapeProblem>) => landscapeDefaultEpsilon(problem);
const firstEps = ({ run, problem }: ReturnType<typeof play>): number | null => {
  for (let g = 0; g <= run.lastCycle; g++) if (run.snapshot(g).state.bestFitnessSoFar! >= problem.knownOptimumFitness! - epsilonOf(problem)) return g;
  return null;
};
const firstStop = ({ run }: ReturnType<typeof play>): { generation: number; reasons: readonly string[] } | null => {
  for (let g = 1; g <= run.lastCycle; g++) if (run.snapshot(g).stops.length > 0) return { generation: g, reasons: run.snapshot(g).stops };
  return null;
};
const pointsAt = ({ run, problem }: ReturnType<typeof play>, g: number) => run.snapshot(g).state.population.map((i) => problem.pointOf(i.chromosome));
const bestAt = (r: ReturnType<typeof play>, g: number) => {
  const best = r.run.snapshot(g).state.population.reduce((b, i) => (i.fitness > b.fitness ? i : b));
  return r.problem.pointOf(best.chromosome);
};
const box = (r: ReturnType<typeof play>, g: number) => {
  const pts = pointsAt(r, g);
  return { x0: Math.min(...pts.map((p) => p.x)), x1: Math.max(...pts.map((p) => p.x)), y0: Math.min(...pts.map((p) => p.y)), y1: Math.max(...pts.map((p) => p.y)) };
};
const area = (r: ReturnType<typeof play>, g: number) => {
  const b = box(r, g);
  return (b.x1 - b.x0) * (b.y1 - b.y0);
};
/** In how many generations the box around the population is larger than the box around the one before it, on any side. */
const growths = (r: ReturnType<typeof play>): number => {
  let n = 0;
  for (let g = 1; g <= r.run.lastCycle; g++) {
    const a = box(r, g - 1);
    const b = box(r, g);
    if (b.x0 < a.x0 - 1e-12 || b.x1 > a.x1 + 1e-12 || b.y0 < a.y0 - 1e-12 || b.y1 > a.y1 + 1e-12) n++;
  }
  return n;
};
const diversityAt = (r: ReturnType<typeof play>, g: number) => {
  const m = metricsOfProblem(r.run.snapshot(g).state, r.problem);
  return m.decoded?.diversity ?? m.diversity;
};
const seeds = (n = 100) => Array.from({ length: n }, (_, k) => k + 1);
const count = (preset: Preset, test: (r: ReturnType<typeof play>) => boolean, override: Parameters<typeof play>[1] = {}): number => seeds().filter((seed) => test(play(preset, { ...override, seed }))).length;
const reached = (preset: Preset, override: Parameters<typeof play>[1] = {}) => count(preset, (r) => firstEps(r) !== null, override);
const near = (p: { x: number; y: number }, x: number, y: number, within: number) => Math.hypot(p.x - x, p.y - y) < within;

describe('the landscape preset files', () => {
  const all = presets.filter((p) => p.problem === 'landscape');

  test('there are ten, in the order of their file names, for the landscape only, each with a one-sentence lesson and a text that says what to look for', () => {
    expect(all.map((p) => p.name)).toEqual([
      'Single peak',
      'Two peaks: the broad hill',
      'Rastrigin: local minima',
      'Himmelblau: four optima',
      'Mutation too small',
      'Arithmetic crossover',
      'BLX-α with α = 0',
      'BLX-α with α = 0.5',
      'Plain binary, low mutation',
      'Gray code, low mutation',
    ]);
    for (const p of all) {
      expect(p.lesson.endsWith('.')).toBe(true);
      expect(p.lesson.slice(0, -1)).not.toMatch(/[.!?]\s/);
      expect(p.lookFor.length).toBeGreaterThan(120);
      expect(p.setup.init).toEqual({ kind: 'random', size: 12 });
    }
  });

  test('every preset is the measured default of its function and representation, except for the one thing its lesson changes', () => {
    const changed: Record<string, (p: GaParams) => GaParams> = {
      'single-peak': (p) => p,
      'two-peaks': (p) => p,
      'rastrigin': (p) => p,
      'himmelblau': (p) => p,
      'sigma-too-small': (p) => ({ ...p, mutation: { ...p.mutation, sigma: 0.005 } }),
      'arithmetic': (p) => ({ ...p, crossover: { enabled: true, operator: 'arithmetic', probability: 0.9 }, mutation: { ...p.mutation, enabled: false } }),
      'blx-zero': (p) => ({ ...p, crossover: { ...p.crossover, alpha: 0 } as GaParams['crossover'], mutation: { ...p.mutation, enabled: false } }),
      'blx-half': (p) => ({ ...p, mutation: { ...p.mutation, enabled: false } }),
      'plain': (p) => ({ ...p, mutation: { ...p.mutation, probability: 0.02 } }),
      'gray': (p) => ({ ...p, mutation: { ...p.mutation, probability: 0.02 } }),
    };
    for (const p of all) {
      const key = p.id.replace(/^[a-z]-landscape-/, '');
      expect(changed[key], p.id).toBeDefined();
      expect(p.params, p.id).toEqual(changed[key]!(landscapeDefaults(optionsOf(p)).params));
      expect(p.params.stop.targetEpsilon, p.id).toBe(epsilonOf(landscapeProblem(optionsOf(p))));
    }
  });

  test('each text states the figures the tests below pin for it', () => {
    const stated: Record<string, string[]> = {
      'single-peak': ['generation 10', '0.36 to 0.01', '0 to 27 generations (median 10)', '100 runs'],
      'two-peaks': ['(−2.5, −2.5)', '0.6', '0.02', '84 runs', '16 find'],
      'rastrigin': ['−0.995', '(0.00, −0.99)', '2 cells', '81 runs', '19 do not', 'generation 19'],
      'himmelblau': ['generation 8', '45 runs', '18 at', '9 at', '28 at', '(−2.81, 3.13)', '(−3.78, −3.28)', '(3.58, −1.85)'],
      'sigma-too-small': ['σ = 0.005', '−4.97', '(2, 1)', '0.002', 'generation 19', '13 runs', '81 with'],
      'arithmetic': ['generation 56', '0.976', '17 reach', '80 stop'],
      'blx-zero': ['generation 79', '−9.94', 'ε = 0.89', '37 runs', '66 with'],
      'blx-half': ['generation 6', '66 runs', '37 with'],
      'plain': ['generation 75', '0.881', '(2.00, 0.00)', '20 single-bit', '33 plain-binary'],
      'gray': ['generation 39', '(2, −1)', 'all 100', '33 plain-binary'],
    };
    for (const p of all) for (const figure of stated[p.id.replace(/^[a-z]-landscape-/, '')]!) expect(p.lookFor, p.id).toContain(figure);
  });

  test('the functions and representations are the ones the lessons name', () => {
    expect(all.map((p) => [optionsOf(p).function, optionsOf(p).representation])).toEqual([
      ['single-peak', 'real'],
      ['two-peaks', 'real'],
      ['rastrigin', 'real'],
      ['himmelblau', 'real'],
      ['rastrigin', 'real'],
      ['single-peak', 'real'],
      ['himmelblau', 'real'],
      ['himmelblau', 'real'],
      ['single-peak', 'plain'],
      ['single-peak', 'gray'],
    ]);
    expect(all.filter((p) => optionsOf(p).representation !== 'real').every((p) => optionsOf(p).bitsPerVariable === 10)).toBe(true);
  });
});

describe('Single peak', () => {
  const preset = landscape('single-peak');

  test('Run until stop pauses at generation 10, when the best so far is within ε of the optimum at (2, −1), and the diversity falls from 0.36 to 0.01 by then', () => {
    const r = play(preset);
    expect(firstEps(r)).toBe(10);
    expect(firstStop(r)).toEqual({ generation: 10, reasons: ['target-reached'] });
    const best = bestAt(r, 10);
    expect(near(best, 2, -1, 0.15)).toBe(true);
    expect(r.problem.knownOptimumFitness).toBe(1);
    expect(diversityAt(r, 0).toFixed(2)).toBe('0.36');
    expect(diversityAt(r, 10).toFixed(2)).toBe('0.01');
  });

  test('all 100 runs (seeds 1 to 100) reach the optimum, in 0 to 27 generations with a median of 10', () => {
    const gens = seeds().map((seed) => firstEps(play(preset, { seed }))!).sort((a, b) => a - b);
    expect(gens.every((g) => g !== null && g !== undefined)).toBe(true);
    expect([gens[0], gens[50], gens[99]]).toEqual([0, 10, 27]);
  }, 60000);
});

describe('Two peaks: the broad hill', () => {
  const preset = landscape('two-peaks');

  test('with this seed the best is on the broad hill at (−2.5, −2.5) with fitness 0.6 from generation 100 back, nothing better ever, and the diversity is 0.02', () => {
    const r = play(preset);
    expect(firstEps(r)).toBeNull();
    const best = bestAt(r, 100);
    expect(near(best, -2.5, -2.5, 0.01)).toBe(true);
    expect(r.run.snapshot(100).state.bestFitnessSoFar).toBeCloseTo(0.6, 5);
    expect(r.problem.knownOptimumFitness).toBeGreaterThan(0.999);
    expect(landscapeFunctionInfo['two-peaks'].optima[0]!.x).toBeCloseTo(2.9999, 3);
    expect(diversityAt(r, 100).toFixed(2)).toBe('0.02');
    expect(r.run.snapshot(100).stops).toEqual(['generation-limit']);
    expect(firstStop(r)).toEqual({ generation: 100, reasons: ['generation-limit'] });
  });

  test('over seeds 1 to 100, 84 runs end on the broad hill and 16 find the narrow one', () => {
    expect(count(preset, (r) => near(bestAt(r, 100), -2.5, -2.5, 1.5))).toBe(84);
    expect(reached(preset)).toBe(16);
  }, 60000);
});

describe('Rastrigin: local minima', () => {
  const preset = landscape('rastrigin');

  test('with this seed the best so far after 100 generations is −0.995 at (0.00, −0.99), never within ε, with the population in 2 cells of the grid of minima', () => {
    const r = play(preset);
    expect(firstEps(r)).toBeNull();
    expect(r.run.snapshot(100).state.bestFitnessSoFar).toBeCloseTo(-0.995, 3);
    const best = bestAt(r, 100);
    expect([best.x.toFixed(2), best.y.toFixed(2)]).toEqual(['0.00', '-0.99']);
    expect(new Set(pointsAt(r, 100).map((p) => `${Math.round(p.x)},${Math.round(p.y)}`)).size).toBe(2);
    expect(firstStop(r)).toEqual({ generation: 100, reasons: ['generation-limit'] });
  });

  test('over seeds 1 to 100, 81 runs reach ε and 19 do not, and seed 42 reaches it in generation 19', () => {
    expect(reached(preset)).toBe(81);
    expect(firstEps(play(preset, { seed: 42 }))).toBe(19);
  }, 60000);
});

describe('Himmelblau: four optima', () => {
  const preset = landscape('himmelblau');

  test('with this seed Run until stop pauses at generation 8, within ε of the optimum at (3, 2)', () => {
    const r = play(preset);
    expect(firstEps(r)).toBe(8);
    expect(firstStop(r)).toEqual({ generation: 8, reasons: ['target-reached'] });
    expect(near(bestAt(r, 8), 3, 2, 0.5)).toBe(true);
  });

  test('over seeds 1 to 100 all reach ε, and 45 end at (3, 2), 18 at (−2.81, 3.13), 9 at (−3.78, −3.28) and 28 at (3.58, −1.85)', () => {
    const optima = landscapeFunctionInfo.himmelblau.optima;
    expect([optima[0]!.x, optima[0]!.y].map((v) => Math.round(v))).toEqual([3, 2]);
    expect([optima[1]!.x.toFixed(2), optima[1]!.y.toFixed(2)]).toEqual(['-2.81', '3.13']);
    expect([optima[2]!.x.toFixed(2), optima[2]!.y.toFixed(2)]).toEqual(['-3.78', '-3.28']);
    expect([optima[3]!.x.toFixed(2), optima[3]!.y.toFixed(2)]).toEqual(['3.58', '-1.85']);
    expect(reached(preset)).toBe(100);
    const ends = [0, 0, 0, 0];
    for (const seed of seeds()) {
      const r = play(preset, { seed });
      const best = bestAt(r, 100);
      const k = optima.findIndex((o) => near(best, o.x, o.y, 1));
      expect(k).toBeGreaterThanOrEqual(0);
      ends[k]!++;
    }
    expect(ends).toEqual([45, 18, 9, 28]);
  }, 60000);
});

describe('Mutation too small', () => {
  const preset = landscape('sigma-too-small');

  test('with this seed the best so far after 100 generations is −4.97 at (2, 1), a local minimum, and the diversity is 0.002; with σ = 0.05 the same seed reaches the global minimum in generation 19', () => {
    expect(preset.params.mutation).toMatchObject({ sigma: 0.005 });
    const r = play(preset);
    expect(firstEps(r)).toBeNull();
    expect(r.run.snapshot(100).state.bestFitnessSoFar).toBeCloseTo(-4.97, 2);
    const best = bestAt(r, 100);
    expect([Math.round(best.x), Math.round(best.y)]).toEqual([2, 1]);
    expect(diversityAt(r, 100).toFixed(3)).toBe('0.002');
    expect(firstEps(play(preset, { mutation: { sigma: 0.05 } }))).toBe(19);
  });

  test('over seeds 1 to 100, 13 runs reach ε with σ = 0.005 against 81 with σ = 0.05', () => {
    expect(reached(preset)).toBe(13);
    expect(reached(preset, { mutation: { sigma: 0.05 } })).toBe(81);
  }, 60000);
});

describe('Arithmetic crossover', () => {
  const preset = landscape('arithmetic');

  test('mutation is off and the crossover is arithmetic', () => {
    expect(preset.params.mutation.enabled).toBe(false);
    expect(preset.params.crossover).toMatchObject({ enabled: true, operator: 'arithmetic' });
  });

  test('with this seed the box around the population never grows and shrinks to a point, and Run until stop pauses at generation 56 for stagnation with the best so far 0.976', () => {
    const r = play(preset);
    expect(growths(r)).toBe(0);
    expect(area(r, 20)).toBeLessThan(1e-3);
    expect(firstEps(r)).toBeNull();
    expect(firstStop(r)).toEqual({ generation: 56, reasons: ['stagnation'] });
    expect(r.run.snapshot(56).state.bestFitnessSoFar).toBeCloseTo(0.976, 3);
  });

  test('over seeds 1 to 100 the box never grows in any run, 17 runs reach ε and 80 pause for stagnation', () => {
    expect(count(preset, (r) => growths(r) === 0)).toBe(100);
    expect(reached(preset)).toBe(17);
    expect(count(preset, (r) => firstStop(r)?.reasons[0] === 'stagnation')).toBe(80);
  }, 120000);
});

describe('BLX-α with α = 0 and with α = 0.5', () => {
  const zero = landscape('blx-zero');
  const half = landscape('blx-half');

  test('mutation is off in both, and the two presets differ only in α', () => {
    expect(zero.params.mutation.enabled).toBe(false);
    expect(half.params.mutation.enabled).toBe(false);
    expect(zero.params.crossover).toMatchObject({ operator: 'blx-alpha', alpha: 0 });
    expect(half.params.crossover).toMatchObject({ operator: 'blx-alpha', alpha: 0.5 });
    expect({ ...zero.params, crossover: half.params.crossover }).toEqual(half.params);
    expect(zero.seed).toBe(half.seed);
    expect(zero.options).toEqual(half.options);
  });

  test('with α = 0 and this seed the box never grows and Run until stop pauses at generation 79 for stagnation with the best so far −9.94, outside ε = 0.89', () => {
    const r = play(zero);
    expect(growths(r)).toBe(0);
    expect(firstEps(r)).toBeNull();
    expect(firstStop(r)).toEqual({ generation: 79, reasons: ['stagnation'] });
    expect(r.run.snapshot(79).state.bestFitnessSoFar).toBeCloseTo(-9.94, 2);
    expect(zero.params.stop.targetEpsilon).toBe(0.89);
  });

  test('with α = 0.5 and the same seed the box grows in some generations and Run until stop pauses at generation 6, within ε', () => {
    const r = play(half);
    expect(growths(r)).toBeGreaterThan(0);
    expect(firstEps(r)).toBe(6);
    expect(firstStop(r)).toEqual({ generation: 6, reasons: ['target-reached'] });
  });

  test('over seeds 1 to 100, 37 runs reach ε with α = 0 against 66 with α = 0.5, and with α = 0 the box never grows in any run', () => {
    expect(reached(zero)).toBe(37);
    expect(reached(half)).toBe(66);
    expect(count(zero, (r) => growths(r) === 0)).toBe(100);
  }, 120000);
});

describe('Plain binary and Gray code with a low mutation rate', () => {
  const plain = landscape('plain');
  const gray = landscape('gray');

  test('the two presets differ only in the coding', () => {
    expect({ ...plain.options, representation: 'gray' }).toEqual(gray.options);
    expect(plain.params).toEqual(gray.params);
    expect(plain.seed).toBe(gray.seed);
    expect(plain.params.mutation).toMatchObject({ mode: 'per-gene', probability: 0.02 });
  });

  test('plain: Run until stop pauses at generation 75 for stagnation with the best so far 0.881 at (2.00, 0.00), and none of the 20 one-bit changes of the best individual is better', () => {
    const r = play(plain);
    expect(firstEps(r)).toBeNull();
    expect(firstStop(r)).toEqual({ generation: 75, reasons: ['stagnation'] });
    const state = r.run.snapshot(75).state;
    expect(state.bestFitnessSoFar).toBeCloseTo(0.881, 3);
    const best = state.population.reduce((b, i) => (i.fitness > b.fitness ? i : b));
    expect(best.fitness).toBe(state.bestFitnessSoFar);
    const point = r.problem.pointOf(best.chromosome);
    expect([point.x.toFixed(2), point.y.toFixed(2)]).toEqual(['2.00', '0.00']);
    expect(best.chromosome).toHaveLength(20);
    for (let k = 0; k < 20; k++) {
      const flipped = best.chromosome.map((b, j) => (j === k ? 1 - (b as number) : b)) as typeof best.chromosome;
      expect(r.problem.evaluate(flipped).fitness, `bit ${k}`).toBeLessThanOrEqual(best.fitness);
    }
  });

  test('Gray with the same seed: Run until stop pauses at generation 39, within ε of the optimum at (2, −1)', () => {
    const r = play(gray);
    expect(firstEps(r)).toBe(39);
    expect(firstStop(r)).toEqual({ generation: 39, reasons: ['target-reached'] });
    const best = bestAt(r, 39);
    expect(best.x).toBeCloseTo(2, 1);
    expect(best.y).toBeCloseTo(-1, 1);
  });

  test('over seeds 1 to 100, 33 plain-binary runs reach ε against all 100 Gray-coded ones', () => {
    expect(reached(plain)).toBe(33);
    expect(reached(gray)).toBe(100);
  }, 120000);
});
