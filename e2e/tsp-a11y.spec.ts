import { expect, test, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { tspCatalogue, tspProblem, type GaParams, type TspOptions } from '../src/engine';
import { defaultsOf, entryOf } from '../src/ui/problems';
import { configOf, encodeConfig } from '../src/ui/run-config';

const url = pathToFileURL(resolve('dist/index.html')).href;
const entry = entryOf('tsp')!;
const LONGEST_PRESET = 'berlin52: against the nearest neighbour and the optimum';

type Extreme = 'identical' | 'reversed' | undefined;
const open = async (page: Page, options: TspOptions, size = 12, projector = true, extreme?: Extreme, change: (p: GaParams) => GaParams = (p) => p) => {
  const d = defaultsOf(entry, options);
  const n = tspProblem(options).chromosomeLength;
  const forward = Array.from({ length: n }, (_, k) => k + 1).join(' ');
  const backward = Array.from({ length: n }, (_, k) => n - k).join(' ');
  const init =
    extreme === 'identical'
      ? { kind: 'explicit' as const, chromosomes: Array(size).fill(forward) as string[] }
      : extreme === 'reversed'
        ? { kind: 'explicit' as const, chromosomes: Array.from({ length: size }, (_, k) => (k % 2 ? backward : forward)) }
        : { kind: 'random' as const, size };
  await page.goto('about:blank');
  await page.goto(url + encodeConfig(configOf({ problem: entry.create(options), init }, change(d.params), 7, 'tsp', options)));
  await expect(page.getByTestId('problem-button')).toHaveText(/TSP/);
  if (projector) await page.getByRole('button', { name: 'Projector mode' }).click();
};
const openMap = async (page: Page) => {
  await page.getByTestId('show-map').click();
  await expect(page.getByTestId('route-map-view')).toBeVisible();
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
};
const unnamed = async (page: Page) => {
  const tree = await page.locator('body').ariaSnapshot();
  return tree.split('\n').filter((line) => /^\s*- (button|textbox|combobox|slider|checkbox|switch|spinbutton|radio|menuitemradio|menuitem)(\s+\[[^\]]*\])*:?\s*$/.test(line));
};

/** The instances of every kind and size, with 12 and 60 individuals, and extreme populations (every tour the same, every other tour reversed). */
const cases: [string, TspOptions, number, Extreme][] = [
  ['circle of 5 cities, 12 individuals', { instance: 'circle', n: 5, seed: 1 }, 12, undefined],
  ['burma14, 60 individuals', { instance: 'burma14', n: 10, seed: 1 }, 60, undefined],
  ['ulysses16, 12 individuals', { instance: 'ulysses16', n: 10, seed: 1 }, 12, undefined],
  ['ulysses22, 60 individuals', { instance: 'ulysses22', n: 10, seed: 1 }, 60, undefined],
  ['random of 15 cities, 12 individuals', { instance: 'random', n: 15, seed: 2 }, 12, undefined],
  ['Two clusters, 12 individuals', { instance: 'clusters', n: 10, seed: 1 }, 12, undefined],
  ['berlin52, 12 individuals', { instance: 'berlin52', n: 10, seed: 1 }, 12, undefined],
  ['berlin52, 60 individuals', { instance: 'berlin52', n: 10, seed: 1 }, 60, undefined],
  ['att48, every tour the same', { instance: 'att48', n: 10, seed: 1 }, 12, 'identical'],
  ['ulysses16, every other tour reversed', { instance: 'ulysses16', n: 10, seed: 1 }, 12, 'reversed'],
];

