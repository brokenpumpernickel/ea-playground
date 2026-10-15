import { formatReal, type Point } from '../engine';
import type { LandscapeInfo } from './landscape-context';

/**
 * The numbers behind the landscape's heatmap, as pure functions: the fitness grid, the isolines, the colour of a fitness,
 * the optimum marks, the region a zoom shows and the sentence that stands for the picture. Nothing here draws.
 */

/** A rectangle of the plane, x from x0 to x1 and y from y0 to y1. */
export interface Region {
  readonly x0: number;
  readonly x1: number;
  readonly y0: number;
  readonly y1: number;
}

export interface FitnessGrid {
  readonly nx: number;
  readonly ny: number;
  readonly region: Region;
  /** Row by row from y0 up: the value for column i, row j is `values[j * nx + i]`. */
  readonly values: Float64Array;
  xAt(i: number): number;
  yAt(j: number): number;
}

/** The fitness at nx × ny evenly spaced points over the region, corners included. */
export function fitnessGrid(info: Pick<LandscapeInfo, 'fitnessAt'>, region: Region, nx: number, ny: number): FitnessGrid {
  const xAt = (i: number) => region.x0 + ((region.x1 - region.x0) * i) / (nx - 1);
  const yAt = (j: number) => region.y0 + ((region.y1 - region.y0) * j) / (ny - 1);
  const values = new Float64Array(nx * ny);
  for (let j = 0; j < ny; j++) {
    const y = yAt(j);
    for (let i = 0; i < nx; i++) values[j * nx + i] = info.fitnessAt(xAt(i), y);
  }
  return { nx, ny, region, values, xAt, yAt };
}

/* ------------------------------------------------------------------ colour */

type Rgb = readonly [number, number, number];

/** The viridis ramp (dark purple to yellow), at nine stops; lightness only ever rises along it. */
const stops: readonly Rgb[] = [
  [68, 1, 84],
  [72, 40, 120],
  [62, 73, 137],
  [49, 104, 142],
  [38, 130, 142],
  [31, 158, 137],
  [53, 183, 121],
  [110, 206, 88],
  [253, 231, 37],
];

/** The colour for t from 0 (the worst fitness) to 1 (the best). */
export function ramp(t: number): Rgb {
  const clamped = Math.min(1, Math.max(0, t));
  const scaled = clamped * (stops.length - 1);
  const k = Math.min(stops.length - 2, Math.floor(scaled));
  const f = scaled - k;
  const a = stops[k]!;
  const b = stops[k + 1]!;
  return [Math.round(a[0] + (b[0] - a[0]) * f), Math.round(a[1] + (b[1] - a[1]) * f), Math.round(a[2] + (b[2] - a[2]) * f)];
}

/** How light a colour looks, 0 to 1 (luma). */
export const rampLuminance = ([r, g, b]: Rgb): number => (0.299 * r + 0.587 * g + 0.114 * b) / 255;

/** The colour of a fitness on a scale from `min` (the bottom of the ramp) to `max` (the top); values outside are cut to the ends. */
export const colourAt = (value: number, min: number, max: number): Rgb => ramp((value - min) / (max - min));

/* ---------------------------------------------------------------- isolines */

/** The fitness levels the isolines are drawn at: 20, 40, 60 and 80% of the way from the worst to the best fitness. */
export const isolineLevels = ({ min, max }: { min: number; max: number }): number[] => [0.2, 0.4, 0.6, 0.8].map((t) => min + t * (max - min));

/** One line segment of an isoline, x1, y1, x2, y2 in the plane's own coordinates. */
export type Segment = readonly [number, number, number, number];

/** Marching squares: for each level the segments where the (linearly interpolated) fitness crosses it. */
export function isolines(grid: FitnessGrid, levels: readonly number[]): Segment[][] {
  const { nx, ny, values } = grid;
  return levels.map((level) => {
    const segments: Segment[] = [];
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        // the corners in order: bottom left, bottom right, top right, top left
        const v = [values[j * nx + i]!, values[j * nx + i + 1]!, values[(j + 1) * nx + i + 1]!, values[(j + 1) * nx + i]!];
        const px = [grid.xAt(i), grid.xAt(i + 1), grid.xAt(i + 1), grid.xAt(i)];
        const py = [grid.yAt(j), grid.yAt(j), grid.yAt(j + 1), grid.yAt(j + 1)];
        const crossings: [number, number][] = [];
        for (let e = 0; e < 4; e++) {
          const a = e;
          const b = (e + 1) % 4;
          if (v[a]! < level !== v[b]! < level) {
            const t = (level - v[a]!) / (v[b]! - v[a]!);
            crossings.push([px[a]! + (px[b]! - px[a]!) * t, py[a]! + (py[b]! - py[a]!) * t]);
          }
        }
        for (let k = 0; k + 1 < crossings.length; k += 2) segments.push([crossings[k]![0], crossings[k]![1], crossings[k + 1]![0], crossings[k + 1]![1]]);
      }
    }
    return segments;
  });
}

