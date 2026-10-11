import { render } from 'svelte/server';
import { describe, expect, test } from 'vitest';
import { gaAlgorithm, goldberg, targetStringProblem, type GaEvent, type GaParams, type GaSetup, type RunState } from '../engine';
import { createRun, type Run } from '../run';
import Bits from './Bits.svelte';
import { describer } from './describe';
import { chromosomePieces, parseChromosomes } from './drawer-model';
import EvaluationView from './EvaluationView.svelte';
import { displayOf, goldbergDisplay } from './format';
import { crossoverModel, mutationModel } from './variation-models';
import { evaluationModel } from './outcome-models';
import { populationTable } from './population';
import { pairingModel } from './selection-models';
import PairingView from './PairingView.svelte';

const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ ';
const problem = targetStringProblem({ alphabet: letters, target: 'HELLO' });
const display = displayOf(problem);
const params: GaParams = {
  selection: { method: 'tournament', size: 2 },
  crossover: { enabled: true, operator: 'one-point', probability: 1 },
  mutation: { enabled: true, mode: 'per-gene', probability: 0.3 },
  elites: 0,
  stop: { generationLimit: 50 },
};
const setup: GaSetup = { problem, init: { kind: 'explicit', chromosomes: ['HELLO', 'JELLY', 'HI YOU', 'ZZZZZ'].map((s) => s.slice(0, 5)) } };
type GaRun = Run<GaSetup, GaParams, RunState, GaEvent>;
const make = (): GaRun => {
  const run: GaRun = createRun(gaAlgorithm, { setup, params, seed: 3 });
  run.forwardCycle();
  return run;
};
const at = (run: GaRun, stage: string, micro: number) => {
  expect(run.moveTo({ cycle: 1, stage: run.layout(1).findIndex((s) => s.stage === stage), micro })).toBe(true);
  return run.view();
};
const html = (component: unknown, props: Record<string, unknown>) => render(component as never, { props: props as never }).body;
const text = (markup: string) => markup.replace(/<!--.*?-->/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

describe('cells with letters', () => {
  test('draw one cell per letter, with a space shown as ␣ so that it can be seen', () => {
    const markup = html(Bits, { chromosome: 'HI YO' });
    expect(markup).toContain('data-bits="HI YO"');
    expect([...markup.matchAll(/<b class="bit[^"]*"[^>]*>(.*?)<\/b>/g)].map((m) => m[1])).toEqual(['H', 'I', '␣', 'Y', 'O']);
    expect(markup).toContain('letter');
    expect(markup).toContain('aria-label="Chromosome HI YO"');
  });

  test('only the genes the caller marks are filled; digits still fill on their own', () => {
    const marked = html(Bits, { chromosome: 'HELLO', marks: [true, false, true, false, false] });
    expect([...marked.matchAll(/class="bit one/g)]).toHaveLength(2);
    const binary = html(Bits, { chromosome: '01101' });
    expect([...binary.matchAll(/class="bit one/g)]).toHaveLength(3);
    expect(binary).not.toContain('letter');
  });

  test('keep inheritance hatching, cut lines and flip marks', () => {
    const markup = html(Bits, { chromosome: 'HELLO', sources: ['A', 'A', 'B', 'B', 'B'], cuts: [2], flipped: [4] });
    expect(markup).toContain('data-sources="AABBB"');
    expect(markup).toContain('data-cuts="2"');
    expect(markup).toContain('data-flipped="4"');
    expect(markup).toContain('gene 4 flipped');
  });
});

describe('what the models show for a problem over letters', () => {
  test('the population table shows letters and the problem’s own column, "7 of 11" style', () => {
    const run = make();
    const table = populationTable(at(run, 'selection', 0), false, display);
    expect(table.rows.map((r) => r.chromosome)).toEqual(['HELLO', 'JELLY', 'HI YO', 'ZZZZZ']);
    expect(table.rows.map((r) => r.cells)).toEqual([['5 of 5'], ['3 of 5'], ['2 of 5'], ['0 of 5']]);
    expect(table.rows.map((r) => r.fitness)).toEqual([5, 3, 2, 0]);
  });

  test('Goldberg’s table is as it always was: x and fitness', () => {
    expect(goldbergDisplay.columns.map((c) => c.header)).toEqual(['x', 'Fitness']);
    expect(goldbergDisplay.evaluationColumns.map((c) => c.header)).toEqual(['x', 'Objective', 'Fitness']);
  });

  test('crossover and mutation models carry the letters', () => {
    const run = make();
    const crossover = crossoverModel(at(run, 'crossover', 1), params.crossover, display);
    expect(crossover.pairs[0]!.parentA.bits).toMatch(/^[A-Z ]{5}$/);
    expect(crossover.pairs[0]!.children[0]!.bits).toMatch(/^[A-Z ]{5}$/);
    const mutation = mutationModel(at(run, 'mutation', 1), params.mutation, display);
    expect(mutation.rows[0]!.before).toMatch(/^[A-Z ]{5}$/);
    expect(mutation.rows[0]!.after).toMatch(/^[A-Z ]{5}$/);
  });

  test('the evaluation view takes its columns from the problem', () => {
    const run = make();
    const model = evaluationModel(at(run, 'evaluation', 2), display);
    expect(model.columns).toEqual([{ header: 'Fitness', note: '= matches' }]);
    expect(model.rows[0]!.cells).toHaveLength(1);
    const markup = html(EvaluationView, { model });
    expect(text(markup)).toContain('Fitness = matches');
    expect(text(markup)).toMatch(/\d of 5/);
    expect(markup).toContain('data-col="fitness"');
    expect(markup).not.toContain('data-col="x"');
    const binary = html(EvaluationView, { model: evaluationModel(at(make(), 'evaluation', 1)) });
    expect(binary).toContain('data-col="objective"');
  });

  test('the pairing view does not print a decoded value that is just the chromosome again', () => {
    const run = make();
    const model = pairingModel(at(run, 'pairing', 1), display);
    expect(text(html(PairingView, { model }))).not.toContain('x =');
  });
});

describe('describing events for a problem over letters', () => {
  test('the sentences use the letters and say fitness, not x', () => {
    const run = make();
    const describe_ = describer(display);
    const lines = run.events(0).map(describe_);
    expect(lines[0]).toBe('Individual 1 (HELLO): fitness 5');
    const evaluation = run.events(1).filter((e) => e.stage === 'evaluation').map(describe_);
    expect(evaluation[0]).toMatch(/^Offspring 1: [A-Z ]{5} → fitness \d \(individual \d+\)$/);
  });
});

describe('typing a hand-edited population over letters', () => {
  test('a new line separates chromosomes always; a space or comma only when it is not a symbol of the alphabet', () => {
    expect(chromosomePieces('HELLO\nJE LY\nZZ ZZ', problem)).toEqual(['HELLO', 'JE LY', 'ZZ ZZ']);
    expect(chromosomePieces('HELLO, JELLY', problem)).toEqual(['HELLO', ' JELLY']); // the space is part of the alphabet, the comma is not
    const noSpace = targetStringProblem({ alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', target: 'HELLO' });
    expect(chromosomePieces('HELLO, JELLY ZZZZZ;AAAAA', noSpace)).toEqual(['HELLO', 'JELLY', 'ZZZZZ', 'AAAAA']);
  });

  test('each string is scored with the problem’s own columns, and a wrong one is named', () => {
    const rows = parseChromosomes('HELLO\nHELP\nhello\nJELLY', problem);
    expect(rows[0]).toMatchObject({ text: 'HELLO', fitness: 5, cells: ['5 of 5'] });
    expect(rows[1]!.error).toBe('Chromosome 2 has 4 genes, but this problem needs 5.');
    expect(rows[2]!.error).toBe('Chromosome 3 ("hello") may only contain the characters of the alphabet (27 symbols).');
    expect(rows[3]).toMatchObject({ text: 'JELLY', fitness: 3 });
  });

  test('binary populations behave as they did, including the messages and the separators', () => {
    const rows = parseChromosomes('01101 11000, 0110\n11x00', goldberg);
    expect(rows.map((r) => r.text)).toEqual(['01101', '11000', '0110', '11x00']);
    expect(rows[0]).toMatchObject({ decoded: 13, fitness: 169, cells: ['13', '169'] });
    expect(rows[2]!.error).toBe('Chromosome 3 has 4 genes, but this problem needs 5.');
    expect(rows[3]!.error).toBe('Chromosome 4 ("11x00") may only contain the characters 0 and 1.');
  });
});
