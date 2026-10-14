import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { edgeKey, formatTour, gaAlgorithm, metricsOfProblem, tourEdgeSet, tspProblem, type CrossoverEvent, type GaParams, type GaSetup, type MutationEvent, type TspOptions } from '../src/engine';
import { createRun } from '../src/run';
import { defaultsOf, entryOf } from '../src/ui/problems';
import { tourInfoOf, tourStatsLines } from '../src/ui/tour-cells';

const url = pathToFileURL(resolve('dist/index.html')).href;
// the screenshots of this scenario are written only with SHOTS=1, so an ordinary run leaves the files alone
const shots = resolve('.scratch/milestone-6-tsp/screenshots');
const shoot = async (page: Page, name: string) => {
  if (process.env.SHOTS !== '1') return;
  mkdirSync(shots, { recursive: true });
  await page.screenshot({ path: `${shots}/${name}.png` });
};
test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

const entry = entryOf('tsp')!;
const ulysses: TspOptions = { instance: 'ulysses16', n: 10, seed: 1 };
const berlin: TspOptions = { instance: 'berlin52', n: 10, seed: 1 };
const presetFile = JSON.parse(readFileSync(resolve('src/ui/presets/v-tsp-berlin52-cx.json'), 'utf8')) as { seed: number; options: TspOptions; setup: { init: GaSetup['init'] }; params: GaParams };

const heading = (page: Page) => page.locator('#pop-heading');
const engineOf = (options: TspOptions, params: GaParams, seed: number, init: GaSetup['init']) => {
  const problem = tspProblem(options);
  const run = createRun(gaAlgorithm, { setup: { problem, init }, params, seed }, { eventCacheSize: 0 });
  const info = tourInfoOf(problem);
  return { run, problem, summary: (g: number) => tourStatsLines(info, metricsOfProblem(run.snapshot(g).state, problem)).join('') };
};
const summary = async (page: Page) => (await page.getByTestId('summary').innerText()).replace(/\s*\n\s*/g, '');
const rows = (page: Page) => page.getByRole('table', { name: /^(Population|Parents) · generation \d+$/ }).locator('tbody tr [data-bits]').evaluateAll((els) => els.map((el) => el.getAttribute('data-bits')!));
const expectPopulation = async (page: Page, e: ReturnType<typeof engineOf>, g: number) => expect(await rows(page)).toEqual(e.run.snapshot(g).state.population.map((i) => formatTour(i.chromosome)));
const key1 = (a: number, b: number) => `${Math.min(a, b) + 1}-${Math.max(a, b) + 1}`;
const keysOf = (tour: readonly number[]) => [...tourEdgeSet(tour)].map((k) => k.split('-').map(Number)).map(([a, b]) => key1(a!, b!)).sort();
const layerKeys = async (page: Page, layer: string) => (await page.locator(`svg[data-testid="route-map"] line[data-layer="${layer}"]`).evaluateAll((els) => els.map((e) => e.getAttribute('data-edge')!))).sort();

