import { render } from 'svelte/server';
import { describe, expect, test } from 'vitest';
import { landscapeProblem, type LandscapeOptions } from '../engine';
import Bits from './Bits.svelte';
import { landscapeContextKey, landscapeInfoOf, type LandscapeInfo } from './landscape-context';
import { groupWidth, variableGeometry } from './landscape-cells';
import VariableRow from './VariableRow.svelte';

const infoOf = (o: Partial<LandscapeOptions> = {}) => landscapeInfoOf(landscapeProblem({ function: 'single-peak', representation: 'real', bitsPerVariable: 10, ...o }));
const withLandscape = (info: LandscapeInfo | undefined) => new Map<unknown, unknown>([[landscapeContextKey, () => info]]);
const plain = (markup: string) => markup.replace(/<!--.*?-->/g, '');
const bits = (chromosome: string, info: LandscapeInfo | undefined, props: Record<string, unknown> = {}) =>
  plain(render(Bits as never, { props: { chromosome, small: true, ...props } as never, context: withLandscape(info) }).body);
const variableRow = (info: LandscapeInfo | undefined) => plain(render(VariableRow as never, { props: {} as never, context: withLandscape(info) }).body);
const label = (markup: string) => /aria-label="([^"]*)"/.exec(markup)![1]!;
const cells = (markup: string) => [...markup.matchAll(/<b class="([^"]*)"[^>]*>(.*?)<\/b>/g)].map((m) => ({ classes: m[1]!.split(' '), text: m[2]! }));

