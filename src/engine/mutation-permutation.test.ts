import { describe, expect, test } from 'vitest';
import { formatTour, parseTour, tourEdgeSet } from './chromosome';
import { runGeneration, startRun, type GenerationConfig } from './generation';
import { mutate, permutationMutationOperators, type MutationConfig, type MutationOperator } from './mutation';
import { scripted, tourLine } from './test-support';
import { createRng } from '../run/rng';

const config = (operator: MutationOperator | undefined, probability = 1): MutationConfig => ({ enabled: true, mode: 'per-individual', probability, ...(operator ? { operator } : {}) });
const tour = (text: string) => parseTour(text)!;
const run = (text: string, operator: MutationOperator, draws: number[], probability = 1) => {
  const rng = scripted(...draws);
  const { mutated, events } = mutate([{ offspring: 1, chromosome: tour(text) }], config(operator, probability), rng, 0, undefined, true);
  return { after: formatTour(mutated[0]!.chromosome), event: events[0]!, flipped: mutated[0]!.flipped, rng };
};

// n = 5, the tour 1 2 3 4 5. After the decision draw u the two position draws are r1 and r2: i = ⌊r1·5⌋ and, of the other four
// positions, the ⌊r2·4⌋-th (so j differs from i).
// r1 = 0.2, r2 = 0.9: i = 1, the 3rd other (positions 0, 2, 3, 4) is 4 → positions 1 and 4
// r1 = 0.2, r2 = 0.5: i = 1, the 2nd other is 3 → positions 1 and 3
const T = '1 2 3 4 5';

describe('swap, hand-worked', () => {
  test('exchanges the cities at two different positions', () => {
    const r = run(T, 'swap', [0.1, 0.2, 0.9]);
    expect(r.after).toBe('1 5 3 4 2');
    expect(r.rng.used).toBe(3);
    expect(r.event).toMatchObject({ mode: 'per-individual', decision: 'mutated', threshold: 1, individualDraw: { u: 0.1 }, move: { kind: 'swap', first: 1, second: 4, r: [0.2, 0.9] } });
    expect(r.flipped).toEqual([2, 5]); // the positions that changed, from 1
    expect(r.event.flipped).toEqual([2, 5]);
  });

  test('the event reports the edges removed and added, as pairs of cities in tour order', () => {
    // 1 2 3 4 5 → 1 5 3 4 2 (0-based 0 4 2 3 1): 2–3 and 4–5 go, 5–3 and 4–2 come (written 0-based: [1,2] [3,4] removed, [4,2] [3,1] added)
    const { event } = run(T, 'swap', [0.1, 0.2, 0.9]);
    expect(event.edges).toEqual({ removed: [[1, 2], [3, 4]], added: [[4, 2], [3, 1]] });
  });
});

describe('inversion, hand-worked', () => {
  test('reverses the slice from one position to the other, both included', () => {
    const r = run(T, 'inversion', [0.1, 0.2, 0.5]);
    expect(r.after).toBe('1 4 3 2 5');
    expect(r.event.move).toEqual({ kind: 'inversion', first: 1, second: 3, r: [0.2, 0.5] });
    expect(r.flipped).toEqual([2, 4]); // the middle city did not move
  });

  test('changes exactly two edges (a 2-opt move)', () => {
    const { event } = run(T, 'inversion', [0.1, 0.2, 0.5]);
    expect(event.edges).toEqual({ removed: [[0, 1], [3, 4]], added: [[0, 3], [1, 4]] });
  });

  test('reversing everything but the first city changes no edge: it is the same route read the other way', () => {
    const { after, event } = run(T, 'inversion', [0.1, 0.2, 0.9]); // positions 1 and 4
    expect(after).toBe('1 5 4 3 2');
    expect(event.edges).toEqual({ removed: [], added: [] });
  });
});