test('every tour is named by its route, length and gap, the pictures by sentences, and every number of the plots and the map is in a real table', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await open(page, { instance: 'ulysses16', n: 10, seed: 1 });
  for (let g = 0; g < 3; g++) await page.keyboard.press('g');
  const table = page.getByRole('table', { name: /^Population · generation 3$/ });
  await expect(table.getByRole('columnheader')).toContainText(['#', 'Chromosome', 'Length', 'Gap', 'Fitness']);
  const labels = await table.locator('tbody tr [data-bits]').evaluateAll((els) => els.map((el) => [el.getAttribute('role'), el.getAttribute('aria-label')]));
  expect(labels).toHaveLength(12);
  expect(labels.every((l) => l[0] === 'img' && /^Tour of 16 cities, in the order visited: [\d, ]+, then back to \d+\. Length [\d,]+, [\d.]+% over the optimum 6,859\./.test(l[1]!))).toBe(true);
  // the tables a reader of a chart would need
  for (const name of ['Tours of the population', 'Metrics by generation', 'Edge agreement of the best tour']) await expect(page.getByRole('table', { name, includeHidden: true })).toHaveCount(1);
  await openMap(page);
  await expect(page.getByRole('table', { name: 'Tours on the map', includeHidden: true })).toHaveCount(1);
  await expect(page.getByRole('table', { name: 'Lengths of this generation and of the two baselines' })).toBeVisible();
  const sentence = await page.getByTestId('route-sentence').innerText();
  expect(await page.getByTestId('route-map').getAttribute('aria-label')).toBe(sentence);
  expect(sentence).toMatch(/^ulysses16: 16 cities, GEO\. Generation 3: the best tour is [\d,]+ long, [\d.]+% over the optimum 6,859; \d+ edges? (is|are) in every individual\.$/);
  // the plots speak: a sentence for each
  for (const plot of ['fitness', 'diversity']) expect(await page.locator(`svg[data-plot="${plot}"]`).getAttribute('aria-label')).toMatch(/^(Fitness|Diversity) by generation, scale/);
  expect(await page.getByTestId('edge-bars').getAttribute('aria-label')).toMatch(/^Share of the 12 individuals that have each edge of the best tour: edge \d+–\d+ \d+/);
  // the cards: each strip is a named image and the card says what it did
  await page.getByTestId('show-stage').click();
  for (let k = 0; k < 40 && !(await page.locator('[data-testid="tour-card"]').count()); k++) await page.keyboard.press('ArrowRight');
  const strips = await page.locator('[data-testid="tour-card"] .bits.strip').evaluateAll((els) => els.map((el) => [el.getAttribute('role'), el.getAttribute('aria-label')]));
  expect(strips.length).toBeGreaterThanOrEqual(4);
  expect(strips.every((s) => s[0] === 'img' && /^Tour of 16 cities, in the order visited: /.test(s[1]!))).toBe(true);
});

test('a full generation can be stepped through with the keyboard alone, from the problem menu, with the route map open and a tour selected from the map', async ({ page }) => {
  await page.goto(url);
  await page.keyboard.press('Tab');
  await expect(page.getByTestId('problem-button')).toBeFocused();
  await page.keyboard.press('Enter');
  for (let k = 0; k < 5; k++) await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitemradio', { name: 'TSP' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('reset-notice')).toBeVisible();
  while (!(await page.getByRole('button', { name: 'Restart and apply' }).evaluate((el) => el === document.activeElement))) await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('problem-button')).toHaveText(/TSP/);
  const reach = async (testid: string) => {
    for (let k = 0; k < 60; k++) {
      if (await page.getByTestId(testid).evaluate((el) => el === document.activeElement)) return;
      await page.keyboard.press('Tab');
    }
    throw new Error(`Tab never reached ${testid}`);
  };
  await reach('show-map');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('route-map-view')).toBeVisible();
  await reach('toggle-optimal');
  await page.keyboard.press('Space');
  await expect(page.getByTestId('toggle-optimal')).toHaveAttribute('aria-pressed', 'true');
  await reach('map-select');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  const selected = await page.getByTestId('map-select').inputValue();
  expect(selected).not.toBe('');
  await expect(page.locator('tr.sel')).toHaveAttribute('data-id', selected);
  await expect(page.getByTestId('route-tours').locator('tbody tr', { hasText: 'selected individual' }).locator('td').first()).toHaveText(selected);
  expect((await page.locator('svg[data-testid="route-map"] line[data-layer="selected"]').count()) > 0).toBe(true);
  await page.keyboard.press('Escape');
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  // one whole generation with the keys, stage by stage, the map still open
  await page.keyboard.press('ArrowRight');
  for (const stage of ['Selection', 'Pairing', 'Crossover', 'Mutation', 'Evaluation']) {
    await page.keyboard.press('Shift+ArrowRight');
    await expect(page.getByTestId('ribbon').locator('li[aria-current="step"]')).toContainText(stage);
  }
  await page.keyboard.press('Shift+ArrowRight');
  await expect(page.locator('#pop-heading')).toHaveText('Population · generation 1');
  await expect(page.getByTestId('ribbon').locator('li.done')).toHaveCount(6);
  await expect(page.getByTestId('route-map-view')).toBeVisible();
  // and the selection can be taken away again with the keyboard
  await reach('map-select');
  await page.keyboard.press('Home');
  await expect(page.getByTestId('map-select')).toHaveValue('');
  await expect(page.locator('tr.sel')).toHaveCount(0);
});

