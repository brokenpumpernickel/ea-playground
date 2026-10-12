src = open('.scratch/milestone-2-target-string-and-links/mock/index.html', encoding='utf8').read()
head = src[: src.index('</style>')]
head = head.replace('Target string – design mock (throwaway)', 'Landscape – design mock (throwaway)')
js = open('.scratch/milestone-5-landscape/mock/landscape.js', encoding='utf8').read()

css = """
/* ---------- new for the landscape ---------- */
.presetchip { margin-left:14px; font-size:17px; background:var(--chip); color:var(--ink2); border-radius:999px; padding:2px 12px; vertical-align:middle; font-weight:600; }
.menulist { list-style:none; margin:0; padding:6px; min-width:260px; background:var(--surface); border:2px solid var(--ink); border-radius:10px; box-shadow:0 12px 30px rgba(0,0,0,.25); font-size:22px; font-weight:600; }
.menulist li { padding:8px 12px; border-radius:8px; display:flex; gap:10px; }
.menulist li.cur { font-weight:800; background:var(--acc-tint); }
.menulist li span { width:1.2em; }
.tabs { position:absolute; left:16px; top:48px; display:flex; gap:6px; }
.tabs .tab { padding:3px 14px; border:2px solid var(--line, var(--ink2)); border-radius:10px; font-size:17px; font-weight:600; color:var(--ink2); }
.tabs .tab.on { border-color:var(--acc); background:var(--acc-tint); color:var(--ink); }
.ktable td { padding-top:3px; padding-bottom:3px; vertical-align:middle; }
.ktable th, .ktable td { padding-left:6px; padding-right:6px; }
.ktable .num { text-align:right; font-variant-numeric:tabular-nums; }
.ktable .num.strong { font-weight:800; }
.ktable .colnote { display:block; font-size:13px; font-weight:400; text-transform:none; letter-spacing:0; color:var(--ink2); }
.ktable tr.sel td { background:var(--acc-tint); }
.ktable td.pair .xy { font-size:20px; font-variant-numeric:tabular-nums; white-space:nowrap; }
.xy.big { font-size:22px; font-variant-numeric:tabular-nums; } .xy b { font-weight:700; } .xy b.fl { color:var(--flip-ink); }
.ktable td, .ktable th { font-size:18px; }
.varhdr { display:flex; gap:10px; margin-top:2px; text-transform:none; letter-spacing:0; font-weight:400; }
.varhdr .vg { text-align:center; font-size:13px; font-weight:700; color:var(--ink); border-bottom:3px solid var(--ink2); padding-bottom:1px; }
.bits.grp2 { display:inline-flex; gap:10px; }
.vgrp { display:inline-flex; gap:1px; position:relative; }
.vgrp::before { content:""; position:absolute; left:-1px; right:-1px; top:-5px; height:4px; border:2px solid var(--ink2); border-bottom:none; border-radius:4px 4px 0 0; }
.bit.v { width:17px; height:24px; font-size:13px; border-radius:5px; display:inline-flex; align-items:center; justify-content:center; }
.bit.v.sm { width:20px; height:26px; font-size:15px; }
.bits.inl { display:inline-flex; gap:2px; margin-left:8px; vertical-align:middle; }
/* the landscape view */
.lview { display:flex; flex-direction:column; gap:6px; height:100%; }
.lbar { display:flex; align-items:center; gap:22px; flex-wrap:wrap; font-size:15px; }
.lgrp { display:inline-flex; gap:6px; align-items:center; } .lgrp.key { color:var(--ink2); font-size:14px; }
.tog { padding:1px 10px; border:2px solid var(--ink2); border-radius:8px; font-size:14px; font-weight:600; background:var(--surface); }
.tog.on { background:var(--acc-tint); border-color:var(--acc); }
.lplots { display:flex; gap:16px; } .lplots figure { margin:0; } .lplots figcaption { font-size:15px; font-weight:600; margin-bottom:2px; } .lplots figcaption i { font-weight:400; color:var(--ink2); }
.lplots canvas { border:2px solid var(--line, var(--ink2)); border-radius:8px; display:block; }
.lkey { margin:0; font-size:13px; color:var(--ink2); } .lkey .selk { color:var(--flip-ink); font-weight:700; }
.lsent { margin:2px 0 0; font-size:14px; color:var(--ink2); line-height:1.25; }
/* operator cards */
.cardwrap { display:flex; flex-direction:column; gap:6px; }
.card.ccard, .card.mcard { border:2px solid var(--line, var(--ink2)); border-radius:16px; padding:6px 14px; background:var(--surface); }
.card.current { border-color:var(--acc); box-shadow:0 0 0 3px var(--acc-tint); }
.card .thead { display:flex; align-items:center; gap:12px; font-size:18px; }
.gene { margin-top:4px; } .gene .gl { font-size:16px; } .gene .gd { font-size:16px; } .nline text { fill:var(--ink); }
.clamp { color:var(--flip-ink); font-weight:700; }
.atab { border-collapse:collapse; font-size:16px; margin:4px 0; } .atab th, .atab td { padding:2px 12px 2px 0; text-align:left; font-variant-numeric:tabular-nums; white-space:nowrap; } .atab th { font-weight:600; color:var(--ink2); font-size:14px; }
.atab tr.ch td { font-weight:700; } .atab td.sw { background:var(--flip-bg); color:var(--flip-ink); font-weight:800; } .atab td.big { color:var(--flip-ink); font-weight:800; }
.atab.mt td { font-size:15px; padding-right:14px; } .atab tr.flipcell td { background:var(--flip-bg); }
.crow { display:flex; align-items:center; gap:12px; } .crow .who { width:60px; font-weight:700; font-size:20px; } .crow .who.sub { font-weight:400; font-size:15px; } .crow.res { margin-top:6px; }
.badge.flip { border-color:var(--flip); background:var(--flip-bg); color:var(--flip-ink); }
.fliptab { margin:4px 0; } .fliptab .gl { font-size:16px; }
/* spread panel */
.spreadp { padding:2px 16px 0; font-size:15px; }
.sprow { display:grid; grid-template-columns:24px 1fr 150px; gap:8px; align-items:center; height:24px; }
.spbar { height:16px; border:2px solid var(--ink2); border-radius:5px; background:var(--surface); display:block; } .spbar i { display:block; height:100%; background:var(--seq3); }
.spn { text-align:right; color:var(--ink2); } .spkey { color:var(--ink2); font-size:13px; margin-top:2px; } .sphist { font-size:13px; color:var(--ink2); margin-top:2px; font-variant-numeric:tabular-nums; }
.mockdrawer .err { color:var(--flip-ink); font-weight:600; }
"""

