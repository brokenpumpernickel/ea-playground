import { describe, expect, test } from 'vitest';
import { createFakeAlgorithm, type FakeParams, type FakeSetup } from './fake-algorithm';
import { createRng } from './rng';
import { createRun } from './run';

const setup: FakeSetup = { start: 10 };
const params: FakeParams = { step: 5 };
const make = (options?: { eventCacheSize?: number; seed?: number; params?: FakeParams }) => {
  const fake = createFakeAlgorithm();
  const run = createRun(fake.algorithm, { setup, params: options?.params ?? params, seed: options?.seed ?? 42 }, options);
  return { ...fake, run };
};

describe('a new run', () => {
  test('holds the initial state as cycle 0, with the generator state after setup and the parameters in force', () => {
    const { run, algorithm } = make();
    const reference = createRng(42);
    const expected = algorithm.start(setup, reference);

    expect(run.lastCycle).toBe(0);
    expect(run.snapshot(0)).toEqual({ cycle: 0, state: expected.state, rngState: reference.state(), params, stops: [] });
    expect(run.seed).toBe(42);
    expect(run.parameters).toEqual(params);
    expect(run.pendingParameters).toBeUndefined();
  });

  test('starts with the cursor at the end of the setup stage, where the initial population is already scored', () => {
    const { run } = make();
    expect(run.cursor).toEqual({ cycle: 0, stage: 0, micro: 2 });
    expect(run.layout(0)).toEqual([{ stage: 'setup', micros: 2 }]);
  });
});

describe('cycles are generated one whole generation at a time', () => {
  test('stepping forward from the live end generates the next cycle and lands at its first position', () => {
    const { run, calls } = make();
    expect(run.forwardMicro()).toBe(true);

    expect(run.lastCycle).toBe(1);
    expect(calls.step).toBe(1);
    expect(run.cursor).toEqual({ cycle: 1, stage: 0, micro: 0 });
    expect(run.snapshot(1).state.value).toBe(15);
    expect(run.snapshot(1).params).toEqual(params);
  });

  test('a cycle’s layout lists its stages in order with their micro-step counts', () => {
    const { run } = make();
    run.forwardMicro();
    expect(run.layout(1)).toEqual([
      { stage: 'prepare', micros: 0 },
      { stage: 'work', micros: 3 },
      { stage: 'finish', micros: 1 },
    ]);
  });

  test('each snapshot stores the generator state so the next cycle can start exactly there', () => {
    const { run, algorithm } = make();
    run.forwardMicro();
    run.forwardMicro();
    const rng = createRng(42);
    const start = algorithm.start(setup, rng);
    const first = algorithm.step(start.state, setup, params, rng);
    expect(run.snapshot(1).rngState).toBe(rng.state());
    expect(run.snapshot(1).state).toEqual(first.state);
  });
});

describe('micro-steps through one cycle', () => {
  test('walk through every position of a cycle, including each stage’s entry position (micro 0)', () => {
    const { run } = make();
    const seen = [];
    for (let k = 0; k < 8; k++) {
      run.forwardMicro();
      seen.push({ ...run.cursor });
    }
    expect(seen).toEqual([
      { cycle: 1, stage: 0, micro: 0 }, // prepare entered
      { cycle: 1, stage: 1, micro: 0 }, // work entered
      { cycle: 1, stage: 1, micro: 1 },
      { cycle: 1, stage: 1, micro: 2 },
      { cycle: 1, stage: 1, micro: 3 },
      { cycle: 1, stage: 2, micro: 0 }, // finish entered
      { cycle: 1, stage: 2, micro: 1 },
      { cycle: 2, stage: 0, micro: 0 }, // the next generation begins
    ]);
    expect(run.lastCycle).toBe(2);
  });

  test('going back retraces the positions, and crosses back into the previous cycle’s end', () => {
    const { run } = make();
    for (let k = 0; k < 8; k++) run.forwardMicro();
    expect(run.backMicro()).toBe(true);
    expect(run.cursor).toEqual({ cycle: 1, stage: 2, micro: 1 });
    run.backMicro();
    expect(run.cursor).toEqual({ cycle: 1, stage: 2, micro: 0 });
  });

  test('there is nothing before the start of the setup stage', () => {
    const { run } = make();
    while (run.backMicro());
    expect(run.cursor).toEqual({ cycle: 0, stage: 0, micro: 0 });
    expect(run.backMicro()).toBe(false);
  });
});

