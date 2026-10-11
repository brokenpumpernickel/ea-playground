import { render } from 'svelte/server';
import { describe, expect, test } from 'vitest';
import { gaAlgorithm, trapDefaults, trapProblem, type GaEvent, type GaParams, type GaSetup, type Linkage, type RunState } from '../engine';
import { createRun, type Run } from '../run';
import { blockContextKey, blockInfoOf, type BlockInfo } from './block-context';
import { blockOriginNotes, blockOrigins, blockSplitSummary } from './block-model';
import CrossoverView from './CrossoverView.svelte';
import { crossoverModel } from './variation-models';

type GaRun = Run<GaSetup, GaParams, RunState, GaEvent>;
const operators = ['one-point', 'two-point', 'uniform'] as const;
const make = (linkage: Linkage, operator: (typeof operators)[number], seed: number, probability = 0.9, enabled = true, blockSize = 4, blocks = 5) => {
  const problem = trapProblem({ blockSize, blocks, linkage });
  const params: GaParams = { ...trapDefaults.params, crossover: { enabled, operator, probability }, stop: { generationLimit: 50 } };
  const run: GaRun = createRun(gaAlgorithm, { setup: { problem, init: { kind: 'random', size: 10 } }, params, seed });
  run.forwardCycle();
  return { run, params, info: blockInfoOf(problem) };
};
const crossoverEvents = (run: GaRun) => run.events(1).flatMap((e) => (e.stage === 'crossover' ? [e] : []));

describe('where each block of a child came from', () => {
  const info = blockInfoOf(trapProblem({ blockSize: 4, blocks: 5, linkage: 'tight' }));
  const A = 'A' as const;
  const B = 'B' as const;

  test('a block is whole from A, whole from B, or split when its genes come from both', () => {
    // a cut after gene 10 (inside block 3): blocks 1 and 2 from A, 3 split, 4 and 5 from B
    const sources = [...Array(10).fill(A), ...Array(10).fill(B)];
    expect(blockOrigins(info, sources)).toEqual(['A', 'A', 'split', 'B', 'B']);
  });

  test('a cut exactly between two blocks splits none', () => {
    expect(blockOrigins(info, [...Array(8).fill(A), ...Array(12).fill(B)])).toEqual(['A', 'A', 'B', 'B', 'B']);
  });

  test('loose linkage: one cut after gene 9 splits every block, because each block has genes on both sides', () => {
    const loose = blockInfoOf(trapProblem({ blockSize: 4, blocks: 5, linkage: 'loose' }));
    expect(blockOrigins(loose, [...Array(9).fill(A), ...Array(11).fill(B)])).toEqual(['split', 'split', 'split', 'split', 'split']);
  });

  test('the notes say it with a shape and a word: ● A, ▨ B, ◧ split', () => {
    const sources = [...Array(10).fill(A), ...Array(10).fill(B)];
    expect(blockOriginNotes(info, sources)).toEqual([
      { block: 1, text: '● A', state: 'whole-a' },
      { block: 2, text: '● A', state: 'whole-a' },
      { block: 3, text: '◧ split', state: 'split' },
      { block: 4, text: '▨ B', state: 'whole-b' },
      { block: 5, text: '▨ B', state: 'whole-b' },
    ]);
  });

  test('the summary counts the blocks split by the cut and the blocks that came whole', () => {
    expect(blockSplitSummary(['A', 'A', 'split', 'B', 'B'])).toEqual({ whole: 4, split: 1, text: '1 of 5 blocks split' });
    expect(blockSplitSummary(['A', 'B', 'B'])).toEqual({ whole: 3, split: 0, text: 'no block split' });
    expect(blockSplitSummary(['split'])).toEqual({ whole: 0, split: 1, text: '1 of 1 block split' });
  });

  test('a source list of the wrong length gives nothing', () => {
    expect(blockOrigins(info, ['A', 'B'])).toEqual([]);
    expect(blockOriginNotes(info, ['A'])).toEqual([]);
  });
});

