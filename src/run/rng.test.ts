import { describe, expect, test } from 'vitest';
import { createRng } from './rng';

const draw = (seed: number, n: number) => {
  const rng = createRng(seed);
  return Array.from({ length: n }, () => rng.next());
};

describe('seeded generator', () => {
  test('the same seed gives the same sequence', () => {
    expect(draw(7, 20)).toEqual(draw(7, 20));
  });

  test('different seeds give different sequences', () => {
    expect(draw(1, 5)).not.toEqual(draw(2, 5));
  });

  test('every value is in [0, 1)', () => {
    for (const v of draw(123, 10_000)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  // Reference values computed with an independent implementation of mulberry32 (Python, 32-bit integer arithmetic).
  test('matches the published mulberry32 sequence', () => {
    expect(draw(42, 4)).toEqual([0.6011037519201636, 0.44829055899754167, 0.8524657934904099, 0.6697340414393693]);
    expect(draw(0, 4)).toEqual([0.26642920868471265, 0.0003297457005828619, 0.2232720274478197, 0.1462021479383111]);
  });

  test('draws are spread roughly evenly', () => {
    const values = draw(99, 20_000);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    expect(mean).toBeGreaterThan(0.49);
    expect(mean).toBeLessThan(0.51);
  });
});

describe('generator state', () => {
  test('a generator created from a saved state continues exactly where the original left off', () => {
    const original = createRng(2025);
    for (let k = 0; k < 7; k++) original.next();
    const saved = original.state();

    const resumed = createRng(saved);
    for (let k = 0; k < 20; k++) expect(resumed.next()).toBe(original.next());
  });

  test('the state of a fresh generator is its seed, and it changes with every draw', () => {
    const rng = createRng(99);
    expect(rng.state()).toBe(99);
    rng.next();
    expect(rng.state()).not.toBe(99);
  });

  test('state is a 32-bit integer, so it survives being stored as a plain number', () => {
    const rng = createRng(123456789);
    for (let k = 0; k < 50; k++) {
      rng.next();
      expect(Number.isInteger(rng.state())).toBe(true);
      expect(rng.state()).toBe(rng.state() | 0);
    }
  });
});
