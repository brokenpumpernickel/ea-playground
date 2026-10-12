import { num } from './format';
import type { GenerationMetrics } from '../engine';
import type { PlotModel } from './plot-models';

/** The spread panel of the landscape's bottom strip: where the population is spread over each variable's range, now and over the run. */
export interface SpreadPanel {
  readonly generation: number;
  /** The standard deviation of x and of y at the cursor, each as a share of its range. */
  readonly now: { readonly x: number; readonly y: number };
  /** The bars' lengths, 0 to 1: the share on a scale of 0 to 0.5 (half the population on each bound is 0.5). */
  readonly bar: { readonly x: number; readonly y: number };
  /** Every generation up to the cursor. */
  readonly history: { readonly x: readonly number[]; readonly y: readonly number[] };
  /** The last six of those, with their generations, for the printed lines. */
  readonly recent: { readonly generations: readonly number[]; readonly x: readonly number[]; readonly y: readonly number[] };
}

export function spreadPanel(model: PlotModel): SpreadPanel | undefined {
  const upTo = model.points.filter((p) => p.generation <= model.now && p.spread !== undefined);
  if (upTo.length === 0) return undefined;
  const x = upTo.map((p) => p.spread![0]!);
  const y = upTo.map((p) => p.spread![1]!);
  const last = upTo[upTo.length - 1]!;
  return {
    generation: last.generation,
    now: { x: x[x.length - 1]!, y: y[y.length - 1]! },
    bar: { x: Math.min(1, x[x.length - 1]! / 0.5), y: Math.min(1, y[y.length - 1]! / 0.5) },
    history: { x, y },
    recent: { generations: upTo.slice(-6).map((p) => p.generation), x: x.slice(-6), y: y.slice(-6) },
  };
}

/** The two lines under the panel's bars: where the run is and the fitness figures, to three decimals so they fit. */
export const statsLines = (m: GenerationMetrics): [string, string] => [
  `generation ${m.generation} · best now ${num(m.best)} · best so far ${num(m.bestSoFar)}`,
  `average ${num(m.average)} · worst ${num(m.worst)} · evaluations ${m.evaluations}`,
];
