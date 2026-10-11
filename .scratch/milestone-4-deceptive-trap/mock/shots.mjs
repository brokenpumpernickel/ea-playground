import { chromium } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';

const dir = resolve('.scratch/milestone-4-deceptive-trap/mock');
const out = resolve(dir, 'screenshots');
mkdirSync(out, { recursive: true });
const url = pathToFileURL(resolve(dir, 'index.html')).href;
const shots = [
  ['01-crossover-tight', 's=cross&l=tight&p=1'],
  ['02-crossover-loose-A', 's=cross&l=loose&ls=A&p=1'],
  ['03-crossover-loose-B', 's=cross&l=loose&ls=B&p=1'],
  ['04-mutation-tight', 's=mut&l=tight&p=1'],
  ['05-mutation-loose-A', 's=mut&l=loose&ls=A&p=1'],
  ['06-schema', 's=schema&l=tight&p=1'],
  ['07-menu', 's=menu&l=tight&p=1'],
  ['08-drawer', 's=drawer&l=tight&p=1'],
  ['09-drawer-error', 's=drawer&l=loose&bad=1&p=1'],
  ['10-stress-tight', 's=cross&l=tight&x=1&p=1'],
  ['11-stress-loose-A', 's=cross&l=loose&ls=A&x=1&p=1'],
  ['12-stress-loose-B', 's=cross&l=loose&ls=B&x=1&p=1'],
  ['15-30genes-tight-crossover', 's=cross&l=tight&x=2&p=1'],
  ['16-30genes-loose-A-crossover', 's=cross&l=loose&ls=A&x=2&p=1'],
  ['17-30genes-tight-mutation', 's=mut&l=tight&x=2&p=1'],
  ['13-table-wide-tight', 's=table&l=tight&p=1'],
  ['14-dark-crossover', 's=cross&l=tight&t=dark&p=1'],
];
const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1920, height: 1100 } });
for (const [name, query] of shots) {
  await page.goto(`${url}?z=1&${query}`);
  await page.evaluate(() => { document.getElementById('mockbar').style.display = 'none'; window.scrollTo(0, 0); });
  await page.locator('#screen').screenshot({ path: resolve(out, `${name}.png`) });
}
await browser.close();
console.log('done');
