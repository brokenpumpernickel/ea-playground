import re

src = open('.scratch/milestone-2-target-string-and-links/mock/index.html', encoding='utf8').read()
head = src[: src.index('</style>')]
head = head.replace('Target string – design mock (throwaway)', 'Knapsack – design mock (throwaway)')
js = open('.scratch/milestone-3-knapsack/mock/knapsack.js', encoding='utf8').read()

css = """
/* ---------- new for the knapsack ---------- */
.presetchip { margin-left:14px; font-size:17px; background:var(--chip); color:var(--ink2); border-radius:999px; padding:2px 12px; vertical-align:middle; font-weight:600; }
.menulist { list-style:none; margin:0; padding:6px; min-width:260px; background:var(--surface); border:2px solid var(--ink); border-radius:10px; box-shadow:0 12px 30px rgba(0,0,0,.25); font-size:22px; font-weight:600; }
.menulist li { padding:8px 12px; border-radius:8px; display:flex; gap:10px; }
.menulist li.cur { font-weight:800; background:var(--acc-tint); }
.menulist li span { width:1.2em; }
.ktable td { height:38px; padding-top:1px; padding-bottom:1px; }
.ktable .bit.sm { width:26px; height:32px; font-size:19px; border-radius:8px; }
.ktable .num.strong { font-weight:800; }
.ktable tr.pend td { opacity:.6; }
.ktable .colnote { display:block; font-size:13px; font-weight:400; text-transform:none; letter-spacing:0; color:var(--ink2); }
.itemhdr { display:flex; align-items:flex-end; margin-top:2px; text-transform:none; letter-spacing:0; font-weight:400; }
.itemhdr .lbl { display:flex; flex-direction:column; align-items:flex-end; margin-right:6px; font-size:12px; color:var(--ink2); }
.itemhdr .lbl i { display:block; height:17px; line-height:17px; font-style:normal; }
.itemrow { display:inline-flex; gap:3px; }
.itemrow span { display:inline-flex; flex-direction:column; align-items:center; width:26px; }
.itemrow b { height:17px; line-height:17px; font-size:16px; color:var(--ink); font-family:ui-monospace,Consolas,monospace; }
.itemrow u, .itemrow s { height:17px; line-height:17px; font-size:14px; text-decoration:none; color:var(--ink2); font-variant-numeric:tabular-nums; }
.itemrow s { font-style:italic; }
.bits.tight { gap:3px; }
.compact .bit.sm { width:23px; height:30px; font-size:17px; border-radius:7px; }
.compact .bits.tight, .compact .itemrow { gap:2px; }
.compact .itemrow span { width:23px; }
.compact .itemrow b { font-size:15px; } .compact .itemrow u, .compact .itemrow s { font-size:13px; }
/* a gene that is 1 but not in the bag: two proposals */
.varA .bit.skip { border-style:dashed; background-color:color-mix(in srgb, var(--one-bg) 50%, transparent); border-color:var(--one-line); color:var(--one-ink); }
.varA .bit.skip .sx { display:none; }
.varA .bit.skip .sk { font-style:normal; text-decoration:line-through; text-decoration-thickness:2px; }
.varB .bit.skip { border-style:dashed; background:transparent; border-color:var(--ink2); }
.varB .bit.skip .sk { display:none; }
.varB .bit.skip .sx { font-style:normal; font-size:17px; color:var(--flip-ink); }
/* a gene dropped by Lamarckian repair (now 0) */
.bit.cut { border-style:dotted; border-color:var(--flip); border-width:3px; position:relative; }
.bit.cut::after { content:"✂"; position:absolute; top:-17px; left:50%; transform:translateX(-50%); color:var(--flip); font-size:17px; }
/* capacity bars */
.capbar { position:relative; display:inline-block; width:60px; height:14px; border:2px solid var(--ink2); border-radius:3px; vertical-align:middle; background:var(--surface); }
.capbar i { position:absolute; top:0; bottom:0; }
.capbar .fill { left:0; background:var(--seq4); }
.capbar .over { background:repeating-linear-gradient(135deg, var(--flip) 0 3px, transparent 3px 6px); }
.capbar .cap { width:2px; background:var(--ink); top:-5px; bottom:-5px; }
.wcell { display:inline-flex; align-items:center; gap:8px; white-space:nowrap; }
.wnum { font-variant-numeric:tabular-nums; min-width:44px; font-size:16px; }
.okm { color:var(--good); } .overm { color:var(--flip-ink); font-size:18px; }
.bigwrap { display:flex; align-items:center; gap:14px; margin-top:36px; }
.bigwrap .lbl { font-weight:700; white-space:nowrap; }
.bigwrap .legend2 { white-space:nowrap; font-size:18px; color:var(--ink2); }
.bigbar { position:relative; flex:1; height:34px; border:2px solid var(--ink2); border-radius:6px; background:var(--surface); }
.bigbar .seg { position:absolute; top:0; bottom:0; background:var(--seq3); border-right:2px solid var(--surface); display:flex; align-items:center; justify-content:center; color:#fff; font-size:16px; overflow:hidden; }
.bigbar .seg.ov { background:repeating-linear-gradient(135deg, var(--flip) 0 4px, var(--surface) 4px 8px); color:var(--ink); }
.bigbar .capline { position:absolute; top:-9px; bottom:-9px; width:3px; background:var(--ink); }
.bigbar .captxt { position:absolute; top:-32px; transform:translateX(-50%); font-size:15px; color:var(--ink2); white-space:nowrap; }
.ktable td.why { font-size:15px; line-height:1.15; color:var(--ink2); white-space:nowrap; }
.matchbar.k12 { gap:3px; padding:6px 10px 0; }
.matchbar.k12 .gene b { font-size:13px; }
.matchbar.k12 .gene span { font-size:17px; }
.ktable th, .ktable td { padding-left:5px; padding-right:5px; }
.ktable .num { width:62px; }
.ktable .wcell { gap:5px; }
.rt .capbar { width:40px; }
.ktable th { font-size:16px; }
.ktable td.why { font-size:14px; }
.beforeafter { margin-top:6px; padding:6px 10px; border:2px solid var(--acc); border-radius:12px; }
.beforeafter .crow { display:flex; align-items:center; gap:12px; min-height:46px; }
.beforeafter .who { width:150px; font-size:16px; color:var(--ink2); }
.itemtable table { font-size:16px; border-collapse:collapse; width:auto; } .itemtable td, .itemtable th { padding:0 14px 0 0; height:30px; border:none; text-align:left; } .itemtable tr { border:none; } .itemtable thead th { font-size:14px; }
.itemgrid { display:flex; gap:26px; } #drawer .itemtable input[type=text] { width:62px; height:28px; padding:0 8px; font-size:17px; }
.itemtable input { width:66px; height:28px; text-align:right; font:inherit; border:2px solid var(--ink2); border-radius:6px; background:var(--surface); color:var(--ink); }
.itemtable input.bad { border-color:var(--flip); background:var(--flip-bg); }
.mockdrawer .err { color:var(--flip-ink); font-weight:600; margin:4px 0 0; font-size:17px; }
"""

