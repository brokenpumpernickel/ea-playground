import type { Bit, Chromosome } from './chromosome';
import type { Individual } from './initialize';
import type { Pair } from './pairing';
import type { Rng } from './rng';

export type CrossoverOperator = 'one-point' | 'two-point' | 'uniform';

export interface CrossoverConfig {
  readonly enabled: boolean;
  readonly operator: CrossoverOperator;
  /** Applies per pair: one draw u decides recombine (u < probability) or bypass. */
  readonly probability: number;
}

/** Which parent a gene came from: A is the pair's first parent, B its second. */
export type Source = 'A' | 'B';

export interface Child {
  /** Numbered from 1 across the generation: pair k makes offspring 2k − 1 and 2k. */
  readonly offspring: number;
  readonly pair: number;
  readonly chromosome: Chromosome;
  readonly sources: readonly Source[];
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
  readonly children: readonly (Child & { readonly discarded: boolean })[];
}

const minimumGenes: Record<CrossoverOperator, number> = { 'one-point': 2, 'two-point': 3, uniform: 1 };
const operatorName: Record<CrossoverOperator, string> = { 'one-point': 'One-point', 'two-point': 'Two-point', uniform: 'Uniform' };

export function crossover(
  population: readonly Individual[],
  pairs: readonly Pair[],
  config: CrossoverConfig,
  rng: Rng,
): { offspring: Child[]; events: CrossoverEvent[] } {
  if (!(config.probability >= 0 && config.probability <= 1)) throw new Error('Crossover probability must be between 0 and 1');
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
    const plan = recombine ? drawSwaps(config.operator, a.length, rng) : { swapped: a.map(() => false) };
    const { swapped } = plan;
    const [first, second] = makeChildren(a, b, swapped);
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
      children,
    });
  }
  return { offspring, events };
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
  const pick = (sources: Source[]): Bit[] => sources.map((s, g) => (s === 'A' ? a[g]! : b[g]!));
  return [
    { chromosome: pick(source1), sources: source1 },
    { chromosome: pick(source2), sources: source2 },
  ];
}
