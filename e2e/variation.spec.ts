import { expect, test, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { formatBits, gaAlgorithm } from '../src/engine';
import { createRun } from '../src/run';
import { defaultParams, defaultSeed, defaultSetup } from '../src/ui/config';

const url = pathToFileURL(resolve('dist/index.html')).href;
const num = (v: number) => String(Math.round(v * 1000) / 1000);

/** The engine's own record of generation 1 for the default configuration. */
const generation = (seed = defaultSeed) => {
  const run = createRun(gaAlgorithm, { setup: defaultSetup, params: defaultParams, seed });
  run.forwardCycle();
  const events = run.events(1);
  return {
    crossover: events.flatMap((e) => (e.stage === 'crossover' ? [e] : [])),
    mutation: events.flatMap((e) => (e.stage === 'mutation' ? [e] : [])),
  };
};

const micro = (page: Page) => page.getByRole('button', { name: /^Micro-step/ });
const stage = (page: Page) => page.getByRole('button', { name: /^Stage/ });

/** Enters generation 1's crossover (stagesToSkip = 2: selection and pairing) or mutation (3) stage, before its first micro-step. */
const enter = async (page: Page, stagesToSkip: number) => {
  await micro(page).click(); // generation 1, selection entered
  for (let k = 0; k < stagesToSkip; k++) await stage(page).click();
  await micro(page).click(); // the next stage, entered
};


type Events = ReturnType<typeof generation>;

/** Steps through the crossover stage one pair at a time and checks every card against the engine's events. */
const checkCrossover = async (page: Page, crossover: Events['crossover']) => {
  for (let k = 1; k <= crossover.length; k++) {
    await micro(page).click();
    const event = crossover[k - 1]!;
    const card = page.locator(`[data-pair="${k}"]`);
    await expect(card).toHaveAttribute('data-state', 'revealed');
    await expect(page.locator('[data-pair][data-state="revealed"]')).toHaveCount(k);

    // the draw against pc, and the decision, in words
    await expect(card).toContainText(`u = ${num(event.draw!.u)} ${event.decision === 'recombined' ? '<' : '≥'} pc ${num(event.draw!.threshold)}`);
    await expect(card).toContainText(event.decision === 'recombined' ? 'recombined' : 'BYPASS');

    // each child: chromosome, which parent each gene came from, and where the cut is
    for (const child of event.children) {
      const row = card.locator(`[data-child="${child.offspring}"]`);
      const bits = row.locator('[data-bits]');
      await expect(bits).toHaveAttribute('data-bits', formatBits(child.chromosome));
      await expect(bits).toHaveAttribute('data-sources', child.sources.join(''));
      if (event.cuts) await expect(bits).toHaveAttribute('data-cuts', event.cuts.join(','));
      else await expect(bits).not.toHaveAttribute('data-cuts');
      // the hatching is what the eye reads: one hatched cell per gene taken from parent B
      await expect(row.locator('.bit.hatch')).toHaveCount(child.sources.filter((src) => src === 'B').length);
      if (event.decision === 'bypassed') await expect(row).toContainText(child.sources[0] === 'A' ? 'copy of A' : 'copy of B');
      if (child.discarded) await expect(row).toContainText('dropped');
    }
    if (event.cuts) await expect(card).toContainText(`cut after gene ${event.cuts[0]}`);
  }
};

/** Steps through the mutation stage one offspring at a time and checks every row against the engine's events. */
const checkMutation = async (page: Page, mutation: Events['mutation']) => {
  for (let k = 1; k <= mutation.length; k++) {
    await micro(page).click();
    const event = mutation[k - 1]!;
    const row = page.locator(`tr[data-offspring="${event.offspring}"]`);
    await expect(row).toHaveAttribute('data-state', 'revealed');

    for (const draw of event.geneDraws!) {
      const cell = row.locator(`td[data-gene="${draw.gene}"]`);
      await expect(cell).toContainText(num(draw.u));
      // flipped cells carry a symbol and an outline class, not just a colour
      if (draw.flipped) {
        await expect(cell).toHaveClass(/flipcell/);
        await expect(cell).toContainText('✱');
      } else {
        await expect(cell).not.toHaveClass(/flipcell/);
      }
    }
    const result = row.locator('td.result [data-bits]');
    await expect(result).toHaveAttribute('data-bits', formatBits(event.after));
    if (event.flipped.length > 0) {
      await expect(result).toHaveAttribute('data-flipped', event.flipped.join(','));
      await expect(row.locator('td.result')).toContainText(/✱ genes? /);
    } else {
      await expect(result).not.toHaveAttribute('data-flipped');
      await expect(row.locator('td.result')).toContainText('unchanged');
    }
  }
};

test.beforeEach(async ({ page }) => {
  await page.goto(url);
});

test('crossover waits for the first micro-step, and says what pc means', async ({ page }) => {
  const { crossover } = generation();
  await enter(page, 2);
  await expect(page.getByRole('heading', { level: 2, name: /Crossover/ })).toBeVisible();
  await expect(page.locator('[data-pair][data-state="pending"]')).toHaveCount(crossover.length);
  await expect(page.locator('.crossover .expl')).toContainText('u < pc (0.8)');
  await expect(page.locator('.crossover .expl')).toContainText('one-point');
});

test('each micro-step reveals one pair: its draw, decision, cut, and children with their inheritance, as the engine recorded', async ({ page }) => {
  await enter(page, 2);
  await checkCrossover(page, generation().crossover);
});

test('the newest pair stays fully visible inside the scrolling cards area', async ({ page }) => {
  const { crossover } = generation();
  await enter(page, 2);
  for (let k = 1; k <= crossover.length; k++) await micro(page).click();
  const grid = (await page.locator('.cgrid').boundingBox())!;
  const last = (await page.locator(`[data-pair="${crossover.length}"]`).boundingBox())!;
  expect(last.y).toBeGreaterThanOrEqual(grid.y - 1);
  expect(last.y + last.height).toBeLessThanOrEqual(grid.y + grid.height + 1);
});

test('mutation waits for the first micro-step, with each offspring as crossover left it, and says what pm means', async ({ page }) => {
  const { mutation, crossover } = generation();
  await enter(page, 3);
  await expect(page.getByRole('heading', { level: 2, name: /Mutation/ })).toBeVisible();
  await expect(page.locator('tr[data-offspring][data-state="pending"]')).toHaveCount(mutation.length);
  await expect(page.locator('.mutation .expl')).toContainText('u < pm (0.05)');
  const made = crossover.flatMap((e) => e.children).filter((c) => !c.discarded);
  for (const child of made) {
    await expect(page.locator(`tr[data-offspring="${child.offspring}"] [data-bits]`).first()).toHaveAttribute('data-bits', formatBits(child.chromosome));
  }
});

test('each micro-step reveals one offspring: every gene’s draw, the flipped genes, and the final chromosome, as the engine recorded', async ({ page }) => {
  await enter(page, 3);
  await checkMutation(page, generation().mutation);
});

test('over several fresh seeds the screen matches the engine, including bypassed pairs and flipped genes', async ({ page }) => {
  let sawBypass = false;
  let sawFlip = false;
  let sawNoFlip = false;
  for (let attempt = 0; attempt < 12 && !(sawBypass && sawFlip && sawNoFlip); attempt++) {
    await page.getByRole('button', { name: 'New seed' }).click();
    const seed = Number(await page.getByTestId('seed').textContent());
    const { crossover, mutation } = generation(seed);

    await enter(page, 2);
    await checkCrossover(page, crossover);
    await micro(page).click(); // the last pair was the end of crossover, so this enters mutation
    await checkMutation(page, mutation);

    sawBypass ||= crossover.some((e) => e.decision === 'bypassed');
    sawFlip ||= mutation.some((e) => e.flipped.length > 0);
    sawNoFlip ||= mutation.some((e) => e.flipped.length === 0);
  }
  expect(sawBypass).toBe(true);
  expect(sawFlip).toBe(true);
  expect(sawNoFlip).toBe(true);
});

test('the offspring shown at the end of mutation are the engine’s offspring', async ({ page }) => {
  const { mutation } = generation();
  await enter(page, 3);
  await stage(page).click(); // end of mutation
  const shown = await page.locator('tr[data-offspring] td.result [data-bits]').evaluateAll((els) => els.map((el) => el.getAttribute('data-bits')));
  expect(shown).toEqual(mutation.map((e) => formatBits(e.after)));
});