bar = """
</style>
</head>
<body>
<div id="mockbar">
  <b>Landscape mock</b>
  <button data-s="land">Landscape view</button>
  <button data-s="cross">Crossover (real)</button>
  <button data-s="mut">Mutation (real)</button>
  <button data-s="bin">Mutation (binary-coded)</button>
  <button data-s="menu">Menu</button>
  <button data-s="drawer">Drawer</button>
  <span class="sep"></span>
  <button data-fn="single">Single peak</button><button data-fn="two">Two peaks</button><button data-fn="rastrigin">Rastrigin</button><button data-fn="himmel">Himmelblau</button>
  <span class="sep"></span>
  <button data-rep="real">Real</button><button data-rep="plain">Plain binary</button><button data-rep="gray">Gray</button>
  <span class="sep"></span>
  <button data-op="blx">BLX-α</button><button data-op="arith">Arithmetic</button><button data-op="disc">Discrete</button>
  <span class="sep"></span>
  <button data-trail="0">No trails</button><button data-trail="3">3 gens</button><button data-trail="5">5 gens</button>
  <button data-mark="none">No stage marks</button><button data-mark="parents">Parents</button><button data-mark="children">Children</button><button data-mark="mutation">Mutated child</button>
  <button data-n="12">12</button><button data-n="60">60</button>
  <span class="sep"></span>
  <button data-az="-0.35" data-el="0">◀</button><button data-az="0.35" data-el="0">▶</button><button data-az="0" data-el="0.2">▲</button><button data-az="0" data-el="-0.2">▼</button>
  <button data-bad="0">Drawer ok</button><button data-bad="1">Restart notice</button>
  <button data-t="light">Light</button><button data-t="dark">Dark</button>
  <button data-z="fit">Fit</button><button data-z="1">100%</button>
  <button data-p="0">Normal</button><button data-p="1">Projector</button>
</div>
<div id="stagewrap"><div id="screen"></div></div>
<script>
"""

open('.scratch/milestone-5-landscape/mock/index.html', 'w', encoding='utf8', newline='\n').write(head + css + bar + js + '\n</script>\n</body>\n</html>\n')
print('written')
