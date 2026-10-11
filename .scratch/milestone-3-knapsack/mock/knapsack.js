/* ===== Knapsack mock: hand-made data, thrown away after review. The instance below is illustrative (ticket 04 chooses the real one). ===== */
const NAMES = 'ABCDEFGHIJKL'.split('');
const WT = [9, 12, 3, 3, 10, 14, 4, 5, 11, 7, 6, 13];
const VAL = [4, 20, 21, 17, 5, 23, 7, 14, 8, 12, 21, 19];
const N = 12, CAP = 48, RHO = 4, OPT = 123;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const sum = (a, f) => a.reduce((t, x) => t + f(x), 0);

const METHODS = {
  decoder: { name: 'First-fit decoder', short: 'decoder' },
  penalty: { name: 'Penalty', short: 'penalty' },
  lamarck: { name: 'Repair (Lamarckian)', short: 'Lamarckian repair' },
  baldwin: { name: 'Repair (Baldwinian)', short: 'Baldwinian repair' },
};

/* ---------- evaluation of one chromosome under a method ---------- */
function evaluate(bits, method) {
  const g = bits.split('').map(Number);
  let packed = g.map(() => false), notes = [], dropped = [], skipped = [];
  const weightOf = (p) => sum(p.map((x, i) => (x ? WT[i] : 0)), (x) => x);
  if (method === 'decoder') {
    let w = 0;
    g.forEach((b, i) => {
      if (!b) return;
      if (w + WT[i] <= CAP) { packed[i] = true; w += WT[i]; } else { skipped.push(i); notes.push(`skipped ${NAMES[i]}: ${WT[i]} > ${CAP - w} left`); }
    });
  } else {
    packed = g.map((b) => !!b);
    if (method !== 'penalty') {
      while (weightOf(packed) > CAP) {
        let worst = -1, wr = Infinity;
        packed.forEach((p, i) => { if (p && VAL[i] / WT[i] <= wr) { wr = VAL[i] / WT[i]; worst = i; } }); // ties go to the later item
        packed[worst] = false; dropped.push(worst);
        notes.push(`dropped ${NAMES[worst]}: ${VAL[worst]}/${WT[worst]} = ${(VAL[worst] / WT[worst]).toFixed(2)} per weight`);
      }
    }
  }
  const weight = weightOf(packed), value = sum(packed.map((p, i) => (p ? VAL[i] : 0)), (x) => x);
  const over = Math.max(0, weight - CAP), penalty = method === 'penalty' ? RHO * over : 0;
  const genes = method === 'lamarck' ? packed.map((p) => (p ? 1 : 0)) : g;
  return { bits, g, genes, packed, weight, value, over, penalty, fitness: value - penalty, feasible: over === 0, notes, dropped, skipped };
}
const POPBITS = ['110100100101', '011010110000', '101101010110', '010011101001', '111010011010', '001110100101'];
const OFFBITS = ['110110100101', '011010111000', '101101011110', '010111101001', '111010011110', '001110100111'];
const pop = (m) => POPBITS.map((b) => evaluate(b, m));
const off = (m) => OFFBITS.map((b) => evaluate(b, m));

/* ---------- marks for genes (two proposals for the "1 that is not packed") ---------- */
function geneCell(i, r, o = {}) {
  const one = r.genes[i] === 1;
  const notPacked = one && !r.packed[i];
  const wasDropped = o.before && o.before[i] === 1 && r.genes[i] === 0; // Lamarckian: the gene itself was rewritten
  const cls = ['bit', 'sm', one && !notPacked ? 'one' : '', notPacked ? 'skip' : '', wasDropped ? 'cut' : ''].join(' ');
  const title = notPacked ? `item ${NAMES[i]}: gene is 1 but it is not in the bag` : wasDropped ? `item ${NAMES[i]}: dropped by repair, gene rewritten to 0` : one ? `item ${NAMES[i]} is in the bag` : `item ${NAMES[i]} is left out`;
  return `<span class="${cls}" title="${title}">${notPacked ? '<i class="sk">1</i><i class="sx">✕</i>' : r.genes[i]}</span>`;
}
const cellsOf = (r, o) => `<span class="bits tight" style="display:inline-flex">${NAMES.map((_, i) => geneCell(i, r, o)).join('')}</span>`;
const itemRow = () => `<div class="itemhdr"><span class="lbl"><i>item</i><i>weight</i><i>value</i></span><span class="itemrow">${NAMES.map((n, i) => `<span><b>${n}</b><u>${WT[i]}</u><s>${VAL[i]}</s></span>`).join('')}</span></div>`;

