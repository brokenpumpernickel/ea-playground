/* ===== Trap mock: hand-made data, thrown away after review. Default k = 4, m = 5 (20 genes); stress case k = 8, m = 5 (40 genes). ===== */
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const sum = (a) => a.reduce((t, x) => t + x, 0);
const OPT_MARK = '✓', ATT_MARK = '▽';

/* ---------- the trap ---------- */
const cfgOf = () => (state.stress === '1' ? { k: 8, m: 5 } : state.stress === '2' ? { k: 6, m: 5 } : { k: 4, m: 5 });
const lengthOf = (c) => c.k * c.m;
const blockOf = (g, c) => (state.link === 'tight' ? Math.floor(g / c.k) : g % c.m); // gene index 0-based -> block 0-based
const genesOf = (b, c) => Array.from({ length: lengthOf(c) }, (_, g) => g).filter((g) => blockOf(g, c) === b);
const contribution = (u, k) => (u === k ? k : k - 1 - u);
function blocksOf(bits, c) {
  return Array.from({ length: c.m }, (_, b) => {
    const gs = genesOf(b, c), text = gs.map((g) => bits[g]).join(''), u = [...text].filter((x) => x === '1').length;
    return { b, gs, text, u, score: contribution(u, c.k), state: u === c.k ? 'opt' : u === 0 ? 'att' : 'mid' };
  });
}
const fitnessOf = (bits, c) => sum(blocksOf(bits, c).map((x) => x.score));

