import { expect, test, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { formatGenes, gaAlgorithm, type GaParams, type MutationEvent } from '../src/engine';
import { createRun } from '../src/run';
import { entryOf } from '../src/ui/problems';
import { configOf, encodeConfig } from '../src/ui/run-config';

const url = pathToFileURL(resolve('dist/index.html')).href;
const entry = entryOf('target-string')!;
const options = entry.defaultOptions()!;
const problem = entry.create(options);
const text = (c: readonly number[]) => formatGenes(c, problem.alphabet);
const shown = (s: string) => s.replace(/ /g, '␣');
const round = (x: number) => Math.round(x * 1000) / 1000;

const withParams = (changes: Partial<GaParams>): GaParams => ({ ...entry.defaults.params, ...changes });
const engineRun = (params: GaParams, seed: number) => createRun(gaAlgorithm, { setup: { problem, init: entry.defaults.init }, params, seed });
const open = async (page: Page, params: GaParams, seed: number) => {
  await page.goto(url + encodeConfig(configOf({ problem, init: entry.defaults.init }, params, seed, 'target-string', options)));
  await expect(page.getByTestId('problem-button')).toHaveText(/Target string/);
};
/** Generation 1, jumped to the end of the stage with the given title. */
const toStageEnd = async (page: Page, count: number) => {
  await page.keyboard.press('ArrowRight'); // generation 1 begins
  for (let k = 0; k < count; k++) await page.keyboard.press('Shift+ArrowRight');
};
const mutationEvents = (params: GaParams, seed: number): MutationEvent[] => {
  const run = engineRun(params, seed);
  run.forwardCycle();
  return run.events(1).flatMap((e): MutationEvent[] => (e.stage === 'mutation' ? [e] : []));
};

for (const seed of [1, 7, 42, 2024]) {
  test(`per-gene mutation, seed ${seed}: every draw, replacement draw, old and new symbol and final string equals the engine’s`, async ({ page }) => {
    const params = withParams({ mutation: { enabled: true, mode: 'per-gene', probability: 0.2 } });
    await open(page, params, seed);
    await toStageEnd(page, 4); // selection, pairing, crossover and mutation complete
    await expect(page.getByRole('heading', { level: 2, name: /Mutation/ })).toBeVisible();
    const events = mutationEvents(params, seed);
    await expect(page.locator('.mcard[data-state="revealed"]')).toHaveCount(events.length);
    expect(events.flatMap((e) => e.flipped).length).toBeGreaterThan(0);

    for (const e of events) {
      const card = page.locator(`.mcard[data-offspring="${e.offspring}"]`);
      expect(await card.locator('.under').evaluateAll((els) => els.map((el) => Number(el.getAttribute('data-u'))))).toEqual(e.geneDraws!.map((d) => d.u));
      expect(await card.locator('.under.flag').evaluateAll((els) => els.map((el) => Number(el.getAttribute('data-gene'))))).toEqual(e.flipped);
      const bits = card.locator('[data-bits]');
      await expect(bits.nth(0)).toHaveAttribute('data-bits', text(e.before));
      await expect(bits.nth(1)).toHaveAttribute('data-bits', text(e.after));
      const labels = card.locator('[data-replacement]');
      await expect(labels).toHaveCount(e.replacements?.length ?? 0);
      for (const r of e.replacements ?? []) {
        await expect(card.locator(`[data-replacement="${r.gene}"]`)).toHaveText(`gene ${r.gene}: ${shown(text([r.from]))} → ${shown(text([r.to]))} (r = ${round(r.r)})`);
        expect(r.to).not.toBe(r.from);
      }
      if (e.decision === 'unchanged') await expect(card).toContainText('unchanged');
    }
  });
}

test('a bypass: with mutation off every offspring says so, shows no draws and keeps its string', async ({ page }) => {
  const params = withParams({ mutation: { enabled: false, mode: 'per-gene', probability: 0.1 } });
  await open(page, params, 42);
  await toStageEnd(page, 4);
  const events = mutationEvents(params, 42);
  await expect(page.locator('.mtable tr[data-state="revealed"]')).toHaveCount(events.length);
  await expect(page.getByText('bypassed: mutation is off')).toHaveCount(events.length);
  await expect(page.locator('.mutation .expl')).toContainText('Mutation is switched off');
  await expect(page.locator('.under')).toHaveCount(0);
  for (const e of events) {
    const row = page.locator(`tr[data-offspring="${e.offspring}"]`);
    await expect(row.locator('[data-bits]').nth(0)).toHaveAttribute('data-bits', text(e.before));
    await expect(row.locator('[data-bits]').nth(1)).toHaveAttribute('data-bits', text(e.after));
    expect(text(e.after)).toBe(text(e.before));
  }
});

test('per-individual mutation shows u, the chosen gene with its draw, and the replacement draw as recorded', async ({ page }) => {
  const params = withParams({ mutation: { enabled: true, mode: 'per-individual', probability: 0.7 } });
  await open(page, params, 5);
  await toStageEnd(page, 4);
  const events = mutationEvents(params, 5);
  expect(events.some((e) => e.decision === 'mutated')).toBe(true);
  expect(events.some((e) => e.decision === 'unchanged')).toBe(true);
  await expect(page.locator('.mtable tr[data-state="revealed"]')).toHaveCount(events.length);
  for (const e of events) {
    const row = page.locator(`tr[data-offspring="${e.offspring}"]`);
    await expect(row).toContainText(`u = ${round(e.individualDraw!.u)} ${e.chosenGene ? '<' : '≥'} pm 0.7`);
    await expect(row.locator('[data-bits]').nth(1)).toHaveAttribute('data-bits', text(e.after));
    if (!e.chosenGene) continue;
    await expect(row).toContainText(`gene ${e.chosenGene.gene} (r = ${round(e.chosenGene.r)})`);
    const rep = e.replacements![0]!;
    await expect(row.locator('[data-replacement]')).toHaveText(`gene ${rep.gene}: ${shown(text([rep.from]))} → ${shown(text([rep.to]))} (r = ${round(rep.r)})`);
  }
});

test('stepping one offspring at a time reveals its draws and result, and the narration quotes them', async ({ page }) => {
  const params = withParams({ mutation: { enabled: true, mode: 'per-gene', probability: 0.3 } });
  await open(page, params, 42);
  await toStageEnd(page, 3); // end of crossover
  await page.keyboard.press('ArrowRight'); // mutation entered, nothing drawn yet
  const events = mutationEvents(params, 42);
  await expect(page.locator('.mcard[data-state="pending"]')).toHaveCount(events.length);
  for (const [k, e] of events.entries()) {
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.mcard[data-state="revealed"]')).toHaveCount(k + 1);
    await expect(page.locator(`.mcard[data-offspring="${e.offspring}"]`)).toHaveAttribute('aria-current', 'true');
    for (const r of e.replacements ?? []) await expect(page.getByTestId('narration')).toContainText(`gene ${r.gene}: ${shown(text([r.from]))} → ${shown(text([r.to]))} (r = ${round(r.r)})`.replace(/␣/g, ' '));
  }
});

test('crossover cards show the letters with the target row, hatching and the cut line, equal to the engine’s children', async ({ page }) => {
  const params = withParams({ crossover: { enabled: true, operator: 'one-point', probability: 1 } });
  await open(page, params, 42);
  await toStageEnd(page, 3);
  await expect(page.getByRole('heading', { level: 2, name: /Crossover/ })).toBeVisible();
  const run = engineRun(params, 42);
  run.forwardCycle();
  const events = run.events(1).flatMap((e) => (e.stage === 'crossover' ? [e] : []));
  await expect(page.locator('.ccard[data-state="revealed"]')).toHaveCount(events.length);
  await expect(page.locator('.ccard [data-testid="target-row"]')).toHaveCount(events.length * 2);
  for (const [k, e] of events.entries()) {
    const card = page.locator(`.ccard[data-pair="${k + 1}"]`);
    for (const c of e.children) {
      const child = card.locator(`[data-child="${c.offspring}"] [data-bits]`);
      await expect(child).toHaveAttribute('data-bits', text(c.chromosome));
      await expect(child).toHaveAttribute('data-sources', c.sources.join(''));
      await expect(child).toHaveAttribute('data-cuts', String(e.cuts![0]));
    }
  }
  // the cut line sits right of the cell it follows, in the same place for every row of a column of the card
  for (const side of [0, 1]) {
    const geometry = await page.locator('.ccard').first().locator('.cside').nth(side).locator('.bit.cutafter').evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().right)));
    expect(geometry.length).toBeGreaterThan(1);
    expect(new Set(geometry).size).toBe(1);
  }
});

