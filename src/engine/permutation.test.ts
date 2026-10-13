import { describe, expect, test } from 'vitest';
import { canonicalRoute, checkTour, edgeKey, formatTour, parseTour, tourEdgeSet } from './chromosome';
import { initialize } from './initialize';
import { metricsOfProblem } from './metrics';
import { isPermutationProblem, isRealProblem } from './problem';
import { goldberg } from './goldberg';
import { startRun } from './generation';
import { scripted, tourLine } from './test-support';
import { createRng } from '../run/rng';

const line = tourLine(4);
const isPermutation = (c: readonly number[], n: number) => c.length === n && [...c].sort((a, b) => a - b).every((v, k) => v === k);

describe('which representation a problem has', () => {
  test('a permutation problem declares it, has no alphabet and no bounds; the other problems are not permutations', () => {
    expect(isPermutationProblem(line)).toBe(true);
    expect(line.alphabet).toEqual([]);
    expect(isRealProblem(line)).toBe(false);
    expect(isPermutationProblem(goldberg)).toBe(false);
  });
});

describe('reading and writing a tour', () => {
  test('cities are shown from 1 and stored from 0, separated by spaces or commas', () => {
    expect(parseTour('1 5 3 2 4')).toEqual([0, 4, 2, 1, 3]);
    expect(parseTour(' 1, 5,3  2\t4 ')).toEqual([0, 4, 2, 1, 3]);
    expect(formatTour([0, 4, 2, 1, 3])).toBe('1 5 3 2 4');
  });

  test('anything that is not whole city numbers is not a tour', () => {
    for (const text of ['', '  ', '1 a 3', '1.5 2', '-1 2', '1 2 +3', '1e1 2', '1 2 three']) expect(parseTour(text), text).toBeUndefined();
  });

  test('writing and reading round-trip exactly, for every permutation of five cities', () => {
    const all: number[][] = [];
    const permute = (rest: number[], done: number[]) => (rest.length === 0 ? all.push(done) : rest.forEach((c, k) => permute([...rest.slice(0, k), ...rest.slice(k + 1)], [...done, c])));
    permute([0, 1, 2, 3, 4], []);
    expect(all).toHaveLength(120);
    for (const tour of all) expect(parseTour(formatTour(tour))).toEqual(tour);
  });

  test('a tour with the right cities passes; a repeated, a missing and an unknown city are named in words', () => {
    expect(checkTour([2, 0, 1, 3], 4)).toEqual([]);
    expect(checkTour([0, 1, 1, 3], 4)).toEqual(['city 2 appears twice', 'city 3 is missing']);
    expect(checkTour([0, 0, 0, 3], 4)).toEqual(['city 1 appears 3 times', 'city 2 is missing', 'city 3 is missing']);
    expect(checkTour([0, 1, 2, 4], 4)).toEqual(['city 5 is not one of the 4 cities (1 to 4)', 'city 4 is missing']);
    expect(checkTour([-1, 1, 2, 3], 4)).toEqual(['city 0 is not one of the 4 cities (1 to 4)', 'city 1 is missing']);
  });
});

describe('the canonical route and the edges of a tour', () => {
  test('starts at city 1 and goes the way whose second city is the lower', () => {
    expect(canonicalRoute([0, 1, 3, 2])).toEqual([0, 1, 3, 2]);
    expect(canonicalRoute([0, 2, 3, 1])).toEqual([0, 1, 3, 2]); // the same route backwards
    expect(canonicalRoute([3, 2, 0, 1])).toEqual([0, 1, 3, 2]); // rotated
    expect(canonicalRoute([1, 0, 2, 3])).toEqual([0, 1, 3, 2]); // rotated and reversed
  });

  test('every rotation and every reversal of a tour has the same canonical route, and the input is not changed', () => {
    const tour = [4, 0, 6, 2, 5, 1, 3];
    const want = canonicalRoute(tour);
    expect(want[0]).toBe(0);
    for (let r = 0; r < tour.length; r++) {
      const rotated = [...tour.slice(r), ...tour.slice(0, r)];
      expect(canonicalRoute(rotated)).toEqual(want);
      expect(canonicalRoute([...rotated].reverse())).toEqual(want);
    }
    expect(tour).toEqual([4, 0, 6, 2, 5, 1, 3]);
    expect(want).not.toBe(tour);
  });

  test('tiny tours: one city, two cities, three cities', () => {
    expect(canonicalRoute([0])).toEqual([0]);
    expect(canonicalRoute([1, 0])).toEqual([0, 1]);
    expect(canonicalRoute([2, 1, 0])).toEqual([0, 1, 2]);
    expect(canonicalRoute([0, 2, 1])).toEqual([0, 1, 2]);
  });

  test('an edge is the same in both directions, and the edge set ignores direction and rotation', () => {
    expect(edgeKey(3, 1)).toBe(edgeKey(1, 3));
    expect(edgeKey(1, 3)).not.toBe(edgeKey(1, 2));
    const set = tourEdgeSet([0, 1, 2, 3]);
    expect([...set].sort()).toEqual([edgeKey(0, 1), edgeKey(1, 2), edgeKey(2, 3), edgeKey(0, 3)].sort());
    expect(tourEdgeSet([2, 3, 0, 1])).toEqual(set);
    expect(tourEdgeSet([3, 2, 1, 0])).toEqual(set);
    expect(tourEdgeSet([0, 2, 1, 3]).size).toBe(4);
  });

  test('a tour of n cities has n edges, except that two cities have one and one city none', () => {
    expect(tourEdgeSet([0, 1, 2, 3, 4]).size).toBe(5);
    expect(tourEdgeSet([0, 1, 2]).size).toBe(3);
    expect(tourEdgeSet([1, 0]).size).toBe(1);
    expect(tourEdgeSet([0]).size).toBe(0);
  });
});

