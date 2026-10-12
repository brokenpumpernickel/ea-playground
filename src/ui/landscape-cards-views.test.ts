import { render } from 'svelte/server';
import { describe, expect, test } from 'vitest';
import { formatReal, gaAlgorithm, landscapeProblem, type GaEvent, type GaParams, type GaSetup, type LandscapeOptions, type RunState } from '../engine';
import { createRun, type Run } from '../run';
import FlipTable from './FlipTable.svelte';
import GaussianCard from './GaussianCard.svelte';
import { displayOf } from './format';
import { blendLine, flipTable } from './landscape-card-models';
import { landscapeContextKey, landscapeInfoOf, type LandscapeInfo } from './landscape-context';
import NumberLine from './NumberLine.svelte';
import RealCrossoverCard from './RealCrossoverCard.svelte';
import { crossoverModel, mutationModel } from './variation-models';

type GaRun = Run<GaSetup, GaParams, RunState, GaEvent>;
const plain = (markup: string) => markup.replace(/<!--.*?-->/g, '');
const f3 = (v: number) => formatReal([v], 3);
const withLandscape = (info: LandscapeInfo | undefined) => new Map<unknown, unknown>([[landscapeContextKey, () => info]]);

const params: GaParams = {
  selection: { method: 'tournament', size: 2 },
  crossover: { enabled: true, operator: 'blx-alpha', probability: 1, alpha: 3 },
  mutation: { enabled: true, mode: 'per-gene', probability: 0.7, sigma: 0.4 },
  elites: 0,
  stop: { generationLimit: 50 },
};
const make = (p: GaParams, options: LandscapeOptions) => {
  const problem = landscapeProblem(options);
  const run: GaRun = createRun(gaAlgorithm, { setup: { problem, init: { kind: 'random', size: 8 } }, params: p, seed: 7 });
  run.forwardCycle();
  return { run, display: displayOf(problem), problem };
};
const at = (run: GaRun, stage: string, micro: number) => {
  const index = run.layout(1).findIndex((s) => s.stage === stage);
  run.moveTo({ cycle: 1, stage: index, micro });
  return run.view();
};
const real: LandscapeOptions = { function: 'two-peaks', representation: 'real', bitsPerVariable: 10 };

describe('the number line', () => {
  test('draws a mark per parent and child at the model’s fractions, with the bands, and marks a clamped child with a bar', () => {
    const line = blendLine({ gene: 1, name: 'x', a: 4, b: 5, d: 1, from: 3, to: 6, draws: [0.9, 0.5], raw: [5.7, 4.5], values: [5, 4.5], clamped: [true, false], bounds: { lo: -5, hi: 5 } });
    const markup = plain(render(NumberLine as never, { props: { ...line } as never }).body);
    expect([...markup.matchAll(/data-mark="(\w+)" data-fraction="([\d.e-]+)"/g)].map((m) => [m[1], Number(m[2])])).toEqual(line.marks.map((m) => [m.label, m.fraction]));
    expect(markup).toContain('data-band="widened"');
    expect(markup).toContain('data-band="parents"');
    expect(markup.match(/data-clamped="true"/g)).toHaveLength(1);
    expect(markup).toContain('class="clampbar"');
    expect(markup).toContain('aria-hidden="true"'); // the numbers are in the text beside it
  });
});

describe('the BLX-α and arithmetic cards', () => {
  test('BLX-α prints every gene’s interval, draws and children, with the engine’s numbers, and a clamped child says what the draw gave', () => {
    const { run, display } = make(params, real);
    const model = crossoverModel(at(run, 'crossover', 4), params.crossover, display);
    const events = run.events(1).flatMap((e) => (e.stage === 'crossover' ? [e] : []));
    let clampedSeen = 0;
    model.pairs.forEach((pair, k) => {
      const markup = plain(render(RealCrossoverCard as never, { props: { pair, bounds: { lo: -5, hi: 5 } } as never }).body);
      const e = events[k]!;
      e.blend!.forEach((g, i) => {
        expect(markup).toContain(`A = ${f3(g.a)}, B = ${f3(g.b)} · d = ${f3(g.d)} → interval [${f3(g.from)}, ${f3(g.to)}]`);
        expect(markup).toContain(`O1 ${f3(e.children[0]!.chromosome[i]!)}`);
        expect(markup).toContain(`O2 ${f3(e.children[1]!.chromosome[i]!)}`);
        g.clamped.forEach((c, which) => {
          if (!c) return;
          clampedSeen++;
          expect(markup).toContain(`clamped to ${f3(e.children[which]!.chromosome[i]!)} (the draw gave ${f3(g.raw[which]!)})`);
        });
      });
      expect((markup.match(/data-testid="number-line"/g) ?? []).length).toBe(2);
      expect(markup).toContain('data-testid="children-pairs"');
    });
    expect(clampedSeen).toBeGreaterThan(0);
  });

  test('arithmetic prints λ, the weights, the parents and children in a table, and a line per gene', () => {
    const p = { ...params, crossover: { enabled: true, operator: 'arithmetic', probability: 1 } as GaParams['crossover'] };
    const { run, display } = make(p, real);
    const model = crossoverModel(at(run, 'crossover', 4), p.crossover, display);
    const e = run.events(1).flatMap((x) => (x.stage === 'crossover' ? [x] : []))[0]!;
    const markup = plain(render(RealCrossoverCard as never, { props: { pair: model.pairs[0]!, bounds: { lo: -5, hi: 5 } } as never }).body);
    expect(markup).toContain('data-testid="arithmetic-card"');
    expect(markup).toContain(`λ = ${Math.round(e.lambda! * 1000) / 1000}`);
    for (const c of e.children) for (const v of c.chromosome) expect(markup).toContain(f3(v));
    expect((markup.match(/data-testid="number-line"/g) ?? []).length).toBe(2);
  });
});

