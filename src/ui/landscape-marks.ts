import { formatReal, type GaEvent, type Individual, type Point, type RunState } from '../engine';
import type { View } from '../run';
import { num } from './format';
import type { LandscapeInfo } from './landscape-context';
import type { PopulationRow } from './population';

/**
 * What the landscape views draw of the population, worked out from the run at the cursor: a mark per individual of the
 * population the table shows (an elite, the best, a parent of the pair being made, the selected one), the offspring made so
 * far in the stage under way (with an arrow for a mutated one), the trails of earlier generations, and the sentence and the
 * table of positions that stand for the picture. Everything is read from the recorded events and populations.
 */
type GaView = View<RunState, GaEvent>;

export interface IndividualMark {
  readonly id: number;
  readonly point: Point;
  readonly fitness: number;
  /** An elite (carried over unchanged) is a diamond, the best of the generation a star, the others a circle. */
  readonly kind: 'individual' | 'elite' | 'best';
  /** A parent of the pair (or of the picks) the stage under way is dealing with; `letter` says which of the pair. */
  readonly parent: boolean;
  /** 'AB' when the same individual was picked as both parents of the pair. */
  readonly letter?: 'A' | 'B' | 'AB';
  readonly selected: boolean;
}

export interface ChildMark {
  readonly offspring: number;
  readonly label: string;
  readonly point: Point;
  /** Mutation: where the offspring was before the step, for the arrow. */
  readonly from?: Point;
  /** The 1-based genes cut to a bound. */
  readonly clamped: readonly number[];
  /** Made, mutated or scored by the micro-step the cursor is on. */
  readonly current: boolean;
}

export interface TrailMark {
  readonly generation: number;
  readonly points: readonly Point[];
}

export interface PositionRow {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly fitness: number;
  readonly role: 'elite' | 'best' | 'parent' | '';
}

export interface MarksModel {
  /** The generation whose population is shown. */
  readonly generation: number;
  readonly individuals: readonly IndividualMark[];
  readonly children: readonly ChildMark[];
  readonly trails: readonly TrailMark[];
  readonly bestId: number;
  readonly selectedId?: number;
  /** Whether every individual gets its id printed (up to 16; beyond that only the ones that matter). */
  readonly labelAll: boolean;
  readonly sentence: string;
  readonly table: readonly PositionRow[];
}

export interface MarksInput {
  readonly view: GaView;
  readonly info: Pick<LandscapeInfo, 'pointOf'>;
  /** The rows of the population table: the population shown and which are elites. */
  readonly rows: readonly PopulationRow[];
  /** The generation of that population. */
  readonly generation: number;
  /** The population of any recorded generation, for the trails. */
  readonly populationAt: (generation: number) => readonly Individual[];
  readonly selectedId?: number | undefined;
  /** How many earlier generations to show as trails (0 for none). */
  readonly trail: 0 | 1 | 3 | 5;
}

const f3 = (v: number) => formatReal([v], 3);
const pointOfIndividual = (i: { readonly values?: readonly number[] }): Point => ({ x: i.values![0]!, y: i.values![1]! });

