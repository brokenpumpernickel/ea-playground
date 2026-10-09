import { describe, expect, test } from 'vitest';
import { goldberg, runGeneration, startRun, type GaEvent, type GenerationConfig } from '../engine';
import { scripted } from '../engine/test-support';
import { describeEvent, stageTitle } from './describe';

const textbook = ['01101', '11000', '01000', '10011'];
const config: GenerationConfig = {
  problem: goldberg,
  selection: { method: 'roulette', chain: [{ step: 'identity' }] },
  crossover: { enabled: true, operator: 'one-point', probability: 0.8 },
  mutation: { enabled: true, mode: 'per-gene', probability: 0.05 },
  elites: 0,
  stop: { generationLimit: 50 },
};
// The mock's worked example: spins .58 .07 .91 .31 give pool 2, 1, 4, 2; pair 1 recombines after gene 4, pair 2 is a bypass; offspring 3 gene 2 flips.
const mockDraws = [
  0.58, 0.07, 0.91, 0.31, 0.41, 0.8, 0.93,
  0.62, 0.91, 0.27, 0.55, 0.88, 0.44, 0.73, 0.96, 0.18, 0.35, 0.81, 0.03, 0.67, 0.49, 0.22, 0.59, 0.14, 0.77, 0.92, 0.66,
];
const start = () => startRun(goldberg, { kind: 'explicit', chromosomes: textbook }, scripted());
const generation = (overrides: Partial<GenerationConfig> = {}, draws = mockDraws) =>
  runGeneration(start().state, { ...config, ...overrides }, scripted(...draws)).events;

const lines = (events: GaEvent[], filter: (e: GaEvent) => boolean) => events.filter(filter).map(describeEvent);

describe('setup and selection', () => {
  test('setup: each individual with its decoded value and fitness', () => {
    expect(start().events.map(describeEvent)).toEqual([
      'Individual 1 (01101): x = 13, fitness 169',
      'Individual 2 (11000): x = 24, fitness 576',
      'Individual 3 (01000): x = 8, fitness 64',
      'Individual 4 (10011): x = 19, fitness 361',
    ]);
  });

  test('weights: the chain of steps from fitness to weight', () => {
    expect(lines(generation(), (e) => e.stage === 'selection' && e.kind === 'weight-chain')).toEqual(['Selection weights: fitness → Identity → weight']);
  });

  test('probabilities: one share per individual', () => {
    expect(lines(generation(), (e) => e.stage === 'selection' && e.kind === 'probabilities')).toEqual([
      'Probabilities: individual 1 = 0.144, individual 2 = 0.492, individual 3 = 0.055, individual 4 = 0.309',
    ]);
  });

  test('spins: the draw and where it landed', () => {
    expect(lines(generation(), (e) => e.stage === 'selection' && e.kind === 'spin')).toEqual([
      'Spin 1: r = 0.58 → individual 2',
      'Spin 2: r = 0.07 → individual 1',
      'Spin 3: r = 0.91 → individual 4',
      'Spin 4: r = 0.31 → individual 2',
    ]);
  });

  test('an automatic switch to Shift is explained', () => {
    const negative = { chromosomeLength: 5, evaluate: (c: readonly number[]) => ({ decoded: 0, objective: 0, fitness: c.reduce((n, b) => n + b, 0) - 3 }) };
    const state = startRun(negative, { kind: 'explicit', chromosomes: ['00000', '11111', '01010', '10000'] }, scripted()).state;
    const events = runGeneration(state, { ...config, problem: negative }, scripted(...Array<number>(40).fill(0.5))).events;
    const [chain] = lines(events, (e) => e.stage === 'selection' && e.kind === 'weight-chain');
    expect(chain).toContain('fitness → Shift → weight');
    expect(chain).toContain('Switched to Shift automatically');
  });

  test('tournaments: the preamble, then contestants and the winner, noting a tie-break', () => {
    const events = generation({ selection: { method: 'tournament', size: 2 } }, [0.1, 0.6, 0.3, 0.9, 0.55, 0.05, 0.8, 0.3, ...mockDraws.slice(4)]);
    expect(lines(events, (e) => e.stage === 'selection')).toEqual([
      'Tournaments of 2 compare fitness directly; the weight chain is not used',
      'Tournament 1: individual 1 (fitness 169) vs individual 3 (fitness 64) → individual 1 wins',
      'Tournament 2: individual 2 (fitness 576) vs individual 4 (fitness 361) → individual 2 wins',
      'Tournament 3: individual 3 (fitness 64) vs individual 1 (fitness 169) → individual 1 wins',
      'Tournament 4: individual 4 (fitness 361) vs individual 2 (fitness 576) → individual 2 wins',
    ]);
    const tied = startRun(goldberg, { kind: 'explicit', chromosomes: ['01000', '11000', '01000', '11000'] }, scripted()).state;
    const tieEvents = runGeneration(tied, { ...config, selection: { method: 'tournament', size: 2 } }, scripted(0.8, 0.3, ...Array<number>(30).fill(0.5))).events;
    expect(lines(tieEvents, (e) => e.stage === 'selection' && e.kind === 'tournament')[0]).toBe(
      'Tournament 1: individual 4 (fitness 576) vs individual 2 (fitness 576) → individual 2 wins (tie: the lower position wins)',
    );
  });
});

