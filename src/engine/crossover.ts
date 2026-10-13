import type { Chromosome, Gene } from './chromosome';
import type { Individual } from './initialize';
import type { Pair } from './pairing';
import type { Bounds } from './problem';
import type { Rng } from '../run/rng';

/**
 * One-point, two-point and uniform are discrete recombination and work on any representation; BLX-α and arithmetic
 * crossover blend numbers and exist only for real-valued chromosomes (ADR 0006); order, partial-mapped and cycle crossover keep a
 * permutation a permutation and exist only for permutation chromosomes (ADR 0007).
 */
export type CrossoverOperator = 'one-point' | 'two-point' | 'uniform' | 'blx-alpha' | 'arithmetic' | 'ox' | 'pmx' | 'cx';

/** The operators that need real-valued genes. */
export const realOnlyOperators: readonly CrossoverOperator[] = ['blx-alpha', 'arithmetic'];

/** The operators that need permutation chromosomes (ADR 0007). */
export const permutationOperators: readonly CrossoverOperator[] = ['ox', 'pmx', 'cx'];

/** The default α of BLX-α: how far a child gene may fall outside the parents' interval, as a share of its length. */
export const defaultAlpha = 0.5;

export interface CrossoverConfig {
  readonly enabled: boolean;
  readonly operator: CrossoverOperator;
  /** Applies per pair: one draw u decides recombine (u < probability) or bypass. */
  readonly probability: number;
  /** BLX-α only: how far the interval is widened on each side, as a share of its length; 0 or more, default `defaultAlpha`. */
  readonly alpha?: number;
}

/** Which parent a gene came from: A is the pair's first parent, B its second. */
export type Source = 'A' | 'B';

export interface Child {
  /** Numbered from 1 across the generation: pair k makes offspring 2k − 1 and 2k. */
  readonly offspring: number;
  readonly pair: number;
  readonly chromosome: Chromosome;
  /** Which parent each gene was copied from; empty when the genes are blends of both parents (BLX-α, arithmetic). */
  readonly sources: readonly Source[];
  /** Real operators only: for each gene, whether the value was clamped to its bound (BLX-α can leave the bounds). */
  readonly clamped?: readonly boolean[];
}

/**
 * What BLX-α did at one gene: the parents' values, d = |a − b|, the widened interval [from, to] (min − α·d to max + α·d),
 * the two uniform draws (the first makes O1's gene, the second O2's), the values they give, and whether each was clamped.
 */
export interface BlendGene {
  readonly a: number;
  readonly b: number;
  readonly d: number;
  readonly from: number;
  readonly to: number;
  readonly draws: readonly [number, number];
  readonly raw: readonly [number, number];
  readonly clamped: readonly [boolean, boolean];
}

/** OX: the cities one child took from the other parent, in the order it took them, and the positions they went to (the first after the second cut, wrapping round). */
export interface OrderFill {
  readonly cities: readonly number[];
  readonly positions: readonly number[];
}

/**
 * PMX, for one child: `pairs` are the cities it took from the donor's slice and the cities of the other parent's slice they
 * displace, in slice order; `followed` are the positions outside the slice whose city was already in the donor's slice, with the
 * chain of cities followed through the mapping (the first is the conflicting city, the last the free city that was used).
 */
export interface PmxChild {
  readonly pairs: readonly { readonly taken: number; readonly displaced: number }[];
  readonly followed: readonly { readonly position: number; readonly chain: readonly number[]; readonly city: number }[];
}

