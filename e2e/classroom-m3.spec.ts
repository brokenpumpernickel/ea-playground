import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { formatGenes, gaAlgorithm, handlings, type GaParams, type GaSetup, type Handling, type KnapsackOptions } from '../src/engine';
import { createRun } from '../src/run';
import { entryOf } from '../src/ui/problems';

const url = pathToFileURL(resolve('dist/index.html')).href;
const shots = resolve('.scratch/milestone-3-knapsack/screenshots');
test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

const entry = entryOf('knapsack')!;
const base = entry.defaultOptions() as KnapsackOptions;
const lamarckian = JSON.parse(readFileSync(resolve('src/ui/presets/b-bag-repair-lamarckian.json'), 'utf8')) as { seed: number; options: KnapsackOptions; setup: { init: GaSetup['init'] }; params: GaParams };

const rows = (page: Page) =>
  page.getByRole('table', { name: /^(Population|Parents) · generation \d+$/ }).locator('tbody tr [data-bits]').evaluateAll((els) => els.map((el) => el.getAttribute('data-bits')));
const heading = (page: Page) => page.locator('#pop-heading');
const engineOf = (options: KnapsackOptions, params: GaParams, seed: number, init: GaSetup['init']) => {
  const setup: GaSetup = { problem: entry.create(options), init };
  const run = createRun(gaAlgorithm, { setup, params, seed });
  const text = (cycle: number) => run.snapshot(cycle).state.population.map((i) => formatGenes(i.chromosome, setup.problem.alphabet));
  return { run, text };
};
const handlingLabel: Record<Handling, string> = { decoder: 'First-fit decoder', penalty: 'Penalty', 'repair-lamarckian': 'Repair (Lamarckian)', 'repair-baldwinian': 'Repair (Baldwinian)' };