describe('a real-valued chromosome in a landscape screen', () => {
  const real = infoOf();

  test('is drawn as the pair (x, y), each number in a column of its own so the width does not change with the digits or the sign', () => {
    const markup = bits('−2.698 −1.768', real);
    expect(markup).toContain('class="xy"');
    expect([...markup.matchAll(/<span class="xv[^"]*">([^<]*)<\/span>/g)].map((m) => m[1])).toEqual(['−2.698', '−1.768']);
    expect(markup).toContain('data-bits="−2.698 −1.768"');
    expect(cells(markup)).toEqual([]); // no bit cells
    const positive = bits('2.000 1.000', real);
    expect([...positive.matchAll(/<span class="xv[^"]*">([^<]*)<\/span>/g)].map((m) => m[1])).toEqual(['2.000', '1.000']);
  });

  test('says its two numbers in the sentence a screen reader reads', () => {
    expect(label(bits('−2.698 −1.768', real))).toBe('Chromosome x = −2.698, y = −1.768');
  });

  test('keeps the marks it always had: a gene mutation changed is marked on its number and said, genes from parent B are hatched, cuts are said', () => {
    const flipped = bits('−2.698 −1.768', real, { flipped: [2] });
    expect(flipped).toMatch(/<span class="xv flip">−1\.768<\/span>/);
    expect(label(flipped)).toBe('Chromosome x = −2.698, y = −1.768, gene 2 flipped');
    const crossed = bits('−2.698 −1.768', real, { sources: ['A', 'B'], cuts: [1] });
    expect(crossed).toMatch(/<span class="xv hatch">−1\.768<\/span>/);
    expect(label(crossed)).toBe('Chromosome x = −2.698, y = −1.768, gene 2 from parent B, cut after gene 1');
  });

  test('text that is not a pair is drawn as before, so a half-typed chromosome cannot break a view', () => {
    const markup = bits('01', real);
    expect(markup).not.toContain('class="xy"');
    expect(cells(markup).map((c) => c.text)).toEqual(['0', '1']);
  });
});

describe('a binary-coded chromosome in a landscape screen', () => {
  const plainInfo = infoOf({ representation: 'plain', bitsPerVariable: 4 });
  const sample = '11110000';

  test('is drawn as two groups of bits, the x bits and then the y bits, each cell a variable cell', () => {
    const markup = bits(sample, plainInfo);
    expect(markup.match(/class="vgrp"/g)).toHaveLength(2);
    const groups = [...markup.matchAll(/<span class="vgrp" data-variable="(\w)">((?:<b [^>]*>.<\/b>)+)/g)].map((m) => [m[1], [...m[2]!.matchAll(/>(.)<\/b>/g)].map((x) => x[1]).join('')]);
    expect(groups).toEqual([['x', '1111'], ['y', '0000']]);
    expect(cells(bits(sample, plainInfo)).every((c) => c.classes.includes('var'))).toBe(true);
    expect(markup).toContain('data-bits="11110000"');
  });

  test('the cell and gap sizes come from the geometry, so the variable row can match them', () => {
    const g = variableGeometry(4);
    const markup = bits(sample, plainInfo);
    expect(markup).toContain(`--vw:${g.cell}px`);
    expect(markup).toContain(`--vh:${g.height}px`);
    expect(markup).toContain(`--vg:${g.gap}px`);
    expect(markup).toContain(`--vgg:${g.groupGap}px`);
    expect(bits('1'.repeat(24), infoOf({ representation: 'plain', bitsPerVariable: 12 }))).toContain(`--vw:${variableGeometry(12).cell}px`);
  });

  test('says its groups and the point they decode to, then the marks it always said', () => {
    expect(label(bits(sample, plainInfo))).toBe('Chromosome x bits 1111, y bits 0000, decodes to x = 5.000, y = −5.000');
    expect(label(bits(sample, plainInfo, { flipped: [3], cuts: [4] }))).toBe('Chromosome x bits 1111, y bits 0000, decodes to x = 5.000, y = −5.000, cut after gene 4, gene 3 flipped');
    const gray = infoOf({ representation: 'gray', bitsPerVariable: 4 });
    expect(label(bits('10001000', gray))).toBe('Chromosome x bits 1000, y bits 1000, decodes to x = 5.000, y = 5.000');
  });

  test('a flipped gene and a gene from parent B are marked in their cell as for any bit string', () => {
    const markup = bits(sample, plainInfo, { flipped: [2], sources: [...'AAAAABBB'] });
    const c = cells(markup);
    expect(c[1]!.classes).toContain('flip');
    expect(c[5]!.classes).toContain('hatch');
    expect(c[4]!.classes).not.toContain('hatch');
  });

  test('a bit string of the wrong length is drawn as before', () => {
    const markup = bits('101', plainInfo);
    expect(markup).not.toContain('vgrp');
    expect(cells(markup).map((c) => c.text)).toEqual(['1', '0', '1']);
  });
});

describe('a chromosome with no landscape running', () => {
  test('is drawn exactly as it always was', () => {
    const markup = bits('01101', undefined);
    expect(markup).not.toContain('vgrp');
    expect(markup).not.toContain('class="xy"');
    expect(label(markup)).toBe('Chromosome 01101');
    expect(cells(markup).map((c) => c.text)).toEqual(['0', '1', '1', '0', '1']);
  });
});

describe('the variable row above the chromosome columns', () => {
  test('binary-coded: one label over each group, as wide as the group, and one sentence for a screen reader', () => {
    const info = infoOf({ representation: 'plain', bitsPerVariable: 10 });
    const markup = variableRow(info);
    expect(markup).toContain('data-testid="variable-row"');
    expect([...markup.matchAll(/<span class="vlab"[^>]*>([^<]*)<\/span>/g)].map((m) => m[1])).toEqual(['x · 10 bits', 'y · 10 bits']);
    expect([...markup.matchAll(/class="vlab" style="width:(\d+)px"/g)].map((m) => Number(m[1]))).toEqual([groupWidth(10), groupWidth(10)]);
    expect(label(markup)).toBe('Variables: the first 10 bits are x and the next 10 are y; each is read as a whole number in plain binary and scaled onto −5 to 5.');
    expect(markup).toContain(`--vw:${variableGeometry(10).cell}px`);
  });

  test('real-valued: the note says the pair is (x, y); with no landscape, nothing at all', () => {
    expect(variableRow(infoOf())).toContain('(x, y)');
    expect(variableRow(infoOf())).not.toContain('vlab');
    expect(variableRow(undefined)).toBe('');
  });

  test('Gray code says so', () => {
    expect(label(variableRow(infoOf({ representation: 'gray', bitsPerVariable: 8, function: 'rastrigin' })))).toBe(
      'Variables: the first 8 bits are x and the next 8 are y; each is read as a whole number from Gray code and scaled onto −5.12 to 5.12.',
    );
  });
});

describe('clamped and cut genes of a real pair', () => {
  const real = infoOf();

  test('a gene cut to a bound is marked on its number and said; a cut after gene 1 puts a dashed line after x', () => {
    const markup = bits('5.000 −1.768', real, { clamped: [1] });
    expect(markup).toMatch(/<span class="xv clamp">5\.000<\/span>/);
    expect(label(markup)).toBe('Chromosome x = 5.000, y = −1.768, gene 1 clamped to the bound');
    const cut = bits('5.000 −1.768', real, { cuts: [1] });
    expect(cut).toMatch(/<span class="xv cut">5\.000<\/span>/);
  });
});
