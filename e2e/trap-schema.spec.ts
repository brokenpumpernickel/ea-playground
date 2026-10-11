import { expect, test, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { formatGenes, gaAlgorithm, trapProblem, type TrapOptions } from '../src/engine';
import { createRun } from '../src/run';
import { parseSchema, schemaHistory } from '../src/ui/schema-model';
import { entryOf } from '../src/ui/problems';
import { configOf, encodeConfig } from '../src/ui/run-config';

const url = pathToFileURL(resolve('dist/index.html')).href;
const entry = entryOf('trap')!;
const base: TrapOptions = { blockSize: 4, blocks: 5, linkage: 'tight' };
const open = async (page: Page, options: TrapOptions = base) => {
  await page.goto('about:blank');
  await page.goto(url + encodeConfig(configOf({ problem: entry.create(options), init: { kind: 'random', size: 12 } }, entry.defaults.params, 7, 'trap', options)));
  await expect(page.getByTestId('problem-button')).toHaveText(/Trap/);
  await page.getByRole('button', { name: 'Projector mode' }).click();
};
const engine = (options: TrapOptions, generations: number) => {
  const problem = trapProblem(options);
  const run = createRun(gaAlgorithm, { setup: { problem, init: { kind: 'random', size: 12 } }, params: entry.defaults.params, seed: 7 });
  for (let g = 0; g < generations; g++) run.forwardCycle();
  return { run, problem };
};
const rows = (page: Page) => page.getByRole('table', { name: /^(Population|Parents) · generation \d+$/ }).locator('tbody tr [data-bits]').evaluateAll((els) => els.map((el) => el.getAttribute('data-bits')));
const tableValues = (page: Page) =>
  page.getByTestId('schema-table').locator('tbody tr').evaluateAll((trs) => trs.map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent)));

test('the stage panel has a second view, the schema tracker, that opens with block 1 solved; the tabs say which is showing; the other problems have no tabs', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await open(page);
  await expect(page.getByTestId('show-stage')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('show-schema').click();
  await expect(page.getByTestId('show-schema')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#stage-heading')).toHaveText('Schema tracker');
  await expect(page.locator('#schema-input')).toHaveValue('1111****************');
  await expect(page.getByTestId('schema-facts')).toContainText('order 4');
  await expect(page.getByTestId('schema-facts')).toContainText('defining length 3');
  await expect(page.getByTestId('schema-caveat')).toContainText('proves nothing');
  await page.getByTestId('show-stage').click();
  await expect(page.locator('#stage-heading')).toContainText('Setup');
  await page.goto(url);
  await expect(page.getByTestId('show-schema')).toHaveCount(0);
});

test('the counts and means on the screen are the engine’s for each recorded generation, for a typed schema, and follow the cursor', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await open(page);
  for (let g = 0; g < 6; g++) await page.keyboard.press('g');
  await page.getByTestId('show-schema').click();
  const { run } = engine(base, 6);
  const text = '*1**0***1***0**1***';
  await page.locator('#schema-input').fill('*0*0*0*0*0*0*0*0*0*0');
  const parsed = parseSchema('*0*0*0*0*0*0*0*0*0*0', 20);
  if (!parsed.ok) throw new Error(parsed.message);
  const history = schemaHistory(run, parsed.symbols);
  const fmt = (x: number) => String(Number(x.toFixed(2)));
  expect(await tableValues(page)).toEqual(history.map((h) => [String(h.generation), String(h.instances), h.instanceMean === null ? 'none' : fmt(h.instanceMean), fmt(h.populationMean)]));
  await expect(page.getByTestId('schema-sentence')).toContainText(`Generation 6: ${history[6]!.instances === 0 ? 'none of the 12' : `${history[6]!.instances} of 12`}`);
  void text;
  // scrub back to generation 3: the sentence is about generation 3
  const scrub = page.getByTestId('scrub');
  await scrub.focus();
  for (let k = 0; k < 3; k++) await page.keyboard.press('PageUp');
  await expect(scrub).toHaveAttribute('data-cycle', '3');
  await expect(page.getByTestId('schema-sentence')).toContainText('Generation 3: ');
  expect(await tableValues(page)).toHaveLength(7);
});

test('“block b solved” fills the schema in, and for loose linkage it is spread out with a long defining length', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await open(page, { blockSize: 4, blocks: 5, linkage: 'loose' });
  await page.getByTestId('show-schema').click();
  await expect(page.locator('#schema-input')).toHaveValue('1****1****1****1****');
  await expect(page.getByTestId('schema-facts')).toContainText('defining length 15');
  await page.getByRole('button', { name: 'Block 3 solved' }).click();
  await expect(page.locator('#schema-input')).toHaveValue('**1****1****1****1**');
  await expect(page.getByTestId('schema-facts')).toContainText('order 4');
});

