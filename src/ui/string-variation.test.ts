import { render } from 'svelte/server';
import { describe, expect, test } from 'vitest';
import { gaAlgorithm, targetStringProblem, type GaEvent, type GaParams, type GaSetup, type MutationEvent, type RunState } from '../engine';
import { createRun, type Run } from '../run';
import { describer } from './describe';
import { displayOf } from './format';
import MutationView from './MutationView.svelte';
import CrossoverView from './CrossoverView.svelte';
import { targetContextKey } from './target-context';
import { crossoverModel, mutationModel } from './variation-models';

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ ';
const problem = targetStringProblem({ alphabet, target: 'HELLO' });
const display = displayOf(problem);
const base: GaParams = {
  selection: { method: 'tournament', size: 3 },
  crossover: { enabled: true, operator: 'one-point', probability: 1 },
  mutation: { enabled: true, mode: 'per-gene', probability: 0.3 },
  elites: 0,
  stop: { generationLimit: 50 },
};
const setup: GaSetup = { problem, init: { kind: 'explicit', chromosomes: ['HELLO', 'JELLY', 'HI YO', 'ZZ ZZ', 'ABCDE', 'LLEHO'] } };
type GaRun = Run<GaSetup, GaParams, RunState, GaEvent>;
const make = (overrides: Partial<GaParams> = {}, seed = 3) => {
  const params = { ...base, ...overrides };
  const run: GaRun = createRun(gaAlgorithm, { setup, params, seed });
  run.forwardCycle();
  return { run, params };
};
const at = (run: GaRun, stage: string, micro: number) => {
  expect(run.moveTo({ cycle: 1, stage: run.layout(1).findIndex((s) => s.stage === stage), micro })).toBe(true);
  return run.view();
};
const mutations = (run: GaRun) => run.events(1).flatMap((e): MutationEvent[] => (e.stage === 'mutation' ? [e] : []));
const html = (component: unknown, props: Record<string, unknown>) =>
  render(component as never, { props: props as never, context: new Map<unknown, unknown>([[targetContextKey, () => 'HELLO']]) }).body;
