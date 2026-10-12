import { describe, expect, test } from 'vitest';
import { formatReal, gaAlgorithm, landscapeProblem, type GaEvent, type GaParams, type GaSetup, type LandscapeOptions, type RunState } from '../engine';
import { createRun, type Run } from '../run';
import { displayOf } from './format';
import { landscapeInfoOf } from './landscape-context';
import { layoutMarks, marksModel, type MarksModel } from './landscape-marks';
import { atCycleEnd, populationTable } from './population';

type GaRun = Run<GaSetup, GaParams, RunState, GaEvent>;
const f3 = (v: number) => formatReal([v], 3);

const params = (o: Partial<GaParams> = {}): GaParams => ({
  selection: { method: 'tournament', size: 2 },
  crossover: { enabled: true, operator: 'blx-alpha', probability: 1, alpha: 2 },
  mutation: { enabled: true, mode: 'per-gene', probability: 0.5, sigma: 0.3 },
  elites: 2,
  stop: { generationLimit: 50 },
  ...o,
});
const make = (p: GaParams, options: Partial<LandscapeOptions> = {}, size = 10, seed = 5, generations = 3) => {
  const full: LandscapeOptions = { function: 'two-peaks', representation: 'real', bitsPerVariable: 6, ...options };
  const problem = landscapeProblem(full);
  const run: GaRun = createRun(gaAlgorithm, { setup: { problem, init: { kind: 'random', size } }, params: p, seed });
  for (let g = 0; g < generations; g++) run.forwardCycle();
  return { run, info: landscapeInfoOf(problem), display: displayOf(problem), problem };
};
const modelAt = (run: GaRun, info: ReturnType<typeof landscapeInfoOf>, display: ReturnType<typeof displayOf>, cycle: number, stage: string | 'end', micro: number, trail: 0 | 1 | 3 | 5 = 0, selectedId?: number): MarksModel => {
  const layout = run.layout(cycle);
  const index = stage === 'end' ? layout.length - 1 : layout.findIndex((s) => s.stage === stage);
  run.moveTo({ cycle, stage: index, micro: stage === 'end' ? layout[index]!.micros : micro });
  const view = run.view();
  const table = populationTable(view, atCycleEnd(layout, view.position), display);
  const generation = view.position.cycle === 0 || atCycleEnd(layout, view.position) ? view.position.cycle : view.position.cycle - 1;
  return marksModel({ view, info, rows: table.rows, generation, populationAt: (g) => run.snapshot(g).state.population, selectedId, trail });
};

describe('the individuals on the views', () => {
  test('there is one mark per individual of the population the table shows, at its decoded point, with its fitness and id', () => {
    const { run, info, display } = make(params());
    for (let cycle = 0; cycle <= 3; cycle++) {
      const m = modelAt(run, info, display, cycle, 'end', 0);
      const state = run.snapshot(cycle).state;
      expect(m.generation).toBe(cycle);
      expect(m.individuals.map((i) => i.id)).toEqual(state.population.map((i) => i.id));
      m.individuals.forEach((mark, k) => {
        const i = state.population[k]!;
        expect(mark.point).toEqual({ x: i.values![0], y: i.values![1] });
        expect(mark.fitness).toBe(i.fitness);
      });
    }
  });

  test('also for the binary-coded representations, where the point is what the bits decode to', () => {
    for (const representation of ['plain', 'gray'] as const) {
      const { run, info, display, problem } = make(params({ crossover: { enabled: true, operator: 'one-point', probability: 1 }, mutation: { enabled: true, mode: 'per-gene', probability: 0.1 } }), { representation });
      const m = modelAt(run, info, display, 2, 'end', 0);
      m.individuals.forEach((mark, k) => expect(mark.point).toEqual(problem.pointOf(run.snapshot(2).state.population[k]!.chromosome)));
    }
  });

  test('the elites are the ones the replacement carried over; the best is the fittest of the population shown, the first of equals', () => {
    const { run, info, display } = make(params({ elites: 2 }));
    const m = modelAt(run, info, display, 2, 'end', 0);
    const replacement = run.events(2).find((e) => e.stage === 'replacement');
    const elites = replacement && replacement.stage === 'replacement' ? replacement.elites : [];
    expect(elites).toHaveLength(2);
    expect(m.individuals.filter((i) => i.kind === 'elite').map((i) => i.id).sort()).toEqual([...elites].sort());
    const best = run.snapshot(2).state.population.reduce((b, i) => (i.fitness > b.fitness ? i : b));
    expect(m.bestId).toBe(best.id);
    const bestMark = m.individuals.find((i) => i.id === best.id)!;
    expect(['best', 'elite']).toContain(bestMark.kind); // an elite that is also the best keeps the diamond
    expect(m.individuals.filter((i) => i.kind === 'best')).toHaveLength(elites.includes(best.id) ? 0 : 1);
  });

  test('while a generation is being made the table shows the parents, and so do the marks', () => {
    const { run, info, display } = make(params());
    const m = modelAt(run, info, display, 2, 'crossover', 1);
    expect(m.generation).toBe(1);
    expect(m.individuals.map((i) => i.id)).toEqual(run.snapshot(1).state.population.map((i) => i.id));
  });

  test('the selected individual is flagged, and only that one', () => {
    const { run, info, display } = make(params());
    const id = run.snapshot(2).state.population[3]!.id;
    const m = modelAt(run, info, display, 2, 'end', 0, 0, id);
    expect(m.individuals.filter((i) => i.selected).map((i) => i.id)).toEqual([id]);
    expect(m.selectedId).toBe(id);
    expect(modelAt(run, info, display, 2, 'end', 0, 0, 99999).individuals.some((i) => i.selected)).toBe(false); // not in this population
  });
});

