import { formatReal, type Bounds, type CrossoverConfig, type GaEvent, type MutationConfig, type Point, type RunState } from '../engine';
import { goldbergDisplay, type Display } from './format';
import type { View } from '../run';
import { num } from './format';
import { tourMutationNotes, tourPairNotes, type TourMutationNotes, type TourPairNotes } from './tour-variation';

/**
 * The data the crossover and mutation views draw, worked out from the events visible at the cursor plus the stage's
 * own configuration (so the explanation and the "switched off" state are right even before the first event).
 */
type GaView = View<RunState, GaEvent>;

/* ----------------------------------------------------------------- crossover */

export interface ChildView {
  readonly offspring: number;
  readonly bits: string;
  /** Which parent each gene came from; 'B' genes are drawn hatched. */
  readonly sources: readonly ('A' | 'B')[];
  /** The second child of the last pair when an odd number of offspring was wanted. */
  readonly discarded: boolean;
  readonly origin: 'recombined' | 'copy of A' | 'copy of B';
  /** Real-valued landscape: the 1-based genes that were clamped to a bound, and the numbers themselves (the text rounds them). */
  readonly clamped: readonly number[];
  readonly values?: readonly number[];
  /** Binary-coded landscape: the point the bits decode to, and how far it is from each parent's point (in decoded space). */
  readonly point?: Point;
  readonly moved?: { readonly fromA: number; readonly fromB: number };
}

/** What BLX-α did at one gene (see `BlendGene` in the engine), named for the screen. */
export interface BlendView {
  readonly gene: number;
  readonly name: 'x' | 'y';
  readonly a: number;
  readonly b: number;
  readonly d: number;
  readonly from: number;
  readonly to: number;
  readonly draws: readonly [number, number];
  readonly raw: readonly [number, number];
  readonly values: readonly [number, number];
  readonly clamped: readonly [boolean, boolean];
  readonly bounds: Bounds;
}

export interface PairResult {
  readonly pair: number;
  readonly revealed: boolean;
  readonly current: boolean;
  readonly parentA: { readonly id: number; readonly bits: string; readonly point?: Point; readonly values?: readonly number[] };
  readonly parentB: { readonly id: number; readonly bits: string; readonly point?: Point; readonly values?: readonly number[] };
  readonly decision?: 'recombined' | 'bypassed';
  readonly reason?: 'switched-off' | 'draw-failed';
  /** Absent when crossover is switched off, since nothing is drawn. */
  readonly draw?: { readonly u: number; readonly threshold: number };
  /** Cut positions, each the number of genes to its left. */
  readonly cuts: readonly number[];
  /** 1-based genes taken from the other parent (uniform crossover reads best this way). */
  readonly swapped: readonly number[];
  readonly secondChildDropped: boolean;
  /** BLX-α: α and one entry per gene; arithmetic: λ. Absent for the other operators and for a bypass. */
  readonly alpha?: number;
  readonly blend?: readonly BlendView[];
  readonly lambda?: number;
  /** Empty until the cursor reaches this pair. */
  readonly children: readonly ChildView[];
  /** The TSP: what the slice, the fill, the mapping, the cycles and the lengths of this pair were; absent for the other problems. */
  readonly tour?: TourPairNotes;
}

export interface CrossoverModel {
  /** True for the TSP: the chromosomes are tours, and the pairs are drawn as strips of cities. */
  readonly tour: boolean;
  /** True for a real-valued landscape: the genes are numbers, and BLX-α and arithmetic crossover exist. */
  readonly real: boolean;
  readonly enabled: boolean;
  readonly operator: CrossoverConfig['operator'];
  readonly probability: number;
  readonly explanation: string;
  readonly pairs: readonly PairResult[];
}

