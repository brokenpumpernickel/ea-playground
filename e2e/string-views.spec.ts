import { expect, test, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { formatGenes, gaAlgorithm, type GaParams } from '../src/engine';
import { createRun } from '../src/run';
import { entryOf } from '../src/ui/problems';

const url = pathToFileURL(resolve('dist/index.html')).href;
const entry = entryOf('target-string')!;
const options = entry.defaultOptions()!;
const problem = entry.create(options);
const target = [...options.target];

const engineRun = (params: GaParams = entry.defaults.params) => createRun(gaAlgorithm, { setup: { problem, init: entry.defaults.init }, params, seed: entry.defaults.seed });
const text = (c: readonly number[]) => formatGenes(c, problem.alphabet);
const matches = (s: string) => [...s].filter((c, k) => c === target[k]).length;

const micro = (page: Page) => page.keyboard.press('ArrowRight');
const stageEnd = (page: Page) => page.keyboard.press('Shift+ArrowRight');
const tableCells = (page: Page) =>
  page.getByRole('table', { name: /^(Population|Parents) · generation \d+$/ }).locator('tbody tr').evaluateAll((trs) =>
    trs.map((tr) => ({ bits: tr.querySelector('[data-bits]')!.getAttribute('data-bits'), fitness: tr.querySelector('[data-col="fitness"]')!.textContent, matches: Number(tr.querySelector('[data-bits]')!.getAttribute('data-matches')), marked: tr.querySelectorAll('.bit.match').length, dashed: tr.querySelectorAll('.bit.miss').length })),
  );

test.beforeEach(async ({ page }) => {
  await page.goto(url);
  await page.getByTestId('problem-button').click();
  await page.getByRole('menuitemradio', { name: /Target string/ }).click();
  await page.getByRole('button', { name: 'Restart and apply' }).click();
});

test('the population table shows the engine’s strings with their matches, marked by shape, at every generation boundary and inside a generation', async ({ page }) => {
  const run = engineRun();
  for (let g = 1; g <= 4; g++) {
    run.forwardCycle();
    await page.keyboard.press('g');
    const rows = await tableCells(page);
    const want = run.snapshot(g).state.population;
    expect(rows.map((r) => r.bits)).toEqual(want.map((i) => text(i.chromosome)));
    expect(rows.map((r) => r.fitness)).toEqual(want.map((i) => `${i.objective} of 5`));
    for (const [k, row] of rows.entries()) {
      expect(row.matches).toBe(want[k]!.objective);
      expect(row.marked).toBe(want[k]!.objective); // filled cells are the matching positions
      expect(row.dashed).toBe(5 - want[k]!.objective); // the others have a dashed outline
      expect(row.matches).toBe(matches(row.bits!));
    }
  }
  // inside the next generation the table shows its parents, with the selection results counted as they arrive
  await micro(page);
  expect((await tableCells(page)).map((r) => r.bits)).toEqual(run.snapshot(4).state.population.map((i) => text(i.chromosome)));
});

test('the target is printed once above the table’s chromosomes and above the evaluation list, aligned with the cells', async ({ page }) => {
  await page.keyboard.press('g');
  const row = page.getByRole('table', { name: /^Population/ }).getByTestId('target-row');
  await expect(row).toHaveAttribute('aria-label', 'The target is HELLO');
  const letters = await row.locator('.tgtrow span').allTextContents();
  expect(letters).toEqual(['H', 'E', 'L', 'L', 'O']);
  // each target letter sits over its column of cells
  const header = await row.locator('.tgtrow span').evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().x + el.getBoundingClientRect().width / 2)));
  const cells = await page.getByRole('table', { name: /^Population/ }).locator('tbody tr').first().locator('.bit').evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().x + el.getBoundingClientRect().width / 2)));
  header.forEach((x, k) => expect(Math.abs(x - cells[k]!)).toBeLessThanOrEqual(2));
});

test('evaluation reveals one offspring at a time with its strings, matches and fitness, as the engine recorded', async ({ page }) => {
  const run = engineRun();
  run.forwardCycle();
  run.forwardCycle();
  await page.keyboard.press('g');
  await page.keyboard.press('g');
  await micro(page); // generation 3, selection entered
  for (let k = 0; k < 4; k++) await stageEnd(page); // to the end of mutation
  await micro(page); // evaluation entered
  await expect(page.getByRole('heading', { level: 2, name: /Evaluation/ })).toBeVisible();
  run.forwardCycle();
  const scored = run.events(3).flatMap((e) => (e.stage === 'evaluation' ? [e] : []));
  await expect(page.locator('tr[data-offspring][data-state="pending"]')).toHaveCount(scored.length);
  for (const [k, event] of scored.entries()) {
    await micro(page);
    const row = page.locator(`tr[data-offspring="${event.offspring}"]`);
    await expect(row).toHaveAttribute('data-state', 'revealed');
    await expect(row.locator('[data-bits]')).toHaveAttribute('data-bits', text(event.individual.chromosome));
    await expect(row.locator('[data-bits]')).toHaveAttribute('data-matches', String(event.individual.objective));
    await expect(row.locator('[data-col="fitness"]')).toHaveText(`${event.individual.objective} of 5`);
    await expect(row.locator('.bit.match')).toHaveCount(event.individual.objective);
    await expect(page.getByTestId('narration')).toContainText(`${event.individual.objective} of 5 positions match → fitness ${event.individual.fitness}`);
    await expect(page.locator('tr[data-offspring][data-state="revealed"]')).toHaveCount(k + 1);
  }
  await expect(page.locator('.evaluation .expl')).toContainText('how many positions match');
});

