import { expect, test, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const url = pathToFileURL(resolve('dist/index.html')).href;

const openDrawer = async (page: Page) => {
  await page.getByRole('button', { name: /Parameters/ }).click();
  await expect(page.getByTestId('drawer')).toBeVisible();
};
const load = async (page: Page, name: string) => {
  await openDrawer(page);
  await page.locator('#preset').selectOption({ label: name });
  await page.getByTestId('load-preset').click();
  await page.getByRole('button', { name: 'Restart and apply' }).click();
  await page.keyboard.press('Escape');
};
const populationTable = (page: Page) => page.getByRole('table', { name: /^(Population|Parents) · generation \d+$/ });
const column = (page: Page, col: string) => populationTable(page).locator(`tbody tr [data-col="${col}"]`).allTextContents();

test.beforeEach(async ({ page }) => {
  await page.goto(url);
});

test('the preset menu lists every preset with its one-sentence lesson and what to look for', async ({ page }) => {
  await openDrawer(page);
  const options = await page.locator('#preset option').allTextContents();
  expect(options).toEqual(['Textbook population', 'No crossover', 'No mutation', 'High mutation']);
  await expect(page.getByTestId('preset-lesson')).toContainText("Goldberg's four-individual example");
  await page.locator('#preset').selectOption({ label: 'No mutation' });
  await expect(page.getByTestId('preset-lesson')).toContainText('a gene that starts missing stays missing');
  await expect(page.getByTestId('preset-lookfor')).toContainText('expected to stall at 225');
  await page.locator('#preset').selectOption({ label: 'High mutation' });
  await expect(page.getByTestId('preset-lookfor')).toContainText('not the same as converging');
});

test('the textbook preset shows the book’s fitness, total, average, best and selection probabilities', async ({ page }) => {
  await load(page, 'Textbook population');
  await expect(page.getByTestId('seed')).toHaveText('88');
  await expect(page.locator('#brand')).toContainText('preset: Textbook population');
  await expect(page.locator('#pop-heading')).toHaveText('Population · generation 0');
  expect(await column(page, 'fitness')).toEqual(['169', '576', '64', '361']);
  expect(await column(page, 'x')).toEqual(['13', '24', '8', '19']);
  await expect(page.locator('section[aria-labelledby="pop-heading"] .ph .r')).toContainText('Σ fitness 1170 · avg 292.5 · best 576');

  await page.getByRole('button', { name: /^Micro-step/ }).click(); // generation 1, selection entered
  await expect(page.locator('#pop-heading')).toHaveText('Parents · generation 0');
  expect(await column(page, 'prob')).toEqual(['0.144', '0.492', '0.055', '0.309']);
  expect(await column(page, 'weight')).toEqual(['169', '576', '64', '361']);
});

test('the textbook seed shows both pairs recombining and one rare mutation in generation 1', async ({ page }) => {
  await load(page, 'Textbook population');
  await page.getByRole('button', { name: /^Micro-step/ }).click();
  for (let k = 0; k < 2; k++) await page.getByRole('button', { name: /^Stage/ }).click();
  await page.getByRole('button', { name: /^Micro-step/ }).click(); // crossover entered
  await page.getByRole('button', { name: /^Stage/ }).click(); // end of crossover
  await expect(page.locator('[data-pair][data-state="revealed"] .badge.ok')).toHaveCount(2);
  await page.getByRole('button', { name: /^Micro-step/ }).click(); // mutation entered
  await page.getByRole('button', { name: /^Stage/ }).click(); // end of mutation
  await expect(page.locator('td.flipcell')).toHaveCount(1);
  await expect(page.locator('td.flipcell')).toHaveAttribute('data-gene', '3');
});

test('the no-mutation preset stalls as described: gene 1 never gets a 1 and the best is 225', async ({ page }) => {
  await load(page, 'No mutation');
  await expect(page.getByTestId('seed')).toHaveText('4');
  for (let k = 0; k < 50; k++) await page.getByRole('button', { name: /^Generation/ }).click();
  await expect(page.getByTestId('summary')).toContainText('best so far 225');
  const shares = await page.locator('.allele [data-share]').evaluateAll((els) => els.map((el) => Number(el.getAttribute('data-share'))));
  expect(shares[0]).toBe(0);
  await expect(page.getByTestId('distinct')).toHaveText('1 of 6 distinct');
});

test('the no-crossover preset bypasses every pair', async ({ page }) => {
  await load(page, 'No crossover');
  await page.getByRole('button', { name: /^Micro-step/ }).click();
  for (let k = 0; k < 2; k++) await page.getByRole('button', { name: /^Stage/ }).click();
  await page.getByRole('button', { name: /^Micro-step/ }).click();
  await page.getByRole('button', { name: /^Stage/ }).click();
  await expect(page.locator('.crossover .expl')).toContainText('Crossover is switched off');
  await expect(page.locator('[data-pair] .badge.bypass')).toHaveCount(3);
});

test('changing a setting by hand ends the preset label, and loading a preset says what it discards', async ({ page }) => {
  for (let k = 0; k < 3; k++) await page.getByRole('button', { name: /^Generation/ }).click();
  await openDrawer(page);
  await page.locator('#preset').selectOption({ label: 'High mutation' });
  await page.getByTestId('load-preset').click();
  await expect(page.getByTestId('reset-notice')).toHaveText('Loading the preset “High mutation” restarts the run from generation 0 and discards the 3 recorded generations (1–3).');
  await page.getByRole('button', { name: 'Restart and apply' }).click();
  await expect(page.locator('#brand')).toContainText('preset: High mutation');
  await expect(page.locator('#mutation-probability')).toHaveValue('0.3');
  await page.locator('#crossover-probability').fill('0.5');
  await page.locator('#crossover-probability').press('Enter');
  await expect(page.locator('#brand')).not.toContainText('preset:');
});
