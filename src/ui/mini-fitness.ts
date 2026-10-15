import { num } from './format';
import { fitnessSummary, type PlotModel, type PlotPoint } from './plot-models';

/**
 * The simplified fitness graph that lies over a corner of the focus view: the same data as the fitness plot (best of the
 * generation, best so far, the average, the optimum and nearest-neighbour lines, the "now" mark), drawn in a small box with
 * no gridlines or tick labels, only the two ends of the axis in words. Each series has the shape of the full plot's markers at
 * "now", so the three are told apart by more than their colour. Pure geometry; the component only draws it.
 */
export const miniSize = { width: 420, height: 150 } as const;

export type MiniKey = 'average' | 'bestSoFar' | 'best';

export interface MiniSeries {
  readonly key: MiniKey;
  readonly label: string;
  readonly dash: string;
  readonly marker: 'circle' | 'triangle' | 'square';
  /** The path from generation 0 to the cursor, and from the cursor on (dimmed); the cursor's generation belongs to both. */
  readonly past: string;
  readonly future: string;
  /** The series at the cursor's generation: where its marker goes and the value there. */
  readonly at: { readonly x: number; readonly y: number; readonly value: number };
}

export interface MiniLine {
  readonly key: 'optimum' | 'nearest';
  readonly y: number;
  readonly text: string;
  /** The baseline of the label (14 px type, right-aligned at the plot's right edge). */
  readonly labelY: number;
}

export interface MiniFitness {
  readonly width: number;
  readonly height: number;
  readonly plot: { readonly left: number; readonly right: number; readonly top: number; readonly bottom: number };
  readonly series: readonly MiniSeries[];
  readonly now: { readonly x: number };
  readonly lines: readonly MiniLine[];
  readonly yLabels: { readonly top: { readonly text: string; readonly y: number }; readonly bottom: { readonly text: string; readonly y: number } };
  readonly xLabels: { readonly left: string; readonly right: string };
  readonly sentence: string;
}

const plot = { left: 8, right: miniSize.width - 8, top: 30, bottom: 118 } as const;

const picks: readonly { key: MiniKey; label: string; dash: string; marker: MiniSeries['marker']; pick: (p: PlotPoint) => number }[] = [
  { key: 'average', label: 'average', dash: 'none', marker: 'circle', pick: (p) => p.average },
  { key: 'bestSoFar', label: 'best so far', dash: '7 4', marker: 'triangle', pick: (p) => p.bestSoFar },
  { key: 'best', label: 'best of generation', dash: 'none', marker: 'square', pick: (p) => p.best },
];

export function miniFitness(model: PlotModel): MiniFitness {
  const fmt = (value: number) => (model.format ? model.format(value) : num(value));
  const span = model.yMax - model.yMin || 1;
  const X = (generation: number) => plot.left + ((plot.right - plot.left) * generation) / (model.xMax || 1);
  const Y = (value: number) => plot.bottom - ((plot.bottom - plot.top) * (value - model.yMin)) / span;
  const path = (points: readonly PlotPoint[], pick: (p: PlotPoint) => number) => points.map((p, k) => `${k ? 'L' : 'M'}${X(p.generation)},${Y(pick(p))}`).join('');
  const upToNow = model.points.filter((p) => p.generation <= model.now);
  const fromNow = model.points.filter((p) => p.generation >= model.now);
  const here = model.points[Math.min(model.now, model.points.length - 1)]!;

  const series = picks.map((s): MiniSeries => ({
    key: s.key,
    label: s.label,
    dash: s.dash,
    marker: s.marker,
    past: path(upToNow, s.pick),
    future: path(fromNow, s.pick),
    at: { x: X(here.generation), y: Y(s.pick(here)), value: s.pick(here) },
  }));

  // the optimum's label sits above its line and the nearest neighbour's below its line (the nearest tour is never shorter than
  // the optimum, so its line is never above), so the two cannot meet however close the lines are
  const lines: MiniLine[] = [];
  if (model.optimum !== undefined) lines.push({ key: 'optimum', y: Y(model.optimum), text: `optimum ${fmt(model.optimum)}`, labelY: Y(model.optimum) - 5 });
  if (model.optimum !== undefined && model.nearest !== undefined) lines.push({ key: 'nearest', y: Y(model.nearest), text: `nearest neighbour ${fmt(model.nearest)}`, labelY: Y(model.nearest) + 16 });

  return {
    width: miniSize.width,
    height: miniSize.height,
    plot,
    series,
    now: { x: X(here.generation) },
    lines,
    yLabels: { top: { text: fmt(model.yMax), y: plot.top + 13 }, bottom: { text: fmt(model.yMin), y: plot.bottom - 5 } },
    xLabels: { left: '0', right: String(model.xMax) },
    sentence: fitnessSummary(model),
  };
}