/* ---------- capacity bars ---------- */
const SCALE = CAP * 1.5;
function barSmall(r) {
  const w = Math.min(r.weight, SCALE), fillW = Math.min(w, CAP) / SCALE * 100, overW = Math.max(0, w - CAP) / SCALE * 100;
  return `<span class="capbar" role="img" aria-label="weight ${r.weight} of ${CAP}"><i class="fill" style="width:${fillW}%"></i><i class="over" style="left:${CAP / SCALE * 100}%;width:${overW}%"></i><i class="cap" style="left:${CAP / SCALE * 100}%"></i></span>`;
}
function weightCell(r) {
  const mark = r.feasible ? '<b class="okm">✓</b>' : `<b class="overm">✗ +${r.over}</b>`;
  return `<span class="wcell">${barSmall(r)}<span class="wnum">${r.weight}/${CAP}</span>${mark}</span>`;
}
function barBig(r) {
  // stacked by item: the packed items in order, then whatever goes over the capacity is hatched
  const sc = 100 / (CAP * 1.5); let x = 0, out = '';
  r.packed.forEach((p, i) => {
    if (!p) return;
    const startW = x, endW = x + WT[i];
    const inW = Math.max(0, Math.min(endW, CAP) - startW), outW = Math.max(0, endW - Math.max(startW, CAP));
    if (inW > 0) out += `<i class="seg" style="left:${startW * sc}%;width:${inW * sc}%"><b>${NAMES[i]}</b></i>`;
    if (outW > 0) out += `<i class="seg ov" style="left:${Math.max(startW, CAP) * sc}%;width:${outW * sc}%"><b>${NAMES[i]}</b></i>`;
    x = endW;
  });
  return `<div class="bigbar">${out}<i class="capline" style="left:${CAP * sc}%"></i><span class="captxt" style="left:${CAP * sc}%">capacity ${CAP}</span></div>`;
}

