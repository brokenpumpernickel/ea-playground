import { describe, expect, test } from 'vitest';
import {
  decodeVariable,
  integerOfBits,
  landscapeDefaultOptions,
  landscapeFunctionInfo,
  landscapeFunctions,
  landscapeLimits,
  landscapeProblem,
  validateLandscape,
  validateLandscapeFields,
  type LandscapeFunction,
  type LandscapeOptions,
} from './landscape';
import { isRealProblem } from './problem';
import { runGeneration, startRun } from './generation';
import { metricsOfProblem } from './metrics';
import { createRng } from '../run/rng';

const options = (fn: LandscapeFunction, representation: LandscapeOptions['representation'] = 'real', bitsPerVariable = 10): LandscapeOptions => ({
  function: fn,
  representation,
  bitsPerVariable,
});
const real = (fn: LandscapeFunction) => landscapeProblem(options(fn));

describe('the four functions at hand-worked points', () => {
  const at = (fn: LandscapeFunction, x: number, y: number) => landscapeFunctionInfo[fn].objective(x, y);

  test('single peak: exp(−((x − 2)² + (y + 1)²) / 8)', () => {
    expect(at('single-peak', 2, -1)).toBe(1);
    expect(at('single-peak', 0, 0)).toBeCloseTo(Math.exp(-5 / 8), 14); // 0.535261…
    expect(at('single-peak', 2, 3)).toBeCloseTo(Math.exp(-2), 14);
  });

  test('two peaks: a broad hill of height 0.6 at (−2.5, −2.5) and a narrow one of height 1 at (3, 3)', () => {
    expect(at('two-peaks', -2.5, -2.5)).toBeCloseTo(0.6, 12); // the narrow hill is 121 away in the exponent
    expect(at('two-peaks', 3, 3)).toBeCloseTo(1 + 0.6 * Math.exp(-60.5 / 8), 14); // 1.000311…
    expect(at('two-peaks', 0, 0)).toBeCloseTo(0.6 * Math.exp(-12.5 / 8) + Math.exp(-18 / 0.5), 14);
  });

  test('Rastrigin: 20 + Σ (x² − 10·cos 2πx)', () => {
    expect(at('rastrigin', 0, 0)).toBe(0);
    expect(at('rastrigin', 1, 1)).toBeCloseTo(2, 12); // 20 + 2 × (1 − 10)
    expect(at('rastrigin', 0.5, 0)).toBeCloseTo(20.25, 12); // 20 + (0.25 + 10) + (0 − 10)
  });

  test('Himmelblau: (x² + y − 11)² + (x + y² − 7)²', () => {
    expect(at('himmelblau', 3, 2)).toBe(0);
    expect(at('himmelblau', 0, 0)).toBe(170); // 121 + 49
    expect(at('himmelblau', 1, 1)).toBe(106); // 81 + 25
  });
});

describe('what each function is: direction, bounds, fitness', () => {
  test('the bounds are the stated ones, for both variables', () => {
    expect(landscapeFunctionInfo['single-peak'].bounds).toEqual({ lo: -5, hi: 5 });
    expect(landscapeFunctionInfo['two-peaks'].bounds).toEqual({ lo: -5, hi: 5 });
    expect(landscapeFunctionInfo.himmelblau.bounds).toEqual({ lo: -5, hi: 5 });
    expect(landscapeFunctionInfo.rastrigin.bounds).toEqual({ lo: -5.12, hi: 5.12 });
    expect(real('rastrigin').bounds).toEqual([{ lo: -5.12, hi: 5.12 }, { lo: -5.12, hi: 5.12 }]);
  });

  test('the maximised functions use f as fitness and the minimised ones −f, so higher is always better', () => {
    expect(landscapeFunctionInfo['single-peak'].goal).toBe('maximise');
    expect(landscapeFunctionInfo['two-peaks'].goal).toBe('maximise');
    expect(landscapeFunctionInfo.rastrigin.goal).toBe('minimise');
    expect(landscapeFunctionInfo.himmelblau.goal).toBe('minimise');
    const him = real('himmelblau').evaluate([1, 1]);
    expect(him).toMatchObject({ objective: 106, fitness: -106 });
    const single = real('single-peak').evaluate([2, -1]);
    expect(single).toMatchObject({ objective: 1, fitness: 1 });
  });

  test('a fitness of zero is a plain zero, never −0', () => {
    expect(Object.is(real('rastrigin').evaluate([0, 0]).fitness, 0)).toBe(true);
    expect(Object.is(real('himmelblau').evaluate([3, 2]).fitness, 0)).toBe(true);
  });

  test('each function has a name and a formula for the explanation', () => {
    for (const fn of landscapeFunctions) {
      expect(landscapeFunctionInfo[fn].name.length).toBeGreaterThan(3);
      expect(landscapeFunctionInfo[fn].formula).toMatch(/x/);
    }
    expect(landscapeFunctions).toEqual(['single-peak', 'two-peaks', 'rastrigin', 'himmelblau']);
  });
});

