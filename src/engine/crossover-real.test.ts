import { describe, expect, test } from 'vitest';
import { crossover, type CrossoverConfig } from './crossover';
import { goldberg } from './goldberg';
import { initialize, type Individual } from './initialize';
import { pair } from './pairing';
import type { Bounds } from './problem';
import { realSphere, scripted } from './test-support';
import { createRng } from '../run/rng';

const box: readonly Bounds[] = [{ lo: -5, hi: 5 }, { lo: -5, hi: 5 }];
const population = (texts: string[], bounds: readonly Bounds[] = box): Individual[] =>
  initialize(realSphere(bounds), { kind: 'explicit', chromosomes: texts }, createRng(1)).population;

const blx = (alpha?: number, probability = 1): CrossoverConfig => ({ enabled: true, operator: 'blx-alpha', probability, ...(alpha === undefined ? {} : { alpha }) });
const arithmetic = (probability = 1): CrossoverConfig => ({ enabled: true, operator: 'arithmetic', probability });

// individual 1 = A = (−2.1, 1.4), individual 2 = B = (0.9, −0.6)
const ab = () => population(['-2.1 1.4', '0.9 -0.6']);
const onePair = pair([1, 2], 2).pairs;

describe('BLX-α, worked by hand', () => {
  // gene 1: A −2.1, B 0.9, d = 3, widened interval [−2.1 − 1.5, 0.9 + 1.5] = [−3.6, 2.4], width 6
  // gene 2: A 1.4, B −0.6, d = 2, widened interval [−0.6 − 1, 1.4 + 1] = [−1.6, 2.4], width 4
  // draws: pair u, then for each gene in order the draw for O1 and then the draw for O2
  test('each child gene is from + u × (to − from) of the widened interval, genes in order, O1 before O2', () => {
    const rng = scripted(0.1, 0.5, 0.25, 0.75, 0);
    const { offspring } = crossover(ab(), onePair, blx(0.5), rng, box);
    expect(rng.used).toBe(5); // 1 for the pair + 2 per gene
    expect(offspring[0]!.chromosome[0]).toBeCloseTo(-0.6, 12); // −3.6 + 0.5 × 6
    expect(offspring[0]!.chromosome[1]).toBeCloseTo(1.4, 12); // −1.6 + 0.75 × 4
    expect(offspring[1]!.chromosome[0]).toBeCloseTo(-2.1, 12); // −3.6 + 0.25 × 6
    expect(offspring[1]!.chromosome[1]).toBeCloseTo(-1.6, 12); // −1.6 + 0 × 4
  });

  test('the event records α and, per gene, the parents, d, the widened interval, the draws, the raw values and the clamping', () => {
    const { events } = crossover(ab(), onePair, blx(0.5), scripted(0.1, 0.5, 0.25, 0.75, 0), box);
    const e = events[0]!;
    expect(e).toMatchObject({ operator: 'blx-alpha', decision: 'recombined', alpha: 0.5, draw: { u: 0.1, threshold: 1 } });
    expect(e.blend!).toHaveLength(2);
    const g = e.blend![0]!;
    expect([g.a, g.b]).toEqual([-2.1, 0.9]);
    expect(g.d).toBeCloseTo(3, 12);
    expect([g.from, g.to].map((x) => Number(x.toFixed(9)))).toEqual([-3.6, 2.4]);
    expect(g.draws).toEqual([0.5, 0.25]);
    expect(g.clamped).toEqual([false, false]);
    expect(e.children[0]!.clamped).toEqual([false, false]);
    expect(e).not.toHaveProperty('lambda');
    expect(e).not.toHaveProperty('cuts');
  });

  test('without an α the default is 0.5', () => {
    const { events } = crossover(ab(), onePair, blx(), scripted(0.1, 0.5, 0.25, 0.75, 0), box);
    expect(events[0]!.alpha).toBe(0.5);
  });

  test('a value beyond a bound is clamped to it, the raw value is kept and the gene is named as clamped', () => {
    const one = [{ lo: -5, hi: 5 }];
    // A = 4, B = 5, α = 1: d = 1, interval [3, 6]; O1 draws 0.9 → 5.7 → 5; O2 draws 0.5 → 4.5
    const upper = crossover(population(['4', '5'], one), onePair, blx(1), scripted(0, 0.9, 0.5), one);
    expect(upper.offspring.map((c) => c.chromosome)).toEqual([[5], [4.5]]);
    expect(upper.offspring.map((c) => c.clamped)).toEqual([[true], [false]]);
    expect(upper.events[0]!.blend![0]!.raw[0]).toBeCloseTo(5.7, 12);
    expect(upper.events[0]!.blend![0]!.clamped).toEqual([true, false]);
    // A = −5, B = −4, α = 1: interval [−6, −3]; O1 draws 0.1 → −5.7 → −5; O2 draws 0.9 → −3.3
    const lower = crossover(population(['-5', '-4'], one), onePair, blx(1), scripted(0, 0.1, 0.9), one);
    expect(lower.offspring[0]!.chromosome).toEqual([-5]);
    expect(lower.offspring[0]!.clamped).toEqual([true]);
    expect(lower.offspring[1]!.chromosome[0]).toBeCloseTo(-3.3, 12);
  });

  test('with α = 0 the children stay between the parents (a box with the parents at its corners)', () => {
    const { offspring } = crossover(ab(), onePair, blx(0), scripted(0, 1 - 1e-12, 0, 1 - 1e-12, 0), box);
    expect(offspring[0]!.chromosome[0]).toBeCloseTo(0.9, 6); // top of [−2.1, 0.9]
    expect(offspring[1]!.chromosome[0]).toBeCloseTo(-2.1, 6);
    expect(offspring[0]!.chromosome[1]).toBeCloseTo(1.4, 6); // O1 draws the top of [−0.6, 1.4], O2 the bottom
    expect(offspring[1]!.chromosome[1]).toBeCloseTo(-0.6, 6);
  });

  test('equal parents give the single value they share, whatever the draw', () => {
    const { offspring } = crossover(population(['2 3', '2 3']), onePair, blx(0.5), scripted(0, 0.3, 0.9, 0.6, 0.1), box);
    expect(offspring.map((c) => c.chromosome)).toEqual([[2, 3], [2, 3]]);
  });
});

