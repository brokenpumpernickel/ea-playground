import { edgeKey, tourEdgeSet, type CrossoverEvent, type MutationEvent } from '../engine';
import { routeOf, type TourInfo } from './tour-cells';

/**
 * What the route map draws at the cursor, worked out from the population, the tours and the events visible there: the
 * cities, every edge with the layer it belongs to, the marks of the stage being stepped, the figures beside the map and the
 * text alternative. Cities are numbered from 0 in the data (as in the engine) and from 1 on the screen.
 */

export interface Size {
  readonly width: number;
  readonly height: number;
}

/** Cities placed in a box: equal scale across and up, centred, `margin` clear on every side, north (a larger second coordinate) up. */
export function layoutCities(places: readonly (readonly [number, number])[], size: Size, margin: number): { readonly points: readonly (readonly [number, number])[] } {
  const xs = places.map((p) => p[0]);
  const ys = places.map((p) => p[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const spanX = Math.max(...xs) - minX;
  const spanY = Math.max(...ys) - minY;
  const fits = [spanX > 0 ? (size.width - 2 * margin) / spanX : Infinity, spanY > 0 ? (size.height - 2 * margin) / spanY : Infinity];
  const scale = Math.min(...fits);
  const s = Number.isFinite(scale) ? scale : 0;
  const left = (size.width - spanX * s) / 2;
  const top = (size.height - spanY * s) / 2;
  return { points: places.map((p): [number, number] => [left + (p[0] - minX) * s, size.height - top - (p[1] - minY) * s]) };
}

export type Layer = 'population' | 'best' | 'selected' | 'optimal' | 'child' | 'removed' | 'added' | 'unchanged';
export type Origin = 'shared' | 'fromA' | 'fromB' | 'new';

export interface MapNode {
  /** The city, from 0. */
  readonly city: number;
  readonly x: number;
  readonly y: number;
  /** Ringed by a stage mark: the kept slice, or the ends of the edges a mutation changed. */
  readonly ringed: boolean;
}

export interface MapEdge {
  /** The two cities from 1, the smaller first: "3-9". */
  readonly key: string;
  /** The two cities from 0, the smaller first. */
  readonly a: number;
  readonly b: number;
  readonly layer: Layer;
  /** The population's edges: how many individuals use this edge. */
  readonly count?: number;
  /** The population's edges: a line width that grows with the count. */
  readonly width: number;
  /** A child's edges: where the edge comes from. */
  readonly origin?: Origin;
}

export interface MapFigure {
  readonly length: string;
  readonly gap?: string;
  readonly note?: string;
}

export interface MapTourRow {
  readonly role: string;
  /** The individual, for the best and the selected tour. */
  readonly id?: number;
  /** The canonical route, from city 1, written in full. */
  readonly route: string;
  readonly length: string;
  readonly gap: string;
}

export interface RouteMapInput {
  readonly info: TourInfo;
  readonly size: Size;
  /** The population as the table shows it, in the table's order. */
  readonly tours: readonly { readonly id: number; readonly tour: readonly number[]; readonly fitness: number }[];
  readonly selectedId?: number;
  readonly showPopulation: boolean;
  readonly showOptimal: boolean;
  /** The generation of the population shown. */
  readonly generation: number;
  /** The best fitness any generation of the run has had so far. */
  readonly bestSoFar: number;
  readonly mark?: { readonly kind: 'crossover'; readonly event: CrossoverEvent; readonly parentA: readonly number[]; readonly parentB: readonly number[] } | { readonly kind: 'mutation'; readonly event: MutationEvent };
}

export interface RouteMapModel {
  readonly size: Size;
  readonly nodes: readonly MapNode[];
  readonly edges: readonly MapEdge[];
  /** The population's edges are drawn dimmed (a mutation is being stepped). */
  readonly dimPopulation: boolean;
  /** The id of the best individual of the population shown. */
  readonly bestId: number;
  readonly mark?: { readonly kind: 'crossover' | 'mutation'; readonly sentence: string; readonly counts?: Record<Origin, number> };
  readonly stats: { readonly bestNow: MapFigure; readonly bestSoFar: MapFigure; readonly average: MapFigure; readonly optimum: MapFigure; readonly nearestNeighbour: MapFigure };
  readonly sentence: string;
  readonly tours: readonly MapTourRow[];
}

const margin = 24;
const widthOf = (count: number, total: number): number => 1 + (5 * count) / total;

/** The pairs of cities a closed tour joins, each with the smaller city first, in the order of the tour. */
const pairsOf = (tour: readonly number[]): [number, number][] => {
  if (tour.length < 2) return [];
  const seen = new Set<string>();
  const out: [number, number][] = [];
  tour.forEach((city, k) => {
    const next = tour[(k + 1) % tour.length]!;
    const key = edgeKey(city, next);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(city < next ? [city, next] : [next, city]);
  });
  return out;
};
const keyOf = (a: number, b: number): string => `${Math.min(a, b) + 1}-${Math.max(a, b) + 1}`;
const edge = (pair: readonly [number, number], layer: Layer, extra: Partial<MapEdge> = {}): MapEdge => ({ key: keyOf(pair[0], pair[1]), a: pair[0], b: pair[1], layer, width: 0, ...extra });

export function routeMapModel(input: RouteMapInput): RouteMapModel {
  const { info, size, tours } = input;
  const n = info.cities;
  const { points } = layoutCities(info.places, size, margin);
  const total = tours.length;

  // the best of the generation (the first of equals) and the selected individual
  let best = tours[0]!;
  for (const t of tours) if (t.fitness > best.fitness) best = t;
  const selected = input.selectedId === undefined ? undefined : tours.find((t) => t.id === input.selectedId);

  const edges: MapEdge[] = [];
  if (input.showPopulation) {
    const counts = new Map<string, { pair: [number, number]; count: number }>();
    for (const t of tours) {
      for (const pair of pairsOf(t.tour)) {
        const k = edgeKey(pair[0], pair[1]);
        const have = counts.get(k);
        if (have) have.count++;
        else counts.set(k, { pair, count: 1 });
      }
    }
    for (const { pair, count } of counts.values()) edges.push(edge(pair, 'population', { count, width: widthOf(count, total) }));
  }

  const ringed = new Set<number>();
  let mark: RouteMapModel['mark'];
  const mutating = input.mark?.kind === 'mutation';
  const marked = input.mark !== undefined;

  if (input.mark?.kind === 'crossover') {
    const { event, parentA, parentB } = input.mark;
    const child = event.children[0]!;
    const inA = tourEdgeSet(parentA);
    const inB = tourEdgeSet(parentB);
    const counts: Record<Origin, number> = { shared: 0, fromA: 0, fromB: 0, new: 0 };
    for (const pair of pairsOf(child.chromosome)) {
      const k = edgeKey(pair[0], pair[1]);
      const origin: Origin = inA.has(k) && inB.has(k) ? 'shared' : inA.has(k) ? 'fromA' : inB.has(k) ? 'fromB' : 'new';
      counts[origin]++;
      edges.push(edge(pair, 'child', { origin }));
    }
    let slice = '';
    if (event.cuts) {
      // O1 holds, at the slice's positions, the cities it kept or took in place
      for (let p = event.cuts[0]!; p < event.cuts[1]!; p++) ringed.add(child.chromosome[p]!);
      slice = ` The slice (positions ${event.cuts[0]! + 1} to ${event.cuts[1]}) is ringed.`;
    }
    mark = { kind: 'crossover', counts, sentence: `Pair ${event.pair}: O${child.offspring}’s edges by origin: ${counts.shared} shared by both parents, ${counts.fromA} from A only, ${counts.fromB} from B only, ${counts.new} new.${slice}` };
  } else if (input.mark?.kind === 'mutation') {
    const { event } = input.mark;
    const added = new Set((event.edges?.added ?? []).map((e) => edgeKey(e[0], e[1])));
    for (const pair of pairsOf(event.after)) {
      const k = edgeKey(pair[0], pair[1]);
      edges.push(edge(pair, added.has(k) ? 'added' : 'unchanged'));
    }
    for (const e of event.edges?.removed ?? []) edges.push(edge(e[0] < e[1] ? [e[0], e[1]] : [e[1], e[0]], 'removed'));
    for (const e of [...(event.edges?.removed ?? []), ...(event.edges?.added ?? [])]) {
      ringed.add(e[0]);
      ringed.add(e[1]);
    }
    const head = `Offspring ${event.offspring}:`;
    const sentence =
      event.decision === 'bypassed'
        ? `${head} mutation is off, so its tour is drawn as it is.`
        : event.decision === 'unchanged'
          ? `${head} unchanged; its tour is drawn as it is.`
          : `${head} ${event.edges!.removed.length} edges removed (✕, dashed), ${event.edges!.added.length} added (bold); the cities at the ends are ringed.`;
    mark = { kind: 'mutation', sentence };
  }

  if (!marked) {
    edges.push(...pairsOf(best.tour).map((pair) => edge(pair, 'best')));
    if (selected) edges.push(...pairsOf(selected.tour).map((pair) => edge(pair, 'selected')));
  }
  if (input.showOptimal) edges.push(...pairsOf(info.instance.optimalTour).map((pair) => edge(pair, 'optimal')));

  const nodes = points.map((p, city): MapNode => ({ city, x: p[0], y: p[1], ringed: ringed.has(city) }));

  // the figures beside the map
  const lengthOfFitness = (fitness: number) => 0 - fitness;
  const lengths = tours.map((t) => lengthOfFitness(t.fitness));
  const figure = (length: number): MapFigure => ({ length: info.lengthText(length), gap: `+${info.gapText(length)}` });
  const bestLength = lengthOfFitness(best.fitness);
  const average = lengths.reduce((s, l) => s + l, 0) / total;
  const nearest = info.instance.nearestNeighbour.length;
  const stats = {
    bestNow: figure(bestLength),
    bestSoFar: figure(lengthOfFitness(input.bestSoFar)),
    average: figure(average),
    optimum: { length: info.lengthText(info.optimum), note: info.instance.optimumSource === 'published' ? 'published' : 'exact' } as MapFigure,
    nearestNeighbour: figure(nearest),
  };

  // the text alternative: a sentence and a table of the tours that are marked
  const everyone = [...tourEdgeSet(best.tour)].filter((k) => tours.every((t) => tourEdgeSet(t.tour).has(k))).length;
  const sentence = `${info.instance.name}: ${n} cities, ${info.instance.rule}. Generation ${input.generation}: the best tour is ${info.lengthText(bestLength)} long, ${info.gapText(bestLength)} over the optimum ${info.lengthText(info.optimum)}; ${everyone} ${everyone === 1 ? 'edge is' : 'edges are'} in every individual.`;
  const row = (role: string, tour: readonly number[], id?: number): MapTourRow => {
    const length = info.lengthOf(tour);
    return { role, ...(id !== undefined ? { id } : {}), route: routeOf(tour.map((c) => c + 1).join(' ')).route.join(' '), length: info.lengthText(length), gap: info.gapText(length) };
  };
  const rows = [row('best of the generation', best.tour, best.id)];
  if (selected) rows.push(row('selected individual', selected.tour, selected.id));
  if (input.showOptimal) rows.push(row('optimal tour', info.instance.optimalTour));

  return { size, nodes, edges, dimPopulation: mutating, bestId: best.id, ...(mark ? { mark } : {}), stats, sentence, tours: rows };
}
