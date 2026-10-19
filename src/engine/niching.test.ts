import { describe, expect, test } from 'vitest';
import { bitsOfInteger, landscapeFunctionInfo, landscapeProblem, type LandscapeFunction, type LandscapeOptions } from './landscape';
import { nichingDefaults, nichingMethods, validateNiching, type NichingConfig } from './niching';

const options = (fn: LandscapeFunction, representation: LandscapeOptions['representation'] = 'real', bitsPerVariable = 10): LandscapeOptions => ({ function: fn, representation, bitsPerVariable });
const real = (fn: LandscapeFunction) => landscapeProblem(options(fn));

describe('the distance between two individuals of a landscape', () => {
  test('is the Euclidean distance between their decoded points: a 3-4-5 triangle for the real-valued problem', () => {
    const p = real('two-peaks');
    expect(p.distance!({ values: [0, 0] }, { values: [3, 4] })).toBe(5);
    expect(p.distance!({ values: [-1, 2] }, { values: [-1, 2] })).toBe(0);
  });

  test('is symmetric, and for the binary-coded problems it is measured between the decoded points, not the bits', () => {
    for (const representation of ['plain', 'gray'] as const) {
      const p = landscapeProblem(options('two-peaks', representation, 8));
      const top = bitsOfInteger(255, 8, representation); // the integer 255, the upper bound, in this coding
      const a = p.evaluate([...Array(8).fill(0), ...Array(8).fill(0)]); // (−5, −5)
      const b = p.evaluate([...top, ...top]); // (5, 5)
      expect(a.values).toEqual([-5, -5]);
      expect(b.values).toEqual([5, 5]);
      expect(p.distance!(a, b)).toBeCloseTo(10 * Math.SQRT2, 12);
      expect(p.distance!(b, a)).toBe(p.distance!(a, b));
      // one bit away is not one unit away: the most significant bit of x moves the point across half the range
      const c = p.evaluate([1, ...Array(7).fill(0), ...Array(8).fill(0)]);
      expect(p.distance!(a, c)).toBeGreaterThan(4.9);
      expect(p.distance!(a, c)).toBeCloseTo(Math.abs(c.values![0]! - -5), 12); // only x differs
    }
  });

  test('every landscape has one, and a problem without decoded points has none', () => {
    for (const fn of ['single-peak', 'two-peaks', 'rastrigin', 'himmelblau'] as const) expect(typeof real(fn).distance, fn).toBe('function');
  });

  test('is refused in words for an individual with no decoded point', () => {
    expect(() => real('two-peaks').distance!({} as never, { values: [0, 0] })).toThrow(/decoded point/);
  });
});