test('crossover switched off on letters: a labelled bypass with copies of the parents', async ({ page }) => {
  const params = withParams({ crossover: { enabled: false, operator: 'one-point', probability: 0.8 } });
  await open(page, params, 42);
  await toStageEnd(page, 3);
  await expect(page.getByText('BYPASS').first()).toBeVisible();
  const cards = page.locator('.ccard[data-state="revealed"]');
  const n = await cards.count();
  expect(n).toBeGreaterThan(0);
  for (let k = 0; k < n; k++) {
    const card = cards.nth(k);
    const [a, b] = await card.locator('.cside').first().locator('[data-bits]').evaluateAll((els) => els.map((el) => el.getAttribute('data-bits')));
    const kids = await card.locator('.cside').nth(1).locator('[data-bits]').evaluateAll((els) => els.map((el) => el.getAttribute('data-bits')));
    expect(kids[0]).toBe(a);
    if (kids[1]) expect(kids[1]).toBe(b);
  }
});

test('the mutation cards’ draws line up under their letters and the target row above', async ({ page }) => {
  const params = withParams({ mutation: { enabled: true, mode: 'per-gene', probability: 0.2 } });
  await open(page, params, 42);
  await toStageEnd(page, 4);
  const card = page.locator('.mcard').first();
  const centres = await card.locator('.gcell').evaluateAll((els) =>
    els.map((el) => [el.querySelector('.bit')!, el.querySelector('.under')!].map((n) => Math.round(n.getBoundingClientRect().x + n.getBoundingClientRect().width / 2))),
  );
  for (const [letter, draw] of centres) expect(Math.abs(letter! - draw!)).toBeLessThanOrEqual(1);
  const target = await page.locator('.mcards .tgtrow span').evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().x + el.getBoundingClientRect().width / 2)));
  const letters = await card.locator('.bit').evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().x + el.getBoundingClientRect().width / 2)));
  target.forEach((x, k) => expect(Math.abs(x - letters[k]!)).toBeLessThanOrEqual(2));
  // the stage's rows fit inside the panel without sideways scrolling
  const overflow = await page.locator('.mwrap').evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
