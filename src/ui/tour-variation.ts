import type { Chromosome, CrossoverEvent, MutationEvent } from '../engine';
import { num } from './format';
import type { TourInfo } from './tour-cells';

/**
 * What the operator cards of a TSP run say about one event: the slice, the fill, the mapping, the cycles, the edges and the
 * lengths, worked out from the engine's event alone. Cities and positions are numbered from 1 here, as on the screen (the
 * events number them from 0).
 */

const plural = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`;
const cities = (count: number): string => plural(count, 'city', 'cities');
const positions = (count: number): string => plural(count, 'position', 'positions');
/** The first `max` items and an ellipsis when there are more. */
const shorten = (items: readonly string[], max: number): string[] => (items.length > max ? [...items.slice(0, max), '…'] : [...items]);

export interface TourPairNotes {
  readonly operator: 'ox' | 'pmx' | 'cx';
  /** OX and PMX when recombined: the slice as positions from 1, inclusive. */
  readonly slice?: { readonly from: number; readonly to: number };
  readonly cutText?: string;
  /** CX when recombined: the cycle (from 1) of each position. */
  readonly cycleOf?: readonly number[];
  readonly cycleText?: string;
  /** PMX when recombined: the mapping between the slices, and one conflict followed through it. */
  readonly mappingText?: string;
  readonly exampleText?: string;
  /** PMX: for each child the positions (from 1) whose city followed the mapping. */
  readonly followed: readonly (readonly number[])[];
  /** For each child, what it kept and what it took from the other parent. */
  readonly childNotes: readonly string[];
  /** The lengths of the parents and of the children that are kept. */
  readonly lengths: { readonly a: number; readonly b: number; readonly children: readonly number[] };
  readonly lengthsText: string;
  /** The sentence under the card saying what the marks mean. */
  readonly key: string;
}

const keys: Record<'ox' | 'pmx' | 'cx', string> = {
  ox: 'plain city = inherited from the parent whose slice is kept · hatched city = filled from the other parent · thick outline = the slice',
  pmx: 'hatched city = taken from the other parent’s slice · thick outline = the slice · ↻ = a city that followed the mapping to a free one',
  cx: 'hatched city = taken from the other parent · the line under each city names its cycle: solid 1, dotted 2, dashed 3, double 4 and later',
};

/** The notes for one crossover event, given the two parents as the pair had them. */
export function tourPairNotes(event: CrossoverEvent, a: Chromosome, b: Chromosome, info: TourInfo): TourPairNotes {
  const operator = event.operator as 'ox' | 'pmx' | 'cx';
  const n = a.length;
  const recombined = event.decision === 'recombined';
  const kept = event.children.filter((c) => !c.discarded);
  const lengths = { a: info.lengthOf(a), b: info.lengthOf(b), children: event.children.map((c) => info.lengthOf(c.chromosome)) };
  const lengthsText = `lengths: A ${info.lengthText(lengths.a)}, B ${info.lengthText(lengths.b)} → ${kept.map((c) => `O${c.offspring} ${info.lengthText(lengths.children[event.children.indexOf(c)]!)}`).join(', ')}`;
  const base = { operator, lengths, lengthsText, key: keys[operator] };

  if (!recombined) return { ...base, followed: [[], []], childNotes: ['a copy of A', 'a copy of B'] };

  if (operator === 'cx') {
    const cycles = event.cycles ?? [];
    const cycleOf = Array.from({ length: n }, () => 0);
    cycles.forEach((cycle, c) => cycle.forEach((p) => (cycleOf[p] = c + 1)));
    const cycleText =
      cycles.length === 1
        ? `1 cycle: all ${n} positions, so each child is a copy of one parent`
        : `${cycles.length} cycles: ${shorten(cycles.map((c, k) => `cycle ${k + 1} = ${positions(c.length)} (${shorten(c.map((p) => String(p + 1)), 6).join(', ')})`), 5).join(' · ')}`;
    const alternate = (first: 'A' | 'B'): string => {
      const second = first === 'A' ? 'B' : 'A';
      return cycles.length === 1 ? `the one cycle is from ${first}: a copy of ${first}` : shorten(cycles.map((_, k) => `cycle ${k + 1} from ${k % 2 === 0 ? first : second}`), 4).join(', ');
    };
    return { ...base, cycleOf, cycleText, followed: [[], []], childNotes: [alternate('A'), alternate('B')] };
  }

  const [lo, hi] = event.cuts!;
  const slice = { from: lo! + 1, to: hi! };
  const cutText = `cuts after positions ${lo} and ${hi} → slice = positions ${slice.from} to ${slice.to} (${cities(hi! - lo!)})`;

  if (operator === 'ox') {
    const childNotes = event.fill!.map((fill, k) => {
      const keeper = k === 0 ? 'A' : 'B';
      const other = k === 0 ? 'B' : 'A';
      const list = shorten(fill.cities.map((c) => String(c + 1)), 8).join(', ');
      return `keeps ${keeper}’s slice · fills from ${other}, starting after position ${hi}: ${list}${fill.cities.length > 8 ? ` (${cities(fill.cities.length)})` : ''}`;
    });
    return { ...base, slice, cutText, followed: [[], []], childNotes };
  }

  const first = event.mapping![0];
  const mappingText = `mapping (B’s city at each slice position ↔ A’s): ${shorten(first.pairs.map((p) => `${p.taken + 1} ↔ ${p.displaced + 1}`), 8).join(' · ')}`;
  const withConflict = event.mapping!.findIndex((m) => m.followed.length > 0);
  let exampleText = 'no city outside the slice was already in the other parent’s slice, so no mapping was followed';
  if (withConflict >= 0) {
    const f = event.mapping![withConflict]!.followed[0]!;
    const baseParent = withConflict === 0 ? 'A' : 'B';
    const donor = withConflict === 0 ? 'B' : 'A';
    exampleText = `position ${f.position + 1} holds city ${f.chain[0]! + 1} in ${baseParent}, but ${f.chain[0]! + 1} is in ${donor}’s slice → ${f.chain.map((c) => c + 1).join(' ↔ ')}: city ${f.city + 1} is free, so it goes there`;
  }
  const followed = event.mapping!.map((m) => m.followed.map((f) => f.position + 1));
  const childNotes = event.mapping!.map((m, k) => `${k === 0 ? 'B' : 'A'}’s slice, ${k === 0 ? 'A' : 'B'} elsewhere · ${m.followed.length === 0 ? 'no city' : cities(m.followed.length)} followed the mapping${m.followed.length > 0 ? ' ↻' : ''}`);
  return { ...base, slice, cutText, mappingText, exampleText, followed, childNotes };
}

export interface TourMutationNotes {
  /** What the move was, in words, when the individual was mutated. */
  readonly moveText?: string;
  /** The two positions drawn, as the event has them. */
  readonly drawsText?: string;
  /** The edges the move took out and put in, when it was mutated. */
  readonly edgesText?: string;
  readonly before: number;
  readonly after: number;
  readonly lengthText: string;
}

/** The notes for one mutation event: the move, the draws behind it, the edges it changed and what it did to the length. */
export function tourMutationNotes(event: MutationEvent, info: TourInfo): TourMutationNotes {
  const before = info.lengthOf(event.before);
  const after = info.lengthOf(event.after);
  const move = event.move;
  if (!move || !event.edges) return { before, after, lengthText: `length ${info.lengthText(before)}` };
  const i = move.first + 1;
  const j = move.second + 1;
  const moveText =
    move.kind === 'swap' ? `swap the cities at positions ${i} and ${j}` : move.kind === 'inversion' ? `reverse the slice from position ${i} to ${j}` : `take the city at position ${i} out and put it at position ${j}`;
  const edge = (e: readonly [number, number]) => `${e[0] + 1}–${e[1] + 1}`;
  const edgesText = `✕ removed ${event.edges.removed.map(edge).join(', ')} · added ${event.edges.added.map(edge).join(', ')}`;
  const delta = after - before;
  const sign = delta > 0 ? '+' : delta < 0 ? '−' : '±';
  return {
    moveText,
    drawsText: `positions drawn u₁ = ${num(move.r[0])}, u₂ = ${num(move.r[1])}`,
    edgesText,
    before,
    after,
    lengthText: `length ${info.lengthText(before)} → ${info.lengthText(after)} (${sign}${info.lengthText(Math.abs(delta))})`,
  };
}
