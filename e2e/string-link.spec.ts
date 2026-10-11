import { expect, test, type Page } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { formatGenes, gaAlgorithm, type GaParams, type GaSetup } from '../src/engine';
import { createRun } from '../src/run';
import { entryOf } from '../src/ui/problems';
import { configOf, encodeConfig } from '../src/ui/run-config';

const url = pathToFileURL(resolve('dist/index.html')).href;
test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

/** Every preset file as the app reads it (the app's own loader needs the bundler, so the test reads the files itself). */
const presetFiles = readdirSync(resolve('src/ui/presets')).filter((f) => f.endsWith('.json')).sort();
const readPreset = (file: string) => {
  const data = JSON.parse(readFileSync(resolve('src/ui/presets', file), 'utf8'));
  const entry = entryOf(data.problem)!;
  const setup: GaSetup = { problem: entry.create(data.options), init: data.setup.init };
  return { file, name: data.name as string, problem: data.problem as string, options: data.options, seed: data.seed as number, setup, params: data.params as GaParams };
};

const rows = (page: Page) => page.getByRole('table', { name: /^(Population|Parents) · generation \d+$/ }).locator('tbody tr [data-bits]').evaluateAll((els) => els.map((el) => el.getAttribute('data-bits')!));
const b64url = (value: unknown) => `#v1.${Buffer.from(JSON.stringify(value)).toString('base64url')}`;

test('the preset files are all here: four for Goldberg, three for the target string, five for the knapsack and six for the trap', () => {
  expect(presetFiles.map((f) => readPreset(f).problem)).toEqual([...Array(4).fill('goldberg'), ...Array(3).fill('target-string'), ...Array(5).fill('knapsack'), ...Array(6).fill('trap')]);
});

for (const file of presetFiles) {
  const preset = readPreset(file);
  test(`the link of the preset “${preset.name}” (${preset.problem}) opens the same run in a fresh page, equal to the engine for three generations`, async ({ page }) => {
    const hash = encodeConfig(configOf(preset.setup, preset.params, preset.seed, preset.problem, preset.options));
    await page.goto(url + hash);
    await expect(page.getByTestId('link-notice')).toHaveCount(0);
    await expect(page.getByTestId('problem-button')).toHaveText({ goldberg: /Goldberg/, 'target-string': /Target string/, knapsack: /Knapsack/, trap: /Trap/ }[preset.problem]!);
    await expect(page.getByTestId('seed')).toHaveText(String(preset.seed));
    await expect(page.locator('#pop-heading')).toHaveText('Population · generation 0');
    expect(page.url()).toBe(url); // the address is cleared once the link has loaded
    const engine = createRun(gaAlgorithm, { setup: preset.setup, params: preset.params, seed: preset.seed });
    const show = (generation: number) => engine.snapshot(generation).state.population.map((i) => formatGenes(i.chromosome, preset.setup.problem.alphabet));
    expect(await rows(page)).toEqual(show(0));
    for (let g = 1; g <= 3; g++) {
      await page.keyboard.press('g');
      engine.forwardCycle();
    }
    expect(await rows(page)).toEqual(show(3));
  });
}

test('a link with a target letter outside the alphabet, a repeated symbol or a target that is too long opens the default configuration and says what is wrong', async ({ page }) => {
  const entry = entryOf('target-string')!;
  const options = entry.defaultOptions()!;
  const config = configOf({ problem: entry.create(options), init: entry.defaults.init }, entry.defaults.params, 5, 'target-string', options);
  const bad = (change: (o: { alphabet: string; target: string }) => void) => {
    const copy = JSON.parse(JSON.stringify(config));
    change(copy.options);
    return b64url(copy);
  };
  for (const [hash, words] of [
    [bad((o) => (o.target = 'HELLO, WORLD')), 'The target contains "," (position 6), which is not in the alphabet.'],
    [bad((o) => (o.alphabet += 'A')), 'The alphabet contains "A" more than once.'],
    [bad((o) => (o.target = 'A'.repeat(25))), 'The target can have at most 24 characters (it has 25).'],
    [bad((o) => ((o.alphabet = 'H'), (o.target = 'H'))), 'The alphabet needs at least 2 symbols'],
  ] as const) {
    await page.goto('about:blank');
    await page.goto(url + hash);
    const notice = page.getByTestId('link-notice');
    await expect(notice).toBeVisible();
    await expect(notice).toHaveAttribute('role', 'alert');
    await expect(notice).toContainText('default configuration is open instead');
    await expect(notice).toContainText(words);
    await expect(page.getByTestId('problem-button')).toHaveText(/Goldberg/);
    await expect(page.getByTestId('seed')).toHaveText('42'); // nothing of the bad link was used, not even its good seed
    await expect(page.locator('#pop-heading')).toHaveText('Population · generation 0');
    expect(page.url()).toBe(url);
  }
});

