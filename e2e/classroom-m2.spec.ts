import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { formatBits, formatGenes, gaAlgorithm, goldberg, type GaParams, type GaSetup } from '../src/engine';
import { createRun } from '../src/run';
import { entryOf } from '../src/ui/problems';

const url = pathToFileURL(resolve('dist/index.html')).href;
const shots = resolve('.scratch/milestone-2-target-string-and-links/screenshots');
test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

const file = (name: string) => JSON.parse(readFileSync(resolve('src/ui/presets', name), 'utf8')) as { seed: number; options?: { alphabet: string; target: string }; setup: { init: GaSetup['init'] }; params: GaParams };
const rows = (page: Page) =>
  page.getByRole('table', { name: /^(Population|Parents) · generation \d+$/ }).locator('tbody tr [data-bits]').evaluateAll((els) => els.map((el) => el.getAttribute('data-bits')));
const heading = (page: Page) => page.locator('#pop-heading');

test('the second classroom scenario: share a configured run, open it in a fresh page, switch to the target string, load a preset, finish a generation, scrub back, change a parameter, confirm and continue', async ({ page, context }) => {
  mkdirSync(shots, { recursive: true });
  await page.setViewportSize({ width: 1920, height: 1080 });

  // 1. a configured Goldberg run: the textbook population with a different mutation rate and one elite
  await page.goto(url);
  await page.getByRole('button', { name: 'Projector mode' }).click();
  await page.getByRole('button', { name: /Parameters/ }).click();
  await page.locator('#preset').selectOption({ label: 'Textbook population' });
  await page.getByTestId('load-preset').click();
  await page.getByRole('button', { name: 'Restart and apply' }).click();
  await page.locator('#mutation-probability').fill('0.2');
  await page.locator('#mutation-probability').press('Enter');
  await page.locator('#elites').fill('1');
  await page.locator('#elites').press('Enter');
  await page.getByTestId('copy-link').click();
  await expect(page.getByTestId('share-status')).toBeVisible();
  const link = await page.evaluate(() => navigator.clipboard.readText());

  // 2. the link, opened in a fresh page, gives the same run as the engine's
  const textbook = file('1-textbook.json');
  const goldbergParams: GaParams = { ...textbook.params, mutation: { ...textbook.params.mutation, probability: 0.2 }, elites: 1 };
  const goldbergSetup: GaSetup = { problem: goldberg, init: textbook.setup.init };
  const fresh = await context.newPage();
  await fresh.setViewportSize({ width: 1920, height: 1080 });
  await fresh.goto(link);
  await expect(fresh.getByTestId('link-notice')).toHaveCount(0);
  await expect(fresh.getByTestId('problem-button')).toHaveText(/Goldberg/);
  const goldbergRun = createRun(gaAlgorithm, { setup: goldbergSetup, params: goldbergParams, seed: textbook.seed });
  expect(await rows(fresh)).toEqual(goldbergRun.snapshot(0).state.population.map((i) => formatBits(i.chromosome)));
  await fresh.keyboard.press('g');
  goldbergRun.forwardCycle();
  expect(await rows(fresh)).toEqual(goldbergRun.snapshot(1).state.population.map((i) => formatBits(i.chromosome)));
  await page.close();

  // 3. switch to the target string through the menu; the notice says what is lost
  await fresh.getByTestId('problem-button').click();
  await fresh.getByRole('menuitemradio', { name: /Target string/ }).click();
  await expect(fresh.getByTestId('reset-notice')).toHaveText('Switching to the problem Target string restarts the run from generation 0 and discards the 1 recorded generation (1).');
  await fresh.getByRole('button', { name: 'Restart and apply' }).click();
  await expect(fresh.locator('#brand .s')).toHaveText('Match “HELLO” · 27 symbols');

  // 4. a preset of this problem, with its description
  await fresh.getByRole('button', { name: /Parameters/ }).click();
  await expect(fresh.locator('#preset option')).toHaveText(['Evolve a word', 'No mutation', 'Mutation too high']);
  await fresh.locator('#preset').selectOption({ label: 'Mutation too high' });
  await expect(fresh.getByTestId('preset-lesson')).toContainText('selection cannot hold on to what it has found');
  await fresh.getByTestId('load-preset').click();
  await fresh.getByRole('button', { name: 'Restart and apply' }).click();
  await fresh.keyboard.press('Escape');
  await expect(fresh.locator('#brand')).toContainText('preset: Mutation too high');
  const preset = file('7-word-mutation-too-high.json');
  const entry = entryOf('target-string')!;
  const setup: GaSetup = { problem: entry.create(preset.options), init: preset.setup.init };
  const text = (run: ReturnType<typeof createRun>, cycle: number) => run.snapshot(cycle).state.population.map((i) => formatGenes(i.chromosome, setup.problem.alphabet));
  const original = createRun(gaAlgorithm, { setup, params: preset.params, seed: preset.seed });
  expect(await rows(fresh)).toEqual(text(original, 0));
  await fresh.screenshot({ path: `${shots}/classroom-1-string-preset.png` });

  // 5. step into the first generation, to the end of crossover (cut lines and hatching on screen), then to the end of the generation
  await fresh.keyboard.press('ArrowRight');
  for (let k = 0; k < 3; k++) await fresh.keyboard.press('Shift+ArrowRight');
  await expect(fresh.getByRole('heading', { level: 2, name: /Crossover/ })).toBeVisible();
  await fresh.screenshot({ path: `${shots}/classroom-2-string-crossover.png` });
  for (let k = 0; k < 3; k++) await fresh.keyboard.press('Shift+ArrowRight');
  await expect(heading(fresh)).toHaveText('Population · generation 1');
  for (let g = 0; g < 3; g++) await fresh.keyboard.press('g');
  await expect(heading(fresh)).toHaveText('Population · generation 4');
  for (let g = 0; g < 4; g++) original.forwardCycle();
  expect(await rows(fresh)).toEqual(text(original, 4));
  await fresh.screenshot({ path: `${shots}/classroom-3-string-generation-4.png` });

  // 6. scrub back to generation 2: the screen shows what it showed then
  const scrub = fresh.getByTestId('scrub');
  await scrub.focus();
  await fresh.keyboard.press('PageUp');
  await fresh.keyboard.press('PageUp');
  await expect(scrub).toHaveAttribute('data-cycle', '2');
  await expect(heading(fresh)).toHaveText('Population · generation 2');
  expect(await rows(fresh)).toEqual(text(original, 2));

  // 7. lower the mutation rate: the notice names what would go; confirming applies it from here
  await fresh.getByRole('button', { name: /Parameters/ }).click();
  await fresh.locator('#mutation-probability').fill('0.1');
  await fresh.locator('#mutation-probability').press('Enter');
  await expect(fresh.getByTestId('discard-notice')).toHaveText('Generations 3–4 will be discarded. The run continues from generation 2 with the new settings.');
  await fresh.screenshot({ path: `${shots}/classroom-4-string-notice.png` });
  await fresh.getByRole('button', { name: 'Discard and apply' }).click();
  await fresh.keyboard.press('Escape');
  await expect(fresh.getByText('recorded gens 0–2')).toBeVisible();

  // 8. continue: the later generations are the engine's with the same seed and the same change at the same point
  await fresh.keyboard.press('g');
  await fresh.keyboard.press('g');
  await fresh.keyboard.press('g');
  await expect(heading(fresh)).toHaveText('Population · generation 5');
  const changed = createRun(gaAlgorithm, { setup, params: preset.params, seed: preset.seed });
  changed.forwardCycle();
  changed.forwardCycle();
  changed.setParameters({ ...preset.params, mutation: { ...preset.params.mutation, probability: 0.1 } });
  for (let g = 0; g < 3; g++) changed.forwardCycle();
  expect(await rows(fresh)).toEqual(text(changed, 5));
  expect(text(changed, 5)).not.toEqual(text(original, 4));
  await fresh.screenshot({ path: `${shots}/classroom-5-string-after-change.png` });

  // the same at the smaller laptop size
  await fresh.setViewportSize({ width: 1366, height: 768 });
  await fresh.screenshot({ path: `${shots}/classroom-6-string-1366x768.png` });
  expect(await fresh.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
});
