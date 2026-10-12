import { describe, expect, test } from 'vitest';
import type { CrossoverConfig } from './crossover';
import { runGeneration, startRun, type GenerationConfig } from './generation';
import { mutate, type MutationConfig } from './mutation';
import type { Bounds } from './problem';
import { realSphere, scripted } from './test-support';
import { createRng } from '../run/rng';

const box: readonly Bounds[] = [{ lo: -5, hi: 5 }, { lo: -5, hi: 5 }];
const gaussian = (probability: number, mode: MutationConfig['mode'] = 'per-gene', sigma?: number): MutationConfig => ({
  enabled: true,
  mode,
  probability,
  operator: 'gaussian',
  ...(sigma === undefined ? {} : { sigma }),
});
const input = (...genes: number[]) => [{ offspring: 1, chromosome: genes }];

/** The uniforms (u1, u2) that Box–Muller turns into the given z when u2 = 0 (cos = 1): z = √(−2 ln(1 − u1)). */
const u1For = (z: number) => 1 - Math.exp(-(z * z) / 2);

describe('Gaussian mutation, worked by hand (σ = 0.05, range 10, so a step is 0.5 × z)', () => {
  test('per gene: one draw per gene first, then two uniforms for each mutating gene in order', () => {
    // gene 1: u 0.2 < 0.5 mutates; gene 2: u 0.9 does not. Gene 1 then draws u1 → z = 1, u2 = 0 (cos 0 = 1).
    const rng = scripted(0.2, 0.9, u1For(1), 0);
    const { mutated, events } = mutate(input(1, 2), gaussian(0.5), rng, 0, box);
    expect(rng.used).toBe(4); // 2 decisions + 2 uniforms
    expect(mutated[0]!.chromosome[0]).toBeCloseTo(1.5, 12);
    expect(mutated[0]!.chromosome[1]).toBe(2); // an unchanged gene is exactly unchanged
    expect(mutated[0]!.flipped).toEqual([1]);
    const e = events[0]!;
    expect(e).toMatchObject({ decision: 'mutated', mode: 'per-gene', threshold: 0.5, before: [1, 2], flipped: [1], sigma: 0.05 });
    expect(e.geneDraws!.map((d) => [d.gene, d.u, d.flipped])).toEqual([[1, 0.2, true], [2, 0.9, false]]);
    const step = e.gaussian![0]!;
    expect(step).toMatchObject({ gene: 1, u1: u1For(1), u2: 0, before: 1, clamped: false });
    expect(step.z).toBeCloseTo(1, 12);
    expect(step.range).toBe(10);
    expect(step.step).toBeCloseTo(0.5, 12);
    expect(step.after).toBeCloseTo(1.5, 12);
    expect(e.after[0]).toBeCloseTo(1.5, 12);
  });

  test('u2 = 0.5 turns the step round (cos π = −1), and u2 = 0.25 makes it zero (cos π/2 = 0)', () => {
    const down = mutate(input(1, 2), gaussian(1), scripted(0, 0, u1For(2), 0.5, 0.5, 0.25), 0, box).mutated[0]!.chromosome;
    expect(down[0]).toBeCloseTo(1 - 1, 12); // z = −2, step −1
    expect(down[1]).toBeCloseTo(2, 12); // cos(π/2) = 0 up to rounding
  });

  test('u1 = 0 is z = 0, not an error: the gene is chosen to mutate but does not move', () => {
    const { mutated, events } = mutate(input(1, 2), gaussian(0.5), scripted(0, 0.9, 0, 0.3), 0, box);
    expect(mutated[0]!.chromosome).toEqual([1, 2]);
    expect(events[0]!.decision).toBe('mutated');
    expect(events[0]!.gaussian![0]!.z).toBe(0);
  });

  test('the step is σ × the gene’s own range × z, with σ from the config', () => {
    const wide = [{ lo: 0, hi: 100 }, { lo: -1, hi: 1 }];
    const { events } = mutate(input(50, 0), gaussian(1, 'per-gene', 0.1), scripted(0, 0, u1For(1), 0, u1For(1), 0), 0, wide);
    const [x, y] = events[0]!.gaussian!;
    expect([x!.range, y!.range]).toEqual([100, 2]);
    expect(x!.step).toBeCloseTo(10, 10);
    expect(y!.step).toBeCloseTo(0.2, 10);
  });

  test('a new value beyond a bound is clamped to it; the raw value and the clamping are recorded', () => {
    // z = 2 → step 1.0; 4.9 + 1.0 = 5.9 → 5. z = −2 on −4.8 → −5.8 → −5
    const up = mutate(input(4.9, 0), gaussian(0.5, 'per-gene'), scripted(0, 0.9, u1For(2), 0), 0, box);
    expect(up.mutated[0]!.chromosome[0]).toBe(5);
    expect(up.events[0]!.gaussian![0]).toMatchObject({ clamped: true, before: 4.9 });
    expect(up.events[0]!.gaussian![0]!.raw).toBeCloseTo(5.9, 12);
    expect(up.events[0]!.gaussian![0]!.after).toBe(5);
    const down = mutate(input(-4.8, 0), gaussian(0.5, 'per-gene'), scripted(0, 0.9, u1For(2), 0.5), 0, box);
    expect(down.mutated[0]!.chromosome[0]).toBe(-5);
    expect(down.events[0]!.gaussian![0]!.clamped).toBe(true);
  });

  test('per individual: one draw decides, one picks the gene, then two uniforms', () => {
    const rng = scripted(0.1, 0.9, u1For(1), 0); // u 0.1 < 0.3; r 0.9 → gene 1 + ⌊0.9 × 2⌋ = 2
    const { mutated, events } = mutate(input(1, 2), gaussian(0.3, 'per-individual'), rng, 0, box);
    expect(rng.used).toBe(4);
    expect(mutated[0]!.chromosome[0]).toBe(1);
    expect(mutated[0]!.chromosome[1]).toBeCloseTo(2.5, 12);
    expect(events[0]).toMatchObject({ mode: 'per-individual', decision: 'mutated', flipped: [2], individualDraw: { u: 0.1 }, chosenGene: { gene: 2, r: 0.9 } });
    const none = mutate(input(1, 2), gaussian(0.3, 'per-individual'), scripted(0.5), 0, box);
    expect(none.events[0]).toMatchObject({ decision: 'unchanged', flipped: [] });
    expect(none.events[0]).not.toHaveProperty('gaussian');
    expect(none.mutated[0]!.chromosome).toEqual([1, 2]);
  });

  test('switched off draws nothing and leaves a copy that shares no array', () => {
    const chromosome = [1, 2];
    const rng = scripted();
    const { mutated, events } = mutate([{ offspring: 1, chromosome }], { ...gaussian(1), enabled: false }, rng, 0, box);
    expect(rng.used).toBe(0);
    expect(mutated[0]!.chromosome).toEqual([1, 2]);
    expect(mutated[0]!.chromosome).not.toBe(chromosome);
    expect(events[0]).toMatchObject({ decision: 'bypassed', reason: 'switched-off' });
    expect(events[0]).not.toHaveProperty('gaussian');
  });

  test('without a σ the default is 0.05', () => {
    const { events } = mutate(input(1, 2), gaussian(1), scripted(0, 0, u1For(1), 0, u1For(1), 0), 0, box);
    expect(events[0]!.sigma).toBe(0.05);
  });
});

