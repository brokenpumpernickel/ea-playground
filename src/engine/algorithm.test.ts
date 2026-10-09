import { describe, expect, test } from 'vitest';
import { gaAlgorithm, populationFromEvents, type GaParams, type GaSetup } from './algorithm';
import { goldberg } from './goldberg';
import { createRun } from '../run/run';

const setup: GaSetup = { problem: goldberg, init: { kind: 'random', size: 6 } };
const params: GaParams = {
  selection: { method: 'roulette', chain: [{ step: 'identity' }] },
  crossover: { enabled: true, operator: 'one-point', probability: 0.8 },
  mutation: { enabled: true, mode: 'per-gene', probability: 0.05 },
  elites: 0,
  stop: { generationLimit: 50, stagnationWindow: 10 },
};
const make = (overrides: { setup?: Partial<GaSetup>; params?: Partial<GaParams>; seed?: number; eventCacheSize?: number } = {}) =>
  createRun(
    gaAlgorithm,
    { setup: { ...setup, ...overrides.setup }, params: { ...params, ...overrides.params }, seed: overrides.seed ?? 42 },
    { eventCacheSize: overrides.eventCacheSize },
  );

describe('the GA as an algorithm for the run layer', () => {
  test('cycle 0 is the scored initial population, with one micro-step per individual', () => {
    const run = make();
    expect(run.snapshot(0).state.population).toHaveLength(6);
    expect(run.layout(0)).toEqual([{ stage: 'setup', micros: 6 }]);
  });

  test('a generation lists its stages in order, with a micro-step for each spin, pair and offspring', () => {
    const run = make();
    run.forwardCycle();
    expect(run.layout(1)).toEqual([
      { stage: 'selection', micros: 6 }, // six spins (the weight table is whole-stage)
      { stage: 'pairing', micros: 3 },
      { stage: 'crossover', micros: 3 },
      { stage: 'mutation', micros: 6 },
      { stage: 'evaluation', micros: 6 },
      { stage: 'replacement', micros: 1 },
    ]);
  });

  test('with one elite and four individuals: four spins for three offspring, and counts follow', () => {
    const run = make({ setup: { init: { kind: 'random', size: 4 } }, params: { elites: 1 } });
    run.forwardCycle();
    expect(run.layout(1).map((s) => [s.stage, s.micros])).toEqual([
      ['selection', 4],
      ['pairing', 2],
      ['crossover', 2],
      ['mutation', 3],
      ['evaluation', 3],
      ['replacement', 1],
    ]);
  });

  test('when every individual is an elite nothing is made, so only selection and replacement remain', () => {
    const run = make({ setup: { init: { kind: 'random', size: 4 } }, params: { elites: 4 } });
    run.forwardCycle();
    expect(run.layout(1).map((s) => [s.stage, s.micros])).toEqual([
      ['selection', 0],
      ['replacement', 1],
    ]);
  });

  test('the whole-stage weight table is visible as soon as selection is entered, before the first spin', () => {
    const run = make();
    run.forwardMicro(); // (1, selection, 0)
    expect(run.view().events.map((e) => (e.stage === 'selection' ? e.kind : e.stage))).toEqual(['weight-chain', 'probabilities']);
    run.forwardMicro(); // first spin
    expect(run.view().events.map((e) => (e.stage === 'selection' ? e.kind : e.stage))).toEqual(['weight-chain', 'probabilities', 'spin']);
  });

  test('stop reasons reach the view at the end of the cycle that reports them', () => {
    const run = make({ params: { stop: { generationLimit: 2 } } });
    run.forwardCycle();
    expect(run.view().stops).toEqual([]);
    run.forwardCycle();
    expect(run.view().stops).toEqual(['generation-limit']);
  });
});

