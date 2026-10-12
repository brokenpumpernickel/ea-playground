import { chromium } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';

const dir = resolve('.scratch/milestone-6-tsp/mock');
const out = resolve(dir, 'screenshots');
mkdirSync(out, { recursive: true });
const url = pathToFileURL(resolve(dir, 'index.html')).href;
const only = process.argv[2];
const shots = [
  ['01-berlin52-route-map', 's=route&inst=berlin52&p=1'],
  ['02-berlin52-optimal-overlay', 's=route&inst=berlin52&opt=1&p=1'],
  ['03-ulysses16-route-map', 's=route&inst=ulysses16&p=1'],
  ['04-kroA100-route-map', 's=route&inst=kroA100&p=1'],
  ['05-circle-route-map', 's=route&inst=circle&p=1'],
  ['06-table-wrapped-berlin52', 's=route&inst=berlin52&lay=wrap&p=1'],
  ['07-ox-berlin52', 's=cross&inst=berlin52&op=ox&p=1'],
  ['08-ox-ulysses16', 's=cross&inst=ulysses16&op=ox&p=1'],
  ['09-pmx-ulysses16', 's=cross&inst=ulysses16&op=pmx&p=1'],
  ['10-cx-ulysses16', 's=cross&inst=ulysses16&op=cx&p=1'],
  ['11-pmx-berlin52', 's=cross&inst=berlin52&op=pmx&p=1'],
  ['12-ox-kroA100', 's=cross&inst=kroA100&op=ox&p=1'],
  ['13-mutation-swap', 's=mut&inst=berlin52&mop=swap&p=1'],
  ['14-mutation-inversion', 's=mut&inst=berlin52&mop=inversion&p=1'],
  ['15-mutation-insertion', 's=mut&inst=ulysses16&mop=insertion&p=1'],
  ['16-map-crossover-marks', 's=mcross&inst=berlin52&op=ox&p=1'],
  ['17-map-mutation-marks', 's=mmut&inst=berlin52&mop=inversion&p=1'],
  ['16b-map-crossover-ulysses16', 's=mcross&inst=ulysses16&op=pmx&p=1'],
  ['17b-map-mutation-ulysses16', 's=mmut&inst=ulysses16&mop=inversion&p=1'],
  ['18-drawer', 's=drawer&inst=berlin52&p=1'],
  ['19-instances', 's=instances&inst=berlin52&p=1'],
  ['20-menu', 's=menu&inst=berlin52&p=1'],
  ['21-dark', 's=route&inst=berlin52&t=dark&p=1'],
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
