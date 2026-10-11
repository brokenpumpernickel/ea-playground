import { isKnapsackOptions, isStringOptions, isTrapOptions, type ProblemEntry, type ProblemOptions } from './problems';
import { describeAlphabet, handlings, minimumGenes, operatorName, optimalBag, parseGenes, validateKnapsack, validateTrap, type Handling, type KnapsackOptions, type Linkage, type TrapOptions, transformWeights, weightSteps, type GaParams, type GaSetup, type Problem, type StepName, type StepSpec } from '../engine';

/**
 * What the parameter drawer edits. Numbers are kept as the text the user typed, so a half-typed or wrong entry can be
 * explained instead of silently becoming NaN. `validate` says what is wrong; `toParams` / `toSetup` turn a valid draft
 * into what the run layer takes; `changes` says which edits are operator parameters (pending until the next generation
 * boundary) and which need a reset.
 */
export interface ChainStepDraft {
  step: StepName;
  /** One entry per parameter of the step, by key. */
  params: Record<string, string>;
}

export interface Draft {
  init: 'random' | 'explicit';
  size: string;
  /** Hand-edited chromosomes: one per line, or separated by spaces or commas. */
  chromosomes: string;
  seed: string;
  /** The problem's own options as typed (the string problem's alphabet and target); absent for problems without any. */
  options?: { alphabet: string; target: string };
  /** The knapsack's options as typed (every number as text, so a half-typed one can be explained); absent for the other problems. */
  knapsack?: { items: { weight: string; value: string }[]; capacity: string; handling: Handling; rho: string };
  /** The trap's options as typed (block size and number of blocks as text); absent for the other problems. */
  trap?: { blockSize: string; blocks: string; linkage: Linkage };
  method: 'roulette' | 'tournament';
  tournamentSize: string;
  chain: ChainStepDraft[];
  crossover: { enabled: boolean; operator: GaParams['crossover']['operator']; probability: string };
  mutation: { enabled: boolean; mode: GaParams['mutation']['mode']; probability: string };
  elites: string;
  truncation: { enabled: boolean; lambda: string };
  stop: {
    generationLimit: string;
    target: { enabled: boolean; value: string };
    stagnation: { enabled: boolean; window: string };
  };
}

export type Field =
  | 'size'
  | 'chromosomes'
  | 'seed'
  | 'alphabet'
  | 'target'
  | 'items'
  | 'capacity'
  | 'handling'
  | 'rho'
  | 'blockSize'
  | 'blocks'
  | 'linkage'
  | 'genes'
  | 'tournamentSize'
  | 'chain'
  | 'crossover.operator'
  | 'crossover.probability'
  | 'mutation.probability'
  | 'elites'
  | 'truncation.lambda'
  | 'stop.generationLimit'
  | 'stop.target'
  | 'stop.stagnation';

export interface Validation {
  readonly errors: Partial<Record<Field, string>>;
  /** When the chain is invalid and a step is to blame (0-based), so the editor can mark it. */
  readonly chainStep?: number;
}

export const defaultStep = (step: StepName): ChainStepDraft => ({
  step,
  params: Object.fromEntries(weightSteps[step].parameters.map((p) => [p.key, String(p.default)])),
});

const textOf = (v: number | undefined, fallback: number): string => String(v ?? fallback);

