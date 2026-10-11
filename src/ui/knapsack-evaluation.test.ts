import { render } from 'svelte/server';
import { describe, expect, test } from 'vitest';
import { gaAlgorithm, handlings, knapsackDefaults, knapsackProblem, type GaEvent, type GaParams, type GaSetup, type Handling, type RunState } from '../engine';
import { createRun, type Run } from '../run';
import { describer } from './describe';
import EvaluationView from './EvaluationView.svelte';
import { displayOf } from './format';
import { evaluationModel } from './outcome-models';

const problemFor = (handling: Handling, rho = 4) => knapsackProblem({ ...knapsackDefaults.options, handling, rho });
const genes = (text: string) => [...text].map(Number);
const all = '111111111111';
const bag = (letters: string) => Array.from({ length: 12 }, (_, i) => (letters.includes(String.fromCharCode(65 + i)) ? 1 : 0));

describe('what evaluation did, as the problem says it', () => {
  test('first-fit decoder: with everything on it skipped F, I, J, K and L, each with the room that was left', () => {
    const why = problemFor('decoder').explainEvaluation!(genes(all));
    expect(why.summary).toBe('skipped F I J K L');
    expect(why.details).toEqual(['skipped F: 14 > 11 left', 'skipped I: 11 > 2 left', 'skipped J: 7 > 2 left', 'skipped K: 6 > 2 left', 'skipped L: 13 > 2 left']);
  });

  test('repair: with everything on it dropped A, E, I, L and F, each with its value per weight', () => {
    for (const handling of ['repair-lamarckian', 'repair-baldwinian'] as const) {
      const why = problemFor(handling).explainEvaluation!(genes(all));
      expect(why.summary).toBe('dropped A E I L F');
      expect(why.details).toEqual([
        'dropped A: 4/9 = 0.44 per weight',
        'dropped E: 5/10 = 0.50 per weight',
        'dropped I: 8/11 = 0.73 per weight',
        'dropped L: 19/13 = 1.46 per weight',
        'dropped F: 23/14 = 1.64 per weight',
      ]);
    }
  });

  test('penalty: over the capacity it says by how much and how the penalty came about, and a bag that fits says no penalty', () => {
    expect(problemFor('penalty').explainEvaluation!(bag('ABEFG'))).toEqual({ summary: 'over by 1 (4 × 1)', details: [] });
    expect(problemFor('penalty', 2.5).explainEvaluation!(bag('ABEFG')).summary).toBe('over by 1 (2.5 × 1)');
    expect(problemFor('penalty').explainEvaluation!(bag('ABCEF'))).toEqual({ summary: 'fits: no penalty', details: [] });
  });

  test('a chromosome that fits needs no explaining by the decoder or the repairs', () => {
    for (const handling of ['decoder', 'repair-lamarckian', 'repair-baldwinian'] as const) {
      expect(problemFor(handling).explainEvaluation!(bag('BCDFGHK'))).toEqual({ summary: 'everything fits', details: [] });
    }
  });
});

