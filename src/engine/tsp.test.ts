import { describe, expect, test } from 'vitest';
import { canonicalRoute, formatTour } from './chromosome';
import { initialize } from './initialize';
import { isPermutationProblem } from './problem';
import {
  heldKarp,
  nearestNeighbourTour,
  tourLength,
  tspCatalogue,
  tspDefaultEpsilon,
  tspDefaultOptions,
  tspDefaults,
  tspDistance,
  tspPlaces,
  tspInstance,
  tspProblem,
  validateTsp,
  validateTspFields,
  type DistanceRule,
  type TspOptions,
} from './tsp';
import { createRng } from '../run/rng';

const opts = (instance: string, n = 10, seed = 1): TspOptions => ({ instance, n, seed });
const tsplib = ['burma14', 'ulysses16', 'ulysses22', 'att48', 'eil51', 'berlin52'];
const isPermutation = (c: readonly number[], n: number) => c.length === n && [...c].sort((a, b) => a - b).every((v, k) => v === k);

/** The independent oracle: every tour that starts at city 0, the shortest kept. */
function bruteForce(distance: (i: number, j: number) => number, n: number): number {
  let best = Infinity;
  const go = (path: number[], used: boolean[], length: number) => {
    if (length >= best) return;
    if (path.length === n) {
      best = Math.min(best, length + distance(path[n - 1]!, 0));
      return;
    }
    for (let c = 1; c < n; c++) {
      if (used[c]) continue;
      used[c] = true;
      go([...path, c], used, length + distance(path[path.length - 1]!, c));
      used[c] = false;
    }
  };
  go([0], [true, ...Array(n - 1).fill(false)], 0);
  return n === 1 ? 0 : best;
}

describe('the distance rules, on hand-worked pairs', () => {
  const d = (rule: DistanceRule, a: [number, number], b: [number, number]) => tspDistance(rule, a, b);

  test('plain Euclidean distance, in real numbers, for the own instances', () => {
    expect(d('EUC', [0, 0], [3, 4])).toBe(5);
    expect(d('EUC', [0, 0], [1, 1])).toBeCloseTo(Math.SQRT2, 12);
  });

  test('EUC_2D is the Euclidean distance rounded to the nearest whole number, halves up', () => {
    expect(d('EUC_2D', [0, 0], [3, 4])).toBe(5);
    expect(d('EUC_2D', [0, 0], [1, 1])).toBe(1); // 1.414
    expect(d('EUC_2D', [0, 0], [2, 2])).toBe(3); // 2.828
    expect(d('EUC_2D', [0, 0], [0.5, 0])).toBe(1); // exactly half rounds up
    expect(d('EUC_2D', [0, 0], [0.4, 0])).toBe(0);
  });

  test('ATT is the pseudo-Euclidean distance √((dx² + dy²) / 10), rounded to the nearest whole number and then up when that rounded down', () => {
    expect(d('ATT', [0, 0], [10, 0])).toBe(4); // √10 = 3.162 → nearest 3, which is below 3.162, so 4
    expect(d('ATT', [0, 0], [25, 0])).toBe(8); // √62.5 = 7.906 → nearest 8, not below it, so 8
    expect(d('ATT', [0, 0], [30, 0])).toBe(10); // √90 = 9.487 → 9 → 10
    expect(d('ATT', [0, 0], [10, 10])).toBe(5); // √20 = 4.472 → 4 → 5
    expect(d('ATT', [0, 0], [0, 0])).toBe(0);
  });

  test('GEO is the great-circle distance on a sphere of radius 6378.388, the coordinates being degrees.minutes, truncated and plus one', () => {
    // one degree of longitude on the equator: 6378.388 × (1° in radians) = 111.32 km, plus 1, truncated
    expect(d('GEO', [0, 0], [0, 1])).toBe(112);
    expect(d('GEO', [0, 1], [0, 0])).toBe(112);
    expect(d('GEO', [0, 0], [0, 0])).toBe(1); // TSPLIB's formula gives 1 for the same place
  });

  test('GEO uses TSPLIB’s own constants: the radius 6378.388 and π = 3.141592', () => {
    // along the equator the distance is 6378.388 × the angle in radians, plus 1, truncated; 9.34 is 9 degrees 34 minutes
    // (9.5667°, 1064.9 km + 1): with a radius of 6378.4 it would be 1066. 8.11 is 8 degrees 11 minutes (8.1833°, 911.x km + 1):
    // with π = 3.14159 it would be 911.
    expect(d('GEO', [0, 0], [0, 9.34])).toBe(1065);
    expect(d('GEO', [0, 0], [0, 8.11])).toBe(912);
  });

  test('every rule is symmetric', () => {
    const rng = createRng(7);
    const point = (): [number, number] => [Math.round(rng.next() * 8000) / 100, Math.round(rng.next() * 8000) / 100];
    for (const rule of ['EUC', 'EUC_2D', 'ATT', 'GEO'] as const) {
      for (let k = 0; k < 50; k++) {
        const a = point();
        const b = point();
        expect(d(rule, a, b), rule).toBe(d(rule, b, a));
      }
    }
  });
});

