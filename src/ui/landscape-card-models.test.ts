import { describe, expect, test } from 'vitest';
import { bitsOfInteger, decodeVariable, integerOfBits } from '../engine';
import { arithmeticLine, blendLine, flipTable, neighbourBits } from './landscape-card-models';
import type { BlendView } from './variation-models';

const gene = (o: Partial<BlendView> = {}): BlendView => ({
  gene: 1,
  name: 'x',
  a: -2.1,
  b: 0.9,
  d: 3,
  from: -3.6,
  to: 2.4,
  draws: [0.5, 0.25],
  raw: [-0.6, -2.1],
  values: [-0.6, -2.1],
  clamped: [false, false],
  bounds: { lo: -5, hi: 5 },
  ...o,
});

describe('encoding an integer back to bits', () => {
  test('plain binary writes the integer, Gray code its reflected Gray word, most significant bit first', () => {
    expect(bitsOfInteger(5, 4, 'plain')).toEqual([0, 1, 0, 1]);
    expect(bitsOfInteger(5, 4, 'gray')).toEqual([0, 1, 1, 1]);
    expect(bitsOfInteger(0, 4, 'gray')).toEqual([0, 0, 0, 0]);
    expect(bitsOfInteger(15, 4, 'gray')).toEqual([1, 0, 0, 0]);
  });

  test('is the inverse of reading the bits, for every integer and both codings', () => {
    for (const coding of ['plain', 'gray'] as const) {
      for (const n of [4, 7]) for (let v = 0; v < 2 ** n; v++) expect(integerOfBits(bitsOfInteger(v, n, coding), coding)).toBe(v);
    }
  });
});

describe('the BLX-α number line', () => {
  test('shows the widened interval and the parents’ interval, the parents and the children, as fractions of a line wide enough for them', () => {
    const line = blendLine(gene());
    expect(line.lo).toBeLessThanOrEqual(-3.6);
    expect(line.hi).toBeGreaterThanOrEqual(2.4);
    expect(line.lo).toBeGreaterThanOrEqual(-5);
    expect(line.hi).toBeLessThanOrEqual(5);
    const at = (v: number) => (v - line.lo) / (line.hi - line.lo);
    expect(line.widened).toEqual({ from: at(-3.6), to: at(2.4) });
    expect(line.parents).toEqual({ from: at(-2.1), to: at(0.9) });
    expect(line.marks.map((m) => [m.kind, m.label, m.fraction])).toEqual([
      ['parent', 'A', at(-2.1)],
      ['parent', 'B', at(0.9)],
      ['child', 'O1', at(-0.6)],
      ['child', 'O2', at(-2.1)],
    ]);
  });

  test('a child that was clamped sits on the bound and says so; the line never goes past the bounds', () => {
    const line = blendLine(gene({ a: 4, b: 5, d: 1, from: 3, to: 6, raw: [5.7, 4.5], values: [5, 4.5], clamped: [true, false] }));
    expect(line.hi).toBe(5);
    const o1 = line.marks.find((m) => m.label === 'O1')!;
    expect(o1.fraction).toBe(1);
    expect(o1.clamped).toBe(true);
    expect(line.marks.find((m) => m.label === 'O2')!.clamped).toBe(false);
    expect(line.widened.to).toBe(1); // the widened interval is cut at the bound too
  });

  test('equal parents give a line that still has a width', () => {
    const line = blendLine(gene({ a: 2, b: 2, d: 0, from: 2, to: 2, raw: [2, 2], values: [2, 2] }));
    expect(line.hi).toBeGreaterThan(line.lo);
    expect(line.marks.every((m) => m.fraction >= 0 && m.fraction <= 1)).toBe(true);
  });
});

describe('the arithmetic number line and table', () => {
  test('the parents and the two children on one line per gene, with the weights', () => {
    const rows = arithmeticLine({ lambda: 0.25, parentA: [-2.1, 1.4], parentB: [0.9, -0.6], children: [[0.15, -0.1], [-1.35, 0.9]], bounds: { lo: -5, hi: 5 } });
    expect(rows.weights).toEqual({ o1: [0.25, 0.75], o2: [0.75, 0.25] });
    expect(rows.lines).toHaveLength(2);
    expect(rows.lines[0]!.marks.map((m) => m.label)).toEqual(['A', 'B', 'O1', 'O2']);
    const x = rows.lines[0]!;
    const at = (v: number) => (v - x.lo) / (x.hi - x.lo);
    expect(x.marks.map((m) => m.fraction)).toEqual([at(-2.1), at(0.9), at(0.15), at(-1.35)]);
  });
});

describe('what flipping each bit of a variable does, in plain binary and in Gray code', () => {
  const bounds = { lo: -5, hi: 5 };

  test('every row is the flipped bit string, the value it decodes to and how far that is from the value now', () => {
    const rows = flipTable(500, 10, 'plain', bounds);
    expect(rows).toHaveLength(10);
    const start = decodeVariable(bitsOfInteger(500, 10, 'plain'), 'plain', bounds);
    rows.forEach((r, k) => {
      const flipped = bitsOfInteger(500, 10, 'plain').map((b, i) => (i === k ? 1 - b : b));
      expect(r.bit).toBe(k + 1);
      expect(r.bits).toEqual(flipped);
      expect(r.value).toBe(decodeVariable(flipped, 'plain', bounds));
      expect(r.moves).toBeCloseTo(r.value - start, 12);
    });
  });

  test('in plain binary the first bit moves the value by about half the range and the last by one step; in Gray code the same position moves it differently', () => {
    const plain = flipTable(500, 10, 'plain', bounds);
    expect(Math.abs(plain[0]!.moves)).toBeCloseTo((10 * 512) / 1023, 9);
    expect(Math.abs(plain[9]!.moves)).toBeCloseTo(10 / 1023, 9);
    const gray = flipTable(500, 10, 'gray', bounds);
    expect(gray).toHaveLength(10);
    expect(gray.map((r) => r.moves)).not.toEqual(plain.map((r) => r.moves));
  });

  test('how many bits differ between a value and the next one: up to all of them in plain binary, always one in Gray code', () => {
    expect(neighbourBits(511, 10, 'plain')).toBe(10); // 0111111111 → 1000000000
    expect(neighbourBits(512, 10, 'plain')).toBe(1);
    for (let v = 0; v < 1023; v++) expect(neighbourBits(v, 10, 'gray')).toBe(1);
  });
});
