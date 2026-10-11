import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { formatGenes, gaAlgorithm, trapProblem, type GaParams, type GaSetup, type TrapOptions } from '../src/engine';
import { createRun } from '../src/run';
import { entryOf } from '../src/ui/problems';
import { parseSchema, schemaHistory } from '../src/ui/schema-model';

const url = pathToFileURL(resolve('dist/index.html')).href;
const shots = resolve('.scratch/milestone-4-deceptive-trap/screenshots');
test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

const entry = entryOf('trap')!;
const base = entry.defaultOptions() as TrapOptions;
const looseFile = JSON.parse(readFileSync(resolve('src/ui/presets/e-trap-loose.json'), 'utf8')) as { seed: number; options: TrapOptions; setup: { init: GaSetup['init'] }; params: GaParams };

const rows = (page: Page) => page.getByRole('table', { name: /^(Population|Parents) · generation \d+$/ }).locator('tbody tr [data-bits]').evaluateAll((els) => els.map((el) => el.getAttribute('data-bits')));
const heading = (page: Page) => page.locator('#pop-heading');
const engineOf = (options: TrapOptions, params: GaParams, seed: number, init: GaSetup['init']) => {
  const setup: GaSetup = { problem: trapProblem(options), init };
  const run = createRun(gaAlgorithm, { setup, params, seed });
  const text = (cycle: number) => run.snapshot(cycle).state.population.map((i) => formatGenes(i.chromosome, setup.problem.alphabet));
  return { run, text };
};