test('a link for a target that one-point crossover cannot cut says so in words, and the same is said in the drawer', async ({ page }) => {
  const entry = entryOf('target-string')!;
  const options = { alphabet: 'AB', target: 'A' };
  const config = configOf({ problem: entry.create({ alphabet: 'AB', target: 'AB' }), init: entry.defaults.init }, entry.defaults.params, 5, 'target-string', options);
  await page.goto(url + b64url(config));
  await expect(page.getByTestId('link-notice')).toContainText("One-point crossover needs chromosomes of at least 2 genes, but this problem's have 1.");

  // in the drawer: the same words under the crossover type, the restart is blocked, and another type clears it
  await page.getByTestId('problem-button').click();
  await page.getByRole('menuitemradio', { name: /Target string/ }).click();
  await page.getByRole('button', { name: 'Restart and apply' }).click();
  await page.getByRole('button', { name: /Parameters/ }).click();
  await page.locator('#target').fill('H');
  const error = page.locator('.ctl[data-field="crossover-type"] .err');
  await expect(error).toHaveText("One-point crossover needs chromosomes of at least 2 genes, but this problem's have 1. Choose another crossover type, switch crossover off or make the target longer.");
  await expect(page.getByTestId('apply-reset')).toBeDisabled();
  await expect(page.getByText('The crossover type does not fit the target (see Crossover).')).toBeVisible();
  await page.locator('#crossover-type').selectOption('uniform');
  await expect(error).toHaveCount(0);
  await expect(page.getByTestId('apply-reset')).toBeEnabled();
  await page.getByTestId('apply-reset').click();
  await page.getByRole('button', { name: 'Restart and apply' }).click();
  await page.keyboard.press('Escape');
  await page.keyboard.press('g');
  await page.keyboard.press('g');
  await expect(page.locator('#pop-heading')).toHaveText('Population · generation 2'); // the run goes on, it does not fail
});

test('a link with a long alphabet, spaces and symbols beyond ASCII opens and plays', async ({ page }) => {
  const entry = entryOf('target-string')!;
  const options = { alphabet: 'abcdéßñü😀😁 ', target: 'bé😀 ñüa😁' };
  const params: GaParams = { ...entry.defaults.params, crossover: { enabled: true, operator: 'two-point', probability: 0.8 }, stop: { generationLimit: 50 } };
  const setup: GaSetup = { problem: entry.create(options), init: { kind: 'random', size: 10 } };
  await page.goto(url + encodeConfig(configOf(setup, params, 11, 'target-string', options)));
  await expect(page.getByTestId('link-notice')).toHaveCount(0);
  await expect(page.locator('#brand .s')).toHaveText('Match “bé😀 ñüa😁” · 11 symbols');
  const engine = createRun(gaAlgorithm, { setup, params, seed: 11 });
  for (let g = 0; g < 2; g++) {
    await page.keyboard.press('g');
    engine.forwardCycle();
  }
  expect(await rows(page)).toEqual(engine.snapshot(2).state.population.map((i) => formatGenes(i.chromosome, setup.problem.alphabet)));
  await expect(page.getByTestId('target-row').first()).toHaveAttribute('aria-label', 'The target is bé😀 ñüa😁');
});