describe('initializing a permutation population', () => {
  test('a Fisher–Yates shuffle with n − 1 draws, from the last position down, hand-worked', () => {
    // n = 4: i = 3 draws 0.9 → j = ⌊0.9·4⌋ = 3 (no change); i = 2 draws 0.5 → j = 1 swaps genes 2 and 1; i = 1 draws 0.1 → j = 0 swaps genes 1 and 0
    const rng = scripted(0.9, 0.5, 0.1);
    const { population } = initialize(line, { kind: 'random', size: 1 }, rng);
    expect(population[0]!.chromosome).toEqual([2, 0, 1, 3]);
    expect(rng.used).toBe(3);
  });

  test('every individual costs n − 1 draws, in order, so the first one does not depend on how many there are', () => {
    const rng = scripted(0.9, 0.5, 0.1, 0.0, 0.0, 0.0);
    const { population } = initialize(line, { kind: 'random', size: 2 }, rng);
    expect(rng.used).toBe(6);
    expect(population[0]!.chromosome).toEqual([2, 0, 1, 3]);
    expect(population[1]!.chromosome).toEqual([1, 2, 3, 0]); // draws 0, 0, 0: each swaps with position 0 in turn
    const small = initialize(line, { kind: 'random', size: 1 }, createRng(5)).population[0]!.chromosome;
    const large = initialize(line, { kind: 'random', size: 9 }, createRng(5)).population[0]!.chromosome;
    expect(large).toEqual(small);
  });

  test('one city needs no draw', () => {
    const rng = scripted();
    expect(initialize(tourLine(1), { kind: 'random', size: 3 }, rng).population.map((i) => i.chromosome)).toEqual([[0], [0], [0]]);
    expect(rng.used).toBe(0);
  });

  test('every individual is a permutation, whatever the seed, size and number of cities, and no two share an array', () => {
    for (const n of [2, 3, 5, 12, 52]) {
      for (let seed = 1; seed <= 20; seed++) {
        const { population } = initialize(tourLine(n), { kind: 'random', size: 6 }, createRng(seed));
        for (const individual of population) expect(isPermutation(individual.chromosome, n), `n=${n} seed=${seed}`).toBe(true);
        expect(new Set(population.map((i) => i.chromosome)).size).toBe(6);
      }
    }
  });

  test('is reproducible by seed, and the setup events carry the scored individuals', () => {
    const a = initialize(tourLine(8), { kind: 'random', size: 5 }, createRng(42));
    const b = initialize(tourLine(8), { kind: 'random', size: 5 }, createRng(42));
    expect(a.population.map((i) => i.chromosome)).toEqual(b.population.map((i) => i.chromosome));
    expect(a.events.map((e) => e.individual.chromosome)).toEqual(a.population.map((i) => i.chromosome));
    expect(a.population[0]!.fitness).toBe(0 - a.population[0]!.objective);
  });

  test('a shuffle reaches every permutation: over many draws all 24 orders of four cities appear', () => {
    const seen = new Set<string>();
    for (const individual of initialize(line, { kind: 'random', size: 600 }, createRng(3)).population) seen.add(individual.chromosome.join(','));
    expect(seen.size).toBe(24);
  });
});

describe('hand-edited permutation populations', () => {
  test('tours typed as city numbers are read from 1', () => {
    const { population } = initialize(line, { kind: 'explicit', chromosomes: ['1 2 3 4', '4,3,2,1', '2 1 4 3'] }, createRng(1));
    expect(population.map((i) => i.chromosome)).toEqual([[0, 1, 2, 3], [3, 2, 1, 0], [1, 0, 3, 2]]);
  });

  test('what is wrong is said in words, naming the chromosome', () => {
    const run = (text: string, n = 4) => () => initialize(tourLine(n), { kind: 'explicit', chromosomes: ['1 2 3 4', text] }, createRng(1));
    expect(run('1 two 3 4')).toThrow('Chromosome 2 ("1 two 3 4") may only contain city numbers separated by spaces');
    expect(run('1 2 3')).toThrow('Chromosome 2 has 3 cities, but this problem needs 4');
    expect(run('1 2 2 4')).toThrow('Chromosome 2: city 2 appears twice; city 3 is missing');
    expect(run('1 2 3 9')).toThrow('Chromosome 2: city 9 is not one of the 4 cities (1 to 4); city 4 is missing');
    expect(run('1 2 3 4 5')).toThrow('Chromosome 2 has 5 cities, but this problem needs 4');
  });
});