describe('the Gaussian card', () => {
  test('every row of the table is the event’s: the draw, the two uniforms, z, the step, the value after and any clamping', () => {
    const { run, display } = make(params, real);
    const model = mutationModel(at(run, 'mutation', 8), params.mutation, display);
    const events = run.events(1).flatMap((e) => (e.stage === 'mutation' ? [e] : []));
    let steps = 0;
    model.rows.forEach((row, k) => {
      const markup = plain(render(GaussianCard as never, { props: { row, model } as never }).body);
      const e = events[k]!;
      expect((markup.match(/<tr[^>]*class="hit"/g) ?? []).length).toBe(e.gaussian?.length ?? 0);
      for (const s of e.gaussian ?? []) {
        steps++;
        const r = (v: number) => String(Math.round(v * 1000) / 1000);
        expect(markup).toContain(`u₁ = ${r(s.u1)}, u₂ = ${r(s.u2)} → z = ${r(s.z).replace('-', '−')}`);
        expect(markup).toContain(f3(s.after));
        if (s.clamped) expect(markup).toContain(`clamped (raw ${f3(s.raw)})`);
      }
      for (const g of row.gaussian!.genes.filter((x) => !x.mutated)) expect(markup).toContain('no draw for z: this gene is not mutated');
    });
    expect(steps).toBeGreaterThan(3);
  });

  test('a switched-off mutation has no mutated rows and says it is bypassed', () => {
    const p = { ...params, mutation: { ...params.mutation, enabled: false } };
    const { run, display } = make(p, real);
    const model = mutationModel(at(run, 'mutation', 1), p.mutation, display);
    const markup = plain(render(GaussianCard as never, { props: { row: model.rows[0]!, model } as never }).body);
    expect(markup).toContain('bypassed: mutation is off');
    expect(markup).not.toMatch(/class="hit"/);
  });
});

describe('the flip table', () => {
  const info = landscapeInfoOf(landscapeProblem({ function: 'single-peak', representation: 'gray', bitsPerVariable: 6 }));
  const chromosome = '101100' + '000000';

  test('has a block for each coding with one column per bit; every number is the model’s', () => {
    const markup = plain(render(FlipTable as never, { props: { chromosome } as never, context: withLandscape(info) }).body);
    expect(markup).toContain('data-testid="flip-table"');
    expect(markup.match(/data-coding="(plain|gray)"/g)).toHaveLength(2);
    expect((markup.match(/<th scope="col" class="num">/g) ?? []).length).toBe(12); // 6 per coding
    // Gray word 101100: b0 = 1, then each bit is the previous binary bit XOR the Gray bit: 110111, which is 55
    for (const row of flipTable(55, 6, 'gray', info.bounds)) expect(markup).toContain(f3(row.value));
    for (const row of flipTable(55, 6, 'plain', info.bounds)) expect(markup).toContain(f3(row.value));
  });

  test('says how many bits neighbouring values differ in: up to all of them in plain binary, always one in Gray code', () => {
    const markup = plain(render(FlipTable as never, { props: { chromosome } as never, context: withLandscape(info) }).body);
    expect(markup).toMatch(/Plain binary<\/b>:[\s\S]*?up to 6 anywhere/);
    expect(markup).toMatch(/Gray code<\/b>:[\s\S]*?differ in 1 bit\(s\) here, in up to 1 anywhere/);
  });

  test('draws nothing for the real-valued representation, for a bit string of the wrong length, or with no landscape', () => {
    const realInfo = landscapeInfoOf(landscapeProblem({ function: 'single-peak', representation: 'real', bitsPerVariable: 6 }));
    expect(plain(render(FlipTable as never, { props: { chromosome } as never, context: withLandscape(realInfo) }).body)).not.toContain('flip-table');
    expect(plain(render(FlipTable as never, { props: { chromosome: '1011' } as never, context: withLandscape(info) }).body)).not.toContain('flip-table');
    expect(plain(render(FlipTable as never, { props: { chromosome } as never, context: withLandscape(undefined) }).body)).not.toContain('flip-table');
  });
});