/* ---------- hand-made populations ---------- */
const POP4 = ['00001111000000010000', '00000000111000000110', '11110000010000001111', '00000000000010000000', '11111111000000000001', '00010000111100100000'];
function lcg(seed) { let s = seed; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function bigPop() {
  const r = lcg(7);
  return Array.from({ length: 6 }, () => Array.from({ length: 40 }, () => (r() < 0.22 ? '1' : '0')).join(''));
}
const POP8 = bigPop();
const pop = () => (state.stress === '1' ? POP8 : state.stress === '2' ? POP8.map((b) => b.slice(0, 30)) : POP4);
const cross = (a, b, cuts) => { // cuts: 1-based genes after which a cut falls; returns the two children and their sources
  const src = [];
  let flip = false; let ci = 0;
  for (let g = 0; g < a.length; g++) { src.push(flip ? 'B' : 'A'); if (cuts[ci] === g + 1) { flip = !flip; ci++; } }
  const c1 = [...a].map((x, g) => (src[g] === 'A' ? a[g] : b[g])).join('');
  const c2 = [...a].map((x, g) => (src[g] === 'A' ? b[g] : a[g])).join('');
  return { c1, c2, s1: src, s2: src.map((s) => (s === 'A' ? 'B' : 'A')) };
};
const prng = lcg(3);
const draws = (n, flips) => Array.from({ length: n }, (_, g) => (flips.includes(g + 1) ? (0.01 + prng() * 0.04).toFixed(3) : (0.06 + prng() * 0.93).toFixed(3)));

/* ---------- chromosome cells ---------- */
function geometry() { const c = cfgOf(); return c.k * c.m > 20 ? { w: c.k * c.m > 30 ? 14 : 16, h: 24, f: c.k * c.m > 30 ? 12 : 13, gap: 1, bgap: 5 } : { w: 20, h: 28, f: 17, gap: 2, bgap: 6 }; }
function cell(ch, o = {}) {
  const gm = geometry();
  const cls = ['bit', 'g', ch === '1' ? 'one' : '', o.src === 'B' ? 'hatch' : '', o.flip ? 'flip' : '', o.cut ? 'cutafter' : ''].join(' ');
  return `<span class="${cls}" style="width:${gm.w}px;height:${gm.h}px;font-size:${gm.f}px">${ch}${o.below ? `<em class="below">${o.below}</em>` : ''}</span>`;
}
const groupW = (n, extra = 0) => { const g = geometry(); return n * (g.w + extra) + (n - 1) * g.gap; };
/* the block row: printed once above the chromosomes */
function blockRow(extra = 0) {
  const c = cfgOf(), gm = geometry();
  const lab = (b) => `<b>${b + 1}</b>`;
  if (state.link === 'tight' || state.lstyle === 'B') {
    return `<div class="blkhdr"><span class="lbl"><i>block</i></span><span class="blkrow" style="gap:${gm.bgap}px">${Array.from({ length: c.m }, (_, b) => `<span class="brk" style="width:${groupW(c.k, extra)}px">${c.k > 3 ? 'block ' : 'b'}${b + 1}</span>`).join('')}</span></div>`;
  }
  return `<div class="blkhdr"><span class="lbl"><i>block</i></span><span class="blkrow loose" style="gap:${gm.gap}px">${Array.from({ length: lengthOf(c) }, (_, g) => `<span style="width:${gm.w + extra}px" class="bn b${blockOf(g, c) % 2}">${lab(blockOf(g, c))}</span>`).join('')}</span></div>`;
}
/* one chromosome with optional cuts (1-based, genes after which a cut falls), sources and flipped genes; loose style B lists genes block by block */
function chrom(bits, o = {}) {
  const c = cfgOf(), gm = geometry(), cuts = o.cuts || [], flips = o.flips || [], src = o.src;
  const one = (g) => cell(bits[g], { src: src && src[g], flip: flips.includes(g + 1), cut: cuts.includes(g + 1) && !(state.link === 'loose' && state.lstyle === 'B') });
  if (state.link === 'tight') {
    return `<span class="bits grp" style="gap:${gm.bgap}px">${Array.from({ length: c.m }, (_, b) => `<span class="blk" data-b="${b + 1}">${genesOf(b, c).map(one).join('')}</span>`).join('')}</span>`;
  }
  if (state.lstyle === 'B') { // grouped by block; the true positions printed under the genes
    return `<span class="bits grp" style="gap:${gm.bgap}px">${Array.from({ length: c.m }, (_, b) => `<span class="blk">${genesOf(b, c).map((g) => cell(bits[g], { src: src && src[g], flip: flips.includes(g + 1), below: `<u>${g + 1}</u>` })).join('')}</span>`).join('')}</span>`;
  }
  return `<span class="bits" style="gap:${gm.gap}px">${[...bits].map((_, g) => one(g)).join('')}</span>`;
}
/* contributions under a chromosome: under each block (tight and loose-B) or as a line (loose-A) */
function markOf(x) { return x.state === 'opt' ? `${OPT_MARK} ${x.score}` : x.state === 'att' ? `${ATT_MARK} ${x.score}` : `${x.score}`; }
function contribLine(bits) {
  const c = cfgOf(), gm = geometry(), bl = blocksOf(bits, c);
  if (state.link === 'tight' || state.lstyle === 'B') return `<span class="cline grp" style="gap:${gm.bgap}px">${bl.map((x) => `<span class="cb ${x.state}" style="width:${groupW(c.k)}px">${markOf(x)}</span>`).join('')}</span>`;
  return `<span class="cline text">${bl.map((x) => `<span class="cb ${x.state}">block ${x.b + 1}: <b>${markOf(x)}</b></span>`).join('')}</span>`;
}
const decoded = (bits) => blocksOf(bits, cfgOf()).map((x) => x.u).join(' · ');

/* ---------- chrome ---------- */
function topbar(cur, done, gen, line, menuOpen) {
  const stages = ['Selection', 'Pairing', 'Crossover', 'Mutation', 'Evaluation', 'Replacement'], c = cfgOf();
  const menu = menuOpen ? `<ul class="menulist" style="position:absolute;left:68px;top:62px;z-index:60"><li><span>&nbsp;</span> Goldberg x²</li><li><span>&nbsp;</span> Target string</li><li><span>&nbsp;</span> Knapsack</li><li class="cur"><span>✓</span> Trap</li></ul>` : '';
  return `<div id="top"><div id="brand" style="position:relative"><span class="logo" aria-hidden="true">Tr</span><div><div class="trow"><h1 class="t" style="margin:0">Trap ▾</h1><span class="presetchip">${state.link === 'tight' ? 'tight' : 'loose'} linkage</span></div><div class="s">${c.m} blocks of ${c.k} · ${state.link} · optimum ${c.k * c.m}</div></div>${menu}</div>
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
  const c = cfgOf(), rs = pop();
  const head = `<tr><th>#</th><th>Chromosome${blockRow()}</th>${lengthOf(c) > 20 ? '' : '<th>Decoded<span class="colnote">1s per block</span></th>'}<th class="num">Fitness</th></tr>`;
  const rows = rs.map((b, i) => `<tr><td>${i + 1}</td><td class="chr"><div>${chrom(b)}</div><div>${contribLine(b)}</div></td>${lengthOf(c) > 20 ? '' : `<td class="dec">${decoded(b)}</td>`}<td class="num strong">${fitnessOf(b, c)}</td></tr>`).join('');
  const fits = rs.map((b) => fitnessOf(b, c));
  return `<section class="panel abs" style="left:1136px;top:172px;width:760px;height:542px"><div class="ph"><h2>${title}</h2><span class="r">avg ${(sum(fits) / fits.length).toFixed(1)} · best ${Math.max(...fits)} of ${c.k * c.m}</span></div>
  <div class="tablewrap" style="top:50px;padding:0 6px"><table class="ktable compact rt trap"><thead>${head}</thead><tbody>${rows}</tbody></table></div></section>
  <div id="legend" style="left:1136px;top:722px;width:760px"><span><b>${OPT_MARK}</b> block all ones</span><span><b>${ATT_MARK}</b> block all zeros (attractor)</span><span><b>◆</b> parent</span><span><b>◇</b> offspring</span><span><b>✱</b> mutated gene</span></div>`;
}

/* ---------- bottom strip ---------- */
function blockStates() {
  const c = cfgOf(), rs = pop(), n = rs.length;
  const rows = Array.from({ length: c.m }, (_, b) => {
    const st = rs.map((bits) => blocksOf(bits, c)[b].state);
    const o = st.filter((x) => x === 'opt').length, a = st.filter((x) => x === 'att').length, mid = n - o - a;
    const seg = (cls, k) => (k ? `<i class="sg ${cls}" style="flex:${k}"></i>` : '');
    return `<div class="bsrow"><b>block ${b + 1}</b><span class="bsbar">${seg('opt', o)}${seg('mid', mid)}${seg('att', a)}</span><span class="bsnum"><b>${OPT_MARK} ${o}</b> · ${mid} · <b>${ATT_MARK} ${a}</b></span></div>`;
  }).join('');
  return `<div class="bstates">${rows}<div class="bskey"><span><b>${OPT_MARK}</b> all ones</span><span>in between</span><span><b>${ATT_MARK}</b> all zeros</span><span class="muted">of ${n} individuals · now</span></div></div>`;
}
function strip() {
  const c = cfgOf(), OPT = c.k * c.m;
  const gens = [0, 1, 2, 3, 4, 5];
  const best = [14, 15, 15, 16, 16, 16], avg = [10.5, 11.8, 12.4, 13, 13.5, 13.9], so = best;
  const X = (g) => 66 + (780 - 66) * g / 15, Y = (v) => 138 - (138 - 28) * v / 24;
  const path = (a) => a.map((v, k) => `${k ? 'L' : 'M'}${X(k)},${Y(v)}`).join(' ');
  const ticks = [0, 8, 16, 24].map((v) => `<line class="gr" x1="66" x2="780" y1="${Y(v)}" y2="${Y(v)}"/><text x="58" y="${Y(v) + 6}" text-anchor="end">${v}</text>`).join('');
  const xt = [0, 3, 6, 9, 12, 15].map((g) => `<text x="${X(g)}" y="160" text-anchor="middle">${g}</text>`).join('');
  const att = c.m * (c.k - 1);
  const fit = `<svg viewBox="0 0 800 188" width="100%"><g>${ticks}${xt}<line x1="66" x2="780" y1="${Y(OPT)}" y2="${Y(OPT)}" stroke="var(--ink2)" stroke-dasharray="2 5"/><text x="780" y="${Y(OPT) - 6}" text-anchor="end" style="font-size:16px">optimum ${OPT}</text><line x1="66" x2="780" y1="${Y(att)}" y2="${Y(att)}" stroke="var(--ink2)" stroke-dasharray="9 5"/><text x="780" y="${Y(att) + 20}" text-anchor="end" style="font-size:16px">all zeros ${att}</text>
   <path d="${path(avg)}" fill="none" stroke="var(--s1)" stroke-width="2.5"/><path d="${path(so)}" fill="none" stroke="var(--s3)" stroke-width="2.5" stroke-dasharray="7 4"/><path d="${path(best)}" fill="none" stroke="var(--s2)" stroke-width="2.5"/>
   ${gens.map((g) => `<circle cx="${X(g)}" cy="${Y(avg[g])}" r="5" fill="var(--s1)"/><rect x="${X(g) - 5}" y="${Y(best[g]) - 5}" width="10" height="10" fill="var(--s2)"/>`).join('')}
   <line x1="${X(5)}" x2="${X(5)}" y1="28" y2="138" stroke="var(--ink)" stroke-width="2"/><text class="ink" x="${X(5)}" y="20" text-anchor="middle" style="font-weight:700;font-size:16px">now</text></g></svg>`;
  const div = [0.52, 0.47, 0.43, 0.4, 0.36, 0.33];
  const X2 = (g) => 56 + (500 - 56) * g / 15, Y2 = (v) => 138 - 110 * v;
  const dv = `<svg viewBox="0 0 520 188" width="100%">${[0, 0.5, 1].map((v) => `<line class="gr" x1="56" x2="500" y1="${Y2(v)}" y2="${Y2(v)}"/><text x="48" y="${Y2(v) + 6}" text-anchor="end">${v}</text>`).join('')}${[0, 3, 6, 9, 12, 15].map((g) => `<text x="${X2(g)}" y="160" text-anchor="middle">${g}</text>`).join('')}
   <path d="${div.map((v, k) => `${k ? 'L' : 'M'}${X2(k)},${Y2(v)}`).join(' ')}" fill="none" stroke="var(--s7)" stroke-width="2.5"/>${div.map((v, k) => `<circle cx="${X2(k)}" cy="${Y2(v)}" r="5" fill="var(--s7)"/>`).join('')}<line x1="${X2(5)}" x2="${X2(5)}" y1="28" y2="138" stroke="var(--ink)" stroke-width="2"/></svg>`;
  return `<section class="panel plot abs" style="left:24px;top:758px;width:820px;height:244px"><div class="ph"><h2>Fitness</h2><span class="r legend"><b>●</b> average &nbsp;<b>■</b> best of gen. &nbsp;<b>▲</b> best so far</span></div>${fit}</section>
  <section class="panel plot abs" style="left:860px;top:758px;width:540px;height:244px"><div class="ph"><h2>Diversity</h2><span class="r legend">mean pairwise Hamming, 0–1</span></div>${dv}</section>
  <section class="panel plot abs" style="left:1416px;top:758px;width:480px;height:244px"><div class="ph"><h2>Block states</h2><span class="r legend">generation 4</span></div>${blockStates()}<p class="summary" style="margin:2px 16px 0;font-size:15px;color:var(--ink2)">blocks at all zeros, by generation 0–4: 6 · 9 · 13 · 17 · 19</p></section>
  ${history}`;
}

/* ---------- stage views ---------- */
const tabs = (cur) => `<div class="tabs"><span class="tab ${cur === 'stage' ? 'on' : ''}">Stage view</span><span class="tab ${cur === 'schema' ? 'on' : ''}">Schema tracker</span></div>`;
function blockMarks(bits, src) {
  const c = cfgOf(), gm = geometry();
  const verdict = blocksOf(bits, c).map((x) => { const s = new Set(x.gs.map((g) => src[g])); return s.size > 1 ? 'split' : s.has('A') ? 'A' : 'B'; });
  const sym = { A: '● A', B: '▨ B', split: '◧ split' };
  const kept = verdict.filter((v) => v !== 'split').length;
  const line = (state.link === 'tight' || state.lstyle === 'B')
    ? `<span class="cline grp" style="gap:${gm.bgap}px">${verdict.map((v) => `<span class="cb v${v}" style="width:${groupW(c.k)}px">${sym[v]}</span>`).join('')}</span>`
    : `<span class="cline text">${verdict.map((v, b) => `<span class="cb v${v}">block ${b + 1}: <b>${sym[v]}</b></span>`).join('')}</span>`;
  return { line, kept, split: c.m - kept };
}
function crossoverScreen() {
  const c = cfgOf(), p = pop(), n = lengthOf(c);
  const cut = state.link === 'tight' ? Math.round(n / 2) - (c.k > 4 ? 3 : 0) + (c.k > 4 ? 0 : 0) : 9; // a cut inside a block for tight linkage, between genes 9 and 10 for loose
  const cuts = [state.link === 'tight' ? (c.k > 4 ? 18 : 10) : (c.k > 4 ? 18 : 9)];
  const a = p[2], b = p[4], x = cross(a, b, cuts);
  const card = (pair, ra, rb, ch, pending) => {
    if (pending) return `<section class="card ccard pending"><div class="thead"><b>Pair ${pair}</b><span class="muted">not processed yet</span></div></section>`;
    const kids = ch.map((kid, i) => { const m = blockMarks(kid.bits, kid.src); return `<div class="crow2"><div class="chrow"><span class="who">O${i + 1}</span>${chrom(kid.bits, { cuts, src: kid.src })}</div><div class="chrow marks"><span class="who"></span>${m.line}<span class="badge ${m.split ? 'warn' : 'ok'}">${m.kept} whole${m.split ? ` · ${m.split} split` : ''}</span></div></div>`; }).join('');
    return `<section class="card ccard current"><div class="thead"><b>Pair ${pair}</b><span class="badge ok"><span aria-hidden="true">✓</span> recombined</span><span class="muted">u = 0.41 &lt; pc 0.8 → cut after gene ${cuts[0]}</span></div>
      <div class="cbody2"><div class="chrow ctarget"><span class="who"></span>${blockRow()}</div>
      <div class="chrow"><span class="who">A · individual 3</span>${chrom(ra, { cuts })}</div><div class="chrow"><span class="who">B · individual 5</span>${chrom(rb, { cuts, src: [...rb].map(() => 'B') })}</div>
      <div class="chead">Children</div>${kids}</div></section>`;
  };
  const body = `<div class="evaluation"><p class="expl">A block is <b>whole</b> when all its genes come from one parent, and <b>split</b> when the cut falls inside it.</p>
  <div class="cgrid2">${card(1, a, b, [{ bits: x.c1, src: x.s1 }, { bits: x.c2, src: x.s2 }])}${card(2, p[0], p[1], [], true)}</div>
  <p class="key">plain = A · <b>hatched</b> = B · <b>dashed</b> = cut · ● A, ▨ B = block whole from that parent · ◧ = split</p></div>`;
  return `${topbar(2, 2, 5, 'being made · micro-step 1 of 3')}${transport()}<section class="panel abs" style="left:24px;top:172px;width:1096px;height:574px"><div class="ph"><h2>Stage 3 · Crossover</h2></div>${tabs('stage')}<div id="stagebody" style="top:84px">${body}</div>
  <div id="narr"><span class="m">Micro-step 1 of 3</span><span>Pair 1: cut after gene ${cuts[0]} → ${blockMarks(x.c1, x.s1).split} block${blockMarks(x.c1, x.s1).split === 1 ? '' : 's'} split, ${blockMarks(x.c1, x.s1).kept} taken whole</span></div></section>
  ${popPanel('Parents · generation 4')}${strip()}`;
}
function mutationScreen() {
  const c = cfgOf(), p = pop(), n = lengthOf(c);
  const cuts = [state.link === 'tight' ? (c.k > 4 ? 18 : 10) : (c.k > 4 ? 18 : 9)];
  const x = cross(p[2], p[4], cuts);
  // O1: two flips that change contributions; O2: two flips inside one block that cancel (u unchanged)
  const find = (bits, wantSame) => { // pick two flipped genes in one block: a 1 and a 0 (u unchanged) or two 0s
    const bl = blocksOf(bits, c).find((x2) => x2.text.includes('1') && x2.text.includes('0') && x2.u !== c.k);
    const ones = bl.gs.filter((g) => bits[g] === '1'), zeros = bl.gs.filter((g) => bits[g] === '0');
    return wantSame ? [ones[0] + 1, zeros[0] + 1].sort((a, b) => a - b) : [zeros[0] + 1, zeros[1] + 1].sort((a, b) => a - b);
  };
  const rows = [x.c1, p[5]].map((bits, i) => {
    const flips = find(bits, i === 1), after = [...bits].map((ch, g) => (flips.includes(g + 1) ? (ch === '1' ? '0' : '1') : ch)).join('');
    const bb = blocksOf(bits, c), ba = blocksOf(after, c);
    const changed = bb.filter((x2, b) => x2.score !== ba[b].score).map((x2, _, arr) => `block ${x2.b + 1}: ${x2.text} → ${ba[x2.b].text} · ${x2.score} → ${ba[x2.b].score}`);
    const touched = [...new Set(flips.map((g) => blockOf(g - 1, c) + 1))];
    const note = changed.length ? changed.map((t) => `<span class="badge flip">✱ ${t}</span>`).join('') : `<span class="badge quiet">flips inside block ${touched.join(', ')} cancel: ${touched.length === 1 ? `1s in the block unchanged (${bb[touched[0] - 1].u}), ` : ''}contribution unchanged</span>`;
    const d = draws(n, flips).map((t, g) => (n > 20 && !flips.includes(g + 1) ? '' : t));
    return { bits, after, flips, note, d, fit: [fitnessOf(bits, c), fitnessOf(after, c)] };
  });
  const gc = (r, g) => `<span class="gcell"><span class="bit g ${r.bits[g] === '1' ? 'one' : ''} ${r.flips.includes(g + 1) ? 'flip' : ''}" style="width:${geometry().w + 4}px;height:${geometry().h}px;font-size:${geometry().f}px">${r.bits[g]}</span><span class="under ${r.flips.includes(g + 1) ? 'flag' : ''}">${r.d[g].slice(1)}</span></span>`;
  const mcells = (r) => (state.link === 'tight' ? Array.from({ length: c.m }, (_, b) => `<span class="blk">${genesOf(b, c).map((g) => gc(r, g)).join('')}</span>`).join('') : [...r.bits].map((_, g) => gc(r, g)).join(''));
  const card = (r, i) => `<section class="card mcard ${i === 1 ? 'current' : ''}"><div class="crow"><span class="who">O${i + 1}</span><span class="bits ${state.link === 'tight' ? 'grp' : ''}" style="gap:${state.link === 'tight' ? geometry().bgap : 2}px">${mcells(r)}</span></div>
    <div class="crow res"><span class="who sub">result</span>${chrom(r.after, { flips: r.flips })}<span class="muted">fitness ${r.fit[0]} → ${r.fit[1]}</span></div><div class="crow"><span class="who"></span>${r.note}</div></section>`;
  const body = `<div class="mutation"><p class="expl">Every gene of every offspring gets its own draw u; the gene flips if u &lt; pm (0.05). A flip changes its block's contribution only if it changes how many genes of the block are 1.${n > 20 ? ` <i>With ${n} genes only the draws that flipped a gene are printed under it; every other draw was ≥ pm (see the history).</i>` : ''}</p>${blockRow(4)}<div class="mcards2">${rows.map(card).join('')}</div></div>`;
  return `${topbar(3, 3, 5, 'being made · micro-step 2 of 6')}${transport()}<section class="panel abs" style="left:24px;top:172px;width:1096px;height:574px"><div class="ph"><h2>Stage 4 · Mutation</h2></div>${tabs('stage')}<div id="stagebody" style="top:84px">${body}</div>
  <div id="narr"><span class="m">Micro-step 2 of 6</span><span>Offspring 2: genes ${rows[1].flips.join(' and ')} drew below pm 0.05 → flipped; ${rows[1].note.includes('cancel') ? 'the block still has the same number of 1s, so fitness stays ' + rows[1].fit[0] : 'fitness ' + rows[1].fit[0] + ' → ' + rows[1].fit[1]}</span></div></section>
  ${popPanel('Parents · generation 4')}${strip()}`;
}
function schemaScreen() {
  const c = cfgOf();
  const schema = '1111' + '*'.repeat(c.k * c.m - 4);
  const counts = [1, 1, 2, 2, 3, 3], inst = [16, 16, 16.5, 17, 17.3, 17.3], popm = [10.5, 11.8, 12.4, 13, 13.5, 13.9];
  const X = (g) => 70 + 520 * g / 5, Y = (v) => 170 - 140 * v / 20;
  const bars = counts.map((v, g) => `<rect x="${X(g) - 22}" y="${170 - v * 24}" width="44" height="${v * 24}" fill="var(--seq3)"/><text x="${X(g)}" y="${164 - v * 24}" text-anchor="middle" style="font-size:18px;font-weight:700">${v}</text><text x="${X(g)}" y="192" text-anchor="middle" style="font-size:16px">${g}</text>`).join('');
  const line = (a, st, dash) => `<path d="${a.map((v, k) => `${k ? 'L' : 'M'}${X(k)},${Y(v)}`).join(' ')}" fill="none" stroke="${st}" stroke-width="3" ${dash ? `stroke-dasharray="${dash}"` : ''}/>`;
  const lines = `${[0, 10, 20].map((v) => `<line class="gr" x1="70" x2="590" y1="${Y(v)}" y2="${Y(v)}"/><text x="62" y="${Y(v) + 6}" text-anchor="end">${v}</text>`).join('')}${line(inst, 'var(--s2)')}${line(popm, 'var(--s1)', '7 4')}${[0, 1, 2, 3, 4, 5].map((g) => `<rect x="${X(g) - 5}" y="${Y(inst[g]) - 5}" width="10" height="10" fill="var(--s2)"/><circle cx="${X(g)}" cy="${Y(popm[g])}" r="5" fill="var(--s1)"/><text x="${X(g)}" y="192" text-anchor="middle" style="font-size:16px">${g}</text>`).join('')}`;
  const body = `<div class="schema"><p class="expl">A schema fixes some genes and leaves the others free: <b>1</b> = the gene must be 1, <b>0</b> = it must be 0, <b>*</b> = anything. An individual is an <i>instance</i> of a schema if it matches every fixed gene.</p>
   <div class="srow"><label for="sch">Schema (${lengthOf(c)} symbols)</label><input id="sch" type="text" value="${schema}" style="width:${lengthOf(c) * 15 + 20}px"><button class="btn quiet">Block 1 solved</button><button class="btn quiet">Block 2 solved</button><button class="btn quiet">…</button></div>
   <div class="sfacts"><span><b>order</b> 4 <i>(fixed genes)</i></span><span><b>defining length</b> 3 <i>(distance between the outermost fixed genes)</i></span></div>
   <div class="scharts"><div><h3>Instances in the population</h3><svg viewBox="0 0 620 210" width="520">${bars}</svg></div><div><h3>Mean fitness: <b style="color:var(--s2)">■</b> of instances · <b style="color:var(--s1)">●</b> whole population</h3><svg viewBox="0 0 620 210" width="520">${lines}</svg></div></div>
   <p class="sum"><b>Generation 4:</b> 3 of 6 individuals are instances of <code>${schema}</code> (1 in generation 0). Their mean fitness is 17.3, above the population mean 13.9.</p>
   <p class="caveat">One run illustrates a tendency; it proves nothing. Instances may become more common or rarer in the next run with another seed.</p></div>`;
  return `${topbar(5, 5, 5, 'complete · limit 100')}${transport()}<section class="panel abs" style="left:24px;top:172px;width:1096px;height:574px"><div class="ph"><h2>Schema tracker</h2></div>${tabs('schema')}<div id="stagebody" style="top:84px">${body}</div></section>${popPanel('Population · generation 4')}${strip()}`;
}

/* ---------- drawer ---------- */
function drawer() {
  const c = cfgOf(), bad = state.bad;
  const k = bad ? 8 : c.k, m = bad ? 6 : c.m;
  return `<aside class="mockdrawer" id="drawer"><div class="dh"><h2>Parameters</h2><button class="btn quiet">✕ close</button></div>
  <div class="sec" style="padding-top:4px"><h3>Run setup <span class="tag reset">↺ needs reset</span></h3>
   <div class="ctl"><label>Block size k</label><span class="field"><input type="text" value="${k}"></span><p class="help">Genes per block, 2 to 8.</p></div>
   <div class="ctl"><label>Number of blocks m</label><span class="field"><input type="text" value="${m}"></span><p class="help">1 to 10 blocks, at most 40 genes in all (${k} × ${m} = ${k * m}).</p></div>
   <div class="ctl"><label>Linkage</label><span class="field"><select><option>${state.link === 'tight' ? 'Tight: a block’s genes sit side by side' : 'Loose: the blocks are interleaved'}</option></select></span><p class="help">${state.link === 'tight' ? 'Block 1 is genes 1–4, block 2 genes 5–8, …' : 'Block 1 is genes 1, 6, 11, 16; block 2 is genes 2, 7, 12, 17, …  A cut then falls inside almost every block.'}</p></div>
   <div class="trapdef"><b>The trap.</b> With u = the number of 1s in a block of k genes, the block scores <b>k</b> when u = k and <b>k − 1 − u</b> otherwise (Deb and Goldberg’s k-bit trap): 1111 → 4, 0000 → 3, 1000 → 2, 1100 → 1, 1110 → 0. Every block pulls toward 0000 although 1111 is best. Optimum ${k * m}; all zeros scores ${m * (k - 1)}.</div>
   ${bad ? `<p class="err">Block size × blocks: at most 40 genes in all (${k} × ${m} = ${k * m}).</p>` : ''}
   <div class="applyreset"><button class="btn primary" ${bad ? 'disabled' : ''}>Apply and restart</button><span class="help">${bad ? 'Fix the highlighted fields first.' : 'No setup changes.'}</span></div></div></aside>`;
}

/* ---------- screens ---------- */
const screens = {
  cross: crossoverScreen,
  mut: mutationScreen,
  schema: schemaScreen,
  menu() { return crossoverScreen().replace(/<div id="top"><div id="brand" style="position:relative">(.*?)<\/div><\/div>/, (m0) => m0).replace('<span class="logo"', `<ul class="menulist" style="position:absolute;left:68px;top:62px;z-index:60"><li><span>&nbsp;</span> Goldberg x²</li><li><span>&nbsp;</span> Target string</li><li><span>&nbsp;</span> Knapsack</li><li class="cur"><span>✓</span> Trap</li></ul><span class="logo"`); },
  drawer() { return `${topbar(5, 5, 5, 'complete · limit 100')}${transport()}<section class="panel abs" style="left:24px;top:172px;width:1096px;height:574px"><div class="ph"><h2>Stage 6 · Replacement</h2></div><div id="stagebody" style="top:56px"><p class="expl">(stage view as before)</p></div></section>${popPanel('Population · generation 5')}${strip()}${drawer()}`; },
  table() { return `${topbar(5, 5, 5, 'complete · limit 100')}${transport()}<section class="panel abs" style="left:24px;top:172px;width:1096px;height:574px"><div class="ph"><h2>Population · generation 4</h2></div><div id="stagebody" style="top:56px"><div class="mwrap"><table class="mtable ktable trap wide"><thead><tr><th>#</th><th>Chromosome${blockRow()}</th><th>Decoded</th><th class="num">Fitness</th></tr></thead><tbody>${pop().map((b, i) => `<tr><td>${i + 1}</td><td class="chr"><div>${chrom(b)}</div><div>${contribLine(b)}</div></td><td class="dec">${decoded(b)}</td><td class="num strong">${fitnessOf(b, cfgOf())}</td></tr>`).join('')}</tbody></table></div></div></section>${popPanel('Population · generation 4')}${strip()}`; },
};

/* ---------- mock controls ---------- */
let state = { s: 'cross', link: 'tight', lstyle: 'A', stress: '0', t: 'light', z: 'fit', p: '0', bad: false };
function render() {
  const el = document.getElementById('screen');
  el.className = 'ls' + state.lstyle + (state.p === '1' ? ' projector' : '');
  el.innerHTML = screens[state.s]();
  document.documentElement.dataset.theme = state.t;
  const sc = state.z === 'fit' ? Math.min(innerWidth / 1920, (innerHeight - 40) / 1080) : 1;
  el.style.transform = `scale(${sc})`;
  document.getElementById('stagewrap').style.height = 1080 * sc + 'px';
  document.getElementById('stagewrap').style.width = 1920 * sc + 'px';
  document.querySelectorAll('#mockbar button').forEach((b) => {
    const d = b.dataset;
    b.classList.toggle('on', d.s === state.s || d.l === state.link || d.ls === state.lstyle || d.x === state.stress || d.t === state.t || d.z === state.z || d.p === state.p || (d.bad && (d.bad === '1') === state.bad));
  });
}
document.getElementById('mockbar').addEventListener('click', (e) => {
  const d = e.target.dataset; if (!d) return;
  if (d.s) state.s = d.s; if (d.l) state.link = d.l; if (d.ls) state.lstyle = d.ls; if (d.x) state.stress = d.x; if (d.t) state.t = d.t; if (d.z) state.z = d.z; if (d.p) state.p = d.p; if (d.bad) state.bad = d.bad === '1';
  render();
});
addEventListener('resize', render);
const q = new URLSearchParams(location.search);
for (const k of ['s', 't', 'z', 'p']) if (q.get(k)) state[k] = q.get(k);
if (q.get('l')) state.link = q.get('l'); if (q.get('ls')) state.lstyle = q.get('ls'); if (q.get('x')) state.stress = q.get('x');
if (q.get('bad')) state.bad = q.get('bad') === '1';
render();