describe('the real GA through the run layer', () => {
  const record = (run: ReturnType<typeof make>, cycles: number) =>
    Array.from({ length: cycles + 1 }, (_, c) => ({ snapshot: run.snapshot(c), events: run.events(c) }));

  test('micro-steps, stages, generations and run-until make the identical run', () => {
    const advance = (how: (r: ReturnType<typeof make>) => void) => {
      const run = make({ seed: 9, eventCacheSize: 0 });
      while (run.lastCycle < 8) how(run);
      return record(run, 8);
    };
    const byMicro = advance((r) => r.forwardMicro());
    expect(advance((r) => r.forwardStage())).toEqual(byMicro);
    expect(advance((r) => r.forwardCycle())).toEqual(byMicro);
    const until = make({ seed: 9, eventCacheSize: 0 });
    until.runUntil((s) => s.cycle === 8);
    expect(record(until, 8)).toEqual(byMicro);
  });

  test('replaying a generation’s events alone reproduces exactly the population the engine produced', () => {
    for (const elites of [0, 2]) {
      const run = make({ seed: 14, eventCacheSize: 0, params: { elites } });
      run.runUntil((s) => s.cycle === 10);
      for (let c = 1; c <= 10; c++) {
        const replayed = populationFromEvents(run.snapshot(c - 1).state.population, run.events(c));
        expect(replayed).toEqual(run.snapshot(c).state.population);
      }
    }
  });

  test('the setup events alone reproduce the initial population', () => {
    const run = make({ seed: 3 });
    expect(populationFromEvents([], run.events(0))).toEqual(run.snapshot(0).state.population);
  });

  test('events regenerated from a snapshot equal the live ones, even after a parameter change', () => {
    const play = (eventCacheSize: number) => {
      const run = make({ seed: 5, eventCacheSize });
      run.forwardCycle();
      run.forwardCycle();
      run.setParameters({ ...params, crossover: { ...params.crossover, probability: 0.1 }, elites: 1 });
      run.runUntil((s) => s.cycle === 6);
      return run;
    };
    const live = play(100);
    const cold = play(0);
    for (let c = 0; c <= 6; c++) expect(cold.events(c)).toEqual(live.events(c));
  });

  test('a pending change reaches the generation made after it, and no earlier one', () => {
    const run = make({ seed: 2 });
    run.forwardCycle();
    run.setParameters({ ...params, crossover: { ...params.crossover, enabled: false } });
    run.forwardCycle();
    const decisions = (cycle: number) => run.events(cycle).flatMap((e) => (e.stage === 'crossover' ? [e.decision] : []));
    expect(decisions(1).every((d) => d === 'bypassed' || d === 'recombined')).toBe(true);
    expect(run.events(1).some((e) => e.stage === 'crossover' && e.reason === 'switched-off')).toBe(false);
    expect(run.events(2).filter((e) => e.stage === 'crossover').every((e) => e.stage === 'crossover' && e.reason === 'switched-off')).toBe(true);
  });

  test('a reset with the same seed reproduces the run', () => {
    const run = make({ seed: 12 });
    run.runUntil((s) => s.cycle === 5);
    const first = record(run, 5);
    run.reset();
    run.runUntil((s) => s.cycle === 5);
    expect(record(run, 5)).toEqual(first);
  });
});

describe('what needs a reset', () => {
  test('a different problem, population size or initialization is refused with the name of what changed', () => {
    const run = make();
    const other = { ...goldberg };
    expect(run.setSetup({ ...setup, problem: other })).toEqual({ status: 'reset-required', differences: ['problem'] });
    expect(run.setSetup({ ...setup, init: { kind: 'random', size: 8 } })).toEqual({ status: 'reset-required', differences: ['populationSize'] });
    expect(run.setSetup({ ...setup, init: { kind: 'explicit', chromosomes: ['00000', '11111', '01010', '10101', '00111', '11100'] } })).toEqual({
      status: 'reset-required',
      differences: ['initialization'],
    });
    expect(run.setSetup({ ...setup, init: { kind: 'explicit', chromosomes: ['00000', '11111'] } }).differences).toEqual(['populationSize', 'initialization']);
  });

  test('the same setup is unchanged', () => {
    expect(make().setSetup({ ...setup })).toEqual({ status: 'unchanged', differences: [] });
  });

  test('operator parameters, elites and stop criteria are not setup: they can be changed without a reset', () => {
    const run = make();
    expect(run.setParameters({ ...params, elites: 2, stop: { generationLimit: 10 } }).status).toBe('pending');
  });
});

describe('limits are warnings', () => {
  test('a population above 500 or a generation limit above 2,000 is reported, and the run still works', () => {
    const big = make({ setup: { init: { kind: 'random', size: 501 } }, params: { stop: { generationLimit: 2001 } } });
    expect(big.warnings()).toEqual([
      'Population size 501 is above the supported limit of 500, so the app may become slow.',
      'A generation limit of 2001 is above the supported maximum of 2000, so scrubbing and plots may become slow.',
    ]);
    expect(big.forwardCycle()).toBe(true);
    expect(big.snapshot(1).state.population).toHaveLength(501);
  });

  test('the supported maximums themselves are fine', () => {
    expect(make({ setup: { init: { kind: 'random', size: 500 } }, params: { stop: { generationLimit: 2000 } } }).warnings()).toEqual([]);
  });
});

