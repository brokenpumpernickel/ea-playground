import { describe, expect, test } from 'vitest';
import { landscapeDefaultEpsilon, landscapeProblem, type GaParams, type GaSetup, type LandscapeOptions } from '../engine';
import { changes, chromosomePieces, draftOf, optionsOf, parseChromosomes, problemOf, resetParams, toParams, toSetup, validate, withRepresentation, type Draft } from './drawer-model';
import { defaultsOf, entryOf } from './problems';

const entry = entryOf('landscape')!;
const optionsFor = (o: Partial<LandscapeOptions> = {}): LandscapeOptions => ({ ...(entry.defaultOptions() as LandscapeOptions), ...o });

interface Current {
  params: GaParams;
  setup: GaSetup;
  seed: number;
  options: LandscapeOptions;
}
const currentOf = (o: Partial<LandscapeOptions> = {}): Current => {
  const options = optionsFor(o);
  const d = defaultsOf(entry, options);
  return { params: d.params, setup: { problem: entry.create(options), init: d.init }, seed: d.seed, options };
};
const draftFor = (c: Current): Draft => draftOf(c.params, c.setup, c.seed, c.options);
const errorsOf = (draft: Draft, c: Current) => validate(draft, problemOf(draft, entry, c.setup.problem), [], entry).errors;

describe('the landscape draft', () => {
  test('a real-valued run is drafted with its options, α, σ and ε as typed text', () => {
    const draft = draftFor(currentOf());
    expect(draft.landscape).toEqual({ function: 'single-peak', representation: 'real', bits: '10' });
    expect(draft.crossover).toEqual({ enabled: true, operator: 'blx-alpha', probability: '0.9', alpha: '0.5' });
    expect(draft.mutation).toEqual({ enabled: true, mode: 'per-gene', probability: '0.1', sigma: '0.05' });
    expect(draft.stop.epsilon).toEqual({ enabled: true, value: String(landscapeDefaultEpsilon(landscapeProblem(optionsFor()))) });
    expect(draft.stop.target.enabled).toBe(false);
  });

  test('a binary-coded run has no α or σ, and its bits per variable are drafted', () => {
    const draft = draftFor(currentOf({ representation: 'gray', bitsPerVariable: 8 }));
    expect(draft.landscape).toEqual({ function: 'single-peak', representation: 'gray', bits: '8' });
    expect(draft.crossover).toEqual({ enabled: true, operator: 'one-point', probability: '0.9' });
    expect(draft.mutation).toEqual({ enabled: true, mode: 'per-gene', probability: '0.05' });
  });

  test('the options the draft describes are read from the typed text', () => {
    const draft = draftFor(currentOf({ representation: 'plain', bitsPerVariable: 6 }));
    draft.landscape!.function = 'himmelblau';
    draft.landscape!.bits = '11';
    expect(optionsOf(draft)).toEqual({ function: 'himmelblau', representation: 'plain', bitsPerVariable: 11 });
    draft.landscape!.bits = 'x';
    expect(Number.isNaN((optionsOf(draft) as LandscapeOptions).bitsPerVariable)).toBe(true);
  });

  test.each(['real', 'plain', 'gray'] as const)('%s: the draft turns back into exactly the parameters it came from', (representation) => {
    const c = currentOf({ representation, bitsPerVariable: 9 });
    const { truncation, ...params } = toParams(draftFor(c)); // the drawer always writes the truncation setting, off here
    expect(truncation).toEqual({ enabled: false, lambda: 12 });
    expect(params).toEqual(c.params);
    expect(toSetup(draftFor(c), c.setup.problem)).toEqual({ problem: c.setup.problem, init: c.setup.init });
  });

  test('a valid draft has no errors, for every representation', () => {
    for (const representation of ['real', 'plain', 'gray'] as const) {
      const c = currentOf({ representation, bitsPerVariable: 9 });
      expect(errorsOf(draftFor(c), c)).toEqual({});
    }
  });
});

