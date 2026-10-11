import {
  goldberg,
  targetStringDefaults,
  targetStringProblem,
  validateTargetString,
  type GaParams,
  type Initialization,
  type Problem,
  type TargetStringOptions,
} from '../engine';
import { defaultParams, defaultSeed } from './config';

/**
 * The problems the app can run, as data: their names, the options they take (set at setup, so changing them is a
 * reset), how to build the engine problem from the options, and the configuration each one opens with. The problem
 * menu, share links and presets all read this list; adding a problem is adding an entry.
 */
export type ProblemOptions = TargetStringOptions;

export interface ProblemEntry {
  readonly id: string;
  /** The name in the problem menu. */
  readonly name: string;
  /** The two or three characters in the logo tile. */
  readonly logo: string;
  /** Which panel sits beside the diversity plot: Goldberg's share of 1s per gene, or the string problem's match rate. */
  readonly genePanel: 'ones' | 'match-rate';
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
  create: () => goldberg,
  defaults: { init: { kind: 'random', size: 6 }, params: defaultParams, seed: defaultSeed },
};

const targetStringEntry: ProblemEntry = {
  id: 'target-string',
  name: 'Target string',
  logo: 'Aa',
  genePanel: 'match-rate',
  diversityNote: 'mean pairwise mismatch, 0–1',
  subtitle: (options) => (options ? `Match “${options.target}” · ${[...options.alphabet].length} symbols` : 'Match a target string'),
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
  create: (options) => targetStringProblem(options ?? targetStringDefaults.options),
  defaults: { init: { kind: 'random', size: targetStringDefaults.populationSize }, params: targetStringDefaults.params, seed: defaultSeed },
};

export const problemEntries: readonly ProblemEntry[] = [goldbergEntry, targetStringEntry];

export const problemIds = (): string[] => problemEntries.map((p) => p.id);
export const entryOf = (id: string): ProblemEntry | undefined => problemEntries.find((p) => p.id === id);