/* ---------- chrome (copied from the milestone 2 mock, kept generic) ---------- */
function topbar(cur, done, gen, line, menuOpen) {
  const stages = ['Selection', 'Pairing', 'Crossover', 'Mutation', 'Evaluation', 'Replacement'];
  const menu = menuOpen ? `<ul class="menulist" style="position:absolute;left:68px;top:62px;z-index:60"><li><span>&nbsp;</span> Goldberg x²</li><li><span>&nbsp;</span> Target string</li><li class="cur"><span>✓</span> Knapsack</li></ul>` : '';
  return `<div id="top"><div id="brand" style="position:relative"><span class="logo" aria-hidden="true">Kn</span><div><div class="trow"><h1 class="t" style="margin:0">Knapsack ▾</h1><span class="presetchip">${METHODS[state.method].name}</span></div><div class="s">12 items · capacity ${CAP} · optimum ${OPT}</div></div>${menu}</div>
  <ol id="ribbon" style="list-style:none;margin:0">${stages.map((s, k) => `<li class="stage ${k < done ? 'done' : ''} ${k === cur ? 'cur' : ''}"><span class="n">${k < done ? '✓' : k + 1}</span><span>${s}</span></li>`).join('')}</ol>
  <div id="gen"><div class="g">Generation ${gen}</div><div class="l">${line}</div></div></div>`;
}
function transport() {
  return `<div id="transport"><button class="btn quiet">↺</button><button class="btn quiet">◂ Back <kbd>←</kbd></button><button class="btn primary">Micro-step ▸ <kbd>→</kbd></button><button class="btn quiet">◂◂</button><button class="btn">Stage ▸▸ <kbd>⇧→</kbd></button><button class="btn">Generation ⏭ <kbd>G</kbd></button><span class="vsep"></span><button class="btn">▶ Run <kbd>Space</kbd></button><button class="btn quiet">Run to stop</button><span class="vsep"></span>
  <div id="tier"><div><input class="speed" type="range" min="0" max="3" value="0"><div class="labels" style="width:200px;margin-left:0"><span>Slow</span><span>Medium</span><span>Fast</span><span>Max</span></div></div></div><span class="vsep"></span>
  <div id="seedbox">Seed <b>42</b> <button class="btn quiet" style="height:40px;padding:0 10px">↻ New</button></div><div id="statusline">Paused</div><span style="flex:1"></span><button class="btn quiet">◐</button><button class="btn quiet">⚙ Parameters</button><button class="btn quiet">A⁺</button></div>`;
}
const history = `<footer class="history"><div class="title"><b>Run history</b><span class="muted">recorded gens 0–5</span></div><div class="scrub"><svg viewBox="0 0 1440 66" width="1440" height="66"><rect x="0" y="14" width="1440" height="12" rx="6" class="track"/><rect x="0" y="14" width="1000" height="12" rx="6" class="fill"/><rect x="996" y="6" width="8" height="28" rx="3" class="thumb"/>${[0, 1, 2, 3, 4, 5].map((g) => `<text x="${(g + 0.5) * 240}" y="54" text-anchor="middle" class="${g === 4 ? 'current' : ''}">gen ${g}</text>`).join('')}</svg></div><button class="btn live" disabled>Return to live</button></footer>`;

/* ---------- right-hand population table ---------- */
function popPanel(title) {
  const m = state.method, rs = pop(m);
  const head = `<tr><th>#</th><th>Chromosome${itemRow()}</th><th>Weight<span class="colnote">of ${CAP}</span></th><th class="num">Value</th>${m === 'penalty' ? `<th class="num">Penalty<span class="colnote">ρ = ${RHO}</span></th>` : ''}<th class="num">Fitness</th></tr>`;
  const rows = rs.map((r, i) => `<tr><td>${i + 1}</td><td>${cellsOf(r)}</td><td>${weightCell(r)}</td><td class="num">${r.value}</td>${m === 'penalty' ? `<td class="num">${r.penalty ? '−' + r.penalty : '0'}</td>` : ''}<td class="num strong">${r.fitness}</td></tr>`).join('');
  const feas = rs.filter((r) => r.feasible).length;
  return `<section class="panel abs" style="left:1136px;top:172px;width:760px;height:542px"><div class="ph"><h2>${title}</h2><span class="r">${feas} of ${rs.length} feasible · best ${Math.max(...rs.filter((r) => r.feasible).map((r) => r.fitness))}</span></div>
  <div class="tablewrap" style="top:50px;padding:0 6px"><table class="ktable compact rt"><thead>${head}</thead><tbody>${rows}</tbody></table></div></section>
  <div id="legend" style="left:1136px;top:722px;width:760px"><span><b>★</b> elite</span><span><b>◆</b> parent</span><span><b>◇</b> offspring</span><span><b>✱</b> mutated gene</span><span><b>${state.v === 'A' ? '1̶' : '✕'}</b> not in the bag</span><span><b>✂</b> dropped</span></div>`;
}