describe('the optima are verified numerically', () => {
  const bestOnGrid = (fn: LandscapeFunction, n: number) => {
    const p = real(fn) as ReturnType<typeof landscapeProblem>;
    const { lo, hi } = landscapeFunctionInfo[fn].bounds;
    let best = { x: lo, y: lo, fitness: -Infinity };
    for (let i = 0; i <= n; i++) {
      for (let j = 0; j <= n; j++) {
        const x = lo + ((hi - lo) * i) / n;
        const y = lo + ((hi - lo) * j) / n;
        const fitness = p.fitnessAt(x, y);
        if (fitness > best.fitness) best = { x, y, fitness };
      }
    }
    return best;
  };

  for (const fn of landscapeFunctions) {
    test(`${fn}: the known optimum fitness is reached at the listed points and no point of a fine grid beats it`, () => {
      const p = real(fn) as ReturnType<typeof landscapeProblem>;
      const info = landscapeFunctionInfo[fn];
      for (const { x, y } of info.optima) {
        expect(x).toBeGreaterThanOrEqual(info.bounds.lo);
        expect(x).toBeLessThanOrEqual(info.bounds.hi);
        expect(p.fitnessAt(x, y)).toBeCloseTo(p.knownOptimumFitness, 12);
      }
      const best = bestOnGrid(fn, 800);
      expect(best.fitness).toBeLessThanOrEqual(p.knownOptimumFitness + 1e-12);
      // the best grid point lies next to one of the listed optima: the listed ones are the global ones
      const near = Math.min(...info.optima.map((o) => Math.hypot(o.x - best.x, o.y - best.y)));
      expect(near).toBeLessThan(0.05);
    });

    test(`${fn}: nothing next to a listed optimum is better (a local refinement cannot improve it)`, () => {
      const p = real(fn) as ReturnType<typeof landscapeProblem>;
      for (const { x, y } of landscapeFunctionInfo[fn].optima) {
        for (const step of [1e-3, 1e-5]) {
          for (let k = 0; k < 16; k++) {
            const a = (k * Math.PI) / 8;
            expect(p.fitnessAt(x + step * Math.cos(a), y + step * Math.sin(a))).toBeLessThanOrEqual(p.knownOptimumFitness + 1e-12);
          }
        }
      }
    });
  }

  test('single peak: optimum 1 at (2, −1); Rastrigin: 0 at (0, 0)', () => {
    expect(landscapeFunctionInfo['single-peak'].optima).toEqual([{ x: 2, y: -1 }]);
    expect((real('single-peak') as { knownOptimumFitness: number }).knownOptimumFitness).toBe(1);
    expect(landscapeFunctionInfo.rastrigin.optima).toEqual([{ x: 0, y: 0 }]);
    expect(real('rastrigin').knownOptimumFitness).toBe(0);
  });

  test('two peaks: the narrow tall hill is the global optimum, within 1e-3 of 1, and the broad hill is a lower local optimum', () => {
    const p = real('two-peaks') as ReturnType<typeof landscapeProblem>;
    expect(landscapeFunctionInfo['two-peaks'].optima).toHaveLength(1);
    const { x, y } = landscapeFunctionInfo['two-peaks'].optima[0]!;
    expect(Math.hypot(x - 3, y - 3)).toBeLessThan(1e-3);
    expect(Math.abs(p.knownOptimumFitness - 1)).toBeLessThan(1e-3);
    expect(p.knownOptimumFitness).toBeGreaterThan(1);
    // the best of the grid in the far corner (the broad hill) is lower, and a local maximum
    let broad = -Infinity;
    for (let i = 0; i <= 200; i++) for (let j = 0; j <= 200; j++) {
      const bx = -5 + (i * 5) / 200;
      const by = -5 + (j * 5) / 200;
      if (bx < 0 && by < 0) broad = Math.max(broad, p.fitnessAt(bx, by));
    }
    expect(broad).toBeGreaterThan(0.59);
    expect(broad).toBeLessThan(0.61);
  });

  test('Himmelblau: four distinct minima of 0 where both terms vanish', () => {
    const optima = landscapeFunctionInfo.himmelblau.optima;
    expect(optima).toHaveLength(4);
    for (const { x, y } of optima) {
      expect(x * x + y - 11).toBeCloseTo(0, 10);
      expect(x + y * y - 7).toBeCloseTo(0, 10);
    }
    expect(optima[0]).toEqual({ x: 3, y: 2 });
    expect(optima[1]!.x).toBeCloseTo(-2.805118, 5);
    expect(optima[1]!.y).toBeCloseTo(3.131312, 5);
    expect(optima[2]!.x).toBeCloseTo(-3.77931, 5);
    expect(optima[2]!.y).toBeCloseTo(-3.283186, 5);
    expect(optima[3]!.x).toBeCloseTo(3.584428, 5);
    expect(optima[3]!.y).toBeCloseTo(-1.848126, 5);
    expect((real('himmelblau') as { knownOptimumFitness: number }).knownOptimumFitness).toBe(0);
  });
});

