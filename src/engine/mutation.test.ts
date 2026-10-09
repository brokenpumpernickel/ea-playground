import { describe, expect, test } from 'vitest';
import { formatBits, parseBits, type Chromosome } from './chromosome';
import { mutate, type MutationConfig } from './mutation';
import { createRng } from './rng';
import { scripted } from './test-support';

const offspringOf = (...chromosomes: string[]) =>
  chromosomes.map((text, k) => ({ offspring: k + 1, chromosome: parseBits(text) }));
const texts = (result: { mutated: readonly { chromosome: Chromosome }[] }) => result.mutated.map((m) => formatBits(m.chromosome));

const perGene: MutationConfig = { enabled: true, mode: 'per-gene', probability: 0.05 };

describe('per-gene mutation (the mock’s worked example)', () => {
  // One draw per gene, offspring by offspring. Only offspring 3, gene 2 draws below pm = 0.05.
  const draws = [
    0.62, 0.91, 0.27, 0.55, 0.88,
    0.44, 0.73, 0.96, 0.18, 0.35,
    0.81, 0.03, 0.67, 0.49, 0.22,
    0.59, 0.14, 0.77, 0.92, 0.66,
  ];
  const run = () => mutate(offspringOf('11001', '01100', '10011', '11000'), perGene, scripted(...draws));

  test('exactly the genes whose draw is below pm are flipped', () => {
    const result = run();
    expect(texts(result)).toEqual(['11001', '01100', '11011', '11000']);
    expect(result.mutated.map((m) => m.flipped)).toEqual([[], [], [2], []]);
    expect(result.mutated.map((m) => m.offspring)).toEqual([1, 2, 3, 4]);
  });

  test('every draw is recorded with its gene, its value and whether it flipped', () => {
    const [, , third] = run().events;
    expect(third).toMatchObject({
      stage: 'mutation', kind: 'individual', offspring: 3, mode: 'per-gene', decision: 'mutated', threshold: 0.05,
      before: [1, 0, 0, 1, 1], after: [1, 1, 0, 1, 1], flipped: [2],
    });
    expect(third!.geneDraws).toEqual([
      { gene: 1, u: 0.81, flipped: false },
      { gene: 2, u: 0.03, flipped: true },
      { gene: 3, u: 0.67, flipped: false },
      { gene: 4, u: 0.49, flipped: false },
      { gene: 5, u: 0.22, flipped: false },
    ]);
  });

  test('an offspring where no draw succeeds is recorded as unchanged, with all its draws', () => {
    const [first] = run().events;
    expect(first).toMatchObject({ offspring: 1, decision: 'unchanged', flipped: [] });
    expect(first!.geneDraws).toHaveLength(5);
  });
});

describe('per-individual mutation', () => {
  const config: MutationConfig = { enabled: true, mode: 'per-individual', probability: 0.2 };
  // offspring 1: u = 0.9 (not < 0.2) → unchanged, no more draws
  // offspring 2: u = 0.1 → mutated; gene draw 0.5 → gene 1 + floor(0.5 × 5) = 3
  // offspring 3: u = 0.15 → mutated; gene draw 0.99 → gene 1 + floor(0.99 × 5) = 5
  const draws = [0.9, 0.1, 0.5, 0.15, 0.99];
  const run = () => {
    const rng = scripted(...draws);
    return { rng, ...mutate(offspringOf('11001', '01100', '10011'), config, rng) };
  };

  test('one draw decides whether an offspring is mutated, then one more picks the single gene that flips', () => {
    const result = run();
    expect(texts(result)).toEqual(['11001', '01000', '10010']);
    expect(result.mutated.map((m) => m.flipped)).toEqual([[], [3], [5]]);
    expect(result.rng.used).toBe(5);
  });

  test('records the individual draw and the chosen gene, and no per-gene draws', () => {
    const [first, second] = run().events;
    expect(first).toMatchObject({ mode: 'per-individual', decision: 'unchanged', threshold: 0.2, individualDraw: { u: 0.9 }, flipped: [] });
    expect(first).not.toHaveProperty('chosenGene');
    expect(second).toMatchObject({ decision: 'mutated', individualDraw: { u: 0.1 }, chosenGene: { gene: 3, r: 0.5 }, flipped: [3] });
    expect(second).not.toHaveProperty('geneDraws');
  });

  test('per-gene events have no individual draw', () => {
    const [event] = mutate(offspringOf('11001'), perGene, scripted(1, 1, 1, 1, 1)).events;
    expect(event).not.toHaveProperty('individualDraw');
  });
});

