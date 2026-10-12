import { expect, test, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { formatReal, gaAlgorithm, landscapeProblem, type GaParams, type LandscapeOptions } from '../src/engine';
import { createRun } from '../src/run';
import { defaultsOf, entryOf } from '../src/ui/problems';
import { configOf, encodeConfig } from '../src/ui/run-config';

const url = pathToFileURL(resolve('dist/index.html')).href;
const entry = entryOf('landscape')!;
const f3 = (v: number) => formatReal([v], 3);

const open = async (page: Page, options: LandscapeOptions, change: (p: GaParams) => GaParams = (p) => p, size = 10, projector = true) => {
  const d = defaultsOf(entry, options);
  await page.goto('about:blank');
  await page.goto(url + encodeConfig(configOf({ problem: entry.create(options), init: { kind: 'random', size } }, change({ ...d.params, elites: 1 }), 7, 'landscape', options)));
  await expect(page.getByTestId('problem-button')).toHaveText(/Landscape/);
  if (projector) await page.getByRole('button', { name: 'Projector mode' }).click();
};
const real: LandscapeOptions = { function: 'two-peaks', representation: 'real', bitsPerVariable: 10 };

const cases: [string, LandscapeOptions, (p: GaParams) => GaParams][] = [
  ['real, BLX-α α = 2 and Gaussian per gene', real, (p) => ({ ...p, crossover: { enabled: true, operator: 'blx-alpha', probability: 1, alpha: 2 }, mutation: { enabled: true, mode: 'per-gene', probability: 0.6, sigma: 0.3 } })],
  ['real, arithmetic and Gaussian per individual', real, (p) => ({ ...p, crossover: { enabled: true, operator: 'arithmetic', probability: 0.9 }, mutation: { enabled: true, mode: 'per-individual', probability: 0.8, sigma: 0.1 } })],
  ['real, one-point and uniform-free Gaussian', real, (p) => ({ ...p, crossover: { enabled: true, operator: 'one-point', probability: 1 }, mutation: { enabled: true, mode: 'per-gene', probability: 0.3, sigma: 0.05 } })],
  ['plain binary 10 bits, one-point and bit flips', { function: 'himmelblau', representation: 'plain', bitsPerVariable: 10 }, (p) => ({ ...p, crossover: { enabled: true, operator: 'one-point', probability: 1 }, mutation: { enabled: true, mode: 'per-gene', probability: 0.1 } })],
  ['Gray 12 bits, uniform and per-individual flips', { function: 'rastrigin', representation: 'gray', bitsPerVariable: 12 }, (p) => ({ ...p, crossover: { enabled: true, operator: 'uniform', probability: 1 }, mutation: { enabled: true, mode: 'per-individual', probability: 0.9 } })],
];

const measure = (page: Page) =>
  page.evaluate(async () => {
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(undefined))));
    const out: string[] = [];
    for (const wrap of document.querySelectorAll('.cgrid, .mwrap')) {
      if (wrap.scrollWidth > wrap.clientWidth + 1) out.push(`sideways ${wrap.className} ${wrap.scrollWidth}>${wrap.clientWidth}`);
    }
    if (document.documentElement.scrollWidth > window.innerWidth) out.push('page overflows sideways');
    for (const card of document.querySelectorAll('.card')) {
      const box = card.getBoundingClientRect();
      for (const el of card.querySelectorAll('svg, table, .bits, .badge, .lc-gd, .lc-gl, .dec, details')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0) continue;
        if (r.right > box.right + 1 || r.left < box.left - 1) out.push(`${el.tagName.toLowerCase()}.${(el as HTMLElement).className?.toString().slice(0, 20)} leaves its card (${r.left.toFixed(0)}..${r.right.toFixed(0)} vs ${box.left.toFixed(0)}..${box.right.toFixed(0)})`);
      }
      for (const bits of card.querySelectorAll('.bits')) {
        const tops = new Set([...bits.querySelectorAll('.bit')].map((b) => Math.round(b.getBoundingClientRect().top)));
        if (tops.size > 1) out.push('a bit string wraps onto several lines');
      }
    }
    const narr = document.querySelector('#narr')!.getBoundingClientRect();
    for (const el of document.querySelectorAll('#narr > *')) {
      const r = el.getBoundingClientRect();
      if (r.top < narr.top - 1 || r.bottom > narr.bottom + 1 || r.right > narr.right + 1) out.push(`narration leaves its box: ${el.textContent!.slice(0, 40)}`);
    }
    const cur = document.querySelector('.card.current');
    const area = document.querySelector('.cgrid, .mwrap');
    if (cur && area) {
      const c = cur.getBoundingClientRect();
      const a = area.getBoundingClientRect();
      if (c.top < a.top - 1 || (c.bottom > a.bottom + 1 && c.height < a.height)) out.push('the current card is not fully visible');
    }
    return out;
  });

