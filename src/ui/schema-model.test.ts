import { describe, expect, test } from 'vitest';
import { gaAlgorithm, trapDefaults, trapProblem, type GaEvent, type GaParams, type GaSetup, type Linkage, type RunState } from '../engine';
import { createRun, type Run } from '../run';
import { blockInfoOf } from './block-context';
import { describeSchemaMoment, isInstance, parseSchema, schemaCaveat, schemaDefiningLength, schemaHistory, schemaOfBlock, schemaOrder } from './schema-model';

type GaRun = Run<GaSetup, GaParams, RunState, GaEvent>;
const make = (linkage: Linkage = 'tight', seed = 3, generations = 6) => {
  const problem = trapProblem({ blockSize: 4, blocks: 5, linkage });
  const params: GaParams = { ...trapDefaults.params, stop: { generationLimit: 100 } };
  const run: GaRun = createRun(gaAlgorithm, { setup: { problem, init: { kind: 'random', size: 12 } }, params, seed });
  for (let g = 0; g < generations; g++) run.forwardCycle();
  return { run, info: blockInfoOf(problem) };
};

describe('reading a schema', () => {
  test('1, 0 and * in a text of one symbol per gene', () => {
    const parsed = parseSchema('1111****************', 20);
    expect(parsed).toEqual({ ok: true, text: '1111****************', symbols: [...'1111****************'] });
  });

  test('spaces and a trailing newline are ignored, so a schema can be typed in groups', () => {
    expect(parseSchema(' 1111 **** **** **** ****\n', 20)).toMatchObject({ ok: true, text: '1111****************' });
  });

  test('says what is wrong in words: nothing typed, a wrong symbol (and where), a wrong length', () => {
    expect(parseSchema('', 20)).toEqual({ ok: false, message: 'Type a schema of 20 symbols: 1 for a gene that must be 1, 0 for a gene that must be 0, * for any gene.' });
    expect(parseSchema('   ', 20)).toMatchObject({ ok: false });
    expect(parseSchema('11x1****************', 20)).toEqual({ ok: false, message: 'A schema can only use 1, 0 and * (“x” at position 3 is none of them).' });
    expect(parseSchema('1111***************', 20)).toEqual({ ok: false, message: 'The schema needs 20 symbols, one per gene (it has 19).' });
    expect(parseSchema('1111*****************', 20)).toEqual({ ok: false, message: 'The schema needs 20 symbols, one per gene (it has 21).' });
  });

  test('the wrong symbol is named before the wrong length', () => {
    expect(parseSchema('1x', 20)).toMatchObject({ ok: false, message: expect.stringContaining('“x” at position 2') });
  });
});

describe('the order and the defining length of a schema, the two quantities of the schema theorem', () => {
  test('order is the number of fixed genes; defining length is the distance between the outermost fixed genes', () => {
    const sym = (text: string) => [...text] as ('0' | '1' | '*')[];
    expect(schemaOrder(sym('1111****************'))).toBe(4);
    expect(schemaDefiningLength(sym('1111****************'))).toBe(3);
    expect(schemaOrder(sym('1***************0***'))).toBe(2);
    expect(schemaDefiningLength(sym('1***************0***'))).toBe(16);
    expect(schemaOrder(sym('********1***********'))).toBe(1);
    expect(schemaDefiningLength(sym('********1***********'))).toBe(0);
    expect(schemaOrder(sym('********************'))).toBe(0);
    expect(schemaDefiningLength(sym('********************'))).toBe(0);
  });
});

describe('the schema of a solved block', () => {
  test('tight: the block’s four genes are 1 and the rest are free', () => {
    const { info } = make('tight');
    expect(schemaOfBlock(info, 1)).toBe('1111****************');
    expect(schemaOfBlock(info, 3)).toBe('********1111********');
  });

  test('loose: the block owns genes 1, 6, 11 and 16, so its schema is spread out and has a long defining length', () => {
    const { info } = make('loose');
    expect(schemaOfBlock(info, 1)).toBe('1****1****1****1****');
    const symbols = [...schemaOfBlock(info, 1)] as ('0' | '1' | '*')[];
    expect(schemaOrder(symbols)).toBe(4);
    expect(schemaDefiningLength(symbols)).toBe(15);
  });
});