describe('insertion, hand-worked', () => {
  test('takes the city at the first position out and puts it at the second', () => {
    const r = run(T, 'insertion', [0.1, 0.2, 0.9]);
    expect(r.after).toBe('1 3 4 5 2'); // the city 2 from position 2 to position 5
    expect(r.event.move).toEqual({ kind: 'insertion', first: 1, second: 4, r: [0.2, 0.9] }); // from 1 to 4, not sorted
    expect(r.flipped).toEqual([2, 3, 4, 5]);
    expect(r.event.edges).toEqual({ removed: [[1, 2], [4, 0]], added: [[0, 2], [4, 1]] });
  });

  test('a city can move to an earlier position too: the direction is the draw order', () => {
    // r1 = 0.8 → i = 4; r2 = 0 → the 1st other position, 0: the last city goes to the front
    const r = run(T, 'insertion', [0.1, 0.8, 0]);
    expect(r.after).toBe('5 1 2 3 4');
    expect(r.event.move).toMatchObject({ first: 4, second: 0 });
  });
});

describe('the decision', () => {
  test('one draw u per individual: at or above pm it is unchanged and nothing more is drawn', () => {
    for (const operator of permutationMutationOperators) {
      const r = run(T, operator, [0.7], 0.5);
      expect(r.rng.used).toBe(1);
      expect(r.after).toBe(T);
      expect(r.event).toMatchObject({ decision: 'unchanged', individualDraw: { u: 0.7 }, threshold: 0.5, flipped: [] });
      expect(r.event).not.toHaveProperty('move');
      expect(r.event).not.toHaveProperty('edges');
    }
  });

  test('probability 1 always mutates and probability 0 never does; a switched-off mutation draws nothing and says so', () => {
    expect(run(T, 'swap', [0.999, 0.1, 0.1], 1).event.decision).toBe('mutated');
    expect(run(T, 'swap', [0], 0).event.decision).toBe('unchanged');
    for (const operator of permutationMutationOperators) {
      const rng = scripted();
      const { events, mutated } = mutate([{ offspring: 1, chromosome: tour(T) }], { enabled: false, mode: 'per-individual', probability: 1, operator }, rng, 0, undefined, true);
      expect(rng.used).toBe(0);
      expect(events[0]).toMatchObject({ decision: 'bypassed', reason: 'switched-off' });
      expect(formatTour(mutated[0]!.chromosome)).toBe(T);
    }
  });

  test('several offspring each draw in turn', () => {
    const rng = scripted(0.1, 0.2, 0.9, 0.7, 0.1, 0.2, 0.5);
    const { events } = mutate([1, 2, 3].map((offspring) => ({ offspring, chromosome: tour(T) })), config('swap', 0.5), rng, 0, undefined, true);
    expect(events.map((e) => e.decision)).toEqual(['mutated', 'unchanged', 'mutated']);
    expect(rng.used).toBe(7);
  });
});

const randomTour = (n: number, rng: ReturnType<typeof createRng>) => {
  const t = Array.from({ length: n }, (_, k) => k);
  for (let i = n - 1; i >= 1; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [t[i], t[j]] = [t[j]!, t[i]!];
  }
  return t;
};
const isPermutation = (c: readonly number[], n: number) => c.length === n && [...c].sort((a, b) => a - b).every((v, k) => v === k);
const directEdges = (before: readonly number[], after: readonly number[]) => {
  const key = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);
  const pairs = (t: readonly number[]) => t.map((c, k) => [c, t[(k + 1) % t.length]!] as [number, number]);
  const was = tourEdgeSet(before);
  const now = tourEdgeSet(after);
  return { removed: pairs(before).filter(([a, b]) => !now.has(key(a, b))), added: pairs(after).filter(([a, b]) => !was.has(key(a, b))) };
};

