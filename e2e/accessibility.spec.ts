import { expect, test, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const url = pathToFileURL(resolve('dist/index.html')).href;
const title = (page: Page) => page.locator('#pop-heading');

test.beforeEach(async ({ page }) => {
  await page.goto(url);
});

test('a full generation can be stepped through with the keyboard alone', async ({ page }) => {
  await page.keyboard.press('ArrowRight'); // generation 1, selection entered
  await expect(page.getByRole('heading', { level: 2, name: /Selection/ })).toBeVisible();
  for (const stage of ['Selection', 'Pairing', 'Crossover', 'Mutation', 'Evaluation']) {
    await page.keyboard.press('Shift+ArrowRight'); // to the end of each stage in turn
    await expect(page.getByTestId('ribbon').locator('li[aria-current="step"]')).toContainText(stage);
  }
  await page.keyboard.press('Shift+ArrowRight'); // the end of the replacement stage: the generation is complete
  await expect(title(page)).toHaveText('Population · generation 1');
  await expect(page.getByTestId('ribbon').locator('li.done')).toHaveCount(6);

  await page.keyboard.press('Shift+ArrowLeft'); // end of the previous stage: back inside generation 1
  await expect(title(page)).toHaveText('Parents · generation 0');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('g'); // straight to the end of the generation
  await expect(title(page)).toHaveText('Population · generation 1');
  await page.keyboard.press('g');
  await expect(title(page)).toHaveText('Population · generation 2');
});

test('Space runs and pauses, and the keys are written on the buttons', async ({ page }) => {
  await page.keyboard.press(' ');
  await expect(page.getByRole('status')).toContainText('Playing');
  await page.keyboard.press(' ');
  await expect(page.getByRole('status')).not.toContainText('Playing');
  for (const [name, key] of [
    [/^Back/, '←'],
    [/^Micro-step/, '→'],
    [/^Stage/, '⇧→'],
    [/^Generation/, 'G'],
    [/^(Run|Pause)$/, 'Space'],
  ] as const) {
    await expect(page.getByRole('button', { name }).first().locator('kbd')).toHaveText(key);
  }
  await expect(page.getByRole('button', { name: 'Previous stage' })).toHaveAttribute('title', /⇧←/);
});

test('Tab reaches every control in a sensible order, shows where the focus is, and Enter operates it', async ({ page }) => {
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement?.getAttribute('data-testid'))).toBe('problem-button'); // the brand area comes first
  await page.keyboard.press('Tab');
  const first = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
  expect(first).toBe('Reset');
  const outline = await page.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle);
  expect(outline).not.toBe('none');
  for (let k = 0; k < 40; k++) {
    if (await page.getByRole('button', { name: /Parameters/ }).evaluate((el) => el === document.activeElement)) break;
    await page.keyboard.press('Tab');
  }
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('drawer')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('drawer')).toHaveCount(0);
});

test('typing in a field never triggers a shortcut', async ({ page }) => {
  await page.getByRole('button', { name: /Parameters/ }).click();
  const field = page.locator('#crossover-probability');
  await field.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('g 1');
  await expect(field).toHaveValue('g 1');
  await page.keyboard.press('ArrowLeft');
  await expect(title(page)).toHaveText('Population · generation 0'); // nothing moved
  await expect(page.getByRole('status')).not.toContainText('Playing');
});

test('the history bar keeps the arrow keys while it has the focus', async ({ page }) => {
  await page.keyboard.press('g');
  await page.keyboard.press('g');
  await page.getByTestId('scrub').focus();
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByTestId('scrub')).toHaveAttribute('data-live', 'false');
  await expect(page.getByTestId('scrub')).toHaveAttribute('data-cycle', '2'); // moved within the history, nothing was made
  await expect(page.getByText('recorded gens 0–2')).toBeVisible();
});

test('with reduced motion on, the wheel pin arrives at once with the same highlights', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  await page.getByRole('button', { name: /^Micro-step/ }).click(); // generation 1, selection entered
  await page.getByRole('button', { name: /^Micro-step/ }).click(); // first spin
  const wheel = page.locator('svg[data-animated]');
  await expect(wheel).toHaveAttribute('data-animated', 'false');
  await expect(page.getByTestId('narration')).toContainText('Spin 1');
});

