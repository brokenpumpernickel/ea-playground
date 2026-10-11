import type { CrossoverConfig, GaEvent, MutationConfig, RunState } from '../engine';
import { goldbergDisplay, type Display } from './format';
import type { View } from '../run';
import { num } from './format';

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
}

export interface PairResult {
  readonly pair: number;
  readonly revealed: boolean;
  readonly current: boolean;
  readonly parentA: { readonly id: number; readonly bits: string };
  readonly parentB: { readonly id: number; readonly bits: string };
  readonly decision?: 'recombined' | 'bypassed';
  readonly reason?: 'switched-off' | 'draw-failed';
  /** Absent when crossover is switched off, since nothing is drawn. */
  readonly draw?: { readonly u: number; readonly threshold: number };
  /** Cut positions, each the number of genes to its left. */
  readonly cuts: readonly number[];
  /** 1-based genes taken from the other parent (uniform crossover reads best this way). */
  readonly swapped: readonly number[];
  readonly secondChildDropped: boolean;
  /** Empty until the cursor reaches this pair. */
  readonly children: readonly ChildView[];
}

export interface CrossoverModel {
  readonly enabled: boolean;
  readonly operator: CrossoverConfig['operator'];
  readonly probability: number;
  readonly explanation: string;
  readonly pairs: readonly PairResult[];
}

export function crossoverModel(view: GaView, config: CrossoverConfig, display: Display = goldbergDisplay): CrossoverModel {
  const formatBits = display.show;
  const lookup = new Map(view.before!.population.map((i) => [i.id, formatBits(i.chromosome)]));
  const pairing = view.events.flatMap((e) => (e.stage === 'pairing' ? [e] : []));
  const revealed = view.events.flatMap((e) => (e.stage === 'crossover' ? [e] : []));
  const pairs = Array.from({ length: view.micros }, (_, k): PairResult => {
    const parents = pairing[k]!;
    const event = revealed[k];
    const base = {
      pair: k + 1,
      parentA: { id: parents.parentAId, bits: lookup.get(parents.parentAId) ?? '' },
      parentB: { id: parents.parentBId, bits: lookup.get(parents.parentBId) ?? '' },
    };
    if (!event) {
      return { ...base, revealed: false, current: false, cuts: [], swapped: [], secondChildDropped: false, children: [] };
    }
    const children = event.children.map((c, i): ChildView => ({
      offspring: c.offspring,
      bits: formatBits(c.chromosome),
      sources: c.sources,
      discarded: c.discarded,
      origin: event.decision === 'recombined' ? 'recombined' : i === 0 ? 'copy of A' : 'copy of B',
    }));
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
      children,
    };
  });

  const explanation = config.enabled
    ? `One draw u per pair: recombine (${config.operator}) if u < pc (${num(config.probability)}), otherwise the pair is a bypass and its children are copies of the parents.`
    : 'Crossover is switched off, so every pair is a bypass: the children are copies of the parents. No random number is drawn.';
  return { enabled: config.enabled, operator: config.operator, probability: config.probability, explanation, pairs };
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
}

export interface MutationModel {
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
  const made = view.events.flatMap((e) => (e.stage === 'crossover' ? e.children.filter((c) => !c.discarded) : []));
  const revealed = view.events.flatMap((e) => (e.stage === 'mutation' ? [e] : []));
  const rows = Array.from({ length: view.micros }, (_, k): MutationRow => {
    const event = revealed[k];
    if (!event) return { offspring: made[k]!.offspring, revealed: false, current: false, before: formatBits(made[k]!.chromosome), flipped: [], changes: [] };
    const before = formatBits(event.before);
    const after = formatBits(event.after);
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
    };
  });

  const pm = num(config.probability);
  const multiSymbol = display.alphabetSize > 2;
  // with more than two symbols a gene that flips needs a new symbol, chosen by one further draw r
  const replacement = multiSymbol
    ? ` A gene that flips becomes a different symbol: one more draw r picks it from the other ${display.alphabetSize - 1}, in alphabet order.`
    : '';
  const explanation = !config.enabled
    ? 'Mutation is switched off, so every offspring passes through unchanged. No random number is drawn.'
    : config.mode === 'per-gene'
      ? `Every gene of every offspring gets its own draw u; the gene flips if u < pm (${pm}).${replacement}`
      : `Each offspring gets one draw u. If u < pm (${pm}) it is mutated, and one more draw picks the single gene that flips.${replacement}`;
  return {
    multiSymbol,
    enabled: config.enabled,
    mode: config.mode,
    threshold: config.probability,
    geneCount: rows[0]?.before.length ?? 0,
    explanation,
    rows,
  };
}