describe('properties over generated tours', () => {
  const sizes = [2, 3, 5, 9, 20, 52];

  test('every result is a permutation that differs from the original exactly where the event says, with the edges reported as they are', () => {
    for (const n of sizes) {
      for (let seed = 1; seed <= 30; seed++) {
        const rng = createRng(seed);
        const before = randomTour(n, rng);
        for (const operator of permutationMutationOperators) {
          const { mutated, events } = mutate([{ offspring: 1, chromosome: before }], config(operator), createRng(seed + 1000), 0, undefined, true);
          const after = mutated[0]!.chromosome;
          const e = events[0]!;
          const label = `${operator} n=${n} seed=${seed}`;
          expect(isPermutation(after, n), label).toBe(true);
          const { first, second } = e.move!;
          expect(first).not.toBe(second);
          const changed = before.flatMap((c, k) => (c !== after[k] ? [k + 1] : []));
          expect(e.flipped, label).toEqual(changed);
          expect(e.before).toEqual(before);
          expect(e.after).toEqual(after);
          if (operator === 'swap') {
            expect(first).toBeLessThan(second);
            expect(after[first]).toBe(before[second]);
            expect(after[second]).toBe(before[first]);
            expect(changed).toEqual([first + 1, second + 1]);
          } else if (operator === 'inversion') {
            expect(first).toBeLessThan(second);
            expect(after.slice(first, second + 1)).toEqual([...before.slice(first, second + 1)].reverse());
            expect(after.slice(0, first)).toEqual(before.slice(0, first));
            expect(after.slice(second + 1)).toEqual(before.slice(second + 1));
          } else {
            const moved = [...before];
            const [city] = moved.splice(first, 1);
            moved.splice(second, 0, city!);
            expect(after).toEqual(moved);
          }
          expect(e.edges, label).toEqual(directEdges(before, after));
          if (n >= 4) {
            const limit = operator === 'swap' ? 4 : operator === 'inversion' ? 2 : 3;
            expect(e.edges!.removed.length, label).toBeLessThanOrEqual(limit);
            expect(e.edges!.added.length, label).toBe(e.edges!.removed.length);
          }
        }
      }
    }
  });

  test('over many draws every ordered pair of positions occurs, and inversion and swap pairs are sorted', () => {
    const seen = { swap: new Set<string>(), insertion: new Set<string>() };
    for (let seed = 1; seed <= 400; seed++) {
      for (const operator of ['swap', 'insertion'] as const) {
        const { events } = mutate([{ offspring: 1, chromosome: [0, 1, 2, 3] }], config(operator), createRng(seed), 0, undefined, true);
        seen[operator].add(`${events[0]!.move!.first}-${events[0]!.move!.second}`);
      }
    }
    expect(seen.swap.size).toBe(6); // 4 positions: 6 unordered pairs
    expect(seen.insertion.size).toBe(12); // and 12 ordered pairs
  });

  test('the input is not changed, and the event keeps its own copies', () => {
    const input = tour('3 1 4 2 5');
    const { mutated, events } = mutate([{ offspring: 1, chromosome: input }], config('swap'), scripted(0.1, 0.2, 0.9), 0, undefined, true);
    expect(formatTour(input)).toBe('3 1 4 2 5');
    expect(mutated[0]!.chromosome).not.toBe(input);
    expect(events[0]!.before).not.toBe(input);
    expect(events[0]!.after).not.toBe(mutated[0]!.chromosome);
  });
});

