import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { gaAlgorithm, landscapeDefaults, landscapeProblem, metricsOfProblem, type GaParams, type GaSetup, type LandscapeOptions } from '../src/engine';
import { createRun } from '../src/run';
import { defaultsOf, entryOf } from '../src/ui/problems';
import { statsLines } from '../src/ui/spread-model';

const url = pathToFileURL(resolve('dist/index.html')).href;
const shots = resolve('.scratch/milestone-5-landscape/screenshots');
test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

const entry = entryOf('landscape')!;
const himmelblau: LandscapeOptions = { function: 'himmelblau', representation: 'real', bitsPerVariable: 10 };
const presetFile = JSON.parse(readFileSync(resolve('src/ui/presets/m-landscape-himmelblau.json'), 'utf8')) as { seed: number; options: LandscapeOptions; setup: { init: GaSetup['init'] }; params: GaParams };

const heading = (page: Page) => page.locator('#pop-heading');
const engineOf = (options: LandscapeOptions, params: GaParams, seed: number, init: GaSetup['init']) => {
  const problem = landscapeProblem(options);
  const run = createRun(gaAlgorithm, { setup: { problem, init }, params, seed }, { eventCacheSize: 0 });
  return { run, problem, summary: (g: number) => statsLines(metricsOfProblem(run.snapshot(g).state, problem))[0] };
};
const numberPattern = /-?\d+(\.\d+)?(e-?\d+)?/g;
/** The page's first summary line is the engine's: the same words, the numbers equal to the three decimals it shows. */
const expectSummary = async (page: Page, expected: string) => {
  const got = (await page.getByTestId('summary').innerText()).split('\n')[0]!.trim();
  expect(got.replace(numberPattern, '#')).toBe(expected.replace(numberPattern, '#'));
  const want = expected.match(numberPattern)!.map(Number);
  got.match(numberPattern)!.map(Number).forEach((value, k) => expect(value).toBeCloseTo(want[k]!, 2));
};
/** The hidden table of positions equals the engine's population: the same individuals, in the same places. */
const expectPositions = async (page: Page, e: ReturnType<typeof engineOf>, g: number) => {
  const rows = await page.getByRole('table', { name: 'Positions of the individuals' }).locator('tbody tr').evaluateAll((trs) => trs.map((tr) => [...tr.querySelectorAll('th, td')].slice(0, 3).map((c) => Number(c.textContent))));
  const population = e.run.snapshot(g).state.population;
  expect(rows.map((r) => r[0])).toEqual(population.map((i) => i.id));
  rows.forEach((r, k) => {
    const point = e.problem.pointOf(population[k]!.chromosome);
    expect(r[1]).toBeCloseTo(point.x, 2);
    expect(r[2]).toBeCloseTo(point.y, 2);
  });
};
const children = (page: Page) =>
  page.getByTestId('heat-marks').evaluate((svg) => [...svg.querySelectorAll('[data-marker="child"]')].map((g) => [Number(g.getAttribute('data-offspring')), Number(g.getAttribute('data-x')), Number(g.getAttribute('data-y'))] as const));