describe('the operator must suit the representation, and σ must be usable', () => {
  test('flip mutation is refused for a real problem and Gaussian for a symbol problem, in words', () => {
    expect(() => mutate(input(1, 2), { enabled: true, mode: 'per-gene', probability: 0.1, operator: 'flip' }, scripted(0), 0, box)).toThrow(
      'Flip mutation is for symbol chromosomes; use Gaussian mutation for a real-valued problem',
    );
    expect(() => mutate(input(0, 1), gaussian(0.1), scripted(0), 2)).toThrow('Gaussian mutation is for real-valued chromosomes; use flip mutation for this problem');
  });

  test('with no operator named, the representation decides, so symbol runs are untouched', () => {
    const { events } = mutate(input(0, 1), { enabled: true, mode: 'per-gene', probability: 1 }, scripted(0, 0), 2);
    expect(events[0]!.after).toEqual([1, 0]);
    expect(events[0]).not.toHaveProperty('sigma');
  });

  test('σ must be a number greater than 0', () => {
    for (const sigma of [0, -0.1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => mutate(input(1, 2), gaussian(0.5, 'per-gene', sigma), scripted(0), 0, box)).toThrow('σ must be a number greater than 0');
    }
  });

  test('the probability must be between 0 and 1, as for symbols', () => {
    expect(() => mutate(input(1, 2), gaussian(1.5), scripted(0), 0, box)).toThrow('Mutation probability must be between 0 and 1');
  });
});

