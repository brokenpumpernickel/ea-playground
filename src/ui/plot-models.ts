import { metricsOfProblem, type GaEvent, type GaParams, type GaSetup, type RunState } from '../engine';
import type { Run } from '../run';

/**
 * The data the plots draw: one point per recorded generation, read from the engine's metrics, plus the axes.
 * The axes depend on the problem and on how long the run is, never on the cursor, so scrubbing never rescales a plot.
 */
export interface PlotPoint {
  readonly generation: number;
  readonly average: number;
  /** The worst and best fitness in the generation, the edges of the band. */
  readonly min: number;
  readonly max: number;
  /** Best of this generation's population (equal to `max`) and best of any generation so far. */
  readonly best: number;
  readonly bestSoFar: number;
  /** Only for a problem that can have infeasible individuals: the best feasible fitness so far (null until there is one). */
  readonly feasibleBestSoFar?: number | null;
  /** The diversity plotted: Hamming for the binary problems, the mean distance in decoded space (0 to 1) for the landscape. */
  readonly diversity: number;
  /** Binary-coded landscape only: the Hamming diversity, a second line beside the decoded one. */
  readonly hamming?: number;
  /** Landscape only: the standard deviation of x and of y over the population, each as a share of its range. */
  readonly spread?: readonly number[];
  readonly distinct: number;
  readonly alleleFrequencies: readonly number[];
  /** After the cursor: still plotted, but dimmed. */
  readonly future: boolean;
}

export interface PlotModel {
  readonly points: readonly PlotPoint[];
  /** The generation the cursor is on (the one the summary describes). */
  readonly now: number;
  readonly xMax: number;
  readonly xTicks: readonly number[];
  /** The bottom of the fitness axis: 0, or below it for a fitness that can be negative (the minimised landscapes' −f). */
  readonly yMin: number;
  readonly yMax: number;
  readonly yTicks: readonly number[];
  /** The best fitness any solution can have, when known; drawn as a reference line. */
  readonly optimum?: number;
  /** What all zeros scores, for the trap: drawn as a second reference line, dashed differently from the optimum's. */
  readonly attractor?: number;
  /** True when the plot has a line for the best feasible fitness so far. */
  readonly feasibleLine?: boolean;
  /** True when the diversity plot has a second line, the Hamming diversity (binary-coded landscape). */
  readonly hammingLine?: boolean;
}

const niceSteps = [1, 2, 4, 8, 10];

/** The smallest of 1, 2, 4, 8 (times a power of ten) that is at least `value`, so quarter ticks land on round numbers. */
export function niceCeiling(value: number): number {
  if (!(value > 0)) return 1;
  const base = 10 ** Math.floor(Math.log10(value));
  for (const step of niceSteps) {
    const candidate = Number((step * base).toPrecision(12));
    if (candidate >= value) return candidate;
  }
  return base * 10;
}

const generationAxes = [15, 30, 50, 100, 200, 500, 1000, 2000];

export function plotModel(run: Run<GaSetup, GaParams, RunState, GaEvent>, now: number, optimum: number | undefined, feasibleLine = false, attractor?: number): PlotModel {
  const points = Array.from({ length: run.lastCycle + 1 }, (_, g): PlotPoint => {
    const m = metricsOfProblem(run.snapshot(g).state, run.setup.problem);
    return {
      generation: g,
      average: m.average,
      min: m.worst,
      max: m.best,
      best: m.best,
      bestSoFar: m.bestSoFar,
      ...(feasibleLine ? { feasibleBestSoFar: m.feasible?.bestSoFar ?? null } : {}),
      diversity: m.decoded?.diversity ?? m.diversity,
      ...(m.decoded && m.alleleFrequencies.length > 0 ? { hamming: m.diversity } : {}),
      ...(m.decoded ? { spread: m.decoded.spread } : {}),
      distinct: m.distinct,
      alleleFrequencies: m.alleleFrequencies,
      future: g > now,
    };
  });
  const top = Math.max(optimum ?? 0, ...points.map((p) => p.max));
  const bottom = Math.min(optimum ?? 0, ...points.map((p) => p.min));
  // a fitness that can be negative gets a floor at the next nice value below it, and the top is the nice ceiling above, or 0
  const yMin = bottom < 0 ? -niceCeiling(-bottom) : 0;
  const yMax = top > 0 || yMin === 0 ? niceCeiling(top) : 0;
  const xMax = generationAxes.find((limit) => limit >= run.lastCycle) ?? Math.ceil(run.lastCycle / 1000) * 1000;
  return {
    points,
    now,
    xMax,
    xTicks: Array.from({ length: 6 }, (_, k) => (xMax / 5) * k),
    yMin,
    yMax,
    yTicks: Array.from({ length: 5 }, (_, k) => yMin + ((yMax - yMin) / 4) * k),
    ...(optimum !== undefined ? { optimum } : {}),
    ...(attractor !== undefined ? { attractor } : {}),
    ...(feasibleLine ? { feasibleLine } : {}),
    ...(points.some((p) => p.hamming !== undefined) ? { hammingLine: true } : {}),
  };
}