bar = """
</style>
</head>
<body>
<div id="mockbar">
  <b>Knapsack mock</b>
  <button data-s="eval">Evaluation + population</button>
  <button data-s="menu">Problem menu</button>
  <button data-s="drawer">Drawer: setup</button>
  <span class="sep"></span>
  <button data-m="decoder">First-fit decoder</button>
  <button data-m="penalty">Penalty</button>
  <button data-m="lamarck">Repair: Lamarckian</button>
  <button data-m="baldwin">Repair: Baldwinian</button>
  <span class="sep"></span>
  <button data-v="A">Not-packed mark A: struck 1</button>
  <button data-v="B">Not-packed mark B: ✕ in a dashed cell</button>
  <span class="sep"></span>
  <button data-plot="ok">Plot: ρ sensible</button>
  <button data-plot="small">Plot: ρ too small</button>
  <button data-bad="0">Drawer ok</button><button data-bad="1">Drawer error</button>
  <span class="sep"></span>
  <button data-t="light">Light</button><button data-t="dark">Dark</button>
  <span class="sep"></span>
  <button data-z="fit">Fit</button><button data-z="1">100%</button>
  <button data-p="0">Normal</button><button data-p="1">Projector</button>
</div>
<div id="stagewrap"><div id="screen" class="varA"></div></div>
<script>
"""

open('.scratch/milestone-3-knapsack/mock/index.html', 'w', encoding='utf8', newline='\n').write(head + css + bar + js + '\n</script>\n</body>\n</html>\n')
print('written')