/* ------------------------------------------------------------------ marks */

/** The optimum point(s) of the function that lie inside the region shown. */
export const optimumMarks = (info: Pick<LandscapeInfo, 'optima'>, region: Region): Point[] =>
  info.optima.filter((p) => p.x >= region.x0 && p.x <= region.x1 && p.y >= region.y0 && p.y <= region.y1);

/**
 * The region "Zoom to population" shows: the bounding box of the points with a margin of a fifth of the box on each side
 * (at least a tenth of the range wide, so a population in one place still gets a picture), never beyond the bounds.
 * With no points it is the whole landscape.
 */
export function zoomRegion(points: readonly Point[], bounds: { readonly lo: number; readonly hi: number }): Region {
  if (points.length === 0) return { x0: bounds.lo, x1: bounds.hi, y0: bounds.lo, y1: bounds.hi };
  const minimum = 0.1 * (bounds.hi - bounds.lo);
  const axis = (values: readonly number[]): [number, number] => {
    const low = Math.min(...values);
    const high = Math.max(...values);
    const margin = 0.2 * (high - low);
    let a = low - margin;
    let b = high + margin;
    if (b - a < minimum) {
      const middle = (low + high) / 2;
      a = middle - minimum / 2;
      b = middle + minimum / 2;
    }
    return [Math.max(bounds.lo, a), Math.min(bounds.hi, b)];
  };
  const [x0, x1] = axis(points.map((p) => p.x));
  const [y0, y1] = axis(points.map((p) => p.y));
  return { x0, x1, y0, y1 };
}

/* ---------------------------------------------------------------- sentence */

const f3 = (v: number) => formatReal([v], 3);
const f2 = (v: number) => formatReal([v], 2);
const f1 = (v: number) => formatReal([v], 1);
const trimmed = (v: number) => formatReal([v], 2).replace(/\.?0+$/, '');

/** The sentence that says what the picture shows, for a screen reader and for anyone who cannot tell the colours apart. */
export function landscapeSentence(info: LandscapeInfo, region: Region, zoomed: boolean, how = 'Zoomed to the population'): string {
  const { lo, hi } = info.bounds;
  const optimum = info.optima.length === 1 ? `the optimum is at (${f3(info.optima[0]!.x)}, ${f3(info.optima[0]!.y)})` : `there are ${info.optima.length === 4 ? 'four' : info.optima.length} optima, at ${info.optima.map((p) => `(${f3(p.x)}, ${f3(p.y)})`).join(', ')}`;
  const rule = info.minimised ? ' f is minimised, so fitness = −f and higher is always better.' : ' Higher is better.';
  const shown = zoomed ? ` ${how}: x from ${f1(region.x0)} to ${f1(region.x1)}, y from ${f1(region.y0)} to ${f1(region.y1)}.` : '';
  return `${info.name}: fitness from ${f2(info.fitnessRange.min)} to ${f2(info.fitnessRange.max)} over x and y from ${trimmed(lo)} to ${trimmed(hi)}; ${optimum}.${rule}${shown}`;
}

/* ------------------------------------------------------------------ labels */

export interface PlacedLabel {
  /** Canvas position of the label's baseline centre. */
  readonly x: number;
  readonly y: number;
}

/**
 * Where each isoline's value is printed: on a segment of its own line, as near the anchor as possible, inside the plot and clear
 * of its edges, not on top of a label already placed (40 px sideways or 14 px up or down apart at least) and not on an optimum
 * mark. `segments` are in canvas pixels. A line with no room has no label (`undefined`), because a missing label is better
 * than two printed over each other; the line is still drawn and the levels are in the scale's neighbourhood and the sentence.
 */
export function placeLabels(
  segments: readonly (readonly Segment[])[],
  anchor: { x: number; y: number },
  avoid: readonly { x: number; y: number }[],
  plot: { L: number; T: number; R: number; B: number },
): (PlacedLabel | undefined)[] {
  const placed: PlacedLabel[] = [];
  return segments.map((line) => {
    const candidates = line
      .map(([x, y]) => ({ x, y }))
      .filter((p) => p.x > plot.L + 14 && p.x < plot.R - 14 && p.y > plot.T + 12 && p.y < plot.B - 6)
      .sort((a, b) => Math.hypot(a.x - anchor.x, a.y - anchor.y) - Math.hypot(b.x - anchor.x, b.y - anchor.y));
    const pick = candidates.find((p) => placed.every((q) => Math.abs(p.x - q.x) >= 40 || Math.abs(p.y - q.y) >= 14) && avoid.every((o) => Math.hypot(p.x - o.x, p.y - o.y) >= 26));
    if (pick) placed.push(pick);
    return pick;
  });
}
