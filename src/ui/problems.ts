import {
  goldberg,
  knapsackDefaults,
  knapsackProblem,
  optimalBag,
  validateKnapsack,
  validateKnapsackFields,
  handlings,
  targetStringDefaults,
  targetStringProblem,
  trapDefaults,
  trapProblem,
  validateTrap,
  validateTrapFields,
  validateTargetString,
  validateTargetStringFields,
  type GaParams,
  type Handling,
  type Initialization,
  type KnapsackOptions,
  type Problem,
  type TargetStringOptions,
  type TrapOptions,
} from '../engine';
import { defaultParams, defaultSeed } from './config';

/**
 * The problems the app can run, as data: their names, the options they take (set at setup, so changing them is a
 * reset), how to build the engine problem from the options, and the configuration each one opens with. The problem
 * menu, share links and presets all read this list; adding a problem is adding an entry.
 */
export type ProblemOptions = TargetStringOptions | KnapsackOptions | TrapOptions;
export const isStringOptions = (options: ProblemOptions): options is TargetStringOptions => 'target' in options;
/** The target string of a string problem's options, for views that compare chromosomes with it. */
export const targetOf = (options: ProblemOptions | undefined): string | undefined => (options && isStringOptions(options) ? options.target : undefined);
export const isKnapsackOptions = (options: ProblemOptions): options is KnapsackOptions => 'items' in options;
export const isTrapOptions = (options: ProblemOptions): options is TrapOptions => 'blockSize' in options;

