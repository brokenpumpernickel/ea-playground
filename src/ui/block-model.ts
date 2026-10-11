import type { BlockState } from '../engine';
import type { BlockInfo } from './block-context';

/** The note printed under one block of one chromosome. */
export interface BlockNote {
  /** 1-based. */
  readonly block: number;
  readonly text: string;
  /** What the note says: how the block scores (all ones, all zeros, between) or where crossover took it from. */
  readonly state: BlockState | 'whole-a' | 'whole-b' | 'split';
}

/** Where crossover took a block of a child from: whole from parent A, whole from parent B, or split between them. */
export type BlockOrigin = 'A' | 'B' | 'split';

/** One label of the block row, with the 1-based genes it stands for. */
export interface BlockRowLabel {
  readonly text: string;
  readonly genes: readonly number[];
}

/** The genes of a chromosome text, or nothing when it is not a chromosome of this trap (another length, other symbols). */
function genesOf(info: BlockInfo, chromosome: string): number[] | undefined {
  if (!/^[01]+$/.test(chromosome) || chromosome.length !== info.blockSize * info.blocks) return undefined;
  return [...chromosome].map(Number);
}

const MARK: Record<BlockState, string> = { optimum: '✓ ', attractor: '▽ ', between: '' };

/** For each block: ✓ and its score when all its genes are 1, ▽ and its score when all are 0, just the score otherwise. */
export function blockNotes(info: BlockInfo, chromosome: string): BlockNote[] {
  const genes = genesOf(info, chromosome);
  if (!genes) return [];
  return info.outcomeOf(genes).blocks.map((b) => ({ block: b.index + 1, text: `${MARK[b.state]}${b.contribution}`, state: b.state }));
}

const blocksText = (numbers: readonly number[]): string =>
  numbers.length === 1 ? `block ${numbers[0]}` : `blocks ${numbers.slice(0, -1).join(', ')} and ${numbers[numbers.length - 1]}`;

/** A chromosome's blocks in a sentence, for the screen reader and the narration. */
export function blockSentence(info: BlockInfo, chromosome: string): string {
  const genes = genesOf(info, chromosome);
  if (!genes) return '';
  const { blocks } = info.outcomeOf(genes);
  const where = (state: BlockState) => blocks.filter((b) => b.state === state).map((b) => b.index + 1);
  const ones = where('optimum');
  const zeros = where('attractor');
  return [
    `ones per block ${blocks.map((b) => b.ones).join(', ')}`,
    `scores ${blocks.map((b) => b.contribution).join(', ')}`,
    ones.length > 0 ? `all ones in ${blocksText(ones)}` : 'no block is all ones',
    zeros.length > 0 ? `all zeros in ${blocksText(zeros)}` : 'no block is all zeros',
  ].join('; ');
}

/**
 * What the block row prints above the genes. Tight linkage: one label per block, "block n" when the block is wide enough
 * (4 genes or more) and just "n" otherwise. Loose linkage: one label per gene, the number of the block that owns it.
 */
export function blockRowLabels(info: BlockInfo): BlockRowLabel[] {
  if (info.linkage === 'tight') {
    return info.blockGenes.map((genes, b) => ({ text: info.blockSize >= 4 ? `block ${b + 1}` : String(b + 1), genes: genes.map((g) => g + 1) }));
  }
  const owner: number[] = [];
  info.blockGenes.forEach((genes, b) => genes.forEach((g) => (owner[g] = b)));
  return owner.map((b, g) => ({ text: String(b + 1), genes: [g + 1] }));
}

/** Which genes, as a phrase: "1 to 4" for a run, otherwise "1, 3, 5 and 7". */
function genesPhrase(genes: readonly number[]): string {
  const run = genes.length >= 3 && genes.every((g, k) => k === 0 || g === genes[k - 1]! + 1);
  if (run) return `${genes[0]} to ${genes[genes.length - 1]}`;
  return genes.length === 1 ? String(genes[0]) : `${genes.slice(0, -1).join(', ')} and ${genes[genes.length - 1]}`;
}

/** The block row in one sentence for a screen reader: which genes each block owns. */
export function blockRowSentence(info: BlockInfo): string {
  return `Blocks: ${info.blockGenes.map((genes, b) => `block ${b + 1} is genes ${genesPhrase(genes.map((g) => g + 1))}`).join('; ')}`;
}

