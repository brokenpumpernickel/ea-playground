import { describe, expect, test } from 'vitest';
import { formatReal, gaAlgorithm, goldberg, landscapeProblem, type GaEvent, type GaParams, type GaSetup, type LandscapeOptions, type RunState } from '../engine';
import { createRun, type Run } from '../run';
import { displayOf } from './format';
import { crossoverModel, mutationModel } from './variation-models';

type GaRun = Run<GaSetup, GaParams, RunState, GaEvent>;

const baseParams = (o: Partial<GaParams> = {}): GaParams => ({
  selection: { method: 'tournament', size: 2 },
  crossover: { enabled: true, operator: 'blx-alpha', probability: 1, alpha: 0.5 },
  mutation: { enabled: true, mode: 'per-gene', probability: 0.5, sigma: 0.1 },
  elites: 0,
  stop: { generationLimit: 50 },
  ...o,
});
const optionsOf = (o: Partial<LandscapeOptions> = {}): LandscapeOptions => ({ function: 'two-peaks', representation: 'real', bitsPerVariable: 6, ...o });
const make = (params: GaParams, options = optionsOf(), size = 6, seed = 11) => {
  const problem = landscapeProblem(options);
  const run: GaRun = createRun(gaAlgorithm, { setup: { problem, init: { kind: 'random', size } }, params, seed });
  run.forwardCycle();
  return { run, params, display: displayOf(problem), problem };
};
const at = (run: GaRun, stage: string, micro: number) => {
  const index = run.layout(1).findIndex((s) => s.stage === stage);
  expect(run.moveTo({ cycle: 1, stage: index, micro })).toBe(true);
  return run.view();
};
const crossoverEvents = (run: GaRun) => run.events(1).flatMap((e) => (e.stage === 'crossover' ? [e] : []));
const mutationEvents = (run: GaRun) => run.events(1).flatMap((e) => (e.stage === 'mutation' ? [e] : []));
const f3 = (v: number) => formatReal([v], 3);

describe('BLX-α pairs, read from the events', () => {
  test('every number the card shows is the event’s: per gene the parents, d, the widened interval, both draws, the raw and clamped values', () => {
    const { run, params, display } = make(baseParams({ crossover: { enabled: true, operator: 'blx-alpha', probability: 1, alpha: 1.5 } }), optionsOf(), 8);
    const engine = crossoverEvents(run);
    expect(engine.length).toBe(4);
    for (let k = 1; k <= engine.length; k++) {
      const model = crossoverModel(at(run, 'crossover', k), params.crossover, display);
      const pair = model.pairs[k - 1]!;
      const event = engine[k - 1]!;
      expect(model.real).toBe(true);
      expect(pair.alpha).toBe(1.5);
      expect(pair.blend).toHaveLength(2);
      pair.blend!.forEach((g, i) => {
        const e = event.blend![i]!;
        expect(g).toMatchObject({ gene: i + 1, name: i === 0 ? 'x' : 'y', a: e.a, b: e.b, d: e.d, from: e.from, to: e.to, draws: e.draws, raw: e.raw, clamped: e.clamped });
        expect(g.values).toEqual([event.children[0]!.chromosome[i], event.children[1]!.chromosome[i]]);
        expect(g.bounds).toEqual({ lo: -5, hi: 5 });
      });
      expect(pair.children.map((c) => c.clamped)).toEqual(event.children.map((c) => (c.clamped ?? []).flatMap((x, g) => (x ? [g + 1] : []))));
      expect(pair.children.map((c) => c.bits)).toEqual(event.children.map((c) => formatReal(c.chromosome, 3)));
    }
  });

  test('some child in a run with a wide α is clamped, so the clamping the view marks is real', () => {
    const { run } = make(baseParams({ crossover: { enabled: true, operator: 'blx-alpha', probability: 1, alpha: 4 } }), optionsOf(), 20, 3);
    expect(crossoverEvents(run).some((e) => e.children.some((c) => c.clamped?.some(Boolean)))).toBe(true);
  });

  test('the explanation says what α is and that values beyond the bounds are clamped', () => {
    const { run, params, display } = make(baseParams());
    const model = crossoverModel(at(run, 'crossover', 0), params.crossover, display);
    expect(model.explanation).toContain('BLX-α');
    expect(model.explanation).toContain('α = 0.5');
    expect(model.explanation).toContain('clamped');
    expect(model.pairs.every((p) => !p.revealed && p.blend === undefined)).toBe(true);
  });

  test('a bypassed pair has no blend: its children are copies', () => {
    const { run, params, display } = make(baseParams({ crossover: { enabled: true, operator: 'blx-alpha', probability: 0, alpha: 0.5 } }));
    const model = crossoverModel(at(run, 'crossover', 1), params.crossover, display);
    expect(model.pairs[0]).toMatchObject({ decision: 'bypassed', reason: 'draw-failed' });
    expect(model.pairs[0]!.blend).toBeUndefined();
    expect(model.pairs[0]!.lambda).toBeUndefined();
  });
});

