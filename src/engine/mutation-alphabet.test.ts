import { describe, expect, test } from 'vitest';
import { mutate, type MutationConfig } from './mutation';
import { scripted } from './test-support';
import { createRng } from '../run/rng';

const perGene = (probability: number): MutationConfig => ({ enabled: true, mode: 'per-gene', probability });
const perIndividual = (probability: number): MutationConfig => ({ enabled: true, mode: 'per-individual', probability });
const one = (chromosome: number[]) => [{ offspring: 1, chromosome }];

describe('binary alphabets are unchanged', () => {
  test('with 2 symbols a changed gene becomes the other symbol and nothing extra is drawn or recorded', () => {
    const rng = scripted(0.01, 0.9, 0.01);
    const { mutated, events } = mutate(one([0, 1, 1]), perGene(0.05), rng, 2);
    expect(mutated[0]!.chromosome).toEqual([1, 1, 0]);
    expect(rng.used).toBe(3);
    expect(events[0]).not.toHaveProperty('replacements');
  });

  test('the alphabet size defaults to 2', () => {
    expect(mutate(one([0, 1]), perGene(1), scripted(0, 0)).mutated[0]!.chromosome).toEqual([1, 0]);
  });
});

describe('a gene is replaced by a different symbol', () => {
  test('per gene: all the draws u come first, then one replacement draw r for each changed gene, in gene order', () => {
    // genes 1 and 3 change (u below 0.1). Alphabet of 4: gene 1 is symbol 2, so the others are 0, 1, 3; r = 0.5 gives
    // index 1, which is symbol 1. Gene 3 is symbol 0, so the others are 1, 2, 3; r = 0.9 gives index 2, which is symbol 3.
    const rng = scripted(0.05, 0.5, 0.05, 0.5, 0.9);
    const { mutated, events } = mutate(one([2, 3, 0]), perGene(0.1), rng, 4);
    expect(rng.used).toBe(5);
    expect(mutated[0]!.chromosome).toEqual([1, 3, 3]);
    expect(events[0]!.flipped).toEqual([1, 3]);
    expect(events[0]!.geneDraws!.map((d) => d.u)).toEqual([0.05, 0.5, 0.05]);
    expect(events[0]!.replacements).toEqual([
      { gene: 1, r: 0.5, from: 2, to: 1 },
      { gene: 3, r: 0.9, from: 0, to: 3 },
    ]);
  });

  test('per individual: the individual draw, then the draw that chooses the gene, then the replacement draw', () => {
    const rng = scripted(0.2, 0.5, 0.0);
    const { mutated, events } = mutate(one([1, 1, 1, 1]), perIndividual(0.3), rng, 3);
    expect(rng.used).toBe(3);
    expect(events[0]!.chosenGene).toEqual({ gene: 3, r: 0.5 });
    expect(mutated[0]!.chromosome).toEqual([1, 1, 0, 1]); // symbol 1 with r = 0 becomes the first other symbol, 0
    expect(events[0]!.replacements).toEqual([{ gene: 3, r: 0, from: 1, to: 0 }]);
  });

  test('an offspring that is not mutated draws no replacement', () => {
    const rng = scripted(0.9);
    const { events } = mutate(one([0, 1, 2]), perIndividual(0.3), rng, 3);
    expect(rng.used).toBe(1);
    expect(events[0]).not.toHaveProperty('replacements');
    const rng2 = scripted(0.9, 0.9, 0.9);
    expect(mutate(one([0, 1, 2]), perGene(0.3), rng2, 3).events[0]).not.toHaveProperty('replacements');
    expect(rng2.used).toBe(3);
  });

  test.each([3, 27])('the edges of the draw, with %i symbols: r = 0 is the first other symbol and r just below 1 the last', (k) => {
    for (const from of [0, 1, k - 2, k - 1]) {
      const others = Array.from({ length: k }, (_, s) => s).filter((s) => s !== from);
      const first = mutate(one([from]), perGene(1), scripted(0, 0), k).mutated[0]!.chromosome[0];
      const last = mutate(one([from]), perGene(1), scripted(0, 0.9999999), k).mutated[0]!.chromosome[0];
      expect(first).toBe(others[0]);
      expect(last).toBe(others[others.length - 1]);
    }
  });

  test.each([3, 27])('with %i symbols a changed gene never keeps its symbol, whatever the draw', (k) => {
    const rng = createRng(5);
    for (let n = 0; n < 2000; n++) {
      const from = Math.floor(rng.next() * k);
      const { mutated } = mutate(one([from]), perGene(1), rng, k);
      expect(mutated[0]!.chromosome[0]).not.toBe(from);
      expect(mutated[0]!.chromosome[0]).toBeGreaterThanOrEqual(0);
      expect(mutated[0]!.chromosome[0]).toBeLessThan(k);
    }
  });

  test('genes that did not change are untouched, and the input chromosome is never modified', () => {
    const input = [4, 5, 6, 7];
    const { mutated } = mutate(one(input), perGene(0.5), scripted(0.9, 0.1, 0.9, 0.1, 0.5, 0.5), 9);
    expect(mutated[0]!.chromosome[0]).toBe(4);
    expect(mutated[0]!.chromosome[2]).toBe(6);
    expect(input).toEqual([4, 5, 6, 7]);
    expect(mutated[0]!.chromosome).not.toBe(input);
  });

  test('the draws are in a fixed order across several offspring: each offspring finishes its replacements before the next begins', () => {
    // offspring 1: u = 0.0 (gene 1 changes), 0.5 (no); then r = 0.5. offspring 2: u = 0.9 (no), 0.0 (gene 2 changes); then r = 0.5
    const rng = scripted(0.0, 0.5, 0.5, 0.9, 0.0, 0.5);
    const { mutated } = mutate([{ offspring: 1, chromosome: [0, 0] }, { offspring: 2, chromosome: [0, 0] }], perGene(0.1), rng, 3);
    expect(rng.used).toBe(6);
    expect(mutated.map((m) => m.chromosome)).toEqual([[2, 0], [0, 2]]);
  });
});

