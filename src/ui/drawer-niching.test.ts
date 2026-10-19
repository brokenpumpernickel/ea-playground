import { describe, expect, test } from 'vitest';
import { gaAlgorithm, type GaParams, type GaSetup, type LandscapeOptions, type NichingConfig } from '../engine';
import { createRun } from '../run';
import { changes, draftOf, problemOf, resetParams, toParams, validate, type Draft } from './drawer-model';
import { defaultsOf, entryOf } from './problems';
import { configOf, decodeConfig, encodeConfig, setupOf } from './run-config';

const entry = entryOf('landscape')!;
const options: LandscapeOptions = { function: 'two-peaks', representation: 'real', bitsPerVariable: 10 };
const d = defaultsOf(entry, options);
const setup: GaSetup = { problem: entry.create(options), init: d.init };
const current = { params: d.params, setup, seed: d.seed, options };
const draftFor = (params: GaParams = d.params) => draftOf(params, setup, d.seed, options);
const errorsOf = (draft: Draft) => validate(draft, problemOf(draft, entry, setup.problem), [], entry).errors;
const withNiching = (niching: NichingConfig): GaParams => ({ ...d.params, niching });
/** The drawer always writes the truncation setting (off here); the landscape's own defaults do not carry it. */
const plain = (params: GaParams): GaParams => {
  const { truncation: _truncation, ...rest } = params;
  return rest;
};

describe('the niching in the draft', () => {
  test('a landscape run with no niching is drafted as niching none with the default radius and shape, as typed text', () => {
    expect(draftFor().niching).toEqual({ method: 'none', sigma: '2', alpha: '1' });
  });

  test('a run that has niching is drafted with it, σ and α kept as the text they are', () => {
    expect(draftFor(withNiching({ method: 'sharing', sigma: 3.5, alpha: 2 })).niching).toEqual({ method: 'sharing', sigma: '3.5', alpha: '2' });
    expect(draftFor(withNiching({ method: 'crowding', sigma: 2, alpha: 1 })).niching?.method).toBe('crowding');
  });

  test('the other problems have no niching in their draft', () => {
    const goldberg = entryOf('goldberg')!;
    const g = defaultsOf(goldberg, undefined);
    expect(draftOf(g.params, { problem: goldberg.create(undefined), init: g.init }, g.seed, undefined).niching).toBeUndefined();
  });
});

describe('the draft back to parameters', () => {
  test('niching none with the default radius and shape leaves the parameters exactly as they were: no niching key at all', () => {
    expect(plain(toParams(draftFor()))).toEqual(d.params);
    expect('niching' in toParams(draftFor())).toBe(false);
  });

  test('a method, a radius and a shape come back as numbers; a radius or shape changed while the method is none is remembered', () => {
    const sharing = draftFor();
    sharing.niching = { method: 'sharing', sigma: '3', alpha: '1.5' };
    expect(toParams(sharing).niching).toEqual({ method: 'sharing', sigma: 3, alpha: 1.5 });
    const remembered = draftFor();
    remembered.niching = { method: 'none', sigma: '3', alpha: '1' };
    expect(toParams(remembered).niching).toEqual({ method: 'none', sigma: 3, alpha: 1 });
    const crowding = draftFor();
    crowding.niching = { method: 'crowding', sigma: '2', alpha: '1' };
    expect(toParams(crowding).niching).toEqual({ method: 'crowding', sigma: 2, alpha: 1 });
  });

  test('a text that is not a number is not turned into NaN while the method is none (the defaults stand in)', () => {
    const draft = draftFor();
    draft.niching = { method: 'none', sigma: 'abc', alpha: '' };
    expect('niching' in toParams(draft)).toBe(false);
  });

  test('every setting round-trips: params, then draft, then params', () => {
    for (const niching of [{ method: 'sharing', sigma: 3, alpha: 2 }, { method: 'crowding', sigma: 2, alpha: 1 }, { method: 'none', sigma: 4, alpha: 1 }] as NichingConfig[]) {
      const params = withNiching(niching);
      expect(plain(toParams(draftFor(params)))).toEqual(params);
    }
  });

  test('a restart applies the niching too', () => {
    const draft = draftFor();
    draft.niching = { method: 'crowding', sigma: '2', alpha: '1' };
    expect(resetParams(draft, setup.problem).niching?.method).toBe('crowding');
  });
});

