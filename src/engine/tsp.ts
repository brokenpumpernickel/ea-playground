import type { GaParams } from './algorithm';
import { canonicalRoute, formatTour, type Chromosome } from './chromosome';
import { type Problem, type ProblemColumn, type Scores } from './problem';
import { createRng } from '../run/rng';
import att48 from './tsplib/att48.json' with { type: 'json' };
import berlin52 from './tsplib/berlin52.json' with { type: 'json' };
import burma14 from './tsplib/burma14.json' with { type: 'json' };
import eil51 from './tsplib/eil51.json' with { type: 'json' };
import ulysses16 from './tsplib/ulysses16.json' with { type: 'json' };
import ulysses22 from './tsplib/ulysses22.json' with { type: 'json' };

/**
 * The travelling salesperson problem (ADR 0007): a closed tour through every city once, its length the objective, fitness −length.
 * The distance rule of a TSPLIB instance is the one TSPLIB publishes, so the published optimum is the optimum; the own
 * instances use plain Euclidean distance in real numbers.
 */
export type DistanceRule = 'EUC' | 'EUC_2D' | 'ATT' | 'GEO';

type Point = readonly [number, number];

const ruleTexts: Record<DistanceRule, string> = {
  EUC: 'Euclidean distance, in real numbers',
  EUC_2D: 'EUC_2D: Euclidean distance rounded to the nearest whole number',
  ATT: 'ATT: pseudo-Euclidean distance, rounded up when rounding to the nearest whole number rounded down',
  GEO: 'GEO: great-circle distance on degrees and minutes, in whole kilometres',
};

const nint = (x: number): number => Math.floor(x + 0.5);
const geoRadians = (x: number): number => {
  const degrees = Math.trunc(x);
  return (3.141592 * (degrees + (5 * (x - degrees)) / 3)) / 180;
};

const geoDegrees = (x: number): number => {
  const degrees = Math.trunc(x);
  return degrees + (5 * (x - degrees)) / 3;
};

/**
 * Where each city is drawn, as (across, up): the coordinates themselves, except for a GEO instance, whose latitude and longitude
 * (degrees.minutes) are turned into decimal degrees and swapped so that longitude runs across and latitude up, as on a map.
 */
export function tspPlaces(instance: Pick<TspInstance, 'rule' | 'coordinates'>): readonly Point[] {
  if (instance.rule !== 'GEO') return instance.coordinates;
  return instance.coordinates.map((c): Point => [geoDegrees(c[1]), geoDegrees(c[0])]);
}

