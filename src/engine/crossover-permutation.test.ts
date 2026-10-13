import { describe, expect, test } from 'vitest';
import { formatTour, parseTour } from './chromosome';
import { crossover, minimumGenes, permutationOperators, type CrossoverConfig, type CrossoverOperator } from './crossover';
import { initialize, type Individual } from './initialize';
import { pair } from './pairing';
import { scripted, tourLine } from './test-support';
import { createRng } from '../run/rng';

const population = (texts: string[]): Individual[] => initialize(tourLine(parseTour(texts[0]!)!.length), { kind: 'explicit', chromosomes: texts }, createRng(1)).population;
const config = (operator: CrossoverOperator, probability = 1): CrossoverConfig => ({ enabled: true, operator, probability });
const cross = (texts: string[], operator: CrossoverOperator, draws: number[], probability = 1) => {
  const rng = scripted(...draws);
  const result = crossover(population(texts), pair([1, 2], 2).pairs, config(operator, probability), rng, undefined, true);
  return { ...result, rng, a: parseTour(texts[0]!)!, b: parseTour(texts[1]!)!, child: (k: 0 | 1) => formatTour(result.offspring[k]!.chromosome) };
};

// the textbook parents of Eiben and Smith, with the cuts after genes 3 and 7: slices 4 5 6 7 in A and 8 2 6 5 in B
const A = '1 2 3 4 5 6 7 8 9';
const B = '9 3 7 8 2 6 5 1 4';
// first cut: 1 + ⌊0.3 × 8⌋ = 3; the other cut is the ⌊0.8 × 7⌋ = 5th of the positions 1, 2, 4, 5, 6, 7, 8, which is 7
const textbookDraws = [0.1, 0.3, 0.8];

describe('order crossover (OX), worked by hand on the textbook parents', () => {
  test('the child keeps A’s slice in place and fills the rest, from after the second cut, in the order B visits the missing cities', () => {
    // B from after position 7 reads 1 4 9 3 7 8 2 6 5; without 4 5 6 7 that is 1 9 3 8 2, placed at positions 8, 9, 1, 2, 3
    const r = cross([A, B], 'ox', textbookDraws);
    expect(r.child(0)).toBe('3 8 2 4 5 6 7 1 9');
    // O2 keeps B’s slice 8 2 6 5 and fills from A: after position 7 A reads 8 9 1 2 3 4 5 6 7; without 8 2 6 5: 9 1 3 4 7, placed at 8, 9, 1, 2, 3
    expect(r.child(1)).toBe('3 4 7 8 2 6 5 9 1');
    expect(r.rng.used).toBe(3);
  });

  test('the event records the cuts, the draw and, for each child, the cities filled from the other parent and where they went', () => {
    const e = cross([A, B], 'ox', textbookDraws).events[0]!;
    expect(e).toMatchObject({ operator: 'ox', decision: 'recombined', draw: { u: 0.1, threshold: 1 }, cuts: [3, 7] });
    expect(e.fill!).toHaveLength(2);
    expect(e.fill![0]).toEqual({ cities: [0, 8, 2, 7, 1], positions: [7, 8, 0, 1, 2] }); // 1 9 3 8 2 (shown from 1: city numbers minus 1) at positions 8 9 1 2 3
    expect(e.fill![1]).toEqual({ cities: [8, 0, 2, 3, 6], positions: [7, 8, 0, 1, 2] });
    expect(e.children[0]!.sources).toEqual(['B', 'B', 'B', 'A', 'A', 'A', 'A', 'B', 'B']);
    expect(e.children[1]!.sources).toEqual(['A', 'A', 'A', 'B', 'B', 'B', 'B', 'A', 'A']);
    expect(e).not.toHaveProperty('mapping');
    expect(e).not.toHaveProperty('cycles');
  });
});

