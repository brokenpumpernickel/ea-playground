import { expect, test, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { gaAlgorithm, metricsOfProblem, type LandscapeOptions } from '../src/engine';
import { createRun } from '../src/run';
import { defaultsOf, entryOf } from '../src/ui/problems';
import { configOf, encodeConfig } from '../src/ui/run-config';
import { statsLines } from '../src/ui/spread-model';

const url = pathToFileURL(resolve('dist/index.html')).href;
const entry = entryOf('landscape')!;
const base = entry.defaultOptions() as LandscapeOptions;

const errorsOf = (page: Page) => {
  const found: string[] = [];
  page.on('pageerror', (e) => found.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && found.push(m.text()));
  return found;
};

/** The engine's run for these options and parameters: the best fitness now and so far at generation g, as the summary line says them. */
const summaryAt = (options: LandscapeOptions, g: number, seed = 42, edit: (d: ReturnType<typeof defaultsOf>) => ReturnType<typeof defaultsOf> = (d) => d) => {
  const d = edit(defaultsOf(entry, options));
  const problem = entry.create(options);
  const run = createRun(gaAlgorithm, { setup: { problem, init: d.init }, params: d.params, seed });
  for (let k = 0; k < g; k++) run.forwardCycle();
  const m = metricsOfProblem(run.snapshot(g).state, problem);
  return statsLines(m)[0];
};
const summary = async (page: Page) => (await page.getByTestId('summary').innerText()).split('\n')[0]!.trim();
/**
 * The page's summary line is the engine's: the same text, and numbers equal to the three decimals the line shows. A browser's Math.log and
 * Math.cos (used by the Gaussian step) can differ from Node's in the last bits, which moves a fitness by about 1e-15.
 */
const numberPattern = /-?\d+(\.\d+)?(e-?\d+)?/g;
const expectSummary = async (page: Page, expected: string) => {
  const got = await summary(page);
  expect(got.replace(numberPattern, '#')).toBe(expected.replace(numberPattern, '#'));
  const want = expected.match(numberPattern)!.map(Number);
  got.match(numberPattern)!.map(Number).forEach((value, k) => expect(value).toBeCloseTo(want[k]!, 2));
};

const open = async (page: Page, options: LandscapeOptions = base, edit: (d: ReturnType<typeof defaultsOf>) => ReturnType<typeof defaultsOf> = (d) => d) => {
  const d = edit(defaultsOf(entry, options));
  await page.goto('about:blank');
  await page.goto(url + encodeConfig(configOf({ problem: entry.create(options), init: d.init }, d.params, 42, 'landscape', options)));
  await expect(page.getByTestId('problem-button')).toHaveText(/Landscape/);
};
const openDrawer = (page: Page) => page.getByRole('button', { name: /Parameters/ }).click();
const unnamed = async (page: Page) => {
  const tree = await page.locator('body').ariaSnapshot();
  return tree.split('\n').filter((line) => /^\s*- (button|textbox|combobox|slider|checkbox|switch|spinbutton|radio|menuitemradio|menuitem)(\s+\[[^\]]*\])*:?\s*$/.test(line));
};

test('the problem menu lists the landscape as the fifth problem; choosing it restarts with its own defaults through the restart notice', async ({ page }) => {
  const errors = errorsOf(page);
  await page.goto(url);
  await page.getByTestId('problem-button').click();
  await expect(page.getByRole('menuitemradio')).toHaveText([/Goldberg x²/, /Target string/, /Knapsack/, /Trap/, /Landscape/]);
  await page.getByRole('menuitemradio', { name: 'Landscape' }).click();
  await expect(page.getByTestId('reset-notice')).toHaveText('Switching to the problem Landscape restarts the run from generation 0. Nothing recorded will be lost.');
  await page.getByRole('button', { name: 'Restart and apply' }).click();
  await expect(page.getByTestId('problem-button')).toHaveText(/Landscape/);
  await expect(page.locator('#brand .s')).toHaveText('Single peak · maximise f · optimum 1');
  await expect(page.getByTestId('problem-chip')).toHaveText('real-valued');
  await expect(page.locator('#brand .logo')).toHaveText('Ls');
  await page.keyboard.press('g');
  await expectSummary(page, summaryAt(base, 1));
  expect(errors).toEqual([]);
});