/** The distance between two places under a rule (TSPLIB's definitions; GEO takes latitude and longitude as degrees.minutes). */
export function tspDistance(rule: DistanceRule, a: Point, b: Point): number {
  if (rule === 'EUC') return Math.hypot(a[0] - b[0], a[1] - b[1]);
  if (rule === 'EUC_2D') return nint(Math.hypot(a[0] - b[0], a[1] - b[1]));
  if (rule === 'ATT') {
    const r = Math.sqrt(((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2) / 10);
    const t = nint(r);
    return t < r ? t + 1 : t;
  }
  const latA = geoRadians(a[0]);
  const lonA = geoRadians(a[1]);
  const latB = geoRadians(b[0]);
  const lonB = geoRadians(b[1]);
  const q1 = Math.cos(lonA - lonB);
  const q2 = Math.cos(latA - latB);
  const q3 = Math.cos(latA + latB);
  return Math.trunc(6378.388 * Math.acos(0.5 * ((1 + q1) * q2 - (1 - q1) * q3)) + 1);
}

/** The closed length of a tour through these coordinates. */
export function tourLength(rule: DistanceRule, coordinates: readonly Point[], tour: Chromosome): number {
  let total = 0;
  for (let k = 0; k < tour.length; k++) total += tspDistance(rule, coordinates[tour[k]!]!, coordinates[tour[(k + 1) % tour.length]!]!);
  return total;
}

/**
 * The shortest closed tour, by dynamic programming over subsets (Held and Karp): the best length of a path from city 0 through a
 * set of cities ending at one of them. Exact, 2ⁿ·n² work, so only used up to 16 cities. Ties go to the lowest city, so the
 * tour found is always the same one.
 */
export function heldKarp(distance: (i: number, j: number) => number, n: number): { length: number; tour: number[] } {
  if (n > 16) throw new Error('Held–Karp is only used up to 16 cities (it needs 2ⁿ states)');
  if (n === 1) return { length: 0, tour: [0] };
  const m = n - 1; // the cities 1 … m are the bits 0 … m − 1 of a set
  const sets = 1 << m;
  const best = new Float64Array(sets * m).fill(Infinity);
  const before = new Int8Array(sets * m).fill(-1);
  for (let j = 0; j < m; j++) best[(1 << j) * m + j] = distance(0, j + 1);
  for (let set = 1; set < sets; set++) {
    for (let j = 0; j < m; j++) {
      if (!(set & (1 << j))) continue;
      const here = best[set * m + j]!;
      if (here === Infinity) continue;
      for (let k = 0; k < m; k++) {
        if (set & (1 << k)) continue;
        const next = set | (1 << k);
        const length = here + distance(j + 1, k + 1);
        if (length < best[next * m + k]!) {
          best[next * m + k] = length;
          before[next * m + k] = j;
        }
      }
    }
  }
  let last = 0;
  let length = Infinity;
  for (let j = 0; j < m; j++) {
    const total = best[(sets - 1) * m + j]! + distance(j + 1, 0);
    if (total < length) {
      length = total;
      last = j;
    }
  }
  const tour: number[] = [];
  let set = sets - 1;
  for (let j = last; j >= 0; ) {
    tour.push(j + 1);
    const previous = before[set * m + j]!;
    set &= ~(1 << j);
    j = previous;
  }
  return { length, tour: [0, ...tour.reverse()] };
}

/** From city 0 always to the nearest city not yet visited, ties to the lower number. */
export function nearestNeighbourTour(distance: (i: number, j: number) => number, n: number): number[] {
  const visited = new Set<number>([0]);
  const tour = [0];
  while (tour.length < n) {
    const from = tour[tour.length - 1]!;
    let next = -1;
    let nearest = Infinity;
    for (let city = 0; city < n; city++) {
      if (visited.has(city)) continue;
      const d = distance(from, city);
      if (d < nearest) {
        nearest = d;
        next = city;
      }
    }
    tour.push(next);
    visited.add(next);
  }
  return tour;
}

/** What identifies an instance and, for the circle and the random one, its size and its seed. */
export interface TspOptions {
  readonly instance: string;
  /** The number of cities of the circle and of the random instance; ignored for the others. */
  readonly n: number;
  /** The seed of the random instance; ignored for the others. */
  readonly seed: number;
}

export const tspLimits = { minCities: 5, maxCities: 15 } as const;
export const tspDefaultOptions: TspOptions = { instance: 'ulysses16', n: 10, seed: 1 };

interface TsplibData {
  readonly id: string;
  readonly name: string;
  readonly comment: string;
  readonly rule: DistanceRule;
  readonly source: string;
  readonly optimum: number;
  readonly coordinates: readonly Point[];
  readonly optimalTour: readonly number[] | null;
}
const tsplibData = [burma14, ulysses16, ulysses22, att48, eil51, berlin52] as unknown as readonly TsplibData[];

export interface TspCatalogueEntry {
  readonly id: string;
  readonly name: string;
  readonly kind: 'own' | 'tsplib';
  /** The number of cities; null where it is an option (the circle and the random instance). */
  readonly cities: number | null;
  readonly rule: DistanceRule;
  /** The published optimum of a TSPLIB instance; null for the own ones, whose optimum is computed. */
  readonly optimum: number | null;
  readonly comment: string;
}

/** The instances the problem offers, in the order the drawer lists them: the own ones, then TSPLIB's by size. */
export const tspCatalogue: readonly TspCatalogueEntry[] = [
  { id: 'circle', name: 'Circle', kind: 'own', cities: null, rule: 'EUC', optimum: null, comment: 'cities evenly spaced on a circle; the optimum is its perimeter' },
  { id: 'clusters', name: 'Two clusters', kind: 'own', cities: 12, rule: 'EUC', optimum: null, comment: 'two tight groups of six cities far apart' },
  { id: 'random', name: 'Random', kind: 'own', cities: null, rule: 'EUC', optimum: null, comment: 'cities placed at random in a square, from a seed' },
  ...tsplibData.map((d): TspCatalogueEntry => ({ id: d.id, name: d.name, kind: 'tsplib', cities: d.coordinates.length, rule: d.rule, optimum: d.optimum, comment: d.comment })),
];

export interface TspInstance {
  readonly id: string;
  readonly name: string;
  readonly kind: 'own' | 'tsplib';
  readonly comment: string;
  readonly rule: DistanceRule;
  readonly ruleText: string;
  /** Where the data come from, for the TSPLIB instances; null for the own ones. */
  readonly source: string | null;
  readonly coordinates: readonly Point[];
  /** The length of the shortest tour: published for a TSPLIB instance, computed (exactly) for the own ones. */
  readonly optimum: number;
  readonly optimumSource: 'published' | 'computed';
  /** A shortest tour: TSPLIB's optimal tour, or the one Held–Karp or the circle's order gives. */
  readonly optimalTour: readonly number[];
  readonly nearestNeighbour: { readonly tour: readonly number[]; readonly length: number };
}

const showNumber = (x: unknown): string => (typeof x === 'number' && Number.isFinite(x) ? String(x) : 'not a number');
const whole = (x: unknown, min: number, max = Infinity): x is number => typeof x === 'number' && Number.isInteger(x) && x >= min && x <= max;
const ids = tspCatalogue.map((c) => c.id);

/** What is wrong with the options, in words, each under the field it concerns. */
export function validateTspFields(options: TspOptions): { readonly instance: string[]; readonly n: string[]; readonly seed: string[] } {
  const known = ids.includes(options.instance);
  const needsN = options.instance === 'circle' || options.instance === 'random';
  const { minCities, maxCities } = tspLimits;
  return {
    instance: known ? [] : [`Instance must be one of ${ids.join(', ')}.`],
    n: !needsN || whole(options.n, minCities, maxCities) ? [] : [`The number of cities must be a whole number from ${minCities} to ${maxCities} (it is ${showNumber(options.n)}).`],
    seed: options.instance !== 'random' || whole(options.seed, 0) ? [] : [`The seed must be a whole number of 0 or more (it is ${showNumber(options.seed)}).`],
  };
}

/** Everything wrong with these options, or an empty list. */
export function validateTsp(options: TspOptions): string[] {
  const fields = validateTspFields(options);
  return [...fields.instance, ...fields.n, ...fields.seed];
}

const clusterCoordinates: readonly Point[] = [[20, 22], [31, 18], [26, 33], [15, 36], [38, 30], [24, 12], [200, 160], [212, 171], [190, 176], [205, 150], [218, 158], [196, 164]];
const cache = new Map<string, TspInstance>();

/** The instance for valid options (the shortest tour of an own instance is computed once and remembered). */
export function tspInstance(options: TspOptions): TspInstance {
  const problems = validateTsp(options);
  if (problems.length > 0) throw new Error(problems[0]);
  const key = options.instance === 'circle' ? `circle:${options.n}` : options.instance === 'random' ? `random:${options.n}:${options.seed}` : options.instance;
  const known = cache.get(key);
  if (known) return known;
  const instance = build(options);
  cache.set(key, instance);
  return instance;
}

function build(options: TspOptions): TspInstance {
  const entry = tspCatalogue.find((c) => c.id === options.instance)!;
  const data = tsplibData.find((d) => d.id === options.instance);
  const rule: DistanceRule = entry.rule;
  let coordinates: readonly Point[];
  if (data) coordinates = data.coordinates;
  else if (options.instance === 'circle') {
    // city k at the angle 90° − k·360°/n of a circle of radius 100, so city 1 is at the top and the cities go round clockwise
    coordinates = Array.from({ length: options.n }, (_, k) => [150 + 100 * Math.cos(Math.PI / 2 - (2 * Math.PI * k) / options.n), 150 + 100 * Math.sin(Math.PI / 2 - (2 * Math.PI * k) / options.n)] as Point);
  } else if (options.instance === 'clusters') coordinates = clusterCoordinates;
  else {
    // the random instance: x then y for each city in turn, each a draw scaled to 0 to 100 and rounded to one decimal
    const rng = createRng(options.seed);
    coordinates = Array.from({ length: options.n }, () => {
      const x = Math.round(rng.next() * 1000) / 10;
      const y = Math.round(rng.next() * 1000) / 10;
      return [x, y] as Point;
    });
  }
  const n = coordinates.length;
  const distance = (i: number, j: number) => tspDistance(rule, coordinates[i]!, coordinates[j]!);
  let optimalTour: readonly number[];
  let optimum: number;
  let optimumSource: 'published' | 'computed' = 'computed';
  if (data) {
    optimumSource = 'published';
    optimum = data.optimum;
    optimalTour = data.optimalTour ?? heldKarp(distance, n).tour; // burma14 has no tour file
  } else {
    optimalTour = options.instance === 'circle' ? coordinates.map((_, k) => k) : heldKarp(distance, n).tour;
    optimum = tourLength(rule, coordinates, optimalTour);
  }
  const nn = nearestNeighbourTour(distance, n);
  return {
    id: options.instance,
    name: entry.name,
    kind: entry.kind,
    comment: entry.comment,
    rule,
    ruleText: ruleTexts[rule],
    source: data ? data.source : null,
    coordinates,
    optimum,
    optimumSource,
    optimalTour,
    nearestNeighbour: { tour: nn, length: tourLength(rule, coordinates, nn) },
  };
}

export type TspProblem = Problem & {
  readonly options: TspOptions;
  readonly instance: TspInstance;
  /** Minus the optimum: the best fitness any tour has. */
  readonly knownOptimumFitness: number;
  /** The closed length of a tour. */
  lengthOf(tour: Chromosome): number;
  /** How much longer than the optimum a length is, as a share of the optimum. */
  gapOf(length: number): number;
  /** A length as the screen writes it: thousands separators, one decimal for real distances. */
  lengthText(length: number): string;
  /** The gap as the screen writes it: per cent with one decimal, never below 0. */
  gapText(length: number): string;
};

const minus = (text: string): string => text.replace('-', '−');
const grouped = (value: number, decimals: number): string => value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

/** The problem for these options; throws with the first validation message when they are not valid. */
export function tspProblem(options: TspOptions): TspProblem {
  const instance = tspInstance(options);
  const n = instance.coordinates.length;
  const decimals = instance.rule === 'EUC' ? 1 : 0;
  const length = (value: number): string => grouped(value, decimals);
  const lengthOf = (tour: Chromosome): number => tourLength(instance.rule, instance.coordinates, tour);
  const gapOf = (value: number): number => (value - instance.optimum) / instance.optimum;
  const percent = (value: number): string => `${Math.max(0, gapOf(value) * 100).toFixed(1)}%`;
  const columns: ProblemColumn[] = [
    { header: 'Length', note: 'objective', show: (scores: Scores) => length(scores.objective) },
    { header: 'Gap', note: `to ${length(instance.optimum)}`, show: (scores: Scores) => percent(scores.objective) },
    { header: 'Fitness', note: '= −length', show: (scores: Scores) => minus(length(scores.fitness)) },
  ];
  return {
    options,
    instance,
    chromosomeLength: n,
    alphabet: [],
    permutation: true,
    columns,
    knownOptimumFitness: 0 - instance.optimum,
    scoreText: (scores) => (gapOf(scores.objective) < 5e-12 ? `length ${length(scores.objective)}, the optimum` : `length ${length(scores.objective)}, ${percent(scores.objective)} over the optimum ${length(instance.optimum)}`),
    evaluationExplanation: `TSP: the closed length of the tour is added up, edge by edge, under the distance rule of ${instance.name} (${instance.ruleText}); fitness = −length, so a shorter tour has the higher fitness.`,
    lengthOf,
    gapOf,
    lengthText: length,
    gapText: percent,
    evaluate(chromosome): Scores {
      const total = lengthOf(chromosome);
      return { decoded: formatTour(canonicalRoute(chromosome)), objective: total, fitness: 0 - total };
    },
  };
}

/**
 * The default ε of the stop "within ε of the optimum": half a unit when the distances are whole numbers (a tour is either the
 * optimum or at least a whole unit longer, so this means reaching it) and 0.000001 for real distances (far below any real
 * difference between two tours, far above the rounding of a sum).
 */
export function tspDefaultEpsilon(problem: Pick<TspProblem, 'instance'>): number {
  return problem.instance.rule === 'EUC' ? 1e-6 : 0.5;
}

/**
 * How a fresh run starts for these options, as plain data. Provisional: ticket 13 of milestone 6 replaces these numbers with
 * measured ones. A permutation takes order crossover and one mutation move per mutated individual.
 */
export function tspDefaults(options: TspOptions): { readonly options: TspOptions; readonly populationSize: number; readonly params: GaParams } {
  const epsilon = tspDefaultEpsilon(tspProblem(options));
  return {
    options,
    populationSize: 12,
    params: {
      selection: { method: 'tournament', size: 2 },
      crossover: { enabled: true, operator: 'ox', probability: 0.9 },
      mutation: { enabled: true, mode: 'per-individual', probability: 0.4, operator: 'inversion' },
      elites: 1,
      stop: { generationLimit: 200, targetEpsilon: epsilon, stagnationWindow: 50 },
    },
  };
}
