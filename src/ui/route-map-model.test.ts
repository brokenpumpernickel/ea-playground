import { describe, expect, test } from 'vitest';
import { crossover, initialize, mutate, pair, parseTour, tspInstance, tspPlaces, tspProblem, type Individual, type Rng, type TspOptions } from '../engine';
import { focusMap, freeBoxFor, layoutCities, routeMapModel, type RouteMapInput } from './route-map-model';
import { tourInfoOf } from './tour-cells';

const scripted = (...draws: number[]): Rng => {
  let k = 0;
  return { next: () => draws[k++]! };
};
const opts = (instance: string, n = 10): TspOptions => ({ instance, n, seed: 1 });
const problem = tspProblem(opts('circle', 9));
const info = tourInfoOf(problem);
const size = { width: 740, height: 290 };
const T = (text: string) => [...parseTour(text)!];
const A = '1 2 3 4 5 6 7 8 9';
const B = '9 3 7 8 2 6 5 1 4';
const base = (tours: string[], extra: Partial<RouteMapInput> = {}): RouteMapInput => ({
  info,
  size,
  tours: tours.map((t, k) => ({ id: 10 + k, tour: T(t), fitness: -info.lengthOf(T(t)) })),
  showPopulation: true,
  showOptimal: false,
  generation: 3,
  bestSoFar: Infinity,
  ...extra,
});
const keys = (edges: { key: string }[]) => edges.map((e) => e.key).sort();
const edgesOf = (text: string) => {
  const t = T(text);
  return t.map((c, k) => [c, t[(k + 1) % t.length]!].sort((a, b) => a - b)).map(([a, b]) => `${a! + 1}-${b! + 1}`).sort();
};

describe('where the cities are drawn', () => {
  test('equal scale across and up, centred, inside the margin, north up', () => {
    const square = layoutCities([[0, 0], [10, 0], [10, 10], [0, 10]], { width: 740, height: 290 }, 24);
    expect(square.points).toHaveLength(4);
    const [bl, br, tr, tl] = square.points as [[number, number], [number, number], [number, number], [number, number]];
    expect(br[0] - bl[0]).toBeCloseTo(290 - 48, 6);
    expect(bl[1] - tl[1]).toBeCloseTo(290 - 48, 6);
    expect((bl[0] + br[0]) / 2).toBeCloseTo(370, 6);
    expect(tl[1]).toBeCloseTo(24, 6);
    expect(bl[1]).toBeCloseTo(290 - 24, 6);
    expect(tr[0]).toBeCloseTo(br[0], 9);
  });

  test('the map keeps 24 px clear of the border for its labels, in the direction that limits it', () => {
    const m = routeMapModel(base([A]));
    const xs = m.nodes.map((n) => n.x);
    const ys = m.nodes.map((n) => n.y);
    // nine cities on a circle: the picture is limited by its height
    expect(Math.min(...ys)).toBeCloseTo(24, 6);
    expect(Math.max(...ys)).toBeCloseTo(290 - 24, 6);
    expect(Math.min(...xs)).toBeGreaterThan(24);
    expect(Math.max(...xs)).toBeLessThan(740 - 24);
  });

  test('a wide field is limited by its width, a tall one by its height', () => {
    const wide = layoutCities([[0, 0], [100, 10]], { width: 740, height: 290 }, 24);
    expect(wide.points[1]![0] - wide.points[0]![0]).toBeCloseTo(692, 6);
    const tall = layoutCities([[0, 0], [10, 100]], { width: 740, height: 290 }, 24);
    expect(tall.points[0]![1] - tall.points[1]![1]).toBeCloseTo(242, 6);
  });

  test('cities on one line lie on one line, cities at one place at the centre, and nothing is NaN', () => {
    const line = layoutCities([[0, 5], [3, 5], [9, 5]], size, 24);
    expect(new Set(line.points.map((p) => p[1])).size).toBe(1);
    expect(line.points[0]![1]).toBeCloseTo(145, 6);
    const dot = layoutCities([[2, 2], [2, 2]], size, 24);
    expect(dot.points).toEqual([[370, 145], [370, 145]]);
  });

  test('a GEO instance is drawn with longitude across and latitude up, a TSPLIB one where its coordinates say', () => {
    const ulysses = tourInfoOf(tspProblem(opts('ulysses16')));
    const m = routeMapModel({ ...base([A]), info: ulysses, tours: [{ id: 1, tour: [...Array(16).keys()], fitness: 0 }] });
    const lon = ulysses.instance.coordinates.map((c) => c[1]);
    const lat = ulysses.instance.coordinates.map((c) => c[0]);
    const xs = m.nodes.map((n) => n.x);
    const ys = m.nodes.map((n) => n.y);
    const rank = (v: number[]) => v.map((a) => v.filter((b) => b < a).length);
    expect(rank(xs)).toEqual(rank(lon));
    expect(rank(ys)).toEqual(rank(lat.map((v) => -v))); // north (a larger latitude) is up, that is a smaller y
    const berlin = tourInfoOf(tspProblem(opts('berlin52')));
    const b = routeMapModel({ ...base([A]), info: berlin, tours: [{ id: 1, tour: [...Array(52).keys()], fitness: 0 }] });
    const bx = berlin.instance.coordinates.map((c) => c[0]);
    const by = berlin.instance.coordinates.map((c) => c[1]);
    expect(rank(b.nodes.map((n) => n.x))).toEqual(rank(bx));
    expect(rank(b.nodes.map((n) => n.y))).toEqual(rank(by.map((v) => -v)));
  });
});

