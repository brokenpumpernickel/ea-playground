import { createRun } from '../run';
import { gaAlgorithm, weightSteps, type GaParams, type GaSetup, type Initialization, type StepName } from '../engine';
import { draftOf, validate } from './drawer-model';
import { entryOf, problemIds, type ProblemOptions } from './problems';

/**
 * A run's whole configuration as one serialisable value: the problem, how the population starts, every parameter and
 * the seed. A run is fully determined by this (ADR 0001), so it is all a share link needs to carry.
 *
 * Link format: `#v1.<payload>`, the payload being this value as compact JSON in UTF-8, base64url without padding.
 * Decoding is strict: unknown keys, wrong types and anything the parameter drawer would refuse are all reported,
 * together and in words, and nothing from a bad link is used.
 */
export interface RunConfig {
  readonly v: 1;
  readonly problem: string;
  /** The problem's own options (a string problem's alphabet and target); absent for a problem that takes none. */
  readonly options?: ProblemOptions;
  readonly setup: { readonly init: Initialization };
  readonly params: GaParams;
  readonly seed: number;
}

export { problemIds };

export function configOf(setup: GaSetup, params: GaParams, seed: number, problem = 'goldberg', options?: ProblemOptions): RunConfig {
  return { v: 1, problem, ...(options ? { options } : {}), setup: { init: setup.init }, params, seed };
}

/** The engine setup a configuration describes. */
export function setupOf(config: RunConfig): GaSetup {
  return { problem: entryOf(config.problem)!.create(config.options), init: config.setup.init };
}

/* ----------------------------------------------------------------------- encoding */