describe('the TSPLIB instances', () => {
  test('there are six, with their distance rules and sizes', () => {
    const lib = tspCatalogue.filter((c) => c.kind === 'tsplib');
    expect(lib.map((c) => [c.id, c.cities, c.rule])).toEqual([
      ['burma14', 14, 'GEO'],
      ['ulysses16', 16, 'GEO'],
      ['ulysses22', 22, 'GEO'],
      ['att48', 48, 'ATT'],
      ['eil51', 51, 'EUC_2D'],
      ['berlin52', 52, 'EUC_2D'],
    ]);
  });

  test('every stored optimal tour is a permutation whose length under the implemented rule is exactly the published optimum', () => {
    const published: Record<string, number> = { ulysses16: 6859, ulysses22: 7013, att48: 10628, eil51: 426, berlin52: 7542 };
    for (const [id, optimum] of Object.entries(published)) {
      const instance = tspInstance(opts(id));
      expect(instance.optimalTour, id).not.toBeNull();
      expect(isPermutation(instance.optimalTour!, instance.coordinates.length), id).toBe(true);
      expect(tourLength(instance.rule, instance.coordinates, instance.optimalTour!), id).toBe(optimum);
      expect(instance.optimum, id).toBe(optimum);
    }
  });

  test('burma14 has no optimal tour file: Held–Karp finds the published 3323', () => {
    const instance = tspInstance(opts('burma14'));
    expect(instance.optimum).toBe(3323);
    const found = heldKarp((i, j) => tspDistance(instance.rule, instance.coordinates[i]!, instance.coordinates[j]!), 14);
    expect(found.length).toBe(3323);
    expect(isPermutation(found.tour, 14)).toBe(true);
    expect(instance.optimalTour).toEqual(found.tour); // the instance stores the tour Held–Karp found
  });

  test('each carries its comment and its source, and says which distance rule applies', () => {
    for (const id of tsplib) {
      const instance = tspInstance(opts(id));
      expect(instance.kind).toBe('tsplib');
      expect(instance.source).toMatch(/^TSPLIB \(G\. Reinelt, 1991\)/);
      expect(instance.comment.length).toBeGreaterThan(5);
      expect(instance.ruleText).toContain(instance.rule);
    }
    expect(tspInstance(opts('att48')).ruleText).toBe('ATT: pseudo-Euclidean distance, rounded up when rounding to the nearest whole number rounded down');
    expect(tspInstance(opts('eil51')).ruleText).toBe('EUC_2D: Euclidean distance rounded to the nearest whole number');
    expect(tspInstance(opts('ulysses16')).ruleText).toBe('GEO: great-circle distance on degrees and minutes, in whole kilometres');
  });
});