describe('validation of the landscape fields, each under its own field', () => {
  const c = currentOf();
  const bad = (change: (d: Draft) => void) => {
    const draft = draftFor(c);
    change(draft);
    return errorsOf(draft, c);
  };

  test('function, representation and bits per variable', () => {
    expect(bad((d) => (d.landscape!.function = 'sphere' as never))).toEqual({ function: 'Function must be one of single-peak, two-peaks, rastrigin, himmelblau (it is "sphere").' });
    expect(bad((d) => (d.landscape!.representation = 'ternary' as never))).toEqual({ representation: 'Representation must be one of real, plain, gray (it is "ternary").' });
    expect(bad((d) => { d.landscape!.representation = 'plain'; d.landscape!.bits = '13'; d.crossover = { enabled: true, operator: 'one-point', probability: '0.8' }; d.mutation = { enabled: true, mode: 'per-gene', probability: '0.02' }; })).toEqual({
      bitsPerVariable: 'Bits per variable must be a whole number from 4 to 12 (it is 13).',
    });
  });

  test('α: a number of 0 or more, only while the operator is BLX-α', () => {
    expect(bad((d) => (d.crossover.alpha = '-1'))).toEqual({ 'crossover.alpha': 'α must be a number of 0 or more.' });
    expect(bad((d) => (d.crossover.alpha = 'wide'))).toEqual({ 'crossover.alpha': 'α must be a number of 0 or more.' });
    expect(bad((d) => (d.crossover.alpha = '0'))).toEqual({});
    expect(bad((d) => (d.crossover.operator = 'uniform'))).toEqual({ 'crossover.alpha': 'α belongs to BLX-α crossover; leave it out or choose BLX-α.' });
  });

  test('σ: a number greater than 0', () => {
    expect(bad((d) => (d.mutation.sigma = '0'))).toEqual({ 'mutation.sigma': 'σ must be a number greater than 0.' });
    expect(bad((d) => (d.mutation.sigma = ''))).toEqual({ 'mutation.sigma': 'σ must be a number greater than 0.' });
    expect(bad((d) => (d.mutation.sigma = '2'))).toEqual({});
  });

  test('ε: a number greater than 0 while it is on, ignored while it is off', () => {
    expect(bad((d) => (d.stop.epsilon!.value = '0'))).toEqual({ 'stop.epsilon': 'ε must be a number greater than 0.' });
    expect(bad((d) => { d.stop.epsilon!.enabled = false; d.stop.epsilon!.value = 'x'; })).toEqual({});
  });

  test('a target fitness is not how the landscape stops', () => {
    expect(bad((d) => { d.stop.target.enabled = true; d.stop.target.value = '1'; })).toEqual({ 'stop.target': 'The landscape stops within ε of its optimum; use ε instead of a target fitness.' });
  });

  test('a real-only crossover type is refused for the binary-coded representations, whatever the draft says', () => {
    const g = currentOf({ representation: 'gray', bitsPerVariable: 6 });
    const draft = draftFor(g);
    draft.crossover.operator = 'arithmetic';
    expect(errorsOf(draft, g)).toEqual({ 'crossover.operator': 'Arithmetic crossover is for real-valued chromosomes; choose one-point, two-point or uniform crossover for this problem.' });
  });

  test('two-point crossover needs three genes: a real-valued landscape refuses it in the usual words', () => {
    expect(bad((d) => { d.crossover.operator = 'two-point'; delete d.crossover.alpha; })).toEqual({
      'crossover.operator': "Two-point crossover needs chromosomes of at least 3 genes, but this problem's have 2. Choose another crossover type or switch crossover off.",
    });
  });
});