export function marksModel(input: MarksInput): MarksModel {
  const { view, info, rows, generation, selectedId } = input;
  const stage = view.stage;
  const events = view.events;
  const pairing = events.flatMap((e) => (e.stage === 'pairing' ? [e] : []));
  const crossover = events.flatMap((e) => (e.stage === 'crossover' ? [e] : []));
  const mutation = events.flatMap((e) => (e.stage === 'mutation' ? [e] : []));
  const evaluation = events.flatMap((e) => (e.stage === 'evaluation' ? [e] : []));

  // who is a parent, and A or B, at this micro-step
  const parents = new Set<number>();
  const letters = new Map<number, 'A' | 'B' | 'AB'>();
  const setLetters = (a: number, b: number) => {
    if (a === b) letters.set(a, 'AB');
    else {
      letters.set(a, 'A');
      letters.set(b, 'B');
    }
  };
  if (stage === 'selection') {
    for (const e of events) {
      if (e.stage !== 'selection') continue;
      if (e.kind === 'spin') parents.add(e.individualId);
      if (e.kind === 'tournament') parents.add(e.winnerId);
    }
  } else if (stage === 'pairing') {
    pairing.forEach((e, k) => {
      parents.add(e.parentAId);
      parents.add(e.parentBId);
      if (k === pairing.length - 1) setLetters(e.parentAId, e.parentBId);
    });
  } else if (stage === 'crossover' && crossover.length > 0) {
    const current = pairing[crossover.length - 1];
    if (current) {
      parents.add(current.parentAId);
      parents.add(current.parentBId);
      setLetters(current.parentAId, current.parentBId);
    }
  }

  let bestId = rows[0]?.id ?? 0;
  let bestFitness = -Infinity;
  for (const r of rows) {
    if (r.fitness > bestFitness) {
      bestFitness = r.fitness;
      bestId = r.id;
    }
  }
  const individuals = rows.map((r): IndividualMark => ({
    id: r.id,
    point: pointOfIndividual(r),
    fitness: r.fitness,
    kind: r.elite ? 'elite' : r.id === bestId ? 'best' : 'individual',
    parent: parents.has(r.id),
    ...(letters.has(r.id) ? { letter: letters.get(r.id)! } : {}),
    selected: r.id === selectedId,
  }));

  // the offspring of the stage under way
  const children: ChildMark[] = [];
  const clampedOf = (flags: readonly boolean[] | undefined) => (flags ?? []).flatMap((x, g) => (x ? [g + 1] : []));
  if (stage === 'crossover') {
    crossover.forEach((e, k) => {
      for (const c of e.children) {
        if (c.discarded) continue;
        children.push({ offspring: c.offspring, label: `O${c.offspring}`, point: info.pointOf(c.chromosome), clamped: clampedOf(c.clamped), current: k === crossover.length - 1 });
      }
    });
  } else if (stage === 'mutation') {
    const made = events.flatMap((e) => (e.stage === 'crossover' ? e.children.filter((c) => !c.discarded) : []));
    for (const c of made) {
      const m = mutation.find((x) => x.offspring === c.offspring);
      const current = m !== undefined && m === mutation[mutation.length - 1];
      children.push({
        offspring: c.offspring,
        label: `O${c.offspring}`,
        point: info.pointOf(m ? m.after : c.chromosome),
        ...(m && current && m.decision === 'mutated' ? { from: info.pointOf(m.before) } : {}),
        clamped: m ? (m.gaussian ?? []).filter((s) => s.clamped).map((s) => s.gene) : clampedOf(c.clamped),
        current,
      });
    }
  } else if (stage === 'evaluation') {
    evaluation.forEach((e, k) => {
      children.push({ offspring: e.offspring, label: `O${e.offspring}`, point: pointOfIndividual(e.individual), clamped: [], current: k === evaluation.length - 1 });
    });
  }

  // the trails: earlier generations' positions, oldest first
  const trails: TrailMark[] = [];
  for (let g = Math.max(0, generation - input.trail); g < generation; g++) {
    trails.push({ generation: g, points: input.populationAt(g).map(pointOfIndividual) });
  }

  const table = individuals.map((i): PositionRow => ({
    id: i.id,
    x: i.point.x,
    y: i.point.y,
    fitness: i.fitness,
    role: i.kind === 'elite' ? 'elite' : i.kind === 'best' ? 'best' : i.parent ? 'parent' : '',
  }));

  return {
    generation,
    individuals,
    children,
    trails,
    bestId,
    ...(selectedId !== undefined ? { selectedId } : {}),
    labelAll: individuals.length <= 16,
    sentence: sentenceOf(individuals, bestId, selectedId, generation),
    table,
  };
}

function sentenceOf(individuals: readonly IndividualMark[], bestId: number, selectedId: number | undefined, generation: number): string {
  if (individuals.length === 0) return `Generation ${generation}: no individuals.`;
  const best = individuals.find((i) => i.id === bestId)!;
  const xs = individuals.map((i) => i.point.x);
  const ys = individuals.map((i) => i.point.y);
  const base = `Generation ${generation}: ${individuals.length} ${individuals.length === 1 ? 'individual' : 'individuals'}; the best is individual ${best.id} at (${f3(best.point.x)}, ${f3(best.point.y)}) with fitness ${num(best.fitness)}; the population spans x from ${f3(Math.min(...xs))} to ${f3(Math.max(...xs))} and y from ${f3(Math.min(...ys))} to ${f3(Math.max(...ys))}.`;
  const selected = selectedId !== undefined ? individuals.find((i) => i.id === selectedId) : undefined;
  return selected ? `${base} Individual ${selected.id} is selected: (${f3(selected.point.x)}, ${f3(selected.point.y)}), fitness ${num(selected.fitness)}.` : base;
}

