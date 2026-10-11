import { render } from 'svelte/server';
import { describe, expect, test } from 'vitest';
import { formatBits, gaAlgorithm, goldberg, type GaEvent, type GaParams, type GaSetup, type RunState } from '../engine';
import { createRun, type Run } from '../run';
import EvaluationView from './EvaluationView.svelte';
import { evaluationModel, replacementModel } from './outcome-models';
import ReplacementView from './ReplacementView.svelte';

const params: GaParams = {
  selection: { method: 'roulette', chain: [{ step: 'identity' }] },
  crossover: { enabled: true, operator: 'one-point', probability: 0.8 },
  mutation: { enabled: true, mode: 'per-gene', probability: 0.3 },
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
const events = (run: GaRun) => run.events(1);

describe('evaluation view', () => {
  test('unscored offspring wait; scored ones show chromosome, x, objective, fitness and the new individual number', () => {
    const { run } = make();
    const scored = events(run).flatMap((e) => (e.stage === 'evaluation' ? [e] : []));
    const markup = html(EvaluationView, { model: evaluationModel(at(run, 'evaluation', 2)) });
    expect([...markup.matchAll(/data-state="revealed"/g)]).toHaveLength(2);
    expect([...markup.matchAll(/data-state="pending"/g)]).toHaveLength(scored.length - 2);
    expect(text(markup)).toContain('not scored yet');
    for (const e of scored.slice(0, 2)) {
      expect(attrValues(markup, 'data-bits')).toContain(formatBits(e.individual.chromosome));
      expect(text(markup)).toContain(`individual ${e.individual.id}`);
    }
    expect(attrValues(markup, 'data-col').filter((c) => c === 'fitness')).toHaveLength(2);
  });

  test('flipped genes stay marked, and the numbers shown are the engine’s', () => {
    const { run } = make();
    const scored = events(run).flatMap((e) => (e.stage === 'evaluation' ? [e] : []));
    const markup = html(EvaluationView, { model: evaluationModel(at(run, 'evaluation', scored.length)) });
    expect(attrValues(markup, 'data-flipped').length).toBeGreaterThan(0);
    const fitnesses = [...markup.matchAll(/data-col="fitness"[^>]*>(?:<!--.*?-->)*(\d+)</g)].map((m) => Number(m[1]));
    expect(fitnesses).toEqual(scored.map((e) => e.individual.fitness));
  });
});

describe('replacement view', () => {
  test('before the step it says nothing is decided, and shows no verdict badges', () => {
    const { run, p } = make({ elites: 1 });
    const markup = html(ReplacementView, { model: replacementModel(at(run, 'replacement', 0), p) });
    expect(text(markup)).toContain('Not decided yet');
    expect(markup).not.toContain('data-fate="elite"');
    expect(markup).not.toContain('data-next=');
    expect(text(markup)).toContain('Elitism: 1 elite');
  });

  test('elites are starred and labelled; the next population lists them first, then the offspring', () => {
    const { run, p } = make({ elites: 1 });
    const event = events(run).flatMap((e) => (e.stage === 'replacement' ? [e] : []))[0]!;
    const markup = html(ReplacementView, { model: replacementModel(at(run, 'replacement', 1), p) });
    expect(attrValues(markup, 'data-old').length).toBe(4);
    expect([...markup.matchAll(/data-fate="elite"/g)]).toHaveLength(1);
    expect([...markup.matchAll(/data-fate="replaced"/g)]).toHaveLength(3);
    expect(text(markup)).toContain(`★ #${event.elites[0]}`);
    expect(attrValues(markup, 'data-next')).toEqual(event.population.map(String));
    expect(attrValues(markup, 'data-source')).toEqual(['elite', 'offspring', 'offspring', 'offspring']);
  });

  test('with truncation, discarded offspring are dimmed, labelled, and carry their rank and reason', () => {
    const { run, p } = make({ elites: 1, truncation: { enabled: true, lambda: 6 } });
    const markup = html(ReplacementView, { model: replacementModel(at(run, 'replacement', 1), p) });
    const t = text(markup);
    expect([...markup.matchAll(/data-fate="discarded"/g)]).toHaveLength(3);
    expect([...markup.matchAll(/data-fate="survives"/g)]).toHaveLength(3);
    expect(t).toContain('the best 3 are kept, 3 discarded');
    expect([...markup.matchAll(/class="rank"/g)]).toHaveLength(6);
    expect(markup).toMatch(/title="rank \d of 6: only the best 3 offspring are kept/);
    expect(t).toContain('✕ discarded');
    expect(t).toContain('✓ survives');
  });

  test('without truncation every offspring survives and the explanation says so', () => {
    const { run, p } = make();
    const markup = html(ReplacementView, { model: replacementModel(at(run, 'replacement', 1), p) });
    expect(markup).not.toContain('data-fate="discarded"');
    expect(text(markup)).toContain('All 4 offspring survive');
    expect(text(markup)).toContain('No elitism');
  });
});