for (const [width, height] of [
  [1920, 1080],
  [1366, 768],
] as const) {
  for (const [name, options, change] of cases) {
    test(`at ${width}×${height} in projector mode, ${name}: at every micro-step of the crossover and mutation stages of two generations the cards fit, with the narration inside its box`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await open(page, options, change);
      let seen = 0;
      for (let k = 0; k < 2 * 45; k++) {
        await page.keyboard.press('ArrowRight');
        const heading = await page.locator('.panel h2').first().innerText();
        if (/Crossover|Mutation/.test(heading)) {
          seen++;
          expect(await measure(page), `micro-step ${k + 1} (${heading})`).toEqual([]);
        }
      }
      expect(seen).toBeGreaterThan(20);
    });
  }
}

test('BLX-α: every pair’s card shows the engine’s numbers, the number lines mark every parent and child, and a clamped child says so', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const change = (p: GaParams): GaParams => ({ ...p, crossover: { enabled: true, operator: 'blx-alpha', probability: 1, alpha: 3 } });
  await open(page, real, change, 8);
  const d = defaultsOf(entry, real);
  const run = createRun(gaAlgorithm, { setup: { problem: landscapeProblem(real), init: { kind: 'random', size: 8 } }, params: change({ ...d.params, elites: 1 }), seed: 7 });
  run.forwardCycle();
  const events = run.events(1).flatMap((e) => (e.stage === 'crossover' ? [e] : []));
  await page.keyboard.press('ArrowRight');
  for (let k = 0; k < 3; k++) await page.keyboard.press('Shift+ArrowRight'); // to the end of crossover: every pair shown
  await expect(page.getByRole('heading', { level: 2, name: /Crossover/ })).toBeVisible();
  const cards = page.locator('.ccard[data-state="revealed"]');
  await expect(cards).toHaveCount(events.length);
  let clamped = 0;
  for (let k = 0; k < events.length; k++) {
    const e = events[k]!;
    const text = await cards.nth(k).innerText();
    e.blend!.forEach((g) => {
      expect(text).toContain(`A = ${f3(g.a)}, B = ${f3(g.b)} · d = ${f3(g.d)} → interval [${f3(g.from)}, ${f3(g.to)}]`);
      g.draws.forEach((u, c) => expect(text).toContain(`u = ${Math.round(u * 1000) / 1000} → O${c + 1} ${f3(e.children[c]!.chromosome[g.a === g.a ? e.blend!.indexOf(g) : 0]!)}`));
    });
    clamped += e.children.reduce((n, c) => n + (c.clamped ?? []).filter(Boolean).length, 0);
    expect(await cards.nth(k).locator('[data-testid="number-line"] [data-mark]').count()).toBe(8);
    expect(await cards.nth(k).locator('[data-clamped="true"]').count()).toBe(e.children.reduce((n, c) => n + (c.clamped ?? []).filter(Boolean).length, 0));
  }
  expect(clamped).toBeGreaterThan(0);
  await expect(page.locator('.ccard .clamp').first()).toContainText('clamped to');
});

test('arithmetic: λ, the weights and both children are the engine’s', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const change = (p: GaParams): GaParams => ({ ...p, crossover: { enabled: true, operator: 'arithmetic', probability: 1 } });
  await open(page, real, change, 8);
  const d = defaultsOf(entry, real);
  const run = createRun(gaAlgorithm, { setup: { problem: landscapeProblem(real), init: { kind: 'random', size: 8 } }, params: change({ ...d.params, elites: 1 }), seed: 7 });
  run.forwardCycle();
  const events = run.events(1).flatMap((e) => (e.stage === 'crossover' ? [e] : []));
  await page.keyboard.press('ArrowRight');
  for (let k = 0; k < 3; k++) await page.keyboard.press('Shift+ArrowRight');
  const cards = page.locator('.ccard[data-state="revealed"]');
  for (let k = 0; k < events.length; k++) {
    const e = events[k]!;
    const text = await cards.nth(k).innerText();
    const lam = Math.round(e.lambda! * 1000) / 1000;
    expect(text).toContain(`λ = ${lam}`);
    expect(text).toContain(`O1 = ${lam}·A + ${Math.round((1 - e.lambda!) * 1000) / 1000}·B`);
    for (const c of e.children) expect(text).toContain(f3(c.chromosome[0]!));
  }
});

