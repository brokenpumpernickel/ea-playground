import { render } from 'svelte/server';
import { describe, expect, test } from 'vitest';
import { gaAlgorithm, trapDefaults, trapProblem, type GaParams, type GaSetup } from '../engine';
import { createRun } from '../run';
import { blockInfoOf } from './block-context';
import { parseSchema, schemaCaveat, schemaHistory } from './schema-model';
import SchemaTracker from './SchemaTracker.svelte';

const problem = trapProblem({ blockSize: 4, blocks: 5, linkage: 'tight' });
const info = blockInfoOf(problem);
const params: GaParams = { ...trapDefaults.params, stop: { generationLimit: 50 } };
const setup: GaSetup = { problem, init: { kind: 'random', size: 12 } };
const run = createRun(gaAlgorithm, { setup, params, seed: 3 });
for (let g = 0; g < 6; g++) run.forwardCycle();
const html = (text: string, now = 4) => {
  const parsed = parseSchema(text, 20);
  const history = parsed.ok ? schemaHistory(run, parsed.symbols) : undefined;
  return render(SchemaTracker as never, { props: { info, text, oninput: () => {}, history, now } as never }).body.replace(/<!--.*?-->/g, '');
};

describe('the schema tracker view', () => {
  test('for a valid schema it shows the order, the defining length, both charts, the sentence for the cursor’s generation and the caveat', () => {
    const markup = html('1111****************');
    expect(markup).toContain('<b>order</b> 4');
    expect(markup).toContain('<b>defining length</b> 3');
    expect(markup).toContain('data-plot="schema-count"');
    expect(markup).toContain('data-plot="schema-fitness"');
    expect(markup).toMatch(/data-testid="schema-sentence"[^>]*>Generation 4: /);
    expect(markup).toContain(schemaCaveat);
    expect(markup).toContain('aria-live="polite"');
  });

  test('draws a bar per recorded generation with the count as data, and the instance and population means as marks', () => {
    const history = schemaHistory(run, [...'1111****************'] as ('0' | '1' | '*')[]);
    const markup = html('1111****************');
    expect([...markup.matchAll(/<rect(?![^>]*data-series)[^>]*data-gen="(\d+)" data-value="(\d+)"/g)].map((m) => [Number(m[1]), Number(m[2])])).toEqual(history.map((h) => [h.generation, h.instances]));
    expect([...markup.matchAll(/data-series="populationMean" data-gen="(\d+)" data-value="([\d.]+)"/g)]).toHaveLength(history.length);
    expect([...markup.matchAll(/data-series="instanceMean" data-gen="(\d+)"/g)]).toHaveLength(history.filter((h) => h.instanceMean !== null).length);
  });

  test('one button per block picks “block b solved”, each named', () => {
    const markup = html('1111****************');
    expect([...markup.matchAll(/data-block-solved="(\d+)"[^>]*aria-label="Block (\d+) solved"[^>]*>Block (\d+) solved</g)].map((m) => [Number(m[1]), Number(m[2]), Number(m[3])])).toEqual([1, 2, 3, 4, 5].map((b) => [b, b, b]));
  });

  test('an invalid schema shows its message as an alert tied to the field and no charts, and the caveat stays', () => {
    const markup = html('11x1****************');
    expect(markup).toContain('role="alert"');
    expect(markup).toContain('A schema can only use 1, 0 and * (“x” at position 3 is none of them).');
    expect(markup).toContain('aria-invalid="true"');
    expect(markup).toContain('aria-describedby="schema-error"');
    expect(markup).not.toContain('data-plot');
    expect(markup).toContain(schemaCaveat);
  });

  test('has a hidden table with every recorded generation, and a labelled input', () => {
    const markup = html('1111****************');
    expect([...markup.matchAll(/<tr><td>(\d+)<\/td><td>(\d+)<\/td>/g)]).toHaveLength(7);
    expect(markup).toContain('class="sr-only"');
    expect(markup).toContain('<label for="schema-input">Schema (20 symbols)</label>');
  });

  test('explains the notation in words', () => {
    expect(html('1111****************')).toContain('<b>1</b> = the gene must be 1, <b>0</b> = it must be 0, <b>*</b> = anything');
  });
});
