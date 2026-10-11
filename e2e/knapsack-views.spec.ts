import { expect, test, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { formatGenes, gaAlgorithm, handlings, itemName, type GaParams, type Handling, type KnapsackOptions } from '../src/engine';
import { createRun } from '../src/run';
import { entryOf } from '../src/ui/problems';
import { configOf, encodeConfig } from '../src/ui/run-config';

const url = pathToFileURL(resolve('dist/index.html')).href;
const entry = entryOf('knapsack')!;

const setupOf = (handling: Handling, params: GaParams = entry.defaults.params, seed = 42) => {
  const options = { ...(entry.defaultOptions() as KnapsackOptions), handling };
  const problem = entry.create(options) as ReturnType<typeof entry.create> & { outcomeOf(c: readonly number[]): { packed: boolean[] } };
  const setup = { problem, init: entry.defaults.init };
  return { options, problem, setup, params, seed };
};
const open = async (page: Page, s: ReturnType<typeof setupOf>) => {
  await page.goto('about:blank');
  await page.goto(url + encodeConfig(configOf(s.setup, s.params, s.seed, 'knapsack', s.options)));
  await expect(page.getByTestId('problem-button')).toHaveText(/Knapsack/);
};
const tableRows = (page: Page) =>
  page.getByRole('table', { name: /^(Population|Parents) · generation \d+$/ }).locator('tbody tr').evaluateAll((trs) =>
    trs.map((tr) => ({
      bits: tr.querySelector('[data-bits]')!.getAttribute('data-bits')!,
      skipped: [...tr.querySelectorAll('.bit.skip')].map((el) => [...el.parentElement!.children].indexOf(el) + 1),
      cells: Object.fromEntries([...tr.querySelectorAll('td[data-col]')].map((td) => [td.getAttribute('data-col')!, td.textContent!.replace(/\s+/g, ' ').trim()])),
    })),
  );

for (const handling of handlings) {
  test(`${handling}: the table shows the engine’s chromosomes with their bag weight, value, penalty and fitness, and marks exactly the genes that are not packed`, async ({ page }) => {
    const s = setupOf(handling);
    await open(page, s);
    const run = createRun(gaAlgorithm, { setup: s.setup, params: s.params, seed: s.seed });
    for (let g = 0; g <= 4; g++) {
      if (g > 0) {
        await page.keyboard.press('g');
        run.forwardCycle();
      }
      const rows = await tableRows(page);
      const population = run.snapshot(g).state.population;
      expect(rows.map((r) => r.bits)).toEqual(population.map((i) => formatGenes(i.chromosome, s.problem.alphabet)));
      for (const [k, individual] of population.entries()) {
        const row = rows[k]!;
        const scores = { decoded: individual.decoded, objective: individual.objective, fitness: individual.fitness };
        for (const column of s.problem.columns) expect(row.cells[column.header.toLowerCase()]).toBe(column.show(scores));
        const packed = s.problem.outcomeOf(individual.chromosome).packed;
        const expected = individual.chromosome.flatMap((gene, i) => (gene === 1 && !packed[i] ? [i + 1] : []));
        expect(row.skipped).toEqual(expected);
      }
    }
    // the decoder and Baldwinian repair leave genes that are 1 but not packed; Lamarckian repair and the penalty never show any
    const anySkipped = (await tableRows(page)).some((r) => r.skipped.length > 0);
    if (handling === 'decoder' || handling === 'repair-baldwinian') expect(anySkipped).toBe(true);
    if (handling === 'penalty' || handling === 'repair-lamarckian') expect(anySkipped).toBe(false);
  });
}

test('the item row prints every item once above the table, with its weight and value, and lines up with the cells', async ({ page }) => {
  await open(page, setupOf('decoder'));
  const table = page.getByRole('table', { name: /^Population · generation 0$/ });
  const row = table.getByTestId('item-row');
  await expect(row).toHaveAttribute('aria-label', /^Items: A weighs 9 and is worth 4; B weighs 12 and is worth 20;/);
  const items = await row.locator('.itemrow > span').evaluateAll((els) => els.map((el) => [...el.children].map((c) => c.textContent)));
  expect(items).toEqual('ABCDEFGHIJKL'.split('').map((letter, i) => [letter, String([9, 12, 3, 3, 10, 14, 4, 5, 11, 7, 6, 13][i]), String([4, 20, 21, 17, 5, 23, 7, 14, 8, 12, 21, 19][i])]));
  const centre = (box: { x: number; width: number }) => Math.round(box.x + box.width / 2);
  const header = await row.locator('.itemrow > span').evaluateAll((els) => els.map((el) => ({ x: el.getBoundingClientRect().x, width: el.getBoundingClientRect().width })));
  const cells = await table.locator('tbody tr').first().locator('.bit').evaluateAll((els) => els.map((el) => ({ x: el.getBoundingClientRect().x, width: el.getBoundingClientRect().width })));
  expect(cells).toHaveLength(12);
  header.forEach((box, k) => expect(Math.abs(centre(box) - centre(cells[k]!))).toBeLessThanOrEqual(2));
});

test('the item row is above the evaluation list and the hand-edited table too, and the replacement view leaves the old population to the table', async ({ page }) => {
  const s = setupOf('penalty');
  await open(page, s);
  await page.keyboard.press('ArrowRight');
  for (let k = 0; k < 4; k++) await page.keyboard.press('Shift+ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('heading', { level: 2, name: /Evaluation/ })).toBeVisible();
  await expect(page.locator('.evaluation').getByTestId('item-row')).toHaveCount(1);
  await page.keyboard.press('Shift+ArrowRight'); // end of evaluation
  await page.keyboard.press('ArrowRight'); // replacement entered
  await expect(page.getByRole('heading', { level: 2, name: /Replacement/ })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Old population' })).toHaveCount(0);
  await expect(page.locator('.replacement').getByTestId('item-row')).toHaveCount(2);
  await page.getByRole('button', { name: /Parameters/ }).click();
  await page.locator('#init').selectOption('explicit');
  await expect(page.getByTestId('hand-population').getByTestId('item-row')).toHaveCount(1);
});

test('the knapsack table has no room for the selection columns, so Weight and Prob. appear only with roulette weights and the parent count sits beside the number', async ({ page }) => {
  const tournament = setupOf('decoder');
  await open(page, tournament);
  await page.keyboard.press('g');
  const header = () => page.getByRole('table', { name: /^Population · generation 1$/ }).getByRole('columnheader').allTextContents();
  expect((await header()).map((h) => h.replace(/of 48/, '').trim().split(/\s/)[0])).toEqual(['#', 'Chromosomeitemweightvalue', 'Bag', 'Value', 'Fitness']);
  await page.keyboard.press('ArrowRight'); // generation 2 begins; the parents of generation 1 get a parent count
  for (let k = 0; k < 2; k++) await page.keyboard.press('Shift+ArrowRight');
  expect(await page.locator('[data-col="parent"]').count()).toBeGreaterThan(0);
  await expect(page.locator('td[data-col="id"] .parentmark').first()).toContainText('×');

  const roulette = setupOf('decoder', { ...entry.defaults.params, selection: { method: 'roulette', chain: [{ step: 'shift' }] } });
  await open(page, roulette);
  await page.keyboard.press('g');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('td[data-col="prob"]').first()).toBeVisible();
});

test('Goldberg and the target string have no item row and keep their selection columns', async ({ page }) => {
  await page.goto(url);
  await expect(page.getByTestId('item-row')).toHaveCount(0);
  await expect(page.getByRole('table', { name: /^Population/ }).getByRole('columnheader')).toContainText(['#', 'Chromosome', 'x', 'Fitness', 'Weight', 'Prob.', 'Parent']);
  await page.getByTestId('problem-button').click();
  await page.getByRole('menuitemradio', { name: /Target string/ }).click();
  await page.getByRole('button', { name: 'Restart and apply' }).click();
  await expect(page.getByTestId('item-row')).toHaveCount(0);
  await expect(page.getByRole('table', { name: /^Population/ }).getByRole('columnheader')).toContainText(['Weight', 'Prob.', 'Parent']);
});

test('switching to the knapsack from the menu runs it, and a chromosome in the table is described by its bag', async ({ page }) => {
  await page.goto(url);
  await page.getByTestId('problem-button').click();
  await page.getByRole('menuitemradio', { name: /Knapsack/ }).click();
  await page.getByRole('button', { name: 'Restart and apply' }).click();
  await expect(page.locator('#brand .s')).toHaveText('12 items · capacity 48 · optimum 123');
  await expect(page.locator('#brand .logo')).toHaveText('Kn');
  const first = page.getByRole('table', { name: /^Population · generation 0$/ }).locator('tbody tr').first().locator('[data-bits]');
  await expect(first).toHaveAttribute('aria-label', /^Chromosome [01]{12}, (bag: [A-L, ]+|nothing in the bag), weight \d+ of 48/);
  void itemName;
});
