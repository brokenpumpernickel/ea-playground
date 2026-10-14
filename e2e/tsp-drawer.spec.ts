import { expect, test, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { gaAlgorithm, metricsOfProblem, type TspOptions } from '../src/engine';
import { createRun } from '../src/run';
import { defaultsOf, entryOf } from '../src/ui/problems';
import { configOf, encodeConfig } from '../src/ui/run-config';

const url = pathToFileURL(resolve('dist/index.html')).href;
const entry = entryOf('tsp')!;
const base = entry.defaultOptions() as TspOptions;

const errorsOf = (page: Page) => {
  const found: string[] = [];
  page.on('pageerror', (e) => found.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && found.push(m.text()));
  return found;
};

/** The engine's best-now and best-so-far length at generation g for these options and the problem's defaults. */
const engineRun = (options: TspOptions, g: number, seed = 42) => {
  const d = defaultsOf(entry, options);
  const problem = entry.create(options);
  const run = createRun(gaAlgorithm, { setup: { problem, init: d.init }, params: d.params, seed });
  for (let k = 0; k < g; k++) run.forwardCycle();
  return { problem, metrics: metricsOfProblem(run.snapshot(g).state, problem), population: run.snapshot(g).state.population };
};

const open = async (page: Page, options: TspOptions = base, seed = 42) => {
  const d = defaultsOf(entry, options);
  await page.goto('about:blank');
  await page.goto(url + encodeConfig(configOf({ problem: entry.create(options), init: d.init }, d.params, seed, 'tsp', options)));
  await expect(page.getByTestId('problem-button')).toHaveText(/TSP/);
};
const openDrawer = (page: Page) => page.getByRole('button', { name: /Parameters/ }).click();
const unnamed = async (page: Page) => {
  const tree = await page.locator('body').ariaSnapshot();
  return tree.split('\n').filter((line) => /^\s*- (button|textbox|combobox|slider|checkbox|switch|spinbutton|radio|menuitemradio|menuitem)(\s+\[[^\]]*\])*:?\s*$/.test(line));
};
const summary = async (page: Page) => (await page.getByTestId('summary').innerText()).split('\n')[0]!.trim();

test('the problem menu lists the TSP as the sixth problem; choosing it restarts with its own defaults through the restart notice', async ({ page }) => {
  const errors = errorsOf(page);
  await page.goto(url);
  await page.getByTestId('problem-button').click();
  await expect(page.getByRole('menuitemradio')).toHaveText([/Goldberg x²/, /Target string/, /Knapsack/, /Trap/, /Landscape/, /TSP/]);
  await page.getByRole('menuitemradio', { name: 'TSP' }).click();
  await expect(page.getByTestId('reset-notice')).toHaveText('Switching to the problem TSP restarts the run from generation 0. Nothing recorded will be lost.');
  await page.getByRole('button', { name: 'Restart and apply' }).click();
  await expect(page.getByTestId('problem-button')).toHaveText(/TSP/);
  await expect(page.locator('#brand .s')).toHaveText('16 cities · optimum 6,859');
  await expect(page.getByTestId('problem-chip')).toHaveText('ulysses16');
  await expect(page.locator('#brand .logo')).toHaveText('Ts');
  await page.keyboard.press('g');
  expect(await summary(page)).toMatch(/best now/);
  expect(errors).toEqual([]);
});