/** For each block of a child, whether all its genes came from A, all from B, or from both (the cut fell inside it). */
export function blockOrigins(info: BlockInfo, sources: readonly ('A' | 'B')[]): BlockOrigin[] {
  if (sources.length !== info.blockSize * info.blocks) return [];
  return info.blockGenes.map((genes): BlockOrigin => {
    const fromA = genes.filter((g) => sources[g] === 'A').length;
    return fromA === genes.length ? 'A' : fromA === 0 ? 'B' : 'split';
  });
}

const ORIGIN_NOTE: Record<BlockOrigin, { text: string; state: 'whole-a' | 'whole-b' | 'split' }> = {
  A: { text: '● A', state: 'whole-a' },
  B: { text: '▨ B', state: 'whole-b' },
  split: { text: '◧ split', state: 'split' },
};

/** The note under each block of a child after crossover: ● A, ▨ B or ◧ split (a shape and a word, never colour alone). */
export function blockOriginNotes(info: BlockInfo, sources: readonly ('A' | 'B')[]): BlockNote[] {
  return blockOrigins(info, sources).map((origin, b) => ({ block: b + 1, ...ORIGIN_NOTE[origin] }));
}

/** How many blocks came whole and how many the cut split, in words. */
export function blockSplitSummary(origins: readonly BlockOrigin[]): { whole: number; split: number; text: string } {
  const split = origins.filter((o) => o === 'split').length;
  const n = origins.length;
  return { whole: n - split, split, text: split === 0 ? 'no block split' : `${split} of ${n} block${n === 1 ? '' : 's'} split` };
}

/** A block whose number of 1s, and so its score, a mutation changed. */
export interface BlockChange {
  readonly block: number;
  /** The block's genes in the block's own order, before and after. */
  readonly before: string;
  readonly after: string;
  readonly from: number;
  readonly to: number;
}

/** A block that mutation flipped genes in, but whose number of 1s (and so score) did not change. */
export interface BlockCancel {
  readonly block: number;
  /** The 1-based genes that flipped. */
  readonly genes: readonly number[];
  readonly ones: number;
  readonly score: number;
}

/** What a mutation did to the blocks of a chromosome: which changed their score, and which were touched but cancelled out. */
export function blockMutation(info: BlockInfo, before: string, after: string): { changed: BlockChange[]; cancelled: BlockCancel[] } {
  const b = genesOf(info, before);
  const a = genesOf(info, after);
  if (!b || !a) return { changed: [], cancelled: [] };
  const was = info.outcomeOf(b).blocks;
  const now = info.outcomeOf(a).blocks;
  const changed: BlockChange[] = [];
  const cancelled: BlockCancel[] = [];
  info.blockGenes.forEach((genes, i) => {
    const flipped = genes.filter((g) => b[g] !== a[g]).map((g) => g + 1);
    if (flipped.length === 0) return;
    if (was[i]!.contribution !== now[i]!.contribution) {
      changed.push({ block: i + 1, before: genes.map((g) => b[g]).join(''), after: genes.map((g) => a[g]).join(''), from: was[i]!.contribution, to: now[i]!.contribution });
    } else {
      cancelled.push({ block: i + 1, genes: flipped, ones: now[i]!.ones, score: now[i]!.contribution });
    }
  });
  return { changed, cancelled };
}

/** "block 3: 0100 → 1110 · 2 → 0" */
export const describeChange = (c: BlockChange): string => `block ${c.block}: ${c.before} → ${c.after} · ${c.from} → ${c.to}`;

/** "block 3: genes 10 and 11 flipped but the block still has 1 one, so it still scores 2" */
export const describeCancel = (c: BlockCancel): string => {
  const genes = c.genes.length === 1 ? `gene ${c.genes[0]}` : `genes ${c.genes.slice(0, -1).join(', ')} and ${c.genes[c.genes.length - 1]}`;
  return `block ${c.block}: ${genes} flipped but the block still has ${c.ones} ${c.ones === 1 ? 'one' : 'ones'}, so it still scores ${c.score}`;
};
