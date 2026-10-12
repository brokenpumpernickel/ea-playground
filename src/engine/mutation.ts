import type { Chromosome, Gene } from './chromosome';
import type { Bounds } from './problem';
import type { Rng } from '../run/rng';

export type MutationMode = 'per-gene' | 'per-individual';

/** Flip (or replace) changes a symbol of an alphabet; Gaussian adds a normal step to a real number (ADR 0006). */
export type MutationOperator = 'flip' | 'gaussian';

/** The default σ of Gaussian mutation: the standard deviation of a step as a share of the gene's range. */
export const defaultSigma = 0.05;

export interface MutationConfig {
  readonly enabled: boolean;
  readonly mode: MutationMode;
  /** Per gene: the chance each gene flips. Compared with a draw u: the operation happens when u < probability. */
  readonly probability: number;
  /** Absent means the representation's operator: flip for symbols, Gaussian for real genes. Naming the wrong one is refused. */
  readonly operator?: MutationOperator;
  /** Gaussian only: σ, greater than 0, default `defaultSigma`. */
  readonly sigma?: number;
}

/**
 * What Gaussian mutation did to one gene. Box–Muller, in this order: u1 then u2 are drawn, z = √(−2 ln(1 − u1)) · cos(2π u2)
 * (1 − u1 so that u1 = 0 gives z = 0 rather than an infinity; the second value of the pair is not kept), the step is
 * σ · range · z, the raw value is before + step, and `after` is the raw value clamped to the gene's bounds.
 */
export interface GaussianStep {
  readonly gene: number;
  readonly u1: number;
  readonly u2: number;
  readonly z: number;
  readonly range: number;
  readonly step: number;
  readonly before: number;
  readonly raw: number;
  readonly after: number;
  readonly clamped: boolean;
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
  /**
   * Gaussian mutation: σ, and, only when some gene mutated, one step per mutating gene in gene order. Draw order: the
   * decision draws exactly as for symbols (one per gene, or u then r), then u1 and u2 for each mutating gene in order.
   * `flipped` lists the genes that were chosen to mutate, even when clamping left the value where it was.
   */
  readonly sigma?: number;
  readonly gaussian?: readonly GaussianStep[];
}

export function mutate(
  offspring: readonly MutationInput[],
  config: MutationConfig,
  rng: Rng,
  /** How many symbols a gene can take. With 2 the replacement is forced and costs no draw; with more, one draw per changed gene. */
  alphabetSize = 2,
  /** The bounds of a real-valued problem's genes; with them the mutation is Gaussian, without them it is flip/replace. */
  bounds?: readonly Bounds[],
): { mutated: Mutated[]; events: MutationEvent[] } {
  if (!(config.probability >= 0 && config.probability <= 1)) throw new Error('Mutation probability must be between 0 and 1');
  const operator = config.operator ?? (bounds ? 'gaussian' : 'flip');
  if (operator === 'gaussian' && !bounds) throw new Error('Gaussian mutation is for real-valued chromosomes; use flip mutation for this problem');
  if (operator === 'flip' && bounds) throw new Error('Flip mutation is for symbol chromosomes; use Gaussian mutation for a real-valued problem');
  const sigma = config.sigma ?? defaultSigma;
  if (bounds && !(sigma > 0 && Number.isFinite(sigma))) throw new Error('σ must be a number greater than 0');
  if (!bounds && (!Number.isInteger(alphabetSize) || alphabetSize < 2)) throw new Error('A gene needs an alphabet of at least 2 symbols to be mutated');
  const mutated: Mutated[] = [];
  const events: MutationEvent[] = [];
  for (const input of offspring) {
    // A switched-off mutation draws nothing at all.
    const draws = !config.enabled
      ? { flipped: [] as number[], record: {} }
      : config.mode === 'per-gene'
        ? drawPerGene(input.chromosome, config, rng)
        : drawPerIndividual(input.chromosome, config, rng);
    const replaced = bounds ? gaussianSteps(input.chromosome, draws.flipped, sigma, bounds, rng) : replaceGenes(input.chromosome, draws.flipped, alphabetSize, rng);
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
      ...('draws' in replaced && replaced.draws.length > 0 ? { replacements: replaced.draws } : {}),
      ...('steps' in replaced ? { sigma, ...(replaced.steps.length > 0 ? { gaussian: replaced.steps } : {}) } : {}),
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

/** Gives every mutating gene (1-based, in order) a normal step of σ × its range × z, clamped to its bounds; two draws per gene. */
function gaussianSteps(chromosome: Chromosome, changed: readonly number[], sigma: number, bounds: readonly Bounds[], rng: Rng) {
  const steps: GaussianStep[] = [];
  const after: Gene[] = [...chromosome];
  for (const gene of changed) {
    const { lo, hi } = bounds[gene - 1]!;
    const before = chromosome[gene - 1]!;
    const u1 = rng.next();
    const u2 = rng.next();
    const z = Math.sqrt(-2 * Math.log(1 - u1)) * Math.cos(2 * Math.PI * u2);
    const range = hi - lo;
    const step = sigma * range * z;
    const raw = before + step;
    const value = Math.min(hi, Math.max(lo, raw));
    after[gene - 1] = value;
    steps.push({ gene, u1, u2, z, range, step, before, raw, after: value, clamped: raw < lo || raw > hi });
  }
  return { after, steps };
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