test('the run setup has the function, the representation and, for the binary-coded ones, the bits per variable; the other problems have none of it', async ({ page }) => {
  await open(page);
  await openDrawer(page);
  await expect(page.locator('#function')).toHaveValue('single-peak');
  await expect(page.locator('#representation')).toHaveValue('real');
  await expect(page.locator('#bits')).toHaveCount(0);
  await expect(page.locator('#function-help')).toContainText('exp(−((x − 2)² + (y + 1)²) / 8). Higher f is better, so fitness = f.');
  await page.locator('#function').selectOption('himmelblau');
  await expect(page.locator('#function-help')).toContainText('f is to be made small, so fitness = −f');
  await page.locator('#representation').selectOption('plain');
  await expect(page.locator('#bits')).toHaveValue('10');
  await expect(page.locator('#bits-help')).toContainText('2 × n bits');
  await page.keyboard.press('Escape');
  await page.getByTestId('problem-button').click();
  await page.getByRole('menuitemradio', { name: /Goldberg/ }).click();
  await page.getByRole('button', { name: 'Restart and apply' }).click();
  await openDrawer(page);
  for (const id of ['#function', '#representation', '#bits', '#crossover-alpha', '#mutation-sigma', '#stop-epsilon']) await expect(page.locator(id)).toHaveCount(0);
  await expect(page.locator('#stop-target')).toHaveCount(1);
});

test('each option changed through the drawer restarts under the new landscape and the run is the engine’s', async ({ page }) => {
  await open(page);
  await openDrawer(page);
  await page.locator('#function').selectOption('rastrigin');
  await expect(page.getByText('Changed: Function.')).toBeVisible();
  await page.getByTestId('apply-reset').click();
  await expect(page.getByTestId('reset-notice')).toHaveText('Changing the function restarts the run from generation 0. Nothing recorded will be lost.');
  await page.getByRole('button', { name: 'Restart and apply' }).click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#brand .s')).toHaveText('Rastrigin · minimise f · optimum f = 0');
  const options: LandscapeOptions = { ...base, function: 'rastrigin' };
  await expectSummary(page, summaryAt(options, 0, 42, (d) => d));
  await page.keyboard.press('g');
  await expectSummary(page, summaryAt(options, 1, 42));
});

test('switching to Gray code resets the operators to the bit-string defaults and the notice says exactly what', async ({ page }) => {
  await open(page);
  await openDrawer(page);
  await page.locator('#representation').selectOption('gray');
  await expect(page.locator('#crossover-type')).toHaveValue('one-point');
  await expect(page.locator('#crossover-alpha')).toHaveCount(0);
  await expect(page.locator('#mutation-sigma')).toHaveCount(0);
  await expect(page.locator('#mutation-probability')).toHaveValue('0.02');
  await expect(page.locator('#crossover-type option')).toHaveText(['One-point', 'Two-point', 'Uniform']);
  const note = 'Reset to the new representation’s defaults: crossover type (BLX-α → One-point), mutation (Gaussian, per gene, pm 0.1, σ = 0.05 → bit flip, per gene, pm 0.02).';
  await expect(page.locator('[data-section="setup"] .applyreset .help')).toContainText(`Changed: Representation. Restarts the run from generation 0. ${note}`);
  await page.getByTestId('apply-reset').click();
  await expect(page.getByTestId('reset-notice')).toHaveText(`Changing the representation restarts the run from generation 0. Nothing recorded will be lost. ${note}`);
  await page.getByRole('button', { name: 'Restart and apply' }).click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#brand .s')).toHaveText('Single peak · maximise f · optimum 1');
  await expect(page.getByTestId('problem-chip')).toHaveText('Gray-coded · 10 bits');
  const options: LandscapeOptions = { ...base, representation: 'gray' };
  await expectSummary(page, summaryAt(options, 0));
  await page.keyboard.press('g');
  await expectSummary(page, summaryAt(options, 1));
});

