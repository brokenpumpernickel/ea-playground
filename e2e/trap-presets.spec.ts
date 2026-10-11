import { expect, test, type Page } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { formatGenes, gaAlgorithm, trapProblem, type GaParams, type TrapOptions } from '../src/engine';
import { createRun } from '../src/run';

const url = pathToFileURL(resolve('dist/index.html')).href;
interface Loaded { name: string; lesson: string; lookFor: string; seed: number; options: TrapOptions; params: GaParams; size: number }
const files = readdirSync(resolve('src/ui/presets')).filter((f) => f.endsWith('.json')).sort();
const presets: Loaded[] = files
  .map((f) => JSON.parse(readFileSync(resolve('src/ui/presets', f), 'utf8')))
  .filter((d) => d.problem === 'trap')
  .map((d) => ({ name: d.name, lesson: d.lesson, lookFor: d.lookFor, seed: d.seed, options: d.options, params: d.params, size: d.setup.init.size }));
const rows = (page: Page) => page.getByRole('table', { name: /^(Population|Parents) · generation \d+$/ }).locator('tbody tr [data-bits]').evaluateAll((els) => els.map((el) => el.getAttribute('data-bits')!));
const openTrap = async (page: Page) => {
  await page.goto(url);
  await page.getByTestId('problem-button').click();
  await page.getByRole('menuitemradio', { name: /Trap/ }).click();
  await page.getByRole('button', { name: 'Restart and apply' }).click();
};
const load = async (page: Page, name: string) => {
  if (!(await page.getByTestId('drawer').count())) await page.getByRole('button', { name: /Parameters/ }).click();
  await page.locator('#preset').selectOption({ label: name });
  await page.getByTestId('load-preset').click();
  await page.getByRole('button', { name: 'Restart and apply' }).click();
  await page.keyboard.press('Escape');
};

test('the menu lists the six trap presets with their lesson and what to look for, and none of the other problems’', async ({ page }) => {
  await openTrap(page);
  await page.getByRole('button', { name: /Parameters/ }).click();
  await expect(page.locator('#preset option')).toHaveText(['Tight blocks', 'Loose blocks', 'Bigger population', 'Elitism', 'Uniform crossover', 'No mutation']);
  for (const p of presets) {
    await page.locator('#preset').selectOption({ label: p.name });
    await expect(page.getByTestId('preset-lesson')).toHaveText(p.lesson);
    await expect(page.getByTestId('preset-lookfor')).toHaveText(`Look for: ${p.lookFor}`);
    await expect(page.getByText(`with this configuration and seed ${p.seed}.`)).toBeVisible();
  }
});

for (const p of presets) {
  test(`loading “${p.name}” restarts with its seed, its options and its population, and the run is the engine’s`, async ({ page }) => {
    await openTrap(page);
    await page.keyboard.press('g');
    await load(page, p.name);
    await expect(page.locator('#brand')).toContainText(`preset: ${p.name}`);
    await expect(page.getByTestId('seed')).toHaveText(String(p.seed));
    await expect(page.locator('#brand .s')).toHaveText(`5 blocks of 4 · ${p.options.linkage} · optimum 20`);
    const problem = trapProblem(p.options);
    const run = createRun(gaAlgorithm, { setup: { problem, init: { kind: 'random', size: p.size } }, params: p.params, seed: p.seed }, { eventCacheSize: 0 });
    const shown = (g: number) => run.snapshot(g).state.population.map((i) => formatGenes(i.chromosome, problem.alphabet));
    expect(await rows(page)).toEqual(shown(0));
    for (let g = 1; g <= 3; g++) {
      await page.keyboard.press('g');
      run.forwardCycle();
    }
    await expect(page.locator('#pop-heading')).toHaveText('Population · generation 3');
    expect(await rows(page)).toEqual(shown(3));
  });
}

test('Tight blocks pauses at generation 86 for stagnation without finding 20; Bigger population finds it in generation 11 and stops at the target', async ({ page }) => {
  await openTrap(page);
  await load(page, 'Tight blocks');
  await page.getByRole('button', { name: 'Run until stop' }).click();
  await expect(page.locator('#pop-heading')).toHaveText(/generation 86$/);
  await expect(page.getByTestId('summary')).toContainText('best so far 16');
  await load(page, 'Bigger population');
  await page.getByRole('button', { name: 'Run until stop' }).click();
  await expect(page.locator('#pop-heading')).toHaveText(/generation 11$/);
  await expect(page.getByTestId('summary')).toContainText('best so far 20');
});

test('the other problems’ presets are unchanged, and each keeps to its own problem', async ({ page }) => {
  await page.goto(url);
  await page.getByRole('button', { name: /Parameters/ }).click();
  await expect(page.locator('#preset option')).toHaveText(['Textbook population', 'No crossover', 'No mutation', 'High mutation']);
});