describe('the mutation switch', () => {
  const off = (mode: MutationConfig['mode']): MutationConfig => ({ enabled: false, mode, probability: 0.5 });

  test.each(['per-gene', 'per-individual'] as const)('%s: nothing is drawn, every chromosome is unchanged, and each offspring is a recorded bypass', (mode) => {
    const rng = scripted(); // any draw would throw
    const result = mutate(offspringOf('11001', '01100'), off(mode), rng);

    expect(rng.used).toBe(0);
    expect(texts(result)).toEqual(['11001', '01100']);
    for (const event of result.events) {
      expect(event).toMatchObject({ decision: 'bypassed', reason: 'switched-off', flipped: [] });
      expect(event).not.toHaveProperty('geneDraws');
      expect(event).not.toHaveProperty('individualDraw');
    }
  });

  test('a switched-off mutation is still refused a nonsense probability', () => {
    expect(() => mutate(offspringOf('11001'), { ...off('per-gene'), probability: 2 }, scripted())).toThrow(
      'Mutation probability must be between 0 and 1',
    );
  });
});

describe('probability extremes and edges', () => {
  test('per-gene: probability 0 flips nothing and probability 1 flips every gene, whatever the draw', () => {
    const largest = 1 - 2 ** -53;
    const none = mutate(offspringOf('10101'), { ...perGene, probability: 0 }, scripted(0, 0, 0, 0, 0));
    expect(texts(none)).toEqual(['10101']);

    const all = mutate(offspringOf('10101'), { ...perGene, probability: 1 }, scripted(0, largest, 0.5, 0, largest));
    expect(texts(all)).toEqual(['01010']);
    expect(all.mutated[0]!.flipped).toEqual([1, 2, 3, 4, 5]);
  });

  test('per-individual: probability 1 always mutates exactly one gene, and probability 0 never does', () => {
    const always = mutate(offspringOf('00000'), { enabled: true, mode: 'per-individual', probability: 1 }, scripted(0.99, 0.2));
    expect(always.mutated[0]!.flipped).toEqual([2]);
    const never = mutate(offspringOf('00000'), { enabled: true, mode: 'per-individual', probability: 0 }, scripted(0));
    expect(never.mutated[0]!.flipped).toEqual([]);
  });

  test.each(['per-gene', 'per-individual'] as const)('%s: a draw exactly equal to pm does not mutate (u < pm is required)', (mode) => {
    const result = mutate(offspringOf('00000'), { enabled: true, mode, probability: 0.05 }, scripted(0.05, 0.05, 0.05, 0.05, 0.05));
    expect(result.mutated[0]!.flipped).toEqual([]);
  });

  test('the last gene can be chosen in per-individual mode, even for the largest possible draw', () => {
    const result = mutate(offspringOf('00000'), { enabled: true, mode: 'per-individual', probability: 1 }, scripted(0, 1 - 2 ** -53));
    expect(result.mutated[0]!.flipped).toEqual([5]);
  });
});