export function crossoverModel(view: GaView, config: CrossoverConfig, display: Display = goldbergDisplay): CrossoverModel {
  const formatBits = display.show;
  const lookup = new Map(view.before!.population.map((i) => [i.id, formatBits(i.chromosome)]));
  const arrays = new Map(view.before!.population.map((i) => [i.id, i.chromosome]));
  const land = display.landscape;
  const real = land?.representation === 'real';
  /** The point the bits of a binary-coded landscape chromosome decode to. */
  const pointOfBits = (bits: string): Point | undefined => (land && !real ? land.pointOf([...bits].map(Number)) : undefined);
  const distance = (p: Point, q: Point) => Math.hypot(p.x - q.x, p.y - q.y);
  const pairing = view.events.flatMap((e) => (e.stage === 'pairing' ? [e] : []));
  const revealed = view.events.flatMap((e) => (e.stage === 'crossover' ? [e] : []));
  const pairs = Array.from({ length: view.micros }, (_, k): PairResult => {
    const parents = pairing[k]!;
    const event = revealed[k];
    const parentA = { id: parents.parentAId, bits: lookup.get(parents.parentAId) ?? '' };
    const parentB = { id: parents.parentBId, bits: lookup.get(parents.parentBId) ?? '' };
    const pointA = pointOfBits(parentA.bits);
    const pointB = pointOfBits(parentB.bits);
    const base = {
      pair: k + 1,
      parentA: { ...parentA, ...(pointA ? { point: pointA } : {}), ...(real ? { values: arrays.get(parentA.id) } : {}) },
      parentB: { ...parentB, ...(pointB ? { point: pointB } : {}), ...(real ? { values: arrays.get(parentB.id) } : {}) },
    };
    if (!event) {
      return { ...base, revealed: false, current: false, cuts: [], swapped: [], secondChildDropped: false, children: [] };
    }
    const children = event.children.map((c, i): ChildView => {
      const bits = formatBits(c.chromosome);
      const point = pointOfBits(bits);
      return {
        offspring: c.offspring,
        bits,
        sources: c.sources,
        discarded: c.discarded,
        origin: event.decision === 'recombined' ? 'recombined' : i === 0 ? 'copy of A' : 'copy of B',
        clamped: (c.clamped ?? []).flatMap((x, g) => (x ? [g + 1] : [])),
        ...(real ? { values: c.chromosome } : {}),
        ...(point ? { point, moved: { fromA: distance(point, pointA!), fromB: distance(point, pointB!) } } : {}),
      };
    });
    const bounds = land?.bounds;
    const blend = event.blend && bounds ? event.blend.map((g, i): BlendView => ({ gene: i + 1, name: i === 0 ? 'x' : 'y', a: g.a, b: g.b, d: g.d, from: g.from, to: g.to, draws: g.draws, raw: g.raw, values: [event.children[0]!.chromosome[i]!, event.children[1]!.chromosome[i]!], clamped: g.clamped, bounds })) : undefined;
    return {
      ...base,
      revealed: true,
      current: k === revealed.length - 1,
      decision: event.decision,
      ...(event.reason ? { reason: event.reason } : {}),
      ...(event.draw ? { draw: event.draw } : {}),
      cuts: event.cuts ?? [],
      swapped: event.children[0]!.sources.flatMap((s, g) => (s === 'B' ? [g + 1] : [])),
      secondChildDropped: event.children[1]!.discarded,
      ...(event.alpha !== undefined ? { alpha: event.alpha } : {}),
      ...(blend ? { blend } : {}),
      ...(event.lambda !== undefined ? { lambda: event.lambda } : {}),
      children,
      ...(display.tour ? { tour: tourPairNotes(event, arrays.get(parents.parentAId)!, arrays.get(parents.parentBId)!, display.tour) } : {}),
    };
  });

  const operatorWords =
    config.operator === 'blx-alpha'
      ? `BLX-α (α = ${num(config.alpha ?? 0.5)}): each child gene is drawn uniformly from the parents' interval widened by α × its length on each side; values outside the bounds are clamped`
      : config.operator === 'arithmetic'
        ? 'arithmetic: one draw λ per pair; the children are λ·A + (1 − λ)·B and (1 − λ)·A + λ·B, so they always lie between the parents'
        : config.operator;
  const tourWords: Record<string, string> = {
    ox: 'OX keeps one parent’s slice in place (outlined) and fills the rest in the other parent’s order (hatched).',
    pmx: 'PMX takes one parent’s slice (hatched, outlined) and repairs repeats through the mapping between the slices (↻).',
    cx: 'CX gives whole cycles of positions to the children from alternate parents; no cut is drawn.',
  };
  const explanation = !config.enabled
    ? 'Crossover is switched off, so every pair is a bypass: the children are copies of the parents. No random number is drawn.'
    : display.tour
      ? `${tourWords[config.operator] ?? ''} One-point crossover would repeat and lose cities. One draw u per pair: recombine if u < pc (${num(config.probability)}), otherwise bypass (copies).`
      : `One draw u per pair: recombine (${operatorWords}) if u < pc (${num(config.probability)}), otherwise the pair is a bypass and its children are copies of the parents.`;
  return { tour: display.tour !== undefined, real, enabled: config.enabled, operator: config.operator, probability: config.probability, explanation, pairs };
}