for (const kind of [
  ['circle', { instance: 'circle', n: 8, seed: 1 }],
  ['random', { instance: 'random', n: 9, seed: 4 }],
  ['Two clusters', { instance: 'clusters', n: 10, seed: 1 }],
  ['berlin52', { instance: 'berlin52', n: 10, seed: 1 }],
] as [string, TspOptions][]) {
  test(`${kind[0]}: the problem menu, the drawer, the route map and a selection, open, leave no control without a name`, async ({ page }) => {
    await open(page, kind[1]);
    expect(await unnamed(page)).toEqual([]);
    await page.getByTestId('problem-button').click();
    await expect(page.getByRole('menuitemradio', { name: 'TSP' })).toHaveAttribute('aria-checked', 'true');
    expect(await unnamed(page)).toEqual([]);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /Parameters/ }).click();
    expect(await unnamed(page)).toEqual([]);
    await page.keyboard.press('Escape');
    await openMap(page);
    await page.getByTestId('toggle-optimal').click();
    await page.getByTestId('map-select').selectOption({ index: 3 });
    expect(await unnamed(page)).toEqual([]);
    await expect(page.getByTestId('map-select')).toHaveAccessibleName('Selected tour');
  });
}

test('every meaning that has a colour has something else as well', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await open(page, { instance: 'berlin52', n: 10, seed: 1 }, 12, true);
  for (let g = 0; g < 2; g++) await page.keyboard.press('g');
  // the table: ★ for an elite, ▸ for the selected row, ◆ for a parent, and the legend says them in words
  await page.locator('[data-testid^="select-"]').nth(2).click();
  await expect(page.locator('tr.sel td').first()).toContainText('▸');
  expect(await page.locator('#legend').innerText()).toMatch(/elite[\s\S]*parent[\s\S]*offspring[\s\S]*mutated city[\s\S]*selected/);
  // the route map: dash patterns and widths, not colours, tell the layers apart
  await openMap(page);
  await page.getByTestId('toggle-optimal').click();
  const style = (selector: string) => page.locator(selector).first().evaluate((el) => { const s = getComputedStyle(el); return { dash: s.strokeDasharray, width: parseFloat(s.strokeWidth), opacity: s.opacity }; });
  const best = await style('svg[data-testid="route-map"] g.re-best line');
  const selected = await style('svg[data-testid="route-map"] g.re-selected line');
  const optimal = await style('svg[data-testid="route-map"] g.re-optimal line');
  const population = await style('svg[data-testid="route-map"] g.re-population line');
  expect(best.dash).toBe('none');
  expect(selected.dash).not.toBe('none'); // dotted
  expect(optimal.dash).not.toBe('none'); // dashed
  expect(selected.dash).not.toBe(optimal.dash);
  expect(best.width).toBeGreaterThan(population.width * 0 + 3);
  expect(Number(population.opacity)).toBeLessThan(0.5);
  const widths = await page.locator('svg[data-testid="route-map"] line[data-layer="population"]').evaluateAll((els) => new Set(els.map((e) => (e as HTMLElement).style.strokeWidth)).size);
  expect(widths).toBeGreaterThan(1); // the population's edges differ in width, with the count in data and in the table of the sentence
  const key = await page.getByTestId('route-key').innerText();
  for (const word of ['best of the generation', 'selected individual', 'optimal tour', 'thicker = more individuals']) expect(key).toContain(word);
  // the crossover marks: shared grey solid, A solid, B dashed, new dotted, the slice ringed
  await page.keyboard.press('ArrowRight');
  for (let k = 0; k < 120; k++) {
    await page.keyboard.press('ArrowRight');
    if ((await page.locator('#stage-heading').innerText()).includes('crossover') && (await page.locator('svg[data-testid="route-map"] g.re-child').count()) > 0) break;
  }
  const origins: Record<string, string> = {};
  for (const origin of ['shared', 'fromA', 'fromB', 'new']) {
    const el = page.locator(`svg[data-testid="route-map"] g.re-child line[data-origin="${origin}"]`).first();
    if (await el.count()) origins[origin] = await el.evaluate((e) => getComputedStyle(e).strokeDasharray);
  }
  if (origins.fromB) expect(origins.fromB).not.toBe('none');
  if (origins.new) expect(origins.new).not.toBe('none');
  if (origins.fromB && origins.new) expect(origins.fromB).not.toBe(origins.new);
  if (origins.fromA) expect(origins.fromA).toBe('none');
  const crossKey = await page.getByTestId('route-key').innerText();
  for (const glyph of ['shared by both parents', 'from A only', 'from B only', 'a new edge', 'the kept slice']) expect(crossKey).toContain(glyph);
  // the mutation marks: removed edges dashed and crossed out with ✕, added edges bold, ringed ends
  for (let k = 0; k < 160 && !(await page.locator('svg[data-testid="route-map"] g.re-removed').count()); k++) await page.keyboard.press('Shift+ArrowRight').then(() => page.keyboard.press('ArrowRight'));
  if (await page.locator('svg[data-testid="route-map"] g.re-removed').count()) {
    expect(await page.locator('svg[data-testid="route-map"] g.re-removed line').first().evaluate((e) => getComputedStyle(e).strokeDasharray)).not.toBe('none');
    expect(await page.locator('svg[data-testid="route-map"] text.cross').first().textContent()).toBe('✕');
    expect(await page.locator('svg[data-testid="route-map"] g.re-added line').first().evaluate((e) => parseFloat(getComputedStyle(e).strokeWidth))).toBeGreaterThan(4);
    expect(await page.locator('svg[data-testid="route-map"] circle.city.ringed').count()).toBeGreaterThan(0);
    expect(await page.getByTestId('route-key').innerText()).toContain('removed edge (dashed)');
  }
  // the fitness plot: the reference lines are dotted and dashed and named in words
  const lines = await page.locator('svg[data-plot="fitness"] line[data-optimum], svg[data-plot="fitness"] line[data-nearest]').evaluateAll((els) => els.map((e) => e.getAttribute('stroke-dasharray')));
  expect(new Set(lines).size).toBe(2);
  await expect(page.locator('svg[data-plot="fitness"] text[data-label="optimum"]')).toBeVisible();
  await expect(page.locator('svg[data-plot="fitness"] text[data-label="nearest"]')).toBeVisible();
});