export function draftOf(params: GaParams, setup: GaSetup, seed: number, options?: ProblemOptions): Draft {
  const selection = params.selection;
  return {
    init: setup.init.kind,
    size: setup.init.kind === 'random' ? String(setup.init.size) : String(setup.init.chromosomes.length),
    chromosomes: setup.init.kind === 'explicit' ? setup.init.chromosomes.join('\n') : '',
    seed: String(seed),
    ...(options && isStringOptions(options) ? { options: { alphabet: options.alphabet, target: options.target } } : {}),
    ...(options && isKnapsackOptions(options)
      ? {
          knapsack: {
            items: options.items.map((item) => ({ weight: String(item.weight), value: String(item.value) })),
            capacity: String(options.capacity),
            handling: options.handling,
            rho: String(options.rho),
          },
        }
      : {}),
    ...(options && isTrapOptions(options) ? { trap: { blockSize: String(options.blockSize), blocks: String(options.blocks), linkage: options.linkage } } : {}),
    method: selection.method,
    tournamentSize: selection.method === 'tournament' ? String(selection.size) : '2',
    chain:
      selection.method === 'roulette'
        ? selection.chain.map((spec): ChainStepDraft => {
            const { step, ...given } = spec;
            const base = defaultStep(step);
            for (const [key, value] of Object.entries(given)) if (value !== undefined) base.params[key] = String(value);
            return base;
          })
        : [defaultStep('identity')],
    crossover: { enabled: params.crossover.enabled, operator: params.crossover.operator, probability: String(params.crossover.probability) },
    mutation: { enabled: params.mutation.enabled, mode: params.mutation.mode, probability: String(params.mutation.probability) },
    elites: String(params.elites),
    truncation: { enabled: params.truncation?.enabled ?? false, lambda: textOf(params.truncation?.lambda, setup.init.kind === 'random' ? setup.init.size : setup.init.chromosomes.length) },
    stop: {
      generationLimit: String(params.stop.generationLimit),
      target: { enabled: params.stop.targetFitness !== undefined, value: textOf(params.stop.targetFitness, 0) },
      stagnation: { enabled: params.stop.stagnationWindow !== undefined, window: textOf(params.stop.stagnationWindow, 10) },
    },
  };
}

/** A number typed by the user, or undefined when the text is not one. */
export function numberOf(text: string): number | undefined {
  const trimmed = text.trim();
  if (trimmed === '') return undefined;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : undefined;
}
const isWhole = (v: number | undefined, min: number): v is number => v !== undefined && Number.isInteger(v) && v >= min;

/* ------------------------------------------------------- hand-edited population */

export interface ChromosomeRow {
  readonly text: string;
  readonly error?: string;
  readonly decoded?: number | string;
  readonly fitness?: number;
  /** The problem's table columns for this chromosome, in order (Goldberg: x, fitness). */
  readonly cells?: readonly string[];
  readonly meters?: readonly ({ readonly value: number; readonly limit: number } | undefined)[];
}

/**
 * Splits typed text into chromosomes. A new line always separates them; a space, comma, semicolon or tab does too,
 * unless that character is a symbol of the alphabet (a string over letters and a space is typed one per line).
 */
export function chromosomePieces(text: string, problem: Problem): string[] {
  const separators = new Set(['\r', '\n', ';', ',', ' ', '\t']);
  for (const symbol of problem.alphabet) if (symbol !== '\n' && symbol !== '\r') separators.delete(symbol);
  return text.split('').reduce<string[]>(
    (pieces, char) => {
      if (separators.has(char)) pieces.push('');
      else pieces[pieces.length - 1] += char;
      return pieces;
    },
    [''],
  ).filter((piece) => piece !== '');
}

/** Splits the text into chromosomes and, for each, either what it decodes to or what is wrong with it. */
export function parseChromosomes(text: string, problem: Problem): ChromosomeRow[] {
  return chromosomePieces(text, problem).map((piece, k): ChromosomeRow => {
    const genes = parseGenes(piece, problem.alphabet);
    if (!genes) return { text: piece, error: `Chromosome ${k + 1} ("${piece}") may only contain the characters ${describeAlphabet(problem.alphabet)}.` };
    if (genes.length !== problem.chromosomeLength) {
      return { text: piece, error: `Chromosome ${k + 1} has ${genes.length} genes, but this problem needs ${problem.chromosomeLength}.` };
    }
    const scores = problem.evaluate(genes);
    return { text: piece, decoded: scores.decoded, fitness: scores.fitness, cells: problem.columns.map((column) => column.show(scores)), ...(problem.columns.some((c) => c.meter) ? { meters: problem.columns.map((column) => column.meter?.(scores)) } : {}) };
  });
}

/* ------------------------------------------------------------------ validation */

/** A chromosome of this problem, for the hint under an empty hand-edited population. */
const exampleChromosome = (problem: Problem): string => (problem.alphabet.length === 2 ? '01101' : [...Array(problem.chromosomeLength)].map((_, k) => problem.alphabet[k % problem.alphabet.length]).join(''));

/**
 * The problem the draft describes: the entry's problem built from the typed options, or `current` when there are none
 * or they are not valid (the messages then say why, and nothing is built from them).
 */
