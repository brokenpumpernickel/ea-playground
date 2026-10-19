import { describe, expect, test } from 'vitest';
import { gaAlgorithm, metricsOf, type GaEvent, type GaParams, type GaSetup, type RunState } from '../engine';
import { createRun, type Run } from '../run';
import { draftOf, validate } from './drawer-model';
import { presetFromData, presets, type Preset } from './presets';
import { entryOf } from './problems';

type GaRun = Run<GaSetup, GaParams, RunState, GaEvent>;
const byId = (suffix: string): Preset => presets.find((p) => p.problem === 'goldberg' && p.id.endsWith(suffix))!;
const wordPreset = (suffix: string): Preset => presets.find((p) => p.problem === 'target-string' && p.id.endsWith(suffix))!;
const play = (preset: Preset, generations: number): GaRun => {
  const run: GaRun = createRun(gaAlgorithm, { setup: preset.setup, params: preset.params, seed: preset.seed });
  for (let g = 0; g < generations; g++) run.forwardCycle();
  return run;
};
const metrics = (run: GaRun) => Array.from({ length: run.lastCycle + 1 }, (_, g) => metricsOf(run.snapshot(g).state));
const metrics27 = (run: GaRun) => Array.from({ length: run.lastCycle + 1 }, (_, g) => metricsOf(run.snapshot(g).state, run.setup.problem.alphabet.length));