describe('the stage marks follow the events at the cursor', () => {
  test('selection: the individuals picked so far are parents', () => {
    const { run, info, display } = make(params());
    const picks = run.events(2).flatMap((e) => (e.stage === 'selection' && e.kind === 'tournament' ? [e.winnerId] : []));
    for (const micro of [0, 1, 3, picks.length]) {
      const m = modelAt(run, info, display, 2, 'selection', micro);
      expect(m.individuals.filter((i) => i.parent).map((i) => i.id).sort()).toEqual([...new Set(picks.slice(0, micro))].sort());
    }
  });

  test('pairing and crossover: the parents of the current pair are A and B, earlier pairs’ parents are parents without a letter, and children appear as their pairs are made', () => {
    const { run, info, display } = make(params({ crossover: { enabled: true, operator: 'arithmetic', probability: 1 } }));
    const pairing = run.events(2).flatMap((e) => (e.stage === 'pairing' ? [e] : []));
    const crossover = run.events(2).flatMap((e) => (e.stage === 'crossover' ? [e] : []));
    for (let k = 1; k <= crossover.length; k++) {
      const m = modelAt(run, info, display, 2, 'crossover', k);
      const a = m.individuals.find((i) => i.letter === 'A' || i.letter === 'AB');
      const b = m.individuals.find((i) => i.letter === 'B' || i.letter === 'AB');
      expect(a?.id).toBe(pairing[k - 1]!.parentAId);
      expect(b?.id).toBe(pairing[k - 1]!.parentBId);
      expect(m.children.map((c) => c.offspring)).toEqual(crossover.slice(0, k).flatMap((e) => e.children.filter((c) => !c.discarded).map((c) => c.offspring)));
      m.children.forEach((c) => {
        const event = crossover.find((e) => e.children.some((x) => x.offspring === c.offspring))!;
        const child = event.children.find((x) => x.offspring === c.offspring)!;
        expect(c.point).toEqual({ x: child.chromosome[0], y: child.chromosome[1] });
        expect(c.label).toBe(`O${c.offspring}`);
        expect(c.from).toBeUndefined();
      });
      expect(m.children.filter((c) => c.current).map((c) => c.offspring)).toEqual(crossover[k - 1]!.children.filter((c) => !c.discarded).map((c) => c.offspring));
    }
  });

  test('when the same individual is picked as both parents of a pair its mark says both letters', () => {
    const { run, info, display } = make(params(), {}, 4, 2, 3); // a small population, so a pair of the same individual turns up
    let seen = 0;
    for (let cycle = 1; cycle <= 3; cycle++) {
      const pairing = run.events(cycle).flatMap((e) => (e.stage === 'pairing' ? [e] : []));
      pairing.forEach((p, k) => {
        if (p.parentAId !== p.parentBId) return;
        seen++;
        const m = modelAt(run, info, display, cycle, 'crossover', k + 1);
        expect(m.individuals.find((i) => i.id === p.parentAId)!.letter).toBe('AB');
      });
    }
    expect(seen).toBeGreaterThan(0);
  });

  test('a child cut to a bound by crossover says which gene', () => {
    const { run, info, display } = make(params({ crossover: { enabled: true, operator: 'blx-alpha', probability: 1, alpha: 4 } }), {}, 20, 3, 2);
    const crossover = run.events(2).flatMap((e) => (e.stage === 'crossover' ? [e] : []));
    const m = modelAt(run, info, display, 2, 'crossover', crossover.length);
    const clamped = m.children.filter((c) => c.clamped.length > 0);
    expect(clamped.length).toBeGreaterThan(0);
    for (const c of clamped) {
      const child = crossover.flatMap((e) => e.children).find((x) => x.offspring === c.offspring)!;
      expect(c.clamped).toEqual((child.clamped ?? []).flatMap((x, g) => (x ? [g + 1] : [])));
    }
  });

  test('mutation: the offspring show where mutation left them; the current mutated one has an arrow from where it was, and a clamped step is noted', () => {
    const { run, info, display } = make(params({ mutation: { enabled: true, mode: 'per-gene', probability: 0.7, sigma: 0.8 } }), {}, 12, 4, 2);
    const mutation = run.events(2).flatMap((e) => (e.stage === 'mutation' ? [e] : []));
    for (let k = 1; k <= mutation.length; k++) {
      const m = modelAt(run, info, display, 2, 'mutation', k);
      const e = mutation[k - 1]!;
      const mark = m.children.find((c) => c.offspring === e.offspring)!;
      expect(mark.point).toEqual({ x: e.after[0], y: e.after[1] });
      expect(mark.current).toBe(true);
      if (e.decision === 'mutated') {
        expect(mark.from).toEqual({ x: e.before[0], y: e.before[1] });
        expect(mark.clamped).toEqual((e.gaussian ?? []).filter((s) => s.clamped).map((s) => s.gene));
      } else expect(mark.from).toBeUndefined();
      // earlier offspring are where they ended, without an arrow
      for (const earlier of mutation.slice(0, k - 1)) {
        const c = m.children.find((x) => x.offspring === earlier.offspring)!;
        expect(c.point).toEqual({ x: earlier.after[0], y: earlier.after[1] });
        expect(c.from).toBeUndefined();
        expect(c.current).toBe(false);
      }
      expect(m.children).toHaveLength(mutation.length); // every offspring is shown, waiting ones where crossover left them
    }
  });

  test('evaluation: the offspring scored so far are shown at their final points', () => {
    const { run, info, display } = make(params());
    const evaluated = run.events(2).flatMap((e) => (e.stage === 'evaluation' ? [e] : []));
    const m = modelAt(run, info, display, 2, 'evaluation', 3);
    expect(m.children.map((c) => c.offspring)).toEqual(evaluated.slice(0, 3).map((e) => e.offspring));
    m.children.forEach((c, k) => expect(c.point).toEqual({ x: evaluated[k]!.individual.values![0], y: evaluated[k]!.individual.values![1] }));
  });

  test('outside the stages that make offspring there are no children, and a bypassed pair’s children are copies at their parents’ points', () => {
    const { run, info, display } = make(params({ crossover: { enabled: false, operator: 'blx-alpha', probability: 1 } }));
    expect(modelAt(run, info, display, 2, 'selection', 2).children).toEqual([]);
    expect(modelAt(run, info, display, 2, 'end', 0).children).toEqual([]);
    const m = modelAt(run, info, display, 2, 'crossover', 1);
    const pairing = run.events(2).flatMap((e) => (e.stage === 'pairing' ? [e] : []))[0]!;
    const a = run.snapshot(1).state.population.find((i) => i.id === pairing.parentAId)!;
    expect(m.children[0]!.point).toEqual({ x: a.values![0], y: a.values![1] });
  });
});