/* --------------------------------------------------------------- layout */

export type Shape = 'circle' | 'diamond' | 'star' | 'square' | 'triangle';

export interface DrawnMark {
  readonly key: string;
  readonly id?: number;
  readonly offspring?: number;
  readonly shape: Shape;
  /** The point of the plane it stands at (the pixel is where the picture puts it). */
  readonly point: Point;
  readonly px: number;
  readonly py: number;
  /** What is printed beside it ('' for none). */
  readonly label: string;
  readonly letter?: 'A' | 'B' | 'AB';
  readonly selected: boolean;
  /** Behind a ridge of the surface: drawn as a dashed ring with no label. */
  readonly hidden: boolean;
  /** A mutated offspring: where it was, for the arrow. */
  readonly arrow?: { readonly px: number; readonly py: number };
  readonly clamped: readonly number[];
  readonly current: boolean;
}

export interface DrawnTrail {
  readonly generation: number;
  /** 0 to 1: the newest generation is the most visible. */
  readonly opacity: number;
  readonly dots: readonly { readonly px: number; readonly py: number }[];
}

export interface DrawnMarks {
  readonly individuals: readonly DrawnMark[];
  readonly children: readonly DrawnMark[];
  readonly trails: readonly DrawnTrail[];
}

export interface MarkProjection {
  /** Where a point of the plane lands in the picture. */
  readonly project: (p: Point) => { px: number; py: number };
  /** Whether a pixel is inside the picture's plot: marks outside it are not drawn. */
  readonly inside: (px: number, py: number) => boolean;
  /** Surface only: whether a point is behind a ridge. */
  readonly hidden?: (p: Point) => boolean;
}

/**
 * The marks as shapes at pixels for one picture: shape by kind (an elite is a diamond, the best a star, a parent a square with
 * its letter, the others circles, offspring triangles), labels (every individual up to 16, beyond that only those that matter),
 * the arrow of a mutated offspring, the trails faded by age. A mark that falls outside the picture is left out, and one behind a
 * ridge is flagged so it can be drawn dashed.
 */
export function layoutMarks(model: MarksModel, p: MarkProjection): DrawnMarks {
  const individuals: DrawnMark[] = [];
  for (const i of model.individuals) {
    const at = p.project(i.point);
    if (!p.inside(at.px, at.py)) continue;
    const shape: Shape = i.letter || i.parent ? 'square' : i.kind === 'elite' ? 'diamond' : i.kind === 'best' ? 'star' : 'circle';
    const hidden = p.hidden?.(i.point) ?? false;
    const matters = shape !== 'circle' || i.selected;
    const label = hidden ? '' : model.labelAll || matters ? (i.letter ? `${i.id} ${i.letter}` : String(i.id)) : '';
    individuals.push({ key: `i${i.id}`, id: i.id, shape, point: i.point, ...at, label, ...(i.letter ? { letter: i.letter } : {}), selected: i.selected, hidden, clamped: [], current: false });
  }
  const children: DrawnMark[] = [];
  for (const c of model.children) {
    const at = p.project(c.point);
    if (!p.inside(at.px, at.py)) continue;
    const from = c.from ? p.project(c.from) : undefined;
    children.push({
      key: `o${c.offspring}`,
      offspring: c.offspring,
      shape: 'triangle',
      point: c.point,
      ...at,
      label: c.label,
      selected: false,
      hidden: false,
      ...(from && p.inside(from.px, from.py) ? { arrow: from } : {}),
      clamped: c.clamped,
      current: c.current,
    });
  }
  const trails = model.trails.map((t, k): DrawnTrail => ({
    generation: t.generation,
    opacity: (k + 1) / (model.trails.length + 1),
    dots: t.points.map((q) => p.project(q)).filter((d) => p.inside(d.px, d.py)),
  }));
  return { individuals, children, trails };
}