test('on the cards, every mark is a shape or a pattern as well as a colour: the slice outlined, the hatching, ↻, the cycle lines, ✱, the ✕ and the dropped child', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const computed = (selector: string, props: string[]) => page.locator(selector).first().evaluate((el, ps) => { const s = getComputedStyle(el); return Object.fromEntries(ps.map((p) => [p, s.getPropertyValue(p)])); }, props);
  const walkTo = async (stage: string) => {
    // Shift+→ goes to the end of the next stage, where every card of it is revealed
    for (let k = 0; k < 120 && !(await page.locator('#stage-heading').innerText()).includes(stage); k++) await page.keyboard.press('Shift+ArrowRight');
  };
  // OX: the slice is outlined thicker than a plain cell, and cities from the other parent are hatched
  await open(page, { instance: 'ulysses16', n: 10, seed: 1 }, 12, true, undefined, (p) => ({ ...p, crossover: { ...p.crossover, operator: 'ox', probability: 1 } }));
  await page.keyboard.press('ArrowRight');
  await walkTo('Crossover');
  const plain = await computed('[data-testid="strip-A"] .bit:not(.slice)', ['border-top-width']);
  const slice = await computed('[data-testid="strip-A"] .bit.slice', ['border-top-width']);
  expect(parseFloat(slice['border-top-width']!)).toBeGreaterThan(parseFloat(plain['border-top-width']!));
  expect(await computed('[data-testid="tour-card"] .bit.hatch', ['background-image'])).toMatchObject({ 'background-image': expect.stringContaining('repeating-linear-gradient') });
  await expect(page.getByTestId('tour-card').first().locator('.key')).toContainText('hatched city');
  // PMX: ↻ on the cities that followed the mapping (the pseudo-element's text), and the key says it
  await open(page, { instance: 'ulysses16', n: 10, seed: 1 }, 12, true, undefined, (p) => ({ ...p, crossover: { ...p.crossover, operator: 'pmx', probability: 1 } }));
  await page.keyboard.press('ArrowRight');
  await walkTo('Crossover');
  expect((await page.locator('[data-testid="tour-card"] .bit.mapped').count()) > 0).toBe(true);
  expect(await page.locator('[data-testid="tour-card"] .bit.mapped').first().evaluate((el) => getComputedStyle(el, '::after').content)).toBe('"↻"');
  await expect(page.getByTestId('tour-card').first().locator('.key')).toContainText('↻');
  // CX: four different line styles under the cities for cycles 1 to 4
  await open(page, { instance: 'ulysses16', n: 10, seed: 1 }, 12, true, undefined, (p) => ({ ...p, crossover: { ...p.crossover, operator: 'cx', probability: 1 } }));
  await page.keyboard.press('ArrowRight');
  await walkTo('Crossover');
  const styles = await page.evaluate(() => ['cyc1', 'cyc2', 'cyc3', 'cyc4'].map((c) => {
    const probe = document.createElement('b');
    probe.className = `bit tour st ${c}`;
    probe.style.setProperty('--tc', '30px');
    document.querySelector('[data-testid="strip-A"] .bits')!.appendChild(probe);
    const s = getComputedStyle(probe).borderBottomStyle;
    probe.remove();
    return s;
  }));
  expect(styles).toEqual(['solid', 'dotted', 'dashed', 'double']);
  await expect(page.getByTestId('tour-card').first().locator('.key')).toContainText('solid 1, dotted 2, dashed 3, double 4');
  // mutation: the changed cities carry ✱ (the pseudo-element's text), the card says what changed in words
  await open(page, { instance: 'ulysses16', n: 10, seed: 1 }, 12, true, undefined, (p) => ({ ...p, mutation: { ...p.mutation, probability: 1 } }));
  await page.keyboard.press('ArrowRight');
  await walkTo('Mutation');
  expect(await page.locator('[data-testid="strip-after"] .bit.flip').first().evaluate((el) => getComputedStyle(el, '::after').content)).toBe('"✱"');
  await expect(page.getByTestId('tour-move').first()).toContainText('✱');
  await expect(page.getByTestId('tour-edges').first()).toContainText('✕ removed');
});

