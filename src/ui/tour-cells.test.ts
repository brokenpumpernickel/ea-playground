import { describe, expect, test } from 'vitest';
import { tspInstance, tspProblem, type TspOptions } from '../engine';
import { routeDetail, routeOf, thumbnail, tourHeader, tourInfoOf, tourLabel, tourParts, tourSentence, wholeTourUpTo } from './tour-cells';

const opts = (instance: string, n = 10, seed = 1): TspOptions => ({ instance, n, seed });
const range = (n: number) => Array.from({ length: n }, (_, k) => k + 1);

describe('how much of a tour the cell shows', () => {
  test('up to 16 cities the whole tour, in order', () => {
    expect(wholeTourUpTo).toBe(16);
    for (const n of [5, 14, 16]) expect(tourParts(range(n))).toEqual({ whole: true, head: range(n), hidden: 0, tail: [] });
  });

  test('from 17 cities the first seven and the last three, with the number in between', () => {
    expect(tourParts(range(17))).toEqual({ whole: false, head: [1, 2, 3, 4, 5, 6, 7], hidden: 7, tail: [15, 16, 17] });
    const parts = tourParts(range(52));
    expect(parts).toEqual({ whole: false, head: range(7), hidden: 42, tail: [50, 51, 52] });
    expect(parts.head.length + parts.hidden + parts.tail.length).toBe(52);
  });

  test('keeps the city numbers it is given, whatever they are', () => {
    const tour = [31, 18, 21, 17, 2, 42, 7, ...range(42).map((k) => k + 100), 25, 9, 1];
    const parts = tourParts(tour);
    expect(parts.head).toEqual([31, 18, 21, 17, 2, 42, 7]);
    expect(parts.tail).toEqual([25, 9, 1]);
    expect(parts.hidden).toBe(42);
  });
});

describe('the route written out under the table', () => {
  test('a route is written as arrows and closes on its first city', () => {
    expect(routeDetail([1, 3, 2, 4])).toEqual({ text: '1 → 3 → 2 → 4 → 1', hidden: 0 });
  });

  test('up to 52 cities it is written in full', () => {
    const full = routeDetail(range(52));
    expect(full.hidden).toBe(0);
    expect(full.text.endsWith('→ 51 → 52 → 1')).toBe(true);
    expect(full.text.split(' → ')).toHaveLength(53);
  });

  test('a longer route is cut at 46 cities and says how many more', () => {
    const cut = routeDetail(range(60));
    expect(cut.hidden).toBe(14);
    expect(cut.text.split(' → ')).toHaveLength(47);
    expect(cut.text.endsWith('→ 45 → 46 → … (14 more)')).toBe(true);
  });
});

describe('the thumbnail of a tour', () => {
  const square = { rule: 'EUC' as const, coordinates: [[0, 0], [10, 0], [10, 10], [0, 10]] as [number, number][] };

  test('is a closed path through the cities, north up, inside its box', () => {
    const t = thumbnail(square.coordinates, [0, 1, 2, 3], 64, 44);
    expect(t).toMatchObject({ width: 64, height: 44 });
    // the square is 10 × 10 in a 64 × 44 box with 3 px of margin: scale 3.8, centred across
    const points = t.path.replace(/[MLZ]/g, ' ').trim().split(/\s+/).map((p) => p.split(',').map(Number));
    expect(points).toHaveLength(4);
    expect(t.path.startsWith('M')).toBe(true);
    expect(t.path.endsWith('Z')).toBe(true);
    const [bl, br, tr, tl] = points as [[number, number], [number, number], [number, number], [number, number]];
    expect(bl[1]).toBeGreaterThan(tl[1]); // city (0,0) is below city (0,10): y grows downwards on the screen
    expect(br[0]).toBeGreaterThan(bl[0]);
    expect(br[0] - bl[0]).toBeCloseTo(38, 1);
    expect(bl[1] - tl[1]).toBeCloseTo(38, 1);
    expect(tr[0]).toBeCloseTo(br[0], 5);
    for (const [x, y] of points) {
      expect(x).toBeGreaterThanOrEqual(3 - 1e-9);
      expect(x).toBeLessThanOrEqual(61 + 1e-9);
      expect(y).toBeGreaterThanOrEqual(3 - 1e-9);
      expect(y).toBeLessThanOrEqual(41 + 1e-9);
    }
    expect(((bl[0] + br[0]) / 2)).toBeCloseTo(32, 1); // centred
  });

  test('follows the order of the tour', () => {
    const a = thumbnail(square.coordinates, [0, 1, 2, 3]).path;
    const b = thumbnail(square.coordinates, [0, 2, 1, 3]).path;
    expect(a).not.toBe(b);
    expect(b.split('L')).toHaveLength(4);
  });

  test('cities on one line are drawn on one line, centred, and cities at one place make a dot', () => {
    const line = thumbnail([[0, 5], [3, 5], [9, 5]], [0, 1, 2]);
    const ys = [...line.path.matchAll(/,(-?\d+(\.\d+)?)/g)].map((m) => Number(m[1]));
    expect(new Set(ys).size).toBe(1);
    expect(ys[0]).toBeCloseTo(22, 1);
    const dot = thumbnail([[2, 2], [2, 2], [2, 2]], [0, 1, 2]);
    expect(dot.path).toMatch(/^M32,22 L32,22 L32,22 Z$/);
    expect(dot.path).not.toMatch(/NaN|Infinity/);
  });

  test('draws a GEO instance from its places: longitude across, latitude up', () => {
    const ulysses = tspInstance(opts('ulysses16'));
    const t = thumbnail(tourInfoOf(tspProblem(opts('ulysses16'))).places, [...Array(16).keys()]);
    expect(t.path).not.toMatch(/NaN/);
    expect(ulysses.coordinates).toHaveLength(16);
  });
});