describe('decoding bits onto the bounds', () => {
  const bits = (text: string) => [...text].map(Number);
  const gray = (v: number, n: number) => bits((v ^ (v >> 1)).toString(2).padStart(n, '0')); // an independent encoder

  test('plain binary: the end points are the bounds exactly and consecutive integers are evenly spaced', () => {
    for (let n = 4; n <= 12; n++) {
      const bounds = { lo: -5, hi: 5 };
      expect(decodeVariable(new Array(n).fill(0), 'plain', bounds)).toBe(-5);
      expect(decodeVariable(new Array(n).fill(1), 'plain', bounds)).toBe(5);
    }
    const values = Array.from({ length: 64 }, (_, v) => decodeVariable(bits(v.toString(2).padStart(6, '0')), 'plain', { lo: -5.12, hi: 5.12 }));
    values.forEach((x, v) => expect(x).toBeCloseTo(-5.12 + (10.24 * v) / 63, 12));
    const gaps = values.slice(1).map((x, k) => x - values[k]!);
    for (const gap of gaps) expect(gap).toBeCloseTo(10.24 / 63, 12);
  });

  test('Gray: 00…0 is the lower bound, 10…0 the upper bound, and the value of integer v is the value of its Gray word', () => {
    for (let n = 4; n <= 12; n++) {
      const bounds = { lo: -5, hi: 5 };
      expect(decodeVariable(new Array(n).fill(0), 'gray', bounds)).toBe(-5);
      expect(decodeVariable(bits('1' + '0'.repeat(n - 1)), 'gray', bounds)).toBe(5);
    }
    const n = 6;
    for (let v = 0; v < 2 ** n; v++) {
      expect(integerOfBits(gray(v, n), 'gray')).toBe(v);
      expect(integerOfBits(bits(v.toString(2).padStart(n, '0')), 'plain')).toBe(v);
    }
  });

  test('adjacent Gray words differ in one bit and decode to adjacent values; in plain binary 01…1 and 10…0 are adjacent values n bits apart', () => {
    const n = 8;
    for (let v = 0; v < 2 ** n - 1; v++) {
      const a = gray(v, n);
      const b = gray(v + 1, n);
      expect(a.filter((bit, k) => bit !== b[k]).length).toBe(1);
      expect(integerOfBits(b, 'gray') - integerOfBits(a, 'gray')).toBe(1);
    }
    const low = bits('0' + '1'.repeat(n - 1));
    const high = bits('1' + '0'.repeat(n - 1));
    expect(integerOfBits(high, 'plain') - integerOfBits(low, 'plain')).toBe(1);
    expect(low.filter((bit, k) => bit !== high[k]).length).toBe(n); // the largest Hamming distance there is
  });
});