describe('partial-mapped crossover (PMX), worked by hand on the textbook parents', () => {
  test('the child takes B’s slice in place and A elsewhere, a conflicting city following the mapping to a free one', () => {
    // mapping 8 ↔ 4, 2 ↔ 5, 6 ↔ 6, 5 ↔ 7: A’s 2 is in B’s slice, 2 → 5 → 7 (free); A’s 8 → 4 (free)
    const r = cross([A, B], 'pmx', textbookDraws);
    expect(r.child(0)).toBe('1 7 3 8 2 6 5 4 9');
    // O2 takes A’s slice 4 5 6 7 and B elsewhere: B’s 7 → 5 → 2 (free); B’s 4 → 8 (free)
    expect(r.child(1)).toBe('9 3 2 4 5 6 7 1 8');
    expect(r.rng.used).toBe(3);
  });

  test('the event records the mapping of each child and every conflict with its chain', () => {
    const e = cross([A, B], 'pmx', textbookDraws).events[0]!;
    expect(e).toMatchObject({ operator: 'pmx', cuts: [3, 7] });
    expect(e.mapping!).toHaveLength(2);
    // O1: the cities it takes from B’s slice and the cities of A’s slice they displace, in slice order (0-based: B 8 2 6 5 → 7 1 5 4, A 4 5 6 7 → 3 4 5 6)
    expect(e.mapping![0]!.pairs).toEqual([{ taken: 7, displaced: 3 }, { taken: 1, displaced: 4 }, { taken: 5, displaced: 5 }, { taken: 4, displaced: 6 }]);
    expect(e.mapping![0]!.followed).toEqual([
      { position: 1, chain: [1, 4, 6], city: 6 }, // 2 → 5 → 7 shown from 1
      { position: 7, chain: [7, 3], city: 3 }, // 8 → 4
    ]);
    expect(e.mapping![1]!.followed).toEqual([
      { position: 2, chain: [6, 4, 1], city: 1 }, // B's 7 → 5 → 2
      { position: 8, chain: [3, 7], city: 7 }, // B's 4 → 8
    ]);
    expect(e.children[0]!.sources).toEqual(['A', 'A', 'A', 'B', 'B', 'B', 'B', 'A', 'A']);
    expect(e).not.toHaveProperty('fill');
  });
});

describe('cycle crossover (CX), worked by hand on the textbook parents', () => {
  test('the cycles take their positions from A and from B in turn, and no cut is drawn', () => {
    // cycles of positions: 1 8 4 9 (the cities 1 9 4 8), then 2 3 7 5 (2 3 7 5 ↔ 3 7 5 2), then 6 alone
    const r = cross([A, B], 'cx', [0.1]);
    expect(r.child(0)).toBe('1 3 7 4 2 6 5 8 9');
    expect(r.child(1)).toBe('9 2 3 8 5 6 7 1 4');
    expect(r.rng.used).toBe(1);
  });

  test('the event records the cycles as lists of positions, in the order they were found, and the sources follow them', () => {
    const e = cross([A, B], 'cx', [0.1]).events[0]!;
    expect(e).toMatchObject({ operator: 'cx', decision: 'recombined' });
    expect(e.cycles).toEqual([[0, 8, 3, 7], [1, 2, 6, 4], [5]]);
    expect(e).not.toHaveProperty('cuts');
    expect(e.children[0]!.sources).toEqual(['A', 'B', 'B', 'A', 'B', 'A', 'B', 'A', 'A']);
    expect(e.children[1]!.sources).toEqual(['B', 'A', 'A', 'B', 'A', 'B', 'A', 'B', 'B']);
  });

  test('a pair of parents that make a single cycle has children that are copies of the parents', () => {
    const r = cross(['1 2 3', '2 3 1'], 'cx', [0.1]);
    expect(r.events[0]!.cycles).toEqual([[0, 1, 2]]);
    expect(r.child(0)).toBe('1 2 3');
    expect(r.child(1)).toBe('2 3 1');
  });

  test('identical parents have one cycle of one position each, and the children are the parents', () => {
    const r = cross(['3 1 2', '3 1 2'], 'cx', [0.1]);
    expect(r.events[0]!.cycles).toEqual([[0], [1], [2]]);
    expect(r.child(0)).toBe('3 1 2');
  });
});

describe('the decision to recombine', () => {
  test('a pair draws u first: below pc it is recombined, otherwise it is a bypass with copies and no further draws', () => {
    for (const operator of permutationOperators) {
      const failed = cross([A, B], operator, [0.95], 0.9);
      expect(failed.rng.used, operator).toBe(1);
      expect(failed.events[0]).toMatchObject({ decision: 'bypassed', reason: 'draw-failed', draw: { u: 0.95, threshold: 0.9 } });
      expect(failed.child(0)).toBe(A);
      expect(failed.child(1)).toBe(B);
      expect(failed.events[0]).not.toHaveProperty('cuts');
      expect(failed.events[0]).not.toHaveProperty('cycles');
    }
  });

  test('probability 1 always recombines and probability 0 never does; a switched-off crossover draws nothing', () => {
    expect(cross([A, B], 'ox', textbookDraws, 1).events[0]!.decision).toBe('recombined');
    expect(cross([A, B], 'ox', [0], 0).events[0]!.decision).toBe('bypassed');
    for (const operator of permutationOperators) {
      const rng = scripted();
      const { events, offspring } = crossover(population([A, B]), pair([1, 2], 2).pairs, { enabled: false, operator, probability: 1 }, rng, undefined, true);
      expect(rng.used).toBe(0);
      expect(events[0]).toMatchObject({ decision: 'bypassed', reason: 'switched-off' });
      expect(formatTour(offspring[0]!.chromosome)).toBe(A);
    }
  });

  test('an odd number of offspring drops the last pair’s second child, as for the other operators', () => {
    const { offspring, events } = crossover(population([A, B]), pair([1, 2, 1, 2], 3).pairs, config('cx'), scripted(0.1, 0.1), undefined, true);
    expect(offspring).toHaveLength(3);
    expect(events[1]!.children[1]!.discarded).toBe(true);
  });
});