test('the sixth classroom scenario: share a configured TSP run, open it in a fresh page, switch the instance through the drawer, load a preset, open the Route map, step to the end of crossover and of mutation with the stage marks on, select an individual, scrub back, change a parameter, confirm the notice and continue', async ({ page, context }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });

  // 1. configure a TSP run: ulysses16 with tournaments of 4 and three elites
  await page.goto(url);
  await page.getByRole('button', { name: 'Projector mode' }).click();
  await page.getByTestId('problem-button').click();
  await page.getByRole('menuitemradio', { name: 'TSP' }).click();
  await page.getByRole('button', { name: 'Restart and apply' }).click();
  await page.getByRole('button', { name: /Parameters/ }).click();
  await page.locator('#elites').fill('3');
  await page.locator('#elites').press('Enter');
  await page.locator('#tournamentSize').fill('4');
  await page.locator('#tournamentSize').press('Enter');
  await page.getByTestId('copy-link').click();
  await expect(page.getByTestId('share-status')).toBeVisible();
  const link = await page.evaluate(() => navigator.clipboard.readText());

  // 2. the link, opened in a fresh page, gives the same run as the engine's
  const defaults = defaultsOf(entry, ulysses);
  const linkParams: GaParams = { ...defaults.params, selection: { method: 'tournament', size: 4 }, elites: 3 };
  const first = engineOf(ulysses, linkParams, defaults.seed, defaults.init);
  const fresh = await context.newPage();
  await fresh.setViewportSize({ width: 1920, height: 1080 });
  await fresh.goto(link);
  await expect(fresh.getByTestId('link-notice')).toHaveCount(0);
  await expect(fresh.locator('#brand .s')).toHaveText('16 cities · optimum 6,859');
  expect(await summary(fresh)).toBe(first.summary(0));
  await expectPopulation(fresh, first, 0);
  for (let g = 0; g < 2; g++) {
    await fresh.keyboard.press('g');
    first.run.forwardCycle();
  }
  expect(await summary(fresh)).toBe(first.summary(2));
  await expectPopulation(fresh, first, 2);
  await shoot(fresh, 'classroom-1-link-ulysses16');
  await page.close();

  // 3. through the drawer, another instance: berlin52; the same seed and the other settings kept, and it is the engine's run
  await fresh.getByRole('button', { name: /Parameters/ }).click();
  await fresh.locator('#instance').selectOption('berlin52');
  await fresh.getByTestId('apply-reset').click();
  await expect(fresh.getByTestId('reset-notice')).toContainText('Changing the instance restarts the run from generation 0');
  await fresh.getByRole('button', { name: 'Restart and apply' }).click();
  await fresh.keyboard.press('Escape');
  await expect(fresh.getByTestId('problem-chip')).toHaveText('berlin52');
  await expect(fresh.locator('#brand .s')).toHaveText('52 cities · optimum 7,542');
  const berlinParams: GaParams = { ...linkParams };
  const second = engineOf(berlin, berlinParams, defaults.seed, defaults.init);
  expect(await summary(fresh)).toBe(second.summary(0));
  await fresh.keyboard.press('g');
  second.run.forwardCycle();
  expect(await summary(fresh)).toBe(second.summary(1));
  await expectPopulation(fresh, second, 1);
  await shoot(fresh, 'classroom-2-berlin52');

  // 4. a preset of this problem, with its description: cycle crossover instead of order crossover, seed 15
  await fresh.getByRole('button', { name: /Parameters/ }).click();
  await expect(fresh.locator('#preset option')).toHaveCount(9);
  await fresh.locator('#preset').selectOption({ label: 'Cycle crossover instead of order crossover' });
  await expect(fresh.getByTestId('preset-lesson')).toContainText('clearly slower than order crossover');
  await fresh.getByTestId('load-preset').click();
  await fresh.getByRole('button', { name: 'Restart and apply' }).click();
  await fresh.keyboard.press('Escape');
  await expect(fresh.locator('#brand')).toContainText('preset: Cycle crossover instead of order crossover');
  await expect(fresh.getByTestId('seed')).toHaveText(String(presetFile.seed));
  const original = engineOf(presetFile.options, presetFile.params, presetFile.seed, presetFile.setup.init);
  expect(await summary(fresh)).toBe(original.summary(0));
  await expectPopulation(fresh, original, 0);

  // 5. the Route map; into the first generation, to the end of crossover and to the end of mutation with the stage marks on
  await fresh.getByTestId('show-map').click();
  await expect(fresh.getByTestId('route-map-view')).toBeVisible();
  await fresh.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  original.run.forwardCycle();
  const events = original.run.events(1);
  const crossovers = events.filter((e): e is CrossoverEvent => e.stage === 'crossover');
  const mutations = events.filter((e): e is MutationEvent => e.stage === 'mutation');
  await fresh.keyboard.press('ArrowRight');
  for (let k = 0; k < 3; k++) await fresh.keyboard.press('Shift+ArrowRight');
  const lastPair = crossovers.at(-1)!;
  expect(await layerKeys(fresh, 'child')).toEqual(keysOf(lastPair.children[0]!.chromosome));
  const parents = original.run.snapshot(0).state.population;
  const inA = tourEdgeSet(parents.find((i) => i.id === lastPair.parentAId)!.chromosome);
  const inB = tourEdgeSet(parents.find((i) => i.id === lastPair.parentBId)!.chromosome);
  const origins = await fresh.locator('svg[data-testid="route-map"] g.re-child line').evaluateAll((els) => els.map((e) => [e.getAttribute('data-edge')!, e.getAttribute('data-origin')!]));
  for (const [k, origin] of origins) {
    const zero = k!.split('-').map((c) => Number(c) - 1) as [number, number];
    const ek = edgeKey(zero[0], zero[1]);
    expect(origin).toBe(inA.has(ek) && inB.has(ek) ? 'shared' : inA.has(ek) ? 'fromA' : inB.has(ek) ? 'fromB' : 'new');
  }
  await expect(fresh.getByTestId('route-mark')).toContainText(`Pair ${lastPair.pair}: O${lastPair.children[0]!.offspring}’s edges by origin`);
  await shoot(fresh, 'classroom-3-map-crossover');
  await fresh.keyboard.press('Shift+ArrowRight');
  const lastMutation = mutations.at(-1)!;
  const added = new Set((lastMutation.edges?.added ?? []).map((e) => key1(e[0], e[1])));
  expect(await layerKeys(fresh, 'removed')).toEqual((lastMutation.edges?.removed ?? []).map((e) => key1(e[0], e[1])).sort());
  expect(await layerKeys(fresh, 'added')).toEqual([...added].sort());
  expect(await layerKeys(fresh, 'unchanged')).toEqual(keysOf(lastMutation.after).filter((k) => !added.has(k)));
  await expect(fresh.getByTestId('route-mark')).toContainText(`Offspring ${lastMutation.offspring}:`);
  await shoot(fresh, 'classroom-4-map-mutation');

  // 6. select an individual from the map: the same one in the table and in the hidden table of the map, then finish the generation and two more
  await fresh.getByTestId('map-select').selectOption({ index: 4 });
  const picked = await fresh.getByTestId('map-select').inputValue();
  await expect(fresh.locator('tr.sel')).toHaveAttribute('data-id', picked);
  await expect(fresh.getByTestId('route-tours').locator('tbody tr', { hasText: 'selected individual' }).locator('td').first()).toHaveText(picked);
  await fresh.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await fresh.keyboard.press('Shift+ArrowRight');
  await fresh.keyboard.press('Shift+ArrowRight');
  await expect(heading(fresh)).toHaveText('Population · generation 1');
  for (let g = 0; g < 2; g++) await fresh.keyboard.press('g');
  await expect(heading(fresh)).toHaveText('Population · generation 3');
  for (let g = 0; g < 2; g++) original.run.forwardCycle();
  expect(await summary(fresh)).toBe(original.summary(3));
  await expectPopulation(fresh, original, 3);
  await shoot(fresh, 'classroom-5-generation-3');

  // 7. scrub back to generation 1: the screen shows what it showed then
  const scrub = fresh.getByTestId('scrub');
  await scrub.focus();
  await fresh.keyboard.press('PageUp');
  await fresh.keyboard.press('PageUp');
  await expect(scrub).toHaveAttribute('data-cycle', '1');
  await expect(heading(fresh)).toHaveText('Population · generation 1');
  expect(await summary(fresh)).toBe(original.summary(1));
  await expectPopulation(fresh, original, 1);

  // 8. raise the mutation rate: the notice names what would go; confirming applies it from here
  await fresh.getByRole('button', { name: /Parameters/ }).click();
  await fresh.locator('#mutation-probability').fill('0.7');
  await fresh.locator('#mutation-probability').press('Enter');
  await expect(fresh.getByTestId('discard-notice')).toHaveText('Generations 2–3 will be discarded. The run continues from generation 1 with the new settings.');
  await shoot(fresh, 'classroom-6-notice');
  await fresh.getByRole('button', { name: 'Discard and apply' }).click();
  await fresh.keyboard.press('Escape');
  await expect(fresh.getByText('recorded gens 0–1')).toBeVisible();

  // 9. continue: the later generations are the engine's with the same seed and the same change at the same point
  await fresh.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  for (let g = 0; g < 2; g++) await fresh.keyboard.press('g');
  await expect(heading(fresh)).toHaveText('Population · generation 3');
  const changed = engineOf(presetFile.options, presetFile.params, presetFile.seed, presetFile.setup.init);
  changed.run.forwardCycle();
  changed.run.setParameters({ ...presetFile.params, mutation: { ...presetFile.params.mutation, probability: 0.7 } });
  for (let g = 0; g < 2; g++) changed.run.forwardCycle();
  expect(await summary(fresh)).toBe(changed.summary(3));
  await expectPopulation(fresh, changed, 3);
  expect(changed.summary(3)).not.toBe(original.summary(3));
  await expect(fresh.getByTestId('route-map-view')).toBeVisible();
  await shoot(fresh, 'classroom-7-after-change');

  // the same at the smaller laptop size
  await fresh.setViewportSize({ width: 1366, height: 768 });
  await shoot(fresh, 'classroom-8-1366x768');
  expect(await fresh.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  expect(await fresh.evaluate(() => document.documentElement.scrollHeight - window.innerHeight)).toBeLessThanOrEqual(0);
});