export function problemOf(draft: Draft, entry: Pick<ProblemEntry, 'validateOptions' | 'create'>, current: Problem): Problem {
  const options = optionsOf(draft);
  if (!options || entry.validateOptions(options).length > 0) return current;
  return entry.create(options);
}

/** The problem options the draft describes, with every typed number read (text that is not a number becomes NaN, which validation explains). */
export function optionsOf(draft: Draft): ProblemOptions | undefined {
  if (draft.options) return { alphabet: draft.options.alphabet, target: draft.options.target };
  if (draft.knapsack) {
    const k = draft.knapsack;
    const read = (text: string) => numberOf(text) ?? Number.NaN;
    return { items: k.items.map((item) => ({ weight: read(item.weight), value: read(item.value) })), capacity: read(k.capacity), handling: k.handling, rho: read(k.rho) };
  }
  if (draft.trap) {
    const read = (text: string) => numberOf(text) ?? Number.NaN;
    return { blockSize: read(draft.trap.blockSize), blocks: read(draft.trap.blocks), linkage: draft.trap.linkage };
  }
  return undefined;
}

/** The best fitness the problem of the draft can have, when the draft's options are valid and the problem knows it. */
export function optimumOf(draft: Draft): number | undefined {
  const options = optionsOf(draft);
  if (!options) return undefined;
  if (isStringOptions(options)) return [...options.target].length;
  if (isTrapOptions(options)) return validateTrap(options).length > 0 ? undefined : options.blockSize * options.blocks;
  if (validateKnapsack(options).length > 0) return undefined;
  return optimalBag({ items: options.items, capacity: options.capacity }).value;
}

/** The drawer fields that hold a problem's own options (each problem uses its own few). */
const optionFields = ['alphabet', 'target', 'items', 'capacity', 'handling', 'rho', 'blockSize', 'blocks', 'linkage', 'genes'] as const;

/**
 * `sampleFitness` is the fitness of the population the chain will next be applied to, so its messages are real.
 * `problem` is the one the draft describes (see `problemOf`); `entry` is needed to check typed options.
 */
export function validate(draft: Draft, problem: Problem, sampleFitness: readonly number[], entry?: Pick<ProblemEntry, 'validateOptionFields'>): Validation {
  const errors: Partial<Record<Field, string>> = {};

  // the problem's own options (a string problem's alphabet and target, the knapsack's instance and handling)
  const typed = optionsOf(draft);
  if (typed && entry) {
    const found = entry.validateOptionFields(typed);
    for (const field of optionFields) if (found[field]?.length) errors[field] = found[field]!.join(' ');
  }
  const optionsValid = optionFields.every((field) => errors[field] === undefined);

  // run setup
  const seed = numberOf(draft.seed);
  if (seed === undefined || !Number.isInteger(seed) || seed < 0 || seed > 4294967295) errors.seed = 'The seed must be a whole number from 0 to 4294967295.';
  let size: number | undefined;
  if (draft.init === 'random') {
    size = numberOf(draft.size);
    if (!isWhole(size, 1)) errors.size = 'The population size must be a whole number of at least 1.';
  } else {
    const rows = parseChromosomes(draft.chromosomes, problem);
    size = rows.length;
    const bad = rows.find((r) => r.error);
    // while the alphabet or target is wrong the strings cannot be checked against them
    if (rows.length === 0) errors.chromosomes = `Type at least one chromosome, for example ${exampleChromosome(problem)}.`;
    else if (bad && optionsValid) errors.chromosomes = bad.error!;
  }

  // selection
  let chainStep: number | undefined;
  if (draft.method === 'tournament') {
    if (!isWhole(numberOf(draft.tournamentSize), 1)) errors.tournamentSize = 'The tournament size must be a whole number of at least 1.';
  } else {
    const chain = chainOf(draft.chain);
    if (typeof chain === 'string') errors.chain = chain;
    else if (sampleFitness.length > 0) {
      const result = transformWeights(sampleFitness, chain);
      if (!result.ok) {
        errors.chain = result.problem;
        chainStep = result.stepIndex;
      }
    }
  }

  // operators
  const needed = minimumGenes[draft.crossover.operator];
  if (draft.crossover.enabled && problem.chromosomeLength < needed) {
    errors['crossover.operator'] = `${operatorName[draft.crossover.operator]} crossover needs chromosomes of at least ${needed} genes, but this problem's have ${problem.chromosomeLength}. Choose another crossover type${draft.options ? ', switch crossover off or make the target longer' : ' or switch crossover off'}.`;
  }
  const pc = numberOf(draft.crossover.probability);
  if (pc === undefined || pc < 0 || pc > 1) errors['crossover.probability'] = 'The crossover probability must be a number from 0 to 1.';
  const pm = numberOf(draft.mutation.probability);
  if (pm === undefined || pm < 0 || pm > 1) errors['mutation.probability'] = 'The mutation probability must be a number from 0 to 1.';

  // replacement
  const elites = numberOf(draft.elites);
  if (!isWhole(elites, 0) || (size !== undefined && elites > size)) {
    errors.elites = size === undefined ? 'The number of elites must be a whole number, 0 or more.' : `The number of elites must be a whole number from 0 to the population size (${size}).`;
  }
  if (draft.truncation.enabled) {
    const lambda = numberOf(draft.truncation.lambda);
    if (!isWhole(lambda, 1)) errors['truncation.lambda'] = 'λ must be a whole number.';
    else if (size !== undefined && isWhole(elites, 0) && lambda < size - elites) {
      errors['truncation.lambda'] = `λ must be at least N − e = ${size - elites}, so there are enough offspring to fill the population.`;
    }
  }

  // stopping
  if (!isWhole(numberOf(draft.stop.generationLimit), 1)) errors['stop.generationLimit'] = 'The generation limit must be a whole number of at least 1.';
  if (draft.stop.target.enabled && numberOf(draft.stop.target.value) === undefined) errors['stop.target'] = 'The target fitness must be a number.';
  if (draft.stop.stagnation.enabled && !isWhole(numberOf(draft.stop.stagnation.window), 1)) {
    errors['stop.stagnation'] = 'The stagnation window must be a whole number of at least 1.';
  }

  return chainStep === undefined ? { errors } : { errors, chainStep };
}

