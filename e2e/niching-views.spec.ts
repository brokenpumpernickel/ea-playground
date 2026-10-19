import { expect, test, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { gaAlgorithm, landscapeProblem, type CrowdingPair, type GaParams, type LandscapeOptions, type NichingConfig, type SharingEvent } from '../src/engine';
import { createRun } from '../src/run';
import { defaultsOf, entryOf } from '../src/ui/problems';
import { configOf, encodeConfig } from '../src/ui/run-config';
import { heatLayout, pixelOf } from '../src/ui/heatmap-draw';
import { canvasSize } from '../src/ui/landscape-canvas';

const url = pathToFileURL(resolve('dist/index.html')).href;
const entry = entryOf('landscape')!;
const options: LandscapeOptions = { function: 'two-peaks', representation: 'real', bitsPerVariable: 10 };
const sharing: NichingConfig = { method: 'sharing', sigma: 2, alpha: 1 };
const crowding: NichingConfig = { method: 'crowding', sigma: 2, alpha: 1 };
const roulette: GaParams['selection'] = { method: 'roulette', chain: [{ step: 'identity' }] };
const tournament: GaParams['selection'] = { method: 'tournament', size: 2 };

const paramsOf = (niching: NichingConfig, selection: GaParams['selection']): GaParams => ({ ...defaultsOf(entry, options).params, selection, niching });
const open = async (page: Page, niching: NichingConfig, selection: GaParams['selection'], size = 12, projector = false) => {
  await page.goto('about:blank');
  await page.goto(url + encodeConfig(configOf({ problem: entry.create(options), init: { kind: 'random', size } }, paramsOf(niching, selection), 7, 'landscape', options)));
  await expect(page.getByTestId('problem-button')).toHaveText(/Landscape/);
  if (projector) await page.getByRole('button', { name: 'Projector mode' }).click();
};
const engine = (niching: NichingConfig, selection: GaParams['selection'], size = 12) => {
  const run = createRun(gaAlgorithm, { setup: { problem: landscapeProblem(options), init: { kind: 'random', size } }, params: paramsOf(niching, selection), seed: 7 });
  run.forwardCycle();
  return run;
};
const read = (text: string) => Number(text.replace('−', '-').replace(/,/g, ''));
/** Into generation 1's first stage, then to the end of `stages` stages. */
const toStageEnd = async (page: Page, stages: number) => {
  await page.keyboard.press('ArrowRight');
  for (let k = 0; k < stages; k++) await page.keyboard.press('Shift+ArrowRight');
};

test('roulette with fitness sharing: the table has a niche count and a shared weight for every individual, equal to the engine\'s, and the formula says it divides by the niche count', async ({ page }) => {
  await open(page, sharing, roulette);
  await page.keyboard.press('ArrowRight');
  const run = engine(sharing, roulette);
  const e = run.events(1).find((x): x is SharingEvent => x.stage === 'selection' && x.kind === 'sharing')!;
  const table = page.getByRole('table', { name: 'Selection weights and probabilities' });
  await expect(table.locator('th[data-col="niche count"]')).toHaveText('Niche count');
  await expect(table.locator('th[data-col="shared"]')).toHaveText('Shared');
  for (const [k, id] of e.individualIds.entries()) {
    const row = table.locator(`tr[data-row="${id}"]`);
    expect(read(await row.locator('td[data-col="niche count"]').innerText())).toBeCloseTo(e.counts[k]!, 2);
    expect(read(await row.locator('td[data-col="shared"]').innerText())).toBeCloseTo(e.shared[k]!, 2);
  }
  await expect(page.getByTestId('sharing-formula')).toContainText('÷ niche count');
  await expect(page.getByTestId('sharing-formula')).toContainText('σ = 2');
  await expect(page.getByTestId('narration')).toBeVisible();
});

test('the same table with no niching has no niche columns', async ({ page }) => {
  await page.goto('about:blank');
  const d = defaultsOf(entry, options);
  await page.goto(url + encodeConfig(configOf({ problem: entry.create(options), init: { kind: 'random', size: 12 } }, { ...d.params, selection: roulette }, 7, 'landscape', options)));
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('th[data-col="niche count"]')).toHaveCount(0);
  await expect(page.getByTestId('sharing-formula')).toHaveCount(0);
});