describe('whole arithmetic crossover, worked by hand', () => {
  test('one λ per pair after the pair draw; children are λ·A + (1 − λ)·B and (1 − λ)·A + λ·B', () => {
    const rng = scripted(0.1, 0.25);
    const { offspring, events } = crossover(ab(), onePair, arithmetic(), rng, box);
    expect(rng.used).toBe(2);
    // λ = 0.25: O1 = 0.25·A + 0.75·B, O2 = 0.75·A + 0.25·B
    expect(offspring[0]!.chromosome[0]).toBeCloseTo(0.15, 12);
    expect(offspring[0]!.chromosome[1]).toBeCloseTo(-0.1, 12);
    expect(offspring[1]!.chromosome[0]).toBeCloseTo(-1.35, 12);
    expect(offspring[1]!.chromosome[1]).toBeCloseTo(0.9, 12);
    expect(events[0]).toMatchObject({ operator: 'arithmetic', decision: 'recombined', lambda: 0.25 });
    expect(events[0]).not.toHaveProperty('blend');
  });

  test('λ = 0 swaps the parents, λ = 1 copies them', () => {
    const zero = crossover(ab(), onePair, arithmetic(), scripted(0, 0), box).offspring;
    expect(zero.map((c) => c.chromosome)).toEqual([[0.9, -0.6], [-2.1, 1.4]]);
    const one = crossover(ab(), onePair, arithmetic(), scripted(0, 1), box).offspring;
    expect(one.map((c) => c.chromosome)).toEqual([[-2.1, 1.4], [0.9, -0.6]]);
  });
});