export interface CrossoverEvent {
  readonly stage: 'crossover';
  readonly kind: 'pair';
  readonly pair: number;
  readonly parentAId: number;
  readonly parentBId: number;
  readonly operator: CrossoverOperator;
  readonly decision: 'recombined' | 'bypassed';
  readonly reason?: 'switched-off' | 'draw-failed';
  readonly draw?: { readonly u: number; readonly threshold: number };
  /**
   * One-point and two-point: each cut is the number of genes to its left, sorted. Two-point swaps the genes between them.
   * OX and PMX: the two cuts, drawn as two-point crossover draws them (two different gaps between genes, so the slice, the
   * genes from the first cut to the second, has 1 to n − 2 cities).
   */
  readonly cuts?: readonly number[];
  /** Uniform: true for each gene that was swapped. */
  readonly mask?: readonly boolean[];
  /**
   * BLX-α: α and one entry per gene. Draw order after the pair's draw u: for each gene in order, the draw for O1 and then
   * the draw for O2 (1 + 2 × genes draws in all).
   */
  readonly alpha?: number;
  readonly blend?: readonly BlendGene[];
  /** Arithmetic: λ, the one draw after the pair's draw u; O1 = λ·A + (1 − λ)·B, O2 = (1 − λ)·A + λ·B. */
  readonly lambda?: number;
  /** OX: for O1 (which keeps A's slice) and O2 (which keeps B's), the fill taken from the other parent. */
  readonly fill?: readonly [OrderFill, OrderFill];
  /** PMX: for O1 (which takes B's slice) and O2 (which takes A's), the mapping and the conflicts followed. */
  readonly mapping?: readonly [PmxChild, PmxChild];
  /** CX: the cycles, each a list of positions (0-based) in the order they were found; the first cycle's positions go to O1 from A, the second's from B, and so on. */
  readonly cycles?: readonly (readonly number[])[];
  readonly children: readonly (Child & { readonly discarded: boolean })[];
}

/** The fewest genes an operator can work on: one cut needs two genes, two cuts three. */
export const minimumGenes: Record<CrossoverOperator, number> = { 'one-point': 2, 'two-point': 3, uniform: 1, 'blx-alpha': 1, arithmetic: 1, ox: 3, pmx: 3, cx: 1 };
export const operatorName: Record<CrossoverOperator, string> = {
  'one-point': 'One-point',
  'two-point': 'Two-point',
  uniform: 'Uniform',
  'blx-alpha': 'BLX-α',
  arithmetic: 'Arithmetic',
  ox: 'Order (OX)',
  pmx: 'Partial-mapped (PMX)',
  cx: 'Cycle (CX)',
};