describe('what the permutation mutations need', () => {
  test('two cities at least; with fewer an enabled mutation says so', () => {
    expect(() => mutate([{ offspring: 1, chromosome: [0] }], config('swap'), scripted(0.1), 0, undefined, true)).toThrow(/at least 2 cities, but the tour has 1/);
    expect(mutate([{ offspring: 1, chromosome: [0, 1] }], config('insertion'), scripted(0.1, 0.1, 0.1), 0, undefined, true).mutated[0]!.chromosome).toEqual([1, 0]);
    expect(mutate([{ offspring: 1, chromosome: [0] }], { enabled: false, mode: 'per-individual', probability: 1, operator: 'swap' }, scripted(), 0, undefined, true).mutated[0]!.chromosome).toEqual([0]);
  });

  test('flip and Gaussian are refused for a permutation, and so is leaving the operator out, in words', () => {
    for (const operator of ['flip', 'gaussian'] as const) {
      expect(() => mutate([{ offspring: 1, chromosome: tour(T) }], config(operator), scripted(0.1), 0, undefined, true), operator).toThrow(/would repeat and lose cities; choose swap, inversion or insertion mutation for this problem/);
    }
    expect(() => mutate([{ offspring: 1, chromosome: tour(T) }], config(undefined), scripted(0.1), 0, undefined, true)).toThrow(/A permutation needs a mutation operator: choose swap, inversion or insertion/);
  });

  test('per-gene mutation has no meaning for a permutation and is refused, in words', () => {
    expect(() => mutate([{ offspring: 1, chromosome: tour(T) }], { enabled: true, mode: 'per-gene', probability: 0.1, operator: 'swap' }, scripted(0.1), 0, undefined, true)).toThrow(/Per-gene mutation has no meaning for a permutation.*per individual/);
  });

  test('the permutation operators are refused for the other problems, in words', () => {
    for (const operator of permutationMutationOperators) {
      expect(() => mutate([{ offspring: 1, chromosome: [0, 1, 1] }], { enabled: true, mode: 'per-gene', probability: 0.1, operator }, scripted(0.1), 2), operator).toThrow(/mutation is for permutation chromosomes; use flip mutation for this problem/);
      expect(() => mutate([{ offspring: 1, chromosome: [0.5, 1] }], { enabled: true, mode: 'per-gene', probability: 0.1, operator }, scripted(0.1), 0, [{ lo: 0, hi: 1 }, { lo: 0, hi: 1 }]), operator).toThrow(/mutation is for permutation chromosomes; use Gaussian mutation for this problem/);
    }
  });
});

describe('a whole generation of a permutation problem', () => {
  const base = (crossoverOperator: 'ox' | 'pmx' | 'cx' | 'one-point', mutation: MutationOperator): GenerationConfig => ({
    problem: tourLine(8),
    selection: { method: 'tournament', size: 2 },
    crossover: { enabled: true, operator: crossoverOperator, probability: 0.9 },
    mutation: { enabled: true, mode: 'per-individual', probability: 0.5, operator: mutation },
    elites: 1,
    stop: { generationLimit: 50 },
  });

  test('crossover and mutation work together stage by stage: every individual of every generation is a permutation, and the events say which operators ran', () => {
    for (const crossoverOperator of ['ox', 'pmx', 'cx'] as const) {
      for (const mutation of permutationMutationOperators) {
        const rng = createRng(21);
        const c = base(crossoverOperator, mutation);
        let { state } = startRun(c.problem, { kind: 'random', size: 10 }, rng);
        for (let g = 1; g <= 15; g++) {
          const step = runGeneration(state, c, rng);
          state = step.state;
          for (const individual of state.population) expect(isPermutation(individual.chromosome, 8), `${crossoverOperator} ${mutation} generation ${g}`).toBe(true);
          expect(step.events.filter((e) => e.stage === 'crossover').every((e) => e.operator === crossoverOperator)).toBe(true);
          expect(step.events.filter((e) => e.stage === 'mutation').every((e) => e.mode === 'per-individual')).toBe(true);
        }
      }
    }
  });

  test('a symbol crossover on a permutation problem is refused by the generation, in words (the problem flag reaches crossover)', () => {
    const rng = createRng(1);
    const c = base('one-point', 'swap');
    const { state } = startRun(c.problem, { kind: 'random', size: 6 }, rng);
    expect(() => runGeneration(state, c, rng)).toThrow(/would repeat and lose cities/);
  });

  test('a seeded run is the same run each time', () => {
    const go = () => {
      const rng = createRng(5);
      const c = base('pmx', 'inversion');
      let { state } = startRun(c.problem, { kind: 'random', size: 10 }, rng);
      for (let g = 0; g < 10; g++) state = runGeneration(state, c, rng).state;
      return state.population.map((i) => formatTour(i.chromosome));
    };
    expect(go()).toEqual(go());
  });
});