/* ---------- bottom strip ---------- */
function strip() {
  const m = state.method;
  const gens = [0, 1, 2, 3, 4, 5];
  const small = state.plot === 'small';
  const best = small ? [84, 96, 112, 131, 139, 152] : [70, 88, 99, 104, 113, 113];
  const avg = small ? [41, 55, 71, 90, 104, 118] : [38, 49, 58, 66, 74, 80];
  const so = best.map((v, k) => Math.max(...best.slice(0, k + 1)));
  const feasSo = small ? [70, 88, 95, 95, 99, 99] : [70, 88, 99, 104, 113, 113];
  const showFeas = m === 'penalty';
  const X = (g) => 66 + (780 - 66) * g / 15, Y = (v) => 138 - (138 - 28) * v / 160;
  const path = (a) => a.map((v, k) => `${k ? 'L' : 'M'}${X(k)},${Y(v)}`).join(' ');
  const ticks = [0, 40, 80, 123, 160].map((v) => `<line class="gr" x1="66" x2="780" y1="${Y(v)}" y2="${Y(v)}"/><text x="58" y="${Y(v) + 6}" text-anchor="end">${v}</text>`).join('');
  const xt = [0, 3, 6, 9, 12, 15].map((g) => `<text x="${X(g)}" y="160" text-anchor="middle">${g}</text>`).join('');
  const fit = `<svg viewBox="0 0 800 188" width="100%"><g>${ticks}${xt}<line x1="66" x2="780" y1="${Y(OPT)}" y2="${Y(OPT)}" stroke="var(--ink2)" stroke-dasharray="2 5"/><text x="780" y="${Y(OPT) - 6}" text-anchor="end" style="font-size:16px">optimum ${OPT}</text>
   <path d="${path(avg)}" fill="none" stroke="var(--s1)" stroke-width="2.5"/><path d="${path(so)}" fill="none" stroke="var(--s3)" stroke-width="2.5" stroke-dasharray="7 4"/><path d="${path(best)}" fill="none" stroke="var(--s2)" stroke-width="2.5"/>
   ${showFeas ? `<path d="${path(feasSo)}" fill="none" stroke="var(--ink)" stroke-width="3" stroke-dasharray="2 4"/>${gens.map((g) => `<path d="M${X(g)},${Y(feasSo[g]) - 8} l7,8 l-7,8 l-7,-8 z" fill="var(--surface)" stroke="var(--ink)" stroke-width="2.5"/>`).join('')}` : ''}
   ${gens.map((g) => `<circle cx="${X(g)}" cy="${Y(avg[g])}" r="5" fill="var(--s1)"/><rect x="${X(g) - 5}" y="${Y(best[g]) - 5}" width="10" height="10" fill="var(--s2)"/>`).join('')}
   <line x1="${X(5)}" x2="${X(5)}" y1="28" y2="138" stroke="var(--ink)" stroke-width="2"/><text class="ink" x="${X(5)}" y="20" text-anchor="middle" style="font-weight:700;font-size:16px">now</text></g></svg>`;
  const div = [0.52, 0.5, 0.46, 0.43, 0.38, 0.35];
  const X2 = (g) => 56 + (500 - 56) * g / 15, Y2 = (v) => 138 - 110 * v;
  const dv = `<svg viewBox="0 0 520 188" width="100%">${[0, 0.5, 1].map((v) => `<line class="gr" x1="56" x2="500" y1="${Y2(v)}" y2="${Y2(v)}"/><text x="48" y="${Y2(v) + 6}" text-anchor="end">${v}</text>`).join('')}${[0, 3, 6, 9, 12, 15].map((g) => `<text x="${X2(g)}" y="160" text-anchor="middle">${g}</text>`).join('')}
   <path d="${div.map((v, k) => `${k ? 'L' : 'M'}${X2(k)},${Y2(v)}`).join(' ')}" fill="none" stroke="var(--s7)" stroke-width="2.5"/>${div.map((v, k) => `<circle cx="${X2(k)}" cy="${Y2(v)}" r="5" fill="var(--s7)"/>`).join('')}<line x1="${X2(5)}" x2="${X2(5)}" y1="28" y2="138" stroke="var(--ink)" stroke-width="2"/></svg>`;
  const rs = pop(m);
  const rate = NAMES.map((_, i) => rs.filter((r) => r.genes[i] === 1).length / rs.length);
  const bars = `<div class="matchbar k12">${NAMES.map((n, i) => `<div class="gene"><div class="bar" style="height:${Math.round(rate[i] * 60) + 4}px"></div><b>${Math.round(rate[i] * 100)}%</b><span>${n}</span></div>`).join('')}</div>`;
  const feas = rs.filter((r) => r.feasible).length;
  return `<section class="panel plot abs" style="left:24px;top:758px;width:820px;height:244px"><div class="ph"><h2>Fitness</h2><span class="r legend"><b>●</b> average &nbsp;<b>■</b> best of gen. &nbsp;<b>▲</b> best so far${showFeas ? ' &nbsp;<b>◇</b> best <u>feasible</u> so far' : ''}</span></div>${fit}</section>
  <section class="panel plot abs" style="left:860px;top:758px;width:540px;height:244px"><div class="ph"><h2>Diversity</h2><span class="r legend">mean pairwise Hamming, 0–1</span></div>${dv}</section>
  <section class="panel plot abs" style="left:1416px;top:758px;width:480px;height:244px"><div class="ph"><h2>Chosen per item</h2><span class="r legend">${feas} of ${rs.length} feasible</span></div>${bars}<p class="summary" style="margin:6px 16px 0;font-size:17px;color:var(--ink2)">generation 5 · share of the population with the item's gene set to 1</p></section>
  ${history}`;
}

