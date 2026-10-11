import { render } from 'svelte/server';
import { describe, expect, test } from 'vitest';
import { trapProblem, type TrapOptions } from '../engine';
import Bits from './Bits.svelte';
import BlockRow from './BlockRow.svelte';
import { blockContextKey, blockInfoOf, type BlockInfo } from './block-context';
import { blockGeometry, groupWidth } from './block-geometry';
import { blockNotes } from './block-model';

const infoOf = (blockSize: number, blocks: number, linkage: TrapOptions['linkage'] = 'tight') => blockInfoOf(trapProblem({ blockSize, blocks, linkage }));
const withBlocks = (info: BlockInfo | undefined) => new Map<unknown, unknown>([[blockContextKey, () => info]]);
const plain = (markup: string) => markup.replace(/<!--.*?-->/g, '');
const bits = (chromosome: string, info: BlockInfo | undefined, props: Record<string, unknown> = {}) => plain(render(Bits as never, { props: { chromosome, small: true, ...props } as never, context: withBlocks(info) }).body);
const blockRow = (info: BlockInfo | undefined) => plain(render(BlockRow as never, { props: {} as never, context: withBlocks(info) }).body);
const label = (markup: string) => /aria-label="([^"]*)"/.exec(markup)![1]!;
const cells = (markup: string) => [...markup.matchAll(/<b class="([^"]*)"[^>]*>(.*?)<\/b>/g)].map((m) => ({ classes: m[1]!.split(' '), text: m[2]! }));
const sample = '11110000010000001111';