describe('the view at the cursor', () => {
  test('shows the cycle’s start and end states, and only the events visible so far', () => {
    const { run } = make();
    run.forwardMicro(); // (1, prepare, 0)
    expect(run.view().events.map((e) => e.kind)).toEqual(['note']); // the whole-stage event is visible on entry
    expect(run.view().before).toEqual(run.snapshot(0).state);
    expect(run.view().after).toEqual(run.snapshot(1).state);

    run.forwardMicro(); // (1, work, 0): stage entered, no unit done yet
    expect(run.view().events.map((e) => e.kind)).toEqual(['note']);
    run.forwardMicro(); // (1, work, 1)
    expect(run.view().events.map((e) => e.kind)).toEqual(['note', 'unit']);
    run.forwardMicro();
    expect(run.view().events.map((e) => e.micro)).toEqual([null, 1, 2]);
  });

  test('names the stage and its micro-step progress, and passes the cycle’s stop reasons through', () => {
    const { run } = make({ params: { step: 95 } }); // 10 + 95 reaches the fake’s stop threshold of 100
    run.forwardMicro();
    run.forwardMicro();
    run.forwardMicro();
    expect(run.view()).toMatchObject({ stage: 'work', micros: 3, position: { cycle: 1, stage: 1, micro: 1 } });
    expect(run.view().stops).toEqual(['big']);
  });

  test('cycle 0 has no start state, only its end state', () => {
    const { run } = make();
    expect(run.view().before).toBeUndefined();
    expect(run.view().after).toEqual(run.snapshot(0).state);
    expect(run.view().events.map((e) => e.stage)).toEqual(['setup', 'setup']);
  });
});

describe('events are regenerated from snapshots, not stored', () => {
  test('with no cache, asking for a cycle’s events again re-runs the step and gives identical events', () => {
    const { run, calls } = make({ eventCacheSize: 0 });
    run.forwardCycle();
    run.forwardCycle();
    const stepsSoFar = calls.step;

    const first = run.events(1);
    expect(calls.step).toBe(stepsSoFar + 1);
    expect(run.events(1)).toEqual(first);
    expect(calls.step).toBe(stepsSoFar + 2);
  });

  test('recent cycles are served from a small cache', () => {
    const { run, calls } = make({ eventCacheSize: 4 });
    run.forwardCycle();
    run.forwardCycle();
    const stepsSoFar = calls.step;
    run.events(2);
    run.events(2);
    expect(calls.step).toBe(stepsSoFar);
  });

  test('regenerated events equal the events the live run produced', () => {
    const live: unknown[] = [];
    const { run } = make({ eventCacheSize: 100 });
    for (let c = 1; c <= 5; c++) {
      run.forwardCycle();
      live.push(run.events(c));
    }
    const { run: cold } = make({ eventCacheSize: 0 });
    for (let c = 1; c <= 5; c++) cold.forwardCycle();
    for (let c = 1; c <= 5; c++) expect(cold.events(c)).toEqual(live[c - 1]);
    expect(cold.events(0)).toEqual(run.events(0));
  });
});