describe('a switched-off mutation and refusals', () => {
  test('switched off: nothing is drawn, whatever the alphabet', () => {
    const rng = scripted();
    const { mutated, events } = mutate(one([2, 1, 0]), { enabled: false, mode: 'per-gene', probability: 1 }, rng, 5);
    expect(mutated[0]!.chromosome).toEqual([2, 1, 0]);
    expect(events[0]!.decision).toBe('bypassed');
  });

  test('an alphabet of fewer than 2 symbols cannot be mutated, and says so', () => {
    for (const k of [0, 1, 2.5]) expect(() => mutate(one([0]), perGene(0.5), scripted(0), k)).toThrow('at least 2 symbols');
  });
});

describe('rates and uniformity over many draws', () => {
  const sigma = (n: number, p: number) => Math.sqrt(n * p * (1 - p));

  test.each([3, 27])('per gene, %i symbols: about pm of all genes change, and the new symbols are uniform over the other symbols', (k) => {
    const rng = createRng(21);
    const pm = 0.2;
    const length = 20;
    const offspring = Array.from({ length: 4000 }, (_, i) => ({ offspring: i + 1, chromosome: Array.from({ length }, () => 0) }));
    const { mutated } = mutate(offspring, perGene(pm), rng, k);
    const total = 4000 * length;
    const changed = mutated.flatMap((m) => [...m.chromosome]).filter((g) => g !== 0);
    expect(Math.abs(changed.length - total * pm)).toBeLessThan(5 * sigma(total, pm));
    const counts = new Array<number>(k).fill(0);
    for (const g of changed) counts[g]!++;
    expect(counts[0]).toBe(0);
    for (let s = 1; s < k; s++) expect(Math.abs(counts[s]! - changed.length / (k - 1))).toBeLessThan(5 * sigma(changed.length, 1 / (k - 1)));
  });

  test.each([3, 27])('per individual, %i symbols: about pm of offspring change, exactly one gene each, spread evenly over the genes', (k) => {
    const rng = createRng(22);
    const pm = 0.4;
    const length = 6;
    const offspring = Array.from({ length: 6000 }, (_, i) => ({ offspring: i + 1, chromosome: Array.from({ length }, () => 0) }));
    const { mutated } = mutate(offspring, perIndividual(pm), rng, k);
    const changedOnes = mutated.filter((m) => m.chromosome.some((g) => g !== 0));
    expect(Math.abs(changedOnes.length - 6000 * pm)).toBeLessThan(5 * sigma(6000, pm));
    for (const m of changedOnes) expect(m.chromosome.filter((g) => g !== 0)).toHaveLength(1);
    const perGeneCount = Array.from({ length }, (_, g) => changedOnes.filter((m) => m.chromosome[g] !== 0).length);
    for (const c of perGeneCount) expect(Math.abs(c - changedOnes.length / length)).toBeLessThan(5 * sigma(changedOnes.length, 1 / length));
  });
});