describe('the known peaks of the landscape functions', () => {
  test('the single peak, the two hills of the two-peaks function and the four places of Himmelblau, each with a name, a top and a height', () => {
    const single = landscapeFunctionInfo['single-peak'].peaks!;
    expect(single).toHaveLength(1);
    expect(single[0]).toMatchObject({ name: 'the peak', x: 2, y: -1, height: 1 });
    const two = landscapeFunctionInfo['two-peaks'].peaks!;
    expect(two.map((p) => p.name)).toEqual(['broad hill', 'narrow hill']);
    expect(two[0]).toMatchObject({ x: -2.5, y: -2.5 });
    expect(two[0]!.height).toBeCloseTo(0.6, 12);
    expect(two[1]!.height).toBeCloseTo(1.0003117907569556, 9);
    const him = landscapeFunctionInfo.himmelblau.peaks!;
    expect(him.map((p) => p.name)).toEqual(['place 1', 'place 2', 'place 3', 'place 4']);
    expect(him.map((p) => [p.x, p.y])).toEqual(landscapeFunctionInfo.himmelblau.optima.map((o) => [o.x, o.y]));
    // Rastrigin has too many local optima to name
    expect(landscapeFunctionInfo.rastrigin.peaks).toBeUndefined();
  });

  test('each is a local maximum of fitness: nothing in a ring round it is higher, at three radii', () => {
    for (const fn of ['single-peak', 'two-peaks', 'himmelblau'] as const) {
      const p = real(fn);
      for (const peak of landscapeFunctionInfo[fn].peaks!) {
        expect(p.fitnessAt(peak.x, peak.y), `${fn} ${peak.name}: the height is the fitness at the top`).toBeCloseTo(peak.height, 9);
        for (const r of [1e-4, 1e-2, 0.1]) {
          for (let k = 0; k < 16; k++) {
            const a = (2 * Math.PI * k) / 16;
            expect(p.fitnessAt(peak.x + r * Math.cos(a), peak.y + r * Math.sin(a)), `${fn} ${peak.name} at radius ${r}`).toBeLessThanOrEqual(peak.height + 1e-12);
          }
        }
      }
    }
  });

  test('every peak lies inside the bounds, and the highest peak is the known optimum', () => {
    for (const fn of ['single-peak', 'two-peaks', 'himmelblau'] as const) {
      const info = landscapeFunctionInfo[fn];
      for (const peak of info.peaks!) {
        expect(peak.x).toBeGreaterThanOrEqual(info.bounds.lo);
        expect(peak.x).toBeLessThanOrEqual(info.bounds.hi);
        expect(peak.y).toBeGreaterThanOrEqual(info.bounds.lo);
        expect(peak.y).toBeLessThanOrEqual(info.bounds.hi);
      }
      const p = real(fn);
      expect(Math.max(...info.peaks!.map((q) => q.height))).toBeCloseTo(p.knownOptimumFitness, 9);
    }
  });
});

describe('the niching configuration and its validation', () => {
  const sharing: NichingConfig = { method: 'sharing', sigma: 2, alpha: 1 };
  const twoPeaks = real('two-peaks');

  test('there are three methods, and the defaults are a radius of 2 and a shape of 1', () => {
    expect(nichingMethods).toEqual(['none', 'sharing', 'crowding']);
    expect(nichingDefaults).toEqual({ sigma: 2, alpha: 1 });
  });

  test('a good configuration has nothing to say, for every method, and σ and α are kept while another method is chosen', () => {
    for (const method of nichingMethods) expect(validateNiching({ ...sharing, method }, twoPeaks)).toEqual([]);
  });

  test('says in words what is wrong with σ, with α and with the method', () => {
    expect(validateNiching({ ...sharing, sigma: 0 }, twoPeaks)).toEqual(['σ (the niche radius) must be a number greater than 0 (it is 0).']);
    expect(validateNiching({ ...sharing, sigma: -1 }, twoPeaks)).toEqual(['σ (the niche radius) must be a number greater than 0 (it is -1).']);
    expect(validateNiching({ ...sharing, sigma: Number.NaN }, twoPeaks)).toEqual(['σ (the niche radius) must be a number greater than 0 (it is not a number).']);
    expect(validateNiching({ ...sharing, alpha: 0 }, twoPeaks)).toEqual(['α (the shape of the sharing kernel) must be a number greater than 0 (it is 0).']);
    expect(validateNiching({ ...sharing, alpha: Infinity }, twoPeaks)).toEqual(['α (the shape of the sharing kernel) must be a number greater than 0 (it is not a number).']);
    expect(validateNiching({ ...sharing, method: 'clearing' as never }, twoPeaks)).toEqual(['Niching must be one of none, sharing, crowding (it is "clearing").']);
    expect(validateNiching({ ...sharing, sigma: 0, alpha: 0 }, twoPeaks)).toHaveLength(2);
  });

  test('refuses a method for a problem that has no distance, and says why', () => {
    const goldbergLike = { distance: undefined };
    expect(validateNiching(sharing, goldbergLike)).toEqual(['Fitness sharing needs a distance between individuals, and this problem has none.']);
    expect(validateNiching({ ...sharing, method: 'crowding' }, goldbergLike)).toEqual(['Deterministic crowding needs a distance between individuals, and this problem has none.']);
    // none needs nothing
    expect(validateNiching({ ...sharing, method: 'none' }, goldbergLike)).toEqual([]);
  });
});