test('Gaussian mutation: each offspring’s table is the event’s: draws, z, steps, clamping and the result', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const change = (p: GaParams): GaParams => ({ ...p, crossover: { enabled: true, operator: 'one-point', probability: 1 }, mutation: { enabled: true, mode: 'per-gene', probability: 0.6, sigma: 0.5 } });
  await open(page, real, change, 8);
  const d = defaultsOf(entry, real);
  const run = createRun(gaAlgorithm, { setup: { problem: landscapeProblem(real), init: { kind: 'random', size: 8 } }, params: change({ ...d.params, elites: 1 }), seed: 7 });
  run.forwardCycle();
  const events = run.events(1).flatMap((e) => (e.stage === 'mutation' ? [e] : []));
  await page.keyboard.press('ArrowRight');
  for (let k = 0; k < 4; k++) await page.keyboard.press('Shift+ArrowRight'); // to the end of mutation
  await expect(page.getByRole('heading', { level: 2, name: /Mutation/ })).toBeVisible();
  const cards = page.locator('.mcard[data-state="revealed"]');
  await expect(cards).toHaveCount(events.length);
  let steps = 0;
  for (let k = 0; k < events.length; k++) {
    const e = events[k]!;
    const rows = cards.nth(k).locator('tbody tr');
    await expect(rows).toHaveCount(2);
    for (const s of e.gaussian ?? []) {
      steps++;
      const row = rows.nth(s.gene - 1);
      const text = await row.innerText();
      expect(text).toContain(`u₁ = ${Math.round(s.u1 * 1000) / 1000}, u₂ = ${Math.round(s.u2 * 1000) / 1000}`);
      expect(text).toContain(f3(s.after));
      if (s.clamped) expect(text).toContain('clamped');
    }
    expect(await cards.nth(k).locator('tbody tr.hit').count()).toBe(e.gaussian?.length ?? 0);
  }
  expect(steps).toBeGreaterThan(3);
});

test('binary-coded: each chromosome is followed by its decoded point, a child says how far it is from each parent, and a mutated offspring how far it moved; the flip table has both codings', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const options: LandscapeOptions = { function: 'single-peak', representation: 'gray', bitsPerVariable: 8 };
  await open(page, options, (p) => ({ ...p, crossover: { enabled: true, operator: 'one-point', probability: 1 }, mutation: { enabled: true, mode: 'per-gene', probability: 0.2 } }), 8);
  await page.keyboard.press('ArrowRight');
  for (let k = 0; k < 3; k++) await page.keyboard.press('Shift+ArrowRight');
  await expect(page.getByRole('heading', { level: 2, name: /Crossover/ })).toBeVisible();
  const first = page.locator('.ccard[data-state="revealed"]').first();
  await expect(first.locator('[data-testid="decoded"]')).toHaveCount(4); // two parents, two children
  await expect(first.locator('[data-testid="moved"]')).toHaveCount(2);
  await expect(first.locator('[data-testid="moved"]').first()).toContainText(/\d\.\d{3} from A · \d\.\d{3} from B/);
  await page.keyboard.press('Shift+ArrowRight');
  await expect(page.getByRole('heading', { level: 2, name: /Mutation/ })).toBeVisible();
  await page.getByTestId('flip-table').locator('summary').click();
  await expect(page.locator('[data-coding="plain"] tbody tr')).toHaveCount(2);
  await expect(page.locator('[data-coding="gray"] tbody tr')).toHaveCount(2);
  await expect(page.locator('[data-coding="plain"] thead th')).toHaveCount(9);
  await expect(page.locator('[data-testid="moved"]').first()).toContainText('moved');
});

test('the other problems’ crossover and mutation views are unchanged: no number lines, no decoded points, no flip table', async ({ page }) => {
  await page.goto(url);
  await page.keyboard.press('ArrowRight');
  for (let k = 0; k < 3; k++) await page.keyboard.press('Shift+ArrowRight');
  await expect(page.getByRole('heading', { level: 2, name: /Crossover/ })).toBeVisible();
  await expect(page.locator('.nline, .dec, [data-testid="flip-table"], .lc-gene')).toHaveCount(0);
  await page.keyboard.press('Shift+ArrowRight');
  await expect(page.locator('.nline, .dec, [data-testid="flip-table"], .lc-tab')).toHaveCount(0);
});