test('the fourth classroom scenario: share a configured trap run, open it in a fresh page, switch the linkage, load a preset, finish a generation, track a schema, scrub back, change a parameter, confirm and continue', async ({ page, context }) => {
  mkdirSync(shots, { recursive: true });
  await page.setViewportSize({ width: 1920, height: 1080 });

  // 1. configure a trap run: loose blocks, mutation 0.1 per gene, one elite
  await page.goto(url);
  await page.getByRole('button', { name: 'Projector mode' }).click();
  await page.getByTestId('problem-button').click();
  await page.getByRole('menuitemradio', { name: /Trap/ }).click();
  await page.getByRole('button', { name: 'Restart and apply' }).click();
  await expect(page.locator('#brand .s')).toHaveText('5 blocks of 4 · tight · optimum 20');
  await page.getByRole('button', { name: /Parameters/ }).click();
  await page.locator('#linkage').selectOption('loose');
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
  const init = { kind: 'random' as const, size: 12 };
  const first = engineOf({ ...base, linkage: 'loose' }, params, defaults.seed, init);
  const fresh = await context.newPage();
  await fresh.setViewportSize({ width: 1920, height: 1080 });
  await fresh.goto(link);
  await expect(fresh.getByTestId('link-notice')).toHaveCount(0);
  await expect(fresh.locator('#brand .s')).toHaveText('5 blocks of 4 · loose · optimum 20');
  expect(await rows(fresh)).toEqual(first.text(0));
  await fresh.keyboard.press('g');
  first.run.forwardCycle();
  await fresh.keyboard.press('g');
  first.run.forwardCycle();
  expect(await rows(fresh)).toEqual(first.text(2));
  await fresh.screenshot({ path: `${shots}/classroom-1-link-loose.png` });
  await page.close();

  // 3. through the drawer, tight blocks: the same seed and settings, restarted, a generation on, and it is the engine's run
  await fresh.getByRole('button', { name: /Parameters/ }).click();
  await fresh.locator('#linkage').selectOption('tight');
  await fresh.getByTestId('apply-reset').click();
  await fresh.getByRole('button', { name: 'Restart and apply' }).click();
  await fresh.keyboard.press('Escape');
  await expect(fresh.locator('#brand .s')).toHaveText('5 blocks of 4 · tight · optimum 20');
  const tight = engineOf(base, params, defaults.seed, init);
  expect(await rows(fresh)).toEqual(tight.text(0));
  await fresh.keyboard.press('g');
  tight.run.forwardCycle();
  expect(await rows(fresh)).toEqual(tight.text(1));

  // 4. a preset of this problem, with its description: loose blocks, seed 44
  await fresh.getByRole('button', { name: /Parameters/ }).click();
  await expect(fresh.locator('#preset option')).toHaveText(['Tight blocks', 'Loose blocks', 'Bigger population', 'Elitism', 'Uniform crossover', 'No mutation']);
  await fresh.locator('#preset').selectOption({ label: 'Loose blocks' });
  await expect(fresh.getByTestId('preset-lesson')).toContainText('cuts through its blocks far more often');
  await fresh.getByTestId('load-preset').click();
  await fresh.getByRole('button', { name: 'Restart and apply' }).click();
  await fresh.keyboard.press('Escape');
  await expect(fresh.locator('#brand')).toContainText('preset: Loose blocks');
  await expect(fresh.getByTestId('seed')).toHaveText('44');
  const original = engineOf(looseFile.options, looseFile.params, looseFile.seed, looseFile.setup.init);
  expect(await rows(fresh)).toEqual(original.text(0));
  await fresh.screenshot({ path: `${shots}/classroom-2-loose-preset.png` });

  // 5. into the first generation, to the end of crossover (blocks split by the cut), then to the end of the generation
  await fresh.keyboard.press('ArrowRight');
  for (let k = 0; k < 3; k++) await fresh.keyboard.press('Shift+ArrowRight');
  await expect(fresh.getByRole('heading', { level: 2, name: /Crossover/ })).toBeVisible();
  expect(await fresh.locator('.ccard .bnote.split').count()).toBeGreaterThan(0);
  await fresh.screenshot({ path: `${shots}/classroom-3-loose-crossover.png` });
  for (let k = 0; k < 3; k++) await fresh.keyboard.press('Shift+ArrowRight');
  await expect(heading(fresh)).toHaveText('Population · generation 1');
  for (let g = 0; g < 2; g++) await fresh.keyboard.press('g');
  await expect(heading(fresh)).toHaveText('Population · generation 3');
  for (let g = 0; g < 3; g++) original.run.forwardCycle();
  expect(await rows(fresh)).toEqual(original.text(3));
  await fresh.screenshot({ path: `${shots}/classroom-4-generation-3.png` });

  // 6. the schema tracker: block 1 solved, read against the engine, and the run is unchanged by looking
  await fresh.getByTestId('show-schema').click();
  const parsed = parseSchema('1****1****1****1****', 20);
  if (!parsed.ok) throw new Error(parsed.message);
  await expect(fresh.locator('#schema-input')).toHaveValue('1****1****1****1****');
  const history = schemaHistory(original.run, parsed.symbols);
  await expect(fresh.getByTestId('schema-sentence')).toContainText(`Generation 3: ${history[3]!.instances === 0 ? 'none of the 50' : `${history[3]!.instances} of 50`}`);
  await fresh.screenshot({ path: `${shots}/classroom-5-schema-tracker.png` });
  await fresh.getByTestId('show-stage').click();
  expect(await rows(fresh)).toEqual(original.text(3));

  // 7. scrub back to generation 1: the screen shows what it showed then
  const scrub = fresh.getByTestId('scrub');
  await scrub.focus();
  await fresh.keyboard.press('PageUp');
  await fresh.keyboard.press('PageUp');
  await expect(scrub).toHaveAttribute('data-cycle', '1');
  await expect(heading(fresh)).toHaveText('Population · generation 1');
  expect(await rows(fresh)).toEqual(original.text(1));

  // 8. raise the mutation rate: the notice names what would go; confirming applies it from here
  await fresh.getByRole('button', { name: /Parameters/ }).click();
  await fresh.locator('#mutation-probability').fill('0.1');
  await fresh.locator('#mutation-probability').press('Enter');
  await expect(fresh.getByTestId('discard-notice')).toHaveText('Generations 2–3 will be discarded. The run continues from generation 1 with the new settings.');
  await fresh.screenshot({ path: `${shots}/classroom-6-notice.png` });
  await fresh.getByRole('button', { name: 'Discard and apply' }).click();
  await fresh.keyboard.press('Escape');
  await expect(fresh.getByText('recorded gens 0–1')).toBeVisible();

  // 9. continue: the later generations are the engine's with the same seed and the same change at the same point
  for (let g = 0; g < 2; g++) await fresh.keyboard.press('g');
  await expect(heading(fresh)).toHaveText('Population · generation 3');
  const changed = engineOf(looseFile.options, looseFile.params, looseFile.seed, looseFile.setup.init);
  changed.run.forwardCycle();
  changed.run.setParameters({ ...looseFile.params, mutation: { ...looseFile.params.mutation, probability: 0.1 } });
  for (let g = 0; g < 2; g++) changed.run.forwardCycle();
  expect(await rows(fresh)).toEqual(changed.text(3));
  expect(changed.text(3)).not.toEqual(original.text(3));
  await fresh.screenshot({ path: `${shots}/classroom-7-after-change.png` });

  // the same at the smaller laptop size
  await fresh.setViewportSize({ width: 1366, height: 768 });
  await fresh.screenshot({ path: `${shots}/classroom-8-1366x768.png` });
  expect(await fresh.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
});