describe('navigating by stage and by cycle', () => {
  const cursors = (run: ReturnType<typeof make>['run'], move: () => boolean, times: number) => {
    const seen = [];
    for (let k = 0; k < times; k++) {
      move();
      seen.push({ ...run.cursor });
    }
    return seen;
  };

  test('forward by stage goes to the end of each stage in turn, crossing into the next generation when needed', () => {
    const { run } = make();
    expect(cursors(run, () => run.forwardStage(), 5)).toEqual([
      { cycle: 1, stage: 0, micro: 0 }, // prepare has no micro-steps, so its end is its entry
      { cycle: 1, stage: 1, micro: 3 },
      { cycle: 1, stage: 2, micro: 1 },
      { cycle: 2, stage: 0, micro: 0 },
      { cycle: 2, stage: 1, micro: 3 },
    ]);
  });

  test('from the middle of a stage, forward by stage completes that stage', () => {
    const { run } = make();
    run.forwardMicro();
    run.forwardMicro();
    run.forwardMicro(); // (1, work, 1)
    run.forwardStage();
    expect(run.cursor).toEqual({ cycle: 1, stage: 1, micro: 3 });
  });

  test('back by stage returns to the end of the previous stage', () => {
    const { run } = make();
    for (let k = 0; k < 4; k++) run.forwardMicro(); // (1, work, 2)
    expect(run.backStage()).toBe(true);
    expect(run.cursor).toEqual({ cycle: 1, stage: 0, micro: 0 });
    expect(run.backStage()).toBe(true);
    expect(run.cursor).toEqual({ cycle: 0, stage: 0, micro: 2 });
    expect(run.backStage()).toBe(false);
  });

  test('forward by cycle completes the current generation, then each following one', () => {
    const { run } = make();
    expect(cursors(run, () => run.forwardCycle(), 2)).toEqual([
      { cycle: 1, stage: 2, micro: 1 },
      { cycle: 2, stage: 2, micro: 1 },
    ]);
    run.backMicro();
    run.backMicro();
    run.forwardCycle();
    expect(run.cursor).toEqual({ cycle: 2, stage: 2, micro: 1 });
  });

  test('back by cycle goes to the end of the previous generation, even from the middle of one', () => {
    const { run } = make();
    run.forwardCycle();
    run.forwardCycle();
    run.moveTo({ cycle: 2, stage: 1, micro: 2 });
    expect(run.backCycle()).toBe(true);
    expect(run.cursor).toEqual({ cycle: 1, stage: 2, micro: 1 });
    run.backCycle();
    expect(run.cursor).toEqual({ cycle: 0, stage: 0, micro: 2 });
    expect(run.backCycle()).toBe(false);
  });

  test('a stage with no events in a generation is absent: it is not in the layout and navigation steps over it', () => {
    const { run } = make({ params: { step: 0 } });
    run.forwardMicro();
    expect(run.layout(1).map((s) => s.stage)).toEqual(['prepare', 'finish']);
    expect(cursors(run, () => run.forwardMicro(), 3)).toEqual([
      { cycle: 1, stage: 1, micro: 0 }, // finish entered
      { cycle: 1, stage: 1, micro: 1 },
      { cycle: 2, stage: 0, micro: 0 },
    ]);
  });
});

describe('moving the cursor to a position', () => {
  test('goes to any position that exists in a recorded cycle', () => {
    const { run } = make();
    run.forwardCycle();
    run.forwardCycle();
    expect(run.moveTo({ cycle: 1, stage: 1, micro: 2 })).toBe(true);
    expect(run.cursor).toEqual({ cycle: 1, stage: 1, micro: 2 });
  });

  test('refuses positions that do not exist, and leaves the cursor where it was', () => {
    const { run } = make();
    run.forwardCycle();
    const before = { ...run.cursor };
    for (const bad of [
      { cycle: 5, stage: 0, micro: 0 }, // not generated
      { cycle: -1, stage: 0, micro: 0 },
      { cycle: 1, stage: 3, micro: 0 }, // no such stage
      { cycle: 1, stage: 1, micro: 4 }, // work has 3 micro-steps
      { cycle: 1, stage: 1, micro: -1 },
    ]) {
      expect(run.moveTo(bad)).toBe(false);
      expect(run.cursor).toEqual(before);
    }
  });
});