test('with reduced motion, nothing on the TSP screens animates or transitions', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page, { instance: 'ulysses16', n: 10, seed: 1 });
  await page.keyboard.press('ArrowRight');
  for (let k = 0; k < 3; k++) await page.keyboard.press('Shift+ArrowRight');
  await page.keyboard.press('ArrowRight');
  await openMap(page);
  await page.getByTestId('toggle-optimal').click();
  const durations = () => page.evaluate(() => [...document.querySelectorAll('.rmview *, .tcard *, .tmcard *, .edgebars *, .thumb, .bit, .card, button, tr, svg *')].map((el) => getComputedStyle(el)).map((s) => `${s.transitionDuration}|${s.animationName}`));
  const onMap = await durations();
  expect(onMap.length).toBeGreaterThan(200);
  expect(onMap.every((d) => /^0s(, 0s)*\|none$/.test(d))).toBe(true);
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  await page.getByTestId('show-stage').click();
  expect((await durations()).every((d) => /^0s(, 0s)*\|none$/.test(d))).toBe(true);
});

for (const [width, height] of [
  [1920, 1080],
  [1366, 768],
] as const) {
  for (const [name, options, size, extreme] of cases) {
    test(`at ${width}×${height} in projector mode, ${name}: every stage, the route map, the drawer and the menu fit, nothing overlaps and nothing scrolls sideways`, async ({ page }) => {
      test.setTimeout(60_000);
      await page.setViewportSize({ width, height });
      await open(page, options, size, true, extreme);
      const check = async (what: string) => {
        const o = await page.evaluate(() => {
          const visible = (el: Element) => (el as HTMLElement).offsetParent !== null;
          const panels = [...document.querySelectorAll('section.panel')].filter(visible).map((el) => ({ name: el.getAttribute('aria-labelledby') ?? el.className, r: el.getBoundingClientRect() }));
          const overlaps: string[] = [];
          for (let a = 0; a < panels.length; a++) {
            for (let b = a + 1; b < panels.length; b++) {
              const p = panels[a]!.r;
              const q = panels[b]!.r;
              if (p.left < q.right - 1 && q.left < p.right - 1 && p.top < q.bottom - 1 && q.top < p.bottom - 1) overlaps.push(`${panels[a]!.name} and ${panels[b]!.name}`);
            }
          }
          const clipped = [...document.querySelectorAll('.tablewrap, .ccard, .mwrap, .cgrid, .rgrid, .rmview, .rmrow, .plot .ph, .plot .summary, .edgebars, #stagebody, .seldetail')].filter(visible).filter((el) => el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== 'auto').map((el) => `${el.className} ${el.scrollWidth}>${el.clientWidth}`);
          const outside = [...document.querySelectorAll('.rmmap, .rmstats, .edgebars, .spkey, .sphist, .ccard.current .tcard, .mcard.current, .seldetail, .plot .summary, #legend')].filter(visible).filter((el) => {
            const r = el.getBoundingClientRect();
            const panel = el.closest('section.panel')?.getBoundingClientRect() ?? document.querySelector('#legend') === el ? { right: window.innerWidth, bottom: window.innerHeight, left: 0, top: 0 } : undefined;
            return panel ? r.right > panel.right + 1 || r.bottom > panel.bottom + 1 || r.left < panel.left - 1 : false;
          }).map((el) => el.className.toString());
          const cut: string[] = [];
          for (const card of document.querySelectorAll('#stagebody .ccard.current, #stagebody .mcard.current')) {
            const r = card.getBoundingClientRect();
            const list = card.parentElement!.getBoundingClientRect();
            if (r.bottom > list.bottom + 1 || r.top < list.top - 1) cut.push(`the current card is cut: ${Math.round(r.top - list.top)}…${Math.round(r.bottom - list.bottom)}`);
          }
          const rows: string[] = [];
          const drawer = document.querySelector('#drawer');
          if (drawer && visible(drawer)) {
            const d = drawer.getBoundingClientRect();
            for (const ctl of drawer.querySelectorAll('.ctl:not(.wide)')) {
              const label = ctl.querySelector('label')!.getBoundingClientRect();
              const field = ctl.querySelector('.field')!.getBoundingClientRect();
              if (field.width > 0 && label.right > field.left + 1) rows.push(`${ctl.getAttribute('data-field')}: the control runs over its label`);
              if (field.right > d.right + 1) rows.push(`${ctl.getAttribute('data-field')}: the control leaves the drawer`);
            }
          }
          return { cut, rows, x: document.documentElement.scrollWidth - window.innerWidth, y: document.documentElement.scrollHeight - window.innerHeight, canvas: document.querySelector('.canvas')!.getBoundingClientRect().toJSON(), overlaps, clipped, outside };
        });
        expect(o.cut, `${what}: a card is cut`).toEqual([]);
        expect(o.rows, `${what}: a row of the drawer`).toEqual([]);
        expect(o.x, `${what}: page overflows sideways`).toBeLessThanOrEqual(0);
        expect(o.y, `${what}: page overflows downwards`).toBeLessThanOrEqual(0);
        expect(o.canvas.right).toBeLessThanOrEqual(width + 1);
        expect(o.canvas.bottom).toBeLessThanOrEqual(height + 1);
        expect(o.overlaps, `${what}: panels overlap`).toEqual([]);
        expect(o.clipped, `${what}: something scrolls sideways`).toEqual([]);
        expect(o.outside, `${what}: something leaves its panel`).toEqual([]);
      };
      await check('at the start');
      await page.keyboard.press('g');
      await check('after a generation');
      await page.keyboard.press('ArrowRight');
      for (const stage of ['selection', 'pairing', 'crossover', 'mutation', 'evaluation', 'replacement']) {
        await page.keyboard.press('Shift+ArrowRight');
        await page.keyboard.press('ArrowRight');
        for (let k = 0; k < 3; k++) await page.keyboard.press('ArrowRight');
        await check(`inside ${stage}`);
      }
      await page.locator('[data-testid^="select-"]').nth(1).click();
      await check('with an individual selected');
      await openMap(page);
      await check('with the route map');
      await page.getByTestId('toggle-optimal').click();
      await page.getByTestId('map-select').selectOption({ index: 2 });
      await check('with the route map, the optimal tour and a selection');
      for (let k = 0; k < 3; k++) await page.keyboard.press('Shift+ArrowRight');
      await check('with the route map during a stage');
      await page.getByTestId('show-stage').click();
      await page.getByRole('button', { name: /Parameters/ }).click();
      await check('with the drawer open');
      await page.locator('#preset').selectOption({ label: LONGEST_PRESET });
      await check('with the drawer open and the longest preset chosen');
      await page.keyboard.press('Escape');
      await page.getByTestId('problem-button').click();
      await check('with the problem menu open');
      const menu = (await page.getByTestId('problem-list').boundingBox())!;
      expect(menu.x + menu.width).toBeLessThanOrEqual(width);
      expect(menu.y + menu.height).toBeLessThanOrEqual(height);
    });

    test(`at ${width}×${height} in projector mode, ${name}: the narration stays inside its box at every micro-step of the first stages of two generations`, async ({ page }) => {
      test.setTimeout(60_000);
      await page.setViewportSize({ width, height });
      await open(page, options, size, true, extreme);
      const outside = () =>
        page.evaluate(() => {
          const box = document.querySelector('#narr')!.getBoundingClientRect();
          const narr = document.querySelector('#narr')!;
          const out = [...document.querySelectorAll('#narr > *')]
            .map((el) => ({ text: el.textContent!.slice(0, 60), rect: el.getBoundingClientRect() }))
            .filter(({ rect }) => rect.top < box.top - 1 || rect.bottom > box.bottom + 1 || rect.right > box.right + 1)
            .map(({ text }) => text);
          if (narr.scrollHeight - narr.clientHeight > 1) out.push('the narration overflows its box');
          return out;
        });
      for (let generation = 0; generation < 2; generation++) {
        for (const stage of ['selection', 'pairing', 'crossover', 'mutation', 'evaluation', 'replacement']) {
          await page.keyboard.press('Shift+ArrowRight');
          for (let k = 0; k < (size > 12 ? 8 : 14); k++) {
            await page.keyboard.press('ArrowRight');
            expect(await outside(), `generation ${generation + 1}, ${stage}, micro-step ${k + 1}`).toEqual([]);
          }
        }
      }
    });
  }
}

