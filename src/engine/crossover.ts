import type { Chromosome, Gene } from './chromosome';
import type { Individual } from './initialize';
import type { Pair } from './pairing';
import type { Bounds } from './problem';
import type { Rng } from '../run/rng';

/**
 * One-point, two-point and uniform are discrete recombination and work on any representation; BLX-α and arithmetic
 * crossover blend numbers and exist only for real-valued chromosomes (ADR 0006).
 */
export type CrossoverOperator = 'one-point' | 'two-point' | 'uniform' | 'blx-alpha' | 'arithmetic';

/** The operators that need real-valued genes. */
export const realOnlyOperators: readonly CrossoverOperator[] = ['blx-alpha', 'arithmetic'];

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
  /** One-point and two-point: each cut is the number of genes to its left, sorted. Two-point swaps the genes between them. */
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
  readonly children: readonly (Child & { readonly discarded: boolean })[];
}

/** The fewest genes an operator can work on: one cut needs two genes, two cuts three. */
export const minimumGenes: Record<CrossoverOperator, number> = { 'one-point': 2, 'two-point': 3, uniform: 1, 'blx-alpha': 1, arithmetic: 1 };
export const operatorName: Record<CrossoverOperator, string> = {
  'one-point': 'One-point',
  'two-point': 'Two-point',
  uniform: 'Uniform',
  'blx-alpha': 'BLX-α',
  arithmetic: 'Arithmetic',
};

export function crossover(
  population: readonly Individual[],
  pairs: readonly Pair[],
  config: CrossoverConfig,
  rng: Rng,
  /** The bounds of a real-valued problem's genes; absent for the symbol problems, which refuse the real-only operators. */
  bounds?: readonly Bounds[],
): { offspring: Child[]; events: CrossoverEvent[] } {
  if (!(config.probability >= 0 && config.probability <= 1)) throw new Error('Crossover probability must be between 0 and 1');
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
    const plan = recombine && !blended ? drawSwaps(config.operator, a.length, rng) : { swapped: a.map(() => false) };
    const { swapped } = plan;
    const [first, second] = blended ? blended.children : makeChildren(a, b, swapped);
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
