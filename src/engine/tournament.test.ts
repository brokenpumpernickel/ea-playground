import { describe, expect, test } from 'vitest';
import { binaryAlphabet } from './chromosome';
import { fitnessColumn } from './problem';
import { goldberg } from './goldberg';
import { initialize, type Individual } from './initialize';
import { createRng } from '../run/rng';
import { tournamentSelect } from './tournament';
import { scripted } from './test-support';

const populationOf = (...chromosomes: string[]): Individual[] =>
  initialize(goldberg, { kind: 'explicit', chromosomes }, scripted()).population;
const textbook = () => populationOf('01101', '11000', '01000', '10011'); // fitness 169, 576, 64, 361

describe('a hand-computed tournament selection (size 2, the textbook population)', () => {
  // contestant = population position floor(r × 4):  0.1 → 0, 0.6 → 2, 0.3 → 1, 0.9 → 3, 0.55 → 2, 0.05 → 0, 0.8 → 3
  const draws = [0.1, 0.6, 0.3, 0.9, 0.55, 0.05, 0.8, 0.3];
  const run = () => tournamentSelect(textbook(), 2, 4, scripted(...draws));

  test('the best contestant of each tournament goes into the mating pool', () => {
    // 169 v 64 → individual 1 · 576 v 361 → 2 · 64 v 169 → 1 · 361 v 576 → 2
    expect(run().pool).toEqual([1, 2, 1, 2]);
  });

  test('a preamble says the size and that the weight chain is not used, then each tournament records its contestants', () => {
    const { events } = run();
    expect(events[0]).toEqual({ stage: 'selection', kind: 'tournament-setup', size: 2, usesWeightChain: false });
    expect(events).toHaveLength(5);
    expect(events[1]).toEqual({
      stage: 'selection',
      kind: 'tournament',
      tournament: 1,
      contestants: [
        { individualId: 1, fitness: 169, r: 0.1 },
        { individualId: 3, fitness: 64, r: 0.6 },
      ],
      winnerId: 1,
      tieBreak: false,
    });
    expect(events.slice(1).map((e) => e.kind === 'tournament' && [e.tournament, e.winnerId])).toEqual([
      [1, 1],
      [2, 2],
      [3, 1],
      [4, 2],
    ]);
  });
});

describe('ties', () => {
  // positions 0..3 have fitness 64, 576, 64, 576: individuals 1 and 3 tie at 64, 2 and 4 tie at 576
  const tied = () => populationOf('01000', '11000', '01000', '11000');
  const winnerOf = (...draws: number[]) => {
    const { events } = tournamentSelect(tied(), draws.length, 1, scripted(...draws));
    const event = events.find((e) => e.kind === 'tournament');
    if (event?.kind !== 'tournament') throw new Error('no tournament event');
    return event;
  };

  test('the lower population position wins, whichever contestant was drawn first', () => {
    // positions 3 then 1 (both 576): individual 2 sits at position 1
    expect(winnerOf(0.8, 0.3).winnerId).toBe(2);
    expect(winnerOf(0.3, 0.8).winnerId).toBe(2);
  });

  test('the tie-break is recorded when different individuals share the best fitness', () => {
    expect(winnerOf(0.8, 0.3).tieBreak).toBe(true);
  });

  test('the same individual drawn twice is not a tie-break', () => {
    const event = winnerOf(0.3, 0.3);
    expect(event.winnerId).toBe(2);
    expect(event.tieBreak).toBe(false);
  });

  test('a tie below the best fitness is not a tie-break', () => {
    // positions 0 and 2 tie at 64 but position 1 (576) beats them both
    const event = winnerOf(0.0, 0.5, 0.3);
    expect(event.winnerId).toBe(2);
    expect(event.tieBreak).toBe(false);
  });

  test('with three tied contestants the lowest position still wins', () => {
    expect(winnerOf(0.9, 0.8, 0.3).winnerId).toBe(2); // positions 3, 3 and 1: individuals 4, 4, 2
    expect(winnerOf(0.9, 0.8, 0.3).tieBreak).toBe(true);
  });
});