describe('the preset files', () => {
  test('there are four for Goldberg and three for the target string, in the order of their file names, each with a name and a one-sentence lesson', () => {
    expect(presets.filter((p) => p.problem === 'goldberg').map((p) => p.name)).toEqual(['Textbook population', 'No crossover', 'No mutation', 'High mutation']);
    expect(presets.filter((p) => p.problem === 'target-string').map((p) => p.name)).toEqual(['Evolve a word', 'No mutation', 'Mutation too high']);
    expect(new Set(presets.map((p) => p.id)).size).toBe(presets.length);
    for (const preset of presets) {
      expect(preset.lesson.endsWith('.')).toBe(true);
      expect(preset.lesson.slice(0, -1)).not.toMatch(/[.!?]\s/); // one sentence
      expect(preset.lookFor.length).toBeGreaterThan(40);
    }
  });

  test.each(presets.map((p) => [p.name, p] as const))('%s is a valid configuration that the drawer accepts and the engine runs', (_name, preset) => {
    const draft = draftOf(preset.params, preset.setup, preset.seed, preset.options);
    const sample = play(preset, 0).snapshot(0).state.population.map((i) => i.fitness);
    expect(validate(draft, preset.setup.problem, sample, entryOf(preset.problem)).errors).toEqual({});
    expect(() => play(preset, 5)).not.toThrow();
  });

  test('a malformed file is refused with a message naming the file and the field', () => {
    const good = JSON.parse(JSON.stringify({ v: 1, problem: 'goldberg', name: 'x', lesson: 'y', lookFor: 'z', seed: 1, setup: { init: { kind: 'random', size: 4 } }, params: byId('textbook').params }));
    expect(() => presetFromData('9-ok', good)).not.toThrow();
    expect(() => presetFromData('9-bad', { ...good, v: 2 })).toThrow('"v" must be 1');
    expect(() => presetFromData('9-bad', { ...good, problem: 'chess' })).toThrow('"problem" must be one of "goldberg", "target-string", "knapsack"');
    expect(() => presetFromData('9-bad', { ...good, name: '' })).toThrow('Preset "9-bad": "name" must be a non-empty text.');
    expect(() => presetFromData('9-bad', { ...good, seed: 1.5 })).toThrow('"seed" must be a whole number');
    expect(() => presetFromData('9-bad', { ...good, setup: { init: { kind: 'magic' } } })).toThrow('"setup.init.kind" must be "random" or "explicit"');
    expect(() => presetFromData('9-bad', { ...good, params: { ...good.params, crossover: undefined } })).toThrow('"params.crossover" is missing');
    expect(() => presetFromData('9-bad', null)).toThrow('must hold one JSON object');
  });

  test('a niching setting in a preset is checked: its shape, and that the problem has a distance', () => {
    const land = presets.find((x) => x.problem === 'landscape' && x.id.endsWith('two-peaks-sharing'))!;
    const file = JSON.parse(JSON.stringify({ v: 1, problem: 'landscape', name: 'x', lesson: 'y', lookFor: 'z', seed: 1, options: land.options, setup: { init: { kind: 'random', size: 4 } }, params: land.params }));
    expect(() => presetFromData('9-ok', file)).not.toThrow();
    expect(() => presetFromData('9-bad', { ...file, params: { ...file.params, niching: { method: 'sharing', sigma: 3 } } })).toThrow('"params.niching" must hold a "method"');
    expect(() => presetFromData('9-bad', { ...file, params: { ...file.params, niching: { method: 'sharing', sigma: 0, alpha: 1 } } })).toThrow('σ (the niche radius) must be a number greater than 0');
    const gold = JSON.parse(JSON.stringify({ v: 1, problem: 'goldberg', name: 'x', lesson: 'y', lookFor: 'z', seed: 1, setup: { init: { kind: 'random', size: 4 } }, params: { ...byId('textbook').params, niching: { method: 'crowding', sigma: 2, alpha: 1 } } }));
    expect(() => presetFromData('9-bad', gold)).toThrow('needs a distance between individuals');
  });

  test('a preset of a problem with options must carry valid ones, and one of a problem without must not', () => {
    const word = JSON.parse(JSON.stringify({ v: 1, problem: 'target-string', name: 'x', lesson: 'y', lookFor: 'z', seed: 1, options: { alphabet: 'AB', target: 'AB' }, setup: { init: { kind: 'random', size: 4 } }, params: wordPreset('evolve-a-word').params }));
    expect(() => presetFromData('9-ok', word)).not.toThrow();
    expect(presetFromData('9-ok', word).setup.problem.chromosomeLength).toBe(2);
    expect(() => presetFromData('9-bad', { ...word, options: undefined })).toThrow('"options" is not valid');
    expect(() => presetFromData('9-bad', { ...word, options: { alphabet: 'AB', target: 'ABC' } })).toThrow('The target contains "C" (position 3), which is not in the alphabet');
    const bits = { ...word, problem: 'goldberg' };
    expect(() => presetFromData('9-bad', bits)).toThrow('the problem "goldberg" takes no "options"');
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

describe('the target string presets behave as their descriptions say for their seeds', () => {
  const wordsOf = (run: GaRun, generation: number) => run.snapshot(generation).state.population.map((i) => i.decoded as string);

  test('evolve a word: HELLO is found for the first time in generation 65, from an average of 0.42 matches and a diversity of 0.97 that falls to 0.39', () => {
    const preset = wordPreset('evolve-a-word');
    expect(preset.seed).toBe(42);
    expect(preset.options).toEqual({ alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ ', target: 'HELLO' });
    const run = play(preset, 100);
    const m = metrics27(run);
    expect(m.findIndex((x) => x.bestSoFar === 5)).toBe(65);
    expect(wordsOf(run, 65)).toContain('HELLO');
    expect(m[0]!.average.toFixed(2)).toBe('0.42');
    expect(m[0]!.diversity.toFixed(2)).toBe('0.97');
    expect(m[65]!.diversity.toFixed(2)).toBe('0.39');
    expect(m[64]!.best).toBeLessThan(5); // not found a generation earlier
  });

  test('evolve a word: no stop criterion holds before the target is reached in generation 65, so Run does not pause on the way', () => {
    const run = play(wordPreset('evolve-a-word'), 100);
    const stops = (g: number) => run.snapshot(g).stops;
    for (let g = 0; g < 65; g++) expect(stops(g)).toEqual([]);
    expect(stops(64)).not.toContain('target-reached');
    expect(stops(65)).toContain('target-reached');
  });

  test('evolve a word uses the problem’s defaults, so the first run a student sees is this one', () => {
    const preset = wordPreset('evolve-a-word');
    const entry = entryOf('target-string')!;
    expect(preset.params).toEqual(entry.defaults.params);
    expect(preset.setup.init).toEqual(entry.defaults.init);
    expect(preset.seed).toBe(entry.defaults.seed);
  });

  test('no mutation: no starting string has an O in position 5, the match rate of position 5 stays 0 all run, the population is copies of one string from generation 22, and the best stalls at 3', () => {
    const preset = wordPreset('no-mutation');
    expect(preset.params.mutation.enabled).toBe(false);
    const run = play(preset, 100);
    expect(wordsOf(run, 0).map((w) => w[4])).not.toContain('O');
    const m = metrics27(run);
    const o = preset.setup.problem.alphabet.indexOf('O');
    expect(m.every((x) => x.symbolCounts[4]![o] === 0)).toBe(true);
    expect(m[21]!.diversity).toBeGreaterThan(0);
    expect(m[22]!.diversity).toBe(0);
    expect(m[22]!.distinct).toBe(1);
    expect(m.slice(22).every((x) => x.diversity === 0)).toBe(true);
    expect(m[100]!.bestSoFar).toBe(3);
    expect(m.every((x) => x.bestSoFar < 4)).toBe(true);
    for (let g = 1; g <= 100; g++) {
      const events = run.events(g).flatMap((e) => (e.stage === 'mutation' ? [e] : []));
      expect(events.every((e) => e.decision === 'bypassed' && e.flipped.length === 0)).toBe(true);
    }
  });

  test('mutation too high: pm = 0.5, the best of a generation is below the best so far in 93 of 100 generations, the best so far stops at 3 (generation 8), HELLO is never found, and diversity stays above 0.83', () => {
    const preset = wordPreset('mutation-too-high');
    expect(preset.params.mutation).toEqual({ enabled: true, mode: 'per-gene', probability: 0.5 });
    const run = play(preset, 100);
    const m = metrics27(run);
    expect(m.slice(1).filter((x) => x.best < x.bestSoFar)).toHaveLength(93);
    expect(m.findIndex((x) => x.bestSoFar === 3)).toBe(8);
    expect(m[100]!.bestSoFar).toBe(3);
    expect(Math.max(...m.map((x) => x.best))).toBe(3);
    expect(Math.min(...m.slice(1).map((x) => x.diversity))).toBeGreaterThan(0.83);
  });

  test('every claim of the three descriptions about numbers appears in the text, so a changed seed or setting is noticed', () => {
    expect(wordPreset('evolve-a-word').lookFor).toContain('generation 65');
    expect(wordPreset('no-mutation').lookFor).toContain('position 5');
    expect(wordPreset('no-mutation').lookFor).toContain('generation 22');
    expect(wordPreset('no-mutation').lookFor).toContain('3 of 5');
    expect(wordPreset('mutation-too-high').lookFor).toContain('93 of the 100');
    expect(wordPreset('mutation-too-high').lookFor).toContain('generation 8');
  });
});