describe('arithmetic pairs', () => {
  test('λ and both children are the event’s; the children are the weighted averages of the parents shown in the card', () => {
    const { run, params, display } = make(baseParams({ crossover: { enabled: true, operator: 'arithmetic', probability: 1 } }), optionsOf({ function: 'himmelblau' }), 8);
    const engine = crossoverEvents(run);
    for (let k = 1; k <= engine.length; k++) {
      const model = crossoverModel(at(run, 'crossover', k), params.crossover, display);
      const pair = model.pairs[k - 1]!;
      const event = engine[k - 1]!;
      expect(pair.lambda).toBe(event.lambda);
      expect(pair.blend).toBeUndefined();
      expect(pair.children.map((c) => c.bits)).toEqual(event.children.map((c) => formatReal(c.chromosome, 3)));
      const parent = run.snapshot(0).state.population.find((i) => i.id === pair.parentA.id)!.chromosome;
      expect(pair.parentA.bits).toBe(formatReal(parent, 3));
      expect(pair.parentA.values).toEqual(parent); // the exact numbers, for drawing
      expect(pair.children.map((c) => c.values)).toEqual(event.children.map((c) => c.chromosome));
    }
    expect(crossoverModel(at(run, 'crossover', 0), params.crossover, display).explanation).toContain('λ');
  });
});

describe('discrete operators on real pairs', () => {
  test('cuts and swapped genes are read as for symbols, and the children are pairs', () => {
    const { run, params, display } = make(baseParams({ crossover: { enabled: true, operator: 'one-point', probability: 1 } }), optionsOf(), 6);
    const engine = crossoverEvents(run);
    const model = crossoverModel(at(run, 'crossover', engine.length), params.crossover, display);
    model.pairs.forEach((pair, k) => {
      expect(pair.cuts).toEqual(engine[k]!.cuts);
      expect(pair.blend).toBeUndefined();
      expect(pair.lambda).toBeUndefined();
      expect(pair.children[0]!.bits).toMatch(/^[−\d.]+ [−\d.]+$/);
    });
  });
});

describe('Gaussian mutation rows, read from the events', () => {
  test('per gene: every gene’s draw, and for a mutating gene the two uniforms, z, the step, before, raw, after and clamping', () => {
    const { run, params, display } = make(baseParams({ mutation: { enabled: true, mode: 'per-gene', probability: 0.6, sigma: 0.2 } }), optionsOf(), 8);
    const engine = mutationEvents(run);
    let steps = 0;
    for (let k = 1; k <= engine.length; k++) {
      const model = mutationModel(at(run, 'mutation', k), params.mutation, display);
      const row = model.rows[k - 1]!;
      const event = engine[k - 1]!;
      expect(model.real).toBe(true);
      expect(row.gaussian!.sigma).toBe(0.2);
      expect(row.gaussian!.genes).toHaveLength(2);
      row.gaussian!.genes.forEach((g, i) => {
        const draw = event.geneDraws![i]!;
        const step = event.gaussian?.find((s) => s.gene === g.gene);
        expect(g).toMatchObject({ gene: i + 1, name: i === 0 ? 'x' : 'y', u: draw.u, mutated: draw.flipped, before: event.before[i], after: event.after[i] });
        expect(g.range).toBe(10);
        if (step) {
          steps++;
          expect(g).toMatchObject({ u1: step.u1, u2: step.u2, z: step.z, step: step.step, raw: step.raw, clamped: step.clamped });
        } else {
          expect(g.step).toBeUndefined();
          expect(g.after).toBe(g.before);
        }
      });
    }
    expect(steps).toBeGreaterThan(0);
  });

  test('per individual: one draw decides, one picks the gene, and only that gene has a step', () => {
    const { run, params, display } = make(baseParams({ mutation: { enabled: true, mode: 'per-individual', probability: 1, sigma: 0.2 } }), optionsOf(), 6);
    const engine = mutationEvents(run);
    const model = mutationModel(at(run, 'mutation', engine.length), params.mutation, display);
    model.rows.forEach((row, k) => {
      const event = engine[k]!;
      expect(row.individualDraw).toBe(event.individualDraw!.u);
      expect(row.chosenGene).toEqual(event.chosenGene);
      const mutated = row.gaussian!.genes.filter((g) => g.mutated);
      expect(mutated.map((g) => g.gene)).toEqual([event.chosenGene!.gene]);
      expect(mutated[0]!.step).toBe(event.gaussian![0]!.step);
      expect(row.gaussian!.genes.every((g) => g.u === undefined)).toBe(true);
    });
  });

  test('switched off: a bypass with no steps; the explanation says so', () => {
    const { run, params, display } = make(baseParams({ mutation: { enabled: false, mode: 'per-gene', probability: 0.6, sigma: 0.2 } }));
    const model = mutationModel(at(run, 'mutation', 1), params.mutation, display);
    expect(model.rows[0]).toMatchObject({ decision: 'bypassed' });
    expect(model.rows[0]!.gaussian!.genes.every((g) => !g.mutated)).toBe(true);
    expect(model.explanation).toContain('switched off');
  });

  test('the explanation names σ, the range, z and the clamping', () => {
    const { run, params, display } = make(baseParams());
    const model = mutationModel(at(run, 'mutation', 0), params.mutation, display);
    expect(model.explanation).toContain('Gaussian');
    expect(model.explanation).toContain('σ');
    expect(model.explanation).toContain('range');
    expect(model.explanation).toContain('clamped');
    expect(model.rows.every((r) => !r.revealed)).toBe(true);
  });
});

