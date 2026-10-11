import { describe, expect, test } from 'vitest';
import { createFakeAlgorithm, type FakeParams } from './fake-algorithm';
import { createFakeScheduler } from './fake-scheduler';
import { createPlayback } from './playback';
import { createRun } from './run';

const make = (options: { params?: FakeParams; seed?: number; reducedMotion?: boolean } = {}) => {
  const fake = createFakeAlgorithm();
  const run = createRun(fake.algorithm, { setup: { start: 10 }, params: options.params ?? { step: 5 }, seed: options.seed ?? 42 });
  const scheduler = createFakeScheduler();
  const playback = createPlayback(run, { scheduler, reducedMotion: options.reducedMotion });
  return { ...fake, run, scheduler, playback };
};
const at = (run: { cursor: { cycle: number; stage: number; micro: number } }) => ({ ...run.cursor });

describe('the tiers', () => {
  test('there are four, from slow to maximum, with what each advances, how often, and what animates', () => {
    const { playback } = make();
    expect(playback.tiers.map((t) => [t.name, t.unit, t.cyclesPerTick, t.intervalMs])).toEqual([
      ['slow', 'micro', 1, 1000],
      ['medium', 'stage', 1, 1500],
      ['fast', 'cycle', 1, 500],
      ['maximum', 'cycle', 25, 0],
    ]);
    expect(playback.tiers.map((t) => t.animate)).toEqual([
      { micro: true, stage: true, population: true, plots: true },
      { micro: false, stage: true, population: true, plots: true },
      { micro: false, stage: false, population: true, plots: true },
      { micro: false, stage: false, population: false, plots: false },
    ]);
    expect(playback.tiers.every((t) => t.label.length > 0)).toBe(true);
  });

  test('the slider has four stops, 0 to 3; a fractional or out-of-range value snaps to the nearest stop', () => {
    const { playback } = make();
    expect(playback.slider).toBe(0);
    expect(playback.tier.name).toBe('slow');

    for (const [value, slider, name] of [
      [1, 1, 'medium'],
      [2.4, 2, 'fast'],
      [2.6, 3, 'maximum'],
      [-5, 0, 'slow'],
      [99, 3, 'maximum'],
    ] as const) {
      playback.setSlider(value);
      expect([playback.slider, playback.tier.name]).toEqual([slider, name]);
    }
    playback.setTier('medium');
    expect(playback.slider).toBe(1);
  });
});

describe('playing', () => {
  test('starts paused, and does nothing until told to play', () => {
    const { playback, scheduler, run } = make();
    expect(playback.status).toEqual({ playing: false });
    expect(scheduler.pendingDelays()).toEqual([]);
    expect(run.lastCycle).toBe(0);
  });

  test('slow: each tick is one micro-step, one second apart, the first at once', () => {
    const { playback, scheduler, run } = make();
    playback.play();
    expect(scheduler.pendingDelays()).toEqual([0]);

    scheduler.fire();
    expect(at(run)).toEqual({ cycle: 1, stage: 0, micro: 0 });
    expect(scheduler.pendingDelays()).toEqual([1000]);
    scheduler.fire();
    expect(at(run)).toEqual({ cycle: 1, stage: 1, micro: 0 });
    scheduler.fire();
    expect(at(run)).toEqual({ cycle: 1, stage: 1, micro: 1 });
  });

  test('medium: each tick completes a stage, 1.5 seconds apart', () => {
    const { playback, scheduler, run } = make();
    playback.setTier('medium');
    playback.play();
    const seen = [];
    for (let k = 0; k < 4; k++) {
      scheduler.fire();
      seen.push(at(run));
    }
    expect(seen).toEqual([
      { cycle: 1, stage: 0, micro: 0 },
      { cycle: 1, stage: 1, micro: 3 },
      { cycle: 1, stage: 2, micro: 1 },
      { cycle: 2, stage: 0, micro: 0 },
    ]);
    expect(scheduler.pendingDelays()).toEqual([1500]);
  });

  test('fast: each tick completes a generation, half a second apart', () => {
    const { playback, scheduler, run } = make();
    playback.setTier('fast');
    playback.play();
    scheduler.fire();
    expect(at(run)).toEqual({ cycle: 1, stage: 2, micro: 1 });
    scheduler.fire();
    expect(at(run)).toEqual({ cycle: 2, stage: 2, micro: 1 });
    expect(scheduler.pendingDelays()).toEqual([500]);
  });

  test('maximum: each tick makes up to 25 generations, and the next follows immediately', () => {
    const { playback, scheduler, run } = make({ params: { step: 0 } }); // never reaches a stop criterion
    playback.setTier('maximum');
    playback.play();
    scheduler.fire();
    expect(run.lastCycle).toBe(25);
    expect(run.cursor).toMatchObject({ cycle: 25 });
    expect(scheduler.pendingDelays()).toEqual([0]);
    scheduler.fire();
    expect(run.lastCycle).toBe(50);
  });

  test('playing through generations that are already recorded only moves the cursor', () => {
    const { playback, scheduler, run, calls } = make();
    run.runUntil((s) => s.cycle === 5);
    run.moveTo({ cycle: 0, stage: 0, micro: 2 });
    const steps = calls.step;

    playback.setTier('fast');
    playback.play();
    for (let k = 0; k < 5; k++) scheduler.fire();
    expect(at(run)).toMatchObject({ cycle: 5 });
    expect(calls.step).toBe(steps);
  });

  test('play while already playing does not start a second timer', () => {
    const { playback, scheduler } = make();
    playback.play();
    playback.play();
    expect(scheduler.pendingDelays()).toEqual([0]);
  });
});

