import { expect, test, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { formatGenes, gaAlgorithm, handlings, type GaParams, type Handling, type KnapsackOptions } from '../src/engine';
import { createRun } from '../src/run';
import { describer } from '../src/ui/describe';
import { displayOf } from '../src/ui/format';
import { entryOf } from '../src/ui/problems';
import { configOf, encodeConfig } from '../src/ui/run-config';

const url = pathToFileURL(resolve('dist/index.html')).href;
const entry = entryOf('knapsack')!;

const setupOf = (handling: Handling, seed: number, params: GaParams = entry.defaults.params) => {
  const options = { ...(entry.defaultOptions() as KnapsackOptions), handling };
  const problem = entry.create(options);
  return { options, problem, setup: { problem, init: entry.defaults.init }, params, seed };
};
const open = async (page: Page, s: ReturnType<typeof setupOf>, projector = false) => {
  await page.goto('about:blank');
  await page.goto(url + encodeConfig(configOf(s.setup, s.params, s.seed, 'knapsack', s.options)));
  await expect(page.getByTestId('problem-button')).toHaveText(/Knapsack/);
  if (projector) await page.getByRole('button', { name: 'Projector mode' }).click();
};
/** Generation 1, to the start of its evaluation stage (nothing scored yet). */
const intoEvaluation = async (page: Page) => {
  await page.keyboard.press('ArrowRight');
  for (let k = 0; k < 4; k++) await page.keyboard.press('Shift+ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('heading', { level: 2, name: /Evaluation/ })).toBeVisible();
};

for (const handling of handlings) {
  for (const seed of [42, 7]) {
    test(`${handling}, seed ${seed}: one offspring at a time, the row, its “What happened” and the narration are what the engine recorded`, async ({ page }) => {
      const s = setupOf(handling, seed);
      await open(page, s);
      const run = createRun(gaAlgorithm, { setup: s.setup, params: s.params, seed });
      run.forwardCycle();
      const say = describer(displayOf(s.problem));
      const scored = run.events(1).flatMap((e) => (e.stage === 'evaluation' ? [e] : []));
      await intoEvaluation(page);
      await expect(page.locator('tr[data-offspring][data-state="pending"]')).toHaveCount(scored.length);
      let explained = 0;
      for (const [k, e] of scored.entries()) {
        await page.keyboard.press('ArrowRight');
        const row = page.locator(`tr[data-offspring="${e.offspring}"]`);
        await expect(row).toHaveAttribute('data-state', 'revealed');
        await expect(row.locator('[data-bits]')).toHaveAttribute('data-bits', formatGenes(e.individual.chromosome, s.problem.alphabet));
        const scores = { decoded: e.individual.decoded, objective: e.individual.objective, fitness: e.individual.fitness };
        for (const column of s.problem.columns) await expect(row.locator(`[data-col="${column.header.toLowerCase()}"]`)).toHaveText(column.show(scores));
        const why = s.problem.explainEvaluation!(e.repairedFrom ?? e.individual.chromosome);
        await expect(row.locator('[data-col="what happened"]')).toHaveText(why.summary);
        if (why.details.length > 0) explained++;
        await expect(page.getByTestId('narration')).toContainText(say(e));
        await expect(page.locator('tr[data-offspring][data-state="revealed"]')).toHaveCount(k + 1);
      }
      if (handling !== 'penalty') expect(explained).toBeGreaterThan(0); // some offspring really were skipped or repaired
      await expect(page.locator('.evaluation .expl')).toContainText(handling === 'penalty' ? 'Penalty:' : handling === 'decoder' ? 'First-fit decoder:' : handling === 'repair-lamarckian' ? 'Lamarckian repair:' : 'Baldwinian repair:');
    });
  }
}

test('the setup stage narrates the initial population, with what was skipped or repaired, one individual at a time going back', async ({ page }) => {
  for (const handling of ['decoder', 'repair-lamarckian'] as const) {
    const s = setupOf(handling, 42);
    await open(page, s);
    const run = createRun(gaAlgorithm, { setup: s.setup, params: s.params, seed: 42 });
    const say = describer(displayOf(s.problem));
    const setupEvents = run.events(0);
    // the screen opens at the end of the setup stage, showing the last individual's sentence; going back shows the earlier ones
    for (let k = setupEvents.length - 1; k >= setupEvents.length - 4; k--) {
      await expect(page.getByTestId('narration')).toContainText(say(setupEvents[k]!));
      await page.keyboard.press('ArrowLeft');
    }
    const sentences = setupEvents.map(say);
    if (handling === 'decoder') expect(sentences.some((t) => t.includes('skipped'))).toBe(true);
    else expect(sentences.some((t) => t.includes('repaired to'))).toBe(true);
  }
});

for (const projector of [false, true]) {
  for (const handling of handlings) {
    test(`${handling}${projector ? ' in projector mode' : ''}: the evaluation table, with its “What happened” column, never scrolls sideways`, async ({ page }) => {
      await open(page, setupOf(handling, 42), projector);
      await page.keyboard.press('ArrowRight');
      for (let k = 0; k < 4; k++) await page.keyboard.press('Shift+ArrowRight');
      for (let k = 0; k < 6; k++) await page.keyboard.press('ArrowRight');
      const [scroll, client] = await page.locator('.mwrap').first().evaluate((el) => [el.scrollWidth, el.clientWidth]);
      expect(scroll).toBeLessThanOrEqual(client);
      await expect(page.locator('.evaluation th', { hasText: 'What happened' })).toBeVisible();
    });
  }
}

test('the other problems have no “What happened” column', async ({ page }) => {
  await page.goto(url);
  await page.keyboard.press('ArrowRight');
  for (let k = 0; k < 4; k++) await page.keyboard.press('Shift+ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('heading', { level: 2, name: /Evaluation/ })).toBeVisible();
  await expect(page.locator('.evaluation th', { hasText: 'What happened' })).toHaveCount(0);
});