export interface ProblemEntry {
  readonly id: string;
  /** The name in the problem menu. */
  readonly name: string;
  /** The two or three characters in the logo tile. */
  readonly logo: string;
  /** Which panel sits beside the diversity plot: Goldberg's share of 1s per gene, or the string problem's match rate. */
  readonly genePanel: 'ones' | 'match-rate' | 'chosen' | 'blocks';
  /** What the diversity plot says it measures. */
  readonly diversityNote: string;
  /** The line under the name in the brand area. */
  subtitle(options: ProblemOptions | undefined): string;
  /** Whether this problem is configured by options (an alphabet and a target, say). Goldberg is not. */
  readonly hasOptions: boolean;
  /** The options a fresh run of this problem opens with (none for a problem without options). */
  defaultOptions(): ProblemOptions | undefined;
  /** Why these options are not valid, in words (empty when they are). They may be anything: they came from a link. */
  validateOptions(options: unknown): string[];
  /** The same check, sorted by the option each message is about (what the drawer shows under each field). */
  validateOptionFields(options: ProblemOptions): Readonly<Record<string, readonly string[]>>;
  /** The engine problem for these options. */
  create(options: ProblemOptions | undefined): Problem;
  /** How a fresh run of this problem starts: population, parameters and seed. */
  readonly defaults: { readonly init: Initialization; readonly params: GaParams; readonly seed: number };
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

const goldbergEntry: ProblemEntry = {
  id: 'goldberg',
  name: 'Goldberg x²',
  logo: 'x²',
  genePanel: 'ones',
  diversityNote: 'mean pairwise Hamming, 0–1',
  subtitle: () => 'Maximise x² on 0…31',
  hasOptions: false,
  defaultOptions: () => undefined,
  validateOptions: (options) => (options === undefined ? [] : ['This problem takes no options.']),
  validateOptionFields: () => ({}),
  create: () => goldberg,
  defaults: { init: { kind: 'random', size: 6 }, params: defaultParams, seed: defaultSeed },
};

const targetStringEntry: ProblemEntry = {
  id: 'target-string',
  name: 'Target string',
  logo: 'Aa',
  genePanel: 'match-rate',
  diversityNote: 'mean pairwise mismatch, 0–1',
  subtitle: (options) => (options && isStringOptions(options) ? `Match “${options.target}” · ${[...options.alphabet].length} symbols` : 'Match a target string'),
  hasOptions: true,
  defaultOptions: () => ({ ...targetStringDefaults.options }),
  validateOptions(options) {
    if (!isObject(options)) return ['"options" must be an object with an "alphabet" and a "target".'];
    const problems: string[] = [];
    for (const key of Object.keys(options)) if (key !== 'alphabet' && key !== 'target') problems.push(`"options" has an unknown key "${key}".`);
    for (const key of ['alphabet', 'target'] as const) {
      if (!(key in options)) problems.push(`"options" is missing "${key}".`);
      else if (typeof options[key] !== 'string') problems.push(`"options.${key}" must be text.`);
    }
    if (problems.length > 0) return problems;
    return validateTargetString(options as unknown as TargetStringOptions);
  },
  validateOptionFields: (options) => validateTargetStringFields(options as TargetStringOptions),
  create: (options) => targetStringProblem((options as TargetStringOptions | undefined) ?? targetStringDefaults.options),
  defaults: { init: { kind: 'random', size: targetStringDefaults.populationSize }, params: targetStringDefaults.params, seed: defaultSeed },
};

const knapsackEntry: ProblemEntry = {
  id: 'knapsack',
  name: 'Knapsack',
  logo: 'Kn',
  genePanel: 'chosen',
  diversityNote: 'mean pairwise Hamming, 0–1',
  subtitle(options) {
    if (!options || !isKnapsackOptions(options)) return 'Pack a bag';
    const instance = { items: options.items, capacity: options.capacity };
    return `${options.items.length} items · capacity ${options.capacity} · optimum ${optimalBag(instance).value}`;
  },
  hasOptions: true,
  defaultOptions: () => ({ ...knapsackDefaults.options, items: knapsackDefaults.options.items.map((item) => ({ ...item })) }),
  validateOptions(options) {
    if (!isObject(options)) return ['"options" must be an object with "items", "capacity", "handling" and "rho".'];
    const problems: string[] = [];
    const keys = ['items', 'capacity', 'handling', 'rho'];
    for (const key of Object.keys(options)) if (!keys.includes(key)) problems.push(`"options" has an unknown key "${key}".`);
    for (const key of keys) if (!(key in options)) problems.push(`"options" is missing "${key}".`);
    if ('items' in options) {
      if (!Array.isArray(options.items)) problems.push('"options.items" must be a list of items.');
      else {
        options.items.forEach((item, i) => {
          const at = `"options.items[${i}]"`;
          if (!isObject(item)) return void problems.push(`${at} must be an object with a "weight" and a "value".`);
          for (const key of Object.keys(item)) if (key !== 'weight' && key !== 'value') problems.push(`${at} has an unknown key "${key}".`);
          for (const key of ['weight', 'value'] as const) {
            if (!(key in item)) problems.push(`${at} is missing "${key}".`);
            else if (typeof item[key] !== 'number') problems.push(`"options.items[${i}].${key}" must be a number.`);
          }
        });
      }
    }
    if ('capacity' in options && typeof options.capacity !== 'number') problems.push('"options.capacity" must be a number.');
    if ('handling' in options && typeof options.handling !== 'string') problems.push('"options.handling" must be text.');
    if ('rho' in options && typeof options.rho !== 'number') problems.push('"options.rho" must be a number.');
    if (problems.length > 0) return problems;
    return validateKnapsack(options as unknown as KnapsackOptions);
  },
  validateOptionFields: (options) => validateKnapsackFields(options as KnapsackOptions),
  create: (options) => knapsackProblem((options as KnapsackOptions | undefined) ?? knapsackDefaults.options),
  defaults: { init: { kind: 'random', size: knapsackDefaults.populationSize }, params: knapsackDefaults.params, seed: defaultSeed },
};

const trapEntry: ProblemEntry = {
  id: 'trap',
  name: 'Trap',
  logo: 'Tr',
  genePanel: 'blocks',
  diversityNote: 'mean pairwise Hamming, 0–1',
  subtitle(options) {
    if (!options || !isTrapOptions(options)) return 'Deceptive trap functions';
    return `${options.blocks} ${options.blocks === 1 ? 'block' : 'blocks'} of ${options.blockSize} · ${options.linkage} · optimum ${options.blockSize * options.blocks}`;
  },
  hasOptions: true,
  defaultOptions: () => ({ ...trapDefaults.options }),
  validateOptions(options) {
    if (!isObject(options)) return ['"options" must be an object with "blockSize", "blocks" and "linkage".'];
    const problems: string[] = [];
    const keys = ['blockSize', 'blocks', 'linkage'];
    for (const key of Object.keys(options)) if (!keys.includes(key)) problems.push(`"options" has an unknown key "${key}".`);
    for (const key of keys) if (!(key in options)) problems.push(`"options" is missing "${key}".`);
    if ('blockSize' in options && typeof options.blockSize !== 'number') problems.push('"options.blockSize" must be a number.');
    if ('blocks' in options && typeof options.blocks !== 'number') problems.push('"options.blocks" must be a number.');
    if ('linkage' in options && typeof options.linkage !== 'string') problems.push('"options.linkage" must be text.');
    if (problems.length > 0) return problems;
    return validateTrap(options as unknown as TrapOptions);
  },
  validateOptionFields: (options) => validateTrapFields(options as TrapOptions),
  create: (options) => trapProblem((options as TrapOptions | undefined) ?? trapDefaults.options),
  defaults: { init: { kind: 'random', size: trapDefaults.populationSize }, params: trapDefaults.params, seed: defaultSeed },
};

export const problemEntries: readonly ProblemEntry[] = [goldbergEntry, targetStringEntry, knapsackEntry, trapEntry];

export const problemIds = (): string[] => problemEntries.map((p) => p.id);
export const entryOf = (id: string): ProblemEntry | undefined => problemEntries.find((p) => p.id === id);