describe('binary-coded landscapes: the decoded point and how far it moved', () => {
  const binary = (representation: 'plain' | 'gray') => optionsOf({ representation, bitsPerVariable: 6 });
  const params = baseParams({ crossover: { enabled: true, operator: 'one-point', probability: 1 }, mutation: { enabled: true, mode: 'per-gene', probability: 0.3 } });
  const decode = (problem: ReturnType<typeof landscapeProblem>, bits: string) => problem.pointOf([...bits].map(Number));

  test.each(['plain', 'gray'] as const)('%s: parents and children carry the point they decode to, and a child says how far it is from each parent', (representation) => {
    const { run, display, problem } = make(params, binary(representation), 8);
    const engine = crossoverEvents(run);
    const model = crossoverModel(at(run, 'crossover', engine.length), params.crossover, display);
    expect(model.real).toBe(false);
    for (const pair of model.pairs) {
      const a = decode(problem, pair.parentA.bits);
      const b = decode(problem, pair.parentB.bits);
      expect(pair.parentA.point).toEqual(a);
      expect(pair.parentB.point).toEqual(b);
      for (const child of pair.children) {
        const p = decode(problem, child.bits);
        expect(child.point).toEqual(p);
        expect(child.moved!.fromA).toBeCloseTo(Math.hypot(p.x - a.x, p.y - a.y), 12);
        expect(child.moved!.fromB).toBeCloseTo(Math.hypot(p.x - b.x, p.y - b.y), 12);
      }
    }
  });

  test.each(['plain', 'gray'] as const)('%s: a mutated offspring says where it was and where it is, per variable and in all', (representation) => {
    const { run, display, problem } = make(params, binary(representation), 10);
    const engine = mutationEvents(run);
    const model = mutationModel(at(run, 'mutation', engine.length), params.mutation, display);
    let mutated = 0;
    model.rows.forEach((row) => {
      const before = decode(problem, row.before);
      const after = decode(problem, row.after!);
      expect(row.points).toBeDefined();
      expect(row.points!.before).toEqual(before);
      expect(row.points!.after).toEqual(after);
      expect(row.points!.dx).toBeCloseTo(after.x - before.x, 12);
      expect(row.points!.dy).toBeCloseTo(after.y - before.y, 12);
      expect(row.points!.moved).toBeCloseTo(Math.hypot(after.x - before.x, after.y - before.y), 12);
      if (row.decision === 'mutated') mutated++;
      else expect(row.points!.moved).toBe(0);
    });
    expect(mutated).toBeGreaterThan(0);
  });

  test('the same flip of the top bit of x is a jump of half the range in plain binary and of the whole range in Gray code, so the numbers show the two codings differ', () => {
    const problem = (rep: 'plain' | 'gray') => landscapeProblem(binary(rep));
    const plainMove = Math.abs(problem('plain').pointOf([1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0]).x - problem('plain').pointOf([0, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0]).x);
    const grayMove = Math.abs(problem('gray').pointOf([1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]).x - problem('gray').pointOf([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]).x);
    expect(plainMove).toBeCloseTo((10 * 32) / 63, 10); // 011111 → 111111: 31 → 63 is 32 steps, a bit more than half the range
    expect(grayMove).toBeCloseTo(10, 10); // Gray 000000 → 100000 is 0 → 63: the whole range
    expect(grayMove).not.toBeCloseTo(plainMove, 3);
  });

  test('the other problems’ models have no real data, no points and no clamping', () => {
    const run: GaRun = createRun(gaAlgorithm, { setup: { problem: goldberg, init: { kind: 'random', size: 4 } }, params: { selection: { method: 'roulette', chain: [{ step: 'identity' }] }, crossover: { enabled: true, operator: 'one-point', probability: 1 }, mutation: { enabled: true, mode: 'per-gene', probability: 0.5 }, elites: 0, stop: { generationLimit: 5 } }, seed: 3 });
    run.forwardCycle();
    const display = displayOf(goldberg);
    const c = crossoverModel(at(run, 'crossover', 2), { enabled: true, operator: 'one-point', probability: 1 }, display);
    expect(c.real).toBe(false);
    for (const pair of c.pairs) {
      expect(pair.blend).toBeUndefined();
      expect(pair.lambda).toBeUndefined();
      expect(pair.parentA.point).toBeUndefined();
      for (const child of pair.children) expect([child.clamped, child.point, child.moved]).toEqual([[], undefined, undefined]);
    }
    const m = mutationModel(at(run, 'mutation', 2), { enabled: true, mode: 'per-gene', probability: 0.5 }, display);
    expect(m.real).toBe(false);
    for (const row of m.rows) expect([row.gaussian, row.points]).toEqual([undefined, undefined]);
  });
});

