import { describe, expect, test } from 'vitest';
import { createFakeScheduler } from '../run/fake-scheduler';
import { gaAlgorithm } from '../engine';
import { createRun } from '../run';
import { defaultParams, defaultSetup } from './config';
import { createSession } from './session.svelte';

const make = () => {
  const scheduler = createFakeScheduler();
  const session = createSession({ scheduler, drawSeed: () => 777 });
  return { session, scheduler };
};
const generations = (session: ReturnType<typeof make>['session'], n: number) => {
  for (let k = 0; k < n; k++) session.stepGeneration();
};
const state = (session: ReturnType<typeof make>['session'], cycle: number) => session.run.snapshot(cycle).state.population.map((i) => `${i.id}:${i.chromosome.join('')}`);
const changed = { ...defaultParams, crossover: { ...defaultParams.crossover, probability: 0.2 } };

describe('scrubbing', () => {
  test('moving the cursor into the past shows the state the live run showed there, and adds no history', () => {
    const { session } = make();
    generations(session, 5);
    session.scrubTo({ cycle: 3, stage: 5, micro: 1 });
    expect(session.table.title).toBe('Population · generation 3');
    expect(session.table.rows.map((r) => `${r.id}:${r.chromosome}`)).toEqual(state(session, 3));
    expect(session.run.lastCycle).toBe(5);
    expect(session.metrics.generation).toBe(3);
    expect(session.atLive).toBe(false);
  });

  test('scrubbing inside a generation shows its stage and micro-step', () => {
    const { session } = make();
    generations(session, 4);
    session.scrubTo({ cycle: 2, stage: 2, micro: 1 });
    expect(session.view.stage).toBe('crossover');
    expect(session.view.position).toEqual({ cycle: 2, stage: 2, micro: 1 });
    expect(session.table.title).toBe('Parents · generation 1');
  });

  test('a position that does not exist is refused and nothing moves', () => {
    const { session } = make();
    generations(session, 2);
    const before = { ...session.run.cursor };
    expect(session.scrubTo({ cycle: 9, stage: 0, micro: 0 })).toBe(false);
    expect(session.scrubTo({ cycle: 1, stage: 0, micro: 99 })).toBe(false);
    expect(session.run.cursor).toEqual(before);
  });

  test('scrubbing stops playback, and announces the change', () => {
    const { session, scheduler } = make();
    generations(session, 3);
    session.play();
    const before = session.version;
    session.scrubTo({ cycle: 1, stage: 0, micro: 0 });
    expect(session.status.playing).toBe(false);
    expect(scheduler.pendingDelays()).toEqual([]);
    expect(session.version).toBeGreaterThan(before);
  });

  test('stepping inside the history never makes a new generation, even at the live end', () => {
    const { session } = make();
    generations(session, 2);
    expect(session.atLive).toBe(true);
    session.scrubMicro(1);
    session.scrubGeneration(1);
    expect(session.run.lastCycle).toBe(2);
    session.scrubGeneration(-1);
    expect(session.run.cursor.cycle).toBe(1);
    expect(session.run.cursor).toEqual({ cycle: 1, stage: 5, micro: session.run.layout(1)[5]!.micros });
    session.scrubMicro(-1);
    expect(session.run.cursor.micro).toBe(session.run.layout(1)[5]!.micros - 1);
  });

  test('return to live goes to the end of the newest generation', () => {
    const { session } = make();
    generations(session, 4);
    session.scrubTo({ cycle: 1, stage: 1, micro: 0 });
    session.returnToLive();
    expect(session.atLive).toBe(true);
    expect(session.run.cursor.cycle).toBe(4);
    expect(session.table.title).toBe('Population · generation 4');
  });

  test('playing forward from the past replays the recorded generations without changing them', () => {
    const { session, scheduler } = make();
    generations(session, 5);
    const recorded = [0, 1, 2, 3, 4, 5].map((c) => state(session, c));
    session.scrubTo({ cycle: 1, stage: 5, micro: 1 });
    session.setSlider(2); // fast: one generation per tick
    session.play();
    scheduler.fire();
    scheduler.fire();
    expect(session.run.cursor.cycle).toBe(3);
    expect(session.run.lastCycle).toBe(5);
    expect([0, 1, 2, 3, 4, 5].map((c) => state(session, c))).toEqual(recorded);
  });
});