describe('Held–Karp', () => {
  test('equals brute force on seeded random instances of 1 to 8 cities, and returns a tour of that length', () => {
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) {
      for (let seed = 1; seed <= 6; seed++) {
        const rng = createRng(seed * 31 + n);
        const xy = Array.from({ length: n }, () => [rng.next() * 100, rng.next() * 100] as [number, number]);
        const distance = (i: number, j: number) => tspDistance('EUC', xy[i]!, xy[j]!);
        const found = heldKarp(distance, n);
        expect(found.length, `n=${n} seed=${seed}`).toBeCloseTo(bruteForce(distance, n), 9);
        expect(isPermutation(found.tour, n)).toBe(true);
        expect(tourLength('EUC', xy, found.tour)).toBeCloseTo(found.length, 9);
      }
    }
  });

  test('works on integer-rounded distances too, where many tours tie', () => {
    const rng = createRng(11);
    const xy = Array.from({ length: 8 }, () => [Math.floor(rng.next() * 6), Math.floor(rng.next() * 6)] as [number, number]);
    const distance = (i: number, j: number) => tspDistance('EUC_2D', xy[i]!, xy[j]!);
    expect(heldKarp(distance, 8).length).toBe(bruteForce(distance, 8));
  });

  test('refuses more than 16 cities in words', () => {
    expect(() => heldKarp(() => 1, 17)).toThrow(/Held–Karp is only used up to 16 cities/);
  });
});

describe('the nearest-neighbour tour', () => {
  test('hand-worked: from city 1 always to the nearest city not yet visited', () => {
    const x = [0, 5, 1, 6, 2]; // cities on a line
    const distance = (i: number, j: number) => Math.abs(x[i]! - x[j]!);
    // 0 → 2 (1 away) → 4 (1 away) → 1 (3 away; 3 is 4 away) → 3
    expect(nearestNeighbourTour(distance, 5)).toEqual([0, 2, 4, 1, 3]);
  });

  test('ties go to the lower city number', () => {
    const x = [0, 1, -1];
    expect(nearestNeighbourTour((i, j) => Math.abs(x[i]! - x[j]!), 3)).toEqual([0, 1, 2]);
  });

  test('every instance has one, a permutation starting at city 1, never shorter than the optimum', () => {
    for (const id of [...tsplib, 'circle', 'clusters', 'random']) {
      const instance = tspInstance(opts(id));
      expect(isPermutation(instance.nearestNeighbour.tour, instance.coordinates.length), id).toBe(true);
      expect(instance.nearestNeighbour.tour[0]).toBe(0);
      expect(instance.nearestNeighbour.length, id).toBeGreaterThanOrEqual(instance.optimum - 1e-9);
    }
    expect(tspInstance(opts('berlin52')).nearestNeighbour.length).toBe(8980);
  });
});

