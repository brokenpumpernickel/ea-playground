import { describe, expect, test } from 'vitest';
import { formatBits } from './chromosome';
import { crossover, type CrossoverConfig } from './crossover';
import { goldberg } from './goldberg';
import { initialize, type Individual } from './initialize';
import { pair } from './pairing';
import { createRng } from '../run/rng';
import { scripted } from './test-support';

const textbook = (): Individual[] =>
  initialize(goldberg, { kind: 'explicit', chromosomes: ['01101', '11000', '01000', '10011'] }, createRng(1)).population;

const onePoint: CrossoverConfig = { enabled: true, operator: 'one-point', probability: 0.8 };

describe('one-point crossover and the per-pair decision (the mock’s worked example)', () => {
  // The mating pool 2, 1, 4, 2 gives pairs (11000 × 01101) and (10011 × 11000).
  const pairs = pair([2, 1, 4, 2], 4).pairs;

  // pair 1: u = 0.41 (< 0.8, recombine), cut draw 0.8 → cut after gene 1 + floor(0.8 × 4) = 4
  // pair 2: u = 0.93 (≥ 0.8, bypass)
  const run = () => crossover(textbook(), pairs, onePoint, scripted(0.41, 0.8, 0.93));

  test('a recombined pair swaps the genes after the cut (Goldberg’s example: 11000 × 01101 cut after gene 4)', () => {
    const { offspring } = run();
    expect(formatBits(offspring[0]!.chromosome)).toBe('11001');
    expect(formatBits(offspring[1]!.chromosome)).toBe('01100');
    expect(offspring[0]!.sources).toEqual(['A', 'A', 'A', 'A', 'B']);
    expect(offspring[1]!.sources).toEqual(['B', 'B', 'B', 'B', 'A']);
  });

  test('a pair whose draw is not below pc is a bypass: the children are copies of parent A and parent B', () => {
    const { offspring } = run();
    expect(offspring.slice(2).map((c) => formatBits(c.chromosome))).toEqual(['10011', '11000']);
    expect(offspring[2]!.sources).toEqual(['A', 'A', 'A', 'A', 'A']);
    expect(offspring[3]!.sources).toEqual(['B', 'B', 'B', 'B', 'B']);
  });

  test('offspring are numbered from 1 and know their pair', () => {
    const { offspring } = run();
    expect(offspring.map((c) => [c.offspring, c.pair])).toEqual([[1, 1], [2, 1], [3, 2], [4, 2]]);
  });

  test('each pair records its draw, decision and cut', () => {
    const { events } = run();
    expect(events[0]).toMatchObject({
      stage: 'crossover', kind: 'pair', pair: 1, parentAId: 2, parentBId: 1, operator: 'one-point',
      decision: 'recombined', draw: { u: 0.41, threshold: 0.8 }, cuts: [4],
    });
    expect(events[1]).toMatchObject({
      pair: 2, parentAId: 4, parentBId: 2, decision: 'bypassed', reason: 'draw-failed', draw: { u: 0.93, threshold: 0.8 },
    });
    expect(events[1]).not.toHaveProperty('cuts');
  });
});

describe('two-point and uniform crossover', () => {
  // With parent A all zeros and parent B all ones, child 1 shows exactly which genes were swapped in from B.
  const zerosAndOnes = (): Individual[] =>
    initialize(goldberg, { kind: 'explicit', chromosomes: ['00000', '11111'] }, createRng(1)).population;
  const pairs = pair([1, 2], 2).pairs;
  const config = (operator: CrossoverConfig['operator']): CrossoverConfig => ({ enabled: true, operator, probability: 1 });
  const children = (operator: CrossoverConfig['operator'], ...draws: number[]) => {
    const { offspring, events } = crossover(zerosAndOnes(), pairs, config(operator), scripted(...draws));
    return { child1: formatBits(offspring[0]!.chromosome), child2: formatBits(offspring[1]!.chromosome), event: events[0]! };
  };

  test('two-point swaps the genes between two distinct cuts', () => {
    // first cut: 1 + floor(0.3 × 4) = 2; second cut drawn from the other positions [1, 3, 4]: index floor(0.5 × 3) = 1 → 3
    const { child1, child2, event } = children('two-point', 0.1, 0.3, 0.5);
    expect([child1, child2]).toEqual(['00100', '11011']);
    expect(event.cuts).toEqual([2, 3]);
  });

  test('two-point sorts its cuts when the second draw lands before the first', () => {
    // first cut: 1 + floor(0.9 × 4) = 4; second cut from [1, 2, 3]: index 0 → 1; sorted cuts 1 and 4
    const { child1, child2, event } = children('two-point', 0.1, 0.9, 0.0);
    expect([child1, child2]).toEqual(['01110', '10001']);
    expect(event.cuts).toEqual([1, 4]);
  });

  test('uniform swaps every gene whose draw is below 0.5, and records the mask', () => {
    const { child1, child2, event } = children('uniform', 0.1, 0.1, 0.9, 0.4, 0.6, 0.5);
    expect([child1, child2]).toEqual(['10100', '01011']);
    expect(event.mask).toEqual([true, false, true, false, false]);
    expect(event).not.toHaveProperty('cuts');
  });

  test('the sources of the two children are always complementary', () => {
    const { offspring } = crossover(zerosAndOnes(), pairs, config('uniform'), createRng(4));
    offspring[0]!.sources.forEach((s, g) => expect(offspring[1]!.sources[g]).toBe(s === 'A' ? 'B' : 'A'));
  });
});