describe('trails', () => {
  test('are the positions of the previous generations, as many as asked, oldest first, and none at the start or when off', () => {
    const { run, info, display } = make(params(), {}, 8, 5, 5);
    const m3 = modelAt(run, info, display, 5, 'end', 0, 3);
    expect(m3.trails.map((t) => t.generation)).toEqual([2, 3, 4]);
    m3.trails.forEach((t) => expect(t.points).toEqual(run.snapshot(t.generation).state.population.map((i) => ({ x: i.values![0], y: i.values![1] }))));
    expect(modelAt(run, info, display, 5, 'end', 0, 1).trails.map((t) => t.generation)).toEqual([4]);
    expect(modelAt(run, info, display, 5, 'end', 0, 5).trails.map((t) => t.generation)).toEqual([0, 1, 2, 3, 4]);
    expect(modelAt(run, info, display, 5, 'end', 0, 0).trails).toEqual([]);
    expect(modelAt(run, info, display, 0, 'end', 0, 3).trails).toEqual([]);
    expect(modelAt(run, info, display, 2, 'end', 0, 5).trails.map((t) => t.generation)).toEqual([0, 1]);
  });

  test('follow the cursor: scrubbing back shows the trails of that generation', () => {
    const { run, info, display } = make(params(), {}, 8, 5, 5);
    expect(modelAt(run, info, display, 3, 'end', 0, 3).trails.map((t) => t.generation)).toEqual([0, 1, 2]);
    // while generation 4 is being made the table shows generation 3, so its trail is generations 0 to 2
    expect(modelAt(run, info, display, 4, 'crossover', 1, 3).trails.map((t) => t.generation)).toEqual([0, 1, 2]);
  });
});

