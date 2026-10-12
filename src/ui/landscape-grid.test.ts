import { describe, expect, test } from 'vitest';
import { landscapeFitnessRange, landscapeFunctionInfo, landscapeFunctions, landscapeProblem, type LandscapeFunction } from '../engine';
import { landscapeInfoOf } from './landscape-context';
import { colourAt, fitnessGrid, isolineLevels, isolines, landscapeSentence, optimumMarks, ramp, rampLuminance, zoomRegion } from './landscape-grid';

const infoOf = (fn: LandscapeFunction) => landscapeInfoOf(landscapeProblem({ function: fn, representation: 'real', bitsPerVariable: 10 }));
const whole = (fn: LandscapeFunction) => {
  const { lo, hi } = landscapeFunctionInfo[fn].bounds;
  return { x0: lo, x1: hi, y0: lo, y1: hi };
};

describe('what a view knows about the landscape beyond how a chromosome decodes', () => {
  test('the fitness at any point, the optima and the fitness range of the function', () => {
    for (const fn of landscapeFunctions) {
      const p = landscapeProblem({ function: fn, representation: 'real', bitsPerVariable: 10 });
      const i = infoOf(fn);
      expect(i.fitnessAt(1.25, -2.5)).toBe(p.fitnessAt(1.25, -2.5));
      expect(i.optima).toEqual(landscapeFunctionInfo[fn].optima);
      expect(i.fitnessRange).toEqual(landscapeFitnessRange(p));
      expect(i.id).toBe(fn);
    }
  });
});

describe('the fitness grid', () => {
  test('every cell is the engine’s fitness at the centre-of-corner point it stands for, for every function', () => {
    for (const fn of landscapeFunctions) {
      const info = infoOf(fn);
      const region = whole(fn);
      const grid = fitnessGrid(info, region, 41, 31);
      expect(grid.nx).toBe(41);
      expect(grid.ny).toBe(31);
      expect(grid.values).toHaveLength(41 * 31);
      for (const [i, j] of [[0, 0], [40, 0], [0, 30], [40, 30], [20, 15], [7, 22], [33, 4]] as const) {
        const x = region.x0 + ((region.x1 - region.x0) * i) / 40;
        const y = region.y0 + ((region.y1 - region.y0) * j) / 30;
        expect(grid.values[j * 41 + i]).toBe(info.fitnessAt(x, y));
        expect(grid.xAt(i)).toBeCloseTo(x, 12);
        expect(grid.yAt(j)).toBeCloseTo(y, 12);
      }
    }
  });

  test('a zoomed region is sampled over that region only', () => {
    const info = infoOf('single-peak');
    const grid = fitnessGrid(info, { x0: 1, x1: 3, y0: -2, y1: 0 }, 11, 11);
    expect(grid.values[5 * 11 + 5]).toBe(info.fitnessAt(2, -1)); // the optimum is the middle of this region: fitness 1
    expect(grid.values[5 * 11 + 5]).toBe(1);
  });
});

describe('the colour ramp', () => {
  // colours are whole numbers, so lightness can wobble by a thousandth between neighbours: far below what the eye sees
  test('goes from dark to light without ever going back, so a higher fitness is always a lighter colour', () => {
    let last = -1;
    for (let k = 0; k <= 255; k++) {
      const l = rampLuminance(ramp(k / 255));
      expect(l).toBeGreaterThanOrEqual(last - 0.003);
      last = l;
    }
    expect(rampLuminance(ramp(1))).toBeGreaterThan(rampLuminance(ramp(0)) + 0.5);
  });

  test('the worst fitness is the bottom of the ramp, the best the top, and a value outside is cut to them', () => {
    expect(colourAt(-5, -5, 10)).toEqual(ramp(0));
    expect(colourAt(10, -5, 10)).toEqual(ramp(1));
    expect(colourAt(-100, -5, 10)).toEqual(ramp(0));
    expect(colourAt(100, -5, 10)).toEqual(ramp(1));
    expect(colourAt(2.5, -5, 10)).toEqual(ramp(0.5));
  });

  test('is monotone in fitness: more fitness never gives a darker colour', () => {
    let last = -1;
    for (let v = -5; v <= 10; v += 0.1) {
      const l = rampLuminance(colourAt(v, -5, 10));
      expect(l).toBeGreaterThanOrEqual(last - 0.003);
      last = l;
    }
  });
});