describe('pairing, crossover, mutation', () => {
  test('pairs name their slots and parents', () => {
    expect(lines(generation(), (e) => e.stage === 'pairing')).toEqual([
      'Pair 1: slots 1 and 2 → individual 2 with individual 1',
      'Pair 2: slots 3 and 4 → individual 4 with individual 2',
    ]);
  });

  test('crossover: the draw against pc, the outcome, and the children', () => {
    expect(lines(generation(), (e) => e.stage === 'crossover')).toEqual([
      'Pair 1: u = 0.41 < pc 0.8 → recombined (cut after gene 4): children 11001 and 01100',
      'Pair 2: u = 0.93 ≥ pc 0.8 → bypassed: children are copies, 10011 and 11000',
    ]);
  });

  test('crossover switched off is a bypass with its reason', () => {
    const events = generation({ crossover: { ...config.crossover, enabled: false } }, [0.58, 0.07, 0.91, 0.31, ...mockDraws.slice(7)]);
    expect(lines(events, (e) => e.stage === 'crossover')[0]).toBe('Pair 1: crossover is off → bypassed: children are copies, 11000 and 01101');
  });

  test('two-point names the cuts, and an odd count notes the dropped child', () => {
    const draws = [0.58, 0.07, 0.91, 0.31, 0.1, 0.3, 0.5, 0.1, 0.9, 0.0, ...Array<number>(30).fill(0.9)];
    const two = lines(generation({ crossover: { ...config.crossover, operator: 'two-point', probability: 1 } }, draws), (e) => e.stage === 'crossover');
    expect(two[0]).toContain('(cuts after genes 2 and 3)');
    const odd = lines(generation({ elites: 1 }, [0.58, 0.07, 0.91, 0.31, 0.41, 0.8, 0.93, ...mockDraws.slice(7, 22)]), (e) => e.stage === 'crossover');
    expect(odd[1]).toContain('second child dropped');
  });

  test('uniform names the genes taken from the other parent', () => {
    const draws = [0.58, 0.07, 0.91, 0.31, 0.1, 0.1, 0.9, 0.4, 0.6, 0.5, ...Array<number>(30).fill(0.9)];
    const uniform = lines(generation({ crossover: { ...config.crossover, operator: 'uniform', probability: 1 } }, draws), (e) => e.stage === 'crossover');
    expect(uniform[0]).toContain('(genes 1 and 3 taken from the other parent)');
  });

  test('mutation: which genes flipped and the chromosome before and after', () => {
    const mutation = lines(generation(), (e) => e.stage === 'mutation');
    expect(mutation[0]).toBe('Offspring 1: no gene drew below pm 0.05 → unchanged (11001)');
    expect(mutation[2]).toBe('Offspring 3: gene 2 drew u = 0.03 < pm 0.05 → flipped (10011 → 11011)');
  });

  test('per-individual mutation names the chosen gene, and switched-off mutation says so', () => {
    const per = generation({ mutation: { enabled: true, mode: 'per-individual', probability: 0.2 } }, [...mockDraws.slice(0, 7), 0.9, 0.1, 0.5, 0.15, 0.99, 0.9]);
    const perLines = lines(per, (e) => e.stage === 'mutation');
    expect(perLines[0]).toBe('Offspring 1: u = 0.9 ≥ pm 0.2 → unchanged (11001)');
    expect(perLines[1]).toBe('Offspring 2: u = 0.1 < pm 0.2 → mutated, gene 3 chosen (01100 → 01000)');
    const off = lines(generation({ mutation: { ...config.mutation, enabled: false } }, mockDraws.slice(0, 7)), (e) => e.stage === 'mutation');
    expect(off[0]).toBe('Offspring 1: mutation is off → unchanged (11001)');
  });
});

describe('evaluation and replacement', () => {
  test('evaluation: chromosome, decoded value, fitness and the new individual id', () => {
    expect(lines(generation(), (e) => e.stage === 'evaluation')[3]).toBe('Offspring 4: 11000 → x = 24 → fitness 576 (individual 8)');
  });

  test('replacement lists the next population, marking elites', () => {
    expect(lines(generation(), (e) => e.stage === 'replacement')).toEqual(['Next population: individuals 5, 6, 7, 8']);
    const withElite = generation({ elites: 1 }, [0.58, 0.07, 0.91, 0.31, 0.41, 0.8, 0.93, ...mockDraws.slice(7, 22)]);
    expect(lines(withElite, (e) => e.stage === 'replacement')).toEqual(['Next population: individuals 2 (elite), 5, 6, 7']);
  });

  test('with truncation the discarded offspring are listed with their rank', () => {
    const [line] = lines(generation({ elites: 1, truncation: { enabled: true, lambda: 4 } }), (e) => e.stage === 'replacement');
    expect(line).toBe('Next population: individuals 2 (elite), 7, 5, 8. Discarded: offspring 2 (rank 4)');
  });

  test('a long list of discarded offspring is summarised so the narration stays one line', () => {
    const ranking = [1, 2, 3, 4, 5, 6].map((k) => ({ individualId: 10 + k, offspring: k, rank: k, kept: k <= 3 }));
    const line = describeEvent({ stage: 'replacement', kind: 'summary', elites: [], population: [11, 12, 13], ranking });
    expect(line).toBe('Next population: individuals 11, 12, 13. Discarded: 3 offspring (ranks 4–6)');
  });

});

describe('stage titles', () => {
  test.each([
    ['setup', 'Setup: scoring the initial population'],
    ['selection', 'Selection'],
    ['pairing', 'Pairing'],
    ['crossover', 'Crossover'],
    ['mutation', 'Mutation'],
    ['evaluation', 'Evaluation of offspring'],
    ['replacement', 'Replacement'],
  ])('%s', (stage, title) => expect(stageTitle(stage)).toBe(title));
});