describe('pausing and resuming', () => {
  test('pause stops the timer and freezes the cursor where it is', () => {
    const { playback, scheduler, run } = make();
    playback.play();
    scheduler.fire();
    scheduler.fire();
    const frozen = at(run);

    playback.pause();
    expect(playback.status).toEqual({ playing: false, pausedBecause: 'user' });
    expect(scheduler.pendingDelays()).toEqual([]);
    scheduler.advance(60_000);
    expect(at(run)).toEqual(frozen);
  });

  test('resuming continues from the frozen position, and the finished run equals one that was never paused', () => {
    const paused = make({ params: { step: 30 }, seed: 8 });
    paused.playback.setTier('slow');
    paused.playback.play();
    for (let k = 0; k < 9; k++) paused.scheduler.fire();
    paused.playback.pause();
    paused.scheduler.advance(10_000);
    paused.playback.play();
    while (paused.playback.status.playing) paused.scheduler.fire(); // until the stop criterion pauses it

    const straight = make({ params: { step: 30 }, seed: 8 });
    straight.run.runUntil((s) => s.stops.length > 0);

    expect(paused.run.lastCycle).toBe(straight.run.lastCycle);
    for (let c = 0; c <= straight.run.lastCycle; c++) {
      expect(paused.run.snapshot(c)).toEqual(straight.run.snapshot(c));
      expect(paused.run.events(c)).toEqual(straight.run.events(c));
    }
  });

  test('toggle switches between playing and paused', () => {
    const { playback } = make();
    playback.toggle();
    expect(playback.status.playing).toBe(true);
    playback.toggle();
    expect(playback.status.playing).toBe(false);
  });

  test('pausing when not playing changes nothing', () => {
    const { playback } = make();
    playback.pause();
    expect(playback.status).toEqual({ playing: false });
  });
});

describe('changing the tier while playing', () => {
  test('applies from the next tick: the pending tick is rescheduled at the new interval and does the new unit', () => {
    const { playback, scheduler, run } = make();
    playback.play();
    scheduler.fire(); // slow: one micro-step → (1, 0, 0)
    expect(scheduler.pendingDelays()).toEqual([1000]);

    scheduler.advance(400);
    playback.setTier('fast');
    expect(scheduler.pendingDelays()).toEqual([500]);
    scheduler.fire();
    expect(at(run)).toEqual({ cycle: 1, stage: 2, micro: 1 }); // a whole generation, not another micro-step
    expect(scheduler.pendingDelays()).toEqual([500]);
  });

  test('switching to maximum from slow no longer waits out the slow interval', () => {
    const { playback, scheduler } = make({ params: { step: 0 } });
    playback.play();
    scheduler.fire();
    playback.setTier('maximum');
    expect(scheduler.pendingDelays()).toEqual([0]);
  });
});