describe('instances of a schema', () => {
  test('an individual is an instance when it matches every fixed gene', () => {
    const s = [...'1*0*'] as ('0' | '1' | '*')[];
    expect(isInstance(s, [1, 0, 0, 1])).toBe(true);
    expect(isInstance(s, [1, 1, 0, 0])).toBe(true);
    expect(isInstance(s, [0, 1, 0, 0])).toBe(false);
    expect(isInstance(s, [1, 0, 1, 0])).toBe(false);
    expect(isInstance([...'****'] as ('0' | '1' | '*')[], [0, 0, 0, 0])).toBe(true);
  });
});

describe('the schema over the recorded generations equals a direct computation', () => {
  test.each(['tight', 'loose'] as const)('%s: for several schemas, every generation, the count and both means', (linkage) => {
    const { run, info } = make(linkage, 4, 8);
    for (const text of [schemaOfBlock(info, 1), schemaOfBlock(info, 3), '0000****************', '********************', '1*0*1*0*1*0*1*0*1*0*']) {
      const parsed = parseSchema(text, 20);
      if (!parsed.ok) throw new Error(parsed.message);
      const history = schemaHistory(run, parsed.symbols);
      expect(history.map((h) => h.generation)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
      history.forEach((h, g) => {
        const population = run.snapshot(g).state.population;
        const matching = population.filter((i) => [...text].every((c, k) => c === '*' || Number(c) === i.chromosome[k]));
        expect(h.size).toBe(population.length);
        expect(h.instances).toBe(matching.length);
        expect(h.instanceMean).toBe(matching.length === 0 ? null : matching.reduce((t, i) => t + i.fitness, 0) / matching.length);
        expect(h.populationMean).toBeCloseTo(population.reduce((t, i) => t + i.fitness, 0) / population.length, 10);
      });
    }
  });

  test('the all-free schema is matched by everyone and has the population mean as its own', () => {
    const { run } = make('tight', 2, 3);
    const history = schemaHistory(run, [...'*'.repeat(20)] as ('0' | '1' | '*')[]);
    for (const h of history) {
      expect(h.instances).toBe(h.size);
      expect(h.instanceMean).toBeCloseTo(h.populationMean, 10);
    }
  });
});

describe('the sentence about one generation', () => {
  const point = (generation: number, instances: number, instanceMean: number | null, populationMean: number) => ({ generation, size: 12, instances, instanceMean, populationMean });

  test('says how many are instances, compares with generation 0, and says whether their mean fitness is above or below the population’s', () => {
    const history = [point(0, 1, 16, 10.5), point(1, 2, 16.5, 11.8), point(2, 3, 17.25, 12.4)];
    expect(describeSchemaMoment('1111****************', history, 2)).toBe(
      'Generation 2: 3 of 12 individuals are instances of 1111**************** (1 in generation 0). Their mean fitness is 17.25, above the population mean 12.4.',
    );
  });

  test('in generation 0 there is nothing to compare with, and a single instance is “1 of 12 individuals is an instance”', () => {
    expect(describeSchemaMoment('1111****************', [point(0, 1, 16, 10.5)], 0)).toBe('Generation 0: 1 of 12 individuals is an instance of 1111****************. Its mean fitness is 16, above the population mean 10.5.');
  });

  test('below, equal, and none at all', () => {
    expect(describeSchemaMoment('0000****************', [point(0, 4, 8, 9)], 0)).toContain('below the population mean 9');
    expect(describeSchemaMoment('*********', [point(0, 12, 9, 9)], 0)).toContain('equal to the population mean 9');
    expect(describeSchemaMoment('1111****************', [point(0, 2, 16, 10), point(1, 0, null, 11)], 1)).toBe('Generation 1: none of the 12 individuals is an instance of 1111**************** (2 in generation 0).');
  });

  test('the standing caveat says that one run illustrates a tendency and proves nothing', () => {
    expect(schemaCaveat).toContain('illustrates a tendency');
    expect(schemaCaveat).toContain('proves nothing');
  });
});