describe('running until a condition', () => {
  test('advances generation by generation and stops at the end of the one where the condition first holds', () => {
    const { run } = make({ params: { step: 30 } }); // values 40, 70, 100 (stop reason "big" at cycle 3)
    const result = run.runUntil((snapshot) => snapshot.stops.length > 0);

    expect(result).toEqual({ reason: 'condition', cycles: 3 });
    expect(run.lastCycle).toBe(3);
    expect(run.cursor).toEqual({ cycle: 3, stage: 2, micro: 1 });
  });

  test('gives up after a maximum number of generations, saying so', () => {
    const { run } = make();
    const result = run.runUntil(() => false, { maxCycles: 5 });
    expect(result).toEqual({ reason: 'max-cycles', cycles: 5 });
    expect(run.lastCycle).toBe(5);
  });

  test('by default it will not run away: the limit is 2,000 generations', () => {
    const { run } = make({ params: { step: 0 } });
    expect(run.runUntil(() => false)).toEqual({ reason: 'max-cycles', cycles: 2000 });
  });

  test('through already recorded generations it just moves the cursor', () => {
    const { run, calls } = make();
    for (let k = 0; k < 4; k++) run.forwardCycle();
    run.moveTo({ cycle: 0, stage: 0, micro: 2 });
    const steps = calls.step;
    expect(run.runUntil((snapshot) => snapshot.cycle === 3)).toEqual({ reason: 'condition', cycles: 3 });
    expect(calls.step).toBe(steps);
    expect(run.lastCycle).toBe(4);
  });
});

describe('every way of advancing makes the same run', () => {
  const advanceTo = (cycles: number, how: (run: ReturnType<typeof make>['run']) => void) => {
    const { run } = make({ seed: 7, eventCacheSize: 0 });
    while (run.lastCycle < cycles) how(run);
    return run;
  };
  const record = (run: ReturnType<typeof make>['run'], cycles: number) =>
    Array.from({ length: cycles + 1 }, (_, c) => ({ snapshot: run.snapshot(c), events: run.events(c) }));

  test('micro-steps, stages, generations and run-until give identical snapshots and events', () => {
    const byMicro = record(advanceTo(6, (r) => r.forwardMicro()), 6);
    const byStage = record(advanceTo(6, (r) => r.forwardStage()), 6);
    const byCycle = record(advanceTo(6, (r) => r.forwardCycle()), 6);
    const untilRun = make({ seed: 7, eventCacheSize: 0 }).run;
    untilRun.runUntil((s) => s.cycle === 6);

    expect(byStage).toEqual(byMicro);
    expect(byCycle).toEqual(byMicro);
    expect(record(untilRun, 6)).toEqual(byMicro);
  });

  test('a different seed gives a different run', () => {
    const a = record(advanceTo(3, (r) => r.forwardCycle()), 3);
    const { run } = make({ seed: 8 });
    run.runUntil((s) => s.cycle === 3);
    expect(record(run, 3)).not.toEqual(a);
  });
});

describe('scrubbing shows what the live run showed', () => {
  const snapshotOfView = (run: ReturnType<typeof make>['run']) => JSON.parse(JSON.stringify({ cursor: run.cursor, view: run.view() }));

  test.each([4, 0])('every position visited live looks the same when scrubbed back to (event cache %i)', (eventCacheSize) => {
    const { run } = make({ seed: 11, eventCacheSize });
    const live = [snapshotOfView(run)];
    for (let k = 0; k < 40; k++) {
      run.forwardMicro();
      live.push(snapshotOfView(run));
    }

    // visit them in an order that is neither forwards nor backwards
    const order = live.map((_, k) => (k * 17) % live.length);
    for (const k of order) {
      expect(run.moveTo(live[k].cursor)).toBe(true);
      expect(snapshotOfView(run)).toEqual(live[k]);
    }
  });
});