test('with motion allowed, the same step animates', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.reload();
  await page.getByRole('button', { name: /^Micro-step/ }).click();
  await page.getByRole('button', { name: /^Micro-step/ }).click();
  await expect(page.locator('svg[data-animated]')).toHaveAttribute('data-animated', 'true');
});

test('projector mode is a switch: larger text, heavier lines, remembered after a reload', async ({ page }) => {
  const toggle = page.getByRole('button', { name: 'Projector mode' });
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  const metrics = () =>
    page.evaluate(() => ({
      narration: parseFloat(getComputedStyle(document.querySelector('#narr')!).fontSize),
      button: parseFloat(getComputedStyle(document.querySelector('#transport .btn')!).borderTopWidth),
      cell: parseFloat(getComputedStyle(document.querySelector('.bit')!).borderTopWidth),
    }));
  const normal = await metrics();
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  const big = await metrics();
  expect(big.narration).toBeGreaterThan(normal.narration);
  expect(big.button).toBeGreaterThan(normal.button);
  expect(big.cell).toBeGreaterThan(normal.cell);

  await page.reload();
  await expect(page.getByRole('button', { name: 'Projector mode' })).toHaveAttribute('aria-pressed', 'true');
  expect((await metrics()).narration).toBe(big.narration);
  await page.getByRole('button', { name: 'Projector mode' }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Projector mode' })).toHaveAttribute('aria-pressed', 'false');
});

test('projector mode still works when storage is blocked', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new Error('blocked');
      },
    });
  });
  await page.reload();
  const toggle = page.getByRole('button', { name: 'Projector mode' });
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
});

for (const [width, height] of [
  [1920, 1080],
  [1366, 768],
] as const) {
  test(`at ${width}×${height} in projector mode the page never scrolls, with a stage view, the drawer and a dialog open`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.getByRole('button', { name: 'Projector mode' }).click();
    await page.keyboard.press('g');
    await page.getByRole('button', { name: /Parameters/ }).click();
    const overflow = () =>
      page.evaluate(() => ({
        x: document.documentElement.scrollWidth - window.innerWidth,
        y: document.documentElement.scrollHeight - window.innerHeight,
        canvas: document.querySelector('.canvas')!.getBoundingClientRect().toJSON(),
      }));
    const o = await overflow();
    expect(o.x).toBeLessThanOrEqual(0);
    expect(o.y).toBeLessThanOrEqual(0);
    expect(o.canvas.right).toBeLessThanOrEqual(width + 1);
    expect(o.canvas.bottom).toBeLessThanOrEqual(height + 1);
  });
}

for (const projector of [false, true]) {
  test(`the toolbar fits on one row ${projector ? 'in projector mode' : ''} even with a long status message`.replace('  ', ' '), async ({ page }) => {
    if (projector) await page.getByRole('button', { name: 'Projector mode' }).click();
    await page.getByRole('button', { name: 'Run until stop' }).click(); // "Paused · stop criterion: …" is the longest status
    await expect(page.getByRole('status')).toContainText('stop criterion');
    const { scroll, client } = await page.evaluate(() => {
      const t = document.querySelector('#transport')!;
      return { scroll: t.scrollWidth, client: t.clientWidth };
    });
    expect(scroll).toBeLessThanOrEqual(client);
    const last = await page.getByRole('button', { name: 'Projector mode' }).boundingBox();
    const canvas = (await page.locator('.canvas').boundingBox())!;
    expect(last!.x + last!.width).toBeLessThanOrEqual(canvas.x + canvas.width);
  });
}

test('every control has an accessible name, with the drawer closed and open', async ({ page }) => {
  // an unnamed control shows up in the accessibility tree as a bare role with no quoted name
  const unnamed = async () => {
    const tree = await page.locator('body').ariaSnapshot();
    return tree.split('\n').filter((line) => /^\s*- (button|textbox|combobox|slider|checkbox|switch|spinbutton|radio)(\s+\[[^\]]*\])*:?\s*$/.test(line));
  };
  expect(await unnamed()).toEqual([]);
  await page.getByRole('button', { name: /Parameters/ }).click();
  await page.locator('#init').selectOption('explicit');
  expect(await unnamed()).toEqual([]);
});