describe('what the drawer says about niching', () => {
  test('a good draft has nothing to say, for each method', () => {
    for (const method of ['none', 'sharing', 'crowding'] as const) {
      const draft = draftFor();
      draft.niching = { method, sigma: '2', alpha: '1' };
      expect(errorsOf(draft)).toEqual({});
    }
  });

  test('the radius and the shape must be numbers greater than 0 while sharing is chosen, and are not checked while it is not', () => {
    const draft = draftFor();
    draft.niching = { method: 'sharing', sigma: '0', alpha: 'x' };
    expect(errorsOf(draft)['niching.sigma']).toBe('σ (the niche radius) must be a number greater than 0.');
    expect(errorsOf(draft)['niching.alpha']).toBe('α (the shape of the sharing kernel) must be a number greater than 0.');
    draft.niching = { method: 'sharing', sigma: '-1', alpha: '0' };
    expect(Object.keys(errorsOf(draft)).sort()).toEqual(['niching.alpha', 'niching.sigma']);
    draft.niching = { method: 'crowding', sigma: '0', alpha: 'x' };
    expect(errorsOf(draft)).toEqual({});
    draft.niching = { method: 'none', sigma: '0', alpha: 'x' };
    expect(errorsOf(draft)).toEqual({});
  });

  test('under deterministic crowding elitism and truncation are ignored, so nothing is said about them even when they could not be used', () => {
    const draft = draftFor();
    draft.niching = { method: 'crowding', sigma: '2', alpha: '1' };
    draft.elites = '99';
    draft.truncation = { enabled: true, lambda: '1' };
    expect(errorsOf(draft)).toEqual({});
    draft.niching.method = 'sharing';
    expect(errorsOf(draft).elites).toBeDefined();
    draft.elites = '3'; // N − e = 9, so a λ of 1 cannot fill the population
    expect(errorsOf(draft)['truncation.lambda']).toBeDefined();
    draft.niching.method = 'crowding';
    expect(errorsOf(draft)).toEqual({});
  });

  test('a method chosen for a problem that has no distance is refused in words', () => {
    const goldberg = entryOf('goldberg')!;
    const g = defaultsOf(goldberg, undefined);
    const gSetup = { problem: goldberg.create(undefined), init: g.init };
    const draft = draftOf(g.params, gSetup, g.seed, undefined);
    draft.niching = { method: 'sharing', sigma: '2', alpha: '1' };
    expect(validate(draft, gSetup.problem, [], goldberg).errors.niching).toBe('Fitness sharing needs a distance between individuals, and this problem has none.');
    draft.niching = { method: 'crowding', sigma: '2', alpha: '1' };
    expect(validate(draft, gSetup.problem, [], goldberg).errors.niching).toBe('Deterministic crowding needs a distance between individuals, and this problem has none.');
  });
});

describe('when a niching change takes effect', () => {
  const draftWith = (niching: Draft['niching']) => ({ ...draftFor(), niching });
  const was = (niching: NichingConfig) => ({ ...current, params: withNiching(niching) });

  test('a change of method waits for the next generation boundary, like the other operator settings, and does not need a restart', () => {
    const c = changes(draftWith({ method: 'sharing', sigma: '2', alpha: '1' }), current);
    expect(c.operator).toEqual(['Niching']);
    expect(c.reset).toEqual([]);
    expect(changes(draftWith({ method: 'crowding', sigma: '2', alpha: '1' }), was({ method: 'sharing', sigma: 2, alpha: 1 })).operator).toEqual(['Niching']);
    expect(changes(draftWith({ method: 'none', sigma: '2', alpha: '1' }), was({ method: 'crowding', sigma: 2, alpha: 1 })).operator).toEqual(['Niching']);
  });

  test('the radius and the shape matter only while sharing is on, in the run and in the draft', () => {
    expect(changes(draftWith({ method: 'sharing', sigma: '3', alpha: '1' }), was({ method: 'sharing', sigma: 2, alpha: 1 })).operator).toEqual(['Sharing σ']);
    expect(changes(draftWith({ method: 'sharing', sigma: '2', alpha: '2' }), was({ method: 'sharing', sigma: 2, alpha: 1 })).operator).toEqual(['Sharing α']);
    expect(changes(draftWith({ method: 'none', sigma: '5', alpha: '1' }), current).operator).toEqual([]);
    expect(changes(draftWith({ method: 'crowding', sigma: '5', alpha: '3' }), was({ method: 'crowding', sigma: 2, alpha: 1 })).operator).toEqual([]);
  });

  test('no change at all when the draft says what the run already has, with or without the niching key', () => {
    expect(changes(draftFor(), current)).toEqual({ operator: [], reset: [] });
    expect(changes(draftFor(withNiching({ method: 'sharing', sigma: 3, alpha: 2 })), was({ method: 'sharing', sigma: 3, alpha: 2 }))).toEqual({ operator: [], reset: [] });
  });
});

describe('niching in a share link', () => {
  const make = (niching?: NichingConfig) => configOf(setup, niching ? withNiching(niching) : d.params, 7, 'landscape', options);
  const trace = (niching: NichingConfig | undefined) => {
    const config = make(niching);
    const decoded = decodeConfig(encodeConfig(config));
    expect(decoded).toEqual({ ok: true, config });
    const run = createRun(gaAlgorithm, { setup: setupOf(config), params: config.params, seed: config.seed });
    for (let g = 0; g < 5; g++) run.forwardCycle();
    return Array.from({ length: 6 }, (_, g) => run.snapshot(g).state.population.map((i) => i.chromosome.join(',')));
  };

  test.each([
    ['no niching', undefined],
    ['sharing', { method: 'sharing', sigma: 3, alpha: 2 }],
    ['crowding', { method: 'crowding', sigma: 2, alpha: 1 }],
    ['none with a remembered radius', { method: 'none', sigma: 4, alpha: 1 }],
  ] as [string, NichingConfig | undefined][])('%s: round trips and opens as the same run', (_label, niching) => {
    expect(trace(niching)).toEqual(trace(niching));
  });

  test('a link with no niching key is exactly the link it always was', () => {
    expect(JSON.stringify(make())).not.toContain('niching');
  });
});