describe('the population on the map', () => {
  const m = routeMapModel(base([A, B, A, '1 3 2 4 5 6 7 8 9']));

  test('every edge any individual has is drawn once, its width following how many individuals use it', () => {
    const population = m.edges.filter((e) => e.layer === 'population');
    const all = new Set([...edgesOf(A), ...edgesOf(B), ...edgesOf('1 3 2 4 5 6 7 8 9')]);
    expect(keys(population)).toEqual([...all].sort());
    const count = (key: string) => [A, B, A, '1 3 2 4 5 6 7 8 9'].filter((t) => edgesOf(t).includes(key)).length;
    for (const e of population) {
      expect(e.count).toBe(count(e.key));
      expect(e.width).toBeCloseTo(1 + (5 * e.count!) / 4, 9);
    }
    expect(population.find((e) => e.key === '1-2')!.count).toBe(2); // in A, twice, and in neither of the others
    expect(population.find((e) => e.key === '8-9')!.count).toBe(3); // in A twice and in the last tour
  });

  test('with the toggle off the population’s edges are not drawn', () => {
    const off = routeMapModel(base([A, B], { showPopulation: false }));
    expect(off.edges.some((e) => e.layer === 'population')).toBe(false);
  });

  test('the best tour is the one with the highest fitness, the first of equals, drawn as its own layer', () => {
    const best = m.edges.filter((e) => e.layer === 'best');
    const shortest = [A, B, '1 3 2 4 5 6 7 8 9'].reduce((p, t) => (info.lengthOf(T(t)) < info.lengthOf(T(p)) ? t : p));
    expect(keys(best)).toEqual(edgesOf(shortest));
    expect(m.bestId).toBe(10 + [A, B, A, '1 3 2 4 5 6 7 8 9'].indexOf(shortest));
  });

  test('the selected individual’s tour is its own layer, and nothing when nobody is selected or the id is not in the population', () => {
    const selected = routeMapModel(base([A, B], { selectedId: 11 }));
    expect(keys(selected.edges.filter((e) => e.layer === 'selected'))).toEqual(edgesOf(B));
    expect(routeMapModel(base([A, B])).edges.some((e) => e.layer === 'selected')).toBe(false);
    expect(routeMapModel(base([A, B], { selectedId: 99 })).edges.some((e) => e.layer === 'selected')).toBe(false);
  });

  test('the optimal tour is drawn on request, from the instance’s own optimal tour', () => {
    const on = routeMapModel(base([A, B], { showOptimal: true }));
    const optimal = on.edges.filter((e) => e.layer === 'optimal');
    expect(optimal).toHaveLength(9);
    const tour = tspInstance(opts('circle', 9)).optimalTour;
    expect(keys(optimal)).toEqual(edgesOf(tour.map((c) => c + 1).join(' ')));
    expect(routeMapModel(base([A, B])).edges.some((e) => e.layer === 'optimal')).toBe(false);
  });

  test('every edge joins two cities that exist, and its key is the two cities from 1, the smaller first', () => {
    for (const e of m.edges) {
      expect(e.a).toBeLessThan(e.b);
      expect(e.key).toBe(`${e.a + 1}-${e.b + 1}`);
      expect(e.a).toBeGreaterThanOrEqual(0);
      expect(e.b).toBeLessThan(9);
    }
  });
});

