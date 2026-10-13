import { describe, expect, test } from 'vitest';
import { crossover, formatTour, mutate, pair, parseTour, tspProblem, type CrossoverEvent, type CrossoverOperator, type Individual, type MutationEvent, type Rng, type TspOptions } from '../engine';
import { initialize } from '../engine';
import { tourInfoOf } from './tour-cells';
import { tourMutationNotes, tourPairNotes } from './tour-variation';

const scripted = (...draws: number[]): Rng => {
  let k = 0;
  return { next: () => draws[k++]! };
};
const opts = (instance: string, n = 10): TspOptions => ({ instance, n, seed: 1 });
// nine cities on a circle: the lengths are real numbers, which the info writes with one decimal
const problem = tspProblem(opts('circle', 9));
const info = tourInfoOf(problem);

const A = '1 2 3 4 5 6 7 8 9';
const B = '9 3 7 8 2 6 5 1 4';
const population = (texts: string[]): Individual[] => initialize(problem, { kind: 'explicit', chromosomes: texts }, scripted()).population;
const event = (operator: CrossoverOperator, draws: number[], probability = 1): { event: CrossoverEvent; a: number[]; b: number[] } => {
  const { events } = crossover(population([A, B]), pair([1, 2], 2).pairs, { enabled: true, operator, probability }, scripted(...draws), undefined, true);
  return { event: events[0]!, a: [...parseTour(A)!], b: [...parseTour(B)!] };
};
const L = (text: string) => info.lengthText(info.lengthOf(parseTour(text)!));

// the textbook cuts after genes 3 and 7 (first cut: 1 + ⌊0.3 × 8⌋ = 3; second: the 5th of the other gaps, which is 7)
const draws = [0.1, 0.3, 0.8];

describe('the notes on an order crossover event', () => {
  const { event: e, a, b } = event('ox', draws);
  const notes = tourPairNotes(e, a, b, info);

  test('the cuts, the slice as positions from 1 and the number of cities in it', () => {
    expect(notes.slice).toEqual({ from: 4, to: 7 });
    expect(notes.cutText).toBe('cuts after positions 3 and 7 → slice = positions 4 to 7 (4 cities)');
  });

  test('each child says whose slice it kept, where the fill starts and the cities filled, in the order they were taken (from 1)', () => {
    expect(notes.childNotes).toEqual([
      'keeps A’s slice · fills from B, starting after position 7: 1, 9, 3, 8, 2',
      'keeps B’s slice · fills from A, starting after position 7: 9, 1, 3, 4, 7',
    ]);
  });

  test('a long fill is cut after eight cities and says how many there are', () => {
    const berlin = tspProblem(opts('berlin52'));
    const pop = initialize(berlin, { kind: 'explicit', chromosomes: [Array.from({ length: 52 }, (_, k) => k + 1).join(' '), Array.from({ length: 52 }, (_, k) => 52 - k).join(' ')] }, scripted()).population;
    const { events } = crossover(pop, pair([1, 2], 2).pairs, { enabled: true, operator: 'ox', probability: 1 }, scripted(0.1, 0.1, 0.5), undefined, true);
    const note = tourPairNotes(events[0]!, [...pop[0]!.chromosome], [...pop[1]!.chromosome], tourInfoOf(berlin)).childNotes[0]!;
    expect(note).toMatch(/: (\d+, ){8}… \(\d+ cities\)$/);
  });

  test('the lengths are the tours’ own: parents A and B, then each child', () => {
    expect(notes.lengths.a).toBe(info.lengthOf(parseTour(A)!));
    expect(notes.lengths.b).toBe(info.lengthOf(parseTour(B)!));
    expect(notes.lengths.children).toEqual(e.children.map((c) => info.lengthOf(c.chromosome)));
    expect(notes.lengthsText).toBe(`lengths: A ${L(A)}, B ${L(B)} → O1 ${L('3 8 2 4 5 6 7 1 9')}, O2 ${L('3 4 7 8 2 6 5 9 1')}`);
  });
});