describe('stop criteria', () => {
  // step 30 from 10: values 40, 70, 100 (reason "big" from cycle 3), 130, 160, 190, 220 (adds "huge" at cycle 7)
  const playUntilPaused = (m: ReturnType<typeof make>, limit = 500) => {
    for (let k = 0; k < limit && m.playback.status.playing; k++) m.scheduler.fire();
  };

  test.each(['slow', 'medium', 'fast', 'maximum'] as const)('%s: playback pauses at the end of the generation where a criterion first holds, and says which', (tier) => {
    const m = make({ params: { step: 30 } });
    m.playback.setTier(tier);
    m.playback.play();
    playUntilPaused(m);

    expect(m.playback.status).toEqual({ playing: false, pausedBecause: 'stop-criterion', stops: ['big'] });
    expect(m.run.cursor).toEqual({ cycle: 3, stage: 2, micro: 1 });
    expect(m.run.lastCycle).toBe(3); // the maximum tier does not run on past it within its batch
  });

  test('pressing play again continues past the criteria already reported, and pauses only for a new one', () => {
    const m = make({ params: { step: 30 } });
    m.playback.setTier('fast');
    m.playback.play();
    playUntilPaused(m);
    expect(m.run.cursor.cycle).toBe(3);

    m.playback.play();
    playUntilPaused(m);
    expect(m.playback.status).toEqual({ playing: false, pausedBecause: 'stop-criterion', stops: ['huge'] });
    expect(m.run.cursor.cycle).toBe(7);
  });

  test('a criterion that stops holding is forgotten, so it pauses again if it comes back', () => {
    // the fake never un-reports, so use two runs of the controller over a run whose reasons come and go
    const m = make({ params: { step: 30 } });
    m.playback.setTier('fast');
    m.playback.play();
    playUntilPaused(m);
    m.run.moveTo({ cycle: 1, stage: 2, micro: 1 }); // back to a generation with no criteria
    m.playback.play();
    playUntilPaused(m);
    expect(m.run.cursor.cycle).toBe(3);
    expect(m.playback.status).toMatchObject({ pausedBecause: 'stop-criterion', stops: ['big'] });
  });

  test('stepping manually past a stop is never blocked', () => {
    const m = make({ params: { step: 30 } });
    m.run.runUntil((s) => s.cycle === 3);
    expect(m.run.forwardCycle()).toBe(true);
    expect(m.run.lastCycle).toBe(4);
  });

  test('runUntilStop jumps to the first generation where a criterion not already reported holds', () => {
    const m = make({ params: { step: 30 } });
    expect(m.playback.runUntilStop()).toEqual({ reason: 'condition', cycles: 3 });
    expect(m.run.cursor).toEqual({ cycle: 3, stage: 2, micro: 1 });
    expect(m.scheduler.pendingDelays()).toEqual([]); // no animation, no timers

    expect(m.playback.runUntilStop()).toEqual({ reason: 'condition', cycles: 4 }); // "big" is known; waits for "huge"
    expect(m.run.cursor.cycle).toBe(7);
  });

  test('when the run is started again, what was reported for the old run is forgotten: runUntilStop stops for the same criterion in the new run', () => {
    const m = make({ params: { step: 30 } });
    expect(m.playback.runUntilStop()).toEqual({ reason: 'condition', cycles: 3 });
    m.run.reset();
    m.playback.forgetReports();
    expect(m.playback.status).toEqual({ playing: false });
    expect(m.playback.runUntilStop()).toEqual({ reason: 'condition', cycles: 3 }); // "big" again, not "huge"
    expect(m.playback.status).toMatchObject({ pausedBecause: 'stop-criterion', stops: ['big'] });
  });

  test('forgetting reports does not touch playback that is going on', () => {
    const m = make({ params: { step: 30 } });
    m.playback.setTier('fast');
    m.playback.play();
    m.playback.forgetReports();
    expect(m.playback.status.playing).toBe(true);
  });

  test('runUntilStop gives up after 2,000 generations when nothing ever stops', () => {
    const m = make({ params: { step: 0 } });
    expect(m.playback.runUntilStop()).toEqual({ reason: 'max-cycles', cycles: 2000 });
  });

  test('runUntilStop stops any playback in progress first', () => {
    const m = make({ params: { step: 30 } });
    m.playback.play();
    m.playback.runUntilStop();
    expect(m.playback.status.playing).toBe(false);
    expect(m.scheduler.pendingDelays()).toEqual([]);
  });
});

