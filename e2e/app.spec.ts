import { expect, test, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { gaAlgorithm } from '../src/engine';
import { createRun } from '../src/run';
import { defaultParams, defaultSeed, defaultSetup } from '../src/ui/config';

const url = pathToFileURL(resolve('dist/index.html')).href;

/** The engine's own population for the default configuration, so the screen is checked against the algorithm, not against itself. */
const engine = (generations: number) => {
  const run = createRun(gaAlgorithm, { setup: defaultSetup, params: defaultParams, seed: defaultSeed });
  run.runUntil((s) => s.cycle === generations);
  return run.snapshot(generations).state.population.map((i) => ({ id: i.id, bits: i.chromosome.join(''), x: i.decoded, fitness: i.fitness }));
};

const rows = async (page: Page) => {
  const body = populationTable(page).locator('tbody tr');
  return body.evaluateAll((trs) =>
    trs.map((tr) => ({
      id: Number(tr.querySelector('[data-col="id"]')!.textContent!.replace(/\D/g, '')),
      bits: tr.querySelector('[data-bits]')!.getAttribute('data-bits')!,
      x: Number(tr.querySelector('[data-col="x"]')!.textContent),
      fitness: Number(tr.querySelector('[data-col="fitness"]')!.textContent),
    })),
  );
};
const populationTable = (page: Page) => page.getByRole('table', { name: /^(Population|Parents) · generation \d+$/ });
const title = (page: Page) => page.getByRole('heading', { level: 2, name: /^(Population|Parents) · generation \d+$/ });
const button = (page: Page, name: string | RegExp) => page.getByRole('button', { name, exact: typeof name === 'string' });

test.beforeEach(async ({ page }) => {
  await page.goto(url);
});

test('opens on the seeded initial population, paused, with the six stages and the default controls', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Goldberg');
  for (const stage of ['Selection', 'Pairing', 'Crossover', 'Mutation', 'Evaluation', 'Replacement']) {
    await expect(page.getByTestId('ribbon').getByText(stage, { exact: true })).toBeVisible();
  }
  await expect(title(page)).toHaveText('Population · generation 0');
  expect(await rows(page)).toEqual(engine(0));
  await expect(page.getByTestId('seed')).toHaveText('42');
  await expect(button(page, 'Run')).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Paused');
});

test('the population table is a real table with column headers', async ({ page }) => {
  const headers = await page.getByRole('columnheader').allTextContents();
  expect(headers.map((h) => h.trim().toLowerCase())).toEqual(expect.arrayContaining(['chromosome', 'x', 'fitness', 'weight', 'prob.']));
});

test('pressing Generation three times shows the engine’s population for generation 3, each time', async ({ page }) => {
  for (let generation = 1; generation <= 3; generation++) {
    await button(page, /^Generation/).click();
    await expect(title(page)).toHaveText(`Population · generation ${generation}`);
    expect(await rows(page)).toEqual(engine(generation));
  }
});

test('stepping by micro-step, by stage and by generation reaches the same screen', async ({ page, browser }) => {
  const reach = async (p: Page, step: string | RegExp) => {
    for (let n = 0; n < 200; n++) {
      if ((await title(p).textContent()) === 'Population · generation 2') return;
      await button(p, step).click();
    }
    throw new Error('never reached generation 2');
  };
  const results = [];
  for (const step of [/^Micro-step/, /^Stage/, /^Generation/]) {
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const p = await context.newPage();
    await p.goto(url);
    await reach(p, step);
    results.push(await rows(p));
    await context.close();
  }
  expect(results[0]).toEqual(engine(2));
  expect(results[1]).toEqual(results[0]);
  expect(results[2]).toEqual(results[0]);
});

test('inside a generation the table shows the parents, with weights and parent counts as selection is revealed', async ({ page }) => {
  await button(page, /^Micro-step/).click(); // generation 1, selection entered
  await expect(title(page)).toHaveText('Parents · generation 0');
  expect(await rows(page)).toEqual(engine(0));
  await expect(populationTable(page).locator('tbody tr').first().locator('[data-col="weight"]')).not.toHaveText('—');
  await expect(populationTable(page).locator('tbody tr').first().locator('[data-col="parent"]')).toHaveText('—'); // no spin yet

  await button(page, /^Micro-step/).click(); // first spin
  const counts = await populationTable(page).locator('[data-col="parent"]').allTextContents();
  expect(counts.filter((c) => c.includes('×1'))).toHaveLength(1);
});

test('the narration line says in a sentence what the latest micro-step did', async ({ page }) => {
  for (let k = 0; k < 5; k++) await button(page, /^Stage/).click(); // selection, pairing, crossover, mutation, then evaluation, each to its end
  await expect(page.getByRole('heading', { level: 2, name: /Evaluation/ })).toBeVisible();
  await expect(page.getByTestId('narration')).toContainText('Offspring 6:');
  await expect(page.getByTestId('narration')).toContainText('Micro-step 6 of 6');
});

test('Run plays on, Pause freezes it, and Reset returns to the same start', async ({ page }) => {
  await page.getByRole('slider', { name: /speed/i }).fill('2'); // fast: one generation per tick
  await button(page, 'Run').click();
  await expect(page.getByRole('status')).toContainText('Playing');
  await expect(title(page)).toHaveText(/generation [2-9]/, { timeout: 10_000 });

  await button(page, 'Pause').click();
  const frozen = await title(page).textContent();
  await page.waitForTimeout(1200);
  expect(await title(page).textContent()).toBe(frozen);

  await button(page, 'Reset').click();
  await expect(title(page)).toHaveText('Population · generation 0');
  expect(await rows(page)).toEqual(engine(0));
  await expect(page.getByTestId('seed')).toHaveText('42');
});

test('New seed restarts with a different seed and a different population', async ({ page }) => {
  const before = await rows(page);
  await button(page, 'New seed').click();
  await expect(page.getByTestId('seed')).not.toHaveText('42');
  await expect(title(page)).toHaveText('Population · generation 0');
  expect(await rows(page)).not.toEqual(before);
});

test('Run until stop jumps to the end of the generation where a stop criterion first holds', async ({ page }) => {
  await button(page, 'Run until stop').click();
  await expect(page.getByRole('status')).toContainText(/stop/i);
  await expect(title(page)).toHaveText(/^Population · generation \d+$/);
});

test('buttons that belong to later tickets are visibly disabled rather than pretending to work', async ({ page }) => {
  await expect(button(page, /Parameters/)).toBeDisabled();
  await expect(button(page, /Projector/)).toBeDisabled();
});

test('the dark theme can be switched on and back', async ({ page }) => {
  await button(page, /Dark/).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await button(page, /Light/).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('the whole screen scales to fit a smaller window without scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  const overflow = await page.evaluate(() => ({ x: document.documentElement.scrollWidth - innerWidth, y: document.documentElement.scrollHeight - innerHeight }));
  expect(overflow.x).toBeLessThanOrEqual(0);
  expect(overflow.y).toBeLessThanOrEqual(0);
});