describe('offspring truncation through the run layer', () => {
  const truncating = (lambda: number, elites = 1): Partial<GaParams> => ({ elites, truncation: { enabled: true, lambda } });

  test('λ offspring mean λ spins and λ evaluations, and replacement is still one micro-step', () => {
    const run = make({ setup: { init: { kind: 'random', size: 4 } }, params: truncating(8) });
    run.forwardCycle();
    expect(run.layout(1).map((s) => [s.stage, s.micros])).toEqual([
      ['selection', 8],
      ['pairing', 4],
      ['crossover', 4],
      ['mutation', 8],
      ['evaluation', 8],
      ['replacement', 1],
    ]);
  });

  test('replaying the events alone reproduces every population, though discarded offspring appear only in evaluation events', () => {
    const run = make({ seed: 19, eventCacheSize: 0, params: truncating(9, 2) });
    run.runUntil((s) => s.cycle === 8);
    for (let c = 1; c <= 8; c++) {
      expect(populationFromEvents(run.snapshot(c - 1).state.population, run.events(c))).toEqual(run.snapshot(c).state.population);
    }
    const events = run.events(1);
    const evaluated = events.filter((e) => e.stage === 'evaluation').length;
    expect(evaluated).toBe(9);
    expect(run.snapshot(1).state.population).toHaveLength(6);
  });

  test('switching truncation on at a boundary changes the next generation only', () => {
    const run = make({ seed: 3 });
    run.forwardCycle();
    run.setParameters({ ...params, truncation: { enabled: true, lambda: 12 } });
    run.forwardCycle();
    run.forwardCycle();
    const counts = [1, 2, 3].map((c) => run.events(c).filter((e) => e.stage === 'evaluation').length);
    expect(counts).toEqual([6, 12, 12]);
    expect(run.snapshot(1).params.truncation).toBeUndefined();
    expect(run.snapshot(3).state.population).toHaveLength(6);
  });

  test('a λ that cannot fill the population is refused with a readable reason when the generation is made', () => {
    const run = make({ params: truncating(1, 0) }); // N = 6, e = 0 needs at least 6
    expect(() => run.forwardCycle()).toThrow('λ must be a whole number of at least N − e = 6');
  });
});

describe('tournament selection through the run layer', () => {
  const tournament = (size = 2, overrides: Partial<GaParams> = {}): Partial<GaParams> => ({ selection: { method: 'tournament', size }, ...overrides });

  test('the selection stage has one micro-step per tournament, and the rest of the layout is unchanged', () => {
    const run = make({ setup: { init: { kind: 'random', size: 4 } }, params: tournament(3, { elites: 1 }) });
    run.forwardCycle();
    expect(run.layout(1).map((s) => [s.stage, s.micros])).toEqual([
      ['selection', 4],
      ['pairing', 2],
      ['crossover', 2],
      ['mutation', 3],
      ['evaluation', 3],
      ['replacement', 1],
    ]);
  });

  test('entering the stage shows only the preamble; each micro-step then adds one tournament', () => {
    const run = make({ params: tournament(2) });
    run.forwardMicro(); // (1, selection, 0)
    const kinds = () => run.view().events.map((e) => (e.stage === 'selection' ? e.kind : e.stage));
    expect(kinds()).toEqual(['tournament-setup']);
    run.forwardMicro();
    expect(kinds()).toEqual(['tournament-setup', 'tournament']);
    run.forwardMicro();
    expect(kinds()).toEqual(['tournament-setup', 'tournament', 'tournament']);
  });

  test('replaying the events alone reproduces every population', () => {
    const run = make({ seed: 8, eventCacheSize: 0, params: tournament(3, { elites: 1 }) });
    run.runUntil((s) => s.cycle === 8);
    for (let c = 1; c <= 8; c++) {
      expect(populationFromEvents(run.snapshot(c - 1).state.population, run.events(c))).toEqual(run.snapshot(c).state.population);
    }
  });

  test('every way of advancing makes the identical run, and regenerated events equal the live ones', () => {
    const advance = (how: (r: ReturnType<typeof make>) => void, eventCacheSize: number) => {
      const run = make({ seed: 21, eventCacheSize, params: tournament(2) });
      while (run.lastCycle < 6) how(run);
      return Array.from({ length: 7 }, (_, c) => ({ snapshot: run.snapshot(c), events: run.events(c) }));
    };
    const byMicro = advance((r) => r.forwardMicro(), 0);
    expect(advance((r) => r.forwardStage(), 0)).toEqual(byMicro);
    expect(advance((r) => r.forwardCycle(), 100)).toEqual(byMicro);
  });

  test('switching from roulette to tournament at a boundary changes the next generation only', () => {
    const run = make({ seed: 3 });
    run.forwardCycle();
    run.setParameters({ ...params, selection: { method: 'tournament', size: 2 } });
    run.forwardCycle();
    const selectionKinds = (c: number) => [...new Set(run.events(c).flatMap((e) => (e.stage === 'selection' ? [e.kind] : [])))];
    expect(selectionKinds(1)).toEqual(['weight-chain', 'probabilities', 'spin']);
    expect(selectionKinds(2)).toEqual(['tournament-setup', 'tournament']);
  });
});