describe('changing parameters while looking at the past', () => {
  test('at the live end the change simply becomes pending: no notice', () => {
    const { session } = make();
    generations(session, 3);
    expect(session.changeParameters(changed)).toEqual({ status: 'applied' });
    expect(session.pendingChange).toBeUndefined();
    expect(session.run.pendingParameters).toEqual(changed);
  });

  test('in the past, a notice names the generations that would go and nothing changes yet', () => {
    const { session } = make();
    generations(session, 8);
    session.scrubTo({ cycle: 5, stage: 5, micro: 1 });
    expect(session.changeParameters(changed)).toEqual({ status: 'needs-confirmation' });
    expect(session.pendingChange).toEqual({ params: changed, discarded: [6, 7, 8], from: 5 });
    expect(session.run.lastCycle).toBe(8);
    expect(session.run.pendingParameters).toBeUndefined();
  });

  test('the notice words the range and the point the run continues from', () => {
    const { session } = make();
    generations(session, 8);
    session.scrubTo({ cycle: 5, stage: 5, micro: 1 });
    session.changeParameters(changed);
    expect(session.pendingChange!.discarded).toEqual([6, 7, 8]);
    expect(session.discardNotice).toBe('Generations 6–8 will be discarded. The run continues from generation 5 with the new settings.');
    session.cancelChange();
    session.scrubTo({ cycle: 7, stage: 5, micro: 1 });
    session.changeParameters(changed);
    expect(session.discardNotice).toBe('Generation 8 will be discarded. The run continues from generation 7 with the new settings.');
  });

  test('cancelling is a true no-op: history, cursor and parameters are exactly as they were', () => {
    const { session } = make();
    generations(session, 6);
    session.scrubTo({ cycle: 2, stage: 3, micro: 2 });
    const before = {
      cursor: { ...session.run.cursor },
      last: session.run.lastCycle,
      states: [0, 1, 2, 3, 4, 5, 6].map((c) => state(session, c)),
      parameters: session.run.parameters,
      version: session.version,
    };
    session.changeParameters(changed);
    session.cancelChange();
    expect(session.pendingChange).toBeUndefined();
    expect(session.discardNotice).toBeUndefined();
    expect(session.run.cursor).toEqual(before.cursor);
    expect(session.run.lastCycle).toBe(before.last);
    expect([0, 1, 2, 3, 4, 5, 6].map((c) => state(session, c))).toEqual(before.states);
    expect(session.run.parameters).toEqual(before.parameters);
    expect(session.run.pendingParameters).toBeUndefined();
  });

  test('confirming discards the later generations and the run continues from the cursor with the new settings, reproducibly', () => {
    const { session } = make();
    generations(session, 6);
    const oldTail = [4, 5, 6].map((c) => state(session, c));
    session.scrubTo({ cycle: 3, stage: 5, micro: 1 });
    session.changeParameters(changed);
    session.confirmChange();
    expect(session.pendingChange).toBeUndefined();
    expect(session.run.lastCycle).toBe(3);
    expect(session.run.cursor.cycle).toBe(3);

    generations(session, 3);
    // the generations before the change are untouched; those after it differ
    expect(session.run.snapshot(5).params.crossover.probability).toBe(0.2);
    expect([4, 5, 6].map((c) => state(session, c))).not.toEqual(oldTail);

    // the same seed and the same change at the same point give the same run
    const again = createRun(gaAlgorithm, { setup: defaultSetup, params: defaultParams, seed: 42 });
    for (let k = 0; k < 3; k++) again.forwardCycle();
    again.setParameters(changed);
    for (let k = 0; k < 3; k++) again.forwardCycle();
    for (let c = 0; c <= 6; c++) expect(state(session, c)).toEqual(again.snapshot(c).state.population.map((i) => `${i.id}:${i.chromosome.join('')}`));
  });

  test('a reset or new seed closes an open notice', () => {
    const { session } = make();
    generations(session, 4);
    session.scrubTo({ cycle: 1, stage: 5, micro: 1 });
    session.changeParameters(changed);
    session.reset();
    expect(session.pendingChange).toBeUndefined();
    generations(session, 3);
    session.scrubTo({ cycle: 1, stage: 5, micro: 1 });
    session.changeParameters(changed);
    session.newSeed();
    expect(session.pendingChange).toBeUndefined();
  });

  test('changing again while a notice is open replaces it', () => {
    const { session } = make();
    generations(session, 4);
    session.scrubTo({ cycle: 1, stage: 5, micro: 1 });
    session.changeParameters(changed);
    const other = { ...defaultParams, elites: 1 };
    session.changeParameters(other);
    expect(session.pendingChange!.params).toEqual(other);
  });
});