const toBase64Url = (text: string): string => {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (payload: string): string => {
  const padded = payload.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (payload.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
};

export function encodeConfig(config: RunConfig): string {
  return `#v1.${toBase64Url(JSON.stringify(config))}`;
}

/* ----------------------------------------------------------------------- decoding */

export type Decoded = { readonly ok: true; readonly config: RunConfig } | { readonly ok: false; readonly problems: readonly string[] };

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const list = (words: readonly string[]) => words.map((w) => `"${w}"`).join(', ');

/** Checks that `value` is an object with exactly these keys (the optional ones may be absent), reporting any other. */
function exactKeys(value: unknown, path: string, required: readonly string[], optional: readonly string[], problems: string[]): value is Json {
  if (!isObject(value)) {
    problems.push(`"${path}" must be an object.`);
    return false;
  }
  for (const key of required) if (!(key in value)) problems.push(`"${path}" is missing "${key}".`);
  for (const key of Object.keys(value)) if (!required.includes(key) && !optional.includes(key)) problems.push(`"${path}" has an unknown key "${key}".`);
  return true;
}

function checkInit(value: unknown, problems: string[]): void {
  if (!exactKeys(value, 'setup', ['init'], [], problems)) return;
  const init = value.init;
  if (!isObject(init)) return void problems.push('"setup.init" must be an object.');
  if (init.kind === 'random') {
    exactKeys(init, 'setup.init', ['kind', 'size'], [], problems);
    if ('size' in init && !isNumber(init.size)) problems.push('"setup.init.size" must be a number.');
  } else if (init.kind === 'explicit') {
    exactKeys(init, 'setup.init', ['kind', 'chromosomes'], [], problems);
    if ('chromosomes' in init && (!Array.isArray(init.chromosomes) || init.chromosomes.some((c) => typeof c !== 'string'))) {
      problems.push('"setup.init.chromosomes" must be a list of texts such as "01101".');
    }
  } else problems.push('"setup.init.kind" must be "random" or "explicit".');
}

function checkChain(chain: unknown, problems: string[]): void {
  if (!Array.isArray(chain)) return void problems.push('"params.selection.chain" must be a list of steps.');
  chain.forEach((step, k) => {
    const path = `params.selection.chain[${k}]`;
    if (!isObject(step)) return void problems.push(`"${path}" must be an object.`);
    const name = step.step;
    if (typeof name !== 'string' || !(name in weightSteps)) return void problems.push(`"${path}.step" must be one of ${list(Object.keys(weightSteps))}.`);
    const parameters = weightSteps[name as StepName].parameters.map((p) => p.key);
    exactKeys(step, path, ['step'], parameters, problems);
    for (const key of parameters) if (key in step && !isNumber(step[key])) problems.push(`"${path}.${key}" must be a number.`);
  });
}

function checkParams(params: unknown, problems: string[]): void {
  if (!exactKeys(params, 'params', ['selection', 'crossover', 'mutation', 'elites', 'stop'], ['truncation'], problems)) return;
  const selection = params.selection;
  if (isObject(selection) && selection.method === 'roulette') {
    exactKeys(selection, 'params.selection', ['method', 'chain'], [], problems);
    if ('chain' in selection) checkChain(selection.chain, problems);
  } else if (isObject(selection) && selection.method === 'tournament') {
    exactKeys(selection, 'params.selection', ['method', 'size'], [], problems);
    if ('size' in selection && !isNumber(selection.size)) problems.push('"params.selection.size" must be a number.');
  } else if ('selection' in params) problems.push('"params.selection.method" must be "roulette" or "tournament".');

  const crossover = params.crossover;
  if (exactKeys(crossover, 'params.crossover', ['enabled', 'operator', 'probability'], [], problems)) {
    if ('enabled' in crossover && typeof crossover.enabled !== 'boolean') problems.push('"params.crossover.enabled" must be true or false.');
    if ('operator' in crossover && !['one-point', 'two-point', 'uniform'].includes(crossover.operator as string)) problems.push('"params.crossover.operator" must be "one-point", "two-point" or "uniform".');
    if ('probability' in crossover && !isNumber(crossover.probability)) problems.push('"params.crossover.probability" must be a number.');
  }
  const mutation = params.mutation;
  if (exactKeys(mutation, 'params.mutation', ['enabled', 'mode', 'probability'], [], problems)) {
    if ('enabled' in mutation && typeof mutation.enabled !== 'boolean') problems.push('"params.mutation.enabled" must be true or false.');
    if ('mode' in mutation && !['per-gene', 'per-individual'].includes(mutation.mode as string)) problems.push('"params.mutation.mode" must be "per-gene" or "per-individual".');
    if ('probability' in mutation && !isNumber(mutation.probability)) problems.push('"params.mutation.probability" must be a number.');
  }
  if ('elites' in params && !isNumber(params.elites)) problems.push('"params.elites" must be a number.');
  if ('truncation' in params) {
    const truncation = params.truncation;
    if (exactKeys(truncation, 'params.truncation', ['enabled', 'lambda'], [], problems)) {
      if ('enabled' in truncation && typeof truncation.enabled !== 'boolean') problems.push('"params.truncation.enabled" must be true or false.');
      if ('lambda' in truncation && !isNumber(truncation.lambda)) problems.push('"params.truncation.lambda" must be a number.');
    }
  }
  const stop = params.stop;
  if (exactKeys(stop, 'params.stop', ['generationLimit'], ['targetFitness', 'stagnationWindow'], problems)) {
    for (const key of ['generationLimit', 'targetFitness', 'stagnationWindow']) if (key in stop && !isNumber(stop[key])) problems.push(`"params.stop.${key}" must be a number.`);
  }
}

/** Reads a share link (or just its payload), or says everything that is wrong with it. */
export function decodeConfig(hash: string): Decoded {
  const text = hash.startsWith('#') ? hash.slice(1) : hash;
  const match = /^v(\d+)\.(.*)$/s.exec(text);
  if (!match) return { ok: false, problems: ['This is not a share link: it should look like "#v1." followed by the encoded configuration.'] };
  if (match[1] !== '1') return { ok: false, problems: [`This link was made by a different version of the app (v${match[1]}); this app reads v1 links.`] };
  const payload = match[2]!;
  if (payload === '') return { ok: false, problems: ['The link has no configuration in it (it is empty after "#v1.").'] };
  if (!/^[A-Za-z0-9_-]+$/.test(payload)) return { ok: false, problems: ['The link contains characters that cannot be part of a share link, so it was probably copied incorrectly.'] };

  let json: unknown;
  try {
    json = JSON.parse(fromBase64Url(payload));
  } catch {
    return { ok: false, problems: ['The link could not be read: it is cut short or damaged. Copy it again from the original.'] };
  }

  // structure first, with every problem collected; meaning second, through the same checks as the parameter drawer
  const problemsFound: string[] = [];
  if (!exactKeys(json, 'configuration', ['v', 'problem', 'setup', 'params', 'seed'], ['options'], problemsFound)) return { ok: false, problems: problemsFound };
  if ('v' in json && json.v !== 1) problemsFound.push('The configuration says it is version ' + String(json.v) + ', but the link says v1.');
  const entry = typeof json.problem === 'string' ? entryOf(json.problem) : undefined;
  if ('problem' in json && !entry) {
    problemsFound.push(`Unknown problem ${typeof json.problem === 'string' ? `"${json.problem}"` : String(json.problem)}; this app knows ${list(problemIds())}.`);
  }
  if (entry) {
    if (entry.hasOptions && !('options' in json)) problemsFound.push(`"configuration" is missing "options", which ${entry.name} needs.`);
    else if ('options' in json) problemsFound.push(...entry.validateOptions(json.options).map((m) => (entry.hasOptions ? m : '"configuration" has an unknown key "options".')));
  }
  if ('seed' in json && (!isNumber(json.seed) || !Number.isInteger(json.seed) || json.seed < 0 || json.seed > 4294967295)) {
    problemsFound.push('The seed must be a whole number from 0 to 4294967295.');
  }
  if ('setup' in json) checkInit(json.setup, problemsFound);
  if ('params' in json) checkParams(json.params, problemsFound);
  if (problemsFound.length > 0) return { ok: false, problems: problemsFound };

  const config = json as unknown as RunConfig;
  const setup = setupOf(config);
  const problem = setup.problem;
  const draft = draftOf(config.params, setup, config.seed);
  const first = Object.values(validate(draft, problem, []).errors);
  if (first.length > 0) return { ok: false, problems: first as string[] };
  // the weight chain is checked against the fitness the run starts with, as the drawer does
  const start = createRun(gaAlgorithm, { setup, params: config.params, seed: config.seed }).snapshot(0).state.population.map((i) => i.fitness);
  const full = Object.values(validate(draft, problem, start).errors);
  if (full.length > 0) return { ok: false, problems: full as string[] };
  return { ok: true, config };
}