describe('a hand-edited population for the landscape', () => {
  const real = landscapeProblem(optionsFor());
  const binary = landscapeProblem(optionsFor({ representation: 'plain', bitsPerVariable: 4 }));

  test('real: one chromosome per line, numbers separated by spaces or commas; a semicolon also separates chromosomes', () => {
    expect(chromosomePieces('1.5 -2\n0.5, 1;3 3\r\n\n 4 -4 ', real)).toEqual(['1.5 -2', '0.5, 1', '3 3', '4 -4']);
    expect(chromosomePieces('0101 1010', binary)).toEqual(['0101', '1010']);
  });

  test('real: each row shows what it decodes to, its fitness and the table cells; a bad row says what is wrong', () => {
    const rows = parseChromosomes('2 -1\n0 0\n6 0\n1\n1 x', real);
    expect(rows[0]).toMatchObject({ text: '2 -1', decoded: '(2.000, −1.000)', fitness: 1, cells: ['1.000'] });
    expect(rows[1]!.fitness).toBeCloseTo(Math.exp(-5 / 8), 12);
    expect(rows[2]!.error).toBe('Chromosome 3: gene 1 (6) is outside its bounds from −5 to 5.');
    expect(rows[3]!.error).toBe('Chromosome 4 has 1 number, but this problem needs 2.');
    expect(rows[4]!.error).toBe('Chromosome 5 ("1 x") may only contain numbers separated by spaces or commas.');
  });

  test('binary-coded: bit strings of 2·n bits are decoded to the point', () => {
    const rows = parseChromosomes('11110000\n1000', binary);
    expect(rows[0]).toMatchObject({ decoded: '(5.000, −5.000)', fitness: binary.fitnessAt(5, -5) });
    expect(rows[1]!.error).toBe('Chromosome 2 has 4 genes, but this problem needs 8.');
  });

  test('the draft with such a population is valid and becomes the setup', () => {
    const c = currentOf();
    const draft = draftFor(c);
    draft.init = 'explicit';
    draft.chromosomes = '2 -1\n0 0';
    expect(errorsOf(draft, c)).toEqual({});
    expect(toSetup(draft, c.setup.problem).init).toEqual({ kind: 'explicit', chromosomes: ['2 -1', '0 0'] });
  });

  test('an empty hand-edited population is asked for with an example of the right shape', () => {
    const c = currentOf();
    const draft = draftFor(c);
    draft.init = 'explicit';
    draft.chromosomes = '';
    expect(errorsOf(draft, c).chromosomes).toBe('Type at least one chromosome, for example 1.5 -2.5.');
  });
});

describe('switching the representation resets the operators to the new representation’s defaults', () => {
  test('real → Gray: one-point crossover and bit-flip mutation, no α or σ, the settings of the bits kept as defaults', () => {
    const c = currentOf();
    const draft = withRepresentation(draftFor(c), 'gray');
    expect(draft.landscape!.representation).toBe('gray');
    expect(draft.crossover).toEqual({ enabled: true, operator: 'one-point', probability: '0.9' });
    expect(draft.mutation).toEqual({ enabled: true, mode: 'per-gene', probability: '0.05' });
    expect(errorsOf(draft, c)).toEqual({});
  });

  test('Gray → real: BLX-α with α 0.5 and Gaussian mutation with σ 0.05; the on/off switches and crossover probability are kept', () => {
    const c = currentOf({ representation: 'gray', bitsPerVariable: 8 });
    const start = draftFor(c);
    start.crossover.enabled = false;
    start.crossover.probability = '0.3';
    start.mutation.enabled = false;
    const draft = withRepresentation(start, 'real');
    expect(draft.crossover).toEqual({ enabled: false, operator: 'blx-alpha', probability: '0.3', alpha: '0.5' });
    expect(draft.mutation).toEqual({ enabled: false, mode: 'per-gene', probability: '0.1', sigma: '0.05' });
  });

  test('plain ↔ Gray changes only the coding: every operator setting stays', () => {
    const c = currentOf({ representation: 'plain', bitsPerVariable: 8 });
    const start = draftFor(c);
    start.crossover.operator = 'uniform';
    start.mutation.mode = 'per-individual';
    start.mutation.probability = '0.5';
    const draft = withRepresentation(start, 'gray');
    expect(draft.landscape!.representation).toBe('gray');
    expect(draft.crossover).toEqual(start.crossover);
    expect(draft.mutation).toEqual(start.mutation);
  });

  test('the restart notice lists exactly what is reset, word for word', () => {
    const c = currentOf();
    const draft = withRepresentation(draftFor(c), 'gray');
    const result = changes(draft, c);
    expect(result.reset).toEqual(['Representation']);
    expect(result.notes).toEqual([
      'Reset to the new representation’s defaults: crossover type (BLX-α → One-point), mutation (Gaussian, per gene, pm 0.1, σ = 0.05 → bit flip, per gene, pm 0.05).',
    ]);
    const back = changes(withRepresentation(draftFor(currentOf({ representation: 'gray', bitsPerVariable: 8 })), 'real'), currentOf({ representation: 'gray', bitsPerVariable: 8 }));
    expect(back.notes).toEqual([
      'Reset to the new representation’s defaults: crossover type (One-point → BLX-α, α = 0.5), mutation (bit flip, per gene, pm 0.05 → Gaussian, per gene, pm 0.1, σ = 0.05).',
    ]);
  });

  test('the crossover type is listed with the type it replaces, whatever it was', () => {
    const c = currentOf({ representation: 'gray', bitsPerVariable: 8 });
    const start = draftFor(c);
    start.crossover.operator = 'uniform'; // and uniform exists for real too, but the reset still sets BLX-α
    const result = changes(withRepresentation(start, 'real'), { ...c, params: toParams(start) });
    expect(result.notes![0]).toContain('crossover type (Uniform → BLX-α, α = 0.5)');
  });

  test('plain ↔ Gray lists no reset notes', () => {
    const c = currentOf({ representation: 'plain', bitsPerVariable: 8 });
    const result = changes(withRepresentation(draftFor(c), 'gray'), c);
    expect(result.reset).toEqual(['Representation']);
    expect(result.notes).toBeUndefined();
  });
});