/* ------------------------------------------------------------------ mutation */

export interface MutationRow {
  readonly offspring: number;
  readonly revealed: boolean;
  readonly current: boolean;
  /** The chromosome as crossover left it. */
  readonly before: string;
  readonly after?: string;
  readonly decision?: 'mutated' | 'unchanged' | 'bypassed';
  /** 1-based genes that flipped. */
  readonly flipped: readonly number[];
  /** What each flipped gene was and became; `r` is the replacement draw, recorded only for alphabets of more than 2 symbols. */
  readonly changes: readonly { readonly gene: number; readonly from: string; readonly to: string; readonly r?: number }[];
  /** Per-gene mode: one draw per gene. */
  readonly geneDraws?: readonly { readonly gene: number; readonly u: number; readonly flipped: boolean }[];
  /** Per-individual mode: the draw that decides whether this offspring mutates, and then the gene it picked. */
  readonly individualDraw?: number;
  readonly chosenGene?: { readonly gene: number; readonly r: number };
  /** Real-valued landscape: what Gaussian mutation did at each gene. */
  readonly gaussian?: { readonly sigma: number; readonly genes: readonly GaussianGeneView[] };
  /** Binary-coded landscape: where the offspring was and is in decoded space, and how far it moved. */
  readonly points?: { readonly before: Point; readonly after: Point; readonly dx: number; readonly dy: number; readonly moved: number };
  /** The TSP: the move, the draws behind it, the edges it changed and what it did to the length; absent for the other problems. */
  readonly tour?: TourMutationNotes;
}

/** One gene of a Gaussian mutation row: its decision draw (per-gene mode), and when it mutated the draws, step and clamping. */
export interface GaussianGeneView {
  readonly gene: number;
  readonly name: 'x' | 'y';
  /** Per-gene mode: this gene's draw u. Absent in per-individual mode. */
  readonly u?: number;
  readonly mutated: boolean;
  readonly range: number;
  readonly before: number;
  readonly after: number;
  readonly u1?: number;
  readonly u2?: number;
  readonly z?: number;
  readonly step?: number;
  readonly raw?: number;
  readonly clamped?: boolean;
  readonly bounds: Bounds;
}

export interface MutationModel {
  /** True for the TSP: the offspring are tours, and each draws one move. */
  readonly tour: boolean;
  /** The TSP's operator, when `tour` is true. */
  readonly tourOperator?: MutationConfig['operator'];
  /** True for a real-valued landscape: Gaussian mutation. */
  readonly real: boolean;
  /** More than two symbols per gene: a mutated gene becomes one of several others, picked by a further draw. */
  readonly multiSymbol: boolean;
  readonly enabled: boolean;
  readonly mode: MutationConfig['mode'];
  readonly threshold: number;
  readonly geneCount: number;
  readonly explanation: string;
  readonly rows: readonly MutationRow[];
}

