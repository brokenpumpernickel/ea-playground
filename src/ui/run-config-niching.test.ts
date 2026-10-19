import { describe, expect, test } from 'vitest';
import { type GaParams, type LandscapeOptions, type NichingConfig } from '../engine';
import { defaultsOf, entryOf } from './problems';
import { configOf, decodeConfig, encodeConfig, setupOf } from './run-config';

const entry = entryOf('landscape')!;
const options: LandscapeOptions = { function: 'two-peaks', representation: 'real', bitsPerVariable: 10 };
const d = defaultsOf(entry, options);
const setup = { problem: entry.create(options), init: d.init };
const b64 = (text: string) => btoa(String.fromCharCode(...new TextEncoder().encode(text))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const edited = (niching: unknown, params: GaParams = d.params) => {
  const copy = JSON.parse(JSON.stringify(configOf(setup, params, 7, 'landscape', options))) as Record<string, any>;
  copy.params.niching = niching;
  return `#v1.${b64(JSON.stringify(copy))}`;
};
const problemsOf = (hash: string): string[] => {
  const r = decodeConfig(hash);
  expect(r.ok).toBe(false);
  return r.ok ? [] : [...r.problems];
};
const good: NichingConfig = { method: 'sharing', sigma: 3, alpha: 2 };

describe('reading niching from a link', () => {
  test('a good one is read as it was written', () => {
    const r = decodeConfig(edited(good));
    expect(r.ok && r.config.params.niching).toEqual(good);
    expect(decodeConfig(encodeConfig(configOf(setup, { ...d.params, niching: { method: 'crowding', sigma: 2, alpha: 1 } }, 7, 'landscape', options))).ok).toBe(true);
  });

  test('says in words what is wrong with its shape: an object with exactly a method, a radius and a shape', () => {
    expect(problemsOf(edited('sharing'))).toEqual(['"params.niching" must be an object.']);
    expect(problemsOf(edited({ method: 'sharing', sigma: 2 }))).toContain('"params.niching" is missing "alpha".');
    expect(problemsOf(edited({ ...good, extra: 1 }))).toContain('"params.niching" has an unknown key "extra".');
    expect(problemsOf(edited({ ...good, sigma: 'wide' }))).toContain('"params.niching.sigma" must be a number.');
    expect(problemsOf(edited({ ...good, alpha: null }))).toContain('"params.niching.alpha" must be a number.');
    expect(problemsOf(edited({ ...good, method: 'clearing' }))).toContain('"params.niching.method" must be "none", "sharing" or "crowding".');
  });

  test('says in words what is wrong with its meaning, as the drawer does, and applies nothing', () => {
    expect(problemsOf(edited({ ...good, sigma: 0 }))).toEqual(['σ (the niche radius) must be a number greater than 0.']);
    expect(problemsOf(edited({ ...good, alpha: -1 }))).toEqual(['α (the shape of the sharing kernel) must be a number greater than 0.']);
  });

  test('a niching method in a link for a problem with no distance is refused, and says why', () => {
    const goldberg = entryOf('goldberg')!;
    const g = defaultsOf(goldberg, undefined);
    const copy = JSON.parse(JSON.stringify(configOf({ problem: goldberg.create(undefined), init: g.init }, g.params, 3, 'goldberg'))) as Record<string, any>;
    copy.params.niching = { method: 'crowding', sigma: 2, alpha: 1 };
    expect(problemsOf(`#v1.${b64(JSON.stringify(copy))}`)).toEqual(['Deterministic crowding needs a distance between individuals, and this problem has none.']);
    copy.params.niching = { method: 'none', sigma: 2, alpha: 1 };
    expect(decodeConfig(`#v1.${b64(JSON.stringify(copy))}`).ok).toBe(true);
  });

  test('a link made before niching existed (no niching key) still opens', () => {
    const link = encodeConfig(configOf(setup, d.params, 7, 'landscape', options));
    expect(decodeConfig(link).ok).toBe(true);
    expect(setupOf((decodeConfig(link) as { config: Parameters<typeof setupOf>[0] }).config).problem).toBeDefined();
  });
});
