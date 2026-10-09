import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { formatBits, gaAlgorithm, goldberg, type GaParams, type GaSetup } from '../src/engine';
import { createRun } from '../src/run';

const url = pathToFileURL(resolve('dist/index.html')).href;
const shots = resolve('.scratch/milestone-1-goldberg/screenshots');

/** The textbook preset exactly as its data file says it, so the expectation does not depend on the app's own loading code. */
const textbook = JSON.parse(readFileSync(resolve('src/ui/presets/1-textbook.json'), 'utf8')) as { seed: number; setup: { init: GaSetup['init'] }; params: GaParams };
const setup: GaSetup = { problem: goldberg, init: textbook.setup.init };

const populationRows = (page: Page) =>
  page.getByRole('table', { name: /^(Population|Parents) · generation \d+$/ }).locator('tbody tr [data-bits]').evaluateAll((els) => els.map((el) => el.getAttribute('data-bits')));
const column = (page: Page, col: string) => page.getByRole('table', { name: /^(Population|Parents) · generation \d+$/ }).locator(`tbody tr [data-col="${col}"]`).allTextContents();

test('the classroom scenario: open the textbook preset, finish a generation, scrub back, change a parameter, confirm the notice, continue', async ({ page }) => {
  mkdirSync(shots, { recursive: true });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(url);
  await page.getByRole('button', { name: 'Projector mode' }).click();

  // 1. the textbook preset, with the book's numbers
  await page.getByRole('button', { name: /Parameters/ }).click();
  await page.locator('#preset').selectOption({ label: 'Textbook population' });
  await page.getByTestId('load-preset').click();
  await page.getByRole('button', { name: 'Restart and apply' }).click();
  await page.keyboard.press('Escape');
  expect(await column(page, 'fitness')).toEqual(['169', '576', '64', '361']);
  await expect(page.locator('section[aria-labelledby="pop-heading"] .ph .r')).toContainText('Σ fitness 1170 · avg 292.5 · best 576');
  await page.screenshot({ path: `${shots}/classroom-1-textbook.png` });

  // 2. step into the generation, to the end of selection (probabilities on screen), then to the end of the generation
  await page.keyboard.press('ArrowRight');
  expect(await column(page, 'prob')).toEqual(['0.144', '0.492', '0.055', '0.309']);
  await page.screenshot({ path: `${shots}/classroom-2-selection.png` });
  for (let k = 0; k < 6; k++) await page.keyboard.press('Shift+ArrowRight');
  await expect(page.locator('#pop-heading')).toHaveText('Population · generation 1');
  await page.screenshot({ path: `${shots}/classroom-3-end-of-generation.png` });

  // 3. two more generations
  await page.keyboard.press('g');
  await page.keyboard.press('g');
  await expect(page.locator('#pop-heading')).toHaveText('Population · generation 3');
  const original = createRun(gaAlgorithm, { setup, params: textbook.params, seed: textbook.seed });
  for (let g = 0; g < 3; g++) original.forwardCycle();
  const population = (run: typeof original, cycle: number) => run.snapshot(cycle).state.population.map((i) => formatBits(i.chromosome));
  expect(await populationRows(page)).toEqual(population(original, 3));

  // 4. scrub back to generation 1; the screen shows what it showed then
  const scrub = page.getByTestId('scrub');
  await scrub.focus();
  await page.keyboard.press('PageUp');
  await page.keyboard.press('PageUp');
  await expect(scrub).toHaveAttribute('data-cycle', '1');
  await expect(page.locator('#pop-heading')).toHaveText('Population · generation 1');
  expect(await populationRows(page)).toEqual(population(original, 1));

  // 5. change a parameter: the notice names what would go; confirming applies it from here
  await page.getByRole('button', { name: /Parameters/ }).click();
  const pm = page.locator('#mutation-probability');
  await pm.fill('0.3');
  await pm.press('Enter');
  const notice = page.getByTestId('discard-notice');
  await expect(notice).toHaveText('Generations 2–3 will be discarded. The run continues from generation 1 with the new settings.');
  await page.screenshot({ path: `${shots}/classroom-4-notice.png` });
  await page.getByRole('button', { name: 'Discard and apply' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByText('recorded gens 0–1')).toBeVisible();

  // 6. continue: the later generations are the engine's with the same seed and the same change at the same point
  await page.keyboard.press('g');
  await page.keyboard.press('g');
  await expect(page.locator('#pop-heading')).toHaveText('Population · generation 3');
  const changed = createRun(gaAlgorithm, { setup, params: textbook.params, seed: textbook.seed });
  changed.forwardCycle();
  changed.setParameters({ ...textbook.params, mutation: { ...textbook.params.mutation, probability: 0.3 } });
  changed.forwardCycle();
  changed.forwardCycle();
  expect(await populationRows(page)).toEqual(population(changed, 3));
  expect(population(changed, 3)).not.toEqual(population(original, 3));
  await page.screenshot({ path: `${shots}/classroom-5-after-change.png` });

  // the same two moments at the smaller laptop size
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.screenshot({ path: `${shots}/classroom-6-1366x768.png` });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