describe('the notes on a partial-mapped crossover event', () => {
  const { event: e, a, b } = event('pmx', draws);
  const notes = tourPairNotes(e, a, b, info);

  test('the mapping lists B’s city at each slice position against A’s', () => {
    // slices: A 4 5 6 7 and B 8 2 6 5
    expect(notes.mappingText).toBe('mapping (B’s city at each slice position ↔ A’s): 8 ↔ 4 · 2 ↔ 5 · 6 ↔ 6 · 5 ↔ 7');
    expect(notes.slice).toEqual({ from: 4, to: 7 });
  });

  test('one conflict is followed through the mapping and said in full', () => {
    // O1 = A outside the slice with B's slice 8 2 6 5 in it: A's city 8 at position 8 is in B's slice, 8 ↔ 4 and 4 is free; A's 5 at position 5 is in the slice too
    expect(notes.exampleText).toMatch(/^position \d+ holds city \d+ in A, but \d+ is in B’s slice → \d+( ↔ \d+)+: city \d+ is free, so it goes there$/);
    const f = e.mapping![0].followed[0]!;
    expect(notes.exampleText).toBe(`position ${f.position + 1} holds city ${f.chain[0]! + 1} in A, but ${f.chain[0]! + 1} is in B’s slice → ${f.chain.map((c) => c + 1).join(' ↔ ')}: city ${f.city + 1} is free, so it goes there`);
  });

  test('the positions that followed the mapping are the event’s, from 1, for each child', () => {
    expect(notes.followed).toEqual(e.mapping!.map((m) => m.followed.map((f) => f.position + 1)));
    expect(notes.followed[0]!.length).toBeGreaterThan(0);
  });

  test('each child says whose slice it took, whose cities are elsewhere and how many followed the mapping', () => {
    expect(notes.childNotes).toEqual([
      `B’s slice, A elsewhere · ${e.mapping![0].followed.length} ${e.mapping![0].followed.length === 1 ? 'city' : 'cities'} followed the mapping ↻`,
      `A’s slice, B elsewhere · ${e.mapping![1].followed.length} ${e.mapping![1].followed.length === 1 ? 'city' : 'cities'} followed the mapping ↻`,
    ]);
  });

  test('with no conflict at all the card says so instead of an example', () => {
    const same = event('pmx', draws);
    const fresh = tourPairNotes({ ...same.event, mapping: [{ pairs: same.event.mapping![0].pairs, followed: [] }, { pairs: same.event.mapping![1].pairs, followed: [] }] }, same.a, same.b, info);
    expect(fresh.exampleText).toBe('no city outside the slice was already in the other parent’s slice, so no mapping was followed');
    expect(fresh.childNotes[0]).toBe('B’s slice, A elsewhere · no city followed the mapping');
  });
});

describe('the notes on a cycle crossover event', () => {
  const { event: e, a, b } = event('cx', [0.1]);
  const notes = tourPairNotes(e, a, b, info);

  test('the cycles are listed with their positions from 1, and every position knows its cycle', () => {
    const cycles = e.cycles!;
    expect(notes.cycleOf).toHaveLength(9);
    cycles.forEach((cycle, c) => cycle.forEach((p) => expect(notes.cycleOf![p]).toBe(c + 1)));
    expect(notes.cycleText!.startsWith(`${cycles.length} cycle${cycles.length === 1 ? '' : 's'}: `)).toBe(true);
    expect(notes.cycleText).toContain(`cycle 1 = ${cycles[0]!.length} position${cycles[0]!.length === 1 ? '' : 's'} (${cycles[0]!.map((p) => p + 1).join(', ')})`);
  });

  test('the children say which cycles came from which parent, alternating', () => {
    expect(e.cycles!.length).toBeGreaterThan(1);
    expect(notes.childNotes[0]!.startsWith('cycle 1 from A, cycle 2 from B')).toBe(true);
    expect(notes.childNotes[1]!.startsWith('cycle 1 from B, cycle 2 from A')).toBe(true);
  });

  test('parents with one cycle give two copies, and the card says so', () => {
    const one = tourPairNotes({ ...e, cycles: [[0, 1, 2, 3, 4, 5, 6, 7, 8]] }, a, b, info);
    expect(one.cycleText).toBe('1 cycle: all 9 positions, so each child is a copy of one parent');
    expect(one.childNotes).toEqual(['the one cycle is from A: a copy of A', 'the one cycle is from B: a copy of B']);
  });

  test('many cycles are cut after five', () => {
    const many = tourPairNotes({ ...e, cycles: Array.from({ length: 9 }, (_, k) => [k]) }, a, b, info);
    expect(many.cycleText!.startsWith('9 cycles: cycle 1 = 1 position (1) · cycle 2 = 1 position (2)')).toBe(true);
    expect(many.cycleText!.endsWith('· cycle 5 = 1 position (5) · …')).toBe(true);
    expect(many.childNotes[0]).toBe('cycle 1 from A, cycle 2 from B, cycle 3 from A, cycle 4 from B, …');
  });
});