describe('the binary-coded problem', () => {
  const p = (fn: LandscapeFunction, rep: 'plain' | 'gray', n = 10) => landscapeProblem(options(fn, rep, n));
  const bitString = (x: string, y: string) => [...(x + y)].map(Number);

  test('2·n bits, the alphabet 0 and 1, no bounds: it is a symbol problem for every operator and view', () => {
    const problem = p('single-peak', 'plain', 7);
    expect(problem.chromosomeLength).toBe(14);
    expect(problem.alphabet).toEqual(['0', '1']);
    expect(problem.bounds).toBeUndefined();
    expect(isRealProblem(problem)).toBe(false);
  });

  test('the x bits come first, then the y bits, and pointOf decodes each onto the bounds', () => {
    const problem = p('single-peak', 'plain', 4);
    // x = 0b1111 = 15 → 5; y = 0b0000 → −5
    expect(problem.pointOf(bitString('1111', '0000'))).toEqual({ x: 5, y: -5 });
    // x = 0b1000 = 8 → −5 + 10 × 8 / 15; y = 0b0001 → −5 + 10 / 15
    const point = problem.pointOf(bitString('1000', '0001'));
    expect(point.x).toBeCloseTo(-5 + (10 * 8) / 15, 12);
    expect(point.y).toBeCloseTo(-5 + 10 / 15, 12);
    const gr = p('single-peak', 'gray', 4);
    expect(gr.pointOf(bitString('1000', '1000'))).toEqual({ x: 5, y: 5 });
    expect(gr.pointOf(bitString('1100', '0000')).x).toBeCloseTo(-5 + (10 * 8) / 15, 12); // Gray 1100 is 1000 = 8
  });

  test('scores: the decoded text, the numbers, the objective and the fitness all follow from the decoded point', () => {
    const problem = p('himmelblau', 'plain', 4);
    const scores = problem.evaluate(bitString('1111', '0000'));
    expect(scores).toMatchObject({ decoded: '(5.000, −5.000)', values: [5, -5] });
    expect(scores.objective).toBe((25 - 5 - 11) ** 2 + (5 + 25 - 7) ** 2);
    expect(scores.fitness).toBe(-scores.objective);
  });

  test('real and binary-coded problems give the same fitness at the same decoded point', () => {
    const rng = createRng(4);
    for (const fn of landscapeFunctions) {
      for (const rep of ['plain', 'gray'] as const) {
        const binary = p(fn, rep, 9);
        const continuous = real(fn);
        for (let k = 0; k < 40; k++) {
          const chromosome = Array.from({ length: 18 }, () => (rng.next() < 0.5 ? 0 : 1));
          const scores = binary.evaluate(chromosome);
          const { x, y } = binary.pointOf(chromosome);
          expect(scores.values).toEqual([x, y]);
          expect(continuous.evaluate([x, y]).fitness).toBe(scores.fitness);
          expect(continuous.evaluate([x, y]).objective).toBe(scores.objective);
        }
      }
    }
  });

  test('decoded values never leave the bounds', () => {
    const rng = createRng(8);
    const problem = p('rastrigin', 'gray', 12);
    for (let k = 0; k < 200; k++) {
      const { x, y } = problem.pointOf(Array.from({ length: 24 }, () => (rng.next() < 0.5 ? 0 : 1)));
      expect(Math.abs(x)).toBeLessThanOrEqual(5.12);
      expect(Math.abs(y)).toBeLessThanOrEqual(5.12);
    }
  });
});