describe('a chromosome in a trap screen', () => {
  test('tight linkage: the cells are grouped by block, each group holding the block’s genes in order, and every cell is a block cell', () => {
    const markup = bits(sample, infoOf(4, 5));
    expect(markup.match(/class="blk"/g)).toHaveLength(5);
    const texts = [...markup.matchAll(/<span class="blk" data-block="(\d)">((?:<b [^>]*>.<\/b>)+)/g)].map((m) => [Number(m[1]), [...m[2]!.matchAll(/>(.)<\/b>/g)].map((x) => x[1]).join('')]);
    expect(texts).toEqual([[1, '1111'], [2, '0000'], [3, '0100'], [4, '0000'], [5, '1111']]);
    expect(cells(markup).every((c) => c.classes.includes('blocked'))).toBe(true);
    expect(markup).toContain('data-bits="11110000010000001111"');
  });

  test('the cell and gap sizes come from the geometry, so the block row can match them', () => {
    const g = blockGeometry(20);
    const markup = bits(sample, infoOf(4, 5));
    expect(markup).toContain(`--bw:${g.cell}px`);
    expect(markup).toContain(`--bh:${g.height}px`);
    expect(markup).toContain(`--bg:${g.gap}px`);
    expect(markup).toContain(`--bgg:${g.blockGap}px`);
    expect(bits('1'.repeat(30), infoOf(6, 5))).toContain(`--bw:${blockGeometry(30).cell}px`);
  });

  test('loose linkage: the cells stay in their true order, ungrouped', () => {
    const markup = bits(sample, infoOf(4, 5, 'loose'));
    expect(markup).not.toContain('class="blk"');
    expect(cells(markup).map((c) => c.text).join('')).toBe(sample);
    expect(cells(markup).every((c) => c.classes.includes('blocked'))).toBe(true);
  });

  test('says its blocks in the sentence a screen reader reads, after the chromosome', () => {
    expect(label(bits(sample, infoOf(4, 5)))).toBe('Chromosome 11110000010000001111, ones per block 4, 0, 1, 0, 4; scores 4, 3, 2, 3, 4; all ones in blocks 1 and 5; all zeros in blocks 2 and 4');
    expect(label(bits(sample, infoOf(4, 5, 'loose')))).toBe('Chromosome 11110000010000001111, ones per block 1, 2, 2, 2, 2; scores 2, 1, 1, 1, 1; no block is all ones; no block is all zeros');
  });

  test('keeps saying the marks it always said, after the blocks', () => {
    const l = label(bits(sample, infoOf(4, 5), { flipped: [3], cuts: [10] }));
    expect(l).toContain('ones per block 4, 0, 1, 0, 4');
    expect(l).toContain('cut after gene 10');
    expect(l).toContain('gene 3 flipped');
  });

  test('a note under each block: inside the block’s group for tight linkage, with its mark and score', () => {
    const info = infoOf(4, 5);
    const markup = bits(sample, info, { blockNotes: blockNotes(info, sample) });
    expect([...markup.matchAll(/<span class="bnote (\w+)"[^>]*>([^<]*)<\/span>/g)].map((m) => [m[1], m[2]])).toEqual([['optimum', '✓ 4'], ['attractor', '▽ 3'], ['between', '2'], ['attractor', '▽ 3'], ['optimum', '✓ 4']]);
    for (const part of markup.split('class="blk"').slice(1)) expect(part).toContain('class="bnote');
  });

  test('loose linkage prints the notes as one line under the chromosome, each named by its block', () => {
    const info = infoOf(4, 5, 'loose');
    const markup = bits(sample, info, { blockNotes: blockNotes(info, sample) });
    expect(markup).toContain('class="bnotes"');
    expect([...markup.matchAll(/<span class="bnote (\w+)"[^>]*>block (\d): ([^<]*)<\/span>/g)].map((m) => [m[1], Number(m[2]), m[3]])).toEqual([['between', 1, '2'], ['between', 2, '1'], ['between', 3, '1'], ['between', 4, '1'], ['between', 5, '1']]);
    expect(markup).not.toContain('class="blk"');
  });

  test('the notes are hidden from a screen reader, which has the sentence', () => {
    const info = infoOf(4, 5);
    expect(bits(sample, info, { blockNotes: blockNotes(info, sample) })).toMatch(/<span class="bnote[^>]*aria-hidden="true"/);
  });

  test('is unchanged without a trap: no groups, no block cells, no sentence, and a chromosome of another length is left alone', () => {
    for (const markup of [bits(sample, undefined), bits('1111', infoOf(4, 5))]) {
      expect(markup).not.toContain('blk');
      expect(markup).not.toContain('blocked');
      expect(markup).not.toContain('ones per block');
    }
    expect(label(bits('0101', undefined))).toBe('Chromosome 0101');
  });
});

describe('with draws printed under the genes (the mutation cards)', () => {
  const unders = (n: number) => Array.from({ length: n }, () => ({ text: '.281', flag: false }));

  test('each gene column is 8 px wider than its cell, up to 20 genes, and the block row can ask for the same widths', () => {
    const markup = bits(sample, infoOf(4, 5), { unders: unders(20) });
    expect(markup).toContain('--bcw:28px');
    const wide = plain(render(BlockRow as never, { props: { wide: true } as never, context: withBlocks(infoOf(4, 5)) }).body);
    expect([...wide.matchAll(/<span class="brk" style="width:(\d+)px"/g)].map((m) => Number(m[1]))).toEqual(Array(5).fill(groupWidth(4, 20, 8)));
    const wideLoose = plain(render(BlockRow as never, { props: { wide: true } as never, context: withBlocks(infoOf(4, 5, 'loose')) }).body);
    expect(new Set([...wideLoose.matchAll(/<span class="bn b[01]" style="width:(\d+)px"/g)].map((m) => Number(m[1])))).toEqual(new Set([28]));
  });

  test('above 20 genes there is no extra width', () => {
    expect(bits('1'.repeat(30), infoOf(6, 5), { unders: unders(30) })).toContain('--bcw:15px');
  });
});

describe('the block row', () => {
  test('tight: one label per block, “block n”, as wide as its group of cells', () => {
    const markup = blockRow(infoOf(4, 5));
    expect([...markup.matchAll(/<span class="brk" style="width:(\d+)px">([^<]*)<\/span>/g)].map((m) => [m[2], Number(m[1])])).toEqual([1, 2, 3, 4, 5].map((n) => [`block ${n}`, groupWidth(4, 20)]));
    expect(markup).toContain('data-testid="block-row"');
    expect(markup).toContain(`--bgg:${blockGeometry(20).blockGap}px`);
  });

  test('narrow blocks are labelled with just their number', () => {
    expect([...blockRow(infoOf(3, 4)).matchAll(/<span class="brk"[^>]*>([^<]*)<\/span>/g)].map((m) => m[1])).toEqual(['1', '2', '3', '4']);
  });

  test('loose: one numbered cell per gene, the number of the block that owns it, alternate blocks marked differently', () => {
    const markup = blockRow(infoOf(4, 5, 'loose'));
    const labels = [...markup.matchAll(/<span class="bn (b[01])" style="width:(\d+)px">([^<]*)<\/span>/g)].map((m) => [m[3], m[1], Number(m[2])]);
    expect(labels.map((l) => l[0]).join(' ')).toBe('1 2 3 4 5 1 2 3 4 5 1 2 3 4 5 1 2 3 4 5');
    expect(labels.map((l) => l[1]).join(' ')).toBe('b0 b1 b0 b1 b0 b0 b1 b0 b1 b0 b0 b1 b0 b1 b0 b0 b1 b0 b1 b0');
    expect(new Set(labels.map((l) => l[2]))).toEqual(new Set([blockGeometry(20).cell]));
  });

  test('is one sentence for a screen reader (which genes each block owns), with the visible labels hidden from it', () => {
    expect(label(blockRow(infoOf(4, 5)))).toBe('Blocks: block 1 is genes 1 to 4; block 2 is genes 5 to 8; block 3 is genes 9 to 12; block 4 is genes 13 to 16; block 5 is genes 17 to 20');
    expect(label(blockRow(infoOf(4, 2, 'loose')))).toBe('Blocks: block 1 is genes 1, 3, 5 and 7; block 2 is genes 2, 4, 6 and 8');
    expect(blockRow(infoOf(4, 5))).toContain('aria-hidden="true"');
  });

  test('draws nothing without a trap', () => {
    expect(blockRow(undefined)).not.toContain('block-row');
    expect(render(BlockRow as never, { props: {} as never }).body).not.toContain('block-row');
  });
});