describe('the text alternative', () => {
  test('says how many individuals, where the best is and its fitness, and where the population lies; and who is selected', () => {
    const { run, info, display } = make(params());
    const m = modelAt(run, info, display, 2, 'end', 0);
    const best = run.snapshot(2).state.population.find((i) => i.id === m.bestId)!;
    const xs = run.snapshot(2).state.population.map((i) => i.values![0]!);
    const ys = run.snapshot(2).state.population.map((i) => i.values![1]!);
    expect(m.sentence).toContain('Generation 2: 10 individuals');
    expect(m.sentence).toContain(`the best is individual ${best.id} at (${f3(best.values![0]!)}, ${f3(best.values![1]!)}) with fitness ${Math.round(best.fitness * 1000) / 1000}`);
    expect(m.sentence).toContain(`x from ${f3(Math.min(...xs))} to ${f3(Math.max(...xs))} and y from ${f3(Math.min(...ys))} to ${f3(Math.max(...ys))}`);
    const id = run.snapshot(2).state.population[3]!.id;
    const sel = modelAt(run, info, display, 2, 'end', 0, 0, id);
    expect(sel.sentence).toContain(`Individual ${id} is selected`);
  });

  test('a table of positions: one row per individual with its point and fitness, and what it is (elite, best, parent)', () => {
    const { run, info, display } = make(params());
    const m = modelAt(run, info, display, 2, 'end', 0);
    expect(m.table).toHaveLength(10);
    m.table.forEach((row, k) => {
      const i = run.snapshot(2).state.population[k]!;
      expect(row).toMatchObject({ id: i.id, x: i.values![0], y: i.values![1], fitness: i.fitness });
    });
    expect(m.table.filter((r) => r.role === 'elite')).toHaveLength(2);
  });
});

describe('labels', () => {
  test('every individual is labelled up to 16; above that only the elites, the best, the selected and the stage marks', () => {
    const small = make(params(), {}, 12);
    expect(modelAt(small.run, small.info, small.display, 2, 'end', 0).labelAll).toBe(true);
    const big = make(params(), {}, 40);
    expect(modelAt(big.run, big.info, big.display, 2, 'end', 0).labelAll).toBe(false);
  });
});