describe('bypass and switched off, for the real operators', () => {
  for (const config of [blx(0.5, 0.5), arithmetic(0.5)]) {
    test(`${config.operator}: a pair whose draw is not below pc passes copies of the parents through with no operator draws`, () => {
      const rng = scripted(0.7);
      const parents = ab();
      const { offspring, events } = crossover(parents, onePair, config, rng, box);
      expect(rng.used).toBe(1);
      expect(offspring.map((c) => c.chromosome)).toEqual([[-2.1, 1.4], [0.9, -0.6]]);
      expect(offspring[0]!.chromosome).not.toBe(parents[0]!.chromosome);
      expect(offspring[1]!.chromosome).not.toBe(parents[1]!.chromosome);
      expect(events[0]).toMatchObject({ decision: 'bypassed', reason: 'draw-failed', draw: { u: 0.7, threshold: 0.5 } });
      expect(events[0]).not.toHaveProperty('blend');
      expect(events[0]).not.toHaveProperty('lambda');
    });

    test(`${config.operator}: switched off draws nothing at all and still passes copies through`, () => {
      const rng = scripted();
      const { offspring, events } = crossover(ab(), onePair, { ...config, enabled: false }, rng, box);
      expect(rng.used).toBe(0);
      expect(offspring.map((c) => c.chromosome)).toEqual([[-2.1, 1.4], [0.9, -0.6]]);
      expect(events[0]).toMatchObject({ decision: 'bypassed', reason: 'switched-off' });
      expect(events[0]).not.toHaveProperty('draw');
    });
  }
});

describe('one-point, two-point and uniform work on real vectors as on symbols', () => {
  test('one-point swaps the genes after the cut, copying the numbers', () => {
    const rng = scripted(0, 0.3); // pair draw, then cut = 1 + ⌊0.3 × 1⌋ = 1
    const { offspring, events } = crossover(ab(), onePair, { enabled: true, operator: 'one-point', probability: 1 }, rng, box);
    expect(offspring.map((c) => c.chromosome)).toEqual([[-2.1, -0.6], [0.9, 1.4]]);
    expect(offspring[0]!.sources).toEqual(['A', 'B']);
    expect(events[0]).toMatchObject({ cuts: [1] });
  });

  test('uniform swaps the genes whose draw is below 0.5', () => {
    const { offspring, events } = crossover(ab(), onePair, { enabled: true, operator: 'uniform', probability: 1 }, scripted(0, 0.9, 0.1), box);
    expect(offspring.map((c) => c.chromosome)).toEqual([[-2.1, -0.6], [0.9, 1.4]]);
    expect(events[0]).toMatchObject({ mask: [false, true] });
  });

  test('two-point needs three genes, so with two genes it is refused in words', () => {
    expect(() => crossover(ab(), onePair, { enabled: true, operator: 'two-point', probability: 1 }, scripted(0), box)).toThrow(
      'Two-point crossover needs chromosomes of at least 3 genes, but they have 2',
    );
  });
});

describe('the operator must suit the representation, and α must be usable', () => {
  const symbols = () => initialize(goldberg, { kind: 'explicit', chromosomes: ['01101', '11000'] }, createRng(1)).population;

  test('BLX-α and arithmetic crossover are refused for a symbol problem, in words', () => {
    expect(() => crossover(symbols(), onePair, blx(), scripted(0))).toThrow('BLX-α crossover is for real-valued chromosomes');
    expect(() => crossover(symbols(), onePair, arithmetic(), scripted(0))).toThrow('Arithmetic crossover is for real-valued chromosomes');
  });

  test('the refusal holds even when crossover is switched off, so a hidden bad setting cannot linger', () => {
    expect(() => crossover(symbols(), onePair, { ...blx(), enabled: false }, scripted())).toThrow('BLX-α crossover is for real-valued chromosomes');
  });

  test('α must be a number of 0 or more', () => {
    for (const alpha of [-0.1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => crossover(ab(), onePair, blx(alpha), scripted(0), box)).toThrow('α must be a number of 0 or more');
    }
  });
});