test('the fifth classroom scenario: share a configured landscape run, open it in a fresh page, switch the representation, load a preset, open the Landscape view, step to the end of crossover and of mutation with the stage marks on, select an individual, scrub back, change a parameter, confirm and continue', async ({ page, context }) => {
  mkdirSync(shots, { recursive: true });
  await page.setViewportSize({ width: 1920, height: 1080 });

  // 1. configure a landscape run: Himmelblau, σ = 0.08, two elites
  await page.goto(url);
  await page.getByRole('button', { name: 'Projector mode' }).click();
  await page.getByTestId('problem-button').click();
  await page.getByRole('menuitemradio', { name: /Landscape/ }).click();
  await page.getByRole('button', { name: 'Restart and apply' }).click();
  await page.getByRole('button', { name: /Parameters/ }).click();
  await page.locator('#function').selectOption('himmelblau');
  await page.getByTestId('apply-reset').click();
  await page.getByRole('button', { name: 'Restart and apply' }).click();
  await page.locator('#mutation-sigma').fill('0.08');
  await page.locator('#mutation-sigma').press('Enter');
  await page.locator('#elites').fill('2');
  await page.locator('#elites').press('Enter');
  await page.getByTestId('copy-link').click();
  await expect(page.getByTestId('share-status')).toBeVisible();
  const link = await page.evaluate(() => navigator.clipboard.readText());

  // 2. the link, opened in a fresh page, gives the same run as the engine's
  const defaults = defaultsOf(entry, himmelblau);
  const linkParams: GaParams = { ...defaults.params, mutation: { ...defaults.params.mutation, sigma: 0.08 } as GaParams['mutation'], elites: 2 };
  const init = { kind: 'random' as const, size: 12 };
  const first = engineOf(himmelblau, linkParams, defaults.seed, init);
  const fresh = await context.newPage();
  await fresh.setViewportSize({ width: 1920, height: 1080 });
  await fresh.goto(link);
  await expect(fresh.getByTestId('link-notice')).toHaveCount(0);
  await expect(fresh.locator('#brand .s')).toHaveText('Himmelblau · minimise f · optimum f = 0 (4 places)');
  await expectSummary(fresh, first.summary(0));
  await fresh.keyboard.press('g');
  first.run.forwardCycle();
  await fresh.keyboard.press('g');
  first.run.forwardCycle();
  await expectSummary(fresh, first.summary(2));
  await fresh.screenshot({ path: `${shots}/classroom-1-link-himmelblau.png` });
  await page.close();

  // 3. through the drawer, Gray code: operators reset to the bit defaults, the same seed and the other settings kept, and it is the engine's run
  await fresh.getByRole('button', { name: /Parameters/ }).click();
  await fresh.locator('#representation').selectOption('gray');
  await fresh.getByTestId('apply-reset').click();
  await expect(fresh.getByTestId('reset-notice')).toContainText('Reset to the new representation’s defaults');
  await fresh.getByRole('button', { name: 'Restart and apply' }).click();
  await fresh.keyboard.press('Escape');
  await expect(fresh.getByTestId('problem-chip')).toHaveText('Gray-coded · 10 bits');
  const grayOptions: LandscapeOptions = { ...himmelblau, representation: 'gray' };
  const grayDefaults = landscapeDefaults(grayOptions).params;
  const gray = engineOf(grayOptions, { ...linkParams, crossover: grayDefaults.crossover, mutation: grayDefaults.mutation }, defaults.seed, init);
  await expectSummary(fresh, gray.summary(0));
  await fresh.keyboard.press('g');
  gray.run.forwardCycle();
  await expectSummary(fresh, gray.summary(1));
  await fresh.screenshot({ path: `${shots}/classroom-2-gray.png` });

  // 4. a preset of this problem, with its description: Himmelblau, four optima, seed 42 (real-valued again)
  await fresh.getByRole('button', { name: /Parameters/ }).click();
  await expect(fresh.locator('#preset option')).toHaveCount(12);
  await fresh.locator('#preset').selectOption({ label: 'Himmelblau: four optima' });
  await expect(fresh.getByTestId('preset-lesson')).toContainText('four equally good minima');
  await fresh.getByTestId('load-preset').click();
  await fresh.getByRole('button', { name: 'Restart and apply' }).click();
  await fresh.keyboard.press('Escape');
  await expect(fresh.locator('#brand')).toContainText('preset: Himmelblau: four optima');
  await expect(fresh.getByTestId('seed')).toHaveText(String(presetFile.seed));
  await expect(fresh.getByTestId('problem-chip')).toHaveText('real-valued');
  const original = engineOf(presetFile.options, presetFile.params, presetFile.seed, presetFile.setup.init);
  await expectSummary(fresh, original.summary(0));

  // 5. the Landscape view, with trails; into the first generation, to the end of crossover and to the end of mutation with the stage marks on
  await fresh.getByTestId('show-landscape').click();
  await expect(fresh.getByTestId('heat-marks')).toBeVisible();
  await fresh.getByTestId('trail-3').click();
  await fresh.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await expectPositions(fresh, original, 0);
  original.run.forwardCycle();
  const events = original.run.events(1);
  const crossover = events.flatMap((e) => (e.stage === 'crossover' ? [e] : []));
  const mutation = events.flatMap((e) => (e.stage === 'mutation' ? [e] : []));
  await fresh.keyboard.press('ArrowRight');
  for (let k = 0; k < 3; k++) await fresh.keyboard.press('Shift+ArrowRight');
  const made = crossover.flatMap((e) => e.children.filter((c) => !c.discarded).map((c) => [c.offspring, c.chromosome[0], c.chromosome[1]] as const));
  expect(made.length).toBeGreaterThan(0);
  expect(await children(fresh)).toEqual(made);
  await fresh.screenshot({ path: `${shots}/classroom-3-landscape-crossover.png` });
  await fresh.keyboard.press('Shift+ArrowRight');
  const mutated = mutation.map((e) => [e.offspring, e.after[0], e.after[1]] as const);
  expect(mutated.length).toBe(12 - presetFile.params.elites);
  expect(await children(fresh)).toEqual(mutated);
  await fresh.screenshot({ path: `${shots}/classroom-4-landscape-mutation.png` });

  // 6. select an individual: the same one on both views and in the table, then finish the generation and two more
  const firstId = await fresh.locator('[data-testid="heat-marks"] [data-marker="individual"]').first().getAttribute('data-id');
  await fresh.getByTestId(`select-${firstId}`).click();
  await expect(fresh.locator('[data-testid="heat-marks"] [data-selected="true"]')).toHaveCount(1);
  await expect(fresh.locator('[data-testid="surface-marks"] [data-selected="true"]')).toHaveCount(firstId ? (await fresh.locator('[data-testid="surface-marks"] [data-marker="individual"][data-id="' + firstId + '"]').count()) : 0);
  await expect(fresh.locator('tr.sel')).toHaveCount(1);
  await fresh.keyboard.press('Shift+ArrowRight');
  await fresh.keyboard.press('Shift+ArrowRight');
  await expect(heading(fresh)).toHaveText('Population · generation 1');
  for (let g = 0; g < 2; g++) await fresh.keyboard.press('g');
  await expect(heading(fresh)).toHaveText('Population · generation 3');
  for (let g = 0; g < 2; g++) original.run.forwardCycle();
  await expectSummary(fresh, original.summary(3));
  await expectPositions(fresh, original, 3);
  await fresh.screenshot({ path: `${shots}/classroom-5-generation-3.png` });

  // 7. scrub back to generation 1: the screen shows what it showed then
  const scrub = fresh.getByTestId('scrub');
  await scrub.focus();
  await fresh.keyboard.press('PageUp');
  await fresh.keyboard.press('PageUp');
  await expect(scrub).toHaveAttribute('data-cycle', '1');
  await expect(heading(fresh)).toHaveText('Population · generation 1');
  await expectSummary(fresh, original.summary(1));
  await expectPositions(fresh, original, 1);

  // 8. raise the mutation rate: the notice names what would go; confirming applies it from here
  await fresh.getByRole('button', { name: /Parameters/ }).click();
  await fresh.locator('#mutation-probability').fill('0.3');
  await fresh.locator('#mutation-probability').press('Enter');
  await expect(fresh.getByTestId('discard-notice')).toHaveText('Generations 2–3 will be discarded. The run continues from generation 1 with the new settings.');
  await fresh.screenshot({ path: `${shots}/classroom-6-notice.png` });
  await fresh.getByRole('button', { name: 'Discard and apply' }).click();
  await fresh.keyboard.press('Escape');
  await expect(fresh.getByText('recorded gens 0–1')).toBeVisible();

  // 9. continue: the later generations are the engine's with the same seed and the same change at the same point
  await fresh.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  for (let g = 0; g < 2; g++) await fresh.keyboard.press('g');
  await expect(heading(fresh)).toHaveText('Population · generation 3');
  const changed = engineOf(presetFile.options, presetFile.params, presetFile.seed, presetFile.setup.init);
  changed.run.forwardCycle();
  changed.run.setParameters({ ...presetFile.params, mutation: { ...presetFile.params.mutation, probability: 0.3 } });
  for (let g = 0; g < 2; g++) changed.run.forwardCycle();
  await expectSummary(fresh, changed.summary(3));
  await expectPositions(fresh, changed, 3);
  expect(changed.summary(3)).not.toBe(original.summary(3));
  await fresh.screenshot({ path: `${shots}/classroom-7-after-change.png` });

  // the same at the smaller laptop size
  await fresh.setViewportSize({ width: 1366, height: 768 });
  await fresh.screenshot({ path: `${shots}/classroom-8-1366x768.png` });
  expect(await fresh.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
});