/** The chain as the engine takes it, or a message when a step's parameter is not a number. */
function chainOf(steps: readonly ChainStepDraft[]): StepSpec[] | string {
  const specs: StepSpec[] = [];
  for (const [index, draft] of steps.entries()) {
    const spec: Record<string, unknown> = { step: draft.step };
    for (const parameter of weightSteps[draft.step].parameters) {
      const value = numberOf(draft.params[parameter.key] ?? '');
      if (value === undefined) return `Step ${index + 1} (${weightSteps[draft.step].label}): ${parameter.key} must be a number.`;
      spec[parameter.key] = value;
    }
    specs.push(spec as StepSpec);
  }
  return specs;
}

/* ------------------------------------------------------------- draft to engine */

/** Only meaningful for a draft whose `validate` found no errors. */
export function toParams(draft: Draft): GaParams {
  return {
    selection: draft.method === 'roulette' ? { method: 'roulette', chain: chainOf(draft.chain) as StepSpec[] } : { method: 'tournament', size: Number(draft.tournamentSize) },
    crossover: { enabled: draft.crossover.enabled, operator: draft.crossover.operator, probability: Number(draft.crossover.probability) },
    mutation: { enabled: draft.mutation.enabled, mode: draft.mutation.mode, probability: Number(draft.mutation.probability) },
    elites: Number(draft.elites),
    truncation: { enabled: draft.truncation.enabled, lambda: Number(draft.truncation.lambda) },
    stop: {
      generationLimit: Number(draft.stop.generationLimit),
      ...(draft.stop.target.enabled ? { targetFitness: Number(draft.stop.target.value) } : {}),
      ...(draft.stop.stagnation.enabled ? { stagnationWindow: Number(draft.stop.stagnation.window) } : {}),
    },
  };
}

export function toSetup(draft: Draft, problem: Problem): GaSetup {
  return {
    problem,
    init: draft.init === 'random' ? { kind: 'random', size: Number(draft.size) } : { kind: 'explicit', chromosomes: parseChromosomes(draft.chromosomes, problem).map((r) => r.text) },
  };
}

/* ---------------------------------------------------------------------- changes */

