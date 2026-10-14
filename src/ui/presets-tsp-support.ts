import { createRng, runGeneration, startRun, tspProblem, type GaParams, type GenerationConfig, type TspOptions, type TspProblem } from '../engine';
import { presets, type Preset } from './presets';

/** Helpers of the tests of the TSP presets: a preset by the end of its file name, and a quick run of the engine's own loop. */
export const tspPreset = (suffix: string): Preset => presets.find((p) => p.problem === 'tsp' && p.id.endsWith(suffix))!;
export const optionsOf = (preset: Preset): TspOptions => preset.options as TspOptions;

export interface Trace {
  readonly problem: TspProblem;
  /** The best fitness of each generation's population (generation 0 is the starting population). */
  readonly best: readonly number[];
  /** The best fitness any generation has had by this one. */
  readonly sofar: readonly number[];
  /** The first generation whose population ended a stop condition, with the reasons. */
  readonly stop: { readonly generation: number; readonly reasons: readonly string[] } | null;
  /** The gap (a fraction of the optimum) of the best so far at each generation. */
  readonly gap: (generation: number) => number;
  /** The first generation at which the best so far is the optimum, or null. */
  readonly firstOptimum: number | null;
  /** The last generation at which the best so far improved. */
  readonly lastImprovement: number;
}

export type Override = { params?: Partial<GaParams>; crossover?: Partial<GaParams['crossover']>; mutation?: Partial<GaParams['mutation']>; stop?: Partial<GaParams['stop']>; seed?: number };

/** Runs the preset's configuration (with changes) for `generations` generations, on the engine's own loop, with the preset's seed unless told another. */
export function trace(preset: Preset, generations: number, override: Override = {}): Trace {
  const problem = tspProblem(optionsOf(preset));
  const params: GaParams = {
    ...preset.params,
    ...override.params,
    crossover: { ...preset.params.crossover, ...override.crossover },
    mutation: { ...preset.params.mutation, ...override.mutation },
    stop: { ...preset.params.stop, ...override.stop, generationLimit: generations },
  };
  const rng = createRng(override.seed ?? preset.seed);
  const size = preset.setup.init.kind === 'random' ? preset.setup.init.size : 20;
  const config: GenerationConfig = { problem, ...params };
  let { state } = startRun(problem, { kind: 'random', size }, rng);
  const best = [Math.max(...state.population.map((i) => i.fitness))];
  const sofar = [best[0]!];
  let stop: Trace['stop'] = null;
  for (let g = 1; g <= generations; g++) {
    const r = runGeneration(state, config, rng);
    state = r.state;
    const b = Math.max(...state.population.map((i) => i.fitness));
    best.push(b);
    sofar.push(Math.max(sofar[g - 1]!, b));
    if (stop === null && r.stops.length > 0) stop = { generation: g, reasons: r.stops };
  }
  const optimum = problem.instance.optimum;
  const gap = (g: number) => (0 - sofar[g]! - optimum) / optimum;
  const firstOptimum = sofar.findIndex((f) => (0 - f - optimum) / optimum < 5e-12);
  const lastImprovement = sofar.reduce((last, f, g) => (g > 0 && f > sofar[g - 1]! ? g : last), 0);
  return { problem, best, sofar, stop, gap, firstOptimum: firstOptimum < 0 ? null : firstOptimum, lastImprovement };
}

export const seeds = (n = 30) => Array.from({ length: n }, (_, k) => k + 1);
export const pct = (fraction: number, digits = 1) => Number((fraction * 100).toFixed(digits));
export const median = (xs: readonly number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const k = s.length;
  return k % 2 ? s[(k - 1) / 2]! : (s[k / 2 - 1]! + s[k / 2]!) / 2;
};
/** In how many of the seeds `a`'s gap is smaller than `b`'s at a generation, and in how many larger. */
export function compare(a: readonly Trace[], b: readonly Trace[], generation: number): { ahead: number; behind: number } {
  let ahead = 0;
  let behind = 0;
  a.forEach((t, k) => {
    const x = t.gap(generation);
    const y = b[k]!.gap(generation);
    if (x < y - 1e-12) ahead++;
    else if (x > y + 1e-12) behind++;
  });
  return { ahead, behind };
}