describe('changing parameters', () => {
  test('at the live end a change is pending, and applies only when the next generation is made', () => {
    const { run } = make();
    run.forwardCycle(); // cycle 1, made with step 5
    expect(run.setParameters({ step: 7 })).toEqual({ status: 'pending', discarded: [] });

    expect(run.pendingParameters).toEqual({ step: 7 });
    expect(run.parameters).toEqual({ step: 7 });
    expect(run.snapshot(1).params).toEqual({ step: 5 }); // the finished generation is unchanged
    run.backMicro();
    run.forwardMicro();
    expect(run.lastCycle).toBe(1); // moving around inside it makes nothing new

    run.forwardCycle();
    expect(run.snapshot(2).params).toEqual({ step: 7 });
    expect(run.snapshot(2).state.value).toBe(10 + 5 + 7);
    expect(run.pendingParameters).toBeUndefined();
  });

  test('a later change replaces one that is still pending', () => {
    const { run } = make();
    run.setParameters({ step: 7 });
    run.setParameters({ step: 8 });
    run.forwardCycle();
    expect(run.snapshot(1).params).toEqual({ step: 8 });
  });

  test('scrubbed into the past, a change is not applied: it reports which generations it would discard', () => {
    const { run } = make();
    for (let k = 0; k < 4; k++) run.forwardCycle();
    run.moveTo({ cycle: 1, stage: 1, micro: 2 });

    expect(run.setParameters({ step: 9 })).toEqual({ status: 'needs-confirmation', discarded: [2, 3, 4] });
    expect(run.lastCycle).toBe(4);
    expect(run.pendingParameters).toBeUndefined();
    expect(run.cursor).toEqual({ cycle: 1, stage: 1, micro: 2 });
  });

  test('confirming discards the later generations, keeps the cursor’s generation, and applies the change to the next one', () => {
    const { run } = make();
    for (let k = 0; k < 4; k++) run.forwardCycle();
    run.moveTo({ cycle: 1, stage: 1, micro: 2 });

    expect(run.setParameters({ step: 9 }, { confirmDiscard: true })).toEqual({ status: 'pending', discarded: [2, 3, 4] });
    expect(run.lastCycle).toBe(1);
    expect(run.cursor).toEqual({ cycle: 1, stage: 1, micro: 2 });
    expect(() => run.snapshot(2)).toThrow('Cycle 2 does not exist');

    run.forwardCycle(); // completes cycle 1
    run.forwardCycle(); // makes cycle 2
    expect(run.snapshot(2).params).toEqual({ step: 9 });
    expect(run.snapshot(1).params).toEqual({ step: 5 });
  });

  test('from the very start, everything after cycle 0 would be discarded', () => {
    const { run } = make();
    run.forwardCycle();
    run.forwardCycle();
    run.moveTo({ cycle: 0, stage: 0, micro: 0 });
    expect(run.setParameters({ step: 1 })).toEqual({ status: 'needs-confirmation', discarded: [1, 2] });
  });

  test('the continued run equals a fresh run that had the same change at the same boundary', () => {
    const scrubbed = make({ seed: 3, eventCacheSize: 0 }).run;
    for (let k = 0; k < 4; k++) scrubbed.forwardCycle();
    scrubbed.moveTo({ cycle: 2, stage: 0, micro: 0 });
    scrubbed.setParameters({ step: 9 }, { confirmDiscard: true });
    scrubbed.runUntil((s) => s.cycle === 6);

    const fresh = make({ seed: 3, eventCacheSize: 0 }).run;
    fresh.forwardCycle();
    fresh.forwardCycle();
    fresh.setParameters({ step: 9 });
    fresh.runUntil((s) => s.cycle === 6);

    for (let c = 0; c <= 6; c++) {
      expect(scrubbed.snapshot(c)).toEqual(fresh.snapshot(c));
      expect(scrubbed.events(c)).toEqual(fresh.events(c));
    }
  });

  test('events regenerated after an earlier parameter change equal the live ones', () => {
    const play = (eventCacheSize: number) => {
      const { run } = make({ seed: 5, eventCacheSize });
      run.forwardCycle();
      run.setParameters({ step: 7 });
      run.forwardCycle();
      run.setParameters({ step: 2 });
      run.forwardCycle();
      run.forwardCycle();
      return run;
    };
    const live = play(100);
    const cold = play(0);
    for (let c = 0; c <= 4; c++) expect(cold.events(c)).toEqual(live.events(c));
  });
});