describe('properties over many draws', () => {
  const bounds: readonly Bounds[] = [{ lo: -5.12, hi: 5.12 }, { lo: -5.12, hi: 5.12 }, { lo: 0, hi: 1 }];
  const rng = createRng(31);
  const start = () => bounds.map(({ lo, hi }) => lo + rng.next() * (hi - lo));

  test('the recorded z is the Box–Muller value of the recorded uniforms, the step is σ × range × z, the result is the clamped sum', () => {
    for (let k = 0; k < 400; k++) {
      const sigma = [0.05, 0.3, 1][k % 3]!;
      const before = start();
      const { mutated, events } = mutate(input(...before), gaussian(0.6, k % 2 === 0 ? 'per-gene' : 'per-individual', sigma), createRng(k), 0, bounds);
      const after = mutated[0]!.chromosome;
      expect(events[0]!.after).toEqual(after);
      const steps = new Map((events[0]!.gaussian ?? []).map((s) => [s.gene, s]));
      expect([...steps.keys()]).toEqual(events[0]!.flipped);
      after.forEach((x, g) => {
        expect(x).toBeGreaterThanOrEqual(bounds[g]!.lo);
        expect(x).toBeLessThanOrEqual(bounds[g]!.hi);
        const s = steps.get(g + 1);
        if (!s) {
          expect(x).toBe(before[g]); // a gene that did not mutate is exactly unchanged
          return;
        }
        expect(s.z).toBe(Math.sqrt(-2 * Math.log(1 - s.u1)) * Math.cos(2 * Math.PI * s.u2));
        expect(s.range).toBe(bounds[g]!.hi - bounds[g]!.lo);
        expect(s.step).toBe(sigma * s.range * s.z);
        expect(s.raw).toBe(s.before + s.step);
        expect(s.clamped).toBe(s.raw < bounds[g]!.lo || s.raw > bounds[g]!.hi);
        expect(x).toBe(Math.min(bounds[g]!.hi, Math.max(bounds[g]!.lo, s.raw)));
        if (s.clamped) expect([bounds[g]!.lo, bounds[g]!.hi]).toContain(x);
      });
    }
  });

  test('over many draws z has mean ≈ 0 and standard deviation ≈ 1, and the fraction of mutating genes ≈ pm (fixed seed)', () => {
    const zs: number[] = [];
    let mutating = 0;
    const genes = 3 * 4000;
    const source = createRng(5);
    for (let k = 0; k < 4000; k++) {
      const { events } = mutate(input(0, 0, 0.5), gaussian(0.25), source, 0, bounds);
      zs.push(...(events[0]!.gaussian ?? []).map((s) => s.z));
      mutating += events[0]!.flipped.length;
    }
    const mean = zs.reduce((a, b) => a + b, 0) / zs.length;
    const sd = Math.sqrt(zs.reduce((a, b) => a + (b - mean) ** 2, 0) / zs.length);
    expect(Math.abs(mean)).toBeLessThan(0.06);
    expect(Math.abs(sd - 1)).toBeLessThan(0.05);
    expect(Math.abs(mutating / genes - 0.25)).toBeLessThan(0.02);
  });

  test('per individual changes at most one gene', () => {
    for (let k = 0; k < 200; k++) {
      const { events } = mutate(input(...start()), gaussian(0.7, 'per-individual'), createRng(k), 0, bounds);
      expect(events[0]!.flipped.length).toBeLessThanOrEqual(1);
      expect((events[0]!.gaussian ?? []).length).toBe(events[0]!.flipped.length);
    }
  });

  test('the draws are the same however the run is advanced: the same seed gives the same results gene by gene', () => {
    const once = mutate(input(1, 2, 0.5), gaussian(0.5), createRng(9), 0, bounds);
    const again = mutate(input(1, 2, 0.5), gaussian(0.5), createRng(9), 0, bounds);
    expect(again).toEqual(once);
  });
});

describe('inside a whole generation of a real-valued problem', () => {
  const problem = realSphere(box);
  const config = (crossoverConfig: CrossoverConfig, mutation: MutationConfig): GenerationConfig => ({
    problem,
    selection: { method: 'tournament', size: 2 },
    crossover: crossoverConfig,
    mutation,
    elites: 1,
    stop: { generationLimit: 50 },
  });
  const play = (crossoverConfig: CrossoverConfig, mutation: MutationConfig, seed: number) => {
    const rng = createRng(seed);
    let state = startRun(problem, { kind: 'random', size: 12 }, rng).state;
    const states = [state];
    for (let g = 0; g < 10; g++) states.push((state = runGeneration(state, config(crossoverConfig, mutation), rng).state));
    return states;
  };
  const crossovers: CrossoverConfig[] = [
    { enabled: true, operator: 'blx-alpha', probability: 0.9 },
    { enabled: true, operator: 'arithmetic', probability: 0.9 },
    { enabled: true, operator: 'uniform', probability: 0.9 },
    { enabled: false, operator: 'blx-alpha', probability: 0.9 },
  ];

  for (const crossoverConfig of crossovers) {
    for (const mutation of [gaussian(0.3, 'per-gene', 0.2), { ...gaussian(0.3), enabled: false }]) {
      test(`${crossoverConfig.enabled ? crossoverConfig.operator : 'no crossover'}, mutation ${mutation.enabled ? 'on' : 'off'}: sizes kept, genes inside the bounds, reproducible by seed`, () => {
        const run = play(crossoverConfig, mutation, 11);
        for (const state of run) {
          expect(state.population).toHaveLength(12);
          for (const i of state.population) expect(i.chromosome.every((x) => x >= -5 && x <= 5)).toBe(true);
        }
        expect(play(crossoverConfig, mutation, 11).map((s) => s.population.map((i) => i.chromosome))).toEqual(run.map((s) => s.population.map((i) => i.chromosome)));
      });
    }
  }

  test('with mutation off and no crossover a generation changes nothing but who survives', () => {
    const off = { ...gaussian(0.3), enabled: false };
    const run = play({ enabled: false, operator: 'blx-alpha', probability: 0.9 }, off, 3);
    const seen = new Set(run[0]!.population.map((i) => i.chromosome.join(',')));
    for (const state of run) for (const i of state.population) expect(seen.has(i.chromosome.join(','))).toBe(true);
  });
});