export function crossover(
  population: readonly Individual[],
  pairs: readonly Pair[],
  config: CrossoverConfig,
  rng: Rng,
  /** The bounds of a real-valued problem's genes; absent for the symbol problems, which refuse the real-only operators. */
  bounds?: readonly Bounds[],
  /** True for a permutation problem (ADR 0007), which takes only order, partial-mapped and cycle crossover. */
  permutation = false,
): { offspring: Child[]; events: CrossoverEvent[] } {
  if (!(config.probability >= 0 && config.probability <= 1)) throw new Error('Crossover probability must be between 0 and 1');
  if (permutation && !permutationOperators.includes(config.operator)) {
    throw new Error(`${operatorName[config.operator]} crossover would repeat and lose cities; choose order, partial-mapped or cycle crossover for this problem`);
  }
  if (!permutation && permutationOperators.includes(config.operator)) {
    throw new Error(`${operatorName[config.operator]} crossover is for permutation chromosomes; choose ${bounds ? 'BLX-α, arithmetic, ' : ''}one-point, two-point or uniform crossover for this problem`);
  }
  if (realOnlyOperators.includes(config.operator) && !bounds) {
    throw new Error(`${operatorName[config.operator]} crossover is for real-valued chromosomes; choose one-point, two-point or uniform crossover for this problem`);
  }
  const alpha = config.alpha ?? defaultAlpha;
  if (config.operator === 'blx-alpha' && !(alpha >= 0 && Number.isFinite(alpha))) throw new Error('α must be a number of 0 or more');
  const byId = new Map(population.map((i) => [i.id, i]));
  const parentsOf = (p: Pair) => {
    for (const id of [p.parentAId, p.parentBId]) {
      if (!byId.has(id)) throw new Error(`Pair ${p.pair} refers to individual ${id}, who is not in the population`);
    }
    return [byId.get(p.parentAId)!.chromosome, byId.get(p.parentBId)!.chromosome] as const;
  };
  const needed = minimumGenes[config.operator];
  for (const p of pairs) {
    const length = parentsOf(p)[0].length;
    if (config.enabled && length < needed) {
      throw new Error(`${operatorName[config.operator]} crossover needs chromosomes of at least ${needed} genes, but they have ${length}`);
    }
  }

  const offspring: Child[] = [];
  const events: CrossoverEvent[] = [];

  for (const p of pairs) {
    const [a, b] = parentsOf(p);
    // A switched-off crossover draws nothing at all; otherwise each pair draws u first.
    const u = config.enabled ? rng.next() : undefined;
    const recombine = u !== undefined && u < config.probability;
    const blended =
      recombine && config.operator === 'blx-alpha' ? blend(a, b, alpha, bounds!, rng) : recombine && config.operator === 'arithmetic' ? arithmetic(a, b, bounds!, rng) : undefined;
    const permuted = recombine && permutationOperators.includes(config.operator) ? permute(config.operator, a, b, rng) : undefined;
    const plan = recombine && !blended && !permuted ? drawSwaps(config.operator, a.length, rng) : { swapped: a.map(() => false) };
    const { swapped } = plan;
    const [first, second] = blended ? blended.children : permuted ? permuted.children : makeChildren(a, b, swapped);
    const children = [
      { offspring: 2 * p.pair - 1, pair: p.pair, ...first, discarded: false },
      { offspring: 2 * p.pair, pair: p.pair, ...second, discarded: p.secondChildDropped },
    ];
    offspring.push(...children.filter((c) => !c.discarded).map(({ discarded: _d, ...c }) => c));
    events.push({
      stage: 'crossover',
      kind: 'pair',
      pair: p.pair,
      parentAId: p.parentAId,
      parentBId: p.parentBId,
      operator: config.operator,
      decision: recombine ? 'recombined' : 'bypassed',
      ...(recombine ? {} : { reason: config.enabled ? ('draw-failed' as const) : ('switched-off' as const) }),
      ...(u === undefined ? {} : { draw: { u, threshold: config.probability } }),
      ...('cuts' in plan ? { cuts: plan.cuts } : {}),
      ...('mask' in plan ? { mask: plan.mask } : {}),
      ...(blended?.genes ? { alpha, blend: blended.genes } : {}),
      ...(blended?.lambda !== undefined ? { lambda: blended.lambda } : {}),
      ...(permuted?.cuts ? { cuts: permuted.cuts } : {}),
      ...(permuted?.fill ? { fill: permuted.fill } : {}),
      ...(permuted?.mapping ? { mapping: permuted.mapping } : {}),
      ...(permuted?.cycles ? { cycles: permuted.cycles } : {}),
      // The event keeps its own copies, so nothing done to the returned offspring later can rewrite the record.
      children: children.map((c) => ({ ...c, chromosome: [...c.chromosome], sources: [...c.sources], ...('clamped' in c && c.clamped ? { clamped: [...c.clamped] } : {}) })),
    });
  }
  return { offspring, events };
}

type Made = { readonly chromosome: Chromosome; readonly sources: Source[]; readonly clamped: boolean[] };

const clampTo = (value: number, { lo, hi }: Bounds): number => Math.min(hi, Math.max(lo, value));
const outside = (value: number, { lo, hi }: Bounds): boolean => value < lo || value > hi;

/** BLX-α: per gene in order, one draw for each child from the parents' interval widened by α·d on each side, clamped to the bounds. */
function blend(
  a: Chromosome,
  b: Chromosome,
  alpha: number,
  bounds: readonly Bounds[],
  rng: Rng,
): { children: [Made, Made]; genes: BlendGene[]; lambda?: undefined } {
  const genes = a.map((x, g): BlendGene => {
    const y = b[g]!;
    const lo = Math.min(x, y);
    const hi = Math.max(x, y);
    const d = hi - lo;
    const from = lo - alpha * d;
    const to = hi + alpha * d;
    const draws: [number, number] = [rng.next(), rng.next()];
    const raw: [number, number] = [from + draws[0] * (to - from), from + draws[1] * (to - from)];
    return { a: x, b: y, d, from, to, draws, raw, clamped: [outside(raw[0], bounds[g]!), outside(raw[1], bounds[g]!)] };
  });
  const child = (c: 0 | 1): Made => ({
    chromosome: genes.map((gene, g) => clampTo(gene.raw[c], bounds[g]!)),
    sources: [],
    clamped: genes.map((gene) => gene.clamped[c]),
  });
  return { children: [child(0), child(1)], genes };
}

