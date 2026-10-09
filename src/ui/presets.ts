import { goldberg, type GaParams, type GaSetup } from '../engine';

/**
 * A preset is a plain data file in `presets/`: a whole configuration plus the seed that shows its lesson. Adding one
 * is adding a file; nothing here needs to change. Files are listed in the order of their names.
 */
export interface Preset {
  /** The file's name without the extension. */
  readonly id: string;
  readonly name: string;
  /** One sentence: what the preset is for. */
  readonly lesson: string;
  /** What to look for, including plainly when the run is expected to stall or fail. */
  readonly lookFor: string;
  readonly seed: number;
  readonly setup: GaSetup;
  readonly params: GaParams;
}

const fail = (id: string, problem: string): never => {
  throw new Error(`Preset "${id}": ${problem}`);
};

/** Reads one preset file's contents, naming the first thing that is wrong with it. */
export function presetFromData(id: string, data: unknown): Preset {
  if (typeof data !== 'object' || data === null) return fail(id, 'the file must hold one JSON object.');
  const d = data as Record<string, unknown>;
  for (const key of ['name', 'lesson', 'lookFor'] as const) {
    if (typeof d[key] !== 'string' || (d[key] as string).trim() === '') fail(id, `"${key}" must be a non-empty text.`);
  }
  if (typeof d.seed !== 'number' || !Number.isInteger(d.seed) || d.seed < 0) fail(id, '"seed" must be a whole number, 0 or more.');
  const setup = d.setup as { init?: { kind?: string; size?: unknown; chromosomes?: unknown } } | undefined;
  const init = setup?.init;
  if (init?.kind === 'random') {
    if (typeof init.size !== 'number' || !Number.isInteger(init.size) || init.size < 1) fail(id, '"setup.init.size" must be a whole number of at least 1.');
  } else if (init?.kind === 'explicit') {
    if (!Array.isArray(init.chromosomes) || init.chromosomes.some((c) => typeof c !== 'string')) fail(id, '"setup.init.chromosomes" must be a list of texts such as "01101".');
  } else fail(id, '"setup.init.kind" must be "random" or "explicit".');
  const params = d.params as Partial<GaParams> | undefined;
  for (const key of ['selection', 'crossover', 'mutation', 'stop'] as const) {
    if (typeof params?.[key] !== 'object' || params[key] === null) fail(id, `"params.${key}" is missing.`);
  }
  if (typeof params?.elites !== 'number') fail(id, '"params.elites" must be a number.');
  return {
    id,
    name: d.name as string,
    lesson: d.lesson as string,
    lookFor: d.lookFor as string,
    seed: d.seed as number,
    setup: { problem: goldberg, init: init as GaSetup['init'] },
    params: params as GaParams,
  };
}

const files = import.meta.glob('./presets/*.json', { eager: true, import: 'default' }) as Record<string, unknown>;

export const presets: readonly Preset[] = Object.keys(files)
  .sort()
  .map((path) => presetFromData(path.replace(/^.*\/(.*)\.json$/, '$1'), files[path]));