/** Random permutations of n cities, as the texts a population is made of. */
const randomTours = (n: number, count: number, seed: number): string[] => {
  const rng = createRng(seed);
  return Array.from({ length: count }, () => {
    const tour = Array.from({ length: n }, (_, k) => k);
    for (let i = n - 1; i >= 1; i--) {
      const j = Math.floor(rng.next() * (i + 1));
      [tour[i], tour[j]] = [tour[j]!, tour[i]!];
    }
    return formatTour(tour);
  });
};
const isPermutation = (c: readonly number[], n: number) => c.length === n && [...c].sort((a, b) => a - b).every((v, k) => v === k);

describe('properties over generated parents', () => {
  const sizes = [3, 4, 5, 9, 20, 52];

  test('every child of every operator is a permutation, and the children and the event’s copies share no arrays with the parents or each other', () => {
    for (const n of sizes) {
      for (let seed = 1; seed <= 25; seed++) {
        const texts = randomTours(n, 2, seed);
        const individuals = population(texts);
        for (const operator of permutationOperators) {
          const { offspring, events } = crossover(individuals, pair([1, 2], 2).pairs, config(operator), createRng(seed + 100), undefined, true);
          for (const c of offspring) expect(isPermutation(c.chromosome, n), `${operator} n=${n} seed=${seed}`).toBe(true);
          const arrays = [...individuals.map((i) => i.chromosome), ...offspring.map((c) => c.chromosome), ...events[0]!.children.map((c) => c.chromosome)];
          expect(new Set(arrays).size).toBe(arrays.length);
        }
      }
    }
  });

  test('OX keeps the slice in place and puts the other cities in the other parent’s order, read from after the second cut', () => {
    for (const n of sizes) {
      for (let seed = 1; seed <= 25; seed++) {
        const [ta, tb] = randomTours(n, 2, seed);
        const a = parseTour(ta!)!;
        const b = parseTour(tb!)!;
        const { offspring, events } = crossover(population([ta!, tb!]), pair([1, 2], 2).pairs, config('ox'), createRng(seed), undefined, true);
        const [lo, hi] = events[0]!.cuts!;
        expect(lo!).toBeGreaterThanOrEqual(1);
        expect(hi!).toBeLessThanOrEqual(n - 1);
        expect(hi! - lo!).toBeGreaterThanOrEqual(1);
        const check = (child: readonly number[], keeper: readonly number[], other: readonly number[]) => {
          for (let i = lo!; i < hi!; i++) expect(child[i]).toBe(keeper[i]);
          const slice = new Set(keeper.slice(lo, hi));
          const expected = Array.from({ length: n }, (_, k) => other[(hi! + k) % n]!).filter((c) => !slice.has(c));
          const found = Array.from({ length: n }, (_, k) => (hi! + k) % n).filter((p) => p < lo! || p >= hi!).map((p) => child[p]!);
          expect(found).toEqual(expected);
        };
        check(offspring[0]!.chromosome, a, b);
        check(offspring[1]!.chromosome, b, a);
      }
    }
  });

  test('PMX keeps the other parent’s slice in place, every other city stays where its parent had it unless it conflicts, and every chain ends on a free city', () => {
    for (const n of sizes) {
      for (let seed = 1; seed <= 25; seed++) {
        const [ta, tb] = randomTours(n, 2, seed);
        const a = parseTour(ta!)!;
        const b = parseTour(tb!)!;
        const { offspring, events } = crossover(population([ta!, tb!]), pair([1, 2], 2).pairs, config('pmx'), createRng(seed), undefined, true);
        const [lo, hi] = events[0]!.cuts!;
        const check = (child: readonly number[], keeper: readonly number[], donor: readonly number[], info: NonNullable<(typeof events)[0]['mapping']>[number]) => {
          // keeper supplies the cities outside the slice, donor the slice
          const slice = new Set(donor.slice(lo, hi));
          for (let i = lo!; i < hi!; i++) expect(child[i]).toBe(donor[i]);
          const followed = new Map(info.followed.map((f) => [f.position, f]));
          for (let i = 0; i < n; i++) {
            if (i >= lo! && i < hi!) continue;
            if (!slice.has(keeper[i]!)) {
              expect(child[i]).toBe(keeper[i]);
              expect(followed.has(i)).toBe(false);
            } else {
              const f = followed.get(i)!;
              expect(f.chain[0]).toBe(keeper[i]);
              expect(f.chain.slice(0, -1).every((c) => slice.has(c))).toBe(true); // every step but the last is inside the slice
              expect(slice.has(f.chain[f.chain.length - 1]!)).toBe(false); // the last city is free
              expect(child[i]).toBe(f.city);
            }
          }
        };
        check(offspring[0]!.chromosome, a, b, events[0]!.mapping![0]!);
        check(offspring[1]!.chromosome, b, a, events[0]!.mapping![1]!);
      }
    }
  });

  test('CX copies every position from the parent of its cycle, alternating from A, and the cycles partition the positions', () => {
    for (const n of sizes) {
      for (let seed = 1; seed <= 25; seed++) {
        const [ta, tb] = randomTours(n, 2, seed);
        const a = parseTour(ta!)!;
        const b = parseTour(tb!)!;
        const { offspring, events } = crossover(population([ta!, tb!]), pair([1, 2], 2).pairs, config('cx'), createRng(seed), undefined, true);
        const cycles = events[0]!.cycles!;
        expect([...cycles.flat()].sort((x, y) => x - y)).toEqual(Array.from({ length: n }, (_, k) => k));
        cycles.forEach((positions, k) => {
          for (const p of positions) {
            expect(offspring[0]!.chromosome[p]).toBe(k % 2 === 0 ? a[p] : b[p]);
            expect(offspring[1]!.chromosome[p]).toBe(k % 2 === 0 ? b[p] : a[p]);
          }
          // a cycle holds the same cities in A and in B
          expect(positions.map((p) => a[p]).sort()).toEqual(positions.map((p) => b[p]).sort());
        });
      }
    }
  });

  test('over many pairs the cut points reach every pair of gaps, and the draws are reproducible by seed', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 300; seed++) {
      const { events } = crossover(population(randomTours(5, 2, seed)), pair([1, 2], 2).pairs, config('ox'), createRng(seed), undefined, true);
      seen.add(events[0]!.cuts!.join('-'));
    }
    expect([...seen].sort()).toEqual(['1-2', '1-3', '1-4', '2-3', '2-4', '3-4']); // two distinct gaps out of four, as for two-point crossover
    const run = (s: number) => crossover(population(randomTours(12, 2, 4)), pair([1, 2], 2).pairs, config('pmx'), createRng(s), undefined, true).offspring.map((c) => c.chromosome);
    expect(run(9)).toEqual(run(9));
  });
});