describe('what a landscape edit changes, and when', () => {
  test('function, representation and bits per variable need a reset; bits only matter for the binary-coded ones', () => {
    const c = currentOf({ representation: 'plain', bitsPerVariable: 8 });
    const draft = draftFor(c);
    draft.landscape!.function = 'rastrigin';
    draft.landscape!.bits = '9';
    expect(changes(draft, c).reset).toEqual(['Function', 'Bits per variable']);
    const r = currentOf();
    const real = draftFor(r);
    real.landscape!.bits = '12';
    expect(changes(real, r).reset).toEqual([]);
  });

  test('α, σ and ε are operator parameters: they wait for the next generation boundary', () => {
    const c = currentOf();
    const draft = draftFor(c);
    draft.crossover.alpha = '1';
    draft.mutation.sigma = '0.2';
    draft.stop.epsilon!.value = '0.5';
    expect(changes(draft, c).operator).toEqual(['Crossover α', 'Mutation σ', 'Stop criteria']);
    expect(changes(draft, c).reset).toEqual([]);
    expect(toParams(draft)).toMatchObject({ crossover: { operator: 'blx-alpha', alpha: 1 }, mutation: { sigma: 0.2 }, stop: { targetEpsilon: 0.5 } });
  });

  test('switching ε off removes the criterion; the drawer’s parameters have no target fitness for the landscape', () => {
    const c = currentOf();
    const draft = draftFor(c);
    draft.stop.epsilon!.enabled = false;
    expect(toParams(draft).stop).not.toHaveProperty('targetEpsilon');
    expect(toParams(draft).stop).not.toHaveProperty('targetFitness');
  });

  test('a restart applies the draft’s parameters as typed (ε does not follow anything)', () => {
    const c = currentOf();
    const draft = draftFor(c);
    draft.landscape!.function = 'himmelblau';
    expect(resetParams(draft, c.setup.problem).stop.targetEpsilon).toBe(c.params.stop.targetEpsilon);
  });

  test('the other problems’ drafts have no landscape fields and their changes are the same as before', () => {
    const t = entryOf('trap')!;
    const options = t.defaultOptions();
    const draft = draftOf(t.defaults.params, { problem: t.create(options), init: t.defaults.init }, 1, options);
    expect(draft.landscape).toBeUndefined();
    expect(draft.crossover).not.toHaveProperty('alpha');
    expect(draft.mutation).not.toHaveProperty('sigma');
    expect(draft.stop.epsilon).toBeUndefined();
  });
});
