import { expect, test, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { formatGenes, gaAlgorithm, metricsOf } from '../src/engine';
import { createRun } from '../src/run';
import { readFileSync } from 'node:fs';
import type { GaParams, GaSetup } from '../src/engine';
import { entryOf } from '../src/ui/problems';

const url = pathToFileURL(resolve('dist/index.html')).href;

/** A preset file as the app reads it (the app's own loader needs the bundler, so the test reads the file itself). */
interface Preset {
  readonly lesson: string;
  readonly lookFor: string;
  readonly seed: number;
  readonly setup: GaSetup;
  readonly params: GaParams;
}
const word = (file: string): Preset => {
  const data = JSON.parse(readFileSync(resolve('src/ui/presets', `${file}.json`), 'utf8'));
  return { lesson: data.lesson, lookFor: data.lookFor, seed: data.seed, params: data.params, setup: { problem: entryOf(data.problem)!.create(data.options), init: data.setup.init } };
};

const rows = (page: Page) => page.getByRole('table', { name: /^(Population|Parents) · generation \d+$/ }).locator('tbody tr [data-bits]').evaluateAll((els) => els.map((el) => el.getAttribute('data-bits')!));
const matchRates = (page: Page) => page.locator('.matchbar [data-share]').evaluateAll((els) => els.map((el) => Number(el.getAttribute('data-share'))));
const openStrings = async (page: Page) => {
  await page.goto(url);
  await page.getByTestId('problem-button').click();
  await page.getByRole('menuitemradio', { name: /Target string/ }).click();
  await page.getByRole('button', { name: 'Restart and apply' }).click();
};
const load = async (page: Page, name: string) => {
  if (!(await page.getByTestId('drawer').count())) await page.getByRole('button', { name: /Parameters/ }).click();
  await page.locator('#preset').selectOption({ label: name });
  await page.getByTestId('load-preset').click();
  await page.getByRole('button', { name: 'Restart and apply' }).click();
  await page.keyboard.press('Escape');
};
const engineRun = (preset: Preset) => createRun(gaAlgorithm, { setup: preset.setup, params: preset.params, seed: preset.seed });
const shown = (preset: Preset, run: ReturnType<typeof engineRun>, generation: number) =>
  run.snapshot(generation).state.population.map((i) => formatGenes(i.chromosome, preset.setup.problem.alphabet));

test.beforeEach(async ({ page }) => {
  await openStrings(page);
});

test('the menu lists the three string presets with their lesson and what to look for, and the Goldberg ones are not among them', async ({ page }) => {
  await page.getByRole('button', { name: /Parameters/ }).click();
  await expect(page.locator('#preset option')).toHaveText(['Evolve a word', 'No mutation', 'Mutation too high']);
  for (const [name, preset] of [
    ['Evolve a word', word('5-evolve-a-word')],
    ['No mutation', word('6-word-no-mutation')],
    ['Mutation too high', word('7-word-mutation-too-high')],
  ] as const) {
    await page.locator('#preset').selectOption({ label: name });
    await expect(page.getByTestId('preset-lesson')).toHaveText(preset.lesson);
    await expect(page.getByTestId('preset-lookfor')).toHaveText(`Look for: ${preset.lookFor}`);
    await expect(page.getByText(`with this configuration and seed ${preset.seed}.`)).toBeVisible();
  }
});

test('Evolve a word: loading it restarts with its seed, and HELLO appears in generation 65 as the description says', async ({ page }) => {
  const preset = word('5-evolve-a-word');
  await page.keyboard.press('g');
  await load(page, 'Evolve a word');
  await expect(page.locator('#brand')).toContainText('preset: Evolve a word');
  await expect(page.getByTestId('seed')).toHaveText('42');
  const engine = engineRun(preset);
  expect(await rows(page)).toEqual(shown(preset, engine, 0));
  // the first thing Run reports is stagnation at generation 20; it is only a report, and Run again goes on to HELLO
  await page.getByRole('button', { name: 'Run until stop' }).click();
  await expect(page.locator('#pop-heading')).toHaveText(/generation 20$/);
  expect(await rows(page)).not.toContain('HELLO');
  await page.getByRole('button', { name: 'Run until stop' }).click();
  await expect(page.locator('#pop-heading')).toHaveText(/generation 65$/);
  for (let g = 0; g < 65; g++) engine.forwardCycle();
  expect(await rows(page)).toEqual(shown(preset, engine, 65));
  expect(await rows(page)).toContain('HELLO');
});

test('No mutation: the match rate of position 5 is 0% in every generation, the population ends as copies of one string at generation 22, and nothing is mutated', async ({ page }) => {
  const preset = word('6-word-no-mutation');
  await load(page, 'No mutation');
  const engine = engineRun(preset);
  for (let g = 0; g <= 22; g++) {
    if (g > 0) {
      await page.keyboard.press('g');
      engine.forwardCycle();
    }
    expect((await matchRates(page))[4]).toBe(0);
    const here = await rows(page);
    expect(here).toEqual(shown(preset, engine, g));
    if (g === 21) expect(new Set(here).size).toBe(2);
    if (g === 22) expect(new Set(here).size).toBe(1);
    expect(here.every((s) => s[4] !== 'O')).toBe(true);
  }
  expect(metricsOf(engine.snapshot(22).state, 27).bestSoFar).toBe(3);
  // the mutation stage of the last generation is nothing but labelled bypasses
  await page.keyboard.press('Shift+ArrowLeft');
  await page.keyboard.press('Shift+ArrowLeft');
  await expect(page.getByRole('heading', { level: 2, name: /Mutation/ })).toBeVisible();
  await expect(page.locator('.mutation .expl')).toContainText('Mutation is switched off');
  await expect(page.getByText('bypassed: mutation is off').first()).toBeVisible();
});

test('Mutation too high: the population stays scattered and HELLO is not found, as the description says', async ({ page }) => {
  const preset = word('7-word-mutation-too-high');
  await load(page, 'Mutation too high');
  await expect(page.getByTestId('seed')).toHaveText('3');
  const engine = engineRun(preset);
  for (let g = 1; g <= 30; g++) {
    await page.keyboard.press('g');
    engine.forwardCycle();
  }
  expect(await rows(page)).toEqual(shown(preset, engine, 30));
  expect(await rows(page)).not.toContain('HELLO');
  const m = Array.from({ length: 31 }, (_, g) => metricsOf(engine.snapshot(g).state, 27));
  expect(m.slice(1).filter((x) => x.best < x.bestSoFar).length).toBeGreaterThan(20);
  expect(Math.max(...m.map((x) => x.bestSoFar))).toBe(3);
  await page.getByRole('button', { name: /Parameters/ }).click();
  await expect(page.locator('#mutation-probability')).toHaveValue('0.5');
});

test('the Goldberg presets are unchanged and still its own', async ({ page }) => {
  await page.getByTestId('problem-button').click();
  await page.getByRole('menuitemradio', { name: /Goldberg/ }).click();
  await page.getByRole('button', { name: 'Restart and apply' }).click();
  await page.getByRole('button', { name: /Parameters/ }).click();
  await expect(page.locator('#preset option')).toHaveText(['Textbook population', 'No crossover', 'No mutation', 'High mutation']);
  await page.locator('#preset').selectOption({ label: 'No mutation' });
  await expect(page.getByTestId('preset-lookfor')).toContainText('expected to stall at 225');
});
