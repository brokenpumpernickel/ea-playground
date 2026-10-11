import { describe, expect, test } from 'vitest';
import { trapProblem, type TrapOptions } from '../engine';
import { blockInfoOf } from './block-context';
import { blockNotes, blockRowLabels, blockSentence } from './block-model';

const infoOf = (blockSize: number, blocks: number, linkage: TrapOptions['linkage'] = 'tight') => blockInfoOf(trapProblem({ blockSize, blocks, linkage }));
const tight = infoOf(4, 5);
const loose = infoOf(4, 5, 'loose');
const sample = '11110000010000001111'; // 4 · 0 · 1 · 0 · 4 tight

describe('the block info of a trap problem', () => {
  test('carries what the views need: sizes, linkage, genes, the optimum and all zeros, and how a chromosome scores', () => {
    expect(tight).toMatchObject({ blockSize: 4, blocks: 5, linkage: 'tight', optimum: 20, attractor: 15 });
    expect(tight.blockGenes[2]).toEqual([8, 9, 10, 11]);
    expect(loose.blockGenes[2]).toEqual([2, 7, 12, 17]);
    expect(tight.outcomeOf([...sample].map(Number)).fitness).toBe(16);
  });
});

describe('the note under each block of a chromosome', () => {
  test('is ✓ and the score for a block of all ones, ▽ and the score for all zeros, and just the score otherwise', () => {
    expect(blockNotes(tight, sample)).toEqual([
      { block: 1, text: '✓ 4', state: 'optimum' },
      { block: 2, text: '▽ 3', state: 'attractor' },
      { block: 3, text: '2', state: 'between' },
      { block: 4, text: '▽ 3', state: 'attractor' },
      { block: 5, text: '✓ 4', state: 'optimum' },
    ]);
  });

  test('for loose linkage the same string is another set of blocks: every block holds one gene of each quarter', () => {
    expect(blockNotes(loose, sample).map((n) => n.text)).toEqual(['2', '1', '1', '1', '1']);
  });

  test('is empty for a text that is not a chromosome of this problem (another length, other symbols)', () => {
    expect(blockNotes(tight, '1111')).toEqual([]);
    expect(blockNotes(tight, '1111000001000000111x')).toEqual([]);
  });
});

describe('the sentence that says a chromosome in words', () => {
  test('gives the ones in each block, what each scores, and which blocks are all ones and all zeros', () => {
    expect(blockSentence(tight, sample)).toBe('ones per block 4, 0, 1, 0, 4; scores 4, 3, 2, 3, 4; all ones in blocks 1 and 5; all zeros in blocks 2 and 4');
  });

  test('leaves out what does not apply, and names a single block without “and”', () => {
    expect(blockSentence(tight, '00000000000000000000')).toBe('ones per block 0, 0, 0, 0, 0; scores 3, 3, 3, 3, 3; no block is all ones; all zeros in blocks 1, 2, 3, 4 and 5');
    expect(blockSentence(tight, '11110000100000000000')).toBe('ones per block 4, 0, 1, 0, 0; scores 4, 3, 2, 3, 3; all ones in block 1; all zeros in blocks 2, 4 and 5');
    expect(blockSentence(infoOf(2, 2), '0110')).toBe('ones per block 1, 1; scores 0, 0; no block is all ones; no block is all zeros');
  });

  test('is empty for a text that is not a chromosome of this problem', () => {
    expect(blockSentence(tight, '1')).toBe('');
  });
});

describe('the labels of the block row', () => {
  test('tight: one per block, named “block n” from 4 genes and just “n” for narrower blocks, with the genes each owns', () => {
    expect(blockRowLabels(tight)).toEqual([1, 2, 3, 4, 5].map((n) => ({ text: `block ${n}`, genes: tight.blockGenes[n - 1]!.map((g) => g + 1) })));
    expect(blockRowLabels(infoOf(3, 2)).map((l) => l.text)).toEqual(['1', '2']);
  });

  test('loose: one per gene, the number of the block that owns it', () => {
    const labels = blockRowLabels(loose);
    expect(labels).toHaveLength(20);
    expect(labels.map((l) => l.text).join(' ')).toBe('1 2 3 4 5 1 2 3 4 5 1 2 3 4 5 1 2 3 4 5');
    expect(labels[7]).toEqual({ text: '3', genes: [8] });
  });
});
