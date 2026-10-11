import { render } from 'svelte/server';
import { describe, expect, test } from 'vitest';
import { gaAlgorithm, trapDefaults, trapProblem, type GaEvent, type GaParams, type GaSetup, type Linkage, type RunState } from '../engine';
import { createRun, type Run } from '../run';
import { blockContextKey, blockInfoOf, type BlockInfo } from './block-context';
import { blockMutation, describeCancel, describeChange } from './block-model';
import MutationView from './MutationView.svelte';
import { mutationModel } from './variation-models';

type GaRun = Run<GaSetup, GaParams, RunState, GaEvent>;
const infoOf = (blockSize: number, blocks: number, linkage: Linkage = 'tight') => blockInfoOf(trapProblem({ blockSize, blocks, linkage }));
const tight = infoOf(4, 5);

describe('what a mutation did to the blocks', () => {
  test('a block whose number of 1s changed is reported with its genes before and after and its score before and after', () => {
    const before = '11110000000000000000';
    const after = '11100000000000000000';
    const m = blockMutation(tight, before, after);
    expect(m.changed).toEqual([{ block: 1, before: '1111', after: '1110', from: 4, to: 0 }]);
    expect(m.cancelled).toEqual([]);
    expect(describeChange(m.changed[0]!)).toBe('block 1: 1111 → 1110 · 4 → 0');
  });

  test('two flips inside one block that leave its number of 1s as it was cancel: the block is reported as touched but not changed', () => {
    // block 3 (genes 9 to 12) 0100 → 0010: gene 10 off, gene 11 on
    const before = '00000000010000000000';
    const after = '00000000001000000000';
    const m = blockMutation(tight, before, after);
    expect(m.changed).toEqual([]);
    expect(m.cancelled).toEqual([{ block: 3, genes: [10, 11], ones: 1, score: 2 }]);
    expect(describeCancel(m.cancelled[0]!)).toBe('block 3: genes 10 and 11 flipped but the block still has 1 one, so it still scores 2');
  });

  test('several blocks at once, each reported once in block order, and a block that was not touched is not mentioned', () => {
    const before = '11110000010000000000';
    const after = '01110000011000000001';
    const m = blockMutation(tight, before, after);
    expect(m.changed.map((c) => [c.block, c.before, c.after, c.from, c.to])).toEqual([
      [1, '1111', '0111', 4, 0],
      [3, '0100', '0110', 2, 1],
      [5, '0000', '0001', 3, 2],
    ]);
    expect(m.cancelled).toEqual([]);
  });

  test('loose linkage reads each block’s genes in the block’s own order, not the chromosome’s', () => {
    const loose = infoOf(4, 5, 'loose');
    const before = '00000000000000000000';
    const after = '10000100000000000000'; // genes 1 and 6 on: both belong to block 1 (genes 1, 6, 11, 16)
    const m = blockMutation(loose, before, after);
    expect(m.changed).toEqual([{ block: 1, before: '0000', after: '1100', from: 3, to: 1 }]);
  });

  test('nothing for equal chromosomes or for text that is not a chromosome of the trap', () => {
    expect(blockMutation(tight, '11110000000000000000', '11110000000000000000')).toEqual({ changed: [], cancelled: [] });
    expect(blockMutation(tight, '1111', '1110')).toEqual({ changed: [], cancelled: [] });
  });
});

describe('the changed blocks equal a direct recomputation of every block, over generated runs', () => {
  const make = (linkage: Linkage, mode: 'per-gene' | 'per-individual', seed: number, probability: number) => {
    const problem = trapProblem({ blockSize: 4, blocks: 5, linkage });
    const params: GaParams = { ...trapDefaults.params, mutation: { enabled: true, mode, probability }, stop: { generationLimit: 50 } };
    const run: GaRun = createRun(gaAlgorithm, { setup: { problem, init: { kind: 'random', size: 10 } }, params, seed });
    run.forwardCycle();
    return { run, params, info: blockInfoOf(problem), problem };
  };

  test.each(['tight', 'loose'] as const)('%s, both modes, many seeds: changed, cancelled and untouched blocks partition correctly', (linkage) => {
    let changedCount = 0;
    let cancelledCount = 0;
    for (const mode of ['per-gene', 'per-individual'] as const) {
      for (let seed = 1; seed <= 15; seed++) {
        const { run, info, problem } = make(linkage, mode, seed, mode === 'per-gene' ? 0.15 : 0.8);
        for (const e of run.events(1)) {
          if (e.stage !== 'mutation') continue;
          const m = blockMutation(info, e.before.join(''), e.after.join(''));
          const direct = problem.outcomeOf(e.before);
          const directAfter = problem.outcomeOf(e.after);
          const expectedChanged = direct.blocks.flatMap((b, i) => (b.contribution !== directAfter.blocks[i]!.contribution ? [b.index + 1] : []));
          expect(m.changed.map((c) => c.block)).toEqual(expectedChanged);
          m.changed.forEach((c) => {
            expect(c.from).toBe(direct.blocks[c.block - 1]!.contribution);
            expect(c.to).toBe(directAfter.blocks[c.block - 1]!.contribution);
          });
          // a block with flipped genes is either changed or cancelled, never both and never neither
          const flippedBlocks = new Set(e.flipped.map((g) => info.blockGenes.findIndex((genes) => genes.includes(g - 1)) + 1));
          expect([...flippedBlocks].sort((a, b) => a - b)).toEqual([...m.changed.map((c) => c.block), ...m.cancelled.map((c) => c.block)].sort((a, b) => a - b));
          for (const c of m.cancelled) expect(c.genes.length).toBeGreaterThanOrEqual(2);
          changedCount += m.changed.length;
          cancelledCount += m.cancelled.length;
        }
      }
    }
    expect(changedCount).toBeGreaterThan(20);
    expect(cancelledCount).toBeGreaterThan(0);
  });
});

