import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { gaAlgorithm, landscapeFunctionInfo, landscapeProblem, metricsOfProblem, type CrowdingPair, type GaParams, type GaSetup, type LandscapeOptions, type SharingEvent } from '../src/engine';
import { createRun } from '../src/run';
import { statsLines } from '../src/ui/spread-model';

const url = pathToFileURL(resolve('dist/index.html')).href;
const shots = resolve('.scratch/milestone-9-niching/screenshots');
test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

interface PresetFile { seed: number; options: LandscapeOptions; setup: { init: GaSetup['init'] }; params: GaParams }
const presetFile = (name: string) => JSON.parse(readFileSync(resolve(`src/ui/presets/${name}.json`), 'utf8')) as PresetFile;
const sharingPreset = presetFile('sa-landscape-two-peaks-sharing');
const crowdingPreset = presetFile('sb-landscape-two-peaks-crowding');

const engineOf = (p: PresetFile, params: GaParams = p.params) => {
  const problem = landscapeProblem(p.options);
  const run = createRun(gaAlgorithm, { setup: { problem, init: p.setup.init }, params, seed: p.seed }, { eventCacheSize: 0 });
  return { run, problem, summary: (g: number) => statsLines(metricsOfProblem(run.snapshot(g).state, problem))[0] };
};
const peaksAt = (e: ReturnType<typeof engineOf>, g: number) => {
  const pts = e.run.snapshot(g).state.population.map((i) => e.problem.pointOf(i.chromosome));
  return landscapeFunctionInfo['two-peaks'].peaks!.map((p) => `${p.name} ${pts.filter((q) => Math.hypot(q.x - p.x, q.y - p.y) <= 1.5).length}`).join(' · ');
};
const numberPattern = /-?\d+(\.\d+)?(e-?\d+)?/g;
const expectSummary = async (page: Page, expected: string) => {
  const got = (await page.getByTestId('summary').innerText()).split('\n')[0]!.trim();
  expect(got.replace(numberPattern, '#')).toBe(expected.replace(numberPattern, '#'));
  const want = expected.match(numberPattern)!.map(Number);
  got.match(numberPattern)!.map(Number).forEach((value, k) => expect(value).toBeCloseTo(want[k]!, 2));
};
const read = (text: string) => Number(text.replace('−', '-').replace(/,/g, ''));
const heading = (page: Page) => page.locator('#pop-heading');
const loadPreset = async (page: Page, name: string) => {
  if (!(await page.getByTestId('drawer').count())) await page.getByRole('button', { name: /Parameters/ }).click();
  await page.locator('#preset').selectOption({ label: name });
  await page.getByTestId('load-preset').click();
  await page.getByRole('button', { name: 'Restart and apply' }).click();
};