/* ---------- stage views ---------- */
function evaluationScreen(menuOpen) {
  const m = state.method, rs = off(m), cur = 3;
  const rows = rs.map((r, i) => {
    const before = evaluate(OFFBITS[i], 'penalty').g; // the genes as mutation left them
    const reveal = i <= cur;
    if (!reveal) return `<tr class="pend"><td><span class="who">O${i + 1}</span></td><td>${cellsOf(evaluate(OFFBITS[i], 'penalty'))}</td><td colspan="4" class="muted">not scored yet</td></tr>`;
    const why = r.notes.length ? r.notes.map((n) => `<div>${esc(n)}</div>`).join('') : m === 'penalty' ? (r.over ? `<div>over by ${r.over}: ${RHO} × ${r.over}</div>` : '<div class="muted">fits: no penalty</div>') : '<div class="muted">everything fits</div>';
    return `<tr class="${i === cur ? 'hl' : ''}"><td><span class="who">${i === cur ? '▸ ' : ''}O${i + 1}</span></td><td>${cellsOf(r, { before })}</td><td class="why">${why}</td><td>${weightCell(r)}</td><td class="num">${r.value}</td>${m === 'penalty' ? `<td class="num">${r.penalty ? '−' + r.penalty : '0'}</td>` : ''}<td class="num strong">${r.fitness}</td></tr>`;
  }).join('');
  const c = rs[cur];
  const expl = {
    decoder: 'First-fit decoder: walk the items A, B, C, … and pack an item if its gene is 1 and it still fits; otherwise skip it and carry on. The chromosome is not changed, and every bag is feasible.',
    penalty: `Penalty: the bag is exactly the genes set to 1. Overweight bags are allowed but pay ρ = ${RHO} per unit of excess weight: fitness = value − penalty.`,
    lamarck: 'Lamarckian repair: while the bag is too heavy, drop the item with the lowest value per weight (ties: the later item). The repaired genes replace the chromosome.',
    baldwin: 'Baldwinian repair: while the bag is too heavy, drop the item with the lowest value per weight (ties: the later item). The chromosome keeps its genes; only the bag and the score use the repaired set.',
  }[m];
  const narr = m === 'penalty'
    ? `Offspring ${cur + 1}: packs ${NAMES.filter((_, i) => c.packed[i]).join(', ')}: weight ${c.weight} of ${CAP}, value ${c.value}${c.over ? `, over by ${c.over} → penalty ${c.penalty}` : ''} → fitness ${c.fitness}`
    : `Offspring ${cur + 1}: ${c.notes.length ? c.notes.join('; ') + '; ' : ''}packs ${NAMES.filter((_, i) => c.packed[i]).join(', ')}: weight ${c.weight} of ${CAP}, value ${c.value} → fitness ${c.fitness}`;
  return `${topbar(4, 4, 5, 'being made · micro-step 4 of 6', menuOpen)}${transport()}
  <section class="panel abs" style="left:24px;top:172px;width:1096px;height:574px"><div class="ph"><h2>Stage 5 · Evaluation of offspring</h2></div><div id="stagebody" style="top:56px"><div class="evaluation"><p class="expl">${expl}</p>
  <div class="mwrap"><table class="mtable etable ktable compact"><thead><tr><th>Offspring</th><th>Chromosome${itemRow()}</th><th>What happened</th><th>Weight</th><th class="num">Value</th>${m === 'penalty' ? '<th class="num">Penalty</th>' : ''}<th class="num">Fitness</th></tr></thead><tbody>${rows}</tbody></table></div>
  <div class="bigwrap"><span class="lbl">Offspring ${cur + 1}</span>${barBig(c)}<span class="legend2">${NAMES.filter((_, i) => c.packed[i]).length} items · weight ${c.weight} of ${CAP}${c.over ? ` · <b>${c.over} over (hatched)</b>` : ''}${c.dropped.length ? ` · repaired from ${evaluate(c.bits, 'penalty').weight}` : ''}</span></div></div></div>
  <div id="narr"><span class="m">Micro-step ${cur + 1} of 6</span><span>${esc(narr)}</span></div></section>
  ${popPanel('Parents · generation 4')}${strip()}`;
}
function repairBefore() {
  // Lamarckian: show the chromosome as mutation left it, and after repair, for one individual
  const bits = OFFBITS[3], before = evaluate(bits, 'penalty'), after = evaluate(bits, 'lamarck');
  return { before, after };
}
function repairScreen() {
  const { before, after } = repairBefore();
  const lam = state.method === 'lamarck';
  return `<div class="beforeafter"><div class="crow"><span class="who">as mutation left it</span>${cellsOf(before)}<span class="muted">weight ${before.weight} of ${CAP}</span></div><div class="crow"><span class="who">after repair</span>${cellsOf(after, { before: before.g })}<span class="muted">weight ${after.weight} of ${CAP} · ${after.notes.join('; ')}</span></div></div>`;
}