describe('the sentences in the narration', () => {
  const setup = (handling: Handling): GaSetup => ({ problem: problemFor(handling), init: { kind: 'explicit', chromosomes: [all, '000000000001', '011100110110'] } });
  const params: GaParams = { ...knapsackDefaults.params, stop: { generationLimit: 50 } };
  const make = (handling: Handling): Run<GaSetup, GaParams, RunState, GaEvent> => {
    const run = createRun(gaAlgorithm, { setup: setup(handling), params, seed: 5 });
    run.forwardCycle();
    return run;
  };

  test('the initial population says what was skipped, dropped or repaired, in one sentence each', () => {
    const say = describer(displayOf(problemFor('repair-lamarckian')));
    const first = make('repair-lamarckian').events(0)[0]!;
    expect(say(first)).toBe(
      'Individual 1 (111111111111 repaired to 011100110110): dropped A: 4/9 = 0.44 per weight; dropped E: 5/10 = 0.50 per weight; dropped I: 8/11 = 0.73 per weight; dropped L: 19/13 = 1.46 per weight; dropped F: 23/14 = 1.64 per weight; packs B, C, D, G, H, J, K: weight 40 of 48, value 112, fitness 112',
    );
    expect(say(make('repair-lamarckian').events(0)[1]!)).toBe('Individual 2 (000000000001): packs L: weight 13 of 48, value 19, fitness 19');
    const decoder = describer(displayOf(problemFor('decoder')));
    expect(decoder(make('decoder').events(0)[0]!)).toBe(
      'Individual 1 (111111111111): skipped F: 14 > 11 left; skipped I: 11 > 2 left; skipped J: 7 > 2 left; skipped K: 6 > 2 left; skipped L: 13 > 2 left; packs A, B, C, D, E, G, H: weight 46 of 48, value 88, fitness 88',
    );
  });

  test.each(handlings)('%s: every evaluation sentence quotes what the engine recorded', (handling) => {
    const run = make(handling);
    const problem = problemFor(handling);
    const say = describer(displayOf(problem));
    const scored = run.events(1).flatMap((e) => (e.stage === 'evaluation' ? [e] : []));
    expect(scored.length).toBeGreaterThan(0);
    let repaired = 0;
    for (const e of scored) {
      const sentence = say(e);
      const why = problem.explainEvaluation!(e.repairedFrom ?? e.individual.chromosome);
      expect(sentence.startsWith(`Offspring ${e.offspring}: `)).toBe(true);
      for (const detail of why.details) expect(sentence).toContain(detail);
      expect(sentence).toContain(`fitness ${e.individual.fitness} (individual ${e.individual.id})`);
      expect(sentence).toContain(problem.scoreText!(e.individual));
      if (e.repairedFrom) {
        repaired++;
        expect(sentence).toContain(`${e.repairedFrom.join('')} → repaired to ${e.individual.chromosome.join('')}`);
      } else expect(sentence).not.toContain('repaired to');
    }
    if (handling === 'repair-lamarckian') expect(repaired).toBeGreaterThanOrEqual(0);
  });
});

describe('the evaluation view', () => {
  const display = (handling: Handling) => displayOf(problemFor(handling));
  const setup = (handling: Handling): GaSetup => ({ problem: problemFor(handling), init: { kind: 'random', size: 8 } });
  const at = (handling: Handling) => {
    const run = createRun(gaAlgorithm, { setup: setup(handling), params: { ...knapsackDefaults.params, stop: { generationLimit: 50 } }, seed: 9 });
    run.forwardCycle();
    const stage = run.layout(1).findIndex((s) => s.stage === 'evaluation');
    run.moveTo({ cycle: 1, stage, micro: run.layout(1)[stage]!.micros });
    return run;
  };
  const text = (markup: string) => markup.replace(/<!--.*?-->/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  test.each(handlings)('%s: the model has a "What happened" line for every scored offspring, equal to the problem’s own', (handling) => {
    const run = at(handling);
    const model = evaluationModel(run.view(), display(handling));
    expect(model.explains).toBe(true);
    const scored = run.events(1).flatMap((e) => (e.stage === 'evaluation' ? [e] : []));
    expect(model.rows.map((r) => r.why)).toEqual(scored.map((e) => problemFor(handling).explainEvaluation!(e.repairedFrom ?? e.individual.chromosome)));
  });

  test('the view prints the column with its summaries, and nothing for a pending offspring', () => {
    const run = createRun(gaAlgorithm, { setup: setup('decoder'), params: knapsackDefaults.params, seed: 9 });
    run.forwardCycle();
    const stage = run.layout(1).findIndex((s) => s.stage === 'evaluation');
    run.moveTo({ cycle: 1, stage, micro: 2 });
    const model = evaluationModel(run.view(), display('decoder'));
    const markup = render(EvaluationView as never, { props: { model } as never }).body;
    expect(text(markup)).toContain('What happened');
    expect([...markup.matchAll(/data-col="what happened"[^>]*>(?:<!--.*?-->)*([^<]*)</g)].map((m) => m[1])).toEqual(model.rows.filter((r) => r.revealed).map((r) => r.why!.summary));
    expect(markup).toContain('not scored yet');
  });

  test('a problem that does not explain evaluation has no such column', () => {
    const model = { explanation: 'x', columns: [{ header: 'Fitness' }], explains: false, rows: [] };
    expect(text(render(EvaluationView as never, { props: { model } as never }).body)).not.toContain('What happened');
  });
});