test('tournaments with fitness sharing: a table of every individual\'s fitness, niche count and shared weight, and each contestant shown with its shared weight', async ({ page }) => {
  await open(page, sharing, tournament);
  await page.keyboard.press('ArrowRight');
  const run = engine(sharing, tournament);
  const e = run.events(1).find((x): x is SharingEvent => x.stage === 'selection' && x.kind === 'sharing')!;
  await expect(page.getByTestId('sharing-expl')).toContainText('shared weights');
  const rows = page.getByTestId('sharing-table').locator('tbody tr');
  await expect(rows).toHaveCount(12);
  for (const [k, id] of e.individualIds.entries()) {
    const cells = rows.nth(k).locator('td');
    expect(Number(await cells.nth(0).innerText())).toBe(id);
    expect(read(await cells.nth(2).innerText())).toBeCloseTo(e.counts[k]!, 2);
    expect(read(await cells.nth(3).innerText())).toBeCloseTo(e.shared[k]!, 2);
  }
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('[data-tournament="1"] .contestants')).toContainText('shared');
  const first = run.events(1).find((x) => x.stage === 'selection' && x.kind === 'tournament') as unknown as { winnerId: number; contestants: { shared: number }[] };
  await expect(page.locator('[data-tournament="1"]')).toContainText(`winner: individual ${first.winnerId}`);
});

test('deterministic crowding\'s selection: every individual once, each draw revealed by a micro-step with the engine\'s r and individual, the pool filling in order', async ({ page }) => {
  await open(page, crowding, tournament);
  await page.keyboard.press('ArrowRight');
  const run = engine(crowding, tournament);
  const draws = run.events(1).filter((x) => x.stage === 'selection' && x.kind === 'draw') as unknown as { draw: number; r: number; individualId: number }[];
  expect(draws).toHaveLength(12);
  await expect(page.getByTestId('crowding-selection')).toContainText('no selection pressure');
  await expect(page.locator('[data-draw][data-state="revealed"]')).toHaveCount(0);
  for (let k = 1; k <= 12; k++) {
    await page.keyboard.press('ArrowRight');
    const card = page.locator(`[data-draw="${k}"]`);
    await expect(card).toHaveAttribute('data-state', 'revealed');
    await expect(card).toContainText(`individual ${draws[k - 1]!.individualId}`);
    await expect(card).toContainText(`${12 - k + 1} waiting`);
    await expect(page.getByTestId('narration')).toContainText(`Draw ${k}:`);
    await expect(page.getByTestId('narration')).toContainText(`individual ${draws[k - 1]!.individualId} is parent number ${k}`);
  }
  const pool = await page.getByTestId('mating-pool').locator('li').evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-id'))));
  expect(pool).toEqual(draws.map((d) => d.individualId));
  expect([...pool].sort((a, b) => a - b)).toEqual(Array.from({ length: 12 }, (_, k) => k + 1));
  // pairing says it is not a selection with replacement
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#stage-heading')).toContainText('Pairing');
  await expect(page.getByText('Deterministic crowding: every individual is a parent exactly once')).toBeVisible();
});