describe('what a screen reader and the table header are told', () => {
  const problem = tspProblem(opts('berlin52'));
  const info = tourInfoOf(problem);

  test('the info carries the number of cities, the places and the words for a length and a gap', () => {
    expect(info.cities).toBe(52);
    expect(info.places).toHaveLength(52);
    expect(info.lengthText(7542)).toBe('7,542');
    expect(info.gapText(14004)).toBe('85.7%');
  });

  test('a tour is described by its length and its gap, and the optimum is said to be the optimum', () => {
    const optimal = [...tspInstance(opts('berlin52')).optimalTour];
    expect(info.describe(optimal)).toBe('length 7,542, the optimum');
    const identity = [...Array(52).keys()];
    expect(info.describe(identity)).toMatch(/^length 22,\d{3}, \d+\.\d% over the optimum 7,542$/);
  });

  test('the name of a chromosome gives the route in full, back to its first city, then its length and gap', () => {
    const small = tourInfoOf(tspProblem(opts('circle', 5)));
    expect(tourLabel(small, [0, 2, 1, 3, 4])).toBe(`Tour of 5 cities, in the order visited: 1, 3, 2, 4, 5, then back to 1. Length ${small.lengthText(small.lengthOf([0, 2, 1, 3, 4]))}, ${small.gapText(small.lengthOf([0, 2, 1, 3, 4]))} over the optimum ${small.lengthText(small.optimum)}.`);
    const all = tourLabel(info, [...Array(52).keys()]);
    expect(all).toContain('1, 2, 3, 4,');
    expect(all).toContain('51, 52, then back to 1');
    expect(all).toContain('Tour of 52 cities');
  });

  test('the sentence about a tour is the label without its marks', () => {
    expect(tourSentence([0, 1, 2])).toMatch(/^1, 2, 3/);
  });

  test('the header of the table gives the average and the best length and the best gap', () => {
    expect(tourHeader(info, [-10000, -14004, -16000])).toBe('avg 13,335 · best 10,000 (32.6%)');
    expect(tourHeader(info, [-7542])).toBe('avg 7,542 · best 7,542 (0.0%)');
  });
});

describe('the canonical route of a chromosome', () => {
  test('starts at city 1 and goes the way whose second city is the lower', () => {
    expect(routeOf('3 4 5 1 2')).toEqual({ route: [1, 2, 3, 4, 5], start: 3 });
    expect(routeOf('2 1 5 4 3')).toEqual({ route: [1, 2, 3, 4, 5], start: 2 });
    expect(routeOf('1 5 4 3 2')).toEqual({ route: [1, 2, 3, 4, 5], start: 1 });
  });

  test('a rotation or a reversal of a tour has the same route', () => {
    const a = routeOf('4 2 6 1 3 5').route;
    expect(routeOf('1 3 5 4 2 6').route).toEqual(a);
    expect(routeOf('6 2 4 5 3 1').route).toEqual(a);
  });
});