describe('how often each individual wins', () => {
  test('matches the probability of being the best among t draws with replacement', () => {
    // N = 4, distinct fitness. P(the j-th best wins) = ((N − j + 1)^t − (N − j)^t) / N^t
    const population = textbook(); // best to worst: individual 2 (576), 4 (361), 1 (169), 3 (64)
    for (const size of [1, 2, 3]) {
      const tournaments = 20_000;
      const { pool } = tournamentSelect(population, size, tournaments, createRng(100 + size));
      [2, 4, 1, 3].forEach((id, k) => {
        const j = k + 1;
        const expected = ((4 - j + 1) ** size - (4 - j) ** size) / 4 ** size;
        const share = pool.filter((winner) => winner === id).length / tournaments;
        expect(Math.abs(share - expected)).toBeLessThan(0.02);
      });
    }
  });

  test('size 1 is uniform random selection: the single contestant always wins', () => {
    const { events, pool } = tournamentSelect(textbook(), 1, 3, scripted(0.1, 0.6, 0.9));
    expect(pool).toEqual([1, 3, 4]);
    expect(events.filter((e) => e.kind === 'tournament').every((e) => e.kind === 'tournament' && !e.tieBreak)).toBe(true);
  });

  test('a big tournament almost always picks the best individual', () => {
    const { pool } = tournamentSelect(textbook(), 12, 500, createRng(5));
    expect(pool.filter((id) => id === 2).length / 500).toBeGreaterThan(0.95);
  });

  test('the largest possible draw still picks a valid individual, for any population size', () => {
    const largest = 1 - 2 ** -53;
    for (let n = 1; n <= 200; n++) {
      const population = initialize(goldberg, { kind: 'random', size: n }, createRng(n)).population;
      const { pool } = tournamentSelect(population, 1, 1, scripted(largest));
      expect(pool[0]).toBe(n);
    }
  });
});

describe('random draws', () => {
  test('exactly size × count draws are made, in order, so later stages continue the same sequence', () => {
    const reference = createRng(2024);
    const sequence = Array.from({ length: 20 }, () => reference.next());
    const rng = createRng(2024);
    tournamentSelect(textbook(), 3, 5, rng);
    expect(rng.next()).toBe(sequence[15]);
  });

  test('the same seed gives the same pool and events', () => {
    const run = (seed: number) => tournamentSelect(textbook(), 2, 30, createRng(seed));
    expect(run(8)).toEqual(run(8));
    expect(run(8).pool).not.toEqual(run(9).pool);
  });

  test('no tournaments means no draws and just the preamble', () => {
    const rng = scripted();
    const { pool, events } = tournamentSelect(textbook(), 2, 0, rng);
    expect(pool).toEqual([]);
    expect(events).toEqual([{ stage: 'selection', kind: 'tournament-setup', size: 2, usesWeightChain: false }]);
    expect(rng.used).toBe(0);
  });
});

describe('fitness is compared directly', () => {
  test('negative fitness needs no weights, no chain and no automatic switch', () => {
    const negative = { chromosomeLength: 3, alphabet: binaryAlphabet, columns: [fitnessColumn], evaluate: (c: readonly number[]) => ({ decoded: 0, objective: 0, fitness: c.reduce((n, b) => n + b, 0) - 5 }) };
    const population = initialize(negative, { kind: 'explicit', chromosomes: ['000', '111', '010'] }, scripted()).population; // −5, −2, −4
    const { pool, events } = tournamentSelect(population, 2, 1, scripted(0.0, 0.5)); // positions 0 and 1
    expect(pool).toEqual([2]);
    expect(events.map((e) => e.kind)).toEqual(['tournament-setup', 'tournament']);
  });
});

describe('refusals', () => {
  test.each([0, -1, 1.5, Number.NaN])('rejects a tournament size of %s', (size) => {
    expect(() => tournamentSelect(textbook(), size, 1, scripted())).toThrow('Tournament size must be a whole number of at least 1');
  });

  test.each([-1, 2.5])('rejects %s tournaments', (count) => {
    expect(() => tournamentSelect(textbook(), 2, count, scripted())).toThrow('The number of tournaments must be a whole number of at least 0');
  });

  test('rejects an empty population', () => {
    expect(() => tournamentSelect([], 2, 1, scripted())).toThrow('Tournament selection needs at least one individual');
  });
});