describe('the crossover switch and the probability extremes', () => {
  const pairs = pair([2, 1, 4, 2], 4).pairs;
  const off: CrossoverConfig = { enabled: false, operator: 'one-point', probability: 0.8 };

  test('with crossover switched off nothing is drawn, and every pair is a recorded bypass of copies', () => {
    const rng = scripted(); // any draw would throw
    const { offspring, events } = crossover(textbook(), pairs, off, rng);

    expect(rng.used).toBe(0);
    expect(offspring.map((c) => formatBits(c.chromosome))).toEqual(['11000', '01101', '10011', '11000']);
    for (const event of events) {
      expect(event).toMatchObject({ decision: 'bypassed', reason: 'switched-off' });
      expect(event).not.toHaveProperty('draw');
    }
  });

  test('probability 0 always bypasses, and probability 1 always recombines, even for the largest possible draw', () => {
    const never = crossover(textbook(), pairs, { ...onePoint, probability: 0 }, scripted(0, 0));
    expect(never.events.map((e) => e.decision)).toEqual(['bypassed', 'bypassed']);

    const largest = 1 - 2 ** -53;
    const always = crossover(textbook(), pairs, { ...onePoint, probability: 1 }, scripted(largest, 0.5, largest, 0.5));
    expect(always.events.map((e) => e.decision)).toEqual(['recombined', 'recombined']);
  });

  test('a draw exactly equal to the probability is a bypass (recombine only when u < pc)', () => {
    const { events } = crossover(textbook(), pairs.slice(0, 1), onePoint, scripted(0.8));
    expect(events[0]!.decision).toBe('bypassed');
  });
});

describe('draw order', () => {
  const pairs = pair([2, 1, 4, 2], 4).pairs;
  const draws = (operator: CrossoverConfig['operator'], u: number) => {
    const rng = scripted(...Array<number>(20).fill(u));
    crossover(textbook(), pairs.slice(0, 1), { enabled: true, operator, probability: 0.5 }, rng);
    return rng.used;
  };

  test('each pair draws u first, then only the operator’s draws when it recombines', () => {
    expect(draws('one-point', 0.9)).toBe(1); // bypass: u only
    expect(draws('one-point', 0.1)).toBe(2); // u + one cut
    expect(draws('two-point', 0.1)).toBe(3); // u + two cuts
    expect(draws('uniform', 0.1)).toBe(1 + 5); // u + one draw per gene
  });

  test('the same seed gives the same offspring, and later stages continue the same random sequence', () => {
    const run = (seed: number) => crossover(textbook(), pairs, onePoint, createRng(seed));
    expect(run(5)).toEqual(run(5));

    const reference = createRng(31);
    const sequence = Array.from({ length: 8 }, () => reference.next());
    const rng = createRng(31);
    const { events } = crossover(textbook(), pairs, onePoint, rng);
    const consumed = events.reduce((n, e) => n + (e.decision === 'recombined' ? 2 : 1), 0);
    expect(rng.next()).toBe(sequence[consumed]);
  });
});

describe('children never share mutable state with their parents or each other', () => {
  const asMutable = (c: readonly number[]) => c as number[];

  test('bypass children are fresh copies: changing one leaves the parent and its sibling alone', () => {
    const population = textbook();
    const { offspring } = crossover(population, pair([2, 1], 2).pairs, { ...onePoint, enabled: false }, scripted());
    const [first, second] = offspring;
    const parentA = population.find((i) => i.id === 2)!;
    const parentB = population.find((i) => i.id === 1)!;

    expect(first!.chromosome).not.toBe(parentA.chromosome);
    expect(second!.chromosome).not.toBe(parentB.chromosome);
    asMutable(first!.chromosome)[0] = 0;
    expect(formatBits(parentA.chromosome)).toBe('11000');
    expect(formatBits(second!.chromosome)).toBe('01101');
  });

  test('when both parents are the same individual, the two children are still separate arrays', () => {
    const population = textbook();
    const { offspring } = crossover(population, pair([3, 3], 2).pairs, { ...onePoint, enabled: false }, scripted());
    expect(offspring[0]!.chromosome).not.toBe(offspring[1]!.chromosome);
    asMutable(offspring[0]!.chromosome)[1] = 1;
    expect(formatBits(offspring[1]!.chromosome)).toBe('01000');
    expect(formatBits(population.find((i) => i.id === 3)!.chromosome)).toBe('01000');
  });

  test('changing a returned offspring afterwards leaves the event’s record of the child alone', () => {
    const population = textbook();
    const { offspring, events } = crossover(population, pair([2, 1], 2).pairs, { ...onePoint, probability: 1 }, scripted(0.1, 0.8));
    (offspring[0]!.chromosome as number[])[0] = 0; // child 1 is 11001
    expect(formatBits(events[0]!.children[0]!.chromosome)).toBe('11001');
    expect(events[0]!.children[0]!.chromosome).not.toBe(offspring[0]!.chromosome);
  });

  test('recombined children are fresh arrays too', () => {
    const population = textbook();
    const { offspring } = crossover(population, pair([2, 1], 2).pairs, { ...onePoint, probability: 1 }, scripted(0.1, 0.5));
    expect(population.some((i) => offspring.some((c) => c.chromosome === i.chromosome))).toBe(false);
  });
});