describe('the own instances', () => {
  test('the circle: n cities evenly spaced, the optimum is the perimeter, and Held–Karp agrees', () => {
    for (const n of [5, 6, 7, 10, 12, 13]) {
      const instance = tspInstance(opts('circle', n));
      expect(instance.coordinates).toHaveLength(n);
      const radius = 100;
      expect(instance.optimum).toBeCloseTo(n * 2 * radius * Math.sin(Math.PI / n), 9);
      const hk = heldKarp((i, j) => tspDistance('EUC', instance.coordinates[i]!, instance.coordinates[j]!), n);
      expect(hk.length).toBeCloseTo(instance.optimum, 9);
      expect(tourLength('EUC', instance.coordinates, instance.optimalTour!)).toBeCloseTo(instance.optimum, 9);
      expect(instance.kind).toBe('own');
      expect(instance.rule).toBe('EUC');
    }
  });

  test('a tour that crosses itself is longer than the circle', () => {
    const instance = tspInstance(opts('circle', 8));
    const crossing = [0, 2, 1, 3, 4, 5, 6, 7];
    expect(tourLength('EUC', instance.coordinates, crossing)).toBeGreaterThan(instance.optimum + 1);
  });

  test('two clusters: 12 cities in two far groups, the optimum visits each group in one stretch, and Held–Karp agrees', () => {
    const instance = tspInstance(opts('clusters'));
    expect(instance.coordinates).toHaveLength(12);
    const group = (c: number) => (instance.coordinates[c]![0] < 100 ? 0 : 1);
    const tour = instance.optimalTour!;
    const changes = tour.filter((c, k) => group(c) !== group(tour[(k + 1) % 12]!)).length;
    expect(changes).toBe(2);
    expect(instance.coordinates.filter((_, c) => group(c) === 0)).toHaveLength(6);
    const hk = heldKarp((i, j) => tspDistance('EUC', instance.coordinates[i]!, instance.coordinates[j]!), 12);
    expect(hk.length).toBeCloseTo(instance.optimum, 9);
    expect(instance.optimum).toBeCloseTo(CLUSTERS_OPTIMUM, 6);
  });

  test('random: n cities in a 100 × 100 square, the same options always the same cities, a different seed different ones, and the optimum is Held–Karp’s', () => {
    const a = tspInstance(opts('random', 9, 5));
    const b = tspInstance(opts('random', 9, 5));
    expect(a.coordinates).toEqual(b.coordinates);
    expect(a.coordinates).toHaveLength(9);
    for (const [x, y] of a.coordinates) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(100);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(100);
      expect(x * 10).toBeCloseTo(Math.round(x * 10), 9); // one decimal
    }
    expect(a.coordinates.some(([x]) => !Number.isInteger(x))).toBe(true); // to one decimal, not whole numbers, in x
    expect(a.coordinates.some(([, y]) => !Number.isInteger(y))).toBe(true); // and in y
    expect(tspInstance(opts('random', 9, 6)).coordinates).not.toEqual(a.coordinates);
    expect(tspInstance(opts('random', 10, 5)).coordinates.slice(0, 9)).toEqual(a.coordinates); // more cities extend the same list
    expect(a.optimum).toBeCloseTo(bruteForce((i, j) => tspDistance('EUC', a.coordinates[i]!, a.coordinates[j]!), 9), 9);
  });

  test('random with 15 cities has its exact optimum too', () => {
    const instance = tspInstance(opts('random', 15, 3));
    expect(instance.optimum).toBeLessThanOrEqual(instance.nearestNeighbour.length + 1e-9);
    expect(isPermutation(instance.optimalTour!, 15)).toBe(true);
  });
});