const text = (markup: string) =>
  markup.replace(/<!--.*?-->/g, '').replace(/<[^>]+>/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const attrs = (markup: string, name: string) => [...markup.matchAll(new RegExp(`${name}="([^"]*)"`, 'g'))].map((m) => m[1]!);
const sym = (gene: number) => display.show([gene]).replace(/ /g, '␣');
const round = (x: number) => Math.round(x * 1000) / 1000;
const full = (run: GaRun, params: GaParams) => {
  const n = mutationModel(at(run, 'mutation', 0), params.mutation, display).rows.length;
  return mutationModel(at(run, 'mutation', n), params.mutation, display);
};

describe('mutation view with 27 symbols, per gene', () => {
  const { run, params } = make();
  const events = mutations(run);
  const model = full(run, params);
  const markup = html(MutationView, { model });

  test('the run used for these tests has flips, and every flip has its replacement draw', () => {
    expect(events.flatMap((e) => e.flipped).length).toBeGreaterThan(1);
    for (const e of events) expect(e.replacements?.map((r) => r.gene) ?? []).toEqual(e.flipped);
  });

  test('says that a flipped gene becomes a different symbol picked by a draw r from the other 26', () => {
    expect(text(markup)).toContain('Every gene of every offspring gets its own draw u; the gene flips if u < pm (0.3).');
    expect(text(markup)).toContain('A gene that flips becomes a different symbol: one more draw r picks it from the other 26, in alphabet order.');
  });

  test('draws one draw under every gene of every offspring, equal to the engine’s, and flags exactly the flipped genes', () => {
    expect(attrs(markup, 'data-u')).toHaveLength(events.length * 5);
    expect(attrs(markup, 'data-u').map(Number)).toEqual(events.flatMap((e) => e.geneDraws!.map((d) => d.u)));
    expect([...markup.matchAll(/class="under flag"/g)]).toHaveLength(events.flatMap((e) => e.flipped).length);
    for (const e of events) for (const d of e.geneDraws!) expect(text(markup)).toContain(`${round(d.u)}`);
  });

  test('labels each change old → new with its replacement draw, and the result row is the engine’s final chromosome', () => {
    for (const e of events) {
      for (const r of e.replacements ?? []) {
        expect(text(markup)).toContain(`gene ${r.gene}: ${sym(r.from)} → ${sym(r.to)} (r = ${round(r.r)})`);
        expect(r.to).not.toBe(r.from); // a mutated gene visibly changes
      }
      expect(attrs(markup, 'data-bits')).toContain(display.show(e.after));
      expect(attrs(markup, 'data-bits')).toContain(display.show(e.before));
    }
  });

  test('prints the target once above the offspring', () => {
    expect([...markup.matchAll(/data-testid="target-row"/g)]).toHaveLength(1);
  });

  test('an unchanged offspring says so', () => {
    expect(events.some((e) => e.decision === 'unchanged')).toBe(true);
    expect([...text(markup).matchAll(/unchanged/g)].length).toBeGreaterThanOrEqual(events.filter((e) => e.decision === 'unchanged').length);
  });
});

describe('mutation view with 27 symbols, per individual', () => {
  const { run, params } = make({ mutation: { enabled: true, mode: 'per-individual', probability: 0.7 } }, 5);
  const events = mutations(run);
  const markup = html(MutationView, { model: full(run, params) });

  test('shows the individual draw, the chosen gene with its draw and the replacement draw r, as recorded', () => {
    expect(events.some((e) => e.decision === 'mutated')).toBe(true);
    const t = text(markup);
    expect(t).toContain('one more draw picks the single gene');
    expect(t).toContain('one more draw r picks it from the other 26');
    for (const e of events) {
      expect(t).toContain(`u = ${round(e.individualDraw!.u)} ${e.chosenGene ? '<' : '≥'} pm 0.7`);
      if (!e.chosenGene) continue;
      expect(t).toContain(`gene ${e.chosenGene.gene} (r = ${round(e.chosenGene.r)})`);
      const rep = e.replacements!.find((x) => x.gene === e.chosenGene!.gene)!;
      expect(t).toContain(`gene ${rep.gene}: ${sym(rep.from)} → ${sym(rep.to)} (r = ${round(rep.r)})`);
      expect(attrs(markup, 'data-bits')).toContain(display.show(e.after));
    }
  });

  test('keeps the table of draws (no draw cell per gene), with the target above the offspring', () => {
    expect(markup).toContain('class="mtable"');
    expect(markup).not.toContain('class="under');
    expect([...markup.matchAll(/data-testid="target-row"/g)]).toHaveLength(1);
  });
});

describe('mutation switched off, with letters', () => {
  test('every offspring is a labelled bypass and nothing is drawn', () => {
    const { run, params } = make({ mutation: { enabled: false, mode: 'per-gene', probability: 0.3 } });
    const markup = html(MutationView, { model: full(run, params) });
    expect(text(markup)).toContain('Mutation is switched off');
    expect([...markup.matchAll(/bypassed: mutation is off/g)]).toHaveLength(mutations(run).length);
    expect(markup).not.toContain('data-u=');
    for (const e of mutations(run)) expect(e.replacements).toBeUndefined();
  });
});

describe('two symbols', () => {
  test('the explanation has no replacement draw in it', () => {
    const { run, params } = make();
    const m = mutationModel(at(run, 'mutation', 1), params.mutation, { ...display, alphabetSize: 2 });
    expect(m.multiSymbol).toBe(false);
    expect(m.explanation).toBe('Every gene of every offspring gets its own draw u; the gene flips if u < pm (0.3).');
  });
});

describe('crossover on letters', () => {
  test('cards show the strings with hatching and cuts, the target row above each side, bypass and copies labelled', () => {
    const { run, params } = make();
    const events = run.events(1).flatMap((e) => (e.stage === 'crossover' ? [e] : []));
    const markup = html(CrossoverView, { model: crossoverModel(at(run, 'crossover', events.length), params.crossover, display) });
    for (const e of events) {
      for (const c of e.children) expect(attrs(markup, 'data-bits')).toContain(display.show(c.chromosome));
      expect(attrs(markup, 'data-cuts')).toContain(String(e.cuts![0]));
    }
    expect(attrs(markup, 'data-sources').some((s) => s.includes('B'))).toBe(true);
    expect([...markup.matchAll(/data-testid="target-row"/g)]).toHaveLength(events.length * 2);

    const bypass = make({ crossover: { enabled: false, operator: 'one-point', probability: 1 } });
    const t = text(html(CrossoverView, { model: crossoverModel(at(bypass.run, 'crossover', events.length), bypass.params.crossover, display) }));
    expect(t).toContain('BYPASS');
    expect(t).toContain('copy of A');
  });
});

describe('narration of a mutation with letters', () => {
  test('names the old and new symbol and the draw r, so the sentence matches the view', () => {
    const { run } = make();
    const describe = describer(display);
    const flips = mutations(run).filter((e) => e.replacements);
    expect(flips.length).toBeGreaterThan(0);
    for (const e of flips) for (const r of e.replacements!) expect(describe(e)).toContain(`gene ${r.gene}: ${display.show([r.from])} → ${display.show([r.to])} (r = ${round(r.r)})`);
  });
});
