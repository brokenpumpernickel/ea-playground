import { metricsOfProblem, type GaEvent, type GaParams, type GaSetup, type RunState } from '../engine';
import type { Run } from '../run';
import { num } from './format';

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
  /** The TSP: the fitness of the nearest-neighbour tour, a second reference line beside the optimum's (it is never above it). */
  readonly nearest?: number;
  /** The TSP: how a fitness is written on the axis and in the labels (grouped digits, a real minus). */
  readonly format?: (value: number) => string;
  /** True when the axis labels are wide (the TSP's), and the margin on the left grows to hold them. */
  readonly wideAxis?: boolean;
}

/** What the TSP adds to the fitness plot: where the nearest-neighbour tour lies and how a fitness is written. */
export interface TourPlotExtras {
  readonly nearest: number;
  readonly format: (value: number) => string;
}

/**
 * The box the fitness plot draws in, in the plot's own units: the left margin holds the widest tick label, `top` is where the
 * cursor's line starts and `dataTop` where the top of the axis lies. A tour plot's axis ends at 0 and its optimum line can lie
 * just under it, so its axis starts 18 below `top`, which leaves the optimum's label room above its line.
 */
export function fitnessPlotBox(model: Pick<PlotModel, 'wideAxis' | 'yTicks' | 'format'>): { left: number; right: number; top: number; dataTop: number; bottom: number } {
  const widest = model.wideAxis && model.format && model.yTicks ? Math.max(...model.yTicks.map((v) => model.format!(v).length)) : 0;
  return { left: model.wideAxis ? Math.max(66, 20 + widest * 11.5) : 66, right: 780, top: 28, dataTop: model.wideAxis ? 46 : 28, bottom: 138 };
}

/** The sentence that says what the fitness plot shows at its cursor, for the screen reader and for the simplified graph of the focus view. */
export function fitnessSummary(model: PlotModel): string {
  const fmt = (value: number) => (model.format ? model.format(value) : num(value));
  const at = model.points[Math.min(model.now, model.points.length - 1)]!;
  const feasible = model.feasibleLine ? `, best feasible so far ${at.feasibleBestSoFar === null || at.feasibleBestSoFar === undefined ? 'none yet' : num(at.feasibleBestSoFar)}` : '';
  const zeros = model.attractor !== undefined ? ` All zeros scores ${num(model.attractor)}.` : '';
  const lines = model.nearest !== undefined ? ` Optimum ${fmt(model.optimum!)}, nearest neighbour ${fmt(model.nearest)}.` : '';
  return `Fitness by generation, scale ${fmt(model.yMin)} to ${fmt(model.yMax)}. Generation ${at.generation}: average ${fmt(at.average)}, best of generation ${fmt(at.best)}, best so far ${fmt(at.bestSoFar)}${feasible}.${zeros}${lines}`;
}

/**
 * The baselines of the labels of the optimum's line and the nearest-neighbour line (16 px type): the optimum's above its line,
 * the nearest neighbour's below its line. The nearest-neighbour tour is never shorter than the optimum, so its line is never
 * above the optimum's and the two labels, one outside each line, cannot meet however close the lines are. With no room above
 * the top of the picture the first goes below its line, with no room below the bottom the second goes above its line.
 */
export function referenceLabels(optimumY: number, nearestY: number): { optimum: number; nearest: number } {
  const { top, bottom } = fitnessPlotBox({} as never);
  let optimum = optimumY - 6;
  if (optimum - 16 < top - 4) optimum = optimumY + 20;
  let nearest = nearestY + 20;
  if (nearest + 4 > bottom + 2) nearest = nearestY - 6;
  return { optimum, nearest };
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

export function plotModel(run: Run<GaSetup, GaParams, RunState, GaEvent>, now: number, optimum: number | undefined, feasibleLine = false, attractor?: number, tour?: TourPlotExtras): PlotModel {
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
  const bottom = Math.min(optimum ?? 0, tour?.nearest ?? 0, ...points.map((p) => p.min));
  // a fitness that can be negative gets a floor at the next nice value below it, and the top is the nice ceiling above, or 0;
  // under a nearest-neighbour line there is a quarter more, so that its label has room below the line
  const yMin = bottom < 0 ? -niceCeiling(-bottom * (tour ? 1.25 : 1)) : 0;
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
    ...(tour ? { nearest: tour.nearest, format: tour.format, wideAxis: true } : {}),
  };
}
