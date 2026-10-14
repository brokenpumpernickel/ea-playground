import { expect, test, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { formatTour, gaAlgorithm, type CrossoverEvent, type GaParams, type MutationEvent, type TspOptions, type TspProblem } from '../src/engine';
import { createRun } from '../src/run';
import { defaultsOf, entryOf } from '../src/ui/problems';
import { configOf, encodeConfig } from '../src/ui/run-config';

const url = pathToFileURL(resolve('dist/index.html')).href;
const entry = entryOf('tsp')!;
const num = (v: number) => String(Math.round(v * 1000) / 1000);

type Op = 'ox' | 'pmx' | 'cx';
type Move = 'swap' | 'inversion' | 'insertion';
const SIZES: [string, TspOptions][] = [
  ['5 cities', { instance: 'circle', n: 5, seed: 1 }],
  ['16 cities', { instance: 'ulysses16', n: 10, seed: 1 }],
  ['52 cities', { instance: 'berlin52', n: 10, seed: 1 }],
];

const paramsFor = (options: TspOptions, change: (p: GaParams) => GaParams): { d: ReturnType<typeof defaultsOf>; params: GaParams } => {
  const d = defaultsOf(entry, options);
  return { d, params: change(d.params) };
};
const open = async (page: Page, options: TspOptions, change: (p: GaParams) => GaParams, seed = 42, projector = false) => {
  const { d, params } = paramsFor(options, change);
  await page.goto('about:blank');
  await page.goto(url + encodeConfig(configOf({ problem: entry.create(options), init: d.init }, params, seed, 'tsp', options)));
  await expect(page.getByTestId('problem-button')).toHaveText(/TSP/);
  if (projector) await page.getByRole('button', { name: 'Projector mode' }).click();
};
const engine = (options: TspOptions, change: (p: GaParams) => GaParams, generations: number, seed = 42) => {
  const { d, params } = paramsFor(options, change);
  const problem = entry.create(options) as TspProblem;
  const run = createRun(gaAlgorithm, { setup: { problem, init: d.init }, params, seed });
  for (let g = 0; g < generations; g++) run.forwardCycle();
  return { problem, run };
};
const crossoverOf = (op: Op, pc = 0.9) => (p: GaParams): GaParams => ({ ...p, crossover: { ...p.crossover, operator: op, probability: pc } });
const mutationOf = (kind: Move, pm = 0.6) => (p: GaParams): GaParams => ({ ...p, mutation: { ...p.mutation, operator: kind, probability: pm } });
const both = (...fs: ((p: GaParams) => GaParams)[]) => (p: GaParams) => fs.reduce((q, f) => f(q), p);

/** Steps micro-step by micro-step through two generations, calling `visit` after each with where the cursor is. */
const walk = async (page: Page, visit: (at: { stage: string; micro: number; cycle: number }) => Promise<void>, presses = 2 * 80) => {
  for (let k = 0; k < presses; k++) {
    await page.keyboard.press('ArrowRight');
    const heading = await page.locator('#stage-heading').innerText();
    const narration = await page.getByTestId('narration').innerText();
    const micro = /Micro-step (\d+) of/.exec(narration);
    const parents = /Parents · generation (\d+)/.exec(await page.locator('#pop-heading').innerText());
    await visit({ stage: heading.replace(/^Stage \d · /, ''), micro: micro ? Number(micro[1]) : 0, cycle: parents ? Number(parents[1]) + 1 : 0 });
  }
};

test.describe('the crossover cards say what the events say', () => {
  for (const op of ['ox', 'pmx', 'cx'] as Op[]) {
    for (const [label, options] of SIZES) {
      test(`${op.toUpperCase()}, ${label}: every pair of two generations, strips, marks, notes and lengths`, async ({ page }) => {
        const change = crossoverOf(op);
        await open(page, options, change);
        const { problem, run } = engine(options, change, 2);
        const seen = { recombined: 0, bypassed: 0, marked: 0 };
        await walk(page, async ({ stage, micro, cycle }) => {
          if (stage !== 'Crossover' || micro === 0 || cycle < 1) return;
          const events = run.events(cycle).filter((e): e is CrossoverEvent => e.stage === 'crossover');
          const event = events[micro - 1]!;
          expect(event.pair).toBe(micro);
          const parents = run.snapshot(cycle - 1).state.population;
          const a = parents.find((i) => i.id === event.parentAId)!.chromosome;
          const b = parents.find((i) => i.id === event.parentBId)!.chromosome;
          const card = page.locator(`[data-pair="${micro}"]`);
          await expect(card.locator('[data-testid="tour-card"]')).toHaveAttribute('data-decision', event.decision);
          await expect(card.locator('[data-testid="strip-A"] .bits')).toHaveAttribute('data-bits', formatTour(a));
          await expect(card.locator('[data-testid="strip-B"] .bits')).toHaveAttribute('data-bits', formatTour(b));
          const lengths = `lengths: A ${problem.lengthText(problem.lengthOf(a))}, B ${problem.lengthText(problem.lengthOf(b))} → ${event.children.filter((c) => !c.discarded).map((c) => `O${c.offspring} ${problem.lengthText(problem.lengthOf(c.chromosome))}`).join(', ')}`;
          await expect(card.getByTestId('tour-lengths')).toHaveText(lengths);
          for (const [k, child] of event.children.entries()) {
            const strip = card.locator(`[data-testid="strip-O${child.offspring}"] .bits`);
            await expect(strip).toHaveAttribute('data-bits', formatTour(child.chromosome));
            await expect(strip.locator('.bit')).toHaveCount(options.n === 10 && options.instance === 'circle' ? 10 : child.chromosome.length);
            // hatched = a city taken from the parent that is not this child's own (A for O1, B for O2)
            const own = k === 0 ? 'A' : 'B';
            await expect(strip).toHaveAttribute('data-sources', child.sources.map((s) => (s === own ? 'A' : 'B')).join(''));
            await expect(card.getByTestId(`child-note-${child.offspring}`)).toBeVisible();
          }
          if (event.decision === 'bypassed') {
            seen.bypassed++;
            await expect(card.locator('[data-testid="strip-O' + event.children[0]!.offspring + '"] .bits')).toHaveAttribute('data-bits', formatTour(a));
            await expect(card.locator('.bit.hatch')).toHaveCount(0);
            return;
          }
          seen.recombined++;
          if (op !== 'cx') {
            const [lo, hi] = event.cuts!;
            await expect(card.getByTestId('tour-cut')).toHaveText(`cuts after positions ${lo} and ${hi} → slice = positions ${lo! + 1} to ${hi} (${hi! - lo!} ${hi! - lo! === 1 ? 'city' : 'cities'})`);
            for (const who of ['A', 'B']) await expect(card.locator(`[data-testid="strip-${who}"] .bits`)).toHaveAttribute('data-slice', `${lo! + 1}-${hi}`);
            await expect(card.locator('[data-testid="strip-A"] .bit.slice')).toHaveCount(hi! - lo!);
          }
          if (op === 'ox') {
            for (const [k, child] of event.children.entries()) {
              const cities = event.fill![k]!.cities.map((c) => c + 1);
              const note = await card.getByTestId(`child-note-${child.offspring}`).innerText();
              expect(note.startsWith(`keeps ${k === 0 ? 'A' : 'B'}’s slice · fills from ${k === 0 ? 'B' : 'A'}, starting after position ${event.cuts![1]}: ${cities.slice(0, 8).join(', ')}`)).toBe(true);
            }
          }
          if (op === 'pmx') {
            const first = event.mapping![0];
            const text = first.pairs.slice(0, 8).map((p) => `${p.taken + 1} ↔ ${p.displaced + 1}`).join(' · ');
            expect(await card.getByTestId('tour-mapping').innerText()).toContain(text);
            for (const [k, child] of event.children.entries()) {
              const followed = event.mapping![k]!.followed.map((f) => f.position + 1);
              const strip = card.locator(`[data-testid="strip-O${child.offspring}"] .bits`);
              if (followed.length > 0) {
                seen.marked++;
                await expect(strip).toHaveAttribute('data-followed', followed.join(','));
                await expect(strip.locator('.bit.mapped')).toHaveCount(followed.length);
              } else await expect(strip.locator('.bit.mapped')).toHaveCount(0);
            }
          }
          if (op === 'cx') {
            const cycleOf = Array.from({ length: a.length }, () => 0);
            event.cycles!.forEach((cycle, c) => cycle.forEach((p) => (cycleOf[p] = c + 1)));
            for (const who of ['A', 'B']) await expect(card.locator(`[data-testid="strip-${who}"] .bits`)).toHaveAttribute('data-cycles', cycleOf.join(','));
            await expect(card.getByTestId('tour-cycles')).toContainText(`${event.cycles!.length} cycle`);
          }
        });
        expect(seen.recombined + seen.bypassed, 'pairs were seen').toBeGreaterThan(6);
        expect(seen.recombined, 'recombined pairs were seen').toBeGreaterThan(0);
        if (op === 'pmx' && options.n !== 5) expect(seen.marked, 'a city that followed the mapping was seen').toBeGreaterThan(0);
      });
    }
  }

  test('a switched-off crossover shows every pair as a bypass with copies and the lengths, and says why in the card and the narration', async ({ page }) => {
    const options = SIZES[1]![1];
    const change = (p: GaParams): GaParams => ({ ...p, crossover: { ...p.crossover, enabled: false } });
    await open(page, options, change);
    const { problem, run } = engine(options, change, 1);
    let visited = 0;
    await walk(page, async ({ stage, micro, cycle }) => {
      if (stage !== 'Crossover' || micro === 0 || cycle !== 1) return;
      visited++;
      const event = run.events(1).filter((e): e is CrossoverEvent => e.stage === 'crossover')[micro - 1]!;
      const card = page.locator(`[data-pair="${micro}"]`);
      await expect(card).toContainText('BYPASS');
      await expect(card).toContainText('crossover is off → children are copies');
      await expect(card.getByTestId('child-note-' + event.children[0]!.offspring)).toHaveText('a copy of A');
      const narration = await page.getByTestId('narration').innerText();
      expect(narration).toContain(`Pair ${micro}: crossover is off → bypassed: children are copies, ${problem.lengthText(problem.lengthOf(event.children[0]!.chromosome))}`);
    }, 50);
    expect(visited, 'pairs were seen').toBeGreaterThan(5);
  });
});

test.describe('the mutation cards say what the events say', () => {
  for (const kind of ['swap', 'inversion', 'insertion'] as Move[]) {
    for (const [label, options] of SIZES) {
      test(`${kind}, ${label}: every offspring of two generations, draw, move, strips, edges and lengths`, async ({ page }) => {
        const change = both(mutationOf(kind), crossoverOf('ox'));
        await open(page, options, change);
        const { problem, run } = engine(options, change, 2);
        const seen = { mutated: 0, unchanged: 0 };
        await walk(page, async ({ stage, micro, cycle }) => {
          if (stage !== 'Mutation' || micro === 0 || cycle < 1) return;
          const event = run.events(cycle).filter((e): e is MutationEvent => e.stage === 'mutation')[micro - 1]!;
          const card = page.locator(`[data-offspring="${event.offspring}"][data-state="revealed"]`);
          const before = problem.lengthOf(event.before);
          const after = problem.lengthOf(event.after);
          await expect(card.getByTestId('individual-draw')).toContainText(`draw u = ${num(event.individualDraw!.u)} ${event.decision === 'mutated' ? '<' : '≥'} pm 0.6 (one draw per individual) → ${event.decision}`);
          if (event.decision === 'mutated') {
            seen.mutated++;
            const m = event.move!;
            await expect(card.getByTestId('tour-draws')).toHaveText(`positions drawn u₁ = ${num(m.r[0])}, u₂ = ${num(m.r[1])}`);
            const i = m.first + 1;
            const j = m.second + 1;
            await expect(card.getByTestId('tour-move')).toContainText(kind === 'swap' ? `swap the cities at positions ${i} and ${j}` : kind === 'inversion' ? `reverse the slice from position ${i} to ${j}` : `take the city at position ${i} out and put it at position ${j}`);
            await expect(card.locator('[data-testid="strip-before"] .bits')).toHaveAttribute('data-bits', formatTour(event.before));
            const afterStrip = card.locator('[data-testid="strip-after"] .bits');
            await expect(afterStrip).toHaveAttribute('data-bits', formatTour(event.after));
            await expect(afterStrip).toHaveAttribute('data-flipped', event.flipped.join(','));
            await expect(afterStrip.locator('.bit.flip')).toHaveCount(event.flipped.length);
            const edge = (e: readonly [number, number]) => `${e[0] + 1}–${e[1] + 1}`;
            const delta = after - before;
            await expect(card.getByTestId('tour-edges')).toHaveText(`✕ removed ${event.edges!.removed.map(edge).join(', ')} · added ${event.edges!.added.map(edge).join(', ')} · length ${problem.lengthText(before)} → ${problem.lengthText(after)} (${delta > 0 ? '+' : delta < 0 ? '−' : '±'}${problem.lengthText(Math.abs(delta))})`);
          } else {
            seen.unchanged++;
            await expect(card.getByTestId('tour-length')).toHaveText(`unchanged · length ${problem.lengthText(before)}`);
            await expect(card.locator('.bits')).toHaveCount(0);
          }
        });
        expect(seen.mutated, 'mutated offspring were seen').toBeGreaterThan(3);
        expect(seen.unchanged, 'unchanged offspring were seen').toBeGreaterThan(0);
      });
    }
  }

  test('a switched-off mutation shows every offspring as a bypass with its length', async ({ page }) => {
    const options = SIZES[1]![1];
    const change = (p: GaParams): GaParams => ({ ...p, mutation: { ...p.mutation, enabled: false } });
    await open(page, options, change);
    const { problem, run } = engine(options, change, 1);
    let visited = 0;
    await walk(page, async ({ stage, micro, cycle }) => {
      if (stage !== 'Mutation' || micro === 0 || cycle !== 1) return;
      visited++;
      const event = run.events(1).filter((e): e is MutationEvent => e.stage === 'mutation')[micro - 1]!;
      const card = page.locator(`[data-offspring="${event.offspring}"][data-state="revealed"]`);
      await expect(card).toContainText('BYPASS');
      await expect(card).toContainText('mutation is off');
      await expect(card.getByTestId('tour-length')).toHaveText(`unchanged · length ${problem.lengthText(problem.lengthOf(event.before))}`);
    }, 75);
    expect(visited, 'offspring were seen').toBeGreaterThan(10);
  });
});

for (const [width, height] of [
  [1920, 1080],
  [1366, 768],
] as const) {
  test.describe(`at ${width}×${height}`, () => {
    for (const [label, options] of SIZES) {
     for (const projector of [false, true]) {
      for (const op of ['ox', 'pmx', 'cx'] as Op[]) {
        test(`${op.toUpperCase()}, ${label}${projector ? ' in projector mode' : ''}: at every micro-step of two generations, in every stage, the cards stay inside the panel, strips are one row, and the narration stays in its box`, async ({ page }) => {
          test.setTimeout(60_000);
          await page.setViewportSize({ width, height });
          const move: Move = op === 'ox' ? 'inversion' : op === 'pmx' ? 'swap' : 'insertion';
          await open(page, options, both(crossoverOf(op), mutationOf(move)), 42, projector);
          const stages = new Set<string>();
          await walk(page, async ({ stage }) => {
            stages.add(stage);
            const problems = await page.evaluate(() => {
              const out: string[] = [];
              const panel = document.querySelector('section.panel[aria-labelledby="stage-heading"]')!.getBoundingClientRect();
              const body = document.querySelector('#stagebody')!;
              const b = body.getBoundingClientRect();
              if (body.scrollWidth - body.clientWidth > 1) out.push(`the stage body scrolls sideways by ${body.scrollWidth - body.clientWidth}px`);
              const narr = document.querySelector('#narr')!;
              const nr = narr.getBoundingClientRect();
              if (narr.scrollHeight - narr.clientHeight > 1) out.push('the narration overflows its box');
              if (nr.bottom > panel.bottom + 1 || nr.top < b.top) out.push('the narration leaves the panel');
              for (const strip of document.querySelectorAll('#stagebody .bits.strip')) {
                const tops = new Set([...strip.querySelectorAll('.bit')].map((c) => Math.round(c.getBoundingClientRect().top / 4)));
                if (tops.size > 1) out.push('a strip wraps onto a second row');
              }
              // a card is wholly visible in its scrolling list when it is the current one
              for (const card of document.querySelectorAll('#stagebody .ccard.current, #stagebody .mcard.current')) {
                const r = card.getBoundingClientRect();
                const list = card.parentElement!.getBoundingClientRect();
                if (r.bottom > list.bottom + 1 || r.top < list.top - 1) out.push(`the current card is cut: ${Math.round(r.top - list.top)}…${Math.round(r.bottom - list.bottom)}`);
                if (r.right > list.right + 1) out.push('the current card leaves its list on the right');
              }
              // nothing in a column, a card or a row sticks out of it sideways
              for (const box of document.querySelectorAll('#stagebody .rcol, #stagebody .card, #stagebody .tcard, #stagebody .rrow, #stagebody .tcard .crow')) {
                const r = box.getBoundingClientRect();
                if (r.width === 0) continue;
                for (const el of box.querySelectorAll('*')) {
                  const e = el.getBoundingClientRect();
                  if (e.width === 0 || el.closest('svg') !== null && el.tagName !== 'svg') continue;
                  if (e.right > r.right + 1.5) {
                    out.push(`${(el as HTMLElement).className || el.tagName} sticks out of ${(box as HTMLElement).className} by ${Math.round(e.right - r.right)}px`);
                    break;
                  }
                }
              }
              return out;
            });
            expect(problems, `${stage}`).toEqual([]);
          });
          expect([...stages].sort(), 'every stage was visited').toEqual(['Crossover', 'Evaluation of offspring', 'Mutation', 'Pairing', 'Replacement', 'Selection']);
        });
      }
     }
    }
  });
}
