import { render } from 'svelte/server';
import { describe, expect, test } from 'vitest';
import { formatBits, gaAlgorithm, goldberg, type GaEvent, type GaParams, type GaSetup, type RunState } from '../engine';
import { createRun, type Run } from '../run';
import Bits from './Bits.svelte';
import CrossoverView from './CrossoverView.svelte';
import MutationView from './MutationView.svelte';
import { crossoverModel, mutationModel } from './variation-models';

const params: GaParams = {
  selection: { method: 'roulette', chain: [{ step: 'identity' }] },
  crossover: { enabled: true, operator: 'one-point', probability: 0.8 },
  mutation: { enabled: true, mode: 'per-gene', probability: 0.05 },
  elites: 0,
  stop: { generationLimit: 50 },
};
const setup: GaSetup = { problem: goldberg, init: { kind: 'explicit', chromosomes: ['01101', '11000', '01000', '10011'] } };
type GaRun = Run<GaSetup, GaParams, RunState, GaEvent>;
const make = (overrides: Partial<GaParams> = {}) => {
  const p = { ...params, ...overrides };
  const run: GaRun = createRun(gaAlgorithm, { setup, params: p, seed: 42 });
  run.forwardCycle();
  return { run, p };
};
const at = (run: GaRun, stage: string, micro: number) => {
  expect(run.moveTo({ cycle: 1, stage: run.layout(1).findIndex((s) => s.stage === stage), micro })).toBe(true);
  return run.view();
};
const html = (component: unknown, props: Record<string, unknown>) => render(component as never, { props: props as never }).body;
const attrValues = (markup: string, name: string) => [...markup.matchAll(new RegExp(`${name}="([^"]*)"`, 'g'))].map((m) => m[1]!);
const text = (markup: string) =>
  markup.replace(/<!--.*?-->/g, '').replace(/<[^>]+>/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

describe('chromosome cells', () => {
  test('hatch the genes that came from parent B, mark cuts and flips, and describe it all to screen readers', () => {
    const markup = html(Bits, { chromosome: '11001', sources: ['A', 'A', 'A', 'A', 'B'], cuts: [4], flipped: [2] });
    expect(attrValues(markup, 'data-sources')).toEqual(['AAAAB']);
    expect(attrValues(markup, 'data-cuts')).toEqual(['4']);
    expect(attrValues(markup, 'data-flipped')).toEqual(['2']);
    expect([...markup.matchAll(/class="bit[^"]*hatch/g)]).toHaveLength(1);
    expect([...markup.matchAll(/class="bit[^"]*flip/g)]).toHaveLength(1);
    expect([...markup.matchAll(/class="bit[^"]*cutafter/g)]).toHaveLength(1);
    const label = attrValues(markup, 'aria-label').find((l) => l.startsWith('Chromosome'))!;
    expect(label).toContain('gene 5 from parent B');
    expect(label).toContain('cut after gene 4');
    expect(label).toContain('gene 2 flipped');
  });

  test('a plain chromosome has none of those marks', () => {
    const markup = html(Bits, { chromosome: '01101' });
    expect(markup).not.toContain('data-sources');
    expect(markup).not.toContain('hatch');
    expect(markup).not.toContain('data-flipped');
  });
});

describe('crossover view', () => {
  test('shows the explanation and one card per pair, waiting until the cursor reaches it', () => {
    const { run, p } = make();
    const markup = html(CrossoverView, { model: crossoverModel(at(run, 'crossover', 0), p.crossover) });
    expect(text(markup)).toContain('u < pc (0.8)');
    expect([...markup.matchAll(/data-state="pending"/g)]).toHaveLength(2);
    expect(text(markup)).toContain('not processed yet');
  });

  test('a revealed pair shows its draw against pc and both parents with both children, equal to the engine’s offspring', () => {
    const { run, p } = make({ crossover: { enabled: true, operator: 'one-point', probability: 1 } });
    const events = run.events(1).flatMap((e) => (e.stage === 'crossover' ? [e] : []));
    const markup = html(CrossoverView, { model: crossoverModel(at(run, 'crossover', 1), p.crossover) });
    const t = text(markup);
    expect(t).toContain(`u = ${Math.round(events[0]!.draw!.u * 1000) / 1000} < pc 1`);
    expect(t).toContain('recombined');
    expect(attrValues(markup, 'data-sources')).toContain(events[0]!.children[0]!.sources.join(''));
    expect(attrValues(markup, 'data-bits')).toContain(formatBits(events[0]!.children[0]!.chromosome));
    expect(attrValues(markup, 'data-bits')).toContain(formatBits(events[0]!.children[1]!.chromosome));
    expect(attrValues(markup, 'data-cuts')).toContain(String(events[0]!.cuts![0]));
    expect(t).toContain(`cut after gene ${events[0]!.cuts![0]}`);
    expect(markup).toContain('data-state="revealed"');
  });

  test('a bypass is labelled with its reason, and its children are labelled as copies', () => {
    const failed = make({ crossover: { enabled: true, operator: 'one-point', probability: 0 } });
    const t = text(html(CrossoverView, { model: crossoverModel(at(failed.run, 'crossover', 1), failed.p.crossover) }));
    expect(t).toContain('BYPASS');
    expect(t).toMatch(/u = [\d.]+ ≥ pc 0/);
    expect(t).toContain('copy of A');
    expect(t).toContain('copy of B');
  });

  test('with crossover switched off every pair is a labelled bypass, not an empty stage', () => {
    const off = make({ crossover: { enabled: false, operator: 'one-point', probability: 0.8 } });
    const markup = html(CrossoverView, { model: crossoverModel(at(off.run, 'crossover', 2), off.p.crossover) });
    const t = text(markup);
    expect(t).toContain('switched off');
    expect(t).toContain('crossover is off');
    expect([...markup.matchAll(/BYPASS/g)]).toHaveLength(2);
    expect(t).not.toMatch(/u = /);
  });

  test('two-point shows two cut lines; uniform names the genes taken from the other parent', () => {
    const two = make({ crossover: { enabled: true, operator: 'two-point', probability: 1 } });
    const twoMarkup = html(CrossoverView, { model: crossoverModel(at(two.run, 'crossover', 1), two.p.crossover) });
    expect(attrValues(twoMarkup, 'data-cuts').some((c) => c.includes(','))).toBe(true);
    expect(text(twoMarkup)).toMatch(/cuts after genes \d and \d/);

    const uniform = make({ crossover: { enabled: true, operator: 'uniform', probability: 1 } });
    const uniMarkup = html(CrossoverView, { model: crossoverModel(at(uniform.run, 'crossover', 1), uniform.p.crossover) });
    expect(attrValues(uniMarkup, 'data-cuts')).toEqual([]);
    expect(text(uniMarkup)).toMatch(/genes? [\d, and]+ taken from the other parent|no gene taken from the other parent/);
  });

  test('a dropped child is dimmed and labelled', () => {
    const { run, p } = make({ elites: 1 });
    const markup = html(CrossoverView, { model: crossoverModel(at(run, 'crossover', 2), p.crossover) });
    expect(text(markup)).toContain('dropped');
    expect([...markup.matchAll(/data-dropped="true"/g)]).toHaveLength(1);
  });

  test('a key explains the marks', () => {
    const { run, p } = make();
    const t = text(html(CrossoverView, { model: crossoverModel(at(run, 'crossover', 1), p.crossover) }));
    expect(t).toContain('hatched');
    expect(t).toContain('parent B');
    expect(t).toContain('dashed line');
  });
});

