/* ===== TSP mock: hand-made data and a throwaway mini GA, thrown away after review. ===== */
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const num = (v, d = 0) => (v < 0 ? '−' : '') + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const PI = 3.141592;
const geoRad = (c) => { const deg = Math.trunc(c); return PI * (deg + (5 * (c - deg)) / 3) / 180; };
const geoDeg = (c) => { const deg = Math.trunc(c); return deg + (5 * (c - deg)) / 3; };

/* ---------- instances ---------- */
const INST = {};
for (const k of Object.keys(TSPLIB)) INST[k] = { ...TSPLIB[k], kind: 'TSPLIB (Reinelt, 1991)', n: TSPLIB[k].coords.length, rule: { EUC_2D: 'EUC_2D, Euclidean rounded to the nearest integer', GEO: 'GEO, great-circle distance on the degrees and minutes, truncated', ATT: 'ATT, pseudo-Euclidean' }[TSPLIB[k].type] };
INST.berlin52.optLen = 7542; INST.ulysses16.optLen = 6859; INST.kroA100.optLen = 21282;
INST.circle = { name: 'Circle', type: 'EUC', kind: 'own', n: 10, coords: Array.from({ length: 10 }, (_, k) => [150 + 100 * Math.cos((2 * PI * k) / 10 + 0.3), 150 + 100 * Math.sin((2 * PI * k) / 10 + 0.3)]), rule: 'Euclidean, real numbers', comment: 'cities evenly spaced on a circle' };
INST.circle.opt = INST.circle.coords.map((_, k) => k);
INST.clusters = { name: 'Two clusters', type: 'EUC', kind: 'own', n: 12, rule: 'Euclidean, real numbers', comment: 'two tight groups far apart',
  coords: [[20, 22], [31, 18], [26, 33], [15, 36], [38, 30], [24, 12], [200, 160], [212, 171], [190, 176], [205, 150], [218, 158], [196, 164]] };
INST.clusters.opt = [0, 1, 4, 2, 3, 5, 0].slice(0, 6).concat([11, 8, 6, 7, 10, 9]).filter((v, i, a) => a.indexOf(v) === i);

const geoXY = (inst, c) => (inst.type === 'GEO' ? [geoDeg(c[1]), geoDeg(c[0])] : c);
function dist(inst, a, b) {
  const p = inst.coords[a], q = inst.coords[b];
  if (inst.type === 'EUC_2D') return Math.round(Math.hypot(p[0] - q[0], p[1] - q[1]));
  if (inst.type === 'ATT') { const r = Math.sqrt(((p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2) / 10); const t = Math.round(r); return t < r ? t + 1 : t; }
  if (inst.type === 'GEO') { const R = 6378.388, la = geoRad(p[0]), lo = geoRad(p[1]), lb = geoRad(q[0]), lob = geoRad(q[1]); const q1 = Math.cos(lo - lob), q2 = Math.cos(la - lb), q3 = Math.cos(la + lb); return Math.trunc(R * Math.acos(0.5 * ((1 + q1) * q2 - (1 - q1) * q3)) + 1); }
  return Math.hypot(p[0] - q[0], p[1] - q[1]);
}
const tourLen = (inst, t) => t.reduce((s, c, k) => s + dist(inst, c, t[(k + 1) % t.length]), 0);
const nnTour = (inst) => { const left = new Set(inst.coords.map((_, k) => k)); const t = [0]; left.delete(0); while (left.size) { let best = -1, bd = Infinity; for (const c of left) { const d = dist(inst, t[t.length - 1], c); if (d < bd) { bd = d; best = c; } } t.push(best); left.delete(best); } return t; };
for (const inst of Object.values(INST)) {
  if (inst.optLen === undefined) inst.optLen = tourLen(inst, inst.opt);
  inst.nn = nnTour(inst); inst.nnLen = tourLen(inst, inst.nn);
}
const L = (inst, v) => (inst.type === 'EUC' ? num(v, 1) : num(v));
const edgeKey = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);
const edgesOf = (t) => t.map((c, k) => edgeKey(c, t[(k + 1) % t.length]));
const canon = (t) => { const i = t.indexOf(0); const f = [...t.slice(i), ...t.slice(0, i)]; return f[1] < f[f.length - 1] ? f : [f[0], ...f.slice(1).reverse()]; };

