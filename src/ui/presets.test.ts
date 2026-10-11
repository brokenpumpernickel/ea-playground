import { describe, expect, test } from 'vitest';
import { gaAlgorithm, metricsOf, type GaEvent, type GaParams, type GaSetup, type RunState } from '../engine';
import { createRun, type Run } from '../run';
import { draftOf, validate } from './drawer-model';
import { presetFromData, presets, type Preset } from './presets';

type GaRun = Run<GaSetup, GaParams, RunState, GaEvent>;
const byId = (suffix: string): Preset => presets.find((p) => p.id.endsWith(suffix))!;
const play = (preset: Preset, generations: number): GaRun => {
  const run: GaRun = createRun(gaAlgorithm, { setup: preset.setup, params: preset.params, seed: preset.seed });
  for (let g = 0; g < generations; g++) run.forwardCycle();
  return run;
};
const metrics = (run: GaRun) => Array.from({ length: run.lastCycle + 1 }, (_, g) => metricsOf(run.snapshot(g).state));

describe('the preset files', () => {
  test('there are four, in the order of their file names, each with a name and a one-sentence lesson', () => {
    expect(presets.map((p) => p.name)).toEqual(['Textbook population', 'No crossover', 'No mutation', 'High mutation']);
    expect(new Set(presets.map((p) => p.id)).size).toBe(presets.length);
    for (const preset of presets) {
      expect(preset.lesson.endsWith('.')).toBe(true);
      expect(preset.lesson.slice(0, -1)).not.toMatch(/[.!?]\s/); // one sentence
      expect(preset.lookFor.length).toBeGreaterThan(40);
    }
  });

  test.each(presets.map((p) => [p.name, p] as const))('%s is a valid configuration that the drawer accepts and the engine runs', (_name, preset) => {
    const draft = draftOf(preset.params, preset.setup, preset.seed);
    const sample = play(preset, 0).snapshot(0).state.population.map((i) => i.fitness);
    expect(validate(draft, preset.setup.problem, sample).errors).toEqual({});
    expect(() => play(preset, 5)).not.toThrow();
  });

  test('a malformed file is refused with a message naming the file and the field', () => {
    const good = JSON.parse(JSON.stringify({ v: 1, problem: 'goldberg', name: 'x', lesson: 'y', lookFor: 'z', seed: 1, setup: { init: { kind: 'random', size: 4 } }, params: byId('textbook').params }));
    expect(() => presetFromData('9-ok', good)).not.toThrow();
    expect(() => presetFromData('9-bad', { ...good, v: 2 })).toThrow('"v" must be 1');
    expect(() => presetFromData('9-bad', { ...good, problem: 'knapsack' })).toThrow('"problem" must be one of "goldberg", "target-string"');
    expect(() => presetFromData('9-bad', { ...good, name: '' })).toThrow('Preset "9-bad": "name" must be a non-empty text.');
    expect(() => presetFromData('9-bad', { ...good, seed: 1.5 })).toThrow('"seed" must be a whole number');
    expect(() => presetFromData('9-bad', { ...good, setup: { init: { kind: 'magic' } } })).toThrow('"setup.init.kind" must be "random" or "explicit"');
    expect(() => presetFromData('9-bad', { ...good, params: { ...good.params, crossover: undefined } })).toThrow('"params.crossover" is missing');
    expect(() => presetFromData('9-bad', null)).toThrow('must hold one JSON object');
  });
});

describe('textbook population (the acceptance check)', () => {
  const preset = byId('textbook');

  test('starts from the four textbook chromosomes with their fitness, total, average and best', () => {
    expect(preset.setup.init).toEqual({ kind: 'explicit', chromosomes: ['01101', '11000', '01000', '10011'] });
    expect(preset.params).toMatchObject({ crossover: { enabled: true, operator: 'one-point', probability: 1 }, mutation: { probability: 0.001 }, elites: 0 });
    const run = play(preset, 1);
    const start = run.snapshot(0).state.population;
    expect(start.map((i) => i.fitness)).toEqual([169, 576, 64, 361]);
    expect(start.reduce((sum, i) => sum + i.fitness, 0)).toBe(1170);
    const m = metricsOf(run.snapshot(0).state);
    expect(m.average).toBe(292.5);
    expect(m.best).toBe(576);
  });

  test('the selection probabilities are about 0.144, 0.492, 0.055 and 0.309', () => {
    const run = play(preset, 1);
    const table = run.events(1).flatMap((e) => (e.stage === 'selection' && e.kind === 'probabilities' ? [e] : []))[0]!;
    expect(table.entries.map((entry) => Math.round(entry.probability * 1000) / 1000)).toEqual([0.144, 0.492, 0.055, 0.309]);
  });

  test('its seed shows what the description says: both pairs recombine and exactly one gene (gene 3) mutates in generation 1', () => {
    const events = play(preset, 1).events(1);
    const crossover = events.flatMap((e) => (e.stage === 'crossover' ? [e] : []));
    expect(crossover.map((e) => e.decision)).toEqual(['recombined', 'recombined']);
    const flips = events.flatMap((e) => (e.stage === 'mutation' ? e.flipped : []));
    expect(flips).toEqual([3]);
  });
});

describe('the other presets behave as their descriptions say for their seeds', () => {
  test('no crossover: every pair of every generation is a switched-off bypass, and the best is still 900 after 50 generations', () => {
    const run = play(byId('no-crossover'), 50);
    for (let g = 1; g <= 50; g++) {
      const pairs = run.events(g).flatMap((e) => (e.stage === 'crossover' ? [e] : []));
      expect(pairs.every((e) => e.decision === 'bypassed' && e.reason === 'switched-off')).toBe(true);
    }
    const m = metrics(run);
    expect(m.every((x) => x.bestSoFar < 961)).toBe(true);
    expect(m[50]!.bestSoFar).toBe(900);
  });

  test('no mutation: gene 1 starts with no 1s and never gets one, the population collapses to copies, and the run stalls at 225', () => {
    const run = play(byId('no-mutation'), 50);
    const m = metrics(run);
    expect(m.every((x) => x.alleleFrequencies[0] === 0)).toBe(true);
    expect(m[30]!.diversity).toBe(0);
    expect(m[50]!.bestSoFar).toBe(225);
    for (let g = 1; g <= 50; g++) expect(run.events(g).flatMap((e) => (e.stage === 'mutation' ? e.flipped : []))).toEqual([]);
  });

  test('high mutation: best of generation is below best so far in 23 of the first 30 generations, and diversity stays high', () => {
    const run = play(byId('high-mutation'), 30);
    const m = metrics(run);
    expect(m.filter((x) => x.best < x.bestSoFar)).toHaveLength(23);
    const late = m.slice(15);
    expect(late.reduce((sum, x) => sum + x.diversity, 0) / late.length).toBeGreaterThan(0.3);
  });
});
