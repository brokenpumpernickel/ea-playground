import { describe, expect, test } from 'vitest';
import { formatReal, gaAlgorithm, landscapeProblem, type GaEvent, type GaParams, type GaSetup, type LandscapeOptions, type RunState } from '../engine';
import { createRun, type Run } from '../run';
import { describer } from './describe';
import { displayOf, num } from './format';

type GaRun = Run<GaSetup, GaParams, RunState, GaEvent>;
const f3 = (v: number) => formatReal([v], 3);
const pair = (c: readonly number[]) => `(${f3(c[0]!)}, ${f3(c[1]!)})`;
const signed = (v: number) => (v < 0 ? '−' : '+') + f3(Math.abs(v)).replace('−', '');
const mz = (v: number) => num(v).replace('-', '−');

const make = (params: Partial<GaParams>, options: Partial<LandscapeOptions> = {}, size = 8, seed = 11) => {
  const full: LandscapeOptions = { function: 'two-peaks', representation: 'real', bitsPerVariable: 6, ...options };
  const problem = landscapeProblem(full);
  const p: GaParams = {
    selection: { method: 'tournament', size: 2 },
    crossover: { enabled: true, operator: 'blx-alpha', probability: 1, alpha: 1.5 },
    mutation: { enabled: true, mode: 'per-gene', probability: 0.5, sigma: 0.2 },
    elites: 0,
    stop: { generationLimit: 50 },
    ...params,
  };
  const run: GaRun = createRun(gaAlgorithm, { setup: { problem, init: { kind: 'random', size } }, params: p, seed });
  run.forwardCycle();
  return { run, say: describer(displayOf(problem)), problem };
};
const of = <S extends GaEvent['stage']>(run: GaRun, stage: S) => run.events(1).filter((e): e is Extract<GaEvent, { stage: S }> => e.stage === stage);

describe('crossover sentences for real pairs', () => {
  test('BLX-α names the operator and α, and the children are pairs; a clamped gene is named', () => {
    const { run, say } = make({ crossover: { enabled: true, operator: 'blx-alpha', probability: 1, alpha: 4 } }, {}, 16, 3);
    let clamped = 0;
    for (const e of of(run, 'crossover')) {
      const [c1, c2] = e.children;
      const marks = e.children.flatMap((c) => (c.clamped ?? []).flatMap((x, g) => (x ? [`O${c.offspring} ${g === 0 ? 'x' : 'y'}`] : [])));
      clamped += marks.length;
      const tail = marks.length > 0 ? ` · clamped to a bound: ${marks.join(', ')}` : '';
      expect(say(e)).toBe(`Pair ${e.pair}: u = ${num(e.draw!.u)} < pc 1 → recombined (BLX-α, α = 4): children ${pair(c1!.chromosome)} and ${pair(c2!.chromosome)}${c2!.discarded ? ' · second child dropped' : ''}${tail}`);
    }
    expect(clamped).toBeGreaterThan(0);
  });

  test('arithmetic names λ', () => {
    const { run, say } = make({ crossover: { enabled: true, operator: 'arithmetic', probability: 1 } });
    for (const e of of(run, 'crossover')) {
      const [c1, c2] = e.children;
      expect(say(e)).toBe(`Pair ${e.pair}: u = ${num(e.draw!.u)} < pc 1 → recombined (arithmetic, λ = ${num(e.lambda!)}): children ${pair(c1!.chromosome)} and ${pair(c2!.chromosome)}${c2!.discarded ? ' · second child dropped' : ''}`);
    }
  });

  test('a discrete operator keeps its cut sentence, with pairs', () => {
    const { run, say } = make({ crossover: { enabled: true, operator: 'one-point', probability: 1 } });
    const e = of(run, 'crossover')[0]!;
    expect(say(e)).toBe(`Pair 1: u = ${num(e.draw!.u)} < pc 1 → recombined (cut after gene 1): children ${pair(e.children[0]!.chromosome)} and ${pair(e.children[1]!.chromosome)}`);
  });

  test('a bypass says copies', () => {
    const { run, say } = make({ crossover: { enabled: true, operator: 'arithmetic', probability: 0 } });
    const e = of(run, 'crossover')[0]!;
    expect(say(e)).toBe(`Pair 1: u = ${num(e.draw!.u)} ≥ pc 0 → bypassed: children are copies, ${pair(e.children[0]!.chromosome)} and ${pair(e.children[1]!.chromosome)}`);
  });
});