/* ---------- drawer ---------- */
function drawer() {
  const m = state.method;
  const row = (i) => `<tr><td><b>${NAMES[i]}</b></td><td><input type="text" value="${i === 5 && state.bad ? 0 : WT[i]}" ${i === 5 && state.bad ? 'class="bad"' : ''}></td><td><input type="text" value="${VAL[i]}"></td><td><button class="btn quiet" style="height:28px;padding:0 6px" aria-label="Remove item ${NAMES[i]}">✕</button></td></tr>`;
  const tbl = (from) => `<table><thead><tr><th></th><th>Weight</th><th>Value</th><th></th></tr></thead><tbody>${[0, 1, 2, 3, 4, 5].map((k) => row(from + k)).join('')}</tbody></table>`;
  const items = `<div class="itemgrid">${tbl(0)}${tbl(6)}</div>`;
  return `<aside class="mockdrawer" id="drawer"><div class="dh"><h2>Parameters</h2><button class="btn quiet">✕ close</button></div>
  <div class="sec" style="padding-top:4px"><h3>Run setup <span class="tag reset">↺ needs reset</span></h3>
   <div class="ctl"><label>Constraint handling</label><span class="field"><select><option>${METHODS[m].name}</option></select></span><p class="help">${{ decoder: 'Walks the items in order and packs each one that still fits. Always feasible, chromosome unchanged.', penalty: 'Overweight bags are allowed but lose ρ per unit of excess weight.', lamarck: 'Drops the worst value-per-weight items until the bag fits, and writes that back into the chromosome.', baldwin: 'Drops the same items, but the chromosome keeps its genes: only the bag and the score are repaired.' }[m]}</p></div>
   ${m === 'penalty' ? `<div class="ctl"><label>Penalty ρ</label><span class="field"><input type="text" value="${RHO}"></span><p class="help">Fitness lost per unit of weight above the capacity. Too small and an overweight bag can beat the optimum; too large and the search avoids the boundary.</p></div>` : ''}
   <div class="ctl"><label>Capacity</label><span class="field"><input type="text" value="${CAP}"></span><p class="help">At most the total weight (97).</p></div>
   <div class="itemtable"><div class="chead">Items (2 to 20)</div>${items}<button class="btn" style="margin-top:6px;height:36px">+ Add item</button></div>
   ${state.bad ? '<p class="err">Item F: the weight must be a whole number from 1 to 99 (it is 0).</p>' : ''}
   <div class="applyreset"><button class="btn primary" ${state.bad ? 'disabled' : ''}>Apply and restart</button><span class="help">${state.bad ? 'Fix the highlighted fields first.' : 'No setup changes.'}</span></div></div></aside>`;
}