describe('the mutation view of a trap', () => {
  const html = (info: BlockInfo, model: ReturnType<typeof mutationModel>) =>
    render(MutationView as never, { props: { model } as never, context: new Map<unknown, unknown>([[blockContextKey, () => info]]) }).body.replace(/<!--.*?-->/g, '');
  const find = (mode: 'per-gene' | 'per-individual', linkage: Linkage, wanted: 'changed' | 'cancelled' | 'bypass') => {
    for (let seed = 1; seed <= 80; seed++) {
      const problem = trapProblem({ blockSize: 4, blocks: 5, linkage });
      const params: GaParams = {
        ...trapDefaults.params,
        mutation: { enabled: wanted !== 'bypass', mode, probability: mode === 'per-gene' ? 0.25 : 0.9 },
        stop: { generationLimit: 50 },
      };
      const run: GaRun = createRun(gaAlgorithm, { setup: { problem, init: { kind: 'random', size: 10 } }, params, seed }, { eventCacheSize: 100 });
      run.forwardCycle();
      const info = blockInfoOf(problem);
      const events = run.events(1).filter((e) => e.stage === 'mutation');
      const hit = events.some((e) => {
        if (e.stage !== 'mutation') return false;
        if (wanted === 'bypass') return true;
        const m = blockMutation(info, e.before.join(''), e.after.join(''));
        return wanted === 'changed' ? m.changed.length > 0 : m.cancelled.length > 0;
      });
      if (!hit) continue;
      const index = run.layout(1).findIndex((s) => s.stage === 'mutation');
      run.moveTo({ cycle: 1, stage: index, micro: events.length });
      return { markup: html(info, mutationModel(run.view(), params.mutation)), run, info, params };
    }
    throw new Error('no seed found');
  };

  test('says under a changed block what it was and became, with its score', () => {
    const { markup } = find('per-gene', 'tight', 'changed');
    const found = [...markup.matchAll(/data-testid="block-change"[^>]*>(?:<span[^>]*>[^<]*<\/span>)?\s*([^<]*)</g)];
    expect(found.length).toBeGreaterThan(0);
    for (const m of found) expect(m[1]).toMatch(/block \d+: [01]{4} → [01]{4} · \d → \d/);
  });

  test('says when flips inside a block cancel, in words', () => {
    const { markup } = find('per-gene', 'tight', 'cancelled');
    expect(markup).toMatch(/data-testid="block-cancel"[^>]*>(?:<span[^>]*>[^<]*<\/span>)?\s*block \d+: genes [\d, and]+ flipped but the block still has \d ones?, so it still scores \d/);
  });

  test('works the same for per-individual mutation and for loose linkage', () => {
    expect(find('per-individual', 'tight', 'changed').markup).toContain('block-change');
    expect(find('per-gene', 'loose', 'changed').markup).toContain('block-change');
  });

  test('a bypassed mutation (switched off) has no block marks', () => {
    const { markup } = find('per-gene', 'tight', 'bypass');
    expect(markup).not.toContain('block-change');
    expect(markup).not.toContain('block-cancel');
  });

  test('without a trap the view has no block marks', () => {
    const { run, params } = find('per-gene', 'tight', 'changed');
    const markup = render(MutationView as never, { props: { model: mutationModel(run.view(), params.mutation) } as never }).body;
    expect(markup).not.toContain('block-change');
  });
});