describe('changes that need a reset', () => {
  const setup = (size: number) => ({ ...defaultSetup, init: { kind: 'random' as const, size } });

  test('are held until confirmed, with a notice that says what restarts and what is lost', () => {
    const { session } = make();
    generations(session, 5);
    const before = [0, 1, 2, 3, 4, 5].map((c) => state(session, c));
    session.requestReset({ setup: setup(8), seed: 42, params: defaultParams, changed: ['Population size'] });
    expect(session.run.lastCycle).toBe(5);
    expect([0, 1, 2, 3, 4, 5].map((c) => state(session, c))).toEqual(before);
    expect(session.resetNotice).toBe('Changing the population size restarts the run from generation 0 and discards the 5 recorded generations (1–5).');
  });

  test('the notice names every changed setting, and handles a run with nothing recorded yet', () => {
    const { session } = make();
    session.requestReset({ setup: setup(8), seed: 7, params: defaultParams, changed: ['Population size', 'Seed'] });
    expect(session.resetNotice).toBe('Changing the population size and the seed restarts the run from generation 0. Nothing recorded will be lost.');
  });

  test('confirming restarts with the new setup, seed and parameters; the run is then the one those settings would have made', () => {
    const { session } = make();
    generations(session, 3);
    const params = { ...defaultParams, elites: 1 };
    session.requestReset({ setup: setup(8), seed: 7, params, changed: ['Population size', 'Seed'] });
    const epoch = session.epoch;
    session.confirmReset();
    expect(session.resetNotice).toBeUndefined();
    expect(session.run.lastCycle).toBe(0);
    expect(session.seed).toBe(7);
    expect(session.run.snapshot(0).state.population).toHaveLength(8);
    expect(session.epoch).toBeGreaterThan(epoch);
    generations(session, 2);
    const again = createRun(gaAlgorithm, { setup: setup(8), params, seed: 7 });
    again.forwardCycle();
    again.forwardCycle();
    for (let c = 0; c <= 2; c++) expect(state(session, c)).toEqual(again.snapshot(c).state.population.map((i) => `${i.id}:${i.chromosome.join('')}`));
  });

  test('cancelling changes nothing', () => {
    const { session } = make();
    generations(session, 3);
    const before = [0, 1, 2, 3].map((c) => state(session, c));
    session.requestReset({ setup: setup(8), seed: 7, params: defaultParams, changed: ['Population size'] });
    session.cancelReset();
    expect(session.resetNotice).toBeUndefined();
    expect(session.seed).toBe(42);
    expect([0, 1, 2, 3].map((c) => state(session, c))).toEqual(before);
  });
});

describe('pending parameters', () => {
  test('are listed by name until the next generation boundary applies them', () => {
    const { session } = make();
    generations(session, 2);
    expect(session.pending).toEqual([]);
    session.changeParameters({ ...defaultParams, crossover: { ...defaultParams.crossover, probability: 0.3 }, elites: 1 });
    expect(session.pending).toEqual(['Crossover probability', 'Elites']);
    session.stepGeneration();
    expect(session.pending).toEqual([]);
    expect(session.run.snapshot(3).params.elites).toBe(1);
  });

  test('a new seed or reset keeps the parameters, and the epoch tells the drawer to reread them', () => {
    const { session } = make();
    generations(session, 2);
    const epoch = session.epoch;
    session.changeParameters({ ...defaultParams, elites: 2 });
    session.newSeed();
    expect(session.epoch).toBeGreaterThan(epoch);
    expect(session.run.parameters.elites).toBe(2);
  });
});