test('the ninth classroom scenario: load the sharing preset, step into its selection and read the niche counts, select an individual and see its ring, run to the stop and read the peak counts, switch niching off for the next generation, load the crowding preset, step through its draws and duels, run to its stop, share the link and open it in a fresh page', async ({ page, context }) => {
  mkdirSync(shots, { recursive: true });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(url);
  await page.getByRole('button', { name: 'Projector mode' }).click();
  await page.getByTestId('problem-button').click();
  await page.getByRole('menuitemradio', { name: /Landscape/ }).click();
  await page.getByRole('button', { name: 'Restart and apply' }).click();

  // 1. the sharing preset, with its text and the Niching section of the drawer
  await page.getByRole('button', { name: /Parameters/ }).click();
  await page.locator('#preset').selectOption({ label: 'Two peaks: fitness sharing' });
  await expect(page.getByTestId('preset-lookfor')).toContainText('σ = 3');
  await page.getByTestId('load-preset').click();
  await page.getByRole('button', { name: 'Restart and apply' }).click();
  await expect(page.locator('#niching-method')).toHaveValue('sharing');
  await expect(page.locator('#niching-sigma')).toHaveValue('3');
  await page.locator('[data-section="niching"]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${shots}/classroom-1-drawer-niching.png` });
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('seed')).toHaveText(String(sharingPreset.seed));
  const sharing = engineOf(sharingPreset);
  await expectSummary(page, sharing.summary(0));
  await expect(page.getByTestId('peak-readout')).toHaveText(`near: ${peaksAt(sharing, 0)}`);

  // 2. generation 1's selection: every individual's niche count and shared weight equal the engine's
  await page.keyboard.press('ArrowRight');
  sharing.run.forwardCycle();
  const event = sharing.run.events(1).find((x): x is SharingEvent => x.stage === 'selection' && x.kind === 'sharing')!;
  const table = page.getByRole('table', { name: 'Selection weights and probabilities' });
  for (const [k, id] of event.individualIds.entries()) {
    const row = table.locator(`tr[data-row="${id}"]`);
    expect(read(await row.locator('td[data-col="niche count"]').innerText())).toBeCloseTo(event.counts[k]!, 2);
    expect(read(await row.locator('td[data-col="shared"]').innerText())).toBeCloseTo(event.shared[k]!, 2);
  }
  await expect(page.getByTestId('sharing-formula')).toContainText('σ = 3');
  await page.screenshot({ path: `${shots}/classroom-2-sharing-selection.png` });

  // 3. the Landscape view: select an individual, its niche is a ring of radius σ = 3
  await page.getByTestId('show-landscape').click();
  const first = sharing.run.snapshot(0).state.population[1]!;
  await page.getByTestId('heat-marks').locator(`[data-marker="individual"][data-id="${first.id}"] .body`).first().dispatchEvent('click');
  await expect(page.getByTestId('niche-ring')).toHaveAttribute('data-sigma', '3');
  await expect(page.getByTestId('niche-label')).toHaveText('σ = 3');
  await page.screenshot({ path: `${shots}/classroom-3-sharing-ring.png` });

  // 4. Run until stop pauses in generation 24 with the engine's counts near each hill
  await page.getByTestId('show-stage').click();
  await page.getByRole('button', { name: 'Run until stop' }).click();
  await expect(heading(page)).toContainText('generation 24');
  for (let g = 2; g <= 24; g++) sharing.run.forwardCycle();
  await expectSummary(page, sharing.summary(24));
  await expect(page.getByTestId('peak-readout')).toHaveText(`near: ${peaksAt(sharing, 24)}`);
  await expect(page.getByTestId('peak-sentence')).toContainText('broad hill 6, narrow hill 13');
  await page.getByTestId('show-landscape').click();
  await page.screenshot({ path: `${shots}/classroom-4-sharing-stop.png` });

  // 5. switch niching off: pending until the next generation boundary, then the selection has no niche columns
  await page.getByRole('button', { name: /Parameters/ }).click();
  await page.locator('#niching-method').selectOption('none');
  await expect(page.getByTestId('pending-niching-method')).toBeVisible();
  await expect(page.getByTestId('pending-chip')).toContainText('Niching');
  await page.keyboard.press('Escape');
  await page.getByTestId('show-stage').click();
  await page.keyboard.press('g');
  await expect(page.getByTestId('pending-chip')).toHaveCount(0);
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('PageUp');
  await page.keyboard.press('PageDown');
  await page.keyboard.press('ArrowRight');
  await expect(table.locator('th[data-col="niche count"]')).toHaveCount(0);
  await page.screenshot({ path: `${shots}/classroom-5-niching-off.png` });

  // 6. the crowding preset: every individual is a parent once; the draws, then the duels
  await loadPreset(page, 'Two peaks: deterministic crowding');
  await expect(page.locator('#niching-method')).toHaveValue('crowding');
  await expect(page.getByTestId('selection-crowding-note')).toBeVisible();
  await page.keyboard.press('Escape');
  const crowding = engineOf(crowdingPreset);
  await expectSummary(page, crowding.summary(0));
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('crowding-selection')).toBeVisible();
  await expect(page.getByTestId('crowding-draws').locator('[data-state="revealed"]')).toHaveCount(1);
  await page.screenshot({ path: `${shots}/classroom-6-crowding-draws.png` });
  for (let k = 0; k < 6; k++) await page.keyboard.press('Shift+ArrowRight');
  crowding.run.forwardCycle();
  await expect(heading(page)).toContainText('generation 1');
  const pairs = crowding.run.events(1).find((x) => x.stage === 'replacement' && 'duels' in x) as unknown as { duels: CrowdingPair[] };
  const rows = page.locator('[data-testid="duels"] tr[data-child]');
  await expect(rows).toHaveCount(pairs.duels.reduce((n, p) => n + p.duels.length, 0));
  for (const pair of pairs.duels) for (const d of pair.duels) await expect(page.locator(`[data-testid="duels"] tr[data-child="${d.childId}"]`)).toHaveAttribute('data-winner', d.winner);
  await page.screenshot({ path: `${shots}/classroom-7-crowding-duels.png` });

  // 7. Run until stop pauses in generation 139 with the engine's counts
  await page.getByRole('button', { name: 'Run until stop' }).click();
  await expect(heading(page)).toContainText('generation 139', { timeout: 30_000 });
  for (let g = 2; g <= 139; g++) crowding.run.forwardCycle();
  await expectSummary(page, crowding.summary(139));
  await expect(page.getByTestId('peak-readout')).toHaveText(`near: ${peaksAt(crowding, 139)}`);
  await page.getByTestId('show-landscape').click();
  await page.screenshot({ path: `${shots}/classroom-8-crowding-stop.png` });

  // 8. the link carries niching: a fresh page opens the same run
  await page.getByRole('button', { name: /Parameters/ }).click();
  await page.getByTestId('copy-link').click();
  await expect(page.getByTestId('share-status')).toBeVisible();
  const link = await page.evaluate(() => navigator.clipboard.readText());
  const fresh = await context.newPage();
  await fresh.setViewportSize({ width: 1920, height: 1080 });
  await fresh.goto(link);
  await expect(fresh.getByTestId('link-notice')).toHaveCount(0);
  await expect(fresh.getByTestId('problem-button')).toHaveText(/Landscape/);
  await expectSummary(fresh, engineOf(crowdingPreset).summary(0));
  await fresh.getByRole('button', { name: /Parameters/ }).click();
  await expect(fresh.locator('#niching-method')).toHaveValue('crowding');

  // 9. the smaller laptop screen
  await fresh.setViewportSize({ width: 1366, height: 768 });
  await fresh.keyboard.press('Escape');
  for (let k = 0; k < 8; k++) await fresh.keyboard.press('Shift+ArrowRight');
  await fresh.screenshot({ path: `${shots}/classroom-9-1366x768.png` });
});