describe('laying the marks out on a picture', () => {
  const plot = { L: 40, T: 10, R: 440, B: 260 };
  // a picture where x and y map straight to pixels, over the whole −5..5
  const project = (p: { x: number; y: number }) => ({ px: 240 + p.x * 40, py: 135 - p.y * 12.5 });
  const inside = (px: number, py: number) => px >= plot.L && px <= plot.R && py >= plot.T && py <= plot.B;
  const run = () => {
    const { run, info, display } = make(params({ elites: 2 }), {}, 12, 5, 3);
    return { m: modelAt(run, info, display, 3, 'end', 0, 3, run.snapshot(3).state.population[4]!.id), run, info, display };
  };

  test('a shape for each kind: circle, diamond for an elite, star for the best, and the selected one flagged', () => {
    const { m } = run();
    const drawn = layoutMarks(m, { project, inside });
    const byId = new Map(drawn.individuals.map((d) => [d.id, d]));
    for (const i of m.individuals) {
      const d = byId.get(i.id)!;
      expect(d.shape).toBe(i.kind === 'elite' ? 'diamond' : i.kind === 'best' ? 'star' : 'circle');
      expect(d.selected).toBe(i.selected);
      expect({ px: d.px, py: d.py }).toEqual(project(i.point));
    }
    expect(drawn.individuals.filter((d) => d.selected)).toHaveLength(1);
  });

  test('a parent of the current pair is a square carrying its letter; a parent without a letter is a plain square', () => {
    const { run: r, info, display } = make(params({ crossover: { enabled: true, operator: 'arithmetic', probability: 1 } }), {}, 10, 5, 3);
    const m = modelAt(r, info, display, 3, 'crossover', 2);
    const drawn = layoutMarks(m, { project, inside });
    const a = drawn.individuals.find((d) => d.letter === 'A' || d.letter === 'AB')!;
    expect(a.shape).toBe('square');
    expect(a.label).toBe(`${a.id} ${a.letter}`);
    const sel = modelAt(r, info, display, 3, 'selection', 3);
    const picked = layoutMarks(sel, { project, inside }).individuals.filter((d) => d.shape === 'square');
    expect(picked.length).toBeGreaterThan(0);
    expect(picked.every((d) => d.letter === undefined)).toBe(true);
  });

  test('offspring are triangles labelled On; a mutated one has an arrow from where it was', () => {
    const { run: r, info, display } = make(params({ mutation: { enabled: true, mode: 'per-gene', probability: 1, sigma: 0.2 } }), {}, 10, 5, 3);
    const mutation = r.events(3).flatMap((e) => (e.stage === 'mutation' ? [e] : []));
    const m = modelAt(r, info, display, 3, 'mutation', 2);
    const drawn = layoutMarks(m, { project, inside });
    const current = drawn.children.find((c) => c.current)!;
    expect(current.shape).toBe('triangle');
    expect(current.label).toBe(`O${mutation[1]!.offspring}`);
    expect(current.arrow).toEqual(project({ x: mutation[1]!.before[0]!, y: mutation[1]!.before[1]! }));
    expect(drawn.children.filter((c) => c.arrow).length).toBe(1);
  });

  test('labels: all of them up to 16 individuals; beyond that the elites, the best, the selected, parents and offspring', () => {
    const { run: r, info, display } = make(params({ elites: 2 }), {}, 40, 5, 2);
    const m = modelAt(r, info, display, 2, 'end', 0, 0, r.snapshot(2).state.population[7]!.id);
    const drawn = layoutMarks(m, { project, inside });
    for (const d of drawn.individuals) {
      const should = d.shape !== 'circle' || d.selected;
      expect(d.label !== '').toBe(should);
    }
    const small = run();
    expect(layoutMarks(small.m, { project, inside }).individuals.every((d) => d.label !== '')).toBe(true);
  });

  test('a mark outside the picture is not drawn, and one hidden behind a ridge is flagged so it can be drawn dashed and unlabelled', () => {
    const { m } = run();
    const narrow = (p: { x: number; y: number }) => ({ px: 240 + p.x * 400, py: 135 }); // most points fall outside the plot
    const drawn = layoutMarks(m, { project: narrow, inside });
    expect(drawn.individuals.length).toBeLessThan(m.individuals.length);
    for (const d of drawn.individuals) expect(inside(d.px, d.py)).toBe(true);
    const first = m.individuals[0]!;
    const hidden = layoutMarks(m, { project, inside, hidden: (p) => p.x === first.point.x && p.y === first.point.y });
    const h = hidden.individuals.find((d) => d.id === first.id)!;
    expect(h.hidden).toBe(true);
    expect(h.label).toBe('');
    expect(hidden.individuals.filter((d) => d.hidden).length).toBeGreaterThan(0);
  });

  test('trails fade with age: the oldest are the faintest, and each dot is inside the picture', () => {
    const { run: r, info, display } = make(params(), {}, 8, 5, 5);
    const m = modelAt(r, info, display, 5, 'end', 0, 3);
    const drawn = layoutMarks(m, { project, inside });
    expect(drawn.trails.map((t) => t.generation)).toEqual([2, 3, 4]);
    const o = drawn.trails.map((t) => t.opacity);
    expect(o[0]!).toBeLessThan(o[1]!);
    expect(o[1]!).toBeLessThan(o[2]!);
    drawn.trails.forEach((t, k) => {
      expect(t.dots.length).toBeLessThanOrEqual(m.trails[k]!.points.length);
      for (const d of t.dots) expect(inside(d.px, d.py)).toBe(true);
    });
  });
});
