import { render } from 'svelte/server';
import { describe, expect, test } from 'vitest';
import BlockStatesStrip from './BlockStatesStrip.svelte';
import { describeBlockStates, type BlockStatesModel } from './block-states-model';

const model = (blocks: number): BlockStatesModel => ({
  generation: 4,
  size: 12,
  blocks: Array.from({ length: blocks }, (_, b) => ({ block: b + 1, optimum: b % 3, between: 12 - (b % 3) - (b % 5), attractor: b % 5 })),
  history: [0, 1, 2, 3, 4].map((generation) => ({ generation, optimum: generation, attractor: 2 * generation })),
  historyText: 'blocks at all zeros, generations 0–4: 0 · 2 · 4 · 6 · 8',
});
const html = (m: BlockStatesModel) => render(BlockStatesStrip as never, { props: { model: m } as never }).body.replace(/<!--.*?-->/g, '');

describe('the block states strip', () => {
  test('has a row per block with its three counts as data and as printed figures with their marks', () => {
    const m = model(5);
    const markup = html(m);
    const rows = [...markup.matchAll(/data-block="(\d+)" data-optimum="(\d+)" data-between="(\d+)" data-attractor="(\d+)"/g)].map((r) => r.slice(1).map(Number));
    expect(rows).toEqual(m.blocks.map((c) => [c.block, c.optimum, c.between, c.attractor]));
    expect([...markup.matchAll(/<span class="bsnum"[^>]*><b>✓ (\d+)<\/b> · (\d+) · <b>▽ (\d+)<\/b>/g)].map((r) => r.slice(1).map(Number))).toEqual(m.blocks.map((c) => [c.optimum, c.between, c.attractor]));
  });

  test('the bar of a block shares its width by the counts: solid for all ones, empty for in between, hatched for all zeros; a count of zero has no segment', () => {
    const markup = html(model(5));
    const first = markup.split('data-block="').slice(1);
    expect(first[0]).toContain('class="sg mid" style="flex:12"');
    expect(first[0]).not.toContain('sg opt');
    expect(first[0]).not.toContain('sg att');
    expect(first[4]).toMatch(/sg opt" style="flex:1"[^]*sg mid" style="flex:7"[^]*sg att" style="flex:4"/);
  });

  test('says all of it in one sentence for a screen reader, with the bars and the figures hidden from it', () => {
    const m = model(2);
    const markup = html(m);
    expect(markup).toContain(`aria-label="${describeBlockStates(m)}"`);
    expect(markup).toContain('class="bsbar" aria-hidden="true"');
    expect(markup).toContain('class="bsnum" aria-hidden="true"');
  });

  test('prints the history line and has a hidden table with every recorded generation', () => {
    const markup = html(model(3));
    expect(markup).toContain('data-testid="block-history">blocks at all zeros, generations 0–4: 0 · 2 · 4 · 6 · 8</p>');
    expect([...markup.matchAll(/<tr><td>(\d)<\/td><td>(\d+)<\/td><td>(\d+)<\/td><\/tr>/g)].map((r) => r.slice(1).map(Number))).toEqual([0, 1, 2, 3, 4].map((g) => [g, g, 2 * g]));
    expect(markup).toContain('class="sr-only"');
  });

  test('the key is printed for up to five blocks, and the rows get lower as there are more of them', () => {
    expect(html(model(5))).toContain('class="bskey"');
    expect(html(model(6))).not.toContain('bskey');
    expect(html(model(1))).toContain('--bsrow:22px');
    expect(html(model(5))).toContain('--bsrow:22px');
    expect(html(model(10))).toContain('--bsrow:13px');
  });
});
