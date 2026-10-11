import type { Chromosome, Gene } from './chromosome';
import type { Rng } from '../run/rng';

export type MutationMode = 'per-gene' | 'per-individual';

export interface MutationConfig {
  readonly enabled: boolean;
  readonly mode: MutationMode;
  /** Per gene: the chance each gene flips. Compared with a draw u: the operation happens when u < probability. */
  readonly probability: number;
}

export interface MutationInput {
  /** The offspring's number within the generation (as in crossover). */
  readonly offspring: number;
  readonly chromosome: Chromosome;
}

export interface Mutated {
  readonly offspring: number;
  readonly chromosome: Chromosome;
  /** 1-based positions of the genes that flipped. */
  readonly flipped: readonly number[];
}

export interface MutationEvent {
  readonly stage: 'mutation';
  readonly kind: 'individual';
  readonly offspring: number;
  readonly mode: MutationMode;
  /** `unchanged`: the operator ran and nothing flipped. `bypassed`: the operator was switched off, so it did not run. */
  readonly decision: 'mutated' | 'unchanged' | 'bypassed';
  readonly reason?: 'switched-off';
  readonly threshold: number;
  readonly before: Chromosome;
  readonly after: Chromosome;
  readonly flipped: readonly number[];
  /** Per-gene mode: one draw per gene, in gene order. */
  readonly geneDraws?: readonly { readonly gene: number; readonly u: number; readonly flipped: boolean }[];
  /** Per-individual mode: the draw that decides whether this offspring is mutated at all. */
  readonly individualDraw?: { readonly u: number };
  /** Per-individual mode, when mutated: the single gene chosen to flip, from the draw r. */
  readonly chosenGene?: { readonly gene: number; readonly r: number };
  /**
   * Only for alphabets of more than 2 symbols: for each changed gene, in gene order, the draw r that picked its new
   * symbol among the other symbols, and the old and new gene. (With 2 symbols the new gene is forced, nothing is drawn
   * and nothing is recorded here; `before` and `after` already say it.)
   */
  readonly replacements?: readonly { readonly gene: number; readonly r: number; readonly from: number; readonly to: number }[];
}

export function mutate(
  offspring: readonly MutationInput[],
  config: MutationConfig,
  rng: Rng,
  /** How many symbols a gene can take. With 2 the replacement is forced and costs no draw; with more, one draw per changed gene. */
  alphabetSize = 2,
): { mutated: Mutated[]; events: MutationEvent[] } {
  if (!(config.probability >= 0 && config.probability <= 1)) throw new Error('Mutation probability must be between 0 and 1');
  if (!Number.isInteger(alphabetSize) || alphabetSize < 2) throw new Error('A gene needs an alphabet of at least 2 symbols to be mutated');
  const mutated: Mutated[] = [];
  const events: MutationEvent[] = [];
  for (const input of offspring) {
    // A switched-off mutation draws nothing at all.
    const draws = !config.enabled
      ? { flipped: [] as number[], record: {} }
      : config.mode === 'per-gene'
        ? drawPerGene(input.chromosome, config, rng)
        : drawPerIndividual(input.chromosome, config, rng);
    const replaced = replaceGenes(input.chromosome, draws.flipped, alphabetSize, rng);
    const after = replaced.after;
    mutated.push({ offspring: input.offspring, chromosome: after, flipped: draws.flipped });
    events.push({
      stage: 'mutation',
      kind: 'individual',
      offspring: input.offspring,
      mode: config.mode,
      decision: !config.enabled ? 'bypassed' : draws.flipped.length > 0 ? 'mutated' : 'unchanged',
      ...(config.enabled ? {} : { reason: 'switched-off' as const }),
      threshold: config.probability,
      // The events keep their own copies, so nothing done to the inputs or outputs later can rewrite the record.
      before: [...input.chromosome],
      after: [...after],
      flipped: draws.flipped,
      ...draws.record,
      ...(replaced.draws.length > 0 ? { replacements: replaced.draws } : {}),
    });
  }
  return { mutated, events };
}

/** One draw per gene, in gene order, always all of them. */
function drawPerGene(chromosome: Chromosome, config: MutationConfig, rng: Rng) {
  const geneDraws = chromosome.map((_, k) => {
    const u = rng.next();
    return { gene: k + 1, u, flipped: u < config.probability };
  });
  return { flipped: geneDraws.filter((d) => d.flipped).map((d) => d.gene), record: { geneDraws } };
}

/** One draw u for the whole offspring; only when u < probability, one more draw picks the single gene that flips. */
function drawPerIndividual(chromosome: Chromosome, config: MutationConfig, rng: Rng) {
  const u = rng.next();
  if (!(u < config.probability)) return { flipped: [] as number[], record: { individualDraw: { u } } };
  const r = rng.next();
  const gene = 1 + Math.floor(r * chromosome.length);
  return { flipped: [gene], record: { individualDraw: { u }, chosenGene: { gene, r } } };
}

/**
 * Gives every changed gene (1-based, in order) a different symbol. With 2 symbols that is the other one and nothing is
 * drawn. With more, one draw r per gene picks the ⌊r·(k − 1)⌋-th of the other symbols, in alphabet order.
 */
function replaceGenes(chromosome: Chromosome, changed: readonly number[], k: number, rng: Rng) {
  const draws: { gene: number; r: number; from: number; to: number }[] = [];
  const after: Gene[] = [...chromosome];
  for (const gene of changed) {
    const from = chromosome[gene - 1]!;
    if (k === 2) {
      after[gene - 1] = from === 0 ? 1 : 0;
      continue;
    }
    const r = rng.next();
    const pick = Math.floor(r * (k - 1));
    const to = pick < from ? pick : pick + 1; // skip the symbol the gene has now
    after[gene - 1] = to;
    draws.push({ gene, r, from, to });
  }
  return { after, draws };
}
