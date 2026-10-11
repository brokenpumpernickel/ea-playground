import { metricsOf, type GaEvent, type GaParams, type GaSetup, type RunState } from '../engine';
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
  readonly diversity: number;
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
  readonly yMax: number;
  readonly yTicks: readonly number[];
  /** The best fitness any solution can have, when known; drawn as a reference line. */
  readonly optimum?: number;
  /** What all zeros scores, for the trap: drawn as a second reference line, dashed differently from the optimum's. */
  readonly attractor?: number;
  /** True when the plot has a line for the best feasible fitness so far. */
  readonly feasibleLine?: boolean;
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
    const m = metricsOf(run.snapshot(g).state, run.setup.problem.alphabet.length);
    return {
      generation: g,
      average: m.average,
      min: m.worst,
      max: m.best,
      best: m.best,
      bestSoFar: m.bestSoFar,
      ...(feasibleLine ? { feasibleBestSoFar: m.feasible?.bestSoFar ?? null } : {}),
      diversity: m.diversity,
      distinct: m.distinct,
      alleleFrequencies: m.alleleFrequencies,
      future: g > now,
    };
  });
  const top = Math.max(optimum ?? 0, ...points.map((p) => p.max));
  const yMax = niceCeiling(top);
  const xMax = generationAxes.find((limit) => limit >= run.lastCycle) ?? Math.ceil(run.lastCycle / 1000) * 1000;
  return {
    points,
    now,
    xMax,
    xTicks: Array.from({ length: 6 }, (_, k) => (xMax / 5) * k),
    yMax,
    yTicks: Array.from({ length: 5 }, (_, k) => (yMax / 4) * k),
    ...(optimum !== undefined ? { optimum } : {}),
    ...(attractor !== undefined ? { attractor } : {}),
    ...(feasibleLine ? { feasibleLine } : {}),
  };
}