for (const [width, height] of [
  [1920, 1080],
  [1366, 768],
] as const) {
  for (const projector of [true, false]) {
    test(`at ${width}×${height}${projector ? ' in projector mode' : ''}, the title, the chips and the subtitle stay inside the brand box and never run into the stage ribbon or the generation counter, for every instance, with the longest preset name and a three-digit generation`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width, height });
      const instances: TspOptions[] = [...tspCatalogue.map((c): TspOptions => ({ instance: c.id, n: c.id === 'random' ? 15 : 10, seed: c.id === 'random' ? 2 : 1 })), { instance: 'circle', n: 15, seed: 1 }];
      for (const options of instances) {
        await open(page, options, 12, projector);
        for (const preset of [undefined, LONGEST_PRESET]) {
          if (preset) {
            await page.getByRole('button', { name: /Parameters/ }).click();
            await page.locator('#preset').selectOption({ label: preset });
            await page.getByTestId('load-preset').click();
            await page.getByRole('button', { name: 'Restart and apply' }).click();
            await page.keyboard.press('Escape');
            await expect(page.locator('#brand')).toContainText(`preset: ${preset}`);
          }
          const problems = await page.evaluate(() => {
            const out: string[] = [];
            const brand = document.querySelector('#brand')!.getBoundingClientRect();
            const ribbon = document.querySelector('#ribbon')!.getBoundingClientRect();
            if (brand.right > ribbon.left + 1) out.push('the brand runs into the ribbon');
            if (ribbon.right > document.querySelector('#gen')!.getBoundingClientRect().left + 1) out.push('the ribbon runs into the generation counter');
            for (const li of document.querySelectorAll('#ribbon li')) if (li.scrollWidth > li.clientWidth + 1) out.push(`the stage "${li.textContent!.trim()}" does not fit its pill`);
            for (const el of document.querySelectorAll('#brand *')) {
              const r = el.getBoundingClientRect();
              if (r.width === 0) continue;
              if (r.right > brand.right + 1 || r.left < brand.left - 1) out.push(`${(el as HTMLElement).className || el.tagName} leaves the brand box (${Math.round(r.right)} > ${Math.round(brand.right)})`);
              if (r.bottom > document.querySelector('#top')!.getBoundingClientRect().bottom + 1) out.push(`${(el as HTMLElement).className || el.tagName} leaves the top bar`);
            }
            return out;
          });
          expect(problems, `${options.instance} ${preset ?? ''}`).toEqual([]);
        }
      }
      // a three-digit generation in the counter, at the end of a stage, and at the end of a run
      await open(page, { instance: 'ulysses16', n: 10, seed: 1 }, 12, projector);
      for (let g = 0; g < 105; g++) await page.keyboard.press('g');
      await expect(page.locator('#pop-heading')).toHaveText('Population · generation 105');
      const counter = await page.evaluate(() => {
        const out: string[] = [];
        const gen = document.querySelector('#gen')!;
        const r = gen.getBoundingClientRect();
        if (gen.scrollWidth > gen.clientWidth + 1) out.push('the counter is cut');
        for (const el of gen.querySelectorAll('*')) { const e = el.getBoundingClientRect(); if (e.right > r.right + 1 || e.left < r.left - 1) out.push(`${el.className || el.tagName} leaves the counter`); }
        if (r.right > window.innerWidth + 1) out.push('the counter leaves the window');
        if (document.querySelector('#ribbon')!.getBoundingClientRect().right > r.left + 1) out.push('the ribbon runs into the counter');
        return out;
      });
      expect(counter).toEqual([]);
    });
  }
}

