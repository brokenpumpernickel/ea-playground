import type { GaEvent, GaParams, GaSetup, RunState } from '../engine';
import type { Run } from '../run';
import type { BlockInfo } from './block-context';

/**
 * The schema tracker's arithmetic. A schema fixes some genes (1 or 0) and leaves the others free (*); an individual is an
 * instance when it matches every fixed gene. For every recorded generation the tracker shows how many individuals are
 * instances, the mean fitness of those instances, and the mean fitness of the whole population: the quantities the schema
 * theorem is about. It only reads the recorded populations, so tracking a schema never changes a run.
 */
export type SchemaSymbol = '0' | '1' | '*';

export type ParsedSchema = { readonly ok: true; readonly text: string; readonly symbols: readonly SchemaSymbol[] } | { readonly ok: false; readonly message: string };

/** Reads typed text (spaces and line breaks are ignored) as a schema of `length` symbols, or says what is wrong with it. */
export function parseSchema(typed: string, length: number): ParsedSchema {
  const text = typed.replace(/\s+/g, '');
  if (text.length === 0) {
    return { ok: false, message: `Type a schema of ${length} symbols: 1 for a gene that must be 1, 0 for a gene that must be 0, * for any gene.` };
  }
  const bad = [...text].findIndex((c) => c !== '1' && c !== '0' && c !== '*');
  if (bad >= 0) return { ok: false, message: `A schema can only use 1, 0 and * (“${[...text][bad]}” at position ${bad + 1} is none of them).` };
  if (text.length !== length) return { ok: false, message: `The schema needs ${length} symbols, one per gene (it has ${text.length}).` };
  return { ok: true, text, symbols: [...text] as SchemaSymbol[] };
}

/** The number of fixed genes. */
export const schemaOrder = (symbols: readonly SchemaSymbol[]): number => symbols.filter((s) => s !== '*').length;

/** The distance between the outermost fixed genes (0 with fewer than two fixed genes). */
export function schemaDefiningLength(symbols: readonly SchemaSymbol[]): number {
  const fixed = symbols.flatMap((s, k) => (s === '*' ? [] : [k]));
  return fixed.length < 2 ? 0 : fixed[fixed.length - 1]! - fixed[0]!;
}

/** "Block b solved": the schema that fixes the block's genes to 1 and leaves the rest free (1-based block). */
export function schemaOfBlock(info: BlockInfo, block: number): string {
  const owned = new Set(info.blockGenes[block - 1] ?? []);
  return Array.from({ length: info.blockSize * info.blocks }, (_, g) => (owned.has(g) ? '1' : '*')).join('');
}

export const isInstance = (symbols: readonly SchemaSymbol[], chromosome: readonly number[]): boolean => symbols.every((s, k) => s === '*' || Number(s) === chromosome[k]);

export interface SchemaPoint {
  readonly generation: number;
  /** The individuals in that generation. */
  readonly size: number;
  readonly instances: number;
  /** The mean fitness of the instances, or null when there are none. */
  readonly instanceMean: number | null;
  readonly populationMean: number;
}

/** For every recorded generation: how many are instances and the two mean fitnesses. */
export function schemaHistory(run: Run<GaSetup, GaParams, RunState, GaEvent>, symbols: readonly SchemaSymbol[]): SchemaPoint[] {
  return Array.from({ length: run.lastCycle + 1 }, (_, generation): SchemaPoint => {
    const population = run.snapshot(generation).state.population;
    const matching = population.filter((i) => isInstance(symbols, i.chromosome));
    return {
      generation,
      size: population.length,
      instances: matching.length,
      instanceMean: matching.length === 0 ? null : matching.reduce((t, i) => t + i.fitness, 0) / matching.length,
      populationMean: population.reduce((t, i) => t + i.fitness, 0) / population.length,
    };
  });
}

const fmt = (x: number): string => String(Number(x.toFixed(2)));

/** What the schema did up to the generation the cursor is on, in a sentence. */
export function describeSchemaMoment(schema: string, history: readonly SchemaPoint[], now: number): string {
  const here = history.find((h) => h.generation === now) ?? history[history.length - 1]!;
  const first = history[0]!;
  const earlier = here.generation > 0 ? ` (${first.instances === 0 ? 'none' : first.instances} in generation 0)` : '';
  if (here.instances === 0) return `Generation ${here.generation}: none of the ${here.size} individuals is an instance of ${schema}${earlier}.`;
  const one = here.instances === 1;
  const mean = here.instanceMean!;
  const against = mean > here.populationMean ? 'above' : mean < here.populationMean ? 'below' : 'equal to';
  return `Generation ${here.generation}: ${here.instances} of ${here.size} individuals ${one ? 'is an instance' : 'are instances'} of ${schema}${earlier}. ${one ? 'Its' : 'Their'} mean fitness is ${fmt(mean)}, ${against} the population mean ${fmt(here.populationMean)}.`;
}

/** Said under the tracker whatever it shows: a count that rises is something to discuss, not a result. */
export const schemaCaveat = 'One run illustrates a tendency; it proves nothing. With another seed the same schema may become rarer instead, and a schema theorem is a statement about expectations, not a guarantee that a run succeeds.';