/** Whole arithmetic crossover: one draw λ for the pair; O1 = λ·A + (1 − λ)·B and O2 = (1 − λ)·A + λ·B at every gene. */
function arithmetic(
  a: Chromosome,
  b: Chromosome,
  bounds: readonly Bounds[],
  rng: Rng,
): { children: [Made, Made]; lambda: number; genes?: undefined } {
  const lambda = rng.next();
  // Between two values inside the bounds a weighted average is inside them too; clamping only guards against rounding.
  const child = (weightA: number, weightB: number): Made => {
    const raw = a.map((x, g) => weightA * x + weightB * b[g]!);
    return { chromosome: raw.map((v, g) => clampTo(v, bounds[g]!)), sources: [], clamped: raw.map((v, g) => outside(v, bounds[g]!)) };
  };
  return { children: [child(lambda, 1 - lambda), child(1 - lambda, lambda)], lambda };
}

type Permuted = {
  readonly children: [{ chromosome: Chromosome; sources: Source[] }, { chromosome: Chromosome; sources: Source[] }];
  readonly cuts?: number[];
  readonly fill?: [OrderFill, OrderFill];
  readonly mapping?: [PmxChild, PmxChild];
  readonly cycles?: number[][];
};

/**
 * The permutation operators (ADR 0007). OX and PMX draw two cuts as two-point crossover does (the first among the n − 1 gaps
 * between genes, the second among the others); CX draws nothing. Every result is a fresh array.
 */
function permute(operator: CrossoverOperator, a: Chromosome, b: Chromosome, rng: Rng): Permuted {
  if (operator === 'cx') return cycleCrossover(a, b);
  const n = a.length;
  const first = 1 + Math.floor(rng.next() * (n - 1));
  const others = Array.from({ length: n - 1 }, (_, k) => k + 1).filter((gap) => gap !== first);
  const second = others[Math.floor(rng.next() * others.length)]!;
  const [lo, hi] = first < second ? [first, second] : [second, first];
  const inSlice = (i: number) => i >= lo && i < hi;
  const sources = (sliceFrom: Source): Source[] => Array.from({ length: n }, (_, i) => (inSlice(i) ? sliceFrom : sliceFrom === 'A' ? 'B' : 'A'));
  if (operator === 'ox') {
    const one = orderChild(a, b, lo, hi);
    const two = orderChild(b, a, lo, hi);
    return { cuts: [lo, hi], fill: [one.fill, two.fill], children: [{ chromosome: one.chromosome, sources: sources('A') }, { chromosome: two.chromosome, sources: sources('B') }] };
  }
  const one = mappedChild(a, b, lo, hi);
  const two = mappedChild(b, a, lo, hi);
  return { cuts: [lo, hi], mapping: [one.info, two.info], children: [{ chromosome: one.chromosome, sources: sources('B') }, { chromosome: two.chromosome, sources: sources('A') }] };
}

/** OX: the child keeps `keeper`'s slice [lo, hi) in place and, from position hi round to the start, takes the cities it lacks in the order `other` visits them from position hi. */
function orderChild(keeper: Chromosome, other: Chromosome, lo: number, hi: number): { chromosome: Gene[]; fill: OrderFill } {
  const n = keeper.length;
  const child = Array.from({ length: n }, () => -1);
  const kept = new Set<number>();
  for (let i = lo; i < hi; i++) {
    child[i] = keeper[i]!;
    kept.add(keeper[i]!);
  }
  const cities = Array.from({ length: n }, (_, k) => other[(hi + k) % n]!).filter((city) => !kept.has(city));
  const positions = Array.from({ length: n }, (_, k) => (hi + k) % n).filter((p) => p < lo || p >= hi);
  cities.forEach((city, k) => (child[positions[k]!] = city));
  return { chromosome: child, fill: { cities, positions } };
}