describe('property: over generated runs the models equal the events for every operator and representation', () => {
  const realOps = ['one-point', 'uniform', 'blx-alpha', 'arithmetic'] as const;
  const bitOps = ['one-point', 'two-point', 'uniform'] as const;
  const cases: [LandscapeOptions, readonly GaParams['crossover']['operator'][]][] = [
    [optionsOf({ representation: 'real' }), realOps],
    [optionsOf({ representation: 'plain', bitsPerVariable: 5 }), bitOps],
    [optionsOf({ representation: 'gray', bitsPerVariable: 5 }), bitOps],
  ];

  test('every pair and every offspring of 12 seeds, both mutation modes, with and without the operators switched off', () => {
    let pairs = 0;
    let rows = 0;
    for (const [options, operators] of cases) {
      for (const operator of operators) {
        for (const mode of ['per-gene', 'per-individual'] as const) {
          for (let seed = 1; seed <= 12; seed++) {
            const enabled = seed % 5 !== 0;
            const p = baseParams({ crossover: { enabled, operator, probability: 0.8, ...(operator === 'blx-alpha' ? { alpha: 1 } : {}) }, mutation: { enabled, mode, probability: 0.4, ...(options.representation === 'real' ? { sigma: 0.2 } : {}) } });
            const { run, display, problem } = make(p, options, 6 + (seed % 3), seed);
            const cEvents = crossoverEvents(run);
            const cm = crossoverModel(at(run, 'crossover', cEvents.length), p.crossover, display);
            expect(cm.pairs).toHaveLength(cEvents.length);
            cm.pairs.forEach((pair, k) => {
              const e = cEvents[k]!;
              pairs++;
              expect(pair.decision).toBe(e.decision);
              expect(pair.children.map((c) => c.bits)).toEqual(e.children.map((c) => display.show(c.chromosome)));
              expect(pair.blend !== undefined).toBe(e.blend !== undefined);
              expect(pair.lambda).toBe(e.lambda);
              if (e.blend) expect(pair.blend!.map((g) => [g.a, g.b, g.from, g.to, ...g.draws, ...g.raw, ...g.values])).toEqual(e.blend.map((g, i) => [g.a, g.b, g.from, g.to, ...g.draws, ...g.raw, e.children[0]!.chromosome[i], e.children[1]!.chromosome[i]]));
              if (options.representation !== 'real') pair.children.forEach((c) => expect(c.point).toEqual(problem.pointOf([...c.bits].map(Number))));
            });
            const mEvents = mutationEvents(run);
            const mm = mutationModel(at(run, 'mutation', mEvents.length), p.mutation, display);
            expect(mm.rows).toHaveLength(mEvents.length);
            mm.rows.forEach((row, k) => {
              const e = mEvents[k]!;
              rows++;
              expect(row.after).toBe(display.show(e.after));
              expect(row.decision).toBe(e.decision);
              if (options.representation === 'real') {
                expect(row.gaussian!.genes.filter((g) => g.mutated).map((g) => g.step)).toEqual((e.gaussian ?? []).map((s) => s.step));
                expect(row.gaussian!.genes.map((g) => g.after)).toEqual([...e.after]);
              } else {
                expect(row.points!.moved).toBeCloseTo(Math.hypot(problem.pointOf(e.after).x - problem.pointOf(e.before).x, problem.pointOf(e.after).y - problem.pointOf(e.before).y), 12);
              }
            });
          }
        }
      }
    }
    expect(pairs).toBeGreaterThan(500);
    expect(rows).toBeGreaterThan(500);
  });
});