describe('the problem', () => {
  test('is a permutation problem of n cities with no alphabet, whose best fitness is minus the optimum', () => {
    const p = tspProblem(opts('berlin52'));
    expect(isPermutationProblem(p)).toBe(true);
    expect(p.chromosomeLength).toBe(52);
    expect(p.alphabet).toEqual([]);
    expect(p.knownOptimumFitness).toBe(-7542);
    expect(p.options).toEqual(opts('berlin52'));
  });

  test('scores a tour: the objective is its closed length, the fitness its negative, the decoded text its canonical route', () => {
    const p = tspProblem(opts('berlin52'));
    const optimal = tspInstance(opts('berlin52')).optimalTour!;
    const scores = p.evaluate(optimal);
    expect(scores.objective).toBe(7542);
    expect(scores.fitness).toBe(-7542);
    expect(scores.fitness).toBe(p.knownOptimumFitness);
    expect(scores.decoded).toBe(formatTour(canonicalRoute(optimal)));
    // a rotation and a reversal are the same route with the same length
    const rotated = [...optimal.slice(9), ...optimal.slice(0, 9)];
    expect(p.evaluate(rotated).objective).toBe(7542);
    expect(p.evaluate([...optimal].reverse()).objective).toBe(7542);
    expect(p.evaluate(rotated).decoded).toBe(scores.decoded);
    expect(Object.is(p.evaluate(optimal).fitness, -0)).toBe(false);
  });

  test('own instances: the optimal tour scores exactly the known optimum fitness', () => {
    for (const o of [opts('circle', 9), opts('clusters'), opts('random', 8, 4)]) {
      const p = tspProblem(o);
      expect(p.evaluate(tspInstance(o).optimalTour!).fitness).toBe(p.knownOptimumFitness);
    }
  });

  test('the table columns: the length, the gap to the optimum in per cent, and fitness = −length, lengths in whole numbers for TSPLIB and to one decimal for the own instances', () => {
    const berlin = tspProblem(opts('berlin52'));
    expect(berlin.columns.map((c) => [c.header, c.note])).toEqual([['Length', 'objective'], ['Gap', 'to 7,542'], ['Fitness', '= −length']]);
    const optimal = berlin.evaluate(tspInstance(opts('berlin52')).optimalTour!);
    expect(berlin.columns.map((c) => c.show(optimal))).toEqual(['7,542', '0.0%', '−7,542']);
    const worse = berlin.evaluate(tspInstance(opts('berlin52')).nearestNeighbour.tour);
    expect(berlin.columns.map((c) => c.show(worse))).toEqual(['8,980', '19.1%', '−8,980']);
    const circle = tspProblem(opts('circle', 8));
    const crossing = circle.evaluate([0, 2, 1, 3, 4, 5, 6, 7]);
    const shown = circle.columns.map((c) => c.show(crossing));
    expect(shown[0]).toMatch(/^\d+\.\d$/);
    expect(shown[2]).toMatch(/^−\d+\.\d$/);
  });

  test('the gap is how much longer than the optimum, as a share of it', () => {
    const p = tspProblem(opts('berlin52'));
    expect(p.gapOf(7542)).toBe(0);
    expect(p.gapOf(8980)).toBeCloseTo(1438 / 7542, 12);
    expect(p.lengthOf(tspInstance(opts('berlin52')).nearestNeighbour.tour)).toBe(8980);
  });

  test('says in a sentence what a score means', () => {
    const p = tspProblem(opts('berlin52'));
    expect(p.scoreText!(p.evaluate(tspInstance(opts('berlin52')).nearestNeighbour.tour))).toBe('length 8,980, 19.1% over the optimum 7,542');
    expect(p.scoreText!(p.evaluate(tspInstance(opts('berlin52')).optimalTour))).toBe('length 7,542, the optimum');
    expect(p.evaluationExplanation).toContain('fitness = −length');
  });

  test('a random population of it can be started and scored', () => {
    const p = tspProblem(opts('ulysses16'));
    const { population } = initialize(p, { kind: 'random', size: 12 }, createRng(3));
    expect(population).toHaveLength(12);
    for (const i of population) {
      expect(isPermutation(i.chromosome, 16)).toBe(true);
      expect(i.objective).toBe(p.lengthOf(i.chromosome));
      expect(i.fitness).toBe(0 - i.objective);
    }
  });

  test('the default ε is half a unit for whole-number distances (so “within ε” means the optimum) and 0.000001 for real ones', () => {
    expect(tspDefaultEpsilon(tspProblem(opts('berlin52')))).toBe(0.5);
    expect(tspDefaultEpsilon(tspProblem(opts('ulysses16')))).toBe(0.5);
    expect(tspDefaultEpsilon(tspProblem(opts('circle', 10)))).toBe(1e-6);
    expect(tspDefaultEpsilon(tspProblem(opts('random', 12, 4)))).toBe(1e-6);
  });
});

describe('how a fresh run starts', () => {
  test('a population, the operators of a permutation (order crossover, a per-individual mutation), elites and the stops, with ε for the instance', () => {
    for (const o of [opts('berlin52'), opts('circle', 8), opts('random', 12, 2)]) {
      const d = tspDefaults(o);
      expect(d.options).toEqual(o);
      expect(d.populationSize).toBeGreaterThan(1);
      expect(d.params.crossover).toMatchObject({ enabled: true, operator: 'ox' });
      expect(d.params.mutation).toMatchObject({ enabled: true, mode: 'per-individual', operator: 'inversion' });
      expect(d.params.elites).toBe(1);
      expect(d.params.stop.targetEpsilon).toBe(tspDefaultEpsilon(tspProblem(o)));
    }
  });
});

