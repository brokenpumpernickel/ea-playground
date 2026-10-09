import { expect, test, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { formatBits, gaAlgorithm } from '../src/engine';
import { createRun } from '../src/run';
import { defaultParams, defaultSeed, defaultSetup } from '../src/ui/config';

const url = pathToFileURL(resolve('dist/index.html')).href;

/** The engine's own record of generation 1 for the default configuration. */
const generation = (seed = defaultSeed) => {
  const run = createRun(gaAlgorithm, { setup: defaultSetup, params: defaultParams, seed });
  run.forwardCycle();
  const events = run.events(1);
  return {
    before: run.snapshot(0).state.population,
    after: run.snapshot(1).state.population,
    evaluation: events.flatMap((e) => (e.stage === 'evaluation' ? [e] : [])),
    replacement: events.flatMap((e) => (e.stage === 'replacement' ? [e] : []))[0]!,
  };
};

const micro = (page: Page) => page.getByRole('button', { name: /^Micro-step/ });
const stage = (page: Page) => page.getByRole('button', { name: /^Stage/ });

/** Enters generation 1's evaluation (stagesToSkip = 4) or replacement (5) stage, before its first micro-step. */
const enter = async (page: Page, stagesToSkip: number) => {
  await micro(page).click(); // generation 1, selection entered
  for (let k = 0; k < stagesToSkip; k++) await stage(page).click();
  await micro(page).click(); // the next stage, entered
};

test.beforeEach(async ({ page }) => {
  await page.goto(url);
});

test('evaluation scores one offspring per micro-step, as the engine recorded', async ({ page }) => {
  const { evaluation } = generation();
  await enter(page, 4);
  await expect(page.getByRole('heading', { level: 2, name: /Evaluation/ })).toBeVisible();
  await expect(page.locator('tr[data-offspring][data-state="pending"]')).toHaveCount(evaluation.length);
  for (let k = 1; k <= evaluation.length; k++) {
    await micro(page).click();
    const i = evaluation[k - 1]!.individual;
    const row = page.locator(`tr[data-offspring="${evaluation[k - 1]!.offspring}"]`);
    await expect(row).toHaveAttribute('data-state', 'revealed');
    await expect(row.locator('[data-bits]')).toHaveAttribute('data-bits', formatBits(i.chromosome));
    await expect(row.locator('[data-col="x"]')).toHaveText(String(i.decoded));
    await expect(row.locator('[data-col="objective"]')).toHaveText(String(i.objective));
    await expect(row.locator('[data-col="fitness"]')).toHaveText(String(i.fitness));
    await expect(row.locator('[data-col="id"]')).toHaveText(`individual ${i.id}`);
    await expect(page.locator('tr[data-offspring][data-state="revealed"]')).toHaveCount(k);
  }
});

test('replacement waits for its step, then shows the engine’s next population with every offspring surviving', async ({ page }) => {
  const { before, after, evaluation, replacement } = generation();
  await enter(page, 5);
  await expect(page.getByRole('heading', { level: 2, name: /Replacement/ })).toBeVisible();
  await expect(page.locator('.replacement')).toContainText('Not decided yet');
  await expect(page.locator('[data-old]')).toHaveCount(before.length);
  await expect(page.locator('[data-next]')).toHaveCount(0);

  await micro(page).click();
  await expect(page.locator('.replacement')).toHaveAttribute('data-state', 'revealed');
  const next = page.locator('[data-next]');
  await expect(next).toHaveCount(replacement.population.length);
  expect(await next.evaluateAll((els) => els.map((el) => el.getAttribute('data-next')))).toEqual(replacement.population.map(String));
  expect(await next.locator('[data-bits]').evaluateAll((els) => els.map((el) => el.getAttribute('data-bits')))).toEqual(after.map((i) => formatBits(i.chromosome)));
  // default configuration: no elites, no truncation
  await expect(page.locator('[data-fate="elite"]')).toHaveCount(0);
  await expect(page.locator('[data-old][data-fate="replaced"]')).toHaveCount(before.length);
  await expect(page.locator('[data-offspring][data-fate="survives"]')).toHaveCount(evaluation.length);
  await expect(page.locator('[data-fate="discarded"]')).toHaveCount(0);
});

test('the population table agrees with the replacement view once the generation is complete', async ({ page }) => {
  const { after } = generation();
  await enter(page, 5);
  await micro(page).click();
  const table = page.getByRole('table', { name: /^Population · generation 1$/ });
  const shown = await table.locator('tbody tr [data-bits]').evaluateAll((els) => els.map((el) => el.getAttribute('data-bits')));
  expect(shown).toEqual(after.map((i) => formatBits(i.chromosome)));
});