describe('the verdicts equal what the recorded swap mask gives, for every operator, both linkages and bypasses', () => {
  test.each(['tight', 'loose'] as const)('%s: over many seeds, every child and every block', (linkage) => {
    let recombined = 0;
    let bypassed = 0;
    let splits = 0;
    for (const operator of operators) {
      for (let seed = 1; seed <= 12; seed++) {
        const { run, info } = make(linkage, operator, seed, 0.7);
        for (const e of crossoverEvents(run)) {
          if (e.decision === 'recombined') recombined++;
          else bypassed++;
          for (const child of e.children) {
            const verdicts = blockOrigins(info, child.sources);
            expect(verdicts).toHaveLength(5);
            info.blockGenes.forEach((genes, b) => {
              const fromA = genes.filter((g) => child.sources[g] === 'A').length;
              const expected = fromA === genes.length ? 'A' : fromA === 0 ? 'B' : 'split';
              expect(verdicts[b], `${operator} ${linkage} seed ${seed} block ${b + 1}`).toBe(expected);
              if (expected === 'split') splits++;
            });
            // the second child is the first one's complement, so it splits exactly the same blocks
            const other = blockOrigins(info, e.children[0]!.sources);
            expect(verdicts.map((v) => v === 'split')).toEqual(other.map((v) => v === 'split'));
          }
        }
      }
    }
    expect(recombined).toBeGreaterThan(20);
    expect(bypassed).toBeGreaterThan(5);
    expect(splits).toBeGreaterThan(20);
  });

  test('a bypassed pair gives copies: every block of the first child is whole from A and of the second whole from B', () => {
    const { run, info } = make('tight', 'one-point', 3, 0, true);
    for (const e of crossoverEvents(run)) {
      expect(e.decision).toBe('bypassed');
      expect(blockOrigins(info, e.children[0]!.sources).every((v) => v === 'A')).toBe(true);
      expect(blockOrigins(info, e.children[1]!.sources).every((v) => v === 'B')).toBe(true);
    }
  });
});

describe('the crossover view of a trap', () => {
  const html = (info: BlockInfo, model: ReturnType<typeof crossoverModel>) =>
    render(CrossoverView as never, { props: { model } as never, context: new Map<unknown, unknown>([[blockContextKey, () => info]]) }).body.replace(/<!--.*?-->/g, '');
  const viewOf = (run: GaRun, micro: number) => {
    const index = run.layout(1).findIndex((s) => s.stage === 'crossover');
    run.moveTo({ cycle: 1, stage: index, micro });
    return run.view();
  };

  test('prints a note under every block of every child of a recombined pair, and a summary in the pair’s header', () => {
    const { run, params, info } = make('tight', 'one-point', 5, 1);
    const model = crossoverModel(viewOf(run, 1), params.crossover, undefined);
    const markup = html(info, model);
    const children = markup.split('data-child=').slice(1);
    expect(children.length).toBeGreaterThanOrEqual(2);
    for (const child of children) expect([...child.matchAll(/class="bnote (whole-a|whole-b|split)"/g)]).toHaveLength(5);
    expect(markup).toMatch(/data-testid="block-split"[^>]*>(<span[^>]*>[^<]*<\/span>)?\s*(\d of 5 blocks split|no block split)/);
    expect(markup).toContain('data-testid="block-row"');
  });

  test('the notes in the markup are the model’s verdicts for that child', () => {
    const { run, params, info } = make('loose', 'one-point', 6, 1);
    const model = crossoverModel(viewOf(run, 1), params.crossover, undefined);
    const markup = html(info, model);
    const pair = model.pairs[0]!;
    const expected = pair.children.map((c) => blockOrigins(info, c.sources).map((v) => (v === 'A' ? 'whole-a' : v === 'B' ? 'whole-b' : 'split')));
    const found = markup
      .split('data-child=')
      .slice(1, 1 + pair.children.length)
      .map((part) => [...part.matchAll(/class="bnote (whole-a|whole-b|split)"/g)].map((m) => m[1]));
    expect(found).toEqual(expected);
  });

  test('a bypassed pair has no block marks and no summary (its children are copies)', () => {
    const { run, params, info } = make('tight', 'one-point', 3, 0);
    const markup = html(info, crossoverModel(viewOf(run, 1), params.crossover, undefined));
    expect(markup).toContain('BYPASS');
    expect(markup).not.toContain('bnote');
    expect(markup).not.toContain('block-split');
  });

  test('without a trap the view has no block marks and no block row', () => {
    const { run, params } = make('tight', 'one-point', 5, 1);
    const markup = render(CrossoverView as never, { props: { model: crossoverModel(viewOf(run, 1), params.crossover, undefined) } as never }).body;
    expect(markup).not.toContain('bnote');
    expect(markup).not.toContain('block-row');
  });
});