describe('odd offspring counts', () => {
  test('the last pair’s second child is recorded as discarded and left out of the offspring', () => {
    const pairs = pair([2, 1, 4, 2, 3, 3], 5).pairs;
    const { offspring, events } = crossover(textbook(), pairs, onePoint, createRng(2));

    expect(offspring.map((c) => c.offspring)).toEqual([1, 2, 3, 4, 5]);
    expect(events[2]!.children.map((c) => [c.offspring, c.discarded])).toEqual([[5, false], [6, true]]);
    expect(events.slice(0, 2).every((e) => e.children.every((c) => !c.discarded))).toBe(true);
  });
});

describe('validation', () => {
  const pairs = pair([2, 1], 2).pairs;
  const attempt = (config: CrossoverConfig, population = textbook(), p = pairs) => () => crossover(population, p, config, createRng(1));
  const tiny = (length: number): Individual[] =>
    initialize(
      { chromosomeLength: length, evaluate: () => ({ decoded: 0, objective: 0, fitness: 0 }) },
      { kind: 'explicit', chromosomes: ['0'.repeat(length), '1'.repeat(length)] },
      createRng(1),
    ).population;

  test.each([-0.1, 1.1, Number.NaN])('rejects a probability of %s', (probability) => {
    expect(attempt({ ...onePoint, probability })).toThrow('Crossover probability must be between 0 and 1');
  });

  test('rejects a chromosome too short for the operator, saying how many genes it needs', () => {
    const p = pair([1, 2], 2).pairs;
    expect(attempt(onePoint, tiny(1), p)).toThrow('One-point crossover needs chromosomes of at least 2 genes, but they have 1');
    expect(attempt({ ...onePoint, operator: 'two-point' }, tiny(2), p)).toThrow('Two-point crossover needs chromosomes of at least 3 genes, but they have 2');
    expect(attempt({ ...onePoint, operator: 'uniform' }, tiny(1), p)).not.toThrow();
  });

  test('rejects a pair that refers to an individual who is not in the population', () => {
    expect(attempt(onePoint, textbook(), pair([2, 9], 2).pairs)).toThrow('Pair 1 refers to individual 9, who is not in the population');
  });

  test('a switched-off crossover is not held to the operator’s length requirement', () => {
    expect(attempt({ ...onePoint, enabled: false }, tiny(1), pair([1, 2], 2).pairs)).not.toThrow();
  });
});

describe('rates over many pairs', () => {
  const manyPairs = (n: number) => pair(Array.from({ length: n }, () => [1, 2]).flat(), 2 * n).pairs;
  const zerosAndOnes = initialize(goldberg, { kind: 'explicit', chromosomes: ['00000', '11111'] }, createRng(1)).population;

  test('the fraction of pairs that recombine matches the probability', () => {
    const { events } = crossover(zerosAndOnes, manyPairs(5000), { ...onePoint, probability: 0.3 }, createRng(17));
    const fraction = events.filter((e) => e.decision === 'recombined').length / events.length;
    expect(Math.abs(fraction - 0.3)).toBeLessThan(0.03);
  });

  test('one-point cuts are spread evenly over the possible positions 1 to L − 1', () => {
    const { events } = crossover(zerosAndOnes, manyPairs(8000), { ...onePoint, probability: 1 }, createRng(23));
    for (const position of [1, 2, 3, 4]) {
      const share = events.filter((e) => e.cuts?.[0] === position).length / events.length;
      expect(Math.abs(share - 0.25)).toBeLessThan(0.03);
    }
  });

  test('two-point cuts are always two different positions in range, and uniform masks are about half swapped', () => {
    const two = crossover(zerosAndOnes, manyPairs(2000), { ...onePoint, operator: 'two-point', probability: 1 }, createRng(5));
    for (const e of two.events) {
      const [lo, hi] = e.cuts!;
      expect(lo).toBeGreaterThanOrEqual(1);
      expect(hi).toBeLessThanOrEqual(4);
      expect(lo).toBeLessThan(hi!);
    }
    const uniform = crossover(zerosAndOnes, manyPairs(2000), { ...onePoint, operator: 'uniform', probability: 1 }, createRng(6));
    const swapped = uniform.events.flatMap((e) => e.mask!).filter(Boolean).length / (2000 * 5);
    expect(Math.abs(swapped - 0.5)).toBeLessThan(0.02);
  });
});
