// Generates tspdata.js from the TSPLIB files next to it (thrown away after review).
import fs from 'node:fs';
const out = {};
for (const [name, label] of [['berlin52', 'berlin52'], ['ulysses16', 'ulysses16'], ['kroA100', 'kroA100']]) {
  const t = fs.readFileSync(`${name}.tsp`, 'utf8');
  const type = /EDGE_WEIGHT_TYPE\s*:\s*(\S+)/.exec(t)[1];
  const comment = /COMMENT\s*:\s*(.*)/.exec(t)[1].trim();
  const coords = [...t.split('NODE_COORD_SECTION')[1].matchAll(/^\s*(\d+)\s+(\S+)\s+(\S+)/gm)].map((m) => [Number(m[2]), Number(m[3])]);
  const tour = fs.readFileSync(`${name}.opt.tour`, 'utf8').split('TOUR_SECTION')[1].split(/\s+/).filter((x) => /^-?\d+$/.test(x)).map(Number).filter((x) => x > 0).map((x) => x - 1);
  out[name] = { name: label, type, comment, coords, opt: tour };
}
fs.writeFileSync('tspdata.js', `const TSPLIB = ${JSON.stringify(out)};\n`);
console.log(Object.entries(out).map(([k, v]) => `${k} ${v.type} ${v.coords.length} ${v.opt.length}`).join('\n'));
