import { canonicalRoute, tspPlaces, type TspProblem } from '../engine';

/** Up to this many cities a table cell shows the whole tour; a longer tour is shortened and drawn as a thumbnail beside it. */
export const wholeTourUpTo = 16;
const headCities = 7;
const tailCities = 3;
/** A route is written out in full up to this many cities; a longer one is cut after `routeCut`. */
const routeWholeUpTo = 52;
const routeCut = 46;

/** What a running TSP gives the views: how many cities, where they are drawn, and the words for a length, a gap and a tour. */
export interface TourInfo {
  /** How many cities a tour visits. */
  readonly cities: number;
  /** Where each city is drawn, (across, up): longitude across and latitude up for a GEO instance. */
  readonly places: readonly (readonly [number, number])[];
  /** The length of the shortest tour. */
  readonly optimum: number;
  /** The closed length of a tour (city numbers from 0). */
  lengthOf(tour: readonly number[]): number;
  lengthText(length: number): string;
  gapText(length: number): string;
  /** "length 14,004, 85.7% over the optimum 7,542", or "length 7,542, the optimum". */
  describe(tour: readonly number[]): string;
}

const infos = new WeakMap<object, TourInfo>();

/** The views' picture of a TSP problem, made once per problem. */
export function tourInfoOf(problem: TspProblem): TourInfo {
  const known = infos.get(problem);
  if (known) return known;
  const lengthOf = (tour: readonly number[]): number => problem.lengthOf(tour);
  const info: TourInfo = {
    cities: problem.chromosomeLength,
    places: tspPlaces(problem.instance),
    optimum: problem.instance.optimum,
    lengthOf,
    lengthText: problem.lengthText,
    gapText: problem.gapText,
    describe: (tour) => {
      const length = lengthOf(tour);
      return problem.scoreText!({ decoded: '', objective: length, fitness: 0 - length });
    },
  };
  infos.set(problem, info);
  return info;
}

export interface TourParts {
  /** The whole tour is shown (so `hidden` is 0 and `tail` empty). */
  readonly whole: boolean;
  readonly head: readonly number[];
  /** How many cities between the head and the tail are not shown. */
  readonly hidden: number;
  readonly tail: readonly number[];
}

/** What a table cell shows of a tour, given as city numbers in the order visited: the whole of it, or its first seven and last three cities. */
export function tourParts(cities: readonly number[]): TourParts {
  if (cities.length <= wholeTourUpTo) return { whole: true, head: cities, hidden: 0, tail: [] };
  return { whole: false, head: cities.slice(0, headCities), hidden: cities.length - headCities - tailCities, tail: cities.slice(cities.length - tailCities) };
}

/** A canonical route (city numbers, starting at city 1) written as arrows, closing on its first city; cut after 46 cities when it has more than 52. */
export function routeDetail(route: readonly number[]): { readonly text: string; readonly hidden: number } {
  if (route.length <= routeWholeUpTo) return { text: `${route.join(' → ')} → ${route[0]}`, hidden: 0 };
  return { text: `${route.slice(0, routeCut).join(' → ')} → … (${route.length - routeCut} more)`, hidden: route.length - routeCut };
}

export interface Thumbnail {
  readonly width: number;
  readonly height: number;
  /** An SVG path through the cities in the order of the tour, closed. */
  readonly path: string;
}

const fixed = (x: number): string => String(Math.round(x * 10) / 10);

/**
 * The tour drawn small: the instance's places scaled to fit the box (3 px margin, equal scale across and up, centred), north
 * up. Cities on a line or at one place are drawn on the line or as a dot, never with a division by zero.
 */
export function thumbnail(places: readonly (readonly [number, number])[], tour: readonly number[], width = 64, height = 44): Thumbnail {
  const margin = 3;
  const xs = places.map((p) => p[0]);
  const ys = places.map((p) => p[1]);
  const x0 = Math.min(...xs);
  const y0 = Math.min(...ys);
  const spanX = Math.max(...xs) - x0;
  const spanY = Math.max(...ys) - y0;
  const scales = [spanX > 0 ? (width - 2 * margin) / spanX : Infinity, spanY > 0 ? (height - 2 * margin) / spanY : Infinity];
  const scale = Math.min(...scales);
  const s = Number.isFinite(scale) ? scale : 0;
  const left = (width - spanX * s) / 2;
  const bottom = (height + spanY * s) / 2;
  const at = (city: number): string => {
    const p = places[city]!;
    return `${fixed(left + (p[0] - x0) * s)},${fixed(bottom - (p[1] - y0) * s)}`;
  };
  return { width, height, path: `${tour.map((city, k) => `${k === 0 ? 'M' : 'L'}${at(city)}`).join(' ')} Z` };
}

/** The route of a tour (city numbers from 0) as a screen reader says it: every city in order, then back to the first. */
export function tourSentence(tour: readonly number[]): string {
  return `${tour.map((c) => c + 1).join(', ')}, then back to ${tour[0]! + 1}`;
}

/** The accessible name of a tour: the number of cities, the whole route, then its length and its gap to the optimum. */
export function tourLabel(info: TourInfo, tour: readonly number[]): string {
  const described = info.describe(tour);
  return `Tour of ${tour.length} cities, in the order visited: ${tourSentence(tour)}. ${described.charAt(0).toUpperCase()}${described.slice(1)}.`;
}

/** The right-hand side of the table's heading: the average and the best length and the best one's gap. Fitness is minus the length. */
export function tourHeader(info: TourInfo, fitnesses: readonly number[]): string {
  const lengths = fitnesses.map((f) => 0 - f);
  const best = Math.min(...lengths);
  const average = lengths.reduce((sum, l) => sum + l, 0) / lengths.length;
  return `avg ${info.lengthText(average)} · best ${info.lengthText(best)} (${info.gapText(best)})`;
}

/** A chromosome as the table shows it (city numbers from 1) and its canonical route (from city 1, the lower second city first), city numbers from 1 again. */
export function routeOf(chromosome: string): { readonly route: readonly number[]; readonly start: number } {
  const tour = chromosome.split(' ').map((c) => Number(c) - 1);
  return { route: canonicalRoute(tour).map((c) => c + 1), start: tour[0]! + 1 };
}

/** The brief form of a tour for a line of narration: the whole of a tour of up to 9 cities, else the first five, the number between and the last two. */
export function briefTour(cities: readonly number[]): string {
  if (cities.length <= 9) return cities.join(' ');
  return `${cities.slice(0, 5).join(' ')} … ${cities.length - 7} more … ${cities.slice(-2).join(' ')}`;
}

/** The size of a city's cell in a strip of the operator views, by the number of cities: 30 px up to 16 cities, 22 up to 24, 20 up to 36, 16 up to 52 (one row at 1920 × 1080), 14 beyond. */
export function stripCell(cities: number): 30 | 22 | 20 | 16 | 14 {
  return cities <= 16 ? 30 : cities <= 24 ? 22 : cities <= 36 ? 20 : cities <= 52 ? 16 : 14;
}

/** What the brief form of a tour shows: the whole of it up to 9 cities, else the first five and the last two with the number between. */
export function briefParts(cities: readonly number[]): TourParts {
  if (cities.length <= 9) return { whole: true, head: cities, hidden: 0, tail: [] };
  return { whole: false, head: cities.slice(0, 5), hidden: cities.length - 7, tail: cities.slice(-2) };
}