describe('the stage marks while crossover is stepped', () => {
  const population = (texts: string[]): Individual[] => initialize(problem, { kind: 'explicit', chromosomes: texts }, scripted()).population;
  const cross = (operator: 'ox' | 'pmx' | 'cx', draws: number[], probability = 1) => {
    const { events } = crossover(population([A, B]), pair([1, 2], 2).pairs, { enabled: true, operator, probability }, scripted(...draws), undefined, true);
    return events[0]!;
  };
  const mark = (event: ReturnType<typeof cross>) => routeMapModel(base([A, B], { mark: { kind: 'crossover', event, parentA: T(A), parentB: T(B) } }));

  test('the child’s edges are told apart by where they come from: shared, from A only, from B only, new', () => {
    const e = cross('ox', [0.1, 0.3, 0.8]);
    const m = mark(e);
    const child = e.children[0]!.chromosome;
    const childEdges = edgesOf(child.map((c) => c + 1).join(' '));
    const inA = new Set(edgesOf(A));
    const inB = new Set(edgesOf(B));
    const expectOrigin = (k: string) => (inA.has(k) && inB.has(k) ? 'shared' : inA.has(k) ? 'fromA' : inB.has(k) ? 'fromB' : 'new');
    const drawn = m.edges.filter((x) => x.layer === 'child');
    expect(keys(drawn)).toEqual(childEdges);
    for (const x of drawn) expect(x.origin).toBe(expectOrigin(x.key));
    expect(m.mark!.counts).toEqual({
      shared: childEdges.filter((k) => expectOrigin(k) === 'shared').length,
      fromA: childEdges.filter((k) => expectOrigin(k) === 'fromA').length,
      fromB: childEdges.filter((k) => expectOrigin(k) === 'fromB').length,
      new: childEdges.filter((k) => expectOrigin(k) === 'new').length,
    });
    expect(m.mark!.counts!.shared + m.mark!.counts!.fromA + m.mark!.counts!.fromB + m.mark!.counts!.new).toBe(9);
  });

  test('the slice of OX and PMX is ringed in the child; CX has none to ring', () => {
    const ox = mark(cross('ox', [0.1, 0.3, 0.8]));
    expect(ox.nodes.filter((n) => n.ringed).map((n) => n.city + 1).sort()).toEqual([4, 5, 6, 7]); // positions 4 to 7 of O1, which keeps A's slice 4 5 6 7
    const pmx = mark(cross('pmx', [0.1, 0.3, 0.8]));
    expect(pmx.nodes.filter((n) => n.ringed).map((n) => n.city + 1).sort((a, b) => a - b)).toEqual([2, 5, 6, 8]); // O1 takes B's slice 8 2 6 5
    expect(mark(cross('cx', [0.1])).nodes.some((n) => n.ringed)).toBe(false);
  });

  test('the best and the selected tours are not drawn while a child is, the population is', () => {
    const m = routeMapModel(base([A, B], { selectedId: 10, mark: { kind: 'crossover', event: cross('ox', [0.1, 0.3, 0.8]), parentA: T(A), parentB: T(B) } }));
    expect(m.edges.some((e) => e.layer === 'best' || e.layer === 'selected')).toBe(false);
    expect(m.edges.some((e) => e.layer === 'population')).toBe(true);
  });

  test('the sentence says how many edges of each origin, and names the slice', () => {
    const m = mark(cross('ox', [0.1, 0.3, 0.8]));
    const c = m.mark!.counts!;
    expect(m.mark!.sentence).toBe(`Pair 1: O1’s edges by origin: ${c.shared} shared by both parents, ${c.fromA} from A only, ${c.fromB} from B only, ${c.new} new. The slice (positions 4 to 7) is ringed.`);
    expect(mark(cross('cx', [0.1])).mark!.sentence).not.toContain('ringed');
  });

  test('a bypass draws the copy of A, whose edges come from A', () => {
    const e = cross('ox', [0.9], 0.5);
    expect(e.decision).toBe('bypassed');
    const m = mark(e);
    for (const x of m.edges.filter((y) => y.layer === 'child')) expect(['shared', 'fromA']).toContain(x.origin);
    expect(m.mark!.counts!.fromB + m.mark!.counts!.new).toBe(0);
  });
});