describe('changing the setup', () => {
  test('is refused with the names of what differs, and changes nothing', () => {
    const { run } = make();
    run.forwardCycle();
    expect(run.setSetup({ start: 11, label: 'x' })).toEqual({ status: 'reset-required', differences: ['start', 'label'] });
    expect(run.setup).toEqual(setup);
    expect(run.lastCycle).toBe(1);
  });

  test('an equivalent setup is accepted as unchanged', () => {
    const { run } = make();
    expect(run.setSetup({ start: 10 })).toEqual({ status: 'unchanged', differences: [] });
  });
});

describe('reset', () => {
  test('starts again from cycle 0 with the new setup, keeping the seed and the parameters', () => {
    const { run } = make({ seed: 21 });
    run.forwardCycle();
    run.forwardCycle();
    run.setParameters({ step: 7 });

    run.reset({ setup: { start: 11 } });

    expect(run.lastCycle).toBe(0);
    expect(run.seed).toBe(21);
    expect(run.setup).toEqual({ start: 11 });
    expect(run.snapshot(0).state.value).toBe(11);
    expect(run.cursor).toEqual({ cycle: 0, stage: 0, micro: 2 });
    expect(run.parameters).toEqual({ step: 7 });
    expect(run.pendingParameters).toBeUndefined();
    expect(() => run.snapshot(1)).toThrow('Cycle 1 does not exist');
  });

  test('a reset with nothing changed reproduces the same run, because the seed is kept', () => {
    const { run } = make({ seed: 21 });
    run.runUntil((s) => s.cycle === 4);
    const first = Array.from({ length: 5 }, (_, c) => ({ snapshot: run.snapshot(c), events: run.events(c) }));

    run.reset();
    run.runUntil((s) => s.cycle === 4);
    expect(Array.from({ length: 5 }, (_, c) => ({ snapshot: run.snapshot(c), events: run.events(c) }))).toEqual(first);
  });

  test('a new seed, supplied by the caller, gives a different run', () => {
    const { run } = make({ seed: 21 });
    run.runUntil((s) => s.cycle === 3);
    const before = run.snapshot(3);
    run.reset({ seed: 22 });
    run.runUntil((s) => s.cycle === 3);
    expect(run.seed).toBe(22);
    expect(run.snapshot(3)).not.toEqual(before);
  });

  test('the generator state is reset too, so events are regenerated from the new seed', () => {
    const { run } = make({ seed: 21, eventCacheSize: 0 });
    run.runUntil((s) => s.cycle === 2);
    run.reset({ seed: 5 });
    const { run: fresh } = make({ seed: 5, eventCacheSize: 0 });
    run.runUntil((s) => s.cycle === 2);
    fresh.runUntil((s) => s.cycle === 2);
    expect(run.events(2)).toEqual(fresh.events(2));
    expect(run.events(0)).toEqual(fresh.events(0));
  });
});

describe('warnings', () => {
  test('come from the algorithm for the parameters the next cycle will use, pending ones included', () => {
    const { run } = make();
    expect(run.warnings()).toEqual([]);
    run.setParameters({ step: 60 });
    expect(run.warnings()).toEqual(['The step is very large.']);
  });

  test('never stop the run from continuing', () => {
    const { run } = make({ params: { step: 60 } });
    expect(run.warnings()).toHaveLength(1);
    expect(run.forwardCycle()).toBe(true);
    expect(run.lastCycle).toBe(1);
  });
});