describe('fresh output', () => {
  test.each(['per-gene', 'per-individual'] as const)('%s: the input is never edited, and no returned chromosome is an input array', (mode) => {
    const input = offspringOf('11001', '01100');
    const snapshot = input.map((o) => formatBits(o.chromosome));
    const result = mutate(input, { enabled: true, mode, probability: 1 }, createRng(3));

    expect(input.map((o) => formatBits(o.chromosome))).toEqual(snapshot);
    result.mutated.forEach((m, k) => expect(m.chromosome).not.toBe(input[k]!.chromosome));
  });

  test('even an unchanged offspring and a bypass come back as new arrays', () => {
    const input = offspringOf('11001');
    const unchanged = mutate(input, { ...perGene, probability: 0 }, createRng(1));
    const bypassed = mutate(input, { ...perGene, enabled: false }, createRng(1));
    expect(unchanged.mutated[0]!.chromosome).not.toBe(input[0]!.chromosome);
    expect(bypassed.mutated[0]!.chromosome).not.toBe(input[0]!.chromosome);
  });

  test('changing a returned chromosome afterwards leaves the events’ record of before and after alone', () => {
    const input = offspringOf('11001');
    const result = mutate(input, { ...perGene, probability: 1 }, createRng(1));
    (result.mutated[0]!.chromosome as number[])[0] = 1; // the mutated chromosome is 00110, so this changes it
    (input[0]!.chromosome as number[])[4] = 0;
    expect(formatBits(result.events[0]!.before)).toBe('11001');
    expect(formatBits(result.events[0]!.after)).toBe('00110');
  });
});

describe('draw order', () => {
  test('per-gene mode draws once per gene for every offspring, flipped or not', () => {
    const rng = scripted(...Array<number>(10).fill(0.9));
    mutate(offspringOf('11001', '01100'), perGene, rng);
    expect(rng.used).toBe(10);
  });

  test('per-individual mode draws once per offspring, plus once more for each one it mutates', () => {
    const rng = scripted(0.9, 0.9, 0.0, 0.5, 0.0, 0.5);
    mutate(offspringOf('11001', '01100', '10011', '11000'), { enabled: true, mode: 'per-individual', probability: 0.5 }, rng);
    // offspring 1: 0.9 (no) · 2: 0.9 (no) · 3: 0.0 (yes) + 0.5 · 4: 0.0 (yes) + 0.5
    expect(rng.used).toBe(6);
  });

  test('the same seed gives the same result, and later stages continue the same sequence', () => {
    const run = (seed: number) => mutate(offspringOf('11001', '01100', '10011'), perGene, createRng(seed));
    expect(run(8)).toEqual(run(8));

    const reference = createRng(12);
    const sequence = Array.from({ length: 20 }, () => reference.next());
    const rng = createRng(12);
    mutate(offspringOf('11001', '01100', '10011'), perGene, rng);
    expect(rng.next()).toBe(sequence[15]);
  });
});

describe('rates over many offspring', () => {
  const many = (n: number) => offspringOf(...Array<string>(n).fill('00000'));

  test('per-gene: about pm of all genes flip', () => {
    const result = mutate(many(4000), { ...perGene, probability: 0.1 }, createRng(41));
    const flips = result.mutated.reduce((n, m) => n + m.flipped.length, 0);
    expect(Math.abs(flips / (4000 * 5) - 0.1)).toBeLessThan(0.01);
  });

  test('per-individual: about pm of offspring are mutated, each with exactly one flip, spread evenly over the genes', () => {
    const result = mutate(many(10000), { enabled: true, mode: 'per-individual', probability: 0.3 }, createRng(43));
    const mutatedOnes = result.mutated.filter((m) => m.flipped.length > 0);

    expect(Math.abs(mutatedOnes.length / 10000 - 0.3)).toBeLessThan(0.02);
    expect(mutatedOnes.every((m) => m.flipped.length === 1)).toBe(true);
    for (let gene = 1; gene <= 5; gene++) {
      const share = mutatedOnes.filter((m) => m.flipped[0] === gene).length / mutatedOnes.length;
      expect(Math.abs(share - 0.2)).toBeLessThan(0.03);
    }
  });
});

describe('validation', () => {
  test.each([-0.1, 1.1, Number.NaN])('rejects a probability of %s', (probability) => {
    expect(() => mutate(offspringOf('11001'), { ...perGene, probability }, scripted())).toThrow('Mutation probability must be between 0 and 1');
  });

  test('an empty list of offspring is fine and draws nothing', () => {
    const rng = scripted();
    expect(mutate([], perGene, rng)).toEqual({ mutated: [], events: [] });
    expect(rng.used).toBe(0);
  });
});