describe('the stage marks while mutation is stepped', () => {
  const T9 = '1 2 3 4 5 6 7 8 9';
  const mutateOnce = (kind: 'swap' | 'inversion' | 'insertion', draws: number[], probability = 1, enabled = true) => {
    const { events } = mutate([{ offspring: 1, chromosome: T(T9) }], { enabled, mode: 'per-individual', probability, operator: kind }, scripted(...draws), 0, undefined, true);
    return events[0]!;
  };
  const mark = (event: ReturnType<typeof mutateOnce>) => routeMapModel(base([A, B], { mark: { kind: 'mutation', event } }));

  test('the removed edges, the added edges and the unchanged ones are the event’s', () => {
    const e = mutateOnce('inversion', [0.1, 0.2, 0.9]);
    const m = mark(e);
    const key = (x: readonly [number, number]) => `${Math.min(x[0], x[1]) + 1}-${Math.max(x[0], x[1]) + 1}`;
    expect(keys(m.edges.filter((x) => x.layer === 'removed'))).toEqual(e.edges!.removed.map(key).sort());
    expect(keys(m.edges.filter((x) => x.layer === 'added'))).toEqual(e.edges!.added.map(key).sort());
    const after = edgesOf(e.after.map((c) => c + 1).join(' '));
    const added = new Set(e.edges!.added.map(key));
    expect(keys(m.edges.filter((x) => x.layer === 'unchanged'))).toEqual(after.filter((k) => !added.has(k)));
    // every edge of the tour after the move is drawn exactly once, as added or unchanged
    expect(m.edges.filter((x) => x.layer === 'added' || x.layer === 'unchanged')).toHaveLength(9);
  });

  test('the cities at the ends of the removed and added edges are ringed, and nothing else', () => {
    const e = mutateOnce('swap', [0.1, 0.2, 0.9]);
    const m = mark(e);
    const ends = new Set([...e.edges!.removed, ...e.edges!.added].flat().map((c) => c + 1));
    expect(m.nodes.filter((n) => n.ringed).map((n) => n.city + 1).sort((a, b) => a - b)).toEqual([...ends].sort((a, b) => a - b));
  });

  test('the population is drawn dimmed while an offspring is, and the best and selected tours are not drawn', () => {
    const m = routeMapModel(base([A, B], { selectedId: 10, mark: { kind: 'mutation', event: mutateOnce('swap', [0.1, 0.2, 0.9]) } }));
    expect(m.edges.some((e) => e.layer === 'best' || e.layer === 'selected')).toBe(false);
    expect(m.dimPopulation).toBe(true);
    expect(routeMapModel(base([A, B])).dimPopulation).toBe(false);
  });

  test('the sentence counts the removed and added edges, and says the ends are ringed', () => {
    const e = mutateOnce('inversion', [0.1, 0.2, 0.9]);
    expect(mark(e).mark!.sentence).toBe(`Offspring 1: ${e.edges!.removed.length} edges removed (✕, dashed), ${e.edges!.added.length} added (bold); the cities at the ends are ringed.`);
  });

  test('an unchanged offspring, and one whose mutation is off, are drawn as they are with nothing marked', () => {
    const unchanged = mark(mutateOnce('swap', [0.9], 0.4));
    expect(unchanged.edges.filter((e) => e.layer === 'unchanged')).toHaveLength(9);
    expect(unchanged.edges.some((e) => e.layer === 'removed' || e.layer === 'added')).toBe(false);
    expect(unchanged.nodes.some((n) => n.ringed)).toBe(false);
    expect(unchanged.mark!.sentence).toBe('Offspring 1: unchanged; its tour is drawn as it is.');
    const off = mark(mutateOnce('swap', [], 0.4, false));
    expect(off.mark!.sentence).toBe('Offspring 1: mutation is off, so its tour is drawn as it is.');
  });
});

