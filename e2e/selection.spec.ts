import { expect, test, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { gaAlgorithm } from '../src/engine';
import { createRun } from '../src/run';
import { defaultParams, defaultSeed, defaultSetup } from '../src/ui/config';

const url = pathToFileURL(resolve('dist/index.html')).href;

/** The engine's own record of generation 1 for the default configuration. */
const generation = () => {
  const run = createRun(gaAlgorithm, { setup: defaultSetup, params: defaultParams, seed: defaultSeed });
  run.forwardCycle();
  const events = run.events(1);
  return {
    spins: events.flatMap((e) => (e.stage === 'selection' && e.kind === 'spin' ? [e] : [])),
    probabilities: events.flatMap((e) => (e.stage === 'selection' && e.kind === 'probabilities' ? [e] : []))[0]!,
    pairs: events.flatMap((e) => (e.stage === 'pairing' ? [e] : [])),
  };
};

const micro = (page: Page) => page.getByRole('button', { name: /^Micro-step/ });
const stage = (page: Page) => page.getByRole('button', { name: /^Stage/ });
const num = (v: number) => String(Math.round(v * 1000) / 1000);

test.beforeEach(async ({ page }) => {
  await page.goto(url);
});

test('stepping through selection reveals one spin at a time, with its pin, its row and its pool slot', async ({ page }) => {
  const { spins } = generation();
  await micro(page).click(); // generation 1: selection entered, nothing drawn yet
  await expect(page.getByTestId('spin-chips').locator('li')).toHaveCount(spins.length);
  await expect(page.getByTestId('spin-chips')).toContainText('1: not drawn');
  await expect(page.locator('[data-pin]')).toHaveCount(0);
  expect(await page.getByTestId('mating-pool').locator('li').evaluateAll((lis) => lis.map((li) => li.getAttribute('data-id')))).toEqual(spins.map(() => ''));

  for (let k = 1; k <= spins.length; k++) {
    await micro(page).click();
    const spin = spins[k - 1]!;
    await expect(page.getByTestId('spin-chips').locator('li').nth(k - 1)).toHaveText(`${k}: r = ${num(spin.r)} → ${spin.individualId}`);
    await expect(page.locator('[data-pin]')).toHaveCount(k);
    await expect(page.locator(`tr.hl[data-row="${spin.individualId}"]`)).toBeVisible();
    const pool = await page.getByTestId('mating-pool').locator('li').evaluateAll((lis) => lis.map((li) => li.getAttribute('data-id')));
    expect(pool).toEqual(spins.map((s, i) => (i < k ? String(s.individualId) : '')));
  }
});

test('the weight table shows the engine’s probabilities and intervals', async ({ page }) => {
  const { probabilities } = generation();
  await micro(page).click();
  const rows = await page.getByRole('table', { name: /Selection weights/ }).locator('tbody tr').evaluateAll((trs) =>
    trs.map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent!.trim())),
  );
  expect(rows).toHaveLength(probabilities.entries.length);
  probabilities.entries.forEach((entry, k) => {
    const cells = rows[k]!;
    expect(cells[0]).toBe(String(entry.individualId));
    expect(cells.at(-2)).toBe(entry.probability.toFixed(3));
    expect(cells.at(-1)).toBe(`[${entry.lo.toFixed(3)}, ${entry.hi.toFixed(3)})`);
  });
});

test('the finished mating pool equals the engine’s, and the wheel has one slice per individual', async ({ page }) => {
  const { spins, probabilities } = generation();
  await micro(page).click();
  await stage(page).click(); // to the end of selection
  const pool = await page.getByTestId('mating-pool').locator('li').evaluateAll((lis) => lis.map((li) => li.getAttribute('data-id')));
  expect(pool).toEqual(spins.map((s) => String(s.individualId)));
  await expect(page.locator('svg path.slice')).toHaveCount(probabilities.entries.length);
  await expect(page.getByRole('img', { name: /^Roulette wheel/ })).toBeVisible();
});

test('the latest pin ends up exactly where the draw says, after its sweep', async ({ page }) => {
  const { spins } = generation();
  await micro(page).click();
  await micro(page).click();
  const r = spins[0]!.r;
  const expected = { x: 170 + 146 * Math.sin(2 * Math.PI * r), y: 170 - 146 * Math.cos(2 * Math.PI * r) };
  await expect(page.locator('svg[data-animated="true"]')).toBeVisible(); // slow tier animates
  await page.waitForTimeout(1300); // longer than the sweep
  const circle = page.locator('[data-pin="1"][data-current="true"] circle');
  expect(Number(await circle.getAttribute('cx'))).toBeCloseTo(expected.x, 0);
  expect(Number(await circle.getAttribute('cy'))).toBeCloseTo(expected.y, 0);
});

test('faster tiers and reduced motion do not animate, but show the same result', async ({ page, browser }) => {
  await page.getByRole('slider', { name: /speed/i }).fill('1'); // medium: no per-spin animation
  await micro(page).click();
  await micro(page).click();
  await expect(page.locator('svg[data-animated="false"]')).toBeVisible();

  const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1920, height: 1080 } });
  const calm = await context.newPage();
  await calm.goto(url);
  await micro(calm).click();
  await micro(calm).click();
  await expect(calm.locator('svg[data-animated="false"]')).toBeVisible();
  await expect(calm.getByTestId('spin-chips').locator('li').first()).toHaveText(new RegExp(`^1: r = ${num(generation().spins[0]!.r)} →`));
  await context.close();
});

test('pairing reveals one pair per micro-step, equal to the engine’s pairs', async ({ page }) => {
  const { pairs, spins } = generation();
  await micro(page).click();
  await stage(page).click(); // end of selection
  await micro(page).click(); // pairing entered
  await expect(page.getByRole('heading', { level: 2, name: /Pairing/ })).toBeVisible();
  await expect(page.locator('[data-state="pending"]')).toHaveCount(pairs.length);

  for (let k = 1; k <= pairs.length; k++) {
    await micro(page).click();
    await expect(page.locator('[data-state="revealed"]')).toHaveCount(k);
    const card = page.getByRole('region', { name: `Pair ${k}` });
    const pair = pairs[k - 1]!;
    await expect(card).toContainText(`slot ${pair.slotA} ← individual ${pair.parentAId}`);
    await expect(card).toContainText(`slot ${pair.slotB} ← individual ${pair.parentBId}`);
  }
  const pool = await page.getByTestId('mating-pool').locator('li').evaluateAll((lis) => lis.map((li) => li.getAttribute('data-id')));
  expect(pool).toEqual(spins.map((s) => String(s.individualId)));

  // the newest pair must be fully visible inside its scrolling area, not hidden below it
  const grid = (await page.locator('.pgrid').boundingBox())!;
  const last = (await page.getByRole('region', { name: `Pair ${pairs.length}` }).boundingBox())!;
  expect(last.y).toBeGreaterThanOrEqual(grid.y - 1);
  expect(last.y + last.height).toBeLessThanOrEqual(grid.y + grid.height + 1);
});

test('the population table counts the parents as selection proceeds, and agrees with the pool', async ({ page }) => {
  const { spins } = generation();
  await micro(page).click();
  await stage(page).click();
  const table = page.getByRole('table', { name: /^Parents · generation 0$/ });
  for (const id of new Set(spins.map((s) => s.individualId))) {
    const n = spins.filter((s) => s.individualId === id).length;
    await expect(table.locator('tbody tr').filter({ has: page.locator(`td[data-col="id"]`, { hasText: new RegExp(`^\\s*${id}$`) }) }).locator('[data-col="parent"]')).toContainText(`×${n}`);
  }
});
