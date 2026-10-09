import { expect, test, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { formatBits, gaAlgorithm } from '../src/engine';
import { createRun } from '../src/run';
import { defaultParams, defaultSeed, defaultSetup } from '../src/ui/config';
import { layoutsOf, positionAtX } from '../src/ui/scrub-model';

const url = pathToFileURL(resolve('dist/index.html')).href;

/** The engine's run of n generations, to say what the screen should show at any position. */
const engine = (n: number) => {
  const run = createRun(gaAlgorithm, { setup: defaultSetup, params: defaultParams, seed: defaultSeed });
  for (let g = 0; g < n; g++) run.forwardCycle();
  return run;
};

const generations = async (page: Page, n: number) => {
  for (let k = 0; k < n; k++) await page.getByRole('button', { name: /^Generation/ }).click();
};
const scrub = (page: Page) => page.getByTestId('scrub');

/** x of a point on the bar, as a fraction of its width, in the page's own pixels. */
const clickAtFraction = async (page: Page, fraction: number) => {
  const box = (await scrub(page).boundingBox())!;
  await page.mouse.click(box.x + box.width * fraction, box.y + box.height / 2);
};

/** What the screen should show at a position, from the engine alone. */
const expected = (run: ReturnType<typeof engine>, position: { cycle: number; stage: number; micro: number }) => {
  expect(run.moveTo(position)).toBe(true);
  const view = run.view();
  const atEnd = position.cycle === 0 || (position.stage === 5 && position.micro === run.layout(position.cycle)[5]!.micros);
  const state = atEnd ? view.after : view.before!;
  return {
    stage: view.stage,
    title: atEnd ? `Population · generation ${position.cycle}` : `Parents · generation ${position.cycle - 1}`,
    rows: state.population.map((i) => formatBits(i.chromosome)),
  };
};
const shown = async (page: Page) => ({
  rows: await page.getByRole('table', { name: /^(Population|Parents) · generation \d+$/ }).locator('tbody tr [data-bits]').evaluateAll((els) => els.map((el) => el.getAttribute('data-bits'))),
});

test.beforeEach(async ({ page }) => {
  await page.goto(url);
});

test('clicking the bar shows what the live run showed at that position', async ({ page }) => {
  await generations(page, 6);
  const run = engine(6);
  const layouts = layoutsOf(run);
  for (const fraction of [0.05, 0.3, 0.52, 0.8, 0.97]) {
    await clickAtFraction(page, fraction);
    const position = positionAtX(layouts, 1440, fraction * 1440);
    const want = expected(run, position);
    await expect(scrub(page)).toHaveAttribute('data-cycle', String(position.cycle));
    await expect(page.locator('#pop-heading')).toHaveText(want.title);
    expect((await shown(page)).rows).toEqual(want.rows);
    if (position.cycle > 0) await expect(page.locator('#stage-heading')).toContainText(new RegExp(`Stage ${position.stage + 1}`));
    await expect(scrub(page)).toHaveAttribute('data-live', 'false');
  }
});

test('dragging the thumb moves through the history, stage by stage', async ({ page }) => {
  await generations(page, 6);
  const box = (await scrub(page).boundingBox())!;
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width * 0.9, y);
  await page.mouse.down();
  const seen: number[] = [];
  for (const fraction of [0.75, 0.55, 0.35, 0.15]) {
    await page.mouse.move(box.x + box.width * fraction, y, { steps: 4 });
    seen.push(Number(await scrub(page).getAttribute('data-cycle')));
  }
  await page.mouse.up();
  expect(seen).toEqual([...seen].sort((a, b) => b - a));
  expect(seen[0]).toBeGreaterThan(seen[seen.length - 1]!);
  const final = positionAtX(layoutsOf(engine(6)), 1440, 0.15 * 1440);
  await expect(scrub(page)).toHaveAttribute('data-cycle', String(final.cycle));
});

test('the keyboard moves a micro-step, a generation, or to either end', async ({ page }) => {
  await generations(page, 3);
  await scrub(page).focus();
  const text = () => scrub(page).getAttribute('aria-valuetext');
  expect(await text()).toMatch(/^Generation 3, stage 6 Replacement, micro-step 1 of 1$/);
  await page.keyboard.press('ArrowLeft');
  expect(await text()).toBe('Generation 3, stage 6 Replacement entered');
  await page.keyboard.press('ArrowLeft');
  expect(await text()).toMatch(/^Generation 3, stage 5 Evaluation of offspring, micro-step 6 of 6$/);
  await page.keyboard.press('ArrowRight');
  expect(await text()).toBe('Generation 3, stage 6 Replacement entered');
  await page.keyboard.press('PageUp');
  expect(await scrub(page).getAttribute('data-cycle')).toBe('2');
  await page.keyboard.press('Home');
  expect(await text()).toBe('Generation 0, initial population');
  await page.keyboard.press('End');
  expect(await scrub(page).getAttribute('data-live')).toBe('true');
  expect(await scrub(page).getAttribute('data-cycle')).toBe('3');
  // at the live end, forward keys do not make a new generation
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('PageDown');
  await expect(page.getByText('recorded gens 0–3')).toBeVisible();
});

test('return to live is only available in the past, and goes to the end of the newest generation', async ({ page }) => {
  await generations(page, 4);
  const live = page.getByRole('button', { name: 'Return to live' });
  await expect(live).toBeDisabled();
  await clickAtFraction(page, 0.2);
  await expect(live).toBeEnabled();
  await live.click();
  await expect(live).toBeDisabled();
  await expect(scrub(page)).toHaveAttribute('data-cycle', '4');
  await expect(page.locator('#pop-heading')).toHaveText('Population · generation 4');
});

test('stepping forward through recorded generations replays them without changing them', async ({ page }) => {
  await generations(page, 5);
  const run = engine(5);
  const recorded = (g: number) => run.snapshot(g).state.population.map((i) => formatBits(i.chromosome));
  await clickAtFraction(page, 0.1); // inside generation 0 or 1
  await page.keyboard.press('Home');
  await page.getByRole('button', { name: /^Generation/ }).click(); // to the end of generation 0, where the cursor already is the start
  await expect(page.locator('#pop-heading')).toHaveText('Population · generation 0');
  await page.getByRole('button', { name: /^Generation/ }).click();
  await expect(page.locator('#pop-heading')).toHaveText('Population · generation 1');
  expect((await shown(page)).rows).toEqual(recorded(1));
  await page.getByRole('button', { name: /^Generation/ }).click();
  expect((await shown(page)).rows).toEqual(recorded(2));
  await expect(page.getByText('recorded gens 0–5')).toBeVisible();
});

test('playing from the past replays recorded generations at the chosen speed and keeps the history', async ({ page }) => {
  await generations(page, 5);
  const run = engine(5);
  await scrub(page).focus();
  await page.keyboard.press('Home');
  await page.getByRole('slider', { name: /speed/i }).fill('2'); // fast: one generation per tick
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await expect(page.locator('#pop-heading')).toHaveText(/generation [2-3]/, { timeout: 5000 });
  await page.getByRole('button', { name: 'Pause' }).click();
  const title = (await page.locator('#pop-heading').textContent())!;
  const g = Number(/generation (\d+)/.exec(title)![1]);
  expect(g).toBeLessThanOrEqual(5);
  expect((await shown(page)).rows).toEqual(run.snapshot(g).state.population.map((i) => formatBits(i.chromosome)));
  await expect(page.getByText('recorded gens 0–5')).toBeVisible();
});
