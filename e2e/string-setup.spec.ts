import { expect, test, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { formatGenes, gaAlgorithm, type GaParams, type Initialization } from '../src/engine';
import { createRun } from '../src/run';
import { entryOf } from '../src/ui/problems';

const url = pathToFileURL(resolve('dist/index.html')).href;
const entry = entryOf('target-string')!;

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

const rows = (page: Page) => page.getByRole('table', { name: /^(Population|Parents) · generation \d+$/ }).locator('tbody tr [data-bits]').evaluateAll((els) => els.map((el) => el.getAttribute('data-bits')));
const switchToStrings = async (page: Page) => {
  await page.getByTestId('problem-button').click();
  await page.getByRole('menuitemradio', { name: /Target string/ }).click();
  await page.getByRole('button', { name: 'Restart and apply' }).click();
};
const openDrawer = async (page: Page) => {
  if (await page.getByTestId('drawer').count()) return;
  await page.getByRole('button', { name: /Parameters/ }).click();
  await expect(page.getByTestId('drawer')).toBeVisible();
};
const field = (page: Page, id: string) => page.locator(`.ctl[data-field="${id}"]`);
const engineRun = (options: { alphabet: string; target: string }, init: Initialization, params: GaParams = entry.defaults.params, seed = entry.defaults.seed) =>
  createRun(gaAlgorithm, { setup: { problem: entry.create(options), init }, params, seed });
const engineRows = (run: ReturnType<typeof engineRun>, generation: number, options: { alphabet: string; target: string }) => {
  for (let g = 0; g < generation; g++) run.forwardCycle();
  const problem = entry.create(options);
  return run.snapshot(generation).state.population.map((i) => formatGenes(i.chromosome, problem.alphabet));
};

test.beforeEach(async ({ page }) => {
  await page.goto(url);
  await switchToStrings(page);
  await openDrawer(page);
});

test('the run setup has Target and Alphabet fields with the current values and what they mean; Goldberg has neither', async ({ page }) => {
  await expect(page.locator('#target')).toHaveValue('HELLO');
  await expect(page.locator('#alphabet')).toHaveValue('ABCDEFGHIJKLMNOPQRSTUVWXYZ ');
  await expect(field(page, 'target')).toContainText('5 characters, so the best possible fitness is 5');
  await expect(field(page, 'alphabet')).toContainText('27 symbols. A space (shown as ␣) counts as a symbol.');
  await expect(page.getByTestId('apply-reset')).toBeDisabled();
  await expect(page.getByText('No setup changes.')).toBeVisible();

  await page.keyboard.press('Escape');
  await page.getByTestId('problem-button').click();
  await page.getByRole('menuitemradio', { name: /Goldberg/ }).click();
  await page.getByRole('button', { name: 'Restart and apply' }).click();
  await openDrawer(page);
  await expect(page.locator('#target')).toHaveCount(0);
  await expect(page.locator('#alphabet')).toHaveCount(0);
});

test('an invalid target is explained under the field, blocks the restart, and clears when fixed', async ({ page }) => {
  await page.locator('#target').fill('HELLO, WORLD');
  await expect(field(page, 'target').locator('.err')).toHaveText('The target contains "," (position 6), which is not in the alphabet. Add it to the alphabet or remove it from the target.');
  await expect(page.locator('#target')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#target')).toHaveAttribute('aria-describedby', 'target-error');
  await expect(page.getByTestId('apply-reset')).toBeDisabled();
  await expect(page.getByText('Fix the highlighted fields first.')).toBeVisible();
  await page.locator('#alphabet').fill('ABCDEFGHIJKLMNOPQRSTUVWXYZ ,');
  await expect(field(page, 'target').locator('.err')).toHaveCount(0);
  await expect(page.getByTestId('apply-reset')).toBeEnabled();
  await expect(page.getByText('Changed: Alphabet, Target, Target fitness.')).toBeVisible();
});

test('invalid alphabets are explained under the alphabet field: repeated, too short, too long, a hidden character', async ({ page }) => {
  const alphabet = page.locator('#alphabet');
  const message = field(page, 'alphabet').locator('.err');
  await alphabet.fill('HELO LH');
  await expect(message).toHaveText('The alphabet contains "L" more than once. The alphabet contains "H" more than once.');
  await alphabet.fill('H ');
  await page.locator('#target').fill('H');
  await expect(message).toHaveCount(0); // 2 symbols is the least a gene can change between
  await alphabet.fill('H');
  await expect(message).toContainText('at least 2 symbols');
  await alphabet.fill('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz');
  await expect(message).toContainText('at most 40 symbols (it has 52)');
  await alphabet.fill('AB\tC');
  await expect(message).toContainText('visible characters');
  await expect(page.getByTestId('apply-reset')).toBeDisabled();
  await page.locator('#alphabet').fill('  ');
  await expect(message).toHaveText('The alphabet contains a space more than once.');
});

test('an empty or too long target is explained', async ({ page }) => {
  await page.locator('#target').fill('');
  await expect(field(page, 'target').locator('.err')).toHaveText('The target must not be empty.');
  await page.locator('#target').fill('A'.repeat(25));
  await expect(field(page, 'target').locator('.err')).toContainText('at most 24 characters (it has 25)');
});

test('a valid change is staged until Apply and restart, then the notice names what is lost and the run is the engine’s', async ({ page }) => {
  await page.keyboard.press('Escape');
  await page.keyboard.press('g');
  await page.keyboard.press('g');
  await openDrawer(page);
  const before = await rows(page);

  await page.locator('#target').fill('WORLD');
  await expect(page.getByText('Changed: Target.')).toBeVisible();
  expect(await rows(page)).toEqual(before); // staged, nothing happened yet
  await expect(page.locator('#brand .s')).toHaveText('Match “HELLO” · 27 symbols');

  await page.getByTestId('apply-reset').click();
  await expect(page.getByTestId('reset-notice')).toHaveText('Changing the target restarts the run from generation 0 and discards the 2 recorded generations (1–2).');
  await page.getByRole('button', { name: 'Cancel' }).click();
  expect(await rows(page)).toEqual(before);
  await expect(page.locator('#brand .s')).toHaveText('Match “HELLO” · 27 symbols');

  await page.getByTestId('apply-reset').click();
  await page.getByRole('button', { name: 'Restart and apply' }).click();
  const options = { alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ ', target: 'WORLD' };
  await expect(page.locator('#brand .s')).toHaveText('Match “WORLD” · 27 symbols');
  await expect(page.locator('#pop-heading')).toHaveText('Population · generation 0');
  expect(await rows(page)).toEqual(engineRows(engineRun(options, entry.defaults.init), 0, options));
  await expect(page.locator('#target')).toHaveValue('WORLD'); // the drawer shows what runs now
  await expect(page.getByTestId('target-row')).toHaveAttribute('aria-label', 'The target is WORLD');
  await page.keyboard.press('Escape');
  await page.keyboard.press('g');
  await page.keyboard.press('g');
  expect(await rows(page)).toEqual(engineRows(engineRun(options, entry.defaults.init), 2, options));
});

test('a longer target moves “target fitness reached” to its length and says so, a custom value is left alone', async ({ page }) => {
  await expect(page.locator('#stop-target')).toHaveValue('5');
  await page.locator('#target').fill('HELLO WORLD');
  await expect(page.getByText('moves to the new target\'s length (11)')).toBeVisible();
  await expect(page.getByText('Changed: Target, Target fitness.')).toBeVisible();
  await page.getByTestId('apply-reset').click();
  await expect(page.getByTestId('reset-notice')).toHaveText('Changing the target and the target fitness restarts the run from generation 0. Nothing recorded will be lost.');
  await page.getByRole('button', { name: 'Restart and apply' }).click();
  await expect(page.locator('#stop-target')).toHaveValue('11');
  await expect(field(page, 'target')).toContainText('11 characters');

  // a value the instructor chose stays
  await page.locator('#stop-target').fill('8');
  await page.locator('#stop-target').press('Enter');
  await page.locator('#target').fill('HELLO');
  await expect(page.getByText('Changed: Target.')).toBeVisible();
  await page.getByTestId('apply-reset').click();
  await page.getByRole('button', { name: 'Restart and apply' }).click();
  await expect(page.locator('#stop-target')).toHaveValue('8');
});

test('operator settings still work beside the setup fields, and a staged target does not leak into them', async ({ page }) => {
  await page.locator('#target').fill('WORLD');
  await page.locator('#mutation-probability').fill('0.05');
  await page.locator('#mutation-probability').press('Enter');
  await expect(page.getByTestId('pending-mutation-probability')).toBeVisible();
  await expect(page.locator('#brand .s')).toHaveText('Match “HELLO” · 27 symbols'); // the staged target is not in the run
  await expect(page.locator('#target')).toHaveValue('WORLD'); // and it was not thrown away either
});

test('hand-edited strings: a live table with matches, a message naming the wrong chromosome, and the run starts from them', async ({ page }) => {
  await page.locator('#init').selectOption('explicit');
  const editor = page.getByTestId('hand-population');
  await editor.locator('textarea').fill('HELLO\nJELLY\nHI YO\nZZ');
  const table = editor.getByRole('table', { name: 'Hand-edited population' });
  await expect(table.locator('tbody tr')).toHaveCount(4);
  await expect(table.locator('thead')).toContainText('Fitness');
  await expect(table.locator('tbody tr[data-row="1"] [data-col="fitness"]')).toHaveText('5 of 5');
  await expect(table.locator('tbody tr[data-row="2"] [data-col="fitness"]')).toHaveText('3 of 5');
  await expect(table.locator('tbody tr[data-row="3"] [data-col="fitness"]')).toHaveText('2 of 5'); // a space inside a string is a letter
  await expect(table.locator('tbody tr[data-row="3"] [data-bits]')).toHaveAttribute('data-bits', 'HI YO');
  await expect(table.locator('tbody tr[data-row="4"]')).toHaveClass('bad'); // the wrong row is marked, the message below names it
  await expect(field(page, 'chromosomes').locator('p.err')).toHaveText('Chromosome 4 has 2 genes, but this problem needs 5.');
  await expect(page.getByTestId('apply-reset')).toBeDisabled();

  await editor.locator('textarea').fill('HELLO\nJELLY\nHI YO\nhello');
  await expect(field(page, 'chromosomes').locator('p.err')).toHaveText('Chromosome 4 ("hello") may only contain the characters of the alphabet (27 symbols).');

  const strings = ['HELLO', 'JELLY', 'HI YO', 'ZZ ZZ', 'ABCDE', 'LLEHO'];
  await editor.locator('textarea').fill(strings.join('\n'));
  await expect(field(page, 'chromosomes').locator('p.err')).toHaveCount(0);
  await page.getByTestId('apply-reset').click();
  await expect(page.getByTestId('reset-notice')).toContainText('Changing the initialization restarts the run from generation 0.');
  await page.getByRole('button', { name: 'Restart and apply' }).click();
  expect(await rows(page)).toEqual(strings);
  await page.keyboard.press('Escape');
  await page.keyboard.press('g');
  await page.keyboard.press('g');
  const options = { alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ ', target: 'HELLO' };
  expect(await rows(page)).toEqual(engineRows(engineRun(options, { kind: 'explicit', chromosomes: strings }), 2, options));
});

test('changing the alphabet while strings are hand-edited re-reads them: letters that are no longer allowed are named', async ({ page }) => {
  await page.locator('#init').selectOption('explicit');
  await page.getByTestId('hand-population').locator('textarea').fill('HELLO\nJELLY');
  await expect(field(page, 'chromosomes').locator('p.err')).toHaveCount(0);
  await page.locator('#alphabet').fill('HELO');
  await expect(field(page, 'chromosomes').locator('p.err')).toContainText('Chromosome 2 ("JELLY") may only contain the characters H, E, L and O');
  await page.locator('#alphabet').fill('HELOJY');
  await expect(field(page, 'chromosomes').locator('p.err')).toHaveCount(0);
  await expect(page.getByTestId('hand-population').locator('tbody tr[data-row="2"] [data-col="fitness"]')).toHaveText('3 of 5');
});

test('Copy link then open reproduces the run, with its alphabet, target and hand-edited strings', async ({ page, context }) => {
  const strings = ['WORLD', 'WORLE', 'XORLD', 'AAAAA'];
  await page.locator('#init').selectOption('explicit');
  await page.getByTestId('hand-population').locator('textarea').fill(strings.join('\n'));
  await page.locator('#target').fill('WORLD');
  await page.locator('#alphabet').fill('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
  await page.getByTestId('apply-reset').click();
  await page.getByRole('button', { name: 'Restart and apply' }).click();
  await page.getByTestId('copy-link').click();
  await expect(page.getByTestId('share-status')).toBeVisible();
  const link = await page.evaluate(() => navigator.clipboard.readText());

  const fresh = await context.newPage();
  await fresh.goto(link);
  await expect(fresh.getByTestId('problem-button')).toHaveText(/Target string/);
  await expect(fresh.locator('#brand .s')).toHaveText('Match “WORLD” · 26 symbols');
  expect(await rows(fresh)).toEqual(strings);
  await fresh.keyboard.press('g');
  await fresh.keyboard.press('g');
  const options = { alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', target: 'WORLD' };
  expect(await rows(fresh)).toEqual(engineRows(engineRun(options, { kind: 'explicit', chromosomes: strings }, entry.defaults.params), 2, options));
  await openDrawer(fresh);
  await expect(fresh.locator('#target')).toHaveValue('WORLD');
  await expect(fresh.locator('#alphabet')).toHaveValue('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
});

test('the setup fields fit and read well at 1366×768 in projector mode', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Projector mode' }).click();
  await openDrawer(page);
  await page.locator('#target').fill('HELLO, WORLD');
  const box = (await page.locator('#target').boundingBox())!;
  const drawer = (await page.getByTestId('drawer').boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(drawer.x);
  expect(box.x + box.width).toBeLessThanOrEqual(drawer.x + drawer.width);
  const overflow = await page.getByTestId('drawer').evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