test('the third classroom scenario: share a configured knapsack run, open it in a fresh page, try all four methods, load a preset, finish a generation, scrub back, change a parameter, confirm and continue', async ({ page, context }) => {
  mkdirSync(shots, { recursive: true });
  await page.setViewportSize({ width: 1920, height: 1080 });

  // 1. configure a knapsack run: penalty method with ρ = 3, mutation 0.1 per gene, one elite
  await page.goto(url);
  await page.getByRole('button', { name: 'Projector mode' }).click();
  await page.getByTestId('problem-button').click();
  await page.getByRole('menuitemradio', { name: /Knapsack/ }).click();
  await page.getByRole('button', { name: 'Restart and apply' }).click();
  await expect(page.locator('#brand .s')).toHaveText('12 items · capacity 48 · optimum 123');
  await page.getByRole('button', { name: /Parameters/ }).click();
  await page.locator('#handling').selectOption('penalty');
  await page.locator('#rho').fill('3');
  await page.getByTestId('apply-reset').click();
  await page.getByRole('button', { name: 'Restart and apply' }).click();
  await page.locator('#mutation-probability').fill('0.1');
  await page.locator('#mutation-probability').press('Enter');
  await page.locator('#elites').fill('1');
  await page.locator('#elites').press('Enter');
  await page.getByTestId('copy-link').click();
  await expect(page.getByTestId('share-status')).toBeVisible();
  const link = await page.evaluate(() => navigator.clipboard.readText());

  // 2. the link, opened in a fresh page, gives the same run as the engine's
  const defaults = entry.defaults;
  const params: GaParams = { ...defaults.params, mutation: { ...defaults.params.mutation, probability: 0.1 }, elites: 1 };
  const penalty: KnapsackOptions = { ...base, handling: 'penalty', rho: 3 };
  const init = { kind: 'random' as const, size: 8 };
  const first = engineOf(penalty, params, defaults.seed, init);
  const fresh = await context.newPage();
  await fresh.setViewportSize({ width: 1920, height: 1080 });
  await fresh.goto(link);
  await expect(fresh.getByTestId('link-notice')).toHaveCount(0);
  await expect(fresh.getByTestId('problem-button')).toHaveText(/Knapsack/);
  expect(await rows(fresh)).toEqual(first.text(0));
  await fresh.keyboard.press('g');
  first.run.forwardCycle();
  await fresh.keyboard.press('g');
  first.run.forwardCycle();
  expect(await rows(fresh)).toEqual(first.text(2));
  await fresh.screenshot({ path: `${shots}/classroom-1-link-penalty.png` });
  await page.close();

  // 3. through the drawer, each of the four methods: the same seed and settings, restarted, a generation on, and it is the engine's run
  for (const handling of handlings) {
    await fresh.getByRole('button', { name: /Parameters/ }).click();
    await fresh.locator('#handling').selectOption({ label: handlingLabel[handling] });
    await fresh.getByTestId('apply-reset').click();
    await fresh.getByRole('button', { name: 'Restart and apply' }).click();
    await fresh.keyboard.press('Escape');
    const options: KnapsackOptions = { ...base, handling, rho: handling === 'penalty' ? 3 : base.rho };
    const e = engineOf(options, params, defaults.seed, init);
    await expect(heading(fresh)).toHaveText('Population · generation 0');
    expect(await rows(fresh)).toEqual(e.text(0));
    await fresh.keyboard.press('g');
    e.run.forwardCycle();
    await expect(heading(fresh)).toHaveText('Population · generation 1');
    expect(await rows(fresh)).toEqual(e.text(1));
  }

  // 4. a preset of this problem, with its description: Lamarckian repair, seed 19
  await fresh.getByRole('button', { name: /Parameters/ }).click();
  await expect(fresh.locator('#preset option')).toHaveText(['Evolve a bag', 'Penalty too small', 'Penalty too large', 'Repair: Lamarckian', 'Repair: Baldwinian']);
  await fresh.locator('#preset').selectOption({ label: 'Repair: Lamarckian' });
  await expect(fresh.getByTestId('preset-lesson')).toContainText('writes that back into the chromosome');
  await fresh.getByTestId('load-preset').click();
  await fresh.getByRole('button', { name: 'Restart and apply' }).click();
  await fresh.keyboard.press('Escape');
  await expect(fresh.locator('#brand')).toContainText('preset: Repair: Lamarckian');
  await expect(fresh.getByTestId('seed')).toHaveText('19');
  const original = engineOf(lamarckian.options, lamarckian.params, lamarckian.seed, lamarckian.setup.init);
  expect(await rows(fresh)).toEqual(original.text(0));
  await fresh.screenshot({ path: `${shots}/classroom-2-lamarckian-preset.png` });

  // 5. step into the first generation, to the end of evaluation (✂ marks and the "what happened" column), then to the end of the generation
  await fresh.keyboard.press('ArrowRight');
  for (let k = 0; k < 5; k++) await fresh.keyboard.press('Shift+ArrowRight');
  await expect(fresh.getByRole('heading', { level: 2, name: /Evaluation/ })).toBeVisible();
  const probe = engineOf(lamarckian.options, lamarckian.params, lamarckian.seed, lamarckian.setup.init);
  probe.run.forwardCycle();
  const repaired = probe.run.events(1).some((e) => (e.stage === 'evaluation' || e.stage === 'setup') && 'repairedFrom' in e && e.repairedFrom);
  if (repaired) await expect(fresh.locator('[data-dropped]').first()).toBeVisible();
  await fresh.screenshot({ path: `${shots}/classroom-3-lamarckian-evaluation.png` });
  await fresh.keyboard.press('Shift+ArrowRight');
  await expect(heading(fresh)).toHaveText('Population · generation 1');
  for (let g = 0; g < 3; g++) await fresh.keyboard.press('g');
  await expect(heading(fresh)).toHaveText('Population · generation 4');
  for (let g = 0; g < 4; g++) original.run.forwardCycle();
  expect(await rows(fresh)).toEqual(original.text(4));
  await fresh.screenshot({ path: `${shots}/classroom-4-generation-4.png` });

  // 6. scrub back to generation 2: the screen shows what it showed then
  const scrub = fresh.getByTestId('scrub');
  await scrub.focus();
  await fresh.keyboard.press('PageUp');
  await fresh.keyboard.press('PageUp');
  await expect(scrub).toHaveAttribute('data-cycle', '2');
  await expect(heading(fresh)).toHaveText('Population · generation 2');
  expect(await rows(fresh)).toEqual(original.text(2));

  // 7. raise the mutation rate: the notice names what would go; confirming applies it from here
  await fresh.getByRole('button', { name: /Parameters/ }).click();
  await fresh.locator('#mutation-probability').fill('0.15');
  await fresh.locator('#mutation-probability').press('Enter');
  await expect(fresh.getByTestId('discard-notice')).toHaveText('Generations 3–4 will be discarded. The run continues from generation 2 with the new settings.');
  await fresh.screenshot({ path: `${shots}/classroom-5-notice.png` });
  await fresh.getByRole('button', { name: 'Discard and apply' }).click();
  await fresh.keyboard.press('Escape');
  await expect(fresh.getByText('recorded gens 0–2')).toBeVisible();

  // 8. continue: the later generations are the engine's with the same seed and the same change at the same point
  for (let g = 0; g < 3; g++) await fresh.keyboard.press('g');
  await expect(heading(fresh)).toHaveText('Population · generation 5');
  const changed = engineOf(lamarckian.options, lamarckian.params, lamarckian.seed, lamarckian.setup.init);
  changed.run.forwardCycle();
  changed.run.forwardCycle();
  changed.run.setParameters({ ...lamarckian.params, mutation: { ...lamarckian.params.mutation, probability: 0.15 } });
  for (let g = 0; g < 3; g++) changed.run.forwardCycle();
  expect(await rows(fresh)).toEqual(changed.text(5));
  expect(changed.text(5)).not.toEqual(original.text(4));
  await fresh.screenshot({ path: `${shots}/classroom-6-after-change.png` });

  // the same at the smaller laptop size
  await fresh.setViewportSize({ width: 1366, height: 768 });
  await fresh.screenshot({ path: `${shots}/classroom-7-1366x768.png` });
  expect(await fresh.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
});
