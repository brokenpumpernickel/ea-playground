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
