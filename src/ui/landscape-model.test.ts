import { describe, expect, test } from 'vitest';
import { goldberg } from '../engine';
import { landscapeModel } from './landscape-model';

const landscape = goldberg.landscape!;
const rows = [13, 24, 8, 19].map((x) => ({ decoded: x, fitness: x * x }));

describe('the curve', () => {
  test('is the problem’s own fitness for every value in its domain, on a fixed scale', () => {
    const m = landscapeModel(landscape, rows);
    expect(m.label).toBe('f(x) = x²');
    expect(m.curve).toHaveLength(32);
    m.curve.forEach((p, x) => expect(p).toEqual({ x, y: goldberg.evaluate(x.toString(2).padStart(5, '0').split('').map(Number) as never).fitness }));
    expect(m.yMax).toBe(1000);
    expect(m.yTicks).toEqual([0, 250, 500, 750, 1000]);
    expect(m.xTicks).toEqual([0, 5, 10, 15, 20, 25, 30]);
  });

  test('does not depend on who is in the population', () => {
    expect(landscapeModel(landscape, rows).curve).toEqual(landscapeModel(landscape, [{ decoded: 31, fitness: 961 }]).curve);
  });
});

describe('the individuals', () => {
  test('each distinct value is one mark with its fitness, left to right, and the best is flagged', () => {
    const m = landscapeModel(landscape, rows);
    expect(m.marks).toEqual([
      { x: 8, fitness: 64, count: 1, best: false },
      { x: 13, fitness: 169, count: 1, best: false },
      { x: 19, fitness: 361, count: 1, best: false },
      { x: 24, fitness: 576, count: 1, best: true },
    ]);
    expect(m.size).toBe(4);
  });

  test('individuals with the same value share a mark and are counted', () => {
    const m = landscapeModel(landscape, [24, 24, 24, 8].map((x) => ({ decoded: x, fitness: x * x })));
    expect(m.marks).toEqual([
      { x: 8, fitness: 64, count: 1, best: false },
      { x: 24, fitness: 576, count: 3, best: true },
    ]);
    expect(m.size).toBe(4);
  });
});
