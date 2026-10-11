import { describe, expect, test } from 'vitest';
import { defaultParams, defaultSeed, defaultSetup } from './config';
import { configOf, encodeConfig } from './run-config';
import { addressWithoutHash, linkFor, longLinkLimit, startupOf } from './share-link';

const config = configOf(defaultSetup, defaultParams, defaultSeed);

describe('making a link', () => {
  test('is the page’s own address, whatever it was, with the configuration as its only hash', () => {
    expect(linkFor('https://example.org/ea/index.html', config)).toBe(`https://example.org/ea/index.html${encodeConfig(config)}`);
    expect(linkFor('https://example.org/ea/?lang=en#v1.old', config)).toBe(`https://example.org/ea/?lang=en${encodeConfig(config)}`);
    expect(linkFor('file:///C:/classes/ea/index.html', config).startsWith('file:///C:/classes/ea/index.html#v1.')).toBe(true);
  });

  test('the address without its hash', () => {
    expect(addressWithoutHash('https://a.b/c#d')).toBe('https://a.b/c');
    expect(addressWithoutHash('https://a.b/c')).toBe('https://a.b/c');
  });

  test('an ordinary configuration is far below the length that chat tools break on', () => {
    expect(encodeConfig(config).length).toBeLessThan(longLinkLimit / 2);
  });
});

describe('what an address asks for', () => {
  test('no hash, or a hash that is not ours (an anchor), asks for nothing', () => {
    expect(startupOf('')).toEqual({ kind: 'none' });
    expect(startupOf('#')).toEqual({ kind: 'none' });
    expect(startupOf('#section-2')).toEqual({ kind: 'none' });
  });

  test('a good link gives its configuration', () => {
    expect(startupOf(encodeConfig(config))).toEqual({ kind: 'config', config });
  });

  test('anything that starts like a link but is not a good one is reported, even a very short one', () => {
    for (const hash of ['#v1', '#v1.', '#v2.abc', '#v1.@@', encodeConfig(config).slice(0, 30)]) {
      const startup = startupOf(hash);
      expect(startup.kind).toBe('invalid');
      if (startup.kind === 'invalid') expect(startup.problems.length).toBeGreaterThan(0);
    }
  });
});