test('the real-valued operators: α, σ and ε are parameters that wait for the next generation, and a bad entry is marked', async ({ page }) => {
  await open(page);
  await openDrawer(page);
  await expect(page.locator('#crossover-type option')).toHaveText(['One-point', 'Two-point (needs 3 genes)', 'Uniform', 'BLX-α', 'Arithmetic']);
  await expect(page.locator('#crossover-type')).toHaveValue('blx-alpha');
  await expect(page.locator('#crossover-alpha')).toHaveValue('0.5');
  await expect(page.locator('#mutation-sigma')).toHaveValue('0.05');
  await expect(page.locator('#stop-epsilon')).toHaveValue(/^0\.00099/);
  await expect(page.locator('#stop-target')).toHaveCount(0);
  await page.locator('#crossover-alpha').fill('-1');
  await page.locator('#crossover-alpha').blur();
  await expect(page.locator('#crossover-alpha-error')).toHaveText('α must be a number of 0 or more.');
  await expect(page.locator('#crossover-alpha')).toHaveAttribute('aria-invalid', 'true');
  await page.locator('#crossover-alpha').fill('1.5');
  await page.locator('#crossover-alpha').blur();
  await expect(page.getByTestId('pending-crossover-alpha')).toBeVisible();
  await page.locator('#mutation-sigma').fill('0');
  await page.locator('#mutation-sigma').blur();
  await expect(page.locator('#mutation-sigma-error')).toHaveText('σ must be a number greater than 0.');
  await page.locator('#mutation-sigma').fill('0.2');
  await page.locator('#mutation-sigma').blur();
  await page.locator('#stop-epsilon').fill('0.1');
  await page.locator('#stop-epsilon').blur();
  await page.locator('#crossover-type').selectOption('uniform');
  await expect(page.locator('#crossover-alpha')).toHaveCount(0);
  await page.locator('#crossover-type').selectOption('blx-alpha');
  await expect(page.locator('#crossover-alpha')).toHaveValue('0.5');
  await page.locator('#crossover-type').selectOption('two-point');
  await expect(page.locator('#crossover-type-error')).toContainText('Two-point crossover needs chromosomes of at least 3 genes');
});

test('a hand-edited population is typed as pairs of numbers and read against the bounds', async ({ page }) => {
  await open(page);
  await openDrawer(page);
  await page.locator('#init').selectOption('explicit');
  await page.locator('#chromosomes').fill('2 -1\n0.5, 3\n6 0');
  await expect(page.locator('#chromosomes-error')).toContainText('gene 1 (6) is outside its bounds from −5 to 5');
  await page.locator('#chromosomes').fill('2 -1\n0.5, 3');
  await expect(page.getByTestId('hand-population').locator('tbody tr')).toHaveCount(2);
  await expect(page.getByTestId('hand-population').locator('[data-testid="real-chromosome"]').first()).toHaveText('2 -1');
  await page.getByTestId('apply-reset').click();
  await page.getByRole('button', { name: 'Restart and apply' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('distinct')).toHaveText('2 of 2 distinct');
  expect(await summary(page)).toContain('best now 1 ·');
});

test('a share link opens the landscape, in every representation, as the same run', async ({ page }) => {
  const errors = errorsOf(page);
  for (const options of [
    { function: 'two-peaks', representation: 'real', bitsPerVariable: 10 },
    { function: 'himmelblau', representation: 'plain', bitsPerVariable: 6 },
    { function: 'rastrigin', representation: 'gray', bitsPerVariable: 8 },
  ] as const) {
    await open(page, options);
    await expectSummary(page, summaryAt(options, 0));
    await page.keyboard.press('g');
    await page.keyboard.press('g');
    await expectSummary(page, summaryAt(options, 2));
  }
  expect(errors).toEqual([]);
});

test('a link whose operator does not exist for its representation is refused in words and nothing is used', async ({ page }) => {
  const d = defaultsOf(entry, { ...base, representation: 'plain', bitsPerVariable: 6 });
  const options: LandscapeOptions = { ...base, representation: 'plain', bitsPerVariable: 6 };
  const config = configOf({ problem: entry.create(options), init: d.init }, { ...d.params, crossover: { enabled: true, operator: 'arithmetic', probability: 0.5 } }, 42, 'landscape', options);
  await page.goto('about:blank');
  await page.goto(url + encodeConfig(config));
  await expect(page.getByRole('alert').or(page.getByTestId('link-notice'))).toContainText('Arithmetic crossover is for real-valued chromosomes; choose one-point, two-point or uniform crossover for this problem.');
  await expect(page.getByTestId('problem-button')).toHaveText(/Goldberg/);
});

test('with the drawer open every control has a name, for each representation', async ({ page }) => {
  for (const options of [base, { ...base, representation: 'plain', bitsPerVariable: 8 }] as const) {
    await open(page, options);
    await openDrawer(page);
    expect(await unnamed(page)).toEqual([]);
    await page.keyboard.press('Escape');
  }
});