describe('mutation view', () => {
  test('per-gene: a column per gene, every draw shown, flips marked with ✱, an outline class and a label', () => {
    const { run, p } = make({ mutation: { enabled: true, mode: 'per-gene', probability: 0.5 } });
    const events = run.events(1).flatMap((e) => (e.stage === 'mutation' ? [e] : []));
    const markup = html(MutationView, { model: mutationModel(at(run, 'mutation', events.length), p.mutation) });
    const t = text(markup);
    expect(t).toContain('Every gene');
    for (const g of [1, 2, 3, 4, 5]) expect(t).toContain(`gene ${g}`);
    const flippedGenes = events.flatMap((e) => e.flipped);
    expect(flippedGenes.length).toBeGreaterThan(0);
    expect([...markup.matchAll(/class="[^"]*flipcell/g)]).toHaveLength(flippedGenes.length);
    expect(t).toMatch(/✱ gene \d: [01] → [01]|✱ genes? [\d, and]+ flipped/);
    expect(attrValues(markup, 'data-flipped').length).toBeGreaterThan(0);
    for (const event of events) expect(attrValues(markup, 'data-bits')).toContain(formatBits(event.after));
  });

  test('a single flip is described with the gene’s real before and after bit', () => {
    const { run, p } = make({ mutation: { enabled: true, mode: 'per-gene', probability: 0.2 } });
    const events = run.events(1).flatMap((e) => (e.stage === 'mutation' ? [e] : []));
    const t = text(html(MutationView, { model: mutationModel(at(run, 'mutation', events.length), p.mutation) }));
    const singles = events.filter((e) => e.flipped.length === 1);
    expect(singles.length).toBeGreaterThan(0);
    for (const e of singles) {
      const g = e.flipped[0]!;
      expect(t).toContain(`✱ gene ${g}: ${formatBits(e.before)[g - 1]} → ${formatBits(e.after)[g - 1]}`);
    }
  });

  test('offspring not yet reached are waiting, with their chromosome as crossover left it', () => {
    const { run, p } = make();
    const markup = html(MutationView, { model: mutationModel(at(run, 'mutation', 1), p.mutation) });
    expect([...markup.matchAll(/data-state="pending"/g)]).toHaveLength(mutationModel(at(run, 'mutation', 1), p.mutation).rows.length - 1);
    expect(text(markup)).toContain('not yet drawn');
  });

  test('per-individual: shows the individual draw and the chosen gene, not a column per gene', () => {
    const { run, p } = make({ mutation: { enabled: true, mode: 'per-individual', probability: 1 } });
    const n = mutationModel(at(run, 'mutation', 0), p.mutation).rows.length;
    const markup = html(MutationView, { model: mutationModel(at(run, 'mutation', n), p.mutation) });
    const t = text(markup);
    expect(t).toContain('one more draw picks the single gene');
    expect(t).toMatch(/u = [\d.]+ < pm 1/);
    expect(t).toMatch(/gene \d \(r = [\d.]+\)/);
    expect(t).not.toContain('gene 5 gene');
  });

  test('with mutation switched off every offspring is a labelled bypass, unchanged', () => {
    const { run, p } = make({ mutation: { enabled: false, mode: 'per-gene', probability: 0.05 } });
    const n = mutationModel(at(run, 'mutation', 0), p.mutation).rows.length;
    const markup = html(MutationView, { model: mutationModel(at(run, 'mutation', n), p.mutation) });
    const t = text(markup);
    expect(t).toContain('switched off');
    expect([...markup.matchAll(/bypassed: mutation is off/g)]).toHaveLength(n);
    expect(markup).not.toContain('flipcell');
  });
});