export interface Changes {
  /** Operator parameters that differ: they wait for the next generation boundary. */
  readonly operator: string[];
  /** Setup that differs: it needs a reset. */
  readonly reset: string[];
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** What the draft would change compared with the run as it stands. The draft must be valid. */
export function changes(draft: Draft, current: { params: GaParams; setup: GaSetup; seed: number; options?: ProblemOptions }): Changes {
  const next = toParams(draft);
  const p = current.params;
  const operator: string[] = [];
  if (!same(next.selection, p.selection)) operator.push('Selection');
  if (next.crossover.enabled !== p.crossover.enabled) operator.push('Crossover on/off');
  if (next.crossover.operator !== p.crossover.operator) operator.push('Crossover type');
  if (next.crossover.probability !== p.crossover.probability) operator.push('Crossover probability');
  if (next.mutation.enabled !== p.mutation.enabled) operator.push('Mutation on/off');
  if (next.mutation.mode !== p.mutation.mode) operator.push('Mutation mode');
  if (next.mutation.probability !== p.mutation.probability) operator.push('Mutation probability');
  if (next.elites !== p.elites) operator.push('Elites');
  if (next.truncation?.enabled !== (p.truncation?.enabled ?? false)) operator.push('Offspring truncation on/off');
  // λ only matters while truncation is on
  else if (next.truncation?.enabled && next.truncation.lambda !== p.truncation?.lambda) operator.push('Offspring λ');
  if (!same(next.stop, p.stop)) operator.push('Stop criteria');

  const reset: string[] = [];
  const setup = toSetup(draft, current.setup.problem);
  const was = current.setup.init;
  if (setup.init.kind !== was.kind) reset.push('Initialization');
  else if (setup.init.kind === 'random' && was.kind === 'random' && setup.init.size !== was.size) reset.push('Population size');
  else if (setup.init.kind === 'explicit' && !same(setup.init, was)) reset.push('Hand-edited population');
  if (draft.options && current.options && isStringOptions(current.options)) {
    if (draft.options.alphabet !== current.options.alphabet) reset.push('Alphabet');
    if (draft.options.target !== current.options.target) reset.push('Target');
  }
  if (draft.knapsack && current.options && isKnapsackOptions(current.options)) {
    const was = current.options;
    const k = draft.knapsack;
    if (!same(k.items.map((i) => [i.weight, i.value]), was.items.map((i) => [String(i.weight), String(i.value)]))) reset.push('Items');
    if (k.capacity !== String(was.capacity)) reset.push('Capacity');
    if (k.handling !== was.handling) reset.push('Constraint handling');
    // ρ only matters while the penalty is the method
    if (k.handling === 'penalty' && was.handling === 'penalty' && k.rho !== String(was.rho)) reset.push('Penalty ρ');
  }
  if (draft.trap && current.options && isTrapOptions(current.options)) {
    const was = current.options;
    const t = draft.trap;
    if (numberOf(t.blockSize) !== was.blockSize) reset.push('Block size');
    if (numberOf(t.blocks) !== was.blocks) reset.push('Number of blocks');
    if (t.linkage !== was.linkage) reset.push('Linkage');
  }
  if (Number(draft.seed) !== current.seed) reset.push('Seed');
  if (followedTargetFitness(draft, current.setup.problem) !== undefined) reset.push('Target fitness');
  return { operator, reset };
}

/**
 * When the problem's best possible fitness changes (a longer target, another knapsack) and the stop criterion "target
 * fitness reached" is still the old best possible fitness, the restart moves it to the new one, so the run does not
 * report success at 5 matches on a 12-letter target. Returns the new value, or undefined when the rule does not apply.
 */
export function followedTargetFitness(draft: Draft, current: Problem): number | undefined {
  if (current.knownOptimumFitness === undefined || !draft.stop.target.enabled) return undefined;
  const next = optimumOf(draft);
  if (next === undefined || next === current.knownOptimumFitness || numberOf(draft.stop.target.value) !== current.knownOptimumFitness) return undefined;
  return next;
}

/** The parameters a restart applies: the draft's, with the target fitness following a new target's length. */
export function resetParams(draft: Draft, current: Problem): GaParams {
  const params = toParams(draft);
  const followed = followedTargetFitness(draft, current);
  return followed === undefined ? params : { ...params, stop: { ...params.stop, targetFitness: followed } };
}