test('a wrong schema is explained under the field and nothing is drawn; a right one brings the charts back', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await open(page);
  await page.getByTestId('show-schema').click();
  await page.locator('#schema-input').fill('11x1****************');
  await expect(page.getByTestId('schema-error')).toHaveText('A schema can only use 1, 0 and * (“x” at position 3 is none of them).');
  await expect(page.locator('#schema-input')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('[data-plot="schema-count"]')).toHaveCount(0);
  await page.locator('#schema-input').fill('1111***************');
  await expect(page.getByTestId('schema-error')).toHaveText('The schema needs 20 symbols, one per gene (it has 19).');
  await page.locator('#schema-input').fill('1111 1111 **** **** ****');
  await expect(page.getByTestId('schema-error')).toHaveCount(0);
  await expect(page.locator('[data-plot="schema-count"]')).toBeVisible();
});

test('tracking a schema never changes the run: with the tracker open the populations are the engine’s, stage by stage and generation by generation', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await open(page);
  await page.getByTestId('show-schema').click();
  await page.locator('#schema-input').fill('0000****************');
  const { run, problem } = engine(base, 4);
  for (let g = 0; g < 4; g++) await page.getByRole('button', { name: /^Generation/ }).click();
  await expect(page.locator('#pop-heading')).toHaveText('Population · generation 4');
  expect(await rows(page)).toEqual(run.snapshot(4).state.population.map((i) => formatGenes(i.chromosome, problem.alphabet)));
});

test('a restart starts the tracker over: back to the stage view with block 1 solved', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await open(page);
  await page.getByTestId('show-schema').click();
  await page.locator('#schema-input').fill('0000****************');
  await page.getByRole('button', { name: /Parameters/ }).click();
  await page.locator('#seed').fill('11');
  await page.getByTestId('apply-reset').click();
  await page.getByRole('button', { name: 'Restart and apply' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('show-stage')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('show-schema').click();
  await expect(page.locator('#schema-input')).toHaveValue('1111****************');
});

test('with the tracker open every control has a name, and the tabs, the field and the buttons can be reached with the keyboard', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await open(page);
  await page.getByTestId('show-stage').focus();
  await page.keyboard.press('Tab');
  await expect(page.getByTestId('show-schema')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#schema-input')).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.locator('#schema-input')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Block 1 solved' })).toBeFocused();
  const tree = await page.locator('body').ariaSnapshot();
  const unnamed = tree.split('\n').filter((line) => /^\s*- (button|textbox|combobox|slider|checkbox|switch|spinbutton|radio|menuitemradio|menuitem)(\s+\[[^\]]*\])*:?\s*$/.test(line));
  expect(unnamed).toEqual([]);
});

for (const [width, height] of [
  [1920, 1080],
  [1366, 768],
] as const) {
  for (const [name, options] of [
    ['4 × 5 tight', base],
    ['6 × 5 loose (30 genes)', { blockSize: 6, blocks: 5, linkage: 'loose' }],
    ['3 × 10 tight (ten buttons)', { blockSize: 3, blocks: 10, linkage: 'tight' }],
  ] as [string, TrapOptions][]) {
    test(`at ${width}×${height} in projector mode, ${name}: the whole tracker fits the stage panel, with the generations growing`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await open(page, options);
      await page.getByTestId('show-schema').click();
      for (let g = 0; g < 10; g++) {
        if (g > 0) await page.getByRole('button', { name: /^Generation/ }).click();
        const r = await page.evaluate(() => {
          const panel = document.querySelector('[data-testid="schema-tracker"]')!.closest('section')!;
          const box = panel.getBoundingClientRect();
          const out: string[] = [];
          for (const el of panel.querySelectorAll('.expl, .srow, .sfacts, .scharts, .sum, .caveat, .btn, input')) {
            const b = el.getBoundingClientRect();
            if (b.bottom > box.bottom + 0.5 || b.right > box.right + 0.5 || b.left < box.left - 0.5) out.push(`${el.className || el.tagName} leaves the panel`);
          }
          const tracker = panel.querySelector('.schema')!;
          if (tracker.scrollHeight > tracker.clientHeight + 1) out.push(`the tracker scrolls (${tracker.scrollHeight} > ${tracker.clientHeight})`);
          if (document.documentElement.scrollWidth > window.innerWidth) out.push('page overflows sideways');
          return out;
        });
        expect(r, `generation ${g}`).toEqual([]);
      }
    });
  }
}