describe('what each operator needs', () => {
  test('OX and PMX need three cities, CX one; with fewer an enabled crossover says so', () => {
    expect(minimumGenes).toMatchObject({ ox: 3, pmx: 3, cx: 1 });
    for (const operator of ['ox', 'pmx'] as const) {
      expect(() => crossover(population(['1 2', '2 1']), pair([1, 2], 2).pairs, config(operator), scripted(0.1), undefined, true)).toThrow(/at least 3 genes, but they have 2/);
    }
    expect(crossover(population(['1 2', '2 1']), pair([1, 2], 2).pairs, config('cx'), scripted(0.1), undefined, true).offspring).toHaveLength(2);
    expect(crossover(population(['1']), pair([1, 1], 2).pairs, config('cx'), scripted(0.1), undefined, true).offspring).toHaveLength(2);
  });

  test('three cities is the smallest tour OX and PMX work on: the slice is one city', () => {
    for (const operator of ['ox', 'pmx'] as const) {
      const r = crossover(population(['1 2 3', '3 1 2']), pair([1, 2], 2).pairs, config(operator), scripted(0.1, 0.1, 0.1), undefined, true);
      expect(r.events[0]!.cuts).toHaveLength(2);
      for (const c of r.offspring) expect(isPermutation(c.chromosome, 3)).toBe(true);
    }
  });

  test('the symbol and real operators are refused for a permutation, and the permutation operators for the other problems, in words', () => {
    const ids = pair([1, 2], 2).pairs;
    for (const operator of ['one-point', 'two-point', 'uniform', 'blx-alpha', 'arithmetic'] as const) {
      expect(() => crossover(population([A, B]), ids, config(operator), scripted(0.1), undefined, true), operator).toThrow(/would repeat and lose cities; choose order, partial-mapped or cycle crossover/);
    }
    for (const operator of permutationOperators) {
      expect(() => crossover(population(['1 2 3', '3 2 1']), ids, config(operator), scripted(0.1)), operator).toThrow(/is for permutation chromosomes; choose one-point, two-point or uniform crossover/);
      expect(() => crossover(population(['1 2 3', '3 2 1']), ids, config(operator), scripted(0.1), [{ lo: 0, hi: 1 }]), operator).toThrow(/is for permutation chromosomes; choose BLX-α, arithmetic/);
    }
  });
});
