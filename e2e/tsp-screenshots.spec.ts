import { test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import type { GaParams, TspOptions } from '../src/engine';
import { defaultsOf, entryOf } from '../src/ui/problems';
import { configOf, encodeConfig } from '../src/ui/run-config';

// Screenshots for the rendered review (ticket 16): written only with SHOTS=1, so an ordinary run leaves the files alone.
const url = pathToFileURL(resolve('dist/index.html')).href;
const entry = entryOf('tsp')!;
const dir = resolve('.scratch/milestone-6-tsp/screenshots');
const enabled = process.env.SHOTS === '1';
test.skip(!enabled, 'set SHOTS=1 to write the screenshots');

const ulysses: TspOptions = { instance: 'ulysses16', n: 10, seed: 1 };
const berlin: TspOptions = { instance: 'berlin52', n: 10, seed: 1 };
type Edit = (p: GaParams) => GaParams;
const open = async (page: Page, options: TspOptions, change: Edit = (p) => p, seed = 42, dark = false) => {
  const d = defaultsOf(entry, options);
  await page.goto('about:blank');
  await page.goto(url + encodeConfig(configOf({ problem: entry.create(options), init: d.init }, change(d.params), seed, 'tsp', options)));
  await page.getByRole('button', { name: 'Projector mode' }).click();
  if (dark) await page.getByRole('button', { name: /theme|dark|light/i }).first().click();
};
const toStage = async (page: Page, stage: string, micros = 0) => {
  for (let k = 0; k < 120 && !(await page.locator('#stage-heading').innerText()).includes(stage); k++) await page.keyboard.press('Shift+ArrowRight');
  if (micros > 0) {
    // back to the start of the stage, then forward `micros` micro-steps
    await page.keyboard.press('Shift+ArrowLeft');
    for (let k = 0; k < micros; k++) await page.keyboard.press('ArrowRight');
  }
};
const generations = async (page: Page, n: number) => {
  for (let g = 0; g < n; g++) await page.keyboard.press('g');
};
const op = (operator: 'ox' | 'pmx' | 'cx'): Edit => (p) => ({ ...p, crossover: { ...p.crossover, operator, probability: 1 } });
const pm = (probability: number): Edit => (p) => ({ ...p, mutation: { ...p.mutation, probability } });

const scenarios: [string, (page: Page) => Promise<void>][] = [
  ['01-selection-berlin52', async (page) => { await open(page, berlin); await generations(page, 3); await toStage(page, 'Selection', 4); }],
  ['02-crossover-ox-ulysses16', async (page) => { await open(page, ulysses, op('ox')); await generations(page, 8); await toStage(page, 'Crossover', 3); }],
  ['03-crossover-pmx-ulysses16', async (page) => { await open(page, ulysses, op('pmx')); await generations(page, 8); await toStage(page, 'Crossover', 3); }],
  ['04-crossover-cx-ulysses16', async (page) => { await open(page, ulysses, op('cx')); await generations(page, 8); await toStage(page, 'Crossover', 3); }],
  ['05-crossover-pmx-berlin52', async (page) => { await open(page, berlin, op('pmx')); await generations(page, 8); await toStage(page, 'Crossover', 3); }],
  ['06-mutation-ulysses16', async (page) => { await open(page, ulysses, pm(0.7)); await generations(page, 8); await toStage(page, 'Mutation', 3); }],
  ['07-mutation-berlin52', async (page) => { await open(page, berlin, pm(0.7)); await generations(page, 8); await toStage(page, 'Mutation', 3); }],
  ['08-replacement-ulysses16', async (page) => { await open(page, ulysses); await generations(page, 8); await toStage(page, 'Replacement'); }],
  ['09-route-map-berlin52', async (page) => { await open(page, berlin); await generations(page, 40); await page.getByTestId('show-map').click(); await page.getByTestId('map-select').selectOption({ index: 3 }); await page.getByTestId('toggle-optimal').click(); }],
  ['10-route-map-ulysses16-crossover-marks', async (page) => { await open(page, ulysses, op('pmx')); await generations(page, 20); await page.getByTestId('show-map').click(); await toStage(page, 'crossover', 3); }],
  ['11-route-map-ulysses16-mutation-marks', async (page) => { await open(page, ulysses, pm(0.9)); await generations(page, 20); await page.getByTestId('show-map').click(); await toStage(page, 'mutation', 2); }],
  ['12-route-map-berlin52-crossover-marks', async (page) => { await open(page, berlin, op('ox')); await generations(page, 40); await page.getByTestId('show-map').click(); await toStage(page, 'crossover', 3); }],
  ['13-drawer', async (page) => { await open(page, berlin); await page.getByRole('button', { name: /Parameters/ }).click(); }],
  ['14-menu', async (page) => { await open(page, berlin); await page.getByTestId('problem-button').click(); }],
  ['15-circle-end', async (page) => { await open(page, { instance: 'circle', n: 15, seed: 1 }, (p) => p, 2); await generations(page, 46); await page.getByTestId('show-map').click(); }],
];

for (const [width, height] of [
  [1920, 1080],
  [1366, 768],
] as const) {
  for (const [name, setup] of scenarios) {
    test(`${name} at ${width}×${height}`, async ({ page }) => {
      test.setTimeout(60_000);
      mkdirSync(dir, { recursive: true });
      await page.setViewportSize({ width, height });
      await setup(page);
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      await page.screenshot({ path: `${dir}/m6-${name}-${width}x${height}.png` });
    });
  }
}