describe('properties over generated parents', () => {
  const rng = createRng(2024);
  const range = { lo: -5.12, hi: 5.12 };
  const bounds = [range, range, { lo: 0, hi: 1 }];
  const parentsOf = () => {
    const text = () => bounds.map(({ lo, hi }) => (lo + rng.next() * (hi - lo)).toString()).join(' ');
    return population([text(), text()], bounds);
  };
  const many = 300;

  test('BLX-α children lie in the widened interval of their gene and, after clamping, in the bounds; a clamped gene sits on a bound', () => {
    for (let k = 0; k < many; k++) {
      const alpha = [0, 0.25, 0.5, 1.5][k % 4]!;
      const parents = parentsOf();
      const { offspring, events } = crossover(parents, onePair, blx(alpha), createRng(k), bounds);
      const [a, b] = [parents[0]!.chromosome, parents[1]!.chromosome];
      offspring.forEach((child, c) => {
        child.chromosome.forEach((x, g) => {
          const mn = Math.min(a[g]!, b[g]!);
          const mx = Math.max(a[g]!, b[g]!);
          const d = mx - mn;
          expect(x).toBeGreaterThanOrEqual(bounds[g]!.lo);
          expect(x).toBeLessThanOrEqual(bounds[g]!.hi);
          expect(x).toBeGreaterThanOrEqual(Math.max(bounds[g]!.lo, mn - alpha * d - 1e-12));
          expect(x).toBeLessThanOrEqual(Math.min(bounds[g]!.hi, mx + alpha * d + 1e-12));
          if (alpha === 0) {
            expect(x).toBeGreaterThanOrEqual(mn - 1e-12);
            expect(x).toBeLessThanOrEqual(mx + 1e-12);
          }
          const recorded = events[0]!.blend![g]!;
          if (child.clamped![g]) expect([bounds[g]!.lo, bounds[g]!.hi]).toContain(x);
          // the recorded draws reproduce the child
          const raw = recorded.from + recorded.draws[c]! * (recorded.to - recorded.from);
          expect(recorded.raw[c]).toBe(raw);
          expect(x).toBe(Math.min(bounds[g]!.hi, Math.max(bounds[g]!.lo, raw)));
          expect(child.clamped![g]).toBe(raw < bounds[g]!.lo || raw > bounds[g]!.hi);
        });
      });
    }
  });

  test('arithmetic children are λ·A + (1 − λ)·B and the mirror, inside the parents’ box, and λ is the recorded draw', () => {
    for (let k = 0; k < many; k++) {
      const parents = parentsOf();
      const draws = createRng(k);
      const preview = createRng(k);
      preview.next(); // the pair draw
      const lambda = preview.next();
      const { offspring, events } = crossover(parents, onePair, arithmetic(), draws, bounds);
      expect(events[0]!.lambda).toBe(lambda);
      const [a, b] = [parents[0]!.chromosome, parents[1]!.chromosome];
      offspring[0]!.chromosome.forEach((x, g) => {
        expect(x).toBeCloseTo(lambda * a[g]! + (1 - lambda) * b[g]!, 12);
        expect(offspring[1]!.chromosome[g]!).toBeCloseTo((1 - lambda) * a[g]! + lambda * b[g]!, 12);
        for (const y of [x, offspring[1]!.chromosome[g]!]) {
          expect(y).toBeGreaterThanOrEqual(Math.min(a[g]!, b[g]!) - 1e-12);
          expect(y).toBeLessThanOrEqual(Math.max(a[g]!, b[g]!) + 1e-12);
          expect(y).toBeGreaterThanOrEqual(bounds[g]!.lo);
          expect(y).toBeLessThanOrEqual(bounds[g]!.hi);
        }
      });
    }
  });

  test('children never share an array with a parent or with the event’s record, and the events’ children equal the offspring', () => {
    for (const config of [blx(), arithmetic(), { enabled: true, operator: 'uniform' as const, probability: 1 }]) {
      const parents = parentsOf();
      const { offspring, events } = crossover(parents, onePair, config, createRng(5), bounds);
      offspring.forEach((child, c) => {
        for (const p of parents) expect(child.chromosome).not.toBe(p.chromosome);
        expect(events[0]!.children[c]!.chromosome).toEqual(child.chromosome);
        expect(events[0]!.children[c]!.chromosome).not.toBe(child.chromosome);
      });
    }
  });

  test('a run of the draws is reproducible: the same seed gives the same children', () => {
    const run = () => crossover(parentsOf2(), onePair, blx(), createRng(77), bounds).offspring.map((c) => c.chromosome);
    const parentsOf2 = () => population(['1 2 0.5', '-3 4 0.25'], bounds);
    expect(run()).toEqual(run());
  });
});
