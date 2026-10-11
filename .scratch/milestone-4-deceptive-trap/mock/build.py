src = open('.scratch/milestone-2-target-string-and-links/mock/index.html', encoding='utf8').read()
head = src[: src.index('</style>')]
head = head.replace('Target string – design mock (throwaway)', 'Trap – design mock (throwaway)')
js = open('.scratch/milestone-4-deceptive-trap/mock/trap.js', encoding='utf8').read()

css = """
/* ---------- new for the trap ---------- */
.presetchip { margin-left:14px; font-size:17px; background:var(--chip); color:var(--ink2); border-radius:999px; padding:2px 12px; vertical-align:middle; font-weight:600; }
.menulist { list-style:none; margin:0; padding:6px; min-width:260px; background:var(--surface); border:2px solid var(--ink); border-radius:10px; box-shadow:0 12px 30px rgba(0,0,0,.25); font-size:22px; font-weight:600; }
.menulist li { padding:8px 12px; border-radius:8px; display:flex; gap:10px; }
.menulist li.cur { font-weight:800; background:var(--acc-tint); }
.menulist li span { width:1.2em; }
.ktable td { padding-top:3px; padding-bottom:3px; vertical-align:middle; }
.ktable .num.strong { font-weight:800; }
.ktable .colnote { display:block; font-size:13px; font-weight:400; text-transform:none; letter-spacing:0; color:var(--ink2); }
.ktable th, .ktable td { padding-left:5px; padding-right:5px; }
.ktable .dec { font-size:17px; white-space:nowrap; color:var(--ink2); font-variant-numeric:tabular-nums; }
.ktable td.chr { white-space:nowrap; }
.bit.g { position:relative; border-radius:6px; }
.bit.g em.below { position:absolute; top:100%; left:0; right:0; text-align:center; font-style:normal; }
.bit.g em.below u { text-decoration:none; font-size:10px; color:var(--ink2); font-weight:400; }
.bits.grp .blk { display:inline-flex; gap:2px; position:relative; }
.bits.grp .blk::before { content:""; position:absolute; left:-1px; right:-1px; top:-6px; height:4px; border:2px solid var(--ink2); border-bottom:none; border-radius:4px 4px 0 0; }
/* the block row, printed once above the genes */
.blkhdr { display:flex; align-items:flex-end; margin-top:2px; text-transform:none; letter-spacing:0; font-weight:400; }
.blkhdr .lbl { margin-right:6px; font-size:12px; color:var(--ink2); } .blkhdr .lbl i { font-style:normal; }
.blkrow { display:inline-flex; }
.blkrow .brk { text-align:center; font-size:14px; font-weight:700; color:var(--ink); border-bottom:3px solid var(--ink2); padding-bottom:1px; }
.blkrow.loose .bn { text-align:center; font-size:13px; font-weight:700; font-family:ui-monospace,Consolas,monospace; border-bottom:3px solid var(--ink2); padding-bottom:1px; }
.blkrow.loose .bn.b1 { border-bottom-style:dotted; background:color-mix(in srgb, var(--ink2) 10%, transparent); }
.cline { display:flex; margin-top:2px; font-size:14px; }
.cline.grp { display:inline-flex; }
.cline .cb { text-align:center; white-space:nowrap; font-weight:700; color:var(--ink2); font-variant-numeric:tabular-nums; }
.cline .cb.opt { color:var(--good); } .cline .cb.att { color:var(--flip-ink); }
.cline.text { gap:12px; flex-wrap:nowrap; font-size:13px; }
.cline.text .cb b { font-weight:800; }
.cline.text .cb.vsplit b, .cb.vsplit { color:var(--flip-ink); }
.cb.vB { color:var(--ink2); }
/* crossover view */
.cgrid2 { display:flex; flex-direction:column; gap:8px; margin-top:6px; }
.cbody2 .chrow { display:flex; align-items:center; gap:12px; min-height:36px; }
.chrow .who { width:150px; font-size:16px; color:var(--ink2); flex:none; }
.chrow.marks { min-height:20px; margin-top:-4px; }
.crow2 { margin-bottom:4px; }
.chead { font-weight:700; font-size:15px; text-transform:uppercase; letter-spacing:.04em; color:var(--ink2); margin:4px 0 2px; }
.badge.warn { border-color:var(--flip); color:var(--flip-ink); } .badge.quiet { border-style:dashed; border-color:var(--ink2); color:var(--ink2); font-weight:500; }
.card.ccard { border:2px solid var(--line); border-radius:16px; padding:6px 12px; background:var(--surface); }
.card.ccard.current { border-color:var(--acc); box-shadow:0 0 0 3px var(--acc-tint); }
.card.ccard.pending { border-style:dashed; background:transparent; }
.card.ccard .thead { display:flex; align-items:center; gap:12px; font-size:18px; }
/* mutation cards */
.mcards2 { display:flex; flex-direction:column; gap:10px; margin-top:6px; }
.mcard { border:2px solid var(--line); border-radius:16px; padding:6px 12px; background:var(--surface); }
.mcard.current { border-color:var(--acc); box-shadow:0 0 0 3px var(--acc-tint); }
.mcard .crow { display:flex; align-items:center; gap:12px; }
.mcard .crow .who { width:60px; font-weight:700; font-size:20px; }
.mcard .crow .who.sub { font-weight:400; font-size:15px; }
.mcard .crow.res { margin-top:22px; }
.gcell { display:inline-flex; flex-direction:column; align-items:center; }
.gcell .under { font-size:11px; height:16px; line-height:16px; color:var(--ink2); font-weight:700; font-variant-numeric:tabular-nums; margin-top:2px; }
.gcell .under.flag { outline:2px solid var(--flip); outline-offset:-2px; border-radius:5px; color:var(--flip-ink); padding:0 2px; }
.badge.flip { border-color:var(--flip); background:var(--flip-bg); color:var(--flip-ink); }
/* block states panel */
.bstates { padding:2px 16px 0; }
.bsrow { display:flex; align-items:center; gap:10px; height:26px; font-size:16px; }
.bsrow b { width:70px; font-weight:700; }
.bits.grp .blk:has(.below) { margin-bottom:14px; }
.chrow .badge { white-space:nowrap; }
.bsnum { width:128px; font-size:15px; color:var(--ink2); text-align:right; white-space:nowrap; }
.ktable td.chr > div { display:block; }
.cgrid2 + .key { font-size:16px; margin:2px 0 0; white-space:nowrap; }
.cgrid2 .cbody2 .ctarget { min-height:22px; }
.bsbar { flex:1; display:flex; height:22px; border:2px solid var(--ink2); border-radius:5px; overflow:hidden; background:var(--surface); }
.bsbar .sg { display:flex; align-items:center; justify-content:center; font-style:normal; font-size:14px; font-weight:700; }
.bsbar .sg.opt { background:var(--seq3); color:#fff; }
.bsbar .sg.mid { background:var(--surface); }
.bsbar .sg.att { background:repeating-linear-gradient(135deg, var(--flip) 0 4px, var(--surface) 4px 8px); color:var(--ink); }
.bskey { display:flex; gap:14px; font-size:14px; color:var(--ink2); margin-top:2px; }
/* tabs and the schema tracker */
.tabs { position:absolute; left:16px; top:50px; display:flex; gap:6px; }
.tabs .tab { padding:4px 14px; border:2px solid var(--line); border-radius:10px 10px 0 0; font-size:17px; font-weight:600; color:var(--ink2); }
.tabs .tab.on { border-color:var(--acc); background:var(--acc-tint); color:var(--ink); }
.schema { font-size:18px; }
.schema .srow { display:flex; align-items:center; gap:12px; margin:8px 0; }
.schema input { font:inherit; font-family:ui-monospace,Consolas,monospace; letter-spacing:.06em; border:2px solid var(--ink2); border-radius:6px; background:var(--surface); color:var(--ink); height:34px; padding:0 8px; }
.sfacts { display:flex; gap:28px; color:var(--ink2); font-size:16px; } .sfacts i { font-style:normal; }
.scharts { display:flex; gap:24px; margin-top:6px; } .scharts h3 { margin:0; font-size:17px; } .scharts svg text { fill:var(--ink); } .scharts .gr { stroke:var(--line); }
.schema .sum { margin:6px 0 2px; } .schema .caveat { margin:0; color:var(--ink2); font-size:16px; font-style:italic; }
/* drawer */
.mockdrawer .err { color:var(--flip-ink); font-weight:600; margin:4px 0 0; font-size:17px; }
.trapdef { margin:8px 0; padding:8px 12px; border:2px dashed var(--ink2); border-radius:10px; font-size:16px; line-height:1.3; }
"""

