// Builds index.html from the milestone 5 mock's page chrome plus the TSP pieces (thrown away after review).
import fs from 'node:fs';
const base = fs.readFileSync('../../milestone-5-landscape/mock/index.html', 'utf8');
let head = base.slice(0, base.indexOf('</style>'));
head = head.replace('Landscape – design mock (throwaway)', 'TSP – design mock (throwaway)');
const data = fs.readFileSync('tspdata.js', 'utf8');
const js = fs.readFileSync('tsp.js', 'utf8');

const css = `
/* ---------- new for the TSP ---------- */
.pcs { display:inline-flex; flex-wrap:wrap; gap:2px; align-items:center; }
.pcs.nowrap { flex-wrap:nowrap; }
.pc { position:relative; display:inline-flex; align-items:center; justify-content:center; border:1.5px solid var(--ink2); border-radius:5px; background:var(--surface); font-weight:700; font-variant-numeric:tabular-nums; color:var(--ink); box-sizing:border-box; }
.pc.gap { border:none; background:none; color:var(--ink2); font-weight:400; white-space:nowrap; }
.pc.slice { border:2.5px solid var(--ink); background:var(--acc-tint); }
.pc.slicek { border:2.5px dashed var(--ink); background:var(--acc-tint); }
.pc.hatch { background-image:repeating-linear-gradient(135deg, rgba(110,100,150,.38) 0 3px, transparent 3px 6px); }
.pc.mapped { outline:2.5px solid var(--flip); outline-offset:0; }
.pc.mapped::after { content:'↻'; position:absolute; top:-11px; right:-4px; font-size:13px; font-weight:800; color:var(--flip-ink); }
.pc.mutated { background:var(--flip-bg); border-color:var(--flip); color:var(--flip-ink); }
.pc.mutated::after { content:'✱'; position:absolute; top:-12px; left:50%; transform:translateX(-50%); font-size:13px; color:var(--flip-ink); }
.pc.c1 { border-bottom:5px solid var(--ink2); } .pc.c2 { border-bottom:5px dotted var(--ink2); } .pc.c3 { border-bottom:5px dashed var(--ink2); } .pc.c4 { border-bottom:5px double var(--ink2); }
.prow { gap:12px; align-items:center; margin:3px 0; } .prow .who { width:58px; flex:none; }
.cutline { font-size:16px; color:var(--ink2); margin:2px 0 8px; }
.gl2 { font-size:14px; color:var(--ink2); margin:6px 0 0 70px; text-transform:uppercase; letter-spacing:.04em; }
.fillnote { font-size:15px; color:var(--ink2); margin:0 0 4px 70px; }
.maprow { font-size:16px; margin:6px 0 6px 0; line-height:1.3; } .maprow b { color:var(--ink); }
.plain-hatch { font-size:14px; color:var(--ink2); margin-top:6px; line-height:1.3; }
.edgeline { font-size:16px; margin:4px 0 0 70px; } .edgeline .rm { color:var(--flip-ink); font-weight:700; } .edgeline .ad { color:var(--s1); font-weight:700; }
.mrow { display:flex; gap:18px; align-items:flex-start; } .mside { width:280px; } .mside h3 { margin:0 0 4px; font-size:19px; }
.map { border:2px solid var(--line, var(--ink2)); border-radius:8px; display:block; background:var(--surface); }
.atab.st td { padding-right:14px; font-size:17px; } .atab.st .num { text-align:right; font-variant-numeric:tabular-nums; font-weight:700; } .atab.st hr { border:none; border-top:1px solid var(--axis); margin:2px 0; }
.toggles { display:flex; flex-direction:column; gap:6px; margin-top:12px; align-items:flex-start; }
.trunc { display:flex; align-items:center; gap:10px; } .trunc .seq { font-size:15px; white-space:nowrap; font-variant-numeric:tabular-nums; }
.thumb { border:1.5px solid var(--axis); border-radius:6px; background:var(--surface); flex:none; }
.ktable.tsp td, .ktable.tsp th { font-size:18px; } .ktable.tsp td.chr { padding:3px 6px; }
.seldetail { position:absolute; left:6px; right:6px; bottom:6px; border:2px solid var(--acc); background:var(--acc-tint); border-radius:10px; padding:6px 12px; font-size:14px; line-height:1.3; height:104px; overflow:hidden; }
.agree { padding:2px 20px 0; } .agree .spkey { font-size:13px; color:var(--ink2); margin-top:2px; } .agree .sphist { font-size:15px; margin-top:4px; }
.menulist.inst li { white-space:nowrap; align-items:baseline; }
.menulist.inst li.grp { font-size:16px; padding:6px 12px 2px; border-radius:0; } .menulist.inst li .muted { font-weight:400; font-size:16px; margin-left:8px; }
.mockdrawer .ctl label { font-weight:700; }
`;
const bar = `
</style>
</head>
<body>
<div id="mockbar">
  <b>TSP mock</b>
  <button data-s="route">Route map</button>
  <button data-s="cross">Crossover</button>
  <button data-s="mut">Mutation</button>
  <button data-s="mcross">Map: crossover marks</button>
  <button data-s="mmut">Map: mutation marks</button>
  <button data-s="menu">Menu</button>
  <button data-s="drawer">Drawer</button>
  <button data-s="instances">Instances</button>
  <span class="sep"></span>
  <button data-inst="ulysses16">ulysses16</button><button data-inst="berlin52">berlin52</button><button data-inst="kroA100">kroA100</button><button data-inst="circle">Circle</button><button data-inst="clusters">Two clusters</button>
  <span class="sep"></span>
  <button data-op="ox">OX</button><button data-op="pmx">PMX</button><button data-op="cx">CX</button>
  <span class="sep"></span>
  <button data-mop="swap">Swap</button><button data-mop="inversion">Inversion</button><button data-mop="insertion">Insertion</button>
  <span class="sep"></span>
  <button data-lay="trunc">Table: shortened + thumbnail</button><button data-lay="wrap">Table: wrapped</button>
  <button data-opt="1">Optimal tour on</button><button data-opt="0">off</button><button data-heat="1">Edges on</button><button data-heat="0">off</button>
  <button data-t="light">Light</button><button data-t="dark">Dark</button>
  <button data-z="fit">Fit</button><button data-z="1">100%</button>
  <button data-p="0">Normal</button><button data-p="1">Projector</button>
</div>
<div id="stagewrap"><div id="screen"></div></div>
<script>
`;
fs.writeFileSync('index.html', head + css + bar + data + js + '\n</script>\n</body>\n</html>\n');
console.log('written');