/* ---------- a mini GA for plausible data (seeded) ---------- */
function lcg(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const ri = (u, k) => Math.floor(u * k);
function shuffle(n, rnd) { const p = Array.from({ length: n }, (_, k) => k); for (let i = n - 1; i > 0; i--) { const j = ri(rnd(), i + 1); [p[i], p[j]] = [p[j], p[i]]; } return p; }
function ox(a, b, c1, c2) {
  const n = a.length, child = Array(n).fill(-1), inSlice = new Set();
  for (let i = c1; i < c2; i++) { child[i] = a[i]; inSlice.add(a[i]); }
  const order = []; for (let k = 0; k < n; k++) { const c = b[(c2 + k) % n]; if (!inSlice.has(c)) order.push(c); }
  let p = c2 % n; for (const c of order) { while (child[p] !== -1) p = (p + 1) % n; child[p] = c; p = (p + 1) % n; }
  return { child, order, slice: [c1, c2] };
}
function pmx(a, b, c1, c2) { // child takes b's slice, a elsewhere, conflicts followed through the mapping
  const n = a.length, child = a.slice(), inB = new Map(); // b city -> a city at the same position
  for (let i = c1; i < c2; i++) inB.set(b[i], a[i]);
  const fixed = [];
  for (let i = 0; i < n; i++) {
    if (i >= c1 && i < c2) { child[i] = b[i]; continue; }
    let c = a[i]; const chain = [c];
    while (inB.has(c)) { c = inB.get(c); chain.push(c); }
    child[i] = c; if (chain.length > 1) fixed.push({ pos: i, chain });
  }
  return { child, fixed, slice: [c1, c2], mapping: [...inB.entries()] };
}
function cx(a, b) {
  const n = a.length, cycleOf = Array(n).fill(0), cycles = []; let id = 0;
  for (let s = 0; s < n; s++) { if (cycleOf[s]) continue; id++; const pos = []; let i = s; while (!cycleOf[i]) { cycleOf[i] = id; pos.push(i); i = a.indexOf(b[i]); } cycles.push(pos); }
  const c1 = a.map((v, i) => (cycleOf[i] % 2 ? a[i] : b[i])), c2 = a.map((v, i) => (cycleOf[i] % 2 ? b[i] : a[i]));
  return { c1, c2, cycleOf, cycles };
}
const swapM = (t, i, j) => { const x = t.slice(); [x[i], x[j]] = [x[j], x[i]]; return x; };
const invM = (t, i, j) => [...t.slice(0, i), ...t.slice(i, j + 1).reverse(), ...t.slice(j + 1)];
const insM = (t, i, j) => { const x = t.slice(); const [c] = x.splice(i, 1); x.splice(j, 0, c); return x; };

function simulate(inst, { size = 12, gens = 40, pc = 0.9, pm = 0.3, op = 'ox', mop = 'inversion', seed = 7 } = {}) {
  const rnd = lcg(seed), n = inst.n;
  let pop = Array.from({ length: size }, () => shuffle(n, rnd)).map((t, id) => ({ id: id + 1, t, len: tourLen(inst, t) }));
  let nextId = size + 1;
  const hist = [{ pop, events: null }];
  for (let g = 1; g <= gens; g++) {
    const pool = []; for (let k = 0; k < size - 1; k++) { const a = pop[ri(rnd(), size)], b = pop[ri(rnd(), size)]; pool.push(a.len <= b.len ? a : b); }
    if (pool.length % 2) pool.push(pool[0]);
    const kids = [], pairs = [];
    for (let k = 0; k < pool.length; k += 2) {
      const A = pool[k], B = pool[k + 1], u = rnd(), ev = { A, B, u, op };
      if (u < pc) {
        let c1 = ri(rnd(), n + 1), c2 = ri(rnd(), n + 1); const u1c = c1 / n, u2c = c2 / n; if (c1 > c2) [c1, c2] = [c2, c1]; if (c1 === c2) c2 = Math.min(n, c1 + 2);
        ev.cuts = [c1, c2]; ev.u1 = u1c; ev.u2 = u2c;
        if (op === 'ox') { const r1 = ox(A.t, B.t, c1, c2), r2 = ox(B.t, A.t, c1, c2); ev.o1 = r1; ev.o2 = r2; ev.kids = [r1.child, r2.child]; }
        else if (op === 'pmx') { const r1 = pmx(A.t, B.t, c1, c2), r2 = pmx(B.t, A.t, c1, c2); ev.o1 = r1; ev.o2 = r2; ev.kids = [r1.child, r2.child]; }
        else { const r = cx(A.t, B.t); ev.cx = r; ev.kids = [r.c1, r.c2]; }
        ev.decision = 'recombined';
      } else { ev.kids = [A.t.slice(), B.t.slice()]; ev.decision = 'bypassed'; }
      pairs.push(ev); kids.push(...ev.kids);
    }
    const kept = kids.slice(0, size - 1), muts = [];
    const children = kept.map((t, k) => {
      const u = rnd(), m = { u, before: t, offspring: k + 1 };
      if (u < pm) {
        let i = ri(rnd(), n), j = ri(rnd(), n); if (i === j) j = (j + 1) % n; if (i > j) [i, j] = [j, i];
        m.i = i; m.j = j; m.u1 = i / n; m.u2 = j / n; m.kind = mop; m.after = mop === 'swap' ? swapM(t, i, j) : mop === 'inversion' ? invM(t, i, j) : insM(t, i, j); m.decision = 'mutated';
      } else { m.after = t; m.decision = 'unchanged'; }
      muts.push(m); return { id: nextId++, t: m.after, len: tourLen(inst, m.after) };
    });
    const elite = pop.reduce((b, p) => (p.len < b.len ? p : b));
    pop = [{ ...elite, elite: true }, ...children];
    hist.push({ pop, events: { pool, pairs, muts } });
  }
  return hist;
}
const stats = (inst, hist) => { let bs = Infinity; return hist.map(({ pop }) => { const lens = pop.map((p) => p.len); const best = Math.min(...lens); bs = Math.min(bs, best); const edges = new Map(); pop.forEach((p) => edgesOf(p.t).forEach((e) => edges.set(e, (edges.get(e) || 0) + 1))); const bestT = pop.reduce((b, p) => (p.len < b.len ? p : b)).t; let share = 0, pairs = 0; for (let i = 0; i < pop.length; i++) for (let j = i + 1; j < pop.length; j++) { const A = new Set(edgesOf(pop[i].t)); const sh = edgesOf(pop[j].t).filter((e) => A.has(e)).length; share += 1 - sh / inst.n; pairs++; } return { best, bs, avg: lens.reduce((a, b) => a + b, 0) / lens.length, worst: Math.max(...lens), div: share / pairs, edges, bestT }; }); };

/* ---------- state and caches ---------- */
let state = { s: 'route', inst: 'berlin52', gen: 200, op: 'ox', mop: 'inversion', lay: 'trunc', marks: 'none', opt: 0, heat: 1, sel: 3, t: 'light', z: 'fit', p: '0', pair: 6 };
const cache = {};
function run() { const k = `${state.inst}|${state.op}|${state.mop}`; if (!cache[k]) { const inst = INST[state.inst]; const gens = { ulysses16: 60, circle: 40, clusters: 60, berlin52: 300, kroA100: 200 }[state.inst] || 100; const hist = simulate(inst, { op: state.op, mop: state.mop, gens, pm: 0.5, seed: 11 }); cache[k] = { hist, st: stats(inst, hist) }; } return cache[k]; }
const I = () => INST[state.inst];

/* ---------- mock chrome ---------- */
function topbar(cur, done, gen, line, menuOpen) {
  const stages = ['Selection', 'Pairing', 'Crossover', 'Mutation', 'Evaluation', 'Replacement'], inst = I();
  const menu = menuOpen ? `<ul class="menulist" style="position:absolute;left:68px;top:62px;z-index:60"><li><span>&nbsp;</span> Goldberg x²</li><li><span>&nbsp;</span> Target string</li><li><span>&nbsp;</span> Knapsack</li><li><span>&nbsp;</span> Trap</li><li><span>&nbsp;</span> Landscape</li><li class="cur"><span>✓</span> TSP</li></ul>` : '';
  return `<div id="top"><div id="brand" style="position:relative"><span class="logo" aria-hidden="true">Ts</span><div><div class="trow"><h1 class="t" style="margin:0">TSP ▾</h1><span class="presetchip">${inst.name}</span></div><div class="s">${inst.n} cities · optimum ${L(inst, inst.optLen)}</div></div>${menu}</div>
  <ol id="ribbon" style="list-style:none;margin:0">${stages.map((s, k) => `<li class="stage ${k < done ? 'done' : ''} ${k === cur ? 'cur' : ''}"><span class="n">${k < done ? '✓' : k + 1}</span><span>${s}</span></li>`).join('')}</ol>
  <div id="gen"><div class="g">Generation ${gen}</div><div class="l">${line}</div></div></div>`;
}
function transport() {
  return `<div id="transport"><button class="btn quiet">↺</button><button class="btn quiet">◂ Back <kbd>←</kbd></button><button class="btn primary">Micro-step ▸ <kbd>→</kbd></button><button class="btn quiet">◂◂</button><button class="btn">Stage ▸▸ <kbd>⇧→</kbd></button><button class="btn">Generation ⏭ <kbd>G</kbd></button><span class="vsep"></span><button class="btn">▶ Run <kbd>Space</kbd></button><button class="btn quiet">Run to stop</button><span class="vsep"></span>
  <div id="tier"><div><input class="speed" type="range" min="0" max="3" value="0"><div class="labels" style="width:200px;margin-left:0"><span>Slow</span><span>Medium</span><span>Fast</span><span>Max</span></div></div></div><span class="vsep"></span>
  <div id="seedbox">Seed <b>42</b> <button class="btn quiet" style="height:40px;padding:0 10px">↻ New</button></div><div id="statusline">Paused</div><span style="flex:1"></span><button class="btn quiet">◐</button><button class="btn quiet">⚙ Parameters</button><button class="btn quiet">A⁺</button></div>`;
}
const history = (g) => `<footer class="history"><div class="title"><b>Run history</b><span class="muted">recorded gens 0–${g}</span></div><div class="scrub"><svg viewBox="0 0 1440 66" width="1440" height="66"><rect x="0" y="14" width="1440" height="12" rx="6" class="track"/><rect x="0" y="14" width="1000" height="12" rx="6" class="fill"/><rect x="996" y="6" width="8" height="28" rx="3" class="thumb"/>${[0, 1, 2, 3, 4, 5].map((k) => `<text x="${(k + 0.5) * 240}" y="54" text-anchor="middle" class="${k === 4 ? 'current' : ''}">gen ${Math.round((k * g) / 5)}</text>`).join('')}</svg></div><button class="btn live" disabled>Return to live</button></footer>`;
const tabs = (cur) => `<div class="tabs"><span class="tab ${cur === 'stage' ? 'on' : ''}">Stage view</span><span class="tab ${cur === 'map' ? 'on' : ''}">Route map</span></div>`;

/* ---------- permutation strips ---------- */
function strip(t, o = {}) {
  const n = t.length, w = o.cell || (n <= 16 ? 30 : n <= 24 ? 22 : n <= 36 ? 20 : n <= 52 ? 16 : n <= 60 ? 15 : 22), fs = w >= 28 ? 17 : w >= 22 ? 14 : w >= 20 ? 13 : 11;
  let keep = null;
  if (n > 60) { const k = new Set([0, 1, 2, 3, 4, 5, n - 1, n - 2, n - 3]); (o.focus || []).forEach((c) => { for (let d = -4; d <= 4; d++) if (c + d >= 0 && c + d < n) k.add(c + d); }); keep = k; }
  let out = '', gap = 0;
  for (let i = 0; i < n; i++) {
    if (keep && !keep.has(i)) { gap++; continue; }
    if (gap) { out += `<span class="pc gap" style="width:${w + 8}px;height:${w <= 17 ? 24 : 28}px;font-size:${fs}px">⋯ ${gap}</span>`; gap = 0; }
    const cls = (o.cls ? o.cls(i) : []).join(' ');
    out += `<span class="pc ${cls}" style="width:${w}px;height:${w <= 17 ? 24 : 28}px;font-size:${fs}px">${t[i] + 1}</span>`;
  }
  if (gap) out += `<span class="pc gap" style="width:${w + 8}px;height:${w <= 17 ? 24 : 28}px;font-size:${fs}px">⋯ ${gap}</span>`;
  return `<span class="pcs ${o.nowrap ? 'nowrap' : ''}">${out}</span>`;
}
const srow = (who, t, o) => `<div class="crow prow"><span class="who ${o && o.sub ? 'sub' : ''}">${who}</span>${strip(t, o)}</div>`;

/* ---------- the population table ---------- */
function thumb(inst, t, w = 64, h = 44) {
  const xy = inst.coords.map((c) => geoXY(inst, c)), xs = xy.map((p) => p[0]), ys = xy.map((p) => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), s = Math.min((w - 6) / (x1 - x0 || 1), (h - 6) / (y1 - y0 || 1));
  const P = (c) => [3 + (xy[c][0] - x0) * s, h - 3 - (xy[c][1] - y0) * s];
  return `<svg class="thumb" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><path d="${t.map((c, k) => `${k ? 'L' : 'M'}${P(c).map((v) => v.toFixed(1)).join(',')}`).join(' ')} Z" fill="none" stroke="var(--ink2)" stroke-width="1.3" stroke-linejoin="round"/></svg>`;
}
function popPanel(title, pop, o = {}) {
  const inst = I(), n = inst.n, lay = o.lay || (n <= 16 ? 'full' : state.lay);
  const sel = pop.find((p) => p.id === state.sel) || pop[2];
  const best = Math.min(...pop.map((p) => p.len)), avg = pop.reduce((t, p) => t + p.len, 0) / pop.length;
  const gap = (len) => `${(((len - inst.optLen) / inst.optLen) * 100).toFixed(1)}%`;
  const cell = (t) => {
    if (lay === 'full') return `<span class="pcs nowrap">${strip(t, { cell: 22, nowrap: 1 })}</span>`;
    if (lay === 'wrap') return strip(t, { cell: 17 });
    return `<span class="trunc">${thumb(inst, t)}<span class="seq">${t.slice(0, 7).map((c) => c + 1).join(' ')} <span class="muted">… ${n - 10} more …</span> ${t.slice(-3).map((c) => c + 1).join(' ')}</span></span>`;
  };
  const rows = pop.map((p) => `<tr class="${p.id === sel.id ? 'sel' : ''}"><td>${p.id === sel.id ? '▸ ' : ''}${p.id}${p.elite ? ' ★' : ''}</td><td class="chr">${cell(p.t)}</td><td class="num">${L(inst, p.len)}</td><td class="num">${gap(p.len)}</td><td class="num strong">${L(inst, -p.len)}</td></tr>`).join('');
  const cr = canon(sel.t).map((c) => c + 1), cut = cr.length > 52 ? 46 : cr.length; const detail = lay === 'trunc' ? `<div class="seldetail"><b>Individual ${sel.id}</b> · canonical route ${cr.slice(0, cut).join(' → ')}${cut < cr.length ? ` → … (${cr.length - cut} more)` : ' → 1'} <span class="muted">· the chromosome starts at city ${sel.t[0] + 1}</span></div>` : '';
  const head = `<tr><th>#</th><th>Chromosome<span class="colnote">${n} cities, as the order visited</span></th><th class="num">Length<span class="colnote">objective</span></th><th class="num">Gap<span class="colnote">to ${L(inst, inst.optLen)}</span></th><th class="num">Fitness<span class="colnote">= −length</span></th></tr>`;
  const h = lay === 'trunc' ? 542 : 542;
  return `<section class="panel abs" style="left:1136px;top:172px;width:760px;height:${h}px"><div class="ph"><h2>${title}</h2><span class="r">avg ${L(inst, avg)} · best ${L(inst, best)} (${gap(best)})</span></div>
  <div class="tablewrap" style="top:50px;bottom:${detail ? 112 : 0}px;padding:0 6px"><table class="ktable compact rt tsp"><thead>${head}</thead><tbody>${rows}</tbody></table></div>${detail}</section>
  <div id="legend" style="left:1136px;top:722px;width:760px"><span><b>★</b> elite</span><span><b>◆</b> parent</span><span><b>◇</b> offspring</span><span><b>✱</b> mutated city</span><span><b>▸</b> selected</span></div>`;
}

/* ---------- the bottom strip ---------- */
function strip3(g) {
  const inst = I(), { st } = run(), G = Math.min(g, st.length - 1), xmax = Math.max(15, Math.ceil((st.length - 1) / 5) * 5);
  const floor = -Math.ceil(Math.max(...st.map((s) => s.worst), inst.nnLen) / 5000) * 5000, X = (k) => 100 + (680 * k) / xmax, Y = (v) => 138 - (110 * (v - floor)) / (0 - floor);
  const path = (a) => a.map((v, k) => `${k ? 'L' : 'M'}${X(k)},${Y(v)}`).join(' ');
  const ticks = [0, 1, 2, 3, 4].map((t) => { const v = floor + (t * -floor) / 4; return `<line class="gr" x1="100" x2="780" y1="${Y(v)}" y2="${Y(v)}"/><text x="92" y="${Y(v) + 6}" text-anchor="end">${num(v)}</text>`; }).join('');
  const step = xmax > 150 ? 50 : xmax > 60 ? 25 : 5; const xt = Array.from({ length: xmax / step + 1 }, (_, k) => k * step).map((k) => `<text x="${X(k)}" y="160" text-anchor="middle">${k}</text>`).join('');
  const upto = st.slice(0, G + 1);
  const fit = `<svg viewBox="0 0 800 188" width="100%">${ticks}${xt}<line x1="100" x2="780" y1="${Y(-inst.optLen)}" y2="${Y(-inst.optLen)}" stroke="var(--ink2)" stroke-width="1.5" stroke-dasharray="2 5"/><text x="780" y="${Y(-inst.optLen) - 6}" text-anchor="end" style="font-size:16px">optimum ${num(-inst.optLen)}</text><line x1="100" x2="780" y1="${Y(-inst.nnLen)}" y2="${Y(-inst.nnLen)}" stroke="var(--ink2)" stroke-width="1.5" stroke-dasharray="9 5"/><text x="780" y="${Y(-inst.nnLen) + 20}" text-anchor="end" style="font-size:16px">nearest neighbour ${num(-inst.nnLen)}</text>
   <path d="${path(upto.map((s) => -s.avg))}" fill="none" stroke="var(--s1)" stroke-width="2.5"/><path d="${path(upto.map((s) => -s.best))}" fill="none" stroke="var(--s2)" stroke-width="2.5"/><path d="${path(upto.map((s) => -s.bs))}" fill="none" stroke="var(--s3)" stroke-width="2.5" stroke-dasharray="7 4"/>
   ${upto.filter((_, k) => k % Math.ceil(upto.length / 12) === 0 || k === G).map((s, _i, a) => '').join('')}<line x1="${X(G)}" x2="${X(G)}" y1="28" y2="138" stroke="var(--ink)" stroke-width="2"/><text x="${X(G)}" y="20" text-anchor="middle" class="ink" style="font-weight:700;font-size:16px">now</text></svg>`;
  const X2 = (k) => 56 + (444 * k) / xmax, Y2 = (v) => 138 - 110 * v;
  const div = `<svg viewBox="0 0 520 188" width="100%">${[0, 0.5, 1].map((v) => `<line class="gr" x1="56" x2="500" y1="${Y2(v)}" y2="${Y2(v)}"/><text x="48" y="${Y2(v) + 6}" text-anchor="end">${v}</text>`).join('')}${Array.from({ length: xmax / step + 1 }, (_, k) => k * step).map((k) => `<text x="${X2(k)}" y="160" text-anchor="middle">${k}</text>`).join('')}<path d="${upto.map((s, k) => `${k ? 'L' : 'M'}${X2(k)},${Y2(s.div)}`).join(' ')}" fill="none" stroke="var(--s7)" stroke-width="2.5"/><line x1="${X2(G)}" x2="${X2(G)}" y1="28" y2="138" stroke="var(--ink)" stroke-width="2"/><text x="${X2(G)}" y="20" text-anchor="middle" class="ink" style="font-weight:700;font-size:16px">now</text></svg>`;
  // edge agreement: for each edge of the best-so-far tour (here the generation's best), the share of the population that uses it
  const s = st[G], pop = run().hist[G].pop, shares = edgesOf(s.bestT).map((e) => (s.edges.get(e) || 0) / pop.length), all = shares.filter((v) => v === 1).length, maj = shares.filter((v) => v >= 0.5).length;
  const bw = 440 / inst.n, bars = shares.map((v, k) => `<rect x="${k * bw + 0.5}" y="${60 - v * 56}" width="${Math.max(1.5, bw - 1.5)}" height="${v * 56 + 1}" fill="var(--seq4)" stroke="var(--ink2)" stroke-width="0.8"/>`).join('');
  const agree = `<div class="agree"><svg viewBox="0 0 440 66" width="440" height="66" role="img" aria-label="Share of the population that uses each edge of the best tour"><line x1="0" x2="440" y1="64.5" y2="64.5" stroke="var(--axis)"/>${bars}</svg><div class="spkey">each bar: an edge of the best tour, and the share of the population that has it (full height = all ${pop.length})</div><div class="sphist"><b>${all}</b> of ${inst.n} edges are in every individual · <b>${maj}</b> in at least half · mean agreement <b>${(shares.reduce((a, b) => a + b, 0) / shares.length).toFixed(2)}</b></div></div>`;
  const gap = ((s.bs - inst.optLen) / inst.optLen * 100).toFixed(1);
  return `<section class="panel plot abs" style="left:24px;top:758px;width:820px;height:244px"><div class="ph"><h2>Fitness</h2><span class="r legend"><b>●</b> average &nbsp;<b>■</b> best of gen. &nbsp;<b>▲</b> best so far &nbsp;fitness = −length</span></div>${fit}</section>
  <section class="panel plot abs" style="left:860px;top:758px;width:540px;height:244px"><div class="ph"><h2>Diversity</h2><span class="r legend">share of edges not in common, 0–1</span></div>${div}</section>
  <section class="panel plot abs" style="left:1416px;top:758px;width:480px;height:244px"><div class="ph"><h2>Edge agreement</h2><span class="r legend">${new Set(pop.map((p) => canon(p.t).join())).size} of ${pop.length} distinct routes</span></div>${agree}<p class="summary" style="margin:2px 16px 0;font-size:15px;line-height:1.2;color:var(--ink2)">generation ${G} · best now ${L(inst, s.best)} · best so far ${L(inst, s.bs)} (gap ${gap}%)<br>average ${L(inst, s.avg)} · worst ${L(inst, s.worst)} · evaluations ${12 * (G + 1)}</p></section>
  ${history(G)}`;
}

/* ---------- the route map ---------- */
function mapSvg(o = {}) {
  const inst = I(), { hist, st } = run(), G = Math.min(state.gen, hist.length - 1), pop = hist[G].pop, W = 740, H = 292, M = 22;
  const xy = inst.coords.map((c) => geoXY(inst, c)), xs = xy.map((p) => p[0]), ys = xy.map((p) => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const s = Math.min((W - 2 * M) / (x1 - x0 || 1), (H - 2 * M) / (y1 - y0 || 1)), ox0 = (W - (x1 - x0) * s) / 2, oy0 = (H - (y1 - y0) * s) / 2;
  const P = (c) => [ox0 + (xy[c][0] - x0) * s, H - oy0 - (xy[c][1] - y0) * s];
  const line = (a, b, attrs) => { const p = P(a), q = P(b); return `<line x1="${p[0].toFixed(1)}" y1="${p[1].toFixed(1)}" x2="${q[0].toFixed(1)}" y2="${q[1].toFixed(1)}" ${attrs}/>`; };
  const tourEdges = (t) => t.map((c, k) => [c, t[(k + 1) % t.length]]);
  let g = '';
  const best = pop.reduce((b, p) => (p.len < b.len ? p : b));
  const counts = st[G].edges;
  if (state.heat && !o.hideHeat) for (const [e, cnt] of counts) { const [a, b] = e.split('-').map(Number); g += line(a, b, `stroke="var(--ink2)" stroke-opacity="${(o.marks ? 0.4 : 1) * (0.18 + 0.4 * (cnt / pop.length))}" stroke-width="${(1 + 6 * (cnt / pop.length)).toFixed(1)}" stroke-linecap="round" data-count="${cnt}"`); }
  if (state.opt) tourEdges(inst.opt).forEach(([a, b]) => (g += line(a, b, 'stroke="var(--ink2)" stroke-width="2" stroke-dasharray="9 6" opacity=".9"')));
  if (o.marks === 'cross') {
    const ev = o.ev, kid = ev.kids[0], A = new Set(edgesOf(ev.A.t)), B = new Set(edgesOf(ev.B.t));
    tourEdges(kid).forEach(([a, b]) => { const k = edgeKey(a, b), inA = A.has(k), inB = B.has(k); g += line(a, b, inA && inB ? 'stroke="var(--ink2)" stroke-width="3" opacity=".75"' : inA ? 'stroke="var(--s1)" stroke-width="4"' : inB ? 'stroke="var(--s3)" stroke-width="4" stroke-dasharray="10 6"' : 'stroke="var(--flip)" stroke-width="4" stroke-dasharray="2 5" stroke-linecap="round"'); });
    if (ev.cuts && state.op !== 'cx') for (let i = ev.cuts[0]; i < ev.cuts[1]; i++) { const p = P(kid[i]); g += `<circle cx="${p[0]}" cy="${p[1]}" r="9" fill="none" stroke="var(--ink)" stroke-width="2.5"/>`; }
  } else if (o.marks === 'mut') {
    const m = o.m, was = new Set(edgesOf(m.before)), now = new Set(edgesOf(m.after));
    tourEdges(m.before).forEach(([a, b]) => { if (!now.has(edgeKey(a, b))) { g += line(a, b, 'stroke="var(--flip)" stroke-width="3" stroke-dasharray="3 5"'); const p = P(a), q = P(b); g += `<text x="${(p[0] + q[0]) / 2}" y="${(p[1] + q[1]) / 2 + 6}" text-anchor="middle" style="font-size:30px;font-weight:900;fill:var(--flip-ink);paint-order:stroke;stroke:var(--surface);stroke-width:6px">✕</text>`; } else g += line(a, b, 'stroke="var(--ink2)" stroke-width="2" opacity=".55"'); });
    tourEdges(m.after).forEach(([a, b]) => { if (!was.has(edgeKey(a, b))) g += line(a, b, 'stroke="var(--s1)" stroke-width="5" stroke-linecap="round"'); });
    new Set([...tourEdges(m.before), ...tourEdges(m.after)].flatMap(([a, b]) => [a, b]).filter((c) => (was.has(edgeKey(c, m.before[(m.before.indexOf(c) + 1) % m.before.length])) ? 0 : 1) + (now.has(edgeKey(c, m.after[(m.after.indexOf(c) + 1) % m.after.length])) ? 0 : 1) > 0)).forEach((c) => { const p = P(c); g += `<circle cx="${p[0]}" cy="${p[1]}" r="10" fill="none" stroke="var(--ink)" stroke-width="2.5"/>`; });
  } else {
    tourEdges(best.t).forEach(([a, b]) => (g += line(a, b, 'stroke="var(--ink)" stroke-width="3.4" stroke-linecap="round" data-best="1"')));
    const sel = pop.find((p) => p.id === state.sel);
    if (sel && sel !== best) tourEdges(sel.t).forEach(([a, b]) => (g += line(a, b, 'stroke="var(--flip)" stroke-width="3.2" stroke-dasharray="2 6" stroke-linecap="round"')));
  }
  const r = inst.n > 60 ? 3.6 : inst.n > 30 ? 5 : 8, fsz = inst.n > 60 ? 0 : inst.n > 30 ? 10 : 14;
  const dots = inst.coords.map((_, c) => { const p = P(c); return `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${r}" fill="var(--surface)" stroke="var(--ink)" stroke-width="1.6"/>${fsz ? `<text x="${(p[0] + r + 2).toFixed(1)}" y="${(p[1] - r).toFixed(1)}" style="font-size:${fsz}px;font-weight:700;fill:var(--ink);paint-order:stroke;stroke:var(--surface);stroke-width:3px">${c + 1}</text>` : ''}`; }).join('');
  return `<svg class="map" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Route map">${g}${dots}<text x="${W - 8}" y="${H - 8}" text-anchor="end" style="font-size:13px;fill:var(--ink2)">${inst.type === 'GEO' ? 'longitude → · latitude ↑' : 'x → · y ↑'}</text></svg>`;
}
function mapScreen(o = {}) {
  const inst = I(), { hist, st } = run(), G = Math.min(state.gen, hist.length - 1), s = st[G];
  const gap = (v) => (((v - inst.optLen) / inst.optLen) * 100).toFixed(1);
  const keyText = o.marks === 'cross' ? '<b>━</b> shared by both parents · <b style="color:var(--s1)">━</b> from A only · <b style="color:var(--s3)">╍</b> from B only · <b style="color:var(--flip)">┈</b> a new edge · ○ the kept slice' : o.marks === 'mut' ? '<b style="color:var(--flip-ink)">✕</b> removed edge (dashed) · <b style="color:var(--s1)">━</b> added edge · grey: unchanged' : '<b>━</b> best of the generation · <b style="color:var(--flip)">┈</b> selected individual · faint lines: the population’s edges, thicker = more individuals use it · <b>╍</b> optimal tour';
  const toolbar = `<span class="lgrp"><span class="tog ${state.heat ? 'on' : ''}">${state.heat ? '✓ ' : ''}Population’s edges</span><span class="tog ${state.opt ? 'on' : ''}">${state.opt ? '✓ ' : ''}Optimal tour</span></span><span class="lgrp key">gap = how much longer than the optimum</span>`;
  const sidebar = `<div class="mside"><h3>Generation ${G}</h3><table class="atab st"><tbody><tr><td>best now</td><td class="num">${L(inst, s.best)}</td><td class="num muted">+${gap(s.best)}%</td></tr><tr><td>best so far</td><td class="num">${L(inst, s.bs)}</td><td class="num muted">+${gap(s.bs)}%</td></tr><tr><td>average</td><td class="num">${L(inst, s.avg)}</td><td class="num muted">+${gap(s.avg)}%</td></tr><tr><td colspan="3"><hr></td></tr><tr><td>optimum</td><td class="num">${L(inst, inst.optLen)}</td><td class="num muted">${inst.kind === 'own' ? 'exact' : 'published'}</td></tr><tr><td>nearest neighbour</td><td class="num">${L(inst, inst.nnLen)}</td><td class="num muted">+${gap(inst.nnLen)}%</td></tr></tbody></table></div>`;
  const sent = `${inst.name}: ${inst.n} cities, ${inst.rule}. Generation ${G}: the best tour is ${L(inst, s.best)} long, ${gap(s.best)} % over the optimum ${L(inst, inst.optLen)}; ${[...s.edges.values()].filter((v) => v === hist[G].pop.length).length} edges are in every individual.`;
  const body = `<div class="lview"><div class="lbar">${toolbar}</div><div class="mrow"><figure style="margin:0">${mapSvg(o)}</figure>${sidebar}</div><p class="lkey">${keyText}</p><p class="lsent">${esc(sent)}</p></div>`;
  const narr = o.narr || `Generation ${G} complete: best ${L(inst, s.best)} (${gap(s.best)} % over the optimum)`;
  return `${topbar(o.cur ?? 5, o.done ?? 6, o.gen ?? G, o.line || 'generation complete')}${transport()}<section class="panel abs" style="left:24px;top:172px;width:1096px;height:574px"><div class="ph"><h2>${o.title || 'Route map'}</h2></div>${tabs('map')}<div id="stagebody" style="top:90px;bottom:70px">${body}</div><div id="narr"><span class="m">${o.micro || 'Generation complete'}</span><span>${esc(narr)}</span></div></section>${popPanel(o.poptitle || `Population · generation ${G}`, hist[G].pop)}${strip3(G)}`;
}

/* ---------- operator cards ---------- */
function stageFrame(title, cur, bodyHtml, narrMicro, narr, parentsGen) {
  const { hist } = run(), G = state.gen;
  return `${topbar(cur, cur, G, `being made · ${narrMicro}`)}${transport()}<section class="panel abs" style="left:24px;top:172px;width:1096px;height:574px"><div class="ph"><h2>${title}</h2></div>${tabs('stage')}<div id="stagebody" style="top:90px"><div class="cardwrap">${bodyHtml}</div></div><div id="narr"><span class="m">${narrMicro}</span><span>${esc(narr)}</span></div></section>${popPanel(`Parents · generation ${G - 1}`, hist[G - 1].pop)}${strip3(G - 1)}`;
}
const pairEvent = () => { const { hist } = run(); const ps = hist[state.gen].events.pairs, n = I().n; const nice = ps.filter((p) => p.decision === 'recombined' && (state.op === 'cx' || (p.cuts[0] >= 4 && p.cuts[1] <= n - 4 && p.cuts[1] - p.cuts[0] >= 4))); const pick = nice[0] || ps.find((p) => p.decision === 'recombined') || ps[0]; state.pair = ps.indexOf(pick) + 1; return pick; };
function cutText(ev, n) { return `cut points: u₁ = ${ev.u1.toFixed(3)} → position ${ev.cuts[0]}, u₂ = ${ev.u2.toFixed(3)} → position ${ev.cuts[1]} (the slice is positions ${ev.cuts[0] + 1} to ${ev.cuts[1]}, ${ev.cuts[1] - ev.cuts[0]} cities)`; }
function crossScreen() {
  const inst = I(), n = inst.n, ev = pairEvent(), op = state.op;
  const focus = ev.cuts || [0];
  const head = (what) => `<div class="thead"><b>Pair ${state.pair}</b><span class="badge ok"><span aria-hidden="true">✓</span> recombined</span><span class="muted">u = ${ev.u.toFixed(2)} &lt; pc 0.9 · ${what}</span></div>`;
  let body = '';
  const A = ev.A, B = ev.B, names = ['O1', 'O2'];
  if (op === 'ox') {
    const sl = ev.cuts, inS = (i) => i >= sl[0] && i < sl[1];
    const pc = (src) => (i) => [inS(i) ? 'slice' : '', src === 'A' && inS(i) ? '' : src === 'B' ? '' : ''];
    const child = (r, srcA) => strip(r.child, { focus, cls: (i) => (inS(i) ? ['slice'] : ['hatch']) });
    const order = (r) => r.order.slice(0, 8).map((c) => c + 1).join(', ');
    body = `<p class="expl"><b>Order crossover (OX)</b>: the child keeps one parent’s slice in place (outlined) and fills the other positions, after the slice, with the remaining cities in the other parent’s order (hatched). One-point crossover would repeat some cities and lose others.</p>
    <section class="card ccard current">${head('OX')}<div class="cutline">${cutText(ev, n)}</div>
    ${srow('A', A.t, { focus, cls: (i) => (inS(i) ? ['slice'] : []) })}${srow('B', B.t, { focus, cls: (i) => (inS(i) ? ['slicek'] : []) })}    <div class="crow prow"><span class="who">O1</span>${child(ev.o1)}</div><div class="fillnote">keeps A’s slice · fills from B, starting after position ${sl[1]}: ${order(ev.o1)}${ev.o1.order.length > 8 ? ', …' : ''} (${ev.o1.order.length} cities)</div>
    <div class="crow prow"><span class="who">O2</span>${child(ev.o2)}</div><div class="fillnote">keeps B’s slice · fills from A: ${order(ev.o2)}${ev.o2.order.length > 8 ? ', …' : ''}</div>
    <div class="plain-hatch">plain city = inherited from the parent whose slice is kept · <span class="pc hatch" style="width:20px;height:20px;font-size:12px;display:inline-flex">7</span> hatched city = filled from the other parent · outlined = the slice · lengths: A ${L(inst, A.len)}, B ${L(inst, B.len)} → O1 ${L(inst, tourLen(inst, ev.o1.child))}, O2 ${L(inst, tourLen(inst, ev.o2.child))}</div></section>`;
  } else if (op === 'pmx') {
    const sl = ev.cuts, inS = (i) => i >= sl[0] && i < sl[1];
    const fixedAt = (r) => new Map(r.fixed.map((f) => [f.pos, f]));
    const child = (r) => { const fx = fixedAt(r); return strip(r.child, { focus, cls: (i) => (inS(i) ? ['hatch', 'slice'] : fx.has(i) ? ['mapped'] : []) }); };
    const map = ev.o1.mapping.slice(0, 7).map(([b, a]) => `${b + 1} ↔ ${a + 1}`).join(' · ');
    const ex = ev.o1.fixed[0];
    body = `<p class="expl"><b>Partial-mapped crossover (PMX)</b>: the child takes one parent’s slice in place (hatched, outlined) and keeps the other parent’s city everywhere else, unless that city is already in the slice; then it follows the <b>mapping</b> between the two slices to a city that is free (marked ↻).</p>
    <section class="card ccard current">${head('PMX')}<div class="cutline">${cutText(ev, n)}</div>
    ${srow('A', A.t, { focus, cls: (i) => (inS(i) ? ['slice'] : []) })}${srow('B', B.t, { focus, cls: (i) => (inS(i) ? ['slice', 'hatch'] : []) })}
    <div class="maprow"><b>mapping</b> (B’s city at each slice position ↔ A’s): ${map}${ev.o1.mapping.length > 7 ? ' · …' : ''}${ex ? `<br><b>example</b>: position ${ex.pos + 1} holds city ${ex.chain[0] + 1} in A, but ${ex.chain[0] + 1} is in B’s slice → ${ex.chain.map((c) => c + 1).join(' ↔ ')}: city ${ex.chain[ex.chain.length - 1] + 1} is free, so it goes there` : '<br>no city of A outside the slice is in B’s slice, so nothing needed mapping'}</div>
    <div class="crow prow"><span class="who">O1</span>${child(ev.o1)}</div><div class="fillnote">B’s slice, A elsewhere · ${ev.o1.fixed.length} cit${ev.o1.fixed.length === 1 ? 'y' : 'ies'} followed the mapping ↻</div>
    <div class="crow prow"><span class="who">O2</span>${child(ev.o2)}</div><div class="fillnote">A’s slice, B elsewhere · ${ev.o2.fixed.length} followed the mapping</div>
    <div class="plain-hatch">lengths: A ${L(inst, A.len)}, B ${L(inst, B.len)} → O1 ${L(inst, tourLen(inst, ev.o1.child))}, O2 ${L(inst, tourLen(inst, ev.o2.child))}</div></section>`;
  } else {
    const r = ev.cx, cyc = (i) => r.cycleOf[i];
    const kid = (t, first) => strip(t, { focus: [0], cls: (i) => [(cyc(i) % 2 ? first : !first) ? '' : 'hatch', `c${Math.min(cyc(i), 4)}`] });
    body = `<p class="expl"><b>Cycle crossover (CX)</b>: the positions fall into <b>cycles</b> (position i, then the position where A has the city B has at i, and so on until it closes). The child takes the first cycle’s positions from A, the second’s from B, alternating. There is no random cut point.</p>
    <section class="card ccard current">${head('CX')}<div class="cutline">${r.cycles.length} cycle${r.cycles.length > 1 ? 's' : ''}: ${r.cycles.slice(0, 5).map((c, k) => `cycle ${k + 1} = ${c.length} position${c.length > 1 ? 's' : ''} (${c.slice(0, 6).map((p) => p + 1).join(', ')}${c.length > 6 ? ', …' : ''})`).join(' · ')}${r.cycles.length > 5 ? ' · …' : ''}${r.cycles.length === 1 ? ' — with a single cycle both children are copies of the parents' : ''}</div>
    ${srow('A', A.t, { focus: [0], cls: (i) => ['c' + Math.min(cyc(i), 4)] })}${srow('B', B.t, { focus: [0], cls: (i) => ['c' + Math.min(cyc(i), 4)] })}
    <div class="crow prow"><span class="who">O1</span>${kid(r.c1, true)}</div><div class="fillnote">cycle 1 from A, cycle 2 from B, … (hatched = from B)</div>
    <div class="crow prow"><span class="who">O2</span>${kid(r.c2, false)}</div>
    <div class="plain-hatch">the underline under each city names its cycle (1, 2, 3, 4+ : one, two, three and four-dashes) · lengths: A ${L(inst, A.len)}, B ${L(inst, B.len)} → O1 ${L(inst, tourLen(inst, r.c1))}, O2 ${L(inst, tourLen(inst, r.c2))}</div></section>`;
  }
  return stageFrame('Stage 3 · Crossover', 2, body, `micro-step ${state.pair} of 6`, `Pair ${state.pair}: ${op.toUpperCase()}${ev.cuts && op !== 'cx' ? `, slice positions ${ev.cuts[0] + 1} to ${ev.cuts[1]}` : ''} → children ${L(inst, tourLen(inst, ev.kids[0]))} and ${L(inst, tourLen(inst, ev.kids[1]))}`);
}
function mutEvent() { const { hist } = run(); const ms = hist[state.gen].events.muts; return ms.find((m) => m.decision === 'mutated') || ms[0]; }
function mutScreen() {
  const inst = I(), { hist } = run(), ms = hist[state.gen].events.muts, m = mutEvent(), n = inst.n;
  const kind = state.mop;
  const mutated = ms.filter((x) => x.decision === 'mutated');
  const showMs = [ms[0], m, ms[1]].filter((x, k, a) => x && a.indexOf(x) === k).slice(0, 3);
  const row = (x) => {
    const lenB = tourLen(inst, x.before), lenA = tourLen(inst, x.after);
    const was = new Set(edgesOf(x.before)), now = new Set(edgesOf(x.after));
    const removed = edgesOf(x.before).filter((e) => !now.has(e)), added = edgesOf(x.after).filter((e) => !was.has(e));
    const changed = (i) => (x.after[i] !== x.before[i] ? ['mutated'] : []);
    const d = (e) => e.replace('-', '–').split('–').map((v) => +v + 1).join('–');
    const what = x.decision !== 'mutated' ? '' : kind === 'swap' ? `swap positions ${x.i + 1} and ${x.j + 1}` : kind === 'inversion' ? `reverse the slice from position ${x.i + 1} to ${x.j + 1}` : `move the city at position ${x.i + 1} to position ${x.j + 1}`;
    return `<section class="card mcard ${x === m ? 'current' : ''}"><div class="crow"><span class="who">O${x.offspring}</span><span class="dec">draw u = ${x.u.toFixed(3)} ${x.decision === 'mutated' ? '&lt;' : '≥'} pm 0.4 (one draw per individual) → <b>${x.decision}</b></span>${x.decision === 'mutated' ? `<span class="badge flip">✱ ${what}</span><span class="dec">positions drawn u₁ = ${x.u1.toFixed(3)}, u₂ = ${x.u2.toFixed(3)}</span>` : ''}</div>
    ${x.decision === 'mutated' ? `${srow('before', x.before, { sub: 1, focus: [x.i, x.j], cls: (i) => (i >= Math.min(x.i, x.j) && i <= Math.max(x.i, x.j) && kind === 'inversion' ? ['slice'] : i === x.i || i === x.j ? ['slice'] : []) })}${srow('after', x.after, { sub: 1, focus: [x.i, x.j], cls: changed })}
    <div class="edgeline"><span class="rm">✕ removed ${removed.map(d).join(', ')}</span> · <span class="ad">added ${added.map(d).join(', ')}</span> · length ${L(inst, lenB)} → <b>${L(inst, lenA)}</b> (${lenA - lenB >= 0 ? '+' : '−'}${L(inst, Math.abs(lenA - lenB))})</div>` : `<div class="edgeline muted">unchanged · length ${L(inst, lenB)}</div>`}</section>`;
  };
  const expl = { swap: '<b>Swap</b>: two positions are drawn and their cities exchanged. Up to four edges change.', inversion: '<b>Inversion</b> (a 2-opt move): two positions are drawn and the slice between them is reversed. Exactly two edges change.', insertion: '<b>Insertion</b>: a city is taken out and put back at another position. Three edges change.' }[kind];
  const body = `<p class="expl">${expl} The probability pm is <b>per individual</b>: one draw u decides whether this tour is mutated at all, then the positions are drawn. A permutation has no independent genes to flip.</p>${showMs.map(row).join('')}`;
  return stageFrame('Stage 4 · Mutation', 3, body, 'micro-step 2 of 11', `Offspring ${m.offspring}: draw ${m.u.toFixed(3)} below pm → ${kind} → length ${L(inst, tourLen(inst, m.before))} to ${L(inst, tourLen(inst, m.after))}`);
}

/* ---------- drawer, menu, instance list ---------- */
const sizes = [['burma14', 'TSPLIB', 14, 'GEO', '3,323'], ['ulysses16', 'TSPLIB', 16, 'GEO', '6,859'], ['ulysses22', 'TSPLIB', 22, 'GEO', '7,013'], ['att48', 'TSPLIB', 48, 'ATT', '10,628'], ['eil51', 'TSPLIB', 51, 'EUC_2D', '426'], ['berlin52', 'TSPLIB', 52, 'EUC_2D', '7,542'], ['st70', 'TSPLIB', 70, 'EUC_2D', '675'], ['eil76', 'TSPLIB', 76, 'EUC_2D', '538'], ['kroA100', 'TSPLIB', 100, 'EUC_2D', '21,282']];
function instanceList() {
  return `<ul class="menulist inst" style="position:absolute;left:24px;top:150px;z-index:70;min-width:520px;font-size:19px"><li class="grp"><b>Own instances</b> <span class="muted">exact optimum</span></li><li><span>&nbsp;</span> Circle <span class="muted">5–15 cities · optimum = perimeter</span></li><li><span>&nbsp;</span> Two clusters <span class="muted">12 cities</span></li><li><span>&nbsp;</span> Random <span class="muted">5–15 cities, a seed · Held–Karp</span></li><li class="grp"><b>TSPLIB</b> <span class="muted">Reinelt, 1991 · published optimum</span></li>${sizes.map((s) => `<li class="${s[0] === state.inst ? 'cur' : ''}"><span>${s[0] === state.inst ? '✓' : '&nbsp;'}</span> ${s[0]} <span class="muted">${s[2]} cities · ${s[3]} · optimum ${s[4]}</span></li>`).join('')}</ul>`;
}
function drawer() {
  const inst = I(), op = state.op, mop = state.mop;
  return `<aside class="mockdrawer" id="drawer"><div class="dh"><h2>Parameters</h2><button class="btn quiet">✕ close</button></div>
  <div class="sec" style="padding-top:4px"><h3>Run setup <span class="tag reset">↺ needs reset</span></h3>
   <div class="ctl"><label>Instance</label><span class="field"><select><option>${inst.name}</option></select></span><p class="help">${inst.kind === 'own' ? inst.comment : `TSPLIB (Reinelt, 1991): ${inst.comment}`}. ${inst.n} cities; distance rule ${inst.rule}. Optimum ${L(inst, inst.optLen)} (${inst.kind === 'own' ? 'exact' : 'published; the stored optimal tour has exactly this length'}); nearest neighbour from city 1 gives ${L(inst, inst.nnLen)}.</p></div>
   <div class="applyreset"><button class="btn primary">Restart and apply</button><span class="help">No setup changes.</span></div></div>
  <div class="sec"><h3>Crossover</h3><div class="ctl"><label>Type</label><span class="field"><select><option>${{ ox: 'Order crossover (OX)', pmx: 'Partial-mapped (PMX)', cx: 'Cycle (CX)' }[op]}</option></select></span><p class="help">Offered for permutations: order, partial-mapped and cycle crossover. One-point, two-point and uniform crossover would repeat and lose cities, so they are not offered.</p></div>
   <div class="ctl"><label>Probability pc</label><span class="field"><input type="text" value="0.9"></span><p class="help">Drawn once per pair: below pc the pair is recombined, otherwise its children are copies of the parents.</p></div></div>
  <div class="sec"><h3>Mutation</h3><div class="ctl"><label>Type</label><span class="field"><select><option>${{ swap: 'Swap', inversion: 'Inversion (2-opt move)', insertion: 'Insertion' }[mop]}</option></select></span><p class="help">One move per mutated individual.</p></div>
   <div class="ctl"><label>Probability pm (per individual)</label><span class="field"><input type="text" value="0.4"></span><p class="help">Drawn once per individual, not per city: below pm the tour is mutated once (positions drawn next), otherwise it is unchanged.</p></div>
   <div class="ctl"><label>Stop within ε</label><span class="field"><input type="text" value="0.5"></span><p class="help">“Target reached” means the best length is within ε of the optimum ${L(inst, inst.optLen)}. For ${inst.name} a classroom run usually stays well above it: the gap is shown instead.</p></div></div></aside>`;
}

/* ---------- screens and controls ---------- */
function marksCross() { const { hist } = run(); const ev = pairEvent(); return mapScreen({ marks: 'cross', ev, cur: 2, done: 2, gen: state.gen, line: 'being made · micro-step 6 of 6', title: 'Route map · crossover', poptitle: `Parents · generation ${state.gen - 1}`, micro: 'Micro-step 6 of 6', narr: `Pair ${state.pair}: O1 on the map, its edges coloured by where they come from (${state.op.toUpperCase()})` }); }
function marksMut() { const m = mutEvent(); return mapScreen({ marks: 'mut', m, cur: 3, done: 3, gen: state.gen, line: 'being made · micro-step 2 of 11', title: 'Route map · mutation', micro: 'Micro-step 2 of 11', narr: `Offspring ${m.offspring}: ${state.mop} → removed edges ✕, added edges bold; length ${L(I(), tourLen(I(), m.before))} → ${L(I(), tourLen(I(), m.after))}` }); }
const screens = {
  route: () => mapScreen(), cross: crossScreen, mut: mutScreen, mcross: marksCross, mmut: marksMut,
  menu: () => mapScreen().replace('<span class="logo" aria-hidden="true">Ts</span>', `<ul class="menulist" style="position:absolute;left:68px;top:62px;z-index:60"><li><span>&nbsp;</span> Goldberg x²</li><li><span>&nbsp;</span> Target string</li><li><span>&nbsp;</span> Knapsack</li><li><span>&nbsp;</span> Trap</li><li><span>&nbsp;</span> Landscape</li><li class="cur"><span>✓</span> TSP</li></ul><span class="logo" aria-hidden="true">Ts</span>`),
  drawer: () => `${mapScreen()}${drawer()}`,
  instances: () => `${mapScreen()}${drawer()}${instanceList().replace('left:24px;top:150px', 'left:1160px;top:230px;width:620px')}`,
};
function render() {
  const el = document.getElementById('screen');
  el.className = state.p === '1' ? 'projector' : '';
  el.innerHTML = screens[state.s]();
  document.documentElement.dataset.theme = state.t;
  const sc = state.z === 'fit' ? Math.min(innerWidth / 1920, (innerHeight - 40) / 1080) : 1;
  el.style.transform = `scale(${sc})`;
  document.getElementById('stagewrap').style.height = 1080 * sc + 'px'; document.getElementById('stagewrap').style.width = 1920 * sc + 'px';
  document.querySelectorAll('#mockbar button').forEach((b) => { const d = b.dataset; b.classList.toggle('on', d.s === state.s || d.inst === state.inst || d.op === state.op || d.mop === state.mop || d.lay === state.lay || d.t === state.t || d.z === state.z || d.p === state.p); });
}
document.getElementById('mockbar').addEventListener('click', (e) => {
  const d = e.target.dataset; if (!d) return;
  for (const k of ['s', 'inst', 'op', 'mop', 'lay', 't', 'z', 'p']) if (d[k] !== undefined) state[k] = d[k];
  if (d.gen) state.gen = +d.gen; if (d.opt !== undefined) state.opt = +d.opt; if (d.heat !== undefined) state.heat = +d.heat; if (d.pair) state.pair = +d.pair;
  render();
});
addEventListener('resize', render);
const q = new URLSearchParams(location.search);
for (const k of ['s', 'inst', 'op', 'mop', 'lay', 't', 'z', 'p']) if (q.get(k)) state[k] = q.get(k);
for (const k of ['gen', 'opt', 'heat', 'pair', 'sel']) if (q.get(k)) state[k] = +q.get(k);
if (!q.get('gen')) state.gen = { ulysses16: 40, circle: 20, clusters: 30, berlin52: 200, kroA100: 150 }[state.inst] || 40;
render();