test('deterministic crowding\'s replacement: the duels of every pair as the engine decided them, the winners marked, and the next population saying which places were kept', async ({ page }) => {
  await open(page, crowding, tournament);
  await toStageEnd(page, 6);
  const run = engine(crowding, tournament);
  const event = run.events(1).find((x) => x.stage === 'replacement') as unknown as { duels: CrowdingPair[]; population: number[] };
  const before = run.snapshot(0).state.population;
  await expect(page.getByTestId('duels')).toBeVisible();
  await expect(page.locator('.replacement .expl')).toContainText('Deterministic crowding');
  for (const pair of event.duels) {
    for (const d of pair.duels) {
      const row = page.locator(`[data-testid="duels"] tr[data-child="${d.childId}"]`);
      await expect(row).toHaveAttribute('data-pair', String(pair.pair));
      await expect(row).toHaveAttribute('data-winner', d.winner);
      await expect(row.locator('td').nth(d.childId === pair.duels[0]!.childId && pair.duels.length > 0 ? 0 : 0)).toBeVisible();
      await expect(row).toContainText(`#${d.parentId}`);
      await expect(row).toContainText(d.winner === 'child' ? 'child wins' : 'stays');
    }
    const matching = await page.getByTestId(`matching-${pair.pair}`).innerText();
    expect(matching).toContain(pair.matching === 'straight' ? 'child 1 ↔ A, child 2 ↔ B' : pair.matching === 'crossed' ? 'child 1 ↔ B, child 2 ↔ A' : 'the one child');
  }
  const wins = event.duels.flatMap((d) => d.duels).filter((d) => d.winner === 'child').length;
  await expect(page.locator('[data-next][data-source="offspring"]')).toHaveCount(wins);
  await expect(page.locator('[data-next][data-source="kept"]')).toHaveCount(12 - wins);
  expect(await page.locator('[data-next]').evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-next'))))).toEqual(event.population);
  await expect(page.getByTestId('narration')).toContainText(`Duels: ${wins} of 12 children took the place of the parent they duelled`);
  expect(before).toHaveLength(12);
});

test('the niche ring: with sharing and an individual selected, a dashed ring of radius σ lies on the heatmap centred on it, with its radius written and a sentence; gone without a selection and without sharing', async ({ page }) => {
  await open(page, sharing, roulette);
  await page.getByTestId('show-landscape').click();
  await expect(page.getByTestId('niche-ring')).toHaveCount(0);
  const run = engine(sharing, roulette);
  const first = run.snapshot(0).state.population[2]!;
  await page.getByTestId('heat-marks').locator(`[data-marker="individual"][data-id="${first.id}"] .body`).first().dispatchEvent('click');
  const ring = page.getByTestId('niche-ring');
  await expect(ring).toBeVisible();
  const layout = heatLayout(canvasSize.width, canvasSize.height);
  const region = { x0: -5, x1: 5, y0: -5, y1: 5 };
  const at = pixelOf(layout, region, first.values![0]!, first.values![1]!);
  expect(Number(await ring.getAttribute('data-cx'))).toBeCloseTo(at.px, 6);
  expect(Number(await ring.getAttribute('data-cy'))).toBeCloseTo(at.py, 6);
  const pw = Math.round(layout.R - layout.L);
  const ph = Math.round(layout.B - layout.T);
  expect(Number(await ring.getAttribute('data-rx'))).toBeCloseTo((2 * (pw - 1)) / 10, 6);
  expect(Number(await ring.getAttribute('data-ry'))).toBeCloseTo((2 * (ph - 1)) / 10, 6);
  expect(await ring.getAttribute('data-sigma')).toBe('2');
  await expect(page.getByTestId('niche-label')).toHaveText('σ = 2');
  await expect(page.getByTestId('ring-sentence')).toContainText(`ring round individual ${first.id}`);
  expect(await ring.evaluate((e) => getComputedStyle(e).strokeDasharray)).not.toBe('none');
  // the same individual, selected again, clears the selection and the ring
  await page.getByTestId('heat-marks').locator(`[data-marker="individual"][data-id="${first.id}"] .body`).first().dispatchEvent('click');
  await expect(page.getByTestId('niche-ring')).toHaveCount(0);
});

test('no ring under deterministic crowding or without niching, even with an individual selected', async ({ page }) => {
  await open(page, crowding, tournament);
  await page.getByTestId('show-landscape').click();
  const id = engine(crowding, tournament).snapshot(0).state.population[0]!.id;
  await page.getByTestId('heat-marks').locator(`[data-marker="individual"][data-id="${id}"] .body`).first().dispatchEvent('click');
  await expect(page.locator('.idbtn[aria-pressed="true"], tr.sel').first()).toBeVisible();
  await expect(page.getByTestId('niche-ring')).toHaveCount(0);
});

test('the ring in the focus view too, at the heatmap\'s larger size', async ({ page }) => {
  await open(page, sharing, roulette);
  await page.getByTestId('show-landscape').click();
  await page.getByTestId('focus-toggle').click();
  const id = engine(sharing, roulette).snapshot(0).state.population[1]!.id;
  await page.getByTestId('heat-marks').locator(`[data-marker="individual"][data-id="${id}"] .body`).first().dispatchEvent('click');
  const ring = page.getByTestId('niche-ring');
  await expect(ring).toBeVisible();
  // a circle of 2 units, drawn with the larger plot's own scales (the canvas is 892 × 620 in the focus view)
  const layout = heatLayout(892, 620);
  expect(Number(await ring.getAttribute('data-rx'))).toBeCloseTo((2 * (Math.round(layout.R - layout.L) - 1)) / 10, 6);
  expect(Number(await ring.getAttribute('data-ry'))).toBeCloseTo((2 * (Math.round(layout.B - layout.T) - 1)) / 10, 6);
  // it is clipped to the plot, so nothing of it falls on the axes or the scale
  expect(await ring.evaluate((e) => !!e.closest('g[clip-path]'))).toBe(true);
});

for (const projector of [false, true]) {
  for (const [width, height] of [[1920, 1080], [1366, 768]] as const) {
    for (const [label, niching, selection, size] of [
      ['sharing with roulette', sharing, roulette, 12],
      ['sharing with tournaments', sharing, tournament, 12],
      ['crowding', crowding, tournament, 12],
      ['crowding, 40 individuals', crowding, tournament, 40],
      ['crowding, an odd population', crowding, tournament, 13],
    ] as [string, NichingConfig, GaParams['selection'], number][]) {
      test(`${label} at ${width}×${height}${projector ? ' in projector mode' : ''}: every stage of two generations stays inside the panel, the narration is whole and the page does not scroll`, async ({ page }) => {
        test.setTimeout(120_000);
        await page.setViewportSize({ width, height });
        await open(page, niching, selection, size, projector);
        await page.locator('#narr').click();
        const check = async (at: string) => {
          const bad = await page.evaluate(() => {
            const out: string[] = [];
            const panel = document.querySelector('[data-testid="stage-panel"]')!.getBoundingClientRect();
            const body = document.querySelector('#stagebody')!;
            const bodyBox = body.getBoundingClientRect();
            for (const el of body.querySelectorAll('.roulette, .tournament, .crowdsel, .replacement, .pairing, .rgrid, .evaluation, .tgrid, .poolbox, .duels, .sharetable, .weights')) {
              const r = el.getBoundingClientRect();
              if (r.width === 0) continue;
              if (r.right > bodyBox.right + 1 || r.left < bodyBox.left - 1) out.push(`${el.className} leaves the stage body sideways`);
            }
            // nothing scrolls sideways inside the views: a cut-off column heading is content the audience cannot read
            for (const el of body.querySelectorAll('.weights, .duelt, .sharetable, .duelcol, .rgrid')) {
              if (el.getBoundingClientRect().width === 0) continue;
              if (el.scrollWidth - el.clientWidth > 1) out.push(`${el.className || el.tagName} scrolls sideways (${el.scrollWidth} > ${el.clientWidth})`);
            }
            // the duels table and the next-population column sit side by side without overlapping
            const duels = body.querySelector('.duelcol');
            const next = body.querySelector('.rgrid > section[aria-label="Next population"]');
            if (duels && next) {
              const a = duels.getBoundingClientRect();
              const b = next.getBoundingClientRect();
              if (a.right > b.left + 1) out.push('the duels overlap the next population');
              for (const cell of duels.querySelectorAll('td, th')) {
                const c = cell.getBoundingClientRect();
                if (c.width > 0 && c.right > a.right + 1) out.push('a duel cell sticks out of its column');
              }
            }
            const narr = document.querySelector('#narr')!;
            if (narr.scrollHeight - narr.clientHeight > 1) out.push('the narration overflows its box');
            const nr = narr.getBoundingClientRect();
            if (nr.bottom > panel.bottom + 1) out.push('the narration leaves the panel');
            if (document.documentElement.scrollWidth > window.innerWidth) out.push('the page scrolls sideways');
            return out;
          });
          expect(bad, at).toEqual([]);
        };
        await check('start');
        for (let k = 0; k < 2 * (size + 40); k++) {
          await page.keyboard.press('ArrowRight');
          await check(`micro-step ${k}`);
        }
      });
    }
  }
}