describe('the figures beside the map and the text alternative', () => {
  const tours = [A, B, '1 3 2 4 5 6 7 8 9'];
  const lens = tours.map((t) => info.lengthOf(T(t)));
  const m = routeMapModel(base(tours, { bestSoFar: -Math.min(...lens) + 0, generation: 4 }));

  test('best now, best so far, average, the optimum and the nearest neighbour, each with its length and gap', () => {
    const best = Math.min(...lens);
    const average = lens.reduce((s, l) => s + l, 0) / lens.length;
    expect(m.stats.bestNow).toEqual({ length: info.lengthText(best), gap: `+${info.gapText(best)}` });
    expect(m.stats.average).toEqual({ length: info.lengthText(average), gap: `+${info.gapText(average)}` });
    expect(m.stats.optimum).toEqual({ length: info.lengthText(info.optimum), note: 'exact' });
    const nn = info.instance.nearestNeighbour.length;
    expect(m.stats.nearestNeighbour).toEqual({ length: info.lengthText(nn), gap: `+${info.gapText(nn)}`, note: `from city ${info.instance.nearestNeighbour.start + 1}` });
  });

  test('best so far is the larger fitness of the run, as a length; a published optimum says so', () => {
    expect(m.stats.bestSoFar).toEqual({ length: info.lengthText(Math.min(...lens)), gap: `+${info.gapText(Math.min(...lens))}` });
    const berlin = routeMapModel({ ...base([A]), info: tourInfoOf(tspProblem(opts('berlin52'))), tours: [{ id: 1, tour: [...Array(52).keys()], fitness: -30000 }], bestSoFar: -25000 });
    expect(berlin.stats.optimum).toEqual({ length: '7,542', note: 'published' });
    expect(berlin.stats.bestSoFar.length).toBe('25,000');
  });

  test('the sentence says the instance, the generation, the best tour with its gap and how many edges every individual has', () => {
    const best = Math.min(...lens);
    const every = new Set(tours.map((t) => edgesOf(t)).reduce((a, b) => a.filter((k) => b.includes(k)))).size;
    expect(m.sentence).toBe(`${info.instance.name}: 9 cities, ${info.instance.rule}. Generation 4: the best tour is ${info.lengthText(best)} long, ${info.gapText(best)} over the optimum ${info.lengthText(info.optimum)}; ${every} ${every === 1 ? 'edge is' : 'edges are'} in every individual.`);
  });

  test('the hidden table lists the best tour and, when there is one, the selected tour, in full, with length and gap', () => {
    expect(m.tours.map((t) => t.role)).toEqual(['best of the generation']);
    const withSelected = routeMapModel(base(tours, { selectedId: 12, showOptimal: true }));
    expect(withSelected.tours.map((t) => t.role)).toEqual(['best of the generation', 'selected individual', 'optimal tour']);
    const selected = withSelected.tours[1]!;
    expect(selected.route).toBe('1 3 2 4 5 6 7 8 9');
    expect(selected.length).toBe(info.lengthText(info.lengthOf(T('1 3 2 4 5 6 7 8 9'))));
    expect(selected.id).toBe(12);
  });
});