describe('the metrics of a permutation population', () => {
  const stateOf = (problem: ReturnType<typeof tourLine>, chromosomes: string[]) => startRun(problem, { kind: 'explicit', chromosomes }, createRng(1)).state;

  test('hand-worked: a rotation of the same route is the same route, and shares all its edges', () => {
    // A and B are the same route (B is A rotated); C shares two of A's four edges (1–2 and 0–3 in 0-based numbers)
    const state = stateOf(line, ['1 2 3 4', '2 3 4 1', '1 3 2 4']);
    const m = metricsOfProblem(state, line);
    expect(m.distinct).toBe(2); // three chromosomes, two routes
    expect(m.diversity).toBeCloseTo(1 / 3, 12); // pairs: A–B share 4/4, A–C 2/4, B–C 2/4 → mean shared 2/3 → diversity 1/3
    expect(m.alleleFrequencies).toEqual([]);
    expect(m.symbolCounts).toEqual([]);
    expect(m.tour!.distinctRoutes).toBe(2);
  });

  test('identical routes and a single individual have diversity 0; tours with no edge in common have 1', () => {
    expect(metricsOfProblem(stateOf(line, ['1 2 3 4', '3 4 1 2', '4 3 2 1']), line).diversity).toBe(0);
    expect(metricsOfProblem(stateOf(line, ['2 4 1 3']), line).diversity).toBe(0);
    const five = tourLine(5);
    // 1 2 3 4 5 uses 12 23 34 45 15; 1 3 5 2 4 uses 13 35 25 24 14: no edge in common
    expect(metricsOfProblem(stateOf(five, ['1 2 3 4 5', '1 3 5 2 4']), five).diversity).toBe(1);
  });

  test('the agreement of the best tour: for each of its edges, in tour order, the share of the population that has it', () => {
    // a tour of the line that goes out and back has length 6, the least possible
    const state = stateOf(line, ['1 3 2 4', '1 2 3 4', '1 2 4 3', '1 2 3 4']);
    const m = metricsOfProblem(state, line);
    expect(m.best).toBe(-6);
    // tours 2, 3 and 4 all have length 6, and the first of them in the population (2) is the best tour: 1 2 3 4, with edges 1–2, 2–3, 3–4 and 4–1.
    // Tour 1 (1 3 2 4) has 1–3, 3–2, 2–4, 4–1; tour 3 (1 2 4 3) has 1–2, 2–4, 4–3, 3–1; tours 2 and 4 have the best tour's four.
    // Edge by edge: 1–2 is in tours 2, 3, 4; 2–3 in tours 1, 2, 4; 3–4 in tours 2, 3, 4; 4–1 in tours 1, 2, 4. Each is in three of the four.
    expect(m.tour!.agreement).toEqual([0.75, 0.75, 0.75, 0.75]);
    expect(m.tour!.bestRoute).toEqual([0, 1, 2, 3]);
  });

  test('when several tours tie for best the first in the population is the best tour', () => {
    const m = metricsOfProblem(stateOf(line, ['1 2 4 3', '1 2 3 4']), line);
    expect(m.tour!.bestRoute).toEqual([0, 1, 3, 2]);
    // the best tour 1 2 4 3 has edges 1–2, 2–4, 4–3, 3–1; the other tour 1 2 3 4 has 1–2 and 3–4 (= 4–3) too, but not 2–4 or 3–1
    expect(m.tour!.agreement).toEqual([1, 0.5, 1, 0.5]);
  });

  test('the diversity equals the mean over every pair of one minus the share of edges the two tours have in common', () => {
    const n = 9;
    const problem = tourLine(n);
    for (let seed = 1; seed <= 10; seed++) {
      const { population } = initialize(problem, { kind: 'random', size: 7 }, createRng(seed));
      let sum = 0;
      let pairs = 0;
      for (let a = 0; a < population.length; a++) {
        for (let b = a + 1; b < population.length; b++) {
          const ea = tourEdgeSet(population[a]!.chromosome);
          const shared = [...tourEdgeSet(population[b]!.chromosome)].filter((e) => ea.has(e)).length;
          sum += 1 - shared / n;
          pairs++;
        }
      }
      const state = { generation: 0, population, nextId: 8, evaluations: 7, bestFitnessSoFar: Math.max(...population.map((i) => i.fitness)), lastImprovementGeneration: 0 };
      expect(metricsOfProblem(state, problem).diversity).toBeCloseTo(sum / pairs, 12);
    }
  });

  test('best, worst, average and best so far are the usual ones, in fitness', () => {
    const m = metricsOfProblem(stateOf(line, ['1 2 3 4', '1 3 2 4']), line);
    expect(m.best).toBe(-6);
    expect(m.worst).toBe(-8);
    expect(m.average).toBe(-7);
    expect(m.bestSoFar).toBe(-6);
    expect(m.evaluations).toBe(2);
  });
});