/** PMX: the child takes `donor`'s slice in place and `base`'s city elsewhere, a city already in the donor's slice being replaced by following the mapping donor city → base city until it reaches a free city. */
function mappedChild(base: Chromosome, donor: Chromosome, lo: number, hi: number): { chromosome: Gene[]; info: PmxChild } {
  const mapping = new Map<number, number>();
  const pairs: { taken: number; displaced: number }[] = [];
  for (let j = lo; j < hi; j++) {
    mapping.set(donor[j]!, base[j]!);
    pairs.push({ taken: donor[j]!, displaced: base[j]! });
  }
  const child = [...base];
  for (let j = lo; j < hi; j++) child[j] = donor[j]!;
  const followed: { position: number; chain: number[]; city: number }[] = [];
  base.forEach((city, i) => {
    if (i >= lo && i < hi) return;
    if (!mapping.has(city)) return;
    const chain = [city];
    let current = city;
    while (mapping.has(current)) {
      current = mapping.get(current)!;
      chain.push(current);
    }
    child[i] = current;
    followed.push({ position: i, chain, city: current });
  });
  return { chromosome: child, info: { pairs, followed } };
}

/** CX: the positions fall into cycles (position i, then where A has the city B has at i, until it closes); the first cycle's positions come from A for O1, the second's from B, alternating; O2 is the other way round. */
function cycleCrossover(a: Chromosome, b: Chromosome): Permuted {
  const n = a.length;
  const cycleOf = Array.from({ length: n }, () => -1);
  const cycles: number[][] = [];
  for (let start = 0; start < n; start++) {
    if (cycleOf[start]! >= 0) continue;
    const positions: number[] = [];
    let i = start;
    while (cycleOf[i]! < 0) {
      cycleOf[i] = cycles.length;
      positions.push(i);
      i = a.indexOf(b[i]!);
    }
    cycles.push(positions);
  }
  const fromA = (cycle: number) => cycle % 2 === 0;
  const one: Source[] = cycleOf.map((c) => (fromA(c) ? 'A' : 'B'));
  const two: Source[] = one.map((s) => (s === 'A' ? 'B' : 'A'));
  const pick = (sources: Source[]): Gene[] => sources.map((s, i) => (s === 'A' ? a[i]! : b[i]!));
  return { cycles, children: [{ chromosome: pick(one), sources: one }, { chromosome: pick(two), sources: two }] };
}

/** Makes the operator's random draws, in the documented order, and says which genes are swapped. */
function drawSwaps(
  operator: CrossoverOperator,
  length: number,
  rng: Rng,
): { swapped: boolean[]; cuts?: number[]; mask?: boolean[] } {
  if (operator === 'one-point') {
    const cut = 1 + Math.floor(rng.next() * (length - 1));
    return { cuts: [cut], swapped: Array.from({ length }, (_, g) => g >= cut) };
  }
  if (operator === 'two-point') {
    const first = 1 + Math.floor(rng.next() * (length - 1));
    const others = Array.from({ length: length - 1 }, (_, k) => k + 1).filter((position) => position !== first);
    const second = others[Math.floor(rng.next() * others.length)]!;
    const [lo, hi] = first < second ? [first, second] : [second, first];
    return { cuts: [lo, hi], swapped: Array.from({ length }, (_, g) => g >= lo && g < hi) };
  }
  const mask = Array.from({ length }, () => rng.next() < 0.5);
  return { mask, swapped: mask };
}

/** Child 1 takes parent A's genes except where `swapped`; child 2 is the complement. Always fresh arrays. */
function makeChildren(
  a: Chromosome,
  b: Chromosome,
  swapped: readonly boolean[],
): [{ chromosome: Chromosome; sources: Source[] }, { chromosome: Chromosome; sources: Source[] }] {
  const source1: Source[] = swapped.map((s) => (s ? 'B' : 'A'));
  const source2: Source[] = swapped.map((s) => (s ? 'A' : 'B'));
  const pick = (sources: Source[]): Gene[] => sources.map((s, g) => (s === 'A' ? a[g]! : b[g]!));
  return [
    { chromosome: pick(source1), sources: source1 },
    { chromosome: pick(source2), sources: source2 },
  ];
}