export function mutationModel(view: GaView, config: MutationConfig, display: Display = goldbergDisplay): MutationModel {
  const formatBits = display.show;
  const land = display.landscape;
  const real = land?.representation === 'real';
  const bounds = land?.bounds;
  const pointOfBits = (bits: string): Point | undefined => (land && !real ? land.pointOf([...bits].map(Number)) : undefined);
  const made = view.events.flatMap((e) => (e.stage === 'crossover' ? e.children.filter((c) => !c.discarded) : []));
  const revealed = view.events.flatMap((e) => (e.stage === 'mutation' ? [e] : []));
  const rows = Array.from({ length: view.micros }, (_, k): MutationRow => {
    const event = revealed[k];
    if (!event) return { offspring: made[k]!.offspring, revealed: false, current: false, before: formatBits(made[k]!.chromosome), flipped: [], changes: [] };
    const before = formatBits(event.before);
    const after = formatBits(event.after);
    const gaussian =
      real && bounds
        ? {
            sigma: event.sigma ?? 0.05,
            genes: event.before.map((value, i): GaussianGeneView => {
              const gene = i + 1;
              const draw = event.geneDraws?.find((d) => d.gene === gene);
              const step = event.gaussian?.find((s) => s.gene === gene);
              return {
                gene,
                name: i === 0 ? 'x' : 'y',
                ...(draw ? { u: draw.u } : {}),
                mutated: step !== undefined,
                range: bounds.hi - bounds.lo,
                before: value,
                after: event.after[i]!,
                ...(step ? { u1: step.u1, u2: step.u2, z: step.z, step: step.step, raw: step.raw, clamped: step.clamped } : {}),
                bounds,
              };
            }),
          }
        : undefined;
    const pointBefore = pointOfBits(before);
    const pointAfter = pointOfBits(after);
    const points = pointBefore && pointAfter ? { before: pointBefore, after: pointAfter, dx: pointAfter.x - pointBefore.x, dy: pointAfter.y - pointBefore.y, moved: Math.hypot(pointAfter.x - pointBefore.x, pointAfter.y - pointBefore.y) } : undefined;
    return {
      offspring: event.offspring,
      revealed: true,
      current: k === revealed.length - 1,
      before,
      after,
      decision: event.decision,
      flipped: event.flipped,
      changes: event.flipped.map((gene) => {
        const r = event.replacements?.find((x) => x.gene === gene)?.r;
        return { gene, from: before[gene - 1]!, to: after[gene - 1]!, ...(r !== undefined ? { r } : {}) };
      }),
      ...(event.geneDraws ? { geneDraws: event.geneDraws } : {}),
      ...(event.individualDraw ? { individualDraw: event.individualDraw.u } : {}),
      ...(event.chosenGene ? { chosenGene: event.chosenGene } : {}),
      ...(gaussian ? { gaussian } : {}),
      ...(points ? { points } : {}),
      ...(display.tour ? { tour: tourMutationNotes(event, display.tour) } : {}),
    };
  });

  const pm = num(config.probability);
  const multiSymbol = display.alphabetSize > 2;
  // with more than two symbols a gene that flips needs a new symbol, chosen by one further draw r
  const replacement = multiSymbol
    ? ` A gene that flips becomes a different symbol: one more draw r picks it from the other ${display.alphabetSize - 1}, in alphabet order.`
    : '';
  const sigma = num(config.sigma ?? 0.05);
  const gaussianWords = ` A gene that mutates moves by σ × its range × z (σ = ${sigma}), z a normal draw made from two further uniform draws (Box–Muller); values outside the bounds are clamped.`;
  const tourWords: Record<string, string> = {
    swap: 'Swap: two positions are drawn and their cities exchange places. At most four edges change.',
    inversion: 'Inversion (a 2-opt move): two positions are drawn and the slice between them is reversed. At most two edges change.',
    insertion: 'Insertion: a city is taken out and put back at another position, the cities between moving up by one. At most three edges change.',
  };
  const explanation = !config.enabled
    ? 'Mutation is switched off, so every offspring passes through unchanged. No random number is drawn.'
    : display.tour
      ? `${tourWords[config.operator ?? 'inversion'] ?? ''} The probability pm (${pm}) is per individual, not per city: one draw u decides whether this tour is mutated at all, then the positions are drawn. A permutation has no independent genes to flip.`
      : config.mode === 'per-gene'
      ? `${real ? 'Gaussian mutation: every' : 'Every'} gene of every offspring gets its own draw u; the gene ${real ? 'mutates' : 'flips'} if u < pm (${pm}).${real ? gaussianWords : replacement}`
      : `${real ? 'Gaussian mutation: each' : 'Each'} offspring gets one draw u. If u < pm (${pm}) it is mutated, and one more draw picks the single gene that ${real ? 'mutates' : 'flips'}.${real ? gaussianWords : replacement}`;
  return {
    tour: display.tour !== undefined,
    ...(display.tour ? { tourOperator: config.operator } : {}),
    real,
    multiSymbol,
    enabled: config.enabled,
    mode: config.mode,
    threshold: config.probability,
    geneCount: real ? (rows[0]?.gaussian?.genes.length ?? 2) : (rows[0]?.before.length ?? 0),
    explanation,
    rows,
  };
}