describe('the real-valued problem', () => {
  test('two genes inside the function’s bounds, no alphabet', () => {
    const problem = real('single-peak');
    expect(problem.chromosomeLength).toBe(2);
    expect(problem.alphabet).toEqual([]);
    expect(isRealProblem(problem)).toBe(true);
  });

  test('scores: the point is its own decoded solution, shown to three decimals with a real minus sign', () => {
    const scores = real('single-peak').evaluate([2, -1]);
    expect(scores).toMatchObject({ decoded: '(2.000, −1.000)', values: [2, -1], objective: 1, fitness: 1 });
    expect(real('rastrigin').evaluate([-0.0004, 1.23456]).decoded).toBe('(0.000, 1.235)');
  });

  test('the population columns of a real-valued run: the pair is the chromosome, so only the objective (where it differs from fitness) and fitness follow', () => {
    expect(real('single-peak').columns.map((c) => c.header)).toEqual(['Fitness']);
    const minimised = real('himmelblau');
    expect(minimised.columns.map((c) => c.header)).toEqual(['f(x, y)', 'Fitness']);
    expect(minimised.columns[1]!.note).toBe('= −f');
    const scores = minimised.evaluate([1, 1]);
    expect(minimised.columns.map((c) => c.show(scores))).toEqual(['106.000', '−106.000']);
    expect(minimised.columns[0]!.optional).toBe(true); // the one the table can drop when it needs the room
  });

  test('the population columns of a binary-coded run: the decoded x and y beside the bits, then the same', () => {
    const maximised = landscapeProblem(options('single-peak', 'plain', 8));
    expect(maximised.columns.map((c) => c.header)).toEqual(['x', 'y', 'Fitness']);
    const minimised = landscapeProblem(options('rastrigin', 'gray', 8));
    expect(minimised.columns.map((c) => c.header)).toEqual(['x', 'y', 'f(x, y)', 'Fitness']);
    const scores = minimised.evaluate([1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]); // x = 5.12, y = −5.12
    const f = 20 + 2 * (5.12 ** 2 - 10 * Math.cos(2 * Math.PI * 5.12)); // Rastrigin at (5.12, −5.12), computed here by hand
    expect(minimised.columns.map((c) => c.show(scores))).toEqual(['5.120', '−5.120', f.toFixed(3), `−${f.toFixed(3)}`]);
    expect(minimised.columns[0]!.show(minimised.evaluate([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe('−5.120');
  });

  test('numbers in the columns are shown to three decimals with a real minus sign, so a column keeps its width', () => {
    const p = real('single-peak');
    expect(p.columns[0]!.show(p.evaluate([2, -1]))).toBe('1.000');
    expect(p.columns[0]!.show(p.evaluate([0, 0]))).toBe('0.535');
    expect(p.columns[0]!.show({ decoded: '', objective: 0, fitness: 0 })).toBe('0.000');
    expect(p.columns[0]!.show({ decoded: '', objective: 0, fitness: -0.0001 })).toBe('0.000'); // never "−0.000"
  });

  test('the explanation names the function, and for a minimised one the rule fitness = −f', () => {
    expect(real('himmelblau').evaluationExplanation).toMatch(/fitness = −f/);
    expect(real('himmelblau').evaluationExplanation).toMatch(/\(x² \+ y − 11\)²/);
    expect(real('single-peak').evaluationExplanation).not.toMatch(/−f/);
  });

  test('the sentence for a score reads in the problem’s own terms', () => {
    const problem = real('himmelblau');
    expect(problem.scoreText!(problem.evaluate([1, 1]))).toBe('(1.000, 1.000): f = 106, so fitness = −106');
    // long fractions are rounded to three decimals, so a sentence stays a sentence
    expect(real('single-peak').scoreText!(real('single-peak').evaluate([0, 0]))).toBe('(0.000, 0.000): f = 0.535, fitness 0.535');
    expect(real('single-peak').scoreText!(real('single-peak').evaluate([5, 5]))).toBe('(5.000, 5.000): f = 0.004, fitness 0.004');
    expect(real('single-peak').scoreText!(real('single-peak').evaluate([-5, 5]))).toBe('(−5.000, 5.000): f = 0, fitness 0');
    expect(real('single-peak').scoreText!(real('single-peak').evaluate([2, -1]))).toBe('(2.000, −1.000): f = 1, fitness 1');
  });

  test('fitnessAt and objectiveAt give any point of the plane, which is what the heatmap and surface draw', () => {
    const problem = real('rastrigin');
    expect(problem.fitnessAt(1, 1)).toBeCloseTo(-2, 12);
    expect(problem.objectiveAt(1, 1)).toBeCloseTo(2, 12);
    expect(problem.fitnessAt(0.3, -0.4)).toBe(problem.evaluate([0.3, -0.4]).fitness);
  });
});

describe('the options and their validation, in words per field', () => {
  test('the defaults are valid', () => {
    expect(validateLandscape(landscapeDefaultOptions)).toEqual([]);
    expect(landscapeDefaultOptions.bitsPerVariable).toBe(10);
    expect(landscapeLimits).toMatchObject({ minBits: 4, maxBits: 12 });
  });

  test('a function, a representation and bits that are not allowed are named by field', () => {
    const bad = { function: 'sphere', representation: 'ternary', bitsPerVariable: 13 } as unknown as LandscapeOptions;
    const fields = validateLandscapeFields(bad);
    expect(fields.function).toEqual(['Function must be one of single-peak, two-peaks, rastrigin, himmelblau (it is "sphere").']);
    expect(fields.representation).toEqual(['Representation must be one of real, plain, gray (it is "ternary").']);
    expect(fields.bitsPerVariable).toEqual([]); // the representation is not binary-coded, so the bits do not matter yet
    expect(validateLandscapeFields({ ...bad, representation: 'gray' }).bitsPerVariable).toEqual(['Bits per variable must be a whole number from 4 to 12 (it is 13).']);
  });

  test('bits per variable: whole numbers from 4 to 12 only, checked for the binary-coded representations', () => {
    for (const bitsPerVariable of [3, 13, 4.5, Number.NaN]) {
      expect(validateLandscape(options('single-peak', 'plain', bitsPerVariable))).toHaveLength(1);
    }
    for (const bitsPerVariable of [4, 8, 12]) expect(validateLandscape(options('single-peak', 'gray', bitsPerVariable))).toEqual([]);
    expect(validateLandscape(options('single-peak', 'real', 99))).toEqual([]);
  });

  test('building a problem from invalid options throws the first message', () => {
    expect(() => landscapeProblem(options('single-peak', 'plain', 3))).toThrow('Bits per variable must be a whole number from 4 to 12 (it is 3).');
  });
});

describe('the landscape problem inside the engine', () => {
  test('a random population and a generation work for each representation and the metrics follow the representation', () => {
    for (const rep of ['real', 'plain', 'gray'] as const) {
      const problem = landscapeProblem(options('two-peaks', rep, 8));
      const rng = createRng(3);
      const { state } = startRun(problem, { kind: 'random', size: 10 }, rng);
      const next = runGeneration(
        state,
        {
          problem,
          selection: { method: 'tournament', size: 2 },
          crossover: { enabled: true, operator: 'one-point', probability: 0.9 },
          mutation: rep === 'real' ? { enabled: true, mode: 'per-gene', probability: 0.5, sigma: 0.1 } : { enabled: true, mode: 'per-gene', probability: 0.05 },
          elites: 1,
          stop: { generationLimit: 10 },
        },
        rng,
      ).state;
      expect(next.population).toHaveLength(10);
      expect(metricsOfProblem(next, problem).symbolCounts.length).toBe(rep === 'real' ? 0 : 16);
      for (const i of next.population) expect(i.values).toHaveLength(2);
    }
  });

  test('a hand-edited population: pairs of numbers for the real problem, bit strings of 2·n bits for the binary-coded ones', () => {
    const rngA = createRng(1);
    const real2 = startRun(real('single-peak'), { kind: 'explicit', chromosomes: ['2 -1', '0, 0'] }, rngA).state.population;
    expect(real2.map((i) => i.fitness)).toEqual([1, Math.exp(-5 / 8)]);
    const binary = startRun(landscapeProblem(options('single-peak', 'plain', 4)), { kind: 'explicit', chromosomes: ['11110000', '10001000'] }, createRng(1)).state.population;
    expect(binary.map((i) => i.values![0])).toEqual([5, -5 + (10 * 8) / 15]);
    expect(() => startRun(landscapeProblem(options('single-peak', 'plain', 4)), { kind: 'explicit', chromosomes: ['1111'] }, createRng(1))).toThrow(
      'Chromosome 1 has 4 genes, but this problem needs 8',
    );
  });
});