describe('the cities in the area the overlays leave free', () => {
  test('given a free box, every city lies inside it, 24 px from its edges at the tightest, and the layout is the same inside it as it would be alone', () => {
    const free = { left: 470, top: 72, width: 1016, height: 650 };
    const m = routeMapModel(base([A], { size: { width: 1840, height: 734 }, free }));
    for (const n of m.nodes) {
      expect(n.x).toBeGreaterThanOrEqual(free.left + 24 - 1e-9);
      expect(n.x).toBeLessThanOrEqual(free.left + free.width - 24 + 1e-9);
      expect(n.y).toBeGreaterThanOrEqual(free.top + 24 - 1e-9);
      expect(n.y).toBeLessThanOrEqual(free.top + free.height - 24 + 1e-9);
    }
    const alone = routeMapModel(base([A], { size: { width: free.width, height: free.height } }));
    alone.nodes.forEach((n, k) => {
      expect(m.nodes[k]!.x).toBeCloseTo(n.x + free.left, 9);
      expect(m.nodes[k]!.y).toBeCloseTo(n.y + free.top, 9);
    });
    expect(m.size).toEqual({ width: 1840, height: 734 });
  });

  test('without a free box the whole picture is used, as before', () => {
    const a = routeMapModel(base([A]));
    const b = routeMapModel(base([A], { free: { left: 0, top: 0, width: size.width, height: size.height } }));
    expect(b.nodes).toEqual(a.nodes);
  });

  test('both free boxes of the focus view are clear of the toolbar, the figures card and the fitness graph, whatever the map', () => {
    const { picture, frees, overlays } = focusMap;
    const apart = (a: { left: number; top: number; width: number; height: number }, b: { left: number; top: number; width: number; height: number }) =>
      a.left + a.width <= b.left || b.left + b.width <= a.left || a.top + a.height <= b.top || b.top + b.height <= a.top;
    for (const free of frees) {
      for (const [name, box] of Object.entries(overlays)) expect(apart(free, box), `a free box ${JSON.stringify(free)} and the ${name}`).toBe(true);
      expect(free.left + free.width).toBeLessThanOrEqual(picture.width);
      expect(free.top + free.height).toBeLessThanOrEqual(picture.height);
    }
    for (const [name, box] of Object.entries(overlays)) {
      expect(box.left, name).toBeGreaterThanOrEqual(0);
      expect(box.top, name).toBeGreaterThanOrEqual(0);
      expect(box.left + box.width, name).toBeLessThanOrEqual(picture.width);
      expect(box.top + box.height, name).toBeLessThanOrEqual(picture.height);
    }
    // the tall box is most of the picture's height, so a map about as tall as wide is large
    expect(Math.max(...frees.map((f) => f.height))).toBeGreaterThan(picture.height * 0.85);
  });

  test('the box chosen is the one that makes the larger map: the tall one for a round map, the wide one for a long thin one', () => {
    const round = tspInstance({ instance: 'circle', n: 9, seed: 1 });
    expect(freeBoxFor(tspPlaces(round))).toBe(focusMap.frees[0]);
    const thin: [number, number][] = [[0, 0], [100, 5], [60, 3]];
    expect(freeBoxFor(thin)).toBe(focusMap.frees[1]);
    const tall: [number, number][] = [[0, 0], [5, 100]];
    expect(freeBoxFor(tall)).toBe(focusMap.frees[0]);
    // cities all at one place or on one line: a box is still chosen, nothing is NaN
    expect(focusMap.frees).toContain(freeBoxFor([[1, 1], [1, 1]]));
    expect(focusMap.frees).toContain(freeBoxFor([[0, 5], [3, 5]]));
    // and the chosen box never gives a smaller map than the other
    for (const places of [thin, tall, tspPlaces(tspInstance({ instance: 'berlin52', n: 10, seed: 1 })), tspPlaces(tspInstance({ instance: 'ulysses16', n: 10, seed: 1 }))]) {
      const free = freeBoxFor(places);
      const width = (box: typeof free) => layoutCities(places, { width: box.width, height: box.height }, 24).points;
      const extent = (pts: readonly (readonly [number, number])[]) => Math.max(Math.max(...pts.map((p) => p[0])) - Math.min(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1])) - Math.min(...pts.map((p) => p[1])));
      for (const other of focusMap.frees) expect(extent(width(free))).toBeGreaterThanOrEqual(extent(width(other)) - 1e-9);
    }
  });
});