test('replacement shows the engine’s next population, with and without elites and truncation', async ({ page }) => {
  for (const config of [
    { elites: 0, truncation: undefined },
    { elites: 2, truncation: 14 },
  ]) {
    await page.reload();
    await page.getByTestId('problem-button').click();
    await page.getByRole('menuitemradio', { name: /Target string/ }).click();
    await page.getByRole('button', { name: 'Restart and apply' }).click();
    const params: GaParams = { ...entry.defaults.params, elites: config.elites, ...(config.truncation ? { truncation: { enabled: true, lambda: config.truncation } } : {}) };
    const run = engineRun(params);

    await page.getByRole('button', { name: /Parameters/ }).click();
    await page.locator('#elites').fill(String(config.elites));
    await page.locator('#elites').press('Enter');
    if (config.truncation) {
      await page.locator('#truncation-on').check();
      await page.locator('#truncation-lambda').fill(String(config.truncation));
      await page.locator('#truncation-lambda').press('Enter');
    }
    await page.keyboard.press('Escape');
    await page.keyboard.press('g'); // generation 1 is made with the new settings
    run.forwardCycle();
    await page.keyboard.press('Shift+ArrowLeft'); // back to the end of evaluation, before the replacement
    await page.keyboard.press('ArrowRight'); // replacement entered
    await expect(page.getByRole('heading', { level: 2, name: /Replacement/ })).toBeVisible();
    await micro(page);

    const replacement = run.events(1).flatMap((e) => (e.stage === 'replacement' ? [e] : []))[0]!;
    const next = page.locator('[data-next]');
    await expect(next).toHaveCount(12);
    expect(await next.evaluateAll((els) => els.map((el) => el.getAttribute('data-next')))).toEqual(replacement.population.map(String));
    expect(await next.locator('[data-bits]').evaluateAll((els) => els.map((el) => el.getAttribute('data-bits')))).toEqual(
      run.snapshot(1).state.population.map((i) => text(i.chromosome)),
    );
    await expect(page.locator('[data-next][data-source="elite"]')).toHaveCount(config.elites);
    if (replacement.ranking) {
      await expect(page.locator('[data-offspring][data-fate="discarded"]')).toHaveCount(replacement.ranking.filter((r) => !r.kept).length);
      await expect(page.locator('[data-offspring][data-fate="survives"]')).toHaveCount(replacement.ranking.filter((r) => r.kept).length);
    } else {
      await expect(page.locator('[data-offspring][data-fate="survives"]')).toHaveCount(12);
    }
    // the target row is shown above each list (the old population is the table beside the stage), and every cell is marked by its own letter
    await expect(page.locator('.replacement [data-testid="target-row"]')).toHaveCount(2);
    await expect(page.getByRole('region', { name: 'Old population' })).toHaveCount(0);
    await expect(page.locator('.replacement .expl')).toContainText('The old population is in the table on the right.');
    const cells = page.locator('.replacement .bits');
    const count = await cells.count();
    for (let k = 0; k < count; k++) {
      const bits = (await cells.nth(k).getAttribute('data-bits'))!;
      expect(Number(await cells.nth(k).getAttribute('data-matches'))).toBe(matches(bits));
    }
  }
});

test('selection, pairing and tournament views draw the strings with their matches too', async ({ page }) => {
  await page.keyboard.press('g');
  await micro(page); // selection entered
  await micro(page); // first tournament
  const tournament = page.locator('[data-tournament][data-state="revealed"]').first();
  await expect(tournament.locator('[data-bits]').first()).toHaveAttribute('data-matches', /^\d$/);
  await stageEnd(page);
  await stageEnd(page); // end of pairing
  await expect(page.locator('.pgrid [data-bits]').first()).toHaveAttribute('data-matches', /^\d$/);
  await expect(page.locator('.pgrid')).not.toContainText('x =');
});

test('the narration and event sentences say matches, never x', async ({ page }) => {
  await page.keyboard.press('g');
  for (let k = 0; k < 4; k++) await stageEnd(page);
  await micro(page);
  await micro(page);
  const narration = await page.getByTestId('narration').textContent();
  expect(narration).toMatch(/positions match → fitness \d/);
  expect(narration).not.toContain('x =');
});
