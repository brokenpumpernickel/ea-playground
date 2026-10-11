import { render } from 'svelte/server';
import { describe, expect, test } from 'vitest';
import { binaryAlphabet, fitnessColumn, gaAlgorithm, goldberg, type GaEvent, type GaParams, type GaSetup, type RunState } from '../engine';
import { createRun, type Run } from '../run';
import PairingView from './PairingView.svelte';
import RouletteView from './RouletteView.svelte';
import { pairingModel, selectionModel, tournamentModel } from './selection-models';
import TournamentView from './TournamentView.svelte';

const params: GaParams = {
  selection: { method: 'roulette', chain: [{ step: 'identity' }] },
  crossover: { enabled: true, operator: 'one-point', probability: 0.8 },
  mutation: { enabled: true, mode: 'per-gene', probability: 0.05 },
  elites: 0,
  stop: { generationLimit: 50 },
};
const setup: GaSetup = { problem: goldberg, init: { kind: 'explicit', chromosomes: ['01101', '11000', '01000', '10011'] } };
type GaRun = Run<GaSetup, GaParams, RunState, GaEvent>;
const make = (overrides: Partial<GaParams> = {}, s: GaSetup = setup): GaRun => {
  const run = createRun(gaAlgorithm, { setup: s, params: { ...params, ...overrides }, seed: 42 });
  run.forwardCycle();
  return run;
};
const at = (run: GaRun, stage: number, micro: number) => {
  expect(run.moveTo({ cycle: 1, stage, micro })).toBe(true);
  return run.view();
};
const html = (component: unknown, props: Record<string, unknown>) => render(component as never, { props: props as never }).body;
const attrValues = (markup: string, name: string) => [...markup.matchAll(new RegExp(`${name}="([^"]*)"`, 'g'))].map((m) => m[1]!);
const text = (markup: string) => markup.replace(/<!--.*?-->/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

describe('roulette view', () => {
  const spins = (run: GaRun) => run.events(1).flatMap((e) => (e.stage === 'selection' && e.kind === 'spin' ? [e] : []));

  test('shows the weight table with a column per chain step, and the formula from fitness to probability', () => {
    const run = make({ selection: { method: 'roulette', chain: [{ step: 'shift' }, { step: 'power' }] } });
    const markup = html(RouletteView, { model: selectionModel(at(run, 0, 0)), animate: false });
    const t = text(markup);
    expect(t).toContain('raw fitness → Shift → Power → weight → probability');
    expect(t).toContain('ε = 1');
    expect(t).toContain('exponent = 2');
    expect(t).toMatch(/Interval of r/i);
    for (const id of [1, 2, 3, 4]) expect(markup).toContain(`data-row="${id}"`);
  });

  test('the wheel is described for screen readers and has one slice per individual', () => {
    const markup = html(RouletteView, { model: selectionModel(at(make(), 0, 0)), animate: false });
    expect(markup).toMatch(/role="img"[^>]*aria-label="Roulette wheel/);
    expect([...markup.matchAll(/class="slice"/g)]).toHaveLength(4);
  });

  test('spin chips show each revealed spin and mark the rest as not drawn', () => {
    const run = make();
    const markup = html(RouletteView, { model: selectionModel(at(run, 0, 2)), animate: false });
    const t = text(markup);
    const [first, second] = spins(run);
    expect(t).toContain(`1: r = ${Math.round(first!.r * 1000) / 1000} → ${first!.individualId}`);
    expect(t).toContain(`2: r = ${Math.round(second!.r * 1000) / 1000} → ${second!.individualId}`);
    expect(t).toContain('3: not drawn');
    expect(t).toContain('4: not drawn');
    expect([...markup.matchAll(/data-pin="/g)]).toHaveLength(2); // future spins are not drawn on the wheel
  });

  test('the mating pool fills slot by slot and equals the engine’s pool once all spins are shown', () => {
    const run = make();
    const engine = spins(run).map((s) => String(s.individualId));
    const partial = html(RouletteView, { model: selectionModel(at(run, 0, 2)), animate: false });
    expect(attrValues(partial, 'data-id')).toEqual([engine[0], engine[1], '', '']);
    const full = html(RouletteView, { model: selectionModel(at(run, 0, 4)), animate: false });
    expect(attrValues(full, 'data-id')).toEqual(engine);
  });

  test('the row the latest spin landed on is highlighted', () => {
    const run = make();
    const landed = spins(run)[1]!.individualId;
    const markup = html(RouletteView, { model: selectionModel(at(run, 0, 2)), animate: false });
    expect(markup).toMatch(new RegExp(`class="[^"]*hl[^"]*"[^>]*data-row="${landed}"|data-row="${landed}"[^>]*class="[^"]*hl[^"]*"`));
  });

  test('an automatic switch is shown as a labelled notice, and is absent otherwise', () => {
    expect(html(RouletteView, { model: selectionModel(at(make(), 0, 0)), animate: false })).not.toContain('data-testid="auto-switch"');
    const negative = { chromosomeLength: 5, alphabet: binaryAlphabet, columns: [fitnessColumn], evaluate: (c: readonly number[]) => ({ decoded: 0, objective: 0, fitness: c.reduce((n, b) => n + b, 0) - 3 }) };
    const run = make({}, { problem: negative, init: { kind: 'explicit', chromosomes: ['00000', '11111', '01010', '10000'] } });
    const markup = html(RouletteView, { model: selectionModel(at(run, 0, 0)), animate: false });
    expect(markup).toContain('data-testid="auto-switch"');
    expect(text(markup)).toContain('Switched to Shift automatically');
    expect(text(markup)).toContain('Fitness is negative');
  });

  test('the animation flag only says how the pin arrives: it is recorded on the wheel and changes nothing else', () => {
    const run = make();
    const view = at(run, 0, 2);
    const still = html(RouletteView, { model: selectionModel(view), animate: false });
    const moving = html(RouletteView, { model: selectionModel(view), animate: true });
    expect(still).toContain('data-animated="false"');
    expect(moving).toContain('data-animated="true"');
    expect(text(still)).toBe(text(moving));
  });
});

describe('tournament view', () => {
  const tournament = (size = 2, s: GaSetup = setup) => make({ selection: { method: 'tournament', size } }, s);

  test('says the weight chain is not used', () => {
    const markup = html(TournamentView, { model: tournamentModel(at(tournament(), 0, 0)) });
    expect(text(markup)).toContain('compares fitness directly');
    expect(text(markup)).toContain('weight chain is not used');
  });

  test('shows one card per revealed tournament, with its contestants and the winner marked', () => {
    const run = tournament();
    const markup = html(TournamentView, { model: tournamentModel(at(run, 0, 2)) });
    expect([...markup.matchAll(/data-tournament="\d+"/g)]).toHaveLength(4);
    expect([...markup.matchAll(/data-state="revealed"/g)]).toHaveLength(2);
    expect([...markup.matchAll(/data-state="pending"/g)]).toHaveLength(2);
    expect(text(markup)).toContain('not drawn');
    expect([...markup.matchAll(/data-winner="true"/g)].length).toBeGreaterThanOrEqual(2);
    expect(text(markup)).toContain('winner');
  });

  test('a tie-break is labelled', () => {
    const tied: GaSetup = { problem: goldberg, init: { kind: 'explicit', chromosomes: ['01000', '11000', '01000', '11000'] } };
    const markup = html(TournamentView, { model: tournamentModel(at(tournament(4, tied), 0, 4)) });
    expect(text(markup)).toContain('tie-break');
  });

  test('contestants show their chromosome and fitness', () => {
    const markup = html(TournamentView, { model: tournamentModel(at(tournament(), 0, 1)) });
    expect(attrValues(markup, 'data-bits').length).toBeGreaterThanOrEqual(2);
    expect(text(markup)).toMatch(/fitness \d+/);
  });

  test('the mating pool is the winners in order', () => {
    const run = tournament();
    const winners = run.events(1).flatMap((e) => (e.stage === 'selection' && e.kind === 'tournament' ? [String(e.winnerId)] : []));
    const markup = html(TournamentView, { model: tournamentModel(at(run, 0, 4)) });
    expect(attrValues(markup, 'data-id')).toEqual(winners);
  });
});

describe('pairing view', () => {
  test('shows the pool, the pairs revealed so far, and the ones still to come', () => {
    const run = make();
    const pool = run.events(1).flatMap((e) => (e.stage === 'selection' && e.kind === 'spin' ? [String(e.individualId)] : []));
    const markup = html(PairingView, { model: pairingModel(at(run, 1, 1)) });
    expect(attrValues(markup, 'data-id')).toEqual(pool);
    expect([...markup.matchAll(/data-state="revealed"/g)]).toHaveLength(1);
    expect([...markup.matchAll(/data-state="pending"/g)]).toHaveLength(1);
    expect(text(markup)).toContain('not paired yet');
  });

  test('a revealed pair names its slots and shows both parents’ chromosomes and decoded values', () => {
    const run = make();
    const markup = html(PairingView, { model: pairingModel(at(run, 1, 2)) });
    const t = text(markup);
    expect(t).toContain('Pair 1');
    expect(t).toContain('slot 1');
    expect(t).toContain('slot 2');
    expect(attrValues(markup, 'data-bits')).toHaveLength(4);
    expect(t).toMatch(/x = \d+/);
  });

  test('the generated notes are shown', () => {
    const run = make();
    const model = pairingModel(at(run, 1, 2));
    const t = text(html(PairingView, { model }));
    for (const note of model.notes) expect(t).toContain(note);
    expect(model.notes.length).toBeGreaterThan(0);
  });
});