/* ---------- screens ---------- */
const screens = {
  eval() {
    let html = evaluationScreen();
    return html;
  },
  repair() {
    // the same evaluation view, with the before/after pair for the current offspring in the foreground
    return screens.eval();
  },
  menu() {
    return evaluationScreen(true);
  },
  drawer() {
    return `${topbar(4, 4, 5, 'complete · limit 100')}${transport()}<section class="panel abs" style="left:24px;top:172px;width:1096px;height:574px"><div class="ph"><h2>Stage 6 · Replacement</h2></div><div id="stagebody" style="top:56px"><p class="expl">(stage view as before)</p></div></section>${popPanel('Population · generation 5')}${strip()}${drawer()}`;
  },
};

/* ---------- mock controls ---------- */
let state = { s: 'eval', method: 'decoder', v: 'A', plot: 'ok', bad: false, t: 'light', z: 'fit', p: '0' };
function render() {
  const el = document.getElementById('screen');
  el.className = 'var' + state.v + (state.p === '1' ? ' projector' : '');
  el.innerHTML = screens[state.s]();
  document.documentElement.dataset.theme = state.t;
  const sc = state.z === 'fit' ? Math.min(innerWidth / 1920, (innerHeight - 40) / 1080) : 1;
  el.style.transform = `scale(${sc})`;
  document.getElementById('stagewrap').style.height = 1080 * sc + 'px';
  document.getElementById('stagewrap').style.width = 1920 * sc + 'px';
  document.querySelectorAll('#mockbar button').forEach((b) => {
    const d = b.dataset;
    b.classList.toggle('on', d.s === state.s || d.m === state.method || d.v === state.v || d.t === state.t || d.z === state.z || d.p === state.p || (d.plot && d.plot === state.plot) || (d.bad && (d.bad === '1') === state.bad));
  });
}
document.getElementById('mockbar').addEventListener('click', (e) => {
  const d = e.target.dataset; if (!d) return;
  if (d.s) state.s = d.s; if (d.m) state.method = d.m; if (d.v) state.v = d.v; if (d.t) state.t = d.t; if (d.z) state.z = d.z; if (d.p) state.p = d.p; if (d.plot) state.plot = d.plot; if (d.bad) state.bad = d.bad === '1';
  render();
});
addEventListener('resize', render);
const q = new URLSearchParams(location.search);
for (const k of ['s', 'm', 'v', 't', 'z', 'p', 'plot']) if (q.get(k)) state[k === 'm' ? 'method' : k] = q.get(k);
if (q.get('bad')) state.bad = q.get('bad') === '1';
render();
