import { describe, expect, test } from 'vitest';
import { createFakeScheduler } from '../run/fake-scheduler';
import { createSession } from './session.svelte';
import { defaultParams, defaultSeed, defaultSetup } from './config';

const make = (options: { reducedMotion?: boolean } = {}) => {
  const scheduler = createFakeScheduler();
  const session = createSession({ scheduler, drawSeed: () => 777, reducedMotion: options.reducedMotion });
  return { session, scheduler };
};
const populationIds = (s: ReturnType<typeof make>['session'], cycle: number) => s.run.snapshot(cycle).state.population.map((i) => [i.id, i.chromosome.join('')]);

describe('the default configuration', () => {
  test('is the Goldberg example as specified: N = 6, one-point 0.8, per-gene 0.05, no elites, roulette with Identity', () => {
    expect(defaultSetup.init).toEqual({ kind: 'random', size: 6 });
    expect(defaultParams).toMatchObject({
      selection: { method: 'roulette', chain: [{ step: 'identity' }] },
      crossover: { enabled: true, operator: 'one-point', probability: 0.8 },
      mutation: { enabled: true, mode: 'per-gene', probability: 0.05 },
      elites: 0,
      stop: { generationLimit: 50, targetFitness: 961, stagnationWindow: 10 },
    });
    expect(defaultSeed).toBe(42);
  });
});

describe('a new session', () => {
  test('starts paused at the end of the setup stage, with the seeded initial population on show', () => {
    const { session } = make();
    expect(session.seed).toBe(42);
    expect(session.run.cursor).toEqual({ cycle: 0, stage: 0, micro: 6 });
    expect(session.status).toEqual({ playing: false });
    expect(session.table.title).toBe('Population · generation 0');
    expect(session.table.rows).toHaveLength(6);
    expect(session.metrics.generation).toBe(0);
    expect(session.atCycleEnd).toBe(true);
  });
});

describe('stepping', () => {
  test('micro-step, stage and generation moves go through the same run, and each one is announced', () => {
    const { session } = make();
    const versions = [session.version];
    session.stepMicro();
    versions.push(session.version);
    session.stepStage();
    versions.push(session.version);
    session.stepGeneration();
    versions.push(session.version);

    expect(new Set(versions).size).toBe(4); // every action changed what the screen must show
    expect(session.run.cursor.cycle).toBe(1);
    expect(session.atCycleEnd).toBe(true);
  });

  test('back goes one micro-step back', () => {
    const { session } = make();
    session.stepMicro();
    const after = { ...session.run.cursor };
    session.stepMicro();
    session.backMicro();
    expect(session.run.cursor).toEqual(after);
  });

  test('the table, metrics and view follow the cursor: parents inside a generation, the new population at its end', () => {
    const { session } = make();
    session.stepMicro(); // (1, selection, 0)
    expect(session.table.title).toBe('Parents · generation 0');
    expect(session.view.position.cycle).toBe(1);
    session.stepGeneration();
    expect(session.table.title).toBe('Population · generation 1');
    expect(session.metrics.generation).toBe(1);
    expect(session.table.rows.map((r) => r.id)).toEqual(session.run.snapshot(1).state.population.map((i) => i.id));
  });

  test('stepping by micro-step, stage or generation reaches the same populations', () => {
    const byMicro = make().session;
    while (byMicro.run.lastCycle < 3 || byMicro.run.cursor.cycle < 3) byMicro.stepMicro();
    const byStage = make().session;
    while (byStage.run.lastCycle < 3) byStage.stepStage();
    const byGeneration = make().session;
    for (let k = 0; k < 3; k++) byGeneration.stepGeneration();

    for (let c = 0; c <= 3; c++) {
      expect(populationIds(byStage, c)).toEqual(populationIds(byMicro, c));
      expect(populationIds(byGeneration, c)).toEqual(populationIds(byMicro, c));
    }
  });

  test('a manual step while playing pauses the playback first', () => {
    const { session, scheduler } = make();
    session.play();
    expect(session.status.playing).toBe(true);
    session.stepMicro();
    expect(session.status).toEqual({ playing: false, pausedBecause: 'user' });
    expect(scheduler.pendingDelays()).toEqual([]);
  });
});

describe('playback', () => {
  test('play ticks through the run at the chosen tier and every tick is announced', () => {
    const { session, scheduler } = make();
    session.setSlider(2); // fast: one generation per tick
    const before = session.version;
    session.play();
    scheduler.fire();
    scheduler.fire();

    expect(session.run.cursor.cycle).toBe(2);
    expect(session.version).toBeGreaterThan(before + 2);
    session.pause();
    expect(session.status).toEqual({ playing: false, pausedBecause: 'user' });
    expect(session.tier.name).toBe('fast');
  });

  test('toggle plays and pauses', () => {
    const { session } = make();
    session.toggle();
    expect(session.status.playing).toBe(true);
    session.toggle();
    expect(session.status.playing).toBe(false);
  });

  test('run until stop jumps to the first stop criterion and reports why the run stopped', () => {
    const { session, scheduler } = make();
    const result = session.runUntilStop();
    expect(result.reason).toBe('condition');
    expect(session.run.cursor.cycle).toBe(session.run.lastCycle);
    expect(session.view.stops.length).toBeGreaterThan(0);
    expect(scheduler.pendingDelays()).toEqual([]);
  });

  test('reduced motion is passed to playback', () => {
    expect(make({ reducedMotion: true }).session.animate).toEqual({ micro: false, stage: false, population: false, plots: false });
    expect(make().session.animate.micro).toBe(true);
  });

  test('a failing step shows up as a paused status with the message, not a crash', () => {
    const { session, scheduler } = make();
    session.run.setParameters({ ...defaultParams, selection: { method: 'tournament', size: 0 } });
    session.setSlider(2);
    session.play();
    scheduler.fire();
    expect(session.status).toMatchObject({ playing: false, pausedBecause: 'error', error: 'Tournament size must be a whole number of at least 1' });
  });
});

describe('reset and new seed', () => {
  test('reset goes back to generation 0 with the same seed, and running again reproduces the same run', () => {
    const { session } = make();
    for (let k = 0; k < 3; k++) session.stepGeneration();
    const first = [0, 1, 2, 3].map((c) => populationIds(session, c));

    session.reset();
    expect(session.run.lastCycle).toBe(0);
    expect(session.run.cursor.cycle).toBe(0);
    expect(session.seed).toBe(42);
    for (let k = 0; k < 3; k++) session.stepGeneration();
    expect([0, 1, 2, 3].map((c) => populationIds(session, c))).toEqual(first);
  });

  test('new seed restarts with a different seed, which is shown, and a different run', () => {
    const { session } = make();
    session.stepGeneration();
    const before = populationIds(session, 0);

    session.newSeed();
    expect(session.seed).toBe(777);
    expect(session.run.lastCycle).toBe(0);
    expect(populationIds(session, 0)).not.toEqual(before);
  });

  test('both stop any playback and announce the change', () => {
    const { session, scheduler } = make();
    session.play();
    const before = session.version;
    session.reset();
    expect(session.status.playing).toBe(false);
    expect(scheduler.pendingDelays()).toEqual([]);
    expect(session.version).toBeGreaterThan(before);
  });
});