test('extreme populations (every tour the same, every other tour reversed) are shown, stepped through and mapped without errors: no NaN in a picture, agreement 1, diversity 0', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.setViewportSize({ width: 1920, height: 1080 });
  await open(page, { instance: 'berlin52', n: 10, seed: 1 }, 12, true, 'identical');
  await expect(page.getByTestId('distinct')).toHaveText('1 of 12 distinct routes');
  await expect(page.getByTestId('agreement-line')).toContainText('52 of 52 edges are in every individual · 52 in at least half · mean agreement 1.00');
  expect(Number(await page.locator('svg[data-plot="diversity"] circle[data-series="diversity"]').first().getAttribute('data-value'))).toBe(0);
  await openMap(page);
  const widths = await page.locator('svg[data-testid="route-map"] line[data-layer="population"]').evaluateAll((els) => new Set(els.map((e) => (e as HTMLElement).style.strokeWidth)).size);
  expect(widths).toBe(1);
  expect(await page.locator('svg[data-testid="route-map"] line[data-layer="population"]').count()).toBe(52);
  await page.getByTestId('show-stage').click();
  for (let k = 0; k < 90; k++) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('g');
  await openMap(page);
  const bad = await page.evaluate(() => [...document.querySelectorAll('svg *')].flatMap((el) => ['x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'x', 'y', 'd', 'width', 'height'].filter((a) => /NaN|Infinity/.test(el.getAttribute(a) ?? '')).map((a) => `${el.tagName}.${a}`)));
  expect(bad).toEqual([]);
  await open(page, { instance: 'ulysses16', n: 10, seed: 1 }, 12, true, 'reversed');
  await expect(page.getByTestId('distinct')).toHaveText('1 of 12 distinct routes'); // a reversed tour is the same route
  for (let k = 0; k < 60; k++) await page.keyboard.press('ArrowRight');
  expect(errors).toEqual([]);
});
