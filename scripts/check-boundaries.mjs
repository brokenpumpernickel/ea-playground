// Enforces the layer rules from ADR 0002 and ADR 0003:
//   src/run     may import nothing from src/engine or src/ui
//   src/engine  may import src/run, never src/ui
//   neither may import a UI framework or bundler, or call the unseeded random source
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, dirname, sep } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const src = join(root, 'src');

const forbiddenByLayer = {
  run: [join(src, 'engine'), join(src, 'ui')],
  engine: [join(src, 'ui')],
};
const forbiddenPackages = /^(svelte|vite|@sveltejs\/|three)(\/|$)/;
const unseededRandom = new RegExp('Math' + '\\.random\\s*\\(');
const importPattern = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)['"]([^'"]+)['"]/g;

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* walk(path);
    else if (/\.ts$/.test(path)) yield path;
  }
}

const problems = [];
for (const [layer, forbiddenDirs] of Object.entries(forbiddenByLayer)) {
  const layerDir = join(src, layer);
  for (const file of walk(layerDir)) {
    const text = readFileSync(file, 'utf8');
    const where = relative(root, file).split(sep).join('/');
    for (const match of text.matchAll(importPattern)) {
      const spec = match[1];
      if (spec.startsWith('.')) {
        const target = resolve(dirname(file), spec);
        const hit = forbiddenDirs.find((d) => target === d || target.startsWith(d + sep));
        if (hit) problems.push(`${where}: src/${layer} must not import ${relative(root, hit).split(sep).join('/')} ("${spec}")`);
      } else if (forbiddenPackages.test(spec)) {
        problems.push(`${where}: src/${layer} must not import "${spec}"`);
      }
    }
    if (unseededRandom.test(text)) {
      problems.push(`${where}: unseeded random source is not allowed in src/${layer}; use the seeded generator`);
    }
  }
}

if (problems.length) {
  console.error('Layer boundary violations:\n' + problems.map((p) => '  ' + p).join('\n'));
  process.exit(1);
}
console.log('Layer boundaries OK');