describe('a bypass', () => {
  test('keeps the lengths and says the children are copies', () => {
    const { event: e, a, b } = event('ox', [0.95], 0.5);
    expect(e.decision).toBe('bypassed');
    const notes = tourPairNotes(e, a, b, info);
    expect(notes.slice).toBeUndefined();
    expect(notes.childNotes).toEqual(['a copy of A', 'a copy of B']);
    expect(notes.lengthsText).toBe(`lengths: A ${L(A)}, B ${L(B)} → O1 ${L(A)}, O2 ${L(B)}`);
  });

  test('a second child that was dropped has no length in the line', () => {
    const { event: e, a, b } = event('ox', draws);
    const dropped = { ...e, children: [e.children[0]!, { ...e.children[1]!, discarded: true }] as CrossoverEvent['children'] };
    expect(tourPairNotes(dropped, a, b, info).lengthsText).toBe(`lengths: A ${L(A)}, B ${L(B)} → O1 ${L('3 8 2 4 5 6 7 1 9')}`);
  });
});

describe('the notes on a mutation event', () => {
  const T = '1 2 3 4 5 6 7 8 9';
  const mutateOnce = (operator: 'swap' | 'inversion' | 'insertion', draws: number[], probability = 1, enabled = true): MutationEvent => {
    const { events } = mutate([{ offspring: 1, chromosome: [...parseTour(T)!] }], { enabled, mode: 'per-individual', probability, operator }, scripted(...draws), 0, undefined, true);
    return events[0]!;
  };

  test('a swap names the two positions, the draws, the edges and what the length did', () => {
    // r1 = 0.2: i = ⌊0.2 × 9⌋ = 1; r2 = 0.9: the ⌊0.9 × 8⌋ = 7th of the other positions (0, 2, 3, 4, 5, 6, 7, 8) is 8 → positions 1 and 8 (0-based), 2 and 9 on the screen
    const e = mutateOnce('swap', [0.1, 0.2, 0.9]);
    const notes = tourMutationNotes(e, info);
    expect(notes.moveText).toBe('swap the cities at positions 2 and 9');
    expect(notes.drawsText).toBe('positions drawn u₁ = 0.2, u₂ = 0.9');
    // cities 2 and 9 are neighbours across the closing edge, so 1–2 and 9–1 are still edges after the swap: only 2–3 and 8–9 go and 9–3 and 8–2 come
    expect(notes.edgesText).toBe('✕ removed 2–3, 8–9 · added 9–3, 8–2');
    expect(notes.before).toBe(info.lengthOf(parseTour(T)!));
    expect(notes.after).toBe(info.lengthOf(e.after));
    const delta = notes.after - notes.before;
    expect(notes.lengthText).toBe(`length ${info.lengthText(notes.before)} → ${info.lengthText(notes.after)} (${delta > 0 ? '+' : delta < 0 ? '−' : '±'}${info.lengthText(Math.abs(delta))})`);
  });

  test('an inversion names the slice, an insertion the city taken out and where it goes', () => {
    const inversion = mutateOnce('inversion', [0.1, 0.2, 0.9]);
    expect(tourMutationNotes(inversion, info).moveText).toBe('reverse the slice from position 2 to 9');
    const insertion = mutateOnce('insertion', [0.1, 0.2, 0.9]);
    expect(tourMutationNotes(insertion, info).moveText).toBe('take the city at position 2 out and put it at position 9');
    const reversed = mutateOnce('insertion', [0.1, 0.8, 0.0]);
    expect(tourMutationNotes(reversed, info).moveText).toBe('take the city at position 8 out and put it at position 1');
  });

  test('the edges are the event’s: two for a swap of neighbours’ ends, as many added as removed', () => {
    for (const operator of ['swap', 'inversion', 'insertion'] as const) {
      const e = mutateOnce(operator, [0.1, 0.35, 0.6]);
      const notes = tourMutationNotes(e, info);
      expect(notes.edgesText).toBe(`✕ removed ${e.edges!.removed.map((x) => `${x[0] + 1}–${x[1] + 1}`).join(', ')} · added ${e.edges!.added.map((x) => `${x[0] + 1}–${x[1] + 1}`).join(', ')}`);
      expect(e.edges!.removed.length).toBe(e.edges!.added.length);
    }
  });

  test('an individual that is not mutated, or whose mutation is off, has only its length', () => {
    const unchanged = mutateOnce('swap', [0.9], 0.4);
    expect(unchanged.decision).toBe('unchanged');
    expect(tourMutationNotes(unchanged, info)).toEqual({ before: info.lengthOf(parseTour(T)!), after: info.lengthOf(parseTour(T)!), lengthText: `length ${L(T)}` });
    const off = mutateOnce('swap', [], 0.4, false);
    expect(off.decision).toBe('bypassed');
    expect(tourMutationNotes(off, info).lengthText).toBe(`length ${L(T)}`);
    expect(tourMutationNotes(off, info).moveText).toBeUndefined();
  });

  test('formatTour is how the cards number cities: from 1', () => {
    expect(formatTour([0, 1, 2])).toBe('1 2 3');
  });
});
