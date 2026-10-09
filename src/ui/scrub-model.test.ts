import { describe, expect, test } from 'vitest';
import { gaAlgorithm } from '../engine';
import { createRun } from '../run';
import type { Position } from '../run';
import { defaultParams, defaultSetup } from './config';
import { layoutsOf, positionAtX, scrubModel, xOfPosition } from './scrub-model';

const make = (generations: number) => {
  const run = createRun(gaAlgorithm, { setup: defaultSetup, params: defaultParams, seed: 42 });
  for (let g = 0; g < generations; g++) run.forwardCycle();
  return run;
};
/** Every position the run has, in the order the cursor visits them. */
const allPositions = (run: ReturnType<typeof make>): Position[] =>
  Array.from({ length: run.lastCycle + 1 }, (_, cycle) => run.layout(cycle).flatMap((s, stage) => Array.from({ length: s.micros + 1 }, (_, micro) => ({ cycle, stage, micro })))).flat();

describe('mapping positions to the bar', () => {
  test('every recorded position has its own place on the bar, and the place maps back to it', () => {
    const run = make(4);
    const layouts = layoutsOf(run);
    for (const position of allPositions(run)) expect(positionAtX(layouts, 1440, xOfPosition(layouts, 1440, position))).toEqual(position);
  });

  test('later positions are further right, so dragging forward moves forward in the run', () => {
    const run = make(4);
    const layouts = layoutsOf(run);
    const xs = allPositions(run).map((p) => xOfPosition(layouts, 1440, p));
    xs.forEach((x, k) => k > 0 && expect(x).toBeGreaterThan(xs[k - 1]!));
  });

  test('each generation gets an equal share of the bar, and the bar is not overrun at the live end', () => {
    const run = make(3);
    const layouts = layoutsOf(run);
    expect(xOfPosition(layouts, 1200, { cycle: 2, stage: 0, micro: 0 })).toBe(600);
    expect(xOfPosition(layouts, 1200, { cycle: 3, stage: 0, micro: 0 })).toBe(900);
    expect(xOfPosition(layouts, 1200, { cycle: 3, stage: 5, micro: run.layout(3)[5]!.micros })).toBeLessThan(1200);
  });

  test('a point outside the bar snaps to the first or last position', () => {
    const run = make(3);
    const layouts = layoutsOf(run);
    expect(positionAtX(layouts, 1440, -50)).toEqual({ cycle: 0, stage: 0, micro: 0 });
    const last = run.layout(3);
    expect(positionAtX(layouts, 1440, 5000)).toEqual({ cycle: 3, stage: last.length - 1, micro: last[last.length - 1]!.micros });
  });

  test('every position that positionAtX returns exists in the run', () => {
    const run = make(3);
    const layouts = layoutsOf(run);
    for (let x = 0; x <= 1440; x += 7) expect(run.moveTo(positionAtX(layouts, 1440, x))).toBe(true);
  });
});

describe('scrub model', () => {
  test('has a cell per recorded generation, with the thumb where the cursor is and the current generation named', () => {
    const run = make(5);
    run.moveTo({ cycle: 2, stage: 3, micro: 1 });
    const model = scrubModel(run, 1440);
    expect(model.cells).toBe(6);
    expect(model.cellWidth).toBe(240);
    expect(model.thumbX).toBeCloseTo(xOfPosition(layoutsOf(run), 1440, run.cursor), 9);
    expect(model.current).toBe(2);
    expect(model.valueText).toBe('Generation 2, stage 4 Mutation, micro-step 1 of 6');
  });

  test('labels thin out when the generations are too many to name each one', () => {
    const few = scrubModel(make(5), 1440);
    expect(few.labels.map((l) => l.generation)).toEqual([0, 1, 2, 3, 4, 5]);
    const many = scrubModel(make(40), 1440);
    expect(many.labels.length).toBeLessThan(41);
    expect(many.labels.every((l) => l.generation % many.labelStep === 0)).toBe(true);
    expect(many.labels[0]!.generation).toBe(0);
  });

  test('the position text for the setup, a stage entry and the end of a generation', () => {
    const run = make(2);
    run.moveTo({ cycle: 0, stage: 0, micro: 6 });
    expect(scrubModel(run, 1440).valueText).toBe('Generation 0, initial population');
    run.moveTo({ cycle: 1, stage: 1, micro: 0 });
    expect(scrubModel(run, 1440).valueText).toBe('Generation 1, stage 2 Pairing entered');
    run.moveTo({ cycle: 1, stage: 5, micro: 1 });
    expect(scrubModel(run, 1440).valueText).toBe('Generation 1, stage 6 Replacement, micro-step 1 of 1');
  });
});