test('the run setup has the instance and, for the two sized ones, the number of cities and the instance seed; the other problems have none of it', async ({ page }) => {
  await open(page);
  await openDrawer(page);
  await expect(page.locator('#instance')).toHaveValue('ulysses16');
  await expect(page.locator('#cities')).toHaveCount(0);
  await expect(page.locator('#city-seed')).toHaveCount(0);
  await expect(page.locator('#instance-help')).toContainText('16 cities; distance rule GEO');
  await expect(page.locator('#instance-help')).toContainText('Optimum 6,859 (published');
  await page.locator('#instance').selectOption('circle');
  await expect(page.locator('#cities')).toHaveValue('10');
  await expect(page.locator('#cities-help')).toContainText('5 to 15');
  await expect(page.locator('#city-seed')).toHaveCount(0);
  await page.locator('#instance').selectOption('random');
  await expect(page.locator('#city-seed')).toHaveValue('1');
  await page.locator('#instance').selectOption('berlin52');
  await expect(page.locator('#instance-help')).toContainText('A plain GA ends far from the optimum');
  await expect(page.locator('#cities')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.getByTestId('problem-button').click();
  await page.getByRole('menuitemradio', { name: /Goldberg/ }).click();
  await page.getByRole('button', { name: 'Restart and apply' }).click();
  await openDrawer(page);
  for (const id of ['#instance', '#cities', '#city-seed', '#mutation-operator']) await expect(page.locator(id)).toHaveCount(0);
  await expect(page.locator('#mutation-mode')).toHaveCount(1);
});

test('only the operators that keep a tour a tour are offered, and the mutation has a type instead of a mode', async ({ page }) => {
  await open(page);
  await openDrawer(page);
  await expect(page.locator('#crossover-type option')).toHaveText(['Order crossover (OX)', 'Partial-mapped (PMX)', 'Cycle (CX)']);
  await expect(page.locator('#crossover-type')).toHaveValue('ox');
  await expect(page.locator('#mutation-operator option')).toHaveText(['Swap', 'Inversion (2-opt move)', 'Insertion']);
  await expect(page.locator('#mutation-operator')).toHaveValue('inversion');
  await expect(page.locator('#mutation-mode')).toHaveCount(0);
  await expect(page.locator('#mutation-probability-help')).toContainText('Applies per individual, not per city');
  await expect(page.locator('#stop-epsilon')).toHaveValue('0.5');
  await expect(page.locator('#stop-target')).toHaveCount(0);
});

test('changing the instance through the drawer restarts under the new instance and the run is the engine’s', async ({ page }) => {
  await open(page);
  await openDrawer(page);
  await page.locator('#instance').selectOption('berlin52');
  await expect(page.getByText('Changed: Instance.')).toBeVisible();
  await page.getByTestId('apply-reset').click();
  await expect(page.getByTestId('reset-notice')).toContainText('Changing the instance restarts the run from generation 0. Nothing recorded will be lost.');
  await page.getByRole('button', { name: 'Restart and apply' }).click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#brand .s')).toHaveText('52 cities · optimum 7,542');
  await expect(page.getByTestId('problem-chip')).toHaveText('berlin52');
  const options: TspOptions = { ...base, instance: 'berlin52' };
  const e = engineRun(options, 0);
  expect((await summary(page)).length).toBeGreaterThan(0);
  expect(e.population).toHaveLength(20);
  expect(e.population[0]!.chromosome).toHaveLength(52);
});

test('moving from a whole-number rule to the circle moves ε to its default, and the notice says so', async ({ page }) => {
  await open(page);
  await openDrawer(page);
  await page.locator('#instance').selectOption('circle');
  await expect(page.locator('#stop-epsilon')).toHaveValue('0.000001');
  await expect(page.locator('[data-section="setup"] .applyreset .help')).toContainText('ε reset to the new instance’s default (0.5 → 0.000001).');
});

test('the operators wait for the next generation; a bad entry is marked', async ({ page }) => {
  await open(page);
  await openDrawer(page);
  await page.locator('#crossover-type').selectOption('pmx');
  await expect(page.getByTestId('pending-crossover-type')).toBeVisible();
  await page.locator('#mutation-operator').selectOption('swap');
  await expect(page.getByTestId('pending-mutation-operator')).toBeVisible();
  await expect(page.getByTestId('apply-reset')).toBeDisabled(); // nothing here needs a restart
  await page.locator('#instance').selectOption('circle');
  await page.locator('#cities').fill('3');
  await page.locator('#cities').blur();
  await expect(page.locator('#cities-error')).toHaveText('The number of cities must be a whole number from 5 to 15 (it is 3).');
  await expect(page.locator('#cities')).toHaveAttribute('aria-invalid', 'true');
});

test('a hand-edited population is typed as tours and read in words', async ({ page }) => {
  await open(page, { instance: 'circle', n: 6, seed: 1 });
  await openDrawer(page);
  await page.locator('#init').selectOption('explicit');
  await page.locator('#chromosomes').fill('1 2 3 4 5 6\n1 2 2 4 5 6');
  await expect(page.locator('#chromosomes-error')).toContainText('Chromosome 2: city 2 appears twice; city 3 is missing.');
  await page.locator('#chromosomes').fill('1 2 3 4 5 6\n4,3,2,1,6,5\n1 3 2 4 5 6');
  await expect(page.locator('#chromosomes-error')).toHaveCount(0);
  await page.getByTestId('apply-reset').click();
  await page.getByRole('button', { name: 'Restart and apply' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('distinct')).toHaveText('2 of 3 distinct routes'); // the second line is the first tour read backwards from city 4
});

test('a share link opens every instance as the same run, and opens at the instance it names', async ({ page }) => {
  const errors = errorsOf(page);
  for (const options of [
    { instance: 'burma14', n: 10, seed: 1 },
    { instance: 'circle', n: 7, seed: 1 },
    { instance: 'random', n: 9, seed: 5 },
    { instance: 'berlin52', n: 10, seed: 1 },
  ] as const) {
    await open(page, options);
    await expect(page.getByTestId('problem-chip')).toHaveText(options.instance === 'random' ? 'Random · seed 5' : options.instance === 'circle' ? 'Circle' : options.instance);
    await page.keyboard.press('g');
    await page.keyboard.press('g');
    expect(await summary(page)).toMatch(/best now/);
  }
  expect(errors).toEqual([]);
});

test('a link whose operator is not for permutations is refused in words and nothing is used', async ({ page }) => {
  const d = defaultsOf(entry, base);
  const config = configOf({ problem: entry.create(base), init: d.init }, { ...d.params, crossover: { enabled: true, operator: 'one-point', probability: 0.8 } }, 42, 'tsp', base);
  await page.goto('about:blank');
  await page.goto(url + encodeConfig(config));
  await expect(page.getByRole('alert').or(page.getByTestId('link-notice'))).toContainText('One-point crossover would repeat and lose cities; choose order, partial-mapped or cycle crossover for this problem.');
  await expect(page.getByTestId('problem-button')).toHaveText(/Goldberg/);
});

test('with the drawer open every control has a name, for each kind of instance', async ({ page }) => {
  for (const options of [base, { instance: 'circle', n: 8, seed: 1 }, { instance: 'random', n: 8, seed: 3 }] as const) {
    await open(page, options);
    await openDrawer(page);
    expect(await unnamed(page)).toEqual([]);
    await page.keyboard.press('Escape');
  }
});
