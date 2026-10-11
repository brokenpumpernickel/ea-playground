import { render } from 'svelte/server';
import { describe, expect, test } from 'vitest';
import { goldberg } from '../engine';
import FunctionPlot from './FunctionPlot.svelte';
import { landscapeModel } from './landscape-model';

const html = (xs: number[]) => render(FunctionPlot as never, { props: { model: landscapeModel(goldberg.landscape!, xs.map((x) => ({ decoded: x, fitness: x * x }))) } as never }).body;
const attrs = (markup: string, name: string) => [...markup.matchAll(new RegExp(`${name}="([^"]*)"`, 'g'))].map((m) => m[1]!);

describe('function plot', () => {
  test('marks every individual on the axis, with a vertical line up to its fitness on the curve', () => {
    const markup = html([13, 24, 8, 19]);
    expect(attrs(markup, 'data-x')).toEqual(['8', '13', '19', '24']);
    expect(attrs(markup, 'data-fitness')).toEqual(['64', '169', '361', '576']);
    expect([...markup.matchAll(/<line[^>]*stroke-dasharray="6 4"/g)]).toHaveLength(4);
    expect([...markup.matchAll(/<circle[^>]*r="(6|8)"/g)]).toHaveLength(4);
    expect(markup).toContain('data-curve');
  });

  test('flags the best and counts individuals that share a value, and says all of it to screen readers', () => {
    const markup = html([24, 24, 8]);
    expect(attrs(markup, 'data-best')).toEqual(['false', 'true']);
    expect(attrs(markup, 'data-count')).toEqual(['1', '2']);
    expect(markup).toContain('×2');
    expect(markup).toMatch(/aria-label="f\(x\) = x² over 0 to 31\. 3 individuals at 2 different values: x = 8, fitness 64; x = 24 \(2 individuals\), fitness 576\./);
  });

  test('labels the axes at fixed values', () => {
    const markup = html([1]);
    for (const tick of ['0', '250', '500', '750', '1000', '5', '10', '30']) expect(markup).toContain(`>${tick}</text>`);
  });
});
