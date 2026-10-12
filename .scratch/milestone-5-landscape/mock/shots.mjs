import { chromium } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';

const dir = resolve('.scratch/milestone-5-landscape/mock');
const out = resolve(dir, 'screenshots');
mkdirSync(out, { recursive: true });
const url = pathToFileURL(resolve(dir, 'index.html')).href;
const only = process.argv[2];
const shots = [
  ['01-two-peaks-real', 's=land&fn=two&rep=real&trail=3&p=1'],
  ['02-single-peak', 's=land&fn=single&rep=real&trail=3&mark=none&p=1'],
  ['03-rastrigin-60', 's=land&fn=rastrigin&rep=real&trail=1&n=60&p=1'],
  ['04-himmelblau', 's=land&fn=himmel&rep=real&trail=5&p=1'],
  ['05-parents-marks', 's=land&fn=two&rep=real&mark=parents&trail=0&p=1'],
  ['06-children-marks', 's=land&fn=two&rep=real&mark=children&trail=0&p=1'],
  ['07-mutated-child', 's=land&fn=two&rep=real&mark=mutation&trail=0&p=1'],
  ['08-binary-plain-table', 's=land&fn=two&rep=plain&trail=3&p=1'],
  ['09-gray-himmelblau', 's=land&fn=himmel&rep=gray&trail=3&p=1'],
  ['10-surface-rotated', 's=land&fn=rastrigin&rep=real&az=0.9&el=0.55&trail=0&p=1'],
  ['11-crossover-blx', 's=cross&op=blx&fn=two&p=1'],
  ['12-crossover-arith', 's=cross&op=arith&fn=two&p=1'],
  ['13-crossover-discrete', 's=cross&op=disc&fn=two&p=1'],
  ['14-mutation-gaussian', 's=mut&fn=two&p=1'],
  ['15-mutation-binary', 's=bin&fn=two&rep=plain&p=1'],
  ['16-drawer-real', 's=drawer&fn=two&rep=real&op=blx&p=1'],
  ['17-drawer-restart-notice', 's=drawer&fn=two&rep=plain&op=disc&bad=1&p=1'],
  ['18-menu', 's=menu&fn=two&p=1'],
  ['19-dark', 's=land&fn=two&rep=real&t=dark&p=1'],
];
const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1920, height: 1100 } });
page.on('pageerror', (e) => console.log('ERR', e.message));
for (const [name, query] of shots) {
  if (only && !name.includes(only)) continue;
  await page.goto(`${url}?z=1&${query}`);
  await page.evaluate(() => { document.getElementById('mockbar').style.display = 'none'; window.scrollTo(0, 0); });
  await page.locator('#screen').screenshot({ path: resolve(out, `${name}.png`) });
}
await browser.close();
console.log('done');