bar = """
</style>
</head>
<body>
<div id="mockbar">
  <b>Trap mock</b>
  <button data-s="cross">Crossover</button>
  <button data-s="mut">Mutation</button>
  <button data-s="schema">Schema tracker</button>
  <button data-s="table">Population (wide)</button>
  <button data-s="menu">Menu</button>
  <button data-s="drawer">Drawer</button>
  <span class="sep"></span>
  <button data-l="tight">Tight</button>
  <button data-l="loose">Loose</button>
  <button data-ls="A">Loose A: block numbers on the genes</button>
  <button data-ls="B">Loose B: genes grouped by block</button>
  <span class="sep"></span>
  <button data-x="0">4 × 5</button><button data-x="2">6 × 5 (30 genes)</button><button data-x="1">8 × 5 (40 genes)</button>
  <button data-bad="0">Drawer ok</button><button data-bad="1">Drawer error</button>
  <span class="sep"></span>
  <button data-t="light">Light</button><button data-t="dark">Dark</button>
  <button data-z="fit">Fit</button><button data-z="1">100%</button>
  <button data-p="0">Normal</button><button data-p="1">Projector</button>
</div>
<div id="stagewrap"><div id="screen"></div></div>
<script>
"""

open('.scratch/milestone-4-deceptive-trap/mock/index.html', 'w', encoding='utf8', newline='\n').write(head + css + bar + js + '\n</script>\n</body>\n</html>\n')
print('written')