describe('Gaussian mutation sentences', () => {
  test('one gene: the draw, z, the signed step, before and after, and the pairs', () => {
    const { run, say } = make({ mutation: { enabled: true, mode: 'per-gene', probability: 0.3, sigma: 0.2 } }, {}, 20);
    const events = of(run, 'mutation');
    const one = events.find((e) => e.gaussian?.length === 1)!;
    const step = one.gaussian![0]!;
    const u = one.geneDraws!.find((d) => d.gene === step.gene)!.u;
    const name = step.gene === 1 ? 'x' : 'y';
    const clamp = step.clamped ? ', clamped to the bound' : '';
    expect(say(one)).toBe(`Offspring ${one.offspring}: gene ${name} drew u = ${num(u)} < pm 0.3 → z = ${mz(step.z)}, step ${signed(step.step)} (${f3(step.before)} → ${f3(step.after)}${clamp}): ${pair(one.before)} → ${pair(one.after)}`);
  });

  test('both genes: each step in turn', () => {
    const { run, say } = make({ mutation: { enabled: true, mode: 'per-gene', probability: 1, sigma: 0.2 } });
    const e = of(run, 'mutation')[0]!;
    const part = (s: NonNullable<typeof e.gaussian>[number]) => `${s.gene === 1 ? 'x' : 'y'}: z = ${mz(s.z)}, step ${signed(s.step)} (${f3(s.before)} → ${f3(s.after)}${s.clamped ? ', clamped to the bound' : ''})`;
    expect(say(e)).toBe(`Offspring ${e.offspring}: genes x and y drew below pm 1 → ${e.gaussian!.map(part).join('; ')}: ${pair(e.before)} → ${pair(e.after)}`);
  });

  test('per individual: the decision draw, the gene chosen and its step', () => {
    const { run, say } = make({ mutation: { enabled: true, mode: 'per-individual', probability: 1, sigma: 0.2 } });
    const e = of(run, 'mutation')[0]!;
    const s = e.gaussian![0]!;
    expect(say(e)).toBe(`Offspring ${e.offspring}: u = ${num(e.individualDraw!.u)} < pm 1 → mutated, gene ${e.chosenGene!.gene === 1 ? 'x' : 'y'} chosen → z = ${mz(s.z)}, step ${signed(s.step)} (${f3(s.before)} → ${f3(s.after)}${s.clamped ? ', clamped to the bound' : ''}): ${pair(e.before)} → ${pair(e.after)}`);
  });

  test('unchanged and bypassed', () => {
    const none = make({ mutation: { enabled: true, mode: 'per-gene', probability: 0, sigma: 0.2 } });
    const e = of(none.run, 'mutation')[0]!;
    expect(none.say(e)).toBe(`Offspring ${e.offspring}: no gene drew below pm 0 → unchanged, still ${pair(e.before)}`);
    const off = make({ mutation: { enabled: false, mode: 'per-gene', probability: 0.5, sigma: 0.2 } });
    const b = of(off.run, 'mutation')[0]!;
    expect(off.say(b)).toBe(`Offspring ${b.offspring}: mutation is off → unchanged, still ${pair(b.before)}`);
  });
});

describe('evaluation sentences for a real chromosome do not say the point twice', () => {
  test('the setup and the evaluation name the point once, in the score', () => {
    const { run, say, problem } = make({});
    const setup = run.events(0).find((e) => e.stage === 'setup')!;
    const i = (setup as Extract<GaEvent, { stage: 'setup' }>).individual;
    expect(say(setup)).toBe(`Individual ${i.id}: ${problem.scoreText!(i)}, fitness ${num(i.fitness)}`);
    const ev = of(run, 'evaluation')[0]!;
    expect(say(ev)).toBe(`Offspring ${ev.offspring}: ${problem.scoreText!(ev.individual)} → fitness ${num(ev.individual.fitness)} (individual ${ev.individual.id})`);
    expect(say(ev)).not.toContain(`${pair(ev.individual.chromosome)} → ${pair(ev.individual.chromosome)}`);
  });
});

describe('a binary-coded evaluation sentence rounds the fitness too', () => {
  test('three decimals at most', () => {
    const { run, say } = make({ crossover: { enabled: true, operator: 'one-point', probability: 1 }, mutation: { enabled: true, mode: 'per-gene', probability: 0.3 } }, { representation: 'gray' });
    const ev = of(run, 'evaluation')[0]!;
    expect(say(ev).endsWith(`→ fitness ${num(ev.individual.fitness)} (individual ${ev.individual.id})`)).toBe(true);
    expect(say(ev)).not.toMatch(/\d\.\d{4,}/);
  });
});

describe('binary-coded mutation sentences say where the point moved', () => {
  test.each(['plain', 'gray'] as const)('%s: a flipped bit adds the decoded move to the sentence', (representation) => {
    const { run, say, problem } = make({ crossover: { enabled: true, operator: 'one-point', probability: 1 }, mutation: { enabled: true, mode: 'per-gene', probability: 0.3 } }, { representation }, 12);
    const e = of(run, 'mutation').find((m) => m.decision === 'mutated')!;
    const a = problem.pointOf(e.before);
    const b = problem.pointOf(e.after);
    const moved = Math.hypot(b.x - a.x, b.y - a.y);
    expect(say(e)).toContain(`; the point moves from (${f3(a.x)}, ${f3(a.y)}) to (${f3(b.x)}, ${f3(b.y)}) by ${f3(moved)}`);
    expect(say(e)).toContain('→ flipped');
  });

  test('an unchanged offspring adds nothing', () => {
    const { run, say } = make({ crossover: { enabled: true, operator: 'one-point', probability: 1 }, mutation: { enabled: true, mode: 'per-gene', probability: 0 } }, { representation: 'plain' });
    expect(say(of(run, 'mutation')[0]!)).not.toContain('the point moves');
  });
});