describe('the options', () => {
  test('the default is a valid instance', () => {
    expect(validateTsp(tspDefaultOptions)).toEqual([]);
    expect(tspCatalogue.map((c) => c.id)).toContain(tspDefaultOptions.instance);
  });

  test('an unknown instance is named in words with the choices', () => {
    expect(validateTspFields(opts('att49')).instance).toEqual([`Instance must be one of circle, clusters, random, ${tsplib.join(', ')}.`]);
    expect(() => tspProblem(opts('att49'))).toThrow(/Instance must be one of/);
  });

  test('the number of cities matters for the circle and the random instance only, from 5 to 15', () => {
    for (const instance of ['circle', 'random']) {
      expect(validateTspFields(opts(instance, 4)).n).toEqual(['The number of cities must be a whole number from 5 to 15 (it is 4).']);
      expect(validateTspFields(opts(instance, 16)).n).toHaveLength(1);
      expect(validateTspFields(opts(instance, 7.5)).n).toHaveLength(1);
      expect(validateTspFields({ instance, n: Number.NaN, seed: 1 }).n).toEqual(['The number of cities must be a whole number from 5 to 15 (it is not a number).']);
      expect(validateTspFields(opts(instance, 5)).n).toEqual([]);
      expect(validateTspFields(opts(instance, 15)).n).toEqual([]);
    }
    for (const instance of ['clusters', 'berlin52']) expect(validateTspFields(opts(instance, 99)).n).toEqual([]);
  });

  test('the seed matters for the random instance only: a whole number of 0 or more', () => {
    expect(validateTspFields(opts('random', 8, -1)).seed).toEqual(['The seed must be a whole number of 0 or more (it is -1).']);
    expect(validateTspFields(opts('random', 8, 2.5)).seed).toHaveLength(1);
    expect(validateTspFields(opts('random', 8, 0)).seed).toEqual([]);
    expect(validateTspFields(opts('circle', 8, -1)).seed).toEqual([]);
  });

  test('all the messages together, and a problem is only made from valid options', () => {
    expect(validateTsp({ instance: 'random', n: 3, seed: -1 })).toHaveLength(2);
    expect(() => tspProblem({ instance: 'circle', n: 40, seed: 1 })).toThrow('The number of cities must be a whole number from 5 to 15 (it is 40).');
  });
});

// the length of the shortest tour through the two clusters, found by Held–Karp and, independently, by brute force over all 11! tours once, off line (the two agree to the last digit)
const CLUSTERS_OPTIMUM = 548.3163389389227;

describe('where a city is drawn and how a length and a gap are written', () => {
  test('a plain instance is drawn at its coordinates', () => {
    const berlin = tspInstance(opts('berlin52'));
    expect(tspPlaces(berlin)[0]).toEqual(berlin.coordinates[0]);
    expect(tspPlaces(berlin)).toHaveLength(52);
  });

  test('a GEO instance is drawn with longitude across and latitude up, in degrees (degrees.minutes → decimal degrees)', () => {
    const ulysses = tspInstance(opts('ulysses16'));
    // city 1 of ulysses16 is at latitude 38.24 and longitude 20.42, that is 38°24′ north and 20°42′ east
    expect(ulysses.coordinates[0]).toEqual([38.24, 20.42]);
    const [x, y] = tspPlaces(ulysses)[0]!;
    expect(x).toBeCloseTo(20.7, 9);
    expect(y).toBeCloseTo(38.4, 9);
    // a negative minute-value keeps its sign: -20.30 is 20°30′ west
    expect(tspPlaces({ ...ulysses, coordinates: [[-10.3, -20.3]] })[0]).toEqual([expect.closeTo(-20.5, 9), expect.closeTo(-10.5, 9)]);
  });

  test('the problem writes a length with thousands separators and the rule’s decimals, and a gap in per cent, never below 0', () => {
    const berlin = tspProblem(opts('berlin52'));
    expect(berlin.lengthText(7542)).toBe('7,542');
    expect(berlin.lengthText(14004)).toBe('14,004');
    expect(berlin.gapText(14004)).toBe('85.7%');
    expect(berlin.gapText(7542)).toBe('0.0%');
    expect(berlin.gapText(7000)).toBe('0.0%');
    const circle = tspProblem(opts('circle', 8));
    expect(circle.lengthText(12.345)).toBe('12.3');
  });
});