describe('isolines', () => {
  test('the levels are 20, 40, 60 and 80% of the fitness range', () => {
    expect(isolineLevels({ min: 0, max: 1 })).toEqual([0.2, 0.4, 0.6, 0.8]);
    expect(isolineLevels({ min: -890, max: 0 }).map((v) => Math.round(v * 1000) / 1000)).toEqual([-712, -534, -356, -178]);
  });

  test('lie where the fitness crosses the level: every segment end of the single peak is at the level, to the size of a cell', () => {
    const info = infoOf('single-peak');
    const grid = fitnessGrid(info, whole('single-peak'), 201, 201);
    const levels = isolineLevels(info.fitnessRange);
    const lines = isolines(grid, levels);
    expect(lines).toHaveLength(levels.length);
    const cell = 10 / 200;
    let ends = 0;
    lines.forEach((segments, k) => {
      expect(segments.length).toBeGreaterThan(10);
      for (const [x1, y1, x2, y2] of segments) {
        for (const [x, y] of [[x1, y1], [x2, y2]] as const) {
          ends++;
          // the true level set of exp(−r²/8) is the circle r² = −8 ln L around (2, −1); linear interpolation stays within a cell of it
          const r = Math.hypot(x - 2, y + 1);
          expect(Math.abs(r - Math.sqrt(-8 * Math.log(levels[k]!)))).toBeLessThan(cell);
          expect(Math.abs(info.fitnessAt(x, y) - levels[k]!)).toBeLessThan(0.02);
        }
      }
    });
    expect(ends).toBeGreaterThan(400);
  });

  test('uses the values at the cell corners to place each end (linear interpolation), so even a coarse grid puts the ends at the level', () => {
    const info = infoOf('single-peak');
    const grid = fitnessGrid(info, whole('single-peak'), 21, 21); // cells half a unit wide
    const levels = isolineLevels(info.fitnessRange);
    isolines(grid, levels).forEach((segments, k) => {
      expect(segments.length).toBeGreaterThan(5);
      for (const [x1, y1, x2, y2] of segments) for (const [x, y] of [[x1, y1], [x2, y2]] as const) expect(Math.abs(info.fitnessAt(x, y) - levels[k]!)).toBeLessThan(0.03);
    });
  });

  test('a level a function never reaches has no segments', () => {
    const info = infoOf('single-peak');
    const grid = fitnessGrid(info, whole('single-peak'), 41, 41);
    expect(isolines(grid, [5, -3])).toEqual([[], []]);
  });

  test('on Rastrigin the lines are many (many hills) and on Himmelblau they close around four minima', () => {
    const rast = infoOf('rastrigin');
    const l = isolines(fitnessGrid(rast, whole('rastrigin'), 201, 201), [isolineLevels(rast.fitnessRange)[3]!]);
    expect(l[0]!.length).toBeGreaterThan(100);
  });
});

describe('the optimum marks', () => {
  test('are the known optima, and only those inside the region shown', () => {
    expect(optimumMarks(infoOf('himmelblau'), whole('himmelblau'))).toEqual(landscapeFunctionInfo.himmelblau.optima);
    expect(optimumMarks(infoOf('himmelblau'), { x0: 2, x1: 4, y0: 1, y1: 3 })).toEqual([{ x: 3, y: 2 }]);
    expect(optimumMarks(infoOf('single-peak'), { x0: -5, x1: 0, y0: -5, y1: 0 })).toEqual([]);
    expect(optimumMarks(infoOf('rastrigin'), whole('rastrigin'))).toEqual([{ x: 0, y: 0 }]);
  });
});

describe('zoom to the population', () => {
  const bounds = { lo: -5, hi: 5 };

  test('the bounding box of the points plus a margin of a fifth of the box, never past the bounds', () => {
    const r = zoomRegion([{ x: 1, y: 1 }, { x: 2, y: 3 }], bounds);
    expect(r.x0).toBeCloseTo(1 - 0.2, 12);
    expect(r.x1).toBeCloseTo(2 + 0.2, 12);
    expect(r.y0).toBeCloseTo(1 - 0.4, 12);
    expect(r.y1).toBeCloseTo(3 + 0.4, 12);
    const edge = zoomRegion([{ x: -4.9, y: 4.9 }, { x: -4, y: 4.95 }], bounds);
    expect(edge.x0).toBe(-5);
    expect(edge.y1).toBe(5);
  });

  test('a population in one place still gets a region with a width, centred on it, and the shape stays square', () => {
    const r = zoomRegion([{ x: 2, y: -1 }, { x: 2, y: -1 }], bounds);
    expect(r.x1 - r.x0).toBeGreaterThan(0.5);
    expect(r.y1 - r.y0).toBeGreaterThan(0.5);
    expect((r.x0 + r.x1) / 2).toBeCloseTo(2, 12);
    expect((r.y0 + r.y1) / 2).toBeCloseTo(-1, 12);
  });

  test('no points means the whole landscape', () => {
    expect(zoomRegion([], bounds)).toEqual({ x0: -5, x1: 5, y0: -5, y1: 5 });
  });
});

describe('the sentence that stands for the picture', () => {
  test('names the function, its bounds, where the optimum is and the range of fitness; and says what is shown', () => {
    const s = landscapeSentence(infoOf('two-peaks'), { x0: -5, x1: 5, y0: -5, y1: 5 }, false);
    expect(s).toContain('Two peaks');
    expect(s).toContain('x and y from −5 to 5');
    expect(s).toContain('the optimum is at (3.000, 3.000)');
    expect(s).toMatch(/fitness from 0\.00 to 1\.00/);
  });

  test('Himmelblau has four optima and Rastrigin’s fitness is the negative of f; a zoomed view says it is zoomed', () => {
    expect(landscapeSentence(infoOf('himmelblau'), whole('himmelblau'), false)).toContain('four optima');
    expect(landscapeSentence(infoOf('rastrigin'), whole('rastrigin'), false)).toContain('fitness = −f');
    expect(landscapeSentence(infoOf('single-peak'), { x0: 1, x1: 3, y0: -2, y1: 0 }, true)).toContain('Zoomed to the population: x from 1.0 to 3.0, y from −2.0 to 0.0');
  });
});