describe('animation flags', () => {
  test('follow the tier', () => {
    const { playback } = make();
    playback.setTier('medium');
    expect(playback.animate).toEqual({ micro: false, stage: true, population: true, plots: true });
    playback.setTier('maximum');
    expect(playback.animate).toEqual({ micro: false, stage: false, population: false, plots: false });
  });

  test('reduced motion turns every animation off at every tier, without changing the pacing', () => {
    const { playback, scheduler, run } = make({ reducedMotion: true });
    expect(playback.reducedMotion).toBe(true);
    expect(playback.animate).toEqual({ micro: false, stage: false, population: false, plots: false });

    playback.play();
    scheduler.fire();
    expect(at(run)).toEqual({ cycle: 1, stage: 0, micro: 0 }); // still one micro-step per tick
    expect(scheduler.pendingDelays()).toEqual([1000]); // still one second apart
  });

  test('can be switched on and off while the app runs, and the change is announced', () => {
    const { playback } = make();
    let announced = 0;
    playback.subscribe(() => announced++);
    playback.setReducedMotion(true);
    expect(playback.animate.micro).toBe(false);
    playback.setReducedMotion(false);
    expect(playback.animate.micro).toBe(true);
    expect(announced).toBe(2);
  });
});

describe('playback never changes the results', () => {
  test('every tier produces the identical run for the same seed', () => {
    const runs = (['slow', 'medium', 'fast', 'maximum'] as const).map((tier) => {
      const m = make({ params: { step: 30 }, seed: 17 });
      m.playback.setTier(tier);
      m.playback.play();
      for (let k = 0; k < 500 && m.playback.status.playing; k++) m.scheduler.fire();
      return Array.from({ length: 4 }, (_, c) => ({ snapshot: m.run.snapshot(c), events: m.run.events(c) }));
    });
    for (const other of runs.slice(1)) expect(other).toEqual(runs[0]);
  });
});

describe('errors', () => {
  test('a step that fails pauses playback with the reason and message instead of throwing', () => {
    const m = make({ params: { step: -1 } });
    m.playback.play();
    expect(() => m.scheduler.fire()).not.toThrow();
    expect(m.playback.status).toEqual({ playing: false, pausedBecause: 'error', error: 'The step must not be negative' });
    expect(m.scheduler.pendingDelays()).toEqual([]);
  });

  test('playing again after fixing the cause carries on', () => {
    const m = make({ params: { step: -1 } });
    m.playback.play();
    m.scheduler.fire();
    m.run.setParameters({ step: 5 });
    m.playback.play();
    m.scheduler.fire();
    expect(m.playback.status.playing).toBe(true);
    expect(m.run.lastCycle).toBe(1);
  });
});

describe('notifications', () => {
  test('subscribers hear about plays, ticks, pauses and tier changes, and can unsubscribe', () => {
    const { playback, scheduler } = make();
    const heard: boolean[] = [];
    const unsubscribe = playback.subscribe((status) => heard.push(status.playing));

    playback.play(); // 1
    scheduler.fire(); // 2 (a tick)
    playback.setTier('fast'); // 3
    playback.pause(); // 4
    expect(heard).toEqual([true, true, true, false]);

    unsubscribe();
    playback.play();
    expect(heard).toHaveLength(4);
  });
});
