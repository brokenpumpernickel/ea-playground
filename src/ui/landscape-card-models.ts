import { bitsOfInteger, decodeVariable, type Bounds } from '../engine';
import type { BlendView } from './variation-models';

/**
 * The numbers behind the drawings in the landscape's operator cards, as pure functions, so every position on a number
 * line and every row of the flip table can be checked against the engine's numbers.
 */

export interface LineMark {
  readonly kind: 'parent' | 'child';
  readonly label: string;
  readonly value: number;
  /** Where on the line, 0 to 1. */
  readonly fraction: number;
  /** A child whose value was cut to a bound. */
  readonly clamped: boolean;
}

export interface NumberLine {
  readonly lo: number;
  readonly hi: number;
  /** The widened interval BLX-α draws from, cut at the line's ends. */
  readonly widened: { readonly from: number; readonly to: number };
  /** The interval between the two parents. */
  readonly parents: { readonly from: number; readonly to: number };
  readonly marks: readonly LineMark[];
}

const unit = (v: number) => Math.min(1, Math.max(0, v));

/** A line that holds every value in `values` with a little room, never past the bounds, and never of no width. */
function domain(values: readonly number[], bounds: Bounds): { lo: number; hi: number } {
  const low = Math.min(...values);
  const high = Math.max(...values);
  const pad = Math.max(0.08 * (high - low), 0.05 * (bounds.hi - bounds.lo));
  return { lo: Math.max(bounds.lo, low - pad), hi: Math.min(bounds.hi, high + pad) };
}

/** BLX-α at one gene: the widened interval, the parents' interval, the parents and the children on one line. */
export function blendLine(g: BlendView): NumberLine {
  const { lo, hi } = domain([g.from, g.to, g.a, g.b, ...g.values], g.bounds);
  const at = (v: number) => (v - lo) / (hi - lo);
  return {
    lo,
    hi,
    widened: { from: unit(at(g.from)), to: unit(at(g.to)) },
    parents: { from: at(Math.min(g.a, g.b)), to: at(Math.max(g.a, g.b)) },
    marks: [
      { kind: 'parent', label: 'A', value: g.a, fraction: at(g.a), clamped: false },
      { kind: 'parent', label: 'B', value: g.b, fraction: at(g.b), clamped: false },
      { kind: 'child', label: 'O1', value: g.values[0], fraction: at(g.values[0]), clamped: g.clamped[0] },
      { kind: 'child', label: 'O2', value: g.values[1], fraction: at(g.values[1]), clamped: g.clamped[1] },
    ],
  };
}

export interface ArithmeticLines {
  /** The weights of A and B in each child: O1 = λ·A + (1 − λ)·B, O2 = (1 − λ)·A + λ·B. */
  readonly weights: { readonly o1: readonly [number, number]; readonly o2: readonly [number, number] };
  /** One line per gene, with the parents and both children. */
  readonly lines: readonly { readonly lo: number; readonly hi: number; readonly marks: readonly LineMark[] }[];
}

export function arithmeticLine(input: {
  readonly lambda: number;
  readonly parentA: readonly number[];
  readonly parentB: readonly number[];
  readonly children: readonly (readonly number[])[];
  readonly bounds: Bounds;
}): ArithmeticLines {
  const { lambda, parentA, parentB, children, bounds } = input;
  return {
    weights: { o1: [lambda, 1 - lambda], o2: [1 - lambda, lambda] },
    lines: parentA.map((a, i) => {
      const b = parentB[i]!;
      const values = [a, b, children[0]![i]!, children[1]![i]!];
      const { lo, hi } = domain(values, bounds);
      const at = (v: number) => (v - lo) / (hi - lo);
      const labels = ['A', 'B', 'O1', 'O2'];
      return { lo, hi, marks: values.map((v, k): LineMark => ({ kind: k < 2 ? 'parent' : 'child', label: labels[k]!, value: v, fraction: at(v), clamped: false })) };
    }),
  };
}

export interface FlipRow {
  /** The bit flipped, counted from 1 at the most significant bit. */
  readonly bit: number;
  /** The variable's bits after the flip. */
  readonly bits: readonly number[];
  /** The value they decode to. */
  readonly value: number;
  /** How far that is from the value before the flip. */
  readonly moves: number;
}

/** What flipping each bit of the variable that stands for integer `index` does, in the given coding. */
export function flipTable(index: number, n: number, coding: 'plain' | 'gray', bounds: Bounds): FlipRow[] {
  const bits = bitsOfInteger(index, n, coding);
  const start = decodeVariable(bits, coding, bounds);
  return bits.map((_, k) => {
    const flipped = bits.map((b, i) => (i === k ? 1 - b : b));
    const value = decodeVariable(flipped, coding, bounds);
    return { bit: k + 1, bits: flipped, value, moves: value - start };
  });
}

/** How many bits differ between the code of `index` and the code of the next integer: a neighbouring value. */
export function neighbourBits(index: number, n: number, coding: 'plain' | 'gray'): number {
  const a = bitsOfInteger(index, n, coding);
  const b = bitsOfInteger(index + 1, n, coding);
  return a.filter((bit, k) => bit !== b[k]).length;
}
